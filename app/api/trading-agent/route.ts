import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const FINNHUB_KEY   = process.env.FINNHUB_API_KEY;
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL         = 'claude-sonnet-4-6';
const BASE          = 'https://finnhub.io/api/v1';

// ── Halal-screened universe ──────────────────────────────────────────────────
const UNIVERSE: Record<string, { halal: 'high'|'medium'|'doubtful'|'haram'; sector: string }> = {
  // SMALL < $25
  RKLB: { halal:'high',     sector:'Aerospace'       },
  SOFI: { halal:'doubtful', sector:'Fintech'         },
  XPEV: { halal:'high',     sector:'EV'              },
  RIVN: { halal:'high',     sector:'EV'              },
  LCID: { halal:'high',     sector:'EV'              },
  PLUG: { halal:'high',     sector:'Clean Energy'    },
  JOBY: { halal:'high',     sector:'Aviation'        },
  ARRY: { halal:'high',     sector:'Solar'           },
  OPEN: { halal:'high',     sector:'PropTech'        },
  SOUN: { halal:'high',     sector:'AI'              },
  BBAI: { halal:'high',     sector:'AI'              },
  HIMS: { halal:'high',     sector:'Healthcare'      },
  RXRX: { halal:'high',     sector:'BioTech'         },
  ACHR: { halal:'high',     sector:'Aviation'        },
  ASTS: { halal:'high',     sector:'Space'           },
  RCAT: { halal:'high',     sector:'Drones'          },
  LAZR: { halal:'high',     sector:'Autonomous Tech' },
  MVIS: { halal:'high',     sector:'Sensors'         },
  INDI: { halal:'high',     sector:'Semiconductors'  },
  TMDX: { halal:'high',     sector:'MedTech'         },
  // MEDIUM $26–$100
  AMD:  { halal:'high',     sector:'Semiconductors'  },
  QCOM: { halal:'high',     sector:'Semiconductors'  },
  MU:   { halal:'high',     sector:'Semiconductors'  },
  SNDK: { halal:'high',     sector:'Storage'         },
  SHOP: { halal:'high',     sector:'E-Commerce'      },
  PINS: { halal:'medium',   sector:'Social'          },
  SNAP: { halal:'medium',   sector:'Social'          },
  COIN: { halal:'doubtful', sector:'Crypto'          },
  APP:  { halal:'doubtful', sector:'Ad Tech'         },
  TWLO: { halal:'high',     sector:'Cloud'           },
  DDOG: { halal:'high',     sector:'Cloud'           },
  NET:  { halal:'high',     sector:'Cloud'           },
  ZS:   { halal:'high',     sector:'Cybersecurity'   },
  OKTA: { halal:'high',     sector:'Cybersecurity'   },
  CRWD: { halal:'high',     sector:'Cybersecurity'   },
  PLTR: { halal:'medium',   sector:'AI/Data'         },
  AI:   { halal:'high',     sector:'AI'              },
  PATH: { halal:'high',     sector:'Automation'      },
  GTLB: { halal:'high',     sector:'Dev Tools'       },
  MDB:  { halal:'high',     sector:'Cloud DB'        },
  DOCN: { halal:'high',     sector:'Cloud'           },
  CELH: { halal:'high',     sector:'Beverages'       },
  NIO:  { halal:'high',     sector:'EV'              },
  LI:   { halal:'high',     sector:'EV'              },
  ON:   { halal:'high',     sector:'Semiconductors'  },
  MPWR: { halal:'high',     sector:'Semiconductors'  },
  PSTG: { halal:'high',     sector:'Storage'         },
  CIEN: { halal:'high',     sector:'Telecom Tech'    },
  WOLF: { halal:'high',     sector:'Semiconductors'  },
  AFRM: { halal:'doubtful', sector:'Fintech'         },
  BILL: { halal:'high',     sector:'Fintech'         },
  // LARGE $101–$200
  NVDA: { halal:'high',     sector:'Semiconductors'  },
  MSFT: { halal:'high',     sector:'Cloud/AI'        },
  AAPL: { halal:'medium',   sector:'Consumer Tech'   },
  TSLA: { halal:'medium',   sector:'EV'              },
  LLY:  { halal:'high',     sector:'Pharma'          },
  AVGO: { halal:'high',     sector:'Semiconductors'  },
  TMO:  { halal:'high',     sector:'Life Sciences'   },
  ABT:  { halal:'high',     sector:'MedTech'         },
  ISRG: { halal:'high',     sector:'Robotic Surgery' },
  HD:   { halal:'high',     sector:'Retail'          },
  TXN:  { halal:'high',     sector:'Semiconductors'  },
  AMAT: { halal:'high',     sector:'Semiconductors'  },
  LRCX: { halal:'high',     sector:'Semiconductors'  },
  KLAC: { halal:'high',     sector:'Semiconductors'  },
  MRVL: { halal:'high',     sector:'Semiconductors'  },
  FTNT: { halal:'high',     sector:'Cybersecurity'   },
  PANW: { halal:'high',     sector:'Cybersecurity'   },
  SNOW: { halal:'high',     sector:'Cloud'           },
  NOW:  { halal:'high',     sector:'Cloud SaaS'      },
  WDAY: { halal:'high',     sector:'SaaS'            },
  VEEV: { halal:'high',     sector:'Health SaaS'     },
  IDXX: { halal:'high',     sector:'Vet Diagnostics' },
  BSX:  { halal:'high',     sector:'MedTech'         },
  SYK:  { halal:'high',     sector:'MedTech'         },
  DHR:  { halal:'high',     sector:'Life Sciences'   },
  PAVE: { halal:'high',     sector:'Infrastructure'  },
  EW:   { halal:'high',     sector:'MedTech'         },
  DXCM: { halal:'high',     sector:'MedTech'         },
  // BIG $201+
  NVO:  { halal:'high',     sector:'Pharma'          },
  MA:   { halal:'high',     sector:'Payments'        },
  V:    { halal:'high',     sector:'Payments'        },
  COST: { halal:'high',     sector:'Retail'          },
  INTU: { halal:'high',     sector:'SaaS'            },
  ADBE: { halal:'high',     sector:'Software'        },
  CRM:  { halal:'high',     sector:'SaaS'            },
  ORCL: { halal:'high',     sector:'Cloud'           },
  ASML: { halal:'high',     sector:'Semiconductors'  },
  TSM:  { halal:'high',     sector:'Semiconductors'  },
  MELI: { halal:'high',     sector:'E-Commerce'      },
  AZO:  { halal:'high',     sector:'Auto Parts'      },
  ORLY: { halal:'high',     sector:'Auto Parts'      },
  DECK: { halal:'high',     sector:'Footwear'        },
  SAP:  { halal:'high',     sector:'ERP'             },
};

