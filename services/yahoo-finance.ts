import type { StockData, PricePoint } from '@/types';

const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
const BASE = 'https://finnhub.io/api/v1';

export async function fetchStockData(ticker: string): Promise<StockData | null> {
  const upper = ticker.toUpperCase();
  try {
    const [quoteRes, profileRes, metricRes] = await Promise.all([
      fetch(`${BASE}/quote?symbol=${upper}&token=${FINNHUB_KEY}`),
      fetch(`${BASE}/stock/profile2?symbol=${upper}&token=${FINNHUB_KEY}`),
      fetch(`${BASE}/stock/metric?symbol=${upper}&metric=all&token=${FINNHUB_KEY}`),
    ]);

    const [quote, profile, metric] = await Promise.all([
      quoteRes.json(),
      profileRes.json(),
      metricRes.json(),
    ]);

    // quote.c = current price, quote.pc = previous close
    if (!quote?.c || quote.c === 0) return null;

    const m = metric?.metric ?? {};

    return {
      ticker: upper,
      name: profile?.name ?? upper,
      price: quote.c,
      change: quote.d ?? 0,
      change_percent: quote.dp ?? 0,
      market_cap: profile?.marketCapitalization
        ? profile.marketCapitalization * 1e6
        : undefined,
      pe_ratio: m['peNormalizedAnnual'] ?? undefined,
      sector: profile?.finnhubIndustry ?? undefined,
      industry: profile?.finnhubIndustry ?? undefined,
      fifty_two_week_high: m['52WeekHigh'] ?? undefined,
      fifty_two_week_low: m['52WeekLow'] ?? undefined,
      dividend_yield: m['dividendYieldIndicatedAnnual'] ?? undefined,
      beta: m['beta'] ?? undefined,
      volume: quote.v ?? undefined,
      avg_volume: undefined,
      description: undefined,
      last_updated: new Date().toISOString(),
    };
  } catch (e) {
    console.error('fetchStockData error:', e);
    return null;
  }
}

export async function fetchPriceHistory(
  ticker: string,
  period: '1mo' | '3mo' | '6mo' | '1y' | '2y' = '6mo'
): Promise<PricePoint[]> {
  const upper = ticker.toUpperCase();
  const to = Math.floor(Date.now() / 1000);
  const map: Record<string, number> = {
    '1mo': 30, '3mo': 90, '6mo': 180, '1y': 365, '2y': 730,
  };
  const from = Math.floor(Date.now() / 1000) - (map[period] ?? 180) * 86400;
  const resolution = period === '1mo' ? 'D' : period === '3mo' ? 'D' : 'W';

  try {
    const res = await fetch(
      `${BASE}/stock/candle?symbol=${upper}&resolution=${resolution}&from=${from}&to=${to}&token=${FINNHUB_KEY}`
    );
    const data = await res.json();

    if (data.s !== 'ok') return [];

    return data.t.map((timestamp: number, i: number) => ({
      date: new Date(timestamp * 1000).toISOString().split('T')[0],
      open: data.o[i],
      high: data.h[i],
      low: data.l[i],
      close: data.c[i],
      volume: data.v[i],
    }));
  } catch (e) {
    return [];
  }
}

export async function searchTicker(query: string) {
  try {
    const res = await fetch(
      `${BASE}/search?q=${encodeURIComponent(query)}&token=${FINNHUB_KEY}`
    );
    const data = await res.json();
    return (data.result ?? [])
      .filter((r: any) => r.type === 'Common Stock' || r.type === 'ETP')
      .slice(0, 8)
      .map((r: any) => ({
        ticker: r.symbol,
        name: r.description,
        type: r.type,
      }));
  } catch {
    return [];
  }
}

export function formatMarketCap(v?: number | null) {
  if (!v) return 'N/A';
  if (v >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T';
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
  return '$' + v.toLocaleString();
}

export function formatPercent(v?: number | null) {
  if (v == null) return 'N/A';
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}

export function formatPrice(v?: number | null) {
  if (v == null) return 'N/A';
  return '$' + v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}