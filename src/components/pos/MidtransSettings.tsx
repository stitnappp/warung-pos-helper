import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { CreditCard, Save, Loader2, ExternalLink, Shield, TestTube, Rocket } from 'lucide-react';
import { toast } from 'sonner';

interface MidtransConfig {
  merchantId: string;
  clientKey: string;
  serverKey: string;
  environment: 'sandbox' | 'production';
}

export function MidtransSettings() {
  const [config, setConfig] = useState<MidtransConfig>({
    merchantId: '',
    clientKey: '',
    serverKey: '',
    environment: 'sandbox',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', [
          'midtrans_merchant_id',
          'midtrans_client_key',
          'midtrans_server_key',
          'midtrans_environment',
        ]);

      if (error) throw error;

      const configMap: Record<string, string> = {};
      data?.forEach(item => {
        configMap[item.key] = item.value || '';
      });

      setConfig({
        merchantId: configMap['midtrans_merchant_id'] || '',
        clientKey: configMap['midtrans_client_key'] || '',
        serverKey: configMap['midtrans_server_key'] || '',
        environment: (configMap['midtrans_environment'] as 'sandbox' | 'production') || 'sandbox',
      });
    } catch (error) {
      console.error('Error fetching Midtrans config:', error);
      toast.error('Gagal memuat konfigurasi Midtrans');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);

    try {
      const updates = [
        { key: 'midtrans_merchant_id', value: config.merchantId },
        { key: 'midtrans_client_key', value: config.clientKey },
        { key: 'midtrans_server_key', value: config.serverKey },
        { key: 'midtrans_environment', value: config.environment },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('app_settings')
          .update({ value: update.value })
          .eq('key', update.key);

        if (error) throw error;
      }

      toast.success('Konfigurasi Midtrans berhasil disimpan!');
    } catch (error) {
      console.error('Error saving Midtrans config:', error);
      toast.error('Gagal menyimpan konfigurasi Midtrans');
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

  const sandboxEndpoint = 'https://api.sandbox.midtrans.com';
  const productionEndpoint = 'https://api.midtrans.com';

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          Pengaturan Midtrans QRIS
        </CardTitle>
        <CardDescription>
          Konfigurasi akun Midtrans untuk pembayaran QRIS. Dapatkan kredensial dari{' '}
          <a
            href="https://dashboard.midtrans.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            Dashboard Midtrans <ExternalLink className="h-3 w-3" />
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Environment Selection */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Environment
          </Label>
          <RadioGroup
            value={config.environment}
            onValueChange={(value) => setConfig(prev => ({ ...prev, environment: value as 'sandbox' | 'production' }))}
            className="grid grid-cols-2 gap-4"
          >
            <div className="flex items-center space-x-2 border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="sandbox" id="sandbox" />
              <Label htmlFor="sandbox" className="flex items-center gap-2 cursor-pointer flex-1">
                <TestTube className="h-4 w-4 text-yellow-500" />
                <div>
                  <p className="font-medium">Sandbox</p>
                  <p className="text-xs text-muted-foreground">Mode pengujian</p>
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-2 border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="production" id="production" />
              <Label htmlFor="production" className="flex items-center gap-2 cursor-pointer flex-1">
                <Rocket className="h-4 w-4 text-green-500" />
                <div>
                  <p className="font-medium">Production</p>
                  <p className="text-xs text-muted-foreground">Mode produksi</p>
                </div>
              </Label>
            </div>
          </RadioGroup>
          <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
            Endpoint API: <code className="bg-background px-1 py-0.5 rounded text-xs">
              {config.environment === 'sandbox' ? sandboxEndpoint : productionEndpoint}
            </code>
          </p>
        </div>

        {/* Merchant ID */}
        <div className="space-y-2">
          <Label htmlFor="merchantId">Merchant ID</Label>
          <Input
            id="merchantId"
            value={config.merchantId}
            onChange={(e) => setConfig(prev => ({ ...prev, merchantId: e.target.value }))}
            placeholder="G123456789"
          />
          <p className="text-xs text-muted-foreground">
            ID merchant Anda dari dashboard Midtrans
          </p>
        </div>

        {/* Client Key */}
        <div className="space-y-2">
          <Label htmlFor="clientKey">Client Key</Label>
          <Input
            id="clientKey"
            value={config.clientKey}
            onChange={(e) => setConfig(prev => ({ ...prev, clientKey: e.target.value }))}
            placeholder="SB-Mid-client-xxxxxxxx"
          />
          <p className="text-xs text-muted-foreground">
            Client key untuk integrasi frontend (publishable)
          </p>
        </div>

        {/* Server Key */}
        <div className="space-y-2">
          <Label htmlFor="serverKey">Server Key</Label>
          <Input
            id="serverKey"
            type="password"
            value={config.serverKey}
            onChange={(e) => setConfig(prev => ({ ...prev, serverKey: e.target.value }))}
            placeholder="SB-Mid-server-xxxxxxxx"
          />
          <p className="text-xs text-muted-foreground">
            Server key untuk integrasi backend (rahasia)
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
          <p className="font-medium">Cara mendapatkan kredensial Midtrans:</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Login ke <a href="https://dashboard.midtrans.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Dashboard Midtrans</a></li>
            <li>Pilih mode Sandbox atau Production</li>
            <li>Buka menu Settings → Access Keys</li>
            <li>Salin Merchant ID, Client Key, dan Server Key</li>
            <li>Tempel kredensial di form di atas</li>
          </ol>
        </div>

        <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-4 text-sm">
          <p className="font-medium text-yellow-600 dark:text-yellow-400">⚠️ Penting</p>
          <p className="text-muted-foreground mt-1">
            Gunakan mode Sandbox untuk pengujian. Setelah integrasi berfungsi dengan baik, 
            ganti ke mode Production untuk menerima pembayaran nyata.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
