'use client';

import Link from 'next/link';
import { TrendingUp, TrendingDown, Trash2, AlertCircle, Pencil } from 'lucide-react';
import { formatMarketCap, formatPrice, formatPercent } from '@/lib/utils';
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
  const stock = item.stock_data;
  const isPos = (stock?.change_percent ?? 0) >= 0;
  const watchItem = !isPortfolio(item) ? (item as WatchlistItem) : null;
  const fiftyTwoPct =
    stock?.fifty_two_week_high && stock?.fifty_two_week_low && stock?.price
      ? ((stock.price - stock.fifty_two_week_low) /
          (stock.fifty_two_week_high - stock.fifty_two_week_low)) *
        100
      : null;

  return (
    <div className="card-hover group relative flex flex-col">
      {/* Action buttons top-right */}
      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        {onEdit && (
          <button
            onClick={e => { e.preventDefault(); onEdit(); }}
            className="p-1.5 rounded-lg bg-surface-3 hover:bg-accent-green/20 text-muted hover:text-accent-green transition-colors"
            title="Update position"
          >
            <Pencil size={12} />
          </button>
        )}
        {onRemove && (
          <button
            onClick={e => { e.preventDefault(); onRemove(); }}
            className="p-1.5 rounded-lg bg-surface-3 hover:bg-accent-red/20 text-muted hover:text-accent-red transition-colors"
            title="Remove"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {/* Target price alert badge */}
      {watchItem?.at_target && (
        <div className="absolute top-3 left-3">
          <span className="badge-yellow text-[10px]">
            <AlertCircle size={10} /> At Target
          </span>
        </div>
      )}

      <Link href={`/stock/${item.ticker}`} className="flex flex-col flex-1">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3 pr-14">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface-3 flex items-center justify-center shrink-0 border border-border">
              <span className="text-xs font-mono font-bold text-accent-green">
                {item.ticker.slice(0, 2)}
              </span>
            </div>
            <div>
              <p className="font-semibold text-white text-sm">{item.ticker}</p>
              <p className="text-xs text-secondary line-clamp-1 max-w-[120px]">
                {stock?.name ?? item.ticker}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-mono font-semibold text-white text-sm">
              {stock?.price ? formatPrice(stock.price) : '—'}
            </p>
            <div
              className={`flex items-center gap-1 justify-end text-xs ${
                isPos ? 'text-accent-green' : 'text-accent-red'
              }`}
            >
              {isPos ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              <span>{stock ? formatPercent(stock.change_percent) : '—'}</span>
            </div>
          </div>
        </div>

        {/* Portfolio P&L */}
        {mode === 'portfolio' && isPortfolio(item) && (
          <div className="flex items-center justify-between mb-3 p-2.5 bg-surface-3 rounded-lg">
            <div>
              <p className="text-[10px] text-muted uppercase mb-0.5">Shares</p>
              <p className="text-xs font-mono font-semibold text-white">
                {item.quantity}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted uppercase mb-0.5">Value</p>
              <p className="text-xs font-mono font-semibold text-white">
                {item.current_value ? formatPrice(item.current_value) : '—'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted uppercase mb-0.5">Return</p>
              <p
                className={`text-xs font-mono font-semibold ${
                  (item.gain_loss_percent ?? 0) >= 0
                    ? 'text-accent-green'
                    : 'text-accent-red'
                }`}
              >
                {item.gain_loss_percent != null
                  ? `${item.gain_loss_percent >= 0 ? '+' : ''}${item.gain_loss_percent.toFixed(2)}%`
                  : '—'}
              </p>
            </div>
          </div>
        )}

        {/* Watchlist target price */}
        {watchItem?.target_price && (
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-secondary">Target</p>
            <p className="text-xs font-mono font-medium text-accent-yellow">
              {formatPrice(watchItem.target_price)}
            </p>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-2 mt-auto">
          <div>
            <p className="text-[10px] text-muted uppercase mb-0.5">Mkt Cap</p>
            <p className="text-xs font-mono text-secondary">
              {formatMarketCap(stock?.market_cap)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted uppercase mb-0.5">P/E</p>
            <p className="text-xs font-mono text-secondary">
              {stock?.pe_ratio ? stock.pe_ratio.toFixed(1) : 'N/A'}
            </p>
          </div>
        </div>

        {/* 52W range bar */}
        {fiftyTwoPct !== null && (
          <div className="mt-3">
            <div className="flex justify-between text-[10px] text-muted mb-1">
              <span>{formatPrice(stock?.fifty_two_week_low)}</span>
              <span>52W</span>
              <span>{formatPrice(stock?.fifty_two_week_high)}</span>
            </div>
            <div className="h-1 bg-surface-3 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent-green rounded-full"
                style={{
                  width: Math.min(100, Math.max(0, fiftyTwoPct)) + '%',
                }}
              />
            </div>
          </div>
        )}

        {/* Sector badge */}
        {stock?.sector && (
          <div className="mt-3">
            <span className="badge-neutral text-[10px]">{stock.sector}</span>
          </div>
        )}
      </Link>
    </div>
  );
}
