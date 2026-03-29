import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';

function scoreSentiment(text: string): 'positive'|'negative'|'neutral' {
  const lower = text.toLowerCase();
  const pos = ['beat','surge','gain','rise','record','growth','profit','strong','upgrade','rally'].filter(w => lower.includes(w)).length;
  const neg = ['miss','fall','drop','loss','decline','weak','downgrade','crash','warning','fraud'].filter(w => lower.includes(w)).length;
  return pos > neg ? 'positive' : neg > pos ? 'negative' : 'neutral';
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { ticker } = await params;
  const upper = ticker.toUpperCase();
  const service = createServiceClient();
  const { data: cached } = await service.from('news_cache').select('*').eq('ticker', upper).order('published_at', { ascending: false }).limit(10);
  if (cached && cached.length > 0) {
    const age = (Date.now() - new Date(cached[0].last_updated).getTime()) / 3600000;
    if (age < 2) return NextResponse.json({ news: cached });
  }
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return NextResponse.json({ news: cached ?? [] });
  try {
    const to = new Date().toISOString().split('T')[0];
    const from = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const res = await fetch('https://finnhub.io/api/v1/company-news?symbol=' + upper + '&from=' + from + '&to=' + to + '&token=' + key);
    const articles = await res.json();
    if (!Array.isArray(articles)) return NextResponse.json({ news: cached ?? [] });
    await service.from('news_cache').delete().eq('ticker', upper);
    const news = articles.slice(0, 10).map((a: any) => ({
      ticker: upper, headline: a.headline, summary: a.summary || a.headline,
      sentiment: scoreSentiment(a.headline + ' ' + (a.summary ?? '')),
      url: a.url, published_at: new Date(a.datetime * 1000).toISOString(),
      source: a.source, last_updated: new Date().toISOString(),
    }));
    if (news.length > 0) await service.from('news_cache').insert(news);
    return NextResponse.json({ news });
  } catch { return NextResponse.json({ news: cached ?? [] }); }
}
