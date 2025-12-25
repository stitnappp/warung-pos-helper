import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSalesReport } from '@/hooks/useSalesReport';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { id } from 'date-fns/locale';
import { 
  TrendingUp, 
  ShoppingBag, 
  DollarSign, 
  Calendar,
  BarChart3,
} from 'lucide-react';

type DateRange = '7days' | '30days' | 'thisMonth' | 'lastMonth';

const COLORS = ['hsl(25, 95%, 53%)', 'hsl(145, 60%, 45%)', 'hsl(45, 95%, 55%)', 'hsl(200, 70%, 50%)', 'hsl(280, 60%, 50%)'];

export function SalesReport() {
  const [dateRange, setDateRange] = useState<DateRange>('7days');

  const getDateRange = () => {
    const today = new Date();
    switch (dateRange) {
      case '7days':
        return { start: subDays(today, 6), end: today };
      case '30days':
        return { start: subDays(today, 29), end: today };
      case 'thisMonth':
        return { start: startOfMonth(today), end: endOfMonth(today) };
      case 'lastMonth':
        const lastMonth = subMonths(today, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      default:
        return { start: subDays(today, 6), end: today };
    }
  };

  const { start, end } = getDateRange();
  const { data, isLoading } = useSalesReport(start, end);

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatShortPrice = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}jt`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}rb`;
    }
    return value.toString();
  };

  const chartData = data?.dailyData.map(d => ({
    ...d,
    displayDate: format(new Date(d.date), 'dd MMM', { locale: id }),
  })) || [];

  const pieData = data?.summary.topItems.map(item => ({
    name: item.name,
    value: item.revenue,
  })) || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-9 w-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={dateRange === '7days' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setDateRange('7days')}
        >
          <Calendar className="h-4 w-4 mr-1" />
          7 Hari
        </Button>
        <Button
          variant={dateRange === '30days' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setDateRange('30days')}
        >
          30 Hari
        </Button>
        <Button
          variant={dateRange === 'thisMonth' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setDateRange('thisMonth')}
        >
          Bulan Ini
        </Button>
        <Button
          variant={dateRange === 'lastMonth' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setDateRange('lastMonth')}
        >
          Bulan Lalu
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="gradient-primary text-primary-foreground">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 opacity-90">
              <DollarSign className="h-4 w-4" />
              Total Pendapatan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatPrice(data?.summary.totalRevenue || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <ShoppingBag className="h-4 w-4" />
              Total Pesanan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {data?.summary.totalOrders || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Rata-rata Pesanan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {formatPrice(data?.summary.averageOrderValue || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Grafik Pendapatan
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Tidak ada data untuk periode ini
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="displayDate" 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis 
                    tickFormatter={formatShortPrice}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatPrice(value), 'Pendapatan']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--popover-foreground))',
                    }}
                    labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                  />
                  <Bar 
                    dataKey="total" 
                    fill="hsl(25, 95%, 53%)" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top Items */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Menu Terlaris</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Tidak ada data
              </div>
            ) : (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => formatPrice(value)}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {data?.summary.topItems.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="truncate max-w-[120px]">{item.name}</span>
                      </div>
                      <span className="text-muted-foreground">{item.quantity}x</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Orders Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Jumlah Pesanan per Hari</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground">
              Tidak ada data untuk periode ini
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="displayDate" 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                />
                <YAxis 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                />
                <Tooltip 
                  formatter={(value: number) => [value, 'Pesanan']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--popover-foreground))',
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="orders" 
                  stroke="hsl(145, 60%, 45%)" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(145, 60%, 45%)', strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
