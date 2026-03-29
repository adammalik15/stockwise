export interface Portfolio {
  id: string; user_id: string; ticker: string;
  asset_type: 'stock' | 'etf' | 'commodity' | 'crypto';
  quantity: number; purchase_price: number; purchase_date: string;
  notes?: string; created_at: string;
}
export interface Watchlist {
  id: string; user_id: string; ticker: string;
  asset_type: 'stock' | 'etf' | 'commodity' | 'crypto';
  target_price?: number; alert_enabled: boolean; created_at: string;
}
export interface StockCache {
  ticker: string; name: string; price: number; change: number;
  change_percent: number; market_cap?: number; pe_ratio?: number;
  sector?: string; industry?: string; fifty_two_week_high?: number;
  fifty_two_week_low?: number; dividend_yield?: number; beta?: number;
  volume?: number; avg_volume?: number; description?: string;
  logo_url?: string; last_updated: string;
}
export interface NewsCache {
  id: string; ticker: string; headline: string; summary: string;
  sentiment: 'positive' | 'negative' | 'neutral'; url: string;
  published_at: string; source: string; last_updated: string;
}
export interface StockData extends StockCache { history?: PricePoint[]; }
export interface PricePoint { date: string; open: number; high: number; low: number; close: number; volume: number; }
export interface Recommendation {
  ticker: string; signal: 'BUY' | 'HOLD' | 'SELL'; confidence: number;
  timeframe: 'daily' | 'weekly' | 'monthly' | 'longterm'; reasoning: string;
  price_target?: number; risk_level: 'LOW' | 'MEDIUM' | 'HIGH'; generated_at: string;
}
export interface AllocationItem { label: string; value: number; percentage: number; color: string; }
export interface RiskFlag { type: string; severity: 'low' | 'medium' | 'high'; message: string; tickers?: string[]; }
export interface AIInsights { strengths: string[]; weaknesses: string[]; opportunities: string[]; summary: string; }
export interface PortfolioAnalysis {
  total_value: number; total_cost: number; total_gain_loss: number;
  total_gain_loss_percent: number; diversification_score: number;
  allocation_by_sector: AllocationItem[]; allocation_by_asset_type: AllocationItem[];
  allocation_by_market_cap: AllocationItem[]; risk_flags: RiskFlag[];
  ai_insights: AIInsights; recommendations: string[];
}
export interface PortfolioItem extends Portfolio {
  stock_data?: StockCache; current_value?: number; gain_loss?: number; gain_loss_percent?: number;
}
export interface WatchlistItem extends Watchlist { stock_data?: StockCache; at_target?: boolean; }

export type HalalStatus = 'HALAL' | 'DOUBTFUL' | 'NOT_HALAL' | 'NEEDS_REVIEW';

export interface HalalScreenResult {
  status: HalalStatus;
  score: number;
  company_type: 1 | 2 | 3;
  company_type_label: string;
  security_type_check: {
    passed: boolean;
    reason: string;
  };
  business_check: {
    passed: boolean;
    reason: string;
    flagged_activities: string[];
  };
  financial_check: {
    debt_ratio: { status: 'pass' | 'fail' | 'unknown'; threshold: string; note: string };
    deposit_ratio: { status: 'pass' | 'fail' | 'unknown'; threshold: string; note: string };
    haram_income_ratio: { status: 'pass' | 'fail' | 'unknown'; threshold: string; note: string };
    overall_passed: boolean | null;
  };
  purification: {
    required: boolean;
    note: string;
    estimated_rate: string;
  };
  esg_note: string;
  flags: string[];
  positives: string[];
  disclaimer: string;
  musaffa_url: string;
  source: string;
}