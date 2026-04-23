'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  Zap, Search, Loader2, TrendingUp, TrendingDown, Info,
  ChevronDown, ChevronUp, CheckCircle2, XCircle, AlertCircle,
  RefreshCw, BookOpen, ExternalLink, Calendar,
  Brain, Shield, Target, Activity, AlertTriangle, Trophy, PanelRight,
} from 'lucide-react';

const PriceChart = dynamic(() => import('@/components/charts/PriceChart'), { ssr: false });

// ── Date formatting: always MM/DD/YYYY ────────────────────────────────────────
function fmtDate(d:string|null|undefined):string{
  if(!d)return'';
  const parts=d.split('-');
  if(parts.length!==3)return d;
  const[y,m,day]=parts;
  return`${m}/${day}/${y}`;
}

// ── Tooltip text ──────────────────────────────────────────────────────────────
const TIPS: Record<string,string> = {
  confidence:'Score 1–10: how many signal criteria this setup meets. Strict mode requires 4+ factors, Broader mode requires 3+. 7+ = strong conviction. 9-10 = rare high-quality setup.',
  rsi:      'RSI (0–100): 0–30 = oversold (watch for bounce) · 30–50 = neutral · 50–65 = healthy momentum ✓ · 65–75 = elevated · 75+ = overbought (we reject these).',
  macd:     'MACD 8/17/9: faster version of the classic indicator. Bullish = short-term EMA crossing above long-term, with histogram expanding. Zero-line filter prevents weak signals.',
  atr:      'ATR (Average True Range): how much the stock moves on a typical day in dollars. Stop = 1.5×ATR below entry. Target 1 = 2×ATR above entry.',
  volume:   'Volume ratio vs 20-day average. Small stocks need 2×+ to confirm. Mid caps need 1.5×+. Large caps need 1.2×+.',
  ema20:    'EMA-20: 20-day moving average — short-term trend. Price above = uptrend. A rising EMA-20 (sloping up) is a stronger signal than a flat one.',
  ema50:    'EMA-50: 50-day moving average — medium-term trend. Best setups have price above EMA-9, EMA-20, and EMA-50 all aligned.',
  adx:      'ADX: trend strength — not direction. Below 20 = choppy sideways (breakouts fail here). 20–30 = developing trend. 30–50 = strong trend ✓.',
  stoch:    'Stochastic: where price sits in its recent high-low range. Below 20 = oversold. Above 80 = overbought. %K crossing %D = entry signal.',
  sr:       'Support = price floor where buyers stepped in repeatedly. Resistance = price ceiling. More tests of a level = stronger it becomes.',
  fib:      'Fibonacci retracement levels. 38.2%, 50%, 61.8% are used by institutions worldwide — becomes self-fulfilling through widespread adoption.',
  rr:       'Risk:Reward ratio. 1:1.3 means for every $1 you risk, you aim to make $1.30. Never enter a trade with R:R below 1:1.',
  entry:    'Entry zone: the PRICE RANGE where you should place your order — NOT the current price. For breakouts: set a buy-stop order at the top of this zone. For dips: set a limit order at the bottom. Current price is shown separately above.',
  stop:     'Stop-loss: the price where you exit if wrong. Set at 1.5×ATR below entry. Non-negotiable — place it before entering.',
  tp1:      'Take-profit 1: first target at 2×ATR above entry. When hit, move stop to breakeven. You now have a risk-free trade running.',
  keyMoves: '5%+ moves in the past 90 days with AI explanations. Reveals what type of catalysts move this specific stock — so you know what to watch for.',
  earnings: 'Estimated next earnings call. Trading into earnings is a binary event — stock can swing 10-20%+ either way regardless of technicals. Approach with caution.',
  marketCap:'Total market value of the company. Large cap = more stable, slower moves. Small cap = more volatile, higher potential upside.',
  pe:       'Price-to-Earnings ratio. How much investors pay per $1 of profit. Context-dependent — always compare within the same sector.',
  beta:     'Beta: how much this stock amplifies market moves. Beta 2 = moves twice the S&P 500. Higher beta needs smaller position size.',
  grossMargin:'Gross profit margin = (Revenue − Cost of Goods) ÷ Revenue. High and stable = pricing power and scalable business model.',
  netMargin: 'Net profit margin = Net income ÷ Revenue. Positive and growing = the business is profitable and improving.',
  shortInt: 'Short interest: what % of tradeable shares are sold short. High short interest + rising price = potential short squeeze, amplifying upside moves.',
  float:    'Shares available for public trading. Low float = smaller supply = price can move dramatically even on moderate volume.',
  capital:  'Your trading capital for position sizing. The 3% rule: never risk more than 3% of total capital on any single trade.',
  pdh:      'Previous Day High — the top of the "Rumers Box". Price breaking above PDH with volume = momentum confirmation for the session.',
  pdl:      'Previous Day Low — the bottom of the "Rumers Box". Price holding above PDL = support intact. Break below = warning sign.',
  pdm:      'Box Midpoint = (PDH + PDL) ÷ 2. The indecision zone between support and resistance. Avoid entering trades in the middle of the box.',
  ema9:     'EMA-9: very short-term momentum (last 9 trading days). Price above EMA-9 > EMA-20 = full short-term stack aligned. This is the earliest momentum signal.',
};

