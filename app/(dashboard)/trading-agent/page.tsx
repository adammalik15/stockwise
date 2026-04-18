'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  Zap, Search, Loader2, TrendingUp, TrendingDown, Info,
  ChevronDown, ChevronUp, CheckCircle2, XCircle, AlertCircle,
  RefreshCw, BookOpen, ExternalLink, BarChart2, Calendar,
  Brain, Shield, Target, Activity,
} from 'lucide-react';

const PriceChart = dynamic(() => import('@/components/charts/PriceChart'), { ssr: false });

// ── Admin email — only this user can edit halal status ───────────────────────
const ADMIN_EMAIL = 'adammalik15@gmail.com';

// ── Tooltip text ─────────────────────────────────────────────────────────────
const TIPS: Record<string, string> = {
  rsi:     'RSI (0–100): Below 30 = oversold, 30–50 = neutral, 50–65 = healthy momentum ✓, 65–78 = elevated, above 78 = overbought. Our scanner rejects anything above 78.',
  macd:    'MACD: Compares two moving averages. Bullish = short-term avg crossing above long-term avg. Histogram expanding = momentum is accelerating.',
  atr:     'ATR: How much the stock typically moves in one day in dollars. Used to set stop-losses (ATR × 1.5) and take-profit targets (ATR × 2).',
  volume:  'Volume ratio: Today\'s volume vs the 20-day average. Below 1.3× = low conviction. Above 1.3× = confirmed. Above 2× = strong institutional interest.',
  ema:     'EMA (Exponential Moving Average): A running price average. Price above EMA-20 AND EMA-50 = bullish trend confirmed.',
  adx:     'ADX: Measures trend strength — not direction. Below 20 = sideways/weak. 20–30 = developing. 30–50 = strong trend ✓. Above 50 = very strong.',
  stoch:   'Stochastic: Where is the price relative to its recent high-low range? Below 20 = oversold. Above 80 = overbought. %K crossing above %D = buy signal.',
  sr:      'Support = price floor where buyers historically stepped in. Resistance = price ceiling where sellers pushed back. More tests = stronger level.',
  fib:     'Fibonacci levels: 38.2%, 50%, 61.8% of a recent swing. Globally used by institutions as support/resistance — becomes self-fulfilling.',
  rr:      'Risk:Reward ratio. A 1:2 ratio means you risk $1 to potentially make $2. Never take a trade with less than 1:1.5 R:R.',
  confidence: 'Confidence score (1–10): How many of our 5 signal criteria this setup meets. 4 = minimum to qualify. 6+ = strong setup.',
  keyMoves: 'Key price moves of 5%+ in the past 90 days. Useful for understanding what types of events move this stock and how violently.',
  earnings: 'Earnings date: The company reports quarterly results. Stocks can move ±10-20% on earnings — trading into earnings is a binary bet, not a momentum trade.',
};

// ── Educational 1-liners for indicators ──────────────────────────────────────
const EDU_LINES: Record<string, (v: any) => string> = {
  rsi:    (v) => v < 30 ? `RSI ${v} — stock has fallen hard and may bounce soon` : v < 50 ? `RSI ${v} — recovering but no clear momentum yet` : v < 65 ? `RSI ${v} — momentum is building, not yet overheated ✓` : v < 78 ? `RSI ${v} — getting hot, consider a smaller position` : `RSI ${v} — overbought, high risk of pullback`,
  volume: (v) => v >= 2 ? `${v}× volume — institutions are actively trading this today` : v >= 1.3 ? `${v}× volume — more than normal interest confirms the move` : `${v}× volume — below our threshold, low conviction`,
  macd:   (v) => v?.bullish ? 'MACD bullish — short-term momentum is accelerating upward' : 'MACD bearish — momentum is fading or reversing',
  adx:    (v) => v < 20 ? `ADX ${v} — weak trend, stock is chopping sideways` : v < 30 ? `ADX ${v} — trend developing, watch for confirmation` : `ADX ${v} — strong trend, momentum plays work best here`,
  stoch:  (v) => v < 20 ? `Stochastic ${v} — oversold, watch for %K crossing above %D` : v > 80 ? `Stochastic ${v} — overbought, momentum may be exhausted` : `Stochastic ${v} — neutral zone, not extreme`,
};

// ── Gauge bar ─────────────────────────────────────────────────────────────────
interface Zone { from: number; to: number; hex: string; alpha: number }

