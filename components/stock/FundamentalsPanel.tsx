'use client';

import { useState, useEffect } from 'react';
import { BarChart3, Loader2, TrendingUp, TrendingDown, Info } from 'lucide-react';

interface FundamentalsData {
  // Valuation
  pe_ratio?: number;
  forward_pe?: number;
  pb_ratio?: number;
  ps_ratio?: number;
  ev_ebitda?: number;
  peg_ratio?: number;
  // Profitability
  gross_margin?: number;
  operating_margin?: number;
  net_margin?: number;
  roe?: number;
  roa?: number;
  // Growth
  revenue_growth?: number;
  earnings_growth?: number;
  // Financial Health
  current_ratio?: number;
  debt_to_equity?: number;
  quick_ratio?: number;
  // Dividends
  dividend_yield?: number;
  payout_ratio?: number;
  // Per Share
  eps?: number;
  book_value_per_share?: number;
  revenue_per_share?: number;
}

function MetricRow({
  label,
  value,
  tooltip,
  positive,
  format = 'number',
}: {
  label: string;
  value?: number;
  tooltip?: string;
  positive?: boolean;
  format?: 'number' | 'percent' | 'ratio' | 'currency';
}) {
  function formatValue(v?: number) {
    if (v == null) return 'N/A';
    switch (format) {
      case 'percent': return (v * 100).toFixed(2) + '%';
      case 'currency': return '$' + v.toFixed(2);
      case 'ratio': return v.toFixed(2) + 'x';
      default: return v.toFixed(2);
    }
  }

  const colorClass = positive === undefined
    ? 'text-white'
    : value == null
    ? 'text-secondary'
    : positive
    ? 'text-accent-green'
    : 'text-accent-red';

  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-secondary">{label}</span>
      </div>
      <span className={`text-xs font-mono font-semibold ${colorClass}`}>
        {formatValue(value)}
      </span>
    </div>
  );
}

export default function FundamentalsPanel({ ticker }: { ticker: string }) {
  const [data, setData] = useState<FundamentalsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<'valuation' | 'profitability' | 'health' | 'pershare'>('valuation');

  useEffect(() => {
    fetch(`/api/stocks/${ticker}/fundamentals`)
      .then(r => r.json())
      .then(d => setData(d.fundamentals ?? null))
      .finally(() => setLoading(false));
  }, [ticker]);

  const sections = [
    { key: 'valuation', label: 'Valuation' },
    { key: 'profitability', label: 'Profitability' },
    { key: 'health', label: 'Health' },
    { key: 'pershare', label: 'Per Share' },
  ] as const;

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={15} className="text-accent-yellow" />
        <p className="text-sm font-semibold text-white">Fundamental Analysis</p>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {sections.map(s => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              section === s.key
                ? 'bg-accent-yellow/15 text-accent-yellow'
                : 'text-secondary hover:text-white hover:bg-surface-2'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={20} className="animate-spin text-accent-yellow" />
        </div>
      ) : !data ? (
        <p className="text-sm text-secondary py-4 text-center">
          No fundamental data available.
        </p>
      ) : (
        <div>
          {section === 'valuation' && (
            <div>
              <MetricRow label="P/E Ratio (TTM)" value={data.pe_ratio} format="number" />
              <MetricRow label="Forward P/E" value={data.forward_pe} format="number" />
              <MetricRow label="Price/Book" value={data.pb_ratio} format="number" />
              <MetricRow label="Price/Sales" value={data.ps_ratio} format="number" />
              <MetricRow label="EV/EBITDA" value={data.ev_ebitda} format="number" />
              <MetricRow label="PEG Ratio" value={data.peg_ratio} format="number" />
            </div>
          )}
          {section === 'profitability' && (
            <div>
              <MetricRow label="Gross Margin" value={data.gross_margin} format="percent" positive={data.gross_margin != null && data.gross_margin > 0.2} />
              <MetricRow label="Operating Margin" value={data.operating_margin} format="percent" positive={data.operating_margin != null && data.operating_margin > 0} />
              <MetricRow label="Net Profit Margin" value={data.net_margin} format="percent" positive={data.net_margin != null && data.net_margin > 0} />
              <MetricRow label="Return on Equity" value={data.roe} format="percent" positive={data.roe != null && data.roe > 0.1} />
              <MetricRow label="Return on Assets" value={data.roa} format="percent" positive={data.roa != null && data.roa > 0.05} />
              <MetricRow label="Revenue Growth (YoY)" value={data.revenue_growth} format="percent" positive={data.revenue_growth != null && data.revenue_growth > 0} />
              <MetricRow label="Earnings Growth (YoY)" value={data.earnings_growth} format="percent" positive={data.earnings_growth != null && data.earnings_growth > 0} />
            </div>
          )}
          {section === 'health' && (
            <div>
              <MetricRow label="Current Ratio" value={data.current_ratio} format="ratio" positive={data.current_ratio != null && data.current_ratio > 1.5} />
              <MetricRow label="Quick Ratio" value={data.quick_ratio} format="ratio" positive={data.quick_ratio != null && data.quick_ratio > 1} />
              <MetricRow label="Debt/Equity" value={data.debt_to_equity} format="ratio" positive={data.debt_to_equity != null && data.debt_to_equity < 1} />
              <MetricRow label="Dividend Yield" value={data.dividend_yield} format="percent" />
              <MetricRow label="Payout Ratio" value={data.payout_ratio} format="percent" positive={data.payout_ratio != null && data.payout_ratio < 0.8} />
            </div>
          )}
          {section === 'pershare' && (
            <div>
              <MetricRow label="EPS (TTM)" value={data.eps} format="currency" positive={data.eps != null && data.eps > 0} />
              <MetricRow label="Book Value/Share" value={data.book_value_per_share} format="currency" />
              <MetricRow label="Revenue/Share" value={data.revenue_per_share} format="currency" />
            </div>
          )}

          <div className="mt-4 p-3 bg-surface-2 rounded-lg">
            <p className="text-[10px] text-muted">
              🟢 Green = healthy range · 🔴 Red = potentially concerning · Data from Finnhub financial reports
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
