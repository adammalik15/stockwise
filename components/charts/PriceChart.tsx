'use client';
import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { PricePoint } from '@/types';

type Period = '1mo'|'3mo'|'6mo'|'1y'|'2y';

export default function PriceChart({ ticker, initialData, currentPrice }: { ticker: string; initialData: PricePoint[]; currentPrice: number }) {
  const [period, setPeriod] = useState<Period>('6mo');
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  async function changePeriod(p: Period) {
    if (p === period) return;
    setPeriod(p); setLoading(true);
    try {
      const res = await fetch('/api/stocks/' + ticker + '/history?period=' + p);
      const json = await res.json();
      setData(json.history ?? []);
    } finally { setLoading(false); }
  }

  const startPrice = data[0]?.close ?? currentPrice;
  const isPos = currentPrice >= startPrice;
  const stroke = isPos ? '#00d4aa' : '#ff4d6d';

  const Tip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-xs">
        <p className="text-secondary mb-1">{new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
        <p className="font-mono font-semibold text-white">${d.close?.toFixed(2)}</p>
      </div>
    );
  };

  return (
    <div>
      <div className="flex gap-1 mb-4">
        {(['1mo','3mo','6mo','1y','2y'] as Period[]).map(p => (
          <button key={p} onClick={() => changePeriod(p)}
            className={"px-3 py-1 rounded-lg text-xs font-medium transition-all " + (period === p ? 'bg-accent-green/15 text-accent-green' : 'text-secondary hover:text-white hover:bg-surface-2')}>
            {p}
          </button>
        ))}
      </div>
      <div className="relative w-full" style={{ height: '200px' }}>
        {loading && <div className="absolute inset-0 flex items-center justify-center bg-surface-1/60 z-10 rounded-lg"><div className="w-5 h-5 border-2 border-accent-green/30 border-t-accent-green rounded-full animate-spin" /></div>}
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.15} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tickFormatter={d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              tick={{ fill: '#6b6b7e', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis domain={['auto','auto']} tick={{ fill: '#6b6b7e', fontSize: 10 }} axisLine={false} tickLine={false}
              tickFormatter={v => '$' + v.toFixed(0)} width={55} />
            <Tooltip content={<Tip />} />
            <Area type="monotone" dataKey="close" stroke={stroke} strokeWidth={2} fill="url(#pg)" dot={false}
              activeDot={{ r: 4, fill: stroke, strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
