import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Printer, RefreshCw, Loader2, Bluetooth, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { useAutoPrint } from '@/hooks/useAutoPrint';

interface BluetoothDevice {
  name: string;
  address: string;
  id: string;
  class?: number;
}

// Get BluetoothSerial plugin
let BluetoothSerial: any = null;

const initBluetoothPlugin = async () => {
  if (!Capacitor.isNativePlatform()) return null;
  
  try {
    const { registerPlugin } = await import('@capacitor/core');
    BluetoothSerial = registerPlugin('BluetoothSerial');
    return BluetoothSerial;
  } catch (error) {
    console.error('Failed to init Bluetooth plugin:', error);
    return null;
  }
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
  
  const { autoPrintEnabled, loading: autoPrintLoading, toggleAutoPrint } = useAutoPrint();

  useEffect(() => {
    const isNativePlatform = Capacitor.isNativePlatform();
    setIsNative(isNativePlatform);
    
    if (isNativePlatform) {
      initBluetoothPlugin();
    }
    
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
    setBluetoothError(null);

    try {
      // Ensure plugin is initialized
      if (!BluetoothSerial) {
        await initBluetoothPlugin();
      }
      
      if (!BluetoothSerial) {
        const errorMsg = 'Plugin BluetoothSerial tidak tersedia. Pastikan aplikasi sudah di-build dengan plugin yang benar.';
        setBluetoothError(errorMsg);
        toast.error(errorMsg);
        setScanning(false);
        return;
      }

      console.log('BluetoothSerial plugin available:', Object.keys(BluetoothSerial));

      // Check if Bluetooth is enabled
      try {
        const enabledResult = await BluetoothSerial.isEnabled();
        console.log('Bluetooth enabled check:', enabledResult);
        
        if (!enabledResult?.enabled && enabledResult !== true) {
          // Try to enable Bluetooth
          try {
            await BluetoothSerial.enable();
            toast.info('Mengaktifkan Bluetooth...');
            // Wait a bit for Bluetooth to enable
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (enableError) {
            console.error('Enable error:', enableError);
            const errorMsg = 'Bluetooth tidak aktif. Silahkan aktifkan Bluetooth di pengaturan HP.';
            setBluetoothError(errorMsg);
            toast.error(errorMsg);
            setScanning(false);
            return;
          }
        }
      } catch (checkError) {
        console.error('Error checking Bluetooth status:', checkError);
        // Continue anyway, some plugins don't have isEnabled
      }

      // Try multiple methods to get paired devices
      let deviceList: any[] = [];
      
      // Method 1: Try list() - most common
      try {
        console.log('Trying BluetoothSerial.list()...');
        const listResult = await BluetoothSerial.list();
        console.log('list() result:', JSON.stringify(listResult));
        
        if (listResult?.devices) {
          deviceList = listResult.devices;
        } else if (Array.isArray(listResult)) {
          deviceList = listResult;
        }
      } catch (listError) {
        console.log('list() failed:', listError);
      }

      // Method 2: Try getBondedDevices() if list() didn't work
      if (deviceList.length === 0) {
        try {
          console.log('Trying BluetoothSerial.getBondedDevices()...');
          const bondedResult = await BluetoothSerial.getBondedDevices();
          console.log('getBondedDevices() result:', JSON.stringify(bondedResult));
          
          if (bondedResult?.devices) {
            deviceList = bondedResult.devices;
          } else if (Array.isArray(bondedResult)) {
            deviceList = bondedResult;
          }
        } catch (bondedError) {
          console.log('getBondedDevices() failed:', bondedError);
        }
      }

      // Method 3: Try getPairedDevices() as last resort
      if (deviceList.length === 0) {
        try {
          console.log('Trying BluetoothSerial.getPairedDevices()...');
          const pairedResult = await BluetoothSerial.getPairedDevices();
          console.log('getPairedDevices() result:', JSON.stringify(pairedResult));
          
          if (pairedResult?.devices) {
            deviceList = pairedResult.devices;
          } else if (Array.isArray(pairedResult)) {
            deviceList = pairedResult;
          }
        } catch (pairedError) {
          console.log('getPairedDevices() failed:', pairedError);
        }
      }

      console.log('Final device list:', deviceList);

      if (deviceList.length > 0) {
        const allDevices: BluetoothDevice[] = deviceList.map((d: any) => ({
          name: d.name || d.deviceName || d.localName || 'Perangkat Tidak Dikenal',
          address: d.address || d.macAddress || d.id || d.uuid || d.deviceId,
          id: d.id || d.uuid || d.address || d.macAddress || d.deviceId,
          class: d.class || d.deviceClass,
        }));

        // Filter out devices without valid address
        const validDevices = allDevices.filter(d => d.address && d.address.length > 0);
        
        setDevices(validDevices);
        toast.success(`Ditemukan ${validDevices.length} perangkat Bluetooth`);
      } else {
        const errorMsg = 'Tidak ada perangkat Bluetooth yang di-pair. Pair printer terlebih dahulu di Pengaturan → Bluetooth HP.';
        setBluetoothError(errorMsg);
        toast.info(errorMsg);
      }
    } catch (error: any) {
      console.error('Error scanning devices:', error);
      const errorMsg = error?.message || 'Gagal mencari perangkat Bluetooth. Coba restart aplikasi.';
      setBluetoothError(errorMsg);
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
