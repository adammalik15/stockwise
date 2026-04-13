import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const FINNHUB_KEY = process.env.FINNHUB_API_KEY;

// High-profile buzz tickers with known halal status
const BUZZ_TICKERS = [
  { ticker: 'AAPL',  halal: 'medium'  },
  { ticker: 'MSFT',  halal: 'high'    },
  { ticker: 'NVDA',  halal: 'high'    },
  { ticker: 'GOOGL', halal: 'haram'   },
  { ticker: 'META',  halal: 'haram'   },
  { ticker: 'AMZN',  halal: 'doubtful'},
  { ticker: 'TSLA',  halal: 'medium'  },
  { ticker: 'LLY',   halal: 'high'    },
  { ticker: 'AVGO',  halal: 'high'    },
  { ticker: 'JPM',   halal: 'haram'   },
  { ticker: 'V',     halal: 'high'    },
  { ticker: 'MA',    halal: 'high'    },
  { ticker: 'COST',  halal: 'high'    },
  { ticker: 'AMD',   halal: 'high'    },
  { ticker: 'QCOM',  halal: 'high'    },
  { ticker: 'TMO',   halal: 'high'    },
  { ticker: 'NVO',   halal: 'high'    },
  { ticker: 'NFLX',  halal: 'haram'   },
  { ticker: 'DIS',   halal: 'haram'   },
  { ticker: 'PYPL',  halal: 'doubtful'},
];

// Beta-based average move estimate
function estimateAvgMove(ticker: string): string {
  const highVol = ['NVDA', 'TSLA', 'AMD', 'META', 'NFLX', 'COIN'];
  const medVol  = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'LLY', 'AVGO', 'QCOM'];
  if (highVol.includes(ticker)) return '±7-10%';
  if (medVol.includes(ticker))  return '±4-6%';
  return '±3-5%';
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ── Get user tickers ──
  const [{ data: portfolio }, { data: watchlist }] = await Promise.all([
    supabase.from('portfolios').select('ticker, quantity, purchase_price').eq('user_id', user.id),
    supabase.from('watchlists').select('ticker').eq('user_id', user.id),
  ]);

  const portfolioTickers = (portfolio ?? []).map((h: any) => h.ticker.toUpperCase());
  const watchlistTickers = (watchlist ?? []).map((h: any) => h.ticker.toUpperCase());
  const portfolioMap = Object.fromEntries((portfolio ?? []).map((h: any) => [h.ticker.toUpperCase(), h]));

  if (!FINNHUB_KEY) {
    return NextResponse.json({ portfolio: [], watchlist: [], buzz: [], error: 'No Finnhub key' });
  }

  // ── Fetch earnings calendar (next 45 days) ──
  const from = new Date().toISOString().split('T')[0];
  const to   = new Date(Date.now() + 45 * 86400000).toISOString().split('T')[0];

  let allEarnings: any[] = [];
  try {
    const res  = await fetch(
      `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${FINNHUB_KEY}`
    );
    const data = await res.json();
    allEarnings = data.earningsCalendar ?? [];
  } catch {
    return NextResponse.json({ portfolio: [], watchlist: [], buzz: [] });
  }

  // ── Index by ticker for fast lookup ──
  const earningsMap: Record<string, any> = {};
  for (const e of allEarnings) {
    if (!earningsMap[e.symbol] || e.date > earningsMap[e.symbol].date) {
      earningsMap[e.symbol] = e;
    }
  }

  function formatEarning(e: any, extras: any = {}) {
    return {
      ticker:       e.symbol,
      date:         e.date,
      hour:         e.hour === 'bmo' ? 'Before Open' : e.hour === 'amc' ? 'After Close' : 'During',
      eps_estimate: e.epsEstimate ?? null,
      quarter:      e.quarter ? `Q${e.quarter} ${e.year}` : null,
      avg_move:     estimateAvgMove(e.symbol),
      ...extras,
    };
  }

  // ── Table 1: Portfolio earnings ──
  const portfolioEarnings = portfolioTickers
    .filter(t => earningsMap[t])
    .map(t => {
      const h = portfolioMap[t];
      return formatEarning(earningsMap[t], {
        shares: h?.quantity,
        buy_price: h?.purchase_price,
      });
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // ── Table 2: Watchlist earnings ──
  const watchlistEarnings = watchlistTickers
    .filter(t => earningsMap[t] && !portfolioTickers.includes(t))
    .map(t => formatEarning(earningsMap[t]))
    .sort((a, b) => a.date.localeCompare(b.date));

  // ── Table 3: Buzz earnings ──
  const buzzEarnings = BUZZ_TICKERS
    .filter(b => earningsMap[b.ticker])
    .map(b => formatEarning(earningsMap[b.ticker], {
      halal_status: b.halal,
      in_portfolio: portfolioTickers.includes(b.ticker),
      in_watchlist: watchlistTickers.includes(b.ticker),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 15);

  return NextResponse.json({
    portfolio: portfolioEarnings,
    watchlist: watchlistEarnings,
    buzz:      buzzEarnings,
    generated_at: new Date().toISOString(),
  });
}