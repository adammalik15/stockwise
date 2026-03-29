'use client';

import { useState } from 'react';
import { ExternalLink, ChevronDown, ChevronUp, Shield, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';
import type { HalalScreenResult, HalalStatus } from '@/services/halal-screener';

interface Props {
  result: HalalScreenResult;
  ticker: string;
}

const STATUS_CONFIG: Record<HalalStatus, {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: any;
  emoji: string;
}> = {
  HALAL: {
    label: 'Likely Halal',
    color: 'text-accent-green',
    bg: 'bg-accent-green/10',
    border: 'border-accent-green/30',
    icon: Shield,
    emoji: '✅',
  },
  DOUBTFUL: {
    label: 'Doubtful',
    color: 'text-accent-yellow',
    bg: 'bg-accent-yellow/10',
    border: 'border-accent-yellow/30',
    icon: AlertTriangle,
    emoji: '⚠️',
  },
  NOT_HALAL: {
    label: 'Likely Not Halal',
    color: 'text-accent-red',
    bg: 'bg-accent-red/10',
    border: 'border-accent-red/30',
    icon: XCircle,
    emoji: '❌',
  },
  NEEDS_REVIEW: {
    label: 'Needs Review',
    color: 'text-accent-blue',
    bg: 'bg-accent-blue/10',
    border: 'border-accent-blue/30',
    icon: HelpCircle,
    emoji: '🔍',
  },
};

export default function HalalBadge({ result, ticker }: Props) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[result.status];
  const Icon = cfg.icon;

  return (
    <div className={`card border ${cfg.border} ${cfg.bg}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="text-2xl">☪️</div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-semibold text-white">Halal Screening</p>
              <span className={`badge text-[10px] ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                {cfg.emoji} {cfg.label}
              </span>
            </div>
            <p className="text-xs text-secondary">Preliminary AAOIFI-based analysis</p>
          </div>
        </div>

        {/* Score */}
        <div className="text-right shrink-0">
          <div className="relative w-14 h-14">
            <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1f1f28" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15.9" fill="none"
                stroke={result.status === 'HALAL' ? '#00d4aa' : result.status === 'DOUBTFUL' ? '#ffd166' : result.status === 'NOT_HALAL' ? '#ff4d6d' : '#4d9fff'}
                strokeWidth="3"
                strokeDasharray={`${result.score} 100`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-xs font-mono font-bold ${cfg.color}`}>{result.score}</span>
            </div>
          </div>
          <p className="text-[10px] text-muted mt-0.5">Score /100</p>
        </div>
      </div>

      {/* Quick summary */}
      <div className="grid grid-cols-2 gap-2 mt-4">
        <div className={`p-2.5 rounded-lg border ${result.business_check.passed ? 'bg-accent-green/8 border-accent-green/20' : 'bg-accent-red/8 border-accent-red/20'}`}>
          <p className="text-[10px] uppercase tracking-wide text-muted mb-1">Business Screen</p>
          <p className={`text-xs font-semibold ${result.business_check.passed ? 'text-accent-green' : 'text-accent-red'}`}>
            {result.business_check.passed ? '✅ Passed' : '❌ Failed'}
          </p>
        </div>
        <div className={`p-2.5 rounded-lg border ${
          result.financial_check.passed === null
            ? 'bg-surface-3 border-border'
            : result.financial_check.passed
            ? 'bg-accent-green/8 border-accent-green/20'
            : 'bg-accent-yellow/8 border-accent-yellow/20'
        }`}>
          <p className="text-[10px] uppercase tracking-wide text-muted mb-1">Financial Screen</p>
          <p className={`text-xs font-semibold ${
            result.financial_check.passed === null
              ? 'text-secondary'
              : result.financial_check.passed
              ? 'text-accent-green'
              : 'text-accent-yellow'
          }`}>
            {result.financial_check.passed === null ? '⚠️ Insufficient Data' : result.financial_check.passed ? '✅ Indicators OK' : '⚠️ Review Needed'}
          </p>
        </div>
      </div>

      {/* Expand button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-secondary hover:text-white mt-4 transition-colors"
      >
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        {expanded ? 'Hide' : 'Show'} detailed analysis
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-4 space-y-4 border-t border-border/50 pt-4">

          {/* AAOIFI Criteria */}
          <div>
            <p className="text-xs font-semibold text-white mb-2">AAOIFI Screening Criteria</p>
            <div className="space-y-2">
              {[
                {
                  label: 'Business Activity',
                  desc: 'No haram primary business (alcohol, gambling, banking, etc.)',
                  status: result.business_check.passed,
                },
                {
                  label: 'Interest-Bearing Debt',
                  desc: 'Debt ≤ 30% of market capitalization',
                  status: result.financial_check.debt_ratio_flag === null ? null : !result.financial_check.debt_ratio_flag,
                },
                {
                  label: 'Non-Permissible Income',
                  desc: 'Haram revenue ≤ 5% of total revenue',
                  status: result.business_check.passed ? null : false,
                },
                {
                  label: 'Interest-Bearing Assets',
                  desc: 'Interest assets ≤ 30% of market cap',
                  status: null,
                },
              ].map((criterion, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="text-sm shrink-0 mt-0.5">
                    {criterion.status === true ? '✅' : criterion.status === false ? '❌' : '⚠️'}
                  </span>
                  <div>
                    <p className="text-xs font-medium text-white">{criterion.label}</p>
                    <p className="text-[10px] text-muted">{criterion.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Positives */}
          {result.positives.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-accent-green mb-2">Positive Indicators</p>
              <ul className="space-y-1">
                {result.positives.map((p, i) => (
                  <li key={i} className="text-xs text-secondary">{p}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Flags */}
          {result.flags.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-accent-yellow mb-2">Flags & Concerns</p>
              <ul className="space-y-1">
                {result.flags.map((f, i) => (
                  <li key={i} className="text-xs text-secondary">{f}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Business check detail */}
          <div className="p-3 bg-surface-2 rounded-lg">
            <p className="text-[10px] text-muted uppercase tracking-wide mb-1">Business Screen Detail</p>
            <p className="text-xs text-secondary">{result.business_check.reason}</p>
          </div>

          {/* Financial check detail */}
          <div className="p-3 bg-surface-2 rounded-lg">
            <p className="text-[10px] text-muted uppercase tracking-wide mb-1">Financial Screen Detail</p>
            <p className="text-xs text-secondary">{result.financial_check.reason}</p>
          </div>

          {/* Disclaimer */}
          <div className="p-3 bg-surface-3 rounded-lg border border-border">
            <p className="text-[10px] text-muted uppercase tracking-wide mb-1">⚠️ Important Disclaimer</p>
            <p className="text-[10px] text-muted leading-relaxed">{result.disclaimer}</p>
          </div>

          {/* Musaffa link */}
          
           href={result.musaffa_url}
  target="_blank"
  rel="noopener noreferrer"
  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-accent-green/15 border border-accent-green/30 text-accent-green text-sm font-medium hover:bg-accent-green/20 transition-colors">
  <span>Verify on Musaffa.com</span>
  <ExternalLink size={13} />
</a>
        </div>
      )}
    </div>
  );
}