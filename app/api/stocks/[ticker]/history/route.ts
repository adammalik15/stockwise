import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const AV_KEY = process.env.ALPHA_VANTAGE_KEY;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { ticker } = await params;
  const upper = ticker.toUpperCase();
  const period = request.nextUrl.searchParams.get('period') ?? '6mo';

  // 1d uses Finnhub intraday (5-min candles); other periods use Alpha Vantage daily
  const FINNHUB_KEY = process.env.FINNHUB_API_KEY;

  try {
    if (period === '1d') {
      const now = Math.floor(Date.now() / 1000);
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const from = Math.floor(today.getTime() / 1000);
      const url = `https://finnhub.io/api/v1/stock/candle?symbol=${upper}&resolution=5&from=${from}&to=${now}&token=${FINNHUB_KEY}`;
      const res = await fetch(url, { next: { revalidate: 60 } });
      const data = await res.json();
      if (!data || data.s !== 'ok' || !data.t?.length) {
        return NextResponse.json({ history: [] });
      }
      const history = data.t.map((ts: number, i: number) => ({
        date: new Date(ts * 1000).toISOString(),
        open: data.o[i] ?? 0, high: data.h[i] ?? 0,
        low: data.l[i] ?? 0, close: data.c[i] ?? 0, volume: data.v[i] ?? 0,
      }));
      return NextResponse.json({ history });
    }

    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${upper}&outputsize=compact&apikey=${AV_KEY}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    const data = await res.json();
    const timeSeries = data['Time Series (Daily)'];
    if (!timeSeries) return NextResponse.json({ history: [], debug: data });

    const daysMap: Record<string, number> = {
      '1mo': 30, '3mo': 90, '6mo': 180, '1y': 365, '2y': 730,
    };
    const days = daysMap[period] ?? 180;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const history = Object.entries(timeSeries)
      .filter(([date]) => new Date(date) >= cutoff)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]: [string, any]) => ({
        date,
        open: parseFloat(values['1. open']),
        high: parseFloat(values['2. high']),
        low: parseFloat(values['3. low']),
        close: parseFloat(values['4. close']),
        volume: parseInt(values['5. volume']),
      }));

    return NextResponse.json({ history });
  } catch (e: any) {
    return NextResponse.json({ history: [], debug: { error: e.message } });
  }
}