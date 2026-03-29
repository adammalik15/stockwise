import { NextRequest, NextResponse } from 'next/server';
import { searchTicker } from '@/services/yahoo-finance';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const q = request.nextUrl.searchParams.get('q') ?? '';
  if (!q.trim()) return NextResponse.json({ results: [] });
  const results = await searchTicker(q);
  return NextResponse.json({ results });
}
