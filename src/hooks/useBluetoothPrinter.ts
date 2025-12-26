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
  isConnecting: boolean;
  devices: BluetoothDevice[];
  error: string | null;
}

// Check if running on native platform
const isNative = Capacitor.isNativePlatform();

const STORAGE_KEY = 'eppos_printer_device';

// Fixed line width for 58mm thermal paper
const LINE_WIDTH = 32;

// ESC/POS commands for thermal printers
const ESC = 0x1B;
const GS = 0x1D;

const ESC_POS = {
  INIT: [ESC, 0x40],
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  DOUBLE_HEIGHT_ON: [GS, 0x21, 0x10],
  DOUBLE_HEIGHT_OFF: [GS, 0x21, 0x00],
  CUT_PAPER: [GS, 0x56, 0x00],
  FEED_LINE: [0x0A],
};

const sanitizeReceiptText = (text: string) => {
  return text
    .normalize('NFKD')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');
};

// Web Bluetooth characteristic UUIDs for thermal printers
const PRINTER_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
];

const PRINTER_CHARACTERISTIC_UUIDS = [
  '00002af1-0000-1000-8000-00805f9b34fb',
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
];

export function useBluetoothPrinter() {
  const [status, setStatus] = useState<PrinterStatus>({
    isConnected: false,
    connectedDevice: null,
    isScanning: false,
    isPrinting: false,
    isConnecting: false,
    devices: [],
    error: null,
  });

  const [thermalPrinter, setThermalPrinter] = useState<any>(null);
  const listenerRef = useRef<any>(null);
  const finishListenerRef = useRef<any>(null);
  
  // Web Bluetooth refs
  const gattServerRef = useRef<BluetoothRemoteGATTServer | null>(null);
  const characteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);

  // Check if Web Bluetooth is supported
  const isWebBluetoothSupported = typeof navigator !== 'undefined' && 'bluetooth' in navigator;

  // Load thermal printer plugin dynamically (native only)
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

  // Web Bluetooth: Connect to printer
  const connectWebBluetooth = useCallback(async () => {
    if (!isWebBluetoothSupported) {
      setStatus(prev => ({
        ...prev,
        error: 'Web Bluetooth tidak didukung di browser ini'
      }));
      return false;
    }

    try {
      setStatus(prev => ({ ...prev, isConnecting: true, error: null }));

      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: PRINTER_SERVICE_UUIDS.map(uuid => uuid) }],
        optionalServices: PRINTER_SERVICE_UUIDS,
      }).catch(() => null);

      if (!device) {
        // User cancelled
        setStatus(prev => ({ ...prev, isConnecting: false }));
        return false;
      }

      const server = await device.gatt?.connect();
      if (!server) {
        throw new Error('Gagal koneksi ke GATT server');
      }

      gattServerRef.current = server;

      // Try to find the printer characteristic
      let characteristic: BluetoothRemoteGATTCharacteristic | null = null;

      for (const serviceUuid of PRINTER_SERVICE_UUIDS) {
        try {
          const service = await server.getPrimaryService(serviceUuid);
          for (const charUuid of PRINTER_CHARACTERISTIC_UUIDS) {
            try {
              characteristic = await service.getCharacteristic(charUuid);
              if (characteristic) break;
            } catch {
              continue;
            }
          }
          if (characteristic) break;
        } catch {
          continue;
        }
      }

      if (!characteristic) {
        throw new Error('Karakteristik printer tidak ditemukan');
      }

      characteristicRef.current = characteristic;

      const connectedDevice: BluetoothDevice = {
        name: device.name || 'Printer',
        address: device.id,
      };

      setStatus(prev => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        connectedDevice,
      }));

      localStorage.setItem(STORAGE_KEY, JSON.stringify(connectedDevice));

      return true;
    } catch (error: any) {
      console.error('Web Bluetooth connect error:', error);
      setStatus(prev => ({
        ...prev,
        isConnecting: false,
        error: error.message || 'Gagal koneksi ke printer'
      }));
      return false;
    }
  }, [isWebBluetoothSupported]);

  // Scan for Bluetooth devices (native) or request connection (web)
  const scanDevices = useCallback(async () => {
    if (!isNative) {
      // For web, we use requestDevice which shows a picker
      return connectWebBluetooth();
    }

    if (!thermalPrinter) {
      setStatus(prev => ({
        ...prev,
        error: 'Plugin printer tidak tersedia'
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
          if (!foundDevices.some(d => d.address === device.address)) {
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

      await thermalPrinter.startScan();
      console.log('Started scanning for printers...');

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
  }, [thermalPrinter, connectWebBluetooth]);

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

  // Disconnect from printer (native or web)
  const disconnectPrinter = useCallback(async () => {
    // Web Bluetooth disconnect
    if (!isNative) {
      if (gattServerRef.current?.connected) {
        gattServerRef.current.disconnect();
      }
      gattServerRef.current = null;
      characteristicRef.current = null;
      setStatus(prev => ({
        ...prev,
        isConnected: false,
        connectedDevice: null
      }));
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    // Native disconnect
    if (!thermalPrinter) return;

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

  // Web Bluetooth print helper
  const sendToWebPrinter = useCallback(async (data: Uint8Array): Promise<boolean> => {
    if (!characteristicRef.current) return false;

    try {
      // Split into chunks (BLE has ~20 byte MTU typically, but we'll use 100 for efficiency)
      const chunkSize = 100;
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        await characteristicRef.current.writeValue(chunk);
        // Small delay between chunks
        await new Promise(resolve => setTimeout(resolve, 30));
      }
      return true;
    } catch (error) {
      console.error('Web Bluetooth write error:', error);
      return false;
    }
  }, []);

  // Print receipt (supports both web and native)
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

      // Web Bluetooth printing
      if (!isNative) {
        // Build ESC/POS command buffer
        const encoder = new TextEncoder();
        const textBytes = encoder.encode(receiptText);
        
        const commands = new Uint8Array([
          ...ESC_POS.INIT,
          ...ESC_POS.ALIGN_CENTER,
          ...textBytes,
          ...ESC_POS.FEED_LINE,
          ...ESC_POS.FEED_LINE,
          ...ESC_POS.CUT_PAPER,
        ]);

        const success = await sendToWebPrinter(commands);
        setStatus(prev => ({ ...prev, isPrinting: false }));
        return success;
      }

      // Native printing using plugin builder API
      const printer = thermalPrinter.begin().clearFormatting();

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
  }, [status.isConnected, thermalPrinter, sendToWebPrinter]);

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
  const connect = isNative ? connectPrinter : connectWebBluetooth;
  const disconnect = disconnectPrinter;

  return {
    ...status,
    isNative,
    isSupported: isNative || isWebBluetoothSupported,
    isConnecting: status.isConnecting,
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
