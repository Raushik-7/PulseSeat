'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Logo } from '@/components/ui/logo';

function VerifyEmailInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token || !email) {
      setStatus('error');
      setMessage('This verification link is malformed. Please request a new verification email.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await apiClient.verifyEmail({ token, email });
        if (!cancelled) setStatus('success');
      } catch (err: any) {
        if (!cancelled) {
          setStatus('error');
          setMessage(err.message || 'Verification failed.');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [token, email]);

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-24 left-1/3 w-[420px] h-[420px] bg-brand-500/8 rounded-full blur-[130px]" />
      </div>

      <div className="w-full max-w-md relative text-center">
        <div className="flex justify-center mb-4">
          <Logo href={null} size="lg" />
        </div>

        <div className="rounded-2xl border border-dark-800 bg-dark-900/60 backdrop-blur-sm p-8 shadow-2xl shadow-black/30">
          {status === 'verifying' && (
            <>
              <Loader2 className="h-12 w-12 text-brand-400 animate-spin mx-auto mb-5" aria-hidden="true" />
              <h1 className="text-2xl font-bold mb-2">Verifying your email…</h1>
              <p className="text-dark-400 text-sm">This only takes a moment.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="flex justify-center mb-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 border border-green-500/20">
                  <CheckCircle className="h-8 w-8 text-green-400" aria-hidden="true" />
                </div>
              </div>
              <h1 className="text-2xl font-bold mb-2">Email verified!</h1>
              <p className="text-dark-400 text-sm mb-6">
                Your account is now active. You can sign in and start booking.
              </p>
              <button
                onClick={() => router.push('/login')}
                className="w-full px-6 py-3 bg-brand-500 hover:bg-brand-400 text-white rounded-xl font-semibold transition-all shadow-lg shadow-brand-500/20"
              >
                Continue to Sign In
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="flex justify-center mb-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
                  <XCircle className="h-8 w-8 text-red-400" aria-hidden="true" />
                </div>
              </div>
              <h1 className="text-2xl font-bold mb-2">Verification failed</h1>
              <p className="text-dark-400 text-sm mb-6">{message}</p>
              <div className="flex flex-col gap-2">
                <Link
                  href="/signup"
                  className="w-full px-6 py-3 bg-brand-500 hover:bg-brand-400 text-white rounded-xl font-semibold transition-all text-center"
                >
                  Create a new account
                </Link>
                <Link
                  href="/login"
                  className="w-full px-6 py-3 bg-dark-800 hover:bg-dark-700 border border-dark-700 text-white rounded-xl font-medium transition-all text-center"
                >
                  Back to Sign In
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-brand-400 animate-spin" aria-hidden="true" />
        </div>
      }
    >
      <VerifyEmailInner />
    </Suspense>
  );
}
