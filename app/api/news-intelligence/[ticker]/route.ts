import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL         = 'claude-sonnet-4-6';
const FINNHUB_KEY   = process.env.FINNHUB_API_KEY;

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { ticker } = await params;
  const upper = ticker.toUpperCase();

  // ── 1. Get halal cert for this ticker ──
  const { data: certs } = await supabase
    .from('halal_certifications')
    .select('*')
    .eq('ticker', upper)
    .order('created_at', { ascending: false });

  const userCert = certs?.find((c: any) => c.certified_by === user.id) ?? null;

  // ── 2. Fetch news (cache → Finnhub) ──
  let news: any[] = [];
  const service = createServiceClient();
  const { data: cached } = await service
    .from('news_cache')
    .select('*')
    .eq('ticker', upper)
    .order('published_at', { ascending: false })
    .limit(10);

  if (cached && cached.length > 0) {
    const age = (Date.now() - new Date(cached[0].last_updated).getTime()) / 3600000;
    if (age < 2) news = cached;
  }

  if (news.length === 0 && FINNHUB_KEY) {
    try {
      const to   = new Date().toISOString().split('T')[0];
      const from = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
      const res  = await fetch(
        `https://finnhub.io/api/v1/company-news?symbol=${upper}&from=${from}&to=${to}&token=${FINNHUB_KEY}`
      );
      const articles = await res.json();
      if (Array.isArray(articles)) {
        news = articles.slice(0, 10).map((a: any) => ({
          ticker: upper,
          headline: a.headline,
          summary: a.summary || a.headline,
          url: a.url,
          published_at: new Date(a.datetime * 1000).toISOString(),
          source: a.source,
          last_updated: new Date().toISOString(),
        }));
        // Cache for next call
        if (news.length > 0) {
          await service.from('news_cache').delete().eq('ticker', upper);
          await service.from('news_cache').insert(news);
        }
      }
    } catch { /* silent */ }
  }

  if (news.length === 0) {
    return NextResponse.json({
      ticker: upper, items: [], net_signal: null,
      halal: { user_cert: userCert, total_certs: certs?.length ?? 0 },
    });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  // ── 3. Fallback if no AI key ──
  if (!anthropicKey) {
    return NextResponse.json({
      ticker: upper,
      items: news.slice(0, 3).map(n => ({
        headline: n.headline,
        one_line: n.summary ?? n.headline,
        sentiment: 'neutral', horizon: 'short',
        action: 'monitor', halal_note: null,
        published_at: n.published_at, url: n.url, source: n.source,
      })),
      net_signal: { direction: 'neutral', confidence: 40, summary: 'Add Anthropic API key for full AI analysis.' },
      halal: { user_cert: userCert, total_certs: certs?.length ?? 0 },
    });
  }

  // ── 4. Claude analysis ──
  const SYSTEM = `You are a halal investment news analyst. Analyse news for their market impact and Shariah relevance. Be concise and actionable. Respond only with valid JSON — no markdown, no extra text.`;

  const newsText = news.slice(0, 8).map((n, i) =>
    `${i + 1}. [${n.published_at?.split('T')[0] ?? 'recent'}] ${n.headline}\n   ${(n.summary ?? '').slice(0, 150)}`
  ).join('\n\n');

  const USER = `Analyse these news articles about ${upper}.

NEWS:
${newsText}

Respond ONLY with this JSON:
{
  "items": [
    {
      "index": <1-based article number>,
      "headline": "<max 80 chars>",
      "one_line": "<one sentence market impact>",
      "sentiment": "bullish" | "bearish" | "neutral",
      "horizon": "short" | "medium" | "long",
      "action": "buy" | "hold" | "sell" | "avoid" | "monitor",
      "halal_note": null or "<brief note if Shariah compliance is affected>"
    }
  ],
  "show_count": <3 or 5 — use 5 if high-impact week, 3 if routine>,
  "net_signal": {
    "direction": "bullish" | "bearish" | "mixed" | "neutral",
    "confidence": <0-100>,
    "summary": "<one sentence net assessment>"
  }
}

Only return the most impactful articles (up to show_count). Skip duplicates and fluff.`;

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL, max_tokens: 1000,
        system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: USER }],
      }),
    });

    const data  = await res.json();
    const text  = data.content?.[0]?.text ?? '';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    const itemsWithMeta = parsed.items.slice(0, parsed.show_count).map((item: any) => {
      const src = news[item.index - 1] ?? news[0];
      return { ...item, published_at: src?.published_at, url: src?.url, source: src?.source ?? '' };
    });

    return NextResponse.json({
      ticker: upper,
      items: itemsWithMeta,
      net_signal: parsed.net_signal,
      generated_at: new Date().toISOString(),
      halal: { user_cert: userCert, total_certs: certs?.length ?? 0 },
    });
  } catch {
    return NextResponse.json({
      ticker: upper, items: [], net_signal: null,
      halal: { user_cert: userCert, total_certs: certs?.length ?? 0 },
      error: 'Analysis failed',
    });
  }
}