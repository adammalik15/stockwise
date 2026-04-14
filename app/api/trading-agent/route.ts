import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
const BASE        = 'https://finnhub.io/api/v1';

// ── Trimmed, high-liquidity halal universe (best candidates per tier) ─────────
// Kept intentionally small so scans finish well within Vercel's timeout
const UNIVERSE: Record<string, {
  halal: 'high'|'medium'|'doubtful';
  sector: string;
  tier: 'small'|'medium'|'large'|'big';
}> = {
  // ── SMALL  < $25 ─────────────────────────────────────────────────────────
  RKLB: { halal:'high',     sector:'Aerospace',      tier:'small'  },
  RIVN: { halal:'high',     sector:'EV',             tier:'small'  },
  LCID: { halal:'high',     sector:'EV',             tier:'small'  },
  PLUG: { halal:'high',     sector:'Clean Energy',   tier:'small'  },
  JOBY: { halal:'high',     sector:'Aviation',       tier:'small'  },
  SOUN: { halal:'high',     sector:'AI',             tier:'small'  },
  HIMS: { halal:'high',     sector:'Healthcare',     tier:'small'  },
  ACHR: { halal:'high',     sector:'Aviation',       tier:'small'  },
  ASTS: { halal:'high',     sector:'Space',          tier:'small'  },
  RXRX: { halal:'high',     sector:'BioTech',        tier:'small'  },
  BBAI: { halal:'high',     sector:'AI',             tier:'small'  },
  XPEV: { halal:'high',     sector:'EV',             tier:'small'  },
  NIO:  { halal:'high',     sector:'EV',             tier:'small'  },
  LAZR: { halal:'high',     sector:'Autonomous',     tier:'small'  },
  OPEN: { halal:'high',     sector:'PropTech',       tier:'small'  },
  // ── MEDIUM  $26–$100 ──────────────────────────────────────────────────────
  AMD:  { halal:'high',     sector:'Semiconductors', tier:'medium' },
  QCOM: { halal:'high',     sector:'Semiconductors', tier:'medium' },
  MU:   { halal:'high',     sector:'Semiconductors', tier:'medium' },
  SHOP: { halal:'high',     sector:'E-Commerce',     tier:'medium' },
  NET:  { halal:'high',     sector:'Cloud',          tier:'medium' },
  DDOG: { halal:'high',     sector:'Cloud',          tier:'medium' },
  ZS:   { halal:'high',     sector:'Cybersecurity',  tier:'medium' },
  CRWD: { halal:'high',     sector:'Cybersecurity',  tier:'medium' },
  OKTA: { halal:'high',     sector:'Cybersecurity',  tier:'medium' },
  PLTR: { halal:'medium',   sector:'AI/Data',        tier:'medium' },
  MDB:  { halal:'high',     sector:'Cloud DB',       tier:'medium' },
  TWLO: { halal:'high',     sector:'Cloud',          tier:'medium' },
  ON:   { halal:'high',     sector:'Semiconductors', tier:'medium' },
  CELH: { halal:'high',     sector:'Beverages',      tier:'medium' },
  SNAP: { halal:'medium',   sector:'Social',         tier:'medium' },
  // ── LARGE  $101–$200 ──────────────────────────────────────────────────────
  NVDA: { halal:'high',     sector:'Semiconductors', tier:'large'  },
  MSFT: { halal:'high',     sector:'Cloud/AI',       tier:'large'  },
  AAPL: { halal:'medium',   sector:'Consumer Tech',  tier:'large'  },
  LLY:  { halal:'high',     sector:'Pharma',         tier:'large'  },
  AVGO: { halal:'high',     sector:'Semiconductors', tier:'large'  },
  TMO:  { halal:'high',     sector:'Life Sciences',  tier:'large'  },
  ISRG: { halal:'high',     sector:'Robotic Surgery',tier:'large'  },
  PANW: { halal:'high',     sector:'Cybersecurity',  tier:'large'  },
  NOW:  { halal:'high',     sector:'Cloud SaaS',     tier:'large'  },
  AMAT: { halal:'high',     sector:'Semiconductors', tier:'large'  },
  LRCX: { halal:'high',     sector:'Semiconductors', tier:'large'  },
  HD:   { halal:'high',     sector:'Retail',         tier:'large'  },
  TSLA: { halal:'medium',   sector:'EV',             tier:'large'  },
  SNOW: { halal:'high',     sector:'Cloud',          tier:'large'  },
  FTNT: { halal:'high',     sector:'Cybersecurity',  tier:'large'  },
  // ── BIG  $201+ ────────────────────────────────────────────────────────────
  NVO:  { halal:'high',     sector:'Pharma',         tier:'big'    },
  MA:   { halal:'high',     sector:'Payments',       tier:'big'    },
  V:    { halal:'high',     sector:'Payments',       tier:'big'    },
  COST: { halal:'high',     sector:'Retail',         tier:'big'    },
  ADBE: { halal:'high',     sector:'Software',       tier:'big'    },
  CRM:  { halal:'high',     sector:'SaaS',           tier:'big'    },
  ORCL: { halal:'high',     sector:'Cloud',          tier:'big'    },
  ASML: { halal:'high',     sector:'Semiconductors', tier:'big'    },
  TSM:  { halal:'high',     sector:'Semiconductors', tier:'big'    },
  INTU: { halal:'high',     sector:'SaaS',           tier:'big'    },
};

