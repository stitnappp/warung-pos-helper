import { useState, useCallback, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Order, OrderItem } from '@/types/pos';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

// ESC/POS Commands
const ESC = 0x1b;
const GS = 0x1d;

const COMMANDS = {
  INIT: [ESC, 0x40],
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  DOUBLE_HEIGHT: [ESC, 0x21, 0x10],
  NORMAL_SIZE: [ESC, 0x21, 0x00],
  CUT_PAPER: [GS, 0x56, 0x00],
  FEED_LINE: [ESC, 0x64, 0x02],
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
  dataMode: 'string';
  paperSize: '58mm' | '80mm';
}

const STORAGE_KEY = 'connected_printer';
const isNative = Capacitor.isNativePlatform();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const getSavedPrinter = (): BluetoothDevice | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('[NativeBluetooth] Failed to load saved printer:', e);
  }
  return null;
};

const savePrinter = (device: BluetoothDevice | null) => {
  try {
    if (device) localStorage.setItem(STORAGE_KEY, JSON.stringify(device));
    else localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('[NativeBluetooth] Failed to save printer:', e);
  }
};

const getBluetoothSerial = (): any => {
  if (!isNative) return null;
  return (window as any).bluetoothSerial || null;
};

// Some devices load Cordova plugins a bit late; retry a few times before giving up.
const waitForBluetoothSerial = async (maxTries: number = 10): Promise<any | null> => {
  for (let i = 0; i < maxTries; i++) {
    const bt = getBluetoothSerial();
    if (bt) return bt;
    await sleep(250);
  }
  return null;
};

