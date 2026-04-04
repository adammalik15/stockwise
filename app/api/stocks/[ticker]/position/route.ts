import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Returns the user's portfolio position + transaction history for a ticker.
// Requires DB:
//   portfolios table (existing) — plus optional `term` column
//   portfolio_transactions table (optional, gracefully absent):
//     id, user_id, ticker, type ('buy'|'sell'|'set'), quantity, price, date, notes, created_at
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { ticker } = await params;
  const upper = ticker.toUpperCase();

  const { data: holding } = await supabase
    .from('portfolios')
    .select('*')
    .eq('user_id', user.id)
    .eq('ticker', upper)
    .maybeSingle();

  // Transactions — best-effort (table may not exist yet)
  let transactions: any[] = [];
  try {
    const { data: txns } = await supabase
      .from('portfolio_transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('ticker', upper)
      .order('created_at', { ascending: false });
    transactions = txns ?? [];
  } catch {
    // table doesn't exist yet — return empty
  }

  return NextResponse.json({ holding, transactions });
}