// ── Right panel educational content ──────────────────────────────────────────
const EDU_SECTIONS = [
  {
    id:'setup', label:'Signal & Setup',
    intro:'The signal engine scans for 5 criteria before qualifying a setup. Every factor shown is a reason the trade passed. Higher confidence = more criteria met.',
    items:[
      {t:'Momentum Breakout',d:'Price breaks above the 20-day high with strong volume. Buy-stop entry confirms the breakout before you commit capital.',ex:'NVDA at $105, 20-day high $104. Breakout entry at $105.45 (10% of ATR above). Stop at $102 (1.5×ATR below).'},
      {t:'Dip Buy Reversal',d:'Price has pulled back sharply (RSI < 42). You buy the dip expecting a bounce back toward trend. Limit order entry slightly below.',ex:'HIMS pulls from $32 to $27 (RSI 36). Dip entry at $26.60. Stop at $24.80. Target $29.40.'},
      {t:'News Catalyst',d:'Fresh bullish news in the past 72h with above-average volume. Market price entry at open to capture the momentum.',ex:'RKLB announces new satellite contract. Volume 3.2× average. Entry at open $18.20. Stop $16.50.'},
      {t:'Confidence Score',d:'1–10 scale. Volume always scores 1 point. Each additional qualifying factor (EMA alignment, RSI zone, MACD, ADX, stochastic) adds 1 more.',ex:'Score 4 = minimum. Score 7+ = strong setup. Score 9–10 = rare, high-conviction trade.'},
    ],
  },
  {
    id:'levels', label:'Trade Levels & R:R',
    intro:'All price levels are derived from ATR (Average True Range) — the stock\'s typical daily move. This ensures stops and targets scale correctly to each stock\'s volatility.',
    items:[
      {t:'Entry Zone',d:'ATR-scaled entry: Breakout = price + ATR×0.10. Dip buy = price − ATR×0.15. Wider zone for volatile stocks, tighter for stable ones.',ex:'Stock at $50, ATR $2. Breakout entry: $50.20. Dip entry: $49.70. Never chase price far above entry zone.'},
      {t:'Stop-Loss',d:'Set at 1.5×ATR below entry. This is the non-negotiable exit if the trade goes wrong. Place it before entering.',ex:'Entry $50.20, ATR $2. Stop = $50.20 − $3 = $47.20. If price hits $47.20, exit immediately — no second-guessing.'},
      {t:'Target 1 (TP1)',d:'First profit target at 2×ATR above entry. When hit, move stop to breakeven. Now the trade risks nothing.',ex:'Entry $50.20, ATR $2. TP1 = $54.20. At TP1, stop moves to $50.20. You keep any further gains risk-free.'},
      {t:'R:R Ratio',d:'Risk:Reward = (TP1 − Entry) ÷ (Entry − Stop). Our system targets 1:1.33 minimum. This means winners only need to hit 43% of the time to break even.',ex:'Risk $3, Target $4. R:R = 1:1.33. At 43% win rate: (0.43×$4) − (0.57×$3) = $0 breakeven. Higher win rate = profit.'},
      {t:'PDH / PDL (Rumers Box)',d:'Previous Day High and Low define the "box" for today\'s session. Price above PDH = bullish. Below PDL = bearish. Middle = avoid.',ex:'PDH $52, PDL $48, Mid $50. If price is at $53 (above PDH), it\'s showing strength. If at $47 (below PDL), trend is broken.'},
    ],
  },
  {
    id:'indicators', label:'Indicators',
    intro:'We use 6 indicators that each measure a different aspect of the market. No single indicator is enough — you need confluence across multiple ones.',
    items:[
      {t:'RSI (Relative Strength Index)',d:'Measures momentum fatigue. We use 28–42 for dip buys (genuinely oversold) and 50–65 for momentum buys (healthy, not overbought). We reject above 75.',ex:'RSI 35 + price above EMA-20 = ideal dip buy. RSI 58 + rising EMA-20 = ideal momentum buy. RSI 80 = danger zone, skip.'},
      {t:'MACD (8/17/9)',d:'Faster than the standard 12/26/9 MACD. Catches momentum shifts 1-2 days earlier. Zero-line filter means we only count it as bullish when momentum is genuinely positive.',ex:'MACD histogram crossing from negative to positive = early momentum signal. Histogram expanding = momentum accelerating.'},
      {t:'Volume Ratio',d:'Today\'s volume vs 20-day average. Tiered thresholds: small stocks need 2×+, mid caps 1.5×+, large caps 1.2×+. Low volume breakouts fail 70%+ of the time.',ex:'NVDA (large) at 1.3× = confirmed. RKLB (small) at 1.3× = too weak, needs 2×+. HIMS (mid) at 1.6× = confirmed.'},
      {t:'EMA Stack (9/20/50)',d:'Three moving averages. The strongest setups have price > EMA-9 > EMA-20, with EMA-20 sloping upward. This is the "full stack" — all short-term momentum aligned.',ex:'Price $100, EMA-9 $98, EMA-20 $95, EMA-50 $90. All below price and stacked correctly = full bullish alignment ✓'},
      {t:'ADX (Average Directional Index)',d:'Measures trend strength — not direction. We use it as a hard filter: Breakout setups need ADX > 20. Dip buys need ADX > 15. Below these thresholds = choppy, unreliable.',ex:'ADX 15 = sideways chop, breakouts will fail. ADX 28 = developing trend. ADX 42 = strong trend, great for momentum plays.'},
      {t:'Stochastic',d:'Where price is in its recent high-low range. Most useful as a confirmation: RSI < 42 AND Stochastic < 25 = double-oversold = high-quality dip setup.',ex:'RSI 38 alone = ok signal. RSI 38 + Stochastic 18 = double confirmation, much higher probability bounce.'},
    ],
  },
  {
    id:'fundamentals', label:'Fundamentals',
    intro:'Technicals tell you WHEN to buy. Fundamentals tell you WHAT to buy. Strong fundamentals mean the stock has a reason to recover when momentum slows.',
    items:[
      {t:'Revenue & Margins',d:'Revenue TTM = total annual sales. Gross profit = revenue minus cost of goods. Net income = what\'s left after all expenses. Growing margins = improving business.',ex:'Revenue $10B, Gross profit $7B (70% margin) = pricing power. Net income $2B (20% margin) = profitable. Both growing = strong.',},
      {t:'P/E Ratio',d:'Price-to-earnings. High P/E = investors expect fast growth. Low P/E = value or slow growth. Always compare within same sector, not across industries.',ex:'Tech growth stock P/E 45 = normal. Pharma P/E 22 = reasonable. But a bank at P/E 45 would be extreme — context matters.'},
      {t:'Beta',d:'Market amplifier. Beta 1.5 = moves 1.5× the S&P 500 in both directions. Higher beta means smaller position size to keep your dollar risk constant.',ex:'$10,000 position in Beta 1.0 stock vs Beta 2.0 stock. The Beta 2.0 position effectively has 2× the risk — halve the shares.'},
      {t:'Short Interest',d:'% of float sold short. High short interest + rising price = potential short squeeze. Shorts must buy to cover losses, amplifying upside.',ex:'Stock with 25% short interest starts rising sharply. Shorts panic-cover, amplifying move. GME 2021 is the extreme example.'},
      {t:'Analyst Consensus',d:'Average price target from Wall Street analysts. Shows where professionals think the stock will be in 12 months. Upside % = room to grow.',ex:'Stock at $80, consensus target $110 = 37.5% upside. Take with a grain of salt — targets are often revised up after the move.'},
    ],
  },
  {
    id:'position', label:'Position Sizing',
    intro:'Position sizing is the single most important factor in long-term trading survival. Fixed fractional sizing (3% rule) means no single trade can seriously damage your account.',
    items:[
      {t:'The 3% Rule',d:'Never risk more than 3% of total capital on one trade. This is the dollar amount from entry to stop-loss × shares, not the position value.',ex:'$10,000 capital × 3% = $300 max loss. ATR $2, stop $3 away. Shares = $300 ÷ $3 = 100 shares. Position value = $5,000.'},
      {t:'Shares Calculation',d:'Shares = (Capital × 0.03) ÷ StopDistance. StopDistance = 1.5×ATR. This auto-sizes so your max loss is always exactly 3% regardless of stock price.',ex:'NVDA at $110, ATR $5. Stop distance $7.50. $300 ÷ $7.50 = 40 shares. Position value: 40 × $110 = $4,400.'},
      {t:'Adjust for Beta',d:'High-beta stocks (Beta > 1.5) carry extra risk. Consider using 2% max risk instead of 3% for volatile small caps or meme-adjacent stocks.',ex:'RIOT Beta 3.5 = very volatile. Use 2% rule: $200 max risk. ATR $1.50, stop $2.25. Shares = $200 ÷ $2.25 = 88 shares.'},
      {t:'Never Average Down',d:'If a trade hits your stop-loss, exit. Do not buy more to reduce your average cost. This turns a controlled loss into a catastrophic one.',ex:'Bought 100 shares at $50, stop $47. Stock drops to $47 — EXIT. Buying more at $47 means you need a bigger recovery and took more risk.'},
    ],
  },
];

