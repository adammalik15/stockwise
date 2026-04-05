const MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_VERSION = '2023-06-01';
const API_URL = 'https://api.anthropic.com/v1/messages';

// ─── Usage Limiter ──────────────────────────────────────────────────────────

const DAILY_LIMITS = {
  recommendation: 10,   // per user per day
  goal_analysis: 5,
  portfolio_analysis: 3,
};

export async function checkAndIncrementUsage(
  userId: string,
  type: keyof typeof DAILY_LIMITS,
  supabase: any
): Promise<{ allowed: boolean; remaining: number }> {
  const today = new Date().toISOString().split('T')[0];
  const countField = `${type}_count`;

  // Upsert today's row
  const { data, error } = await supabase
    .from('ai_usage')
    .upsert({ user_id: userId, date: today }, { onConflict: 'user_id,date' })
    .select()
    .single();

  if (error || !data) return { allowed: true, remaining: DAILY_LIMITS[type] };

  const current = data[countField] ?? 0;
  const limit = DAILY_LIMITS[type];

  if (current >= limit) {
    return { allowed: false, remaining: 0 };
  }

  // Increment
  await supabase
    .from('ai_usage')
    .update({ [countField]: current + 1 })
    .eq('user_id', userId)
    .eq('date', today);

  return { allowed: true, remaining: limit - current - 1 };
}

