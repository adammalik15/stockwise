import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
const FMP_KEY     = process.env.FMP_API_KEY;

const UNIVERSE: Record<string, { halal:'high'|'medium'|'doubtful'; sector:string; tier:'small'|'medium'|'large'|'big' }> = {
  // SMALL < $25
  RKLB:{ halal:'high',    sector:'Aerospace',      tier:'small'  },
  RIVN:{ halal:'high',    sector:'EV',             tier:'small'  },
  LCID:{ halal:'high',    sector:'EV',             tier:'small'  },
  PLUG:{ halal:'high',    sector:'Clean Energy',   tier:'small'  },
  JOBY:{ halal:'high',    sector:'Aviation',       tier:'small'  },
  SOUN:{ halal:'high',    sector:'AI',             tier:'small'  },
  HIMS:{ halal:'high',    sector:'Healthcare',     tier:'small'  },
  ACHR:{ halal:'high',    sector:'Aviation',       tier:'small'  },
  ASTS:{ halal:'high',    sector:'Space',          tier:'small'  },
  RXRX:{ halal:'high',    sector:'BioTech',        tier:'small'  },
  BBAI:{ halal:'high',    sector:'AI',             tier:'small'  },
  NIO: { halal:'high',    sector:'EV',             tier:'small'  },
  LAZR:{ halal:'high',    sector:'Autonomous',     tier:'small'  },
  XPEV:{ halal:'high',    sector:'EV',             tier:'small'  },
  OPEN:{ halal:'high',    sector:'PropTech',       tier:'small'  },
  // MEDIUM $26–$100
  AMD: { halal:'high',    sector:'Semiconductors', tier:'medium' },
  QCOM:{ halal:'high',    sector:'Semiconductors', tier:'medium' },
  MU:  { halal:'high',    sector:'Semiconductors', tier:'medium' },
  SHOP:{ halal:'high',    sector:'E-Commerce',     tier:'medium' },
  NET: { halal:'high',    sector:'Cloud',          tier:'medium' },
  DDOG:{ halal:'high',    sector:'Cloud',          tier:'medium' },
  ZS:  { halal:'high',    sector:'Cybersecurity',  tier:'medium' },
  CRWD:{ halal:'high',    sector:'Cybersecurity',  tier:'medium' },
  OKTA:{ halal:'high',    sector:'Cybersecurity',  tier:'medium' },
  PLTR:{ halal:'medium',  sector:'AI/Data',        tier:'medium' },
  MDB: { halal:'high',    sector:'Cloud DB',       tier:'medium' },
  ON:  { halal:'high',    sector:'Semiconductors', tier:'medium' },
  CELH:{ halal:'high',    sector:'Beverages',      tier:'medium' },
  SNAP:{ halal:'medium',  sector:'Social',         tier:'medium' },
  CIEN:{ halal:'high',    sector:'Telecom Tech',   tier:'medium' },
  SNDK:{ halal:'high',    sector:'Storage',        tier:'medium' },
  BILL:{ halal:'high',    sector:'Fintech',        tier:'medium' },
  TWLO:{ halal:'high',    sector:'Cloud',          tier:'medium' },
  // LARGE $101–$200
  NVDA:{ halal:'high',    sector:'Semiconductors', tier:'large'  },
  MSFT:{ halal:'high',    sector:'Cloud/AI',       tier:'large'  },
  AAPL:{ halal:'medium',  sector:'Consumer Tech',  tier:'large'  },
  LLY: { halal:'high',    sector:'Pharma',         tier:'large'  },
  AVGO:{ halal:'high',    sector:'Semiconductors', tier:'large'  },
  TMO: { halal:'high',    sector:'Life Sciences',  tier:'large'  },
  ISRG:{ halal:'high',    sector:'Robotic Surgery',tier:'large'  },
  PANW:{ halal:'high',    sector:'Cybersecurity',  tier:'large'  },
  NOW: { halal:'high',    sector:'Cloud SaaS',     tier:'large'  },
  AMAT:{ halal:'high',    sector:'Semiconductors', tier:'large'  },
  HD:  { halal:'high',    sector:'Retail',         tier:'large'  },
  TSLA:{ halal:'medium',  sector:'EV',             tier:'large'  },
  SNOW:{ halal:'high',    sector:'Cloud',          tier:'large'  },
  // BIG $201+
  NVO: { halal:'high',    sector:'Pharma',         tier:'big'    },
  MA:  { halal:'high',    sector:'Payments',       tier:'big'    },
  V:   { halal:'high',    sector:'Payments',       tier:'big'    },
  COST:{ halal:'high',    sector:'Retail',         tier:'big'    },
  ADBE:{ halal:'high',    sector:'Software',       tier:'big'    },
  ORCL:{ halal:'high',    sector:'Cloud',          tier:'big'    },
  ASML:{ halal:'high',    sector:'Semiconductors', tier:'big'    },
  TSM: { halal:'high',    sector:'Semiconductors', tier:'big'    },
  INTU:{ halal:'high',    sector:'SaaS',           tier:'big'    },
};

