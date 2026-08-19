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
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: { name: string; email: string; password: string }) => {
    setLoading(true);
    try {
      await signup(data.name, data.email, data.password);
      toast({ title: 'Account created!', type: 'success' });
      router.push('/events');
    } catch (err: any) {
      toast({ title: err.message || 'Signup failed', type: 'error' });
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
          <h1 className="text-2xl font-bold mb-1">Create your account</h1>
          <p className="text-dark-400 text-sm">Join PulseSeat and start booking</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Name</label>
            <input
              {...register('name')}
              type="text"
              placeholder="Your name"
              className="w-full px-4 py-2.5 rounded-xl bg-dark-800 border border-dark-700 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
            />
            {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Email</label>
            <input
              {...register('email')}
              type="email"
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 rounded-xl bg-dark-800 border border-dark-700 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
            />
            {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Password</label>
            <input
              {...register('password')}
              type="password"
              placeholder="At least 6 characters"
              className="w-full px-4 py-2.5 rounded-xl bg-dark-800 border border-dark-700 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
            />
            {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-brand-500 hover:bg-brand-400 disabled:bg-brand-500/50 text-white rounded-xl font-semibold transition-all disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-dark-400 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-brand-400 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
