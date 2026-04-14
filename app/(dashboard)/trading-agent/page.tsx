'use client';

import { useState } from 'react';
import {
  Zap, Loader2, TrendingUp, ShieldAlert, Clock,
  BarChart2, Target, StopCircle, Info, RefreshCw,
  ChevronDown, ChevronUp, AlertTriangle,
} from 'lucide-react';

type PriceRange = 'small' | 'medium' | 'large' | 'big';

const RANGE_CONFIG: Record<PriceRange, { label: string; desc: string; color: string }> = {
  small:  { label: 'Small',  desc: '< $25',       color: 'text-accent-purple' },
  medium: { label: 'Medium', desc: '$26 – $100',   color: 'text-accent-blue'   },
  large:  { label: 'Large',  desc: '$101 – $200',  color: 'text-accent-green'  },
  big:    { label: 'Big',    desc: '> $200',       color: 'text-accent-yellow' },
};

const SETUP_CONFIG: Record<string, { color: string; icon: string; bg: string }> = {
  'Momentum Breakout': { color: 'text-accent-green',  bg: 'bg-accent-green/10  border-accent-green/25',  icon: '🚀' },
  'Dip Buy Reversal':  { color: 'text-accent-blue',   bg: 'bg-accent-blue/10   border-accent-blue/25',   icon: '📉' },
  'News Catalyst':     { color: 'text-accent-yellow', bg: 'bg-accent-yellow/10 border-accent-yellow/25', icon: '📰' },
};

const HALAL_CONFIG: Record<string, { label: string; color: string }> = {
  high:     { label: '✅ Halal',    color: 'text-accent-green'  },
  medium:   { label: '⚠️ Medium',  color: 'text-accent-yellow' },
  doubtful: { label: '⚠️ Doubtful',color: 'text-accent-yellow' },
};

const TIMING_TIPS = [
  { time: '4:15 – 8:00pm ET', label: '🥇 Best',    tip: 'After market close — full daily candles, most reliable signals' },
  { time: '7:30 – 9:15am ET', label: '🥈 Good',    tip: 'Pre-market — uses yesterday\'s completed candles' },
  { time: '10:30 – 11:30am ET',label: '🥉 Decent', tip: 'Mid-morning — opening volatility settled, direction clear' },
  { time: '12:00 – 1:00pm ET', label: '❌ Avoid',  tip: 'Lunch lull — volume dries up, signals unreliable' },
  { time: '9:30 – 10:15am ET', label: '❌ Avoid',  tip: 'Opening — false breakouts, extreme noise' },
];