function GaugeMeter({ label, value, min, max, zones, thresholds, tipKey, eduMode, eduVal }:
  { label: string; value: number; min: number; max: number; zones: Zone[]; thresholds: {v:number;l:string}[]; tipKey: string; eduMode: boolean; eduVal?: any }) {
  const clamp = Math.min(max, Math.max(min, value));
  const pct   = ((clamp - min) / (max - min)) * 100;
  const zone  = zones.find(z => clamp >= z.from && clamp <= z.to) ?? zones[zones.length - 1];
  return (
    <div className="bg-surface-2 rounded-xl p-3 border border-border">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-muted uppercase tracking-wide font-semibold flex items-center gap-1">
          {label} <Tip id={tipKey} />
        </span>
        <span className="text-sm font-mono font-bold" style={{ color: zone.hex }}>{Math.round(value)}</span>
      </div>
      <div className="relative h-3 rounded-full overflow-hidden bg-surface-3">
        {zones.map((z, i) => (
          <div key={i} className="absolute top-0 h-full"
            style={{ left:`${((z.from-min)/(max-min))*100}%`, width:`${((z.to-z.from)/(max-min))*100}%`, backgroundColor: z.hex, opacity: z.alpha }} />
        ))}
        <div className="absolute top-0 h-full w-0.5 z-10"
          style={{ left:`${pct}%`, backgroundColor:'rgba(255,255,255,0.95)', transform:'translateX(-50%)' }} />
      </div>
      <div className="relative mt-1 h-3">
        {thresholds.map((t, i) => (
          <span key={i} className="absolute text-[8px] text-muted" style={{ left:`${((t.v-min)/(max-min))*100}%`, transform:'translateX(-50%)' }}>{t.l}</span>
        ))}
      </div>
      {eduMode && EDU_LINES[tipKey] && (
        <p className="text-[10px] text-accent-green mt-2 pt-1.5 border-t border-border leading-relaxed italic">
          {EDU_LINES[tipKey](eduVal ?? value)}
        </p>
      )}
    </div>
  );
}

const RSI_ZONES:   Zone[] = [{from:0,to:30,hex:'#3b82f6',alpha:0.7},{from:30,to:50,hex:'#eab308',alpha:0.55},{from:50,to:65,hex:'#10b981',alpha:0.85},{from:65,to:78,hex:'#eab308',alpha:0.55},{from:78,to:100,hex:'#ef4444',alpha:0.7}];
const STOCH_ZONES: Zone[] = [{from:0,to:20,hex:'#3b82f6',alpha:0.7},{from:20,to:80,hex:'#10b981',alpha:0.6},{from:80,to:100,hex:'#ef4444',alpha:0.7}];
const ADX_ZONES:   Zone[] = [{from:0,to:20,hex:'#ef4444',alpha:0.6},{from:20,to:30,hex:'#eab308',alpha:0.6},{from:30,to:50,hex:'#10b981',alpha:0.85},{from:50,to:60,hex:'#eab308',alpha:0.6}];
const VOL_ZONES:   Zone[] = [{from:0,to:1.0,hex:'#ef4444',alpha:0.6},{from:1.0,to:1.3,hex:'#eab308',alpha:0.6},{from:1.3,to:2.0,hex:'#10b981',alpha:0.75},{from:2.0,to:3.0,hex:'#10b981',alpha:1.0}];

// ── Tooltip popup ─────────────────────────────────────────────────────────────
function Tip({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const text = TIPS[id];
  if (!text) return null;
  return (
    <div className="relative inline-block">
      <button onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className="text-muted hover:text-accent-green transition-colors ml-0.5 align-middle">
        <Info size={10} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 left-0 top-5 w-60 bg-surface-2 border border-border rounded-xl p-3 shadow-xl text-left">
            <p className="text-[10px] text-secondary leading-relaxed">{text}</p>
          </div>
        </>
      )}
    </div>
  );
}

