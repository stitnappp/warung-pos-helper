import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.e320bb311cda4281bc9018536efe794c',
  appName: 'Warung POS',
  webDir: 'dist',
  android: {
    allowMixedContent: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#f97316',
      showSpinner: false
    }
  }
};

export default config;
