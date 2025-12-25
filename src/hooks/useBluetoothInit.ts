import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const getBluetoothSerial = (): any => {
  if (!isNative) return null;
  return (window as any).bluetoothSerial || null;
};

/**
 * Initializes the Bluetooth plugin as early as possible so it's ready when needed.
 * Call this hook once at the app root level (e.g., App.tsx).
 */
export function useBluetoothInit() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isNative) {
      // Not native, nothing to init
      setIsReady(true);
      return;
    }

    let cancelled = false;

    const init = async () => {
      console.log('[BluetoothInit] Initializing Bluetooth plugin...');

      // Wait for device ready event
      const waitForDeviceReady = new Promise<void>((resolve) => {
        if ((document as any).cordova) {
          // Already ready
          resolve();
        } else {
          document.addEventListener('deviceready', () => resolve(), { once: true });
          // Fallback timeout
          setTimeout(() => resolve(), 3000);
        }
      });

      await waitForDeviceReady;

      // Wait for plugin to be available (some devices load it late)
      let bt: any = null;
      for (let i = 0; i < 15; i++) {
        bt = getBluetoothSerial();
        if (bt) break;
        await sleep(300);
      }

      if (cancelled) return;

      if (!bt) {
        console.warn('[BluetoothInit] BluetoothSerial plugin not available');
        setError('Plugin Bluetooth tidak tersedia');
        setIsReady(false);
        return;
      }

      console.log('[BluetoothInit] BluetoothSerial plugin loaded');

      // Pre-request permissions (Android 12+)
      if (typeof bt.requestPermission === 'function') {
        try {
          await new Promise<void>((resolve) => {
            bt.requestPermission(
              () => {
                console.log('[BluetoothInit] Bluetooth permission granted');
                resolve();
              },
              (err: any) => {
                console.warn('[BluetoothInit] Bluetooth permission denied:', err);
                resolve();
              }
            );
          });
        } catch (e) {
          console.warn('[BluetoothInit] Permission request error:', e);
        }
      }

      // Pre-enable Bluetooth if not enabled
      if (typeof bt.isEnabled === 'function' && typeof bt.enable === 'function') {
        const enabled = await new Promise<boolean>((resolve) => {
          bt.isEnabled(
            () => resolve(true),
            () => resolve(false)
          );
        });

        if (!enabled) {
          console.log('[BluetoothInit] Bluetooth is off, requesting enable...');
          await new Promise<void>((resolve) => {
            bt.enable(
              () => {
                console.log('[BluetoothInit] Bluetooth enabled');
                resolve();
              },
              (err: any) => {
                console.warn('[BluetoothInit] Failed to enable Bluetooth:', err);
                resolve();
              }
            );
          });
        } else {
          console.log('[BluetoothInit] Bluetooth already enabled');
        }
      }

      if (!cancelled) {
        setIsReady(true);
        setError(null);
        console.log('[BluetoothInit] Initialization complete');
      }
    };

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  return { isReady, error };
}
