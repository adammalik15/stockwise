'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Plus, Star, Loader2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function StockSearch({ placeholder = 'Search stocks, ETFs...' }: { placeholder?: string }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [addModal, setAddModal] = useState<{ ticker: string; name: string } | null>(null);
  const searchTimeout = useRef<NodeJS.Timeout>();
  const router = useRouter();

  const handleInput = useCallback((val: string) => {
    setQuery(val);
    clearTimeout(searchTimeout.current);
    if (!val.trim()) { setResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/stocks/search?q=' + encodeURIComponent(val));
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen(true);
      } finally { setLoading(false); }
    }, 350);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (!(e.target as Element).closest('[data-search]')) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function addToWatchlist(ticker: string, e: React.MouseEvent) {
    e.stopPropagation(); setAdding(ticker + '-w');
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from('watchlists').upsert({ user_id: user.id, ticker, asset_type: 'stock', alert_enabled: false }, { onConflict: 'user_id,ticker' });
    setAdding(null); setOpen(false); router.refresh();
  }

  return (
    <>
      <div data-search className="relative w-full max-w-xl">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input type="text" value={query} onChange={e => handleInput(e.target.value)} onFocus={() => results.length > 0 && setOpen(true)}
            placeholder={placeholder} className="input w-full pl-10 pr-10 py-2.5" />
          {loading && <Loader2 size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted animate-spin" />}
          {query && !loading && <button onClick={() => { setQuery(''); setResults([]); setOpen(false); }} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-white"><X size={14} /></button>}
        </div>
        {open && results.length > 0 && (
          <div className="absolute top-full mt-1.5 w-full bg-surface-2 border border-border rounded-xl shadow-xl z-50 overflow-hidden">
            {results.map(r => (
              <div key={r.ticker} onClick={() => { setOpen(false); setQuery(''); router.push('/stock/' + r.ticker); }}
                className="flex items-center justify-between px-4 py-3 hover:bg-surface-3 cursor-pointer group border-b border-border/50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-surface-3 flex items-center justify-center shrink-0">
                    <span className="text-xs font-mono font-bold text-accent-green">{r.ticker.slice(0,2)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{r.ticker}</p>
                    <p className="text-xs text-secondary line-clamp-1">{r.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={e => addToWatchlist(r.ticker, e)} className="p-1.5 rounded-lg bg-surface-4 hover:bg-accent-green/20 text-secondary hover:text-accent-green transition-colors" title="Add to Watchlist">
                    {adding === r.ticker + '-w' ? <Loader2 size={13} className="animate-spin" /> : <Star size={13} />}
                  </button>
                  <button onClick={e => { e.stopPropagation(); setAddModal({ ticker: r.ticker, name: r.name }); setOpen(false); }} className="p-1.5 rounded-lg bg-surface-4 hover:bg-accent-green/20 text-secondary hover:text-accent-green transition-colors" title="Add to Portfolio">
                    <Plus size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {addModal && <AddPortfolioModal ticker={addModal.ticker} name={addModal.name} onClose={() => setAddModal(null)} onSuccess={() => { setAddModal(null); router.refresh(); }} />}
    </>
  );
}

function AddPortfolioModal({ ticker, name, onClose, onSuccess }: any) {
  const [form, setForm] = useState({ quantity: '', purchase_price: '', purchase_date: new Date().toISOString().split('T')[0], asset_type: 'stock', notes: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error: dbError } = await supabase.from('portfolios').upsert({
        user_id: user.id, ticker, asset_type: form.asset_type,
        quantity: parseFloat(form.quantity), purchase_price: parseFloat(form.purchase_price),
        purchase_date: form.purchase_date, notes: form.notes || null,
      }, { onConflict: 'user_id,ticker' });
      if (dbError) throw dbError;
      onSuccess();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface-1 border border-border rounded-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-white mb-1">Add to Portfolio</h2>
        <p className="text-sm text-secondary mb-5">{ticker} — {name}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label block mb-1.5">Quantity *</label><input type="number" step="any" min="0.000001" required value={form.quantity} onChange={e => setForm(p => ({...p, quantity: e.target.value}))} className="input w-full" placeholder="0.00" /></div>
            <div><label className="label block mb-1.5">Purchase Price *</label><input type="number" step="any" min="0" required value={form.purchase_price} onChange={e => setForm(p => ({...p, purchase_price: e.target.value}))} className="input w-full" placeholder="0.00" /></div>
          </div>
          <div><label className="label block mb-1.5">Purchase Date *</label><input type="date" required value={form.purchase_date} onChange={e => setForm(p => ({...p, purchase_date: e.target.value}))} className="input w-full" /></div>
          <div><label className="label block mb-1.5">Asset Type</label>
            <select value={form.asset_type} onChange={e => setForm(p => ({...p, asset_type: e.target.value}))} className="input w-full">
              <option value="stock">Stock</option><option value="etf">ETF</option><option value="commodity">Commodity</option><option value="crypto">Crypto</option>
            </select>
          </div>
          <div><label className="label block mb-1.5">Notes (optional)</label><input type="text" value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} className="input w-full" placeholder="e.g. Long-term hold" /></div>
          {error && <p className="text-sm text-accent-red">{error}</p>}
          <div className="flex gap-3"><button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button><button type="submit" disabled={loading} className="btn-primary flex-1">{loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Add'}</button></div>
        </form>
      </div>
    </div>
  );
}
