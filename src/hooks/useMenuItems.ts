import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MenuItem, MenuCategory } from '@/types/pos';
import { toast } from 'sonner';

export function useMenuItems() {
  return useQuery({
    queryKey: ['menuItems'],
    queryFn: async (): Promise<MenuItem[]> => {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        price: Number(item.price),
      }));
    },
  });
}

export function useMenuCategories() {
  return useQuery({
    queryKey: ['menuCategories'],
    queryFn: async (): Promise<MenuCategory[]> => {
      const { data, error } = await supabase
        .from('menu_categories')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateMenuItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (menuItem: Omit<MenuItem, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('menu_items')
        .insert(menuItem)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menuItems'] });
      toast.success('Menu item berhasil ditambahkan');
    },
    onError: (error: Error) => {
      toast.error(`Gagal menambahkan menu: ${error.message}`);
    },
  });
}

export function useUpdateMenuItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MenuItem> & { id: string }) => {
      const { data, error } = await supabase
        .from('menu_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menuItems'] });
      toast.success('Menu item berhasil diupdate');
    },
    onError: (error: Error) => {
      toast.error(`Gagal mengupdate menu: ${error.message}`);
    },
  });
}

export function useDeleteMenuItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menuItems'] });
      toast.success('Menu item berhasil dihapus');
    },
    onError: (error: Error) => {
      toast.error(`Gagal menghapus menu: ${error.message}`);
    },
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (category: Omit<MenuCategory, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('menu_categories')
        .insert(category)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menuCategories'] });
      toast.success('Kategori berhasil ditambahkan');
    },
    onError: (error: Error) => {
      toast.error(`Gagal menambahkan kategori: ${error.message}`);
    },
  });
}