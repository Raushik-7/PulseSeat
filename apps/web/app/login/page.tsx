'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Mail, Eye, EyeOff, Lock } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Logo } from '@/components/ui/logo';
import { toast } from '@/components/ui/toast';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || loading) return;
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      toast({ title: 'Welcome back!', type: 'success' });
      router.push('/events');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Subtle background glow, consistent with homepage */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-24 left-1/3 w-[420px] h-[420px] bg-brand-500/8 rounded-full blur-[130px]" />
        <div className="absolute bottom-0 right-1/4 w-[300px] h-[300px] bg-purple-500/6 rounded-full blur-[110px]" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo href={null} size="lg" />
          </div>
          <h1 className="text-2xl font-bold mb-1">Welcome back 👋</h1>
          <p className="text-dark-400 text-sm">Sign in to continue booking</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-dark-800 bg-dark-900/60 backdrop-blur-sm p-6 sm:p-8 space-y-5 shadow-2xl shadow-black/30"
        >
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
                autoComplete="current-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="Your password"
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

          {/* Forgot password */}
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-sm text-brand-400 hover:text-brand-300 font-medium transition-colors"
            >
              Forgot password?
            </Link>
          </div>

          {error && (
            <div
              className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-brand-500 hover:bg-brand-400 disabled:bg-brand-500/50 text-white rounded-xl font-semibold transition-all disabled:cursor-not-allowed shadow-lg shadow-brand-500/20"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-dark-400 mt-6">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
            Create Account
          </Link>
        </p>
      </div>
    </div>
  );
}
