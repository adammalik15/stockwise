import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchStockData } from '@/services/yahoo-finance';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: holdings } = await supabase.from('portfolios').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  const enriched = await Promise.all((holdings ?? []).map(async h => {
    const stock = await fetchStockData(h.ticker);
    const price = stock?.price ?? h.purchase_price;
    const val = price * h.quantity;
    const cost = h.purchase_price * h.quantity;
    return { ...h, stock_data: stock, current_value: val, gain_loss: val - cost, gain_loss_percent: cost > 0 ? ((val - cost) / cost) * 100 : 0 };
  }));
  return NextResponse.json({ holdings: enriched });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await request.json();
  await supabase.from('portfolios').delete().eq('id', id).eq('user_id', user.id);
  return NextResponse.json({ success: true });
}
