import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchStockData } from '@/services/yahoo-finance';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: items } = await supabase.from('watchlists').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  const enriched = await Promise.all((items ?? []).map(async w => {
    const stock = await fetchStockData(w.ticker);
    return { ...w, stock_data: stock, at_target: w.target_price != null && stock?.price != null ? stock.price >= w.target_price : false };
  }));
  return NextResponse.json({ watchlist: enriched });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, target_price, alert_enabled } = await request.json();
  await supabase.from('watchlists').update({ target_price, alert_enabled }).eq('id', id).eq('user_id', user.id);
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await request.json();
  await supabase.from('watchlists').delete().eq('id', id).eq('user_id', user.id);
  return NextResponse.json({ success: true });
}
