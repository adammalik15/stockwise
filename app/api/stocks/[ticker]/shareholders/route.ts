import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
const BASE = 'https://finnhub.io/api/v1';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { ticker } = await params;
  const upper = ticker.toUpperCase();

  try {
    const res = await fetch(
      `${BASE}/stock/insider-transactions?symbol=${upper}&token=${FINNHUB_KEY}`,
      { next: { revalidate: 86400 } }
    );
    const data = await res.json();

    const transactions = (data?.data ?? [])
      .filter((t: any) => t.share && Math.abs(t.share) > 0)
      .slice(0, 8)
      .map((t: any) => ({
        name: t.name ?? 'Company Insider',
        shares: Math.abs(t.share ?? 0),
        value: Math.abs(t.value ?? 0),
        transaction_type: t.transactionCode === 'P'
          ? 'Purchase'
          : t.transactionCode === 'S'
          ? 'Sale'
          : t.transactionCode ?? 'Other',
        date: t.filingDate ?? t.date ?? '',
      }));

    return NextResponse.json({ transactions });
  } catch (e: any) {
    return NextResponse.json({ transactions: [], error: e.message });
  }
}