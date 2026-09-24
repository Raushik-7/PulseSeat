import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'PulseSeat — Discover & Book Live Events',
  description:
    'Find concerts, sports, theatre, comedy and live events near you. Book tickets instantly with instant confirmation.',
  keywords: ['tickets', 'events', 'concerts', 'sports', 'theatre', 'comedy', 'booking'],
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/favicon.svg',
  },
  openGraph: {
    title: 'PulseSeat — Discover & Book Live Events',
    description: 'Find and book tickets for concerts, sports, theatre and live events.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.svg" sizes="any" />
      </head>
      <body className="min-h-screen bg-dark-950 text-white">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
