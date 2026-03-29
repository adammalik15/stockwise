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
      `${BASE}/stock/metric?symbol=${upper}&metric=all&token=${FINNHUB_KEY}`,
      { next: { revalidate: 3600 } }
    );
    const data = await res.json();
    const m = data?.metric ?? {};

    const fundamentals = {
      pe_ratio: m['peNormalizedAnnual'] ?? m['peTTM'] ?? null,
      forward_pe: m['peForward'] ?? null,
      pb_ratio: m['pbQuarterly'] ?? m['pbAnnual'] ?? null,
      ps_ratio: m['psTTM'] ?? null,
      ev_ebitda: m['evEbitdaTTM'] ?? null,
      peg_ratio: m['pegTTM'] ?? null,
      gross_margin: m['grossMarginTTM'] ? m['grossMarginTTM'] / 100 : null,
      operating_margin: m['operatingMarginTTM'] ? m['operatingMarginTTM'] / 100 : null,
      net_margin: m['netProfitMarginTTM'] ? m['netProfitMarginTTM'] / 100 : null,
      roe: m['roeTTM'] ? m['roeTTM'] / 100 : null,
      roa: m['roaTTM'] ? m['roaTTM'] / 100 : null,
      revenue_growth: m['revenueGrowthTTMYoy'] ? m['revenueGrowthTTMYoy'] / 100 : null,
      earnings_growth: m['epsGrowthTTMYoy'] ? m['epsGrowthTTMYoy'] / 100 : null,
      current_ratio: m['currentRatioQuarterly'] ?? m['currentRatioAnnual'] ?? null,
      quick_ratio: m['quickRatioQuarterly'] ?? m['quickRatioAnnual'] ?? null,
      debt_to_equity: m['totalDebt/totalEquityQuarterly'] ?? m['totalDebt/totalEquityAnnual'] ?? null,
      dividend_yield: m['dividendYieldIndicatedAnnual'] ? m['dividendYieldIndicatedAnnual'] / 100 : null,
      payout_ratio: m['payoutRatioTTM'] ? m['payoutRatioTTM'] / 100 : null,
      eps: m['epsTTM'] ?? m['epsNormalizedAnnual'] ?? null,
      book_value_per_share: m['bookValuePerShareQuarterly'] ?? m['bookValuePerShareAnnual'] ?? null,
      revenue_per_share: m['revenuePerShareTTM'] ?? null,
    };

    return NextResponse.json({ fundamentals });
  } catch (e: any) {
    return NextResponse.json({ fundamentals: null, error: e.message });
  }
}