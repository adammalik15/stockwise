// ── Alpaca (candle data — SIP feed, full market coverage, no bandwidth cap) ──
const ALPACA_KEY    = process.env.ALPACA_KEY_ID;
const ALPACA_SECRET = process.env.ALPACA_SECRET;
const ALPACA_BASE   = 'https://data.alpaca.markets/v2/stocks';

// ── FMP (analyst targets only) ────────────────────────────────────────────────
const FMP_KEY  = process.env.FMP_API_KEY;
const FMP_BASE = 'https://financialmodelingprep.com/stable';

export interface FMPCandle {
  date:          string;
  open:          number;
  high:          number;
  low:           number;
  close:         number;
  volume:        number;
  vwap:          number;
  changePercent: number;
}

export interface FMPTargets {
  targetHigh:      number;
  targetLow:       number;
  targetConsensus: number;
  targetMedian:    number;
}

/**
 * Fetch daily candles via Alpaca SIP feed.
 * SIP = all US exchanges combined = 100% of market volume.
 * Works for large-cap AND small/mid-cap stocks.
 * No bandwidth cap. Returns chronological order (oldest → newest).
 */
export async function fetchFMPCandles(
  ticker: string,
  limit  = 90,
): Promise<FMPCandle[]> {
  const upper = ticker.toUpperCase();

  // ── Primary: Alpaca SIP historical bars ──────────────────────────────────
  if (ALPACA_KEY && ALPACA_SECRET) {
    try {
      // Alpaca needs a start date. Go back far enough for the limit requested.
      const daysBack = Math.ceil(limit * 1.5); // buffer for weekends/holidays
      const start    = new Date(Date.now() - daysBack * 86400000)
        .toISOString().split('T')[0];

      const res = await fetch(
        `${ALPACA_BASE}/${upper}/bars?timeframe=1Day&limit=${limit}&feed=sip&start=${start}&sort=asc`,
        {
          headers: {
            'APCA-API-KEY-ID':     ALPACA_KEY,
            'APCA-API-SECRET-KEY': ALPACA_SECRET,
          },
          signal: AbortSignal.timeout(8000),
        },
      );

      if (res.ok) {
        const data = await res.json();
        const bars: any[] = data?.bars ?? [];
        if (bars.length >= 15) {
          return bars.map((b: any) => ({
            date:          b.t.split('T')[0],
            open:          b.o,
            high:          b.h,
            low:           b.l,
            close:         b.c,
            volume:        b.v,
            vwap:          b.vw ?? b.c,
            changePercent: 0, // not provided by Alpaca daily bars
          }));
        }
      }
    } catch (e) {
      console.error(`Alpaca candle fetch failed for ${upper}:`, e);
    }
  }

  // ── Fallback: FMP (may be rate-limited) ──────────────────────────────────
  if (FMP_KEY) {
    try {
      const res = await fetch(
        `${FMP_BASE}/historical-price-eod/full?symbol=${upper}&limit=${limit}&apikey=${FMP_KEY}`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (res.ok) {
        const data = await res.json();
        const rows: any[] = data?.value ?? data ?? [];
        if (Array.isArray(rows) && rows.length >= 15) {
          return rows
            .filter((r: any) => r.close && r.close > 0)
            .map((r: any) => ({
              date:          r.date,
              open:          r.open   ?? r.close,
              high:          r.high   ?? r.close,
              low:           r.low    ?? r.close,
              close:         r.close,
              volume:        r.volume ?? 0,
              vwap:          r.vwap   ?? r.close,
              changePercent: r.changePercent ?? 0,
            }))
            .reverse(); // FMP is newest-first
        }
      }
    } catch { /* silent */ }
  }

  return [];
}

/**
 * Analyst price targets — FMP only (Alpaca doesn't provide this).
 */
export async function fetchAnalystTargets(
  ticker: string,
): Promise<FMPTargets | null> {
  if (!FMP_KEY) return null;
  try {
    const res = await fetch(
      `${FMP_BASE}/price-target-consensus?symbol=${ticker.toUpperCase()}&apikey=${FMP_KEY}`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const rows: any[] = data?.value ?? data ?? [];
    const row  = rows?.[0];
    if (!row?.targetConsensus) return null;
    return {
      targetHigh:      row.targetHigh      ?? 0,
      targetLow:       row.targetLow       ?? 0,
      targetConsensus: row.targetConsensus ?? 0,
      targetMedian:    row.targetMedian    ?? 0,
    };
  } catch {
    return null;
  }
}
