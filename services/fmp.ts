const FMP_KEY = process.env.FMP_API_KEY;
const FMP_BASE = 'https://financialmodelingprep.com/stable';

export interface FMPCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap: number;
  changePercent: number;
}

export interface FMPTargets {
  targetHigh: number;
  targetLow: number;
  targetConsensus: number;
  targetMedian: number;
}

// Returns candles in CHRONOLOGICAL order (oldest → newest)
export async function fetchFMPCandles(
  ticker: string,
  limit = 90,
): Promise<FMPCandle[]> {
  if (!FMP_KEY) return [];
  try {
    const res = await fetch(
      `${FMP_BASE}/historical-price-eod/full?symbol=${ticker.toUpperCase()}&limit=${limit}&apikey=${FMP_KEY}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return [];
    const data = await res.json();
    const rows: any[] = data?.value ?? data ?? [];
    if (!Array.isArray(rows) || rows.length === 0) return [];

    return rows
      .filter((r: any) => r.close && r.close > 0)
      .map((r: any) => ({
        date: r.date,
        open: r.open ?? r.close,
        high: r.high ?? r.close,
        low: r.low ?? r.close,
        close: r.close,
        volume: r.volume ?? 0,
        vwap: r.vwap ?? r.close,
        changePercent: r.changePercent ?? 0,
      }))
      .reverse(); // FMP returns newest first — reverse for indicators
  } catch {
    return [];
  }
}

export async function fetchAnalystTargets(ticker: string): Promise<FMPTargets | null> {
  if (!FMP_KEY) return null;
  try {
    const res = await fetch(
      `${FMP_BASE}/price-target-consensus?symbol=${ticker.toUpperCase()}&apikey=${FMP_KEY}`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const rows: any[] = data?.value ?? data ?? [];
    const row = rows?.[0];
    if (!row?.targetConsensus) return null;
    return {
      targetHigh:      row.targetHigh ?? 0,
      targetLow:       row.targetLow ?? 0,
      targetConsensus: row.targetConsensus ?? 0,
      targetMedian:    row.targetMedian ?? 0,
    };
  } catch {
    return null;
  }
}
