import { forwardRef } from 'react';
import { Order, OrderItem } from '@/types/pos';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface ReceiptProps {
  order: Order;
  items: OrderItem[];
  tableName?: string;
}

export const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(
  ({ order, items, tableName }, ref) => {
    const formatPrice = (price: number) => {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
      }).format(price);
    };

    return (
      <div
        ref={ref}
        className="bg-white text-black p-6 w-[300px] font-mono text-sm"
        style={{ fontFamily: 'monospace' }}
      >
        {/* Header */}
        <div className="text-center border-b border-dashed border-gray-400 pb-4 mb-4">
          <h1 className="text-xl font-bold">WARUNG POS</h1>
          <p className="text-xs text-gray-600 mt-1">Jl. Contoh No. 123</p>
          <p className="text-xs text-gray-600">Telp: 021-1234567</p>
        </div>

        {/* Order Info */}
        <div className="border-b border-dashed border-gray-400 pb-3 mb-3">
          <div className="flex justify-between text-xs">
            <span>No. Order:</span>
            <span className="font-bold">#{order.id.slice(-6).toUpperCase()}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span>Tanggal:</span>
            <span>{format(new Date(order.created_at), 'dd/MM/yyyy HH:mm', { locale: id })}</span>
          </div>
          {order.customer_name && (
            <div className="flex justify-between text-xs">
              <span>Pelanggan:</span>
              <span>{order.customer_name}</span>
            </div>
          )}
          {tableName && (
            <div className="flex justify-between text-xs">
              <span>Meja:</span>
              <span>{tableName}</span>
            </div>
          )}
          {order.payment_method && (
            <div className="flex justify-between text-xs">
              <span>Pembayaran:</span>
              <span className="capitalize">{order.payment_method}</span>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="border-b border-dashed border-gray-400 pb-3 mb-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left pb-1">Item</th>
                <th className="text-center pb-1">Qty</th>
                <th className="text-right pb-1">Harga</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="py-1 pr-2">{item.name}</td>
                  <td className="text-center py-1">{item.quantity}</td>
                  <td className="text-right py-1">{formatPrice(item.price * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>{formatPrice(order.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Pajak (10%):</span>
            <span>{formatPrice(order.tax)}</span>
          </div>
          <div className="flex justify-between font-bold text-base border-t border-gray-400 pt-2 mt-2">
            <span>TOTAL:</span>
            <span>{formatPrice(order.total)}</span>
          </div>
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="mt-3 pt-3 border-t border-dashed border-gray-400">
            <p className="text-xs text-gray-600">Catatan: {order.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-6 pt-3 border-t border-dashed border-gray-400">
          <p className="text-xs">Terima kasih atas kunjungan Anda!</p>
          <p className="text-xs text-gray-500 mt-1">Simpan struk ini sebagai bukti pembayaran</p>
        </div>
      </div>
    );
  }
);

Receipt.displayName = 'Receipt';
