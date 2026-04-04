'use client';

import { useEffect, useState } from 'react';
import { Briefcase, ArrowDownLeft, ArrowUpRight, Hash, Clock } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

interface Holding {
  quantity: number;
  purchase_price: number;
  purchase_date: string;
  term?: string;
  notes?: string;
}

interface Transaction {
  id: string;
  type: 'buy' | 'sell' | 'set';
  quantity: number;
  price: number;
  date: string;
  notes?: string;
  created_at: string;
}

const txIcon = { buy: ArrowDownLeft, sell: ArrowUpRight, set: Hash };
const txColor = { buy: 'text-accent-green', sell: 'text-accent-red', set: 'text-accent-blue' };
const txLabel = { buy: 'Buy', sell: 'Sell', set: 'Set' };

export default function PortfolioPositionPanel({ ticker, currentPrice }: { ticker: string; currentPrice: number }) {
  const [holding, setHolding] = useState<Holding | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/stocks/${ticker}/position`)
      .then(r => r.json())
      .then(d => {
        setHolding(d.holding ?? null);
        setTransactions(d.transactions ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading || !holding) return null;

  const currentValue = holding.quantity * currentPrice;
  const totalCost = holding.quantity * holding.purchase_price;
  const gainLoss = currentValue - totalCost;
  const gainLossPct = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0;
  const isPos = gainLoss >= 0;

  return (
    <div className="card space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Briefcase size={15} className="text-accent-green shrink-0" />
        <p className="text-sm font-semibold text-white">Your Position</p>
        {holding.term && (
          <span className={`badge text-[10px] ${holding.term === 'short' ? 'bg-accent-yellow/15 text-accent-yellow' : 'bg-accent-green/15 text-accent-green'}`}>
            {holding.term === 'short' ? 'Short-Term' : 'Long-Term'}
          </span>
        )}
      </div>

      {/* Position summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 bg-surface-2 rounded-xl">
          <p className="text-[10px] text-muted uppercase tracking-wide mb-1">Shares</p>
          <p className="font-mono font-semibold text-white text-sm">{holding.quantity}</p>
        </div>
        <div className="p-3 bg-surface-2 rounded-xl">
          <p className="text-[10px] text-muted uppercase tracking-wide mb-1">Current Value</p>
          <p className="font-mono font-semibold text-white text-sm">{formatPrice(currentValue)}</p>
        </div>
        <div className="p-3 bg-surface-2 rounded-xl">
          <p className="text-[10px] text-muted uppercase tracking-wide mb-1">Avg Cost / Share</p>
          <p className="font-mono font-semibold text-white text-sm">{formatPrice(holding.purchase_price)}</p>
        </div>
      </div>

      {/* P&L */}
      <div className={`flex items-center justify-between p-3 rounded-xl border ${isPos ? 'bg-accent-green/8 border-accent-green/20' : 'bg-accent-red/8 border-accent-red/20'}`}>
        <div>
          <p className="text-[10px] text-muted uppercase tracking-wide mb-0.5">Total Cost</p>
          <p className="font-mono text-xs text-secondary">{formatPrice(totalCost)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted uppercase tracking-wide mb-0.5">Unrealised P&L</p>
          <p className={`font-mono font-semibold text-sm ${isPos ? 'text-accent-green' : 'text-accent-red'}`}>
            {isPos ? '+' : ''}{formatPrice(gainLoss)} ({isPos ? '+' : ''}{gainLossPct.toFixed(2)}%)
          </p>
        </div>
      </div>

      {/* Transaction history */}
      {transactions.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <Clock size={12} className="text-muted" />
            <p className="text-xs font-semibold text-white">Transaction History</p>
          </div>
          <div className="space-y-2">
            {transactions.map(tx => {
              const Icon = txIcon[tx.type] ?? Hash;
              return (
                <div key={tx.id} className="flex items-center gap-3 p-2.5 bg-surface-2 rounded-xl">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${tx.type === 'buy' ? 'bg-accent-green/15' : tx.type === 'sell' ? 'bg-accent-red/15' : 'bg-accent-blue/15'}`}>
                    <Icon size={13} className={txColor[tx.type]} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${txColor[tx.type]}`}>{txLabel[tx.type]}</span>
                      <span className="text-xs text-white font-mono">{tx.quantity} @ {formatPrice(tx.price)}</span>
                    </div>
                    {tx.notes && <p className="text-[10px] text-muted truncate">{tx.notes}</p>}
                  </div>
                  <p className="text-[10px] text-muted shrink-0">
                    {new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {transactions.length === 0 && (
        <p className="text-xs text-muted">No transaction history recorded yet.</p>
      )}
    </div>
  );
}
