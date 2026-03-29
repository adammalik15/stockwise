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

  try {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${upper}&outputsize=compact&apikey=${AV_KEY}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    const data = await res.json();

    const timeSeries = data['Time Series (Daily)'];
    if (!timeSeries) {
      return NextResponse.json({ history: [], debug: data });
    }

    // Filter by period
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