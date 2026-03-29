'use client';
import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Loader2, AlertTriangle, CheckCircle, Lightbulb, Shield, Sparkles, RefreshCw } from 'lucide-react';

const Tip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return <div className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-xs"><p className="font-medium text-white">{d.label}</p><p className="text-accent-green">{d.percentage?.toFixed(1)}%</p></div>;
};

export default function PortfolioAnalysisPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/portfolio-analysis');
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? 'Failed'); }
      setData(await res.json());
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4"><Loader2 size={32} className="animate-spin text-accent-green"/><p className="text-secondary text-sm">Analyzing your portfolio...</p></div>;
  if (error) return <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4"><AlertTriangle size={40} className="text-accent-yellow"/><h2 className="text-lg font-semibold text-white">{error}</h2><p className="text-secondary text-sm">Add holdings to your portfolio to see analysis.</p></div>;
  if (!data) return null;

  const scoreColor = data.diversification_score >= 70 ? '#00d4aa' : data.diversification_score >= 40 ? '#ffd166' : '#ff4d6d';
  const scoreLabel = data.diversification_score >= 70 ? 'Well Diversified' : data.diversification_score >= 40 ? 'Moderately Diversified' : 'Concentrated';
  const isPos = data.total_gain_loss >= 0;

  return (
    <div className="space-y-5 page-enter">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-white">Portfolio Analysis</h1><p className="text-secondary text-sm mt-0.5">Diversification & risk assessment</p></div>
        <button onClick={load} className="btn-ghost flex items-center gap-2"><RefreshCw size={14}/> Refresh</button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:'Total Value', value:'$'+data.total_value.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) },
          { label:'Total Cost', value:'$'+data.total_cost.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) },
          { label:'Total P&L', value:(isPos?'+':'')+'$'+Math.abs(data.total_gain_loss).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}), positive:isPos },
          { label:'Return', value:(isPos?'+':'')+data.total_gain_loss_percent.toFixed(2)+'%', positive:isPos },
        ].map(s => <div key={s.label} className="card"><p className="label mb-1.5">{s.label}</p><p className={"stat-value "+(s.positive===undefined?'text-white':s.positive?'text-accent-green':'text-accent-red')}>{s.value}</p></div>)}
      </div>
      <div className="card">
        <div className="flex items-center gap-2 mb-4"><Shield size={15} className="text-accent-green"/><p className="text-sm font-semibold text-white">Diversification Score</p></div>
        <div className="flex items-center gap-6">
          <div className="relative w-28 h-28 shrink-0">
            <svg viewBox="0 0 36 36" className="w-28 h-28 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1f1f28" strokeWidth="3"/>
              <circle cx="18" cy="18" r="15.9" fill="none" stroke={scoreColor} strokeWidth="3" strokeDasharray={data.diversification_score+' 100'} strokeLinecap="round"/>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-mono font-bold" style={{color:scoreColor}}>{data.diversification_score}</span>
              <span className="text-[10px] text-muted">/ 100</span>
            </div>
          </div>
          <div>
            <p className="text-lg font-semibold text-white mb-1">{scoreLabel}</p>
            <p className="text-sm text-secondary">Based on sector spread, asset variety, and position sizing.</p>
          </div>
        </div>
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        {[
          { title:'By Sector', data:data.allocation_by_sector },
          { title:'By Asset Type', data:data.allocation_by_asset_type },
          { title:'By Market Cap', data:data.allocation_by_market_cap },
        ].map(chart => (
          <div key={chart.title} className="card">
            <p className="text-sm font-semibold text-white mb-4">{chart.title}</p>
            {chart.data.length === 0 ? <p className="text-xs text-muted text-center py-4">No data</p> : (
              <>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart><Pie data={chart.data} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={60} strokeWidth={2} stroke="#111118">
                    {chart.data.map((e: any, i: number) => <Cell key={i} fill={e.color}/>)}
                  </Pie><Tooltip content={<Tip/>}/></PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {chart.data.slice(0,4).map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{backgroundColor:item.color}}/><span className="text-secondary truncate max-w-[100px]">{item.label}</span></div>
                      <span className="font-mono text-white">{item.percentage.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      {data.risk_flags.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4"><AlertTriangle size={15} className="text-accent-yellow"/><p className="text-sm font-semibold text-white">Risk Flags</p></div>
          <div className="space-y-3">
            {data.risk_flags.map((flag: any, i: number) => (
              <div key={i} className={"flex items-start gap-3 p-3 rounded-xl border " + (flag.severity==='high'?'bg-accent-red/8 border-accent-red/25':flag.severity==='medium'?'bg-accent-yellow/8 border-accent-yellow/25':'bg-surface-2 border-border')}>
                <AlertTriangle size={14} className={flag.severity==='high'?'text-accent-red mt-0.5 shrink-0':flag.severity==='medium'?'text-accent-yellow mt-0.5 shrink-0':'text-muted mt-0.5 shrink-0'}/>
                <p className="text-sm text-secondary">{flag.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="card border-accent-purple/20">
        <div className="flex items-center gap-2 mb-5"><Sparkles size={15} className="text-accent-purple"/><p className="text-sm font-semibold text-white">AI Insights</p></div>
        <p className="text-sm text-secondary leading-relaxed mb-5">{data.ai_insights.summary}</p>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { icon:<CheckCircle size={14} className="text-accent-green"/>, title:'Strengths', items:data.ai_insights.strengths, color:'text-accent-green' },
            { icon:<AlertTriangle size={14} className="text-accent-yellow"/>, title:'Weaknesses', items:data.ai_insights.weaknesses, color:'text-accent-yellow' },
            { icon:<Lightbulb size={14} className="text-accent-blue"/>, title:'Opportunities', items:data.ai_insights.opportunities, color:'text-accent-blue' },
          ].map(section => (
            <div key={section.title}>
              <div className={"flex items-center gap-1.5 mb-3"}>{section.icon}<p className={"text-xs font-semibold uppercase tracking-wide "+section.color}>{section.title}</p></div>
              <ul className="space-y-2">{section.items.map((item: string, i: number) => <li key={i} className="text-xs text-secondary flex items-start gap-2"><span className={"mt-1 shrink-0 "+section.color}>•</span>{item}</li>)}</ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
