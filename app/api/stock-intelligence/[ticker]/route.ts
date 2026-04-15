import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchFMPCandles, fetchAnalystTargets } from '@/services/fmp';
import { screenStock } from '@/services/halal-screener';
import type { FMPCandle } from '@/services/fmp';

const FINNHUB_KEY    = process.env.FINNHUB_API_KEY;
const ANTHROPIC_URL  = 'https://api.anthropic.com/v1/messages';
const MODEL          = 'claude-sonnet-4-6';
const FH_BASE        = 'https://finnhub.io/api/v1';

// ── Indicator helpers ────────────────────────────────────────────────────────

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out = [values[0]];
  for (let i = 1; i < values.length; i++) {
    out.push(values[i] * k + out[i - 1] * (1 - k));
  }
  return out;
}
const emaLast = (v: number[], p: number) => ema(v, p).slice(-1)[0];

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let g = 0, l = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) g += d; else l += Math.abs(d);
  }
  const ag = g / period, al = l / period;
  if (al === 0) return 100;
  return Math.round(100 - 100 / (1 + ag / al));
}

function calcMACD(closes: number[]) {
  if (closes.length < 35) return { macd: 0, signal: 0, histogram: 0, bullish: false };
  const e12   = ema(closes, 12);
  const e26   = ema(closes, 26);
  const line  = e12.map((v, i) => v - e26[i]);
  const sig   = ema(line.slice(-9), 9);
  const hist  = line[line.length - 1] - sig[sig.length - 1];
  const prev  = line[line.length - 2] - sig[sig.length - 2];
  return {
    macd:      parseFloat(line[line.length - 1].toFixed(4)),
    signal:    parseFloat(sig[sig.length - 1].toFixed(4)),
    histogram: parseFloat(hist.toFixed(4)),
    bullish:   hist > 0 && hist > prev,
  };
}

function calcATR(candles: FMPCandle[], period = 14): number {
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    trs.push(Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low  - candles[i - 1].close),
    ));
  }
  const r = trs.slice(-period);
  return r.reduce((a, b) => a + b, 0) / r.length;
}

function calcVolumeRatio(volumes: number[]): number {
  if (volumes.length < 21) return 1;
  const avg = volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
  return avg > 0 ? parseFloat((volumes[volumes.length - 1] / avg).toFixed(2)) : 1;
}

function calcOBVTrend(candles: FMPCandle[]): 'accumulation' | 'distribution' | 'neutral' {
  let obv = 0;
  const obvArr: number[] = [0];
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].close > candles[i - 1].close)      obv += candles[i].volume;
    else if (candles[i].close < candles[i - 1].close) obv -= candles[i].volume;
    obvArr.push(obv);
  }
  const recent  = obvArr[obvArr.length - 1];
  const baseline = obvArr[Math.max(0, obvArr.length - 15)];
  const pct = baseline !== 0 ? (recent - baseline) / Math.abs(baseline) : 0;
  if (pct > 0.02)  return 'accumulation';
  if (pct < -0.02) return 'distribution';
  return 'neutral';
}

function calcStochastic(candles: FMPCandle[], kPeriod = 14, dPeriod = 3) {
  if (candles.length < kPeriod) return { k: 50, d: 50 };
  const kValues: number[] = [];
  for (let i = kPeriod - 1; i < candles.length; i++) {
    const slice  = candles.slice(i - kPeriod + 1, i + 1);
    const lo     = Math.min(...slice.map(c => c.low));
    const hi     = Math.max(...slice.map(c => c.high));
    const k      = hi === lo ? 50 : ((candles[i].close - lo) / (hi - lo)) * 100;
    kValues.push(k);
  }
  const lastK = kValues[kValues.length - 1];
  const dSlice = kValues.slice(-dPeriod);
  const lastD  = dSlice.reduce((a, b) => a + b, 0) / dSlice.length;
  return { k: Math.round(lastK), d: Math.round(lastD) };
}

