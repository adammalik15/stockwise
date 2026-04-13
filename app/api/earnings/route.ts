import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL         = 'claude-sonnet-4-6';

// ── Halal status for well-known tickers ─────────────────────────────────
const HALAL_MAP: Record<string, 'high' | 'medium' | 'doubtful' | 'haram'> = {
  NVDA:'high', MSFT:'high', LLY:'high', AAPL:'medium', TSLA:'medium',
  AMD:'high', QCOM:'high', AVGO:'high', TMO:'high', COST:'high',
  V:'high', MA:'high', SHOP:'high', NVO:'high', ISRG:'high',
  ABT:'high', HD:'high', PAVE:'high', SPUS:'high', HLAL:'high',
  JNJ:'high', RKLB:'high', MU:'high', SNDK:'high',
  META:'haram', GOOGL:'haram', NFLX:'haram', DIS:'haram', JPM:'haram',
  GS:'haram', BAC:'haram', WFC:'haram',
  AMZN:'doubtful', PYPL:'doubtful', UBER:'doubtful', APP:'doubtful',
  ZETA:'doubtful', CIEN:'high', PG:'doubtful',
};

// ── Buzz tickers to always show ─────────────────────────────────────────
const BUZZ_TICKERS = [
  'NVDA','MSFT','AAPL','META','GOOGL','AMZN','TSLA','LLY',
  'AMD','V','MA','QCOM','AVGO','TMO','COST','SHOP','NFLX',
  'DIS','UBER','NVO','JNJ','RKLB','MU',
];

// ── Cache TTL: 7 days (earnings dates rarely change once announced) ──────
const CACHE_TTL_DAYS = 7;

function isCacheValid(updatedAt: string): boolean {
  const age = (Date.now() - new Date(updatedAt).getTime()) / 86400000;
  return age < CACHE_TTL_DAYS;
}

function isUpcoming(dateStr: string): boolean {
  return new Date(dateStr + 'T23:59:00').getTime() > Date.now();
}

// ── Use Claude with web search to fetch earnings dates for multiple tickers
async function fetchEarningsDatesViaClaude(
  tickers: string[],
  apiKey: string
): Promise<Record<string, { date: string; hour: string; eps_est: number | null; confirmed: boolean; quarter: string }>> {
  if (tickers.length === 0) return {};

  const today = new Date().toISOString().split('T')[0];

  const prompt = `Today is ${today}. Search the web for the next upcoming earnings report date for each of these stocks: ${tickers.join(', ')}.

For each ticker, find:
1. The confirmed or estimated date of their next earnings report
2. Whether it is before market open (BMO) or after market close (AMC)  
3. The EPS estimate if available
4. Whether the date is confirmed or estimated
5. Which quarter it covers (e.g. Q1 2026)

Only return upcoming dates (after ${today}). If a ticker already reported recently with no next date found, skip it.

Return ONLY a JSON object in this exact format, no other text:
{
  "TICKER": {
    "date": "YYYY-MM-DD",
    "hour": "bmo" or "amc" or "tbd",
    "eps_est": number or null,
    "confirmed": true or false,
    "quarter": "Q1 2026" or similar
  }
}`;

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await res.json();

    // Extract text from all content blocks (Claude may do multiple searches)
    const textBlocks = (data.content ?? [])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n');

    const clean = textBlocks.replace(/```json|```/g, '').trim();

    // Find the JSON object in the response
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};

    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('Claude earnings search failed:', e);
    return {};
  }
}

function hourLabel(h: string): string {
  if (h === 'bmo') return 'Before Open';
  if (h === 'amc') return 'After Close';
  return 'TBD';
}

function avgMove(ticker: string): string {
  const high  = ['NVDA','AMD','TSLA','META','NFLX','RKLB','SHOP','ZETA','APP'];
  const med   = ['AAPL','MSFT','GOOGL','AMZN','LLY','AVGO','QCOM','MU','SNDK'];
  if (high.includes(ticker))  return '±8-12%';
  if (med.includes(ticker))   return '±4-7%';
  return '±3-5%';
}