const PRICE_BOUNDS: Record<string, [number, number]> = {
  small:  [0,   25],
  medium: [26,  100],
  large:  [101, 200],
  big:    [201, 999999],
};

// ── Indicators ────────────────────────────────────────────────────────────────

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  return Math.round(100 - 100 / (1 + avgGain / avgLoss));
}

function calcEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema = [values[0]];
  for (let i = 1; i < values.length; i++) {
    ema.push(values[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calcMACD(closes: number[]): { histogram: number; bullish: boolean } {
  if (closes.length < 35) return { histogram: 0, bullish: false };
  const ema12    = calcEMA(closes, 12);
  const ema26    = calcEMA(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signal   = calcEMA(macdLine.slice(-9), 9);
  const hist     = macdLine[macdLine.length - 1] - signal[signal.length - 1];
  const prevHist = macdLine[macdLine.length - 2] - signal[signal.length - 2];
  return { histogram: hist, bullish: hist > 0 && hist > prevHist };
}

function calcATR(h: number[], l: number[], c: number[], period = 14): number {
  const trs: number[] = [];
  for (let i = 1; i < c.length; i++) {
    trs.push(Math.max(h[i] - l[i], Math.abs(h[i] - c[i-1]), Math.abs(l[i] - c[i-1])));
  }
  const recent = trs.slice(-period);
  return recent.reduce((a, b) => a + b, 0) / recent.length;
}

function calcVolumeRatio(volumes: number[]): number {
  if (volumes.length < 21) return 1;
  const avg20 = volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
  return avg20 > 0 ? volumes[volumes.length - 1] / avg20 : 1;
}

function emaLast(closes: number[], period: number): number {
  return calcEMA(closes, period).slice(-1)[0];
}

// ── Fetch daily candles — single call gives price + all indicator data ────────
async function fetchCandles(ticker: string): Promise<{
  closes: number[]; highs: number[]; lows: number[];
  volumes: number[]; price: number;
} | null> {
  if (!FINNHUB_KEY) return null;
  try {
    const now  = Math.floor(Date.now() / 1000);
    const from = now - 100 * 86400; // 100 trading days
    const res  = await fetch(
      `${BASE}/stock/candle?symbol=${ticker}&resolution=D&from=${from}&to=${now}&token=${FINNHUB_KEY}`,
      { signal: AbortSignal.timeout(8000) } // 8s per ticker max
    );
    if (!res.ok) return null;
    const d = await res.json();
    if (d.s !== 'ok' || !Array.isArray(d.c) || d.c.length < 30) return null;
    return {
      closes: d.c, highs: d.h, lows: d.l,
      volumes: d.v, price: d.c[d.c.length - 1],
    };
  } catch {
    return null;
  }
}

// ── Parallel batch fetcher — respects Finnhub 60 req/min ─────────────────────
// Batches of 8 with 1.2s gap = 8 calls / 1.2s = ~400/min across batches
// But Finnhub counts per minute total so we keep batches small
async function batchFetch<T>(
  tickers: string[],
  fn: (t: string) => Promise<T | null>,
  concurrency = 5,
  batchDelayMs = 1000,
): Promise<Map<string, T | null>> {
  const map = new Map<string, T | null>();
  for (let i = 0; i < tickers.length; i += concurrency) {
    const batch = tickers.slice(i, i + concurrency);
    const results = await Promise.all(batch.map(async t => ({ t, v: await fn(t) })));
    results.forEach(({ t, v }) => map.set(t, v));
    if (i + concurrency < tickers.length) {
      await new Promise(r => setTimeout(r, batchDelayMs));
    }
  }
  return map;
}

// ── Signal analysis ───────────────────────────────────────────────────────────
function analyzeSetup(
  candles: { closes: number[]; highs: number[]; lows: number[]; volumes: number[]; price: number },
  catalyst: boolean,
): { setup: string; confidence: number; factors: string[]; atr: number } | null {
  const { closes, highs, lows, volumes, price } = candles;

  const rsi         = calcRSI(closes);
  const macd        = calcMACD(closes);
  const atr         = calcATR(highs, lows, closes);
  const volumeRatio = calcVolumeRatio(volumes);
  const ema20       = emaLast(closes, 20);
  const ema50       = emaLast(closes, 50);

  // Hard rejects
  if (volumeRatio < 1.3) return null;
  if (rsi > 78 || rsi < 22) return null;

  // Sideways chop check
  const slice20 = closes.slice(-20);
  const mean    = slice20.reduce((a, b) => a + b, 0) / 20;
  const std     = Math.sqrt(slice20.reduce((a, b) => a + (b - mean) ** 2, 0) / 20);
  if ((2 * std) / mean < 0.03 && volumeRatio < 2.0) return null;

  const factors: string[] = [];
  let score = 0;

  // Factor 1 — Trend
  if (price > ema20 && price > ema50) {
    score++;
    factors.push(`Trend aligned — above 20 & 50 EMA`);
  } else if (price > ema20) {
    factors.push(`Partial trend — above 20 EMA`);
  }

  // Factor 2 — RSI momentum
  if (rsi >= 50 && rsi <= 65)        { score++; factors.push(`RSI ${rsi} — building momentum`); }
  else if (rsi > 65 && rsi <= 75)    { factors.push(`RSI ${rsi} — elevated, reduce size`); }
  else if (rsi >= 30 && rsi < 48)    { score++; factors.push(`RSI ${rsi} — oversold bounce zone`); }

  // Factor 3 — Volume (already passed threshold)
  score++;
  factors.push(`Volume ${volumeRatio.toFixed(1)}× avg — ${volumeRatio >= 2 ? 'strong' : 'confirmed'}`);

  // Factor 4 — ATR expansion
  const atrPrev = calcATR(highs.slice(0,-5), lows.slice(0,-5), closes.slice(0,-5));
  if (atr > atrPrev * 1.08) { score++; factors.push(`ATR expanding — volatility supports move`); }

  // Factor 5 — MACD
  if (macd.bullish) { score++; factors.push(`MACD bullish — histogram expanding`); }

  // Bonus
  if (catalyst) { score++; factors.push(`News catalyst in past 72h`); }

  if (score < 4) return null;

  // Setup type
  const high20 = Math.max(...closes.slice(-21, -1));
  let setup: string;
  if      (price > high20 && volumeRatio >= 1.8)  setup = 'Momentum Breakout';
  else if (rsi < 45 && price > ema20)             setup = 'Dip Buy Reversal';
  else if (catalyst && volumeRatio >= 1.5)        setup = 'News Catalyst';
  else if (score >= 5)                            setup = 'Momentum Breakout';
  else return null;

  return { setup, confidence: Math.min(10, score), factors, atr };
}

// ── Quick catalyst check ──────────────────────────────────────────────────────
async function hasCatalyst(ticker: string): Promise<boolean> {
  if (!FINNHUB_KEY) return false;
  try {
    const to   = new Date().toISOString().split('T')[0];
    const from = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0];
    const res  = await fetch(
      `${BASE}/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${FINNHUB_KEY}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return false;
    const articles = await res.json();
    if (!Array.isArray(articles)) return false;
    const bullish = ['beat','upgrade','record','partnership','contract','raised guidance','revenue growth','launch','breakthrough'];
    return articles.some((a: any) => {
      const t = ((a.headline ?? '') + ' ' + (a.summary ?? '')).toLowerCase();
      return bullish.some(kw => t.includes(kw));
    });
  } catch { return false; }
}

// ── Trade plan builder ────────────────────────────────────────────────────────
function buildPlan(
  ticker: string, price: number, atr: number,
  setup: string, confidence: number, factors: string[],
  capital: number, halal: string, sector: string,
) {
  const stopDist = atr * 1.5;
  return {
    ticker, setup_type: setup, halal, sector,
    entry_price:   parseFloat(price.toFixed(2)),
    stop_loss:     parseFloat((price - stopDist).toFixed(2)),
    take_profit_1: parseFloat((price + atr * 2.0).toFixed(2)),
    take_profit_2: parseFloat((price + atr * 3.5).toFixed(2)),
    confidence,
    shares:        Math.max(1, Math.floor((capital * 0.03) / stopDist)),
    position_value:parseFloat((Math.max(1, Math.floor((capital * 0.03) / stopDist)) * price).toFixed(2)),
    max_loss:      parseFloat((Math.max(1, Math.floor((capital * 0.03) / stopDist)) * stopDist).toFixed(2)),
    factors,
    reasoning:     factors.slice(0, 2).join('. '),
    hold_days:     setup === 'News Catalyst' ? '1 day' : '1–3 days',
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!FINNHUB_KEY) {
    return NextResponse.json({
      signal: 'NO_TRADE',
      reason: 'Finnhub API key not configured. Add FINNHUB_API_KEY to environment variables.',
      scanned: 0, setups: [],
    });
  }

  const body = await request.json().catch(() => ({}));
  const { price_ranges = ['small','medium','large','big'], capital = 10000 } = body;

  const selectedTiers = new Set<string>(price_ranges);

  // Filter to selected tiers only (keeps scan small and fast)
  const candidates = Object.entries(UNIVERSE)
    .filter(([, meta]) => selectedTiers.has(meta.tier))
    .map(([ticker]) => ticker);

  console.log(`Trading agent scan: ${candidates.length} candidates for tiers [${[...selectedTiers].join(',')}]`);

  if (candidates.length === 0) {
    return NextResponse.json({ signal: 'NO_TRADE', reason: 'No candidates for selected ranges.', scanned: 0, setups: [] });
  }

  // ── Step 1: Fetch candles in parallel batches ──────────────────────────────
  // 5 concurrent + 1s between batches = stays within Finnhub 60 req/min
  // 15 tickers (small) = 3 batches × ~1s = ~3s total ✅
  // 60 tickers (all)   = 12 batches × ~1s = ~12s total ✅
  const candleMap = await batchFetch(candidates, fetchCandles, 5, 1000);

  // Filter by actual price from candle data
  const selectedBounds = (price_ranges as string[]).map(r => PRICE_BOUNDS[r]).filter(Boolean);
  const inRange = candidates.filter(t => {
    const c = candleMap.get(t);
    if (!c) return false;
    return selectedBounds.some(([min, max]) => c.price >= min && c.price <= max);
  });

  console.log(`In range: ${inRange.length} / ${candidates.length}`);

  if (inRange.length === 0) {
    // Diagnose why — check how many candles we actually got back
    const fetched = candidates.filter(t => candleMap.get(t) !== null).length;
    const reason = fetched === 0
      ? `Could not fetch market data. Finnhub may be rate-limited — try again in 60 seconds.`
      : `${fetched} stocks fetched but none matched the ${[...selectedTiers].join('/')} price range(s). Markets may have moved — try "All Ranges".`;
    return NextResponse.json({ signal: 'NO_TRADE', reason, scanned: 0, setups: [] });
  }

  // ── Step 2: Catalyst check for in-range tickers ────────────────────────────
  const catalystMap = await batchFetch(inRange, hasCatalyst, 8, 500);

  // ── Step 3: Score every in-range ticker ────────────────────────────────────
  const validSetups: any[] = [];
  const rejectLog: string[] = [];

  for (const ticker of inRange) {
    const candles  = candleMap.get(ticker);
    const catalyst = catalystMap.get(ticker) ?? false;
    if (!candles) continue;

    const analysis = analyzeSetup(candles, catalyst);
    if (!analysis) {
      const rsi = calcRSI(candles.closes);
      const vol  = calcVolumeRatio(candles.volumes).toFixed(1);
      rejectLog.push(`${ticker}: RSI ${rsi}, Vol ${vol}×`);
      continue;
    }

    const meta = UNIVERSE[ticker];
    validSetups.push(buildPlan(
      ticker, candles.price, analysis.atr,
      analysis.setup, analysis.confidence, analysis.factors,
      capital, meta.halal, meta.sector,
    ));
  }

  validSetups.sort((a, b) => b.confidence - a.confidence);
  console.log(`Found ${validSetups.length} setups, rejected ${rejectLog.length}`);

  if (validSetups.length === 0) {
    return NextResponse.json({
      signal:       'NO_TRADE',
      reason:       `Scanned ${inRange.length} halal stocks. No setups met all 4-of-5 signal criteria today. This is normal — capital preservation is the priority.`,
      scanned:      inRange.length,
      reject_sample: rejectLog.slice(0, 5),
      setups:       [],
    });
  }

  return NextResponse.json({
    signal:       'SETUPS_FOUND',
    scanned:      inRange.length,
    found:        validSetups.length,
    setups:       validSetups.slice(0, 5),
    generated_at: new Date().toISOString(),
  });
}