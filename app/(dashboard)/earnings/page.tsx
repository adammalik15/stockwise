'use client';

import { useState, useEffect } from 'react';
import { CalendarDays, Loader2, TrendingUp, Eye, Flame } from 'lucide-react';

type Tab = 'portfolio' | 'watchlist' | 'buzz';

const HALAL_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  high:     { label: 'Halal',    color: 'text-accent-green',  icon: '✅' },
  medium:   { label: 'Medium',   color: 'text-accent-yellow', icon: '⚠️' },
  doubtful: { label: 'Doubtful', color: 'text-accent-yellow', icon: '⚠️' },
  haram:    { label: 'Haram',    color: 'text-accent-red',    icon: '❌' },
};

const HOUR_CONFIG: Record<string, { color: string }> = {
  'Before Open': { color: 'text-accent-blue'   },
  'After Close': { color: 'text-accent-purple' },
  'During':      { color: 'text-muted'         },
};

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - new Date().setHours(0,0,0,0);
  return Math.ceil(diff / 86400000);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', weekday: 'short',
  });
}

export default function EarningsPage() {
  const [tab,     setTab]     = useState<Tab>('portfolio');
  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res  = await fetch('/api/earnings');
        const json = await res.json();
        setData(json);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const tabs: { key: Tab; label: string; icon: any; count: number }[] = [
    { key: 'portfolio', label: 'My Portfolio', icon: TrendingUp, count: data?.portfolio?.length ?? 0 },
    { key: 'watchlist', label: 'My Watchlist', icon: Eye,        count: data?.watchlist?.length ?? 0 },
    { key: 'buzz',      label: 'Market Buzz',  icon: Flame,      count: data?.buzz?.length      ?? 0 },
  ];

  const rows: any[] = data?.[tab] ?? [];

  return (
    <div className="space-y-5 page-enter">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <CalendarDays size={20} className="text-accent-green" />
          Earnings Calendar
        </h1>
        <p className="text-secondary text-sm mt-0.5">
          Upcoming earnings reports for your stocks — next 45 days
        </p>
      </div>

      {/* ── Tab switcher ── */}
      <div className="flex gap-1 p-1 bg-surface-2 rounded-xl w-fit">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                tab === t.key
                  ? 'bg-surface-4 text-white'
                  : 'text-secondary hover:text-white'
              }`}
            >
              <Icon size={12} />
              {t.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                tab === t.key ? 'bg-accent-green/20 text-accent-green' : 'bg-surface-3 text-muted'
              }`}>
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={20} className="animate-spin text-accent-green" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card flex flex-col items-center py-16 text-center">
          <CalendarDays size={32} className="text-muted mb-3" />
          <p className="text-sm font-semibold text-white mb-1">
            {tab === 'portfolio' ? 'No upcoming earnings for your holdings' :
             tab === 'watchlist' ? 'No upcoming earnings for your watchlist' :
             'No buzz earnings found'}
          </p>
          <p className="text-xs text-secondary">Check back — calendar updates daily.</p>
        </div>
      ) : (
        <div className="space-y-2">

          {/* ── Special note for buzz ── */}
          {tab === 'buzz' && (
            <div className="card border border-accent-yellow/20 bg-accent-yellow/5 p-3">
              <p className="text-xs text-accent-yellow">
                ⚠️ Market Buzz includes all major companies for awareness — including non-halal ones.
                Always check halal status before considering any position.
              </p>
            </div>
          )}

          {/* ── Table ── */}
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2">
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted uppercase tracking-wide">Date</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted uppercase tracking-wide">Ticker</th>
                    {tab === 'portfolio' && (
                      <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted uppercase tracking-wide">You Hold</th>
                    )}
                    {tab === 'buzz' && (
                      <th className="text-center px-4 py-3 text-[10px] font-semibold text-muted uppercase tracking-wide">Halal</th>
                    )}
                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted uppercase tracking-wide">EPS Est.</th>
                    <th className="text-center px-4 py-3 text-[10px] font-semibold text-muted uppercase tracking-wide">When</th>
                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted uppercase tracking-wide">Avg Move</th>
                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted uppercase tracking-wide">Days Away</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row: any, i: number) => {
                    const days      = daysUntil(row.date);
                    const urgent    = days <= 7;
                    const halalCfg  = row.halal_status ? HALAL_CONFIG[row.halal_status] : null;
                    const hourCfg   = HOUR_CONFIG[row.hour] ?? HOUR_CONFIG['During'];
                    return (
                      <tr
                        key={i}
                        className={`border-b border-border/50 hover:bg-surface-2 transition-colors ${
                          urgent ? 'bg-accent-yellow/3' : ''
                        }`}
                      >
                        {/* Date */}
                        <td className="px-4 py-3">
                          <p className="text-xs font-medium text-white">{formatDate(row.date)}</p>
                          {row.quarter && (
                            <p className="text-[10px] text-muted">{row.quarter}</p>
                          )}
                        </td>

                        {/* Ticker */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-surface-3 flex items-center justify-center border border-border">
                              <span className="text-[9px] font-mono font-bold text-accent-green">
                                {row.ticker.slice(0, 2)}
                              </span>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white font-mono">{row.ticker}</p>
                              {tab === 'buzz' && row.in_portfolio && (
                                <p className="text-[9px] text-accent-green">In portfolio</p>
                              )}
                              {tab === 'buzz' && row.in_watchlist && !row.in_portfolio && (
                                <p className="text-[9px] text-accent-blue">On watchlist</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Portfolio: shares held */}
                        {tab === 'portfolio' && (
                          <td className="px-4 py-3 text-right">
                            <p className="text-xs font-mono text-white">{row.shares} sh</p>
                            <p className="text-[10px] text-muted">
                              @ ${parseFloat(row.buy_price ?? 0).toFixed(2)}
                            </p>
                          </td>
                        )}

                        {/* Buzz: halal status */}
                        {tab === 'buzz' && (
                          <td className="px-4 py-3 text-center">
                            {halalCfg ? (
                              <span className={`text-xs ${halalCfg.color}`}>
                                {halalCfg.icon}
                              </span>
                            ) : '—'}
                          </td>
                        )}

                        {/* EPS estimate */}
                        <td className="px-4 py-3 text-right">
                          <p className="text-xs font-mono text-white">
                            {row.eps_estimate != null ? `$${row.eps_estimate.toFixed(2)}` : '—'}
                          </p>
                        </td>

                        {/* When (before/after market) */}
                        <td className="px-4 py-3 text-center">
                          <span className={`text-[10px] font-medium ${hourCfg.color}`}>
                            {row.hour}
                          </span>
                        </td>

                        {/* Avg move */}
                        <td className="px-4 py-3 text-right">
                          <span className="text-xs font-mono text-accent-yellow">
                            {row.avg_move}
                          </span>
                        </td>

                        {/* Days away */}
                        <td className="px-4 py-3 text-right">
                          <span className={`text-xs font-mono font-bold ${
                            days <= 3  ? 'text-accent-red' :
                            days <= 7  ? 'text-accent-yellow' :
                            days <= 14 ? 'text-accent-green' :
                            'text-muted'
                          }`}>
                            {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days}d`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-[10px] text-muted text-center">
            Earnings dates from Finnhub · May shift by ±1 day · Avg move estimates are historical approximations
          </p>
        </div>
      )}
    </div>
  );
}