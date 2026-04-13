'use client';

import { useEffect, useState, useCallback } from 'react';
import StockCard from '@/components/stock/StockCard';
import StockSearch from '@/components/stock/StockSearch';
import {
  Briefcase, Download, Loader2, TrendingUp, Layers,
  BarChart2, Package, Brain, Zap, ShieldCheck,
  ShieldAlert, ShieldX, RefreshCw
} from 'lucide-react';

const SECTIONS = [
  { key: 'long',      label: 'Long-Term',   icon: TrendingUp, color: 'text-accent-green',  match: (h: any) => h.asset_type === 'stock' && h.term !== 'short' },
  { key: 'short',     label: 'Short-Term',  icon: BarChart2,  color: 'text-accent-yellow', match: (h: any) => h.asset_type === 'stock' && h.term === 'short' },
  { key: 'etf',       label: 'ETFs',        icon: Layers,     color: 'text-accent-blue',   match: (h: any) => h.asset_type === 'etf' },
  { key: 'commodity', label: 'Commodities', icon: Package,    color: 'text-accent-purple', match: (h: any) => h.asset_type === 'commodity' || h.asset_type === 'crypto' },
];

interface UsageData {
  recommendation: { used: number; limit: number };
  goal_analysis:  { used: number; limit: number };
}

interface MarketConditions {
  status: 'favorable' | 'cautious' | 'unfavorable' | 'closed';
  status_label: string;
  reasons: string[];
  guidance: string;
  your_stocks: { favorable: string[]; avoid: string[]; neutral: string[] };
  generated_at: string;
}

const STATUS_CONFIG = {
  favorable:   { bg: 'bg-accent-green/10 border-accent-green/20',   icon: ShieldCheck, iconColor: 'text-accent-green',  dot: 'bg-accent-green'  },
  cautious:    { bg: 'bg-accent-yellow/10 border-accent-yellow/20', icon: ShieldAlert, iconColor: 'text-accent-yellow', dot: 'bg-accent-yellow' },
  unfavorable: { bg: 'bg-accent-red/10 border-accent-red/20',       icon: ShieldX,     iconColor: 'text-accent-red',    dot: 'bg-accent-red'    },
  closed:      { bg: 'bg-surface-2 border-border',                  icon: ShieldCheck, iconColor: 'text-muted',         dot: 'bg-muted'         },
};

