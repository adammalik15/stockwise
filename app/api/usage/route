import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const LIMITS = {
  recommendation: 10,
  goal_analysis: 5,
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const today = new Date().toISOString().split('T')[0];

  const { data } = await supabase
    .from('ai_usage')
    .select('recommendation_count, goal_analysis_count')
    .eq('user_id', user.id)
    .eq('date', today)
    .maybeSingle();

  return NextResponse.json({
    recommendation: {
      used:  data?.recommendation_count  ?? 0,
      limit: LIMITS.recommendation,
    },
    goal_analysis: {
      used:  data?.goal_analysis_count ?? 0,
      limit: LIMITS.goal_analysis,
    },
  });
}