import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Order, OrderItem } from '@/types/pos';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

// ESC/POS Commands
const ESC = 0x1B;
const GS = 0x1D;

const COMMANDS = {
  INIT: [ESC, 0x40], // Initialize printer
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  DOUBLE_HEIGHT: [ESC, 0x21, 0x10],
  NORMAL_SIZE: [ESC, 0x21, 0x00],
  CUT_PAPER: [GS, 0x56, 0x00], // Full cut
  FEED_LINE: [ESC, 0x64, 0x02], // Feed 2 lines
};

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

// Check if running in Capacitor
const isCapacitor = typeof (window as any).Capacitor !== 'undefined';

// BluetoothSerial plugin reference - will be loaded dynamically on native
let BluetoothSerial: any = null;

// Try to get the plugin from Capacitor Plugins registry (native only)
const getBluetoothSerial = () => {
  if (!isCapacitor) return null;
  
  try {
    // On native, the plugin should be available on window.Capacitor.Plugins
    const Capacitor = (window as any).Capacitor;
    if (Capacitor?.Plugins?.BluetoothSerial) {
      BluetoothSerial = Capacitor.Plugins.BluetoothSerial;
      return BluetoothSerial;
    }
  } catch (error) {
    console.error('[NativeBluetooth] Failed to get BluetoothSerial:', error);
  }
  return null;
};

