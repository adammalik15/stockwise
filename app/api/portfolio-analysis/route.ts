import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchStockData } from '@/services/yahoo-finance';
import { generatePortfolioAnalysis } from '@/services/claude';

const SECTOR_COLORS: Record<string,string> = { 'Technology':'#4d9fff','Healthcare':'#00d4aa','Financial Services':'#ffd166','Consumer Cyclical':'#ff9f43','Industrials':'#a29bfe','Energy':'#e17055','Other':'#636e72' };

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: holdings } = await supabase.from('portfolios').select('*').eq('user_id', user.id);
  if (!holdings || holdings.length === 0) return NextResponse.json({ error: 'No holdings found' }, { status: 404 });
  const enriched = await Promise.all(holdings.map(async h => {
    const stock = await fetchStockData(h.ticker);
    const price = stock?.price ?? h.purchase_price;
    const val = price * h.quantity; const cost = h.purchase_price * h.quantity;
    return { ...h, stock, current_value: val, cost_basis: cost, gain_loss: val - cost, gain_loss_percent: cost > 0 ? ((val - cost) / cost) * 100 : 0 };
  }));
  const totalValue = enriched.reduce((s, h) => s + h.current_value, 0);
  const totalCost = enriched.reduce((s, h) => s + h.cost_basis, 0);
  const sectorMap: Record<string,number> = {};
  enriched.forEach(h => { const s = h.stock?.sector ?? 'Other'; sectorMap[s] = (sectorMap[s] ?? 0) + h.current_value; });
  const allocationBySector = Object.entries(sectorMap).sort(([,a],[,b]) => b-a).map(([label, value]) => ({ label, value, percentage: totalValue > 0 ? (value/totalValue)*100 : 0, color: SECTOR_COLORS[label] ?? SECTOR_COLORS['Other'] }));
  const assetMap: Record<string,number> = {};
  enriched.forEach(h => { const t = h.asset_type; assetMap[t] = (assetMap[t] ?? 0) + h.current_value; });
  const allocationByAssetType = Object.entries(assetMap).sort(([,a],[,b]) => b-a).map(([label, value], i) => ({ label, value, percentage: totalValue > 0 ? (value/totalValue)*100 : 0, color: ['#00d4aa','#4d9fff','#ffd166','#ff4d6d','#a29bfe'][i%5] }));
  const capMap: Record<string,number> = { 'Large Cap (>$10B)':0, 'Mid Cap ($2B-$10B)':0, 'Small Cap (<$2B)':0, 'Unknown':0 };
  enriched.forEach(h => { const mc = h.stock?.market_cap; if (!mc) capMap['Unknown'] += h.current_value; else if (mc >= 10e9) capMap['Large Cap (>$10B)'] += h.current_value; else if (mc >= 2e9) capMap['Mid Cap ($2B-$10B)'] += h.current_value; else capMap['Small Cap (<$2B)'] += h.current_value; });
  const allocationByMarketCap = Object.entries(capMap).filter(([,v]) => v > 0).map(([label, value]) => ({ label, value, percentage: totalValue > 0 ? (value/totalValue)*100 : 0, color: '#4d9fff' }));
  const riskFlags: any[] = [];
  enriched.forEach(h => { const pct = totalValue > 0 ? (h.current_value/totalValue)*100 : 0; if (pct > 30) riskFlags.push({ type: 'concentration', severity: pct > 50 ? 'high' : 'medium', message: h.ticker + ' makes up ' + pct.toFixed(1) + '% of your portfolio.', tickers: [h.ticker] }); });
  allocationBySector.forEach(s => { if (s.percentage > 50) riskFlags.push({ type: 'sector', severity: 'high', message: s.percentage.toFixed(1) + '% in ' + s.label + ' creates significant sector risk.' }); });
  const sectorCount = Object.keys(sectorMap).length;
  const assetTypeCount = Object.keys(assetMap).length;
  const maxConc = Math.max(...enriched.map(h => totalValue > 0 ? (h.current_value/totalValue)*100 : 0));
  const diversificationScore = Math.round(Math.min(100, (sectorCount/8)*40) + Math.min(20, (assetTypeCount/4)*20) + Math.max(0, 40 - Math.max(0, maxConc - 20)));
  const holdingsForAI = enriched.map(h => ({ ticker: h.ticker, name: h.stock?.name ?? h.ticker, sector: h.stock?.sector ?? 'Unknown', asset_type: h.asset_type, current_value: h.current_value, gain_loss_percent: h.gain_loss_percent, market_cap: h.stock?.market_cap }));
  const aiInsights = await generatePortfolioAnalysis(holdingsForAI, totalValue, diversificationScore);
  return NextResponse.json({ total_value: totalValue, total_cost: totalCost, total_gain_loss: totalValue - totalCost, total_gain_loss_percent: totalCost > 0 ? ((totalValue - totalCost)/totalCost)*100 : 0, diversification_score: diversificationScore, allocation_by_sector: allocationBySector, allocation_by_asset_type: allocationByAssetType, allocation_by_market_cap: allocationByMarketCap, risk_flags: riskFlags, ai_insights: aiInsights, recommendations: [sectorCount < 4 ? 'Add more sectors for better diversification.' : 'Good sector spread.', maxConc > 30 ? 'Consider reducing your largest position.' : 'Position sizing looks balanced.'] });
}