async function callClaude(systemText: string, userPrompt: string, maxTokens = 800): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Rule-based fallback if no API key
  if (!apiKey) return '';

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: [
        {
          type: 'text',
          text: systemText,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) {
    console.error('Claude API error:', res.status, await res.text());
    return '';
  }

  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

function safeParseJSON(text: string): any | null {
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

// ─── Recommendation ────────────────────────────────────────────────────────

export async function generateRecommendation(stock: any, news: any[], timeframe: string) {
  const SYSTEM = `You are a professional halal investment analyst. You specialise in Shariah-compliant stock analysis using AAOIFI standards. Always factor halal compliance into your analysis. Be specific, data-driven, and honest about uncertainty. Never present predictions as guaranteed outcomes. Respond only with valid JSON — no markdown, no extra text.`;

  const newsContext = (news ?? [])
    .map((n: any) => `- [${n.sentiment ?? 'neutral'}] ${n.headline}`)
    .join('\n') || 'No recent news available.';

  const timeframeDesc: Record<string, string> = {
    daily: 'next 1-2 trading days',
    weekly: 'next 5-7 trading days',
    monthly: 'next 30 days',
    longterm: 'next 6-12 months',
  };

  const USER = `Analyse this stock and provide a ${timeframeDesc[timeframe] ?? timeframe} investment recommendation.

STOCK DATA:
- Ticker: ${stock.ticker}
- Name: ${stock.name}
- Current Price: $${stock.price}
- Daily Change: ${stock.change_percent?.toFixed(2)}%
- Sector: ${stock.sector ?? 'N/A'}
- Industry: ${stock.industry ?? 'N/A'}
- P/E Ratio: ${stock.pe_ratio ?? 'N/A'}
- Market Cap: ${stock.market_cap ? '$' + (stock.market_cap / 1e9).toFixed(1) + 'B' : 'N/A'}
- 52W High: $${stock.fifty_two_week_high ?? 'N/A'}
- 52W Low: $${stock.fifty_two_week_low ?? 'N/A'}
- Beta: ${stock.beta ?? 'N/A'}
- Dividend Yield: ${stock.dividend_yield ? (stock.dividend_yield * 100).toFixed(2) + '%' : 'None'}
- Volume: ${stock.volume ? (stock.volume / 1e6).toFixed(1) + 'M' : 'N/A'}

RECENT NEWS:
${newsContext}

Respond ONLY with this JSON structure:
{
  "signal": "BUY" or "HOLD" or "SELL",
  "confidence": <integer 0-100>,
  "reasoning": "<3-4 sentence analysis explaining your recommendation including halal perspective>",
  "price_target": <number or null>,
  "risk_level": "LOW" or "MEDIUM" or "HIGH",
  "key_factors": ["<factor 1>", "<factor 2>", "<factor 3>"],
  "risks": ["<risk 1>", "<risk 2>"]
}`;

  const text = await callClaude(SYSTEM, USER, 800);

  // Fallback if API unavailable
  if (!text) {
    const signal = (stock.change_percent ?? 0) > 2 ? 'BUY' : (stock.change_percent ?? 0) < -2 ? 'SELL' : 'HOLD';
    return {
      ticker: stock.ticker,
      signal,
      confidence: 45,
      timeframe,
      reasoning: 'Rule-based signal from price momentum. Add an Anthropic API key for full AI analysis.',
      price_target: null,
      risk_level: (stock.beta ?? 1) > 1.5 ? 'HIGH' : (stock.beta ?? 1) > 1 ? 'MEDIUM' : 'LOW',
      key_factors: ['Price momentum indicator only'],
      risks: ['Rule-based signal — not AI generated'],
      generated_at: new Date().toISOString(),
      ai_powered: false,
    };
  }

  const parsed = safeParseJSON(text);
  if (!parsed) {
    console.error('Failed to parse Claude recommendation response:', text);
    return null;
  }

  return {
    ticker: stock.ticker,
    signal: parsed.signal,
    confidence: parsed.confidence,
    timeframe,
    reasoning: parsed.reasoning,
    price_target: parsed.price_target ?? null,
    risk_level: parsed.risk_level,
    key_factors: parsed.key_factors ?? [],
    risks: parsed.risks ?? [],
    generated_at: new Date().toISOString(),
    ai_powered: true,
  };
}

// ─── Portfolio Analysis ─────────────────────────────────────────────────────

export async function generatePortfolioAnalysis(holdings: any[], totalValue: number, score: number) {
  const SYSTEM = `You are a halal portfolio analyst specialising in Shariah-compliant investing using AAOIFI standards. Provide honest, actionable portfolio analysis. Consider halal compliance, diversification, and long-term wealth building aligned with Islamic finance principles. Respond only with valid JSON — no markdown, no extra text.`;

  const holdingSummary = holdings
    .map(h => `${h.ticker} (${h.sector ?? 'Unknown'}, ${h.asset_type}, value: $${h.current_value?.toFixed(0)}, return: ${h.gain_loss_percent?.toFixed(1)}%)`)
    .join('\n');

  const USER = `Analyse this halal investment portfolio and provide insights.

PORTFOLIO SUMMARY:
- Total Value: $${totalValue.toFixed(2)}
- Diversification Score: ${score}/100
- Number of Holdings: ${holdings.length}

HOLDINGS:
${holdingSummary}

Respond ONLY with this JSON structure:
{
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>"],
  "opportunities": ["<opportunity 1>", "<opportunity 2>"],
  "summary": "<2-3 sentence overall portfolio assessment from a halal investing perspective>"
}`;

  const text = await callClaude(SYSTEM, USER, 600);

  if (!text) {
    return {
      strengths: ['Portfolio is being tracked successfully.', 'Diversification score has been calculated.'],
      weaknesses: ['Add an Anthropic API key for deeper AI insights.'],
      opportunities: ['Consider exploring the Discover page for new halal investment ideas.'],
      summary: 'Add an Anthropic API key to unlock full AI-powered halal portfolio analysis.',
    };
  }

  const parsed = safeParseJSON(text);
  if (!parsed) return null;

  return {
    strengths: parsed.strengths ?? [],
    weaknesses: parsed.weaknesses ?? [],
    opportunities: parsed.opportunities ?? [],
    summary: parsed.summary ?? '',
  };
}

// ─── Goal Analysis ──────────────────────────────────────────────────────────

export async function generateGoalAnalysis(goal: any, portfolioValue: number) {
  const SYSTEM = `You are a halal financial planning advisor. All investment recommendations must be Shariah-compliant per AAOIFI standards. Only suggest halal-certified stocks and ETFs such as SPUS, HLAL, UMMA, PAVE, XLE, MSFT, NVDA, LLY, AAPL, AMZN. Be specific with timelines and monthly contributions. Always frame advice within Islamic finance principles. Respond only with valid JSON — no markdown, no extra text.`;

  const yearsRemaining = (new Date(goal.target_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 365);
  const amountNeeded = goal.target_amount - goal.current_amount;
  const monthsRemaining = yearsRemaining * 12;
  const simpleMonthly = monthsRemaining > 0 ? amountNeeded / monthsRemaining : amountNeeded;

  const USER = `Create a personalised halal investment strategy for this financial goal.

GOAL:
- Title: ${goal.title}
- Category: ${goal.category}
- Target Amount: $${goal.target_amount.toLocaleString()}
- Currently Saved: $${goal.current_amount.toLocaleString()}
- Amount Still Needed: $${amountNeeded.toLocaleString()}
- Target Date: ${goal.target_date}
- Years Remaining: ${yearsRemaining.toFixed(1)}
- Notes: ${goal.notes || 'None'}

INVESTOR CONTEXT:
- Current Portfolio Value: $${portfolioValue.toLocaleString()}
- This investor requires Halal/Shariah-compliant investments only
- Simple monthly savings needed (no returns): $${simpleMonthly.toFixed(0)}

Respond ONLY with this JSON structure:
{
  "feasibility": "achievable" or "challenging" or "stretch",
  "monthly_needed": <number — monthly investment assuming 8% annual halal return>,
  "recommended_return": <number — % annual return needed>,
  "suggested_stocks": ["TICKER1", "TICKER2", "TICKER3", "TICKER4", "TICKER5"],
  "strategy": "<3-4 sentence personalised halal investment strategy>",
  "milestones": ["<milestone 1 with date>", "<milestone 2 with date>", "<milestone 3 with date>", "<milestone 4 with date>"]
}`;

  const text = await callClaude(SYSTEM, USER, 700);

  if (!text) {
    return {
      feasibility: yearsRemaining > 10 ? 'achievable' : yearsRemaining > 5 ? 'challenging' : 'stretch',
      monthly_needed: Math.round(simpleMonthly),
      recommended_return: 8,
      suggested_stocks: ['SPUS', 'HLAL', 'MSFT', 'LLY', 'PAVE'],
      strategy: 'Add an Anthropic API key to get a personalised halal investment strategy for this goal.',
      milestones: ['Add Anthropic API key to enable AI goal analysis'],
    };
  }

  const parsed = safeParseJSON(text);
  if (!parsed) return null;

  return {
    feasibility: parsed.feasibility,
    monthly_needed: parsed.monthly_needed,
    recommended_return: parsed.recommended_return,
    suggested_stocks: parsed.suggested_stocks ?? [],
    strategy: parsed.strategy,
    milestones: parsed.milestones ?? [],
  };
}

// ─── Discovery ──────────────────────────────────────────────────────────────

export async function generateDiscovery(category: string, existing: string[]) {
  return [];
}