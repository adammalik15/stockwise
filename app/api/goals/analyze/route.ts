import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateGoalAnalysis, checkAndIncrementUsage } from '@/services/claude';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Check daily usage limit
  const usage = await checkAndIncrementUsage(user.id, 'goal_analysis', supabase);
  if (!usage.allowed) {
    return NextResponse.json({
      error: 'Daily AI limit reached',
      message: 'You have used all 5 goal analyses for today. Resets at midnight.',
      remaining: 0,
    }, { status: 429 });
  }

  const { goal, portfolio_value } = await request.json();
  if (!goal) return NextResponse.json({ error: 'Goal is required' }, { status: 400 });

  const analysis = await generateGoalAnalysis(goal, portfolio_value ?? 0);
  if (!analysis) return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });

  return NextResponse.json({ analysis, remaining_today: usage.remaining });
}