'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Moon, Sun, Monitor, Save, Check, Palette, Eye, Shield, ShieldCheck, Loader2, X } from 'lucide-react';

type Theme = 'dark' | 'light' | 'system';

interface UISettings {
  theme: Theme;
  show_halal_badge: boolean;
  show_news: boolean;
  show_ai_recommendations: boolean;
  show_shareholders: boolean;
  compact_view: boolean;
}

const DEFAULTS: UISettings = {
  theme: 'dark',
  show_halal_badge: true,
  show_news: true,
  show_ai_recommendations: true,
  show_shareholders: true,
  compact_view: false,
};

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const h = document.documentElement;
  if (theme === 'light') {
    h.classList.remove('dark'); h.classList.add('light');
  } else if (theme === 'system') {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    h.classList.toggle('dark', dark); h.classList.toggle('light', !dark);
  } else {
    h.classList.add('dark'); h.classList.remove('light');
  }
}

export function getSettings(): UISettings {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const saved = localStorage.getItem('sw_settings');
    return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<UISettings>(DEFAULTS);
  const [userEmail, setUserEmail] = useState('');
  const [saved, setSaved] = useState(false);

  // 2FA state
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaSetup, setMfaSetup] = useState(false);
  const [mfaQR, setMfaQR] = useState('');
  const [mfaSecret, setMfaSecret] = useState('');
  const [mfaEnrollId, setMfaEnrollId] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);

  useEffect(() => {
    const loaded = getSettings();
    setSettings(loaded);
    applyTheme(loaded.theme);
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setUserEmail(user.email);
    });
    // Check MFA status
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const verified = data?.totp?.find(f => f.status === 'verified');
      if (verified) { setMfaEnabled(true); setMfaFactorId(verified.id); }
    });
  }, []);

  async function enableMFA() {
    setMfaLoading(true); setMfaError('');
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (error) throw error;
      setMfaQR(data.totp.qr_code);
      setMfaSecret(data.totp.secret);
      setMfaEnrollId(data.id);
      setMfaSetup(true);
    } catch (err: any) { setMfaError(err.message); }
    finally { setMfaLoading(false); }
  }

  async function verifyMFA() {
    setMfaLoading(true); setMfaError('');
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: mfaEnrollId, code: mfaCode });
      if (error) throw error;
      setMfaEnabled(true); setMfaFactorId(mfaEnrollId);
      setMfaSetup(false); setMfaQR(''); setMfaCode('');
    } catch (err: any) { setMfaError(err.message); }
    finally { setMfaLoading(false); }
  }

  async function disableMFA() {
    if (!mfaFactorId) return;
    setMfaLoading(true); setMfaError('');
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId });
      if (error) throw error;
      setMfaEnabled(false); setMfaFactorId(null); setConfirmDisable(false);
    } catch (err: any) { setMfaError(err.message); }
    finally { setMfaLoading(false); }
  }

  function update<K extends keyof UISettings>(key: K, value: UISettings[K]) {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'theme') {
        applyTheme(value as Theme);
        localStorage.setItem('sw_settings', JSON.stringify(next));
      }
      return next;
    });
  }

  function saveSettings() {
    localStorage.setItem('sw_settings', JSON.stringify(settings));
    applyTheme(settings.theme);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const displayName = userEmail
    ? userEmail.split('@')[0].charAt(0).toUpperCase() + userEmail.split('@')[0].slice(1)
    : 'User';

  return (
    <div className="space-y-6 page-enter max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-secondary text-sm mt-0.5">Customise your StockWise experience</p>
      </div>

      <div className="card">
        <p className="label mb-4">Account</p>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-accent-green/20 border border-accent-green/30 flex items-center justify-center shrink-0">
            <span className="text-2xl font-bold text-accent-green">{displayName.charAt(0)}</span>
          </div>
          <div>
            <p className="font-semibold text-white text-lg">{displayName}</p>
            <p className="text-sm text-secondary">{userEmail}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Palette size={15} className="text-accent-purple" />
          <p className="text-sm font-semibold text-white">Appearance</p>
        </div>
        <p className="label mb-3">Theme</p>
        <div className="grid grid-cols-3 gap-2">
          {([
            { key: 'dark' as Theme, label: 'Dark', icon: Moon },
            { key: 'light' as Theme, label: 'Light', icon: Sun },
            { key: 'system' as Theme, label: 'System', icon: Monitor },
          ]).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => update('theme', key)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-xs font-medium transition-all ${
                settings.theme===key
                  ?'bg-accent-green/15 border-accent-green/40 text-accent-green'
                  :'bg-surface-2 border-border text-secondary hover:text-white hover:bg-surface-3'
              }`}>
              <Icon size={20} />
              {label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted mt-3">Theme applies and saves immediately when selected.</p>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Eye size={15} className="text-accent-blue" />
          <p className="text-sm font-semibold text-white">Features</p>
        </div>
        <div className="space-y-4">
          <Toggle label="Halal Screening Badge" desc="Show AAOIFI-based Halal analysis on stock pages"
            value={settings.show_halal_badge} onChange={v=>update('show_halal_badge',v)} />
          <Toggle label="News and Sentiment" desc="Show news panel on stock detail pages"
            value={settings.show_news} onChange={v=>update('show_news',v)} />
          <Toggle label="AI Recommendations" desc="Show AI-powered buy/hold/sell signals"
            value={settings.show_ai_recommendations} onChange={v=>update('show_ai_recommendations',v)} />
          <Toggle label="Insider Transactions" desc="Show SEC insider buying/selling activity"
            value={settings.show_shareholders} onChange={v=>update('show_shareholders',v)} />
          <Toggle label="Compact View" desc="Smaller cards with less whitespace"
            value={settings.compact_view} onChange={v=>update('compact_view',v)} />
        </div>
      </div>

      {/* Security / 2FA */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={15} className="text-accent-blue" />
          <p className="text-sm font-semibold text-white">Security</p>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">Two-Factor Authentication</p>
            <p className="text-xs text-secondary mt-0.5">
              {mfaEnabled ? 'Your account is protected with TOTP authentication' : 'Add an extra layer of security with an authenticator app'}
            </p>
          </div>
          {mfaLoading && !mfaSetup ? (
            <Loader2 size={16} className="animate-spin text-muted shrink-0" />
          ) : mfaEnabled ? (
            confirmDisable ? (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-secondary">Sure?</span>
                <button onClick={disableMFA} disabled={mfaLoading}
                  className="px-2.5 py-1.5 rounded-lg bg-accent-red/15 border border-accent-red/30 text-accent-red text-xs font-medium hover:bg-accent-red/20 transition-colors">
                  {mfaLoading ? <Loader2 size={12} className="animate-spin" /> : 'Yes, disable'}
                </button>
                <button onClick={() => setConfirmDisable(false)}
                  className="p-1.5 rounded-lg hover:bg-surface-3 text-muted hover:text-white transition-colors">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmDisable(true)}
                className="px-3 py-1.5 rounded-lg bg-surface-3 border border-border text-secondary text-xs font-medium hover:text-white transition-colors shrink-0">
                Disable
              </button>
            )
          ) : (
            <button onClick={enableMFA} disabled={mfaLoading || mfaSetup}
              className="px-3 py-1.5 rounded-lg bg-accent-green/15 border border-accent-green/30 text-accent-green text-xs font-medium hover:bg-accent-green/20 transition-colors shrink-0">
              Enable
            </button>
          )}
        </div>

        {mfaEnabled && !confirmDisable && (
          <div className="mt-3 flex items-center gap-2 p-2.5 bg-accent-green/8 rounded-lg border border-accent-green/20">
            <ShieldCheck size={14} className="text-accent-green shrink-0" />
            <p className="text-xs text-accent-green">2FA is active — your account requires a verification code on each sign-in</p>
          </div>
        )}

        {mfaSetup && (
          <div className="mt-4 p-4 bg-surface-2 rounded-xl border border-accent-blue/30 space-y-4">
            <div>
              <p className="text-xs font-semibold text-white mb-1">Scan with your authenticator app</p>
              <p className="text-xs text-secondary">Use Google Authenticator, Authy, or any TOTP-compatible app.</p>
            </div>
            {mfaQR && (
              <div className="flex justify-center">
                <img src={mfaQR} alt="2FA QR Code" className="w-40 h-40 rounded-lg bg-white p-2" />
              </div>
            )}
            <div>
              <p className="text-[10px] text-muted mb-1 uppercase tracking-wider">Manual entry key</p>
              <p className="text-xs font-mono text-secondary bg-surface-3 rounded-lg px-3 py-2 break-all select-all">{mfaSecret}</p>
            </div>
            <div>
              <label className="label block mb-1.5">Enter the 6-digit code from your app</label>
              <input
                type="text" inputMode="numeric" maxLength={6}
                value={mfaCode}
                onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                className="input w-full text-center text-lg tracking-[0.5em] font-mono"
                placeholder="000000" autoFocus
              />
            </div>
            {mfaError && (
              <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/20 rounded-lg px-3 py-2">{mfaError}</p>
            )}
            <div className="flex gap-2">
              <button onClick={() => { setMfaSetup(false); setMfaQR(''); setMfaCode(''); setMfaError(''); }}
                className="btn-secondary flex-1">Cancel</button>
              <button onClick={verifyMFA} disabled={mfaLoading || mfaCode.length !== 6}
                className="btn-primary flex-1 flex items-center justify-center gap-2">
                {mfaLoading ? <Loader2 size={14} className="animate-spin" /> : <><ShieldCheck size={14} /> Verify &amp; Enable</>}
              </button>
            </div>
          </div>
        )}

        {mfaError && !mfaSetup && (
          <p className="mt-3 text-sm text-accent-red bg-accent-red/10 border border-accent-red/20 rounded-lg px-3 py-2">{mfaError}</p>
        )}
      </div>

      <div className="card">
        <p className="label mb-3">About StockWise</p>
        <div className="space-y-1.5 text-xs text-secondary">
          <p>Version 1.0.0 · Built by Adam</p>
          <p>Stock data — Finnhub · Charts — Alpha Vantage</p>
          <p>Halal screening — AAOIFI standards · Fiqh Council of North America</p>
          <p className="text-muted pt-2 leading-relaxed">For informational purposes only. Not financial advice. Always verify Halal compliance on Musaffa.com.</p>
        </div>
      </div>

      <button onClick={saveSettings}
        className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-base">
        {saved
          ? <><Check size={18}/><span>Saved successfully!</span></>
          : <><Save size={18}/><span>Save Settings</span></>
        }
      </button>
    </div>
  );
}

function Toggle({ label, desc, value, onChange }: {
  label: string; desc: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-secondary mt-0.5">{desc}</p>
      </div>
      <button onClick={() => onChange(!value)}
        className={`relative w-12 h-6 rounded-full transition-colors duration-200 shrink-0 ${value?'bg-accent-green':'bg-surface-4'}`}>
        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${value?'left-7':'left-1'}`} />
      </button>
    </div>
  );
}
