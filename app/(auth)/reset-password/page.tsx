'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { TrendingUp, Loader2, Eye, EyeOff, Check } from 'lucide-react';

function ResetPasswordContent() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get('code');

  const requirements = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'One number', met: /[0-9]/.test(password) },
    { label: 'One special character', met: /[^A-Za-z0-9]/.test(password) },
  ];
  const allMet = requirements.every(r => r.met);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (!allMet) { setError('Password does not meet all requirements'); return; }
    if (!code) { setError('Invalid reset link — no code found. Please request a new one.'); return; }

    setError(''); setSaving(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to reset password');
      setSuccess(true);
      setTimeout(() => router.push('/login'), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
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
          {!code ? (
            <div className="text-center py-4">
              <h2 className="text-base font-semibold text-white mb-2">Invalid reset link</h2>
              <p className="text-sm text-secondary mb-4">No reset code found. Please request a new password reset.</p>
              <Link href="/login" className="text-accent-green hover:underline text-sm">Back to sign in</Link>
            </div>
          ) : success ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-2xl bg-accent-green/15 border border-accent-green/30 flex items-center justify-center mx-auto mb-4">
                <Check size={22} className="text-accent-green" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">Password updated</h2>
              <p className="text-sm text-secondary mb-4">Your password has been reset. Redirecting to sign in…</p>
              <Link href="/login" className="btn-secondary inline-flex">Go to Sign In</Link>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-white mb-1">Set new password</h2>
              <p className="text-sm text-secondary mb-5">Choose a strong password for your account.</p>
              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label className="label block mb-1.5">New Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required autoFocus value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="input w-full pr-10" placeholder="••••••••"
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowPassword(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-secondary transition-colors">
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {password && (
                    <div className="mt-2 space-y-1">
                      {requirements.map(r => (
                        <div key={r.label} className={`flex items-center gap-1.5 text-[11px] ${r.met ? 'text-accent-green' : 'text-muted'}`}>
                          <Check size={10} className={r.met ? 'opacity-100' : 'opacity-0'} />
                          <span>{r.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="label block mb-1.5">Confirm Password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="input w-full" placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>
                {error && <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/20 rounded-lg px-3 py-2">{error}</p>}
                <button type="submit" disabled={saving || !allMet || password !== confirmPassword}
                  className="btn-primary w-full py-2.5">
                  {saving ? <Loader2 size={15} className="animate-spin mx-auto" /> : 'Update Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <Loader2 size={22} className="animate-spin text-accent-green" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
