import { useState, useCallback, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';

export interface BluetoothDevice {
  name: string;
  address: string;
}

interface PrinterStatus {
  isConnected: boolean;
  connectedDevice: BluetoothDevice | null;
  isScanning: boolean;
  isPrinting: boolean;
  devices: BluetoothDevice[];
  error: string | null;
}

// Check if running on native platform
const isNative = Capacitor.isNativePlatform();

const STORAGE_KEY = 'eppos_printer_device';

// Fixed line width for 58mm thermal paper
const LINE_WIDTH = 32;

const sanitizeReceiptText = (text: string) => {
  // Thermal printers are sensitive to charset/encoding; keep output strictly ASCII-ish
  // to prevent garbled characters (e.g., Mandarin glyphs) on some devices.
  return text
    .normalize('NFKD')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');
};

export function useBluetoothPrinter() {
  const [status, setStatus] = useState<PrinterStatus>({
    isConnected: false,
    connectedDevice: null,
    isScanning: false,
    isPrinting: false,
    devices: [],
    error: null,
  });

  const [thermalPrinter, setThermalPrinter] = useState<any>(null);
  const listenerRef = useRef<any>(null);
  const finishListenerRef = useRef<any>(null);

  // Load thermal printer plugin dynamically
  useEffect(() => {
    if (!isNative) return;

    import('capacitor-thermal-printer')
      .then((printerModule) => {
        const printer = printerModule.CapacitorThermalPrinter;
        setThermalPrinter(printer);
        console.log('Thermal printer plugin loaded');
      })
      .catch((err) => {
        console.error('Failed to load thermal printer plugin:', err);
      });
  }, []);

  // Scan for Bluetooth devices using thermal printer plugin's startScan
  const scanDevices = useCallback(async () => {
    if (!isNative || !thermalPrinter) {
      setStatus(prev => ({
        ...prev,
        error: 'Fitur ini hanya tersedia di aplikasi Android'
      }));
      return;
    }

    try {
      setStatus(prev => ({ ...prev, isScanning: true, error: null, devices: [] }));

      // Clean up previous listeners
      if (listenerRef.current) {
        await listenerRef.current.remove();
        listenerRef.current = null;
      }
      if (finishListenerRef.current) {
        await finishListenerRef.current.remove();
        finishListenerRef.current = null;
      }

      const foundDevices: BluetoothDevice[] = [];

      // Listen for discovered devices
      listenerRef.current = await thermalPrinter.addListener('discoverDevices', (data: { devices: BluetoothDevice[] }) => {
        console.log('Discovered devices:', data.devices);

        for (const device of data.devices) {
          // Check if device is not already in list
          if (!foundDevices.some(d => d.address === device.address)) {
            // Prioritize Eppos, RPP, and thermal printer devices
            const deviceName = device.name || 'Unknown Device';
            const isEppos = deviceName.toLowerCase().includes('eppos') ||
                           deviceName.toLowerCase().includes('rpp');
            const isPrinter = deviceName.toLowerCase().includes('printer') ||
                             deviceName.toLowerCase().includes('pos') ||
                             deviceName.toLowerCase().includes('thermal');

            if (isEppos || isPrinter) {
              foundDevices.unshift(device);
            } else {
              foundDevices.push(device);
            }

            setStatus(prev => ({
              ...prev,
              devices: [...foundDevices]
            }));
          }
        }
      });

      // Listen for scan finish
      finishListenerRef.current = await thermalPrinter.addListener('discoveryFinish', () => {
        console.log('Discovery finished');
        setStatus(prev => ({ ...prev, isScanning: false }));
      });

      // Start scanning - this uses Bluetooth Classic on Android
      await thermalPrinter.startScan();
      console.log('Started scanning for printers...');

      // Auto stop after 15 seconds if not finished
      setTimeout(async () => {
        try {
          await thermalPrinter.stopScan();
        } catch (e) {
          console.log('Scan may have already stopped');
        }
        setStatus(prev => ({ ...prev, isScanning: false }));
      }, 15000);

    } catch (error: any) {
      console.error('Scan error:', error);
      setStatus(prev => ({
        ...prev,
        isScanning: false,
        error: error.message || 'Gagal mencari printer. Pastikan Bluetooth aktif dan izin diberikan.'
      }));
    }
  }, [thermalPrinter]);

  // Connect to a specific printer
  const connectPrinter = useCallback(async (device: BluetoothDevice) => {
    if (!isNative || !thermalPrinter) {
      return false;
    }

    try {
      setStatus(prev => ({ ...prev, error: null }));

      // Connect using thermal printer plugin with device address
      await thermalPrinter.connect({ address: device.address });

      setStatus(prev => ({
        ...prev,
        isConnected: true,
        connectedDevice: device
      }));

      // Save to localStorage for reconnection
      localStorage.setItem(STORAGE_KEY, JSON.stringify(device));

      return true;
    } catch (error: any) {
      console.error('Connect error:', error);
      setStatus(prev => ({
        ...prev,
        error: error.message || 'Gagal koneksi ke printer. Pastikan printer sudah di-pair.'
      }));
      return false;
    }
  }, [thermalPrinter]);

  // Disconnect from printer
  const disconnectPrinter = useCallback(async () => {
    if (!isNative || !thermalPrinter) return;

    try {
      await thermalPrinter.disconnect();
      setStatus(prev => ({
        ...prev,
        isConnected: false,
        connectedDevice: null
      }));
      localStorage.removeItem(STORAGE_KEY);
    } catch (error: any) {
      setStatus(prev => ({
        ...prev,
        error: error.message || 'Gagal disconnect'
      }));
    }
  }, [thermalPrinter]);

  // Test print function
  const testPrint = useCallback(async () => {
    if (!isNative || !thermalPrinter) {
      return false;
    }

    if (!status.isConnected) {
      setStatus(prev => ({ ...prev, error: 'Printer belum terhubung' }));
      return false;
    }

    try {
      setStatus(prev => ({ ...prev, isPrinting: true, error: null }));

      const dateStr = new Date().toLocaleDateString('id-ID');
      const timeStr = new Date().toLocaleTimeString('id-ID');
      const lineStr = '-'.repeat(LINE_WIDTH);

      // Use plugin's builder API (Android implementation) then write()
      const printer = thermalPrinter.begin().clearFormatting();

      const receiptTextRaw =
        `TEST PRINT\n` +
        `${lineStr}\n` +
        `Printer Terhubung!\n` +
        `${dateStr} ${timeStr}\n` +
        `${lineStr}\n` +
        `WARUNG POS\n\n\n`;

      const receiptText = sanitizeReceiptText(receiptTextRaw);

      await printer
        .align('center')
        .bold()
        .text(receiptText)
        .bold(false)
        .feedCutPaper()
        .write();

      setStatus(prev => ({ ...prev, isPrinting: false }));
      return true;
    } catch (error: any) {
      setStatus(prev => ({
        ...prev,
        isPrinting: false,
        error: error.message || 'Test print gagal'
      }));
      return false;
    }
  }, [status.isConnected, thermalPrinter]);

  // Print receipt
  const printReceipt = useCallback(async (receiptData: {
    orderNumber: string;
    cashierName: string;
    tableNumber?: number;
    items: Array<{ name: string; quantity: number; price: number }>;
    subtotal: number;
    discount: number;
    total: number;
    paymentMethod: string;
    amountPaid: number;
    change: number;
    timestamp: Date;
    restaurantSettings?: {
      restaurant_name: string;
      address_line1: string | null;
      address_line2: string | null;
      address_line3: string | null;
      whatsapp_number: string | null;
      instagram_handle: string | null;
      footer_message: string | null;
    };
  }) => {
    if (!isNative || !thermalPrinter) {
      return false;
    }

    if (!status.isConnected) {
      setStatus(prev => ({ ...prev, error: 'Printer belum terhubung' }));
      return false;
    }

    try {
      setStatus(prev => ({ ...prev, isPrinting: true, error: null }));

      const paymentMethodText: Record<string, string> = {
        cash: 'Tunai',
        transfer: 'Transfer',
        qris: 'QRIS',
      };

      const formatPrice = (price: number) => {
        return new Intl.NumberFormat('id-ID', {
          minimumFractionDigits: 0,
        }).format(price);
      };

      const dateStr = receiptData.timestamp.toLocaleDateString('id-ID');
      const timeStr = receiptData.timestamp.toLocaleTimeString('id-ID');

      // Get restaurant settings or use defaults
      const rs = receiptData.restaurantSettings;
      const restaurantName = rs?.restaurant_name || 'WARUNG POS';
      const addressLine1 = rs?.address_line1 || '';
      const addressLine2 = rs?.address_line2 || '';
      const addressLine3 = rs?.address_line3 || '';
      const footerMessage = rs?.footer_message || 'Terima Kasih!';

      // Helper functions for text formatting based on LINE_WIDTH
      const dashedLine = '-'.repeat(LINE_WIDTH);

      // Create two-column line: left label + right value
      const twoColumn = (left: string, right: string) => {
        const rightLen = right.length;
        const leftMax = LINE_WIDTH - rightLen - 1;
        const leftTrimmed = left.slice(0, leftMax);
        const spaces = LINE_WIDTH - leftTrimmed.length - rightLen;
        return leftTrimmed + ' '.repeat(Math.max(1, spaces)) + right;
      };

      // Create item line: Item | Qty | Harga (aligned columns)
      const itemLine = (name: string, qty: number, price: string) => {
        const qtyStr = String(qty);
        const qtyWidth = 4;
        const priceWidth = Math.max(10, price.length + 1);
        const nameWidth = LINE_WIDTH - qtyWidth - priceWidth;

        const nameTrimmed = name.length > nameWidth ? name.slice(0, nameWidth - 1) : name;
        const namePadded = nameTrimmed.padEnd(nameWidth, ' ');
        const qtyPadded = qtyStr.padStart(qtyWidth - 1, ' ') + ' ';
        const pricePadded = price.padStart(priceWidth, ' ');

        return namePadded + qtyPadded + pricePadded;
      };

      // Header row for items table
      const itemHeader = () => {
        const qtyWidth = 4;
        const priceWidth = Math.max(10, 6);
        const nameWidth = LINE_WIDTH - qtyWidth - priceWidth;

        return 'Item'.padEnd(nameWidth, ' ') + 'Qty'.padStart(qtyWidth, ' ') + 'Harga'.padStart(priceWidth, ' ');
      };

      // Print using plugin builder API (implemented on Android)
      const printer = thermalPrinter.begin().clearFormatting();

      // Build receipt text
      let receiptTextRaw = '';

      // Header - Restaurant name (bold, centered)
      receiptTextRaw += `${restaurantName}\n`;

      // Address lines (centered, smaller)
      if (addressLine1) receiptTextRaw += `${addressLine1}\n`;
      if (addressLine2) receiptTextRaw += `${addressLine2}\n`;
      if (addressLine3) receiptTextRaw += `${addressLine3}\n`;

      receiptTextRaw += `${dashedLine}\n`;

      // Order info section
      receiptTextRaw += `${twoColumn('No. Order:', '#' + receiptData.orderNumber)}\n`;
      receiptTextRaw += `${twoColumn('Tanggal:', `${dateStr} ${timeStr}`)}\n`;
      receiptTextRaw += `${twoColumn('Pembayaran:', paymentMethodText[receiptData.paymentMethod] || receiptData.paymentMethod)}\n`;
      receiptTextRaw += `${twoColumn('Kasir:', receiptData.cashierName)}\n`;
      if (receiptData.tableNumber) {
        receiptTextRaw += `${twoColumn('Meja:', String(receiptData.tableNumber))}\n`;
      }

      receiptTextRaw += `${dashedLine}\n`;

      // Items table header
      receiptTextRaw += `${itemHeader()}\n`;

      // Items
      for (const item of receiptData.items) {
        const itemTotal = item.price * item.quantity;
        const priceStr = 'Rp ' + formatPrice(itemTotal);
        receiptTextRaw += `${itemLine(item.name, item.quantity, priceStr)}\n`;
      }

      receiptTextRaw += `${dashedLine}\n`;

      // Totals section
      if (receiptData.discount > 0) {
        receiptTextRaw += `${twoColumn('Subtotal:', 'Rp ' + formatPrice(receiptData.subtotal))}\n`;
        receiptTextRaw += `${twoColumn('Diskon:', '-Rp ' + formatPrice(receiptData.discount))}\n`;
      }

      receiptTextRaw += `${twoColumn('TOTAL:', 'Rp ' + formatPrice(receiptData.total))}\n`;

      // Payment info
      const payMethod = paymentMethodText[receiptData.paymentMethod] || receiptData.paymentMethod;
      receiptTextRaw += `${twoColumn(payMethod + ':', 'Rp ' + formatPrice(receiptData.amountPaid))}\n`;
      if (receiptData.change > 0) {
        receiptTextRaw += `${twoColumn('Kembali:', 'Rp ' + formatPrice(receiptData.change))}\n`;
      }

      // Footer
      receiptTextRaw += `${dashedLine}\n`;
      receiptTextRaw += `${footerMessage}\n\n\n`;

      const receiptText = sanitizeReceiptText(receiptTextRaw);

      await printer
        .align('center')
        .text(receiptText)
        .feedCutPaper()
        .write();

      setStatus(prev => ({ ...prev, isPrinting: false }));
      return true;
    } catch (error: any) {
      console.error('Print error:', error);
      setStatus(prev => ({
        ...prev,
        isPrinting: false,
        error: error.message || 'Gagal mencetak struk'
      }));
      return false;
    }
  }, [status.isConnected, thermalPrinter]);

  // Try to reconnect to last printer on mount
  useEffect(() => {
    if (!isNative || !thermalPrinter) return;

    const lastPrinter = localStorage.getItem(STORAGE_KEY);
    if (lastPrinter) {
      try {
        const device = JSON.parse(lastPrinter) as BluetoothDevice;
        connectPrinter(device).catch(() => {
          // Failed to reconnect, clear storage
          localStorage.removeItem(STORAGE_KEY);
        });
      } catch (e) {
        console.error('Failed to parse last printer:', e);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, [connectPrinter, thermalPrinter]);

  // Backward compatibility aliases
  const connect = connectPrinter;
  const disconnect = disconnectPrinter;
  const isConnecting = false; // Not used in new implementation but needed for compatibility

  return {
    ...status,
    isNative,
    isSupported: isNative, // For backward compatibility
    isConnecting,
    connectedDevice: status.connectedDevice,
    scanDevices,
    connectPrinter,
    disconnectPrinter,
    connect,
    disconnect,
    printReceipt,
    testPrint,
  };
}
