import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type AppRole = 'admin' | 'kasir';

export function useUserRole() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['userRole', user?.id],
    queryFn: async (): Promise<AppRole | null> => {
      if (!user) return null;

      // First try to fetch existing role
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && data?.role) {
        return data.role as AppRole;
      }

      // If no role exists, bootstrap one via secure function
      const { data: bootstrapped, error: bootstrapError } = await supabase
        .rpc('bootstrap_user_role');

      if (bootstrapError) {
        console.error('Error bootstrapping user role:', bootstrapError);
        return null;
      }

      return bootstrapped as AppRole;
    },
    enabled: !!user,
  });
}

export function useIsAdmin() {
  const { data: role, isLoading } = useUserRole();
  return {
    isAdmin: role === 'admin',
    isLoading,
  };
}
