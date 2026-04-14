import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const FINNHUB_KEY    = process.env.FINNHUB_API_KEY;
const ANTHROPIC_URL  = 'https://api.anthropic.com/v1/messages';
const MODEL          = 'claude-sonnet-4-6';
const BASE           = 'https://finnhub.io/api/v1';

// ── Halal-screened universe by price tier ────────────────────────────────────
// Only liquid, tradeable US stocks with sufficient daily volume
const UNIVERSE: Record<string, { halal: 'high'|'medium'|'doubtful'|'haram'; sector: string }> = {
  // ── SMALL < $25 ─────────────────────────────────────────────────────────
  RKLB:{ halal:'high',    sector:'Aerospace'        },
  SOFI:{ halal:'doubtful',sector:'Fintech'          },
  XPEV:{ halal:'high',    sector:'EV'               },
  RIVN:{ halal:'high',    sector:'EV'               },
  LCID:{ halal:'high',    sector:'EV'               },
  PLUG:{ halal:'high',    sector:'Clean Energy'     },
  JOBY:{ halal:'high',    sector:'Aviation'         },
  ARRY:{ halal:'high',    sector:'Solar'            },
  AFRM:{ halal:'doubtful',sector:'Fintech'          },
  OPEN:{ halal:'high',    sector:'PropTech'         },
  SOUN:{ halal:'high',    sector:'AI/Audio'         },
  BBAI:{ halal:'high',    sector:'AI'               },
  SPCE:{ halal:'high',    sector:'Space'            },
  WKHS:{ halal:'high',    sector:'EV'               },
  NKLA:{ halal:'high',    sector:'EV'               },
  HIMS:{ halal:'high',    sector:'Healthcare'       },
  RXRX:{ halal:'high',    sector:'BioTech'          },
  ACHR:{ halal:'high',    sector:'Aviation'         },
  KTOS:{ halal:'medium',  sector:'Defense Tech'     },
  ASTS:{ halal:'high',    sector:'Space'            },
  RCAT:{ halal:'high',    sector:'Drones'           },
  TMDX:{ halal:'high',    sector:'MedTech'          },
  INDI:{ halal:'high',    sector:'Semiconductors'   },
  LAZR:{ halal:'high',    sector:'Autonomous Tech'  },
  MVIS:{ halal:'high',    sector:'Sensors'          },
  // ── MEDIUM $26–$100 ─────────────────────────────────────────────────────
  AMD:  { halal:'high',    sector:'Semiconductors'  },
  QCOM: { halal:'high',    sector:'Semiconductors'  },
  MU:   { halal:'high',    sector:'Semiconductors'  },
  SNDK: { halal:'high',    sector:'Storage'         },
  SHOP: { halal:'high',    sector:'E-Commerce'      },
  SQ:   { halal:'doubtful',sector:'Fintech'         },
  PINS: { halal:'medium',  sector:'Social'          },
  SNAP: { halal:'medium',  sector:'Social'          },
  UBER: { halal:'doubtful',sector:'Transport'       },
  LYFT: { halal:'doubtful',sector:'Transport'       },
  DKNG: { halal:'haram',   sector:'Gambling'        },
  COIN: { halal:'doubtful',sector:'Crypto'          },
  HOOD: { halal:'doubtful',sector:'Fintech'         },
  APP:  { halal:'doubtful',sector:'Ad Tech'         },
  TWLO: { halal:'high',    sector:'Cloud'           },
  DDOG: { halal:'high',    sector:'Cloud'           },
  NET:  { halal:'high',    sector:'Cloud'           },
  ZS:   { halal:'high',    sector:'Cybersecurity'   },
  OKTA: { halal:'high',    sector:'Cybersecurity'   },
  CRWD: { halal:'high',    sector:'Cybersecurity'   },
  PLTR: { halal:'medium',  sector:'AI/Data'         },
  AI:   { halal:'high',    sector:'AI'              },
  PATH: { halal:'high',    sector:'Automation'      },
  BILL: { halal:'high',    sector:'Fintech'         },
  GTLB: { halal:'high',    sector:'Dev Tools'       },
  MDB:  { halal:'high',    sector:'Cloud DB'        },
  ESTC: { halal:'high',    sector:'Cloud'           },
  SMAR: { halal:'high',    sector:'SaaS'            },
  DOCN: { halal:'high',    sector:'Cloud'           },
  CELH: { halal:'high',    sector:'Beverages'       },
  NIO:  { halal:'high',    sector:'EV'              },
  LI:   { halal:'high',    sector:'EV'              },
  WOLF: { halal:'high',    sector:'Semiconductors'  },
  ON:   { halal:'high',    sector:'Semiconductors'  },
  MPWR: { halal:'high',    sector:'Semiconductors'  },
  RMBS: { halal:'high',    sector:'Semiconductors'  },
  ACLS: { halal:'high',    sector:'Semiconductors'  },
  COHU: { halal:'high',    sector:'Semiconductors'  },
  CIEN: { halal:'high',    sector:'Telecom Tech'    },
  PSTG: { halal:'high',    sector:'Storage'         },
  PEGA: { halal:'high',    sector:'SaaS'            },
  // ── LARGE $101–$200 ─────────────────────────────────────────────────────
  NVDA: { halal:'high',    sector:'Semiconductors'  },
  MSFT: { halal:'high',    sector:'Cloud/AI'        },
  AAPL: { halal:'medium',  sector:'Consumer Tech'   },
  TSLA: { halal:'medium',  sector:'EV'              },
  LLY:  { halal:'high',    sector:'Pharma'          },
  AVGO: { halal:'high',    sector:'Semiconductors'  },
  TMO:  { halal:'high',    sector:'Life Sciences'   },
  ABT:  { halal:'high',    sector:'MedTech'         },
  ISRG: { halal:'high',    sector:'Robotic Surgery' },
  HD:   { halal:'high',    sector:'Retail'          },
  COST: { halal:'high',    sector:'Retail'          },
  TXN:  { halal:'high',    sector:'Semiconductors'  },
  AMAT: { halal:'high',    sector:'Semiconductors'  },
  LRCX: { halal:'high',    sector:'Semiconductors'  },
  KLAC: { halal:'high',    sector:'Semiconductors'  },
  MRVL: { halal:'high',    sector:'Semiconductors'  },
  FTNT: { halal:'high',    sector:'Cybersecurity'   },
  PANW: { halal:'high',    sector:'Cybersecurity'   },
  SNOW: { halal:'high',    sector:'Cloud'           },
  NOW:  { halal:'high',    sector:'Cloud SaaS'      },
  WDAY: { halal:'high',    sector:'SaaS'            },
  VEEV: { halal:'high',    sector:'Health SaaS'     },
  IDXX: { halal:'high',    sector:'Vet Diagnostics' },
  EW:   { halal:'high',    sector:'MedTech'         },
  DXCM: { halal:'high',    sector:'MedTech'         },
  BSX:  { halal:'high',    sector:'MedTech'         },
  SYK:  { halal:'high',    sector:'MedTech'         },
  DHR:  { halal:'high',    sector:'Life Sciences'   },
  MTD:  { halal:'high',    sector:'Lab Instruments' },
  WAT:  { halal:'high',    sector:'Lab Instruments' },
  PAVE: { halal:'high',    sector:'Infrastructure'  },
  // ── BIG $201+ ───────────────────────────────────────────────────────────
  NVO:  { halal:'high',    sector:'Pharma'          },
  MA:   { halal:'high',    sector:'Payments'        },
  V:    { halal:'high',    sector:'Payments'        },
  SPGI: { halal:'medium',  sector:'Financial Data'  },
  MCO:  { halal:'medium',  sector:'Financial Data'  },
  BLK:  { halal:'medium',  sector:'Asset Mgmt'      },
  AMP:  { halal:'medium',  sector:'Financial'       },
  GS:   { halal:'haram',   sector:'Banking'         },
  AZO:  { halal:'high',    sector:'Auto Parts'      },
  ORLY: { halal:'high',    sector:'Auto Parts'      },
  DECK: { halal:'high',    sector:'Footwear'        },
  PODD: { halal:'high',    sector:'MedTech'         },
  INTU: { halal:'high',    sector:'SaaS'            },
  ADBE: { halal:'high',    sector:'Software'        },
  CRM:  { halal:'high',    sector:'SaaS'            },
  ORCL: { halal:'high',    sector:'Cloud'           },
  SAP:  { halal:'high',    sector:'ERP'             },
  ASML: { halal:'high',    sector:'Semiconductors'  },
  TSMC: { halal:'high',    sector:'Semiconductors'  },
  TSM:  { halal:'high',    sector:'Semiconductors'  },
  MELI: { halal:'high',    sector:'E-Commerce'      },
  SE:   { halal:'high',    sector:'E-Commerce'      },
};

