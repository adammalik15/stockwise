'use client';
import { useState, useEffect } from 'react';
import { Brain, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';

type Timeframe = 'daily'|'weekly'|'monthly'|'longterm';
const TFS = [{ key: 'daily', label: 'Tomorrow' },{ key: 'weekly', label: 'This Week' },{ key: 'monthly', label: 'This Month' },{ key: 'longterm', label: 'Long Term' }] as const;

export default function RecommendationPanel({ ticker }: { ticker: string }) {
  const [tf, setTf] = useState<Timeframe>('weekly');
  const [rec, setRec] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true); setRec(null);
      try {
        const res = await fetch('/api/recommendation/' + ticker + '?timeframe=' + tf);
        const data = await res.json();
        setRec(data.recommendation ?? null);
      } finally { setLoading(false); }
    }
    load();
  }, [ticker, tf]);

  const cfg: any = {
    BUY: { color: 'text-accent-green', bg: 'bg-accent-green/15 border-accent-green/30', icon: TrendingUp },
    HOLD: { color: 'text-accent-yellow', bg: 'bg-accent-yellow/15 border-accent-yellow/30', icon: Minus },
    SELL: { color: 'text-accent-red', bg: 'bg-accent-red/15 border-accent-red/30', icon: TrendingDown },
  };

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <Brain size={15} className="text-accent-purple" />
        <p className="text-sm font-semibold text-white">AI Recommendation</p>
      </div>
      <div className="flex gap-1 p-1 bg-surface-2 rounded-xl mb-5 w-fit">
        {TFS.map(t => (
          <button key={t.key} onClick={() => setTf(t.key as Timeframe)}
            className={"px-3 py-1.5 rounded-lg text-xs font-medium transition-all " + (tf === t.key ? 'bg-surface-4 text-white' : 'text-secondary hover:text-white')}>
            {t.label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <Loader2 size={24} className="animate-spin text-accent-purple" />
          <p className="text-xs text-secondary">Analyzing {ticker}...</p>
        </div>
      ) : rec ? (() => {
        const c = cfg[rec.signal] ?? cfg.HOLD;
        const Icon = c.icon;
        return (
          <div className="space-y-4">
            <div className={"flex items-center gap-4 p-4 rounded-xl border " + c.bg}>
              <Icon size={28} className={c.color} />
              <div>
                <p className={"text-2xl font-bold " + c.color}>{rec.signal}</p>
                <p className="text-xs text-secondary">{TFS.find(t => t.key === rec.timeframe)?.label} outlook</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-xs text-secondary mb-1">Confidence</p>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                    <div className={"h-full rounded-full bg-current " + c.color} style={{ width: rec.confidence + '%' }} />
                  </div>
                  <span className={"text-sm font-mono font-bold " + c.color}>{rec.confidence}%</span>
                </div>
              </div>
            </div>
            <p className="text-sm text-secondary leading-relaxed">{rec.reasoning}</p>
            <p className="text-[10px] text-muted">Not financial advice. Always do your own research.</p>
          </div>
        );
      })() : <p className="text-sm text-secondary">Could not generate recommendation.</p>}
    </div>
  );
}
