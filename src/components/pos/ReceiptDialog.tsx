import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
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
import { Printer, X, Loader2, Bluetooth, BluetoothConnected, BluetoothOff, CheckCircle, Share2, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ReceiptDialogProps {
  open: boolean;
  onClose: () => void;
  order: Order | null;
  onCompleteOrder?: (orderId: string) => void;
}

export function ReceiptDialog({ open, onClose, order, onCompleteOrder }: ReceiptDialogProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const { data: orderItems = [], isLoading } = useOrderItems(order?.id || '');
  const { data: tables = [] } = useTables();
  const bluetooth = useBluetoothPrinter();
  const [isPrinted, setIsPrinted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const tableName = order?.table_id 
    ? tables.find(t => t.id === order.table_id)?.table_number 
    : undefined;

  // Check if native share is available (mobile apps)
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator && 'canShare' in navigator;

  const captureReceiptAsImage = async (): Promise<Blob | null> => {
    if (!receiptRef.current) return null;
    
    try {
      const canvas = await html2canvas(receiptRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/png', 1.0);
      });
    } catch (error) {
      console.error('Error capturing receipt:', error);
      return null;
    }
  };

  const handleShareReceipt = async () => {
    if (!order) return;
    
    setIsProcessing(true);
    
    try {
      const blob = await captureReceiptAsImage();
      
      if (!blob) {
        toast.error('Gagal membuat gambar struk');
        return;
      }
      
      const file = new File([blob], `struk-${order.id.slice(-6).toUpperCase()}.png`, {
        type: 'image/png',
      });
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Struk #${order.id.slice(-6).toUpperCase()}`,
          text: `Struk pesanan #${order.id.slice(-6).toUpperCase()} - Total: Rp ${order.total.toLocaleString('id-ID')}`,
        });
        
        setIsPrinted(true);
        if (onCompleteOrder) {
          onCompleteOrder(order.id);
        }
        toast.success('Struk berhasil dibagikan!');
      } else {
        // Fallback to download if share is not available
        handleDownloadReceipt();
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Share error:', error);
        toast.error('Gagal membagikan struk');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadReceipt = async () => {
    if (!order) return;
    
    setIsProcessing(true);
    
    try {
      const blob = await captureReceiptAsImage();
      
      if (!blob) {
        toast.error('Gagal membuat gambar struk');
        return;
      }
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `struk-${order.id.slice(-6).toUpperCase()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setIsPrinted(true);
      if (onCompleteOrder) {
        onCompleteOrder(order.id);
      }
      toast.success('Struk berhasil diunduh!');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Gagal mengunduh struk');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBrowserPrint = () => {
    if (!receiptRef.current) return;

    const printContent = receiptRef.current.innerHTML;
    const printWindow = window.open('', '', 'width=350,height=600');
    
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Struk #${order?.id.slice(-6).toUpperCase()}</title>
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              body {
                font-family: 'Courier New', monospace;
                font-size: 12px;
                padding: 10px;
                background: white;
                color: black;
              }
              table {
                width: 100%;
                border-collapse: collapse;
              }
              th, td {
                padding: 2px 0;
              }
              .text-center { text-align: center; }
              .text-right { text-align: right; }
              .text-left { text-align: left; }
              .text-xs { font-size: 10px; }
              .text-xl { font-size: 18px; }
              .text-base { font-size: 14px; }
              .font-bold { font-weight: bold; }
              .capitalize { text-transform: capitalize; }
              .border-b { border-bottom: 1px dashed #999; }
              .border-t { border-top: 1px dashed #999; }
              .pb-1 { padding-bottom: 4px; }
              .pb-3 { padding-bottom: 12px; }
              .pb-4 { padding-bottom: 16px; }
              .pt-2 { padding-top: 8px; }
              .pt-3 { padding-top: 12px; }
              .mb-3 { margin-bottom: 12px; }
              .mb-4 { margin-bottom: 16px; }
              .mt-1 { margin-top: 4px; }
              .mt-2 { margin-top: 8px; }
              .mt-3 { margin-top: 12px; }
              .mt-6 { margin-top: 24px; }
              .py-1 { padding-top: 4px; padding-bottom: 4px; }
              .pr-2 { padding-right: 8px; }
              .space-y-1 > * + * { margin-top: 4px; }
              .text-gray-500, .text-gray-600 { color: #666; }
              .border-gray-300 { border-color: #ccc; }
              .border-gray-400 { border-color: #999; }
              .flex { display: flex; }
              .justify-between { justify-content: space-between; }
              @media print {
                body { padding: 0; }
              }
            </style>
          </head>
          <body>
            ${printContent}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
      
      // Mark as printed and complete order
      setIsPrinted(true);
      if (order && onCompleteOrder) {
        onCompleteOrder(order.id);
        toast.success('Pesanan selesai!');
      }
    }
  };

  const handleBluetoothPrint = async () => {
    if (!order) return;

    if (!bluetooth.isConnected) {
      const connected = await bluetooth.connect();
      if (!connected) return;
    }

    const success = await bluetooth.printReceipt(order, orderItems, tableName);
    
    if (success) {
      // Mark as printed and complete order
      setIsPrinted(true);
      if (onCompleteOrder) {
        onCompleteOrder(order.id);
        toast.success('Pesanan selesai!');
      }
    }
  };

  const handleClose = () => {
    setIsPrinted(false);
    onClose();
  };

  if (!order) return null;

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
              />
            </div>
          )}
        </div>

        {/* Success Message */}
        {isPrinted && (
          <div className="bg-accent/20 text-accent-foreground p-3 rounded-lg text-center mb-2">
            <CheckCircle className="h-6 w-6 mx-auto mb-1 text-accent" />
            <p className="text-sm font-medium">Struk berhasil dicetak/dibagikan</p>
            <p className="text-xs text-muted-foreground">Pesanan telah ditandai selesai</p>
          </div>
        )}

        {/* Bluetooth Status */}
        {bluetooth.isSupported && !isPrinted && (
          <div className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-lg mb-2">
            <div className="flex items-center gap-2">
              {bluetooth.isConnected ? (
                <BluetoothConnected className="h-4 w-4 text-accent" />
              ) : (
                <BluetoothOff className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm">
                {bluetooth.isConnecting 
                  ? 'Menghubungkan...' 
                  : bluetooth.isConnected 
                    ? 'Printer terhubung'
                    : 'Printer tidak terhubung'}
              </span>
            </div>
            {bluetooth.isConnected && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={bluetooth.disconnect}
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
              {/* Primary Action: Share (for mobile) or Download */}
              {canShare ? (
                <Button 
                  onClick={handleShareReceipt} 
                  disabled={isLoading || isProcessing}
                  className="gradient-primary w-full"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Share2 className="h-4 w-4 mr-2" />
                  )}
                  Bagikan / Cetak ke Printer
                </Button>
              ) : (
                <Button 
                  onClick={handleDownloadReceipt} 
                  disabled={isLoading || isProcessing}
                  className="gradient-primary w-full"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Unduh Gambar Struk
                </Button>
              )}

              <div className="grid grid-cols-2 gap-2">
                {/* Browser Print */}
                <Button onClick={handleBrowserPrint} disabled={isLoading} variant="secondary">
                  <Printer className="h-4 w-4 mr-2" />
                  Cetak Browser
                </Button>

                {/* Bluetooth Print */}
                {bluetooth.isSupported && (
                  <Button 
                    onClick={handleBluetoothPrint} 
                    disabled={isLoading || bluetooth.isPrinting || bluetooth.isConnecting} 
                    variant="secondary"
                    className={cn(
                      bluetooth.isConnected && "ring-2 ring-accent ring-offset-1"
                    )}
                  >
                    {bluetooth.isPrinting || bluetooth.isConnecting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Bluetooth className="h-4 w-4 mr-2" />
                    )}
                    {bluetooth.isConnecting 
                      ? 'Connecting...' 
                      : bluetooth.isPrinting 
                        ? 'Mencetak...'
                        : 'Thermal'}
                  </Button>
                )}
              </div>
              
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