'use client';

import { useEffect, useState } from 'react';
import { BarChart2, TrendingDown, TrendingUp, Activity, Loader2 } from 'lucide-react';

interface PricePoint { date: string; open: number; high: number; low: number; close: number; volume: number; }

interface Indicators {
  // Volatility
  avgDailySwing: number;       // average (high-low)/close %
  bigSwingDays: number;        // days where swing > 3% in last 30d
  bigSwingFreq: string;        // "X times in last 30 days"
  // Support / resistance (simple pivot)
  support: number;
  resistance: number;
  // Optimal buy zone
  buyZoneLow: number;
  buyZoneHigh: number;
  // Optimal sell zone
  sellZoneLow: number;
  sellZoneHigh: number;
  // Expected dip
  expectedDipLow: number;
  expectedDipHigh: number;
  // RSI (14)
  rsi: number;
  rsiSignal: 'Oversold' | 'Neutral' | 'Overbought';
  // ATR (14)
  atr: number;
  atrPct: number;
}

function computeRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1];
    if (delta > 0) gains += delta; else losses -= delta;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function computeATR(data: PricePoint[], period = 14): number {
  if (data.length < 2) return 0;
  const trs = data.slice(1).map((d, i) => {
    const prev = data[i];
    return Math.max(d.high - d.low, Math.abs(d.high - prev.close), Math.abs(d.low - prev.close));
  });
  const recent = trs.slice(-period);
  return recent.reduce((a, b) => a + b, 0) / recent.length;
}

function analyseHistory(data: PricePoint[], currentPrice: number): Indicators {
  const last30 = data.slice(-30);
  const last14 = data.slice(-14);

  // Avg daily swing %
  const swings = last30.map(d => d.close > 0 ? ((d.high - d.low) / d.close) * 100 : 0);
  const avgDailySwing = swings.reduce((a, b) => a + b, 0) / (swings.length || 1);

  // Big swing days > 3%
  const bigSwingDays = swings.filter(s => s > 3).length;

  // Pivot support / resistance from last 14 days
  const highs = last14.map(d => d.high);
  const lows  = last14.map(d => d.low);
  const resistance = Math.max(...highs);
  const support    = Math.min(...lows);

  // Buy zone: support ± 0.5 ATR
  const atr = computeATR(data);
  const buyZoneLow  = Math.max(0, support - atr * 0.5);
  const buyZoneHigh = support + atr * 0.5;

  // Sell zone: resistance ± 0.5 ATR
  const sellZoneLow  = resistance - atr * 0.5;
  const sellZoneHigh = resistance + atr * 0.5;

  // Expected dip: current price minus 1-2× ATR
  const expectedDipLow  = Math.max(0, currentPrice - atr * 2);
  const expectedDipHigh = Math.max(0, currentPrice - atr * 1);

  // RSI
  const closes = data.map(d => d.close);
  const rsi = computeRSI(closes);
  const rsiSignal = rsi < 30 ? 'Oversold' : rsi > 70 ? 'Overbought' : 'Neutral';

  const atrPct = currentPrice > 0 ? (atr / currentPrice) * 100 : 0;

  return {
    avgDailySwing, bigSwingDays,
    bigSwingFreq: `${bigSwingDays} time${bigSwingDays !== 1 ? 's' : ''} in last 30 days`,
    support: parseFloat(support.toFixed(2)),
    resistance: parseFloat(resistance.toFixed(2)),
    buyZoneLow:   parseFloat(buyZoneLow.toFixed(2)),
    buyZoneHigh:  parseFloat(buyZoneHigh.toFixed(2)),
    sellZoneLow:  parseFloat(sellZoneLow.toFixed(2)),
    sellZoneHigh: parseFloat(sellZoneHigh.toFixed(2)),
    expectedDipLow:  parseFloat(expectedDipLow.toFixed(2)),
    expectedDipHigh: parseFloat(expectedDipHigh.toFixed(2)),
    rsi: parseFloat(rsi.toFixed(1)),
    rsiSignal,
    atr: parseFloat(atr.toFixed(2)),
    atrPct: parseFloat(atrPct.toFixed(2)),
  };
}

