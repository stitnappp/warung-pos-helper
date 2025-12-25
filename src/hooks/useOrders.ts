import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Order, OrderItem, CartItem } from '@/types/pos';
import { toast } from 'sonner';

export function useOrders() {
  return useQuery({
    queryKey: ['orders'],
    queryFn: async (): Promise<Order[]> => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(order => ({
        ...order,
        subtotal: Number(order.subtotal),
        tax: Number(order.tax),
        total: Number(order.total),
        status: order.status as Order['status'],
      }));
    },
  });
}

export function useOrderItems(orderId: string) {
  return useQuery({
    queryKey: ['orderItems', orderId],
    queryFn: async (): Promise<OrderItem[]> => {
      const { data, error } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);
      
      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        price: Number(item.price),
      }));
    },
    enabled: !!orderId,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      cart, 
      tableId, 
      customerName, 
      paymentMethod,
      notes 
    }: { 
      cart: CartItem[];
      tableId?: string;
      customerName?: string;
      paymentMethod?: string;
      notes?: string;
    }) => {
      const subtotal = cart.reduce((sum, item) => sum + (item.menuItem.price * item.quantity), 0);
      const tax = subtotal * 0.1; // 10% tax
      const total = subtotal + tax;

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          table_id: tableId || null,
          customer_name: customerName || null,
          subtotal,
          tax,
          total,
          payment_method: paymentMethod || null,
          notes: notes || null,
          status: 'pending',
        })
        .select()
        .single();
      
      if (orderError) throw orderError;

      const orderItems = cart.map(item => ({
        order_id: order.id,
        menu_item_id: item.menuItem.id,
        name: item.menuItem.name,
        price: item.menuItem.price,
        quantity: item.quantity,
        notes: item.notes || null,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);
      
      if (itemsError) throw itemsError;

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Pesanan berhasil dibuat!');
    },
    onError: (error: Error) => {
      toast.error(`Gagal membuat pesanan: ${error.message}`);
    },
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: Order['status'] }) => {
      const { data, error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Status pesanan diupdate');
    },
    onError: (error: Error) => {
      toast.error(`Gagal mengupdate status: ${error.message}`);
    },
  });
}