import yahooFinance from 'yahoo-finance2';
import type { StockData, PricePoint } from '@/types';

export async function fetchStockData(ticker: string): Promise<StockData | null> {
  const upper = ticker.toUpperCase();
  try {
    const [quote, summary] = await Promise.allSettled([
      yahooFinance.quote(upper),
      yahooFinance.quoteSummary(upper, { modules: ['assetProfile'] }),
    ]);
    if (quote.status === 'rejected') return null;
    const q = quote.value;
    const qs = summary.status === 'fulfilled' ? summary.value : null;
    return {
      ticker: upper,
      name: q.longName || q.shortName || upper,
      price: q.regularMarketPrice ?? 0,
      change: q.regularMarketChange ?? 0,
      change_percent: q.regularMarketChangePercent ?? 0,
      market_cap: q.marketCap ?? undefined,
      pe_ratio: q.trailingPE ?? undefined,
      sector: qs?.assetProfile?.sector ?? undefined,
      industry: qs?.assetProfile?.industry ?? undefined,
      fifty_two_week_high: q.fiftyTwoWeekHigh ?? undefined,
      fifty_two_week_low: q.fiftyTwoWeekLow ?? undefined,
      dividend_yield: q.trailingAnnualDividendYield ?? undefined,
      beta: q.beta ?? undefined,
      volume: q.regularMarketVolume ?? undefined,
      avg_volume: q.averageDailyVolume10Day ?? undefined,
      description: qs?.assetProfile?.longBusinessSummary ?? undefined,
      last_updated: new Date().toISOString(),
    };
  } catch (e) {
    console.error('fetchStockData error:', e);
    return null;
  }
}

export async function fetchPriceHistory(ticker: string, period: '1mo'|'3mo'|'6mo'|'1y'|'2y' = '6mo'): Promise<PricePoint[]> {
  const upper = ticker.toUpperCase();
  const endDate = new Date();
  const startDate = new Date();
  const map: Record<string, number> = { '1mo': 1, '3mo': 3, '6mo': 6, '1y': 12, '2y': 24 };
  startDate.setMonth(startDate.getMonth() - (map[period] ?? 6));
  try {
    const result = await yahooFinance.chart(upper, {
      period1: startDate,
      period2: endDate,
      interval: period === '1mo' ? '1d' : period === '3mo' ? '1d' : '1wk',
    });
    return (result.quotes ?? []).map((q: any) => ({
      date: new Date(q.date).toISOString().split('T')[0],
      open: q.open ?? 0,
      high: q.high ?? 0,
      low: q.low ?? 0,
      close: q.close ?? 0,
      volume: q.volume ?? 0,
    }));
  } catch (e) {
    return [];
  }
}

export async function searchTicker(query: string) {
  try {
    const r = await yahooFinance.search(query, { quotesCount: 8, newsCount: 0 });
    return (r.quotes ?? [])
      .filter((r: any) => r.symbol && r.shortname)
      .map((r: any) => ({
        ticker: r.symbol,
        name: r.shortname || r.symbol,
        type: r.typeDisp || 'Stock',
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
  return '$' + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}