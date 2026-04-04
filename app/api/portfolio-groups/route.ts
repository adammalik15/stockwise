import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// portfolio_groups table:
//   id uuid pk, user_id uuid, name text, created_at timestamptz
// portfolios table gains: group_id uuid nullable (fk portfolio_groups.id)

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: groups } = await supabase
    .from('portfolio_groups')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  return NextResponse.json({ groups: groups ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const { data, error } = await supabase
    .from('portfolio_groups')
    .insert({ user_id: user.id, name: name.trim() })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ group: data });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, name } = await request.json();
  const { error } = await supabase
    .from('portfolio_groups')
    .update({ name: name.trim() })
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
  // Null out group_id on holdings before deleting the group
  await supabase.from('portfolios').update({ group_id: null }).eq('group_id', id).eq('user_id', user.id);
  const { error } = await supabase.from('portfolio_groups').delete().eq('id', id).eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
