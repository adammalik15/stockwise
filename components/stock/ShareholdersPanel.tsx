'use client';

import { useState, useEffect } from 'react';
import { Users, Loader2, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';

interface Transaction {
  name: string;
  shares: number;
  value: number;
  transaction_type: string;
  date: string;
}

export default function ShareholdersPanel({ ticker }: { ticker: string }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/stocks/${ticker}/shareholders`)
      .then(r => r.json())
      .then(d => setTransactions(d.transactions ?? []))
      .finally(() => setLoading(false));
  }, [ticker]);

  function formatShares(n: number) {
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toLocaleString();
  }

  function formatValue(n: number) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n.toLocaleString();
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users size={15} className="text-accent-blue" />
          <p className="text-sm font-semibold text-white">Insider Transactions</p>
          <span className="badge-blue text-[10px]">SEC Form 4</span>
        </div>
        
        <a
          href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${ticker}&type=13F&dateb=&owner=include&count=10`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-accent-blue hover:underline">
          <span>Full 13F filings</span>
          <ExternalLink size={11} />
        </a>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={20} className="animate-spin text-accent-blue" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-6 space-y-3">
          <p className="text-sm text-secondary">
            No recent insider transactions found for {ticker}.
          </p>
          
          <a
            href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${ticker}&type=4&dateb=&owner=include&count=10`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-accent-blue hover:underline"
          >
            <span>Search SEC EDGAR directly</span>
            <ExternalLink size={11} />
          </a>
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx, i) => (
            <div key={i} className="flex items-center justify-between gap-3 p-3 bg-surface-2 rounded-xl">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  tx.transaction_type === 'Purchase'
                    ? 'bg-accent-green/20'
                    : 'bg-accent-red/20'
                }`}>
                  {tx.transaction_type === 'Purchase'
                    ? <TrendingUp size={13} className="text-accent-green" />
                    : <TrendingDown size={13} className="text-accent-red" />
                  }
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{tx.name}</p>
                  <p className="text-xs text-secondary">
                    {tx.transaction_type}
                    {tx.date
                      ? ' · ' + new Date(tx.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : ''}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-sm font-mono font-semibold ${
                  tx.transaction_type === 'Purchase'
                    ? 'text-accent-green'
                    : 'text-accent-red'
                }`}>
                  {tx.transaction_type === 'Purchase' ? '+' : '-'}{formatShares(tx.shares)}
                </p>
                {tx.value > 0 && (
                  <p className="text-[10px] text-muted">{formatValue(tx.value)}</p>
                )}
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between pt-2">
            <p className="text-[10px] text-muted">
              Source: SEC Form 4 filings · Updated daily
            </p>
            
            <a
              href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${ticker}&type=13F&dateb=&owner=include&count=10`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-accent-blue hover:underline"
            >
              <span>View institutional holders on SEC.gov</span>
              <ExternalLink size={10} />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
