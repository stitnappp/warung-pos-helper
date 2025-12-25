import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { MessageSquare, Save, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export function TelegramSettings() {
  const [chatId, setChatId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchChatId();
  }, []);

  const fetchChatId = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'telegram_chat_id')
        .maybeSingle();

      if (error) throw error;
      setChatId(data?.value || '');
    } catch (error) {
      console.error('Error fetching chat ID:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('app_settings')
        .update({ value: chatId })
        .eq('key', 'telegram_chat_id');

      if (error) throw error;
      toast.success('Chat ID Telegram berhasil disimpan!');
    } catch (error) {
      console.error('Error saving chat ID:', error);
      toast.error('Gagal menyimpan Chat ID');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          Pengaturan Telegram
        </CardTitle>
        <CardDescription>
          Konfigurasi akun Telegram untuk menerima notifikasi pesanan dan laporan
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="chatId">Chat ID Telegram</Label>
          <Input
            id="chatId"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            placeholder="Masukkan Chat ID (contoh: 123456789)"
          />
          <p className="text-xs text-muted-foreground">
            Untuk mendapatkan Chat ID, kirim pesan ke bot{' '}
            <a 
              href="https://t.me/userinfobot" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              @userinfobot <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="gradient-primary w-full"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Simpan Pengaturan
        </Button>

        <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-2">
          <p className="font-medium">Cara mendapatkan Chat ID:</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Buka Telegram</li>
            <li>Cari bot @userinfobot</li>
            <li>Kirim pesan /start</li>
            <li>Salin angka "Id" yang diberikan</li>
            <li>Tempel di kolom Chat ID di atas</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
