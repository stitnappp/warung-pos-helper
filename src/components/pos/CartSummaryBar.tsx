import { CartItem } from '@/types/pos';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Minus, Plus, Trash2 } from 'lucide-react';

interface CartSummaryBarProps {
  cart: CartItem[];
  subtotal: number;
  total: number;
  onUpdateQuantity: (menuItemId: string, quantity: number) => void;
  onRemove: (menuItemId: string) => void;
  onCheckout: () => void;
  onClear: () => void;
  isProcessing?: boolean;
}

export function CartSummaryBar({ 
  cart, 
  subtotal,
  total, 
  onUpdateQuantity,
  onRemove,
  onCheckout, 
  onClear,
  isProcessing 
}: CartSummaryBarProps) {

  const formatPrice = (price: number): string => {
    const formatted = price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return 'Rp ' + formatted;
  };

  if (cart.length === 0) return null;

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t shadow-lg lg:hidden safe-bottom">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <span className="font-semibold">Pesanan</span>
          <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
            {totalItems}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="text-primary hover:text-primary/80 text-sm font-medium"
        >
          Hapus Semua
        </Button>
      </div>

      {/* Item List */}
      <div className="max-h-52 overflow-y-auto">
        <div className="p-3 space-y-3">
          {cart.map((item) => (
            <div 
              key={item.menuItem.id} 
              className="flex items-center justify-between bg-muted/50 rounded-lg p-3"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{item.menuItem.name}</div>
                <div className="text-primary text-sm font-semibold">
                  {formatPrice(item.menuItem.price)}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => onUpdateQuantity(item.menuItem.id, item.quantity - 1)}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-6 text-center font-medium">{item.quantity}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => onUpdateQuantity(item.menuItem.id, item.quantity + 1)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive/80"
                  onClick={() => onRemove(item.menuItem.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-bold text-lg">{formatPrice(subtotal)}</span>
        </div>
        <Button
          className="w-full gradient-primary text-lg h-12 font-semibold"
          onClick={onCheckout}
          disabled={isProcessing}
        >
          {isProcessing ? 'Proses...' : `Bayar ${formatPrice(total)}`}
        </Button>
      </div>
    </div>
  );
}
