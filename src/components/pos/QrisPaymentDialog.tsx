import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, QrCode, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { CartItem } from '@/types/pos';

interface QrisPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  onPaymentSuccess: () => void;
  orderId: string;
  total: number;
  customerName?: string;
  cart: CartItem[];
}

interface QrisResponse {
  success: boolean;
  transactionId?: string;
  orderId?: string;
  qrCodeUrl?: string;
  transactionStatus?: string;
  expiryTime?: string;
  error?: string;
}

type PaymentStatus = 'pending' | 'settlement' | 'capture' | 'expire' | 'cancel' | 'deny' | 'failure' | 'error';

export function QrisPaymentDialog({
  open,
  onClose,
  onPaymentSuccess,
  orderId,
  total,
  customerName,
  cart,
}: QrisPaymentDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [qrisData, setQrisData] = useState<QrisResponse | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('pending');
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const generateQris = useCallback(async () => {
    setIsLoading(true);
    setQrisData(null);
    setPaymentStatus('pending');

    try {
      const { data, error } = await supabase.functions.invoke('midtrans-qris', {
        body: {
          orderId: `ORDER-${orderId.slice(-8)}-${Date.now()}`,
          grossAmount: total,
          customerName: customerName || 'Customer',
          items: cart.map(item => ({
            id: item.menuItem.id,
            name: item.menuItem.name,
            price: item.menuItem.price,
            quantity: item.quantity,
          })),
        },
      });

      if (error) {
        console.error('QRIS generation error:', error);
        toast.error('Gagal membuat QRIS. Pastikan Midtrans sudah dikonfigurasi.');
        setQrisData({ success: false, error: error.message });
        return;
      }

      if (data?.error) {
        console.error('QRIS API error:', data.error);
        toast.error(data.error);
        setQrisData({ success: false, error: data.error });
        return;
      }

      console.log('QRIS generated:', data);
      setQrisData(data);

      // Calculate time left if expiry time is provided
      if (data?.expiryTime) {
        const expiryDate = new Date(data.expiryTime);
        const now = new Date();
        const diffSeconds = Math.floor((expiryDate.getTime() - now.getTime()) / 1000);
        setTimeLeft(diffSeconds > 0 ? diffSeconds : 0);
      }
    } catch (error: any) {
      console.error('QRIS generation failed:', error);
      toast.error('Gagal membuat QRIS');
      setQrisData({ success: false, error: error.message });
    } finally {
      setIsLoading(false);
    }
  }, [orderId, total, customerName, cart]);

  const checkPaymentStatus = useCallback(async () => {
    if (!qrisData?.orderId) return;

    setIsCheckingStatus(true);

    try {
      const { data, error } = await supabase.functions.invoke('midtrans-status', {
        body: { orderId: qrisData.orderId },
      });

      if (error) {
        console.error('Status check error:', error);
        return;
      }

      console.log('Payment status:', data);

      if (data?.transactionStatus) {
        setPaymentStatus(data.transactionStatus as PaymentStatus);

        if (data.transactionStatus === 'settlement' || data.transactionStatus === 'capture') {
          toast.success('Pembayaran berhasil!');
          onPaymentSuccess();
          onClose();
        } else if (data.transactionStatus === 'expire') {
          toast.error('QRIS sudah kadaluarsa');
        } else if (data.transactionStatus === 'cancel' || data.transactionStatus === 'deny') {
          toast.error('Pembayaran dibatalkan');
        }
      }
    } catch (error) {
      console.error('Status check failed:', error);
    } finally {
      setIsCheckingStatus(false);
    }
  }, [qrisData?.orderId, onPaymentSuccess, onClose]);

  // Generate QRIS when dialog opens
  useEffect(() => {
    if (open && !qrisData && !isLoading) {
      generateQris();
    }
  }, [open, qrisData, isLoading, generateQris]);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setQrisData(null);
      setPaymentStatus('pending');
      setTimeLeft(null);
    }
  }, [open]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  // Auto-check payment status every 5 seconds
  useEffect(() => {
    if (!open || !qrisData?.success || paymentStatus !== 'pending') return;

    const interval = setInterval(() => {
      checkPaymentStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, [open, qrisData?.success, paymentStatus, checkPaymentStatus]);

  const formatTimeLeft = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusDisplay = () => {
    switch (paymentStatus) {
      case 'settlement':
      case 'capture':
        return { icon: CheckCircle, text: 'Pembayaran Berhasil', color: 'text-green-500' };
      case 'expire':
        return { icon: Clock, text: 'QRIS Kadaluarsa', color: 'text-orange-500' };
      case 'cancel':
      case 'deny':
      case 'failure':
        return { icon: XCircle, text: 'Pembayaran Gagal', color: 'text-destructive' };
      default:
        return { icon: Clock, text: 'Menunggu Pembayaran', color: 'text-primary' };
    }
  };

  const statusDisplay = getStatusDisplay();
  const StatusIcon = statusDisplay.icon;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Pembayaran QRIS
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center py-4 space-y-4">
          {/* Total Amount */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Total Pembayaran</p>
            <p className="text-2xl font-bold text-primary">{formatPrice(total)}</p>
          </div>

          {/* QR Code Display */}
          {isLoading ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Membuat QRIS...</p>
            </div>
          ) : qrisData?.success && qrisData?.qrCodeUrl ? (
            <div className="flex flex-col items-center gap-3">
              <div className="bg-white p-4 rounded-lg border-2 border-primary/20">
                <img
                  src={qrisData.qrCodeUrl}
                  alt="QRIS Payment"
                  className="w-64 h-64 object-contain"
                />
              </div>

              {/* Timer */}
              {timeLeft !== null && timeLeft > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>Berlaku {formatTimeLeft(timeLeft)}</span>
                </div>
              )}

              {/* Status */}
              <div className={`flex items-center gap-2 ${statusDisplay.color}`}>
                <StatusIcon className="h-5 w-5" />
                <span className="font-medium">{statusDisplay.text}</span>
                {paymentStatus === 'pending' && isCheckingStatus && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
              </div>

              <p className="text-xs text-muted-foreground text-center max-w-xs">
                Scan QR code di atas menggunakan aplikasi e-wallet atau mobile banking Anda
              </p>
            </div>
          ) : qrisData?.error ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <XCircle className="h-12 w-12 text-destructive" />
              <p className="text-sm text-destructive">{qrisData.error}</p>
              <Button onClick={generateQris} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Coba Lagi
              </Button>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          {paymentStatus === 'pending' && qrisData?.success && (
            <Button 
              onClick={checkPaymentStatus} 
              disabled={isCheckingStatus}
              className="gradient-primary w-full"
            >
              {isCheckingStatus ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Cek Status Pembayaran
            </Button>
          )}

          {(paymentStatus === 'expire' || paymentStatus === 'cancel') && (
            <Button onClick={generateQris} className="gradient-primary w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Buat QRIS Baru
            </Button>
          )}

          <Button variant="outline" onClick={onClose} className="w-full">
            {paymentStatus === 'pending' ? 'Batal' : 'Tutup'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
