import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export function useOrderNotifications() {
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create notification sound
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQAXbLWvl1gAGR+b2umvbAQPWZvC0q5lCgxXm8PVq2cJDVabxdKrZgsMVpvE1KpmCwxXm8PUrGYLDFebxNSqZgsNV5vE1KtmCwxXm8TUq2YLDFebxNSrZgsNV5vE1KpmCwxXm8TUq2cLDFebxNSrZgsNV5vE1KtnCwxXm8TUq2YLDFebw9SrZwsNV5vE1KtmCw1Xm8PUrGYLDVebxNSrZgsNV5vD1KxmCw1Xm8TUq2YLDVebw9SsZgsNV5vE1KtnCw1Xm8PUrGYLDVebxNSrZwsNV5vD1KtnCw1Xm8TUrGYLDVebw9SsZgsNV5vE1KtnCw1Xm8PUrGcLDVebxNSrZwsNV5vE1KtnCw1Xm8TUrGcLDVebxNSrZwsNV5vE1KtnDQ1Xm8TUrGcLDVebxNSrZwsNWJvE1KtnCw1Xm8TUq2cLDVebxNSrZwsNV5vE1KxnCw1Xm8TUq2cLDVebxNSsZwsNV5vE1KtnCw5Xm8TUq2cLDVebxNSsZwsNV5vE1KtnCw1Xm8TUrGcLDVebxNSrZwsNV5vE1KxnCw1Xm8TUrGcLDVebxNSsZwsNV5vE1KtnCw5Xm8TUrGcLDVebxNSrZwsNWJvE1KxnCw1Xm8TUrGcLDVebxNSsZwsNV5vE1KxnCw1Ym8TUrGcLDVebxNSsZw0NV5vE1KxnCw1Xm8TUrGcLDVebxNSsZwsNWJvE1KtnDQ1Xm8TUrGcLDVibxNSsZwsNV5vE1KxnCw1Ym8TUrGcNDVebxNSsZwsNWJvE1KxnCw1Xm8TUrGcLDVibxNSsZw0NV5vE1KxnCw1Ym8TUrGcLDVibxNSsZwsNWJvE06xnCw1Ym8TUrGcLDVibxNSsZwsNWJvE1KxnDA1Ym8TUrGcLDVibxNSsZwsNWJvE1KxnCw1Ym8TUrGcMDVibxNSsZwsNWJvE06xnCw1Ym8TUrGcLDVibxNSsZw0NWJvE1KxnCw1Ym8TUrGcLDVibxNSsZwwNWJvE1KxnDA1Ym8TUrGcMDVibxNSsZwwNWJvE1KxnDA1Ym8TUrGcMDVibxNSsZwwNWJvE1KxnDA1Ym8TUrWcMDVibxNOsZwwNWJvE06xnDA1Ym8TUrGcMDVibxNSsZwwNWJvE1KxnDA1Ym8TUrGcMDVibxNSsZwwOWJvE1KxnDA1Ym8TUrGcMDlibxNSsZwwNWJvE1KxnDA5Ym8TUrGcMDVmbxNSsZwwNWJvE1KxnDA5Ym8TUrGcMDlibxNSsZwwNWJvE1K1nDA1Ym8TUrGcMDlibxNSsZwwNWZvE1KxnDA1Ym8TUrWcMDVibxNSsZwwOWJvE1KxnDA5Ym8TUrGcMDlibxNSsZwwNWZvE1KxnDA5Ym8TUrGcMDlibxNSsaAwNWJvE1KxnDA5Ym8TUrGcMDlibxNOsaAwNWZvE1KxnDA5Ym8TUrGgMDlibxNSsZwwOWJvE1K1nDA1Zm8TUrGgMDVmbxNSsaAwNWZvE1KxoDA1Zm8TUrGgMDVmbxNSsaAwNWZvE1KxoDA5Zm8TUrGgMDVmbxNSsaAwNWZvE0+xoDA1Zm8TUrGgMDVmbxNSsaAwNWZvE1KxoDA1Zm8TUq2gMDVmbxNSsaAwNWZvE1KxoDA1Zm8TUrGgMDVmbxNSsaAwNWZvE1KxoDA1Zm8TUrGgMDVmbxNSsaAwNWZvE1KxoDA1Zm8TUrGgMDVmbxNSsaAwNWZvE1KxoDA1Zm8TUrGgMDVmbxNSsaAwNWZvE1KxoDA5Zm8TUrGgMDVmbxNSsaAwNWZvE1KxoDA1Zm8TUrGgMDVmbxNSsaAwNWZvE1KxoDA1Zm8TUrGgMDVmbxNSsaAwNmZvE1KxoDA1Zm8TUrGgMDVmbxNSsaAwNWZvE1KxoDA1Zm8TUrGgMDVmbxNSsaAwNWZvE1KxoDA1Zm8TUrGgMDVmbxNSsaAwNWZvE1KxoDA1Zm8TUrGgMDVmbxNSsaA=');
    
    console.log('[Realtime] Setting up order notifications channel');
    
    const channel = supabase
      .channel('orders-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          console.log('[Realtime] New order received:', payload);
          
          // Play notification sound
          if (audioRef.current) {
            audioRef.current.play().catch(err => {
              console.log('[Realtime] Could not play sound:', err);
            });
          }
          
          // Show toast notification
          const order = payload.new;
          const orderId = order.id?.slice(-6).toUpperCase() || 'NEW';
          const total = new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
          }).format(order.total || 0);
          
          toast.success(`Pesanan Baru! #${orderId}`, {
            description: `${order.customer_name || 'Pelanggan'} - ${total}`,
            duration: 5000,
          });
          
          // Invalidate orders query to refresh the list
          queryClient.invalidateQueries({ queryKey: ['orders'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          console.log('[Realtime] Order updated:', payload);
          queryClient.invalidateQueries({ queryKey: ['orders'] });
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
      });

    return () => {
      console.log('[Realtime] Cleaning up order notifications channel');
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
