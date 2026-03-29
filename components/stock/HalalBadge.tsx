'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, ChevronDown, ChevronUp, X, Loader2, BadgeCheck, Users } from 'lucide-react';
import type { HalalScreenResult, HalalStatus } from '@/services/halal-screener';

interface Props {
  result: HalalScreenResult;
  ticker: string;
}

interface Certification {
  id: string;
  certified_by: string;
  certified_name: string;
  source: string;
  notes?: string;
  created_at: string;
}

function getStatusConfig(status: HalalStatus) {
  switch (status) {
    case 'HALAL':
      return { label: 'Likely Halal', color: 'text-accent-green', bg: 'bg-accent-green/10', border: 'border-accent-green/30', emoji: '✅' };
    case 'DOUBTFUL':
      return { label: 'Doubtful', color: 'text-accent-yellow', bg: 'bg-accent-yellow/10', border: 'border-accent-yellow/30', emoji: '⚠️' };
    case 'NOT_HALAL':
      return { label: 'Likely Not Halal', color: 'text-accent-red', bg: 'bg-accent-red/10', border: 'border-accent-red/30', emoji: '❌' };
    default:
      return { label: 'Needs Review', color: 'text-accent-blue', bg: 'bg-accent-blue/10', border: 'border-accent-blue/30', emoji: '🔍' };
  }
}

function getScoreColor(status: HalalStatus) {
  switch (status) {
    case 'HALAL': return '#00d4aa';
    case 'DOUBTFUL': return '#ffd166';
    case 'NOT_HALAL': return '#ff4d6d';
    default: return '#4d9fff';
  }
}

function RatioRow({
  label,
  threshold,
  status,
  note,
}: {
  label: string;
  threshold: string;
  status: 'pass' | 'fail' | 'unknown';
  note: string;
}) {
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
  const color =
    status === 'pass'
      ? 'text-accent-green'
      : status === 'fail'
      ? 'text-accent-red'
      : 'text-accent-yellow';
  return (
    <div className="p-3 bg-surface-2 rounded-xl border border-border/50">
      <div className="flex items-start gap-2 mb-1">
        <span className="text-sm shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white">{label}</p>
          <p className={`text-[10px] font-mono ${color} mt-0.5`}>{threshold}</p>
        </div>
      </div>
      <p className="text-[10px] text-muted leading-relaxed pl-6">{note}</p>
    </div>
  );
}

