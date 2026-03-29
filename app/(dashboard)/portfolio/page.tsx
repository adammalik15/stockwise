'use client';

import { useEffect, useState, useCallback } from 'react';
import StockCard from '@/components/stock/StockCard';
import StockSearch from '@/components/stock/StockSearch';
import { Briefcase, Download, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import type { PortfolioItem } from '@/types';

export default function PortfolioPage() {
  const [holdings, setHoldings] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/portfolio');
    const data = await res.json();
    setHoldings(data.holdings ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function remove(id: string) {
    await fetch('/api/portfolio', { method: 'DELETE', body: JSON.stringify({ id }) });
    setHoldings(prev => prev.filter(h => h.id !== id));
  }

  function exportCSV() {
    const headers = ['Ticker', 'Asset Type', 'Quantity', 'Purchase Price', 'Purchase Date', 'Current Price', 'Current Value', 'Gain/Loss', 'Return %', 'Notes'];
    const rows = holdings.map(h => [
      h.ticker,
      h.asset_type,
      h.quantity,
      h.purchase_price,
      h.purchase_date,
      h.stock_data?.price ?? '',
      h.current_value?.toFixed(2) ?? '',
      h.gain_loss?.toFixed(2) ?? '',
      h.gain_loss_percent?.toFixed(2) ?? '',
      h.notes ?? '',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'portfolio.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const totalValue = holdings.reduce((s, h) => s + (h.current_value ?? 0), 0);
  const totalCost = holdings.reduce((s, h) => s + h.purchase_price * h.quantity, 0);
  const totalGainLoss = totalValue - totalCost;
  const totalGainLossPct = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;
  const isPositive = totalGainLoss >= 0;

  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display text-white">Portfolio</h1>
          <p className="text-secondary text-sm mt-0.5">{holdings.length} holding{holdings.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          {holdings.length > 0 && (
            <button onClick={exportCSV} className="btn-secondary flex items-center gap-2">
              <Download size={14} /> Export CSV
            </button>
          )}
          <StockSearch placeholder="Add stock..." />
        </div>
      </div>

      {/* Summary */}
      {holdings.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card">
            <p className="label mb-1.5">Total Value</p>
            <p className="stat-value">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="card">
            <p className="label mb-1.5">Total Cost</p>
            <p className="stat-value">${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="card">
            <p className="label mb-1.5">Total P&L</p>
            <p className={`stat-value ${isPositive ? 'text-accent-green' : 'text-accent-red'}`}>
              {isPositive ? '+' : ''}${Math.abs(totalGainLoss).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="card">
            <p className="label mb-1.5">Return</p>
            <div className={`flex items-center gap-1.5 ${isPositive ? 'text-accent-green' : 'text-accent-red'}`}>
              {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              <p className="stat-value">{isPositive ? '+' : ''}{totalGainLossPct.toFixed(2)}%</p>
            </div>
          </div>
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
            Search for a stock above and click the + button to add it to your portfolio.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {holdings.map(item => (
            <StockCard key={item.id} item={item} mode="portfolio" onRemove={() => remove(item.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