// ── Technical indicator calculations ────────────────────────────────────────

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round(100 - (100 / (1 + rs)));
}

function calcEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    ema.push(values[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calcMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
  if (closes.length < 26) return { macd: 0, signal: 0, histogram: 0 };
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
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i]  - closes[i - 1])
    );
    trs.push(tr);
  }
  const recent = trs.slice(-period);
  return parseFloat((recent.reduce((a, b) => a + b, 0) / recent.length).toFixed(4));
}

function calcVolumeRatio(volumes: number[]): number {
  if (volumes.length < 21) return 1;
  const avg20 = volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
  const today = volumes[volumes.length - 1];
  return avg20 > 0 ? parseFloat((today / avg20).toFixed(2)) : 1;
}

function calcEMAValue(closes: number[], period: number): number {
  const ema = calcEMA(closes, period);
  return ema[ema.length - 1];
}

function calcBollingerBands(closes: number[], period = 20): { upper: number; lower: number; squeeze: boolean } {
  const recent = closes.slice(-period);
  const mean   = recent.reduce((a, b) => a + b, 0) / period;
  const std    = Math.sqrt(recent.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / period);
  const bandwidth = (2 * std) / mean;
  return {
    upper:   parseFloat((mean + 2 * std).toFixed(2)),
    lower:   parseFloat((mean - 2 * std).toFixed(2)),
    squeeze: bandwidth < 0.04, // narrow bands = consolidation
  };
}

