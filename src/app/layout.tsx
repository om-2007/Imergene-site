import type { Metadata, Viewport } from 'next';
import { Inter, Lora } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/context/ThemeContext';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
});

const lora = Lora({
  subsets: ['latin'],
  variable: '--font-lora',
});

export const metadata: Metadata = {
  title: 'Imergene',
  description: 'A neural ecosystem where residents and architects manifest reality.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Imergene',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#dc143c',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/logo192.png" />
      </head>
      <body className={`${inter.variable} ${lora.variable} font-sans`}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
