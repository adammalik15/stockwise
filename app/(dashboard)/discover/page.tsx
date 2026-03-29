'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Loader2, Zap, Clock, DollarSign, ExternalLink, Star } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

type Category = 'short_term'|'long_term'|'dividend';
const CATS = [
  { key:'short_term', label:'Short-Term', desc:'Momentum plays', icon:<Zap size={15}/>, color:'text-accent-red' },
  { key:'long_term', label:'Long-Term', desc:'Strong fundamentals', icon:<Clock size={15}/>, color:'text-accent-blue' },
  { key:'dividend', label:'Dividend', desc:'Income stocks', icon:<DollarSign size={15}/>, color:'text-accent-green' },
] as const;
const RISK_COLORS: any = { LOW:'badge-green', MEDIUM:'badge-yellow', HIGH:'badge-red' };

export default function DiscoverPage() {
  const [cat, setCat] = useState<Category>('long_term');
  const [stocks, setStocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string|null>(null);
  const router = useRouter();

  const load = useCallback(async (c: Category) => {
    setLoading(true); setStocks([]);
    const res = await fetch('/api/discover?category='+c);
    const data = await res.json();
    setStocks(data.stocks ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(cat); }, [cat, load]);

  async function addToWatchlist(ticker: string) {
    setAdding(ticker);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from('watchlists').upsert({ user_id: user.id, ticker, asset_type: 'stock', alert_enabled: false }, { onConflict: 'user_id,ticker' });
    setAdding(null); router.refresh();
  }

  return (
    <div className="space-y-6 page-enter">
      <div><h1 className="text-2xl font-bold text-white">Discover</h1><p className="text-secondary text-sm">Curated stock ideas by strategy</p></div>
      <div className="flex items-start gap-3 p-4 bg-accent-green/5 border border-accent-green/20 rounded-xl">
        <span className="text-lg mt-0.5">☪️</span>
        <p className="text-xs text-secondary leading-relaxed"><strong className="text-accent-green">Halal Note:</strong> All suggestions must be independently verified. Use <a href="https://musaffa.com" target="_blank" rel="noopener noreferrer" className="text-accent-green underline inline-flex items-center gap-0.5">Musaffa.com <ExternalLink size={10}/></a> to screen each stock.</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {CATS.map(c => (
          <button key={c.key} onClick={() => setCat(c.key as Category)}
            className={"flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all " + (cat===c.key ? 'bg-surface-3 border-accent-green/40 text-white' : 'bg-surface-1 border-border text-secondary hover:text-white hover:bg-surface-2')}>
            <span className={cat===c.key ? c.color : ''}>{c.icon}</span>{c.label}
          </button>
        ))}
      </div>
      {loading ? <div className="flex flex-col items-center justify-center py-20 gap-4"><Loader2 size={28} className="animate-spin text-accent-green"/><p className="text-secondary text-sm">Loading suggestions...</p></div>
      : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stocks.map((s: any) => (
            <div key={s.ticker} className="card-hover group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-surface-3 flex items-center justify-center shrink-0"><span className="text-xs font-mono font-bold text-accent-green">{s.ticker?.slice(0,2)}</span></div>
                  <div><p className="font-semibold text-white text-sm">{s.ticker}</p><p className="text-xs text-secondary">{s.name}</p></div>
                </div>
                <span className={RISK_COLORS[s.risk_level]??'badge-neutral'}>{s.risk_level}</span>
              </div>
              <p className="text-xs text-secondary leading-relaxed mb-3">{s.reasoning}</p>
              <div className="flex items-start gap-1.5 p-2 bg-accent-green/5 rounded-lg border border-accent-green/15 mb-3">
                <span className="text-sm shrink-0">☪️</span>
                <p className="text-[10px] text-secondary leading-relaxed">{s.halal_note}</p>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><span className="badge-neutral text-[10px]">{s.sector}</span>{s.price && <span className="text-xs font-mono text-secondary">~${s.price}</span>}</div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => addToWatchlist(s.ticker)} disabled={adding===s.ticker} className="p-1.5 rounded-lg bg-surface-3 hover:bg-accent-yellow/20 text-secondary hover:text-accent-yellow transition-colors" title="Add to Watchlist">
                    {adding===s.ticker ? <Loader2 size={13} className="animate-spin"/> : <Star size={13}/>}
                  </button>
                  <Link href={'/stock/'+s.ticker} className="p-1.5 rounded-lg bg-surface-3 hover:bg-accent-blue/20 text-secondary hover:text-accent-blue transition-colors" title="View Details"><ExternalLink size={13}/></Link>
                </div>
              </div>
            </div>
          ))}
        </div>}
      <p className="text-xs text-muted text-center pb-4">⚠️ For informational purposes only. Not financial advice. Verify Halal status independently.</p>
    </div>
  );
}