const withTimeout = <T,>(p: Promise<T>, ms: number, message: string): Promise<T> => {
  let t: any;
  const timeout = new Promise<T>((_, reject) => {
    t = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([p.finally(() => clearTimeout(t)), timeout]);
};

const toBinaryString = (bytes: number[]) => {
  // Avoid call stack limits by chunking
  const chunkSize = 1024;
  let out = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    out += String.fromCharCode(...chunk);
  }
  return out;
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
      // IMPORTANT: string mode is the most stable across Android devices/printers
      dataMode: 'string' as const,
      paperSize: '58mm' as const,
    };
  });

  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    const checkSupport = async () => {
      if (!isNative) return;
      const bt = await waitForBluetoothSerial();
      if (bt) {
        setIsSupported(true);
        console.log('[NativeBluetooth] BluetoothSerial plugin available');
      }
    };

    if (isNative) {
      document.addEventListener('deviceready', checkSupport, false);
      checkSupport();
    }
  }, []);

  // Load saved printer + settings from backend
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
        console.debug('[NativeBluetooth] Failed to load settings from backend:', e);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const ensureEnabledAndPermitted = useCallback(async (): Promise<{ bt: any } | null> => {
    const bt = await waitForBluetoothSerial();
    if (!bt) {
      toast.error('Plugin Bluetooth belum siap. Rebuild APK lalu coba lagi.');
      return null;
    }

    // Android 12+ permissions (if the plugin exposes it)
    if (typeof bt.requestPermission === 'function') {
      const ok = await withTimeout(
        new Promise<boolean>((resolve) => {
          bt.requestPermission(
            () => resolve(true),
            () => resolve(false)
          );
        }),
        8000,
        'Permission timeout'
      ).catch(() => false);

      if (!ok) {
        toast.error('Izin Bluetooth ditolak. Aktifkan izin Bluetooth & Lokasi di Pengaturan aplikasi.');
        return null;
      }
    }

    // Ensure Bluetooth enabled
    if (typeof bt.isEnabled === 'function' && typeof bt.enable === 'function') {
      const enabled = await new Promise<boolean>((resolve) => {
        bt.isEnabled(
          () => resolve(true),
          () => resolve(false)
        );
      });

      if (!enabled) {
        const enabledNow = await withTimeout(
          new Promise<boolean>((resolve) => {
            bt.enable(
              () => resolve(true),
              () => resolve(false)
            );
          }),
          12000,
          'Enable bluetooth timeout'
        ).catch(() => false);

        if (!enabledNow) {
          toast.error('Bluetooth tidak aktif. Aktifkan Bluetooth lalu coba lagi.');
          return null;
        }
      }
    }

    return { bt };
  }, []);

  const isCurrentlyConnected = useCallback(async (bt: any): Promise<boolean> => {
    if (!bt || typeof bt.isConnected !== 'function') return false;
    return new Promise<boolean>((resolve) => {
      try {
        bt.isConnected(
          () => resolve(true),
          () => resolve(false)
        );
      } catch {
        resolve(false);
      }
    });
  }, []);

  const safeDisconnect = useCallback(async (bt: any): Promise<void> => {
    if (!bt || typeof bt.disconnect !== 'function') return;
    await new Promise<void>((resolve) => {
      try {
        bt.disconnect(
          () => resolve(),
          () => resolve()
        );
      } catch {
        resolve();
      }
    });
  }, []);

  const scanDevices = useCallback(async () => {
    setState((prev) => ({ ...prev, isScanning: true, devices: [] }));

    try {
      const ensured = await ensureEnabledAndPermitted();
      if (!ensured) {
        setState((prev) => ({ ...prev, isScanning: false }));
        return [] as BluetoothDevice[];
      }

      const { bt } = ensured;
      if (typeof bt.list !== 'function') {
        toast.error('Plugin Bluetooth tidak mendukung list perangkat.');
        setState((prev) => ({ ...prev, isScanning: false }));
        return [] as BluetoothDevice[];
      }

      const normalizeDevice = (d: any): BluetoothDevice => ({
        name: d.name || d.deviceName || d.localName || 'Unknown Device',
        address: (d.address || d.macAddress || d.id || '').toUpperCase(),
        id: (d.address || d.macAddress || d.id || '').toUpperCase(),
        class: d.class || d.deviceClass,
      });

      const devices = await withTimeout(
        new Promise<BluetoothDevice[]>((resolve) => {
          bt.list(
            (deviceList: any[]) => {
              console.log('[NativeBluetooth] Paired list:', deviceList);
              resolve((deviceList || []).map(normalizeDevice).filter((x) => x.address));
            },
            () => resolve([])
          );
        }),
        10000,
        'List perangkat timeout'
      ).catch(() => [] as BluetoothDevice[]);

      setState((prev) => ({ ...prev, devices, isScanning: false }));

      if (devices.length === 0) {
        toast.info('Tidak ada printer ditemukan. Pastikan printer sudah di-pair & izin Bluetooth/Lokasi sudah aktif.');
      } else {
        toast.success(`Ditemukan ${devices.length} perangkat`);
      }

      return devices;
    } catch (e) {
      console.error('[NativeBluetooth] Scan error:', e);
      toast.error('Gagal mencari perangkat Bluetooth');
      setState((prev) => ({ ...prev, isScanning: false }));
      return [] as BluetoothDevice[];
    }
  }, [ensureEnabledAndPermitted]);

  const connect = useCallback(
    async (device: BluetoothDevice) => {
      setState((prev) => ({ ...prev, isConnecting: true }));

      const ensured = await ensureEnabledAndPermitted();
      if (!ensured) {
        setState((prev) => ({ ...prev, isConnecting: false }));
        return false;
      }

      const { bt } = ensured;

      try {
        // If already connected, disconnect first (avoids native crashes on some devices)
        const already = await isCurrentlyConnected(bt);
        if (already) {
          await safeDisconnect(bt);
          await sleep(400);
        }

        const ok = await withTimeout(
          new Promise<boolean>((resolve) => {
            bt.connect(
              device.address,
              () => resolve(true),
              () => resolve(false)
            );
          }),
          12000,
          'Koneksi timeout'
        ).catch(() => false);

        if (!ok) {
          toast.error('Gagal terhubung. Pastikan printer menyala & dekat.');
          setState((prev) => ({ ...prev, isConnecting: false }));
          return false;
        }

        // Save for next time
        savePrinter(device);

        setState((prev) => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          connectedDevice: device,
        }));

        toast.success(`Terhubung ke ${device.name}`);
        return true;
      } catch (e) {
        console.error('[NativeBluetooth] Connect error:', e);
        toast.error('Gagal terhubung ke printer');
        setState((prev) => ({ ...prev, isConnecting: false }));
        return false;
      }
    },
    [ensureEnabledAndPermitted, isCurrentlyConnected, safeDisconnect]
  );

  const disconnect = useCallback(async () => {
    const bt = await waitForBluetoothSerial();
    if (bt) {
      await safeDisconnect(bt);
    }

    savePrinter(null);
    setState((prev) => ({ ...prev, isConnected: false, connectedDevice: null }));
    toast.info('Printer terputus');
  }, [safeDisconnect]);

  const textToBytes = useCallback((text: string): number[] => {
    const encoder = new TextEncoder();
    return Array.from(encoder.encode(text));
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
      const ensured = await ensureEnabledAndPermitted();
      if (!ensured) return false;
      const { bt } = ensured;

      const savedPrinter = state.connectedDevice || getSavedPrinter();
      if (!savedPrinter) {
        toast.error('Tidak ada printer tersimpan. Hubungkan printer terlebih dahulu.');
        return false;
      }

      setState((prev) => ({ ...prev, isPrinting: true }));

      try {
        const already = await isCurrentlyConnected(bt);
        if (!already) {
          const ok = await withTimeout(
            new Promise<boolean>((resolve) => {
              bt.connect(
                savedPrinter.address,
                () => resolve(true),
                () => resolve(false)
              );
            }),
            12000,
            'Koneksi printer timeout'
          ).catch(() => false);

          if (!ok) throw new Error('Gagal terhubung ke printer');
          await sleep(450);
        }

        const data: number[] = [];
        const LINE = '\n';
        const lineWidth = getLineWidth();
        const SEPARATOR = '-'.repeat(lineWidth);

        data.push(...COMMANDS.INIT);

        data.push(...COMMANDS.ALIGN_CENTER);
        data.push(...COMMANDS.BOLD_ON);
        data.push(...COMMANDS.DOUBLE_HEIGHT);
        data.push(...textToBytes('RM MINANG MAIMBAOE' + LINE));

        data.push(...COMMANDS.NORMAL_SIZE);
        data.push(...COMMANDS.BOLD_OFF);
        data.push(...textToBytes('Jln. Gatot Subroto no 10' + LINE));
        data.push(...textToBytes('depan balai desa Losari Kidul' + LINE));
        data.push(...textToBytes('Kec Losari Kab Cirebon' + LINE));
        data.push(...textToBytes(SEPARATOR + LINE));

        data.push(...COMMANDS.ALIGN_LEFT);
        data.push(...textToBytes(padText('No. Order:', '#' + order.id.slice(-6).toUpperCase()) + LINE));
        data.push(
          ...textToBytes(
            padText('Tanggal:', format(new Date(order.created_at), 'dd/MM/yy HH:mm', { locale: id })) + LINE
          )
        );

        if (order.customer_name) data.push(...textToBytes(padText('Pelanggan:', order.customer_name) + LINE));
        if (tableName) data.push(...textToBytes(padText('Meja:', tableName) + LINE));

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

        if (cashierName) data.push(...textToBytes(padText('Kasir:', cashierName) + LINE));
        data.push(...textToBytes(SEPARATOR + LINE));

        data.push(...COMMANDS.BOLD_ON);
        data.push(...textToBytes(padText('Item', 'Qty   Harga') + LINE));
        data.push(...COMMANDS.BOLD_OFF);

        for (const item of items) {
          const itemTotal = formatPrice(item.price * item.quantity);
          data.push(...textToBytes(item.name + LINE));
          data.push(...textToBytes(padText(`  ${formatPrice(item.price)} x ${item.quantity}`, itemTotal) + LINE));
          if (item.notes) data.push(...textToBytes(`  Catatan: ${item.notes}` + LINE));
        }

        data.push(...textToBytes(SEPARATOR + LINE));
        data.push(...COMMANDS.BOLD_ON);
        data.push(...COMMANDS.DOUBLE_HEIGHT);
        data.push(...textToBytes(padText('TOTAL:', formatPrice(order.total)) + LINE));
        data.push(...COMMANDS.NORMAL_SIZE);
        data.push(...COMMANDS.BOLD_OFF);

        if (receivedAmount && receivedAmount > 0) {
          data.push(...textToBytes(padText('Tunai:', formatPrice(receivedAmount)) + LINE));
          if (changeAmount && changeAmount > 0) {
            data.push(...COMMANDS.BOLD_ON);
            data.push(...textToBytes(padText('Kembalian:', formatPrice(changeAmount)) + LINE));
            data.push(...COMMANDS.BOLD_OFF);
          }
        }

        if (order.notes) {
          data.push(...textToBytes(SEPARATOR + LINE));
          data.push(...textToBytes(`Catatan: ${order.notes}` + LINE));
        }

        data.push(...textToBytes(SEPARATOR + LINE));
        data.push(...COMMANDS.ALIGN_CENTER);
        data.push(...textToBytes('Terima kasih!' + LINE));
        data.push(...textToBytes('Simpan struk ini' + LINE));
        data.push(...textToBytes('sebagai bukti pembayaran' + LINE));

        data.push(...COMMANDS.FEED_LINE);
        data.push(...COMMANDS.FEED_LINE);
        data.push(...COMMANDS.CUT_PAPER);

        const payload = toBinaryString(data);

        const writeOk = await withTimeout(
          new Promise<boolean>((resolve) => {
            bt.write(
              payload,
              () => resolve(true),
              () => resolve(false)
            );
          }),
          8000,
          'Write timeout'
        ).catch(() => false);

        if (!writeOk) throw new Error('Gagal mengirim data ke printer');

        toast.success('Struk berhasil dicetak!');
        setState((prev) => ({ ...prev, isPrinting: false }));

        // Disconnect after a short delay (more stable)
        await sleep(300);
        await safeDisconnect(bt);
        setState((prev) => ({ ...prev, isConnected: false }));

        return true;
      } catch (e: any) {
        console.error('[NativeBluetooth] Print error:', e);
        toast.error(`Gagal mencetak: ${e?.message || 'Unknown error'}`);
        setState((prev) => ({ ...prev, isPrinting: false }));

        // Best effort disconnect
        await safeDisconnect(bt);
        return false;
      }
    },
    [ensureEnabledAndPermitted, getLineWidth, isCurrentlyConnected, padText, safeDisconnect, state.connectedDevice, textToBytes]
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
