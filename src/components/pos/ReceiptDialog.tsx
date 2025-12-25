import { useRef } from 'react';
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
import { Printer, X, Loader2, Bluetooth, BluetoothConnected, BluetoothOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReceiptDialogProps {
  open: boolean;
  onClose: () => void;
  order: Order | null;
}

export function ReceiptDialog({ open, onClose, order }: ReceiptDialogProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const { data: orderItems = [], isLoading } = useOrderItems(order?.id || '');
  const { data: tables = [] } = useTables();
  const bluetooth = useBluetoothPrinter();

  const tableName = order?.table_id 
    ? tables.find(t => t.id === order.table_id)?.table_number 
    : undefined;

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
    }
  };

  const handleBluetoothPrint = async () => {
    if (!order) return;

    if (!bluetooth.isConnected) {
      const connected = await bluetooth.connect();
      if (!connected) return;
    }

    await bluetooth.printReceipt(order, orderItems, tableName);
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Struk Pesanan
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center py-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Memuat data...
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden shadow-sm max-h-[50vh] overflow-y-auto">
              <Receipt
                ref={receiptRef}
                order={order}
                items={orderItems}
                tableName={tableName}
              />
            </div>
          )}
        </div>

        {/* Bluetooth Status */}
        {bluetooth.isSupported && (
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

        <div className="flex gap-2 justify-end flex-wrap">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Tutup
          </Button>
          
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
              className={cn(
                "gradient-primary",
                bluetooth.isConnected && "ring-2 ring-accent ring-offset-2"
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
                  : bluetooth.isConnected 
                    ? 'Cetak Thermal'
                    : 'Hubungkan Printer'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}