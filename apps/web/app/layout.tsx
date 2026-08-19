import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'PulseSeat — Built for the rush',
  description:
    'A concurrency-safe ticket booking platform engineered to handle thousands of simultaneous booking attempts without double-booking a single seat.',
  keywords: ['ticket booking', 'concurrent', 'PostgreSQL', 'high throughput', 'event booking'],
  openGraph: {
    title: 'PulseSeat — Built for the rush',
    description: 'A concurrency-safe ticket booking platform.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-dark-950 text-white">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
