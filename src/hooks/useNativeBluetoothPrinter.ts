import { useState, useCallback, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Order, OrderItem } from '@/types/pos';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

// Dynamic import for capacitor-thermal-printer
let CapacitorThermalPrinter: any = null;

interface BluetoothDevice {
  name: string;
  address: string;
  id: string;
}

interface NativeBluetoothState {
  isConnected: boolean;
  isConnecting: boolean;
  isPrinting: boolean;
  connectedDevice: BluetoothDevice | null;
  devices: BluetoothDevice[];
  isScanning: boolean;
  paperSize: '58mm' | '80mm';
}

const STORAGE_KEY = 'connected_printer';
const isNative = Capacitor.isNativePlatform();

const getSavedPrinter = (): BluetoothDevice | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('[Printer] Failed to load saved printer:', e);
  }
  return null;
};

const savePrinter = (device: BluetoothDevice | null) => {
  try {
    if (device) localStorage.setItem(STORAGE_KEY, JSON.stringify(device));
    else localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('[Printer] Failed to save printer:', e);
  }
};

// Load the Capacitor Thermal Printer plugin
const loadPlugin = async (): Promise<any> => {
  if (CapacitorThermalPrinter) return CapacitorThermalPrinter;
  
  try {
    const module = await import('capacitor-thermal-printer');
    CapacitorThermalPrinter = module.CapacitorThermalPrinter;
    console.log('[Printer] Plugin loaded successfully');
    return CapacitorThermalPrinter;
  } catch (e) {
    console.error('[Printer] Failed to load plugin:', e);
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
      paperSize: '58mm' as const,
    };
  });

  const [isSupported, setIsSupported] = useState(false);

  // Initialize plugin on mount
  useEffect(() => {
    if (!isNative) return;

    const init = async () => {
      const plugin = await loadPlugin();
      if (plugin) {
        setIsSupported(true);
        
        // Listen for discovered devices
        plugin.addListener('discoverDevices', (result: { devices: any[] }) => {
          console.log('[Printer] Discovered devices:', result.devices);
          const mapped = (result.devices || []).map((d: any) => ({
            name: d.name || 'Unknown Device',
            address: d.address || d.macAddress || '',
            id: d.address || d.macAddress || '',
          })).filter((d: BluetoothDevice) => d.address);
          
          setState(prev => ({ ...prev, devices: mapped }));
        });
      }
    };

    init();
  }, []);

  // Load settings from backend
  useEffect(() => {
    if (!isNative) return;

    let cancelled = false;

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('key, value')
          .in('key', ['printer_address', 'printer_name', 'printer_paper_size']);

        if (error) throw error;

        const map: Record<string, string> = {};
        data?.forEach((item) => {
          map[item.key] = item.value || '';
        });

        const address = (map['printer_address'] || '').trim();
        const name = (map['printer_name'] || 'Printer').trim() || 'Printer';
        const paperSize = (map['printer_paper_size'] || '58mm') as '58mm' | '80mm';

        if (cancelled) return;

        setState((prev) => ({
          ...prev,
          paperSize,
          connectedDevice: address
            ? { name, address: address.toUpperCase(), id: address.toUpperCase() }
            : prev.connectedDevice,
        }));

        if (address && !getSavedPrinter()) {
          savePrinter({ name, address: address.toUpperCase(), id: address.toUpperCase() });
        }
      } catch (e) {
        console.debug('[Printer] Failed to load settings from backend:', e);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  const scanDevices = useCallback(async () => {
    setState(prev => ({ ...prev, isScanning: true, devices: [] }));

    try {
      const plugin = await loadPlugin();
      if (!plugin) {
        toast.error('Plugin printer belum siap');
        setState(prev => ({ ...prev, isScanning: false }));
        return [];
      }

      // Start scanning - devices will be received via listener
      await plugin.startScan();
      
      // Wait a bit for devices to be discovered
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Stop scan
      if (plugin.stopScan) {
        await plugin.stopScan();
      }

      setState(prev => {
        if (prev.devices.length === 0) {
          toast.info('Tidak ada printer ditemukan. Pastikan printer sudah di-pair & menyala.');
        } else {
          toast.success(`Ditemukan ${prev.devices.length} perangkat`);
        }
        return { ...prev, isScanning: false };
      });

      return state.devices;
    } catch (e) {
      console.error('[Printer] Scan error:', e);
      toast.error('Gagal mencari perangkat Bluetooth');
      setState(prev => ({ ...prev, isScanning: false }));
      return [];
    }
  }, [state.devices]);

  const connect = useCallback(async (device: BluetoothDevice) => {
    setState(prev => ({ ...prev, isConnecting: true }));

    try {
      const plugin = await loadPlugin();
      if (!plugin) {
        toast.error('Plugin printer belum siap');
        setState(prev => ({ ...prev, isConnecting: false }));
        return false;
      }

      console.log('[Printer] Connecting to:', device.address);
      
      const result = await plugin.connect({ address: device.address });
      
      if (result === null) {
        toast.error('Gagal terhubung. Pastikan printer menyala & dekat.');
        setState(prev => ({ ...prev, isConnecting: false }));
        return false;
      }

      // Save for next time
      savePrinter(device);

      setState(prev => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        connectedDevice: device,
      }));

      toast.success(`Terhubung ke ${device.name}`);
      return true;
    } catch (e) {
      console.error('[Printer] Connect error:', e);
      toast.error('Gagal terhubung ke printer');
      setState(prev => ({ ...prev, isConnecting: false }));
      return false;
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      const plugin = await loadPlugin();
      if (plugin && plugin.disconnect) {
        await plugin.disconnect();
      }
    } catch (e) {
      console.error('[Printer] Disconnect error:', e);
    }

    savePrinter(null);
    setState(prev => ({ ...prev, isConnected: false, connectedDevice: null }));
    toast.info('Printer terputus');
  }, []);

  const formatPrice = (price: number): string => {
    const formatted = price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return 'Rp' + formatted;
  };

  const getLineWidth = useCallback(() => (state.paperSize === '58mm' ? 32 : 48), [state.paperSize]);

  const padText = useCallback(
    (left: string, right: string, width?: number): string => {
      const w = width ?? getLineWidth();
      const spaces = w - left.length - right.length;
      return left + ' '.repeat(Math.max(1, spaces)) + right;
    },
    [getLineWidth]
  );

  const printReceipt = useCallback(
    async (
      order: Order,
      items: OrderItem[],
      tableName?: string,
      cashierName?: string,
      receivedAmount?: number,
      changeAmount?: number
    ) => {
      const plugin = await loadPlugin();
      if (!plugin) {
        toast.error('Plugin printer belum siap');
        return false;
      }

      const savedPrinter = state.connectedDevice || getSavedPrinter();
      if (!savedPrinter) {
        toast.error('Tidak ada printer tersimpan. Hubungkan printer terlebih dahulu.');
        return false;
      }

      setState(prev => ({ ...prev, isPrinting: true }));

      try {
        // Try to connect if not connected
        const connectResult = await plugin.connect({ address: savedPrinter.address });
        if (connectResult === null) {
          throw new Error('Gagal terhubung ke printer');
        }

        // Build the receipt
        const lineWidth = getLineWidth();
        const SEPARATOR = '-'.repeat(lineWidth);

        const paymentLabels: Record<string, string> = {
          cash: 'Tunai',
          qris: 'QRIS',
          transfer: 'Transfer',
          card: 'Kartu',
          ewallet: 'E-Wallet',
        };

        // Start building receipt using fluent API
        let builder = plugin.begin()
          .align('center')
          .bold()
          .doubleHeight()
          .text('RM MINANG MAIMBAOE\n')
          .clearFormatting()
          .align('center')
          .text('Jln. Gatot Subroto no 10\n')
          .text('depan balai desa Losari Kidul\n')
          .text('Kec Losari Kab Cirebon\n')
          .text(SEPARATOR + '\n')
          .align('left')
          .text(padText('No. Order:', '#' + order.id.slice(-6).toUpperCase()) + '\n')
          .text(padText('Tanggal:', format(new Date(order.created_at), 'dd/MM/yy HH:mm', { locale: id })) + '\n');

        if (order.customer_name) {
          builder = builder.text(padText('Pelanggan:', order.customer_name) + '\n');
        }
        if (tableName) {
          builder = builder.text(padText('Meja:', tableName) + '\n');
        }
        if (order.payment_method) {
          builder = builder.text(padText('Pembayaran:', paymentLabels[order.payment_method] || order.payment_method) + '\n');
        }
        if (cashierName) {
          builder = builder.text(padText('Kasir:', cashierName) + '\n');
        }

        builder = builder
          .text(SEPARATOR + '\n')
          .bold()
          .text('PESANAN:\n')
          .clearFormatting();

        // Items
        for (const item of items) {
          const itemLine = `${item.quantity}x ${item.name}`;
          const priceStr = formatPrice(item.price * item.quantity);
          builder = builder.text(padText(itemLine, priceStr) + '\n');
          
          if (item.notes) {
            builder = builder.text(`   > ${item.notes}\n`);
          }
        }

        builder = builder.text(SEPARATOR + '\n');

        // Totals
        builder = builder
          .text(padText('Subtotal:', formatPrice(order.subtotal)) + '\n')
          .text(padText('Pajak:', formatPrice(order.tax)) + '\n')
          .bold()
          .text(padText('TOTAL:', formatPrice(order.total)) + '\n')
          .clearFormatting();

        if (receivedAmount !== undefined && receivedAmount > 0) {
          builder = builder
            .text(SEPARATOR + '\n')
            .text(padText('Dibayar:', formatPrice(receivedAmount)) + '\n');
          
          if (changeAmount !== undefined && changeAmount > 0) {
            builder = builder.text(padText('Kembali:', formatPrice(changeAmount)) + '\n');
          }
        }

        // Footer
        builder = builder
          .text('\n')
          .align('center')
          .text('Terima Kasih\n')
          .text('Atas Kunjungan Anda\n')
          .text('\n\n\n')
          .cutPaper();

        // Send to printer
        await builder.write();

        setState(prev => ({ ...prev, isPrinting: false }));
        toast.success('Struk berhasil dicetak!');
        return true;
      } catch (e) {
        console.error('[Printer] Print error:', e);
        toast.error('Gagal mencetak: ' + (e instanceof Error ? e.message : 'Unknown error'));
        setState(prev => ({ ...prev, isPrinting: false }));
        return false;
      }
    },
    [state.connectedDevice, getLineWidth, padText]
  );

  return {
    ...state,
    isSupported,
    scanDevices,
    connect,
    disconnect,
    printReceipt,
  };
}
