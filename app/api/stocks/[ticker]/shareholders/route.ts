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
    const [fundRes, instRes] = await Promise.all([
      fetch(`${BASE}/stock/fund-ownership?symbol=${upper}&limit=5&token=${FINNHUB_KEY}`),
      fetch(`${BASE}/stock/institutional-ownership?symbol=${upper}&limit=5&token=${FINNHUB_KEY}`),
    ]);

    const [fundData, instData] = await Promise.all([
      fundRes.json(),
      instRes.json(),
    ]);

    const fundHolders = (fundData?.data ?? []).slice(0, 5).map((h: any) => ({
      name: h.name ?? 'Unknown Fund',
      shares: h.share ?? 0,
      value: h.value ?? 0,
      change: h.change ?? 0,
      change_percent: h.changePercent ?? 0,
      percent_held: h.percentOwnership ?? 0,
      type: 'fund',
    }));

    const instHolders = (instData?.data ?? []).slice(0, 5).map((h: any) => ({
      name: h.name ?? 'Unknown Institution',
      shares: h.share ?? 0,
      value: h.value ?? 0,
      change: h.change ?? 0,
      change_percent: h.changePercent ?? 0,
      percent_held: h.percentOwnership ?? 0,
      type: 'institution',
    }));

    return NextResponse.json({
      fund_holders: fundHolders,
      institutional_holders: instHolders,
    });
  } catch (e: any) {
    return NextResponse.json({
      fund_holders: [],
      institutional_holders: [],
      error: e.message,
    });
  }
}