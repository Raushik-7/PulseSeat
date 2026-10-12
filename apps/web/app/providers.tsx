'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError } from '@/lib/api';
import { AuthProvider } from '@/lib/auth-context';
import { Navbar } from '@/components/layout/navbar';

/**
 * Retry policy: at most 2 retries, up to 10s total, exponential backoff.
 * Non-retryable errors are never repeated — punching a broken endpoint 3
 * times changes nothing except user-perceived latency.
 */
const MAX_RETRIES = 2;
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function retryWithBackoff(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false;
  if (error instanceof ApiError && !RETRYABLE_STATUS.has(error.statusCode)) return false;
  if (error instanceof TypeError) return true; // network failure / timeout
  return true;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // Bounded retries with backoff for transient failures (Render
            // cold starts, Supabase wake-from-pause). Named function so the
            // React Query devtools show it as a stable identifier.
            retry: retryWithBackoff,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Navbar />
        <main className="min-h-[calc(100vh-64px)]">{children}</main>
      </AuthProvider>
    </QueryClientProvider>
  );
}
