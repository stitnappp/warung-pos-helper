import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subDays, format, eachDayOfInterval } from 'date-fns';

interface SalesData {
  date: string;
  total: number;
  orders: number;
}

interface SalesSummary {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  topItems: { name: string; quantity: number; revenue: number }[];
}

export function useSalesReport(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['salesReport', startDate.toISOString(), endDate.toISOString()],
    queryFn: async (): Promise<{ dailyData: SalesData[]; summary: SalesSummary }> => {
      try {
        // Fetch completed orders within date range
        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select('*')
          .eq('status', 'completed')
          .gte('created_at', startOfDay(startDate).toISOString())
          .lte('created_at', endOfDay(endDate).toISOString())
          .order('created_at', { ascending: true });

        if (ordersError) {
          console.error('[SalesReport] Error fetching orders:', ordersError);
          throw ordersError;
        }

      // Get order items for top items calculation
      const orderIds = orders?.map(o => o.id) || [];
      let orderItems: any[] = [];
      
      if (orderIds.length > 0) {
        const { data: items, error: itemsError } = await supabase
          .from('order_items')
          .select('*')
          .in('order_id', orderIds);
        
        if (itemsError) throw itemsError;
        orderItems = items || [];
      }

      // Calculate daily data
      const dailyMap = new Map<string, { total: number; orders: number }>();
      
      // Initialize all days in range
      const allDays = eachDayOfInterval({ start: startDate, end: endDate });
      allDays.forEach(day => {
        dailyMap.set(format(day, 'yyyy-MM-dd'), { total: 0, orders: 0 });
      });

      // Aggregate order data
      (orders || []).forEach(order => {
        const dateKey = format(new Date(order.created_at), 'yyyy-MM-dd');
        const existing = dailyMap.get(dateKey) || { total: 0, orders: 0 };
        dailyMap.set(dateKey, {
          total: existing.total + Number(order.total),
          orders: existing.orders + 1,
        });
      });

      const dailyData: SalesData[] = Array.from(dailyMap.entries())
        .map(([date, data]) => ({
          date,
          total: data.total,
          orders: data.orders,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Calculate summary
      const totalRevenue = (orders || []).reduce((sum, o) => sum + Number(o.total), 0);
      const totalOrders = orders?.length || 0;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Calculate top items
      const itemMap = new Map<string, { quantity: number; revenue: number }>();
      orderItems.forEach(item => {
        const existing = itemMap.get(item.name) || { quantity: 0, revenue: 0 };
        itemMap.set(item.name, {
          quantity: existing.quantity + item.quantity,
          revenue: existing.revenue + (Number(item.price) * item.quantity),
        });
      });

      const topItems = Array.from(itemMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      return {
        dailyData,
        summary: {
          totalRevenue,
          totalOrders,
          averageOrderValue,
          topItems,
        },
      };
      } catch (error) {
        console.error('[SalesReport] Error:', error);
        // Return empty data on error
        return {
          dailyData: [],
          summary: {
            totalRevenue: 0,
            totalOrders: 0,
            averageOrderValue: 0,
            topItems: [],
          },
        };
      }
    },
  });
}
