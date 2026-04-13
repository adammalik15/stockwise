import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const finnhubKey = process.env.FINNHUB_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  // ── Fetch SPY as market proxy ──
  let spyData: any = null;
  if (finnhubKey) {
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=SPY&token=${finnhubKey}`
      );
      spyData = await res.json();
    } catch { /* silent */ }
  }

  // ── Fetch general market news ──
  let marketNews: any[] = [];
  if (finnhubKey) {
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/news?category=general&token=${finnhubKey}`
      );
      const articles = await res.json();
      if (Array.isArray(articles)) {
        marketNews = articles.slice(0, 8).map((a: any) => a.headline);
      }
    } catch { /* silent */ }
  }

  // ── Fetch user's portfolio + watchlist tickers ──
  const [{ data: portfolio }, { data: watchlist }] = await Promise.all([
    supabase.from('portfolios').select('ticker').eq('user_id', user.id),
    supabase.from('watchlists').select('ticker').eq('user_id', user.id),
  ]);

  const portfolioTickers = (portfolio ?? []).map((h: any) => h.ticker);
  const watchlistTickers = (watchlist ?? []).map((h: any) => h.ticker);
  const allTickers = [...new Set([...portfolioTickers, ...watchlistTickers])];

  // ── Build market context ──
  const spyChange = spyData?.dp ?? 0;
  const spyPrice = spyData?.c ?? 0;
  const spyPrevClose = spyData?.pc ?? 0;

  // ── Rule-based fallback if no API key ──
  if (!anthropicKey) {
    return NextResponse.json({
      status: 'favorable',
      status_label: '🟢 FAVORABLE — Normal trading',
      reasons: ['Market data unavailable — add Anthropic API key for AI analysis'],
      guidance: 'Check market conditions manually before trading.',
      your_stocks: {
        favorable: portfolioTickers.slice(0, 3),
        avoid: [],
        neutral: watchlistTickers.slice(0, 3),
      },
      generated_at: new Date().toISOString(),
    });
  }

  // ── Claude analysis ──
  const SYSTEM = `You are a halal market analyst. Analyse current market conditions and provide a clear, actionable daily market status for a Muslim investor. Be concise and direct. Respond only with valid JSON — no markdown, no extra text.`;

  const USER = `Analyse today's market conditions and provide a trading status assessment.

MARKET DATA:
- SPY (S&P 500 ETF): $${spyPrice.toFixed(2)} (${spyChange >= 0 ? '+' : ''}${spyChange.toFixed(2)}% today)
- Previous close: $${spyPrevClose.toFixed(2)}
- Day direction: ${spyChange > 1 ? 'Strong rally' : spyChange > 0 ? 'Mild gains' : spyChange > -1 ? 'Mild decline' : 'Significant drop'}

RECENT MARKET HEADLINES:
${marketNews.map((h, i) => `${i + 1}. ${h}`).join('\n')}

USER'S HALAL HOLDINGS: ${portfolioTickers.join(', ') || 'None yet'}
USER'S WATCHLIST: ${watchlistTickers.join(', ') || 'None yet'}

Based on all of the above, respond ONLY with this JSON:
{
  "status": "favorable" | "cautious" | "unfavorable" | "closed",
  "status_label": "one line summary e.g. 🟢 FAVORABLE — Normal trading",
  "reasons": ["reason 1", "reason 2", "reason 3"],
  "guidance": "2 sentence plain English guidance for today",
  "your_stocks": {
    "favorable": ["TICKER1", "TICKER2"],
    "avoid": ["TICKER3"],
    "neutral": ["TICKER4", "TICKER5"]
  }
}

Only include tickers from the user's holdings and watchlist in your_stocks.
If market is closed (weekend/holiday), set status to "closed".`;

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: USER }],
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text ?? '';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return NextResponse.json({
      ...parsed,
      generated_at: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({
      status: 'cautious',
      status_label: '🟡 CAUTIOUS — Analysis unavailable',
      reasons: ['Market analysis could not be generated right now'],
      guidance: 'Proceed with caution. Check market conditions manually.',
      your_stocks: { favorable: [], avoid: [], neutral: allTickers.slice(0, 5) },
      generated_at: new Date().toISOString(),
    });
  }
}