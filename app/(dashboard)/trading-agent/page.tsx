'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  Zap, Search, Loader2, TrendingUp, TrendingDown, Info,
  ChevronDown, ChevronUp, CheckCircle2, XCircle, AlertCircle,
  RefreshCw, BookOpen, ExternalLink, BarChart2, Calendar,
  Brain, Shield, Target, Activity, AlertTriangle,
} from 'lucide-react';

const PriceChart = dynamic(() => import('@/components/charts/PriceChart'), { ssr: false });

// ── Tooltips ──────────────────────────────────────────────────────────────────
const TIPS: Record<string,string> = {
  confidence: 'Score (1–10): how many of our 5 signal criteria this setup meets. 4 = minimum to qualify. 6+ = strong. 8+ = high conviction.',
  rsi:        'RSI (0–100): momentum fatigue meter. 0–30 = oversold (watch for bounce). 30–50 = neutral. 50–65 = healthy ✓. 65–78 = elevated. 78+ = overbought (we reject these).',
  macd:       'MACD: compares two moving averages to detect momentum direction. Bullish = short-term avg crossing above long-term. Expanding histogram = accelerating.',
  atr:        'ATR (Average True Range): how much the stock typically moves in one day. We set stops at 1.5×ATR below entry and targets at 2×ATR above.',
  volume:     'Volume ratio: today vs 20-day average. Below 1.3× = weak signal. 1.3–2× = confirmed ✓. 2×+ = strong institutional interest.',
  ema20:      'EMA-20: 20-day moving average. Price above = short-term uptrend. Acts as first support on pullbacks.',
  ema50:      'EMA-50: 50-day moving average. Price above both EMA-20 and EMA-50 = fully bullish trend alignment ✓.',
  adx:        'ADX: trend strength meter — not direction. Below 20 = sideways chop. 20–30 = developing. 30–50 = strong trend ✓. 50+ = very strong.',
  stoch:      'Stochastic: where is price in its recent high-low range. Below 20 = oversold. Above 80 = overbought. %K crossing %D = signal.',
  sr:         'Support = price floor where buyers stepped in historically. Resistance = price ceiling where sellers pushed back. More tests = stronger level.',
  fib:        'Fibonacci retracement levels (38.2%, 50%, 61.8%) from recent swing high/low. Used globally by institutions — becomes self-fulfilling.',
  rr:         'Risk:Reward. A 1:2 ratio means you risk $1 to potentially make $2. Never enter a trade below 1:1.5 R:R.',
  entry:      'Entry zone: the price range where you place your buy order. Breakout setups enter slightly above current price to confirm the break. Dip buys enter slightly below.',
  stop:       'Stop-loss: exit price if wrong. Non-negotiable. Calculated at 1.5×ATR below entry to give the trade breathing room without risking too much.',
  tp1:        'Take-profit 1: first target at 2×ATR above entry. At this point move your stop to breakeven — you now have a risk-free trade.',
  keyMoves:   '5%+ moves in the last 90 days. The reason tells you what type of news moves this stock so you know what to watch for.',
  earnings:   'Earnings call date (estimated). Trading into earnings is a binary bet — the stock can swing 10-20% either way regardless of technicals.',
  marketCap:  'Total value of all shares. Large cap = more stable. Small cap = more volatile but higher upside potential.',
  pe:         'Price/Earnings ratio. How much investors pay per dollar of profit. Context-dependent — compare within same sector.',
  beta:       'How much this stock amplifies market moves. Beta 2 = moves twice as much as S&P 500. Higher beta = need smaller position size.',
  grossMargin:'Revenue minus cost of goods. High gross margin = pricing power and scalable business model.',
  netMargin:  'Profit after all expenses as % of revenue. Positive and growing = healthy business.',
  shortInt:   'Short interest: what % of float is sold short. High short interest + strong move = potential short squeeze amplifier.',
  float:      'Float: shares available for public trading. Low float = price can move more dramatically on lower volume.',
  capital:    'Adjust capital to calculate how many shares to buy and your maximum dollar risk (capped at 3% of entered capital).',
};

// ── Educational 1-liners ──────────────────────────────────────────────────────
const EDU: Record<string,(v:any)=>string> = {
  rsi:    v=>v<30?`RSI ${v} — fell hard, watching for bounce signal`
               :v<50?`RSI ${v} — recovering, no strong momentum yet`
               :v<65?`RSI ${v} — healthy building momentum, good zone ✓`
               :v<78?`RSI ${v} — getting hot, consider reducing size`
               :`RSI ${v} — overbought, high pullback risk`,
  volume: v=>v>=2?`${v}× — institutions actively trading today`
               :v>=1.3?`${v}× — more than usual, move is confirmed`
               :`${v}× — below our 1.3× threshold, weak conviction`,
  macd:   v=>v?.bullish?'MACD bullish — short-term momentum accelerating upward'
               :'MACD bearish — momentum fading or reversing downward',
  adx:    v=>v<20?`ADX ${v} — sideways chop, momentum plays risky`
               :v<30?`ADX ${v} — trend developing, watch for confirmation`
               :`ADX ${v} — strong trend confirmed, good momentum environment`,
  stoch:  v=>v<20?`Stochastic ${v} — oversold, watch for %K crossover`
               :v>80?`Stochastic ${v} — overbought, momentum may exhaust`
               :`Stochastic ${v} — neutral zone`,
  ema20:  (v:{price:number;ema:number})=>v.price>v.ema?'Price above 20-day avg — short-term uptrend ✓':'Price below 20-day avg — short-term downtrend',
  ema50:  (v:{price:number;ema:number})=>v.price>v.ema?'Price above 50-day avg — medium-term uptrend ✓':'Price below 50-day avg — medium-term downtrend',
  atr:    (v:{atr:number;pct:number})=>`Moves ~$${v.atr.toFixed(2)} (${v.pct}%) per day. Stop placed 1.5× below entry — wide enough to breathe.`,
};

