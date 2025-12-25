import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useMenuItems, useMenuCategories } from '@/hooks/useMenuItems';
import { useOrders, useCreateOrder, useUpdateOrderStatus } from '@/hooks/useOrders';
import { useTables } from '@/hooks/useTables';
import { useCart } from '@/hooks/useCart';
import { useOrderNotifications } from '@/hooks/useOrderNotifications';
import { MenuGrid } from '@/components/pos/MenuGrid';
import { Cart } from '@/components/pos/Cart';
import { CartSummaryBar } from '@/components/pos/CartSummaryBar';
import { CheckoutDialog } from '@/components/pos/CheckoutDialog';
import { OrdersList } from '@/components/pos/OrdersList';
import { ReceiptDialog } from '@/components/pos/ReceiptDialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Store, Settings, LogOut, Menu, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Order } from '@/types/pos';

export default function Index() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { data: menuItems = [], isLoading: itemsLoading } = useMenuItems();
  const { data: categories = [], isLoading: categoriesLoading } = useMenuCategories();
  const { data: orders = [], isLoading: ordersLoading } = useOrders();
  const { data: tables = [] } = useTables();
  const createOrder = useCreateOrder();
  const updateOrderStatus = useUpdateOrderStatus();
  
  // Enable realtime notifications for new orders
  useOrderNotifications();
  
  const {
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    subtotal,
    tax,
    total,
  } = useCart();

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center animate-pulse">
            <Store className="h-6 w-6 text-primary-foreground" />
          </div>
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const isLoading = itemsLoading || categoriesLoading || ordersLoading;

  const handleCheckout = async (data: {
    tableId?: string;
    customerName?: string;
    paymentMethod: string;
    notes?: string;
    receivedAmount?: number;
    changeAmount?: number;
  }) => {
    try {
      const order = await createOrder.mutateAsync({
        cart,
        tableId: data.tableId,
        customerName: data.customerName,
        paymentMethod: data.paymentMethod,
        notes: data.notes,
      });
      clearCart();
      setCheckoutOpen(false);
      
      // Automatically open receipt dialog for printing
      if (order) {
        const formattedOrder: Order = {
          ...order,
          subtotal: Number(order.subtotal),
          tax: Number(order.tax),
          total: Number(order.total),
          status: order.status as Order['status'],
        };
        setReceiptOrder(formattedOrder);
      }
    } catch (error) {
      // Error already handled by mutation
    }
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error('Gagal keluar');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Store className="h-4 w-4 text-primary-foreground" />
            </div>
            <h1 className="font-bold text-lg hidden sm:block">Warung POS</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/admin">
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-7rem)]">
          {/* Menu Grid */}
          <div className="lg:col-span-5 xl:col-span-6 h-full overflow-hidden">
            {isLoading ? (
              <div className="space-y-4">
                <div className="flex gap-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-9 w-20" />)}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <Skeleton key={i} className="aspect-square rounded-lg" />
                  ))}
                </div>
              </div>
            ) : (
              <MenuGrid
                items={menuItems}
                categories={categories}
                onAddToCart={addToCart}
              />
            )}
          </div>

          {/* Cart - Desktop */}
          <div className="hidden lg:block lg:col-span-4 xl:col-span-3 h-full">
            <Cart
              cart={cart}
              subtotal={subtotal}
              tax={tax}
              total={total}
              onUpdateQuantity={updateQuantity}
              onRemove={removeFromCart}
              onCheckout={() => setCheckoutOpen(true)}
              onClear={clearCart}
              isProcessing={createOrder.isPending}
            />
          </div>

          {/* Orders - Desktop */}
          <div className="hidden lg:block lg:col-span-3 h-full">
            <OrdersList
              orders={orders}
              onUpdateStatus={(orderId, status) => updateOrderStatus.mutate({ orderId, status })}
            />
          </div>
        </div>

        {/* Mobile Cart/Orders Toggle */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 top-14 z-40 bg-background lg:hidden">
            <div className="container px-4 py-4 h-full overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Cart
                  cart={cart}
                  subtotal={subtotal}
                  tax={tax}
                  total={total}
                  onUpdateQuantity={updateQuantity}
                  onRemove={removeFromCart}
                  onCheckout={() => {
                    setMobileMenuOpen(false);
                    setCheckoutOpen(true);
                  }}
                  onClear={clearCart}
                  isProcessing={createOrder.isPending}
                />
                <OrdersList
                  orders={orders}
                  onUpdateStatus={(orderId, status) => updateOrderStatus.mutate({ orderId, status })}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Checkout Dialog */}
      <CheckoutDialog
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        onConfirm={handleCheckout}
        cart={cart}
        total={total}
        tables={tables}
        isProcessing={createOrder.isPending}
      />

      {/* Receipt Dialog - Auto opens after checkout */}
      <ReceiptDialog
        open={!!receiptOrder}
        onClose={() => setReceiptOrder(null)}
        order={receiptOrder}
        onCompleteOrder={(orderId) => updateOrderStatus.mutate({ orderId, status: 'completed' })}
      />

      {/* Cart Summary Bar - Mobile */}
      {!mobileMenuOpen && (
        <CartSummaryBar
          cart={cart}
          subtotal={subtotal}
          total={total}
          onUpdateQuantity={updateQuantity}
          onRemove={removeFromCart}
          onCheckout={() => setCheckoutOpen(true)}
          onClear={clearCart}
          isProcessing={createOrder.isPending}
        />
      )}
    </div>
  );
}
