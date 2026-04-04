'use client';
import { useState } from 'react';
import { Star, Plus, Loader2, Check, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function AddStockButtons({ ticker, inPortfolio, inWatchlist, stockType }: {
  ticker: string; inPortfolio: boolean; inWatchlist: boolean; stockType?: string;
}) {
  const [watchAdded, setWatchAdded] = useState(inWatchlist);
  const [portfolioAdded, setPortfolioAdded] = useState(inPortfolio);
  const [loadingWatch, setLoadingWatch] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();

  async function toggleWatchlist() {
    setLoadingWatch(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (watchAdded) {
      await supabase.from('watchlists').delete().eq('user_id', user.id).eq('ticker', ticker);
      setWatchAdded(false);
    } else {
      await supabase.from('watchlists').upsert({ user_id: user.id, ticker, asset_type: 'stock', alert_enabled: false }, { onConflict: 'user_id,ticker' });
      setWatchAdded(true);
    }
    setLoadingWatch(false);
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={toggleWatchlist} disabled={loadingWatch}
        className={'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all ' +
          (watchAdded ? 'bg-accent-yellow/15 border-accent-yellow/30 text-accent-yellow' : 'bg-surface-2 border-border text-secondary hover:text-white hover:bg-surface-3')}>
        {loadingWatch ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} className={watchAdded ? 'fill-current' : ''} />}
        {watchAdded ? 'Watching' : 'Watch'}
      </button>
      <button onClick={() => setShowModal(true)}
        className={'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all ' +
          (portfolioAdded ? 'bg-accent-green/15 border-accent-green/30 text-accent-green' : 'btn-primary border-transparent')}>
        {portfolioAdded ? <Check size={14} /> : <Plus size={14} />}
        {portfolioAdded ? 'In Portfolio' : 'Add to Portfolio'}
      </button>
      {showModal && (
        <AddModal
          ticker={ticker}
          stockType={stockType}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); setPortfolioAdded(true); router.refresh(); }}
        />
      )}
    </div>
  );
}

function AddModal({ ticker, stockType, onClose, onSuccess }: {
  ticker: string; stockType?: string; onClose: () => void; onSuccess: () => void;
}) {
  const inferredType = stockType === 'ETP' ? 'etf' : 'stock';
  const [form, setForm] = useState({
    quantity: '',
    purchase_price: '',
    purchase_date: new Date().toISOString().split('T')[0],
    asset_type: inferredType,
    term: 'long',
    notes: '',
  });
  const [loadingPrice, setLoadingPrice] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-fetch current price on mount
  useState(() => {
    fetch(`/api/stocks/${ticker}`)
      .then(r => r.json())
      .then(d => { if (d?.price) setForm(p => ({ ...p, purchase_price: String(d.price.toFixed(2)) })); })
      .catch(() => {})
      .finally(() => setLoadingPrice(false));
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error: dbError } = await supabase.from('portfolios').upsert({
        user_id: user.id, ticker, asset_type: form.asset_type,
        quantity: parseFloat(form.quantity), purchase_price: parseFloat(form.purchase_price),
        purchase_date: form.purchase_date, notes: form.notes || null,
        term: form.term,
      }, { onConflict: 'user_id,ticker' });
      if (dbError) throw dbError;
      // Record transaction
      await supabase.from('portfolio_transactions').insert({
        user_id: user.id, ticker, type: 'buy',
        quantity: parseFloat(form.quantity), price: parseFloat(form.purchase_price),
        date: form.purchase_date, notes: form.notes || null,
      }).then(() => {}); // best-effort; table may not exist yet
      onSuccess();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface-1 border border-border rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">Add {ticker} to Portfolio</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2 text-muted"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label block mb-1.5">Quantity *</label>
              <input type="number" step="any" min="0.000001" required value={form.quantity}
                onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))}
                className="input w-full" placeholder="0.00" />
            </div>
            <div>
              <label className="label block mb-1.5">
                Purchase Price *{loadingPrice && <span className="text-muted ml-1">(loading…)</span>}
              </label>
              <input type="number" step="any" min="0" required value={form.purchase_price}
                onChange={e => setForm(p => ({ ...p, purchase_price: e.target.value }))}
                className="input w-full" placeholder="0.00" />
            </div>
          </div>
          <div><label className="label block mb-1.5">Date *</label>
            <input type="date" required value={form.purchase_date}
              onChange={e => setForm(p => ({ ...p, purchase_date: e.target.value }))}
              className="input w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label block mb-1.5">Asset Type</label>
              <select value={form.asset_type} onChange={e => setForm(p => ({ ...p, asset_type: e.target.value }))} className="input w-full">
                <option value="stock">Stock</option>
                <option value="etf">ETF</option>
                <option value="commodity">Commodity</option>
                <option value="crypto">Crypto</option>
              </select>
            </div>
            <div>
              <label className="label block mb-1.5">Horizon</label>
              <select value={form.term} onChange={e => setForm(p => ({ ...p, term: e.target.value }))} className="input w-full">
                <option value="long">Long-Term</option>
                <option value="short">Short-Term</option>
              </select>
            </div>
          </div>
          <div><label className="label block mb-1.5">Notes (optional)</label>
            <input type="text" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              className="input w-full" placeholder="e.g. Long-term hold" />
          </div>
          {error && <p className="text-sm text-accent-red">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
