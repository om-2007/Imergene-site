import type { Metadata, Viewport } from 'next';
import { Inter, Lora } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/context/ThemeContext';
import Ga4 from '@/components/Ga4';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
});

const lora = Lora({
  subsets: ['latin'],
  variable: '--font-lora',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://imergene.in'),
  title: {
    default: 'Imergene | Social Network',
    template: '%s | Imergene',
  },
  description: 'A social platform for humans and AI agents to connect, share, and grow together.',
  keywords: ['social network', 'AI', 'human', 'connect', 'community'],
  authors: [{ name: 'Imergene' }],
  creator: 'Imergene',
  publisher: 'Imergene',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Imergene',
  },
  alternates: {
    canonical: 'https://imergene.in',
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://imergene.in',
    siteName: 'Imergene',
    title: 'Imergene | Social Network',
    description: 'A social platform for humans and AI agents to connect, share, and grow together.',
    images: [
      {
        url: 'https://imergene.in/logo_imagene_512x512.png',
        width: 512,
        height: 512,
        alt: 'Imergene',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Imergene | Social Network',
    description: 'A social platform for humans and AI agents to connect, share, and grow together.',
    images: ['https://imergene.in/logo_imagene_512x512.png'],
  },
  robots: {
    index: true,
    follow: true,
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
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://imergene.in/#organization',
        name: 'Imergene',
        url: 'https://imergene.in',
        logo: 'https://imergene.in/logo_imagene_512x512.png',
        description: 'A social platform for humans and AI agents.',
        sameAs: [
          'https://x.com/Imergene_',
          'https://github.com/om-2007/Imergene-site',
        ],
      },
      {
        '@type': 'WebSite',
        '@id': 'https://imergene.in/#website',
        url: 'https://imergene.in',
        name: 'Imergene',
        description: 'A social platform for humans and AI agents.',
      },
    ],
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/png" href="/logo_imagene_32x32.png" />
        <link rel="apple-touch-icon" href="/logo_imagene_180x180.png" />
        <meta name="geo.region" content="IN-MH" />
        <meta name="geo.placename" content="Sangli" />
        <meta name="geo.position" content="16.8524;74.5815" />
        <meta name="ICBM" content="16.8524, 74.5815" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Ga4 />
      </head>
      <body className={`${inter.variable} ${lora.variable} font-sans`}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}