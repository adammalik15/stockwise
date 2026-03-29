export async function generateRecommendation(stock: any, news: any[], timeframe: string) {
  const signal = (stock.change_percent ?? 0) > 2 ? 'BUY' : (stock.change_percent ?? 0) < -2 ? 'SELL' : 'HOLD';
  return {
    ticker: stock.ticker, signal, confidence: 55, timeframe,
    reasoning: 'Rule-based signal from recent price momentum. Add an Anthropic API key for full AI analysis.',
    risk_level: (stock.beta ?? 1) > 1.5 ? 'HIGH' : (stock.beta ?? 1) > 1 ? 'MEDIUM' : 'LOW',
    generated_at: new Date().toISOString(),
  };
}
export async function generatePortfolioAnalysis(holdings: any[], totalValue: number, score: number) {
  return {
    strengths: ['Portfolio is being tracked successfully.', 'Diversification score has been calculated.'],
    weaknesses: ['Add an Anthropic API key for deeper AI insights.'],
    opportunities: ['Consider exploring the Discover page for new ideas.'],
    summary: 'Your portfolio analysis is ready. Add an Anthropic API key to unlock full AI-powered insights including detailed strengths, weaknesses, and personalised recommendations.',
  };
}
export async function generateDiscovery(category: string, existing: string[]) { return []; }
