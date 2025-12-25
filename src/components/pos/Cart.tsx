import { CartItem } from '@/types/pos';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Minus, Plus, Trash2, ShoppingCart, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CartProps {
  cart: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  onUpdateQuantity: (menuItemId: string, quantity: number) => void;
  onRemove: (menuItemId: string) => void;
  onCheckout: () => void;
  onClear: () => void;
  isProcessing?: boolean;
}

export function Cart({
  cart,
  subtotal,
  tax,
  total,
  onUpdateQuantity,
  onRemove,
  onCheckout,
  onClear,
  isProcessing,
}: CartProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShoppingCart className="h-5 w-5" />
            Keranjang
          </CardTitle>
          {cart.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <Receipt className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">Keranjang kosong</p>
            <p className="text-xs">Pilih menu untuk memulai</p>
          </div>
        ) : (
          <ScrollArea className="h-full px-4">
            <div className="space-y-3 pb-4">
              {cart.map((item, index) => (
                <div
                  key={item.menuItem.id}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg bg-muted/50",
                    "animate-fade-in"
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">
                      {item.menuItem.name}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {formatPrice(item.menuItem.price)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onUpdateQuantity(item.menuItem.id, item.quantity - 1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => onUpdateQuantity(item.menuItem.id, parseInt(e.target.value) || 0)}
                      className="h-7 w-12 text-center px-1"
                      min={0}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onUpdateQuantity(item.menuItem.id, item.quantity + 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => onRemove(item.menuItem.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      {cart.length > 0 && (
        <CardFooter className="flex-col gap-3 pt-4 border-t">
          <div className="w-full space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Pajak (10%)</span>
              <span>{formatPrice(tax)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="text-primary">{formatPrice(total)}</span>
            </div>
          </div>
          <Button
            className="w-full gradient-primary"
            size="lg"
            onClick={onCheckout}
            disabled={isProcessing}
          >
            {isProcessing ? 'Memproses...' : 'Bayar Sekarang'}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}