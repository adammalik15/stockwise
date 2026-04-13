'use client';

import Link from 'next/link';
import { useState } from 'react';
import { TrendingUp, TrendingDown, Trash2, Pencil, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { formatPrice, formatPercent, formatMarketCap } from '@/lib/utils';
import type { WatchlistItem, PortfolioItem } from '@/types';

function isPortfolio(item: any): item is PortfolioItem {
  return 'quantity' in item;
}

export default function StockCard({
  item,
  mode,
  onRemove,
  onEdit,
}: {
  item: any;
  mode: 'portfolio' | 'watchlist';
  onRemove?: () => void;
  onEdit?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const stock = item.stock_data;
  const isPos = (stock?.change_percent ?? 0) >= 0;
  const isPosGL = (item.gain_loss_percent ?? 0) >= 0;
  const watchItem = !isPortfolio(item) ? (item as WatchlistItem) : null;

  const fiftyTwoPct =
    stock?.fifty_two_week_high && stock?.fifty_two_week_low && stock?.price
      ? ((stock.price - stock.fifty_two_week_low) /
          (stock.fifty_two_week_high - stock.fifty_two_week_low)) * 100
      : null;

  return (
    <div className="card group relative flex flex-col gap-0 p-3 transition-all duration-200 hover:bg-surface-2">

      {/* ── Compact Row (always visible) ── */}
      <div className="flex items-center gap-2">

        {/* Logo */}
        <div className="w-8 h-8 rounded-lg bg-surface-3 flex items-center justify-center shrink-0 border border-border">
          <span className="text-[10px] font-mono font-bold text-accent-green">
            {item.ticker.slice(0, 2)}
          </span>
        </div>

        {/* Ticker + subtitle */}
        <Link href={`/stock/${item.ticker}`} className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm leading-tight">{item.ticker}</p>
          <p className="text-[10px] text-muted truncate max-w-[100px]">
            {stock?.name ?? item.ticker}
          </p>
        </Link>

        {/* Price + change */}
        <div className="text-right shrink-0">
          <p className="font-mono font-semibold text-white text-sm leading-tight">
            {stock?.price ? formatPrice(stock.price) : '—'}
          </p>
          <div className={`flex items-center justify-end gap-0.5 text-[10px] font-mono ${isPos ? 'text-accent-green' : 'text-accent-red'}`}>
            {isPos ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
            <span>{stock ? formatPercent(stock.change_percent) : '—'}</span>
          </div>
        </div>

        {/* Actions + expand */}
        <div className="flex items-center gap-0.5 shrink-0">
          {onEdit && (
            <button
              onClick={e => { e.preventDefault(); onEdit(); }}
              className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-surface-3 text-muted hover:text-accent-green transition-all"
              title="Edit position"
            >
              <Pencil size={10} />
            </button>
          )}
          {onRemove && (
            <button
              onClick={e => { e.preventDefault(); onRemove(); }}
              className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-surface-3 text-muted hover:text-accent-red transition-all"
              title="Remove"
            >
              <Trash2 size={10} />
            </button>
          )}
          <button
            onClick={() => setExpanded(e => !e)}
            className="p-1 rounded hover:bg-surface-3 text-muted hover:text-white transition-colors"
          >
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        </div>
      </div>

      {/* ── Portfolio P&L strip (always visible for portfolio mode) ── */}
      {mode === 'portfolio' && isPortfolio(item) && (
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-muted">{item.quantity} sh · {item.current_value ? formatPrice(item.current_value) : '—'}</span>
          <span className={`text-[10px] font-mono font-semibold ${isPosGL ? 'text-accent-green' : 'text-accent-red'}`}>
            {isPosGL ? '+' : ''}{(item.gain_loss_percent ?? 0).toFixed(2)}%
          </span>
        </div>
      )}

      {/* ── Watchlist target strip ── */}
      {watchItem?.target_price && (
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-muted">Target</span>
          <div className="flex items-center gap-1">
            {watchItem.at_target && <AlertCircle size={9} className="text-accent-yellow" />}
            <span className="text-[10px] font-mono text-accent-yellow">
              {formatPrice(watchItem.target_price)}
            </span>
          </div>
        </div>
      )}

      {/* ── Expanded Details ── */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-border space-y-3">

          {/* Portfolio breakdown */}
          {mode === 'portfolio' && isPortfolio(item) && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-surface-2 rounded-lg p-2">
                <p className="text-[9px] text-muted uppercase mb-0.5">Shares</p>
                <p className="text-xs font-mono text-white">{item.quantity}</p>
              </div>
              <div className="bg-surface-2 rounded-lg p-2">
                <p className="text-[9px] text-muted uppercase mb-0.5">Value</p>
                <p className="text-xs font-mono text-white">
                  {item.current_value ? formatPrice(item.current_value) : '—'}
                </p>
              </div>
              <div className="bg-surface-2 rounded-lg p-2">
                <p className="text-[9px] text-muted uppercase mb-0.5">P&L</p>
                <p className={`text-xs font-mono ${isPosGL ? 'text-accent-green' : 'text-accent-red'}`}>
                  {item.gain_loss != null
                    ? `${item.gain_loss >= 0 ? '+' : ''}${formatPrice(Math.abs(item.gain_loss))}`
                    : '—'}
                </p>
              </div>
            </div>
          )}

          {/* Fundamentals */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[9px] text-muted uppercase mb-0.5">Market Cap</p>
              <p className="text-xs font-mono text-secondary">{formatMarketCap(stock?.market_cap)}</p>
            </div>
            <div>
              <p className="text-[9px] text-muted uppercase mb-0.5">P/E Ratio</p>
              <p className="text-xs font-mono text-secondary">
                {stock?.pe_ratio ? stock.pe_ratio.toFixed(1) : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-[9px] text-muted uppercase mb-0.5">Beta</p>
              <p className="text-xs font-mono text-secondary">
                {stock?.beta ? stock.beta.toFixed(2) : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-[9px] text-muted uppercase mb-0.5">Dividend</p>
              <p className="text-xs font-mono text-secondary">
                {stock?.dividend_yield ? (stock.dividend_yield * 100).toFixed(2) + '%' : 'None'}
              </p>
            </div>
          </div>

          {/* 52W range */}
          {fiftyTwoPct !== null && (
            <div>
              <div className="flex justify-between text-[9px] text-muted mb-1">
                <span>{formatPrice(stock?.fifty_two_week_low)}</span>
                <span>52-Week Range</span>
                <span>{formatPrice(stock?.fifty_two_week_high)}</span>
              </div>
              <div className="h-1 bg-surface-3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-green rounded-full"
                  style={{ width: Math.min(100, Math.max(0, fiftyTwoPct)) + '%' }}
                />
              </div>
            </div>
          )}

          {/* Sector + link */}
          <div className="flex items-center justify-between">
            {stock?.sector && (
              <span className="badge-neutral text-[9px]">{stock.sector}</span>
            )}
            <Link
              href={`/stock/${item.ticker}`}
              className="text-[10px] text-accent-green hover:underline ml-auto"
            >
              Full Analysis →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}