// ── Gauge component ───────────────────────────────────────────────────────────
interface Zone{from:number;to:number;hex:string;alpha:number}
function Gauge({label,value,min,max,zones,ticks,tipKey,eduMode,eduVal}:{label:string;value:number;min:number;max:number;zones:Zone[];ticks:{v:number;l:string}[];tipKey:string;eduMode:boolean;eduVal?:any}){
  const clamp=Math.min(max,Math.max(min,value));
  const pct=((clamp-min)/(max-min))*100;
  const zone=zones.find(z=>clamp>=z.from&&clamp<=z.to)??zones[zones.length-1];
  const EDU_LINES: Record<string,(v:any)=>string> = {
    rsi:   v=>v<30?`RSI ${v} — fell hard, watching for reversal signal`:v<50?`RSI ${v} — recovering, no clear momentum yet`:v<65?`RSI ${v} — healthy building momentum ✓`:v<78?`RSI ${v} — getting hot, reduce position size`:`RSI ${v} — overbought, high pullback risk`,
    volume:v=>v>=2?`${v}× — institutions actively trading today`:`${v}×avg — ${v>=1.3?'participation confirmed ✓':'below threshold, weak conviction'}`,
    adx:   v=>v<20?`ADX ${v} — sideways chop, momentum plays risky`:v<30?`ADX ${v} — trend developing`:v<50?`ADX ${v} — strong trend ✓`:`ADX ${v} — very strong, watch for exhaustion`,
    stoch: v=>v<20?`Stochastic ${v} — oversold, watch for crossover`:v>80?`Stochastic ${v} — overbought, momentum may exhaust`:`Stochastic ${v} — neutral zone`,
  };
  return(
    <div className="bg-surface-2 rounded-xl p-3 border border-border">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-muted uppercase tracking-wide font-semibold flex items-center gap-1">{label}<T id={tipKey}/></span>
        <span className="text-sm font-mono font-bold" style={{color:zone.hex}}>{value>=10?Math.round(value):value.toFixed(1)}</span>
      </div>
      <div className="relative h-3 rounded-full overflow-hidden bg-surface-3">
        {zones.map((z,i)=><div key={i} className="absolute top-0 h-full" style={{left:`${((z.from-min)/(max-min))*100}%`,width:`${((z.to-z.from)/(max-min))*100}%`,backgroundColor:z.hex,opacity:z.alpha}}/>)}
        <div className="absolute top-0 h-full w-0.5 z-10" style={{left:`${pct}%`,backgroundColor:'rgba(255,255,255,0.95)',transform:'translateX(-50%)'}}/>
      </div>
      <div className="relative mt-1 h-3">
        {ticks.map((t,i)=><span key={i} className="absolute text-[8px] text-muted" style={{left:`${((t.v-min)/(max-min))*100}%`,transform:'translateX(-50%)'}}>{t.l}</span>)}
      </div>
      {eduMode&&EDU_LINES[tipKey]&&<p className="text-[10px] text-accent-green mt-2 pt-1.5 border-t border-border italic leading-relaxed">{EDU_LINES[tipKey](eduVal??value)}</p>}
    </div>
  );
}
const RSI_Z:Zone[]=[{from:0,to:28,hex:'#3b82f6',alpha:.7},{from:28,to:42,hex:'#10b981',alpha:.8},{from:42,to:50,hex:'#eab308',alpha:.5},{from:50,to:65,hex:'#10b981',alpha:.85},{from:65,to:75,hex:'#eab308',alpha:.6},{from:75,to:100,hex:'#ef4444',alpha:.7}];
const STOCH_Z:Zone[]=[{from:0,to:20,hex:'#3b82f6',alpha:.7},{from:20,to:80,hex:'#10b981',alpha:.6},{from:80,to:100,hex:'#ef4444',alpha:.7}];
const ADX_Z:Zone[]=[{from:0,to:20,hex:'#ef4444',alpha:.6},{from:20,to:30,hex:'#eab308',alpha:.6},{from:30,to:50,hex:'#10b981',alpha:.85},{from:50,to:60,hex:'#eab308',alpha:.6}];
const VOL_Z:Zone[]=[{from:0,to:1,hex:'#ef4444',alpha:.6},{from:1,to:1.3,hex:'#eab308',alpha:.5},{from:1.3,to:2,hex:'#10b981',alpha:.75},{from:2,to:3,hex:'#10b981',alpha:1}];