// ── Fetch candle data for one ticker ────────────────────────────────────────
async function fetchCandles(ticker: string): Promise<{
  closes: number[]; highs: number[]; lows: number[]; volumes: number[]; price: number;
} | null> {
  if (!FINNHUB_KEY) return null;
  const now  = Math.floor(Date.now() / 1000);
  const from = now - 90 * 86400; // 90 days of daily candles
  try {
    const res  = await fetch(
      `${BASE}/stock/candle?symbol=${ticker}&resolution=D&from=${from}&to=${now}&token=${FINNHUB_KEY}`
    );
    const data = await res.json();
    if (data.s !== 'ok' || !data.c || data.c.length < 30) return null;
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

// ── Check recent news for catalyst ──────────────────────────────────────────
async function hasNewsCatalyst(ticker: string): Promise<boolean> {
  if (!FINNHUB_KEY) return false;
  try {
    const to   = new Date().toISOString().split('T')[0];
    const from = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0];
    const res  = await fetch(
      `${BASE}/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${FINNHUB_KEY}`
    );
    const articles = await res.json();
    if (!Array.isArray(articles)) return false;
    return articles.some((a: any) => {
      const h = (a.headline ?? '').toLowerCase();
      return h.includes('beat') || h.includes('surge') || h.includes('upgrade') ||
             h.includes('record') || h.includes('launch') || h.includes('contract') ||
             h.includes('partnership') || h.includes('revenue') || h.includes('growth');
    });
  } catch {
    return false;
  }
}

// ── Determine setup type and confidence ─────────────────────────────────────
function analyzeSetup(
  ticker: string,
  data: { closes: number[]; highs: number[]; lows: number[]; volumes: number[]; price: number },
  catalyst: boolean
): {
  setup: string;
  confidence: number;
  factors: string[];
  rejectReason?: string;
  atr: number;
  rsi: number;
  macd: { macd: number; signal: number; histogram: number };
  volumeRatio: number;
  ema20: number;
  ema50: number;
} | null {
  const { closes, highs, lows, volumes, price } = data;

  const rsi         = calcRSI(closes);
  const macd        = calcMACD(closes);
  const atr         = calcATR(highs, lows, closes);
  const volumeRatio = calcVolumeRatio(volumes);
  const ema20       = calcEMAValue(closes, 20);
  const ema50       = calcEMAValue(closes, 50);
  const bb          = calcBollingerBands(closes);

  // ── Hard rejects ──
  if (volumeRatio < 1.3) return null; // volume filter — non-negotiable
  if (bb.squeeze && volumeRatio < 2.0) return null; // sideways squeeze without breakout volume
  if (rsi > 78) return null; // severely overbought
  if (rsi < 22) return null; // breakdown territory

  const factors: string[] = [];
  let score = 0;

  // Factor 1: Trend alignment
  if (price > ema20 && price > ema50) { score++; factors.push('Trend aligned (above 20 & 50 EMA)'); }
  else if (price > ema20)              { factors.push('Partial trend (above 20 EMA only)'); }

  // Factor 2: RSI momentum
  if (rsi >= 50 && rsi <= 65)          { score++; factors.push(`RSI ${rsi} — momentum building`); }
  else if (rsi > 65 && rsi <= 75)      { factors.push(`RSI ${rsi} — elevated, limit size`); }
  else if (rsi >= 30 && rsi < 45)      { score++; factors.push(`RSI ${rsi} — oversold bounce zone`); }

  // Factor 3: Volume (already passed threshold)
  if (volumeRatio >= 2.0)              { score++; factors.push(`Volume ${volumeRatio}× avg — strong confirmation`); }
  else if (volumeRatio >= 1.3)         { score++; factors.push(`Volume ${volumeRatio}× avg — confirmed`); }

  // Factor 4: ATR expansion
  const atrPrev = calcATR(highs.slice(0, -1), lows.slice(0, -1), closes.slice(0, -1));
  if (atr > atrPrev * 1.1)            { score++; factors.push('ATR expanding — volatility supporting move'); }

  // Factor 5: MACD
  if (macd.histogram > 0 && macd.macd > macd.signal) {
    score++; factors.push('MACD bullish — histogram expanding');
  } else if (macd.histogram > 0) {
    factors.push('MACD mildly bullish');
  }

  // Bonus: Catalyst
  if (catalyst) { score++; factors.push('News catalyst in last 72h'); }

  // Need at least 4 of 5 core factors
  if (score < 4) return null;

  // ── Determine setup type ──
  const highestClose20 = Math.max(...closes.slice(-21, -1));
  let setup: string;

  if (price > highestClose20 && volumeRatio >= 1.8) {
    setup = 'MOMENTUM_BREAKOUT';
  } else if (rsi < 45 && price > ema20) {
    setup = 'DIP_BUY_REVERSAL';
  } else if (catalyst && volumeRatio >= 1.5) {
    setup = 'NEWS_CATALYST';
  } else if (score >= 5) {
    setup = 'MOMENTUM_BREAKOUT';
  } else {
    return null; // no clear setup type
  }

  return {
    setup,
    confidence: Math.min(10, score + (catalyst ? 1 : 0)),
    factors,
    atr,
    rsi,
    macd,
    volumeRatio,
    ema20,
    ema50,
  } as any;
}

// ── Build trade plan ─────────────────────────────────────────────────────────
function buildTradePlan(
  ticker: string,
  price: number,
  atr: number,
  setup: string,
  confidence: number,
  factors: string[],
  userCapital: number,
  halal: string,
  sector: string,
) {
  const stopDist    = atr * 1.5;
  const stopLoss    = parseFloat((price - stopDist).toFixed(2));
  const tp1         = parseFloat((price + atr * 2.0).toFixed(2));
  const tp2         = parseFloat((price + atr * 3.5).toFixed(2));
  const capitalRisk = userCapital * 0.03;
  const shares      = Math.max(1, Math.floor(capitalRisk / stopDist));
  const positionVal = parseFloat((shares * price).toFixed(2));
  const maxLoss     = parseFloat((shares * stopDist).toFixed(2));

  const setupLabel: Record<string, string> = {
    MOMENTUM_BREAKOUT: 'Momentum Breakout',
    DIP_BUY_REVERSAL:  'Dip Buy Reversal',
    NEWS_CATALYST:     'News Catalyst',
  };

  return {
    ticker,
    setup_type:   setupLabel[setup] ?? setup,
    halal,
    sector,
    entry_price:  price,
    stop_loss:    stopLoss,
    take_profit_1: tp1,
    take_profit_2: tp2,
    confidence,
    shares,
    position_value: positionVal,
    max_loss:     maxLoss,
    factors,
    reasoning:    factors.slice(0, 3).join('. '),
    hold_days:    setup === 'NEWS_CATALYST' ? '1 day' : '1-3 days',
  };
}

// ── Rate-limit safe batch fetcher ────────────────────────────────────────────
async function batchFetch<T>(
  items: string[],
  fn: (item: string) => Promise<T | null>,
  batchSize = 8,
  delayMs = 1200,
): Promise<{ ticker: string; result: T | null }[]> {
  const results: { ticker: string; result: T | null }[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async ticker => ({ ticker, result: await fn(ticker) }))
    );
    results.push(...batchResults);
    if (i + batchSize < items.length) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return results;
}

