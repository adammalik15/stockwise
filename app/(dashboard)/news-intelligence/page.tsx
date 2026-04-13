'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Newspaper, Loader2, TrendingUp, TrendingDown,
  Minus, ExternalLink, RefreshCw, CheckCircle2,
  XCircle, AlertCircle, Brain,
} from 'lucide-react';

const SENTIMENT_CONFIG: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  bullish: { color: 'text-accent-green',  bg: 'bg-accent-green/10 border-accent-green/25',  icon: TrendingUp,   label: 'Bullish'  },
  bearish: { color: 'text-accent-red',    bg: 'bg-accent-red/10   border-accent-red/25',    icon: TrendingDown, label: 'Bearish'  },
  neutral: { color: 'text-muted',         bg: 'bg-surface-3       border-border',            icon: Minus,        label: 'Neutral'  },
};

const ACTION_CONFIG: Record<string, { color: string; bg: string }> = {
  buy:     { color: 'text-accent-green',  bg: 'bg-accent-green/15'  },
  hold:    { color: 'text-accent-yellow', bg: 'bg-accent-yellow/15' },
  sell:    { color: 'text-accent-red',    bg: 'bg-accent-red/15'    },
  avoid:   { color: 'text-accent-red',    bg: 'bg-accent-red/10'    },
  monitor: { color: 'text-muted',         bg: 'bg-surface-3'        },
};

const HORIZON_LABEL: Record<string, string> = {
  short: 'Short-term', medium: 'Medium-term', long: 'Long-term',
};

const VERDICT_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  halal:    { label: 'Halal',    color: 'text-accent-green',  icon: CheckCircle2 },
  haram:    { label: 'Haram',    color: 'text-accent-red',    icon: XCircle      },
  doubtful: { label: 'Doubtful', color: 'text-accent-yellow', icon: AlertCircle  },
};