function calcADX(candles: FMPCandle[], period = 14): number {
  if (candles.length < period * 2) return 20;
  const trs: number[] = [], pdms: number[] = [], mdms: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const tr  = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low  - candles[i - 1].close),
    );
    const pdm = candles[i].high - candles[i - 1].high;
    const mdm = candles[i - 1].low - candles[i].low;
    trs.push(tr);
    pdms.push(pdm > 0 && pdm > mdm ? pdm : 0);
    mdms.push(mdm > 0 && mdm > pdm ? mdm : 0);
  }
  const atr14  = trs.slice(-period).reduce((a, b) => a + b, 0) / period;
  const pdi14  = pdms.slice(-period).reduce((a, b) => a + b, 0) / period;
  const mdi14  = mdms.slice(-period).reduce((a, b) => a + b, 0) / period;
  const pdi    = atr14 > 0 ? (pdi14 / atr14) * 100 : 0;
  const mdi    = atr14 > 0 ? (mdi14 / atr14) * 100 : 0;
  const dx     = (pdi + mdi) > 0 ? (Math.abs(pdi - mdi) / (pdi + mdi)) * 100 : 0;
  return Math.round(dx);
}

function calcSupportResistance(candles: FMPCandle[], price: number) {
  // Pivot points from yesterday
  const last   = candles[candles.length - 1];
  const prev   = candles[candles.length - 2] ?? last;
  const pp     = (prev.high + prev.low + prev.close) / 3;
  const r1     = 2 * pp - prev.low;
  const r2     = pp + (prev.high - prev.low);
  const r3     = prev.high + 2 * (pp - prev.low);
  const s1     = 2 * pp - prev.high;
  const s2     = pp - (prev.high - prev.low);
  const s3     = prev.low - 2 * (prev.high - pp);

  // Fibonacci from recent 60-bar swing
  const slice60 = candles.slice(-60);
  const swingHi = Math.max(...slice60.map(c => c.high));
  const swingLo = Math.min(...slice60.map(c => c.low));
  const range   = swingHi - swingLo;
  const isUp    = (price - swingLo) > (swingHi - price);
  const fibBase = isUp ? swingLo : swingHi;
  const fibSign = isUp ? 1 : -1;

  // Entry zone and trade levels
  const atr     = calcATR(candles);
  const entryLo = parseFloat((price - atr * 0.3).toFixed(2));
  const entryHi = parseFloat(price.toFixed(2));
  const stopLoss = parseFloat((s1 - atr * 0.5).toFixed(2));

  return {
    pivot:    parseFloat(pp.toFixed(2)),
    r1:       parseFloat(r1.toFixed(2)),
    r2:       parseFloat(r2.toFixed(2)),
    r3:       parseFloat(r3.toFixed(2)),
    s1:       parseFloat(s1.toFixed(2)),
    s2:       parseFloat(s2.toFixed(2)),
    s3:       parseFloat(s3.toFixed(2)),
    fib_236:  parseFloat((fibBase + fibSign * range * 0.236).toFixed(2)),
    fib_382:  parseFloat((fibBase + fibSign * range * 0.382).toFixed(2)),
    fib_500:  parseFloat((fibBase + fibSign * range * 0.500).toFixed(2)),
    fib_618:  parseFloat((fibBase + fibSign * range * 0.618).toFixed(2)),
    swing_hi: parseFloat(swingHi.toFixed(2)),
    swing_lo: parseFloat(swingLo.toFixed(2)),
    entry_lo: entryLo,
    entry_hi: entryHi,
    stop_loss: stopLoss,
    target1:  parseFloat(r1.toFixed(2)),
    target2:  parseFloat(r2.toFixed(2)),
    atr:      parseFloat(atr.toFixed(2)),
  };
}

function priceTier(price: number): string {
  if (price < 25)  return 'small';
  if (price < 101) return 'medium';
  if (price < 201) return 'large';
  return 'big';
}

// ── Claude narrative ─────────────────────────────────────────────────────────

