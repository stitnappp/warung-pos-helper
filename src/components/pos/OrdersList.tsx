import { Order } from '@/types/pos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ClipboardList, Clock, CheckCircle, XCircle, ChefHat, Truck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface OrdersListProps {
  orders: Order[];
  onUpdateStatus: (orderId: string, status: Order['status']) => void;
}

const statusConfig: Record<Order['status'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof Clock }> = {
  pending: { label: 'Menunggu', variant: 'secondary', icon: Clock },
  preparing: { label: 'Diproses', variant: 'default', icon: ChefHat },
  ready: { label: 'Siap', variant: 'outline', icon: Truck },
  completed: { label: 'Selesai', variant: 'default', icon: CheckCircle },
  cancelled: { label: 'Dibatalkan', variant: 'destructive', icon: XCircle },
};

const nextStatus: Record<Order['status'], Order['status'] | null> = {
  pending: 'preparing',
  preparing: 'ready',
  ready: 'completed',
  completed: null,
  cancelled: null,
};

export function OrdersList({ orders, onUpdateStatus }: OrdersListProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const activeOrders = orders.filter(o => !['completed', 'cancelled'].includes(o.status));
  const completedOrders = orders.filter(o => ['completed', 'cancelled'].includes(o.status));

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <ClipboardList className="h-5 w-5" />
        <h2 className="text-lg font-bold">Pesanan</h2>
        {activeOrders.length > 0 && (
          <Badge variant="secondary">{activeOrders.length} aktif</Badge>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-6">
          {/* Active Orders */}
          {activeOrders.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Pesanan Aktif</h3>
              {activeOrders.map((order, index) => {
                const config = statusConfig[order.status];
                const StatusIcon = config.icon;
                const next = nextStatus[order.status];

                return (
                  <Card 
                    key={order.id} 
                    className={cn(
                      "animate-fade-in",
                      order.status === 'pending' && "border-warning/50 bg-warning/5"
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            #{order.id.slice(-6).toUpperCase()}
                            {order.customer_name && (
                              <span className="font-normal text-muted-foreground">
                                - {order.customer_name}
                              </span>
                            )}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(order.created_at), {
                              addSuffix: true,
                              locale: id,
                            })}
                          </p>
                        </div>
                        <Badge variant={config.variant} className="flex items-center gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-primary">
                          {formatPrice(order.total)}
                        </span>
                        <div className="flex gap-2">
                          {order.status !== 'cancelled' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive"
                              onClick={() => onUpdateStatus(order.id, 'cancelled')}
                            >
                              Batalkan
                            </Button>
                          )}
                          {next && (
                            <Button
                              size="sm"
                              onClick={() => onUpdateStatus(order.id, next)}
                              className="gradient-primary"
                            >
                              {next === 'preparing' && 'Proses'}
                              {next === 'ready' && 'Siap Antar'}
                              {next === 'completed' && 'Selesai'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Completed Orders */}
          {completedOrders.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Riwayat</h3>
              {completedOrders.slice(0, 10).map(order => {
                const config = statusConfig[order.status];
                const StatusIcon = config.icon;

                return (
                  <Card key={order.id} className="opacity-60">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-sm">
                            #{order.id.slice(-6).toUpperCase()}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(order.created_at), {
                              addSuffix: true,
                              locale: id,
                            })}
                          </p>
                        </div>
                        <Badge variant={config.variant} className="flex items-center gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <span className="font-medium">{formatPrice(order.total)}</span>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {orders.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <ClipboardList className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-sm">Belum ada pesanan</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}