const PRICE_BOUNDS: Record<string, [number, number]> = {
  small:  [0,   25],
  medium: [26,  100],
  large:  [101, 200],
  big:    [201, 999999],
};

// ── Indicators ───────────────────────────────────────────────────────────────

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
  return Math.round(100 - (100 / (1 + avgGain / avgLoss)));
}

function calcEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema = [values[0]];
  for (let i = 1; i < values.length; i++) {
    ema.push(values[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calcMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
  if (closes.length < 35) return { macd: 0, signal: 0, histogram: 0 };
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = calcEMA(macdLine.slice(-9), 9);
  const lastMacd   = macdLine[macdLine.length - 1];
  const lastSignal = signalLine[signalLine.length - 1];
  return {
    macd:      parseFloat(lastMacd.toFixed(4)),
    signal:    parseFloat(lastSignal.toFixed(4)),
    histogram: parseFloat((lastMacd - lastSignal).toFixed(4)),
  };
}

function calcATR(highs: number[], lows: number[], closes: number[], period = 14): number {
  const trs: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    trs.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i]  - closes[i - 1])
    ));
  }
  const recent = trs.slice(-period);
  return parseFloat((recent.reduce((a, b) => a + b, 0) / recent.length).toFixed(4));
}

function calcVolumeRatio(volumes: number[]): number {
  if (volumes.length < 21) return 1;
  const avg20 = volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
  const today  = volumes[volumes.length - 1];
  return avg20 > 0 ? parseFloat((today / avg20).toFixed(2)) : 1;
}

function calcEMALast(closes: number[], period: number): number {
  return calcEMA(closes, period).slice(-1)[0];
}

