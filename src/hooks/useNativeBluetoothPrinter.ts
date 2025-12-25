import { useState, useCallback, useEffect } from 'react';
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

// Get BluetoothSerial from Cordova plugins (works with Capacitor)
const getBluetoothSerial = (): any => {
  if (!isCapacitor) return null;
  
  // Cordova plugins are available on window
  const bluetoothSerial = (window as any).bluetoothSerial;
  if (bluetoothSerial) {
    return bluetoothSerial;
  }
  
  return null;
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
  
  const [isSupported, setIsSupported] = useState(false);

  // Check if plugin is available
  useEffect(() => {
    const checkSupport = () => {
      const bt = getBluetoothSerial();
      if (bt) {
        setIsSupported(true);
        console.log('[NativeBluetooth] Cordova BluetoothSerial plugin available');
      } else if (isCapacitor) {
        // Plugin might load later, check again
        const timer = setTimeout(checkSupport, 1000);
        return () => clearTimeout(timer);
      }
    };
    
    if (isCapacitor) {
      // Wait for device ready
      document.addEventListener('deviceready', checkSupport, false);
      // Also check immediately in case device is already ready
      checkSupport();
    }
  }, []);

  const scanDevices = useCallback(async () => {
    const bt = getBluetoothSerial();
    if (!bt) {
      toast.error('Plugin Bluetooth tidak tersedia. Pastikan aplikasi sudah di-build dengan plugin.');
      return [];
    }

    setState(prev => ({ ...prev, isScanning: true, devices: [] }));

    return new Promise<BluetoothDevice[]>((resolve) => {
      // First check if bluetooth is enabled
      bt.isEnabled(
        () => {
          // Bluetooth is enabled, get paired devices
          bt.list(
            (deviceList: any[]) => {
              console.log('[NativeBluetooth] Paired devices:', deviceList);
              
              const devices: BluetoothDevice[] = (deviceList || []).map((d: any) => ({
                name: d.name || 'Unknown Device',
                address: d.address || d.id,
                id: d.address || d.id,
                class: d.class,
              }));
              
              setState(prev => ({ 
                ...prev, 
                devices: devices,
                isScanning: false 
              }));

              if (devices.length === 0) {
                toast.info('Tidak ada perangkat Bluetooth ditemukan. Pastikan printer sudah di-pair di Pengaturan HP.');
              } else {
                toast.success(`Ditemukan ${devices.length} perangkat`);
              }

              resolve(devices);
            },
            (error: any) => {
              console.error('[NativeBluetooth] List error:', error);
              toast.error('Gagal mendapatkan daftar perangkat');
              setState(prev => ({ ...prev, isScanning: false }));
              resolve([]);
            }
          );
        },
        () => {
          // Bluetooth is not enabled, try to enable it
          bt.enable(
            () => {
              toast.info('Bluetooth diaktifkan, mencari perangkat...');
              // Retry scan after enabling
              setTimeout(() => scanDevices().then(resolve), 500);
            },
            (error: any) => {
              console.error('[NativeBluetooth] Enable error:', error);
              toast.error('Gagal mengaktifkan Bluetooth. Aktifkan manual di Pengaturan HP.');
              setState(prev => ({ ...prev, isScanning: false }));
              resolve([]);
            }
          );
        }
      );
    });
  }, []);

  const connect = useCallback(async (device: BluetoothDevice) => {
    const bt = getBluetoothSerial();
    if (!bt) {
      toast.error('Plugin Bluetooth tidak tersedia');
      return false;
    }

    setState(prev => ({ ...prev, isConnecting: true }));

    return new Promise<boolean>((resolve) => {
      bt.connect(
        device.address,
        () => {
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
          resolve(true);
        },
        (error: any) => {
          console.error('[NativeBluetooth] Connect error:', error);
          toast.error(`Gagal terhubung: ${error || 'Unknown error'}`);
          setState(prev => ({ ...prev, isConnecting: false }));
          resolve(false);
        }
      );
    });
  }, []);

  const disconnect = useCallback(async () => {
    const bt = getBluetoothSerial();
    
    if (bt) {
      bt.disconnect(
        () => console.log('[NativeBluetooth] Disconnected'),
        (error: any) => console.error('[NativeBluetooth] Disconnect error:', error)
      );
    }
    
    // Remove from localStorage
    savePrinter(null);
    
    setState(prev => ({
      ...prev,
      isConnected: false,
      connectedDevice: null,
    }));

    toast.info('Printer terputus');
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
      toast.error('Plugin Bluetooth tidak tersedia');
      return false;
    }

    const savedPrinter = state.connectedDevice || getSavedPrinter();
    if (!savedPrinter) {
      toast.error('Tidak ada printer tersimpan. Hubungkan printer terlebih dahulu.');
      return false;
    }

    setState(prev => ({ ...prev, isPrinting: true }));

    return new Promise<boolean>((resolve) => {
      // Connect first, then print
      bt.connect(
        savedPrinter.address,
        () => {
          console.log('[NativeBluetooth] Connected for printing');
          
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

          // Convert to Uint8Array
          const uint8Array = new Uint8Array(data);

          // Send to printer
          bt.write(
            uint8Array.buffer,
            () => {
              console.log('[NativeBluetooth] Print successful');
              toast.success('Struk berhasil dicetak!');
              
              // Disconnect after printing
              bt.disconnect(
                () => console.log('[NativeBluetooth] Disconnected after print'),
                () => {}
              );
              
              setState(prev => ({ ...prev, isPrinting: false }));
              resolve(true);
            },
            (error: any) => {
              console.error('[NativeBluetooth] Write error:', error);
              toast.error(`Gagal mencetak: ${error || 'Unknown error'}`);
              setState(prev => ({ ...prev, isPrinting: false }));
              resolve(false);
            }
          );
        },
        (error: any) => {
          console.error('[NativeBluetooth] Connect for print error:', error);
          toast.error(`Gagal terhubung ke printer: ${error || 'Unknown error'}`);
          setState(prev => ({ ...prev, isPrinting: false }));
          resolve(false);
        }
      );
    });
  }, [state.connectedDevice, textToBytes]);

  return {
    ...state,
    isSupported,
    scanDevices,
    connect,
    disconnect,
    printReceipt,
  };
}
