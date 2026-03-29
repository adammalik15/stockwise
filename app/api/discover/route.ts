import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchStockData } from '@/services/yahoo-finance';

const FALLBACK: Record<string, any[]> = {
  short_term: [
    { ticker: 'NVDA', name: 'NVIDIA', category: 'short_term', reasoning: 'Strong momentum from AI chip demand. High institutional interest and volume.', risk_level: 'HIGH', sector: 'Technology', halal_note: 'Verify on Musaffa.com — semiconductor/AI focus.' },
    { ticker: 'META', name: 'Meta Platforms', category: 'short_term', reasoning: 'Ad revenue recovery and AI investments driving near-term momentum.', risk_level: 'MEDIUM', sector: 'Communication Services', halal_note: 'Verify on Musaffa.com — advertising revenue.' },
    { ticker: 'AMZN', name: 'Amazon', category: 'short_term', reasoning: 'AWS growth and retail margin expansion creating near-term tailwinds.', risk_level: 'MEDIUM', sector: 'Consumer Cyclical', halal_note: 'Verify on Musaffa.com — mixed revenue streams.' },
    { ticker: 'TSLA', name: 'Tesla', category: 'short_term', reasoning: 'EV delivery numbers and energy business driving volatility and opportunity.', risk_level: 'HIGH', sector: 'Consumer Cyclical', halal_note: 'Verify on Musaffa.com — auto/energy, check debt ratios.' },
    { ticker: 'AMD', name: 'Advanced Micro Devices', category: 'short_term', reasoning: 'Data center GPU competition with NVIDIA creating momentum plays.', risk_level: 'HIGH', sector: 'Technology', halal_note: 'Verify on Musaffa.com — semiconductor focus.' },
    { ticker: 'SMCI', name: 'Super Micro Computer', category: 'short_term', reasoning: 'AI server demand driving strong revenue growth.', risk_level: 'HIGH', sector: 'Technology', halal_note: 'Verify on Musaffa.com.' },
  ],
  long_term: [
    { ticker: 'MSFT', name: 'Microsoft', category: 'long_term', reasoning: 'Durable moat across cloud, productivity, and AI with consistent free cash flow.', risk_level: 'LOW', sector: 'Technology', halal_note: 'Verify on Musaffa.com — tech/cloud, generally considered compliant.' },
    { ticker: 'PAVE', name: 'Global X U.S. Infrastructure ETF', category: 'long_term', reasoning: 'Infrastructure spending tailwind with diversified industrials exposure.', risk_level: 'LOW', sector: 'Industrials', halal_note: 'Verify on Musaffa.com — ETF needs full holdings screen.' },
    { ticker: 'LLY', name: 'Eli Lilly', category: 'long_term', reasoning: 'GLP-1 pipeline dominance provides decade-long earnings growth runway.', risk_level: 'MEDIUM', sector: 'Healthcare', halal_note: 'Verify on Musaffa.com — pharmaceutical.' },
    { ticker: 'AAPL', name: 'Apple', category: 'long_term', reasoning: 'Ecosystem lock-in and services growth provide durable long-term compounding.', risk_level: 'LOW', sector: 'Technology', halal_note: 'Verify on Musaffa.com — check debt ratios.' },
    { ticker: 'V', name: 'Visa', category: 'long_term', reasoning: 'Global payments network with high margins and consistent dividend growth.', risk_level: 'LOW', sector: 'Financial Services', halal_note: 'Verify on Musaffa.com — payment processor, some scholars flag interest exposure.' },
    { ticker: 'UNH', name: 'UnitedHealth Group', category: 'long_term', reasoning: 'Largest US health insurer with diversified revenue across insurance and services.', risk_level: 'MEDIUM', sector: 'Healthcare', halal_note: 'Verify on Musaffa.com — healthcare insurance.' },
  ],
  dividend: [
    { ticker: 'JNJ', name: 'Johnson & Johnson', category: 'dividend', reasoning: '60+ year Dividend Aristocrat with consistent payout growth.', risk_level: 'LOW', sector: 'Healthcare', halal_note: 'Verify on Musaffa.com — diversified healthcare.' },
    { ticker: 'XLE', name: 'Energy Select Sector SPDR ETF', category: 'dividend', reasoning: 'High yield energy ETF with broad sector exposure.', risk_level: 'MEDIUM', sector: 'Energy', halal_note: '✅ Confirmed Halal on Musaffa.com.' },
    { ticker: 'PFE', name: 'Pfizer', category: 'dividend', reasoning: 'Attractive dividend yield with pipeline recovery potential.', risk_level: 'MEDIUM', sector: 'Healthcare', halal_note: 'Verify on Musaffa.com — pharma.' },
    { ticker: 'KO', name: 'Coca-Cola', category: 'dividend', reasoning: '60+ year dividend growth streak with global brand resilience.', risk_level: 'LOW', sector: 'Consumer Defensive', halal_note: 'Verify on Musaffa.com — beverages, check halal certification.' },
    { ticker: 'PG', name: 'Procter & Gamble', category: 'dividend', reasoning: 'Consumer staples giant with 130+ years of dividend payments.', risk_level: 'LOW', sector: 'Consumer Defensive', halal_note: 'Verify on Musaffa.com — consumer goods.' },
    { ticker: 'VZ', name: 'Verizon', category: 'dividend', reasoning: 'High dividend yield telecom with stable cash flows.', risk_level: 'MEDIUM', sector: 'Communication Services', halal_note: 'Verify on Musaffa.com — telecom, check debt levels.' },
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

  const existing = [
    ...(portfolio ?? []).map(p => p.ticker),
    ...(watchlist ?? []).map(w => w.ticker),
  ];

  const candidates = (FALLBACK[category] ?? FALLBACK.long_term)
    .filter((s: any) => !existing.includes(s.ticker));

  // Fetch live prices for all candidates in parallel
  const stocksWithPrices = await Promise.all(
    candidates.map(async (s: any) => {
      const data = await fetchStockData(s.ticker);
      return {
        ...s,
        price: data?.price ?? null,
        change_percent: data?.change_percent ?? null,
      };
    })
  );

  return NextResponse.json({ stocks: stocksWithPrices, ai_powered: false });
}