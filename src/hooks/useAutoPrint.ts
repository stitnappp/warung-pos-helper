import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useAutoPrint() {
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAutoPrintSetting();
  }, []);

  const fetchAutoPrintSetting = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'auto_print_enabled')
        .maybeSingle();

      if (error) throw error;
      setAutoPrintEnabled(data?.value === 'true');
    } catch (error) {
      console.error('Error fetching auto print setting:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAutoPrint = async (enabled: boolean) => {
    try {
      // Check if setting exists
      const { data: existing } = await supabase
        .from('app_settings')
        .select('key')
        .eq('key', 'auto_print_enabled')
        .maybeSingle();

      if (existing) {
        await supabase
          .from('app_settings')
          .update({ value: enabled ? 'true' : 'false' })
          .eq('key', 'auto_print_enabled');
      } else {
        await supabase
          .from('app_settings')
          .insert({ 
            key: 'auto_print_enabled', 
            value: enabled ? 'true' : 'false',
            description: 'Auto print receipt after checkout'
          });
      }

      setAutoPrintEnabled(enabled);
      return true;
    } catch (error) {
      console.error('Error saving auto print setting:', error);
      return false;
    }
  };

  return {
    autoPrintEnabled,
    loading,
    toggleAutoPrint,
  };
}
