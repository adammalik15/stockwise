'use client';

import { useEffect, useState, useCallback } from 'react';
import StockCard from '@/components/stock/StockCard';
import StockSearch from '@/components/stock/StockSearch';
import { Briefcase, Download, Loader2, TrendingUp, Layers, BarChart2, Package, Brain, Zap } from 'lucide-react';

const SECTIONS = [
  { key: 'long',      label: 'Long-Term Stocks', icon: TrendingUp,  color: 'text-accent-green',  matchTerm: (h: any) => h.asset_type === 'stock' && h.term !== 'short' },
  { key: 'short',     label: 'Short-Term Stocks', icon: BarChart2,   color: 'text-accent-yellow', matchTerm: (h: any) => h.asset_type === 'stock' && h.term === 'short' },
  { key: 'etf',       label: 'ETFs',              icon: Layers,      color: 'text-accent-blue',   matchTerm: (h: any) => h.asset_type === 'etf' },
  { key: 'commodity', label: 'Commodities',       icon: Package,     color: 'text-accent-purple', matchTerm: (h: any) => h.asset_type === 'commodity' || h.asset_type === 'crypto' },
];

interface UsageData {
  recommendation: { used: number; limit: number };
  goal_analysis:  { used: number; limit: number };
}

export default function DashboardPage() {
  const [holdings, setHoldings] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [usage, setUsage]       = useState<UsageData | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res  = await fetch('/api/portfolio');
    const data = await res.json();
    setHoldings(data.holdings ?? []);
    setLoading(false);
  }, []);

  // Fetch today's AI usage from Supabase via a lightweight endpoint
  const loadUsage = useCallback(async () => {
    try {
      const res  = await fetch('/api/usage');
      if (!res.ok) return;
      const data = await res.json();
      setUsage(data);
    } catch { /* silent — usage widget is non-critical */ }
  }, []);

  useEffect(() => { load(); loadUsage(); }, [load, loadUsage]);

  async function remove(id: string) {
    await fetch('/api/portfolio', { method: 'DELETE', body: JSON.stringify({ id }) });
    setHoldings(p => p.filter(h => h.id !== id));
  }

  function exportCSV() {
    const headers = ['Ticker', 'Type', 'Term', 'Shares', 'Avg Buy Price', 'Date', 'Current Price', 'Value', 'P&L', 'Return%'];
    const rows = holdings.map(h => [
      h.ticker, h.asset_type, h.term ?? 'long', h.quantity, h.purchase_price,
      h.purchase_date, h.stock_data?.price ?? '',
      h.current_value?.toFixed(2)    ?? '',
      h.gain_loss?.toFixed(2)        ?? '',
      h.gain_loss_percent?.toFixed(2) ?? '',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'portfolio.csv';
    a.click();
  }

  const totalValue = holdings.reduce((s, h) => s + (h.current_value ?? 0), 0);
  const totalCost  = holdings.reduce((s, h) => s + h.purchase_price * h.quantity, 0);
  const totalGL    = totalValue - totalCost;
  const totalGLPct = totalCost > 0 ? (totalGL / totalCost) * 100 : 0;
  const isPos      = totalGL >= 0;

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

  return (
    <div className="space-y-6 page-enter">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-secondary text-sm mt-0.5">
            {holdings.length} holding{holdings.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {holdings.length > 0 && (
            <button onClick={exportCSV} className="btn-secondary flex items-center gap-2">
              <Download size={14} /> Export CSV
            </button>
          )}
          <StockSearch placeholder="Add stock…" />
        </div>
      </div>

      {/* AI Usage Banner */}
      {usage && (
        <div className="card border border-accent-purple/20 bg-accent-purple/5">
          <div className="flex items-center gap-2 mb-3">
            <Brain size={14} className="text-accent-purple" />
            <p className="text-sm font-semibold text-white">AI Usage Today</p>
            <span className="badge bg-accent-purple/15 text-accent-purple text-[10px]">Resets at midnight</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Recommendations */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Zap size={11} className="text-accent-purple" />
                  <p className="text-xs text-secondary">Stock Recommendations</p>
                </div>
                <p className={`text-xs font-semibold font-mono ${usageTextColor(usage.recommendation.used, usage.recommendation.limit)}`}>
                  {usage.recommendation.used} / {usage.recommendation.limit}
                </p>
              </div>
              <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${usageBarColor(usage.recommendation.used, usage.recommendation.limit)}`}
                  style={{ width: Math.min(100, (usage.recommendation.used / usage.recommendation.limit) * 100) + '%' }}
                />
              </div>
              <p className="text-[10px] text-muted mt-1">
                {usage.recommendation.limit - usage.recommendation.used} remaining
              </p>
            </div>

            {/* Goal Analysis */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Zap size={11} className="text-accent-purple" />
                  <p className="text-xs text-secondary">Goal Strategies</p>
                </div>
                <p className={`text-xs font-semibold font-mono ${usageTextColor(usage.goal_analysis.used, usage.goal_analysis.limit)}`}>
                  {usage.goal_analysis.used} / {usage.goal_analysis.limit}
                </p>
              </div>
              <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${usageBarColor(usage.goal_analysis.used, usage.goal_analysis.limit)}`}
                  style={{ width: Math.min(100, (usage.goal_analysis.used / usage.goal_analysis.limit) * 100) + '%' }}
                />
              </div>
              <p className="text-[10px] text-muted mt-1">
                {usage.goal_analysis.limit - usage.goal_analysis.used} remaining
              </p>
            </div>

          </div>
        </div>
      )}

      {/* Summary stats */}
      {holdings.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Value', value: '$' + totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
            { label: 'Total Cost',  value: '$' + totalCost.toLocaleString(undefined,  { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
            { label: 'Total P&L',   value: (isPos ? '+' : '') + '$' + Math.abs(totalGL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), positive: isPos },
            { label: 'Return',      value: (isPos ? '+' : '') + totalGLPct.toFixed(2) + '%', positive: isPos },
          ].map(s => (
            <div key={s.label} className="card">
              <p className="label mb-1.5">{s.label}</p>
              <p className={'stat-value ' + (s.positive === undefined ? 'text-white' : s.positive ? 'text-accent-green' : 'text-accent-red')}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Holdings */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={22} className="animate-spin text-accent-green" />
        </div>
      ) : holdings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Briefcase size={40} className="text-muted mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">No holdings yet</h2>
          <p className="text-secondary text-sm max-w-xs">
            Search for a stock above and click + to add it.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {SECTIONS.map(section => {
            const items = holdings.filter(section.matchTerm);
            if (items.length === 0) return null;
            const Icon = section.icon;
            return (
              <div key={section.key}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon size={15} className={section.color} />
                  <h2 className="text-sm font-semibold text-white">{section.label}</h2>
                  <span className="text-xs text-muted">({items.length})</span>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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