export default function ShortTermPanel({ ticker, currentPrice }: { ticker: string; currentPrice: number }) {
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/stocks/${ticker}/history?period=3mo`)
      .then(r => r.json())
      .then(d => {
        const history: PricePoint[] = d.history ?? [];
        if (history.length >= 15) setIndicators(analyseHistory(history, currentPrice));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ticker, currentPrice]);

  if (loading) return (
    <div className="card flex items-center gap-2 py-4">
      <Loader2 size={14} className="animate-spin text-muted" />
      <span className="text-xs text-muted">Computing short-term indicators…</span>
    </div>
  );

  if (!indicators) return null;

  const { rsi, rsiSignal, avgDailySwing, bigSwingFreq, atr, atrPct,
          support, resistance, buyZoneLow, buyZoneHigh, sellZoneLow, sellZoneHigh,
          expectedDipLow, expectedDipHigh } = indicators;

  const rsiColor = rsiSignal === 'Oversold' ? 'text-accent-green' : rsiSignal === 'Overbought' ? 'text-accent-red' : 'text-accent-yellow';
  const rsiBarColor = rsiSignal === 'Oversold' ? 'bg-accent-green' : rsiSignal === 'Overbought' ? 'bg-accent-red' : 'bg-accent-yellow';

  return (
    <div className="card space-y-5">
      <div className="flex items-center gap-2">
        <BarChart2 size={15} className="text-accent-yellow shrink-0" />
        <p className="text-sm font-semibold text-white">Short-Term Indicators</p>
        <span className="badge bg-accent-yellow/15 text-accent-yellow text-[10px]">3-month data</span>
      </div>

      {/* RSI */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-medium text-white">RSI (14)</p>
          <span className={`text-xs font-semibold ${rsiColor}`}>{rsi} — {rsiSignal}</span>
        </div>
        <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${rsiBarColor}`} style={{ width: `${rsi}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-muted mt-1">
          <span>Oversold (&lt;30)</span><span>Neutral</span><span>Overbought (&gt;70)</span>
        </div>
      </div>

      {/* Volatility */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 bg-surface-2 rounded-xl">
          <div className="flex items-center gap-1.5 mb-1">
            <Activity size={12} className="text-accent-yellow" />
            <p className="text-[10px] text-muted uppercase tracking-wide">Avg Daily Swing</p>
          </div>
          <p className="text-sm font-mono font-semibold text-white">{avgDailySwing.toFixed(2)}%</p>
          <p className="text-[10px] text-muted mt-0.5">High-to-low per day</p>
        </div>
        <div className="p-3 bg-surface-2 rounded-xl">
          <div className="flex items-center gap-1.5 mb-1">
            <Activity size={12} className="text-accent-red" />
            <p className="text-[10px] text-muted uppercase tracking-wide">Major Swings (&gt;3%)</p>
          </div>
          <p className="text-sm font-mono font-semibold text-white">{bigSwingFreq}</p>
          <p className="text-[10px] text-muted mt-0.5">ATR: ${atr} ({atrPct}%)</p>
        </div>
      </div>

      {/* Support / Resistance */}
      <div>
        <p className="text-xs font-medium text-white mb-2">14-Day Support &amp; Resistance</p>
        <div className="relative h-8 bg-surface-3 rounded-full overflow-hidden">
          {/* price bar */}
          {(() => {
            const range = resistance - support;
            if (range <= 0) return null;
            const pricePct = Math.min(100, Math.max(0, ((currentPrice - support) / range) * 100));
            return (
              <>
                <div className="absolute inset-0 bg-gradient-to-r from-accent-red/20 via-accent-yellow/20 to-accent-green/20" />
                <div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-md border-2 border-accent-green z-10" style={{ left: `calc(${pricePct}% - 5px)` }} />
              </>
            );
          })()}
        </div>
        <div className="flex justify-between text-[10px] mt-1">
          <span className="text-accent-red font-mono">S ${support}</span>
          <span className="text-secondary">Current ${currentPrice.toFixed(2)}</span>
          <span className="text-accent-green font-mono">R ${resistance}</span>
        </div>
      </div>

      {/* Buy / Sell zones */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-accent-green/8 rounded-xl border border-accent-green/20">
          <div className="flex items-center gap-1.5 mb-1.5">
            <TrendingDown size={12} className="text-accent-green" />
            <p className="text-[10px] text-accent-green font-semibold uppercase tracking-wide">Optimal Buy Zone</p>
          </div>
          <p className="text-xs font-mono text-white">${buyZoneLow} – ${buyZoneHigh}</p>
          <p className="text-[10px] text-muted mt-0.5">Near support ± ½ ATR</p>
        </div>
        <div className="p-3 bg-accent-red/8 rounded-xl border border-accent-red/20">
          <div className="flex items-center gap-1.5 mb-1.5">
            <TrendingUp size={12} className="text-accent-red" />
            <p className="text-[10px] text-accent-red font-semibold uppercase tracking-wide">Optimal Sell Zone</p>
          </div>
          <p className="text-xs font-mono text-white">${sellZoneLow} – ${sellZoneHigh}</p>
          <p className="text-[10px] text-muted mt-0.5">Near resistance ± ½ ATR</p>
        </div>
      </div>

      {/* Expected dip */}
      <div className="p-3 bg-accent-yellow/8 rounded-xl border border-accent-yellow/20">
        <div className="flex items-center gap-1.5 mb-1">
          <TrendingDown size={12} className="text-accent-yellow" />
          <p className="text-xs font-semibold text-accent-yellow">Expected Dip Level</p>
        </div>
        <p className="text-sm font-mono text-white">${expectedDipLow} – ${expectedDipHigh}</p>
        <p className="text-[10px] text-muted mt-0.5">Based on 1–2× ATR pullback from current price</p>
      </div>

      <p className="text-[10px] text-muted leading-relaxed">
        Indicators are computed from 3-month daily price data. Support/resistance uses 14-day pivot highs/lows.
        RSI and ATR use standard 14-period calculations. These are informational only — not financial advice.
      </p>
    </div>
  );
}
