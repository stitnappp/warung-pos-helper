import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Printer, RefreshCw, Loader2, Bluetooth, Check, AlertCircle, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface BluetoothDevice {
  name: string;
  address: string;
  id: string;
  class?: number;
}

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
  const [showManual, setShowManual] = useState(false);
  const [manualAddress, setManualAddress] = useState('');

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
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

  const scanForDevices = async () => {
    if (!isNative) {
      toast.error('Fitur ini hanya tersedia di aplikasi Android');
      return;
    }

    setScanning(true);
    setDevices([]);

    try {
      // Access BluetoothSerial plugin dynamically using registerPlugin pattern
      const { registerPlugin } = await import('@capacitor/core');
      const BluetoothSerial = registerPlugin<any>('BluetoothSerial');

      if (!BluetoothSerial) {
        toast.error('Plugin Bluetooth tidak tersedia');
        setScanning(false);
        return;
      }

      // Check if Bluetooth is enabled
      const { enabled } = await BluetoothSerial.isEnabled();
      if (!enabled) {
        toast.error('Bluetooth tidak aktif. Silahkan aktifkan Bluetooth terlebih dahulu.');
        setScanning(false);
        return;
      }

      // Get paired devices
      const result = await BluetoothSerial.list();
      console.log('Paired devices:', result);

      if (result && result.devices && result.devices.length > 0) {
        // Filter for printer-like devices (often have "Printer", "POS", "RPP", "Thermal" in name)
        const allDevices: BluetoothDevice[] = result.devices.map((d: any) => ({
          name: d.name || 'Unknown Device',
          address: d.address || d.id,
          id: d.id || d.address,
          class: d.class,
        }));

        setDevices(allDevices);
        toast.success(`Ditemukan ${allDevices.length} perangkat Bluetooth yang sudah di-pair`);
      } else {
        toast.info('Tidak ada perangkat Bluetooth yang di-pair. Silahkan pair printer terlebih dahulu di Pengaturan Bluetooth HP.');
      }
    } catch (error) {
      console.error('Error scanning devices:', error);
      toast.error('Gagal mencari perangkat Bluetooth');
    } finally {
      setScanning(false);
    }
  };

  const connectToDevice = async (device: BluetoothDevice) => {
    setConnecting(true);
    setSelectedDevice(device);

    try {
      const { registerPlugin } = await import('@capacitor/core');
      const BluetoothSerial = registerPlugin<any>('BluetoothSerial');

      if (!BluetoothSerial) {
        toast.error('Plugin Bluetooth tidak tersedia');
        return;
      }

      // Try to connect to verify the device is a printer
      await BluetoothSerial.connect({ address: device.address });
      
      toast.success(`Berhasil terhubung ke ${device.name}`);

      // Disconnect after test
      await BluetoothSerial.disconnect();

      // Save the printer
      await savePrinter(device);
    } catch (error) {
      console.error('Error connecting to device:', error);
      toast.error(`Gagal terhubung ke ${device.name}. Pastikan printer menyala dan dalam jangkauan.`);
    } finally {
      setConnecting(false);
      setSelectedDevice(null);
    }
  };

  const connectManualPrinter = async () => {
    const cleanedAddress = manualAddress.trim().toUpperCase();
    
    // Validate MAC address format
    const macRegex = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;
    if (!macRegex.test(cleanedAddress)) {
      toast.error('Format MAC Address tidak valid. Contoh: 00:11:22:33:44:55');
      return;
    }

    setConnecting(true);

    try {
      if (isNative) {
        const { registerPlugin } = await import('@capacitor/core');
        const BluetoothSerial = registerPlugin<any>('BluetoothSerial');

        if (BluetoothSerial) {
          // Try to connect
          await BluetoothSerial.connect({ address: cleanedAddress });
          toast.success('Berhasil terhubung ke printer');
          await BluetoothSerial.disconnect();
        }
      }

      // Save the printer
      const device: BluetoothDevice = {
        name: 'Printer Manual',
        address: cleanedAddress,
        id: cleanedAddress,
      };
      await savePrinter(device);
      setManualAddress('');
      setShowManual(false);
    } catch (error) {
      console.error('Error connecting to manual printer:', error);
      // Still save even if connection fails (user might be in web mode or printer is off)
      const device: BluetoothDevice = {
        name: 'Printer Manual',
        address: cleanedAddress,
        id: cleanedAddress,
      };
      await savePrinter(device);
      setManualAddress('');
      setShowManual(false);
      toast.info('MAC Address disimpan. Printer akan terhubung saat mencetak.');
    } finally {
      setConnecting(false);
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
        {/* Current Saved Printer */}
        {savedPrinterAddress && (
          <div className="bg-accent/20 border border-accent/30 rounded-lg p-4">
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

        {/* Manual MAC Address Input */}
        <Collapsible open={showManual} onOpenChange={setShowManual}>
          <CollapsibleTrigger asChild>
            <Button variant="link" className="w-full text-primary">
              <Link2 className="h-4 w-4 mr-2" />
              {showManual ? 'Sembunyikan' : 'Koneksi Manual'}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 mt-4">
            <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-3">
              <p className="text-muted-foreground">
                Masukkan MAC Address printer RPP02N Anda.
                Lihat di Pengaturan Bluetooth HP → Pilih RPP02N → Lihat detail.
              </p>
              <div className="bg-muted rounded-lg p-3 font-mono text-sm">
                Contoh: 00:11:22:33:44:55
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="00:11:22:33:44:55"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value.toUpperCase())}
                  className="font-mono"
                />
              </div>
              <Button
                onClick={connectManualPrinter}
                disabled={connecting || !manualAddress.trim()}
                className="w-full"
                variant="secondary"
              >
                {connecting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Bluetooth className="h-4 w-4 mr-2" />
                )}
                Hubungkan Printer
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {!isNative && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-600 dark:text-yellow-400">Mode Web</p>
                <p className="text-muted-foreground mt-1">
                  Fitur scan printer otomatis hanya tersedia di aplikasi Android.
                  Gunakan "Koneksi Manual" untuk menyimpan MAC Address printer.
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

        {/* Instructions */}
        <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-3">
          <p className="font-medium">Cara Menghubungkan Printer RPP02N/Eppos:</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Nyalakan printer dan aktifkan Bluetooth di HP</li>
            <li>Buka Pengaturan → Bluetooth di HP</li>
            <li>Pair/Sambungkan dengan printer "RPP02N"</li>
            <li>Kembali ke aplikasi ini</li>
            <li>Tekan "Cari Printer Bluetooth" atau gunakan "Koneksi Manual"</li>
            <li>Untuk koneksi manual: Lihat MAC Address di detail perangkat Bluetooth HP</li>
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
