'use client';

import { useState, useEffect } from 'react';
import { Users, Loader2, TrendingUp, TrendingDown, Building2, Landmark } from 'lucide-react';

interface Holder {
  name: string;
  shares: number;
  value: number;
  change: number;
  percent_held: number;
  type: 'fund' | 'institution';
}

export default function ShareholdersPanel({ ticker }: { ticker: string }) {
  const [fundHolders, setFundHolders] = useState<Holder[]>([]);
  const [instHolders, setInstHolders] = useState<Holder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'fund' | 'institution'>('fund');

  useEffect(() => {
    fetch(`/api/stocks/${ticker}/shareholders`)
      .then(r => r.json())
      .then(d => {
        setFundHolders(d.fund_holders ?? []);
        setInstHolders(d.institutional_holders ?? []);
      })
      .finally(() => setLoading(false));
  }, [ticker]);

  const holders = tab === 'fund' ? fundHolders : instHolders;

  function formatShares(n: number) {
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toLocaleString();
  }

  function formatValue(n: number) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    return '$' + n.toLocaleString();
  }

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <Users size={15} className="text-accent-blue" />
        <p className="text-sm font-semibold text-white">Top Shareholders</p>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 p-1 bg-surface-2 rounded-xl mb-4 w-fit">
        <button
          onClick={() => setTab('fund')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            tab === 'fund' ? 'bg-surface-4 text-white' : 'text-secondary hover:text-white'
          }`}
        >
          <Landmark size={12} /> Fund Holders
        </button>
        <button
          onClick={() => setTab('institution')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            tab === 'institution' ? 'bg-surface-4 text-white' : 'text-secondary hover:text-white'
          }`}
        >
          <Building2 size={12} /> Institutional
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={20} className="animate-spin text-accent-blue" />
        </div>
      ) : holders.length === 0 ? (
        <p className="text-sm text-secondary py-4 text-center">
          No shareholder data available for {ticker}.
        </p>
      ) : (
        <div className="space-y-3">
          {holders.map((holder, i) => (
            <div key={i} className="flex items-center justify-between gap-3 p-3 bg-surface-2 rounded-xl">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-surface-3 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-accent-blue">{i + 1}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{holder.name}</p>
                  <p className="text-xs text-secondary">
                    {formatShares(holder.shares)} shares · {holder.percent_held.toFixed(2)}% held
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-mono font-semibold text-white">
                  {formatValue(holder.value)}
                </p>
                <div className={`flex items-center gap-1 justify-end text-xs ${
                  holder.change >= 0 ? 'text-accent-green' : 'text-accent-red'
                }`}>
                  {holder.change >= 0
                    ? <TrendingUp size={10} />
                    : <TrendingDown size={10} />
                  }
                  <span>{holder.change >= 0 ? '+' : ''}{formatShares(holder.change)}</span>
                </div>
              </div>
            </div>
          ))}
          <p className="text-[10px] text-muted text-center pt-1">
            Data from Finnhub · Updated quarterly with 13F filings
          </p>
        </div>
      )}
    </div>
  );
}
