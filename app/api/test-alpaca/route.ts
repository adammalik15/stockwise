import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const key    = process.env.ALPACA_KEY_ID;
  const secret = process.env.ALPACA_SECRET;
  if (!key || !secret) return NextResponse.json({ status: 'MISSING_KEYS' });

  const headers = { 'APCA-API-KEY-ID': key, 'APCA-API-SECRET-KEY': secret };
  const base    = 'https://data.alpaca.markets/v2/stocks/AAPL/bars';
  const start   = new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0];

  // Try 4 combinations to find what works
  const tests = [
    { label: 'iex+desc+no_start',  url: `${base}?timeframe=1Day&limit=5&feed=iex&sort=desc` },
    { label: 'iex+asc+start',      url: `${base}?timeframe=1Day&limit=5&feed=iex&sort=asc&start=${start}` },
    { label: 'no_feed+asc+start',  url: `${base}?timeframe=1Day&limit=5&sort=asc&start=${start}` },
    { label: 'no_feed+desc',       url: `${base}?timeframe=1Day&limit=5&sort=desc` },
  ];

  const results: any[] = [];
  for (const t of tests) {
    try {
      const res  = await fetch(t.url, { headers, signal: AbortSignal.timeout(6000) });
      const body = await res.json();
      results.push({
        label:       t.label,
        http_status: res.status,
        bars:        body?.bars?.length ?? 0,
        next_token:  body?.next_page_token ?? null,
        error:       res.ok ? null : body,
        raw_keys:    Object.keys(body ?? {}),
      });
    } catch (e: any) {
      results.push({ label: t.label, error: e?.message });
    }
  }

  // Also test account/subscription info
  let account: any = null;
  try {
    const res = await fetch('https://api.alpaca.markets/v2/account', { headers, signal: AbortSignal.timeout(5000) });
    const body = await res.json();
    account = { status: body?.status, account_type: body?.account_type, trading_blocked: body?.trading_blocked };
  } catch {}

  return NextResponse.json({
    key_prefix: key.slice(0, 6) + '…',
    is_paper_key: key.startsWith('PK'),
    account,
    tests: results,
  });
}
