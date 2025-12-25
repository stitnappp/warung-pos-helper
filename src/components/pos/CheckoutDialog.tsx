import { useState, useEffect } from 'react';
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
import { QrisPaymentDialog } from './QrisPaymentDialog';

interface CheckoutDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: {
    tableId?: string;
    customerName?: string;
    paymentMethod: string;
    notes?: string;
    receivedAmount?: number;
    changeAmount?: number;
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

const quickAmounts = [10000, 20000, 50000, 100000];

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
  const [receivedAmount, setReceivedAmount] = useState<string>('');
  const [showQrisDialog, setShowQrisDialog] = useState(false);
  const [tempOrderId, setTempOrderId] = useState('');

  // Reset received amount when dialog opens or total changes
  useEffect(() => {
    if (open) {
      setReceivedAmount('');
      setShowQrisDialog(false);
      // Generate a temporary order ID for QRIS
      setTempOrderId(crypto.randomUUID());
    }
  }, [open]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const receivedValue = parseFloat(receivedAmount) || 0;
  const changeAmount = receivedValue - total;
  const isCashPayment = paymentMethod === 'cash';
  const isQrisPayment = paymentMethod === 'qris';
  const canConfirm = !isCashPayment || receivedValue >= total;

  const handleQuickAmount = (amount: number) => {
    setReceivedAmount(amount.toString());
  };

  const handleExactAmount = () => {
    setReceivedAmount(total.toString());
  };

  const handleConfirm = () => {
    if (isQrisPayment) {
      // Open QRIS payment dialog
      setShowQrisDialog(true);
    } else {
      // Normal checkout flow
      onConfirm({
        tableId: tableId && tableId !== 'none' ? tableId : undefined,
        customerName: customerName || undefined,
        paymentMethod,
        notes: notes || undefined,
        receivedAmount: isCashPayment ? receivedValue : undefined,
        changeAmount: isCashPayment && changeAmount > 0 ? changeAmount : undefined,
      });
    }
  };

  const handleQrisPaymentSuccess = () => {
    // QRIS payment successful, complete the order
    setShowQrisDialog(false);
    onConfirm({
      tableId: tableId && tableId !== 'none' ? tableId : undefined,
      customerName: customerName || undefined,
      paymentMethod: 'qris',
      notes: notes || undefined,
    });
  };

  const availableTables = tables.filter(t => t.status === 'available');

  return (
    <>
      <Dialog open={open && !showQrisDialog} onOpenChange={onClose}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
              <div className="flex justify-between font-bold text-lg">
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

            {/* QRIS Info */}
            {isQrisPayment && (
              <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                <div className="flex items-center gap-3">
                  <QrCode className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium text-sm">Pembayaran QRIS</p>
                    <p className="text-xs text-muted-foreground">
                      QR code akan ditampilkan setelah konfirmasi
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Cash Payment - Received Amount */}
            {isCashPayment && (
              <div className="space-y-3 p-4 bg-secondary/50 rounded-lg border">
                <div className="space-y-2">
                  <Label>Uang Diterima *</Label>
                  <Input
                    type="number"
                    value={receivedAmount}
                    onChange={(e) => setReceivedAmount(e.target.value)}
                    placeholder="Masukkan jumlah uang..."
                    className="text-lg font-semibold"
                    min={0}
                  />
                </div>

                {/* Quick Amount Buttons */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleExactAmount}
                    className="text-xs"
                  >
                    Uang Pas
                  </Button>
                  {quickAmounts.map(amount => (
                    <Button
                      key={amount}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickAmount(amount)}
                      className="text-xs"
                    >
                      {formatPrice(amount)}
                    </Button>
                  ))}
                </div>

                {/* Change Amount Display */}
                {receivedValue > 0 && (
                  <div className={cn(
                    "p-3 rounded-lg text-center",
                    changeAmount >= 0 ? "bg-accent/20" : "bg-destructive/20"
                  )}>
                    <p className="text-sm text-muted-foreground">Kembalian</p>
                    <p className={cn(
                      "text-2xl font-bold",
                      changeAmount >= 0 ? "text-accent" : "text-destructive"
                    )}>
                      {changeAmount >= 0 ? formatPrice(changeAmount) : `Kurang ${formatPrice(Math.abs(changeAmount))}`}
                    </p>
                  </div>
                )}
              </div>
            )}

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
            <Button 
              onClick={handleConfirm} 
              disabled={isProcessing || !canConfirm} 
              className="gradient-primary"
            >
              {isProcessing ? 'Memproses...' : isQrisPayment ? 'Tampilkan QRIS' : 'Konfirmasi & Cetak Struk'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QRIS Payment Dialog */}
      <QrisPaymentDialog
        open={showQrisDialog}
        onClose={() => setShowQrisDialog(false)}
        onPaymentSuccess={handleQrisPaymentSuccess}
        orderId={tempOrderId}
        total={total}
        customerName={customerName}
        cart={cart}
      />
    </>
  );
}