// ── Main handler ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { price_ranges, capital = 10000 } = await request.json();

  // ── Filter universe by price range ──
  const PRICE_BOUNDS: Record<string, [number, number]> = {
    small:  [0,    25],
    medium: [26,   100],
    large:  [101,  200],
    big:    [201,  999999],
  };

  const selectedRanges: [number, number][] = (price_ranges ?? ['small','medium','large','big'])
    .map((r: string) => PRICE_BOUNDS[r])
    .filter(Boolean);

  // Get list of tickers to scan (excluding haram)
  const candidates = Object.entries(UNIVERSE)
    .filter(([, meta]) => meta.halal !== 'haram')
    .map(([ticker]) => ticker);

  // ── Step 1: Get current prices to filter by range ──
  const priceResults = await batchFetch(
    candidates,
    async (ticker) => {
      if (!FINNHUB_KEY) return null;
      try {
        const res  = await fetch(`${BASE}/quote?symbol=${ticker}&token=${FINNHUB_KEY}`);
        const data = await res.json();
        return data?.c > 0 ? data.c : null;
      } catch { return null; }
    },
    10, 800
  );

  const inRange = priceResults
    .filter(({ result: price }) =>
      price !== null &&
      selectedRanges.some(([min, max]) => price! >= min && price! <= max)
    )
    .map(({ ticker }) => ticker);

  if (inRange.length === 0) {
    return NextResponse.json({ signal: 'NO_TRADE', reason: 'No stocks in selected price range found.', setups: [] });
  }

  // ── Step 2: Fetch candle data for price-filtered tickers ──
  const candleResults = await batchFetch(inRange, fetchCandles, 6, 1200);

  // ── Step 3: Check news catalysts in parallel ──
  const catalystResults = await batchFetch(
    inRange, hasNewsCatalyst, 10, 500
  );
  const catalystMap = Object.fromEntries(catalystResults.map(({ ticker, result }) => [ticker, result ?? false]));

  // ── Step 4: Analyze setups ──
  const validSetups: any[] = [];

  for (const { ticker, result: candles } of candleResults) {
    if (!candles) continue;

    const meta    = UNIVERSE[ticker];
    const catalyst = catalystMap[ticker] ?? false;
    const analysis = analyzeSetup(ticker, candles, catalyst);
    if (!analysis) continue;

    const plan = buildTradePlan(
      ticker,
      candles.price,
      analysis.atr,
      analysis.setup,
      analysis.confidence,
      analysis.factors,
      capital,
      meta.halal,
      meta.sector,
    );

    validSetups.push(plan);
  }

  // Sort by confidence descending
  validSetups.sort((a, b) => b.confidence - a.confidence);

  if (validSetups.length === 0) {
    return NextResponse.json({
      signal: 'NO_TRADE',
      reason: 'No setups meeting all criteria found across scanned universe.',
      scanned: inRange.length,
      setups: [],
    });
  }

  return NextResponse.json({
    signal:  'SETUPS_FOUND',
    scanned: inRange.length,
    found:   validSetups.length,
    setups:  validSetups.slice(0, 5), // return top 5 max
    generated_at: new Date().toISOString(),
  });
}