// ── Fetch candles (includes price, so no separate quote call needed) ──────────
async function fetchCandles(ticker: string): Promise<{
  closes: number[]; highs: number[]; lows: number[];
  volumes: number[]; price: number;
} | null> {
  if (!FINNHUB_KEY) return null;
  try {
    const now  = Math.floor(Date.now() / 1000);
    const from = now - 90 * 86400;
    const res  = await fetch(
      `${BASE}/stock/candle?symbol=${ticker}&resolution=D&from=${from}&to=${now}&token=${FINNHUB_KEY}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.s !== 'ok' || !Array.isArray(data.c) || data.c.length < 30) return null;
    return {
      closes:  data.c,
      highs:   data.h,
      lows:    data.l,
      volumes: data.v,
      price:   data.c[data.c.length - 1],
    };
  } catch {
    return null;
  }
}

// ── Check for bullish news catalyst ──────────────────────────────────────────
async function hasCatalyst(ticker: string): Promise<boolean> {
  if (!FINNHUB_KEY) return false;
  try {
    const to   = new Date().toISOString().split('T')[0];
    const from = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0];
    const res  = await fetch(
      `${BASE}/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${FINNHUB_KEY}`
    );
    if (!res.ok) return false;
    const articles = await res.json();
    if (!Array.isArray(articles) || articles.length === 0) return false;
    const bullishKeywords = [
      'beat','beat expectations','revenue growth','record','upgrade','raised guidance',
      'partnership','contract','launch','breakthrough','outperform','strong earnings',
    ];
    return articles.some((a: any) => {
      const text = ((a.headline ?? '') + ' ' + (a.summary ?? '')).toLowerCase();
      return bullishKeywords.some(kw => text.includes(kw));
    });
  } catch {
    return false;
  }
}

// ── Signal analysis — returns null if setup does not qualify ─────────────────
function analyzeSetup(candles: {
  closes: number[]; highs: number[]; lows: number[];
  volumes: number[]; price: number;
}, catalyst: boolean): {
  setup: string; confidence: number; factors: string[];
  atr: number; rsi: number; volumeRatio: number;
} | null {
  const { closes, highs, lows, volumes, price } = candles;

  const rsi         = calcRSI(closes);
  const macd        = calcMACD(closes);
  const atr         = calcATR(highs, lows, closes);
  const volumeRatio = calcVolumeRatio(volumes);
  const ema20       = calcEMALast(closes, 20);
  const ema50       = calcEMALast(closes, 50);

  // ── Hard rejects — no exceptions ──
  if (volumeRatio < 1.3)  return null; // no volume confirmation
  if (rsi > 78)           return null; // severely overbought
  if (rsi < 22)           return null; // breakdown / capitulation

  // Check for sideways chop — Bollinger Band width
  const recent20  = closes.slice(-20);
  const mean      = recent20.reduce((a, b) => a + b, 0) / 20;
  const std       = Math.sqrt(recent20.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / 20);
  const bbWidth   = (2 * std) / mean;
  if (bbWidth < 0.03 && volumeRatio < 2.0) return null; // choppy/sideways without breakout volume

  const factors: string[] = [];
  let score = 0;

  // Factor 1 — Trend alignment
  if (price > ema20 && price > ema50) {
    score++;
    factors.push(`Trend aligned — price above both 20 & 50 EMA`);
  } else if (price > ema20) {
    factors.push(`Partial trend — above 20 EMA, below 50 EMA`);
  }

  // Factor 2 — RSI zone
  if (rsi >= 50 && rsi <= 65) {
    score++;
    factors.push(`RSI ${rsi} — momentum building, not overbought`);
  } else if (rsi > 65 && rsi <= 75) {
    factors.push(`RSI ${rsi} — elevated, reduce position size`);
  } else if (rsi >= 30 && rsi < 48) {
    score++;
    factors.push(`RSI ${rsi} — oversold bounce zone`);
  }

  // Factor 3 — Volume (already passed 1.3× threshold above)
  if (volumeRatio >= 2.0) {
    score++;
    factors.push(`Volume ${volumeRatio}× 20-day avg — strong institutional interest`);
  } else {
    score++;
    factors.push(`Volume ${volumeRatio}× 20-day avg — confirmed`);
  }

  // Factor 4 — ATR expansion (volatility supporting the move)
  const atrPrev = calcATR(highs.slice(0, -5), lows.slice(0, -5), closes.slice(0, -5));
  if (atr > atrPrev * 1.08) {
    score++;
    factors.push(`ATR expanding ${(atr / atrPrev).toFixed(2)}× — volatility supporting move`);
  }

  // Factor 5 — MACD
  if (macd.histogram > 0 && macd.macd > macd.signal) {
    score++;
    factors.push(`MACD bullish — histogram positive and expanding`);
  } else if (macd.histogram > 0) {
    factors.push(`MACD mildly positive`);
  }

  // Bonus — catalyst
  if (catalyst) {
    score++;
    factors.push(`News catalyst detected in past 72h`);
  }

  // Need at least 4 confirmed factors
  if (score < 4) return null;

  // ── Determine setup type ──
  const high20 = Math.max(...closes.slice(-21, -1));
  let setup: string;
  if (price > high20 && volumeRatio >= 1.8) {
    setup = 'Momentum Breakout';
  } else if (rsi < 45 && price > ema20) {
    setup = 'Dip Buy Reversal';
  } else if (catalyst && volumeRatio >= 1.5) {
    setup = 'News Catalyst';
  } else if (score >= 5) {
    setup = 'Momentum Breakout';
  } else {
    return null;
  }

  return { setup, confidence: Math.min(10, score), factors, atr, rsi, volumeRatio };
}

// ── Build trade plan ──────────────────────────────────────────────────────────
function buildTradePlan(
  ticker: string, price: number, atr: number,
  setup: string, confidence: number, factors: string[],
  capital: number, halal: string, sector: string,
) {
  const stopDist    = atr * 1.5;
  const stopLoss    = parseFloat((price - stopDist).toFixed(2));
  const tp1         = parseFloat((price + atr * 2.0).toFixed(2));
  const tp2         = parseFloat((price + atr * 3.5).toFixed(2));
  const shares      = Math.max(1, Math.floor((capital * 0.03) / stopDist));
  const positionVal = parseFloat((shares * price).toFixed(2));
  const maxLoss     = parseFloat((shares * stopDist).toFixed(2));
  return {
    ticker, setup_type: setup, halal, sector,
    entry_price: price, stop_loss: stopLoss,
    take_profit_1: tp1, take_profit_2: tp2,
    confidence, shares, position_value: positionVal,
    max_loss: maxLoss, factors,
    reasoning: factors.slice(0, 2).join('. '),
    hold_days: setup === 'News Catalyst' ? '1 day' : '1–3 days',
  };
}

// ── Rate-limited sequential fetcher ──────────────────────────────────────────
// Sequential with delay is safer than parallel batches on free tier
async function fetchWithDelay<T>(
  tickers: string[],
  fn: (t: string) => Promise<T | null>,
  delayMs = 1100,
): Promise<{ ticker: string; result: T | null }[]> {
  const results: { ticker: string; result: T | null }[] = [];
  for (const ticker of tickers) {
    const result = await fn(ticker);
    results.push({ ticker, result });
    await new Promise(r => setTimeout(r, delayMs));
  }
  return results;
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { price_ranges = ['small','medium','large','big'], capital = 10000 } = body;

  if (!FINNHUB_KEY) {
    return NextResponse.json({
      signal: 'NO_TRADE',
      reason: 'Finnhub API key not configured.',
      setups: [],
    });
  }

  // Only scan non-haram tickers
  const candidates = Object.entries(UNIVERSE)
    .filter(([, meta]) => meta.halal !== 'haram')
    .map(([ticker]) => ticker);

  const selectedBounds: [number, number][] = (price_ranges as string[])
    .map(r => PRICE_BOUNDS[r])
    .filter(Boolean);

  // ── Fetch candles sequentially with delay to respect rate limits ──
  // This gives us price AND all indicator data in one call per ticker
  const candleResults = await fetchWithDelay(candidates, fetchCandles, 1100);

  // ── Filter by price range from candle data (no separate quote call needed) ──
  const inRange = candleResults.filter(({ result }) => {
    if (!result) return false;
    return selectedBounds.some(([min, max]) =>
      result.price >= min && result.price <= max
    );
  });

  console.log(`Price range filter: ${candidates.length} → ${inRange.length} in range`);

  if (inRange.length === 0) {
    return NextResponse.json({
      signal:  'NO_TRADE',
      reason:  `No valid price data returned for selected ranges. Check Finnhub API key and try again.`,
      scanned: 0,
      setups:  [],
    });
  }

  // ── Check news catalysts for in-range tickers ──
  const catalystResults = await fetchWithDelay(
    inRange.map(r => r.ticker),
    hasCatalyst,
    600
  );
  const catalystMap = Object.fromEntries(
    catalystResults.map(({ ticker, result }) => [ticker, result ?? false])
  );

  // ── Analyze setups ──
  const rejectLog: { ticker: string; reason: string }[] = [];
  const validSetups: any[] = [];

  for (const { ticker, result: candles } of inRange) {
    if (!candles) { rejectLog.push({ ticker, reason: 'No candle data' }); continue; }

    const analysis = analyzeSetup(candles, catalystMap[ticker] ?? false);
    if (!analysis) {
      rejectLog.push({ ticker, reason: `Score < 4 (RSI:${calcRSI(candles.closes)}, Vol:${calcVolumeRatio(candles.volumes).toFixed(1)}×)` });
      continue;
    }

    const meta = UNIVERSE[ticker];
    validSetups.push(buildTradePlan(
      ticker, candles.price, analysis.atr,
      analysis.setup, analysis.confidence, analysis.factors,
      capital, meta.halal, meta.sector,
    ));
  }

  validSetups.sort((a, b) => b.confidence - a.confidence);

  console.log(`Setups: ${validSetups.length} valid, ${rejectLog.length} rejected`);

  if (validSetups.length === 0) {
    return NextResponse.json({
      signal:       'NO_TRADE',
      reason:       `Scanned ${inRange.length} halal stocks in selected price ranges. No setups met all required criteria today. This is normal — capital preservation is the priority.`,
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