import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { Printer, RefreshCw, Loader2, Bluetooth, Check, AlertCircle, ChevronDown, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { useAutoPrint } from '@/hooks/useAutoPrint';

interface BluetoothDevice {
  name: string;
  address: string;
  id: string;
  class?: number;
  type?: string;
}

// Get BluetoothSerial from Cordova plugin (works with Capacitor)
const getBluetoothSerial = (): any => {
  if (!Capacitor.isNativePlatform()) return null;
  return (window as any).bluetoothSerial || null;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Some devices load Cordova plugins a bit late; retry a few times before giving up.
const waitForBluetoothSerial = async (maxTries: number = 8): Promise<any | null> => {
  for (let i = 0; i < maxTries; i++) {
    const bt = getBluetoothSerial();
    if (bt) return bt;
    await sleep(350);
  }
  return null;
};

export function PrinterSettings() {
  const [savedPrinterAddress, setSavedPrinterAddress] = useState('');
  const [savedPrinterName, setSavedPrinterName] = useState('');
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<BluetoothDevice | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isNative, setIsNative] = useState(false);
  const [bluetoothError, setBluetoothError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [manualName, setManualName] = useState('');
  const [testPrinting, setTestPrinting] = useState(false);
  
  const { autoPrintEnabled, loading: autoPrintLoading, toggleAutoPrint } = useAutoPrint();
  const testPrint = async () => {
    if (!savedPrinterAddress) {
      toast.error('Tidak ada printer tersimpan');
      return;
    }

    if (!isNative) {
      toast.error('Fitur ini hanya tersedia di aplikasi Android');
      return;
    }

    setTestPrinting(true);

    const bt = getBluetoothSerial();
    if (!bt) {
      toast.error('Plugin Bluetooth belum siap. Pastikan sudah run: npx cap sync android');
      setTestPrinting(false);
      return;
    }

    if (typeof bt.connect !== 'function' || typeof bt.write !== 'function') {
      toast.error('Plugin Bluetooth tidak lengkap. Rebuild aplikasi diperlukan.');
      setTestPrinting(false);
      return;
    }

    // Helper to safely check if connected
    const isConnected = (): Promise<boolean> =>
      new Promise((resolve) => {
        try {
          if (typeof bt.isConnected !== 'function') {
            resolve(false);
            return;
          }
          bt.isConnected(
            () => resolve(true),
            () => resolve(false)
          );
        } catch {
          resolve(false);
        }
      });

    // Helper to safely disconnect
    const safeDisconnect = (): Promise<void> =>
      new Promise((resolve) => {
        try {
          if (typeof bt.disconnect !== 'function') {
            resolve();
            return;
          }
          bt.disconnect(
            () => resolve(),
            () => resolve()
          );
        } catch {
          resolve();
        }
      });

    // Helper to connect with timeout
    const connectWithTimeout = (address: string, timeoutMs: number = 10000): Promise<void> =>
      new Promise((resolve, reject) => {
        let settled = false;
        const timeout = setTimeout(() => {
          if (!settled) {
            settled = true;
            reject(new Error('Koneksi timeout'));
          }
        }, timeoutMs);

        try {
          bt.connect(
            address,
            () => {
              if (!settled) {
                settled = true;
                clearTimeout(timeout);
                resolve();
              }
            },
            (err: any) => {
              if (!settled) {
                settled = true;
                clearTimeout(timeout);
                reject(new Error(typeof err === 'string' ? err : err?.message || 'Gagal terhubung'));
              }
            }
          );
        } catch (e: any) {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            reject(e);
          }
        }
      });

    // Helper to write with timeout
    const writeWithTimeout = (data: any, timeoutMs: number = 5000): Promise<void> =>
      new Promise((resolve, reject) => {
        let settled = false;
        const timeout = setTimeout(() => {
          if (!settled) {
            settled = true;
            reject(new Error('Write timeout'));
          }
        }, timeoutMs);

        try {
          bt.write(
            data,
            () => {
              if (!settled) {
                settled = true;
                clearTimeout(timeout);
                resolve();
              }
            },
            (err: any) => {
              if (!settled) {
                settled = true;
                clearTimeout(timeout);
                reject(new Error(typeof err === 'string' ? err : err?.message || 'Gagal menulis'));
              }
            }
          );
        } catch (e: any) {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            reject(e);
          }
        }
      });

    try {
      // Check if already connected, disconnect first if so
      const alreadyConnected = await isConnected();
      if (alreadyConnected) {
        await safeDisconnect();
        // Wait a moment after disconnect
        await new Promise((r) => setTimeout(r, 500));
      }

      // ESC/POS Commands
      const ESC = '\x1B';
      const GS = '\x1D';
      const INIT = ESC + '@';
      const ALIGN_CENTER = ESC + 'a' + '\x01';
      const ALIGN_LEFT = ESC + 'a' + '\x00';
      const BOLD_ON = ESC + 'E' + '\x01';
      const BOLD_OFF = ESC + 'E' + '\x00';
      const TEXT_DOUBLE = GS + '!' + '\x11';
      const TEXT_NORMAL = GS + '!' + '\x00';
      const CUT = GS + 'V' + '\x00';
      const FEED = '\n';

      const now = new Date();
      const dateStr = now.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      const timeStr = now.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const lineWidth = 32; // Default 58mm printer
      const separator = '-'.repeat(lineWidth);
      const separator2 = '='.repeat(lineWidth);

      let printData = INIT;
      printData += ALIGN_CENTER;
      printData += TEXT_DOUBLE + BOLD_ON;
      printData += '*** TEST PRINT ***' + FEED;
      printData += TEXT_NORMAL + BOLD_OFF;
      printData += FEED;
      printData += 'Printer: ' + (savedPrinterName || 'Unknown') + FEED;
      printData += 'MAC: ' + savedPrinterAddress + FEED;
      printData += FEED;
      printData += separator + FEED;
      printData += dateStr + ' ' + timeStr + FEED;
      printData += separator + FEED;
      printData += FEED;
      printData += BOLD_ON + 'Koneksi Berhasil!' + BOLD_OFF + FEED;
      printData += 'Printer siap digunakan.' + FEED;
      printData += FEED;
      printData += ALIGN_LEFT;
      printData += separator2 + FEED;
      printData += FEED + FEED + FEED;
      printData += CUT;

      // Build send data - always use string for maximum compatibility
      // ArrayBuffer can cause crashes on some Android devices
      const sendData = printData;

      // Connect to printer
      await connectWithTimeout(savedPrinterAddress, 10000);

      // Wait for connection to stabilize
      await new Promise((r) => setTimeout(r, 500));

      // Verify connection before writing
      const connected = await isConnected();
      if (!connected) {
        throw new Error('Koneksi terputus sebelum print');
      }

      // Write data
      await writeWithTimeout(sendData, 5000);

      // Wait a moment before disconnect
      await new Promise((r) => setTimeout(r, 300));

      // Disconnect
      await safeDisconnect();

      toast.success('Test print berhasil! Cek printer Anda.');
    } catch (error: any) {
      console.error('Test print error:', error);
      // Try to disconnect on error
      await safeDisconnect().catch(() => {});
      toast.error('Gagal test print: ' + (error?.message || 'Pastikan printer menyala dan dalam jangkauan'));
    } finally {
      setTestPrinting(false);
    }
  };

  useEffect(() => {
    const isNativePlatform = Capacitor.isNativePlatform();
    setIsNative(isNativePlatform);
    fetchSavedPrinter();
  }, []);

  const fetchSavedPrinter = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['printer_address', 'printer_name']);

      if (error) throw error;

      const configMap: Record<string, string> = {};
      data?.forEach(item => {
        configMap[item.key] = item.value || '';
      });

      setSavedPrinterAddress(configMap['printer_address'] || '');
      setSavedPrinterName(configMap['printer_name'] || '');
    } catch (error) {
      console.error('Error fetching printer config:', error);
    } finally {
      setLoading(false);
    }
  };

  // Request Bluetooth permissions for Android 12+
  const requestBluetoothPermissions = async (): Promise<boolean> => {
    // Method 1: Try cordova-plugin-android-permissions
    const cordova = (window as any).cordova;
    if (cordova?.plugins?.permissions) {
      const permissions = cordova.plugins.permissions;
      const requiredPermissions = [
        'android.permission.BLUETOOTH_CONNECT',
        'android.permission.BLUETOOTH_SCAN',
        'android.permission.BLUETOOTH',
        'android.permission.BLUETOOTH_ADMIN',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
      ];

      return new Promise((resolve) => {
        const requestAllPermissions = () => {
          permissions.requestPermissions(
            requiredPermissions,
            (result: any) => {
              console.log('[BT] Permission request result:', result);
              resolve(result.hasPermission !== false);
            },
            (err: any) => {
              console.warn('[BT] Permission request failed:', err);
              resolve(false);
            }
          );
        };

        // Check if we already have permission
        permissions.checkPermission(
          'android.permission.BLUETOOTH_CONNECT',
          (status: any) => {
            console.log('[BT] Current permission status:', status);
            if (status.hasPermission) {
              resolve(true);
            } else {
              requestAllPermissions();
            }
          },
          () => {
            // If check fails, try requesting anyway
            requestAllPermissions();
          }
        );
      });
    }

    // Method 2: Try navigator.permissions API (limited support)
    if (navigator.permissions) {
      try {
        const btStatus = await (navigator.permissions as any).query({ name: 'bluetooth' }).catch(() => null);
        if (btStatus && btStatus.state === 'granted') {
          console.log('[BT] Navigator permissions granted');
          return true;
        }
      } catch {
        console.log('[BT] Navigator permissions API not available for bluetooth');
      }
    }

    // Method 3: Try BluetoothSerial's own permission check if available
    const bt = getBluetoothSerial();
    if (bt) {
      // Some versions of cordova-plugin-bluetooth-serial have checkPermission
      if (typeof bt.checkPermission === 'function') {
        return new Promise((resolve) => {
          bt.checkPermission(
            () => {
              console.log('[BT] BluetoothSerial checkPermission granted');
              resolve(true);
            },
            () => {
              // Try to request permission
              if (typeof bt.requestPermission === 'function') {
                bt.requestPermission(
                  () => {
                    console.log('[BT] BluetoothSerial requestPermission granted');
                    resolve(true);
                  },
                  (err: any) => {
                    console.warn('[BT] BluetoothSerial requestPermission failed:', err);
                    resolve(false);
                  }
                );
              } else {
                resolve(false);
              }
            }
          );
        });
      }

      // Try enable() which implicitly requests Bluetooth permissions
      if (typeof bt.isEnabled === 'function' && typeof bt.enable === 'function') {
        return new Promise((resolve) => {
          bt.isEnabled(
            () => {
              console.log('[BT] Bluetooth already enabled');
              resolve(true);
            },
            () => {
              console.log('[BT] Bluetooth disabled, trying to enable...');
              bt.enable(
                () => {
                  console.log('[BT] Bluetooth enabled successfully');
                  resolve(true);
                },
                (err: any) => {
                  console.warn('[BT] Failed to enable Bluetooth:', err);
                  // Still return true - maybe it's a permission issue that will show during list()
                  resolve(true);
                }
              );
            }
          );
        });
      }
    }

    // If no permission API available, assume we can proceed and let the actual BT call fail if needed
    console.log('[BT] No permission API available, proceeding anyway');
    return true;
  };

  const scanForDevices = async () => {
    if (!isNative) {
      toast.error('Fitur ini hanya tersedia di aplikasi Android');
      return;
    }

    setScanning(true);
    setDevices([]);
    setBluetoothError(null);

    // Request permissions first for Android 12+
    const hasPermission = await requestBluetoothPermissions();
    if (!hasPermission) {
      const errorMsg = 'Izin Bluetooth ditolak. Buka Pengaturan → Aplikasi → [Nama App] → Izin → Aktifkan Bluetooth.';
      setBluetoothError(errorMsg);
      toast.error(errorMsg);
      setScanning(false);
      return;
    }

    const normalizeDevice = (d: any): BluetoothDevice => ({
      name: d.name || d.deviceName || d.localName || 'Perangkat Tidak Dikenal',
      address: d.address || d.macAddress || d.id || d.uuid || d.deviceId || '',
      id: d.id || d.uuid || d.address || d.macAddress || d.deviceId || '',
      class: d.class || d.deviceClass,
      type: d.type,
    });

    const mergeDevices = (existing: BluetoothDevice[], newDevices: BluetoothDevice[]): BluetoothDevice[] => {
      const map = new Map<string, BluetoothDevice>();
      [...existing, ...newDevices].forEach((d) => {
        if (d.address && d.address.length > 0) {
          map.set(d.address.toUpperCase(), d);
        }
      });
      return Array.from(map.values());
    };

    let foundDevices: BluetoothDevice[] = [];

    const finishScanning = (devs: BluetoothDevice[]) => {
      const validDevices = devs.filter((d) => d.address && d.address.length > 0);
      setDevices(validDevices);

      if (validDevices.length > 0) {
        toast.success(`Ditemukan ${validDevices.length} perangkat Bluetooth`);
      } else {
        const errorMsg = 'Tidak ada perangkat ditemukan. Pastikan printer sudah di-pair di Pengaturan → Bluetooth HP, atau gunakan Input Manual MAC Address.';
        setBluetoothError(errorMsg);
        toast.info(errorMsg);
      }

      setScanning(false);
    };

    const onFail = (err: any) => {
      console.error('Error scanning devices:', err);
      const errStr = typeof err === 'string' ? err : err?.message || '';
      
      if (errStr.includes('BLUETOOTH_CONNECT') || errStr.includes('permission')) {
        const errorMsg = 'Izin Bluetooth diperlukan. Buka Pengaturan HP → Aplikasi → [App ini] → Izin → Aktifkan semua izin Bluetooth.';
        setBluetoothError(errorMsg);
        toast.error(errorMsg);
      } else {
        const errorMsg = errStr || 'Gagal mencari perangkat Bluetooth. Coba gunakan Input Manual MAC Address.';
        setBluetoothError(errorMsg);
        toast.error('Gagal mencari perangkat Bluetooth');
      }
      finishScanning(foundDevices);
    };

    // Method 1: Use Cordova BluetoothSerial plugin (paired devices)
    const tryCordovaBTSerial = (): Promise<BluetoothDevice[]> =>
      new Promise((resolve) => {
        (async () => {
          const bt = await waitForBluetoothSerial();
          if (!bt || typeof bt.list !== 'function') {
            resolve([]);
            return;
          }

          const runList = () =>
            bt.list(
              (deviceList: any[]) => {
                console.log('[BT] Cordova BT Serial list() returned:', deviceList);
                resolve((deviceList || []).map(normalizeDevice));
              },
              (err: any) => {
                console.warn('[BT] Cordova BT Serial list() failed:', err);
                resolve([]);
              }
            );

          // Some Android devices require Bluetooth to be explicitly enabled first
          if (typeof bt.isEnabled === 'function' && typeof bt.enable === 'function') {
            try {
              bt.isEnabled(
                () => runList(),
                () =>
                  bt.enable(
                    async () => {
                      await sleep(600);
                      runList();
                    },
                    () => resolve([])
                  )
              );
            } catch {
              runList();
            }
          } else {
            runList();
          }
        })();
      });

    // Method 3: discoverUnpaired() from Cordova
    const tryDiscoverUnpaired = (): Promise<BluetoothDevice[]> =>
      new Promise((resolve) => {
        const bt = getBluetoothSerial();
        if (!bt || typeof bt.discoverUnpaired !== 'function') {
          resolve([]);
          return;
        }
        const discovered: BluetoothDevice[] = [];
        if (typeof bt.setDeviceDiscoveredListener === 'function') {
          bt.setDeviceDiscoveredListener((device: any) => {
            console.log('[BT] discovered:', device);
            discovered.push(normalizeDevice(device));
          });
        }
        bt.discoverUnpaired(
          (deviceList: any[]) => {
            console.log('[BT] discoverUnpaired() returned:', deviceList);
            const listDevices = (deviceList || []).map(normalizeDevice);
            resolve(mergeDevices(discovered, listDevices));
          },
          (err: any) => {
            console.warn('[BT] discoverUnpaired() failed:', err);
            resolve(discovered);
          }
        );
        setTimeout(() => resolve(discovered), 8000);
      });

    try {
      // Run scanning methods in parallel
      const [cordovaDevs, discoveredDevs] = await Promise.all([
        tryCordovaBTSerial(),
        tryDiscoverUnpaired(),
      ]);

      foundDevices = mergeDevices(cordovaDevs, discoveredDevs);
      finishScanning(foundDevices);
    } catch (e) {
      onFail(e);
    }
  };


  const connectToDevice = async (device: BluetoothDevice) => {
    if (!isNative) {
      toast.error('Fitur ini hanya tersedia di aplikasi Android');
      return;
    }

    const bt = getBluetoothSerial();
    if (!bt) {
      toast.error('Plugin Bluetooth belum siap. Pastikan aplikasi Android sudah di-sync (cap sync) setelah install plugin.');
      return;
    }

    const address = (device.address || '').trim().toUpperCase();
    if (!address) {
      toast.error('Alamat printer tidak valid');
      return;
    }

    setConnecting(true);
    setSelectedDevice({ ...device, address });

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const safeDisconnect = (): Promise<void> =>
      new Promise((resolve) => {
        try {
          if (typeof bt.disconnect !== 'function') {
            resolve();
            return;
          }
          bt.disconnect(() => resolve(), () => resolve());
        } catch {
          resolve();
        }
      });

    const isConnected = (): Promise<boolean> =>
      new Promise((resolve) => {
        try {
          if (typeof bt.isConnected !== 'function') {
            resolve(false);
            return;
          }
          bt.isConnected(
            () => resolve(true),
            () => resolve(false)
          );
        } catch {
          resolve(false);
        }
      });

    const connectWithTimeout = (addr: string, timeoutMs: number = 15000): Promise<void> =>
      new Promise((resolve, reject) => {
        let settled = false;
        const timeout = setTimeout(() => {
          if (!settled) {
            settled = true;
            reject(new Error('Koneksi timeout. Pastikan printer menyala dan sudah di-pair.'));
          }
        }, timeoutMs);

        try {
          bt.connect(
            addr,
            () => {
              if (!settled) {
                settled = true;
                clearTimeout(timeout);
                resolve();
              }
            },
            (err: any) => {
              if (!settled) {
                settled = true;
                clearTimeout(timeout);
                reject(new Error(typeof err === 'string' ? err : err?.message || 'Gagal terhubung'));
              }
            }
          );
        } catch (e: any) {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            reject(e);
          }
        }
      });

    try {
      console.log('[PrinterSettings] connect start', { address, name: device.name });

      // Putuskan koneksi lama dulu (lebih aman daripada connect->disconnect cepat)
      await safeDisconnect();
      await sleep(400);

      // Koneksi
      await connectWithTimeout(address, 15000);
      await sleep(600);

      // Pastikan benar-benar connected
      const ok = await isConnected();
      console.log('[PrinterSettings] connect isConnected', ok);
      if (!ok) throw new Error('Koneksi belum stabil. Coba ulangi.');

      // Simpan printer
      await savePrinter({ ...device, address, id: address });

      // Beri jeda sebelum disconnect (menghindari crash di beberapa device)
      await sleep(600);
      await safeDisconnect();

      toast.success(`Printer tersimpan: ${device.name}`);
    } catch (error: any) {
      console.error('[PrinterSettings] connect error:', error);
      await safeDisconnect().catch(() => {});
      toast.error(`Gagal terhubung: ${error?.message || 'Unknown error'}`);
    } finally {
      setConnecting(false);
      setSelectedDevice(null);
    }
  };

  const savePrinter = async (device: BluetoothDevice) => {
    setSaving(true);

    try {
      // Check if settings exist, if not create them
      const { data: existing } = await supabase
        .from('app_settings')
        .select('key')
        .in('key', ['printer_address', 'printer_name']);

      const existingKeys = existing?.map(e => e.key) || [];

      // Upsert printer_address
      if (existingKeys.includes('printer_address')) {
        await supabase
          .from('app_settings')
          .update({ value: device.address })
          .eq('key', 'printer_address');
      } else {
        await supabase
          .from('app_settings')
          .insert({ key: 'printer_address', value: device.address, description: 'Saved thermal printer MAC address' });
      }

      // Upsert printer_name
      if (existingKeys.includes('printer_name')) {
        await supabase
          .from('app_settings')
          .update({ value: device.name })
          .eq('key', 'printer_name');
      } else {
        await supabase
          .from('app_settings')
          .insert({ key: 'printer_name', value: device.name, description: 'Saved thermal printer name' });
      }

      setSavedPrinterAddress(device.address);
      setSavedPrinterName(device.name);
      toast.success('Printer berhasil disimpan!');
    } catch (error) {
      console.error('Error saving printer:', error);
      toast.error('Gagal menyimpan printer');
    } finally {
      setSaving(false);
    }
  };

  const clearSavedPrinter = async () => {
    setSaving(true);

    try {
      await supabase
        .from('app_settings')
        .update({ value: '' })
        .eq('key', 'printer_address');

      await supabase
        .from('app_settings')
        .update({ value: '' })
        .eq('key', 'printer_name');

      setSavedPrinterAddress('');
      setSavedPrinterName('');
      toast.success('Printer dihapus dari pengaturan');
    } catch (error) {
      console.error('Error clearing printer:', error);
      toast.error('Gagal menghapus printer');
    } finally {
      setSaving(false);
    }
  };

  const handleManualConnect = async () => {
    // Validate MAC address format (XX:XX:XX:XX:XX:XX)
    const macRegex = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
    if (!macRegex.test(manualAddress.trim())) {
      toast.error('Format MAC Address tidak valid. Contoh: 00:11:22:33:44:55');
      return;
    }

    const device: BluetoothDevice = {
      name: manualName.trim() || 'Manual Printer',
      address: manualAddress.trim().toUpperCase(),
      id: manualAddress.trim().toUpperCase(),
    };

    await savePrinter(device);
    setManualAddress('');
    setManualName('');
    setManualOpen(false);
  };

  // Koneksi langsung dengan test koneksi untuk Bluetooth Classic
  const handleDirectConnect = async () => {
    // Validate MAC address format (XX:XX:XX:XX:XX:XX)
    const macRegex = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
    if (!macRegex.test(manualAddress.trim())) {
      toast.error('Format MAC Address tidak valid. Contoh: 00:11:22:33:44:55');
      return;
    }

    if (!isNative) {
      toast.error('Fitur ini hanya tersedia di aplikasi Android');
      return;
    }

    const bt = getBluetoothSerial();
    if (!bt) {
      toast.error('Plugin Bluetooth belum siap. Pastikan aplikasi Android sudah di-sync.');
      return;
    }

    const address = manualAddress.trim().toUpperCase();
    const name = manualName.trim() || 'Printer Bluetooth';

    setConnecting(true);
    toast.info(`Menghubungkan ke ${address}...`);

    // Helper untuk disconnect aman
    const safeDisconnect = (): Promise<void> =>
      new Promise((resolve) => {
        try {
          if (typeof bt.disconnect !== 'function') {
            resolve();
            return;
          }
          bt.disconnect(() => resolve(), () => resolve());
        } catch {
          resolve();
        }
      });

    // Helper untuk connect dengan timeout
    const connectWithTimeout = (addr: string, timeoutMs: number = 15000): Promise<void> =>
      new Promise((resolve, reject) => {
        let settled = false;
        const timeout = setTimeout(() => {
          if (!settled) {
            settled = true;
            reject(new Error('Koneksi timeout. Pastikan printer menyala dan sudah di-pair.'));
          }
        }, timeoutMs);

        try {
          bt.connect(
            addr,
            () => {
              if (!settled) {
                settled = true;
                clearTimeout(timeout);
                resolve();
              }
            },
            (err: any) => {
              if (!settled) {
                settled = true;
                clearTimeout(timeout);
                reject(new Error(typeof err === 'string' ? err : err?.message || 'Gagal terhubung'));
              }
            }
          );
        } catch (e: any) {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            reject(e);
          }
        }
      });

    try {
      // Disconnect dulu jika ada koneksi lama
      await safeDisconnect();
      await new Promise((r) => setTimeout(r, 400));

      // Coba koneksi langsung ke MAC address
      await connectWithTimeout(address, 15000);

      // Tunggu koneksi stabil (hindari connect->disconnect terlalu cepat)
      await new Promise((r) => setTimeout(r, 700));

      const device: BluetoothDevice = {
        name,
        address,
        id: address,
      };

      await savePrinter(device);

      // Baru disconnect setelah tersimpan + jeda
      await new Promise((r) => setTimeout(r, 600));
      await safeDisconnect();

      setManualAddress('');
      setManualName('');
      setManualOpen(false);

      toast.success(`Berhasil terhubung ke ${name}! Printer tersimpan.`);
    } catch (error: any) {
      console.error('Direct connect error:', error);
      await safeDisconnect().catch(() => {});
      toast.error(`Gagal koneksi: ${error?.message || 'Pastikan printer menyala dan sudah di-pair di Bluetooth HP'}`);
    } finally {
      setConnecting(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Printer className="h-5 w-5 text-primary" />
          Pengaturan Printer Thermal
        </CardTitle>
        <CardDescription>
          Hubungkan printer thermal Bluetooth untuk mencetak struk
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Auto Print Toggle */}
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border/50">
          <div className="space-y-0.5">
            <Label htmlFor="auto-print" className="text-base font-medium">
              Auto Print Struk
            </Label>
            <p className="text-sm text-muted-foreground">
              Otomatis cetak struk saat checkout selesai
            </p>
          </div>
          <Switch
            id="auto-print"
            checked={autoPrintEnabled}
            onCheckedChange={async (checked) => {
              const success = await toggleAutoPrint(checked);
              if (success) {
                toast.success(checked ? 'Auto print diaktifkan' : 'Auto print dinonaktifkan');
              } else {
                toast.error('Gagal menyimpan pengaturan');
              }
            }}
            disabled={autoPrintLoading || !savedPrinterAddress}
          />
        </div>

        {!savedPrinterAddress && (
          <p className="text-sm text-muted-foreground text-center">
            Hubungkan printer terlebih dahulu untuk mengaktifkan auto print
          </p>
        )}

        {/* Current Saved Printer */}
        {savedPrinterAddress && (
          <div className="bg-accent/20 border border-accent/30 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent/30 flex items-center justify-center">
                <Check className="h-5 w-5 text-accent" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{savedPrinterName || 'Printer'}</p>
                <p className="text-xs text-muted-foreground font-mono">{savedPrinterAddress}</p>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearSavedPrinter}
                disabled={saving}
                className="text-destructive hover:text-destructive"
              >
                Hapus
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={testPrint}
                disabled={testPrinting || !isNative}
                className="flex-1"
              >
                {testPrinting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4 mr-2" />
                )}
                {testPrinting ? 'Mencetak...' : 'Test Print'}
              </Button>
            </div>
          </div>
        )}

        {/* Scan Button */}
        <Button
          onClick={scanForDevices}
          disabled={scanning || !isNative}
          className="w-full gradient-primary"
          size="lg"
        >
          {scanning ? (
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-5 w-5 mr-2" />
          )}
          {scanning ? 'Mencari Printer...' : 'Cari Printer Bluetooth'}
        </Button>

        {/* Bluetooth Error */}
        {bluetoothError && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Error</p>
                <p className="text-muted-foreground mt-1">{bluetoothError}</p>
              </div>
            </div>
          </div>
        )}

        {!isNative && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-600 dark:text-yellow-400">Mode Web</p>
                <p className="text-muted-foreground mt-1">
                  Fitur scan printer hanya tersedia di aplikasi Android.
                  Silahkan buka aplikasi Android untuk menggunakan fitur ini.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Device List */}
        {devices.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Pilih printer untuk dihubungkan:
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {devices.map((device) => (
                <div
                  key={device.address}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bluetooth className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{device.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{device.address}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => connectToDevice(device)}
                    disabled={connecting}
                    className="gradient-primary"
                  >
                    {connecting && selectedDevice?.address === device.address ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Hubungkan'
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Manual MAC Address Input */}
        <Collapsible open={manualOpen} onOpenChange={setManualOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Koneksi Langsung via MAC Address
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${manualOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-3">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-sm">
              <p className="text-blue-600 dark:text-blue-400 font-medium">Untuk Printer Bluetooth Classic (RPP02N, dll)</p>
              <p className="text-muted-foreground mt-1">
                Masukkan MAC Address printer yang sudah di-pair di Pengaturan Bluetooth HP.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-name">Nama Printer (Opsional)</Label>
              <Input
                id="manual-name"
                placeholder="Contoh: RPP02N"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-address">MAC Address *</Label>
              <Input
                id="manual-address"
                placeholder="Contoh: 00:11:22:33:44:55"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Lihat MAC Address di Pengaturan HP → Bluetooth → Ketuk "i" pada perangkat printer
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleDirectConnect}
                disabled={!manualAddress.trim() || saving || connecting}
                className="flex-1 gradient-primary"
              >
                {connecting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Bluetooth className="h-4 w-4 mr-2" />
                )}
                {connecting ? 'Menghubungkan...' : 'Test & Simpan'}
              </Button>
              <Button
                onClick={handleManualConnect}
                variant="outline"
                disabled={!manualAddress.trim() || saving}
                className="flex-1"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4 mr-2" />
                )}
                Simpan Saja
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Instructions */}
        <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-3">
          <p className="font-medium">Cara Menghubungkan Printer RPP02N/Eppos:</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Nyalakan printer dan aktifkan Bluetooth di HP</li>
            <li>Buka Pengaturan → Bluetooth di HP</li>
            <li>Pair/Sambungkan dengan printer "RPP02N"</li>
            <li>Kembali ke aplikasi ini</li>
            <li>Tekan "Cari Printer Bluetooth"</li>
            <li>Pilih printer dari daftar yang muncul</li>
          </ol>
        </div>

        {/* Troubleshooting */}
        <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-2">
          <p className="font-medium">Printer Tidak Ditemukan?</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Pastikan printer dalam keadaan menyala</li>
            <li>Pastikan Bluetooth HP aktif</li>
            <li>Pastikan printer sudah di-pair di Pengaturan Bluetooth HP</li>
            <li>Coba restart printer dan HP</li>
            <li>Pastikan jarak printer tidak terlalu jauh</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
