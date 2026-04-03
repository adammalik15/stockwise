'use client';
import { useState } from 'react';
import Link from 'next/link';
import { TrendingUp, Loader2, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

function passwordStrength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 1) return { score: s, label: 'Weak', color: 'bg-accent-red', width: '25%' };
  if (s === 2) return { score: s, label: 'Fair', color: 'bg-accent-yellow', width: '50%' };
  if (s === 3) return { score: s, label: 'Good', color: 'bg-accent-blue', width: '75%' };
  return { score: s, label: 'Strong', color: 'bg-accent-green', width: '100%' };
}

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required minLength={8} value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input w-full pr-10" placeholder="Min. 8 characters"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-secondary transition-colors">
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {password && (() => { const s = passwordStrength(password); return (
                <div className="mt-2">
                  <div className="h-1 bg-surface-3 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${s.color}`} style={{ width: s.width }} />
                  </div>
                  <p className={`text-[11px] mt-1 ${s.score <= 1 ? 'text-accent-red' : s.score === 2 ? 'text-accent-yellow' : s.score === 3 ? 'text-accent-blue' : 'text-accent-green'}`}>{s.label} password</p>
                </div>
              ); })()}
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
