'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  Search, Loader2, TrendingUp, TrendingDown,
  CheckCircle2, XCircle, AlertCircle, Info, RefreshCw,
  Brain, BookOpen, ChevronDown, ChevronUp, ExternalLink,
  BarChart2,
} from 'lucide-react';

// Lazy-load recharts-based chart to avoid SSR issues
const PriceChart = dynamic(() => import('@/components/charts/PriceChart'), { ssr: false });

// ── Tooltip definitions ───────────────────────────────────────────────────────
const TIPS: Record<string, { title: string; plain: string; read: string; islam?: string }> = {
  rsi:    { title: 'RSI — Relative Strength Index', plain: 'A "fatigue meter" for momentum — measures how fast a stock has moved on a 0–100 scale.', read: '0–30 = oversold (watch for bounce) · 30–50 = neutral · 50–65 = healthy ✓ · 65–78 = elevated · 78–100 = overbought', islam: 'Helps avoid chasing overheated stocks — consistent with measured, non-speculative risk-taking.' },
  macd:   { title: 'MACD — Momentum Indicator', plain: 'Shows whether momentum is accelerating or slowing by comparing two moving averages.', read: 'Bullish = short-term average crossing above long-term. Histogram expanding = signal strengthening.' },
  atr:    { title: 'ATR — Average True Range', plain: 'How much the stock typically moves in a single day — a volatility ruler.', read: 'We use ATR×1.5 for stop-losses and ATR×2 for take-profit targets. Higher ATR = smaller position needed.', islam: 'ATR-based sizing reflects the Islamic principle of not exposing wealth to unnecessary gharar.' },
  volume: { title: 'Volume Ratio', plain: "Today's volume vs the 20-day average. Confirms whether a move has real participation.", read: '<1.0× = low conviction · 1.0–1.3× = normal · 1.3–2.0× = confirmed ✓ · 2.0×+ = strong institutional interest' },
  ema:    { title: 'EMA — Exponential Moving Average', plain: 'A running price average giving more weight to recent days. Identifies trend direction.', read: 'Price above EMA-20 AND EMA-50 = bullish trend ✓ · Below both = bearish · Between them = transitioning' },
  vwap:   { title: 'VWAP — Volume-Weighted Average Price', plain: 'Average price paid weighted by volume. The institutional benchmark.', read: 'Above VWAP = bullish bias · Below = bearish · Often acts as intraday support/resistance' },
  obv:    { title: 'OBV — On-Balance Volume', plain: 'Cumulative volume showing whether money flows in or out. Detects hidden accumulation.', read: 'Accumulation = institutions buying quietly · Distribution = selling building · OBV rising while price flat = potential breakout' },
  adx:    { title: 'ADX — Average Directional Index', plain: 'Measures trend strength — not direction. Is this a real trend or just noise?', read: '<20 = weak/sideways · 20–30 = developing · 30–50 = strong ✓ · 50+ = very strong, watch for exhaustion' },
  stoch:  { title: 'Stochastic Oscillator', plain: 'Compares close to recent high-low range. Faster than RSI at catching short-term reversals.', read: '<20 = oversold (watch for bounce) · 20–80 = neutral · >80 = overbought · %K crossing above %D = buy signal' },
  fib:    { title: 'Fibonacci Retracement', plain: 'Key support/resistance levels used globally by institutional desks.', read: '23.6% = shallow pullback · 38.2% = normal correction · 50% = midpoint · 61.8% = golden ratio ✓ strongest' },
  pivot:  { title: 'Pivot Points', plain: "Daily support/resistance from yesterday's high, low, close.", read: 'PP = fair value · R1/R2 = resistance above · S1/S2 = support below' },
  sr:     { title: 'Support & Resistance', plain: 'Price levels where buying or selling has concentrated historically.', read: 'More times a level is tested → stronger it becomes. Broken resistance becomes new support.' },
  beta:   { title: 'Beta', plain: 'How much a stock amplifies market moves. Beta 2.0 = moves twice as much as the S&P.', read: '<1 = defensive · ~1 = tracks market · 1.5–2.5 = amplified · >2.5 = high risk' },
  rr:     { title: 'Risk:Reward Ratio', plain: 'How much you stand to gain vs how much you risk on a trade.', read: '<1:1 = avoid · 1:1.5–2 = acceptable · 1:2–3 = good ✓ · >1:3 = excellent' },
};

