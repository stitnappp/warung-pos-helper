import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChargeRequest {
  orderId: string;
  grossAmount: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  items?: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
}

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
        'midtrans_merchant_id',
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
      console.error('Midtrans server key not configured');
      return new Response(
        JSON.stringify({ error: 'Midtrans belum dikonfigurasi. Silahkan atur di Admin Panel > Pengaturan.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine API endpoint based on environment
    const baseUrl = environment === 'production' 
      ? 'https://api.midtrans.com' 
      : 'https://api.sandbox.midtrans.com';

    const { orderId, grossAmount, customerName, customerEmail, customerPhone, items }: ChargeRequest = await req.json();

    console.log('Creating QRIS charge for order:', orderId, 'amount:', grossAmount);

    // Build charge request payload
    const chargePayload: Record<string, unknown> = {
      payment_type: 'qris',
      transaction_details: {
        order_id: orderId,
        gross_amount: Math.round(grossAmount),
      },
      qris: {
        acquirer: 'gopay',
      },
    };

    // Add customer details if provided
    if (customerName || customerEmail || customerPhone) {
      chargePayload.customer_details = {
        first_name: customerName || 'Customer',
        email: customerEmail || 'customer@example.com',
        phone: customerPhone || '08123456789',
      };
    }

    // Add item details if provided
    if (items && items.length > 0) {
      chargePayload.item_details = items.map(item => ({
        id: item.id,
        name: item.name.substring(0, 50), // Midtrans has 50 char limit
        price: Math.round(item.price),
        quantity: item.quantity,
      }));
    }

    console.log('Charge payload:', JSON.stringify(chargePayload));

    // Create authorization header (Base64 encoded server key)
    const authString = btoa(serverKey + ':');

    // Call Midtrans Charge API
    const chargeResponse = await fetch(`${baseUrl}/v2/charge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Basic ${authString}`,
      },
      body: JSON.stringify(chargePayload),
    });

    const chargeResult = await chargeResponse.json();
    console.log('Midtrans charge response:', JSON.stringify(chargeResult));

    if (chargeResult.status_code && chargeResult.status_code !== '201') {
      console.error('Midtrans charge failed:', chargeResult);
      return new Response(
        JSON.stringify({ 
          error: chargeResult.status_message || 'Gagal membuat QRIS',
          details: chargeResult,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract QR code URL from actions
    let qrCodeUrl = '';
    if (chargeResult.actions && Array.isArray(chargeResult.actions)) {
      // Prefer generate-qr-code-v2 (ASPI format) if available
      const qrCodeV2 = chargeResult.actions.find((a: { name: string }) => a.name === 'generate-qr-code-v2');
      const qrCode = chargeResult.actions.find((a: { name: string }) => a.name === 'generate-qr-code');
      qrCodeUrl = qrCodeV2?.url || qrCode?.url || '';
    }

    return new Response(
      JSON.stringify({
        success: true,
        transactionId: chargeResult.transaction_id,
        orderId: chargeResult.order_id,
        grossAmount: chargeResult.gross_amount,
        transactionStatus: chargeResult.transaction_status,
        transactionTime: chargeResult.transaction_time,
        qrCodeUrl,
        actions: chargeResult.actions,
        acquirer: chargeResult.acquirer,
        expiryTime: chargeResult.expiry_time,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in midtrans-qris function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
