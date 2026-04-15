'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search, Loader2, TrendingUp, TrendingDown, Minus,
  CheckCircle2, XCircle, AlertCircle, Info, RefreshCw,
  Brain, BookOpen, ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react';

// ── Tooltip content for every indicator ──────────────────────────────────────
const TIPS: Record<string, { title: string; plain: string; read: string; islam?: string }> = {
  rsi: {
    title: 'RSI — Relative Strength Index',
    plain: 'A "fatigue meter" for price momentum. Measures how fast and how much a stock has moved recently on a scale of 0–100.',
    read: 'Below 30 = oversold (possible bounce) · 30–50 = neutral · 50–65 = healthy momentum · Above 70 = overbought (possible pullback) · Above 78 = auto-reject in our scanner.',
    islam: 'Helps avoid chasing overheated stocks — consistent with the Islamic principle of measured, non-speculative risk-taking.',
  },
  macd: {
    title: 'MACD — Moving Average Convergence Divergence',
    plain: 'Shows whether price momentum is accelerating or decelerating by comparing two moving averages.',
    read: 'Green/bullish = short-term average crossing above long-term average — momentum building. Red/bearish = the opposite. Histogram expanding = signal strengthening.',
  },
  atr: {
    title: 'ATR — Average True Range',
    plain: 'How much the stock typically moves in a single day in dollar terms. A volatility ruler.',
    read: 'We use ATR × 1.5 to set stop-losses and ATR × 2 for first take-profit targets. Higher ATR = wider stops needed = smaller position size.',
    islam: 'Position sizing via ATR reflects the Islamic principle of not exposing wealth to unnecessary gharar (excessive uncertainty).',
  },
  volume: {
    title: 'Volume Ratio',
    plain: "Today's trading volume compared to the 20-day average. Confirms whether a price move has real participation behind it.",
    read: 'Below 1.0× = low conviction move · 1.3–1.9× = confirmed · 2×+ = strong institutional interest · Our scanner requires minimum 1.3× to consider any setup.',
  },
  ema: {
    title: 'EMA — Exponential Moving Average',
    plain: 'A smoothed average of recent prices that gives more weight to recent days. Used to identify trend direction.',
    read: 'Price above EMA-20 AND EMA-50 = bullish trend confirmed. Price below both = bearish. Price between them = neutral / transition zone.',
  },
  vwap: {
    title: 'VWAP — Volume-Weighted Average Price',
    plain: 'The average price paid for the stock weighted by volume. The institutional benchmark — big funds compare their buys against VWAP.',
    read: 'Price above VWAP = bullish bias, institutional money supporting the move. Price below VWAP = bearish. VWAP often acts as intraday support/resistance.',
  },
  obv: {
    title: 'OBV — On-Balance Volume',
    plain: 'Cumulative volume indicator showing whether volume flows into or out of a stock. Detects smart money accumulation before price moves.',
    read: 'Accumulation = institutions buying quietly (volume adding on up-days). Distribution = selling pressure building. OBV rising while price flat = potential breakout coming.',
  },
  adx: {
    title: 'ADX — Average Directional Index',
    plain: 'Measures trend strength, not direction. Answers "is this a real trend or just noise?"',
    read: 'Below 20 = weak/sideways market, avoid momentum plays · 20–30 = developing trend · 30–50 = strong trend worth riding · 50+ = very strong, watch for exhaustion.',
  },
  stoch: {
    title: 'Stochastic Oscillator',
    plain: 'Compares the closing price to its recent high-low range. Faster at catching short-term reversals than RSI.',
    read: 'Below 20 = oversold, potential bounce · Above 80 = overbought, potential pullback · %K crossing above %D = buy signal · Works best combined with RSI confirmation.',
  },
  fib: {
    title: 'Fibonacci Retracement',
    plain: 'Key support and resistance levels based on the Fibonacci sequence. Used by virtually every institutional trading desk globally, making them self-fulfilling.',
    read: '38.2% = shallow pullback zone · 50% = midpoint support (psychologically important) · 61.8% = "golden ratio" — strongest support/resistance level. When price pulls back to these levels, high probability of reaction.',
    islam: 'Fibonacci levels reflect the natural mathematical patterns found throughout creation — a concept that resonates with Islamic appreciation for order in the universe.',
  },
  pivot: {
    title: 'Pivot Points',
    plain: 'Daily support and resistance levels calculated from yesterday\'s high, low, and close. Used by floor traders and institutions as intraday benchmarks.',
    read: 'PP = central pivot (fair value for the day) · R1, R2 = resistance levels above · S1, S2 = support levels below. Price bouncing off S1 = buy signal. Breaking R1 = momentum continuation.',
  },
  sr: {
    title: 'Support & Resistance',
    plain: 'Price levels where buying (support) or selling (resistance) has historically been concentrated. Think of them as floors and ceilings.',
    read: 'Strong support = price tested this level multiple times and held. Resistance = price reached this level multiple times and reversed. The more times a level is tested, the more significant it becomes.',
  },
  beta: {
    title: 'Beta',
    plain: 'Measures how much a stock amplifies or dampens market moves. A stock with beta 2.0 moves twice as much as the S&P 500.',
    read: 'Beta < 1 = less volatile than market (defensive) · Beta = 1 = moves with market · Beta 1.5–2.5 = amplified market moves (tech/growth stocks) · Beta > 2.5 = high risk, needs extra position sizing care.',
    islam: 'High beta stocks require smaller position sizes to keep risk within Islamic capital preservation principles.',
  },
  rr: {
    title: 'Risk:Reward Ratio',
    plain: 'How much you could gain vs how much you risk losing on a trade. A ratio of 1:2 means you risk $1 to potentially make $2.',
    read: 'Our setups target minimum 1:2 R:R. Never take a trade where you risk more than you stand to gain. A 50% win rate with 1:2 R:R is profitable over time.',
    islam: 'Maintaining a positive risk:reward ratio is consistent with Islamic prohibitions on gambling — structured trades with defined outcomes differ from pure chance.',
  },
};

