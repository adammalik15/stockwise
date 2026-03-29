const fs = require('fs');
const path = require('path');

function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✓ Written: ' + filePath);
}

// ─── Portfolio Page ───────────────────────────────────────────────────────────
write('app/(dashboard)/portfolio/page.tsx', `'use client';

import { useEffect, useState, useCallback } from 'react';
import StockCard from '@/components/stock/StockCard';
import StockSearch from '@/components/stock/StockSearch';
import { Briefcase, Download, Loader2, X, Plus, Minus, Hash } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type EditMode = 'add' | 'reduce' | 'set';

export default function PortfolioPage() {
  const [holdings, setHoldings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<any>(null);
  const [editMode, setEditMode] = useState<EditMode>('add');
  const [editForm, setEditForm] = useState({
    quantity: '',
    purchase_price: '',
    purchase_date: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/portfolio');
    const data = await res.json();
    setHoldings(data.holdings ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function remove(id: string) {
    await fetch('/api/portfolio', { method: 'DELETE', body: JSON.stringify({ id }) });
    setHoldings(p => p.filter(h => h.id !== id));
  }

  function startEdit(item: any) {
    setEditItem(item);
    setEditMode('add');
    setEditError('');
    setEditForm({
      quantity: '',
      purchase_price: String(item.purchase_price),
      purchase_date: item.purchase_date,
      notes: item.notes ?? '',
    });
  }

  async function saveEdit() {
    if (!editItem) return;
    setEditError('');
    setSaving(true);
    try {
      const supabase = createClient();
      const inputQty = parseFloat(editForm.quantity);
      if (isNaN(inputQty) || inputQty <= 0) {
        setEditError('Please enter a valid quantity greater than 0.');
        setSaving(false);
        return;
      }
      let newQuantity: number;
      if (editMode === 'add') {
        newQuantity = editItem.quantity + inputQty;
      } else if (editMode === 'reduce') {
        newQuantity = editItem.quantity - inputQty;
        if (newQuantity <= 0) {
          setEditError('Cannot reduce below 0. Use Remove to delete this holding.');
          setSaving(false);
          return;
        }
      } else {
        newQuantity = inputQty;
      }
      await supabase.from('portfolios').update({
        quantity: newQuantity,
        purchase_price: parseFloat(editForm.purchase_price),
        purchase_date: editForm.purchase_date,
        notes: editForm.notes || null,
      }).eq('id', editItem.id);
      setEditItem(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  function exportCSV() {
    const headers = ['Ticker','Type','Shares','Avg Buy Price','Date','Current Price','Value','P&L','Return%'];
    const rows = holdings.map(h => [
      h.ticker, h.asset_type, h.quantity, h.purchase_price,
      h.purchase_date, h.stock_data?.price ?? '',
      h.current_value?.toFixed(2) ?? '',
      h.gain_loss?.toFixed(2) ?? '',
      h.gain_loss_percent?.toFixed(2) ?? '',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'portfolio.csv';
    a.click();
  }

  const totalValue = holdings.reduce((s, h) => s + (h.current_value ?? 0), 0);
  const totalCost = holdings.reduce((s, h) => s + h.purchase_price * h.quantity, 0);
  const totalGL = totalValue - totalCost;
  const totalGLPct = totalCost > 0 ? (totalGL / totalCost) * 100 : 0;
  const isPos = totalGL >= 0;

  const editModes: { key: EditMode; label: string; icon: any; desc: string }[] = [
    { key: 'add', label: 'Buy More', icon: Plus, desc: 'Add shares to existing position' },
    { key: 'reduce', label: 'Sell Some', icon: Minus, desc: 'Remove shares from position' },
    { key: 'set', label: 'Set Exact', icon: Hash, desc: 'Set exact share count' },
  ];

  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Portfolio</h1>
          <p className="text-secondary text-sm mt-0.5">
            {holdings.length} holding{holdings.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {holdings.length > 0 && (
            <button onClick={exportCSV} className="btn-secondary flex items-center gap-2">
              <Download size={14} /> Export CSV
            </button>
          )}
          <StockSearch placeholder="Add stock..." />
        </div>
      </div>

      {holdings.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Value', value: '$' + totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
            { label: 'Total Cost', value: '$' + totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
            { label: 'Total P&L', value: (isPos?'+':'')+'\$'+Math.abs(totalGL).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}), positive: isPos },
            { label: 'Return', value: (isPos?'+':'')+totalGLPct.toFixed(2)+'%', positive: isPos },
          ].map(s => (
            <div key={s.label} className="card">
              <p className="label mb-1.5">{s.label}</p>
              <p className={\`stat-value \${s.positive===undefined?'text-white':s.positive?'text-accent-green':'text-accent-red'}\`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface-1 border border-border rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-lg font-semibold text-white">Update {editItem.ticker}</h2>
                <p className="text-xs text-secondary mt-0.5">
                  Currently holding <strong className="text-white">{editItem.quantity} shares</strong> @ \${editItem.purchase_price}
                </p>
              </div>
              <button onClick={() => setEditItem(null)} className="p-1.5 rounded-lg hover:bg-surface-2 text-muted">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 my-4">
              {editModes.map(m => (
                <button key={m.key} onClick={() => { setEditMode(m.key); setEditError(''); }}
                  className={\`flex flex-col items-center gap-1 p-3 rounded-xl border text-xs font-medium transition-all \${editMode===m.key?'bg-accent-green/15 border-accent-green/40 text-accent-green':'bg-surface-2 border-border text-secondary hover:text-white'}\`}>
                  <m.icon size={16} />
                  {m.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted mb-4">{editModes.find(m=>m.key===editMode)?.desc}</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label block mb-1.5">
                    {editMode==='add'?'Shares to Buy':editMode==='reduce'?'Shares to Sell':'New Total Shares'}
                  </label>
                  <input type="number" step="any" min="0.000001" value={editForm.quantity}
                    onChange={e=>setEditForm(p=>({...p,quantity:e.target.value}))}
                    className="input w-full" placeholder="0.00" autoFocus />
                </div>
                <div>
                  <label className="label block mb-1.5">Avg Buy Price</label>
                  <input type="number" step="any" min="0" value={editForm.purchase_price}
                    onChange={e=>setEditForm(p=>({...p,purchase_price:e.target.value}))}
                    className="input w-full" />
                </div>
              </div>
              {editForm.quantity && !isNaN(parseFloat(editForm.quantity)) && (
                <div className="p-3 bg-surface-2 rounded-lg">
                  <p className="text-xs text-secondary">New total: <strong className="text-white">
                    {editMode==='add'?(editItem.quantity+parseFloat(editForm.quantity)).toFixed(4)
                      :editMode==='reduce'?(editItem.quantity-parseFloat(editForm.quantity)).toFixed(4)
                      :parseFloat(editForm.quantity).toFixed(4)} shares
                  </strong></p>
                </div>
              )}
              <div>
                <label className="label block mb-1.5">Purchase Date</label>
                <input type="date" value={editForm.purchase_date}
                  onChange={e=>setEditForm(p=>({...p,purchase_date:e.target.value}))}
                  className="input w-full" />
              </div>
              <div>
                <label className="label block mb-1.5">Notes</label>
                <input type="text" value={editForm.notes}
                  onChange={e=>setEditForm(p=>({...p,notes:e.target.value}))}
                  className="input w-full" placeholder="e.g. Long-term hold" />
              </div>
              {editError && (
                <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/20 rounded-lg px-3 py-2">{editError}</p>
              )}
              <div className="flex gap-3">
                <button onClick={()=>setEditItem(null)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={saveEdit} disabled={saving} className="btn-primary flex-1">
                  {saving?<Loader2 size={14} className="animate-spin mx-auto"/>:'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={22} className="animate-spin text-accent-green" />
        </div>
      ) : holdings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Briefcase size={40} className="text-muted mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">No holdings yet</h2>
          <p className="text-secondary text-sm max-w-xs">Search for a stock above and click + to add it.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {holdings.map(item => (
            <StockCard key={item.id} item={item} mode="portfolio"
              onRemove={() => remove(item.id)}
              onEdit={() => startEdit(item)} />
          ))}
        </div>
      )}
    </div>
  );
}
`);

// ─── Settings Page ─────────────────────────────────────────────────────────────
write('app/(dashboard)/settings/page.tsx', `'use client';

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
    setSettings(getSettings());
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setUserEmail(user.email);
    });
  }, []);

  function update<K extends keyof UISettings>(key: K, value: UISettings[K]) {
    setSettings(prev => ({ ...prev, [key]: value }));
    if (key === 'theme') applyTheme(value as Theme);
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
              className={\`flex flex-col items-center gap-2 p-4 rounded-xl border text-xs font-medium transition-all \${
                settings.theme===key
                  ?'bg-accent-green/15 border-accent-green/40 text-accent-green'
                  :'bg-surface-2 border-border text-secondary hover:text-white hover:bg-surface-3'
              }\`}>
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
        className={\`relative w-12 h-6 rounded-full transition-colors duration-200 shrink-0 \${value?'bg-accent-green':'bg-surface-4'}\`}>
        <div className={\`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 \${value?'left-7':'left-1'}\`} />
      </button>
    </div>
  );
}
`);

console.log('\n✅ Both files written successfully!');
console.log('Now run: git add . && git commit -m "fix portfolio edit and settings" && git push');
