'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Mail } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Logo } from '@/components/ui/logo';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || loading) return;
    setLoading(true);
    try {
      await apiClient.forgotPassword({ email });
    } finally {
      // Always show the confirmation — never reveal whether the account exists
      setSent(false || true);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-24 left-1/3 w-[420px] h-[420px] bg-brand-500/8 rounded-full blur-[130px]" />
      </div>

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo href={null} size="lg" />
          </div>
          <h1 className="text-2xl font-bold mb-1">Reset your password</h1>
          <p className="text-dark-400 text-sm">
            {sent
              ? 'Check your inbox for the reset link.'
              : "Enter your email and we'll send you a reset link."}
          </p>
        </div>

        <div className="rounded-2xl border border-dark-800 bg-dark-900/60 backdrop-blur-sm p-6 sm:p-8 shadow-2xl shadow-black/30">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-500/10 border border-brand-500/20">
                  <Mail className="h-7 w-7 text-brand-400" aria-hidden="true" />
                </div>
              </div>
              <p className="text-sm text-dark-300">
                If an account exists for <span className="text-white font-medium">{email}</span>, a
                password reset link has been sent. The link expires in 30 minutes.
              </p>
              <Link
                href="/login"
                className="block w-full px-6 py-3 bg-brand-500 hover:bg-brand-400 text-white rounded-xl font-semibold transition-all"
              >
                Back to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-dark-300 mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-500" aria-hidden="true" />
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-dark-800 border border-dark-700 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-brand-500 hover:bg-brand-400 disabled:bg-brand-500/50 text-white rounded-xl font-semibold transition-all disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : 'Send Reset Link'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-dark-400 mt-6">
          Remembered it?{' '}
          <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
