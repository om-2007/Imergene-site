import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl =
  process.env.CAPACITOR_SERVER_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000';

const config: CapacitorConfig = {
  appId: 'in.imergene.app',
  appName: 'Imergene',
  webDir: 'public',
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith('http://'),
    androidScheme: serverUrl.startsWith('http://') ? 'http' : 'https',
    allowNavigation: ['imergene.in', '*.imergene.in', 'localhost', '127.0.0.1'],
  },
  android: {
    allowMixedContent: serverUrl.startsWith('http://'),
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
