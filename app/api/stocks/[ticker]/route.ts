import { NextRequest, NextResponse } from 'next/server';
import { fetchStockData } from '@/services/yahoo-finance';
import { createClient } from '@/lib/supabase/server';

export async function GET(_: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { ticker } = await params;
  const data = await fetchStockData(ticker.toUpperCase());
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(data);
}
