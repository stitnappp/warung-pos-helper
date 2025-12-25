import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch Midtrans configuration from database
    const { data: settings, error: settingsError } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', [
        'midtrans_server_key',
        'midtrans_environment',
      ]);

    if (settingsError) {
      console.error('Error fetching Midtrans settings:', settingsError);
      throw new Error('Failed to fetch Midtrans configuration');
    }

    const configMap: Record<string, string> = {};
    settings?.forEach(item => {
      configMap[item.key] = item.value || '';
    });

    const serverKey = configMap['midtrans_server_key'];
    const environment = configMap['midtrans_environment'] || 'sandbox';

    if (!serverKey) {
      return new Response(
        JSON.stringify({ error: 'Midtrans belum dikonfigurasi' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const baseUrl = environment === 'production' 
      ? 'https://api.midtrans.com' 
      : 'https://api.sandbox.midtrans.com';

    const { orderId } = await req.json();

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'Order ID diperlukan' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Checking transaction status for order:', orderId);

    const authString = btoa(serverKey + ':');

    // Call Midtrans Status API
    const statusResponse = await fetch(`${baseUrl}/v2/${orderId}/status`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Basic ${authString}`,
      },
    });

    const statusResult = await statusResponse.json();
    console.log('Midtrans status response:', JSON.stringify(statusResult));

    return new Response(
      JSON.stringify({
        transactionId: statusResult.transaction_id,
        orderId: statusResult.order_id,
        grossAmount: statusResult.gross_amount,
        transactionStatus: statusResult.transaction_status,
        transactionTime: statusResult.transaction_time,
        settlementTime: statusResult.settlement_time,
        paymentType: statusResult.payment_type,
        fraudStatus: statusResult.fraud_status,
        statusCode: statusResult.status_code,
        statusMessage: statusResult.status_message,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in midtrans-status function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
