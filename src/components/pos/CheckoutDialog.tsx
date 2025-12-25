import { useState } from 'react';
import { CartItem, RestaurantTable } from '@/types/pos';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { CreditCard, Banknote, Wallet, QrCode, Building } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CheckoutDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: {
    tableId?: string;
    customerName?: string;
    paymentMethod: string;
    notes?: string;
  }) => void;
  cart: CartItem[];
  total: number;
  tables: RestaurantTable[];
  isProcessing?: boolean;
}

const paymentMethods = [
  { id: 'cash', label: 'Tunai', icon: Banknote },
  { id: 'qris', label: 'QRIS', icon: QrCode },
  { id: 'transfer', label: 'Transfer', icon: Building },
  { id: 'card', label: 'Kartu', icon: CreditCard },
  { id: 'ewallet', label: 'E-Wallet', icon: Wallet },
];

export function CheckoutDialog({
  open,
  onClose,
  onConfirm,
  cart,
  total,
  tables,
  isProcessing,
}: CheckoutDialogProps) {
  const [tableId, setTableId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const handleConfirm = () => {
    onConfirm({
      tableId: tableId && tableId !== 'none' ? tableId : undefined,
      customerName: customerName || undefined,
      paymentMethod,
      notes: notes || undefined,
    });
  };

  const availableTables = tables.filter(t => t.status === 'available');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Checkout</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Order Summary */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h4 className="font-medium text-sm">Ringkasan Pesanan</h4>
            {cart.map(item => (
              <div key={item.menuItem.id} className="flex justify-between text-sm">
                <span>
                  {item.menuItem.name} x{item.quantity}
                </span>
                <span>{formatPrice(item.menuItem.price * item.quantity)}</span>
              </div>
            ))}
            <Separator />
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span className="text-primary">{formatPrice(total)}</span>
            </div>
          </div>

          {/* Table Selection */}
          <div className="space-y-2">
            <Label>Meja (Opsional)</Label>
            <Select value={tableId} onValueChange={setTableId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih meja..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Tanpa meja (Take away)</SelectItem>
                {availableTables.map(table => (
                  <SelectItem key={table.id} value={table.id}>
                    Meja {table.table_number} (Kapasitas: {table.capacity})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Customer Name */}
          <div className="space-y-2">
            <Label>Nama Pelanggan (Opsional)</Label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Masukkan nama pelanggan..."
            />
          </div>

          {/* Payment Method */}
          <div className="space-y-3">
            <Label>Metode Pembayaran</Label>
            <div className="grid grid-cols-5 gap-2">
              {paymentMethods.map(method => {
                const Icon = method.icon;
                return (
                  <Button
                    key={method.id}
                    type="button"
                    variant={paymentMethod === method.id ? 'default' : 'outline'}
                    className={cn(
                      "flex flex-col gap-1 h-auto py-3",
                      paymentMethod === method.id && "gradient-primary"
                    )}
                    onClick={() => setPaymentMethod(method.id)}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[10px]">{method.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Catatan (Opsional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tambahkan catatan..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Batal
          </Button>
          <Button onClick={handleConfirm} disabled={isProcessing} className="gradient-primary">
            {isProcessing ? 'Memproses...' : 'Konfirmasi Pesanan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}