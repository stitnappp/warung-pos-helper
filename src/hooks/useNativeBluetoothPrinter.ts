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

// Get the thermal printer plugin
const getPrinterPlugin = async () => {
  if (!isCapacitor) return null;
  
  try {
    const { CapacitorThermalPrinter } = await import('capacitor-thermal-printer');
    return CapacitorThermalPrinter;
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
      // Get paired devices using capacitor-thermal-printer
      const result = await plugin.listPrinters();
      console.log('[NativeBluetooth] Paired devices:', result);

      const devices = (result.devices || []).map((d: any) => ({
        name: d.name || 'Unknown Device',
        address: d.address,
        id: d.address,
      }));
      
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
    // Remove from localStorage
    savePrinter(null);
    
    setState(prev => ({
      ...prev,
      isConnected: false,
      connectedDevice: null,
    }));

    toast.info('Printer terputus');
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

    const savedPrinter = state.connectedDevice || getSavedPrinter();
    if (!savedPrinter) {
      toast.error('Tidak ada printer tersimpan');
      return false;
    }

    setState(prev => ({ ...prev, isPrinting: true }));

    try {
      const orderDate = format(new Date(order.created_at), 'dd/MM/yyyy HH:mm', { locale: id });
      const paymentLabels: Record<string, string> = {
        cash: 'Tunai',
        qris: 'QRIS',
        transfer: 'Transfer',
        card: 'Kartu',
        ewallet: 'E-Wallet',
      };

      // Build receipt using capacitor-thermal-printer's chain API
      let printer = plugin.begin({ address: savedPrinter.address });
      
      // Header
      printer = printer
        .align('center')
        .bold()
        .doubleWidth()
        .doubleHeight()
        .text('RM MINANG MAIMBAOE\n')
        .clearFormatting()
        .align('center')
        .text('Jln. Gatot Subroto no 10\n')
        .text('depan balai desa Losari Kidul\n')
        .text('Kec Losari Kab Cirebon\n')
        .text('--------------------------------\n');

      // Order info
      printer = printer
        .align('left')
        .text(`No. Order: #${order.id.slice(-6).toUpperCase()}\n`)
        .text(`Tanggal: ${orderDate}\n`);

      if (order.customer_name) {
        printer = printer.text(`Pelanggan: ${order.customer_name}\n`);
      }
      if (tableName) {
        printer = printer.text(`Meja: ${tableName}\n`);
      }
      if (order.payment_method) {
        printer = printer.text(`Pembayaran: ${paymentLabels[order.payment_method] || order.payment_method}\n`);
      }
      if (cashierName) {
        printer = printer.text(`Kasir: ${cashierName}\n`);
      }

      printer = printer.text('--------------------------------\n');

      // Items header
      printer = printer
        .bold()
        .text('Item            Qty      Harga\n')
        .clearFormatting();

      // Items
      for (const item of items) {
        const itemTotal = formatPrice(item.price * item.quantity);
        printer = printer
          .text(`${item.name}\n`)
          .text(`  ${formatPrice(item.price)} x ${item.quantity}    ${itemTotal}\n`);
        
        if (item.notes) {
          printer = printer.text(`  Catatan: ${item.notes}\n`);
        }
      }

      printer = printer.text('--------------------------------\n');

      // Total
      printer = printer
        .bold()
        .doubleWidth()
        .text(`TOTAL: ${formatPrice(order.total)}\n`)
        .clearFormatting();

      // Payment details for cash
      if (receivedAmount && receivedAmount > 0) {
        printer = printer.text(`Tunai: ${formatPrice(receivedAmount)}\n`);
        if (changeAmount && changeAmount > 0) {
          printer = printer
            .bold()
            .text(`Kembalian: ${formatPrice(changeAmount)}\n`)
            .clearFormatting();
        }
      }

      // Notes
      if (order.notes) {
        printer = printer
          .text('--------------------------------\n')
          .text(`Catatan: ${order.notes}\n`);
      }

      // Footer
      printer = printer
        .text('--------------------------------\n')
        .align('center')
        .text('Terima kasih!\n')
        .text('Simpan struk ini\n')
        .text('sebagai bukti pembayaran\n')
        .feed(3)
        .cutPaper();

      // Execute print
      await printer.write();
      
      toast.success('Struk berhasil dicetak!');
      setState(prev => ({ ...prev, isPrinting: false }));
      return true;
    } catch (error: any) {
      console.error('[NativeBluetooth] Print error:', error);
      toast.error(`Gagal mencetak: ${error.message || 'Unknown error'}`);
      setState(prev => ({ ...prev, isPrinting: false }));
      return false;
    }
  }, [state.connectedDevice]);

  return {
    ...state,
    isSupported,
    scanDevices,
    connect,
    disconnect,
    printReceipt,
  };
}
