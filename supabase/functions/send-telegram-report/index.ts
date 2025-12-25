import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReportData {
  type: 'daily' | 'monthly';
  date: string;
  totalOrders: number;
  totalRevenue: number;
  completedOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
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
    const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID');

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.error('[Telegram Report] Missing bot token or chat ID');
      throw new Error('Telegram configuration is missing');
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
    const reportTypeLabel = report.type === 'daily' ? 'HARIAN' : 'BULANAN';
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
