import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Order, OrderItem } from '@/types/pos';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface BluetoothDevice {
  name: string;
  address: string;
  id: string;
  class?: number;
}

interface NativeBluetoothState {
  isConnected: boolean;
  isConnecting: boolean;
  isPrinting: boolean;
  connectedDevice: BluetoothDevice | null;
  devices: BluetoothDevice[];
  isScanning: boolean;
}

const STORAGE_KEY = 'connected_printer';

// Check if running in Capacitor
const isCapacitor = typeof (window as any).Capacitor !== 'undefined';

// Get saved printer from localStorage
const getSavedPrinter = (): BluetoothDevice | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('[NativeBluetooth] Failed to load saved printer:', e);
  }
  return null;
};

// Save printer to localStorage
const savePrinter = (device: BluetoothDevice | null) => {
  try {
    if (device) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(device));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (e) {
    console.error('[NativeBluetooth] Failed to save printer:', e);
  }
};

// Get the lidta printer plugin
const getPrinterPlugin = async () => {
  if (!isCapacitor) return null;
  
  try {
    const { LidtaCapacitorBlPrinter } = await import('lidta-capacitor-bl-printer');
    return LidtaCapacitorBlPrinter;
  } catch (error) {
    console.error('[NativeBluetooth] Failed to load printer plugin:', error);
    return null;
  }
};

export function useNativeBluetoothPrinter() {
  const [state, setState] = useState<NativeBluetoothState>(() => {
    const savedPrinter = getSavedPrinter();
    return {
      isConnected: false,
      isConnecting: false,
      isPrinting: false,
      connectedDevice: savedPrinter,
      devices: [],
      isScanning: false,
    };
  });
  
  const pluginRef = useRef<any>(null);
  const [isSupported, setIsSupported] = useState(false);

  // Initialize plugin
  useEffect(() => {
    const init = async () => {
      if (!isCapacitor) return;
      
      const plugin = await getPrinterPlugin();
      if (plugin) {
        pluginRef.current = plugin;
        setIsSupported(true);
        console.log('[NativeBluetooth] Plugin loaded successfully');
      }
    };
    init();
  }, []);

  const scanDevices = useCallback(async () => {
    const plugin = pluginRef.current;
    if (!plugin) {
      toast.error('Plugin printer tidak tersedia');
      return [];
    }

    setState(prev => ({ ...prev, isScanning: true, devices: [] }));

    try {
      // Get paired devices
      const result = await plugin.getPairedDevices();
      console.log('[NativeBluetooth] Paired devices:', result);

      const devices = result.devices || [];
      setState(prev => ({ 
        ...prev, 
        devices: devices,
        isScanning: false 
      }));

      if (devices.length === 0) {
        toast.info('Tidak ada perangkat Bluetooth ditemukan. Pastikan printer sudah di-pair.');
      }

      return devices;
    } catch (error: any) {
      console.error('[NativeBluetooth] Scan error:', error);
      toast.error(`Gagal scan: ${error.message || 'Unknown error'}`);
      setState(prev => ({ ...prev, isScanning: false }));
      return [];
    }
  }, []);

  const connect = useCallback(async (device: BluetoothDevice) => {
    const plugin = pluginRef.current;
    if (!plugin) {
      toast.error('Plugin printer tidak tersedia');
      return false;
    }

    setState(prev => ({ ...prev, isConnecting: true }));

    try {
      // Connect to device using lidta plugin
      await plugin.connect({ address: device.address });
      
      console.log('[NativeBluetooth] Connected to:', device.name);

      // Save to localStorage
      savePrinter(device);

      setState(prev => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        connectedDevice: device,
      }));

      toast.success(`Terhubung ke ${device.name}`);
      return true;
    } catch (error: any) {
      console.error('[NativeBluetooth] Connect error:', error);
      toast.error(`Gagal connect: ${error.message || 'Unknown error'}`);
      setState(prev => ({ ...prev, isConnecting: false }));
      return false;
    }
  }, []);

  const disconnect = useCallback(async () => {
    const plugin = pluginRef.current;
    if (!plugin) return;

    try {
      await plugin.disconnect();
      
      // Remove from localStorage
      savePrinter(null);
      
      setState(prev => ({
        ...prev,
        isConnected: false,
        connectedDevice: null,
      }));

      toast.info('Printer terputus');
    } catch (error: any) {
      console.error('[NativeBluetooth] Disconnect error:', error);
    }
  }, []);

  const formatPrice = (price: number): string => {
    const formatted = price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return 'Rp' + formatted;
  };

  const printReceipt = useCallback(async (
    order: Order,
    items: OrderItem[],
    tableName?: string,
    cashierName?: string,
    receivedAmount?: number,
    changeAmount?: number
  ) => {
    const plugin = pluginRef.current;
    if (!plugin) {
      toast.error('Plugin printer tidak tersedia');
      return false;
    }

    if (!state.isConnected && !state.connectedDevice) {
      toast.error('Printer tidak terhubung');
      return false;
    }

    setState(prev => ({ ...prev, isPrinting: true }));

    try {
      // If not connected, try to connect first
      if (!state.isConnected && state.connectedDevice) {
        await plugin.connect({ address: state.connectedDevice.address });
        setState(prev => ({ ...prev, isConnected: true }));
      }

      // Create receipt HTML for printing via html2canvas -> base64
      const receiptHtml = generateReceiptHtml(order, items, tableName, cashierName, receivedAmount, changeAmount);
      
      // Create a temporary div to render the receipt
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = receiptHtml;
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.width = '384px'; // 58mm at ~96dpi
      tempDiv.style.background = 'white';
      tempDiv.style.color = 'black';
      tempDiv.style.fontFamily = 'monospace';
      tempDiv.style.fontSize = '12px';
      tempDiv.style.padding = '10px';
      document.body.appendChild(tempDiv);

      // Use html2canvas to convert to image
      const html2canvasModule = await import('html2canvas');
      const canvas = await html2canvasModule.default(tempDiv, {
        backgroundColor: '#ffffff',
        scale: 2,
      });
      
      // Convert to base64
      const base64Image = canvas.toDataURL('image/png');
      
      // Remove temp div
      document.body.removeChild(tempDiv);

      // Print using lidta plugin
      await plugin.printBase64({
        msg: base64Image,
        align: 1, // center
      });

      // Disconnect after printing
      await plugin.disconnect();
      
      toast.success('Struk berhasil dicetak!');
      setState(prev => ({ ...prev, isPrinting: false, isConnected: false }));
      return true;
    } catch (error: any) {
      console.error('[NativeBluetooth] Print error:', error);
      toast.error(`Gagal mencetak: ${error.message || 'Unknown error'}`);
      setState(prev => ({ ...prev, isPrinting: false }));
      return false;
    }
  }, [state.isConnected, state.connectedDevice]);

  return {
    ...state,
    isSupported,
    scanDevices,
    connect,
    disconnect,
    printReceipt,
  };
}