// ── Halal badge ───────────────────────────────────────────────────────────────
function HalalBadge({ setup, onCertify, certLoading, canEdit }: { setup: any; onCertify: (t:string,v:string)=>void; certLoading: string|null; canEdit: boolean }) {
  const userVerdict = setup.userCert?.user_verdict;
  const preScreened = setup.meta?.halal === 'high';

  if (userVerdict) {
    const cfg = { halal:{label:'Halal',color:'text-accent-green',bg:'bg-accent-green/10 border-accent-green/25',icon:CheckCircle2}, haram:{label:'Haram',color:'text-accent-red',bg:'bg-accent-red/10 border-accent-red/25',icon:XCircle}, doubtful:{label:'Doubtful',color:'text-accent-yellow',bg:'bg-accent-yellow/10 border-accent-yellow/25',icon:AlertCircle} }[userVerdict as string];
    const Icon = cfg?.icon ?? AlertCircle;
    return (
      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border ${cfg?.bg}`}>
        <Icon size={13} className={cfg?.color} />
        <span className={`text-xs font-bold ${cfg?.color}`}>{cfg?.label}</span>
        {canEdit && (
          <button onClick={() => onCertify(setup.ticker, userVerdict)} className="text-[9px] text-muted hover:text-white ml-1">✕</button>
        )}
      </div>
    );
  }

  if (preScreened && !userVerdict) {
    return (
      <div className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border bg-accent-green/5 border-accent-green/20">
          <Shield size={12} className="text-accent-green" />
          <span className="text-[10px] text-accent-green font-semibold">Pre-screened Halal</span>
          <a href={`https://musaffa.com/stock/${setup.ticker}`} target="_blank" rel="noopener noreferrer" className="ml-1"><ExternalLink size={9} className="text-muted hover:text-accent-green" /></a>
        </div>
        {canEdit && (
          <div className="flex gap-1">
            {['halal','haram','doubtful'].map(v => (
              <button key={v} onClick={() => onCertify(setup.ticker, v)} disabled={certLoading===setup.ticker}
                className="text-[9px] px-1.5 py-0.5 rounded border border-border text-muted hover:text-white capitalize">
                {v}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border bg-accent-yellow/5 border-accent-yellow/20">
        <AlertCircle size={12} className="text-accent-yellow" />
        <span className="text-[10px] text-accent-yellow font-semibold">Verify halal status</span>
        <a href={`https://musaffa.com/stock/${setup.ticker}`} target="_blank" rel="noopener noreferrer" className="ml-1"><ExternalLink size={9} className="text-muted hover:text-accent-yellow" /></a>
      </div>
      {canEdit && (
        <div className="flex gap-1">
          {['halal','haram','doubtful'].map(v => (
            <button key={v} onClick={() => onCertify(setup.ticker, v)} disabled={certLoading===setup.ticker}
              className="text-[9px] px-1.5 py-0.5 rounded border border-border text-muted hover:text-white capitalize">
              {v}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Setup card ────────────────────────────────────────────────────────────────
function SetupCard({ setup, eduMode, onCertify, certLoading }: { setup: any; eduMode: boolean; onCertify: (t:string,v:string)=>void; certLoading: string|null }) {
  const [expanded, setExpanded] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);
  const ind = setup.indicators;
  const levels = setup.levels;
  const chg = setup.change ?? 0;
  const chgPos = chg >= 0;
  const daysToEarnings = setup.earningsDate ? Math.round((new Date(setup.earningsDate).getTime() - Date.now()) / 86400000) : null;
  const earningsWarning = daysToEarnings !== null && daysToEarnings <= 7;

  async function loadChart() {
    if (chartData.length > 0) { setShowChart(s => !s); return; }
    const res = await fetch(`/api/stocks/${setup.ticker}/history?period=3mo`);
    const json = await res.json();
    setChartData(json.history ?? []);
    setShowChart(true);
  }

  const confidenceColor = setup.confidence >= 7 ? 'text-accent-green' : setup.confidence >= 5 ? 'text-accent-yellow' : 'text-muted';
  const setupColor = setup.setup_type === 'Momentum Breakout' ? 'badge-green' : setup.setup_type === 'Dip Buy Reversal' ? 'badge-blue' : 'badge-yellow';

  return (
    <div className="card p-0 overflow-hidden border border-border">

      {/* Earnings warning banner */}
      {earningsWarning && (
        <div className="bg-accent-yellow/10 border-b border-accent-yellow/20 px-4 py-2 flex items-center gap-2">
          <Calendar size={12} className="text-accent-yellow shrink-0" />
          <p className="text-[11px] text-accent-yellow font-semibold">
            ⚠️ Earnings in {daysToEarnings} day{daysToEarnings !== 1 ? 's' : ''} ({setup.earningsDate}) — this becomes a binary bet, not a momentum trade
          </p>
        </div>
      )}

      {/* Card header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xl font-bold text-white font-mono">{setup.ticker}</span>
              <span className={`badge ${setupColor}`}>{setup.setup_type}</span>
              <span className="badge badge-neutral text-[9px]">{setup.meta?.sector}</span>
              {setup.earningsDate && !earningsWarning && (
                <span className="badge badge-neutral text-[9px] flex items-center gap-1">
                  <Calendar size={8} /> {setup.earningsDate}
                </span>
              )}
            </div>
            <p className="text-xs text-secondary mb-2">{setup.meta?.description}</p>

            {/* Price */}
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-white font-mono">${setup.price?.toFixed(2)}</span>
              <span className={`text-sm font-semibold flex items-center gap-0.5 ${chgPos ? 'text-accent-green' : 'text-accent-red'}`}>
                {chgPos ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                {chgPos ? '+' : ''}{chg?.toFixed(2)}%
              </span>
              <span className={`text-xs font-bold flex items-center gap-1 ${confidenceColor}`}>
                Signal {setup.confidence}/10 <Tip id="confidence" />
              </span>
            </div>
          </div>

          {/* Halal badge */}
          <HalalBadge setup={setup} onCertify={onCertify} certLoading={certLoading} canEdit={setup.canEdit} />
        </div>

        {/* Sparkline — mini 30-day price trend */}
        {setup.sparkline?.length > 1 && (
          <div className="mt-3 mb-3">
            <div className="flex items-end gap-[1px] h-10 w-full">
              {setup.sparkline.map((p: any, i: number) => {
                const all = setup.sparkline.map((x: any) => x.c);
                const mn = Math.min(...all), mx = Math.max(...all);
                const h = mx === mn ? 50 : ((p.c - mn) / (mx - mn)) * 100;
                const isLast = i === setup.sparkline.length - 1;
                const isPos = setup.sparkline[setup.sparkline.length - 1].c >= setup.sparkline[0].c;
                return <div key={i} className={`flex-1 rounded-sm ${isLast ? 'opacity-100' : 'opacity-60'}`}
                  style={{ height:`${Math.max(8, h)}%`, backgroundColor: isPos ? '#10b981' : '#ef4444' }} />;
              })}
            </div>
            <div className="flex justify-between text-[8px] text-muted mt-0.5">
              <span>30 days ago</span><span>Today</span>
            </div>
          </div>
        )}

        {/* Trade plan summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[
            { label:'Entry',   value:`$${setup.entry}`,       color:'text-white'         },
            { label:'Stop',    value:`$${setup.stop}`,        color:'text-accent-red'    },
            { label:'Target 1',value:`$${setup.tp1}`,         color:'text-accent-green'  },
            { label:`R:R`,     value:`1:${setup.rr}`,         color:'text-accent-yellow' },
          ].map(r => (
            <div key={r.label} className="bg-surface-2 rounded-xl p-2.5 border border-border text-center">
              <p className="text-[9px] text-muted mb-0.5">{r.label}<Tip id="rr" /></p>
              <p className={`text-sm font-mono font-bold ${r.color}`}>{r.value}</p>
            </div>
          ))}
        </div>

        {/* Signal factors */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {setup.factors?.map((f: string, i: number) => (
            <span key={i} className="text-[10px] bg-accent-green/10 text-accent-green px-2 py-0.5 rounded-full border border-accent-green/20">✓ {f}</span>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          <button onClick={loadChart} className="btn-secondary text-xs flex items-center gap-1.5">
            <BarChart2 size={12} /> {showChart ? 'Hide' : 'Show'} Chart
          </button>
          <button onClick={() => setExpanded(e => !e)} className="btn-secondary text-xs flex items-center gap-1.5">
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? 'Less detail' : 'Full analysis'}
          </button>
          <a href={`/stock-intelligence?ticker=${setup.ticker}`}
            className="btn-ghost text-xs flex items-center gap-1.5">
            <ExternalLink size={11} /> Stock Intel
          </a>
        </div>
      </div>

      {/* Full chart */}
      {showChart && chartData.length > 0 && (
        <div className="px-4 pb-4 border-t border-border pt-4">
          <PriceChart ticker={setup.ticker} initialData={chartData} currentPrice={setup.price} />
        </div>
      )}

      {/* Expanded analysis */}
      {expanded && (
        <div className="border-t border-border p-4 space-y-4">

          {/* Core Identity / Behavior */}
          {setup.meta?.behavior && (
            <div>
              <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5"><Brain size={12} className="text-accent-green" /> Core Identity & Behavior</h4>
              <div className="bg-surface-2 rounded-xl p-3 border border-border space-y-1.5">
                <div><span className="text-[10px] text-muted">Primary driver: </span><span className="text-[11px] text-secondary">{setup.meta.behavior.primary_driver}</span></div>
                <div><span className="text-[10px] text-muted">Movement pattern: </span><span className="text-[11px] text-secondary">{setup.meta.behavior.pattern}</span></div>
                <div><span className="text-[10px] text-muted">Avoid when: </span><span className="text-[11px] text-accent-red">{setup.meta.behavior.avoid_when}</span></div>
                <div><span className="text-[10px] text-muted">Best for: </span><span className="text-[11px] text-accent-green">{setup.meta.behavior.best_for}</span></div>
              </div>
            </div>
          )}

          {/* Volatility Profile */}
          <div>
            <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5"><Activity size={12} className="text-accent-yellow" /> Volatility Profile</h4>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label:'ATR (daily $)', value:`$${ind?.atr?.toFixed(2)}`, note:'Typical daily dollar move', tipId:'atr' },
                { label:'ATR % of price', value:`${ind?.atrPct}%`, note:'Volatility as % of price', tipId:'atr' },
                { label:'Avg daily move', value:`±${setup.volatilityProfile?.avgDailyPct}%`, note:'30-day average absolute change', tipId:'atr' },
              ].map(r => (
                <div key={r.label} className="bg-surface-2 rounded-xl p-2.5 border border-border text-center">
                  <p className="text-[9px] text-muted">{r.label}<Tip id={r.tipId} /></p>
                  <p className="text-sm font-mono font-bold text-accent-yellow">{r.value}</p>
                  <p className="text-[9px] text-muted mt-0.5">{r.note}</p>
                </div>
              ))}
            </div>
            {eduMode && <p className="text-[10px] text-accent-green mt-2 italic">A higher ATR means wider stop-losses — size your position smaller to keep total risk at 3% of capital.</p>}
          </div>

          {/* Fundamentals */}
          <div>
            <h4 className="text-xs font-bold text-white mb-2">📊 Fundamentals</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { label:'Market Cap', value: setup.fundamentals?.marketCap ? `$${(setup.fundamentals.marketCap/1e9).toFixed(1)}B` : 'N/A' },
                { label:'P/E Ratio',  value: setup.fundamentals?.pe?.toFixed(1) ?? 'N/A' },
                { label:'Beta',       value: setup.fundamentals?.beta?.toFixed(2) ?? 'N/A', tipId:'atr' },
                { label:'52W High',   value: setup.fundamentals?.high52 ? `$${setup.fundamentals.high52?.toFixed(2)}` : 'N/A' },
                { label:'52W Low',    value: setup.fundamentals?.low52 ? `$${setup.fundamentals.low52?.toFixed(2)}` : 'N/A' },
                { label:'Rev Growth', value: setup.fundamentals?.revenueGrowth ? `${(setup.fundamentals.revenueGrowth*100).toFixed(1)}%` : 'N/A' },
              ].map(r => (
                <div key={r.label} className="bg-surface-2 rounded-xl p-2.5 border border-border">
                  <p className="text-[9px] text-muted">{r.label}</p>
                  <p className="text-sm font-mono font-bold text-white">{r.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Analyst Targets */}
          {setup.targets?.consensus && (
            <div>
              <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5"><Target size={12} className="text-accent-green" /> Analyst Price Targets</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label:'Consensus', value:`$${setup.targets.consensus?.toFixed(2)}`, upside: setup.targets.upside, hi:true },
                  { label:'High',      value:`$${setup.targets.high?.toFixed(2)}`,      upside:null, hi:false },
                  { label:'Low',       value:`$${setup.targets.low?.toFixed(2)}`,       upside:null, hi:false },
                  { label:'Median',    value:`$${setup.targets.median?.toFixed(2)}`,    upside:null, hi:false },
                ].map(r => (
                  <div key={r.label} className={`rounded-xl p-2.5 border text-center ${r.hi ? 'bg-accent-green/10 border-accent-green/25' : 'bg-surface-2 border-border'}`}>
                    <p className="text-[9px] text-muted">{r.label}</p>
                    <p className={`text-sm font-mono font-bold ${r.hi ? 'text-accent-green' : 'text-white'}`}>{r.value}</p>
                    {r.hi && r.upside !== null && <p className={`text-[9px] font-bold ${(r.upside??0) >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>{(r.upside??0) >= 0 ? '+' : ''}{r.upside}% upside</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Indicator Dashboard */}
          {ind && (
            <div>
              <h4 className="text-xs font-bold text-white mb-3 flex items-center gap-1.5">📈 Indicator Dashboard</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                <GaugeMeter label="RSI (14)" value={ind.rsi} min={0} max={100} zones={RSI_ZONES} tipKey="rsi" eduMode={eduMode} eduVal={ind.rsi}
                  thresholds={[{v:30,l:'30'},{v:50,l:'50'},{v:65,l:'65'},{v:78,l:'78'}]} />
                <GaugeMeter label="Volume Ratio" value={Math.min(3, ind.volR)} min={0} max={3} zones={VOL_ZONES} tipKey="volume" eduMode={eduMode} eduVal={ind.volR}
                  thresholds={[{v:1.0,l:'1×'},{v:1.3,l:'1.3×'},{v:2.0,l:'2×'}]} />
                <GaugeMeter label="ADX — Trend Strength" value={Math.min(60, ind.adx)} min={0} max={60} zones={ADX_ZONES} tipKey="adx" eduMode={eduMode} eduVal={ind.adx}
                  thresholds={[{v:20,l:'20'},{v:30,l:'30'},{v:50,l:'50'}]} />
                <GaugeMeter label="Stochastic %K" value={ind.stochK} min={0} max={100} zones={STOCH_ZONES} tipKey="stoch" eduMode={eduMode} eduVal={ind.stochK}
                  thresholds={[{v:20,l:'20'},{v:50,l:'50'},{v:80,l:'80'}]} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { label:'MACD', value: ind.macd?.bullish ? '▲ Bullish' : '▼ Bearish', color: ind.macd?.bullish ? 'text-accent-green' : 'text-accent-red', tipId:'macd', edu: eduMode ? EDU_LINES.macd(ind.macd) : null },
                  { label:'EMA-20', value:`$${ind.ema20}`, color: setup.price > ind.ema20 ? 'text-accent-green' : 'text-accent-red', tipId:'ema', edu: eduMode ? (setup.price > ind.ema20 ? 'Price is above the 20-day average — short-term trend is up ✓' : 'Price is below the 20-day average — short-term trend is down') : null },
                  { label:'EMA-50', value:`$${ind.ema50}`, color: setup.price > ind.ema50 ? 'text-accent-green' : 'text-accent-red', tipId:'ema', edu: eduMode ? (setup.price > ind.ema50 ? 'Price is above the 50-day average — medium-term trend is up ✓' : 'Price is below the 50-day average — medium-term trend is down') : null },
                ].map(r => (
                  <div key={r.label} className="bg-surface-2 rounded-xl p-2.5 border border-border">
                    <p className="text-[9px] text-muted">{r.label}<Tip id={r.tipId} /></p>
                    <p className={`text-sm font-mono font-bold ${r.color}`}>{r.value}</p>
                    {r.edu && <p className="text-[9px] text-accent-green mt-1 italic leading-relaxed">{r.edu}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Support & Resistance */}
          {levels && (
            <div>
              <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">📐 Support & Resistance<Tip id="sr" /></h4>
              <div className="space-y-1 mb-3">
                {[
                  { label:'R2', value:levels.r2, type:'resistance', note:'Major resistance ceiling' },
                  { label:'R1', value:levels.r1, type:'resistance', note:'Nearest resistance — TP1 target' },
                  { label:'▶',  value:setup.price, type:'current', note:'Current price' },
                  { label:'S1', value:levels.s1, type:'support', note:'First support floor' },
                  { label:'S2', value:levels.s2, type:'support', note:'Key support — stop-loss zone' },
                ].map(row => (
                  <div key={row.label} className={`flex items-center gap-2 py-1.5 px-3 rounded-lg ${
                    row.type==='current' ? 'bg-accent-green/10 border border-accent-green/30' :
                    row.type==='resistance' ? 'border-l-4 border-accent-red/50 bg-surface-2' : 'border-l-4 border-accent-green/50 bg-surface-2'}`}>
                    <span className={`text-[10px] font-bold w-5 shrink-0 ${row.type==='current'?'text-accent-green':row.type==='resistance'?'text-accent-red':'text-accent-green'}`}>{row.label}</span>
                    <span className="text-xs font-mono font-bold text-white">${row.value?.toFixed(2)}</span>
                    <span className="text-[9px] text-muted">{row.note}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {[{label:'38.2%',v:levels.fib382},{label:'50%',v:levels.fib500},{label:'61.8%',v:levels.fib618}].map(f => (
                  <div key={f.label} className="bg-surface-2 rounded-lg px-3 py-2 border border-border text-center">
                    <p className="text-[9px] text-accent-yellow font-bold">Fib {f.label}<Tip id="fib" /></p>
                    <p className="text-xs font-mono text-white">${f.v?.toFixed(2)}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label:'Entry Zone', value:`$${levels.entryLo}–${setup.entry}`, color:'text-accent-green' },
                  { label:'Stop Loss', value:`$${setup.stop}`, color:'text-accent-red' },
                  { label:`R:R 1:${setup.rr}`, value:`TP1 $${setup.tp1}`, color:'text-accent-yellow' },
                ].map(r => (
                  <div key={r.label} className="bg-surface-2 rounded-xl p-2.5 border border-border text-center">
                    <p className="text-[9px] text-muted">{r.label}</p>
                    <p className={`text-xs font-mono font-bold ${r.color}`}>{r.value}</p>
                  </div>
                ))}
              </div>
              {eduMode && <p className="text-[10px] text-accent-green mt-2 italic">Entry between ${levels.entryLo}–${setup.entry}. If price falls to ${setup.stop}, exit immediately — no exceptions. That loss keeps you in the game for tomorrow.</p>}
            </div>
          )}

          {/* Historical Key Moves */}
          {setup.keyMoves?.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
                ⚡ Historical Key Moves (5%+)<Tip id="keyMoves" />
              </h4>
              {eduMode && <p className="text-[10px] text-accent-green mb-2 italic">These are the biggest moves in the last 90 days. Understanding what caused them helps you predict how the stock will react to similar news in future.</p>}
              <div className="space-y-2">
                {setup.keyMoves.map((m: any, i: number) => (
                  <div key={i} className={`flex items-start gap-3 p-2.5 rounded-xl border ${m.pct > 0 ? 'bg-accent-green/5 border-accent-green/20' : 'bg-accent-red/5 border-accent-red/20'}`}>
                    <div className="shrink-0 text-center min-w-12">
                      <p className={`text-sm font-mono font-bold ${m.pct > 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                        {m.pct > 0 ? '+' : ''}{m.pct}%
                      </p>
                      <p className="text-[9px] text-muted">{m.date}</p>
                      <p className="text-[9px] text-muted">{m.volume_ratio}× vol</p>
                    </div>
                    <p className="text-[11px] text-secondary leading-relaxed pt-0.5">{m.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Position sizing */}
          <div className="bg-surface-2 rounded-xl p-3 border border-border">
            <h4 className="text-xs font-bold text-white mb-2">💰 Position Sizing (based on $10k capital, 3% risk)</h4>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><p className="text-[9px] text-muted">Shares</p><p className="text-sm font-bold text-white">{setup.shares}</p></div>
              <div><p className="text-[9px] text-muted">Position value</p><p className="text-sm font-bold text-white">${setup.positionValue?.toFixed(0)}</p></div>
              <div><p className="text-[9px] text-muted">Max loss</p><p className="text-sm font-bold text-accent-red">${setup.maxLoss?.toFixed(0)}</p></div>
            </div>
            {eduMode && <p className="text-[10px] text-accent-green mt-2 italic">The 3% rule: never risk more than 3% of your total capital on a single trade. This keeps one bad trade from hurting your account meaningfully.</p>}
          </div>

        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TradingAgentPage() {
  const [mode, setMode]             = useState<'auto'|'manual'>('auto');
  const [manualTicker, setManualTicker] = useState('');
  const [priceRanges, setPriceRanges]   = useState(['small','medium','large','big']);
  const [result, setResult]         = useState<any>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string|null>(null);
  const [eduMode, setEduMode]       = useState(() => { try { return localStorage.getItem('ziqron_edu') !== 'off'; } catch { return true; } });
  const [certLoading, setCertLoading] = useState<string|null>(null);

  function toggleEdu() {
    const next = !eduMode;
    setEduMode(next);
    try { localStorage.setItem('ziqron_edu', next ? 'on' : 'off'); } catch {}
  }

  function toggleRange(r: string) {
    setPriceRanges(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  }

  const scan = useCallback(async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const body: any = { price_ranges: priceRanges, capital: 10000 };
      if (mode === 'manual' && manualTicker.trim()) body.specific_ticker = manualTicker.trim().toUpperCase();
      const res  = await fetch('/api/trading-agent', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.error) { setError(json.error); return; }
      setResult(json);
    } catch { setError('Failed to connect. Please try again.'); }
    finally   { setLoading(false); }
  }, [mode, manualTicker, priceRanges]);

  async function certify(ticker: string, verdict: string) {
    setCertLoading(ticker);
    const existing = result?.setups?.find((s: any) => s.ticker === ticker)?.userCert;
    const isActive = existing?.user_verdict === verdict;
    await fetch(`/api/stocks/${ticker}/halal-cert`, {
      method:  isActive ? 'DELETE' : 'POST',
      headers: {'Content-Type':'application/json'},
      body:    isActive ? undefined : JSON.stringify({ user_verdict: verdict }),
    });
    await scan();
    setCertLoading(null);
  }

  const ranges = [
    { id:'small',  label:'Small',  sub:'< $25'      },
    { id:'medium', label:'Medium', sub:'$26–$100'   },
    { id:'large',  label:'Large',  sub:'$101–$200'  },
    { id:'big',    label:'Big',    sub:'$201+'      },
  ];

  return (
    <div className="space-y-5 page-enter">

      {/* ── Gharar disclaimer ─────────────────────────────────────────────── */}
      <div className="bg-accent-green/5 border border-accent-green/20 rounded-xl p-4">
        <p className="text-xs font-bold text-accent-green mb-1">🕌 تَوَكَّلْ عَلَى اللَّه — Due Diligence is a Religious Obligation</p>
        <p className="text-[11px] text-secondary leading-relaxed">
          Islam prohibits <strong className="text-white">gharar</strong> — transactions based on excessive uncertainty or blind speculation.
          Every signal on this page is a tool for informed analysis, not a directive to buy.
          Before acting on any setup, verify the company's halal status, understand what you own, and never invest money you cannot afford to lose.
          The Prophet ﷺ said: <em>"Tie your camel, then put your trust in Allah."</em> Research first. Trust second.
        </p>
      </div>

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap size={20} className="text-accent-green" />
            Short-Term Trading Agent
          </h1>
          <p className="text-secondary text-sm mt-0.5">Scans halal stocks for momentum setups — signals, trade plans, and why each stock moves</p>
        </div>

        {/* Educational toggle */}
        <button onClick={toggleEdu}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition-all ${eduMode ? 'bg-accent-green/10 border-accent-green/30 text-accent-green' : 'border-border text-muted hover:text-white'}`}>
          <BookOpen size={14} />
          {eduMode ? '📚 Learning ON' : 'Learning OFF'}
        </button>
      </div>

      {/* ── Mode selector ─────────────────────────────────────────────────── */}
      <div className="card p-4">
        <div className="flex gap-2 mb-4">
          {[{id:'auto',label:'🔍 Auto Scan',sub:'Scan halal universe'},{id:'manual',label:'🎯 Evaluate Ticker',sub:'Enter any stock'}].map(m => (
            <button key={m.id} onClick={() => setMode(m.id as 'auto'|'manual')}
              className={`flex-1 rounded-xl p-3 border text-left transition-all ${mode===m.id?'bg-accent-green/10 border-accent-green/30':'border-border hover:bg-surface-2'}`}>
              <p className={`text-sm font-bold ${mode===m.id?'text-accent-green':'text-white'}`}>{m.label}</p>
              <p className="text-[10px] text-muted">{m.sub}</p>
            </button>
          ))}
        </div>

        {/* Manual ticker input */}
        {mode === 'manual' && (
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1 max-w-xs">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input value={manualTicker} onChange={e => setManualTicker(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && scan()}
                placeholder="Enter ticker — e.g. HIMS, ZETA, RKLB"
                className="input w-full pl-9 font-mono" autoComplete="off" />
            </div>
          </div>
        )}

        {/* Price range filter */}
        <div className="mb-4">
          <p className="text-[10px] text-muted uppercase tracking-wide mb-2 font-semibold">Price Range Filter</p>
          <div className="flex gap-2 flex-wrap">
            {ranges.map(r => (
              <button key={r.id} onClick={() => toggleRange(r.id)}
                className={`flex flex-col items-center px-3 py-2 rounded-xl border text-center transition-all ${priceRanges.includes(r.id)?'bg-accent-green/10 border-accent-green/30':'border-border hover:bg-surface-2'}`}>
                <span className={`text-xs font-bold ${priceRanges.includes(r.id)?'text-accent-green':'text-white'}`}>{r.label}</span>
                <span className="text-[9px] text-muted">{r.sub}</span>
              </button>
            ))}
            <button onClick={() => setPriceRanges(ranges.map(r => r.id))}
              className="px-3 py-2 rounded-xl border border-border text-xs text-muted hover:text-white hover:bg-surface-2 transition-all">All</button>
          </div>
        </div>

        <button onClick={scan} disabled={loading || priceRanges.length === 0}
          className="btn-primary w-full flex items-center justify-center gap-2">
          {loading ? <><Loader2 size={14} className="animate-spin" /> Scanning…</> : <><Zap size={14} /> {mode==='manual'&&manualTicker?`Evaluate ${manualTicker}`:'Run Scan'}</>}
        </button>
      </div>

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && <div className="card border border-accent-red/20 bg-accent-red/5 p-4 text-sm text-accent-red">{error}</div>}

      {/* ── Results ───────────────────────────────────────────────────────── */}
      {result && !loading && (
        <div className="space-y-4">

          {/* Summary bar */}
          <div className="flex items-center justify-between flex-wrap gap-2 px-1">
            {result.signal === 'SETUPS_FOUND' ? (
              <>
                <p className="text-sm font-semibold text-white">
                  Found <span className="text-accent-green">{result.found}</span> setup{result.found !== 1 ? 's' : ''} from <span className="text-accent-green">{result.scanned}</span> stocks scanned
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted">{new Date(result.generated_at).toLocaleTimeString()}</span>
                  <button onClick={scan} className="btn-ghost text-xs flex items-center gap-1"><RefreshCw size={11} /> Refresh</button>
                </div>
              </>
            ) : (
              <div className="w-full">
                <p className="text-sm font-semibold text-accent-yellow mb-1">🛡️ No setups found — capital preserved</p>
                <p className="text-xs text-secondary">{result.reason}</p>
                {result.reject_sample?.length > 0 && (
                  <p className="text-[10px] text-muted mt-2">Sample rejections: {result.reject_sample.join(' · ')}</p>
                )}
              </div>
            )}
          </div>

          {/* Setup cards */}
          {result.setups?.map((setup: any) => (
            <SetupCard key={setup.ticker} setup={setup} eduMode={eduMode} onCertify={certify} certLoading={certLoading} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && (
        <div className="flex flex-col items-center py-20 text-center">
          <Zap size={36} className="text-muted mb-3" />
          <h2 className="text-base font-semibold text-white mb-1">Ready to scan</h2>
          <p className="text-xs text-secondary max-w-sm">
            Select a price range and run the scan to find halal stocks currently showing momentum signals. Or enter a specific ticker to evaluate it directly.
          </p>
        </div>
      )}
    </div>
  );
}
