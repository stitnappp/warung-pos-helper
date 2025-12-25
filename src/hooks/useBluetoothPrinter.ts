import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Order, OrderItem } from '@/types/pos';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

// Web Bluetooth types are available in @types/web-bluetooth

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

interface BluetoothPrinterState {
  device: any | null;
  characteristic: any | null;
  isConnected: boolean;
  isConnecting: boolean;
  isPrinting: boolean;
}

export function useBluetoothPrinter() {
  const [state, setState] = useState<BluetoothPrinterState>({
    device: null,
    characteristic: null,
    isConnected: false,
    isConnecting: false,
    isPrinting: false,
  });

  const connect = useCallback(async () => {
    if (!navigator.bluetooth) {
      toast.error('Browser tidak mendukung Bluetooth. Gunakan Chrome/Edge.');
      return false;
    }

    setState(prev => ({ ...prev, isConnecting: true }));

    try {
      // Request Bluetooth device - common thermal printer service UUIDs
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: ['000018f0-0000-1000-8000-00805f9b34fb'] }, // Common thermal printer
          { namePrefix: 'BlueTooth Printer' },
          { namePrefix: 'Printer' },
          { namePrefix: 'POS' },
          { namePrefix: 'BT' },
        ],
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb',
          '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Nordic UART
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Serial Port
        ],
      });

      console.log('[Bluetooth] Device selected:', device.name);

      const server = await device.gatt?.connect();
      if (!server) throw new Error('Gagal connect ke GATT server');

      // Try to find the printer service
      let characteristic: any | null = null;

      const serviceUUIDs = [
        '000018f0-0000-1000-8000-00805f9b34fb',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455',
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
      ];

      for (const serviceUUID of serviceUUIDs) {
        try {
          const service = await server.getPrimaryService(serviceUUID);
          const characteristics = await service.getCharacteristics();
          
          // Find writable characteristic
          characteristic = characteristics.find(
            c => c.properties.write || c.properties.writeWithoutResponse
          ) || null;

          if (characteristic) {
            console.log('[Bluetooth] Found characteristic:', characteristic.uuid);
            break;
          }
        } catch {
          continue;
        }
      }

      if (!characteristic) {
        throw new Error('Karakteristik printer tidak ditemukan');
      }

      setState({
        device,
        characteristic,
        isConnected: true,
        isConnecting: false,
        isPrinting: false,
      });

      device.addEventListener('gattserverdisconnected', () => {
        setState(prev => ({
          ...prev,
          isConnected: false,
          characteristic: null,
        }));
        toast.info('Printer terputus');
      });

      toast.success(`Terhubung ke ${device.name || 'Printer'}`);
      return true;
    } catch (error: any) {
      console.error('[Bluetooth] Error:', error);
      setState(prev => ({ ...prev, isConnecting: false }));
      
      if (error.name === 'NotFoundError') {
        toast.error('Printer tidak ditemukan atau dibatalkan');
      } else {
        toast.error(`Gagal connect: ${error.message}`);
      }
      return false;
    }
  }, []);

  const disconnect = useCallback(() => {
    if (state.device?.gatt?.connected) {
      state.device.gatt.disconnect();
    }
    setState({
      device: null,
      characteristic: null,
      isConnected: false,
      isConnecting: false,
      isPrinting: false,
    });
    toast.info('Printer disconnected');
  }, [state.device]);

  const sendData = useCallback(async (data: Uint8Array) => {
    if (!state.characteristic) {
      throw new Error('Printer tidak terhubung');
    }

    // Send in chunks of 100 bytes (safe for most printers)
    const chunkSize = 100;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      
      if (state.characteristic.properties.writeWithoutResponse) {
        await state.characteristic.writeValueWithoutResponse(chunk);
      } else {
        await state.characteristic.writeValue(chunk);
      }
      
      // Small delay between chunks
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }, [state.characteristic]);

  const textToBytes = useCallback((text: string): number[] => {
    const encoder = new TextEncoder();
    return Array.from(encoder.encode(text));
  }, []);

  const formatPrice = (price: number): string => {
    // Use simple ASCII format for thermal printer compatibility
    const formatted = price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return 'Rp' + formatted;
  };

  const padText = (left: string, right: string, width: number = 32): string => {
    const spaces = width - left.length - right.length;
    return left + ' '.repeat(Math.max(1, spaces)) + right;
  };

  const centerText = (text: string, width: number = 32): string => {
    const padding = Math.floor((width - text.length) / 2);
    return ' '.repeat(Math.max(0, padding)) + text;
  };

  const printReceipt = useCallback(async (
    order: Order,
    items: OrderItem[],
    tableName?: string
  ) => {
    if (!state.isConnected || !state.characteristic) {
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
      data.push(...textToBytes(padText('Subtotal:', formatPrice(order.subtotal)) + LINE));
      data.push(...textToBytes(padText('Pajak (10%):', formatPrice(order.tax)) + LINE));
      data.push(...COMMANDS.BOLD_ON);
      data.push(...COMMANDS.DOUBLE_HEIGHT);
      data.push(...textToBytes(padText('TOTAL:', formatPrice(order.total)) + LINE));
      data.push(...COMMANDS.NORMAL_SIZE);
      data.push(...COMMANDS.BOLD_OFF);

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

      // Send to printer
      await sendData(new Uint8Array(data));

      toast.success('Struk berhasil dicetak!');
      setState(prev => ({ ...prev, isPrinting: false }));
      return true;
    } catch (error: any) {
      console.error('[Bluetooth] Print error:', error);
      toast.error(`Gagal mencetak: ${error.message}`);
      setState(prev => ({ ...prev, isPrinting: false }));
      return false;
    }
  }, [state.isConnected, state.characteristic, sendData, textToBytes]);

  return {
    ...state,
    connect,
    disconnect,
    printReceipt,
    isSupported: !!navigator.bluetooth,
  };
}