export default function TradingAgentPage() {
  const [ranges,       setRanges]       = useState<PriceRange[]>(['medium', 'large']);
  const [capital,      setCapital]      = useState<number>(10000);
  const [loading,      setLoading]      = useState(false);
  const [result,       setResult]       = useState<any>(null);
  const [showTiming,   setShowTiming]   = useState(false);
  const [expanded,     setExpanded]     = useState<string | null>(null);
  const [progress,     setProgress]     = useState('');

  function toggleRange(r: PriceRange) {
    setRanges(prev =>
      prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]
    );
  }

  async function runScan() {
    if (ranges.length === 0) return;
    setLoading(true);
    setResult(null);
    setProgress('Filtering halal universe by price range…');

    const ticker_count: Record<PriceRange, number> = {
      small: 25, medium: 40, large: 30, big: 20
    };
    const total = ranges.reduce((s, r) => s + ticker_count[r], 0);

    setProgress(`Scanning ${total} halal-screened stocks…`);

    try {
      setTimeout(() => setProgress('Fetching price & volume data…'), 3000);
      setTimeout(() => setProgress('Calculating RSI, MACD, ATR indicators…'), 8000);
      setTimeout(() => setProgress('Checking news catalysts…'), 15000);
      setTimeout(() => setProgress('Scoring setups and building trade plans…'), 22000);

      const res  = await fetch('/api/trading-agent', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ price_ranges: ranges, capital }),
      });
      const data = await res.json();
      setResult(data);
    } finally {
      setLoading(false);
      setProgress('');
    }
  }

  const noTrade = result?.signal === 'NO_TRADE';

  return (
    <div className="space-y-5 page-enter">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap size={20} className="text-accent-yellow" />
            Short-Term Trading Agent
          </h1>
          <p className="text-secondary text-sm mt-0.5">
            0–3 day momentum setups · Halal-screened US equities · Signal-based only
          </p>
        </div>
        <button
          onClick={() => setShowTiming(t => !t)}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors"
        >
          <Clock size={12} />
          Best scan times
          {showTiming ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
      </div>

      {/* ── Timing Tips ── */}
      {showTiming && (
        <div className="card p-4 space-y-2">
          <p className="text-xs font-semibold text-white mb-3">
            Optimal Scan Windows — signals are based on daily candles
          </p>
          {TIMING_TIPS.map((t, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="text-[10px] font-mono text-white w-32 shrink-0 mt-0.5">{t.time}</span>
              <span className={`text-[10px] font-bold w-16 shrink-0 ${
                t.label.includes('Avoid') ? 'text-accent-red' :
                t.label.includes('Best')  ? 'text-accent-green' : 'text-accent-yellow'
              }`}>{t.label}</span>
              <span className="text-[10px] text-secondary">{t.tip}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Scan Controls ── */}
      <div className="card p-5 space-y-5">

        {/* Price range selector */}
        <div>
          <p className="text-xs font-semibold text-white mb-2 flex items-center gap-1.5">
            <BarChart2 size={13} className="text-accent-green" />
            Price Range Filter
          </p>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(RANGE_CONFIG) as [PriceRange, any][]).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => toggleRange(key)}
                className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
                  ranges.includes(key)
                    ? `${cfg.color} bg-current/10 border-current/30`
                    : 'text-muted border-border hover:border-accent-green/30 hover:text-white bg-surface-2'
                }`}
              >
                <span className="font-bold">{cfg.label}</span>
                <span className="ml-1.5 opacity-70">{cfg.desc}</span>
              </button>
            ))}
            <button
              onClick={() => setRanges(['small','medium','large','big'])}
              className="px-3 py-2 rounded-lg border text-xs font-semibold text-muted border-border hover:border-accent-green/30 hover:text-white bg-surface-2 transition-all"
            >
              All Ranges
            </button>
          </div>
        </div>

        {/* Capital input */}
        <div>
          <p className="text-xs font-semibold text-white mb-2 flex items-center gap-1.5">
            <Target size={13} className="text-accent-green" />
            Trading Capital (for position sizing)
          </p>
          <div className="flex items-center gap-2">
            <span className="text-secondary text-sm">$</span>
            <input
              type="number"
              value={capital}
              onChange={e => setCapital(Math.max(1000, parseInt(e.target.value) || 10000))}
              className="input w-40 font-mono"
              step={1000}
              min={1000}
            />
            <span className="text-xs text-muted">Max risk per trade: ${(capital * 0.03).toLocaleString()} (3%)</span>
          </div>
        </div>

        {/* Scan button */}
        <div className="flex items-center gap-3">
          <button
            onClick={runScan}
            disabled={loading || ranges.length === 0}
            className="btn-primary flex items-center gap-2 px-6"
          >
            {loading
              ? <><Loader2 size={14} className="animate-spin" /> Scanning…</>
              : <><Zap size={14} /> Run Scan</>
            }
          </button>
          {result && !loading && (
            <button onClick={runScan} className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors">
              <RefreshCw size={11} /> Refresh
            </button>
          )}
          {ranges.length === 0 && (
            <p className="text-xs text-accent-red">Select at least one price range</p>
          )}
        </div>

        {/* Progress */}
        {loading && progress && (
          <div className="flex items-center gap-2 py-2">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
            <p className="text-xs text-secondary">{progress}</p>
          </div>
        )}
      </div>

      {/* ── Results ── */}
      {result && !loading && (
        <div className="space-y-4">

          {/* Meta bar */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-muted">
              Scanned <span className="text-white font-semibold">{result.scanned}</span> halal-screened stocks
              {result.found > 0 && <> · Found <span className="text-accent-green font-semibold">{result.found}</span> valid setup{result.found !== 1 ? 's' : ''}</>}
              {result.generated_at && <> · {new Date(result.generated_at).toLocaleTimeString()}</>}
            </p>
            <div className="flex items-center gap-1.5 text-[10px] text-muted">
              <Info size={10} />
              <span>Data ~15 min delayed · Not financial advice</span>
            </div>
          </div>

          {/* NO TRADE */}
          {noTrade && (
            <div className="card border border-accent-yellow/20 bg-accent-yellow/5 p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-yellow/15 border border-accent-yellow/30 flex items-center justify-center shrink-0">
                  <StopCircle size={20} className="text-accent-yellow" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white mb-1">
                    {`{ "signal": "NO_TRADE" }`}
                  </p>
                  <p className="text-xs text-secondary leading-relaxed">
                    {result.reason}
                  </p>
                  <p className="text-xs text-accent-yellow mt-2 font-semibold">
                    Preserving capital is the correct decision today.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Setup cards */}
          {result.setups?.map((setup: any, i: number) => {
            const cfg    = SETUP_CONFIG[setup.setup_type] ?? SETUP_CONFIG['Momentum Breakout'];
            const hCfg   = HALAL_CONFIG[setup.halal] ?? HALAL_CONFIG['medium'];
            const isOpen = expanded === setup.ticker;
            const rr     = setup.take_profit_1 && setup.stop_loss && setup.entry_price
              ? ((setup.take_profit_1 - setup.entry_price) / (setup.entry_price - setup.stop_loss)).toFixed(1)
              : '—';

            return (
              <div key={setup.ticker} className={`card border ${cfg.bg} p-0 overflow-hidden`}>

                {/* Header row */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer select-none"
                  onClick={() => setExpanded(isOpen ? null : setup.ticker)}
                >
                  <div className="text-2xl">{cfg.icon}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-bold text-lg font-mono">{setup.ticker}</span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${cfg.color} border border-current/30 bg-current/10`}>
                        {setup.setup_type}
                      </span>
                      <span className={`text-[10px] font-medium ${hCfg.color}`}>{hCfg.label}</span>
                      <span className="text-[10px] text-muted">{setup.sector}</span>
                    </div>
                    <p className="text-xs text-secondary mt-0.5 truncate">{setup.reasoning}</p>
                  </div>

                  {/* Confidence */}
                  <div className="text-center shrink-0">
                    <p className={`text-xl font-bold font-mono ${setup.confidence >= 8 ? 'text-accent-green' : setup.confidence >= 6 ? 'text-accent-yellow' : 'text-muted'}`}>
                      {setup.confidence}/10
                    </p>
                    <p className="text-[9px] text-muted">confidence</p>
                  </div>

                  {isOpen ? <ChevronUp size={14} className="text-muted shrink-0" /> : <ChevronDown size={14} className="text-muted shrink-0" />}
                </div>

                {/* Quick stats row */}
                <div className="grid grid-cols-4 gap-0 border-t border-border/50">
                  {[
                    { label: 'Entry', value: `$${setup.entry_price?.toFixed(2)}`, color: 'text-white' },
                    { label: 'Stop',  value: `$${setup.stop_loss?.toFixed(2)}`,   color: 'text-accent-red' },
                    { label: 'TP1',   value: `$${setup.take_profit_1?.toFixed(2)}`,color: 'text-accent-green' },
                    { label: 'R:R',   value: `1:${rr}`,                           color: 'text-accent-yellow' },
                  ].map(stat => (
                    <div key={stat.label} className="flex flex-col items-center py-2.5 border-r border-border/50 last:border-r-0">
                      <p className="text-[9px] text-muted uppercase tracking-wide mb-0.5">{stat.label}</p>
                      <p className={`text-xs font-mono font-bold ${stat.color}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                {/* Expanded details */}
                {isOpen && (
                  <div className="border-t border-border/50 p-4 space-y-4">

                    {/* Trade plan grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {[
                        { label: 'Entry Price',     value: `$${setup.entry_price?.toFixed(2)}`,    note: 'Limit order recommended' },
                        { label: 'Stop Loss',       value: `$${setup.stop_loss?.toFixed(2)}`,      note: 'Hard stop — no exceptions' },
                        { label: 'Take Profit 1',   value: `$${setup.take_profit_1?.toFixed(2)}`,  note: 'Exit 50% of position' },
                        { label: 'Take Profit 2',   value: `$${setup.take_profit_2?.toFixed(2)}`,  note: 'Exit remaining 50%' },
                        { label: 'Position Size',   value: `${setup.shares} shares`,               note: `$${setup.position_value?.toLocaleString()} total` },
                        { label: 'Max Loss',        value: `$${setup.max_loss?.toFixed(2)}`,       note: '3% capital risk rule' },
                      ].map(item => (
                        <div key={item.label} className="bg-surface-2 rounded-xl p-3">
                          <p className="text-[9px] text-muted uppercase tracking-wide mb-0.5">{item.label}</p>
                          <p className="text-sm font-mono font-bold text-white">{item.value}</p>
                          <p className="text-[9px] text-muted mt-0.5">{item.note}</p>
                        </div>
                      ))}
                    </div>

                    {/* Signal factors */}
                    <div>
                      <p className="text-[10px] text-muted uppercase tracking-wide mb-2">Confirmed Signals</p>
                      <div className="flex flex-wrap gap-1.5">
                        {setup.factors?.map((f: string, fi: number) => (
                          <span key={fi} className="text-[10px] text-accent-green bg-accent-green/10 border border-accent-green/20 px-2 py-0.5 rounded-full">
                            ✓ {f}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Hold + rules */}
                    <div className="p-3 bg-surface-2 rounded-xl border border-border text-xs text-secondary leading-relaxed">
                      <span className="text-white font-semibold">Hold period:</span> {setup.hold_days} ·{' '}
                      <span className="text-white font-semibold">Capital at risk:</span> 3% max ·{' '}
                      <span className="text-white font-semibold">Halal:</span> {hCfg.label}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Risk disclaimer */}
          {result.setups?.length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-surface-2 border border-border">
              <AlertTriangle size={13} className="text-accent-yellow shrink-0 mt-0.5" />
              <p className="text-[10px] text-muted leading-relaxed">
                <span className="text-white font-semibold">Risk rules: </span>
                Max 2 open positions simultaneously. Stop all trading if portfolio drops 5% in a single day.
                These are structured signal plans, not financial advice. You bear all risk.
                Signal quality is highest after 4:15pm ET using complete daily candles.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}