// ── Gauge ─────────────────────────────────────────────────────────────────────
interface Zone{from:number;to:number;hex:string;alpha:number}
function Gauge({label,value,min,max,zones,ticks,tipKey,eduMode,eduVal}:{
  label:string;value:number;min:number;max:number;zones:Zone[];ticks:{v:number;l:string}[];tipKey:string;eduMode:boolean;eduVal?:any
}){
  const clamp=Math.min(max,Math.max(min,value));
  const pct=((clamp-min)/(max-min))*100;
  const zone=zones.find(z=>clamp>=z.from&&clamp<=z.to)??zones[zones.length-1];
  return(
    <div className="bg-surface-2 rounded-xl p-3 border border-border">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-muted uppercase tracking-wide font-semibold flex items-center gap-1">{label}<T id={tipKey}/></span>
        <span className="text-sm font-mono font-bold" style={{color:zone.hex}}>{typeof value==='number'?value>=10?Math.round(value):value.toFixed(1):value}</span>
      </div>
      <div className="relative h-3 rounded-full overflow-hidden bg-surface-3">
        {zones.map((z,i)=>(
          <div key={i} className="absolute top-0 h-full" style={{left:`${((z.from-min)/(max-min))*100}%`,width:`${((z.to-z.from)/(max-min))*100}%`,backgroundColor:z.hex,opacity:z.alpha}}/>
        ))}
        <div className="absolute top-0 h-full w-0.5 z-10" style={{left:`${pct}%`,backgroundColor:'rgba(255,255,255,0.95)',transform:'translateX(-50%)'}}/>
      </div>
      <div className="relative mt-1 h-3">
        {ticks.map((t,i)=>(
          <span key={i} className="absolute text-[8px] text-muted" style={{left:`${((t.v-min)/(max-min))*100}%`,transform:'translateX(-50%)'}}>{t.l}</span>
        ))}
      </div>
      {eduMode&&EDU[tipKey]&&<p className="text-[10px] text-accent-green mt-2 pt-1.5 border-t border-border italic leading-relaxed">{EDU[tipKey](eduVal??value)}</p>}
    </div>
  );
}

const RSI_Z:Zone[]=[{from:0,to:30,hex:'#3b82f6',alpha:.7},{from:30,to:50,hex:'#eab308',alpha:.55},{from:50,to:65,hex:'#10b981',alpha:.85},{from:65,to:78,hex:'#eab308',alpha:.55},{from:78,to:100,hex:'#ef4444',alpha:.7}];
const STOCH_Z:Zone[]=[{from:0,to:20,hex:'#3b82f6',alpha:.7},{from:20,to:80,hex:'#10b981',alpha:.6},{from:80,to:100,hex:'#ef4444',alpha:.7}];
const ADX_Z:Zone[]=[{from:0,to:20,hex:'#ef4444',alpha:.6},{from:20,to:30,hex:'#eab308',alpha:.6},{from:30,to:50,hex:'#10b981',alpha:.85},{from:50,to:60,hex:'#eab308',alpha:.6}];
const VOL_Z:Zone[]=[{from:0,to:1,hex:'#ef4444',alpha:.6},{from:1,to:1.3,hex:'#eab308',alpha:.6},{from:1.3,to:2,hex:'#10b981',alpha:.75},{from:2,to:3,hex:'#10b981',alpha:1}];

// ── Tooltip ───────────────────────────────────────────────────────────────────
function T({id}:{id:string}){
  const[open,setOpen]=useState(false);
  const txt=TIPS[id];
  if(!txt)return null;
  return(
    <div className="relative inline-block">
      <button onClick={e=>{e.stopPropagation();setOpen(o=>!o)}} className="text-muted hover:text-accent-green ml-0.5 align-middle transition-colors"><Info size={10}/></button>
      {open&&(<>
        <div className="fixed inset-0 z-40" onClick={()=>setOpen(false)}/>
        <div className="absolute z-50 left-0 top-5 w-56 bg-surface-2 border border-border rounded-xl p-3 shadow-xl">
          <p className="text-[10px] text-secondary leading-relaxed">{txt}</p>
        </div>
      </>)}
    </div>
  );
}

