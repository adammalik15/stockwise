'use client';

import { useState, useEffect } from 'react';
import { Newspaper, Loader2, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';

interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  url: string;
  published_at: string;
  source: string;
}

interface SentimentGroup {
  sentiment: 'positive' | 'negative' | 'neutral';
  items: NewsItem[];
  summary: string;
}

function summariseGroup(items: NewsItem[]): string {
  if (items.length === 0) return '';
  // Take the first 3 summaries and combine into one readable paragraph
  const snippets = items
    .slice(0, 3)
    .map(n => n.summary || n.headline)
    .filter(Boolean);
  return snippets.join(' · ');
}

export default function NewsPanel({ ticker }: { ticker: string }) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<'positive' | 'negative' | 'neutral' | null>(null);

  useEffect(() => {
    fetch(`/api/news/${ticker}`)
      .then(r => r.json())
      .then(d => setNews(d.news ?? []))
      .finally(() => setLoading(false));
  }, [ticker]);

  // Group by sentiment
  const groups: SentimentGroup[] = (['positive', 'negative', 'neutral'] as const)
    .map(sentiment => ({
      sentiment,
      items: news.filter(n => n.sentiment === sentiment),
      summary: summariseGroup(news.filter(n => n.sentiment === sentiment)),
    }))
    .filter(g => g.items.length > 0);

  const sentimentConfig = {
    positive: {
      label: 'Positive News',
      color: 'text-accent-green',
      bg: 'bg-accent-green/10',
      border: 'border-accent-green/30',
      icon: TrendingUp,
      dot: 'bg-accent-green',
    },
    negative: {
      label: 'Negative News',
      color: 'text-accent-red',
      bg: 'bg-accent-red/10',
      border: 'border-accent-red/30',
      icon: TrendingDown,
      dot: 'bg-accent-red',
    },
    neutral: {
      label: 'Neutral News',
      color: 'text-secondary',
      bg: 'bg-surface-2',
      border: 'border-border',
      icon: Minus,
      dot: 'bg-surface-4',
    },
  };

  const totalCount = news.length;
  const posCount = news.filter(n => n.sentiment === 'positive').length;
  const negCount = news.filter(n => n.sentiment === 'negative').length;

  // Overall sentiment
  const overallSentiment = posCount > negCount ? 'positive' : negCount > posCount ? 'negative' : 'neutral';
  const overallLabel = posCount > negCount
    ? 'Mostly Positive'
    : negCount > posCount
    ? 'Mostly Negative'
    : 'Mixed / Neutral';
  const overallColor = posCount > negCount
    ? 'text-accent-green'
    : negCount > posCount
    ? 'text-accent-red'
    : 'text-secondary';

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Newspaper size={15} className="text-accent-blue" />
          <p className="text-sm font-semibold text-white">News & Sentiment</p>
        </div>
        {totalCount > 0 && (
          <span className={`text-xs font-semibold ${overallColor}`}>
            {overallLabel}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={20} className="animate-spin text-accent-blue" />
        </div>
      ) : news.length === 0 ? (
        <p className="text-sm text-secondary py-4">
          No recent news. Add a Finnhub API key in your environment variables for live news.
        </p>
      ) : (
        <div className="space-y-3">
          {/* Sentiment Bar */}
          {totalCount > 0 && (
            <div className="mb-4">
              <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
                {posCount > 0 && (
                  <div
                    className="bg-accent-green rounded-full transition-all"
                    style={{ width: (posCount / totalCount * 100) + '%' }}
                  />
                )}
                {negCount > 0 && (
                  <div
                    className="bg-accent-red rounded-full transition-all"
                    style={{ width: (negCount / totalCount * 100) + '%' }}
                  />
                )}
                {(totalCount - posCount - negCount) > 0 && (
                  <div
                    className="bg-surface-4 rounded-full transition-all"
                    style={{ width: ((totalCount - posCount - negCount) / totalCount * 100) + '%' }}
                  />
                )}
              </div>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5 text-[10px] text-secondary">
                  <div className="w-2 h-2 rounded-full bg-accent-green" />
                  {posCount} positive
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-secondary">
                  <div className="w-2 h-2 rounded-full bg-accent-red" />
                  {negCount} negative
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-secondary">
                  <div className="w-2 h-2 rounded-full bg-surface-4" />
                  {totalCount - posCount - negCount} neutral
                </div>
              </div>
            </div>
          )}

          {/* Grouped Sentiment Cards */}
          {groups.map(group => {
            const cfg = sentimentConfig[group.sentiment];
            const Icon = cfg.icon;
            const isExpanded = expanded === group.sentiment;

            return (
              <div key={group.sentiment} className={`rounded-xl border ${cfg.border} overflow-hidden`}>
                {/* Group Header — always visible */}
                <div className={`p-4 ${cfg.bg}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <Icon size={15} className={`${cfg.color} shrink-0 mt-0.5`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <p className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                            {group.items.length} articles
                          </span>
                        </div>
                        {/* Summary — always shown */}
                        <p className="text-xs text-secondary leading-relaxed">
                          {group.summary}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setExpanded(isExpanded ? null : group.sentiment)}
                      className={`flex items-center gap-1 text-[10px] shrink-0 ${cfg.color} hover:opacity-80 transition-opacity mt-0.5`}
                    >
                      {isExpanded ? (
                        <>
                          <span>Less</span>
                          <ChevronUp size={12} />
                        </>
                      ) : (
                        <>
                          <span>More</span>
                          <ChevronDown size={12} />
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Individual Articles — shown when expanded */}
                {isExpanded && (
                  <div className="divide-y divide-border/50">
                    {group.items.map(article => (
                      <a
                        key={article.id}
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-surface-2 transition-colors group"
                      >
                        <div className="min-w-0">
                          <p className="text-xs text-white font-medium leading-snug line-clamp-2 group-hover:text-accent-blue transition-colors">
                            {article.headline}
                          </p>
                          <p className="text-[10px] text-muted mt-1">
                            {article.source}
                            {article.published_at
                              ? ' · ' + new Date(article.published_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })
                              : ''}
                          </p>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}