// ── Main handler ────────────────────────────────────────────────────────
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  // ── Get user tickers ──
  const [{ data: portfolio }, { data: watchlist }] = await Promise.all([
    supabase.from('portfolios').select('ticker, quantity, purchase_price').eq('user_id', user.id),
    supabase.from('watchlists').select('ticker').eq('user_id', user.id),
  ]);

  const portfolioItems   = portfolio ?? [];
  const watchlistItems   = watchlist ?? [];
  const portfolioTickers = portfolioItems.map((h: any) => h.ticker.toUpperCase());
  const watchlistTickers = watchlistItems
    .map((h: any) => h.ticker.toUpperCase())
    .filter((t: string) => !portfolioTickers.includes(t));

  const portfolioMap = Object.fromEntries(
    portfolioItems.map((h: any) => [h.ticker.toUpperCase(), h])
  );

  // ── All tickers we need to look up ──
  const allNeeded = [...new Set([...portfolioTickers, ...watchlistTickers, ...BUZZ_TICKERS])];

  // ── Load what we have in cache ──
  const { data: cached } = await supabase
    .from('earnings_cache')
    .select('*')
    .in('ticker', allNeeded);

  const cacheMap: Record<string, any> = {};
  for (const row of cached ?? []) {
    cacheMap[row.ticker] = row;
  }

  // ── Find tickers that need a fresh lookup ──
  const needsLookup = allNeeded.filter(t => {
    const c = cacheMap[t];
    if (!c) return true;                     // Not in cache at all
    if (!isCacheValid(c.updated_at)) return true; // Cache expired
    if (c.date && !isUpcoming(c.date)) return true; // Date has passed
    return false;
  });

  // ── Fetch missing dates via Claude web search ──
  if (needsLookup.length > 0 && anthropicKey) {
    console.log(`Fetching earnings dates for: ${needsLookup.join(', ')}`);

    // Batch in groups of 10 to avoid token limits
    const batches: string[][] = [];
    for (let i = 0; i < needsLookup.length; i += 10) {
      batches.push(needsLookup.slice(i, i + 10));
    }

    for (const batch of batches) {
      const results = await fetchEarningsDatesViaClaude(batch, anthropicKey);

      // Upsert results into cache
      const upserts = Object.entries(results)
        .filter(([, v]) => v.date && isUpcoming(v.date))
        .map(([ticker, v]) => ({
          ticker,
          date:      v.date,
          hour:      v.hour,
          eps_est:   v.eps_est,
          confirmed: v.confirmed,
          quarter:   v.quarter,
          halal:     HALAL_MAP[ticker] ?? 'medium',
          avg_move:  avgMove(ticker),
          updated_at: new Date().toISOString(),
        }));

      if (upserts.length > 0) {
        await supabase.from('earnings_cache').upsert(upserts, { onConflict: 'ticker' });
        // Update local cache map
        for (const u of upserts) cacheMap[u.ticker] = u;
      }
    }
  }

  // ── Build response rows from cache ──
  function buildRow(ticker: string, extras: any = {}): any | null {
    const c = cacheMap[ticker];
    if (!c?.date || !isUpcoming(c.date)) return null;
    return {
      ticker,
      date:      c.date,
      hour:      hourLabel(c.hour ?? 'tbd'),
      eps_est:   c.eps_est ?? null,
      confirmed: c.confirmed ?? false,
      quarter:   c.quarter ?? null,
      avg_move:  c.avg_move ?? avgMove(ticker),
      halal:     c.halal ?? HALAL_MAP[ticker] ?? 'medium',
      ...extras,
    };
  }

  // Table 1 — Portfolio
  const portfolioEarnings = portfolioTickers
    .map(t => {
      const h = portfolioMap[t];
      return buildRow(t, { shares: h?.quantity, buy_price: h?.purchase_price });
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Table 2 — Watchlist
  const watchlistEarnings = watchlistTickers
    .map(t => buildRow(t))
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Table 3 — Buzz
  const buzzEarnings = BUZZ_TICKERS
    .map(t => {
      const row = buildRow(t);
      if (!row) return null;
      return {
        ...row,
        in_portfolio: portfolioTickers.includes(t),
        in_watchlist: watchlistTickers.includes(t),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    portfolio:    portfolioEarnings,
    watchlist:    watchlistEarnings,
    buzz:         buzzEarnings,
    data_note:    'Dates sourced via web search and cached for 7 days. Confirm before trading.',
    generated_at: new Date().toISOString(),
  });
}