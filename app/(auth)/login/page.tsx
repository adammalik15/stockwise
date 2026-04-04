'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TrendingUp, Loader2, Eye, EyeOff, ArrowLeft, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type View = 'login' | 'forgot' | 'mfa';

const REMEMBER_KEY = 'sw_remember_until';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState<View>('login');
  const [resetSent, setResetSent] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaFactorId, setMfaFactorId] = useState('');
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      if (rememberMe) {
        const until = new Date();
        until.setDate(until.getDate() + 30);
        localStorage.setItem(REMEMBER_KEY, until.toISOString());
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }
      // Mark current tab as active (SessionGuard won't log out mid-session)
      sessionStorage.setItem('sw_active', '1');

      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.nextLevel === 'aal2' && aal.nextLevel !== aal.currentLevel) {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const totp = factors?.totp?.[0];
        if (totp) { setMfaFactorId(totp.id); setView('mfa'); return; }
      }
      router.push('/dashboard'); router.refresh();
    } catch (err: any) { setError(err.message ?? 'Login failed'); }
    finally { setLoading(false); }
  }

  async function handleMFA(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const supabase = createClient();
      const { data: challenge, error: ce } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
      if (ce) throw ce;
      const { error: ve } = await supabase.auth.mfa.verify({ factorId: mfaFactorId, challengeId: challenge.id, code: mfaCode });
      if (ve) throw ve;
      router.push('/dashboard'); router.refresh();
    } catch (err: any) { setError(err.message ?? 'Invalid code'); }
    finally { setLoading(false); }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setResetSent(true);
    } catch (err: any) { setError(err.message ?? 'Failed to send reset email'); }
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
          {view === 'login' && (
            <>
              <h2 className="text-lg font-semibold text-white mb-5">Sign in to your account</h2>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="label block mb-1.5">Email</label>
                  <input type="email" required autoFocus value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="input w-full" placeholder="you@example.com"
                    autoComplete="email" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="label">Password</label>
                    <button type="button" onClick={() => { setView('forgot'); setError(''); }}
                      className="text-xs text-accent-green hover:underline">
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="input w-full pr-10" placeholder="••••••••"
                      autoComplete="current-password"
                    />
                    <button type="button" onClick={() => setShowPassword(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-secondary transition-colors">
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Remember me */}
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <div onClick={() => setRememberMe(p => !p)}
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${rememberMe ? 'bg-accent-green border-accent-green' : 'border-border bg-surface-3'}`}>
                    {rememberMe && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="#0a0a0f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <span className="text-xs text-secondary">Remember me for 30 days</span>
                </label>

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
            </>
          )}

          {view === 'mfa' && (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-accent-blue/15 border border-accent-blue/30 flex items-center justify-center shrink-0">
                  <ShieldCheck size={16} className="text-accent-blue" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Two-factor verification</h2>
                  <p className="text-xs text-secondary mt-0.5">Enter the code from your authenticator app</p>
                </div>
              </div>
              <form onSubmit={handleMFA} className="space-y-4">
                <input
                  type="text" inputMode="numeric" maxLength={6} autoFocus
                  value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  className="input w-full text-center text-2xl tracking-[0.6em] font-mono py-3"
                  placeholder="000000"
                />
                {error && <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/20 rounded-lg px-3 py-2">{error}</p>}
                <button type="submit" disabled={loading || mfaCode.length !== 6} className="btn-primary w-full py-2.5">
                  {loading ? <Loader2 size={15} className="animate-spin mx-auto" /> : 'Verify'}
                </button>
              </form>
              <button onClick={() => { setView('login'); setError(''); setMfaCode(''); }}
                className="flex items-center gap-1.5 text-xs text-secondary hover:text-white mt-4 transition-colors">
                <ArrowLeft size={13} /> Back to sign in
              </button>
            </>
          )}

          {view === 'forgot' && (
            <>
              <button onClick={() => { setView('login'); setError(''); setResetSent(false); }}
                className="flex items-center gap-1.5 text-xs text-secondary hover:text-white mb-4 transition-colors">
                <ArrowLeft size={13} /> Back to sign in
              </button>
              {resetSent ? (
                <div className="text-center py-4">
                  <div className="w-12 h-12 rounded-2xl bg-accent-green/15 border border-accent-green/30 flex items-center justify-center mx-auto mb-4">
                    <TrendingUp size={20} className="text-accent-green" />
                  </div>
                  <h2 className="text-base font-semibold text-white mb-2">Check your email</h2>
                  <p className="text-sm text-secondary">We sent a reset link to <strong className="text-white">{email}</strong>.</p>
                </div>
              ) : (
                <>
                  <h2 className="text-lg font-semibold text-white mb-1">Reset your password</h2>
                  <p className="text-sm text-secondary mb-5">Enter your email and we&apos;ll send a reset link.</p>
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div>
                      <label className="label block mb-1.5">Email</label>
                      <input type="email" required autoFocus value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="input w-full" placeholder="you@example.com"
                        autoComplete="email" />
                    </div>
                    {error && <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/20 rounded-lg px-3 py-2">{error}</p>}
                    <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
                      {loading ? <Loader2 size={15} className="animate-spin mx-auto" /> : 'Send Reset Link'}
                    </button>
                  </form>
                </>
              )}
            </>
          )}
        </div>
        <p className="text-center text-xs text-muted mt-6">Prices delayed ~15 min. Not financial advice.</p>
      </div>
    </div>
  );
}
