import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const FALLBACK: Record<string,any[]> = {
  short_term: [
    { ticker:'NVDA', name:'NVIDIA', price:130, category:'short_term', reasoning:'Strong momentum from AI chip demand. High institutional interest and volume.', risk_level:'HIGH', sector:'Technology', halal_note:'Verify on Musaffa.com — semiconductor/AI focus, no obvious haram revenue.' },
    { ticker:'META', name:'Meta Platforms', price:610, category:'short_term', reasoning:'Ad revenue recovery and AI investments driving near-term momentum.', risk_level:'MEDIUM', sector:'Communication Services', halal_note:'Verify on Musaffa.com — advertising revenue; some scholars flag social media concerns.' },
    { ticker:'AMZN', name:'Amazon', price:220, category:'short_term', reasoning:'AWS growth and retail margin expansion creating near-term tailwinds.', risk_level:'MEDIUM', sector:'Consumer Cyclical', halal_note:'Verify on Musaffa.com — mixed revenue; check debt ratios.' },
  ],
  long_term: [
    { ticker:'MSFT', name:'Microsoft', price:430, category:'long_term', reasoning:'Durable moat across cloud, productivity, and AI with consistent free cash flow.', risk_level:'LOW', sector:'Technology', halal_note:'Verify on Musaffa.com — tech/cloud, generally considered compliant by many scholars.' },
    { ticker:'PAVE', name:'Global X U.S. Infrastructure ETF', price:40, category:'long_term', reasoning:'Infrastructure spending tailwind with diversified industrials exposure.', risk_level:'LOW', sector:'Industrials', halal_note:'Verify on Musaffa.com — ETF needs full holdings screen via Musaffa ETF tool.' },
    { ticker:'LLY', name:'Eli Lilly', price:810, category:'long_term', reasoning:'GLP-1 pipeline dominance provides decade-long earnings growth runway.', risk_level:'MEDIUM', sector:'Healthcare', halal_note:'Verify on Musaffa.com — pharmaceutical; generally halal if no haram product lines.' },
  ],
  dividend: [
    { ticker:'JNJ', name:'Johnson & Johnson', price:155, category:'dividend', reasoning:'60+ year Dividend Aristocrat with consistent payout growth.', risk_level:'LOW', sector:'Healthcare', halal_note:'Verify on Musaffa.com — diversified healthcare, check debt-to-asset ratios.' },
    { ticker:'XLE', name:'Energy Select Sector SPDR ETF', price:88, category:'dividend', reasoning:'High yield energy ETF with broad sector exposure.', risk_level:'MEDIUM', sector:'Energy', halal_note:'✅ Confirmed Halal on Musaffa.com.' },
    { ticker:'PFE', name:'Pfizer', price:27, category:'dividend', reasoning:'Attractive dividend yield with pipeline recovery potential.', risk_level:'MEDIUM', sector:'Healthcare', halal_note:'Verify on Musaffa.com — pharma; check full screening.' },
  ],
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const category = (request.nextUrl.searchParams.get('category') ?? 'long_term') as string;
  const [{ data: portfolio }, { data: watchlist }] = await Promise.all([
    supabase.from('portfolios').select('ticker').eq('user_id', user.id),
    supabase.from('watchlists').select('ticker').eq('user_id', user.id),
  ]);
  const existing = [...(portfolio ?? []).map(p => p.ticker), ...(watchlist ?? []).map(w => w.ticker)];
  const stocks = (FALLBACK[category] ?? FALLBACK.long_term).filter((s: any) => !existing.includes(s.ticker));
  return NextResponse.json({ stocks, ai_powered: false });
}
