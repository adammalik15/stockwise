import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchStockData } from '@/services/yahoo-finance';
import { generateRecommendation } from '@/services/claude';

export async function GET(request: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { ticker } = await params;
  const tf = (request.nextUrl.searchParams.get('timeframe') ?? 'weekly') as any;
  const stock = await fetchStockData(ticker.toUpperCase());
  if (!stock) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { data: news } = await supabase.from('news_cache').select('*').eq('ticker', ticker.toUpperCase()).limit(5);
  const recommendation = await generateRecommendation(stock, news ?? [], tf);
  return NextResponse.json({ recommendation });
}
