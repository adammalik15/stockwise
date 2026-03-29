import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { ticker } = await params;
  const upper = ticker.toUpperCase();

  const { data: certifications } = await supabase
    .from('halal_certifications')
    .select('*')
    .eq('ticker', upper)
    .order('created_at', { ascending: false });

  const userCert = certifications?.find(c => c.certified_by === user.id) ?? null;

  return NextResponse.json({
    certifications: certifications ?? [],
    user_certified: !!userCert,
    user_cert: userCert,
    total_count: certifications?.length ?? 0,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { ticker } = await params;
  const upper = ticker.toUpperCase();
  const { certified_name, source, notes } = await request.json();

  const { error } = await supabase.from('halal_certifications').upsert({
    ticker: upper,
    certified_by: user.id,
    certified_name: certified_name || user.email?.split('@')[0] || 'Anonymous',
    source: source || 'Personal research',
    notes: notes || null,
  }, { onConflict: 'ticker,certified_by' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { ticker } = await params;

  const { error } = await supabase
    .from('halal_certifications')
    .delete()
    .eq('ticker', ticker.toUpperCase())
    .eq('certified_by', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}