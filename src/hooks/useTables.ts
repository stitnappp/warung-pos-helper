import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RestaurantTable } from '@/types/pos';
import { toast } from 'sonner';

export function useTables() {
  return useQuery({
    queryKey: ['tables'],
    queryFn: async (): Promise<RestaurantTable[]> => {
      const { data, error } = await supabase
        .from('restaurant_tables')
        .select('*')
        .order('table_number', { ascending: true });
      
      if (error) throw error;
      return (data || []).map(table => ({
        ...table,
        status: table.status as RestaurantTable['status'],
      }));
    },
  });
}

export function useCreateTable() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (table: Omit<RestaurantTable, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('restaurant_tables')
        .insert(table)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      toast.success('Meja berhasil ditambahkan');
    },
    onError: (error: Error) => {
      toast.error(`Gagal menambahkan meja: ${error.message}`);
    },
  });
}

export function useUpdateTable() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<RestaurantTable> & { id: string }) => {
      const { data, error } = await supabase
        .from('restaurant_tables')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      toast.success('Meja berhasil diupdate');
    },
    onError: (error: Error) => {
      toast.error(`Gagal mengupdate meja: ${error.message}`);
    },
  });
}