import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ALPACA_KEY    = process.env.ALPACA_KEY_ID;
const ALPACA_SECRET = process.env.ALPACA_SECRET;
const FINNHUB_KEY   = process.env.FINNHUB_API_KEY;
const ALPACA_BASE   = 'https://data.alpaca.markets/v2/stocks';

const PERIOD_DAYS: Record<string, number> = {
  '1mo': 35, '3mo': 100, '6mo': 195, '1y': 380, '2y': 750,
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
  const period = request.nextUrl.searchParams.get('period') ?? '3mo';

  // ── 1d intraday — Finnhub 5-min candles (Alpaca charges for intraday) ────
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
          date:   new Date(ts * 1000).toISOString(),
          open:   data.o[i] ?? 0,
          high:   data.h[i] ?? 0,
          low:    data.l[i] ?? 0,
          close:  data.c[i] ?? 0,
          volume: data.v[i] ?? 0,
        }));
        return NextResponse.json({ history });
      }
    } catch { /* fall through */ }
    return NextResponse.json({ history: [] });
  }

  // ── Daily history — Alpaca SIP (full market volume, no bandwidth cap) ─────
  if (!ALPACA_KEY || !ALPACA_SECRET) {
    return NextResponse.json({ history: [] });
  }

  try {
    const days  = PERIOD_DAYS[period] ?? 100;
    const start = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

    const res = await fetch(
      `${ALPACA_BASE}/${upper}/bars?timeframe=1Day&limit=1000&feed=iex&start=${start}&sort=asc`,
      {
        headers: {
          'APCA-API-KEY-ID':     ALPACA_KEY,
          'APCA-API-SECRET-KEY': ALPACA_SECRET,
        },
        signal: AbortSignal.timeout(8000),
      },
    );

    if (!res.ok) return NextResponse.json({ history: [] });

    const data     = await res.json();
    const bars: any[] = data?.bars ?? [];

    const history = bars.map((b: any) => ({
      date:   b.t.split('T')[0],
      open:   b.o,
      high:   b.h,
      low:    b.l,
      close:  b.c,
      volume: b.v,
    }));

    return NextResponse.json({ history });
  } catch {
    return NextResponse.json({ history: [] });
  }
}