export default function DashboardPage() {
  const [holdings, setHoldings]               = useState<any[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [usage, setUsage]                     = useState<UsageData | null>(null);
  const [conditions, setConditions]           = useState<MarketConditions | null>(null);
  const [conditionsLoading, setConditionsLoading] = useState(true);

  // ── Load portfolio ──
  const load = useCallback(async () => {
    setLoading(true);
    const res  = await fetch('/api/portfolio');
    const data = await res.json();
    setHoldings(data.holdings ?? []);
    setLoading(false);
  }, []);

  // ── Load AI usage ──
  const loadUsage = useCallback(async () => {
    try {
      const res  = await fetch('/api/usage');
      if (!res.ok) return;
      const data = await res.json();
      setUsage(data);
    } catch { /* silent */ }
  }, []);

  // ── Load market conditions ──
  const loadConditions = useCallback(async () => {
    setConditionsLoading(true);
    try {
      const res  = await fetch('/api/market-conditions');
      if (!res.ok) return;
      const data = await res.json();
      setConditions(data);
    } catch { /* silent */ }
    finally { setConditionsLoading(false); }
  }, []);

  useEffect(() => {
    load();
    loadUsage();
    loadConditions();
  }, [load, loadUsage, loadConditions]);

  async function remove(id: string) {
    await fetch('/api/portfolio', { method: 'DELETE', body: JSON.stringify({ id }) });
    setHoldings(p => p.filter(h => h.id !== id));
  }

  function exportCSV() {
    const headers = ['Ticker','Type','Term','Shares','Avg Buy Price','Date','Current Price','Value','P&L','Return%'];
    const rows = holdings.map(h => [
      h.ticker, h.asset_type, h.term ?? 'long', h.quantity, h.purchase_price,
      h.purchase_date, h.stock_data?.price ?? '',
      h.current_value?.toFixed(2)     ?? '',
      h.gain_loss?.toFixed(2)         ?? '',
      h.gain_loss_percent?.toFixed(2) ?? '',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'portfolio.csv';
    a.click();
  }

  const totalValue  = holdings.reduce((s, h) => s + (h.current_value ?? 0), 0);
  const totalCost   = holdings.reduce((s, h) => s + h.purchase_price * h.quantity, 0);
  const totalGL     = totalValue - totalCost;
  const totalGLPct  = totalCost > 0 ? (totalGL / totalCost) * 100 : 0;
  const isPos       = totalGL >= 0;

  function usageBarColor(used: number, limit: number) {
    const pct = (used / limit) * 100;
    if (pct >= 100) return 'bg-accent-red';
    if (pct >= 70)  return 'bg-accent-yellow';
    return 'bg-accent-green';
  }

  function usageTextColor(used: number, limit: number) {
    const pct = (used / limit) * 100;
    if (pct >= 100) return 'text-accent-red';
    if (pct >= 70)  return 'text-accent-yellow';
    return 'text-accent-green';
  }

  const cfg = conditions ? STATUS_CONFIG[conditions.status] : null;
  const StatusIcon = cfg?.icon;

  return (
    <div className="space-y-4 page-enter">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-secondary text-sm mt-0.5">
            {holdings.length} holding{holdings.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {holdings.length > 0 && (
            <button onClick={exportCSV} className="btn-secondary flex items-center gap-2">
              <Download size={13} /> Export CSV
            </button>
          )}
          <StockSearch placeholder="Add stock…" />
        </div>
      </div>

      {/* ── No-Trade Filter / Market Conditions ── */}
      {conditionsLoading ? (
        <div className="card border border-border flex items-center gap-3 py-3">
          <Loader2 size={14} className="animate-spin text-muted shrink-0" />
          <p className="text-xs text-muted">Analysing today's market conditions…</p>
        </div>
      ) : conditions && cfg ? (
        <div className={`card border ${cfg.bg} p-4`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {StatusIcon && <StatusIcon size={18} className={`${cfg.iconColor} mt-0.5 shrink-0`} />}
              <div>
                <p className="text-sm font-semibold text-white">{conditions.status_label}</p>
                <p className="text-xs text-secondary mt-0.5 leading-relaxed">{conditions.guidance}</p>
              </div>
            </div>
            <button
              onClick={loadConditions}
              className="p-1.5 rounded-lg hover:bg-surface-3 text-muted hover:text-white transition-colors shrink-0"
              title="Refresh"
            >
              <RefreshCw size={12} />
            </button>
          </div>

          {/* Reasons */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {conditions.reasons.map((r, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-surface-3 border border-border text-secondary">
                {r}
              </span>
            ))}
          </div>

          {/* Your stocks assessment */}
          {(conditions.your_stocks.favorable.length > 0 ||
            conditions.your_stocks.avoid.length > 0 ||
            conditions.your_stocks.neutral.length > 0) && (
            <div className="mt-3 pt-3 border-t border-border grid grid-cols-3 gap-3 text-center">
              {conditions.your_stocks.favorable.length > 0 && (
                <div>
                  <p className="text-[9px] text-accent-green uppercase tracking-wide mb-1">Favorable</p>
                  <div className="flex flex-wrap justify-center gap-1">
                    {conditions.your_stocks.favorable.map(t => (
                      <span key={t} className="text-[10px] font-mono font-bold text-accent-green bg-accent-green/10 px-1.5 py-0.5 rounded">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {conditions.your_stocks.neutral.length > 0 && (
                <div>
                  <p className="text-[9px] text-muted uppercase tracking-wide mb-1">Neutral</p>
                  <div className="flex flex-wrap justify-center gap-1">
                    {conditions.your_stocks.neutral.map(t => (
                      <span key={t} className="text-[10px] font-mono font-bold text-secondary bg-surface-3 px-1.5 py-0.5 rounded">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {conditions.your_stocks.avoid.length > 0 && (
                <div>
                  <p className="text-[9px] text-accent-red uppercase tracking-wide mb-1">Avoid Today</p>
                  <div className="flex flex-wrap justify-center gap-1">
                    {conditions.your_stocks.avoid.map(t => (
                      <span key={t} className="text-[10px] font-mono font-bold text-accent-red bg-accent-red/10 px-1.5 py-0.5 rounded">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <p className="text-[9px] text-muted mt-2">
            Generated {new Date(conditions.generated_at).toLocaleTimeString()} · Powered by Claude AI
          </p>
        </div>
      ) : null}

      {/* ── AI Usage Banner ── */}
      {usage && (
        <div className="card border border-accent-purple/20 bg-accent-purple/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Brain size={13} className="text-accent-purple" />
            <p className="text-xs font-semibold text-white">AI Usage Today</p>
            <span className="badge bg-accent-purple/15 text-accent-purple text-[9px]">Resets midnight</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Recommendations', data: usage.recommendation },
              { label: 'Goal Strategies',  data: usage.goal_analysis  },
            ].map(({ label, data }) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1">
                    <Zap size={9} className="text-accent-purple" />
                    <p className="text-[10px] text-secondary">{label}</p>
                  </div>
                  <p className={`text-[10px] font-semibold font-mono ${usageTextColor(data.used, data.limit)}`}>
                    {data.used}/{data.limit}
                  </p>
                </div>
                <div className="h-1 bg-surface-3 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${usageBarColor(data.used, data.limit)}`}
                    style={{ width: Math.min(100, (data.used / data.limit) * 100) + '%' }}
                  />
                </div>
                <p className="text-[9px] text-muted mt-0.5">{data.limit - data.used} remaining</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Summary Stats ── */}
      {holdings.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Total Value', value: '$' + totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
            { label: 'Total Cost',  value: '$' + totalCost.toLocaleString(undefined,  { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
            { label: 'Total P&L',   value: (isPos ? '+$' : '-$') + Math.abs(totalGL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), positive: isPos },
            { label: 'Return',      value: (isPos ? '+' : '') + totalGLPct.toFixed(2) + '%', positive: isPos },
          ].map(s => (
            <div key={s.label} className="card p-3">
              <p className="label mb-1 text-[10px]">{s.label}</p>
              <p className={`text-base font-mono font-semibold ${s.positive === undefined ? 'text-white' : s.positive ? 'text-accent-green' : 'text-accent-red'}`}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── Holdings ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={20} className="animate-spin text-accent-green" />
        </div>
      ) : holdings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Briefcase size={36} className="text-muted mb-3" />
          <h2 className="text-base font-semibold text-white mb-1">No holdings yet</h2>
          <p className="text-secondary text-sm">Search for a stock above and click + to add it.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {SECTIONS.map(section => {
            const items = holdings.filter(section.match);
            if (items.length === 0) return null;
            const Icon = section.icon;
            return (
              <div key={section.key}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={13} className={section.color} />
                  <h2 className="text-xs font-semibold text-white uppercase tracking-wide">{section.label}</h2>
                  <span className="text-[10px] text-muted">({items.length})</span>
                </div>
                {/* ── Compact dense grid ── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                  {items.map(item => (
                    <StockCard
                      key={item.id}
                      item={item}
                      mode="portfolio"
                      onRemove={() => remove(item.id)}
                      onEdit={undefined}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}