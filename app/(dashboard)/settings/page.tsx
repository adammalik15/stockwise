'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Moon, Sun, Monitor, Bell, Eye, TrendingUp, DollarSign, Save, Check } from 'lucide-react';

type Theme = 'dark' | 'light' | 'system';
type Currency = 'USD' | 'GBP' | 'EUR' | 'AED' | 'SAR';

interface UISettings {
  theme: Theme;
  currency: Currency;
  show_halal_badge: boolean;
  show_news: boolean;
  show_ai_recommendations: boolean;
  compact_cards: boolean;
  price_alerts: boolean;
}

const DEFAULT_SETTINGS: UISettings = {
  theme: 'dark',
  currency: 'USD',
  show_halal_badge: true,
  show_news: true,
  show_ai_recommendations: true,
  compact_cards: false,
  price_alerts: true,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<UISettings>(DEFAULT_SETTINGS);
  const [userEmail, setUserEmail] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) setUserEmail(user.email);

      // Load saved settings from localStorage
      const saved = localStorage.getItem('stockwise_settings');
      if (saved) {
        try {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
        } catch {}
      }
      setLoading(false);
    }
    load();
  }, []);

  function save() {
    localStorage.setItem('stockwise_settings', JSON.stringify(settings));

    // Apply theme immediately
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (settings.theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      // System
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', prefersDark);
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const displayName = userEmail
    ? userEmail.split('@')[0].charAt(0).toUpperCase() + userEmail.split('@')[0].slice(1)
    : 'User';

  if (loading) return null;

  return (
    <div className="space-y-6 page-enter max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-secondary text-sm mt-0.5">Customise your StockWise experience</p>
      </div>

      {/* Account */}
      <div className="card">
        <p className="text-sm font-semibold text-white mb-4">Account</p>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-accent-green/20 border border-accent-green/30 flex items-center justify-center shrink-0">
            <span className="text-xl font-bold text-accent-green">{displayName.charAt(0)}</span>
          </div>
          <div>
            <p className="font-semibold text-white">{displayName}</p>
            <p className="text-sm text-secondary">{userEmail}</p>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Monitor size={15} className="text-accent-blue" />
          <p className="text-sm font-semibold text-white">Appearance</p>
        </div>

        <div className="space-y-4">
          <div>
            <p className="label mb-3">Theme</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: 'dark', label: 'Dark', icon: Moon },
                { key: 'light', label: 'Light', icon: Sun },
                { key: 'system', label: 'System', icon: Monitor },
              ] as const).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setSettings(p => ({ ...p, theme: key }))}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all ${
                    settings.theme === key
                      ? 'bg-accent-green/15 border-accent-green/40 text-accent-green'
                      : 'bg-surface-2 border-border text-secondary hover:text-white'
                  }`}
                >
                  <Icon size={18} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="label mb-3">Currency Display</p>
            <div className="grid grid-cols-5 gap-2">
              {(['USD', 'GBP', 'EUR', 'AED', 'SAR'] as Currency[]).map(c => (
                <button
                  key={c}
                  onClick={() => setSettings(p => ({ ...p, currency: c }))}
                  className={`py-2 rounded-lg border text-xs font-mono font-medium transition-all ${
                    settings.currency === c
                      ? 'bg-accent-green/15 border-accent-green/40 text-accent-green'
                      : 'bg-surface-2 border-border text-secondary hover:text-white'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted mt-2">Note: Prices are in USD from market. Currency display is cosmetic only.</p>
          </div>

          <Toggle
            label="Compact Card View"
            desc="Show smaller stock cards with less detail"
            value={settings.compact_cards}
            onChange={v => setSettings(p => ({ ...p, compact_cards: v }))}
          />
        </div>
      </div>

      {/* Features */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Eye size={15} className="text-accent-purple" />
          <p className="text-sm font-semibold text-white">Features</p>
        </div>
        <div className="space-y-4">
          <Toggle
            label="Halal Screening Badge"
            desc="Show AAOIFI-based Halal screening on stock pages"
            value={settings.show_halal_badge}
            onChange={v => setSettings(p => ({ ...p, show_halal_badge: v }))}
          />
          <Toggle
            label="News & Sentiment"
            desc="Show news panel on stock detail pages"
            value={settings.show_news}
            onChange={v => setSettings(p => ({ ...p, show_news: v }))}
          />
          <Toggle
            label="AI Recommendations"
            desc="Show AI-powered buy/hold/sell signals"
            value={settings.show_ai_recommendations}
            onChange={v => setSettings(p => ({ ...p, show_ai_recommendations: v }))}
          />
          <Toggle
            label="Price Target Alerts"
            desc="Highlight stocks that reach your watchlist target price"
            value={settings.price_alerts}
            onChange={v => setSettings(p => ({ ...p, price_alerts: v }))}
          />
        </div>
      </div>

      {/* About */}
      <div className="card">
        <p className="text-sm font-semibold text-white mb-3">About StockWise</p>
        <div className="space-y-2 text-xs text-secondary">
          <p>Version 1.0.0 · Built by Adam</p>
          <p>Stock data provided by Finnhub · Chart data by Alpha Vantage</p>
          <p>Halal screening based on AAOIFI standards</p>
          <p className="text-muted pt-1">
            Prices are delayed approximately 15 minutes. This app is for informational purposes only and does not constitute financial advice. Always verify Halal compliance on Musaffa.com.
          </p>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={save}
        className="btn-primary w-full py-3 flex items-center justify-center gap-2"
      >
        {saved ? (
          <>
            <Check size={16} /> Saved!
          </>
        ) : (
          <>
            <Save size={16} /> Save Settings
          </>
        )}
      </button>
    </div>
  );
}

function Toggle({
  label, desc, value, onChange,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-secondary mt-0.5">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-all shrink-0 ${
          value ? 'bg-accent-green' : 'bg-surface-3'
        }`}
      >
        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${
          value ? 'left-6' : 'left-1'
        }`} />
      </button>
    </div>
  );
}