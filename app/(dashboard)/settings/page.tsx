'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Moon, Sun, Monitor, Save, Check, Palette, Eye } from 'lucide-react';

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
  const html = document.documentElement;
  if (theme === 'light') {
    html.classList.remove('dark');
  } else if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    html.classList.toggle('dark', prefersDark);
  } else {
    html.classList.add('dark');
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

  useEffect(() => {
    const loaded = getSettings();
    setSettings(loaded);
    applyTheme(loaded.theme);
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setUserEmail(user.email);
    });
  }, []);

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
        <p className="text-[10px] text-muted mt-3">Theme applies immediately when selected. Save to persist.</p>
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
