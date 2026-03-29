'use client';

import { useState, useEffect } from 'react';
import { Target, Plus, Trash2, Loader2, Sparkles, TrendingUp, Calendar, DollarSign, RefreshCw } from 'lucide-react';

interface Goal {
  id: string;
  title: string;
  target_amount: number;
  current_amount: number;
  target_date: string;
  category: 'retirement' | 'house' | 'education' | 'emergency' | 'wealth' | 'other';
  notes: string;
}

interface GoalAnalysis {
  feasibility: 'achievable' | 'challenging' | 'stretch';
  monthly_needed: number;
  recommended_return: number;
  suggested_stocks: string[];
  strategy: string;
  milestones: string[];
}

const CATEGORY_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  retirement: { label: 'Retirement', emoji: '🏖️', color: 'text-accent-green' },
  house: { label: 'Buy a House', emoji: '🏠', color: 'text-accent-blue' },
  education: { label: 'Education', emoji: '🎓', color: 'text-accent-purple' },
  emergency: { label: 'Emergency Fund', emoji: '🛡️', color: 'text-accent-yellow' },
  wealth: { label: 'Wealth Building', emoji: '📈', color: 'text-accent-green' },
  other: { label: 'Other', emoji: '🎯', color: 'text-secondary' },
};

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<Record<string, GoalAnalysis>>({});
  const [portfolioValue, setPortfolioValue] = useState(0);
  const [form, setForm] = useState({
    title: '',
    target_amount: '',
    current_amount: '',
    target_date: '',
    category: 'wealth' as Goal['category'],
    notes: '',
  });

  // Load goals from localStorage and portfolio value from API
  useEffect(() => {
    const saved = localStorage.getItem('sw_goals');
    if (saved) {
      try { setGoals(JSON.parse(saved)); } catch {}
    }
    // Get portfolio value
    fetch('/api/portfolio')
      .then(r => r.json())
      .then(d => {
        const total = (d.holdings ?? []).reduce((s: number, h: any) => s + (h.current_value ?? 0), 0);
        setPortfolioValue(total);
      })
      .catch(() => {});
  }, []);

  function saveGoals(updated: Goal[]) {
    localStorage.setItem('sw_goals', JSON.stringify(updated));
    setGoals(updated);
  }

  function addGoal() {
    if (!form.title || !form.target_amount || !form.target_date) return;
    const goal: Goal = {
      id: Date.now().toString(),
      title: form.title,
      target_amount: parseFloat(form.target_amount),
      current_amount: parseFloat(form.current_amount) || 0,
      target_date: form.target_date,
      category: form.category,
      notes: form.notes,
    };
    saveGoals([...goals, goal]);
    setForm({ title: '', target_amount: '', current_amount: '', target_date: '', category: 'wealth', notes: '' });
    setShowAdd(false);
  }

  function deleteGoal(id: string) {
    saveGoals(goals.filter(g => g.id !== id));
    const newAnalyses = { ...analyses };
    delete newAnalyses[id];
    setAnalyses(newAnalyses);
  }

  async function analyzeGoal(goal: Goal) {
    setAnalyzing(goal.id);
    try {
      const res = await fetch('/api/goals/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, portfolio_value: portfolioValue }),
      });
      const data = await res.json();
      if (data.analysis) {
        setAnalyses(prev => ({ ...prev, [goal.id]: data.analysis }));
      }
    } catch (e) {
      console.error('Analysis failed:', e);
    } finally {
      setAnalyzing(null);
    }
  }

  function yearsToGoal(targetDate: string) {
    const months = (new Date(targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30);
    if (months < 12) return Math.round(months) + ' months';
    return (months / 12).toFixed(1) + ' years';
  }

  function progressPercent(goal: Goal) {
    return Math.min(100, (goal.current_amount / goal.target_amount) * 100);
  }

  const feasibilityConfig = {
    achievable: { color: 'text-accent-green', bg: 'bg-accent-green/10', border: 'border-accent-green/30', label: 'Achievable' },
    challenging: { color: 'text-accent-yellow', bg: 'bg-accent-yellow/10', border: 'border-accent-yellow/30', label: 'Challenging' },
    stretch: { color: 'text-accent-red', bg: 'bg-accent-red/10', border: 'border-accent-red/30', label: 'Stretch Goal' },
  };

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">My Financial Goals</h1>
          <p className="text-secondary text-sm mt-0.5">
            Set goals and get AI-powered investment strategies to achieve them
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} />
          Add Goal
        </button>
      </div>

      {/* Portfolio context */}
      {portfolioValue > 0 && (
        <div className="card bg-accent-green/5 border-accent-green/20">
          <div className="flex items-center gap-3">
            <TrendingUp size={18} className="text-accent-green" />
            <div>
              <p className="text-sm font-semibold text-white">
                Current Portfolio Value: ${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-secondary">
                This is used as your starting point for goal analysis
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Add Goal Form */}
      {showAdd && (
        <div className="card border-accent-green/20">
          <h2 className="text-base font-semibold text-white mb-4">New Financial Goal</h2>
          <div className="space-y-4">
            <div>
              <label className="label block mb-1.5">Goal Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                className="input w-full"
                placeholder="e.g. Retire at 60 with $2M"
              />
            </div>
            <div>
              <label className="label block mb-1.5">Category</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => setForm(p => ({ ...p, category: key as Goal['category'] }))}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs transition-all ${
                      form.category === key
                        ? 'bg-accent-green/15 border-accent-green/40 text-white'
                        : 'bg-surface-2 border-border text-secondary hover:text-white'
                    }`}
                  >
                    <span className="text-base">{cfg.emoji}</span>
                    <span className="text-[10px] text-center leading-tight">{cfg.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="label block mb-1.5">Target Amount *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
                  <input
                    type="number" min="0" step="1000"
                    value={form.target_amount}
                    onChange={e => setForm(p => ({ ...p, target_amount: e.target.value }))}
                    className="input w-full pl-7"
                    placeholder="500,000"
                  />
                </div>
              </div>
              <div>
                <label className="label block mb-1.5">Already Saved</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
                  <input
                    type="number" min="0"
                    value={form.current_amount}
                    onChange={e => setForm(p => ({ ...p, current_amount: e.target.value }))}
                    className="input w-full pl-7"
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className="label block mb-1.5">Target Date *</label>
                <input
                  type="date"
                  value={form.target_date}
                  onChange={e => setForm(p => ({ ...p, target_date: e.target.value }))}
                  className="input w-full"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
            <div>
              <label className="label block mb-1.5">Notes (optional)</label>
              <input
                type="text"
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                className="input w-full"
                placeholder="e.g. Include rental property income, halal investments only"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={addGoal}
                disabled={!form.title || !form.target_amount || !form.target_date}
                className="btn-primary flex-1"
              >
                Save Goal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Goals List */}
      {goals.length === 0 && !showAdd ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-accent-green/10 border border-accent-green/20 flex items-center justify-center">
            <Target size={28} className="text-accent-green" />
          </div>
          <h2 className="text-lg font-semibold text-white">No goals yet</h2>
          <p className="text-secondary text-sm max-w-sm">
            Add your first financial goal and get a personalised AI-powered investment strategy to achieve it.
          </p>
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Add Your First Goal
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {goals.map(goal => {
            const cfg = CATEGORY_CONFIG[goal.category] ?? CATEGORY_CONFIG.other;
            const analysis = analyses[goal.id];
            const pct = progressPercent(goal);
            const isAnalyzing = analyzing === goal.id;

            return (
              <div key={goal.id} className="card">
                {/* Goal Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="text-2xl shrink-0">{cfg.emoji}</span>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-white text-base">{goal.title}</h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className={`badge text-[10px] bg-surface-3 border border-border ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-muted">
                          <Calendar size={10} />
                          {yearsToGoal(goal.target_date)} remaining
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteGoal(goal.id)}
                    className="p-1.5 rounded-lg hover:bg-accent-red/20 text-muted hover:text-accent-red transition-colors shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Progress */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-secondary">
                      ${goal.current_amount.toLocaleString()} saved
                    </span>
                    <span className="font-mono font-semibold text-white">
                      ${goal.target_amount.toLocaleString()} target
                    </span>
                  </div>
                  <div className="h-2.5 bg-surface-3 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent-green rounded-full transition-all"
                      style={{ width: pct + '%' }}
                    />
                  </div>
                  <p className="text-[10px] text-muted mt-1">{pct.toFixed(1)}% complete</p>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="p-2.5 bg-surface-2 rounded-lg text-center">
                    <p className="text-[10px] text-muted mb-1">Still Needed</p>
                    <p className="text-xs font-mono font-semibold text-white">
                      ${(goal.target_amount - goal.current_amount).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-2.5 bg-surface-2 rounded-lg text-center">
                    <p className="text-[10px] text-muted mb-1">Target Date</p>
                    <p className="text-xs font-mono font-semibold text-white">
                      {new Date(goal.target_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="p-2.5 bg-surface-2 rounded-lg text-center">
                    <p className="text-[10px] text-muted mb-1">Portfolio Covers</p>
                    <p className={`text-xs font-mono font-semibold ${portfolioValue >= goal.target_amount ? 'text-accent-green' : 'text-accent-yellow'}`}>
                      {portfolioValue > 0 ? Math.min(100, (portfolioValue / goal.target_amount * 100)).toFixed(0) + '%' : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* AI Analysis Button */}
                {!analysis && (
                  <button
                    onClick={() => analyzeGoal(goal)}
                    disabled={isAnalyzing}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent-purple/15 border border-accent-purple/30 text-accent-purple text-sm font-medium hover:bg-accent-purple/20 transition-colors disabled:opacity-50"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        <span>Claude is creating your strategy...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={15} />
                        <span>Get AI Investment Strategy</span>
                      </>
                    )}
                  </button>
                )}

                {/* AI Analysis Results */}
                {analysis && (
                  <div className="space-y-3 border-t border-border pt-4 mt-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles size={14} className="text-accent-purple" />
                        <p className="text-sm font-semibold text-white">AI Strategy</p>
                        <span className="badge bg-accent-purple/15 text-accent-purple text-[10px]">Claude AI</span>
                      </div>
                      <button
                        onClick={() => analyzeGoal(goal)}
                        disabled={isAnalyzing}
                        className="p-1.5 rounded-lg hover:bg-surface-2 text-muted hover:text-white transition-colors"
                      >
                        <RefreshCw size={13} />
                      </button>
                    </div>

                    {/* Feasibility */}
                    {(() => {
                      const fc = feasibilityConfig[analysis.feasibility];
                      return (
                        <div className={`p-3 rounded-xl border ${fc.bg} ${fc.border}`}>
                          <div className="flex items-center justify-between mb-1">
                            <p className={`text-xs font-semibold ${fc.color}`}>
                              {fc.label}
                            </p>
                            <p className="text-xs text-secondary">
                              ~${analysis.monthly_needed.toLocaleString()}/month needed
                            </p>
                          </div>
                          <p className="text-xs text-secondary leading-relaxed">
                            {analysis.strategy}
                          </p>
                        </div>
                      );
                    })()}

                    {/* Suggested Stocks */}
                    {analysis.suggested_stocks?.length > 0 && (
                      <div>
                        <p className="text-[10px] text-muted uppercase tracking-wide mb-2">
                          Suggested Investments
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {analysis.suggested_stocks.map((s, i) => (
                            <a
                              key={i}
                              href={`/stock/${s}`}
                              className="px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-xs font-mono font-semibold text-accent-green hover:bg-surface-3 transition-colors"
                            >
                              {s}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Milestones */}
                    {analysis.milestones?.length > 0 && (
                      <div>
                        <p className="text-[10px] text-muted uppercase tracking-wide mb-2">
                          Milestones
                        </p>
                        <div className="space-y-1.5">
                          {analysis.milestones.map((m, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-secondary">
                              <span className="text-accent-green shrink-0 mt-0.5 font-bold">
                                {i + 1}.
                              </span>
                              {m}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="p-2.5 bg-surface-3 rounded-lg">
                      <p className="text-[10px] text-muted">
                        Target return: ~{analysis.recommended_return}% annually ·
                        Not financial advice · Verify Halal compliance on Musaffa.com
                      </p>
                    </div>
                  </div>
                )}

                {goal.notes && (
                  <p className="text-xs text-muted mt-3 pt-3 border-t border-border">
                    📝 {goal.notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}