// ── Halal badge ───────────────────────────────────────────────────────────────
function HalalBadge({setup,onCertify,certLoading,canEdit}:{setup:any;onCertify:(t:string,v:string)=>void;certLoading:string|null;canEdit:boolean}){
  const v=setup.userCert?.user_verdict;
  const pre=setup.meta?.halal==='high';
  const CFG={halal:{l:'Halal',c:'text-accent-green',bg:'bg-accent-green/10 border-accent-green/25',I:CheckCircle2},haram:{l:'Haram',c:'text-accent-red',bg:'bg-accent-red/10 border-accent-red/25',I:XCircle},doubtful:{l:'Doubtful',c:'text-accent-yellow',bg:'bg-accent-yellow/10 border-accent-yellow/25',I:AlertCircle}};
  const cfg=v?CFG[v as keyof typeof CFG]:null;
  return(
    <div className="flex flex-col gap-1">
      {v&&cfg?(<div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border ${cfg.bg}`}><cfg.I size={12} className={cfg.c}/><span className={`text-xs font-bold ${cfg.c}`}>{cfg.l}</span>{canEdit&&<button onClick={()=>onCertify(setup.ticker,v)} className="text-[9px] text-muted hover:text-white ml-1">✕</button>}</div>)
      :pre?(<div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border bg-accent-green/5 border-accent-green/20"><Shield size={12} className="text-accent-green"/><span className="text-[10px] text-accent-green font-semibold">Pre-screened Halal</span><a href={`https://musaffa.com/stock/${setup.ticker}`} target="_blank" rel="noopener noreferrer" className="ml-1"><ExternalLink size={9} className="text-muted hover:text-accent-green"/></a></div>)
      :(<div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border bg-accent-yellow/5 border-accent-yellow/20"><AlertCircle size={12} className="text-accent-yellow"/><span className="text-[10px] text-accent-yellow font-semibold">Verify halal status</span><a href={`https://musaffa.com/stock/${setup.ticker}`} target="_blank" rel="noopener noreferrer" className="ml-1"><ExternalLink size={9} className="text-muted hover:text-accent-yellow"/></a></div>)}
      {canEdit&&(certLoading===setup.ticker?<Loader2 size={10} className="animate-spin text-muted"/>:
        <div className="flex gap-1">{['halal','haram','doubtful'].map(vv=>(
          <button key={vv} onClick={()=>onCertify(setup.ticker,vv)} className={`text-[9px] px-1.5 py-0.5 rounded border border-border capitalize transition-colors ${v===vv?'text-accent-green border-accent-green/30':'text-muted hover:text-white'}`}>{vv}</button>
        ))}</div>
      )}
    </div>
  );
}

// ── Setup card ────────────────────────────────────────────────────────────────
function SetupCard({setup,eduMode,onCertify,certLoading}:{setup:any;eduMode:boolean;onCertify:(t:string,v:string)=>void;certLoading:string|null}){
  const[expanded,setExpanded]=useState(false);
  const[showChart,setShowChart]=useState(false);
  const[chartData,setChartData]=useState<any[]>(setup.chartData??[]);
  const[capital,setCapital]=useState(10000);
  const ind=setup.indicators??{};
  const levels=setup.levels;
  const chg=setup.change??0;
  const chgPos=chg>=0;
  const daysToEarnings=setup.earningsDate?Math.round((new Date(setup.earningsDate).getTime()-Date.now())/86400000):null;
  const earningsWarning=daysToEarnings!==null&&daysToEarnings<=7&&daysToEarnings>=0;
  const noSignal=!!setup.no_signal;

  // Live position calc from user-entered capital
  const atr=ind.atr??setup.levels?.atr??1;
  const stopDist=atr*1.5;
  const liveShares=Math.max(1,Math.floor((capital*0.03)/Math.max(0.01,stopDist)));
  const liveEntry=setup.entry??setup.price;
  const liveStop=parseFloat((liveEntry-stopDist).toFixed(2));
  const liveTp1=parseFloat((liveEntry+atr*2).toFixed(2));
  const livePositionVal=parseFloat((liveShares*liveEntry).toFixed(2));
  const liveMaxLoss=parseFloat((liveShares*stopDist).toFixed(2));

  async function loadChart(){
    if(chartData.length>0){setShowChart(s=>!s);return;}
    const res=await fetch(`/api/stocks/${setup.ticker}/history?period=3mo`);
    const json=await res.json();
    setChartData(json.history??[]);
    setShowChart(true);
  }

  const setupColor=setup.setup_type==='Momentum Breakout'?'badge-green':setup.setup_type==='Dip Buy Reversal'?'badge-blue':'badge-yellow';
  const confColor=setup.confidence>=7?'text-accent-green':setup.confidence>=5?'text-accent-yellow':'text-muted';

  function fmtVol(n:number){if(!n)return'N/A';if(n>=1e9)return`${(n/1e9).toFixed(1)}B`;if(n>=1e6)return`${(n/1e6).toFixed(1)}M`;if(n>=1e3)return`${(n/1e3).toFixed(0)}K`;return String(n);}

  return(
    <div className="card p-0 overflow-hidden border border-border">

      {/* Earnings warning */}
      {earningsWarning&&(
        <div className="bg-accent-yellow/10 border-b border-accent-yellow/20 px-4 py-2 flex items-center gap-2">
          <Calendar size={12} className="text-accent-yellow shrink-0"/>
          <p className="text-[11px] text-accent-yellow font-semibold">
            ⚠️ Earnings Call in {daysToEarnings} day{daysToEarnings!==1?'s':''} ({setup.earningsDate}) — trading into earnings is a binary bet, not a momentum trade
          </p>
        </div>
      )}

      {/* No-signal banner */}
      {noSignal&&(
        <div className="bg-accent-yellow/5 border-b border-accent-yellow/20 px-4 py-2 flex items-center gap-2">
          <AlertTriangle size={12} className="text-accent-yellow shrink-0"/>
          <p className="text-[11px] text-accent-yellow">{setup.reason_rejected}</p>
        </div>
      )}

      <div className="p-4 space-y-3">

        {/* Header row */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xl font-bold text-white font-mono">{setup.ticker}</span>
              {!noSignal&&<span className={`badge ${setupColor}`}>{setup.setup_type}</span>}
              <span className="badge badge-neutral text-[9px]">{setup.meta?.sector}</span>
              {setup.earningsDate&&(
                <span className="badge badge-neutral text-[9px] flex items-center gap-1">
                  <Calendar size={8}/> Earnings Call {setup.earningsDate}
                </span>
              )}
            </div>
            <p className="text-xs text-secondary">{setup.meta?.description}</p>
          </div>
          <HalalBadge setup={setup} onCertify={onCertify} certLoading={certLoading} canEdit={setup.canEdit}/>
        </div>

        {/* Price + confidence */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-2xl font-bold text-white font-mono">${setup.price?.toFixed(2)}</span>
          <span className={`text-sm font-semibold flex items-center gap-0.5 ${chgPos?'text-accent-green':'text-accent-red'}`}>
            {chgPos?<TrendingUp size={13}/>:<TrendingDown size={13}/>}{chgPos?'+':''}{chg?.toFixed(2)}%
          </span>
          {!noSignal&&<span className={`text-xs font-bold ${confColor}`}>Signal {setup.confidence}/10<T id="confidence"/></span>}
        </div>

        {/* Signal factors + catalyst headlines */}
        {!noSignal&&setup.factors?.length>0&&(
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-1.5">
              {setup.factors.map((f:string,i:number)=>(
                <span key={i} className="text-[10px] bg-accent-green/10 text-accent-green px-2 py-0.5 rounded-full border border-accent-green/20">✓ {f}</span>
              ))}
            </div>
            {setup.catalystHeadlines?.length>0&&(
              <div className="bg-accent-green/5 border border-accent-green/15 rounded-xl p-2.5">
                <p className="text-[10px] text-accent-green font-semibold mb-1">📰 Recent bullish news:</p>
                {setup.catalystHeadlines.map((h:string,i:number)=>(
                  <p key={i} className="text-[10px] text-secondary leading-relaxed">• {h}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Chart */}
        <div className="flex gap-2">
          <button onClick={loadChart} className="btn-secondary text-xs flex items-center gap-1.5">
            <BarChart2 size={12}/>{showChart?'Hide':'Show'} Chart
          </button>
          <button onClick={()=>setExpanded(e=>!e)} className="btn-secondary text-xs flex items-center gap-1.5">
            {expanded?<ChevronUp size={12}/>:<ChevronDown size={12}/>}{expanded?'Less':'Full analysis'}
          </button>
        </div>

        {showChart&&chartData.length>0&&(
          <div className="border-t border-border pt-3">
            <PriceChart ticker={setup.ticker} initialData={chartData} currentPrice={setup.price}/>
          </div>
        )}

        {/* S&R + Trade Plan — consolidated directly below chart */}
        {levels&&!noSignal&&(
          <div className="bg-surface-2 rounded-xl p-3 border border-border space-y-2">
            <p className="text-[10px] text-muted font-semibold uppercase tracking-wide">Trade Levels<T id="sr"/></p>
            <div className="space-y-1">
              {[
                {label:'R2',v:levels.r2,type:'r',note:'Major resistance'},
                {label:'R1 / TP1',v:setup.tp1??levels.r1,type:'r',note:'Target 1'},
                {label:'Entry',v:`$${setup.entryLo}–${setup.entryHi}`,type:'e',note:'Entry zone'},
                {label:'Price now',v:setup.price,type:'c',note:'Current price'},
                {label:'Stop',v:setup.stop,type:'s',note:'Exit if wrong'},
                {label:'S1',v:levels.s1,type:'s',note:'Key support'},
              ].map(row=>(
                <div key={row.label} className={`flex items-center gap-2 px-2 py-1 rounded-lg text-[11px] ${row.type==='c'?'bg-accent-green/10 border border-accent-green/30':row.type==='e'?'bg-accent-blue/10 border border-accent-blue/20':row.type==='r'?'border-l-2 border-accent-red/50':'border-l-2 border-accent-green/50'}`}>
                  <span className={`font-bold w-16 shrink-0 ${row.type==='c'?'text-accent-green':row.type==='e'?'text-accent-blue':row.type==='r'?'text-accent-red':'text-accent-green'}`}>{row.label}</span>
                  <span className="font-mono font-bold text-white">{typeof row.v==='number'?`$${row.v.toFixed(2)}`:row.v}</span>
                  <span className="text-muted text-[9px]">{row.note}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              {[{l:'Fib 38.2%',v:levels.fib382},{l:'Fib 50%',v:levels.fib500},{l:'Fib 61.8%',v:levels.fib618}].map(f=>(
                <div key={f.l} className="text-center bg-surface-3 rounded-lg px-2 py-1.5 border border-border flex-1">
                  <p className="text-[8px] text-accent-yellow font-bold">{f.l}<T id="fib"/></p>
                  <p className="text-[10px] font-mono text-white">${f.v?.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Capital input + position sizing */}
        {!noSignal&&(
          <div className="bg-surface-2 rounded-xl p-3 border border-border">
            <div className="flex items-center gap-3 mb-3">
              <p className="text-[10px] text-muted font-semibold uppercase tracking-wide">Position Sizing<T id="capital"/></p>
              <div className="flex items-center gap-1.5 ml-auto">
                <span className="text-[10px] text-muted">Capital $</span>
                <input
                  type="number" value={capital} min={100} step={500}
                  onChange={e=>setCapital(Math.max(100,parseInt(e.target.value)||10000))}
                  className="input w-28 text-xs font-mono py-1 px-2"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              {[
                {l:'Entry price',v:`$${liveEntry.toFixed(2)}`,c:'text-white',tip:'entry'},
                {l:'Stop loss',v:`$${liveStop.toFixed(2)}`,c:'text-accent-red',tip:'stop'},
                {l:'Target 1',v:`$${liveTp1.toFixed(2)}`,c:'text-accent-green',tip:'tp1'},
                {l:`R:R 1:${setup.rr}`,v:`${setup.holdDays}`,c:'text-accent-yellow',tip:'rr'},
                {l:'Shares',v:String(liveShares),c:'text-white',tip:'capital'},
                {l:'Position value',v:`$${livePositionVal.toLocaleString()}`,c:'text-white',tip:'capital'},
                {l:'Max loss (3%)',v:`$${liveMaxLoss.toFixed(0)}`,c:'text-accent-red',tip:'capital'},
                {l:'Target 2',v:`$${(liveEntry+atr*3.5).toFixed(2)}`,c:'text-accent-green',tip:'tp1'},
              ].map(r=>(
                <div key={r.l} className="bg-surface-3 rounded-xl p-2 border border-border">
                  <p className="text-[8px] text-muted">{r.l}<T id={r.tip}/></p>
                  <p className={`text-xs font-mono font-bold ${r.c}`}>{r.v}</p>
                </div>
              ))}
            </div>
            {eduMode&&<p className="text-[10px] text-accent-green mt-2 italic">3% rule: with ${capital.toLocaleString()} capital your max loss per trade is ${(capital*0.03).toFixed(0)}. Never risk more than this regardless of how good the setup looks.</p>}
          </div>
        )}
      </div>

      {/* Expanded analysis */}
      {expanded&&(
        <div className="border-t border-border p-4 space-y-4">

          {/* Core Identity */}
          {setup.meta?.behavior&&(
            <div>
              <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5"><Brain size={12} className="text-accent-green"/>Core Identity & Why It Moves</h4>
              <div className="bg-surface-2 rounded-xl p-3 border border-border space-y-1.5 text-[11px]">
                <p><span className="text-muted">Primary driver: </span><span className="text-secondary">{setup.meta.behavior.primary}</span></p>
                <p><span className="text-muted">Pattern: </span><span className="text-secondary">{setup.meta.behavior.pattern}</span></p>
                <p><span className="text-muted">Avoid when: </span><span className="text-accent-red">{setup.meta.behavior.avoid}</span></p>
                <p><span className="text-muted">Best for: </span><span className="text-accent-green">{setup.meta.behavior.best}</span></p>
              </div>
            </div>
          )}

          {/* Volatility */}
          <div>
            <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5"><Activity size={12} className="text-accent-yellow"/>Volatility Profile</h4>
            <div className="grid grid-cols-3 gap-2">
              {[
                {l:'ATR (daily $)',v:`$${ind.atr?.toFixed(2)??'N/A'}`,tip:'atr'},
                {l:'ATR % of price',v:`${ind.atrPct??0}%`,tip:'atr'},
                {l:'Avg daily move',v:`±${setup.volatility?.avgDailyPct??0}%`,tip:'atr'},
              ].map(r=>(
                <div key={r.l} className="bg-surface-2 rounded-xl p-2.5 border border-border text-center">
                  <p className="text-[9px] text-muted">{r.l}<T id={r.tip}/></p>
                  <p className="text-sm font-mono font-bold text-accent-yellow">{r.v}</p>
                </div>
              ))}
            </div>
            {eduMode&&<p className="text-[10px] text-accent-green mt-2 italic">Higher ATR = wider stops needed = smaller position size. The position calculator above already accounts for this.</p>}
          </div>

          {/* Indicator gauges */}
          {ind.rsi!=null&&(
            <div>
              <h4 className="text-xs font-bold text-white mb-3">📈 Indicator Dashboard</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                <Gauge label="RSI (14)" value={ind.rsi} min={0} max={100} zones={RSI_Z} tipKey="rsi" eduMode={eduMode} eduVal={ind.rsi} ticks={[{v:30,l:'30'},{v:50,l:'50'},{v:65,l:'65'},{v:78,l:'78'}]}/>
                <Gauge label="Volume Ratio" value={Math.min(3,ind.volR??1)} min={0} max={3} zones={VOL_Z} tipKey="volume" eduMode={eduMode} eduVal={ind.volR} ticks={[{v:1,l:'1×'},{v:1.3,l:'1.3×'},{v:2,l:'2×'}]}/>
                <Gauge label="ADX — Trend Strength" value={Math.min(60,ind.adx??20)} min={0} max={60} zones={ADX_Z} tipKey="adx" eduMode={eduMode} eduVal={ind.adx} ticks={[{v:20,l:'20'},{v:30,l:'30'},{v:50,l:'50'}]}/>
                <Gauge label="Stochastic %K" value={ind.stochK??50} min={0} max={100} zones={STOCH_Z} tipKey="stoch" eduMode={eduMode} eduVal={ind.stochK} ticks={[{v:20,l:'20'},{v:50,l:'50'},{v:80,l:'80'}]}/>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {[
                  {l:'MACD',v:ind.macd?.bullish?'▲ Bullish':'▼ Bearish',c:ind.macd?.bullish?'text-accent-green':'text-accent-red',tip:'macd',edu:eduMode?EDU.macd(ind.macd):null},
                  {l:'EMA-20',v:`$${ind.ema20}`,c:setup.price>ind.ema20?'text-accent-green':'text-accent-red',tip:'ema20',edu:eduMode?EDU.ema20({price:setup.price,ema:ind.ema20}):null},
                  {l:'EMA-50',v:`$${ind.ema50}`,c:setup.price>ind.ema50?'text-accent-green':'text-accent-red',tip:'ema50',edu:eduMode?EDU.ema50({price:setup.price,ema:ind.ema50}):null},
                ].map(r=>(
                  <div key={r.l} className="bg-surface-2 rounded-xl p-2.5 border border-border">
                    <p className="text-[9px] text-muted">{r.l}<T id={r.tip}/></p>
                    <p className={`text-sm font-mono font-bold ${r.c}`}>{r.v}</p>
                    {r.edu&&<p className="text-[9px] text-accent-green mt-1 italic leading-relaxed">{r.edu}</p>}
                  </div>
                ))}
              </div>
              {/* Volume details */}
              <div className="bg-surface-2 rounded-xl p-2.5 border border-border">
                <p className="text-[9px] text-muted mb-1.5">Volume breakdown<T id="volume"/></p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    {l:'Today',v:fmtVol(ind.todayVol)},
                    {l:'20-day avg',v:fmtVol(ind.avgVol)},
                    {l:'Ratio',v:`${ind.volR?.toFixed(1)??1}×`},
                  ].map(r=>(
                    <div key={r.l}>
                      <p className="text-[8px] text-muted">{r.l}</p>
                      <p className="text-xs font-mono font-bold text-white">{r.v}</p>
                    </div>
                  ))}
                </div>
                {eduMode&&<p className="text-[10px] text-accent-green mt-1.5 italic">{EDU.volume(ind.volR??1)}</p>}
              </div>
            </div>
          )}

          {/* Fundamentals */}
          <div>
            <h4 className="text-xs font-bold text-white mb-2">📊 Fundamentals</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                {l:'Market Cap',v:setup.fundamentals?.marketCap?`$${(setup.fundamentals.marketCap/1e9).toFixed(1)}B`:'N/A',tip:'marketCap'},
                {l:'P/E Ratio',v:setup.fundamentals?.pe?.toFixed(1)??'N/A',tip:'pe'},
                {l:'Beta',v:setup.fundamentals?.beta?.toFixed(2)??'N/A',tip:'beta'},
                {l:'52W High',v:setup.fundamentals?.high52?`$${setup.fundamentals.high52?.toFixed(2)}`:'N/A',tip:'marketCap'},
                {l:'52W Low',v:setup.fundamentals?.low52?`$${setup.fundamentals.low52?.toFixed(2)}`:'N/A',tip:'marketCap'},
                {l:'Rev Growth',v:setup.fundamentals?.revenueGrowth!=null?`${(setup.fundamentals.revenueGrowth*100).toFixed(1)}%`:'N/A',tip:'netMargin'},
                {l:'Gross Margin',v:setup.fundamentals?.grossMargin!=null?`${setup.fundamentals.grossMargin?.toFixed(1)}%`:'N/A',tip:'grossMargin'},
                {l:'Net Margin',v:setup.fundamentals?.netMargin!=null?`${setup.fundamentals.netMargin?.toFixed(1)}%`:'N/A',tip:'netMargin'},
                {l:'Revenue TTM',v:setup.fundamentals?.revenueTTM?`$${(setup.fundamentals.revenueTTM/1e6).toFixed(0)}M`:'N/A',tip:'netMargin'},
                {l:'Short Interest',v:setup.fundamentals?.shortInterest?`${setup.fundamentals.shortInterest?.toFixed(1)}%`:'N/A',tip:'shortInt'},
                {l:'Float',v:setup.fundamentals?.float?`${(setup.fundamentals.float/1e6).toFixed(0)}M`:'N/A',tip:'float'},
              ].map(r=>(
                <div key={r.l} className="bg-surface-2 rounded-xl p-2.5 border border-border">
                  <p className="text-[9px] text-muted">{r.l}<T id={r.tip}/></p>
                  <p className="text-sm font-mono font-bold text-white">{r.v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Analyst targets */}
          {setup.targets?.consensus&&(
            <div>
              <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5"><Target size={12} className="text-accent-green"/>Analyst Price Targets</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  {l:'Consensus',v:`$${setup.targets.consensus?.toFixed(2)}`,hi:true,up:setup.targets.upside},
                  {l:'High',v:`$${setup.targets.high?.toFixed(2)}`,hi:false,up:null},
                  {l:'Low',v:`$${setup.targets.low?.toFixed(2)}`,hi:false,up:null},
                  {l:'Median',v:`$${setup.targets.median?.toFixed(2)}`,hi:false,up:null},
                ].map(r=>(
                  <div key={r.l} className={`rounded-xl p-2.5 border text-center ${r.hi?'bg-accent-green/10 border-accent-green/25':'bg-surface-2 border-border'}`}>
                    <p className="text-[9px] text-muted">{r.l}</p>
                    <p className={`text-sm font-mono font-bold ${r.hi?'text-accent-green':'text-white'}`}>{r.v}</p>
                    {r.hi&&r.up!=null&&<p className={`text-[9px] font-bold ${(r.up??0)>=0?'text-accent-green':'text-accent-red'}`}>{(r.up??0)>=0?'+':''}{r.up}%</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historical key moves */}
          {setup.keyMoves?.length>0&&(
            <div>
              <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">⚡ Historical Key Moves (5%+)<T id="keyMoves"/></h4>
              {eduMode&&<p className="text-[10px] text-accent-green mb-2 italic">Understanding what caused past moves tells you what to watch for in future — earnings, FDA, Bitcoin, macro, etc.</p>}
              <div className="space-y-2">
                {setup.keyMoves.map((m:any,i:number)=>(
                  <div key={i} className={`flex items-start gap-3 p-2.5 rounded-xl border ${m.pct>0?'bg-accent-green/5 border-accent-green/20':'bg-accent-red/5 border-accent-red/20'}`}>
                    <div className="shrink-0 text-center min-w-14">
                      <p className={`text-sm font-mono font-bold ${m.pct>0?'text-accent-green':'text-accent-red'}`}>{m.pct>0?'+':''}{m.pct}%</p>
                      <p className="text-[9px] text-muted">{m.date}</p>
                      <p className="text-[9px] text-muted">{m.volume_ratio}× vol</p>
                    </div>
                    <p className="text-[11px] text-secondary leading-relaxed pt-0.5">{m.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const RANGES=[
  {id:'small',  label:'Small',   sub:'< $25'},
  {id:'medium', label:'Medium',  sub:'$26–$100'},
  {id:'large',  label:'Large',   sub:'$101–$200'},
  {id:'big',    label:'Big',     sub:'$201–$400'},
  {id:'premium',label:'Premium', sub:'$401–$700'},
  {id:'elite',  label:'Elite',   sub:'$700+'},
];

export default function TradingAgentPage(){
  const[mode,setMode]=useState<'auto'|'manual'>('auto');
  const[manualTicker,setManualTicker]=useState('');
  const[suggestions,setSuggestions]=useState<any[]>([]);
  const[showSuggest,setShowSuggest]=useState(false);
  const[priceRange,setPriceRange]=useState('medium');
  const[result,setResult]=useState<any>(null);
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState<string|null>(null);
  const[eduMode,setEduMode]=useState(()=>{try{return localStorage.getItem('ziqron_edu')!=='off';}catch{return true;}});
  const[certLoading,setCertLoading]=useState<string|null>(null);
  const debounceRef=useRef<ReturnType<typeof setTimeout>|null>(null);
  const searchRef=useRef<HTMLDivElement>(null);

  function toggleEdu(){const n=!eduMode;setEduMode(n);try{localStorage.setItem('ziqron_edu',n?'on':'off');}catch{}}

  // Autocomplete
  function handleManualInput(val:string){
    setManualTicker(val.toUpperCase());
    setShowSuggest(false);
    if(debounceRef.current)clearTimeout(debounceRef.current);
    if(val.length<1){setSuggestions([]);return;}
    debounceRef.current=setTimeout(async()=>{
      try{const res=await fetch(`/api/stocks/search?q=${encodeURIComponent(val)}`);const json=await res.json();setSuggestions(json.results??[]);setShowSuggest((json.results??[]).length>0);}catch{setSuggestions([]);}
    },280);
  }

  useEffect(()=>{
    function handle(e:MouseEvent){if(searchRef.current&&!searchRef.current.contains(e.target as Node))setShowSuggest(false);}
    document.addEventListener('mousedown',handle);return()=>document.removeEventListener('mousedown',handle);
  },[]);

  const scan=useCallback(async()=>{
    setLoading(true);setError(null);setResult(null);
    try{
      const body:any={price_range:priceRange,capital:10000};
      if(mode==='manual'&&manualTicker.trim())body.specific_ticker=manualTicker.trim();
      const res=await fetch('/api/trading-agent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const json=await res.json();
      if(json.error){setError(json.error);return;}
      setResult(json);
    }catch{setError('Connection failed. Please try again.');}
    finally{setLoading(false);}
  },[mode,manualTicker,priceRange]);

  async function certify(ticker:string,verdict:string){
    setCertLoading(ticker);
    const existing=result?.setups?.find((s:any)=>s.ticker===ticker)?.userCert;
    const isActive=existing?.user_verdict===verdict;
    await fetch(`/api/stocks/${ticker}/halal-cert`,{method:isActive?'DELETE':'POST',headers:{'Content-Type':'application/json'},body:isActive?undefined:JSON.stringify({user_verdict:verdict})});
    await scan();setCertLoading(null);
  }

  return(
    <div className="space-y-5 page-enter">

      {/* Gharar disclaimer */}
      <div className="bg-accent-green/5 border border-accent-green/20 rounded-xl p-4">
        <p className="text-xs font-bold text-accent-green mb-1">🕌 تَوَكَّلْ عَلَى اللَّه — Due Diligence is a Religious Obligation</p>
        <p className="text-[11px] text-secondary leading-relaxed">Islam prohibits <strong className="text-white">gharar</strong> — transactions based on excessive uncertainty or blind speculation. Every signal here is a tool for informed analysis, not a directive to buy. Verify halal status, understand what you own, and never invest money you cannot afford to lose. The Prophet ﷺ said: <em>"Tie your camel, then put your trust in Allah."</em></p>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Zap size={20} className="text-accent-green"/>Short-Term Trading Agent</h1>
          <p className="text-secondary text-sm mt-0.5">Signal scanner · 200+ halal stocks · 6 price tiers · Alpaca SIP data</p>
        </div>
        <button onClick={toggleEdu} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition-all ${eduMode?'bg-accent-green/10 border-accent-green/30 text-accent-green':'border-border text-muted hover:text-white'}`}>
          <BookOpen size={14}/>{eduMode?'📚 Learning ON':'Learning OFF'}
        </button>
      </div>

      {/* Controls */}
      <div className="card p-4 space-y-4">
        {/* Mode */}
        <div className="grid grid-cols-2 gap-2">
          {[{id:'auto',l:'🔍 Auto Scan',s:'Scan halal universe'},{id:'manual',l:'🎯 Evaluate Ticker',s:'Enter any stock'}].map(m=>(
            <button key={m.id} onClick={()=>setMode(m.id as 'auto'|'manual')} className={`rounded-xl p-3 border text-left transition-all ${mode===m.id?'bg-accent-green/10 border-accent-green/30':'border-border hover:bg-surface-2'}`}>
              <p className={`text-sm font-bold ${mode===m.id?'text-accent-green':'text-white'}`}>{m.l}</p>
              <p className="text-[10px] text-muted">{m.s}</p>
            </button>
          ))}
        </div>

        {/* Manual ticker with autocomplete */}
        {mode==='manual'&&(
          <div ref={searchRef} className="relative">
            <div className="relative max-w-xs">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"/>
              <input value={manualTicker} onChange={e=>handleManualInput(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&scan()} onFocus={()=>suggestions.length>0&&setShowSuggest(true)}
                placeholder="HIMS, ZETA, ALAB, NVO…" className="input w-full pl-9 font-mono" autoComplete="off"/>
            </div>
            {showSuggest&&suggestions.length>0&&(
              <div className="absolute top-11 left-0 w-64 bg-surface-2 border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                {suggestions.slice(0,7).map((s:any)=>(
                  <button key={s.ticker} onClick={()=>{setManualTicker(s.ticker);setShowSuggest(false);}} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-3 transition-colors text-left">
                    <span className="text-xs font-mono font-bold text-accent-green w-14 shrink-0">{s.ticker}</span>
                    <span className="text-[10px] text-secondary truncate">{s.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Price range — radio (one at a time) */}
        <div>
          <p className="text-[10px] text-muted uppercase tracking-wide mb-2 font-semibold">Price Range — select one</p>
          <div className="flex flex-wrap gap-2">
            {RANGES.map(r=>(
              <button key={r.id} onClick={()=>setPriceRange(r.id)}
                className={`flex flex-col items-center px-3 py-2 rounded-xl border text-center transition-all ${priceRange===r.id?'bg-accent-green/10 border-accent-green/30':'border-border hover:bg-surface-2'}`}>
                <span className={`text-xs font-bold ${priceRange===r.id?'text-accent-green':'text-white'}`}>{r.label}</span>
                <span className="text-[9px] text-muted">{r.sub}</span>
              </button>
            ))}
          </div>
          {eduMode&&<p className="text-[10px] text-accent-green mt-1.5 italic">One range at a time keeps the scan fast and focused. Small stocks are more volatile; large stocks are more stable but move slower.</p>}
        </div>

        <button onClick={scan} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
          {loading?<><Loader2 size={14} className="animate-spin"/>Scanning…</>:<><Zap size={14}/>{mode==='manual'&&manualTicker?`Evaluate ${manualTicker}`:`Scan ${RANGES.find(r=>r.id===priceRange)?.label??''} Range`}</>}
        </button>
      </div>

      {error&&<div className="card border border-accent-red/20 bg-accent-red/5 p-4 text-sm text-accent-red">{error}</div>}

      {result&&!loading&&(
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2 px-1">
            {result.signal==='SETUPS_FOUND'?(
              <>
                <p className="text-sm font-semibold text-white">Found <span className="text-accent-green">{result.found}</span> setup{result.found!==1?'s':''} · <span className="text-accent-green">{result.scanned}</span> stocks scanned</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted">{new Date(result.generated_at).toLocaleTimeString()}</span>
                  <button onClick={scan} className="btn-ghost text-xs flex items-center gap-1"><RefreshCw size={11}/>Refresh</button>
                </div>
              </>
            ):result.signal==='NO_SIGNAL'?(
              <p className="text-sm text-accent-yellow">Full analysis below — stock does not meet signal criteria right now</p>
            ):(
              <div className="w-full">
                <p className="text-sm font-semibold text-accent-yellow mb-1">🛡️ No setups found — capital preserved</p>
                <p className="text-xs text-secondary">{result.reason}</p>
                {result.reject_sample?.length>0&&<p className="text-[10px] text-muted mt-1.5">Sample: {result.reject_sample.join(' · ')}</p>}
              </div>
            )}
          </div>
          {result.setups?.map((s:any)=><SetupCard key={s.ticker} setup={s} eduMode={eduMode} onCertify={certify} certLoading={certLoading}/>)}
        </div>
      )}

      {!result&&!loading&&(
        <div className="flex flex-col items-center py-20 text-center">
          <Zap size={36} className="text-muted mb-3"/>
          <h2 className="text-base font-semibold text-white mb-1">Select a range and run the scan</h2>
          <p className="text-xs text-secondary max-w-sm">The scanner checks 200+ halal stocks for momentum signals — RSI, MACD, volume confirmation, ATR expansion, and news catalysts. Or enter a specific ticker to evaluate it.</p>
        </div>
      )}
    </div>
  );
}
