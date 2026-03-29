'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TrendingUp, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push('/dashboard'); router.refresh();
    } catch (err: any) { setError(err.message ?? 'Login failed'); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="fixed inset-0 bg-gradient-mesh pointer-events-none" />
      <div className="w-full max-w-sm relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-accent-green/15 border border-accent-green/30 flex items-center justify-center mb-4">
            <TrendingUp size={22} className="text-accent-green" />
          </div>
          <h1 className="text-3xl font-bold text-white">StockWise</h1>
          <p className="text-secondary text-sm mt-1">Portfolio Intelligence</p>
        </div>
        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-5">Sign in to your account</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label block mb-1.5">Email</label>
              <input type="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)} className="input w-full" placeholder="you@example.com" />
            </div>
            <div>
              <label className="label block mb-1.5">Password</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="input w-full" placeholder="••••••••" />
            </div>
            {error && <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/20 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
              {loading ? <Loader2 size={15} className="animate-spin mx-auto" /> : 'Sign In'}
            </button>
          </form>
          <div className="divider my-4" />
          <p className="text-center text-sm text-secondary">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-accent-green hover:underline font-medium">Create one free</Link>
          </p>
        </div>
        <p className="text-center text-xs text-muted mt-6">Prices delayed ~15 min. Not financial advice.</p>
      </div>
    </div>
  );
}
