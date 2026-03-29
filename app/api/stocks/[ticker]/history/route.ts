import { NextRequest, NextResponse } from 'next/server';
import { fetchPriceHistory } from '@/services/yahoo-finance';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { ticker } = await params;
  const period = (request.nextUrl.searchParams.get('period') ?? '6mo') as any;
  const history = await fetchPriceHistory(ticker, period);
  return NextResponse.json({ history });
}
