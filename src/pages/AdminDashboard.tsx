import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useIsAdmin } from '@/hooks/useUserRole';
import { useCurrentUserProfile } from '@/hooks/useUserProfile';
import { useOrders } from '@/hooks/useOrders';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Store, ArrowLeft, BarChart3, DollarSign, ShoppingCart, 
  TrendingUp, Send, Loader2, CalendarDays, Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { id } from 'date-fns/locale';

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isLoading: roleLoading } = useIsAdmin();
  const { data: profile } = useCurrentUserProfile();
  const { data: orders = [], isLoading: ordersLoading } = useOrders();
  
  const [sendingDaily, setSendingDaily] = useState(false);
  const [sendingMonthly, setSendingMonthly] = useState(false);

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAdmin) {
    toast.error('Akses ditolak. Hanya admin yang bisa mengakses halaman ini.');
    return <Navigate to="/" replace />;
  }

  // Calculate statistics
  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  const todayOrders = orders.filter(order => {
    const orderDate = new Date(order.created_at);
    return isWithinInterval(orderDate, { start: todayStart, end: todayEnd });
  });

  const monthOrders = orders.filter(order => {
    const orderDate = new Date(order.created_at);
    return isWithinInterval(orderDate, { start: monthStart, end: monthEnd });
  });

  const calculateStats = (orderList: typeof orders) => {
    const completed = orderList.filter(o => o.status === 'completed');
    const pending = orderList.filter(o => o.status === 'pending');
    const cancelled = orderList.filter(o => o.status === 'cancelled');
    const totalRevenue = completed.reduce((sum, o) => sum + o.total, 0);
    
    return {
      total: orderList.length,
      completed: completed.length,
      pending: pending.length,
      cancelled: cancelled.length,
      revenue: totalRevenue,
    };
  };

  const dailyStats = calculateStats(todayOrders);
  const monthlyStats = calculateStats(monthOrders);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const sendReport = async (type: 'daily' | 'monthly') => {
    const isSending = type === 'daily' ? sendingDaily : sendingMonthly;
    if (isSending) return;

    if (type === 'daily') setSendingDaily(true);
    else setSendingMonthly(true);

    try {
      const stats = type === 'daily' ? dailyStats : monthlyStats;
      const dateLabel = type === 'daily' 
        ? format(today, 'dd MMMM yyyy', { locale: id })
        : format(today, 'MMMM yyyy', { locale: id });

      const { error } = await supabase.functions.invoke('send-telegram-report', {
        body: {
          report: {
            type,
            date: dateLabel,
            totalOrders: stats.total,
            totalRevenue: stats.revenue,
            completedOrders: stats.completed,
            pendingOrders: stats.pending,
            cancelledOrders: stats.cancelled,
            generatedBy: profile?.full_name || 'Admin',
          },
        },
      });

      if (error) throw error;

      toast.success(`Laporan ${type === 'daily' ? 'harian' : 'bulanan'} berhasil dikirim ke Telegram!`);
    } catch (error) {
      console.error('Error sending report:', error);
      toast.error('Gagal mengirim laporan ke Telegram');
    } finally {
      if (type === 'daily') setSendingDaily(false);
      else setSendingMonthly(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center px-4">
          <Button variant="ghost" size="icon" asChild className="mr-3">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Store className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Dashboard Admin</h1>
              <p className="text-xs text-muted-foreground">Selamat datang, {profile?.full_name || 'Admin'}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 py-6">
        {ordersLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
        ) : (
          <Tabs defaultValue="daily" className="space-y-6">
            <TabsList className="grid w-full max-w-sm grid-cols-2">
              <TabsTrigger value="daily" className="gap-2">
                <CalendarDays className="h-4 w-4" />
                Hari Ini
              </TabsTrigger>
              <TabsTrigger value="monthly" className="gap-2">
                <Calendar className="h-4 w-4" />
                Bulan Ini
              </TabsTrigger>
            </TabsList>

            {/* Daily Stats */}
            <TabsContent value="daily" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Laporan Harian</h2>
                  <p className="text-sm text-muted-foreground">{format(today, 'EEEE, dd MMMM yyyy', { locale: id })}</p>
                </div>
                <Button 
                  onClick={() => sendReport('daily')} 
                  disabled={sendingDaily}
                  className="gradient-primary"
                >
                  {sendingDaily ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Kirim ke Telegram
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Total Pendapatan</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">{formatPrice(dailyStats.revenue)}</div>
                    <p className="text-xs text-muted-foreground">Dari pesanan selesai</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Total Pesanan</CardTitle>
                    <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dailyStats.total}</div>
                    <p className="text-xs text-muted-foreground">Pesanan hari ini</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Pesanan Selesai</CardTitle>
                    <TrendingUp className="h-4 w-4 text-accent" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-accent">{dailyStats.completed}</div>
                    <p className="text-xs text-muted-foreground">
                      {dailyStats.total > 0 ? Math.round((dailyStats.completed / dailyStats.total) * 100) : 0}% dari total
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Pending / Batal</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      <span className="text-yellow-500">{dailyStats.pending}</span>
                      {' / '}
                      <span className="text-destructive">{dailyStats.cancelled}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Pending / Dibatalkan</p>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Orders Today */}
              <Card>
                <CardHeader>
                  <CardTitle>Pesanan Terbaru Hari Ini</CardTitle>
                  <CardDescription>Menampilkan 10 pesanan terakhir</CardDescription>
                </CardHeader>
                <CardContent>
                  {todayOrders.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Belum ada pesanan hari ini</p>
                  ) : (
                    <div className="space-y-2">
                      {todayOrders.slice(0, 10).map(order => (
                        <div key={order.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div>
                            <p className="font-medium">#{order.id.slice(-6).toUpperCase()}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(order.created_at), 'HH:mm', { locale: id })}
                              {order.customer_name && ` • ${order.customer_name}`}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{formatPrice(order.total)}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              order.status === 'completed' ? 'bg-accent/20 text-accent' :
                              order.status === 'pending' ? 'bg-yellow-500/20 text-yellow-600' :
                              'bg-destructive/20 text-destructive'
                            }`}>
                              {order.status === 'completed' ? 'Selesai' :
                               order.status === 'pending' ? 'Pending' : 'Batal'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Monthly Stats */}
            <TabsContent value="monthly" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Laporan Bulanan</h2>
                  <p className="text-sm text-muted-foreground">{format(today, 'MMMM yyyy', { locale: id })}</p>
                </div>
                <Button 
                  onClick={() => sendReport('monthly')} 
                  disabled={sendingMonthly}
                  className="gradient-primary"
                >
                  {sendingMonthly ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Kirim ke Telegram
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Total Pendapatan</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">{formatPrice(monthlyStats.revenue)}</div>
                    <p className="text-xs text-muted-foreground">Dari pesanan selesai</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Total Pesanan</CardTitle>
                    <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{monthlyStats.total}</div>
                    <p className="text-xs text-muted-foreground">Pesanan bulan ini</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Pesanan Selesai</CardTitle>
                    <TrendingUp className="h-4 w-4 text-accent" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-accent">{monthlyStats.completed}</div>
                    <p className="text-xs text-muted-foreground">
                      {monthlyStats.total > 0 ? Math.round((monthlyStats.completed / monthlyStats.total) * 100) : 0}% dari total
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Pending / Batal</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      <span className="text-yellow-500">{monthlyStats.pending}</span>
                      {' / '}
                      <span className="text-destructive">{monthlyStats.cancelled}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Pending / Dibatalkan</p>
                  </CardContent>
                </Card>
              </div>

              {/* Monthly Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Ringkasan Bulan Ini</CardTitle>
                  <CardDescription>Statistik pesanan bulan {format(today, 'MMMM yyyy', { locale: id })}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 rounded-lg bg-accent/10">
                      <p className="text-3xl font-bold text-accent">{monthlyStats.completed}</p>
                      <p className="text-sm text-muted-foreground">Pesanan Selesai</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-yellow-500/10">
                      <p className="text-3xl font-bold text-yellow-600">{monthlyStats.pending}</p>
                      <p className="text-sm text-muted-foreground">Pesanan Pending</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-destructive/10">
                      <p className="text-3xl font-bold text-destructive">{monthlyStats.cancelled}</p>
                      <p className="text-sm text-muted-foreground">Pesanan Batal</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Quick Links */}
        <div className="mt-8">
          <h3 className="font-semibold mb-4">Akses Cepat</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" asChild className="h-auto py-4 flex-col gap-2">
              <Link to="/admin">
                <BarChart3 className="h-6 w-6" />
                <span>Kelola Menu</span>
              </Link>
            </Button>
            <Button variant="outline" asChild className="h-auto py-4 flex-col gap-2">
              <Link to="/">
                <ShoppingCart className="h-6 w-6" />
                <span>POS Kasir</span>
              </Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
