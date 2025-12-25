import { useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Receipt } from './Receipt';
import { Order } from '@/types/pos';
import { useOrderItems } from '@/hooks/useOrders';
import { useTables } from '@/hooks/useTables';
import { useBluetoothPrinter } from '@/hooks/useBluetoothPrinter';
import { useNativeBluetoothPrinter } from '@/hooks/useNativeBluetoothPrinter';
import { useCurrentUserProfile } from '@/hooks/useUserProfile';
import { Printer, X, Loader2, Bluetooth, BluetoothConnected, BluetoothOff, CheckCircle, Share2, Download, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ReceiptDialogProps {
  open: boolean;
  onClose: () => void;
  order: Order | null;
  onCompleteOrder?: (orderId: string) => void;
  receivedAmount?: number;
  changeAmount?: number;
}

// Detect if running in Capacitor (Android)
const isCapacitor = typeof (window as any).Capacitor !== 'undefined';

export function ReceiptDialog({ open, onClose, order, onCompleteOrder, receivedAmount, changeAmount }: ReceiptDialogProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const { data: orderItems = [], isLoading } = useOrderItems(order?.id || '');
  const { data: tables = [] } = useTables();
  const { data: currentUserProfile } = useCurrentUserProfile();
  const webBluetooth = useBluetoothPrinter();
  const nativeBluetooth = useNativeBluetoothPrinter();
  const [isPrinted, setIsPrinted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDeviceList, setShowDeviceList] = useState(false);

  const tableName = order?.table_id 
    ? tables.find(t => t.id === order.table_id)?.table_number 
    : undefined;
  
  const cashierName = currentUserProfile?.full_name || undefined;

  // Use native bluetooth on Capacitor, web bluetooth on browser
  const bluetooth = isCapacitor ? nativeBluetooth : webBluetooth;

  const generateReceiptImage = async (): Promise<Blob | null> => {
    if (!receiptRef.current) return null;
    
    try {
      const html2canvasModule = await import('html2canvas');
      const canvas = await html2canvasModule.default(receiptRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
      });
      
      return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png');
      });
    } catch (error) {
      console.error('Error generating receipt image:', error);
      return null;
    }
  };

  const handleShareReceipt = async () => {
    if (!order || !receiptRef.current) return;
    
    setIsProcessing(true);
    
    try {
      const blob = await generateReceiptImage();
      if (!blob) throw new Error('Failed to generate image');
      
      const fileName = 'struk-' + order.id.slice(-6).toUpperCase() + '.png';
      const file = new File([blob], fileName, { type: 'image/png' });
      
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Struk RM MINANG MAIMBAOE',
        });
        setIsPrinted(true);
        if (onCompleteOrder) onCompleteOrder(order.id);
        toast.success('Struk berhasil dibagikan!');
      } else {
        const dataUrl = URL.createObjectURL(blob);
        downloadImage(dataUrl, fileName);
        URL.revokeObjectURL(dataUrl);
      }
    } catch (error) {
      console.error('Share error:', error);
      if ((error as Error).name !== 'AbortError') {
        toast.error('Gagal membagikan struk');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadImage = (dataUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    link.click();
    setIsPrinted(true);
    if (order && onCompleteOrder) onCompleteOrder(order.id);
    toast.success('Struk berhasil diunduh!');
  };

  const handleDownloadReceipt = async () => {
    if (!order || !receiptRef.current) return;
    
    setIsProcessing(true);
    
    try {
      const html2canvasModule = await import('html2canvas');
      const canvas = await html2canvasModule.default(receiptRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
      });
      
      const dataUrl = canvas.toDataURL('image/png');
      const fileName = 'struk-' + order.id.slice(-6).toUpperCase() + '.png';
      downloadImage(dataUrl, fileName);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Gagal mengunduh struk');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBrowserPrint = () => {
    if (!receiptRef.current || !order) return;

    const printContent = receiptRef.current.innerHTML;
    const printWindow = window.open('', '', 'width=350,height=600');
    
    if (printWindow) {
      printWindow.document.write(
        '<!DOCTYPE html><html><head><title>Struk</title>' +
        '<style>*{margin:0;padding:0;box-sizing:border-box;}' +
        'body{font-family:monospace;font-size:12px;padding:10px;background:white;color:black;}' +
        'table{width:100%;border-collapse:collapse;}' +
        '.text-center{text-align:center;}.text-right{text-align:right;}' +
        '.font-bold{font-weight:bold;}.text-xs{font-size:10px;}.text-xl{font-size:18px;}' +
        '.border-b{border-bottom:1px dashed #999;}.border-t{border-top:1px dashed #999;}' +
        '.pb-4{padding-bottom:16px;}.mb-4{margin-bottom:16px;}.mt-1{margin-top:4px;}' +
        '</style></head><body>' + printContent + '</body></html>'
      );
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
      
      setIsPrinted(true);
      if (onCompleteOrder) {
        onCompleteOrder(order.id);
        toast.success('Pesanan selesai!');
      }
    }
  };

  const handleScanDevices = async () => {
    if (isCapacitor && nativeBluetooth.isSupported) {
      setShowDeviceList(true);
      await nativeBluetooth.scanDevices();
    }
  };

  const handleConnectDevice = async (device: { name: string; address: string; id: string }) => {
    const success = await nativeBluetooth.connect(device);
    if (success) {
      setShowDeviceList(false);
    }
  };

  const handleBluetoothPrint = async () => {
    if (!order) return;

    if (isCapacitor) {
      // Native Capacitor Bluetooth
      if (!nativeBluetooth.isConnected) {
        // Show device list to connect first
        handleScanDevices();
        return;
      }

      const success = await nativeBluetooth.printReceipt(order, orderItems, tableName, cashierName, receivedAmount, changeAmount);
      
      if (success) {
        setIsPrinted(true);
        if (onCompleteOrder) {
          onCompleteOrder(order.id);
          toast.success('Pesanan selesai!');
        }
      }
    } else {
      // Web Bluetooth
      if (!webBluetooth.isConnected) {
        const connected = await webBluetooth.connect();
        if (!connected) return;
      }

      const success = await webBluetooth.printReceipt(order, orderItems, tableName, cashierName, receivedAmount, changeAmount);
      
      if (success) {
        setIsPrinted(true);
        if (onCompleteOrder) {
          onCompleteOrder(order.id);
          toast.success('Pesanan selesai!');
        }
      }
    }
  };

  const handleClose = () => {
    setIsPrinted(false);
    setShowDeviceList(false);
    onClose();
  };

  if (!order) return null;

  const isBluetoothSupported = isCapacitor ? nativeBluetooth.isSupported : webBluetooth.isSupported;
  const isBluetoothConnected = isCapacitor ? nativeBluetooth.isConnected : webBluetooth.isConnected;
  const isBluetoothConnecting = isCapacitor ? nativeBluetooth.isConnecting : webBluetooth.isConnecting;
  const isPrinting = isCapacitor ? nativeBluetooth.isPrinting : webBluetooth.isPrinting;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isPrinted ? (
              <CheckCircle className="h-5 w-5 text-accent" />
            ) : (
              <Printer className="h-5 w-5" />
            )}
            {isPrinted ? 'Pesanan Selesai' : 'Struk Pesanan'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center py-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Memuat data...
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden shadow-sm max-h-[40vh] overflow-y-auto bg-white">
              <Receipt
                ref={receiptRef}
                order={order}
                items={orderItems}
                tableName={tableName}
                cashierName={cashierName}
                receivedAmount={receivedAmount}
                changeAmount={changeAmount}
              />
            </div>
          )}
        </div>

        {isPrinted && (
          <div className="bg-accent/20 text-accent-foreground p-3 rounded-lg text-center mb-2">
            <CheckCircle className="h-6 w-6 mx-auto mb-1 text-accent" />
            <p className="text-sm font-medium">Struk berhasil dicetak/dibagikan</p>
          </div>
        )}

        {/* Device List for Native Bluetooth */}
        {showDeviceList && isCapacitor && (
          <div className="border rounded-lg p-3 mb-2 bg-muted/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Pilih Printer</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowDeviceList(false)}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {nativeBluetooth.isScanning ? (
              <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Mencari perangkat...</span>
              </div>
            ) : nativeBluetooth.devices.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-2">Tidak ada printer ditemukan</p>
                <Button variant="outline" size="sm" onClick={handleScanDevices}>
                  <Search className="h-4 w-4 mr-2" />
                  Scan Ulang
                </Button>
              </div>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {nativeBluetooth.devices.map((device) => (
                  <Button
                    key={device.address}
                    variant="ghost"
                    className="w-full justify-start h-auto py-2"
                    onClick={() => handleConnectDevice(device)}
                    disabled={nativeBluetooth.isConnecting}
                  >
                    <Bluetooth className="h-4 w-4 mr-2 text-primary" />
                    <div className="text-left">
                      <p className="text-sm font-medium">{device.name || 'Unknown Device'}</p>
                      <p className="text-xs text-muted-foreground">{device.address}</p>
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bluetooth Status */}
        {isBluetoothSupported && !isPrinted && !showDeviceList && (
          <div className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-lg mb-2">
            <div className="flex items-center gap-2">
              {isBluetoothConnected ? (
                <BluetoothConnected className="h-4 w-4 text-accent" />
              ) : (
                <BluetoothOff className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm">
                {isBluetoothConnecting 
                  ? 'Menghubungkan...' 
                  : isBluetoothConnected 
                    ? isCapacitor && nativeBluetooth.connectedDevice 
                      ? `${nativeBluetooth.connectedDevice.name}` 
                      : 'Printer terhubung'
                    : 'Printer tidak terhubung'}
              </span>
            </div>
            {isBluetoothConnected && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => isCapacitor ? nativeBluetooth.disconnect() : webBluetooth.disconnect()}
                className="text-xs h-7"
              >
                Putuskan
              </Button>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {isPrinted ? (
            <Button onClick={handleClose} className="gradient-primary w-full">
              <CheckCircle className="h-4 w-4 mr-2" />
              Selesai
            </Button>
          ) : (
            <>
              {/* Thermal Printer Button - Primary on both platforms */}
              {isBluetoothSupported && (
                <Button 
                  onClick={handleBluetoothPrint} 
                  disabled={isLoading || isPrinting || isBluetoothConnecting}
                  className={cn(
                    "w-full",
                    isBluetoothConnected ? "gradient-primary" : "bg-primary/80 hover:bg-primary"
                  )}
                >
                  {isPrinting || isBluetoothConnecting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Bluetooth className="h-4 w-4 mr-2" />
                  )}
                  {isBluetoothConnected ? 'Cetak Thermal ESC/POS' : 'Hubungkan Printer Thermal'}
                </Button>
              )}

              {/* Share option */}
              <Button 
                onClick={handleShareReceipt} 
                disabled={isLoading || isProcessing}
                variant="secondary"
                className="w-full"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Share2 className="h-4 w-4 mr-2" />
                )}
                Bagikan Struk
              </Button>

              {/* Download option */}
              <Button 
                onClick={handleDownloadReceipt} 
                disabled={isLoading || isProcessing}
                variant="outline"
                className="w-full"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Unduh Gambar Struk
              </Button>

              {/* Browser print - only on web */}
              {!isCapacitor && (
                <Button onClick={handleBrowserPrint} disabled={isLoading} variant="outline">
                  <Printer className="h-4 w-4 mr-2" />
                  Cetak Browser
                </Button>
              )}
              
              <Button variant="ghost" onClick={handleClose} className="w-full">
                <X className="h-4 w-4 mr-2" />
                Tutup
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
