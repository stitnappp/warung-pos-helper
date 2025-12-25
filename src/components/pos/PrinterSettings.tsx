import { useState, useEffect, useCallback } from 'react';
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

// Dynamic import for capacitor-thermal-printer (more stable than cordova plugin)
let ThermalPrinterPlugin: any = null;

const loadThermalPrinterPlugin = async (): Promise<any> => {
  if (ThermalPrinterPlugin) return ThermalPrinterPlugin;
  
  try {
    const module = await import('capacitor-thermal-printer');
    ThermalPrinterPlugin = module.CapacitorThermalPrinter;
    console.log('[Printer] Capacitor Thermal Printer plugin loaded');
    return ThermalPrinterPlugin;
  } catch (e) {
    console.error('[Printer] Failed to load thermal printer plugin:', e);
    return null;
  }
};

const getBluetoothSerial = (): any => {
  if (!Capacitor.isNativePlatform()) return null;
  return (window as any).bluetoothSerial || null;
};

const listPairedDevices = async (): Promise<BluetoothDevice[]> => {
  const bt = getBluetoothSerial();
  if (!bt || typeof bt.list !== 'function') return [];

  try {
    const list = await new Promise<any[]>((resolve, reject) => {
      bt.list(resolve, reject);
    });

    return (list || [])
      .map((d: any) => ({
        name: d.name || d.deviceName || 'Paired Device',
        address: (d.address || d.id || '').toUpperCase(),
        id: (d.address || d.id || '').toUpperCase(),
      }))
      .filter((d: BluetoothDevice) => !!d.address);
  } catch (e) {
    console.warn('[Printer] Failed to list paired devices via BluetoothSerial:', e);
    return [];
  }
};

// Request Bluetooth & Location permissions for Android 12+
// Note: capacitor-thermal-printer will also request permissions internally on first call.
const requestBluetoothPermissions = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return true;

  try {
    const plugin = await loadThermalPrinterPlugin();
    if (!plugin) return true;

    // Capacitor auto-injects these at runtime for plugins with @Permission annotations,
    // but the library's TS types don't always include them.
    const check = (plugin as any).checkPermissions;
    const request = (plugin as any).requestPermissions;

    if (typeof check === 'function' && typeof request === 'function') {
      const status = await check();
      const values = Object.values(status ?? {});
      const hasDenied = values.some((v) => v === 'denied' || v === 'prompt');
      if (hasDenied) {
        await request();
      }
    }

    return true;
  } catch (e) {
    console.error('[Permission] Error requesting permissions:', e);
    return true;
  }
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const withTimeout = async <T,>(promise: Promise<T>, ms: number, message: string) => {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
};

