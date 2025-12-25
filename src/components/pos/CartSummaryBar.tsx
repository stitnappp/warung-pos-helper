import { CartItem } from '@/types/pos';
import { Button } from '@/components/ui/button';
import { ShoppingCart, ChevronUp, ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface CartSummaryBarProps {
  cart: CartItem[];
  total: number;
  onCheckout: () => void;
  isProcessing?: boolean;
}

export function CartSummaryBar({ cart, total, onCheckout, isProcessing }: CartSummaryBarProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const formatPrice = (price: number): string => {
    const formatted = price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return 'Rp' + formatted;
  };

  if (cart.length === 0) return null;

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t shadow-lg lg:hidden">
      {/* Expandable Item List */}
      {isExpanded && (
        <div className="max-h-48 overflow-y-auto border-b">
          <div className="p-3 space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Daftar Pesanan
            </div>
            {cart.map((item) => (
              <div key={item.menuItem.id} className="flex justify-between items-center text-sm">
                <div className="flex-1">
                  <span className="font-medium">{item.menuItem.name}</span>
                  <span className="text-muted-foreground ml-2">x{item.quantity}</span>
                </div>
                <span className="font-medium">{formatPrice(item.menuItem.price * item.quantity)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Bar */}
      <div className="p-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </Button>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{totalItems} item</span>
          </div>
          <div className="text-lg font-bold text-primary">{formatPrice(total)}</div>
        </div>

        <Button
          className="gradient-primary px-6"
          onClick={onCheckout}
          disabled={isProcessing}
        >
          {isProcessing ? 'Proses...' : 'Bayar'}
        </Button>
      </div>
    </div>
  );
}
