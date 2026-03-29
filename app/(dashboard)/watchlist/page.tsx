'use client';
import { useEffect, useState, useCallback } from 'react';
import StockCard from '@/components/stock/StockCard';
import StockSearch from '@/components/stock/StockSearch';
import { Star, Loader2, Bell, BellOff, Pencil, Check, X } from 'lucide-react';

export default function WatchlistPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<{ id: string; value: string } | null>(null);
  const load = useCallback(async () => { setLoading(true); const res = await fetch('/api/watchlist'); const data = await res.json(); setItems(data.watchlist ?? []); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);
  async function remove(id: string) { await fetch('/api/watchlist', { method: 'DELETE', body: JSON.stringify({ id }) }); setItems(p => p.filter(w => w.id !== id)); }
  async function toggleAlert(item: any) { const updated = !item.alert_enabled; await fetch('/api/watchlist', { method: 'PATCH', body: JSON.stringify({ id: item.id, alert_enabled: updated, target_price: item.target_price }) }); setItems(p => p.map(w => w.id === item.id ? { ...w, alert_enabled: updated } : w)); }
  async function saveTarget(id: string) { if (!editTarget) return; const target = parseFloat(editTarget.value) || null; await fetch('/api/watchlist', { method: 'PATCH', body: JSON.stringify({ id, target_price: target, alert_enabled: target != null }) }); setItems(p => p.map(w => w.id === id ? { ...w, target_price: target ?? undefined } : w)); setEditTarget(null); }
  const atTarget = items.filter(w => w.at_target);
  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-white">Watchlist</h1><p className="text-secondary text-sm">{items.length} stocks tracked</p></div>
        <StockSearch placeholder="Add to watchlist..." />
      </div>
      {atTarget.length > 0 && <div className="bg-accent-yellow/10 border border-accent-yellow/30 rounded-xl px-4 py-3 flex items-center gap-3"><Bell size={16} className="text-accent-yellow shrink-0"/><p className="text-sm text-accent-yellow"><strong>{atTarget.length}</strong> stock{atTarget.length>1?'s have':' has'} reached your target: {atTarget.map(w=>w.ticker).join(', ')}</p></div>}
      {loading ? <div className="flex items-center justify-center py-24"><Loader2 size={22} className="animate-spin text-accent-green"/></div>
      : items.length === 0 ? <div className="flex flex-col items-center justify-center py-24 text-center"><Star size={40} className="text-muted mb-4"/><h2 className="text-lg font-semibold text-white mb-2">Your watchlist is empty</h2><p className="text-secondary text-sm max-w-xs">Search for stocks and click ★ to track them here.</p></div>
      : <div className="space-y-3">
          <div className="card">
            <p className="text-xs text-secondary mb-3">Set target prices to track entry/exit points.</p>
            <div className="space-y-2">
              {items.map(item => (
                <div key={item.id} className="flex items-center justify-between gap-3 py-2 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-sm font-semibold text-white w-16 shrink-0">{item.ticker}</span>
                    <span className="text-xs text-secondary truncate hidden sm:block">{item.stock_data?.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {editTarget?.id === item.id ? (
                      <><span className="text-xs text-muted">$</span><input type="number" step="0.01" value={editTarget.value} onChange={e => setEditTarget({id:item.id,value:e.target.value})} className="input w-24 py-1 text-xs" autoFocus/>
                      <button onClick={() => saveTarget(item.id)} className="p-1 rounded text-accent-green hover:bg-accent-green/10"><Check size={14}/></button>
                      <button onClick={() => setEditTarget(null)} className="p-1 rounded text-muted hover:bg-surface-3"><X size={14}/></button></>
                    ) : (
                      <><span className="text-xs font-mono text-accent-yellow">{item.target_price ? '$'+item.target_price : 'No target'}</span>
                      <button onClick={() => setEditTarget({id:item.id,value:String(item.target_price??'')})} className="p-1 rounded text-muted hover:text-white hover:bg-surface-3 transition-colors"><Pencil size={12}/></button>
                      <button onClick={() => toggleAlert(item)} className={"p-1 rounded transition-colors "+(item.alert_enabled?'text-accent-yellow':'text-muted hover:text-white')+' hover:bg-surface-3'}>{item.alert_enabled?<Bell size={12}/>:<BellOff size={12}/>}</button></>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">{items.map(item => <StockCard key={item.id} item={item} mode="watchlist" onRemove={() => remove(item.id)}/>)}</div>
        </div>}
    </div>
  );
}
