'use client';
import { useEffect, useState, useCallback } from 'react';
import StockCard from '@/components/stock/StockCard';
import StockSearch from '@/components/stock/StockSearch';
import { Briefcase, Download, Loader2, TrendingUp, TrendingDown } from 'lucide-react';

export default function PortfolioPage() {
  const [holdings, setHoldings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setLoading(true); const res = await fetch('/api/portfolio'); const data = await res.json(); setHoldings(data.holdings ?? []); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);
  async function remove(id: string) { await fetch('/api/portfolio', { method: 'DELETE', body: JSON.stringify({ id }) }); setHoldings(p => p.filter(h => h.id !== id)); }
  function exportCSV() {
    const headers = ['Ticker','Type','Qty','Buy Price','Date','Current Price','Value','P&L','Return%'];
    const rows = holdings.map(h => [h.ticker,h.asset_type,h.quantity,h.purchase_price,h.purchase_date,h.stock_data?.price??'',h.current_value?.toFixed(2)??'',h.gain_loss?.toFixed(2)??'',h.gain_loss_percent?.toFixed(2)??'']);
    const csv = [headers,...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download = 'portfolio.csv'; a.click();
  }
  const totalValue = holdings.reduce((s,h) => s+(h.current_value??0),0);
  const totalCost = holdings.reduce((s,h) => s+h.purchase_price*h.quantity,0);
  const totalGL = totalValue - totalCost;
  const totalGLPct = totalCost > 0 ? (totalGL/totalCost)*100 : 0;
  const isPos = totalGL >= 0;
  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-white">Portfolio</h1><p className="text-secondary text-sm mt-0.5">{holdings.length} holding{holdings.length!==1?'s':''}</p></div>
        <div className="flex items-center gap-2">
          {holdings.length > 0 && <button onClick={exportCSV} className="btn-secondary flex items-center gap-2"><Download size={14}/> Export CSV</button>}
          <StockSearch placeholder="Add stock..." />
        </div>
      </div>
      {holdings.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label:'Total Value', value:'$'+totalValue.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) },
            { label:'Total Cost', value:'$'+totalCost.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) },
            { label:'Total P&L', value:(isPos?'+':'')+'$'+Math.abs(totalGL).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}), positive:isPos },
            { label:'Return', value:(isPos?'+':'')+totalGLPct.toFixed(2)+'%', positive:isPos },
          ].map(s => <div key={s.label} className="card"><p className="label mb-1.5">{s.label}</p><p className={"stat-value "+(s.positive===undefined?'text-white':s.positive?'text-accent-green':'text-accent-red')}>{s.value}</p></div>)}
        </div>
      )}
      {loading ? <div className="flex items-center justify-center py-24"><Loader2 size={22} className="animate-spin text-accent-green"/></div>
      : holdings.length === 0 ? <div className="flex flex-col items-center justify-center py-24 text-center"><Briefcase size={40} className="text-muted mb-4"/><h2 className="text-lg font-semibold text-white mb-2">No holdings yet</h2><p className="text-secondary text-sm max-w-xs">Search for a stock above and click + to add it.</p></div>
      : <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">{holdings.map(item => <StockCard key={item.id} item={item} mode="portfolio" onRemove={() => remove(item.id)}/>)}</div>}
    </div>
  );
}