// ── Gauge bar component ───────────────────────────────────────────────────────
interface GaugeZone { from: number; to: number; hex: string; alpha: number }

function GaugeMeter({ label, value, tipId, min, max, zones, thresholds, format = String }: {
  label: string; value: number; tipId: string; min: number; max: number;
  zones: GaugeZone[]; thresholds: { v: number; label: string }[];
  format?: (v: number) => string;
}) {
  const clamp = Math.min(max, Math.max(min, value));
  const pct   = ((clamp - min) / (max - min)) * 100;
  const zone  = zones.find(z => clamp >= z.from && clamp <= z.to) ?? zones[zones.length - 1];
  return (
    <div className="bg-surface-2 rounded-xl p-3 border border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-muted uppercase tracking-wide font-semibold">
          {label}<Tooltip id={tipId} />
        </span>
        <span className="text-sm font-mono font-bold" style={{ color: zone.hex }}>
          {format(value)}
        </span>
      </div>
      <div className="relative h-3 rounded-full overflow-hidden bg-surface-3">
        {zones.map((z, i) => (
          <div key={i} className="absolute top-0 h-full"
            style={{ left: `${((z.from-min)/(max-min))*100}%`, width: `${((z.to-z.from)/(max-min))*100}%`, backgroundColor: z.hex, opacity: z.alpha }} />
        ))}
        <div className="absolute top-0 h-full w-0.5 z-10"
          style={{ left: `${pct}%`, backgroundColor: 'rgba(255,255,255,0.9)', transform: 'translateX(-50%)' }} />
      </div>
      <div className="relative mt-1 h-3">
        {thresholds.map((t, i) => (
          <span key={i} className="absolute text-[8px] text-muted"
            style={{ left: `${((t.v-min)/(max-min))*100}%`, transform: 'translateX(-50%)' }}>
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}

const RSI_ZONES:  GaugeZone[] = [
  { from:0,  to:30,  hex:'#3b82f6', alpha:0.7 },
  { from:30, to:50,  hex:'#eab308', alpha:0.6 },
  { from:50, to:65,  hex:'#10b981', alpha:0.8 },
  { from:65, to:78,  hex:'#eab308', alpha:0.6 },
  { from:78, to:100, hex:'#ef4444', alpha:0.7 },
];
const STOCH_ZONES: GaugeZone[] = [
  { from:0,  to:20,  hex:'#3b82f6', alpha:0.7 },
  { from:20, to:80,  hex:'#10b981', alpha:0.6 },
  { from:80, to:100, hex:'#ef4444', alpha:0.7 },
];
const ADX_ZONES:  GaugeZone[] = [
  { from:0,  to:20, hex:'#ef4444', alpha:0.6 },
  { from:20, to:30, hex:'#eab308', alpha:0.6 },
  { from:30, to:50, hex:'#10b981', alpha:0.8 },
  { from:50, to:60, hex:'#eab308', alpha:0.6 },
];
const VOL_ZONES:  GaugeZone[] = [
  { from:0,   to:1.0, hex:'#ef4444', alpha:0.6 },
  { from:1.0, to:1.3, hex:'#eab308', alpha:0.6 },
  { from:1.3, to:2.0, hex:'#10b981', alpha:0.7 },
  { from:2.0, to:3.0, hex:'#10b981', alpha:1.0 },
];

// ── Tooltip popup ─────────────────────────────────────────────────────────────
function Tooltip({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const tip = TIPS[id];
  if (!tip) return null;
  return (
    <div className="relative inline-block">
      <button onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className="text-muted hover:text-accent-green transition-colors ml-1 align-middle">
        <Info size={11} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 left-0 top-5 w-64 bg-surface-2 border border-border rounded-xl p-3 shadow-xl">
            <p className="text-[11px] font-bold text-white mb-1">{tip.title}</p>
            <p className="text-[10px] text-secondary mb-1 leading-relaxed">{tip.plain}</p>
            <p className="text-[10px] text-muted leading-relaxed border-t border-border pt-1">{tip.read}</p>
            {tip.islam && <p className="text-[10px] text-accent-green mt-1 pt-1 border-t border-border leading-relaxed">🕌 {tip.islam}</p>}
          </div>
        </>
      )}
    </div>
  );
}

function IndicatorRow({ label, value, signal, tipId, color }: {
  label: string; value: string; signal: string; tipId: string; color: string;
}) {
  return (
    <div className="bg-surface-2 rounded-xl p-3 border border-border">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] text-muted uppercase tracking-wide font-semibold">{label}<Tooltip id={tipId} /></span>
        <span className={`text-[10px] font-semibold ${color}`}>{signal}</span>
      </div>
      <p className="text-sm font-mono font-bold text-white">{value}</p>
    </div>
  );
}

const HALAL_CFG: Record<string, { label: string; color: string; icon: any }> = {
  HALAL:        { label: 'Halal',        color: 'text-accent-green',  icon: CheckCircle2 },
  DOUBTFUL:     { label: 'Doubtful',     color: 'text-accent-yellow', icon: AlertCircle  },
  NEEDS_REVIEW: { label: 'Needs Review', color: 'text-accent-yellow', icon: AlertCircle  },
  NOT_HALAL:    { label: 'Not Halal',    color: 'text-accent-red',    icon: XCircle      },
};
const VERDICT_CFG: Record<string, { label: string; color: string; icon: any }> = {
  halal:    { label: 'Halal',    color: 'text-accent-green',  icon: CheckCircle2 },
  haram:    { label: 'Haram',    color: 'text-accent-red',    icon: XCircle      },
  doubtful: { label: 'Doubtful', color: 'text-accent-yellow', icon: AlertCircle  },
};

// ── Main page ─────────────────────────────────────────────────────────────────
export default function StockIntelligencePage() {
  const [query,         setQuery]         = useState('');
  const [suggestions,   setSuggestions]   = useState<any[]>([]);
  const [showSuggest,   setShowSuggest]   = useState(false);
  const [suggestLoading,setSuggestLoading]= useState(false);
  const [ticker,        setTicker]        = useState<string | null>(null);
  const [data,          setData]          = useState<any>(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [portfolioList, setPortfolioList] = useState<string[]>([]);
  const [watchlistList, setWatchlistList] = useState<string[]>([]);
  const [showPortfolio, setShowPortfolio] = useState(false);
  const [showWatchlist, setShowWatchlist] = useState(false);
  const [certLoading,   setCertLoading]   = useState(false);
  const [expandLevels,  setExpandLevels]  = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const [pr, wr] = await Promise.all([fetch('/api/portfolio'), fetch('/api/watchlist')]);
      const [pd, wd] = await Promise.all([pr.json(), wr.json()]);
      setPortfolioList((pd.holdings ?? []).map((h: any) => h.ticker));
      setWatchlistList((wd.watchlist ?? []).map((w: any) => w.ticker));
    }
    load();
  }, []);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSuggest(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  function handleQueryChange(val: string) {
    const upper = val.toUpperCase();
    setQuery(upper);
    setShowSuggest(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (upper.length < 1) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSuggestLoading(true);
      try {
        const res  = await fetch(`/api/stocks/search?q=${encodeURIComponent(upper)}`);
        const json = await res.json();
        setSuggestions(json.results ?? []);
        setShowSuggest((json.results ?? []).length > 0);
      } catch { setSuggestions([]); }
      finally  { setSuggestLoading(false); }
    }, 280);
  }

  const analyze = useCallback(async (t: string) => {
    const clean = t.toUpperCase().trim();
    if (!clean) return;
    setTicker(clean);
    setQuery(clean);
    setShowSuggest(false);
    setSuggestions([]);
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res  = await fetch(`/api/stock-intelligence/${clean}`);
      const json = await res.json();
      if (json.error) { setError(json.error); return; }
      setData(json);
    } catch { setError('Failed to load data. Please try again.'); }
    finally   { setLoading(false); }
  }, []);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); if (query.trim()) analyze(query.trim()); };

  async function certify(verdict: 'halal'|'haram'|'doubtful') {
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

  const ind         = data?.indicators;
  const levels      = data?.levels;
  const targets     = data?.targets;
  const halal       = data?.halal;
  const halalCfg    = HALAL_CFG[halal?.screen?.status ?? 'NEEDS_REVIEW'];
  const HalalIcon   = halalCfg?.icon;
  const userVerdict = halal?.user_cert?.user_verdict;
  const verdictCfg  = userVerdict ? VERDICT_CFG[userVerdict] : null;
  const changePos   = (data?.change ?? 0) >= 0;
  const rr          = levels?.target1 && data?.price && levels?.stop_loss && data.price > levels.stop_loss
    ? ((levels.target1 - data.price) / (data.price - levels.stop_loss)).toFixed(1) : null;

  function sigColor(signal: string) {
    if (['bullish','accumulation','strong','oversold','building'].some(s => signal?.includes(s))) return 'text-accent-green';
    if (['overbought','distribution','bearish'].some(s => signal?.includes(s))) return 'text-accent-red';
    return 'text-accent-yellow';
  }

  return (
    <div className="space-y-5 page-enter">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp size={20} className="text-accent-green" />
            Stock Intelligence
          </h1>
          <p className="text-secondary text-sm mt-0.5">
            Deep analysis for any US stock · Chart · Indicators · Targets · Halal
          </p>
        </div>
        {data && (
          <button onClick={() => ticker && analyze(ticker)} disabled={loading}
            className="btn-secondary flex items-center gap-1.5">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        )}
      </div>

      {/* Search with autocomplete */}
      <div ref={searchRef} className="relative">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            {suggestLoading && (
              <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted animate-spin" />
            )}
            <input
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggest(true)}
              placeholder="Search any US stock — NVDA, AAPL, RKLB…"
              className="input w-full pl-9 pr-8 font-mono"
              autoComplete="off" spellCheck={false}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading || !query.trim()}>
            Analyse
          </button>
        </form>

        {showSuggest && suggestions.length > 0 && (
          <div className="absolute top-11 left-0 w-full max-w-md bg-surface-2 border border-border rounded-xl shadow-xl z-50 overflow-hidden">
            {suggestions.slice(0, 7).map((s: any) => (
              <button key={s.ticker} onClick={() => analyze(s.ticker)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-3 transition-colors text-left">
                <span className="text-sm font-mono font-bold text-accent-green w-16 shrink-0">{s.ticker}</span>
                <span className="text-xs text-secondary truncate">{s.name}</span>
                {s.type && <span className="text-[9px] text-muted ml-auto shrink-0">{s.type}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick access */}
      <div className="flex flex-wrap items-center gap-2">
        {portfolioList.length > 0 && (
          <div className="relative">
            <button onClick={() => { setShowPortfolio(o => !o); setShowWatchlist(false); }}
              className="btn-secondary flex items-center gap-1.5 text-xs">
              My Portfolio ({portfolioList.length}) <ChevronDown size={11} />
            </button>
            {showPortfolio && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowPortfolio(false)} />
                <div className="absolute z-20 top-9 left-0 bg-surface-2 border border-border rounded-xl p-2 min-w-36 shadow-xl flex flex-wrap gap-1">
                  {portfolioList.map(t => (
                    <button key={t} onClick={() => { analyze(t); setShowPortfolio(false); }}
                      className="text-[11px] font-mono font-bold px-2 py-1 rounded-lg bg-surface-3 text-accent-green hover:bg-surface-4">
                      {t}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {watchlistList.length > 0 && (
          <div className="relative">
            <button onClick={() => { setShowWatchlist(o => !o); setShowPortfolio(false); }}
              className="btn-secondary flex items-center gap-1.5 text-xs">
              My Watchlist ({watchlistList.length}) <ChevronDown size={11} />
            </button>
            {showWatchlist && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowWatchlist(false)} />
                <div className="absolute z-20 top-9 left-0 bg-surface-2 border border-border rounded-xl p-2 min-w-36 shadow-xl flex flex-wrap gap-1">
                  {watchlistList.map(t => (
                    <button key={t} onClick={() => { analyze(t); setShowWatchlist(false); }}
                      className="text-[11px] font-mono font-bold px-2 py-1 rounded-lg bg-surface-3 text-accent-green hover:bg-surface-4">
                      {t}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center py-20 gap-3">
          <Loader2 size={22} className="animate-spin text-accent-green" />
          <p className="text-xs text-secondary">Analysing {ticker}…</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="card border border-accent-red/20 bg-accent-red/5 p-4 text-sm text-accent-red">{error}</div>
      )}

      {/* Intelligence panel */}
      {data && !loading && (
        <div className="space-y-4">

          {/* ── Stock header ── */}
          <div className="card p-4">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-white font-mono">{data.ticker}</h2>
                  <span className="text-sm text-secondary">{data.name}</span>
                  <span className="badge badge-neutral capitalize">{data.sector}</span>
                  <span className={`badge capitalize ${
                    data.price_tier === 'small' ? 'badge-purple' :
                    data.price_tier === 'medium' ? 'badge-blue' :
                    data.price_tier === 'large' ? 'badge-green' : 'badge-yellow'
                  }`}>{data.price_tier}</span>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-3xl font-bold text-white font-mono">${data.price?.toFixed(2)}</span>
                  <span className={`flex items-center gap-1 text-sm font-semibold ${changePos ? 'text-accent-green' : 'text-accent-red'}`}>
                    {changePos ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {changePos ? '+' : ''}{data.change?.toFixed(2)} ({changePos ? '+' : ''}{data.change_percent?.toFixed(2)}%)
                  </span>
                </div>
              </div>

              {/* Halal badge */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
                halal?.screen?.status === 'HALAL'     ? 'bg-accent-green/10 border-accent-green/25' :
                halal?.screen?.status === 'NOT_HALAL' ? 'bg-accent-red/10 border-accent-red/25' :
                'bg-accent-yellow/10 border-accent-yellow/25'
              }`}>
                {HalalIcon && <HalalIcon size={16} className={halalCfg.color} />}
                <div>
                  <p className={`text-sm font-bold ${halalCfg.color}`}>{halalCfg.label}</p>
                  <p className="text-[9px] text-muted">Auto-screened · {halal?.total_certs ?? 0} cert{halal?.total_certs !== 1 ? 's' : ''}</p>
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
                  const active = userVerdict === v;
                  return (
                    <button key={v} onClick={() => certify(v)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                        active ? `${cfg.color} border-current/30 bg-current/10` : 'text-muted border-border hover:text-white bg-surface-2'
                      }`}>
                      <Icon size={11} /> {active ? `✓ ${cfg.label}` : cfg.label}
                    </button>
                  );
                })
              )}
              {userVerdict && verdictCfg && (
                <span className={`text-[10px] ${verdictCfg.color}`}>Your verdict: {verdictCfg.label}</span>
              )}
            </div>
          </div>

          {/* ── Price chart ── */}
          {data.chart_data?.length > 0 && (
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart2 size={14} className="text-accent-green" />
                <h3 className="text-sm font-bold text-white">{data.ticker} — Price Chart</h3>
                {ind && (
                  <div className="ml-auto flex items-center gap-3 text-[10px]">
                    <span className={ind.trend === 'bullish' ? 'text-accent-green' : ind.trend === 'bearish' ? 'text-accent-red' : 'text-muted'}>
                      {ind.trend === 'bullish' ? '▲ Uptrend' : ind.trend === 'bearish' ? '▼ Downtrend' : '→ Neutral'}
                    </span>
                    <span className="text-muted">EMA-20: <span className={data.price > ind.ema20 ? 'text-accent-green' : 'text-accent-red'}>${ind.ema20}</span></span>
                    <span className="text-muted">EMA-50: <span className={data.price > ind.ema50 ? 'text-accent-green' : 'text-accent-red'}>${ind.ema50}</span></span>
                  </div>
                )}
              </div>
              <PriceChart
                ticker={data.ticker}
                initialData={data.chart_data}
                currentPrice={data.price}
              />
            </div>
          )}

          {/* No chart data notice */}
          {!data.candles_available && (
            <div className="card border border-accent-yellow/20 bg-accent-yellow/5 p-3">
              <p className="text-xs text-accent-yellow">
                ⚠️ Full chart and indicator analysis is available for major US stocks. Basic data shown for this ticker.
                Verify on <a href={`https://musaffa.com/stock/${data.ticker}`} target="_blank" rel="noopener noreferrer" className="underline">Musaffa</a>.
              </p>
            </div>
          )}

          {/* ── Analyst targets + Behavioral profile ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div className="card p-4">
              <h3 className="text-sm font-bold text-white mb-3">🎯 Analyst Price Targets</h3>
              {targets?.consensus ? (
                <>
                  <div className="space-y-1.5 mb-3">
                    {[
                      { label:'Consensus', value: targets.consensus, hi: true  },
                      { label:'Median',    value: targets.median,    hi: false },
                      { label:'High (bull)',value: targets.high,     hi: false },
                      { label:'Low (bear)', value: targets.low,      hi: false },
                    ].map(row => (
                      <div key={row.label} className={`flex items-center justify-between py-1.5 px-2 rounded-lg ${row.hi ? 'bg-accent-green/10' : ''}`}>
                        <span className="text-xs text-secondary">{row.label}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-mono font-bold ${row.hi ? 'text-accent-green' : 'text-white'}`}>${row.value?.toFixed(2)}</span>
                          {row.hi && targets.upside_pct != null && (
                            <span className={`text-[10px] font-bold ${targets.upside_pct >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                              {targets.upside_pct >= 0 ? '+' : ''}{targets.upside_pct}%
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {targets.total > 0 && (
                    <div>
                      <div className="flex overflow-hidden rounded-lg h-2 mb-1">
                        <div className="bg-accent-green" style={{ width:`${(targets.buy/targets.total)*100}%` }} />
                        <div className="bg-accent-yellow" style={{ width:`${(targets.hold/targets.total)*100}%` }} />
                        <div className="bg-accent-red" style={{ width:`${(targets.sell/targets.total)*100}%` }} />
                      </div>
                      <div className="flex justify-between text-[9px]">
                        <span className="text-accent-green">{targets.buy} Buy</span>
                        <span className="text-accent-yellow">{targets.hold} Hold</span>
                        <span className="text-accent-red">{targets.sell} Sell</span>
                      </div>
                    </div>
                  )}
                </>
              ) : <p className="text-xs text-muted">No analyst targets available.</p>}
            </div>

            <div className="card p-4">
              <h3 className="text-sm font-bold text-white mb-3">📊 Behavioral Profile</h3>
              <div className="space-y-2">
                {[
                  { label:'Beta', tipId:'beta', value:`${data.behavior?.beta}×`,
                    note: data.behavior?.beta > 2 ? 'High — amplifies market 2×+' : data.behavior?.beta > 1.3 ? 'Moderate-high amplification' : 'Close to market movement',
                    color: data.behavior?.beta > 2 ? 'text-accent-red' : data.behavior?.beta > 1.3 ? 'text-accent-yellow' : 'text-accent-green' },
                  { label:'Avg Daily Move', tipId:'beta', value:`±${data.behavior?.avg_daily_move ?? 0}%`,
                    note:'Average absolute daily change (30-day)',
                    color: (data.behavior?.avg_daily_move ?? 0) > 3 ? 'text-accent-red' : 'text-accent-yellow' },
                  { label:'Price Tier', tipId:'beta',
                    value: data.price_tier?.charAt(0).toUpperCase() + data.price_tier?.slice(1),
                    note:`$${data.price?.toFixed(0)} — ${data.price_tier === 'small' ? '<$25' : data.price_tier === 'medium' ? '$26–$100' : data.price_tier === 'large' ? '$101–$200' : '$200+'}`,
                    color:'text-white' },
                  ...(ind ? [{ label:'Trend', tipId:'ema',
                    value: ind.trend?.charAt(0).toUpperCase() + ind.trend?.slice(1),
                    note:`EMA-20: $${ind.ema20} · EMA-50: $${ind.ema50}`,
                    color: ind.trend === 'bullish' ? 'text-accent-green' : ind.trend === 'bearish' ? 'text-accent-red' : 'text-accent-yellow' }] : []),
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between py-1">
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

          {/* ── Indicator dashboard (only if candles available) ── */}
          {ind && (
            <div className="card p-4">
              <h3 className="text-sm font-bold text-white mb-4">📈 Indicator Dashboard</h3>

              {/* Gauge bars row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <GaugeMeter label="RSI (14)" value={ind.rsi} tipId="rsi"
                  min={0} max={100} zones={RSI_ZONES}
                  thresholds={[{v:30,label:'30'},{v:50,label:'50'},{v:65,label:'65'},{v:78,label:'78'}]}
                  format={v => String(Math.round(v))} />
                <GaugeMeter label="Stochastic %K" value={ind.stoch_k} tipId="stoch"
                  min={0} max={100} zones={STOCH_ZONES}
                  thresholds={[{v:20,label:'20'},{v:50,label:'50'},{v:80,label:'80'}]}
                  format={v => String(Math.round(v))} />
                <GaugeMeter label="ADX — Trend Strength" value={Math.min(60, ind.adx)} tipId="adx"
                  min={0} max={60} zones={ADX_ZONES}
                  thresholds={[{v:20,label:'20'},{v:30,label:'30'},{v:50,label:'50'}]}
                  format={v => String(Math.round(v))} />
                <GaugeMeter label="Volume Ratio" value={Math.min(3, ind.volume_ratio)} tipId="volume"
                  min={0} max={3} zones={VOL_ZONES}
                  thresholds={[{v:1.0,label:'1×'},{v:1.3,label:'1.3×'},{v:2.0,label:'2×'}]}
                  format={v => `${ind.volume_ratio.toFixed(1)}×`} />
              </div>

              {/* Text indicators grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                <IndicatorRow label="MACD" tipId="macd"
                  value={ind.macd?.histogram > 0 ? `+${ind.macd.histogram.toFixed(3)}` : ind.macd?.histogram?.toFixed(3)}
                  signal={ind.macd?.bullish ? 'Bullish ▲' : 'Bearish ▼'}
                  color={ind.macd?.bullish ? 'text-accent-green' : 'text-accent-red'} />
                <IndicatorRow label="VWAP" tipId="vwap"
                  value={`$${ind.vwap}`}
                  signal={data.price > ind.vwap ? '▲ Above' : '▼ Below'}
                  color={data.price > ind.vwap ? 'text-accent-green' : 'text-accent-red'} />
                <IndicatorRow label="OBV" tipId="obv"
                  value={ind.obv_trend?.charAt(0).toUpperCase() + ind.obv_trend?.slice(1)}
                  signal={ind.obv_trend === 'accumulation' ? 'Smart $ in' : ind.obv_trend === 'distribution' ? 'Selling out' : 'Neutral'}
                  color={sigColor(ind.obv_trend)} />
                <IndicatorRow label="ATR (14)" tipId="atr"
                  value={`$${ind.atr?.toFixed(2)}`}
                  signal={`${ind.atr_pct}% of price`}
                  color="text-muted" />
              </div>

              {/* EMA context */}
              <div className="flex flex-wrap gap-4 text-[10px] p-2 bg-surface-2 rounded-xl border border-border">
                <span className="text-muted font-semibold">EMA position:<Tooltip id="ema" /></span>
                <span className={data.price > ind.ema20 ? 'text-accent-green' : 'text-accent-red'}>
                  EMA-20 ${ind.ema20} {data.price > ind.ema20 ? '✓ price above' : '✗ price below'}
                </span>
                <span className={data.price > ind.ema50 ? 'text-accent-green' : 'text-accent-red'}>
                  EMA-50 ${ind.ema50} {data.price > ind.ema50 ? '✓ price above' : '✗ price below'}
                </span>
              </div>
            </div>
          )}

          {/* ── Support & Resistance ── */}
          {levels && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-1">
                  📐 Support & Resistance<Tooltip id="sr" />
                </h3>
                <button onClick={() => setExpandLevels(o => !o)}
                  className="text-[10px] text-muted hover:text-white flex items-center gap-1">
                  {expandLevels ? 'Less' : 'More'} {expandLevels ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                </button>
              </div>

              {/* Visual S&R strip */}
              <div className="space-y-1.5 mb-4">
                {[
                  { label:'R2', value:levels.r2,   type:'resistance', desc:'Major resistance'   },
                  { label:'R1', value:levels.r1,   type:'resistance', desc:'Nearest resistance'  },
                  { label:'▶',  value:data.price,  type:'current',    desc:'Current price'       },
                  { label:'S1', value:levels.s1,   type:'support',    desc:'First support'       },
                  { label:'S2', value:levels.s2,   type:'support',    desc:'Key support'         },
                ].map(row => (
                  <div key={row.label} className={`flex items-center gap-2 py-1.5 px-2 rounded-lg ${
                    row.type === 'current'    ? 'bg-accent-green/10 border border-accent-green/30' :
                    row.type === 'resistance' ? 'border-l-2 border-accent-red/50' : 'border-l-2 border-accent-green/50'
                  }`}>
                    <span className={`text-[10px] font-bold w-5 ${
                      row.type === 'current' ? 'text-accent-green' :
                      row.type === 'resistance' ? 'text-accent-red' : 'text-accent-green'}`}>
                      {row.label}
                    </span>
                    <span className="text-xs font-mono font-bold text-white">${row.value?.toFixed(2)}</span>
                    <span className="text-[9px] text-muted">{row.desc}</span>
                  </div>
                ))}
              </div>

              {/* Fibonacci */}
              <div className="mb-4">
                <p className="text-[10px] text-muted uppercase tracking-wide mb-2 flex items-center gap-1">
                  Fibonacci Levels<Tooltip id="fib" />
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label:'23.6%', value:levels.fib_236 },
                    { label:'38.2%', value:levels.fib_382 },
                    { label:'50.0%', value:levels.fib_500 },
                    { label:'61.8%', value:levels.fib_618 },
                  ].map(f => (
                    <div key={f.label} className="text-center bg-surface-2 rounded-lg px-3 py-2 border border-border">
                      <p className="text-[9px] text-accent-yellow font-bold">{f.label}</p>
                      <p className="text-xs font-mono text-white">${f.value?.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trade zones */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label:'Entry Zone<Tooltip id="rr" />', value:`$${levels.entry_lo}–${levels.entry_hi}`, color:'text-accent-green' },
                  { label:'Stop Loss', value:`$${levels.stop_loss}`, color:'text-accent-red' },
                  { label:`R:R${rr ? ` ~1:${rr}` : ''}`, value:`TP1 $${levels.target1}`, color:'text-accent-yellow' },
                ].map((t, i) => (
                  <div key={i} className="bg-surface-2 rounded-xl p-2 border border-border text-center">
                    <p className="text-[9px] text-muted">{t.label}</p>
                    <p className={`text-xs font-mono font-bold ${t.color}`}>{t.value}</p>
                  </div>
                ))}
              </div>

              {/* Pivot points (expanded) */}
              {expandLevels && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-[10px] text-muted uppercase tracking-wide mb-2 flex items-center gap-1">
                    Pivot Points<Tooltip id="pivot" />
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label:'S3', value:levels.s3 }, { label:'S2', value:levels.s2 },
                      { label:'S1', value:levels.s1 }, { label:'PP', value:levels.pivot },
                      { label:'R1', value:levels.r1 }, { label:'R2', value:levels.r2 },
                      { label:'R3', value:levels.r3 },
                    ].map(p => (
                      <div key={p.label} className={`text-center rounded-lg px-2.5 py-1.5 border ${
                        p.label === 'PP' ? 'bg-surface-3 border-accent-green/30 text-accent-green' :
                        p.label.startsWith('R') ? 'bg-surface-2 border-accent-red/20 text-accent-red' :
                        'bg-surface-2 border-accent-green/20 text-accent-green'}`}>
                        <p className="text-[9px] font-bold">{p.label}</p>
                        <p className="text-xs font-mono">${p.value?.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Why it's moving ── */}
          {data.narrative && (
            <div className="card p-4 border border-accent-green/15">
              <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
                <Brain size={14} className="text-accent-green" />
                Why Is {data.ticker} Moving?
              </h3>
              <p className="text-sm text-secondary leading-relaxed">{data.narrative}</p>
              <p className="text-[9px] text-muted mt-2">AI analysis · {new Date(data.generated_at).toLocaleTimeString()} · Not financial advice</p>
            </div>
          )}

          {/* Musaffa link */}
          <div className="flex items-center justify-between py-2 px-4 bg-surface-2 rounded-xl border border-border">
            <span className="text-xs text-secondary">Always verify halal status before investing</span>
            <a href={`https://musaffa.com/stock/${ticker}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-accent-green hover:underline">
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
            Type a ticker above or pick from your portfolio and watchlist for a full report — chart, analyst targets, indicators, support levels, and halal screening.
          </p>
          <a href="/learn" className="mt-4 flex items-center gap-1.5 text-xs text-accent-green hover:underline">
            <BookOpen size={12} /> Learn what each indicator means →
          </a>
        </div>
      )}
    </div>
  );
}