// ── Tooltip ───────────────────────────────────────────────────────────────────
function T({id}:{id:string}){
  const[open,setOpen]=useState(false);
  const txt=TIPS[id];
  if(!txt)return null;
  return(
    <div className="relative inline-block">
      <button onClick={e=>{e.stopPropagation();setOpen(o=>!o)}} className="text-muted hover:text-accent-green ml-0.5 align-middle transition-colors"><Info size={10}/></button>
      {open&&(<><div className="fixed inset-0 z-40" onClick={()=>setOpen(false)}/><div className="absolute z-50 left-0 top-5 w-60 bg-surface-2 border border-border rounded-xl p-3 shadow-xl"><p className="text-[10px] text-secondary leading-relaxed">{txt}</p></div></>)}
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

function fmtDollars(n:number|null){if(n==null)return'N/A';const abs=Math.abs(n);if(abs>=1e9)return`$${(n/1e9).toFixed(1)}B`;if(abs>=1e6)return`$${(n/1e6).toFixed(0)}M`;if(abs>=1e3)return`$${(n/1e3).toFixed(0)}K`;return`$${n}`;}
function fmtVol(n:number){if(!n)return'N/A';if(n>=1e9)return`${(n/1e9).toFixed(1)}B`;if(n>=1e6)return`${(n/1e6).toFixed(1)}M`;if(n>=1e3)return`${(n/1e3).toFixed(0)}K`;return String(n);}


// ── Per-section guide content ─────────────────────────────────────────────────
const GUIDE_BOXES: Record<string,{title:string;color:string;items:{t:string;d:string;ex:string}[]}> = {
  setup:{
    title:'📊 Signal & Setup',color:'accent-green',
    items:[
      {t:'Strict vs Broader Mode',d:'Strict (4 factors) = fewer signals, all highly confirmed. Broader (3 factors) = more signals, slightly lower conviction. Use Broader in trending markets, Strict when uncertain.',ex:'Strict: volume ✓ + EMA ✓ + RSI ✓ + MACD ✓ = qualify. Broader: volume ✓ + EMA ✓ + RSI ✓ = qualify.'},
      {t:'Momentum Breakout',d:'Price breaks above 20-day high on strong volume. Buy-stop entry above current price confirms the break before you commit capital.',ex:'NVDA at $105, 20-day high $104 → entry $105.35 (ATR×0.10 above). Stop $102. Target $109.'},
      {t:'Dip Buy Reversal',d:'Stock pulled back hard (RSI < 42). Limit order slightly below current price confirms the bounce rather than chasing.',ex:'HIMS drops from $32 → $27, RSI 36 → dip entry $26.73. Stop $24.80. Target $30.20.'},
      {t:'Confidence Score',d:'Each qualifying factor adds 1 point. Volume always gives 1. Strict mode needs 4+, Broader needs 3+. 7+ = strong. 9–10 = rare high-conviction.',ex:'Score 5: volume ✓, EMA aligned ✓, RSI healthy ✓, MACD bullish ✓, catalyst ✓.'},
    ],
  },
  levels:{
    title:'📐 Trade Levels',color:'accent-blue',
    items:[
      {t:'Entry Zone',d:'ATR-scaled entry. Breakout = price + ATR×0.10 (confirms break). Dip = price − ATR×0.15 (better price). Never chase beyond this zone.',ex:'$50 stock, ATR $2 → Breakout entry $50.20. Dip entry $49.70.'},
      {t:'PDH / PDL (Rumers Box)',d:"Previous Day High/Low = today's key reference. Price above PDH = bullish session. Middle zone = indecision, avoid entries here.",ex:'PDH $52, PDL $48 → stock holding above $52 = session strength confirmed.'},
      {t:'Stop & Targets',d:'Stop = 1.5×ATR below entry (non-negotiable). TP1 = 2×ATR above. At TP1, move stop to breakeven — risk-free trade from that point.',ex:"Entry $50, ATR $2 → Stop $47, TP1 $54. At $54 move stop to $50. Can't lose."},
      {t:'R:R Ratio',d:'Risk:Reward = (TP1−Entry) ÷ (Entry−Stop). Need minimum 1:1. Our system targets ~1:1.3. At 43% win rate, 1:1.3 R:R breaks even.',ex:'Risk $3, target $4 → R:R 1:1.33. Win just 43% of trades to break even.'},
    ],
  },
  indicators:{
    title:'📈 Indicators',color:'accent-yellow',
    items:[
      {t:'RSI Zones',d:'28–42 = genuinely oversold (dip buy zone). 50–65 = healthy momentum (breakout zone). 42–50 = neutral, no edge. Above 75 = rejected.',ex:'RSI 36 + price above EMA-20 = dip buy setup. RSI 58 = momentum buy zone.'},
      {t:'MACD (8/17/9)',d:'Faster than standard 12/26/9. Zero-line filter: only bullish when histogram expanding AND MACD line not deeply negative.',ex:'Histogram turning from −0.05 to +0.03 with MACD line near zero = early momentum signal.'},
      {t:'Volume Tiers',d:'Small stocks < $25 need 2×+ avg volume. Mid caps need 1.5×+. Large caps need 1.2×+. Low-volume breakouts fail 70%+ of the time.',ex:'RKLB (small) at 1.4× = too weak. NVDA (large) at 1.3× = confirmed ✓.'},
      {t:'EMA Stack + ADX',d:'Full stack = price > EMA-9 > EMA-20, with rising EMA-20. ADX > 20 required for breakouts — below 20 means sideways chop, setups fail.',ex:'Price $100, EMA-9 $98, EMA-20 $95 stacked, ADX 28 → full confirmation ✓.'},
    ],
  },
  fundamentals:{
    title:'📊 Fundamentals',color:'accent-green',
    items:[
      {t:'Revenue & Margins',d:'Revenue TTM = annual sales. Gross profit = after cost of goods. Net income = after all expenses. Growing margins = improving business quality.',ex:'Rev $10B, Gross profit $7B (70%) = pricing power. Net income $2B (20%) = profitable.'},
      {t:'P/E & Beta',d:'P/E shows what investors pay per $1 profit — compare within sector only. Beta shows market amplification — Beta 2 = twice S&P 500 moves.',ex:'SaaS P/E 45 = normal for growth. Beta 1.8 stock with $10k position = $18k effective exposure.'},
      {t:'Analyst Target',d:'Wall Street 12-month consensus price target. Upside % = room from current price to target. Always verify — targets lag price action.',ex:'Stock at $80, consensus target $110 = 37.5% upside. Often revised up after the move happens.'},
      {t:'Short Interest',d:'% of shares sold short. High short interest + rising price = short squeeze potential — shorts must buy to cover, amplifying the move.',ex:'Stock at 22% short interest starts rising sharply → shorts forced to buy → squeeze amplifies.'},
    ],
  },
  position:{
    title:'💰 Position Sizing',color:'accent-yellow',
    items:[
      {t:'3% Risk Rule',d:'Never risk more than 3% of total capital on one trade. This is your MAX LOSS (shares × stop distance), not the position size.',ex:'$10,000 capital × 3% = $300 max loss. ATR $2, stop $3 away → shares = $300÷$3 = 100 shares.'},
      {t:'Full Allocation',d:'How many shares your full capital buys at entry price. Compare with 3% rule to understand the difference between risk-sizing and full allocation.',ex:'$10,000 ÷ $50 entry = 200 shares full alloc. 3% rule gives 100 shares. Use 100 to cap risk.'},
      {t:'Why This Matters',d:'Losing 10 trades in a row at 3% risk = lost 30% of capital (recoverable). At 10% per trade × 10 losses = down 65% (very hard to recover).',ex:'$10,000: 3% rule after 10 losses = $9,000 remaining. 10% rule after 10 losses = $3,487 remaining.'},
    ],
  },
};

function SectionGuide({sectionId,show}:{sectionId:string;show:boolean}){
  if(!show)return null;
  const guide=GUIDE_BOXES[sectionId];
  if(!guide)return null;
  const colorMap:Record<string,string>={
    'accent-green':'border-accent-green/25 bg-accent-green/5',
    'accent-blue':'border-accent-blue/25 bg-accent-blue/5',
    'accent-yellow':'border-accent-yellow/25 bg-accent-yellow/5',
  };
  const textMap:Record<string,string>={
    'accent-green':'text-accent-green',
    'accent-blue':'text-accent-blue',
    'accent-yellow':'text-accent-yellow',
  };
  return(
    <div className={`rounded-xl border flex flex-col overflow-hidden ${colorMap[guide.color]??'border-border bg-surface-2'}`}
         style={{maxHeight:'min(420px, calc(100% + 0px))'}}>
      <p className={`text-[11px] font-bold px-3 pt-3 pb-2 shrink-0 border-b border-white/5 ${textMap[guide.color]??'text-white'}`}>{guide.title}</p>
      <div className="overflow-y-auto flex-1 p-3 space-y-3" style={{scrollbarWidth:'thin'}}>
        {guide.items.map((item,i)=>(
          <div key={i}>
            <p className="text-[10px] font-semibold text-white">{item.t}</p>
            <p className="text-[10px] text-secondary leading-relaxed">{item.d}</p>
            <div className="mt-1 bg-surface-3/80 rounded p-1.5 border border-border/50">
              <p className="text-[9px] text-muted italic">{item.ex}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Setup card ────────────────────────────────────────────────────────────────
function SetupCard({setup,eduMode,onCertify,certLoading,isTopPick,showGuide}:{
  setup:any;eduMode:boolean;onCertify:(t:string,v:string)=>void;
  certLoading:string|null;isTopPick:boolean;showGuide:boolean;
}){
  const[expanded,setExpanded]=useState(false);
  const[capital,setCapital]=useState(10000);
  const ind=setup.indicators??{};
  const levels=setup.levels;
  const chg=setup.change??0;
  const chgPos=chg>=0;
  const daysToEarnings=setup.earningsDate?Math.round((new Date(setup.earningsDate).getTime()-Date.now())/86400000):null;
  const earningsWarning=daysToEarnings!=null&&daysToEarnings<=7&&daysToEarnings>=0;
  const noSignal=!!setup.no_signal;

  const rawATR=ind.atr??levels?.atr??0;
  const minATR=(setup.price??10)*0.005;
  const atr=Math.max(minATR,rawATR>0?rawATR:minATR);
  const stopDist=atr*1.5;
  const liveEntry=setup.entry??setup.price;
  const liveStop=parseFloat((liveEntry-stopDist).toFixed(2));
  const liveTp1=parseFloat((liveEntry+atr*2).toFixed(2));
  const liveShares=Math.max(1,Math.floor((capital*0.03)/Math.max(0.01,stopDist)));
  const fullShares=Math.max(1,Math.floor(capital/Math.max(0.01,liveEntry)));
  const livePos=parseFloat((liveShares*liveEntry).toFixed(2));
  const liveLoss=parseFloat((liveShares*stopDist).toFixed(2));
  const liveRR=parseFloat(((atr*2)/stopDist).toFixed(1));

  const setupColor=setup.setup_type==='Momentum Breakout'?'badge-green':setup.setup_type==='Dip Buy Reversal'?'badge-blue':'badge-yellow';
  const confColor=setup.confidence>=7?'text-accent-green':setup.confidence>=5?'text-accent-yellow':'text-muted';

  const chartData=(setup.chartData??[]).map((p:any)=>({
    date:p.date??p.d??'',open:p.close??p.c??0,high:p.close??p.c??0,
    low:p.close??p.c??0,close:p.close??p.c??0,volume:0,
  })).filter((p:any)=>p.date&&p.close>0);

  const G=({id}:{id:string})=>showGuide?<div className="hidden xl:block mt-2"><SectionGuide sectionId={id} show={true}/></div>:null;

  return(
    <div className={`card p-0 overflow-hidden border ${isTopPick?'border-accent-green/40':'border-border'}`}>
      {isTopPick&&!noSignal&&(
        <div className="bg-accent-green/10 border-b border-accent-green/25 px-4 py-2 flex items-center gap-2">
          <Trophy size={12} className="text-accent-green shrink-0"/>
          <p className="text-[11px] text-accent-green font-semibold">🏆 Top Pick — Highest signal quality in this scan</p>
        </div>
      )}
      {earningsWarning&&(
        <div className="bg-accent-yellow/10 border-b border-accent-yellow/20 px-4 py-2 flex items-center gap-2">
          <Calendar size={12} className="text-accent-yellow shrink-0"/>
          <p className="text-[11px] text-accent-yellow font-semibold">⚠️ Earnings in {daysToEarnings} day{daysToEarnings!==1?'s':''} ({fmtDate(setup.earningsDate)}) — binary bet</p>
        </div>
      )}
      {noSignal&&(
        <div className="bg-accent-yellow/5 border-b border-accent-yellow/20 px-4 py-2 flex items-center gap-2">
          <AlertTriangle size={12} className="text-accent-yellow shrink-0"/>
          <p className="text-[11px] text-accent-yellow">{setup.reason_rejected}</p>
        </div>
      )}

      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xl font-bold text-white font-mono">{setup.ticker}</span>
              {!noSignal&&<span className={`badge ${setupColor}`}>{setup.setup_type}</span>}
              <span className="badge badge-neutral text-[9px]">{setup.meta?.sector}</span>
              {setup.priceSource==='realtime'&&<span className="badge badge-green text-[8px]">Live</span>}
              {setup.earningsDate&&<span className="badge badge-neutral text-[9px] flex items-center gap-1"><Calendar size={8}/>Earnings {fmtDate(setup.earningsDate)}</span>}
            </div>
            <p className="text-xs text-secondary">{setup.meta?.description}</p>
          </div>
          <HalalBadge setup={setup} onCertify={onCertify} certLoading={certLoading} canEdit={setup.canEdit}/>
        </div>

        {/* Price + Analyst Target */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-2xl font-bold text-white font-mono">${setup.price?.toFixed(2)}</span>
          <span className={`text-sm font-semibold flex items-center gap-0.5 ${chgPos?'text-accent-green':'text-accent-red'}`}>
            {chgPos?<TrendingUp size={13}/>:<TrendingDown size={13}/>}{chgPos?'+':''}{chg?.toFixed(2)}%
          </span>
          {!noSignal&&<span className={`text-xs font-bold ${confColor}`}>Signal {setup.confidence}/10<T id="confidence"/></span>}
          {setup.targets?.consensus&&(
            <div className="ml-auto flex items-center gap-1.5 bg-surface-3 rounded-lg px-2.5 py-1 border border-border">
              <Target size={10} className="text-accent-green shrink-0"/>
              <span className="text-[10px] text-muted">Analyst Target</span>
              <span className="text-xs font-mono font-bold text-accent-green">${setup.targets.consensus.toFixed(2)}</span>
              {setup.targets.upside!=null&&(
                <span className={`text-[9px] font-bold ${setup.targets.upside>=0?'text-accent-green':'text-accent-red'}`}>
                  {setup.targets.upside>=0?'+':''}{setup.targets.upside}%
                </span>
              )}
            </div>
          )}
        </div>

        {/* Signal factors */}
        {!noSignal&&setup.factors?.length>0&&(
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-1.5">
              {setup.factors.map((f:string,i:number)=>(
                <span key={i} className="text-[10px] bg-accent-green/10 text-accent-green px-2 py-0.5 rounded-full border border-accent-green/20">✓ {f}</span>
              ))}
            </div>
            {setup.catalystHeadlines?.length>0&&(
              <div className="bg-accent-green/5 border border-accent-green/15 rounded-xl p-2.5">
                <p className="text-[10px] text-accent-green font-semibold mb-1">📰 Recent bullish news (past 72h):</p>
                {setup.catalystHeadlines.map((h:string,i:number)=>(
                  <p key={i} className="text-[10px] text-secondary leading-relaxed">• {h}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Chart */}
        {chartData.length>0&&(
          <div className="border-t border-border pt-3">
            <PriceChart
              ticker={setup.ticker} initialData={chartData}
              currentPrice={setup.price} defaultPeriod="3mo"
              keyMoves={(setup.keyMoves??[]).map((m:any)=>({date:m.date,pct:m.pct,direction:m.direction,reason:m.reason}))}
              pdh={levels?.pdh} pdl={levels?.pdl}
            />
          </div>
        )}

        {/* Key moves */}
        {setup.keyMoves?.length>0&&(
          <div>
            <p className="text-[10px] text-muted uppercase tracking-wide font-semibold mb-1.5 flex items-center gap-1">⚡ Key moves (5%+)<T id="keyMoves"/></p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {setup.keyMoves.map((m:any,i:number)=>(
                <div key={i} className={`shrink-0 rounded-xl border px-3 py-2 min-w-44 max-w-60 ${m.pct>0?'bg-accent-green/5 border-accent-green/20':'bg-accent-red/5 border-accent-red/20'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-sm font-mono font-bold ${m.pct>0?'text-accent-green':'text-accent-red'}`}>{m.pct>0?'+':''}{m.pct}%</span>
                    <span className="text-[9px] text-muted">{fmtDate(m.date)}</span>
                    <span className="text-[9px] text-muted ml-auto">{m.volume_ratio}× vol</span>
                  </div>
                  <p className="text-[10px] text-secondary leading-snug">{m.reason||'AI explanation loading'}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trade levels */}
        {levels&&!noSignal&&(
          <div className={showGuide?'xl:grid xl:grid-cols-[1fr_300px] xl:gap-4 xl:items-start':''}>
            <div className="bg-surface-2 rounded-xl p-3 border border-border">
              <p className="text-[10px] text-muted font-semibold uppercase tracking-wide mb-2">Trade Levels<T id="sr"/></p>
              <div className="flex gap-2 mb-2">
                {[{l:'PDH',v:levels.pdh,tip:'pdh',c:'text-accent-yellow'},{l:'MidBox',v:levels.pdm,tip:'pdm',c:'text-muted'},{l:'PDL',v:levels.pdl,tip:'pdl',c:'text-accent-blue'}].map(r=>(
                  <div key={r.l} className="flex-1 text-center bg-surface-3 rounded-lg py-1.5 border border-border">
                    <p className={`text-[8px] font-bold ${r.c} flex items-center justify-center gap-0.5`}>{r.l}<T id={r.tip}/></p>
                    <p className="text-[10px] font-mono text-white">${r.v?.toFixed(2)??'—'}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-1 mb-2">
                {[
                  {label:'TP1',v:setup.tp1,type:'r',note:'Target 1'},
                  {label:'Entry zone',v:`$${setup.entryLo?.toFixed(2)} – $${setup.entryHi?.toFixed(2)}`,type:'e',note:setup.entryNote??'ATR-scaled entry zone'},
                  {label:'Price now',v:setup.price,type:'c',note:'Current price'},
                  {label:'Stop',v:setup.stop,type:'s',note:'Stop-loss'},
                  {label:'S1',v:levels.s1,type:'s',note:'Pivot support'},
                ].map((row,i)=>(
                  <div key={i} className={`flex items-center gap-2 px-2 py-1 rounded-lg text-[11px] ${row.type==='c'?'bg-accent-green/10 border border-accent-green/30':row.type==='e'?'bg-accent-blue/10 border border-accent-blue/20':row.type==='r'?'border-l-2 border-accent-red/40':'border-l-2 border-accent-green/40'}`}>
                    <span className={`font-bold w-16 shrink-0 ${row.type==='c'?'text-accent-green':row.type==='e'?'text-accent-blue':row.type==='r'?'text-accent-red':'text-accent-green'}`}>{row.label}</span>
                    <span className="font-mono font-bold text-white">{typeof row.v==='number'?`$${row.v.toFixed(2)}`:row.v}</span>
                    <span className="text-muted text-[9px]">{row.note}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between bg-surface-3 rounded-lg px-3 py-2 border border-border mb-2">
                <span className="text-[10px] text-muted">R:R ratio<T id="rr"/></span>
                <span className="text-sm font-bold text-accent-yellow font-mono">1:{liveRR}</span>
                <span className="text-[9px] text-muted">Hold: {setup.holdDays}</span>
              </div>
              <div className="flex gap-2">
                {[{l:'Fib 38.2%',v:levels.fib382},{l:'Fib 50%',v:levels.fib500},{l:'Fib 61.8%',v:levels.fib618}].map(f=>(
                  <div key={f.l} className="text-center bg-surface-3 rounded-lg px-2 py-1.5 border border-border flex-1">
                    <p className="text-[8px] text-accent-yellow font-bold">{f.l}<T id="fib"/></p>
                    <p className="text-[10px] font-mono text-white">${f.v?.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
            {showGuide&&<div className="hidden xl:block"><SectionGuide sectionId="levels" show={true}/></div>}
          </div>
        )}

        {/* Position sizing */}
        {!noSignal&&(
          <div className={showGuide?'xl:grid xl:grid-cols-[1fr_300px] xl:gap-4 xl:items-start':''}>
            <div className="bg-surface-2 rounded-xl p-3 border border-border">
              <div className="flex items-center gap-3 mb-2">
                <p className="text-[10px] text-muted font-semibold uppercase tracking-wide">Position Sizing<T id="capital"/></p>
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="text-[10px] text-muted">Capital $</span>
                  <input type="number" value={capital} min={100} step={500}
                    onChange={e=>setCapital(Math.max(100,parseInt(e.target.value)||10000))}
                    className="input w-28 text-xs font-mono py-1 px-2"/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center mb-2">
                {[
                  {l:'Shares (3% risk rule)',v:String(liveShares),c:'text-accent-green',sub:'Max loss capped at 3%'},
                  {l:'Shares (full capital)',v:String(fullShares),c:'text-white',sub:'All capital deployed'},
                  {l:'Position value',v:`$${livePos.toLocaleString()}`,c:'text-white',sub:'At 3% rule shares'},
                  {l:'Max loss (3%)',v:`$${liveLoss.toFixed(0)}`,c:'text-accent-red',sub:`${(capital*0.03).toFixed(0)} = 3% of capital`},
                ].map(r=>(
                  <div key={r.l} className="bg-surface-3 rounded-xl p-2.5 border border-border">
                    <p className="text-[8px] text-muted leading-tight">{r.l}</p>
                    <p className={`text-sm font-mono font-bold ${r.c}`}>{r.v}</p>
                    <p className="text-[8px] text-muted">{r.sub}</p>
                  </div>
                ))}
              </div>
              {eduMode&&<p className="text-[10px] text-accent-green italic">3% rule: {liveShares} shares risks max ${liveLoss.toFixed(0)}. Full allocation: {fullShares} shares at ${liveEntry.toFixed(2)} deploys all ${capital.toLocaleString()}.</p>}
            </div>
            {showGuide&&<div className="hidden xl:block"><SectionGuide sectionId="position" show={true}/></div>}
          </div>
        )}

        {/* Expand button */}
        <button onClick={()=>setExpanded(e=>!e)} className="btn-secondary text-xs flex items-center gap-1.5 w-full justify-center">
          {expanded?<ChevronUp size={12}/>:<ChevronDown size={12}/>}
          {expanded?'Hide full analysis':'Full analysis — indicators · fundamentals · behavior'}
        </button>
      </div>

      {/* Expanded section */}
      {expanded&&(
        <div className="border-t border-border p-4 space-y-4">

          {/* Core identity */}
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
                {l:'ATR (daily $)',v:`$${atr.toFixed(2)}`},
                {l:'ATR % of price',v:`${ind.atrPct??0}%`},
                {l:'Avg daily move',v:`±${setup.volatility?.avgDailyPct??0}%`},
              ].map(r=>(
                <div key={r.l} className="bg-surface-2 rounded-xl p-2.5 border border-border text-center">
                  <p className="text-[9px] text-muted">{r.l}<T id="atr"/></p>
                  <p className="text-sm font-mono font-bold text-accent-yellow">{r.v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Indicators + guide */}
          {ind.rsi!=null&&(
            <div className={showGuide?'xl:grid xl:grid-cols-[1fr_300px] xl:gap-4 xl:items-start':''}>
              <div>
                <h4 className="text-xs font-bold text-white mb-3">📈 Indicator Dashboard</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                  <Gauge label="RSI (14)" value={ind.rsi} min={0} max={100} zones={RSI_Z} tipKey="rsi" eduMode={eduMode} eduVal={ind.rsi} ticks={[{v:28,l:'28'},{v:42,l:'42'},{v:65,l:'65'},{v:75,l:'75'}]}/>
                  <Gauge label="Volume Ratio" value={Math.min(3,ind.volR??ind.ratio??1)} min={0} max={3} zones={VOL_Z} tipKey="volume" eduMode={eduMode} eduVal={ind.volR??ind.ratio} ticks={[{v:1,l:'1×'},{v:1.5,l:'1.5×'},{v:2,l:'2×'}]}/>
                  <Gauge label="ADX — Trend Strength" value={Math.min(60,ind.adx??20)} min={0} max={60} zones={ADX_Z} tipKey="adx" eduMode={eduMode} eduVal={ind.adx} ticks={[{v:20,l:'20'},{v:30,l:'30'},{v:50,l:'50'}]}/>
                  <Gauge label="Stochastic %K" value={ind.stochK??50} min={0} max={100} zones={STOCH_Z} tipKey="stoch" eduMode={eduMode} eduVal={ind.stochK} ticks={[{v:20,l:'20'},{v:50,l:'50'},{v:80,l:'80'}]}/>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
                  {[
                    {l:'MACD (8/17/9)',v:ind.macd?.bullish?'▲ Bullish':'▼ Bearish',c:ind.macd?.bullish?'text-accent-green':'text-accent-red',tip:'macd'},
                    {l:'EMA-9',v:ind.ema9?`$${ind.ema9}`:'N/A',c:(setup.price??0)>(ind.ema9??0)?'text-accent-green':'text-accent-red',tip:'ema9'},
                    {l:'EMA-20',v:`$${ind.ema20??'—'}`,c:(setup.price??0)>(ind.ema20??0)?'text-accent-green':'text-accent-red',tip:'ema20'},
                    {l:'EMA-50',v:`$${ind.ema50??'—'}`,c:(setup.price??0)>(ind.ema50??0)?'text-accent-green':'text-accent-red',tip:'ema50'},
                    {l:'EMA-20 slope',v:ind.ema20Rising?'▲ Rising':'▼ Flat',c:ind.ema20Rising?'text-accent-green':'text-accent-yellow',tip:'ema20'},
                    {l:'EMA stack',v:ind.fullEmaStack?'✓ Full align':'Partial',c:ind.fullEmaStack?'text-accent-green':'text-muted',tip:'ema20'},
                  ].map(r=>(
                    <div key={r.l} className="bg-surface-2 rounded-xl p-2.5 border border-border">
                      <p className="text-[9px] text-muted">{r.l}<T id={r.tip}/></p>
                      <p className={`text-sm font-mono font-bold ${r.c}`}>{r.v}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-surface-2 rounded-xl p-2.5 border border-border">
                  <p className="text-[9px] text-muted mb-1.5">Volume breakdown<T id="volume"/></p>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {[{l:'Today',v:fmtVol(ind.todayVol??0)},{l:'20d avg',v:fmtVol(ind.avgVol??0)},{l:'Ratio',v:`${(ind.volR??ind.ratio??1).toFixed(1)}×`}].map(r=>(
                      <div key={r.l}><p className="text-[8px] text-muted">{r.l}</p><p className="text-xs font-mono font-bold text-white">{r.v}</p></div>
                    ))}
                  </div>
                </div>
              </div>
              {showGuide&&<div className="hidden xl:block"><SectionGuide sectionId="indicators" show={true}/></div>}
            </div>
          )}

          {/* Fundamentals + guide */}
          <div className={showGuide?'xl:grid xl:grid-cols-[1fr_300px] xl:gap-4 xl:items-start':''}>
            <div>
              <h4 className="text-xs font-bold text-white mb-2">📊 Fundamentals</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                {[
                  {l:'Market Cap',v:fmtDollars(setup.fundamentals?.marketCap),tip:'marketCap'},
                  {l:'P/E Ratio',v:setup.fundamentals?.pe?.toFixed(1)??'N/A',tip:'pe'},
                  {l:'Beta',v:setup.fundamentals?.beta?.toFixed(2)??'N/A',tip:'beta'},
                  {l:'52W High',v:setup.fundamentals?.high52?`$${setup.fundamentals.high52?.toFixed(2)}`:'N/A',tip:'marketCap'},
                  {l:'52W Low',v:setup.fundamentals?.low52?`$${setup.fundamentals.low52?.toFixed(2)}`:'N/A',tip:'marketCap'},
                  {l:'Rev Growth',v:setup.fundamentals?.revenueGrowth!=null?`${(setup.fundamentals.revenueGrowth*100).toFixed(1)}%`:'N/A',tip:'netMargin'},
                  {l:'Revenue TTM',v:fmtDollars(setup.fundamentals?.revenueTTM),tip:'netMargin'},
                  {l:'Gross Profit',v:fmtDollars(setup.fundamentals?.grossProfit),tip:'grossMargin'},
                  {l:'Net Income',v:fmtDollars(setup.fundamentals?.netIncome),tip:'netMargin'},
                  {l:'Gross Margin',v:setup.fundamentals?.grossMarginPct!=null?`${setup.fundamentals.grossMarginPct?.toFixed(1)}%`:'N/A',tip:'grossMargin'},
                  {l:'Net Margin',v:setup.fundamentals?.netMarginPct!=null?`${setup.fundamentals.netMarginPct?.toFixed(1)}%`:'N/A',tip:'netMargin'},
                  {l:'Short Interest',v:setup.fundamentals?.shortInterest?`${setup.fundamentals.shortInterest?.toFixed(1)}%`:'N/A',tip:'shortInt'},
                ].map(r=>(
                  <div key={r.l} className="bg-surface-2 rounded-xl p-2.5 border border-border">
                    <p className="text-[9px] text-muted">{r.l}<T id={r.tip}/></p>
                    <p className="text-sm font-mono font-bold text-white">{r.v}</p>
                  </div>
                ))}
              </div>
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
                        {r.hi&&r.up!=null&&<p className={`text-[9px] font-bold ${(r.up??0)>=0?'text-accent-green':'text-accent-red'}`}>{(r.up??0)>=0?'+':''}{r.up}% upside</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {showGuide&&<div className="hidden xl:block"><SectionGuide sectionId="fundamentals" show={true}/></div>}
          </div>

        </div>
      )}
    </div>
  );
}
// ── Main page ─────────────────────────────────────────────────────────────────
const RANGES=[
  {id:'small',label:'Small',sub:'< $25'},
  {id:'medium',label:'Medium',sub:'$26–$100'},
  {id:'large',label:'Large',sub:'$101–$200'},
  {id:'big',label:'Big',sub:'$201–$400'},
  {id:'premium',label:'Premium',sub:'$401–$700'},
  {id:'elite',label:'Elite',sub:'$700+'},
];

export default function TradingAgentPage(){
  const[mode,setMode]=useState<'auto'|'manual'>('auto');
  const[manualTicker,setManualTicker]=useState('');
  const[suggestions,setSuggestions]=useState<any[]>([]);
  const[showSuggest,setShowSuggest]=useState(false);
  const[priceRange,setPriceRange]=useState('medium');
  const[minScore,setMinScore]=useState<3|4>(4);
  const[result,setResult]=useState<any>(null);
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState<string|null>(null);
  const[eduMode,setEduMode]=useState(()=>{try{return localStorage.getItem('ziqron_edu')!=='off';}catch{return true;}});
  const[showGuide,setShowGuide]=useState(true);
  const[certLoading,setCertLoading]=useState<string|null>(null);
  const debounceRef=useRef<ReturnType<typeof setTimeout>|null>(null);
  const searchRef=useRef<HTMLDivElement>(null);

  function toggleEdu(){const n=!eduMode;setEduMode(n);try{localStorage.setItem('ziqron_edu',n?'on':'off');}catch{}}

  function handleManualInput(val:string){
    setManualTicker(val.toUpperCase());setShowSuggest(false);
    if(debounceRef.current)clearTimeout(debounceRef.current);
    if(val.length<1){setSuggestions([]);return;}
    debounceRef.current=setTimeout(async()=>{
      try{
        const res=await fetch(`/api/stocks/search?q=${encodeURIComponent(val)}`);
        const json=await res.json();
        setSuggestions(json.results??[]);
        setShowSuggest((json.results??[]).length>0);
      }catch{setSuggestions([]);}
    },280);
  }

  useEffect(()=>{
    function handle(e:MouseEvent){
      if(searchRef.current&&!searchRef.current.contains(e.target as Node))setShowSuggest(false);
    }
    document.addEventListener('mousedown',handle);
    return()=>document.removeEventListener('mousedown',handle);
  },[]);

  const scan=useCallback(async()=>{
    setLoading(true);setError(null);setResult(null);
    try{
      const body:any={price_range:priceRange,capital:10000,min_score:minScore};
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
    await fetch(`/api/stocks/${ticker}/halal-cert`,{
      method:isActive?'DELETE':'POST',
      headers:{'Content-Type':'application/json'},
      body:isActive?undefined:JSON.stringify({user_verdict:verdict}),
    });
    await scan();setCertLoading(null);
  }

  return(
    <div className="page-enter space-y-5">

      {/* Gharar disclaimer */}
      <div className="bg-accent-green/5 border border-accent-green/20 rounded-xl p-4">
        <p className="text-xs font-bold text-accent-green mb-1">🕌 تَوَكَّلْ عَلَى اللَّه — Due Diligence is a Religious Obligation</p>
        <p className="text-[11px] text-secondary leading-relaxed">Islam prohibits <strong className="text-white">gharar</strong> — excessive uncertainty or blind speculation. Every signal is a tool for informed analysis, not a directive to buy. Verify halal status and never invest money you cannot afford to lose.</p>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Zap size={20} className="text-accent-green"/>Short-Term Trading Agent</h1>
          <p className="text-secondary text-sm mt-0.5">276 halal stocks · live Alpaca price · PDH/PDL · AI behavior · per-section guide</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <a href="/learn" className="btn-secondary flex items-center gap-1.5 text-xs"><BookOpen size={13}/>Learning Hub</a>
          <button onClick={()=>setShowGuide(g=>!g)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${showGuide?'bg-accent-green/10 border-accent-green/30 text-accent-green':'border-border text-muted hover:text-white'}`}>
            <PanelRight size={13}/>{showGuide?'Hide Guide':'Trading Guide'}
          </button>
          <button onClick={toggleEdu} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${eduMode?'bg-accent-green/10 border-accent-green/30 text-accent-green':'border-border text-muted hover:text-white'}`}>
            {eduMode?'📚 ON':'📚 OFF'}
          </button>
        </div>
      </div>

      {/* Controls + setup guide */}
      <div className={showGuide?'xl:grid xl:grid-cols-[1fr_300px] xl:gap-6':''}>
        <div className="card p-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {[{id:'auto',l:'🔍 Auto Scan',s:'Scan 276 halal stocks'},{id:'manual',l:'🎯 Evaluate Ticker',s:'Enter any stock symbol'}].map(m=>(
              <button key={m.id} onClick={()=>setMode(m.id as 'auto'|'manual')}
                className={`rounded-xl p-3 border text-left transition-all ${mode===m.id?'bg-accent-green/10 border-accent-green/30':'border-border hover:bg-surface-2'}`}>
                <p className={`text-sm font-bold ${mode===m.id?'text-accent-green':'text-white'}`}>{m.l}</p>
                <p className="text-[10px] text-muted">{m.s}</p>
              </button>
            ))}
          </div>

          {mode==='manual'&&(
            <div ref={searchRef} className="relative">
              <div className="relative max-w-xs">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"/>
                <input value={manualTicker} onChange={e=>handleManualInput(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&scan()}
                  onFocus={()=>suggestions.length>0&&setShowSuggest(true)}
                  placeholder="HIMS, ALAB, NVO, NIKE…"
                  className="input w-full pl-9 font-mono" autoComplete="off"/>
              </div>
              {showSuggest&&suggestions.length>0&&(
                <div className="absolute top-11 left-0 w-64 bg-surface-2 border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                  {suggestions.slice(0,7).map((s:any)=>(
                    <button key={s.ticker} onClick={()=>{setManualTicker(s.ticker);setShowSuggest(false);}}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-3 transition-colors text-left">
                      <span className="text-xs font-mono font-bold text-accent-green w-14 shrink-0">{s.ticker}</span>
                      <span className="text-[10px] text-secondary truncate">{s.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Signal Sensitivity */}
          <div>
            <p className="text-[10px] text-muted uppercase tracking-wide mb-2 font-semibold">Signal Sensitivity</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                {v:4,l:'🎯 Strict',sub:'4+ factors required · fewer, higher quality setups'},
                {v:3,l:'🔍 Broader',sub:'3+ factors required · more results, slightly lower conviction'},
              ] as {v:3|4;l:string;sub:string}[]).map(opt=>(
                <button key={opt.v} onClick={()=>setMinScore(opt.v)}
                  className={`rounded-xl p-2.5 border text-left transition-all ${minScore===opt.v?'bg-accent-green/10 border-accent-green/30':'border-border hover:bg-surface-2'}`}>
                  <p className={`text-xs font-bold ${minScore===opt.v?'text-accent-green':'text-white'}`}>{opt.l}</p>
                  <p className="text-[9px] text-muted mt-0.5">{opt.sub}</p>
                </button>
              ))}
            </div>
            {eduMode&&<p className="text-[10px] text-accent-green mt-1.5 italic">Strict = safer, fewer trades. Broader = more active, accept slightly lower conviction signals.</p>}
          </div>

          {mode==='auto'&&(
          <div>
            <p className="text-[10px] text-muted uppercase tracking-wide mb-2 font-semibold">Price Range — 276 halal stocks scanned, filtered by actual Alpaca price</p>
            <div className="flex flex-wrap gap-2">
              {RANGES.map(r=>(
                <button key={r.id} onClick={()=>setPriceRange(r.id)}
                  className={`flex flex-col items-center px-3 py-2 rounded-xl border text-center transition-all ${priceRange===r.id?'bg-accent-green/10 border-accent-green/30':'border-border hover:bg-surface-2'}`}>
                  <span className={`text-xs font-bold ${priceRange===r.id?'text-accent-green':'text-white'}`}>{r.label}</span>
                  <span className="text-[9px] text-muted">{r.sub}</span>
                </button>
              ))}
            </div>
          </div>
          )}

          <button onClick={scan} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
            {loading
              ? <><Loader2 size={14} className="animate-spin"/>Scanning {RANGES.find(r=>r.id===priceRange)?.label} range…</>
              : <><Zap size={14}/>{mode==='manual'&&manualTicker?`Evaluate ${manualTicker}`:`Scan ${RANGES.find(r=>r.id===priceRange)?.label??''} Range`}</>}
          </button>
        </div>
        {showGuide&&<div className="hidden xl:block"><SectionGuide sectionId="setup" show={true}/></div>}
      </div>

      {error&&<div className="card border border-accent-red/20 bg-accent-red/5 p-4 text-sm text-accent-red">{error}</div>}

      {result&&!loading&&(
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2 px-1">
            {result.signal==='SETUPS_FOUND'?(
              <>
                <p className="text-sm font-semibold text-white">Found <span className="text-accent-green">{result.found}</span> setup{result.found!==1?'s':''} · <span className="text-accent-green">{result.scanned}</span> of 276 halal stocks in {priceRange} price range</p>
                <div className="flex items-center gap-2">
                  {result.from_cache
                    ? <span className="text-[9px] text-muted bg-surface-2 border border-border px-2 py-0.5 rounded-full">⚡ cached · stable results</span>
                    : <span className="text-[10px] text-muted">{new Date(result.generated_at).toLocaleTimeString()}</span>
                  }
                  <button onClick={scan} className="btn-ghost text-xs flex items-center gap-1"><RefreshCw size={11}/>{result.from_cache?'Force refresh':'Refresh'}</button>
                </div>
              </>
            ):result.signal==='NO_SIGNAL'?(
              <p className="text-sm text-accent-yellow">Full card shown — stock doesn't meet signal criteria right now</p>
            ):(
              <div className="w-full">
                <p className="text-sm font-semibold text-accent-yellow mb-1">🛡️ No setups today — capital preserved</p>
                <p className="text-xs text-secondary">{result.reason}</p>
                {result.reject_sample?.length>0&&<p className="text-[10px] text-muted mt-1.5">Rejections: {result.reject_sample.join(' · ')}</p>}
              </div>
            )}
          </div>

          {result.pickOne&&result.setups?.length>1&&(
            <div className="bg-surface-2 border border-accent-green/25 rounded-xl p-4 flex items-start gap-3">
              <Trophy size={16} className="text-accent-green shrink-0 mt-0.5"/>
              <div>
                <p className="text-xs font-bold text-accent-green mb-1">🏆 If You Can Only Pick One Today:</p>
                <p className="text-xs text-secondary leading-relaxed">{result.pickOne}</p>
              </div>
            </div>
          )}

          {result.setups?.map((s:any,i:number)=>(
            <SetupCard
              key={s.ticker} setup={s} eduMode={eduMode}
              onCertify={certify} certLoading={certLoading}
              isTopPick={i===0&&result.setups.length>1&&!s.no_signal}
              showGuide={showGuide}
            />
          ))}
        </div>
      )}

      {!result&&!loading&&(
        <div className="flex flex-col items-center py-20 text-center">
          <Zap size={36} className="text-muted mb-3"/>
          <h2 className="text-base font-semibold text-white mb-1">Select a range and run the scan</h2>
          <p className="text-xs text-secondary max-w-sm">276 halal-certified stocks scanned — filtered by actual Alpaca price. Enable Trading Guide for per-section explanations alongside each section.</p>
        </div>
      )}
    </div>
  );
}