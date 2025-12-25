import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReportData {
  type: 'daily' | 'weekly' | 'monthly';
  date: string;
  totalOrders: number;
  totalRevenue: number;
  completedOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  cashTotal?: number;
  transferTotal?: number;
  qrisTotal?: number;
  topItems?: { name: string; quantity: number; revenue: number }[];
  generatedBy?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!TELEGRAM_BOT_TOKEN) {
      console.error('[Telegram Report] Missing bot token');
      throw new Error('Telegram bot token is missing');
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[Telegram Report] Missing Supabase credentials');
      throw new Error('Supabase configuration is missing');
    }

    // Get chat ID from database
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: settingData, error: settingError } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'telegram_chat_id')
      .maybeSingle();

    if (settingError) {
      console.error('[Telegram Report] Error fetching chat ID from database:', settingError);
      throw new Error('Failed to fetch Telegram chat ID');
    }

    // Fallback to env variable if database value is empty
    const TELEGRAM_CHAT_ID = settingData?.value || Deno.env.get('TELEGRAM_CHAT_ID');

    if (!TELEGRAM_CHAT_ID) {
      console.error('[Telegram Report] Chat ID not configured');
      throw new Error('Telegram Chat ID is not configured. Please set it in Admin settings.');
    }

    const { report } = await req.json() as { report: ReportData };
    console.log('[Telegram Report] Received report request:', report);

    // Format price
    const formatPrice = (price: number) => {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
      }).format(price);
    };

    // Build message
    const reportTypeLabels: Record<string, string> = {
      daily: 'HARIAN',
      weekly: 'MINGGUAN',
      monthly: 'BULANAN',
    };
    const reportTypeLabel = reportTypeLabels[report.type] || 'HARIAN';
    
    let message = `📊 *LAPORAN ${reportTypeLabel}*\n`;
    message += `━━━━━━━━━━━━━━━━━━\n\n`;
    message += `📅 *Periode:* ${report.date}\n\n`;
    
    message += `📈 *RINGKASAN PESANAN*\n`;
    message += `├ Total Pesanan: ${report.totalOrders}\n`;
    message += `├ ✅ Selesai: ${report.completedOrders}\n`;
    message += `├ ⏳ Pending: ${report.pendingOrders}\n`;
    message += `└ ❌ Dibatalkan: ${report.cancelledOrders}\n\n`;
    
    message += `💰 *TOTAL PENDAPATAN*\n`;
    message += `${formatPrice(report.totalRevenue)}\n\n`;

    // Add payment method breakdown if available
    if (report.cashTotal !== undefined || report.transferTotal !== undefined || report.qrisTotal !== undefined) {
      message += `💳 *METODE PEMBAYARAN*\n`;
      message += `├ 💵 Tunai: ${formatPrice(report.cashTotal || 0)}\n`;
      message += `├ 🏦 Transfer: ${formatPrice(report.transferTotal || 0)}\n`;
      message += `└ 📱 QRIS: ${formatPrice(report.qrisTotal || 0)}\n\n`;
    }

    if (report.topItems && report.topItems.length > 0) {
      message += `🏆 *TOP MENU*\n`;
      report.topItems.slice(0, 5).forEach((item, index) => {
        const prefix = index === report.topItems!.length - 1 ? '└' : '├';
        message += `${prefix} ${index + 1}. ${item.name} (${item.quantity}x) - ${formatPrice(item.revenue)}\n`;
      });
      message += '\n';
    }

    if (report.generatedBy) {
      message += `👤 *Dibuat oleh:* ${report.generatedBy}\n`;
    }
    
    message += `⏰ *Waktu Laporan:* ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`;

    console.log('[Telegram Report] Sending report to chat:', TELEGRAM_CHAT_ID);

    // Send to Telegram
    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const telegramResponse = await fetch(telegramUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    const telegramResult = await telegramResponse.json();
    console.log('[Telegram Report] Response:', telegramResult);

    if (!telegramResult.ok) {
      console.error('[Telegram Report] Error:', telegramResult);
      throw new Error(`Telegram API error: ${telegramResult.description}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Report sent' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Telegram Report] Error sending report:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});