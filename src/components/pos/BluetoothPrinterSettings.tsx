import { useState } from 'react';
import { useBluetoothPrinter, BluetoothDevice } from '@/hooks/useBluetoothPrinter';
import { Bluetooth, BluetoothSearching, Printer, CheckCircle, XCircle, Loader2, RefreshCw, TestTube, Link } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';

interface BluetoothPrinterSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BluetoothPrinterSettings({ isOpen, onClose }: BluetoothPrinterSettingsProps) {
  const {
    isNative,
    isConnected,
    connectedDevice,
    isScanning,
    isPrinting,
    devices,
    error,
    scanDevices,
    connectPrinter,
    disconnectPrinter,
    testPrint,
  } = useBluetoothPrinter();

  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [showManualConnect, setShowManualConnect] = useState(false);

  const handleScan = async () => {
    await scanDevices();
  };

  const handleConnect = async (device: BluetoothDevice) => {
    setIsConnecting(device.address);
    const success = await connectPrinter(device);
    setIsConnecting(null);

    if (success) {
      toast.success(`Terhubung ke ${device.name}`);
    } else {
      toast.error('Gagal menghubungkan printer');
    }
  };

  const handleManualConnect = async () => {
    if (!manualAddress.trim()) {
      toast.error('Masukkan MAC Address printer');
      return;
    }

    const device: BluetoothDevice = {
      name: 'RPP02N',
      address: manualAddress.trim().toUpperCase(),
    };

    setIsConnecting(device.address);
    const success = await connectPrinter(device);
    setIsConnecting(null);

    if (success) {
      toast.success(`Terhubung ke ${device.name}`);
      setManualAddress('');
      setShowManualConnect(false);
    } else {
      toast.error('Gagal menghubungkan printer. Pastikan MAC Address benar dan printer sudah di-pair.');
    }
  };

  const handleDisconnect = async () => {
    await disconnectPrinter();
    toast.info('Printer terputus');
  };

  const handleTestPrint = async () => {
    setIsTesting(true);
    const success = await testPrint();
    setIsTesting(false);

    if (success) {
      toast.success('Test print berhasil!');
    } else {
      toast.error('Test print gagal');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Bluetooth className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">Printer Bluetooth</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {!isNative ? (
            <div className="text-center py-8">
              <Bluetooth className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Fitur Bluetooth Printer hanya tersedia di aplikasi Android.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Saat ini menggunakan Web Print untuk mencetak struk.
              </p>
            </div>
          ) : (
            <>
              {/* Connection Status */}
              <div className={cn(
                "p-4 rounded-xl flex items-center gap-3",
                isConnected ? "bg-green-500/10 border border-green-500/20" : "bg-muted"
              )}>
                {isConnected ? (
                  <>
                    <CheckCircle className="w-6 h-6 text-green-500" />
                    <div className="flex-1">
                      <p className="font-medium text-green-500">Terhubung</p>
                      <p className="text-sm text-muted-foreground">{connectedDevice?.name}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <BluetoothSearching className="w-6 h-6 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium">Tidak Terhubung</p>
                      <p className="text-sm text-muted-foreground">Cari printer untuk menghubungkan</p>
                    </div>
                  </>
                )}
              </div>

              {/* Action Buttons when connected */}
              {isConnected && (
                <div className="flex gap-2">
                  <button
                    onClick={handleTestPrint}
                    disabled={isTesting || isPrinting}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all",
                      isTesting || isPrinting
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/10 text-primary hover:bg-primary/20 active:scale-95"
                    )}
                  >
                    {isTesting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <TestTube className="w-4 h-4" />
                    )}
                    {isTesting ? 'Printing...' : 'Test Print'}
                  </button>
                  <button
                    onClick={handleDisconnect}
                    className="px-4 py-2.5 text-sm bg-destructive/10 text-destructive rounded-xl hover:bg-destructive/20 transition-colors active:scale-95"
                  >
                    Putuskan
                  </button>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                  {error}
                </div>
              )}

              {/* Scan Button */}
              <button
                onClick={handleScan}
                disabled={isScanning}
                className={cn(
                  "w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all",
                  isScanning
                    ? "bg-muted text-muted-foreground"
                    : "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95"
                )}
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Mencari Printer...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-5 h-5" />
                    Cari Printer Bluetooth
                  </>
                )}
              </button>

              {/* Manual Connect Toggle */}
              <button
                onClick={() => setShowManualConnect(!showManualConnect)}
                className="w-full py-2 text-sm text-primary hover:text-primary/80 flex items-center justify-center gap-1"
              >
                <Link className="w-4 h-4" />
                {showManualConnect ? 'Sembunyikan' : 'Koneksi Manual dengan MAC Address'}
              </button>

              {/* Manual Connect Form */}
              {showManualConnect && (
                <div className="p-4 bg-muted/50 rounded-xl space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Masukkan MAC Address printer RPP02N Anda. Lihat di Pengaturan Bluetooth HP → Pilih RPP02N → Lihat detail.
                  </p>
                  <Input
                    placeholder="Contoh: 00:11:22:33:44:55"
                    value={manualAddress}
                    onChange={(e) => setManualAddress(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <button
                    onClick={handleManualConnect}
                    disabled={isConnecting !== null || !manualAddress.trim()}
                    className={cn(
                      "w-full py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-all",
                      isConnecting !== null || !manualAddress.trim()
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95"
                    )}
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Menghubungkan...
                      </>
                    ) : (
                      <>
                        <Bluetooth className="w-4 h-4" />
                        Hubungkan Printer
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Device List */}
              {devices.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Printer Ditemukan ({devices.length})
                  </p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {devices.map((device) => {
                      const isEppos = device.name.toLowerCase().includes('eppos') ||
                                     device.name.toLowerCase().includes('rpp');
                      const isCurrentlyConnected = connectedDevice?.address === device.address;
                      const isConnectingThis = isConnecting === device.address;

                      return (
                        <button
                          key={device.address}
                          onClick={() => handleConnect(device)}
                          disabled={isCurrentlyConnected || isConnecting !== null}
                          className={cn(
                            "w-full p-3 rounded-xl flex items-center gap-3 text-left transition-all",
                            isCurrentlyConnected
                              ? "bg-green-500/10 border border-green-500/20"
                              : isEppos
                              ? "bg-primary/5 border border-primary/20 hover:bg-primary/10"
                              : "bg-secondary hover:bg-secondary/80",
                            !isCurrentlyConnected && isConnecting === null && "active:scale-95"
                          )}
                        >
                          <Printer className={cn(
                            "w-5 h-5 flex-shrink-0",
                            isEppos ? "text-primary" : "text-muted-foreground"
                          )} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{device.name || 'Unknown Device'}</p>
                              {isEppos && (
                                <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                                  EPPOS
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{device.address}</p>
                          </div>
                          {isCurrentlyConnected && (
                            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                          )}
                          {isConnectingThis && (
                            <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Instructions */}
              <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
                <p><strong>Cara Menghubungkan Printer RPP02N:</strong></p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Nyalakan printer dan aktifkan Bluetooth di HP</li>
                  <li>Buka Pengaturan → Bluetooth di HP</li>
                  <li>Pair/Sambungkan dengan printer "RPP02N"</li>
                  <li>Kembali ke aplikasi ini</li>
                  <li>Tekan "Cari Printer Bluetooth" atau gunakan "Koneksi Manual"</li>
                  <li>Untuk koneksi manual: Lihat MAC Address di detail perangkat Bluetooth HP</li>
                </ol>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
