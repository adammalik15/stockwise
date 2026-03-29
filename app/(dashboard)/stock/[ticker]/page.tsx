import { notFound } from 'next/navigation';
import { fetchStockData, fetchPriceHistory } from '@/services/yahoo-finance';
import { formatMarketCap, formatPrice, formatPercent } from '@/lib/utils';
import { createClient } from '@/lib/supabase/server';
import PriceChart from '@/components/charts/PriceChart';
import RecommendationPanel from '@/components/stock/RecommendationPanel';
import NewsPanel from '@/components/stock/NewsPanel';
import AddStockButtons from '@/components/stock/AddStockButtons';
import { TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function StockDetailPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const upper = ticker.toUpperCase();
  const [stock, history] = await Promise.all([
    fetchStockData(upper),
    fetchPriceHistory(upper, '6mo')
  ]);
  if (!stock) notFound();
  const isPos = (stock.change_percent ?? 0) >= 0;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: inP }, { data: inW }] = await Promise.all([
    supabase.from('portfolios').select('id').eq('user_id', user!.id).eq('ticker', upper).maybeSingle(),
    supabase.from('watchlists').select('id').eq('user_id', user!.id).eq('ticker', upper).maybeSingle(),
  ]);
  const fiftyTwoPct = stock.fifty_two_week_high && stock.fifty_two_week_low
    ? ((stock.price - stock.fifty_two_week_low) / (stock.fifty_two_week_high - stock.fifty_two_week_low)) * 100
    : null;

  return (
    <div className="space-y-5 page-enter">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-surface-2 border border-border flex items-center justify-center shrink-0">
            <span className="font-mono font-bold text-accent-green text-lg">{upper.slice(0,2)}</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{upper}</h1>
            <p className="text-secondary text-sm">{stock.name}</p>
            {stock.sector && (
              <div className="flex gap-1.5 mt-1.5">
                <span className="badge-neutral text-[10px]">{stock.sector}</span>
                {stock.industry && <span className="badge-neutral text-[10px]">{stock.industry}</span>}
              </div>
            )}
          </div>
        </div>
        <AddStockButtons ticker={upper} inPortfolio={!!inP} inWatchlist={!!inW} />
      </div>

      <div className="card">
        <div className="flex items-end gap-4 mb-1">
          <span className="text-4xl font-mono font-bold text-white">{formatPrice(stock.price)}</span>
          <div className={"flex items-center gap-1.5 mb-1 " + (isPos ? 'text-accent-green' : 'text-accent-red')}>
            {isPos ? <TrendingUp size={18}/> : <TrendingDown size={18}/>}
            <span className="font-mono font-semibold">{formatPercent(stock.change_percent)}</span>
            <span className="text-sm">({formatPrice(stock.change)} today)</span>
          </div>
        </div>
        <p className="text-[11px] text-muted mb-4">Prices delayed ~15 min</p>
        <PriceChart ticker={upper} initialData={history} currentPrice={stock.price} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Market Cap', value: formatMarketCap(stock.market_cap) },
          { label: 'P/E Ratio', value: stock.pe_ratio ? stock.pe_ratio.toFixed(1) : 'N/A' },
          { label: 'Beta', value: stock.beta ? stock.beta.toFixed(2) : 'N/A' },
          { label: 'Dividend Yield', value: stock.dividend_yield ? (stock.dividend_yield * 100).toFixed(2) + '%' : 'None' },
        ].map(s => (
          <div key={s.label} className="card">
            <p className="label mb-2">{s.label}</p>
            <p className="stat-value text-base">{s.value}</p>
          </div>
        ))}
      </div>

      {fiftyTwoPct !== null && (
        <div className="card">
          <p className="label mb-3">52-Week Range</p>
          <div className="flex justify-between text-xs text-secondary mb-2">
            <span>Low: {formatPrice(stock.fifty_two_week_low)}</span>
            <span className="font-mono font-semibold text-white">{formatPrice(stock.price)}</span>
            <span>High: {formatPrice(stock.fifty_two_week_high)}</span>
          </div>
          <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-accent-red via-accent-yellow to-accent-green rounded-full"
              style={{ width: Math.min(100, Math.max(0, fiftyTwoPct)) + '%' }} />
          </div>
          <p className="text-xs text-secondary mt-2">Currently at {fiftyTwoPct.toFixed(0)}% of 52-week range</p>
        </div>
      )}

      {stock.description && (
        <div className="card">
          <p className="label mb-3">About {stock.name}</p>
          <p className="text-sm text-secondary leading-relaxed line-clamp-4">{stock.description}</p>
        </div>
      )}

      <RecommendationPanel ticker={upper} />
      <NewsPanel ticker={upper} />

      <div className="card border-accent-green/20 bg-accent-green/5">
        <div className="flex items-start gap-3">
          <div className="text-xl mt-0.5">☪️</div>
          <div>
            <p className="text-sm font-semibold text-accent-green mb-1">Halal Compliance Check</p>
            <p className="text-xs text-secondary leading-relaxed">
              Sharia compliance must be independently verified. Use{' '}
              <a href={"https://musaffa.com/stock/" + upper} target="_blank" rel="noopener noreferrer"
                className="text-accent-green underline inline-flex items-center gap-0.5">
                Musaffa.com <ExternalLink size={10}/>
              </a>{' '}
              to screen this stock for Islamic finance compliance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}