'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Mail, Eye, EyeOff, Lock, User, CheckCircle, MailCheck } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Logo } from '@/components/ui/logo';
import { toast } from '@/components/ui/toast';

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res: any = await apiClient.signup({ name, email, password });
      if (res.data?.emailSent === false) {
        toast({ title: 'Account created — but the email could not be sent (SMTP not configured)', type: 'info' });
      }
      setStep('verify');
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resending) return;
    setResending(true);
    try {
      await apiClient.resendVerification({ email });
      toast({ title: 'Verification email sent', type: 'success' });
    } catch (err: any) {
      toast({ title: err.message || 'Failed to resend verification email', type: 'error' });
    } finally {
      setResending(false);
    }
  };

  // ── Step 2: Verification-pending screen ─────────────────────────────────
  if (step === 'verify') {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute -top-24 left-1/3 w-[420px] h-[420px] bg-brand-500/8 rounded-full blur-[130px]" />
          <div className="absolute bottom-0 right-1/4 w-[300px] h-[300px] bg-purple-500/6 rounded-full blur-[110px]" />
        </div>

        <div className="w-full max-w-md relative text-center">
          <div className="flex justify-center mb-4">
            <Logo href={null} size="lg" />
          </div>

          <div className="rounded-2xl border border-dark-800 bg-dark-900/60 backdrop-blur-sm p-8 shadow-2xl shadow-black/30">
            <div className="flex justify-center mb-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 border border-green-500/20">
                <MailCheck className="h-8 w-8 text-green-400" aria-hidden="true" />
              </div>
            </div>

            <h1 className="text-2xl font-bold mb-2">Account Created</h1>
            <p className="text-dark-400 text-sm mb-1">We&apos;ve sent a verification email to:</p>
            <p className="text-white font-semibold mb-6 break-all">{email}</p>

            <p className="text-dark-400 text-sm mb-6">
              Please verify your email before logging in. The link expires in 24 hours.
            </p>

            <button
              onClick={handleResend}
              disabled={resending}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-dark-800 hover:bg-dark-700 disabled:opacity-60 border border-dark-700 text-white rounded-xl font-medium text-sm transition-all"
            >
              {resending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Resend Verification Email
            </button>

            <p className="text-sm text-dark-400 mt-6">
              Already verified?{' '}
              <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 1: Registration form ───────────────────────────────────────────
  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-24 left-1/3 w-[420px] h-[420px] bg-brand-500/8 rounded-full blur-[130px]" />
        <div className="absolute bottom-0 right-1/4 w-[300px] h-[300px] bg-purple-500/6 rounded-full blur-[110px]" />
      </div>

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo href={null} size="lg" />
          </div>
          <h1 className="text-2xl font-bold mb-1">Create your account</h1>
          <p className="text-dark-400 text-sm">Start discovering and booking events</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-dark-800 bg-dark-900/60 backdrop-blur-sm p-6 sm:p-8 space-y-5 shadow-2xl shadow-black/30"
        >
          {/* Full name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-dark-300 mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-500" aria-hidden="true" />
              <input
                id="name"
                type="text"
                required
                autoComplete="name"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(''); }}
                placeholder="Your full name"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-dark-800 border border-dark-700 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all"
              />
            </div>
          </div>

          {/* Email */}
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
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-dark-800 border border-dark-700 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-dark-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-500" aria-hidden="true" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="At least 8 characters"
                className="w-full pl-10 pr-11 py-3 rounded-xl bg-dark-800 border border-dark-700 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-dark-500 hover:text-dark-300 transition-colors rounded"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-dark-300 mb-1.5">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-500" aria-hidden="true" />
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                placeholder="Re-enter your password"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-dark-800 border border-dark-700 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all"
              />
            </div>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !name || !email || !password || !confirmPassword}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-brand-500 hover:bg-brand-400 disabled:bg-brand-500/50 text-white rounded-xl font-semibold transition-all disabled:cursor-not-allowed shadow-lg shadow-brand-500/20"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : 'Create Account'}
          </button>

          <p className="text-xs text-dark-500 text-center">
            We&apos;ll email you a verification link before you can sign in.
          </p>
        </form>

        <p className="text-center text-sm text-dark-400 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
