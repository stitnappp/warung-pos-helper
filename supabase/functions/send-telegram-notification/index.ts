import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderNotification {
  orderId: string;
  customerName?: string;
  total: number;
  items?: { name: string; quantity: number; price: number }[];
  paymentMethod?: string;
  notes?: string;
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
      console.error('[Telegram] Missing bot token or chat ID');
      throw new Error('Telegram configuration is missing');
    }

    const { order } = await req.json() as { order: OrderNotification };
    console.log('[Telegram] Received order notification request:', order);

    // Format the message
    const formatPrice = (price: number) => {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
      }).format(price);
    };

    let message = `🔔 *PESANAN BARU!*\n\n`;
    message += `📝 *Order ID:* #${order.orderId.slice(-6).toUpperCase()}\n`;
    
    if (order.customerName) {
      message += `👤 *Pelanggan:* ${order.customerName}\n`;
    }
    
    message += `💰 *Total:* ${formatPrice(order.total)}\n`;
    
    if (order.paymentMethod) {
      message += `💳 *Pembayaran:* ${order.paymentMethod}\n`;
    }

    if (order.items && order.items.length > 0) {
      message += `\n📋 *Detail Pesanan:*\n`;
      order.items.forEach((item, index) => {
        message += `${index + 1}. ${item.name} x${item.quantity} - ${formatPrice(item.price * item.quantity)}\n`;
      });
    }

    if (order.notes) {
      message += `\n📝 *Catatan:* ${order.notes}\n`;
    }

    message += `\n⏰ *Waktu:* ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`;

    console.log('[Telegram] Sending message to chat:', TELEGRAM_CHAT_ID);

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
    console.log('[Telegram] Response:', telegramResult);

    if (!telegramResult.ok) {
      console.error('[Telegram] Error:', telegramResult);
      throw new Error(`Telegram API error: ${telegramResult.description}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Notification sent' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Telegram] Error sending notification:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