function generateReceiptHtml(
  order: Order,
  items: OrderItem[],
  tableName?: string,
  cashierName?: string,
  receivedAmount?: number,
  changeAmount?: number
): string {
  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const paymentLabels: Record<string, string> = {
    cash: 'Tunai',
    qris: 'QRIS',
    transfer: 'Transfer',
    card: 'Kartu',
    ewallet: 'E-Wallet',
  };

  const orderDate = format(new Date(order.created_at), 'dd/MM/yyyy HH:mm', { locale: id });

  let html = `
    <div style="text-align: center; font-weight: bold; font-size: 16px; margin-bottom: 8px;">
      RM MINANG MAIMBAOE
    </div>
    <div style="text-align: center; font-size: 10px; margin-bottom: 12px;">
      Jln. Gatot Subroto no 10<br/>
      depan balai desa Losari Kidul<br/>
      Kec Losari Kab Cirebon
    </div>
    <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>
    <div style="font-size: 11px;">
      <div style="display: flex; justify-content: space-between;">
        <span>No. Order:</span>
        <span>#${order.id.slice(-6).toUpperCase()}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Tanggal:</span>
        <span>${orderDate}</span>
      </div>
      ${order.customer_name ? `
      <div style="display: flex; justify-content: space-between;">
        <span>Pelanggan:</span>
        <span>${order.customer_name}</span>
      </div>
      ` : ''}
      ${tableName ? `
      <div style="display: flex; justify-content: space-between;">
        <span>Meja:</span>
        <span>${tableName}</span>
      </div>
      ` : ''}
      ${order.payment_method ? `
      <div style="display: flex; justify-content: space-between;">
        <span>Pembayaran:</span>
        <span>${paymentLabels[order.payment_method] || order.payment_method}</span>
      </div>
      ` : ''}
      ${cashierName ? `
      <div style="display: flex; justify-content: space-between;">
        <span>Kasir:</span>
        <span>${cashierName}</span>
      </div>
      ` : ''}
    </div>
    <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>
    <div style="font-size: 11px;">
      <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 4px;">
        <span>Item</span>
        <span>Qty   Harga</span>
      </div>
  `;

  for (const item of items) {
    html += `
      <div style="margin-bottom: 4px;">
        <div>${item.name}</div>
        <div style="display: flex; justify-content: space-between;">
          <span>  ${formatPrice(item.price)} x ${item.quantity}</span>
          <span>${formatPrice(item.price * item.quantity)}</span>
        </div>
        ${item.notes ? `<div style="font-size: 10px;">  Catatan: ${item.notes}</div>` : ''}
      </div>
    `;
  }

  html += `
    <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>
    <div style="font-weight: bold; font-size: 14px; display: flex; justify-content: space-between;">
      <span>TOTAL:</span>
      <span>${formatPrice(order.total)}</span>
    </div>
  `;

  if (receivedAmount && receivedAmount > 0) {
    html += `
      <div style="display: flex; justify-content: space-between; font-size: 11px;">
        <span>Tunai:</span>
        <span>${formatPrice(receivedAmount)}</span>
      </div>
    `;
    if (changeAmount && changeAmount > 0) {
      html += `
        <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold;">
          <span>Kembalian:</span>
          <span>${formatPrice(changeAmount)}</span>
        </div>
      `;
    }
  }

  if (order.notes) {
    html += `
      <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>
      <div style="font-size: 10px;">Catatan: ${order.notes}</div>
    `;
  }

  html += `
    <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>
    <div style="text-align: center; font-size: 11px;">
      Terima kasih!<br/>
      Simpan struk ini sebagai<br/>
      bukti pembayaran
    </div>
    <div style="height: 20px;"></div>
  `;

  return html;
}