export default function HalalBadge({ result, ticker }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [userCertified, setUserCertified] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [showCertForm, setShowCertForm] = useState(false);
  const [certForm, setCertForm] = useState({
    certified_name: '',
    source: 'Musaffa.com',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const cfg = getStatusConfig(result.status);
  const scoreColor = getScoreColor(result.status);

  useEffect(() => {
    fetch(`/api/stocks/${ticker}/halal-cert`)
      .then(r => r.json())
      .then(d => {
        setCertifications(d.certifications ?? []);
        setUserCertified(d.user_certified ?? false);
        setTotalCount(d.total_count ?? 0);
        if (d.user_cert) {
          setCertForm({
            certified_name: d.user_cert.certified_name ?? '',
            source: d.user_cert.source ?? 'Musaffa.com',
            notes: d.user_cert.notes ?? '',
          });
        }
      })
      .catch(() => {});
  }, [ticker]);

  async function saveCertification() {
    setSaving(true);
    try {
      await fetch(`/api/stocks/${ticker}/halal-cert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(certForm),
      });
      setUserCertified(true);
      setShowCertForm(false);
      const res = await fetch(`/api/stocks/${ticker}/halal-cert`);
      const data = await res.json();
      setCertifications(data.certifications ?? []);
      setTotalCount(data.total_count ?? 0);
    } finally {
      setSaving(false);
    }
  }

  async function removeCertification() {
    setSaving(true);
    try {
      await fetch(`/api/stocks/${ticker}/halal-cert`, { method: 'DELETE' });
      setUserCertified(false);
      setShowCertForm(false);
      const res = await fetch(`/api/stocks/${ticker}/halal-cert`);
      const data = await res.json();
      setCertifications(data.certifications ?? []);
      setTotalCount(data.total_count ?? 0);
    } finally {
      setSaving(false);
    }
  }

  const SOURCES = [
    'Musaffa.com',
    'Zoya App',
    'Islamicly',
    'AAOIFI Certified Scholar',
    'Local Imam / Scholar',
    'Fiqh Council of North America',
    'Personal research',
    'Other',
  ];

  return (
    <div
      className={`card border ${
        userCertified
          ? 'border-accent-green/50 bg-accent-green/5'
          : `${cfg.border} ${cfg.bg}`
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="text-2xl shrink-0">☪️</div>
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <p className="text-sm font-semibold text-white">Halal Screening</p>
              <span className={`badge text-[10px] ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                {cfg.emoji} {cfg.label}
              </span>
              {totalCount > 0 && (
                <span className="badge bg-accent-green/15 text-accent-green border border-accent-green/30 text-[10px] gap-1">
                  <BadgeCheck size={10} />
                  {totalCount} {totalCount === 1 ? 'person' : 'people'} certified halal
                </span>
              )}
            </div>
            <p className="text-xs text-secondary">AAOIFI · Fiqh Council of North America</p>
            <p className={`text-[10px] mt-0.5 ${cfg.color}`}>{result.company_type_label}</p>
          </div>
        </div>

        {/* Score circle */}
        <div className="text-right shrink-0">
          <div className="relative w-14 h-14">
            <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1f1f28" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15.9" fill="none"
                stroke={userCertified ? '#00d4aa' : scoreColor}
                strokeWidth="3"
                strokeDasharray={`${userCertified ? 100 : result.score} 100`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              {userCertified ? (
                <BadgeCheck size={20} className="text-accent-green" />
              ) : (
                <span className={`text-xs font-mono font-bold ${cfg.color}`}>{result.score}</span>
              )}
            </div>
          </div>
          <p className="text-[10px] text-muted mt-0.5">{userCertified ? 'Certified' : 'Score /100'}</p>
        </div>
      </div>

      {/* User Certification Banner / Button */}
      {userCertified ? (
        <div className="mt-4 p-3 bg-accent-green/15 rounded-xl border border-accent-green/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BadgeCheck size={16} className="text-accent-green shrink-0" />
            <div>
              <p className="text-xs font-semibold text-accent-green">You marked this as Halal Certified</p>
              <p className="text-[10px] text-secondary mt-0.5">
                Source: {certForm.source}{certForm.notes ? ` · ${certForm.notes}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={removeCertification}
            disabled={saving}
            className="p-1.5 rounded-lg hover:bg-accent-red/20 text-muted hover:text-accent-red transition-colors shrink-0"
            title="Remove certification"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowCertForm(!showCertForm)}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-surface-2 border border-border hover:bg-surface-3 hover:border-accent-green/40 text-secondary hover:text-accent-green text-xs font-medium transition-all"
        >
          <BadgeCheck size={14} />
          <span>Mark as Halal Certified</span>
        </button>
      )}

      {/* Certification Form */}
      {showCertForm && !userCertified && (
        <div className="mt-3 p-4 bg-surface-2 rounded-xl border border-accent-green/30 space-y-3">
          <p className="text-xs font-semibold text-white">Add your Halal certification</p>
          <div>
            <label className="label block mb-1.5">Your name *</label>
            <input
              type="text"
              value={certForm.certified_name}
              onChange={e => setCertForm(p => ({ ...p, certified_name: e.target.value }))}
              className="input w-full"
              placeholder="e.g. Adam Malik"
            />
          </div>
          <div>
            <label className="label block mb-1.5">Verification source *</label>
            <select
              value={certForm.source}
              onChange={e => setCertForm(p => ({ ...p, source: e.target.value }))}
              className="input w-full"
            >
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label block mb-1.5">Notes (optional)</label>
            <input
              type="text"
              value={certForm.notes}
              onChange={e => setCertForm(p => ({ ...p, notes: e.target.value }))}
              className="input w-full"
              placeholder="e.g. Verified via Musaffa March 2026, score 89"
            />
          </div>
          <div className="p-3 bg-surface-3 rounded-lg">
            <p className="text-[10px] text-muted leading-relaxed">
              By certifying, you confirm you have personally verified this stock's Halal status
              using a reliable source. This is visible to other StockWise users and does not
              constitute a Fatwa.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowCertForm(false)} className="btn-secondary flex-1">
              Cancel
            </button>
            <button
              onClick={saveCertification}
              disabled={saving || !certForm.certified_name.trim()}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <>
                  <BadgeCheck size={14} />
                  <span>Certify as Halal</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Three Screens Summary */}
      <div className="grid grid-cols-3 gap-2 mt-4">
        <div className={`p-2.5 rounded-lg border text-center ${result.security_type_check.passed ? 'bg-accent-green/10 border-accent-green/20' : 'bg-accent-red/10 border-accent-red/20'}`}>
          <p className="text-[10px] uppercase tracking-wide text-muted mb-1">Security</p>
          <p className={`text-xs font-semibold ${result.security_type_check.passed ? 'text-accent-green' : 'text-accent-red'}`}>
            {result.security_type_check.passed ? '✅ Pass' : '❌ Fail'}
          </p>
        </div>
        <div className={`p-2.5 rounded-lg border text-center ${result.business_check.passed ? 'bg-accent-green/10 border-accent-green/20' : 'bg-accent-red/10 border-accent-red/20'}`}>
          <p className="text-[10px] uppercase tracking-wide text-muted mb-1">Business</p>
          <p className={`text-xs font-semibold ${result.business_check.passed ? 'text-accent-green' : 'text-accent-red'}`}>
            {result.business_check.passed ? '✅ Pass' : '❌ Fail'}
          </p>
        </div>
        <div className={`p-2.5 rounded-lg border text-center ${
          result.financial_check.overall_passed === true ? 'bg-accent-green/10 border-accent-green/20'
          : result.financial_check.overall_passed === false ? 'bg-accent-red/10 border-accent-red/20'
          : 'bg-surface-3 border-border'
        }`}>
          <p className="text-[10px] uppercase tracking-wide text-muted mb-1">Financial</p>
          <p className={`text-xs font-semibold ${
            result.financial_check.overall_passed === true ? 'text-accent-green'
            : result.financial_check.overall_passed === false ? 'text-accent-red'
            : 'text-secondary'
          }`}>
            {result.financial_check.overall_passed === true ? '✅ Pass'
              : result.financial_check.overall_passed === false ? '❌ Fail'
              : '⚠️ Verify'}
          </p>
        </div>
      </div>

      {/* Purification notice */}
      {result.purification.required && (
        <div className="mt-3 p-3 bg-accent-yellow/8 rounded-xl border border-accent-yellow/25 flex items-start gap-2">
          <span className="text-sm shrink-0">💰</span>
          <div>
            <p className="text-xs font-semibold text-accent-yellow mb-0.5">Purification Required</p>
            <p className="text-[10px] text-secondary leading-relaxed">{result.purification.note}</p>
          </div>
        </div>
      )}

      {/* Community count shortcut */}
      {certifications.length > 0 && !expanded && (
        <div className="mt-3">
          <button
            onClick={() => setExpanded(true)}
            className="flex items-center gap-2 text-xs text-secondary hover:text-white transition-colors"
          >
            <Users size={12} />
            <span>{certifications.length} community certification{certifications.length > 1 ? 's' : ''} — click to view</span>
          </button>
        </div>
      )}

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-secondary hover:text-white mt-4 transition-colors"
      >
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        {expanded ? 'Hide' : 'Show'} full analysis
      </button>

      {/* Expanded Detail */}
      {expanded && (
        <div className="mt-4 space-y-4 border-t border-border pt-4">

          {/* Community Certifications */}
          {certifications.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-white mb-3">Community Certifications ({certifications.length})</p>
              <div className="space-y-2">
                {certifications.map(cert => (
                  <div key={cert.id} className="flex items-start gap-3 p-3 bg-accent-green/8 rounded-xl border border-accent-green/20">
                    <div className="w-8 h-8 rounded-full bg-accent-green/20 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-accent-green">
                        {cert.certified_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-semibold text-white">{cert.certified_name}</p>
                        <span className="badge bg-accent-green/15 text-accent-green text-[10px]">
                          <BadgeCheck size={9} /> Halal Certified
                        </span>
                      </div>
                      <p className="text-[10px] text-secondary mt-0.5">via {cert.source}</p>
                      {cert.notes && <p className="text-[10px] text-muted mt-1 italic">{cert.notes}</p>}
                      <p className="text-[10px] text-muted mt-1">
                        {new Date(cert.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted mt-2">Community certifications are personal verifications, not official Fatwas.</p>
            </div>
          )}

          {/* Company classification */}
          <div className="p-3 bg-surface-2 rounded-xl">
            <p className="text-[10px] text-muted uppercase tracking-wide mb-2">Company Classification</p>
            <div className="space-y-1.5 text-xs text-secondary">
              <p><span className="text-white font-medium">Type 1:</span> Pure halal — fully permissible business, no interest dealings</p>
              <p><span className="text-white font-medium">Type 2:</span> Pure haram — primary business is prohibited</p>
              <p><span className="text-white font-medium">Type 3:</span> Mixed — permissible primary business with some incidental haram (most public companies)</p>
            </div>
            <p className={`text-xs font-semibold mt-2 ${cfg.color}`}>{ticker} is: {result.company_type_label}</p>
          </div>

          {/* Screen 1 */}
          <div>
            <p className="text-xs font-semibold text-white mb-2">Screen 1 — Security Type</p>
            <div className={`p-3 rounded-xl border ${result.security_type_check.passed ? 'bg-accent-green/8 border-accent-green/20' : 'bg-accent-red/8 border-accent-red/20'}`}>
              <p className="text-xs text-secondary leading-relaxed">{result.security_type_check.reason}</p>
              <p className="text-[10px] text-muted mt-1">Prohibited: fixed income, preferred shares, convertible notes — all guarantee returns (riba)</p>
            </div>
          </div>

          {/* Screen 2 */}
          <div>
            <p className="text-xs font-semibold text-white mb-2">Screen 2 — Business Activity</p>
            <div className={`p-3 rounded-xl border ${result.business_check.passed ? 'bg-accent-green/8 border-accent-green/20' : 'bg-accent-red/8 border-accent-red/20'}`}>
              <p className="text-xs text-secondary leading-relaxed">{result.business_check.reason}</p>
              {result.business_check.flagged_activities.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {result.business_check.flagged_activities.map((a, i) => (
                    <span key={i} className="badge-red text-[10px]">{a}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Screen 3 */}
          <div>
            <p className="text-xs font-semibold text-white mb-2">Screen 3 — AAOIFI Financial Ratios</p>
            <div className="space-y-2">
              <RatioRow
                label="Interest-bearing debt ratio"
                threshold="Total interest-bearing debt ≤ 30% of market cap"
                status={result.financial_check.debt_ratio.status}
                note={result.financial_check.debt_ratio.note}
              />
              <RatioRow
                label="Interest-bearing deposit ratio"
                threshold="Total interest-bearing deposits ≤ 30% of market cap"
                status={result.financial_check.deposit_ratio.status}
                note={result.financial_check.deposit_ratio.note}
              />
              <RatioRow
                label="Non-permissible income ratio"
                threshold="Haram income ≤ 5% of total revenue"
                status={result.financial_check.haram_income_ratio.status}
                note={result.financial_check.haram_income_ratio.note}
              />
            </div>
            <p className="text-[10px] text-muted mt-2 leading-relaxed">
              The 30% threshold derives from the Hadith of Sa'd (Bukhari 2742). The 5% threshold reflects AAOIFI-adopted accounting materiality standards.
            </p>
          </div>

          {/* Positives */}
          {result.positives.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-accent-green mb-2">Positive Indicators</p>
              <ul className="space-y-1">
                {result.positives.map((p, i) => <li key={i} className="text-xs text-secondary">{p}</li>)}
              </ul>
            </div>
          )}

          {/* Flags */}
          {result.flags.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-accent-yellow mb-2">Flags and Concerns</p>
              <ul className="space-y-1">
                {result.flags.map((f, i) => <li key={i} className="text-xs text-secondary">{f}</li>)}
              </ul>
            </div>
          )}

          {/* Purification */}
          <div>
            <p className="text-xs font-semibold text-white mb-2">Purification (Tazkiyah)</p>
            <div className="p-3 bg-surface-2 rounded-xl">
              <p className="text-xs text-secondary leading-relaxed">{result.purification.note}</p>
            </div>
          </div>

          {/* ESG */}
          <div>
            <p className="text-xs font-semibold text-white mb-2">ESG Considerations</p>
            <div className="p-3 bg-surface-2 rounded-xl">
              <p className="text-xs text-secondary leading-relaxed">{result.esg_note}</p>
            </div>
          </div>

          {/* Sources */}
          <div className="p-3 bg-surface-3 rounded-xl border border-border">
            <p className="text-[10px] text-muted uppercase tracking-wide mb-1">Sources</p>
            <p className="text-[10px] text-muted leading-relaxed">{result.source}</p>
          </div>

          {/* Disclaimer */}
          <div className="p-3 bg-surface-3 rounded-xl border border-border">
            <p className="text-[10px] text-muted uppercase tracking-wide mb-1">Important Disclaimer</p>
            <p className="text-[10px] text-muted leading-relaxed">{result.disclaimer}</p>
          </div>

          {/* Musaffa link */}
          <a
            href={result.musaffa_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-accent-green/15 border border-accent-green/30 text-accent-green text-sm font-semibold hover:bg-accent-green/20 transition-colors"
          >
            <span>Verify Full Screening on Musaffa.com</span>
            <ExternalLink size={14} />
          </a>
        </div>
      )}
    </div>
  );
}