const connectToPrinterAddress = async (address: string) => {
  const plugin = await loadThermalPrinterPlugin();
  if (!plugin) throw new Error('Plugin printer tidak tersedia. Rebuild aplikasi diperlukan.');

  // connect() sometimes hangs on some Android builds; enforce a timeout so UI doesn't get stuck.
  await withTimeout(
    plugin.connect({ address }),
    12000,
    'Timeout koneksi printer. Pastikan izin "Perangkat di sekitar" aktif dan printer menyala.'
  );
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
  const [connectError, setConnectError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [manualName, setManualName] = useState('');
  const [testPrinting, setTestPrinting] = useState(false);

  const { autoPrintEnabled, loading: autoPrintLoading, toggleAutoPrint } = useAutoPrint();

  // Test print using capacitor-thermal-printer (more stable)
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

    try {
      // Request permissions first (Android 12+)
      await requestBluetoothPermissions();
      setConnectError(null);

      console.log('[Printer] Connecting to:', savedPrinterAddress);
      await connectToPrinterAddress(savedPrinterAddress.trim().toUpperCase());

      const plugin = await loadThermalPrinterPlugin();
      if (!plugin) {
        toast.error('Plugin printer tidak tersedia. Rebuild aplikasi diperlukan.');
        setTestPrinting(false);
        return;
      }

      // Wait for connection to stabilize
      await sleep(500);

      // Build test print content
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

      const lineWidth = 32;
      const separator = '-'.repeat(lineWidth);
      const separator2 = '='.repeat(lineWidth);

      // Use fluent API
      await plugin.begin()
        .align('center')
        .bold()
        .doubleHeight()
        .text('*** TEST PRINT ***\n')
        .clearFormatting()
        .text('\n')
        .text('Printer: ' + (savedPrinterName || 'Unknown') + '\n')
        .text('MAC: ' + savedPrinterAddress + '\n')
        .text('\n')
        .text(separator + '\n')
        .text(dateStr + ' ' + timeStr + '\n')
        .text(separator + '\n')
        .text('\n')
        .bold()
        .text('Koneksi Berhasil!\n')
        .clearFormatting()
        .text('Printer siap digunakan.\n')
        .text('\n')
        .align('left')
        .text(separator2 + '\n')
        .text('\n\n\n')
        .cutPaper()
        .write();

      toast.success('Test print berhasil! Cek printer Anda.');
    } catch (error: any) {
      console.error('Test print error:', error);
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

  // Listen for discovered devices once (avoid duplicate listeners)
  useEffect(() => {
    if (!isNative) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      const plugin = await loadThermalPrinterPlugin();
      if (!plugin || cancelled) return;

      try {
        const handle = await plugin.addListener('discoverDevices', (result: { devices: any[] }) => {
          const mapped = (result.devices || [])
            .map((d: any) => ({
              name: d.name || d.deviceName || 'Unknown Device',
              address: (d.address || d.macAddress || '').toUpperCase(),
              id: (d.address || d.macAddress || '').toUpperCase(),
            }))
            .filter((d: BluetoothDevice) => !!d.address);

          // merge with existing (paired list)
          setDevices((prev) => {
            const byId = new Map<string, BluetoothDevice>();
            for (const p of prev) byId.set(p.id, p);
            for (const n of mapped) byId.set(n.id, n);
            return Array.from(byId.values());
          });
        });

        cleanup = () => handle?.remove?.();
      } catch (e) {
        console.warn('[Printer] Failed to attach discoverDevices listener:', e);
      }
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [isNative]);

  // Scan for devices: show paired devices first, then nearby discovery
  const scanForDevices = async () => {
    if (!isNative) {
      toast.error('Fitur ini hanya tersedia di aplikasi Android');
      return;
    }

    setScanning(true);
    setDevices([]);
    setBluetoothError(null);

    try {
      await requestBluetoothPermissions();

      // 1) Paired devices (this is what users expect after pairing)
      const paired = await listPairedDevices();
      if (paired.length > 0) {
        setDevices(paired);
      }

      // 2) Nearby discovery (printer must be discoverable to appear here)
      const plugin = await loadThermalPrinterPlugin();
      if (plugin) {
        await plugin.startScan();
        await sleep(5000);
        if (plugin.stopScan) await plugin.stopScan();
      }


      if (paired.length === 0) {
        const errorMsg =
          'Bluetooth tidak menemukan perangkat. Jika printer sudah di-pair tapi tidak muncul, gunakan Input Manual MAC Address atau nyalakan mode discoverable di printer.';
        setBluetoothError(errorMsg);
        toast.info(errorMsg);
      } else {
        toast.success('Daftar perangkat diperbarui');
      }
    } catch (error: any) {
      console.error('Error scanning devices:', error);
      const errorMsg = error?.message || 'Gagal membaca perangkat Bluetooth. Coba lagi.';
      setBluetoothError(errorMsg);
      toast.error('Gagal membaca perangkat Bluetooth');
    } finally {
      setScanning(false);
    }
  };

  // Connect to device using capacitor-thermal-printer
  const connectToDevice = async (device: BluetoothDevice) => {
    if (!isNative) {
      toast.error('Fitur ini hanya tersedia di aplikasi Android');
      return;
    }

    const address = (device.address || '').trim().toUpperCase();
    if (!address) {
      toast.error('Alamat printer tidak valid');
      return;
    }

    setConnecting(true);
    setSelectedDevice({ ...device, address });

    try {
      await requestBluetoothPermissions();
      setConnectError(null);

      console.log('[PrinterSettings] Connecting to:', address);
      await connectToPrinterAddress(address);

      await sleep(500);

      // Save printer
      await savePrinter({ ...device, address, id: address });

      toast.success(`Printer tersimpan: ${device.name}`);
    } catch (error: any) {
      console.error('[PrinterSettings] connect error:', error);
      const msg = String(error?.message || 'Gagal terhubung ke printer');
      setConnectError(msg);
      toast.error(`Gagal terhubung: ${msg}`);
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

  // Direct connect using capacitor-thermal-printer
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

    const address = manualAddress.trim().toUpperCase();
    const name = manualName.trim() || 'Printer Bluetooth';

    setConnecting(true);
    toast.info(`Menghubungkan ke ${address}...`);

    try {
      await requestBluetoothPermissions();
      setConnectError(null);

      await connectToPrinterAddress(address);
      await sleep(500);

      const device: BluetoothDevice = {
        name,
        address,
        id: address,
      };

      await savePrinter(device);

      setManualAddress('');
      setManualName('');
      setManualOpen(false);

      toast.success(`Berhasil terhubung ke ${name}! Printer tersimpan.`);
    } catch (error: any) {
      console.error('Direct connect error:', error);
      const msg = String(error?.message || 'Pastikan izin "Perangkat di sekitar" aktif dan printer menyala');
      setConnectError(msg);
      toast.error(`Gagal koneksi: ${msg}`);
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

        {/* Connection Error */}
        {connectError && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Gagal Koneksi</p>
                <p className="text-muted-foreground mt-1">{connectError}</p>
                <p className="text-muted-foreground mt-2">
                  Pastikan izin <span className="font-medium">Perangkat di sekitar</span> aktif, Bluetooth menyala, dan coba ulang.
                </p>
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