async function generateNarrative(
  ticker: string,
  price: number,
  sector: string,
  rsi: number,
  volumeRatio: number,
  macdBullish: boolean,
  beta: number,
  newsHeadlines: string[],
  consensus: number | null,
  apiKey: string,
): Promise<string> {
  const upside = consensus ? (((consensus - price) / price) * 100).toFixed(1) : null;
  const headlinesText = newsHeadlines.slice(0, 4).join('\n- ');

  const prompt = `You are a halal stock analyst. Write a 3-sentence analysis of ${ticker} (${sector}) for a Muslim investor.

Current data:
- Price: $${price} | RSI: ${rsi} | Volume: ${volumeRatio}× avg | MACD: ${macdBullish ? 'bullish' : 'bearish'} | Beta: ${beta}
- Analyst consensus: ${consensus ? `$${consensus} (${upside}% upside)` : 'N/A'}
- Recent news:
- ${headlinesText || 'No recent news'}

Write 3 short, factual sentences covering: (1) what is driving price action right now, (2) what the technicals indicate, (3) one key risk or catalyst to watch. Be direct, no fluff. No Islamic disclaimers needed.`;

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL, max_tokens: 250,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json();
    return data.content?.[0]?.text?.trim() ?? '';
  } catch {
    return '';
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { ticker } = await params;
  const upper = ticker.toUpperCase();

  // ── 1. Fetch candles (FMP) + quote/profile (Finnhub) in parallel ────────
  const [candles, quoteRes, profileRes, recRes, newsRes, targetsData] = await Promise.all([
    fetchFMPCandles(upper, 90),
    FINNHUB_KEY ? fetch(`https://finnhub.io/api/v1/quote?symbol=${upper}&token=${FINNHUB_KEY}`) : null,
    FINNHUB_KEY ? fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${upper}&token=${FINNHUB_KEY}`) : null,
    FINNHUB_KEY ? fetch(`https://finnhub.io/api/v1/stock/recommendation?symbol=${upper}&token=${FINNHUB_KEY}`) : null,
    FINNHUB_KEY ? fetch(`https://finnhub.io/api/v1/company-news?symbol=${upper}&from=${new Date(Date.now()-3*86400000).toISOString().split('T')[0]}&to=${new Date().toISOString().split('T')[0]}&token=${FINNHUB_KEY}`) : null,
    fetchAnalystTargets(upper),
  ]);

  const candlesOk = candles.length >= 15;

  const quote   = quoteRes?.ok   ? await quoteRes.json()   : {};
  const profile = profileRes?.ok ? await profileRes.json() : {};
  const recs    = recRes?.ok     ? await recRes.json()     : [];
  const news    = newsRes?.ok    ? await newsRes.json()    : [];

  // Price from Finnhub quote first, FMP candle as fallback
  const price     = quote?.c && quote.c > 0 ? quote.c : (candlesOk ? candles[candles.length - 1].close : null);
  const change    = quote?.d   ?? 0;
  const changePct = quote?.dp  ?? 0;
  const name      = profile?.name ?? upper;
  const sector    = profile?.finnhubIndustry ?? 'Unknown';
  const beta      = profile?.beta ?? 1.0;

  // No price at all — ticker genuinely doesn't exist
  if (!price) {
    return NextResponse.json(
      { error: `Could not find data for "${upper}". Check the ticker and try again.` },
      { status: 404 },
    );
  }

  // ── 2. Indicators (only when we have enough candle history) ─────────────
  let indicators: any = null;
  let levels: any     = null;
  let avgMove         = 0;

  if (candlesOk) {
    const closes  = candles.map(c => c.close);
    const highs   = candles.map(c => c.high);
    const lows    = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume);

    const rsi         = calcRSI(closes);
    const macd        = calcMACD(closes);
    const atr         = calcATR(candles);
    const atrPct      = parseFloat(((atr / price) * 100).toFixed(2));
    const volumeRatio = calcVolumeRatio(volumes);
    const ema20       = parseFloat(emaLast(closes, 20).toFixed(2));
    const ema50       = parseFloat(emaLast(closes, 50).toFixed(2));
    const vwap        = parseFloat(candles[candles.length - 1].vwap.toFixed(2));
    const obv         = calcOBVTrend(candles);
    const stoch       = calcStochastic(candles);
    const adx         = calcADX(candles);

    const rsiSignal = rsi < 30 ? 'oversold' : rsi < 50 ? 'neutral' : rsi < 65 ? 'building' : rsi < 75 ? 'elevated' : 'overbought';
    const adxStr    = adx < 20 ? 'weak' : adx < 30 ? 'moderate' : adx < 50 ? 'strong' : 'very_strong';
    const stochSig  = stoch.k < 20 ? 'oversold' : stoch.k > 80 ? 'overbought' : 'neutral';
    const trend     = price > ema20 && price > ema50 ? 'bullish' : price < ema20 && price < ema50 ? 'bearish' : 'neutral';

    avgMove = parseFloat(
      (candles.slice(-30).reduce((s, c) => s + Math.abs(c.changePercent), 0) / 30).toFixed(2),
    );

    indicators = {
      rsi, rsi_signal: rsiSignal,
      macd,
      atr, atr_pct: atrPct,
      volume_ratio: volumeRatio,
      ema20, ema50,
      vwap,
      obv_trend: obv,
      adx, adx_strength: adxStr,
      stoch_k: stoch.k, stoch_d: stoch.d, stoch_signal: stochSig,
      trend,
    };

    levels = calcSupportResistance(candles, price);
  }

  // ── 3. Analyst data ──────────────────────────────────────────────────────
  const latestRec = Array.isArray(recs) ? recs[0] : null;
  const buyCount  = (latestRec?.strongBuy ?? 0) + (latestRec?.buy ?? 0);
  const holdCount = latestRec?.hold ?? 0;
  const sellCount = (latestRec?.strongSell ?? 0) + (latestRec?.sell ?? 0);
  const totalRecs = buyCount + holdCount + sellCount;

  // ── 4. Halal screen ──────────────────────────────────────────────────────
  const stockDataForScreen = {
    ticker: upper, name, price, change, change_percent: changePct,
    sector, beta,
    dividend_yield: profile?.dividendYield,
    market_cap: profile?.marketCapitalization ? profile.marketCapitalization * 1e6 : undefined,
  } as any;
  const halal = screenStock(stockDataForScreen);

  // ── 5. User halal cert ───────────────────────────────────────────────────
  const { data: certs } = await supabase
    .from('halal_certifications').select('*').eq('ticker', upper);
  const userCert = certs?.find((c: any) => c.certified_by === user.id) ?? null;

  // ── 6. Claude narrative ──────────────────────────────────────────────────
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const headlines    = Array.isArray(news) ? news.slice(0, 5).map((n: any) => n.headline ?? '') : [];
  const rsiForNarr   = indicators?.rsi ?? 50;
  const volForNarr   = indicators?.volume_ratio ?? 1;
  const macdForNarr  = indicators?.macd?.bullish ?? false;
  const narrative    = anthropicKey
    ? await generateNarrative(
        upper, price, sector, rsiForNarr, volForNarr, macdForNarr,
        beta, headlines, targetsData?.targetConsensus ?? null, anthropicKey,
      )
    : '';

  // ── 7. Targets ───────────────────────────────────────────────────────────
  const consensus   = targetsData?.targetConsensus ?? null;
  const upsidePct   = consensus ? parseFloat((((consensus - price) / price) * 100).toFixed(1)) : null;
  const downsidePct = targetsData?.targetLow
    ? parseFloat((((targetsData.targetLow - price) / price) * 100).toFixed(1))
    : null;

  return NextResponse.json({
    ticker: upper,
    name,
    price,
    change,
    change_percent: changePct,
    sector,
    price_tier: priceTier(price),
    candles_available: candlesOk,

    halal: {
      screen: halal,
      user_cert: userCert,
      total_certs: certs?.length ?? 0,
    },

    targets: {
      high:        targetsData?.targetHigh ?? null,
      low:         targetsData?.targetLow  ?? null,
      consensus,
      median:      targetsData?.targetMedian ?? null,
      upside_pct:  upsidePct,
      downside_pct: downsidePct,
      buy:         buyCount,
      hold:        holdCount,
      sell:        sellCount,
      total:       totalRecs,
    },

    indicators,  // null when candles unavailable
    levels,      // null when candles unavailable

    behavior: {
      beta:           parseFloat((beta ?? 1).toFixed(2)),
      avg_daily_move: avgMove,
      price_tier:     priceTier(price),
    },

    narrative,
    // Initial chart data — avoids a second fetch on page load
    chart_data: candlesOk
      ? candles.slice(-70).map(c => ({
          date:   c.date,
          open:   c.open,
          high:   c.high,
          low:    c.low,
          close:  c.close,
          volume: c.volume,
        }))
      : [],
    generated_at: new Date().toISOString(),
  });
}
