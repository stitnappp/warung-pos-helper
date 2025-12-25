import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUserProfile } from '@/hooks/useUserProfile';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import { 
  FileText,
  TrendingUp,
  Wallet,
  CreditCard,
  QrCode,
  Send,
  Copy,
  Bell,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

type DateRange = 'today' | 'thisWeek' | 'thisMonth' | 'custom';

interface SalesStats {
  totalTransactions: number;
  totalRevenue: number;
  averageOrder: number;
  cashTotal: number;
  transferTotal: number;
  qrisTotal: number;
}

export function SalesReport() {
  const [dateRange, setDateRange] = useState<DateRange>('today');
  const [sending, setSending] = useState(false);
  const { data: profile } = useCurrentUserProfile();

  const getDateRange = () => {
    const today = new Date();
    switch (dateRange) {
      case 'today':
        return { start: startOfDay(today), end: endOfDay(today) };
      case 'thisWeek':
        return { start: startOfWeek(today, { weekStartsOn: 1 }), end: endOfWeek(today, { weekStartsOn: 1 }) };
      case 'thisMonth':
        return { start: startOfMonth(today), end: endOfMonth(today) };
      default:
        return { start: startOfDay(today), end: endOfDay(today) };
    }
  };

  const { start, end } = getDateRange();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['salesStats', dateRange, start.toISOString(), end.toISOString()],
    queryFn: async (): Promise<SalesStats> => {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'completed')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (error) throw error;

      const totalRevenue = orders?.reduce((sum, o) => sum + Number(o.total), 0) || 0;
      const totalTransactions = orders?.length || 0;
      const averageOrder = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

      const cashTotal = orders?.filter(o => o.payment_method === 'cash').reduce((sum, o) => sum + Number(o.total), 0) || 0;
      const transferTotal = orders?.filter(o => o.payment_method === 'transfer').reduce((sum, o) => sum + Number(o.total), 0) || 0;
      const qrisTotal = orders?.filter(o => o.payment_method === 'qris').reduce((sum, o) => sum + Number(o.total), 0) || 0;

      return {
        totalTransactions,
        totalRevenue,
        averageOrder,
        cashTotal,
        transferTotal,
        qrisTotal,
      };
    },
  });

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getDateLabel = () => {
    switch (dateRange) {
      case 'today':
        return format(new Date(), 'dd MMMM yyyy', { locale: id });
      case 'thisWeek':
        return `${format(start, 'dd MMM', { locale: id })} - ${format(end, 'dd MMM yyyy', { locale: id })}`;
      case 'thisMonth':
        return format(new Date(), 'MMMM yyyy', { locale: id });
      default:
        return format(new Date(), 'dd MMMM yyyy', { locale: id });
    }
  };

  const generateReportText = () => {
    if (!stats) return '';
    
    const periodLabel = dateRange === 'today' ? 'Hari Ini' : 
                       dateRange === 'thisWeek' ? 'Minggu Ini' : 'Bulan Ini';
    
    return `📊 *LAPORAN PENJUALAN*
📅 Periode: ${periodLabel}
📆 ${getDateLabel()}

💰 *RINGKASAN*
• Total Transaksi: ${stats.totalTransactions}
• Total Pendapatan: ${formatPrice(stats.totalRevenue)}
• Rata-rata: ${formatPrice(stats.averageOrder)}

💳 *METODE PEMBAYARAN*
• Tunai: ${formatPrice(stats.cashTotal)}
• Transfer: ${formatPrice(stats.transferTotal)}
• QRIS: ${formatPrice(stats.qrisTotal)}

👤 Dibuat oleh: ${profile?.full_name || 'Admin'}
🕐 ${format(new Date(), 'HH:mm', { locale: id })}`;
  };

  const handleSendTelegram = async () => {
    if (sending || !stats) return;
    setSending(true);

    try {
      const periodLabel = dateRange === 'today' ? 'Harian' : 
                         dateRange === 'thisWeek' ? 'Mingguan' : 'Bulanan';

      const { error } = await supabase.functions.invoke('send-telegram-report', {
        body: {
          report: {
            type: dateRange === 'today' ? 'daily' : dateRange === 'thisWeek' ? 'weekly' : 'monthly',
            date: getDateLabel(),
            totalOrders: stats.totalTransactions,
            totalRevenue: stats.totalRevenue,
            completedOrders: stats.totalTransactions,
            pendingOrders: 0,
            cancelledOrders: 0,
            cashTotal: stats.cashTotal,
            transferTotal: stats.transferTotal,
            qrisTotal: stats.qrisTotal,
            generatedBy: profile?.full_name || 'Admin',
          },
        },
      });

      if (error) throw error;
      toast.success(`Laporan ${periodLabel} berhasil dikirim ke Telegram!`);
    } catch (error) {
      console.error('Error sending report:', error);
      toast.error('Gagal mengirim laporan ke Telegram');
    } finally {
      setSending(false);
    }
  };

  const handleCopyText = () => {
    const text = generateReportText().replace(/\*/g, '');
    navigator.clipboard.writeText(text);
    toast.success('Teks laporan berhasil disalin!');
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-10 w-24 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Date Range Filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={dateRange === 'today' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setDateRange('today')}
          className={dateRange === 'today' ? 'gradient-primary' : ''}
        >
          Hari Ini
        </Button>
        <Button
          variant={dateRange === 'thisWeek' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setDateRange('thisWeek')}
          className={dateRange === 'thisWeek' ? 'gradient-primary' : ''}
        >
          Minggu Ini
        </Button>
        <Button
          variant={dateRange === 'thisMonth' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setDateRange('thisMonth')}
          className={dateRange === 'thisMonth' ? 'gradient-primary' : ''}
        >
          Bulan Ini
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Total Transaksi */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <FileText className="h-4 w-4" />
              <span className="text-sm">Total Transaksi</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {stats?.totalTransactions || 0}
            </p>
          </CardContent>
        </Card>

        {/* Total Pendapatan */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Total Pendapatan</span>
            </div>
            <p className="text-2xl font-bold text-primary">
              {formatPrice(stats?.totalRevenue || 0)}
            </p>
          </CardContent>
        </Card>

        {/* Rata-rata */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Rata-rata</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {formatPrice(stats?.averageOrder || 0)}
            </p>
          </CardContent>
        </Card>

        {/* Tunai */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Wallet className="h-4 w-4" />
              <span className="text-sm">Tunai</span>
            </div>
            <p className="text-2xl font-bold text-primary">
              {formatPrice(stats?.cashTotal || 0)}
            </p>
          </CardContent>
        </Card>

        {/* Transfer */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <CreditCard className="h-4 w-4" />
              <span className="text-sm">Transfer</span>
            </div>
            <p className="text-2xl font-bold text-cyan-500">
              {formatPrice(stats?.transferTotal || 0)}
            </p>
          </CardContent>
        </Card>

        {/* QRIS */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <QrCode className="h-4 w-4" />
              <span className="text-sm">QRIS</span>
            </div>
            <p className="text-2xl font-bold text-primary">
              {formatPrice(stats?.qrisTotal || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Telegram Report Section */}
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            <span className="font-medium">Kirim Laporan via Telegram Bot</span>
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={handleSendTelegram}
              disabled={sending}
              className="gradient-primary"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Kirim ke Telegram
            </Button>
            <Button
              variant="outline"
              onClick={handleCopyText}
            >
              <Copy className="h-4 w-4 mr-2" />
              Salin Teks
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Pastikan Telegram Bot sudah dikonfigurasi di menu Pengaturan → Notifikasi Telegram
          </p>
        </CardContent>
      </Card>

      {/* Daily Reminder Section */}
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="h-5 w-5" />
            <span className="font-semibold text-lg">Pengingat Laporan Harian</span>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Aktifkan Pengingat</p>
              <p className="text-sm text-muted-foreground">Terima notifikasi untuk mengirim laporan</p>
            </div>
            <Switch disabled />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
