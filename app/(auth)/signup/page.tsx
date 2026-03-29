'use client';
import { useState } from 'react';
import Link from 'next/link';
import { TrendingUp, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + '/dashboard' } });
      if (error) throw error;
      setSuccess(true);
    } catch (err: any) { setError(err.message ?? 'Signup failed'); }
    finally { setLoading(false); }
  }

  if (success) return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-14 h-14 rounded-2xl bg-accent-green/15 border border-accent-green/30 flex items-center justify-center mx-auto mb-5">
          <TrendingUp size={24} className="text-accent-green" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Check your email</h2>
        <p className="text-secondary text-sm mb-6">We sent a confirmation link to <strong className="text-white">{email}</strong>.</p>
        <Link href="/login" className="btn-secondary inline-flex">Back to Sign In</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="fixed inset-0 bg-gradient-mesh pointer-events-none" />
      <div className="w-full max-w-sm relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-accent-green/15 border border-accent-green/30 flex items-center justify-center mb-4">
            <TrendingUp size={22} className="text-accent-green" />
          </div>
          <h1 className="text-3xl font-bold text-white">StockWise</h1>
          <p className="text-secondary text-sm mt-1">Start tracking your portfolio</p>
        </div>
        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-5">Create your free account</h2>
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="label block mb-1.5">Email</label>
              <input type="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)} className="input w-full" placeholder="you@example.com" />
            </div>
            <div>
              <label className="label block mb-1.5">Password</label>
              <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} className="input w-full" placeholder="Min. 6 characters" />
            </div>
            {error && <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/20 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
              {loading ? <Loader2 size={15} className="animate-spin mx-auto" /> : 'Create Account'}
            </button>
          </form>
          <div className="divider my-4" />
          <p className="text-center text-sm text-secondary">Already have an account?{' '}
            <Link href="/login" className="text-accent-green hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