const PRICE_BOUNDS: Record<string, [number, number]> = {
  small:[0,25], medium:[26,100], large:[101,200], big:[201,999999],
};

// ── Indicators ────────────────────────────────────────────────────────────────
function calcRSI(c: number[], p=14): number {
  if (c.length < p+1) return 50;
  let g=0, l=0;
  for (let i=c.length-p; i<c.length; i++) { const d=c[i]-c[i-1]; if(d>0) g+=d; else l+=Math.abs(d); }
  const ag=g/p, al=l/p;
  if(al===0) return 100;
  return Math.round(100-100/(1+ag/al));
}
function calcEMA(v: number[], p: number): number[] {
  const k=2/(p+1), out=[v[0]];
  for(let i=1;i<v.length;i++) out.push(v[i]*k+out[i-1]*(1-k));
  return out;
}
function calcMACD(c: number[]): { bullish: boolean; histogram: number } {
  if(c.length<35) return { bullish:false, histogram:0 };
  const e12=calcEMA(c,12), e26=calcEMA(c,26);
  const line=e12.map((v,i)=>v-e26[i]);
  const sig=calcEMA(line.slice(-9),9);
  const h=line[line.length-1]-sig[sig.length-1];
  const p=line[line.length-2]-sig[sig.length-2];
  return { bullish: h>0 && h>p, histogram: h };
}
function calcATR(c: any[], p=14): number {
  const trs: number[]=[];
  for(let i=1;i<c.length;i++) trs.push(Math.max(c[i].h-c[i].l,Math.abs(c[i].h-c[i-1].c),Math.abs(c[i].l-c[i-1].c)));
  const r=trs.slice(-p); return r.reduce((a,b)=>a+b,0)/r.length;
}
function calcVolumeRatio(v: number[]): number {
  if(v.length<21) return 1;
  const avg=v.slice(-21,-1).reduce((a,b)=>a+b,0)/20;
  return avg>0 ? parseFloat((v[v.length-1]/avg).toFixed(2)) : 1;
}
function emaLast(c: number[], p: number): number { return calcEMA(c,p).slice(-1)[0]; }