export default function NewsIntelligencePage() {
  const [tickers,        setTickers]        = useState<string[]>([]);
  const [selected,       setSelected]       = useState<string | null>(null);
  const [analysis,       setAnalysis]       = useState<any>(null);
  const [loading,        setLoading]        = useState(false);
  const [certLoading,    setCertLoading]    = useState(false);
  const [tickersLoading, setTickersLoading] = useState(true);

  // ── Load all user tickers ──
  useEffect(() => {
    async function loadTickers() {
      setTickersLoading(true);
      const [pRes, wRes] = await Promise.all([
        fetch('/api/portfolio'),
        fetch('/api/watchlist'),
      ]);
      const [pData, wData] = await Promise.all([pRes.json(), wRes.json()]);
      const all = [
        ...(pData.holdings ?? []).map((h: any) => h.ticker),
        ...(wData.watchlist ?? []).map((w: any) => w.ticker),
      ];
      const unique = [...new Set<string>(all)];
      setTickers(unique);
      if (unique.length > 0) setSelected(unique[0]);
      setTickersLoading(false);
    }
    loadTickers();
  }, []);

  // ── Fetch analysis when ticker changes ──
  const fetchAnalysis = useCallback(async (ticker: string) => {
    setLoading(true);
    setAnalysis(null);
    try {
      const res  = await fetch(`/api/news-intelligence/${ticker}`);
      const data = await res.json();
      setAnalysis(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selected) fetchAnalysis(selected);
  }, [selected, fetchAnalysis]);

  // ── Halal certification ──
  async function certify(verdict: 'halal' | 'haram' | 'doubtful') {
    if (!selected) return;
    setCertLoading(true);
    try {
      await fetch(`/api/stocks/${selected}/halal-cert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_verdict: verdict }),
      });
      // Refresh
      await fetchAnalysis(selected);
    } finally {
      setCertLoading(false);
    }
  }

  async function removeCert() {
    if (!selected) return;
    setCertLoading(true);
    try {
      await fetch(`/api/stocks/${selected}/halal-cert`, { method: 'DELETE' });
      await fetchAnalysis(selected);
    } finally {
      setCertLoading(false);
    }
  }

  const userVerdict = analysis?.halal?.user_cert?.user_verdict;
  const verdictCfg  = userVerdict ? VERDICT_CONFIG[userVerdict] : null;
  const VerdictIcon = verdictCfg?.icon;

  if (tickersLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={22} className="animate-spin text-accent-green" />
      </div>
    );
  }

  if (tickers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <Newspaper size={36} className="text-muted mb-3" />
        <h2 className="text-base font-semibold text-white mb-1">No stocks yet</h2>
        <p className="text-secondary text-sm">Add stocks to your portfolio or watchlist first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 page-enter">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Newspaper size={20} className="text-accent-green" />
            News Intelligence
          </h1>
          <p className="text-secondary text-sm mt-0.5">
            AI-powered actionable news analysis for your stocks
          </p>
        </div>
        {selected && (
          <button
            onClick={() => fetchAnalysis(selected)}
            className="btn-secondary flex items-center gap-2"
            disabled={loading}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        )}
      </div>

      {/* ── Ticker Selector ── */}
      <div className="flex flex-wrap gap-1.5">
        {tickers.map(t => (
          <button
            key={t}
            onClick={() => setSelected(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              selected === t
                ? 'bg-accent-green text-surface'
                : 'bg-surface-2 border border-border text-secondary hover:text-white hover:border-accent-green/40'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Main Panel ── */}
      {selected && (
        <div className="space-y-4">

          {/* ── Halal Status Card ── */}
          <div className="card p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-xs text-muted mb-0.5">Halal Status — {selected}</p>
                  {verdictCfg && VerdictIcon ? (
                    <div className={`flex items-center gap-1.5 ${verdictCfg.color}`}>
                      <VerdictIcon size={16} />
                      <span className="text-sm font-semibold">{verdictCfg.label}</span>
                      <span className="text-[10px] text-muted ml-1">
                        (your verdict · {analysis?.halal?.total_certs ?? 0} total)
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm text-muted">Not yet certified</p>
                  )}
                </div>
              </div>

              {/* Cert buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {certLoading ? (
                  <Loader2 size={14} className="animate-spin text-muted" />
                ) : (
                  <>
                    {(['halal', 'haram', 'doubtful'] as const).map(v => {
                      const cfg = VERDICT_CONFIG[v];
                      const Icon = cfg.icon;
                      const isActive = userVerdict === v;
                      return (
                        <button
                          key={v}
                          onClick={() => isActive ? removeCert() : certify(v)}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                            isActive
                              ? `${cfg.color} bg-current/10 border-current/30`
                              : 'text-muted border-border hover:border-accent-green/30 hover:text-white bg-surface-2'
                          }`}
                        >
                          <Icon size={11} />
                          {isActive ? `✓ ${cfg.label}` : cfg.label}
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── News Analysis ── */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 size={22} className="animate-spin text-accent-green" />
              <p className="text-xs text-secondary">Claude is analysing {selected} news…</p>
            </div>
          ) : analysis?.items?.length === 0 ? (
            <div className="card flex flex-col items-center py-12 text-center">
              <Newspaper size={28} className="text-muted mb-3" />
              <p className="text-sm text-white font-semibold mb-1">No news found</p>
              <p className="text-xs text-secondary">No recent news for {selected}. Try refreshing.</p>
            </div>
          ) : analysis?.items ? (
            <div className="space-y-3">

              {/* Net signal */}
              {analysis.net_signal && (() => {
                const cfg = SENTIMENT_CONFIG[analysis.net_signal.direction] ?? SENTIMENT_CONFIG.neutral;
                const Icon = cfg.icon;
                return (
                  <div className={`card border p-4 ${cfg.bg}`}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Icon size={16} className={cfg.color} />
                        <span className={`text-sm font-bold uppercase tracking-wide ${cfg.color}`}>
                          {analysis.net_signal.direction}
                        </span>
                        <span className="text-xs text-secondary">— {analysis.net_signal.summary}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted">Confidence</span>
                        <div className="w-20 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full bg-current ${cfg.color}`}
                            style={{ width: analysis.net_signal.confidence + '%' }}
                          />
                        </div>
                        <span className={`text-xs font-mono font-bold ${cfg.color}`}>
                          {analysis.net_signal.confidence}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* News items */}
              {analysis.items.map((item: any, i: number) => {
                const sentCfg   = SENTIMENT_CONFIG[item.sentiment] ?? SENTIMENT_CONFIG.neutral;
                const actionCfg = ACTION_CONFIG[item.action]      ?? ACTION_CONFIG.monitor;
                const SentIcon  = sentCfg.icon;
                return (
                  <div key={i} className={`card border p-4 ${sentCfg.bg}`}>
                    <div className="flex items-start gap-3">
                      <SentIcon size={14} className={`${sentCfg.color} mt-0.5 shrink-0`} />
                      <div className="flex-1 min-w-0">

                        {/* Headline + link */}
                        <div className="flex items-start gap-2 mb-1">
                          <p className="text-sm font-semibold text-white leading-snug flex-1">
                            {item.headline}
                          </p>
                          {item.url && (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted hover:text-accent-green transition-colors shrink-0 mt-0.5"
                            >
                              <ExternalLink size={12} />
                            </a>
                          )}
                        </div>

                        {/* One-liner */}
                        <p className="text-xs text-secondary mb-2">{item.one_line}</p>

                        {/* Tags row */}
                        <div className="flex items-center flex-wrap gap-1.5">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${sentCfg.color} ${sentCfg.bg} border border-current/20`}>
                            {sentCfg.label}
                          </span>
                          <span className="text-[10px] text-muted px-2 py-0.5 rounded-full bg-surface-3 border border-border">
                            {HORIZON_LABEL[item.horizon]}
                          </span>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${actionCfg.color} ${actionCfg.bg}`}>
                            {item.action.toUpperCase()}
                          </span>
                          {item.halal_note && (
                            <span className="text-[10px] text-accent-yellow px-2 py-0.5 rounded-full bg-accent-yellow/10 border border-accent-yellow/20">
                              🕌 {item.halal_note}
                            </span>
                          )}
                        </div>

                        {/* Meta */}
                        {item.published_at && (
                          <p className="text-[9px] text-muted mt-2">
                            {item.source && `${item.source} · `}
                            {new Date(item.published_at).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Footer */}
              {analysis.generated_at && (
                <div className="flex items-center gap-1.5 text-[10px] text-muted">
                  <Brain size={10} />
                  <span>Powered by Claude AI · {new Date(analysis.generated_at).toLocaleTimeString()}</span>
                  <span>·</span>
                  <span>Not financial advice</span>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}