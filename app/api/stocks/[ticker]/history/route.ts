import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const FMP_KEY     = process.env.FMP_API_KEY;
const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
const FMP_BASE    = 'https://financialmodelingprep.com/stable';

const PERIOD_LIMIT: Record<string, number> = {
  '1mo': 25, '3mo': 70, '6mo': 132, '1y': 260, '2y': 520,
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { ticker } = await params;
  const upper  = ticker.toUpperCase();
  const period = (request.nextUrl.searchParams.get('period') ?? '3mo') as string;

  // ── Intraday (1d) — Finnhub 5-min candles ───────────────────────────────
  if (period === '1d' && FINNHUB_KEY) {
    try {
      const now   = Math.floor(Date.now() / 1000);
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const from  = Math.floor(today.getTime() / 1000);
      const res   = await fetch(
        `https://finnhub.io/api/v1/stock/candle?symbol=${upper}&resolution=5&from=${from}&to=${now}&token=${FINNHUB_KEY}`,
      );
      const data = await res.json();
      if (data?.s === 'ok' && data.t?.length) {
        const history = data.t.map((ts: number, i: number) => ({
          date: new Date(ts * 1000).toISOString(),
          open: data.o[i] ?? 0, high: data.h[i] ?? 0,
          low: data.l[i] ?? 0,  close: data.c[i] ?? 0, volume: data.v[i] ?? 0,
        }));
        return NextResponse.json({ history });
      }
    } catch { /* fall through */ }
    return NextResponse.json({ history: [] });
  }

  // ── Daily (1mo–2y) — FMP stable endpoint ────────────────────────────────
  if (!FMP_KEY) return NextResponse.json({ history: [] });

  try {
    const limit = PERIOD_LIMIT[period] ?? 132;
    const res   = await fetch(
      `${FMP_BASE}/historical-price-eod/full?symbol=${upper}&limit=${limit}&apikey=${FMP_KEY}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return NextResponse.json({ history: [] });

    const data = await res.json();
    const rows: any[] = (data?.value ?? data ?? []).reverse(); // oldest first

    const history = rows
      .filter((r: any) => r.close && r.close > 0)
      .map((r: any) => ({
        date:   r.date,
        open:   r.open ?? r.close,
        high:   r.high ?? r.close,
        low:    r.low  ?? r.close,
        close:  r.close,
        volume: r.volume ?? 0,
      }));

    return NextResponse.json({ history });
  } catch {
    return NextResponse.json({ history: [] });
  }
}
