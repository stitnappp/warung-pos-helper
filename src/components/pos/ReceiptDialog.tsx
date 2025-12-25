import { useRef, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Receipt } from './Receipt';
import { Order, OrderItem } from '@/types/pos';
import { useOrderItems } from '@/hooks/useOrders';
import { useTables } from '@/hooks/useTables';
import { Printer, X, Loader2 } from 'lucide-react';

interface ReceiptDialogProps {
  open: boolean;
  onClose: () => void;
  order: Order | null;
}

export function ReceiptDialog({ open, onClose, order }: ReceiptDialogProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const { data: orderItems = [], isLoading } = useOrderItems(order?.id || '');
  const { data: tables = [] } = useTables();

  const tableName = order?.table_id 
    ? tables.find(t => t.id === order.table_id)?.table_number 
    : undefined;

  const handlePrint = () => {
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
            <div className="border rounded-lg overflow-hidden shadow-sm">
              <Receipt
                ref={receiptRef}
                order={order}
                items={orderItems}
                tableName={tableName}
              />
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Tutup
          </Button>
          <Button onClick={handlePrint} disabled={isLoading} className="gradient-primary">
            <Printer className="h-4 w-4 mr-2" />
            Cetak Struk
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
