'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Zap, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { toast } from '@/components/ui/toast';

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: { email: string; password: string }) => {
    setLoading(true);
    try {
      await login(data.email, data.password);
      toast({ title: 'Welcome back!', type: 'success' });
      router.push('/events');
    } catch (err: any) {
      toast({ title: err.message || 'Login failed', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-brand-500/10 mb-4">
            <Zap className="h-6 w-6 text-brand-400" />
          </div>
          <h1 className="text-2xl font-bold mb-1">Welcome back</h1>
          <p className="text-dark-400 text-sm">Sign in to your PulseSeat account</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Email</label>
            <input
              {...register('email')}
              type="email"
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 rounded-xl bg-dark-800 border border-dark-700 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
            />
            {errors.email && (
              <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Password</label>
            <input
              {...register('password')}
              type="password"
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-xl bg-dark-800 border border-dark-700 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
            />
            {errors.password && (
              <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-brand-500 hover:bg-brand-400 disabled:bg-brand-500/50 text-white rounded-xl font-semibold transition-all disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-sm text-dark-400 mt-6">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-brand-400 hover:underline">Sign up</Link>
        </p>

        <div className="mt-8 p-4 rounded-xl bg-dark-900/50 border border-dark-800">
          <div className="text-xs text-dark-500 mb-2 font-medium">Demo credentials</div>
          <div className="space-y-1 text-xs font-mono text-dark-400">
            <div>Admin: admin@pulseseat.dev / admin123</div>
            <div>User: user@pulseseat.dev / user123</div>
          </div>
        </div>
      </div>
    </div>
  );
}