type SizeTier = 'all' | 'small' | 'medium' | 'large' | 'big';

const HALAL_CFG: Record<string, { label: string; color: string; icon: any }> = {
  HALAL:       { label: 'Halal',         color: 'text-accent-green',  icon: CheckCircle2 },
  DOUBTFUL:    { label: 'Doubtful',      color: 'text-accent-yellow', icon: AlertCircle  },
  NEEDS_REVIEW:{ label: 'Needs Review',  color: 'text-accent-yellow', icon: AlertCircle  },
  NOT_HALAL:   { label: 'Not Halal',     color: 'text-accent-red',    icon: XCircle      },
};

const VERDICT_CFG: Record<string, { label: string; color: string; icon: any }> = {
  halal:    { label: 'Halal',    color: 'text-accent-green',  icon: CheckCircle2 },
  haram:    { label: 'Haram',    color: 'text-accent-red',    icon: XCircle      },
  doubtful: { label: 'Doubtful', color: 'text-accent-yellow', icon: AlertCircle  },
};

// ── Tooltip component ─────────────────────────────────────────────────────────
function Tooltip({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const tip = TIPS[id];
  if (!tip) return null;
  return (
    <div className="relative inline-block">
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className="text-muted hover:text-accent-green transition-colors ml-1 align-middle"
      >
        <Info size={11} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 left-0 top-5 w-64 bg-surface-2 border border-border rounded-xl p-3 shadow-xl text-left">
            <p className="text-[11px] font-bold text-white mb-1">{tip.title}</p>
            <p className="text-[10px] text-secondary mb-1 leading-relaxed">{tip.plain}</p>
            <p className="text-[10px] text-muted leading-relaxed border-t border-border pt-1">{tip.read}</p>
            {tip.islam && (
              <p className="text-[10px] text-accent-green mt-1 leading-relaxed border-t border-border pt-1">
                🕌 {tip.islam}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Indicator pill ─────────────────────────────────────────────────────────────
function IndicatorRow({
  label, value, signal, tipId, color,
}: {
  label: string; value: string; signal: string; tipId: string; color: string;
}) {
  return (
    <div className="bg-surface-2 rounded-xl p-3 border border-border">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] text-muted uppercase tracking-wide font-semibold">
          {label}<Tooltip id={tipId} />
        </span>
        <span className={`text-[10px] font-semibold ${color}`}>{signal}</span>
      </div>
      <p className="text-sm font-mono font-bold text-white">{value}</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function StockIntelligencePage() {
  const [query,        setQuery]        = useState('');
  const [ticker,       setTicker]       = useState<string | null>(null);
  const [data,         setData]         = useState<any>(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [portfolioList,setPortfolioList]= useState<string[]>([]);
  const [watchlistList,setWatchlistList]= useState<string[]>([]);
  const [sizeTier,     setSizeTier]     = useState<SizeTier>('all');
  const [showPortfolio,setShowPortfolio]= useState(false);
  const [showWatchlist,setShowWatchlist]= useState(false);
  const [certLoading,  setCertLoading]  = useState(false);
  const [expandLevels, setExpandLevels] = useState(false);

  // Load quick-access lists
  useEffect(() => {
    async function load() {
      const [pr, wr] = await Promise.all([fetch('/api/portfolio'), fetch('/api/watchlist')]);
      const [pd, wd] = await Promise.all([pr.json(), wr.json()]);
      setPortfolioList((pd.holdings ?? []).map((h: any) => h.ticker));
      setWatchlistList((wd.watchlist ?? []).map((w: any) => w.ticker));
    }
    load();
  }, []);

  const analyze = useCallback(async (t: string) => {
    const clean = t.toUpperCase().trim();
    if (!clean) return;
    setTicker(clean);
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res  = await fetch(`/api/stock-intelligence/${clean}`);
      const json = await res.json();
      if (json.error) { setError(json.error); return; }
      setData(json);
    } catch {
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) analyze(query.trim());
  };

  async function certify(verdict: 'halal' | 'haram' | 'doubtful') {
    if (!ticker) return;
    setCertLoading(true);
    const isActive = data?.halal?.user_cert?.user_verdict === verdict;
    await fetch(`/api/stocks/${ticker}/halal-cert`, {
      method:  isActive ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    isActive ? undefined : JSON.stringify({ user_verdict: verdict }),
    });
    await analyze(ticker);
    setCertLoading(false);
  }

  // Filter quick-access lists by size tier
  const priceMap: Record<string, number> = {};
  if (data) priceMap[ticker!] = data.price;

  function inTier(price: number): boolean {
    if (sizeTier === 'all')    return true;
    if (sizeTier === 'small')  return price < 25;
    if (sizeTier === 'medium') return price >= 26  && price <= 100;
    if (sizeTier === 'large')  return price >= 101 && price <= 200;
    if (sizeTier === 'big')    return price > 200;
    return true;
  }

  // Derived display values
  const indicators = data?.indicators;
  const levels     = data?.levels;
  const targets    = data?.targets;
  const behavior   = data?.behavior;
  const halal      = data?.halal;

  const halalCfg   = HALAL_CFG[halal?.screen?.status ?? 'NEEDS_REVIEW'];
  const HalalIcon  = halalCfg?.icon;

  const userVerdict = halal?.user_cert?.user_verdict;
  const verdictCfg  = userVerdict ? VERDICT_CFG[userVerdict] : null;

  const indicatorColor = (signal: string) => {
    if (['bullish','accumulation','strong','oversold','building'].some(s => signal?.includes(s))) return 'text-accent-green';
    if (['overbought','distribution','bearish'].some(s => signal?.includes(s))) return 'text-accent-red';
    return 'text-accent-yellow';
  };

  const changeColor = data?.change >= 0 ? 'text-accent-green' : 'text-accent-red';

  const rr = levels && targets?.target1 && data?.price
    ? ((targets.target1 - data.price) / (data.price - levels.stop_loss)).toFixed(1)
    : null;

  return (
    <div className="space-y-5 page-enter">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp size={20} className="text-accent-green" />
            Stock Intelligence
          </h1>
          <p className="text-secondary text-sm mt-0.5">
            Deep analysis for any US stock · Analyst targets · Indicators · Halal screening
          </p>
        </div>
        {data && (
          <button
            onClick={() => ticker && analyze(ticker)}
            className="btn-secondary flex items-center gap-1.5"
            disabled={loading}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        )}
      </div>

      {/* ── Search ── */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value.toUpperCase())}
            placeholder="Search any US stock ticker (e.g. NVDA)"
            className="input w-full pl-9 font-mono"
            autoComplete="off"
          />
        </div>
        <button type="submit" className="btn-primary" disabled={loading || !query.trim()}>
          Analyse
        </button>
      </form>

      {/* ── Quick access + Size filter ── */}
      <div className="flex flex-wrap items-center gap-3">

        {/* Portfolio dropdown */}
        {portfolioList.length > 0 && (
          <div className="relative">
            <button
              onClick={() => { setShowPortfolio(o => !o); setShowWatchlist(false); }}
              className="btn-secondary flex items-center gap-1.5 text-xs"
            >
              My Portfolio ({portfolioList.length})
              <ChevronDown size={11} />
            </button>
            {showPortfolio && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowPortfolio(false)} />
                <div className="absolute z-20 top-9 left-0 bg-surface-2 border border-border rounded-xl p-2 min-w-36 shadow-xl flex flex-wrap gap-1">
                  {portfolioList.map(t => (
                    <button
                      key={t}
                      onClick={() => { analyze(t); setShowPortfolio(false); }}
                      className="text-[11px] font-mono font-bold px-2 py-1 rounded-lg bg-surface-3 text-accent-green hover:bg-surface-4 transition-colors"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Watchlist dropdown */}
        {watchlistList.length > 0 && (
          <div className="relative">
            <button
              onClick={() => { setShowWatchlist(o => !o); setShowPortfolio(false); }}
              className="btn-secondary flex items-center gap-1.5 text-xs"
            >
              My Watchlist ({watchlistList.length})
              <ChevronDown size={11} />
            </button>
            {showWatchlist && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowWatchlist(false)} />
                <div className="absolute z-20 top-9 left-0 bg-surface-2 border border-border rounded-xl p-2 min-w-36 shadow-xl flex flex-wrap gap-1">
                  {watchlistList.map(t => (
                    <button
                      key={t}
                      onClick={() => { analyze(t); setShowWatchlist(false); }}
                      className="text-[11px] font-mono font-bold px-2 py-1 rounded-lg bg-surface-3 text-accent-green hover:bg-surface-4 transition-colors"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Size filter */}
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-[10px] text-muted mr-1">Size:</span>
          {(['all','small','medium','large','big'] as SizeTier[]).map(tier => (
            <button
              key={tier}
              onClick={() => setSizeTier(tier)}
              className={`text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border transition-all capitalize ${
                sizeTier === tier
                  ? 'bg-accent-green/10 text-accent-green border-accent-green/30'
                  : 'text-muted border-border hover:text-white'
              }`}
            >
              {tier === 'all' ? 'All' : tier === 'small' ? '<$25' : tier === 'medium' ? '$26-100' : tier === 'large' ? '$101-200' : '$200+'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex flex-col items-center py-20 gap-3">
          <Loader2 size={22} className="animate-spin text-accent-green" />
          <p className="text-xs text-secondary">Analysing {ticker}…</p>
        </div>
      )}

      {/* ── Error ── */}
      {error && !loading && (
        <div className="card border border-accent-red/20 bg-accent-red/5 p-4 text-sm text-accent-red">
          {error}
        </div>
      )}

      {/* ── Intelligence Panel ── */}
      {data && !loading && (
        <div className="space-y-4">

          {/* Stock header */}
          <div className="card p-4">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-white font-mono">{data.ticker}</h2>
                  <span className="text-sm text-secondary">{data.name}</span>
                  <span className="badge badge-neutral capitalize">{data.sector}</span>
                  <span className={`badge ${data.price_tier === 'small' ? 'badge-purple' : data.price_tier === 'medium' ? 'badge-blue' : data.price_tier === 'large' ? 'badge-green' : 'badge-yellow'} capitalize`}>
                    {data.price_tier}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-3xl font-bold text-white font-mono">${data.price?.toFixed(2)}</span>
                  <span className={`flex items-center gap-1 text-sm font-semibold ${changeColor}`}>
                    {data.change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {data.change >= 0 ? '+' : ''}{data.change?.toFixed(2)} ({data.change_percent >= 0 ? '+' : ''}{data.change_percent?.toFixed(2)}%)
                  </span>
                </div>
              </div>

              {/* Halal badge */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
                halal?.screen?.status === 'HALAL' ? 'bg-accent-green/10 border-accent-green/25' :
                halal?.screen?.status === 'NOT_HALAL' ? 'bg-accent-red/10 border-accent-red/25' :
                'bg-accent-yellow/10 border-accent-yellow/25'
              }`}>
                {HalalIcon && <HalalIcon size={16} className={halalCfg.color} />}
                <div>
                  <p className={`text-sm font-bold ${halalCfg.color}`}>{halalCfg.label}</p>
                  <p className="text-[9px] text-muted">Auto-screened · {halal?.total_certs ?? 0} user cert{halal?.total_certs !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </div>

            {/* User certification */}
            <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-muted">Your verdict:</span>
              {certLoading ? <Loader2 size={12} className="animate-spin text-muted" /> : (
                (['halal','haram','doubtful'] as const).map(v => {
                  const cfg = VERDICT_CFG[v];
                  const Icon = cfg.icon;
                  const isActive = userVerdict === v;
                  return (
                    <button
                      key={v}
                      onClick={() => certify(v)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                        isActive ? `${cfg.color} border-current/30 bg-current/10` : 'text-muted border-border hover:text-white bg-surface-2'
                      }`}
                    >
                      <Icon size={11} /> {isActive ? `✓ ${cfg.label}` : cfg.label}
                    </button>
                  );
                })
              )}
              {userVerdict && (
                <span className="text-[10px] text-muted">
                  Your personal verdict: <span className={verdictCfg?.color}>{verdictCfg?.label}</span>
                </span>
              )}
            </div>
          </div>

          {/* Analyst Targets + Behavioral Profile */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Analyst Targets */}
            <div className="card p-4">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-1.5">
                🎯 Analyst Price Targets
              </h3>
              {targets?.consensus ? (
                <>
                  <div className="space-y-2 mb-3">
                    {[
                      { label: 'Consensus',  value: targets.consensus, highlight: true  },
                      { label: 'Median',     value: targets.median,    highlight: false },
                      { label: 'High (bull)',value: targets.high,      highlight: false },
                      { label: 'Low (bear)', value: targets.low,       highlight: false },
                    ].map(row => (
                      <div key={row.label} className={`flex items-center justify-between py-1.5 px-2 rounded-lg ${row.highlight ? 'bg-accent-green/10' : ''}`}>
                        <span className="text-xs text-secondary">{row.label}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-mono font-bold ${row.highlight ? 'text-accent-green' : 'text-white'}`}>
                            ${row.value?.toFixed(2)}
                          </span>
                          {row.highlight && targets.upside_pct != null && (
                            <span className={`text-[10px] font-bold ${targets.upside_pct >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                              {targets.upside_pct >= 0 ? '+' : ''}{targets.upside_pct}%
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Buy/Hold/Sell bar */}
                  {targets.total > 0 && (
                    <div>
                      <div className="flex overflow-hidden rounded-lg h-2 mb-1">
                        <div className="bg-accent-green" style={{ width: `${(targets.buy/targets.total)*100}%` }} />
                        <div className="bg-accent-yellow" style={{ width: `${(targets.hold/targets.total)*100}%` }} />
                        <div className="bg-accent-red" style={{ width: `${(targets.sell/targets.total)*100}%` }} />
                      </div>
                      <div className="flex justify-between text-[9px]">
                        <span className="text-accent-green">{targets.buy} Buy</span>
                        <span className="text-accent-yellow">{targets.hold} Hold</span>
                        <span className="text-accent-red">{targets.sell} Sell</span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted">No analyst targets available for this ticker.</p>
              )}
            </div>

            {/* Behavioral Profile */}
            <div className="card p-4">
              <h3 className="text-sm font-bold text-white mb-3">
                📊 Behavioral Profile
              </h3>
              <div className="space-y-2">
                {[
                  {
                    label: 'Beta', tipId: 'beta',
                    value: `${behavior?.beta}×`,
                    note:  behavior?.beta > 2 ? 'High — amplifies market 2×+' : behavior?.beta > 1.3 ? 'Moderate-high amplification' : 'Close to market movement',
                    color: behavior?.beta > 2 ? 'text-accent-red' : behavior?.beta > 1.3 ? 'text-accent-yellow' : 'text-accent-green',
                  },
                  {
                    label: 'Avg Daily Move', tipId: 'beta',
                    value: `±${behavior?.avg_daily_move}%`,
                    note:  'Average absolute daily change (30-day)',
                    color: behavior?.avg_daily_move > 3 ? 'text-accent-red' : 'text-accent-yellow',
                  },
                  {
                    label: 'Price Tier', tipId: 'beta',
                    value: data.price_tier?.charAt(0).toUpperCase() + data.price_tier?.slice(1),
                    note:  `$${data.price?.toFixed(0)} — ${data.price_tier === 'small' ? 'under $25' : data.price_tier === 'medium' ? '$26–$100' : data.price_tier === 'large' ? '$101–$200' : '$200+'}`,
                    color: 'text-white',
                  },
                  {
                    label: 'Trend', tipId: 'ema',
                    value: indicators?.trend?.charAt(0).toUpperCase() + indicators?.trend?.slice(1),
                    note:  `EMA-20: $${indicators?.ema20} · EMA-50: $${indicators?.ema50}`,
                    color: indicators?.trend === 'bullish' ? 'text-accent-green' : indicators?.trend === 'bearish' ? 'text-accent-red' : 'text-accent-yellow',
                  },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between py-1.5">
                    <div>
                      <span className="text-xs text-secondary">{row.label}<Tooltip id={row.tipId} /></span>
                      <p className="text-[9px] text-muted">{row.note}</p>
                    </div>
                    <span className={`text-sm font-mono font-bold ${row.color}`}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Support & Resistance Map */}
          {levels && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  📐 Support & Resistance<Tooltip id="sr" />
                </h3>
                <button
                  onClick={() => setExpandLevels(o => !o)}
                  className="text-[10px] text-muted hover:text-white flex items-center gap-1"
                >
                  {expandLevels ? 'Less' : 'More levels'}
                  {expandLevels ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                </button>
              </div>

              {/* Visual S&R bar */}
              <div className="space-y-1.5 mb-4">
                {[
                  { label: 'R2', value: levels.r2,    type: 'resistance', strong: false },
                  { label: 'R1', value: levels.r1,    type: 'resistance', strong: true  },
                  { label: '▶', value: data.price,    type: 'current',    strong: false },
                  { label: 'S1', value: levels.s1,    type: 'support',    strong: true  },
                  { label: 'S2', value: levels.s2,    type: 'support',    strong: false },
                ].map(row => (
                  <div key={row.label} className={`flex items-center gap-2 py-1 px-2 rounded-lg ${
                    row.type === 'current'   ? 'bg-accent-green/10 border border-accent-green/30' :
                    row.type === 'resistance'? 'border-l-2 border-accent-red/50'   :
                                              'border-l-2 border-accent-green/50'
                  }`}>
                    <span className={`text-[10px] font-bold w-5 ${
                      row.type === 'current'    ? 'text-accent-green' :
                      row.type === 'resistance' ? 'text-accent-red'   : 'text-accent-green'
                    }`}>{row.label}</span>
                    <span className="text-xs font-mono text-white font-bold">${row.value?.toFixed(2)}</span>
                    <span className="text-[9px] text-muted capitalize">{
                      row.type === 'current' ? 'Current price' :
                      row.type === 'resistance' ? (row.strong ? 'Nearest resistance' : 'Major resistance') :
                      (row.strong ? 'First support' : 'Key support')
                    }</span>
                  </div>
                ))}
              </div>

              {/* Fibonacci levels */}
              <div className="mb-4">
                <p className="text-[10px] text-muted uppercase tracking-wide mb-2 flex items-center gap-1">
                  Fibonacci Levels<Tooltip id="fib" />
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: '23.6%', value: levels.fib_236 },
                    { label: '38.2%', value: levels.fib_382 },
                    { label: '50.0%', value: levels.fib_500 },
                    { label: '61.8%', value: levels.fib_618 },
                  ].map(f => (
                    <div key={f.label} className="text-center bg-surface-2 rounded-lg px-3 py-2 border border-border">
                      <p className="text-[9px] text-accent-yellow font-bold">{f.label}</p>
                      <p className="text-xs font-mono text-white">${f.value?.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trade zones */}
              <div className="grid grid-cols-3 gap-2 mb-2">
                {[
                  { label: 'Entry Zone',   value: `$${levels.entry_lo}–${levels.entry_hi}`, color: 'text-accent-green'  },
                  { label: 'Stop Loss',    value: `$${levels.stop_loss}`,                   color: 'text-accent-red'    },
                  { label: `R:R${rr ? ` ~1:${rr}` : ''}`, value: `TP1 $${levels.target1}`, color: 'text-accent-yellow' },
                ].map(t => (
                  <div key={t.label} className="bg-surface-2 rounded-xl p-2 border border-border text-center">
                    <p className="text-[9px] text-muted flex items-center justify-center gap-1">
                      {t.label}<Tooltip id="rr" />
                    </p>
                    <p className={`text-xs font-mono font-bold ${t.color}`}>{t.value}</p>
                  </div>
                ))}
              </div>

              {/* Pivot points (expandable) */}
              {expandLevels && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-[10px] text-muted uppercase tracking-wide mb-2 flex items-center gap-1">
                    Pivot Points<Tooltip id="pivot" />
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'S3', value: levels.s3 },
                      { label: 'S2', value: levels.s2 },
                      { label: 'S1', value: levels.s1 },
                      { label: 'PP', value: levels.pivot },
                      { label: 'R1', value: levels.r1 },
                      { label: 'R2', value: levels.r2 },
                      { label: 'R3', value: levels.r3 },
                    ].map(p => (
                      <div key={p.label} className={`text-center rounded-lg px-2.5 py-1.5 border ${
                        p.label === 'PP' ? 'bg-surface-3 border-accent-green/30 text-accent-green' :
                        p.label.startsWith('R') ? 'bg-surface-2 border-accent-red/20 text-accent-red' :
                        'bg-surface-2 border-accent-green/20 text-accent-green'
                      }`}>
                        <p className="text-[9px] font-bold">{p.label}</p>
                        <p className="text-xs font-mono">${p.value?.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Indicator Dashboard */}
          {indicators && (
            <div className="card p-4">
              <h3 className="text-sm font-bold text-white mb-3">
                📈 Indicator Dashboard
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                <IndicatorRow
                  label="RSI (14)" tipId="rsi"
                  value={`${indicators.rsi}`}
                  signal={indicators.rsi_signal?.replace('_',' ')}
                  color={indicatorColor(indicators.rsi_signal)}
                />
                <IndicatorRow
                  label="MACD" tipId="macd"
                  value={indicators.macd?.histogram > 0 ? `+${indicators.macd.histogram.toFixed(3)}` : indicators.macd?.histogram?.toFixed(3)}
                  signal={indicators.macd?.bullish ? 'Bullish ▲' : 'Bearish ▼'}
                  color={indicators.macd?.bullish ? 'text-accent-green' : 'text-accent-red'}
                />
                <IndicatorRow
                  label="Volume" tipId="volume"
                  value={`${indicators.volume_ratio}× avg`}
                  signal={indicators.volume_ratio >= 2 ? 'Strong' : indicators.volume_ratio >= 1.3 ? 'Confirmed' : 'Low'}
                  color={indicators.volume_ratio >= 1.3 ? 'text-accent-green' : 'text-accent-red'}
                />
                <IndicatorRow
                  label="ATR (14)" tipId="atr"
                  value={`$${indicators.atr?.toFixed(2)}`}
                  signal={`${indicators.atr_pct}% of price`}
                  color="text-muted"
                />
                <IndicatorRow
                  label="VWAP" tipId="vwap"
                  value={`$${indicators.vwap}`}
                  signal={data.price > indicators.vwap ? '▲ Above' : '▼ Below'}
                  color={data.price > indicators.vwap ? 'text-accent-green' : 'text-accent-red'}
                />
                <IndicatorRow
                  label="OBV" tipId="obv"
                  value={indicators.obv_trend?.charAt(0).toUpperCase() + indicators.obv_trend?.slice(1)}
                  signal={indicators.obv_trend === 'accumulation' ? 'Smart $ buying' : indicators.obv_trend === 'distribution' ? 'Selling pressure' : 'Neutral'}
                  color={indicatorColor(indicators.obv_trend)}
                />
                <IndicatorRow
                  label="ADX" tipId="adx"
                  value={`${indicators.adx}`}
                  signal={indicators.adx_strength?.replace('_',' ')}
                  color={indicators.adx > 30 ? 'text-accent-green' : indicators.adx > 20 ? 'text-accent-yellow' : 'text-muted'}
                />
                <IndicatorRow
                  label="Stochastic" tipId="stoch"
                  value={`%K ${indicators.stoch_k}`}
                  signal={indicators.stoch_signal}
                  color={indicatorColor(indicators.stoch_signal)}
                />
              </div>

              {/* EMA context */}
              <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-3 text-[10px]">
                <span className="text-muted">EMA-20:<Tooltip id="ema" /></span>
                <span className={data.price > indicators.ema20 ? 'text-accent-green' : 'text-accent-red'}>
                  ${indicators.ema20} {data.price > indicators.ema20 ? '✓ above' : '✗ below'}
                </span>
                <span className="text-muted">EMA-50:</span>
                <span className={data.price > indicators.ema50 ? 'text-accent-green' : 'text-accent-red'}>
                  ${indicators.ema50} {data.price > indicators.ema50 ? '✓ above' : '✗ below'}
                </span>
              </div>
            </div>
          )}

          {/* Why It's Moving */}
          {data.narrative && (
            <div className="card p-4 border border-accent-green/15">
              <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
                <Brain size={14} className="text-accent-green" />
                Why Is {data.ticker} Moving?
              </h3>
              <p className="text-sm text-secondary leading-relaxed">{data.narrative}</p>
              <p className="text-[9px] text-muted mt-2">
                AI analysis · {new Date(data.generated_at).toLocaleTimeString()} · Not financial advice
              </p>
            </div>
          )}

          {/* Musaffa link */}
          <div className="flex items-center justify-between py-2 px-4 bg-surface-2 rounded-xl border border-border">
            <span className="text-xs text-secondary">
              Always verify halal status before investing
            </span>
            <a
              href={`https://musaffa.com/stock/${ticker}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-accent-green hover:underline"
            >
              Check on Musaffa <ExternalLink size={10} />
            </a>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!ticker && !loading && (
        <div className="flex flex-col items-center py-20 text-center">
          <TrendingUp size={36} className="text-muted mb-3" />
          <h2 className="text-base font-semibold text-white mb-1">Search any US stock</h2>
          <p className="text-xs text-secondary max-w-xs">
            Type a ticker above or pick from your portfolio and watchlist for a full intelligence report — analyst targets, indicators, support levels, and halal screening.
          </p>
          <a href="/learn" className="mt-4 flex items-center gap-1.5 text-xs text-accent-green hover:underline">
            <BookOpen size={12} /> Learn what each indicator means →
          </a>
        </div>
      )}
    </div>
  );
}