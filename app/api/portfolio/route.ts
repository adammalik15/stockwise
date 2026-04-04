import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchStockData } from '@/services/yahoo-finance';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const groupId = request.nextUrl.searchParams.get('group_id');

  let query = supabase.from('portfolios').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  if (groupId) query = query.eq('group_id', groupId);

  const { data: holdings } = await query;
  const enriched = await Promise.all((holdings ?? []).map(async h => {
    const stock = await fetchStockData(h.ticker);
    const price = stock?.price ?? h.purchase_price;
    const val = price * h.quantity;
    const cost = h.purchase_price * h.quantity;
    return { ...h, stock_data: stock, current_value: val, gain_loss: val - cost, gain_loss_percent: cost > 0 ? ((val - cost) / cost) * 100 : 0 };
  }));
  return NextResponse.json({ holdings: enriched });
}

export async function PATCH(request: NextRequest) {
  // Move a holding to a different group
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, group_id } = await request.json();
  const { error } = await supabase
    .from('portfolios')
    .update({ group_id: group_id ?? null })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await request.json();
  await supabase.from('portfolios').delete().eq('id', id).eq('user_id', user.id);
  return NextResponse.json({ success: true });
}
