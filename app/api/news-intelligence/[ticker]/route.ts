import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL         = 'claude-sonnet-4-6';
const FINNHUB_KEY   = process.env.FINNHUB_API_KEY;

function extractJSON(text: string): any | null {
  try { const c = text.replace(/```json\s*/g,'').replace(/```\s*/g,'').trim(); return JSON.parse(c); } catch {}
  try { const m = text.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); } catch {}
  try { const m = text.match(/"items"\s*:\s*(\[[\s\S]*?\])\s*[,}]/); if (m) return { items: JSON.parse(m[1]), net_signal: null }; } catch {}
  return null;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { ticker } = await params;
  const upper = ticker.toUpperCase();

  const { data: certs } = await supabase.from('halal_certifications').select('*').eq('ticker', upper).order('created_at', { ascending: false });
  const userCert = certs?.find((c: any) => c.certified_by === user.id) ?? null;
  const halalPayload = { user_cert: userCert, total_certs: certs?.length ?? 0 };

  let news: any[] = [];

  // Try cache
  try {
    const service = createServiceClient();
    const { data: cached } = await service.from('news_cache').select('*').eq('ticker', upper).order('published_at', { ascending: false }).limit(12);
    if (cached && cached.length > 0) {
      const age = (Date.now() - new Date(cached[0].last_updated ?? Date.now()).getTime()) / 3600000;
      if (age < 2) news = cached;
    }
  } catch {}

  // Fetch from Finnhub if cache miss
  if (news.length === 0 && FINNHUB_KEY) {
    try {
      const to   = new Date().toISOString().split('T')[0];
      const from = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
      const res  = await fetch(`https://finnhub.io/api/v1/company-news?symbol=${upper}&from=${from}&to=${to}&token=${FINNHUB_KEY}`, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const articles = await res.json();
        if (Array.isArray(articles) && articles.length > 0) {
          news = articles.slice(0, 12).map((a: any) => ({
            ticker: upper, headline: a.headline ?? '', summary: a.summary ?? a.headline ?? '',
            url: a.url ?? '', published_at: new Date(a.datetime * 1000).toISOString(),
            source: a.source ?? '', last_updated: new Date().toISOString(),
          }));
          try {
            const service = createServiceClient();
            await service.from('news_cache').delete().eq('ticker', upper);
            await service.from('news_cache').insert(news);
          } catch {}
        }
      }
    } catch {}
  }

  if (news.length === 0) {
    return NextResponse.json({ ticker: upper, items: [], net_signal: null, raw_count: 0, halal: halalPayload });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const fallbackItems = news.slice(0, 5).map(n => ({
    headline: n.headline, one_line: n.summary ?? n.headline,
    sentiment: 'neutral', horizon: 'short', action: 'monitor', halal_note: null,
    published_at: n.published_at, url: n.url, source: n.source ?? '',
  }));

  if (!anthropicKey) {
    return NextResponse.json({ ticker: upper, items: fallbackItems,
      net_signal: { direction: 'neutral', confidence: 40, summary: 'Add ANTHROPIC_API_KEY for AI analysis.' },
      raw_count: news.length, halal: halalPayload });
  }

  const newsText = news.slice(0, 8).map((n, i) =>
    `${i+1}. [${(n.published_at??'').split('T')[0]}] ${n.headline}\n   ${(n.summary??'').slice(0,160)}`
  ).join('\n\n');

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'x-api-key':anthropicKey, 'anthropic-version':'2023-06-01' },
      body: JSON.stringify({
        model: MODEL, max_tokens: 1200,
        system: [{ type:'text', text:'You are a halal investment news analyst. Return ONLY valid JSON — no markdown, no preamble.', cache_control:{type:'ephemeral'} }],
        messages: [{ role:'user', content:`Analyse these news articles about ${upper}.\n\n${newsText}\n\nReturn ONLY this JSON:\n{"items":[{"index":1,"headline":"<80 chars","one_line":"one sentence impact","sentiment":"bullish|bearish|neutral","horizon":"short|medium|long","action":"buy|hold|sell|avoid|monitor","halal_note":null}],"show_count":3,"net_signal":{"direction":"bullish|bearish|mixed|neutral","confidence":75,"summary":"one sentence"}}\n\nshow_count=5 if high-impact, 3 if routine. halal_note=null unless Shariah is affected.` }],
      }),
    });

    const apiData = await res.json();
    const rawText = (apiData.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    const parsed  = extractJSON(rawText);

    if (!parsed?.items) {
      console.error(`News parse failed for ${upper}:`, rawText.slice(0, 200));
      return NextResponse.json({ ticker: upper, items: fallbackItems,
        net_signal: { direction:'neutral', confidence:40, summary:'AI analysis unavailable. Showing raw headlines.' },
        raw_count: news.length, halal: halalPayload });
    }

    const items = (parsed.items ?? []).slice(0, parsed.show_count ?? 3).map((item: any) => {
      const src = news[Math.max(0, (item.index ?? 1) - 1)];
      return { ...item, headline: item.headline ?? src?.headline ?? '', published_at: src?.published_at, url: src?.url, source: src?.source ?? '' };
    });

    return NextResponse.json({ ticker: upper, items, net_signal: parsed.net_signal ?? null,
      raw_count: news.length, generated_at: new Date().toISOString(), halal: halalPayload });

  } catch (e) {
    console.error('News intel error:', e);
    return NextResponse.json({ ticker: upper, items: fallbackItems, net_signal: null, raw_count: news.length, halal: halalPayload });
  }
}
