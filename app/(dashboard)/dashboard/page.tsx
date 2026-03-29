import { createClient } from '@/lib/supabase/server';
import { fetchStockData } from '@/services/yahoo-finance';
import StockSearch from '@/components/stock/StockSearch';
import StockCard from '@/components/stock/StockCard';
import { TrendingUp, Star, Briefcase, ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: portfolio }, { data: watchlist }] = await Promise.all([
    supabase.from('portfolios').select('*').eq('user_id', user!.id).limit(4),
    supabase.from('watchlists').select('*').eq('user_id', user!.id).limit(4),
  ]);
  const portfolioItems = await Promise.all((portfolio ?? []).map(async h => {
    const stock = await fetchStockData(h.ticker);
    const price = stock?.price ?? h.purchase_price;
    const val = price * h.quantity; const cost = h.purchase_price * h.quantity;
    return { ...h, stock_data: stock ?? undefined, current_value: val, gain_loss: val - cost, gain_loss_percent: cost > 0 ? ((val - cost)/cost)*100 : 0 };
  }));
  const watchlistItems = await Promise.all((watchlist ?? []).map(async w => {
    const stock = await fetchStockData(w.ticker);
    return { ...w, stock_data: stock ?? undefined, at_target: w.target_price != null && stock?.price != null ? stock.price >= w.target_price : false };
  }));
  const isEmpty = portfolioItems.length === 0 && watchlistItems.length === 0;
  const totalValue = portfolioItems.reduce((s, h) => s + (h.current_value ?? 0), 0);
  const totalCost = portfolioItems.reduce((s, h) => s + h.purchase_price * h.quantity, 0);
  const totalGL = totalValue - totalCost;
  const totalGLPct = totalCost > 0 ? (totalGL / totalCost) * 100 : 0;

  return (
    <div className="space-y-8 page-enter">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-secondary text-sm mt-0.5">Your market overview</p>
        </div>
        <StockSearch placeholder="Search & add stocks..." />
      </div>
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent-green/10 border border-accent-green/20 flex items-center justify-center mb-6">
            <TrendingUp size={28} className="text-accent-green" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Start building your portfolio</h2>
          <p className="text-secondary text-sm max-w-sm mb-8">Search for any stock or ETF above and add it to your portfolio or watchlist.</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {['AAPL','MSFT','NVDA','XLE','LLY','PAVE'].map(t => (
              <Link key={t} href={'/stock/' + t} className="px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-sm font-mono text-secondary hover:text-white hover:border-accent-green/40 transition-all">{t}</Link>
            ))}
          </div>
        </div>
      ) : (
        <>
          {portfolioItems.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Portfolio Value', value: '$' + totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
                { label: 'Total Cost', value: '$' + totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
                { label: 'Total P&L', value: (totalGL >= 0 ? '+' : '') + '$' + Math.abs(totalGL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), positive: totalGL >= 0 },
                { label: 'Return', value: (totalGLPct >= 0 ? '+' : '') + totalGLPct.toFixed(2) + '%', positive: totalGLPct >= 0 },
              ].map(s => (
                <div key={s.label} className="card">
                  <p className="label mb-2">{s.label}</p>
                  <p className={"stat-value " + (s.positive === undefined ? 'text-white' : s.positive ? 'text-accent-green' : 'text-accent-red')}>{s.value}</p>
                </div>
              ))}
            </div>
          )}
          {portfolioItems.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2"><Briefcase size={16} className="text-accent-green" /><h2 className="text-base font-semibold text-white">Portfolio</h2><span className="badge-neutral">{portfolioItems.length}</span></div>
                <Link href="/portfolio" className="flex items-center gap-1 text-xs text-secondary hover:text-white">View all <ArrowRight size={12} /></Link>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {portfolioItems.map(item => <StockCard key={item.id} item={item} mode="portfolio" />)}
              </div>
            </section>
          )}
          {watchlistItems.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2"><Star size={16} className="text-accent-yellow" /><h2 className="text-base font-semibold text-white">Watchlist</h2><span className="badge-neutral">{watchlistItems.length}</span></div>
                <Link href="/watchlist" className="flex items-center gap-1 text-xs text-secondary hover:text-white">View all <ArrowRight size={12} /></Link>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {watchlistItems.map(item => <StockCard key={item.id} item={item} mode="watchlist" />)}
              </div>
            </section>
          )}
          <section className="grid sm:grid-cols-2 gap-3">
            <Link href="/portfolio-analysis" className="card-hover flex items-center gap-4 group">
              <div className="w-10 h-10 rounded-xl bg-accent-blue/10 flex items-center justify-center shrink-0"><TrendingUp size={18} className="text-accent-blue" /></div>
              <div><p className="text-sm font-semibold text-white">Portfolio Analysis</p><p className="text-xs text-secondary">Diversification score & insights</p></div>
              <ArrowRight size={14} className="text-muted ml-auto" />
            </Link>
            <Link href="/discover" className="card-hover flex items-center gap-4 group">
              <div className="w-10 h-10 rounded-xl bg-accent-purple/10 flex items-center justify-center shrink-0"><Sparkles size={18} className="text-accent-purple" /></div>
              <div><p className="text-sm font-semibold text-white">Discover Stocks</p><p className="text-xs text-secondary">Curated ideas by strategy</p></div>
              <ArrowRight size={14} className="text-muted ml-auto" />
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
