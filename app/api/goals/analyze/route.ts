import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateGoalAnalysis } from '@/services/claude';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { goal, portfolio_value } = await request.json();

  if (!goal) return NextResponse.json({ error: 'Goal is required' }, { status: 400 });

  const analysis = await generateGoalAnalysis(goal, portfolio_value ?? 0);

  if (!analysis) return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });

  return NextResponse.json({ analysis });
}