export function useNativeBluetoothPrinter() {
  const [state, setState] = useState<NativeBluetoothState>({
    isConnected: false,
    isConnecting: false,
    isPrinting: false,
    connectedDevice: null,
    devices: [],
    isScanning: false,
  });

  // On web builds, this will always be false
  // On native builds with the plugin installed, it will be true
  const isSupported = isCapacitor && !!getBluetoothSerial();

  const scanDevices = useCallback(async () => {
    const bt = getBluetoothSerial();
    if (!bt) {
      toast.error('Bluetooth tidak tersedia di platform ini');
      return [];
    }

    setState(prev => ({ ...prev, isScanning: true }));

    try {
      // Request enable if not enabled
      const { enabled } = await bt.isEnabled();
      if (!enabled) {
        await bt.enable();
      }

      // Get paired devices
      const { devices: pairedDevices } = await bt.getPairedDevices();
      console.log('[NativeBluetooth] Paired devices:', pairedDevices);

      setState(prev => ({ 
        ...prev, 
        devices: pairedDevices || [],
        isScanning: false 
      }));

      return pairedDevices || [];
    } catch (error: any) {
      console.error('[NativeBluetooth] Scan error:', error);
      toast.error(`Gagal scan: ${error.message}`);
      setState(prev => ({ ...prev, isScanning: false }));
      return [];
    }
  }, []);

  const connect = useCallback(async (device: BluetoothDevice) => {
    const bt = getBluetoothSerial();
    if (!bt) {
      toast.error('Bluetooth tidak tersedia');
      return false;
    }

    setState(prev => ({ ...prev, isConnecting: true }));

    try {
      // Connect to device
      await bt.connect({ address: device.address });
      
      console.log('[NativeBluetooth] Connected to:', device.name);

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
      toast.error(`Gagal connect: ${error.message}`);
      setState(prev => ({ ...prev, isConnecting: false }));
      return false;
    }
  }, []);

  const disconnect = useCallback(async () => {
    const bt = getBluetoothSerial();
    if (!bt) return;

    try {
      await bt.disconnect();
      
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

  const textToBytes = useCallback((text: string): number[] => {
    const encoder = new TextEncoder();
    return Array.from(encoder.encode(text));
  }, []);

  const formatPrice = (price: number): string => {
    const formatted = price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return 'Rp' + formatted;
  };

  const padText = (left: string, right: string, width: number = 32): string => {
    const spaces = width - left.length - right.length;
    return left + ' '.repeat(Math.max(1, spaces)) + right;
  };

  const printReceipt = useCallback(async (
    order: Order,
    items: OrderItem[],
    tableName?: string,
    cashierName?: string,
    receivedAmount?: number,
    changeAmount?: number
  ) => {
    const bt = getBluetoothSerial();
    if (!bt) {
      toast.error('Bluetooth tidak tersedia');
      return false;
    }

    if (!state.isConnected) {
      toast.error('Printer tidak terhubung');
      return false;
    }

    setState(prev => ({ ...prev, isPrinting: true }));

    try {
      const data: number[] = [];
      const LINE = '\n';
      const SEPARATOR = '--------------------------------';

      // Initialize printer
      data.push(...COMMANDS.INIT);

      // Header - Store name (centered, bold, double height)
      data.push(...COMMANDS.ALIGN_CENTER);
      data.push(...COMMANDS.BOLD_ON);
      data.push(...COMMANDS.DOUBLE_HEIGHT);
      data.push(...textToBytes('RM MINANG MAIMBAOE' + LINE));
      
      // Address (normal size)
      data.push(...COMMANDS.NORMAL_SIZE);
      data.push(...COMMANDS.BOLD_OFF);
      data.push(...textToBytes('Jln. Gatot Subroto no 10' + LINE));
      data.push(...textToBytes('depan balai desa Losari Kidul' + LINE));
      data.push(...textToBytes('Kec Losari Kab Cirebon' + LINE));
      data.push(...textToBytes(SEPARATOR + LINE));

      // Order info (left aligned)
      data.push(...COMMANDS.ALIGN_LEFT);
      data.push(...textToBytes(padText('No. Order:', '#' + order.id.slice(-6).toUpperCase()) + LINE));
      data.push(...textToBytes(padText('Tanggal:', format(new Date(order.created_at), 'dd/MM/yy HH:mm', { locale: id })) + LINE));
      
      if (order.customer_name) {
        data.push(...textToBytes(padText('Pelanggan:', order.customer_name) + LINE));
      }
      if (tableName) {
        data.push(...textToBytes(padText('Meja:', tableName) + LINE));
      }
      if (order.payment_method) {
        const paymentLabels: Record<string, string> = {
          cash: 'Tunai',
          qris: 'QRIS',
          transfer: 'Transfer',
          card: 'Kartu',
          ewallet: 'E-Wallet',
        };
        data.push(...textToBytes(padText('Pembayaran:', paymentLabels[order.payment_method] || order.payment_method) + LINE));
      }
      if (cashierName) {
        data.push(...textToBytes(padText('Kasir:', cashierName) + LINE));
      }
      data.push(...textToBytes(SEPARATOR + LINE));

      // Items header
      data.push(...COMMANDS.BOLD_ON);
      data.push(...textToBytes(padText('Item', 'Qty   Harga') + LINE));
      data.push(...COMMANDS.BOLD_OFF);

      // Items
      for (const item of items) {
        const itemTotal = formatPrice(item.price * item.quantity);
        data.push(...textToBytes(item.name + LINE));
        data.push(...textToBytes(padText(`  ${formatPrice(item.price)} x ${item.quantity}`, itemTotal) + LINE));
        if (item.notes) {
          data.push(...textToBytes(`  Catatan: ${item.notes}` + LINE));
        }
      }
      data.push(...textToBytes(SEPARATOR + LINE));

      // Totals
      data.push(...COMMANDS.BOLD_ON);
      data.push(...COMMANDS.DOUBLE_HEIGHT);
      data.push(...textToBytes(padText('TOTAL:', formatPrice(order.total)) + LINE));
      data.push(...COMMANDS.NORMAL_SIZE);
      data.push(...COMMANDS.BOLD_OFF);

      // Payment details for cash
      if (receivedAmount && receivedAmount > 0) {
        data.push(...textToBytes(padText('Tunai:', formatPrice(receivedAmount)) + LINE));
        if (changeAmount && changeAmount > 0) {
          data.push(...COMMANDS.BOLD_ON);
          data.push(...textToBytes(padText('Kembalian:', formatPrice(changeAmount)) + LINE));
          data.push(...COMMANDS.BOLD_OFF);
        }
      }

      // Notes
      if (order.notes) {
        data.push(...textToBytes(SEPARATOR + LINE));
        data.push(...textToBytes(`Catatan: ${order.notes}` + LINE));
      }

      // Footer
      data.push(...textToBytes(SEPARATOR + LINE));
      data.push(...COMMANDS.ALIGN_CENTER);
      data.push(...textToBytes('Terima kasih!' + LINE));
      data.push(...textToBytes('Simpan struk ini' + LINE));
      data.push(...textToBytes('sebagai bukti pembayaran' + LINE));

      // Feed and cut
      data.push(...COMMANDS.FEED_LINE);
      data.push(...COMMANDS.FEED_LINE);
      data.push(...COMMANDS.CUT_PAPER);

      // Convert to base64 for sending
      const uint8Array = new Uint8Array(data);
      const base64Data = btoa(String.fromCharCode(...uint8Array));

      // Send to printer
      await bt.write({ value: base64Data });

      toast.success('Struk berhasil dicetak!');
      setState(prev => ({ ...prev, isPrinting: false }));
      return true;
    } catch (error: any) {
      console.error('[NativeBluetooth] Print error:', error);
      toast.error(`Gagal mencetak: ${error.message}`);
      setState(prev => ({ ...prev, isPrinting: false }));
      return false;
    }
  }, [state.isConnected, textToBytes]);

  return {
    ...state,
    isSupported,
    scanDevices,
    connect,
    disconnect,
    printReceipt,
  };
}
