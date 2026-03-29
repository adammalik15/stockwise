'use client';
import { useState, useEffect } from 'react';
import { Newspaper, Loader2, ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function NewsPanel({ ticker }: { ticker: string }) {
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/news/' + ticker).then(r => r.json()).then(d => setNews(d.news ?? [])).finally(() => setLoading(false));
  }, [ticker]);

  const scfg: any = {
    positive: { label: 'Positive', cls: 'badge-green', icon: TrendingUp },
    negative: { label: 'Negative', cls: 'badge-red', icon: TrendingDown },
    neutral:  { label: 'Neutral',  cls: 'badge-neutral', icon: Minus },
  };

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <Newspaper size={15} className="text-accent-blue" />
        <p className="text-sm font-semibold text-white">News & Sentiment</p>
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-accent-blue" /></div>
      ) : news.length === 0 ? (
        <p className="text-sm text-secondary py-4">No recent news. Add a Finnhub API key in .env.local for live news.</p>
      ) : (
        <div className="space-y-3">
          {news.map((a: any) => {
            const c = scfg[a.sentiment] ?? scfg.neutral;
            const Icon = c.icon;
            return (
              <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer"
                className="block p-3 rounded-xl bg-surface-2 hover:bg-surface-3 transition-colors border border-border/50 group">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium leading-snug line-clamp-2 group-hover:text-accent-blue transition-colors">{a.headline}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={c.cls + ' text-[10px]'}><Icon size={9} /> {c.label}</span>
                      <span className="text-[10px] text-muted">{a.source}</span>
                      <span className="text-[10px] text-muted">{new Date(a.published_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <ExternalLink size={12} className="text-muted shrink-0 mt-0.5" />
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