// ── FMP candle fetch (chronological order) ────────────────────────────────────
async function fetchCandles(ticker: string): Promise<{
  closes:number[]; highs:number[]; lows:number[]; volumes:number[]; price:number;
} | null> {
  if (!FMP_KEY) return null;
  try {
    const res = await fetch(
      `https://financialmodelingprep.com/stable/historical-price-eod/full?symbol=${ticker}&limit=90&apikey=${FMP_KEY}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const data  = await res.json();
    const rows: any[] = (data?.value ?? data ?? []).reverse(); // oldest first
    if (rows.length < 30) return null;
    return {
      closes:  rows.map((r:any) => r.close),
      highs:   rows.map((r:any) => r.high),
      lows:    rows.map((r:any) => r.low),
      volumes: rows.map((r:any) => r.volume),
      price:   rows[rows.length-1].close,
    };
  } catch { return null; }
}

async function hasCatalyst(ticker: string): Promise<boolean> {
  if (!FINNHUB_KEY) return false;
  try {
    const to   = new Date().toISOString().split('T')[0];
    const from = new Date(Date.now()-3*86400000).toISOString().split('T')[0];
    const res  = await fetch(`https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${FINNHUB_KEY}`, { signal:AbortSignal.timeout(4000) });
    if (!res.ok) return false;
    const articles = await res.json();
    if (!Array.isArray(articles)) return false;
    const kw = ['beat','upgrade','record','partnership','contract','raised guidance','revenue growth','launch','breakthrough'];
    return articles.some((a:any) => { const t=((a.headline??'')+(a.summary??'')).toLowerCase(); return kw.some(k=>t.includes(k)); });
  } catch { return false; }
}

// ── Signal analysis ───────────────────────────────────────────────────────────
function analyzeSetup(
  candles: { closes:number[]; highs:number[]; lows:number[]; volumes:number[]; price:number },
  catalyst: boolean,
): { setup:string; confidence:number; factors:string[]; atr:number } | null {
  const { closes, highs, lows, volumes, price } = candles;
  const rsi    = calcRSI(closes);
  const macd   = calcMACD(closes);
  const atr    = calcATR(candles.highs.map((h,i)=>({h,l:candles.lows[i],c:closes[i]})));
  const volR   = calcVolumeRatio(volumes);
  const ema20  = emaLast(closes, 20);
  const ema50  = emaLast(closes, 50);

  if (volR < 1.3)            return null; // no volume = no trade
  if (rsi > 78 || rsi < 22) return null; // extreme RSI

  const s20  = closes.slice(-20);
  const mean = s20.reduce((a,b)=>a+b,0)/20;
  const std  = Math.sqrt(s20.reduce((a,b)=>a+(b-mean)**2,0)/20);
  if ((2*std)/mean < 0.03 && volR < 2.0) return null; // sideways chop

  const factors: string[] = [];
  let score = 0;

  if (price > ema20 && price > ema50) { score++; factors.push(`Trend aligned — above 20 & 50 EMA`); }
  else if (price > ema20)             { factors.push(`Partial trend — above 20 EMA only`); }

  if (rsi >= 50 && rsi <= 65)         { score++; factors.push(`RSI ${rsi} — healthy momentum`); }
  else if (rsi > 65 && rsi <= 75)     { factors.push(`RSI ${rsi} — elevated, reduce size`); }
  else if (rsi >= 30 && rsi < 48)     { score++; factors.push(`RSI ${rsi} — oversold bounce zone`); }

  score++;
  factors.push(`Volume ${volR.toFixed(1)}× avg — ${volR >= 2 ? 'strong' : 'confirmed'}`);

  const atrFull = calcATR(highs.slice(0,-5).map((h,i)=>({h,l:lows.slice(0,-5)[i],c:closes.slice(0,-5)[i]})));
  if (atr > atrFull * 1.08) { score++; factors.push(`ATR expanding — volatility supports move`); }

  if (macd.bullish) { score++; factors.push(`MACD bullish — histogram expanding`); }

  if (catalyst) { score++; factors.push(`News catalyst in past 72h`); }

  if (score < 4) return null;

  const high20 = Math.max(...closes.slice(-21,-1));
  let setup: string;
  if      (price > high20 && volR >= 1.8)  setup = 'Momentum Breakout';
  else if (rsi < 45 && price > ema20)      setup = 'Dip Buy Reversal';
  else if (catalyst && volR >= 1.5)        setup = 'News Catalyst';
  else if (score >= 5)                     setup = 'Momentum Breakout';
  else return null;

  return { setup, confidence: Math.min(10, score), factors, atr };
}

function buildPlan(ticker:string, price:number, atr:number, setup:string, confidence:number, factors:string[], capital:number, halal:string, sector:string) {
  const stopDist = atr*1.5;
  const shares   = Math.max(1, Math.floor((capital*0.03)/stopDist));
  return {
    ticker, setup_type:setup, halal, sector,
    entry_price:   parseFloat(price.toFixed(2)),
    stop_loss:     parseFloat((price-stopDist).toFixed(2)),
    take_profit_1: parseFloat((price+atr*2.0).toFixed(2)),
    take_profit_2: parseFloat((price+atr*3.5).toFixed(2)),
    confidence, shares,
    position_value: parseFloat((shares*price).toFixed(2)),
    max_loss:       parseFloat((shares*stopDist).toFixed(2)),
    factors,
    reasoning: factors.slice(0,2).join('. '),
    hold_days:  setup==='News Catalyst' ? '1 day' : '1–3 days',
  };
}

async function batchFetch<T>(tickers:string[], fn:(t:string)=>Promise<T|null>, concurrency=5, delayMs=1000): Promise<Map<string,T|null>> {
  const map = new Map<string,T|null>();
  for (let i=0; i<tickers.length; i+=concurrency) {
    const batch = tickers.slice(i,i+concurrency);
    const res   = await Promise.all(batch.map(async t=>({t,v:await fn(t)})));
    res.forEach(({t,v})=>map.set(t,v));
    if (i+concurrency<tickers.length) await new Promise(r=>setTimeout(r,delayMs));
  }
  return map;
}

// ── Main ──────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data:{user} } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error:'Unauthorized' }, { status:401 });

  if (!FMP_KEY) {
    return NextResponse.json({ signal:'NO_TRADE', reason:'FMP_API_KEY not configured. Add it to Vercel environment variables.', scanned:0, setups:[] });
  }

  const body = await request.json().catch(()=>({}));
  const { price_ranges=['small','medium','large','big'], capital=10000 } = body;
  const selectedTiers = new Set<string>(price_ranges);

  const candidates = Object.entries(UNIVERSE)
    .filter(([,m]) => selectedTiers.has(m.tier))
    .map(([ticker]) => ticker);

  if (candidates.length === 0) {
    return NextResponse.json({ signal:'NO_TRADE', reason:'No candidates for selected ranges.', scanned:0, setups:[] });
  }

  // Fetch candles (FMP) — 5 concurrent, 1s between batches
  const candleMap = await batchFetch(candidates, fetchCandles, 5, 1000);

  // Filter by actual price
  const selectedBounds = (price_ranges as string[]).map((r:string)=>PRICE_BOUNDS[r]).filter(Boolean);
  const inRange = candidates.filter(t => {
    const c = candleMap.get(t);
    return c && selectedBounds.some(([min,max])=>c.price>=min && c.price<=max);
  });

  if (inRange.length === 0) {
    const fetched = candidates.filter(t=>candleMap.get(t)!==null).length;
    const reason  = fetched===0
      ? 'Could not fetch market data from FMP. Check FMP_API_KEY and try again in 60 seconds.'
      : `${fetched} stocks fetched but none matched selected price range(s). Try "All Ranges".`;
    return NextResponse.json({ signal:'NO_TRADE', reason, scanned:0, setups:[] });
  }

  // Catalyst check
  const catalystMap = await batchFetch(inRange, hasCatalyst, 8, 400);

  // Score setups
  const validSetups: any[] = [];
  const rejectLog: string[] = [];

  for (const ticker of inRange) {
    const candles  = candleMap.get(ticker);
    const catalyst = catalystMap.get(ticker) ?? false;
    if (!candles) continue;

    const analysis = analyzeSetup(candles, catalyst);
    if (!analysis) {
      rejectLog.push(`${ticker}: RSI ${calcRSI(candles.closes)}, Vol ${calcVolumeRatio(candles.volumes).toFixed(1)}×`);
      continue;
    }
    const meta = UNIVERSE[ticker];
    validSetups.push(buildPlan(ticker, candles.price, analysis.atr, analysis.setup, analysis.confidence, analysis.factors, capital, meta.halal, meta.sector));
  }

  validSetups.sort((a,b)=>b.confidence-a.confidence);

  if (validSetups.length === 0) {
    return NextResponse.json({
      signal: 'NO_TRADE',
      reason: `Scanned ${inRange.length} halal stocks. No setups met all required criteria today. This is normal — capital preservation is the priority.`,
      scanned: inRange.length,
      reject_sample: rejectLog.slice(0,5),
      setups: [],
    });
  }

  return NextResponse.json({
    signal: 'SETUPS_FOUND',
    scanned: inRange.length,
    found:   validSetups.length,
    setups:  validSetups.slice(0,5),
    generated_at: new Date().toISOString(),
  });
}
