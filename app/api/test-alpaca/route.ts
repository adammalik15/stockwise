import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const key    = process.env.ALPACA_KEY_ID;
  const secret = process.env.ALPACA_SECRET;

  if (!key || !secret) {
    return NextResponse.json({
      status: 'MISSING',
      key_present:    !!key,
      secret_present: !!secret,
    });
  }

  try {
    const res = await fetch(
      'https://data.alpaca.markets/v2/stocks/AAPL/bars?timeframe=1Day&limit=3&feed=sip&sort=desc',
      {
        headers: {
          'APCA-API-KEY-ID':     key,
          'APCA-API-SECRET-KEY': secret,
        },
        signal: AbortSignal.timeout(8000),
      }
    );

    const body = await res.json();

    return NextResponse.json({
      status:        res.ok ? 'OK' : 'ERROR',
      http_status:   res.status,
      key_length:    key.length,
      secret_length: secret.length,
      key_prefix:    key.slice(0, 6) + '…',
      bars_returned: body?.bars?.length ?? 0,
      latest_date:   body?.bars?.[0]?.t?.split('T')[0] ?? null,
      alpaca_error:  res.ok ? null : body,
    });
  } catch (err: any) {
    return NextResponse.json({
      status: 'FETCH_ERROR',
      error:  err?.message ?? String(err),
    });
  }
}
