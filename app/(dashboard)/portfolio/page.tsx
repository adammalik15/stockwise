'use client';

import { useEffect, useState, useCallback } from 'react';
import StockCard from '@/components/stock/StockCard';
import StockSearch from '@/components/stock/StockSearch';
import { Briefcase, Download, Loader2, X, Plus, Minus, Hash, FolderPlus, Pencil, Trash2, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type EditMode = 'add' | 'reduce' | 'set';

interface Group { id: string; name: string; }

export default function PortfolioPage() {
  const [holdings, setHoldings]   = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [groups, setGroups]       = useState<Group[]>([]);
  const [activeGroup, setActiveGroup] = useState<string | null>(null); // null = All
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [editGroupId, setEditGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [groupLoading, setGroupLoading] = useState(false);

  const [editItem, setEditItem]   = useState<any>(null);
  const [editMode, setEditMode]   = useState<EditMode>('add');
  const [editForm, setEditForm]   = useState({ quantity: '', purchase_price: '', purchase_date: '', term: 'long', notes: '' });
  const [saving, setSaving]       = useState(false);
  const [editError, setEditError] = useState('');

  const loadGroups = useCallback(async () => {
    const res = await fetch('/api/portfolio-groups');
    if (res.ok) { const d = await res.json(); setGroups(d.groups ?? []); }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const url = activeGroup ? `/api/portfolio?group_id=${activeGroup}` : '/api/portfolio';
    const res = await fetch(url);
    const data = await res.json();
    setHoldings(data.holdings ?? []);
    setLoading(false);
  }, [activeGroup]);

  useEffect(() => { loadGroups(); }, [loadGroups]);
  useEffect(() => { load(); }, [load]);

  async function remove(id: string) {
    await fetch('/api/portfolio', { method: 'DELETE', body: JSON.stringify({ id }) });
    setHoldings(p => p.filter(h => h.id !== id));
  }

  async function createGroup() {
    if (!newGroupName.trim()) return;
    setGroupLoading(true);
    const res = await fetch('/api/portfolio-groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newGroupName }) });
    if (res.ok) { const d = await res.json(); setGroups(p => [...p, d.group]); setNewGroupName(''); setShowNewGroup(false); }
    setGroupLoading(false);
  }

  async function renameGroup() {
    if (!editGroupId || !editGroupName.trim()) return;
    setGroupLoading(true);
    await fetch('/api/portfolio-groups', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editGroupId, name: editGroupName }) });
    setGroups(p => p.map(g => g.id === editGroupId ? { ...g, name: editGroupName } : g));
    setEditGroupId(null);
    setGroupLoading(false);
  }

  async function deleteGroup(id: string) {
    setGroupLoading(true);
    await fetch('/api/portfolio-groups', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setGroups(p => p.filter(g => g.id !== id));
    if (activeGroup === id) setActiveGroup(null);
    setGroupLoading(false);
  }

  function startEdit(item: any) {
    setEditItem(item);
    setEditMode('add');
    setEditError('');
    setEditForm({ quantity: '', purchase_price: String(item.purchase_price), purchase_date: item.purchase_date, term: item.term ?? 'long', notes: item.notes ?? '' });
  }

  async function saveEdit() {
    if (!editItem) return;
    setEditError(''); setSaving(true);
    try {
      const supabase = createClient();
      const inputQty = parseFloat(editForm.quantity);
      if (isNaN(inputQty) || inputQty <= 0) { setEditError('Please enter a valid quantity greater than 0.'); setSaving(false); return; }
      let newQuantity: number;
      if (editMode === 'add') newQuantity = editItem.quantity + inputQty;
      else if (editMode === 'reduce') {
        newQuantity = editItem.quantity - inputQty;
        if (newQuantity <= 0) { setEditError('Cannot reduce below 0. Use Remove to delete this holding.'); setSaving(false); return; }
      } else newQuantity = inputQty;

      await supabase.from('portfolios').update({
        quantity: newQuantity,
        purchase_price: parseFloat(editForm.purchase_price),
        purchase_date: editForm.purchase_date,
        term: editForm.term,
        notes: editForm.notes || null,
      }).eq('id', editItem.id);

      // Record transaction
      await supabase.from('portfolio_transactions').insert({
        user_id: editItem.user_id, ticker: editItem.ticker,
        type: editMode === 'add' ? 'buy' : editMode === 'reduce' ? 'sell' : 'set',
        quantity: inputQty, price: parseFloat(editForm.purchase_price),
        date: editForm.purchase_date, notes: editForm.notes || null,
      }).then(() => {});

      setEditItem(null); load();
    } finally { setSaving(false); }
  }

  function exportCSV() {
    const headers = ['Ticker', 'Type', 'Term', 'Shares', 'Avg Buy Price', 'Date', 'Current Price', 'Value', 'P&L', 'Return%'];
    const rows = holdings.map(h => [h.ticker, h.asset_type, h.term ?? 'long', h.quantity, h.purchase_price, h.purchase_date, h.stock_data?.price ?? '', h.current_value?.toFixed(2) ?? '', h.gain_loss?.toFixed(2) ?? '', h.gain_loss_percent?.toFixed(2) ?? '']);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'portfolio.csv'; a.click();
  }

  const totalValue = holdings.reduce((s, h) => s + (h.current_value ?? 0), 0);
  const totalCost  = holdings.reduce((s, h) => s + h.purchase_price * h.quantity, 0);
  const totalGL    = totalValue - totalCost;
  const totalGLPct = totalCost > 0 ? (totalGL / totalCost) * 100 : 0;
  const isPos      = totalGL >= 0;

  const editModes: { key: EditMode; label: string; icon: any; desc: string }[] = [
    { key: 'add',    label: 'Buy More',  icon: Plus,  desc: 'Add shares to existing position' },
    { key: 'reduce', label: 'Sell Some', icon: Minus, desc: 'Remove shares from position' },
    { key: 'set',    label: 'Set Exact', icon: Hash,  desc: 'Set exact share count' },
  ];

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Portfolio</h1>
          <p className="text-secondary text-sm mt-0.5">{holdings.length} holding{holdings.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          {holdings.length > 0 && <button onClick={exportCSV} className="btn-secondary flex items-center gap-2"><Download size={14} /> Export CSV</button>}
          <StockSearch placeholder="Add stock…" />
        </div>
      </div>

      {/* Portfolio group tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setActiveGroup(null)}
          className={'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ' + (!activeGroup ? 'bg-accent-green/15 border-accent-green/40 text-accent-green' : 'bg-surface-2 border-border text-secondary hover:text-white')}>
          All Holdings
        </button>
        {groups.map(g => (
          <div key={g.id} className="flex items-center gap-1">
            {editGroupId === g.id ? (
              <div className="flex items-center gap-1">
                <input autoFocus value={editGroupName} onChange={e => setEditGroupName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') renameGroup(); if (e.key === 'Escape') setEditGroupId(null); }}
                  className="input py-1 px-2 text-xs w-28" />
                <button onClick={renameGroup} disabled={groupLoading} className="p-1 rounded text-accent-green hover:bg-accent-green/10"><Check size={12} /></button>
                <button onClick={() => setEditGroupId(null)} className="p-1 rounded text-muted hover:text-white"><X size={12} /></button>
              </div>
            ) : (
              <button onClick={() => setActiveGroup(g.id)}
                className={'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ' + (activeGroup === g.id ? 'bg-accent-green/15 border-accent-green/40 text-accent-green' : 'bg-surface-2 border-border text-secondary hover:text-white')}>
                {g.name}
              </button>
            )}
            {editGroupId !== g.id && (
              <div className="flex items-center gap-0.5">
                <button onClick={() => { setEditGroupId(g.id); setEditGroupName(g.name); }} className="p-1 rounded text-muted hover:text-white transition-colors"><Pencil size={11} /></button>
                <button onClick={() => deleteGroup(g.id)} className="p-1 rounded text-muted hover:text-accent-red transition-colors"><Trash2 size={11} /></button>
              </div>
            )}
          </div>
        ))}
        {showNewGroup ? (
          <div className="flex items-center gap-1">
            <input autoFocus value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createGroup(); if (e.key === 'Escape') { setShowNewGroup(false); setNewGroupName(''); } }}
              className="input py-1 px-2 text-xs w-32" placeholder="Portfolio name" />
            <button onClick={createGroup} disabled={groupLoading} className="p-1 rounded text-accent-green hover:bg-accent-green/10"><Check size={12} /></button>
            <button onClick={() => { setShowNewGroup(false); setNewGroupName(''); }} className="p-1 rounded text-muted hover:text-white"><X size={12} /></button>
          </div>
        ) : (
          <button onClick={() => setShowNewGroup(true)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-muted hover:text-white border border-dashed border-border hover:border-accent-green/40 transition-all">
            <FolderPlus size={12} /> New portfolio
          </button>
        )}
      </div>

      {/* Summary stats */}
      {holdings.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Value', value: '$' + totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
            { label: 'Total Cost',  value: '$' + totalCost.toLocaleString(undefined,  { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
            { label: 'Total P&L',   value: (isPos ? '+' : '') + '$' + Math.abs(totalGL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), positive: isPos },
            { label: 'Return',      value: (isPos ? '+' : '') + totalGLPct.toFixed(2) + '%', positive: isPos },
          ].map(s => (
            <div key={s.label} className="card">
              <p className="label mb-1.5">{s.label}</p>
              <p className={'stat-value ' + (s.positive === undefined ? 'text-white' : s.positive ? 'text-accent-green' : 'text-accent-red')}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface-1 border border-border rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-lg font-semibold text-white">Update {editItem.ticker}</h2>
                <p className="text-xs text-secondary mt-0.5">Currently holding <strong className="text-white">{editItem.quantity} shares</strong> @ ${editItem.purchase_price}</p>
              </div>
              <button onClick={() => setEditItem(null)} className="p-1.5 rounded-lg hover:bg-surface-2 text-muted"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-3 gap-2 my-4">
              {editModes.map(m => (
                <button key={m.key} onClick={() => { setEditMode(m.key); setEditError(''); }}
                  className={'flex flex-col items-center gap-1 p-3 rounded-xl border text-xs font-medium transition-all ' + (editMode === m.key ? 'bg-accent-green/15 border-accent-green/40 text-accent-green' : 'bg-surface-2 border-border text-secondary hover:text-white')}>
                  <m.icon size={16} />{m.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted mb-4">{editModes.find(m => m.key === editMode)?.desc}</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label block mb-1.5">{editMode === 'add' ? 'Shares to Buy' : editMode === 'reduce' ? 'Shares to Sell' : 'New Total Shares'}</label>
                  <input type="number" step="any" min="0.000001" value={editForm.quantity} onChange={e => setEditForm(p => ({ ...p, quantity: e.target.value }))} className="input w-full" placeholder="0.00" autoFocus />
                </div>
                <div>
                  <label className="label block mb-1.5">Avg Buy Price</label>
                  <input type="number" step="any" min="0" value={editForm.purchase_price} onChange={e => setEditForm(p => ({ ...p, purchase_price: e.target.value }))} className="input w-full" />
                </div>
              </div>
              {editForm.quantity && !isNaN(parseFloat(editForm.quantity)) && (
                <div className="p-3 bg-surface-2 rounded-lg">
                  <p className="text-xs text-secondary">New total: <strong className="text-white">
                    {editMode === 'add' ? (editItem.quantity + parseFloat(editForm.quantity)).toFixed(4) : editMode === 'reduce' ? (editItem.quantity - parseFloat(editForm.quantity)).toFixed(4) : parseFloat(editForm.quantity).toFixed(4)} shares
                  </strong></p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label block mb-1.5">Purchase Date</label>
                  <input type="date" value={editForm.purchase_date} onChange={e => setEditForm(p => ({ ...p, purchase_date: e.target.value }))} className="input w-full" />
                </div>
                <div>
                  <label className="label block mb-1.5">Horizon</label>
                  <select value={editForm.term} onChange={e => setEditForm(p => ({ ...p, term: e.target.value }))} className="input w-full">
                    <option value="long">Long-Term</option>
                    <option value="short">Short-Term</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label block mb-1.5">Notes</label>
                <input type="text" value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} className="input w-full" placeholder="e.g. Long-term hold" />
              </div>
              {editError && <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/20 rounded-lg px-3 py-2">{editError}</p>}
              <div className="flex gap-3">
                <button onClick={() => setEditItem(null)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={saveEdit} disabled={saving} className="btn-primary flex-1">
                  {saving ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 size={22} className="animate-spin text-accent-green" /></div>
      ) : holdings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Briefcase size={40} className="text-muted mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">No holdings yet</h2>
          <p className="text-secondary text-sm max-w-xs">Search for a stock above and click + to add it.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {holdings.map(item => (
            <StockCard key={item.id} item={item} mode="portfolio" onRemove={() => remove(item.id)} onEdit={() => startEdit(item)} />
          ))}
        </div>
      )}
    </div>
  );
}
