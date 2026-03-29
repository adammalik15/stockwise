const fs = require('fs');
const path = require('path');

function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✓ Created: ' + filePath);
}

// ─── next.config.js ───────────────────────────────────────────────────────────
write('next.config.js', `/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['yahoo-finance2'],
  },
};
module.exports = nextConfig;
`);

// ─── tailwind.config.js ───────────────────────────────────────────────────────
write('tailwind.config.js', `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0a0a0f',
          1: '#111118',
          2: '#18181f',
          3: '#1f1f28',
          4: '#26262f',
        },
        accent: {
          green: '#00d4aa',
          red: '#ff4d6d',
          blue: '#4d9fff',
          yellow: '#ffd166',
          purple: '#9b5de5',
        },
        border: {
          DEFAULT: '#2a2a35',
          subtle: '#1e1e28',
        },
      },
      backgroundImage: {
        'gradient-mesh':
          'radial-gradient(at 40% 20%, hsla(168,100%,41%,0.08) 0px, transparent 50%), radial-gradient(at 80% 0%, hsla(220,100%,66%,0.06) 0px, transparent 50%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
`);

// ─── middleware.ts ─────────────────────────────────────────────────────────────
write('middleware.ts', `import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const protectedPaths = ['/dashboard', '/watchlist', '/portfolio', '/portfolio-analysis', '/discover', '/stock'];
  const isProtected = protectedPaths.some(p => pathname.startsWith(p));
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }
  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
`);

// ─── types/index.ts ───────────────────────────────────────────────────────────
write('types/index.ts', `export interface Portfolio {
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
`);

// ─── lib/supabase/client.ts ───────────────────────────────────────────────────
write('lib/supabase/client.ts', `import { createBrowserClient } from '@supabase/ssr';
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
`);

// ─── lib/supabase/server.ts ───────────────────────────────────────────────────
write('lib/supabase/server.ts', `import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {}
        },
      },
    }
  );
}

export function createServiceClient() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
`);

// ─── services/yahoo-finance.ts ────────────────────────────────────────────────
write('services/yahoo-finance.ts', `import yahooFinance from 'yahoo-finance2';
import { createServiceClient } from '@/lib/supabase/server';
import type { StockData, PricePoint } from '@/types';

const CACHE_TTL_MINUTES = 15;

export async function fetchStockData(ticker: string): Promise<StockData | null> {
  const upper = ticker.toUpperCase();
  try {
    const supabase = createServiceClient();
    const { data: cached } = await supabase.from('stock_data_cache').select('*').eq('ticker', upper).single();
    if (cached) {
      const age = (Date.now() - new Date(cached.last_updated).getTime()) / 60000;
      if (age < CACHE_TTL_MINUTES) return cached as StockData;
    }
    const [quote, summary] = await Promise.allSettled([
      yahooFinance.quote(upper),
      yahooFinance.quoteSummary(upper, { modules: ['assetProfile'] }),
    ]);
    if (quote.status === 'rejected') return null;
    const q = quote.value;
    const qs = summary.status === 'fulfilled' ? summary.value : null;
    const stockData: StockData = {
      ticker: upper,
      name: q.longName || q.shortName || upper,
      price: q.regularMarketPrice ?? 0,
      change: q.regularMarketChange ?? 0,
      change_percent: q.regularMarketChangePercent ?? 0,
      market_cap: q.marketCap ?? undefined,
      pe_ratio: q.trailingPE ?? undefined,
      sector: qs?.assetProfile?.sector ?? undefined,
      industry: qs?.assetProfile?.industry ?? undefined,
      fifty_two_week_high: q.fiftyTwoWeekHigh ?? undefined,
      fifty_two_week_low: q.fiftyTwoWeekLow ?? undefined,
      dividend_yield: q.trailingAnnualDividendYield ?? undefined,
      beta: q.beta ?? undefined,
      volume: q.regularMarketVolume ?? undefined,
      avg_volume: q.averageDailyVolume10Day ?? undefined,
      description: qs?.assetProfile?.longBusinessSummary ?? undefined,
      last_updated: new Date().toISOString(),
    };
    await supabase.from('stock_data_cache').upsert(stockData, { onConflict: 'ticker' });
    return stockData;
  } catch (e) {
    console.error('fetchStockData error:', e);
    return null;
  }
}

export async function fetchPriceHistory(ticker: string, period: '1mo'|'3mo'|'6mo'|'1y'|'2y' = '6mo'): Promise<PricePoint[]> {
  const upper = ticker.toUpperCase();
  const endDate = new Date();
  const startDate = new Date();
  const map: Record<string, number> = { '1mo': 1, '3mo': 3, '6mo': 6, '1y': 12, '2y': 24 };
  startDate.setMonth(startDate.getMonth() - (map[period] ?? 6));
  try {
    const result = await yahooFinance.chart(upper, {
      period1: startDate, period2: endDate,
      interval: period === '1mo' ? '1d' : period === '3mo' ? '1d' : '1wk',
    });
    return (result.quotes ?? []).map((q: any) => ({
      date: new Date(q.date).toISOString().split('T')[0],
      open: q.open ?? 0, high: q.high ?? 0, low: q.low ?? 0,
      close: q.close ?? 0, volume: q.volume ?? 0,
    }));
  } catch (e) { return []; }
}

export async function searchTicker(query: string) {
  try {
    const r = await yahooFinance.search(query, { quotesCount: 8, newsCount: 0 });
    return (r.quotes ?? []).filter((r: any) => r.symbol && r.shortname).map((r: any) => ({
      ticker: r.symbol, name: r.shortname || r.symbol, type: r.typeDisp || 'Stock',
    }));
  } catch { return []; }
}

export function formatMarketCap(v?: number | null) {
  if (!v) return 'N/A';
  if (v >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T';
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
  return '$' + v.toLocaleString();
}
export function formatPercent(v?: number | null) {
  if (v == null) return 'N/A';
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}
export function formatPrice(v?: number | null) {
  if (v == null) return 'N/A';
  return '$' + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
`);

// ─── services/claude.ts ───────────────────────────────────────────────────────
write('services/claude.ts', `export async function generateRecommendation(stock: any, news: any[], timeframe: string) {
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
`);

// ─── app/globals.css ──────────────────────────────────────────────────────────
write('app/globals.css', `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-bg: #0a0a0f;
  --color-text-muted: #6b6b7e;
  --color-text-secondary: #9898ad;
}

* { box-sizing: border-box; }
body { background-color: var(--color-bg); }

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #2a2a35; border-radius: 3px; }

::selection { background: rgba(0,212,170,0.2); color: #00d4aa; }

@layer components {
  .card { @apply bg-surface-1 border border-border rounded-xl p-5; }
  .card-hover { @apply card transition-all duration-200 hover:bg-surface-2 hover:shadow-lg; }
  .btn-primary { @apply bg-accent-green text-surface font-semibold px-4 py-2 rounded-lg transition-all duration-150 hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm; }
  .btn-secondary { @apply bg-surface-3 border border-border text-white font-medium px-4 py-2 rounded-lg transition-all duration-150 hover:bg-surface-4 active:scale-95 disabled:opacity-50 text-sm; }
  .btn-ghost { @apply text-[var(--color-text-secondary)] font-medium px-3 py-1.5 rounded-lg transition-all duration-150 hover:bg-surface-2 hover:text-white text-sm; }
  .badge { @apply inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full; }
  .badge-green { @apply badge bg-accent-green/15 text-accent-green; }
  .badge-red { @apply badge bg-accent-red/15 text-accent-red; }
  .badge-blue { @apply badge bg-accent-blue/15 text-accent-blue; }
  .badge-yellow { @apply badge bg-accent-yellow/15 text-accent-yellow; }
  .badge-purple { @apply badge bg-accent-purple/15 text-accent-purple; }
  .badge-neutral { @apply badge bg-surface-3 text-[var(--color-text-secondary)]; }
  .input { @apply bg-surface-2 border border-border text-white placeholder:text-[var(--color-text-muted)] rounded-lg px-3 py-2 text-sm outline-none transition-all duration-150 focus:border-accent-green/50 focus:ring-1 focus:ring-accent-green/20 disabled:opacity-50; }
  .label { @apply text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider; }
  .stat-value { @apply font-mono text-lg font-semibold text-white; }
  .text-muted { @apply text-[var(--color-text-muted)]; }
  .text-secondary { @apply text-[var(--color-text-secondary)]; }
  .positive { @apply text-accent-green; }
  .negative { @apply text-accent-red; }
  .divider { @apply border-t border-border; }
}

.page-enter { animation: pageEnter 0.3s ease-out; }
@keyframes pageEnter { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
.skeleton { @apply bg-surface-3 rounded animate-pulse; }
`);

// ─── app/layout.tsx ───────────────────────────────────────────────────────────
write('app/layout.tsx', `import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'StockWise — Portfolio Intelligence',
  description: 'Track, analyze, and discover stocks with AI-powered insights.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className + ' bg-surface text-white antialiased'}>
        {children}
      </body>
    </html>
  );
}
`);

// ─── app/(dashboard)/layout.tsx ───────────────────────────────────────────────
write('app/(dashboard)/layout.tsx', `import Navigation from '@/components/layout/Navigation';
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-surface">
      <Navigation />
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
`);

// ─── app/(auth)/login/page.tsx ────────────────────────────────────────────────
write('app/(auth)/login/page.tsx', `'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TrendingUp, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push('/dashboard'); router.refresh();
    } catch (err: any) { setError(err.message ?? 'Login failed'); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="fixed inset-0 bg-gradient-mesh pointer-events-none" />
      <div className="w-full max-w-sm relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-accent-green/15 border border-accent-green/30 flex items-center justify-center mb-4">
            <TrendingUp size={22} className="text-accent-green" />
          </div>
          <h1 className="text-3xl font-bold text-white">StockWise</h1>
          <p className="text-secondary text-sm mt-1">Portfolio Intelligence</p>
        </div>
        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-5">Sign in to your account</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label block mb-1.5">Email</label>
              <input type="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)} className="input w-full" placeholder="you@example.com" />
            </div>
            <div>
              <label className="label block mb-1.5">Password</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="input w-full" placeholder="••••••••" />
            </div>
            {error && <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/20 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
              {loading ? <Loader2 size={15} className="animate-spin mx-auto" /> : 'Sign In'}
            </button>
          </form>
          <div className="divider my-4" />
          <p className="text-center text-sm text-secondary">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-accent-green hover:underline font-medium">Create one free</Link>
          </p>
        </div>
        <p className="text-center text-xs text-muted mt-6">Prices delayed ~15 min. Not financial advice.</p>
      </div>
    </div>
  );
}
`);

// ─── app/(auth)/signup/page.tsx ───────────────────────────────────────────────
write('app/(auth)/signup/page.tsx', `'use client';
import { useState } from 'react';
import Link from 'next/link';
import { TrendingUp, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + '/dashboard' } });
      if (error) throw error;
      setSuccess(true);
    } catch (err: any) { setError(err.message ?? 'Signup failed'); }
    finally { setLoading(false); }
  }

  if (success) return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-14 h-14 rounded-2xl bg-accent-green/15 border border-accent-green/30 flex items-center justify-center mx-auto mb-5">
          <TrendingUp size={24} className="text-accent-green" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Check your email</h2>
        <p className="text-secondary text-sm mb-6">We sent a confirmation link to <strong className="text-white">{email}</strong>.</p>
        <Link href="/login" className="btn-secondary inline-flex">Back to Sign In</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="fixed inset-0 bg-gradient-mesh pointer-events-none" />
      <div className="w-full max-w-sm relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-accent-green/15 border border-accent-green/30 flex items-center justify-center mb-4">
            <TrendingUp size={22} className="text-accent-green" />
          </div>
          <h1 className="text-3xl font-bold text-white">StockWise</h1>
          <p className="text-secondary text-sm mt-1">Start tracking your portfolio</p>
        </div>
        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-5">Create your free account</h2>
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="label block mb-1.5">Email</label>
              <input type="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)} className="input w-full" placeholder="you@example.com" />
            </div>
            <div>
              <label className="label block mb-1.5">Password</label>
              <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} className="input w-full" placeholder="Min. 6 characters" />
            </div>
            {error && <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/20 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
              {loading ? <Loader2 size={15} className="animate-spin mx-auto" /> : 'Create Account'}
            </button>
          </form>
          <div className="divider my-4" />
          <p className="text-center text-sm text-secondary">Already have an account?{' '}
            <Link href="/login" className="text-accent-green hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
`);

// ─── components/layout/Navigation.tsx ────────────────────────────────────────
write('components/layout/Navigation.tsx', `'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Star, Briefcase, BarChart2, Compass, LogOut, TrendingUp, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/watchlist', label: 'Watchlist', icon: Star },
  { href: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { href: '/portfolio-analysis', label: 'Analysis', icon: BarChart2 },
  { href: '/discover', label: 'Discover', icon: Compass },
];

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  const NavContent = () => (
    <>
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-accent-green flex items-center justify-center">
          <TrendingUp size={16} className="text-surface" />
        </div>
        <span className="font-bold text-white text-lg">StockWise</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link key={href} href={href} onClick={() => setMobileOpen(false)}
              className={"flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group " +
                (active ? 'bg-accent-green/10 text-accent-green' : 'text-secondary hover:bg-surface-2 hover:text-white')}>
              <Icon size={17} className={active ? 'text-accent-green' : 'text-muted group-hover:text-white'} />
              {label}
              {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-green" />}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 py-4 border-t border-border">
        <p className="px-3 text-[10px] text-muted mb-2">Prices delayed ~15 min. Not financial advice.</p>
        <button onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-secondary hover:bg-surface-2 hover:text-white transition-all duration-150 group">
          <LogOut size={17} className="text-muted group-hover:text-white" /> Sign Out
        </button>
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden lg:flex flex-col w-56 bg-surface-1 border-r border-border h-screen sticky top-0 shrink-0">
        <NavContent />
      </aside>
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-surface-1 border-b border-border sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent-green flex items-center justify-center">
            <TrendingUp size={14} className="text-surface" />
          </div>
          <span className="font-bold text-white">StockWise</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-1.5 rounded-lg hover:bg-surface-2 text-secondary">
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-64 bg-surface-1 border-r border-border flex flex-col h-full"><NavContent /></div>
          <div className="flex-1 bg-black/60" onClick={() => setMobileOpen(false)} />
        </div>
      )}
    </>
  );
}
`);

// ─── components/stock/StockSearch.tsx ─────────────────────────────────────────
write('components/stock/StockSearch.tsx', `'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Plus, Star, Loader2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function StockSearch({ placeholder = 'Search stocks, ETFs...' }: { placeholder?: string }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [addModal, setAddModal] = useState<{ ticker: string; name: string } | null>(null);
  const searchTimeout = useRef<NodeJS.Timeout>();
  const router = useRouter();

  const handleInput = useCallback((val: string) => {
    setQuery(val);
    clearTimeout(searchTimeout.current);
    if (!val.trim()) { setResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/stocks/search?q=' + encodeURIComponent(val));
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen(true);
      } finally { setLoading(false); }
    }, 350);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (!(e.target as Element).closest('[data-search]')) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function addToWatchlist(ticker: string, e: React.MouseEvent) {
    e.stopPropagation(); setAdding(ticker + '-w');
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from('watchlists').upsert({ user_id: user.id, ticker, asset_type: 'stock', alert_enabled: false }, { onConflict: 'user_id,ticker' });
    setAdding(null); setOpen(false); router.refresh();
  }

  return (
    <>
      <div data-search className="relative w-full max-w-xl">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input type="text" value={query} onChange={e => handleInput(e.target.value)} onFocus={() => results.length > 0 && setOpen(true)}
            placeholder={placeholder} className="input w-full pl-10 pr-10 py-2.5" />
          {loading && <Loader2 size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted animate-spin" />}
          {query && !loading && <button onClick={() => { setQuery(''); setResults([]); setOpen(false); }} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-white"><X size={14} /></button>}
        </div>
        {open && results.length > 0 && (
          <div className="absolute top-full mt-1.5 w-full bg-surface-2 border border-border rounded-xl shadow-xl z-50 overflow-hidden">
            {results.map(r => (
              <div key={r.ticker} onClick={() => { setOpen(false); setQuery(''); router.push('/stock/' + r.ticker); }}
                className="flex items-center justify-between px-4 py-3 hover:bg-surface-3 cursor-pointer group border-b border-border/50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-surface-3 flex items-center justify-center shrink-0">
                    <span className="text-xs font-mono font-bold text-accent-green">{r.ticker.slice(0,2)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{r.ticker}</p>
                    <p className="text-xs text-secondary line-clamp-1">{r.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={e => addToWatchlist(r.ticker, e)} className="p-1.5 rounded-lg bg-surface-4 hover:bg-accent-green/20 text-secondary hover:text-accent-green transition-colors" title="Add to Watchlist">
                    {adding === r.ticker + '-w' ? <Loader2 size={13} className="animate-spin" /> : <Star size={13} />}
                  </button>
                  <button onClick={e => { e.stopPropagation(); setAddModal({ ticker: r.ticker, name: r.name }); setOpen(false); }} className="p-1.5 rounded-lg bg-surface-4 hover:bg-accent-green/20 text-secondary hover:text-accent-green transition-colors" title="Add to Portfolio">
                    <Plus size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {addModal && <AddPortfolioModal ticker={addModal.ticker} name={addModal.name} onClose={() => setAddModal(null)} onSuccess={() => { setAddModal(null); router.refresh(); }} />}
    </>
  );
}

function AddPortfolioModal({ ticker, name, onClose, onSuccess }: any) {
  const [form, setForm] = useState({ quantity: '', purchase_price: '', purchase_date: new Date().toISOString().split('T')[0], asset_type: 'stock', notes: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error: dbError } = await supabase.from('portfolios').upsert({
        user_id: user.id, ticker, asset_type: form.asset_type,
        quantity: parseFloat(form.quantity), purchase_price: parseFloat(form.purchase_price),
        purchase_date: form.purchase_date, notes: form.notes || null,
      }, { onConflict: 'user_id,ticker' });
      if (dbError) throw dbError;
      onSuccess();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface-1 border border-border rounded-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-white mb-1">Add to Portfolio</h2>
        <p className="text-sm text-secondary mb-5">{ticker} — {name}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label block mb-1.5">Quantity *</label><input type="number" step="any" min="0.000001" required value={form.quantity} onChange={e => setForm(p => ({...p, quantity: e.target.value}))} className="input w-full" placeholder="0.00" /></div>
            <div><label className="label block mb-1.5">Purchase Price *</label><input type="number" step="any" min="0" required value={form.purchase_price} onChange={e => setForm(p => ({...p, purchase_price: e.target.value}))} className="input w-full" placeholder="0.00" /></div>
          </div>
          <div><label className="label block mb-1.5">Purchase Date *</label><input type="date" required value={form.purchase_date} onChange={e => setForm(p => ({...p, purchase_date: e.target.value}))} className="input w-full" /></div>
          <div><label className="label block mb-1.5">Asset Type</label>
            <select value={form.asset_type} onChange={e => setForm(p => ({...p, asset_type: e.target.value}))} className="input w-full">
              <option value="stock">Stock</option><option value="etf">ETF</option><option value="commodity">Commodity</option><option value="crypto">Crypto</option>
            </select>
          </div>
          <div><label className="label block mb-1.5">Notes (optional)</label><input type="text" value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} className="input w-full" placeholder="e.g. Long-term hold" /></div>
          {error && <p className="text-sm text-accent-red">{error}</p>}
          <div className="flex gap-3"><button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button><button type="submit" disabled={loading} className="btn-primary flex-1">{loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Add'}</button></div>
        </form>
      </div>
    </div>
  );
}
`);

// ─── components/stock/StockCard.tsx ───────────────────────────────────────────
write('components/stock/StockCard.tsx', `'use client';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Trash2, AlertCircle } from 'lucide-react';
import { formatMarketCap, formatPrice, formatPercent } from '@/services/yahoo-finance';
import type { WatchlistItem, PortfolioItem } from '@/types';

function isPortfolio(item: any): item is PortfolioItem { return 'quantity' in item; }

export default function StockCard({ item, mode, onRemove }: { item: any; mode: 'portfolio'|'watchlist'; onRemove?: () => void }) {
  const stock = item.stock_data;
  const isPos = (stock?.change_percent ?? 0) >= 0;
  const watchItem = !isPortfolio(item) ? item as WatchlistItem : null;
  const fiftyTwoPct = stock?.fifty_two_week_high && stock?.fifty_two_week_low && stock?.price
    ? ((stock.price - stock.fifty_two_week_low) / (stock.fifty_two_week_high - stock.fifty_two_week_low)) * 100 : null;

  return (
    <Link href={'/stock/' + item.ticker} className="block">
      <div className="card-hover group relative">
        {onRemove && (
          <button onClick={e => { e.preventDefault(); onRemove(); }}
            className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-accent-red/20 text-muted hover:text-accent-red transition-all">
            <Trash2 size={13} />
          </button>
        )}
        {watchItem?.at_target && (
          <div className="absolute top-3 left-3"><span className="badge-yellow text-[10px]"><AlertCircle size={10} /> At Target</span></div>
        )}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface-3 flex items-center justify-center shrink-0 border border-border">
              <span className="text-xs font-mono font-bold text-accent-green">{item.ticker.slice(0,2)}</span>
            </div>
            <div>
              <p className="font-semibold text-white text-sm">{item.ticker}</p>
              <p className="text-xs text-secondary line-clamp-1 max-w-[140px]">{stock?.name ?? item.ticker}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-mono font-semibold text-white text-sm">{stock?.price ? formatPrice(stock.price) : '—'}</p>
            <div className={"flex items-center gap-1 justify-end text-xs " + (isPos ? 'text-accent-green' : 'text-accent-red')}>
              {isPos ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              <span>{stock ? formatPercent(stock.change_percent) : '—'}</span>
            </div>
          </div>
        </div>
        {mode === 'portfolio' && isPortfolio(item) && (
          <div className="flex items-center justify-between mb-3 p-2.5 bg-surface-3 rounded-lg">
            <div><p className="text-[10px] text-muted uppercase mb-0.5">Value</p><p className="text-sm font-mono font-semibold text-white">{item.current_value ? formatPrice(item.current_value) : '—'}</p></div>
            <div className="text-right"><p className="text-[10px] text-muted uppercase mb-0.5">P&L</p>
              <p className={"text-sm font-mono font-semibold " + ((item.gain_loss ?? 0) >= 0 ? 'text-accent-green' : 'text-accent-red')}>
                {item.gain_loss != null ? (item.gain_loss >= 0 ? '+' : '') + formatPrice(item.gain_loss) : '—'}
              </p>
            </div>
            <div className="text-right"><p className="text-[10px] text-muted uppercase mb-0.5">Return</p>
              <p className={"text-sm font-mono font-semibold " + ((item.gain_loss_percent ?? 0) >= 0 ? 'text-accent-green' : 'text-accent-red')}>
                {item.gain_loss_percent != null ? (item.gain_loss_percent >= 0 ? '+' : '') + item.gain_loss_percent.toFixed(2) + '%' : '—'}
              </p>
            </div>
          </div>
        )}
        {watchItem?.target_price && (
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-secondary">Target</p>
            <p className="text-xs font-mono font-medium text-accent-yellow">{formatPrice(watchItem.target_price)}</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div><p className="text-[10px] text-muted uppercase mb-0.5">Mkt Cap</p><p className="text-xs font-mono text-secondary">{formatMarketCap(stock?.market_cap)}</p></div>
          <div><p className="text-[10px] text-muted uppercase mb-0.5">P/E</p><p className="text-xs font-mono text-secondary">{stock?.pe_ratio ? stock.pe_ratio.toFixed(1) : 'N/A'}</p></div>
        </div>
        {fiftyTwoPct !== null && (
          <div className="mt-3">
            <div className="flex justify-between text-[10px] text-muted mb-1">
              <span>52W Lo {formatPrice(stock?.fifty_two_week_low)}</span>
              <span>52W Hi {formatPrice(stock?.fifty_two_week_high)}</span>
            </div>
            <div className="h-1 bg-surface-3 rounded-full overflow-hidden">
              <div className="h-full bg-accent-green rounded-full" style={{ width: Math.min(100, Math.max(0, fiftyTwoPct)) + '%' }} />
            </div>
          </div>
        )}
        {stock?.sector && <div className="mt-3"><span className="badge-neutral text-[10px]">{stock.sector}</span></div>}
      </div>
    </Link>
  );
}
`);

// ─── components/charts/PriceChart.tsx ─────────────────────────────────────────
write('components/charts/PriceChart.tsx', `'use client';
import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { PricePoint } from '@/types';

type Period = '1mo'|'3mo'|'6mo'|'1y'|'2y';

export default function PriceChart({ ticker, initialData, currentPrice }: { ticker: string; initialData: PricePoint[]; currentPrice: number }) {
  const [period, setPeriod] = useState<Period>('6mo');
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  async function changePeriod(p: Period) {
    if (p === period) return;
    setPeriod(p); setLoading(true);
    try {
      const res = await fetch('/api/stocks/' + ticker + '/history?period=' + p);
      const json = await res.json();
      setData(json.history ?? []);
    } finally { setLoading(false); }
  }

  const startPrice = data[0]?.close ?? currentPrice;
  const isPos = currentPrice >= startPrice;
  const stroke = isPos ? '#00d4aa' : '#ff4d6d';

  const Tip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-xs">
        <p className="text-secondary mb-1">{new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
        <p className="font-mono font-semibold text-white">\${d.close?.toFixed(2)}</p>
      </div>
    );
  };

  return (
    <div>
      <div className="flex gap-1 mb-4">
        {(['1mo','3mo','6mo','1y','2y'] as Period[]).map(p => (
          <button key={p} onClick={() => changePeriod(p)}
            className={"px-3 py-1 rounded-lg text-xs font-medium transition-all " + (period === p ? 'bg-accent-green/15 text-accent-green' : 'text-secondary hover:text-white hover:bg-surface-2')}>
            {p}
          </button>
        ))}
      </div>
      <div className="relative h-52">
        {loading && <div className="absolute inset-0 flex items-center justify-center bg-surface-1/60 z-10 rounded-lg"><div className="w-5 h-5 border-2 border-accent-green/30 border-t-accent-green rounded-full animate-spin" /></div>}
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.15} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tickFormatter={d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              tick={{ fill: '#6b6b7e', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis domain={['auto','auto']} tick={{ fill: '#6b6b7e', fontSize: 10 }} axisLine={false} tickLine={false}
              tickFormatter={v => '\$' + v.toFixed(0)} width={55} />
            <Tooltip content={<Tip />} />
            <Area type="monotone" dataKey="close" stroke={stroke} strokeWidth={2} fill="url(#pg)" dot={false}
              activeDot={{ r: 4, fill: stroke, strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
`);

// ─── components/stock/AddStockButtons.tsx ────────────────────────────────────
write('components/stock/AddStockButtons.tsx', `'use client';
import { useState } from 'react';
import { Star, Plus, Loader2, Check, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function AddStockButtons({ ticker, inPortfolio, inWatchlist }: { ticker: string; inPortfolio: boolean; inWatchlist: boolean }) {
  const [watchAdded, setWatchAdded] = useState(inWatchlist);
  const [portfolioAdded, setPortfolioAdded] = useState(inPortfolio);
  const [loadingWatch, setLoadingWatch] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();

  async function toggleWatchlist() {
    setLoadingWatch(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (watchAdded) {
      await supabase.from('watchlists').delete().eq('user_id', user.id).eq('ticker', ticker);
      setWatchAdded(false);
    } else {
      await supabase.from('watchlists').upsert({ user_id: user.id, ticker, asset_type: 'stock', alert_enabled: false }, { onConflict: 'user_id,ticker' });
      setWatchAdded(true);
    }
    setLoadingWatch(false);
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={toggleWatchlist} disabled={loadingWatch}
        className={"flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all " +
          (watchAdded ? 'bg-accent-yellow/15 border-accent-yellow/30 text-accent-yellow' : 'bg-surface-2 border-border text-secondary hover:text-white hover:bg-surface-3')}>
        {loadingWatch ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} className={watchAdded ? 'fill-current' : ''} />}
        {watchAdded ? 'Watching' : 'Watch'}
      </button>
      <button onClick={() => setShowModal(true)}
        className={"flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all " +
          (portfolioAdded ? 'bg-accent-green/15 border-accent-green/30 text-accent-green' : 'btn-primary border-transparent')}>
        {portfolioAdded ? <Check size={14} /> : <Plus size={14} />}
        {portfolioAdded ? 'In Portfolio' : 'Add to Portfolio'}
      </button>
      {showModal && (
        <AddModal ticker={ticker} onClose={() => setShowModal(false)} onSuccess={() => { setShowModal(false); setPortfolioAdded(true); router.refresh(); }} />
      )}
    </div>
  );
}

function AddModal({ ticker, onClose, onSuccess }: any) {
  const [form, setForm] = useState({ quantity: '', purchase_price: '', purchase_date: new Date().toISOString().split('T')[0], asset_type: 'stock', notes: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error: dbError } = await supabase.from('portfolios').upsert({
        user_id: user.id, ticker, asset_type: form.asset_type,
        quantity: parseFloat(form.quantity), purchase_price: parseFloat(form.purchase_price),
        purchase_date: form.purchase_date, notes: form.notes || null,
      }, { onConflict: 'user_id,ticker' });
      if (dbError) throw dbError;
      onSuccess();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface-1 border border-border rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">Add {ticker} to Portfolio</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2 text-muted"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label block mb-1.5">Quantity *</label><input type="number" step="any" min="0.000001" required value={form.quantity} onChange={e => setForm(p=>({...p,quantity:e.target.value}))} className="input w-full" placeholder="0.00" /></div>
            <div><label className="label block mb-1.5">Purchase Price *</label><input type="number" step="any" min="0" required value={form.purchase_price} onChange={e => setForm(p=>({...p,purchase_price:e.target.value}))} className="input w-full" placeholder="0.00" /></div>
          </div>
          <div><label className="label block mb-1.5">Date *</label><input type="date" required value={form.purchase_date} onChange={e => setForm(p=>({...p,purchase_date:e.target.value}))} className="input w-full" /></div>
          <div><label className="label block mb-1.5">Type</label>
            <select value={form.asset_type} onChange={e => setForm(p=>({...p,asset_type:e.target.value}))} className="input w-full">
              <option value="stock">Stock</option><option value="etf">ETF</option><option value="commodity">Commodity</option><option value="crypto">Crypto</option>
            </select>
          </div>
          {error && <p className="text-sm text-accent-red">{error}</p>}
          <div className="flex gap-3"><button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button><button type="submit" disabled={loading} className="btn-primary flex-1">{loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Add'}</button></div>
        </form>
      </div>
    </div>
  );
}
`);

// ─── components/stock/RecommendationPanel.tsx ─────────────────────────────────
write('components/stock/RecommendationPanel.tsx', `'use client';
import { useState, useEffect } from 'react';
import { Brain, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';

type Timeframe = 'daily'|'weekly'|'monthly'|'longterm';
const TFS = [{ key: 'daily', label: 'Tomorrow' },{ key: 'weekly', label: 'This Week' },{ key: 'monthly', label: 'This Month' },{ key: 'longterm', label: 'Long Term' }] as const;

export default function RecommendationPanel({ ticker }: { ticker: string }) {
  const [tf, setTf] = useState<Timeframe>('weekly');
  const [rec, setRec] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true); setRec(null);
      try {
        const res = await fetch('/api/recommendation/' + ticker + '?timeframe=' + tf);
        const data = await res.json();
        setRec(data.recommendation ?? null);
      } finally { setLoading(false); }
    }
    load();
  }, [ticker, tf]);

  const cfg: any = {
    BUY: { color: 'text-accent-green', bg: 'bg-accent-green/15 border-accent-green/30', icon: TrendingUp },
    HOLD: { color: 'text-accent-yellow', bg: 'bg-accent-yellow/15 border-accent-yellow/30', icon: Minus },
    SELL: { color: 'text-accent-red', bg: 'bg-accent-red/15 border-accent-red/30', icon: TrendingDown },
  };

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <Brain size={15} className="text-accent-purple" />
        <p className="text-sm font-semibold text-white">AI Recommendation</p>
      </div>
      <div className="flex gap-1 p-1 bg-surface-2 rounded-xl mb-5 w-fit">
        {TFS.map(t => (
          <button key={t.key} onClick={() => setTf(t.key as Timeframe)}
            className={"px-3 py-1.5 rounded-lg text-xs font-medium transition-all " + (tf === t.key ? 'bg-surface-4 text-white' : 'text-secondary hover:text-white')}>
            {t.label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <Loader2 size={24} className="animate-spin text-accent-purple" />
          <p className="text-xs text-secondary">Analyzing {ticker}...</p>
        </div>
      ) : rec ? (() => {
        const c = cfg[rec.signal] ?? cfg.HOLD;
        const Icon = c.icon;
        return (
          <div className="space-y-4">
            <div className={"flex items-center gap-4 p-4 rounded-xl border " + c.bg}>
              <Icon size={28} className={c.color} />
              <div>
                <p className={"text-2xl font-bold " + c.color}>{rec.signal}</p>
                <p className="text-xs text-secondary">{TFS.find(t => t.key === rec.timeframe)?.label} outlook</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-xs text-secondary mb-1">Confidence</p>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                    <div className={"h-full rounded-full bg-current " + c.color} style={{ width: rec.confidence + '%' }} />
                  </div>
                  <span className={"text-sm font-mono font-bold " + c.color}>{rec.confidence}%</span>
                </div>
              </div>
            </div>
            <p className="text-sm text-secondary leading-relaxed">{rec.reasoning}</p>
            <p className="text-[10px] text-muted">Not financial advice. Always do your own research.</p>
          </div>
        );
      })() : <p className="text-sm text-secondary">Could not generate recommendation.</p>}
    </div>
  );
}
`);

// ─── components/stock/NewsPanel.tsx ───────────────────────────────────────────
write('components/stock/NewsPanel.tsx', `'use client';
import { useState, useEffect } from 'react';
import { Newspaper, Loader2, ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function NewsPanel({ ticker }: { ticker: string }) {
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/news/' + ticker).then(r => r.json()).then(d => setNews(d.news ?? [])).finally(() => setLoading(false));
  }, [ticker]);

  const scfg: any = {
    positive: { label: 'Positive', cls: 'badge-green', icon: TrendingUp },
    negative: { label: 'Negative', cls: 'badge-red', icon: TrendingDown },
    neutral:  { label: 'Neutral',  cls: 'badge-neutral', icon: Minus },
  };

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <Newspaper size={15} className="text-accent-blue" />
        <p className="text-sm font-semibold text-white">News & Sentiment</p>
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-accent-blue" /></div>
      ) : news.length === 0 ? (
        <p className="text-sm text-secondary py-4">No recent news. Add a Finnhub API key in .env.local for live news.</p>
      ) : (
        <div className="space-y-3">
          {news.map((a: any) => {
            const c = scfg[a.sentiment] ?? scfg.neutral;
            const Icon = c.icon;
            return (
              <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer"
                className="block p-3 rounded-xl bg-surface-2 hover:bg-surface-3 transition-colors border border-border/50 group">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium leading-snug line-clamp-2 group-hover:text-accent-blue transition-colors">{a.headline}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={c.cls + ' text-[10px]'}><Icon size={9} /> {c.label}</span>
                      <span className="text-[10px] text-muted">{a.source}</span>
                      <span className="text-[10px] text-muted">{new Date(a.published_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <ExternalLink size={12} className="text-muted shrink-0 mt-0.5" />
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
`);

// ─── API routes ───────────────────────────────────────────────────────────────
write('app/api/stocks/search/route.ts', `import { NextRequest, NextResponse } from 'next/server';
import { searchTicker } from '@/services/yahoo-finance';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const q = request.nextUrl.searchParams.get('q') ?? '';
  if (!q.trim()) return NextResponse.json({ results: [] });
  const results = await searchTicker(q);
  return NextResponse.json({ results });
}
`);

write('app/api/stocks/[ticker]/route.ts', `import { NextRequest, NextResponse } from 'next/server';
import { fetchStockData } from '@/services/yahoo-finance';
import { createClient } from '@/lib/supabase/server';

export async function GET(_: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { ticker } = await params;
  const data = await fetchStockData(ticker.toUpperCase());
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(data);
}
`);

write('app/api/stocks/[ticker]/history/route.ts', `import { NextRequest, NextResponse } from 'next/server';
import { fetchPriceHistory } from '@/services/yahoo-finance';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { ticker } = await params;
  const period = (request.nextUrl.searchParams.get('period') ?? '6mo') as any;
  const history = await fetchPriceHistory(ticker, period);
  return NextResponse.json({ history });
}
`);

write('app/api/news/[ticker]/route.ts', `import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';

function scoreSentiment(text: string): 'positive'|'negative'|'neutral' {
  const lower = text.toLowerCase();
  const pos = ['beat','surge','gain','rise','record','growth','profit','strong','upgrade','rally'].filter(w => lower.includes(w)).length;
  const neg = ['miss','fall','drop','loss','decline','weak','downgrade','crash','warning','fraud'].filter(w => lower.includes(w)).length;
  return pos > neg ? 'positive' : neg > pos ? 'negative' : 'neutral';
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { ticker } = await params;
  const upper = ticker.toUpperCase();
  const service = createServiceClient();
  const { data: cached } = await service.from('news_cache').select('*').eq('ticker', upper).order('published_at', { ascending: false }).limit(10);
  if (cached && cached.length > 0) {
    const age = (Date.now() - new Date(cached[0].last_updated).getTime()) / 3600000;
    if (age < 2) return NextResponse.json({ news: cached });
  }
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return NextResponse.json({ news: cached ?? [] });
  try {
    const to = new Date().toISOString().split('T')[0];
    const from = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const res = await fetch('https://finnhub.io/api/v1/company-news?symbol=' + upper + '&from=' + from + '&to=' + to + '&token=' + key);
    const articles = await res.json();
    if (!Array.isArray(articles)) return NextResponse.json({ news: cached ?? [] });
    await service.from('news_cache').delete().eq('ticker', upper);
    const news = articles.slice(0, 10).map((a: any) => ({
      ticker: upper, headline: a.headline, summary: a.summary || a.headline,
      sentiment: scoreSentiment(a.headline + ' ' + (a.summary ?? '')),
      url: a.url, published_at: new Date(a.datetime * 1000).toISOString(),
      source: a.source, last_updated: new Date().toISOString(),
    }));
    if (news.length > 0) await service.from('news_cache').insert(news);
    return NextResponse.json({ news });
  } catch { return NextResponse.json({ news: cached ?? [] }); }
}
`);

write('app/api/recommendation/[ticker]/route.ts', `import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchStockData } from '@/services/yahoo-finance';
import { generateRecommendation } from '@/services/claude';

export async function GET(request: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { ticker } = await params;
  const tf = (request.nextUrl.searchParams.get('timeframe') ?? 'weekly') as any;
  const stock = await fetchStockData(ticker.toUpperCase());
  if (!stock) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { data: news } = await supabase.from('news_cache').select('*').eq('ticker', ticker.toUpperCase()).limit(5);
  const recommendation = await generateRecommendation(stock, news ?? [], tf);
  return NextResponse.json({ recommendation });
}
`);

write('app/api/portfolio/route.ts', `import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchStockData } from '@/services/yahoo-finance';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: holdings } = await supabase.from('portfolios').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  const enriched = await Promise.all((holdings ?? []).map(async h => {
    const stock = await fetchStockData(h.ticker);
    const price = stock?.price ?? h.purchase_price;
    const val = price * h.quantity;
    const cost = h.purchase_price * h.quantity;
    return { ...h, stock_data: stock, current_value: val, gain_loss: val - cost, gain_loss_percent: cost > 0 ? ((val - cost) / cost) * 100 : 0 };
  }));
  return NextResponse.json({ holdings: enriched });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await request.json();
  await supabase.from('portfolios').delete().eq('id', id).eq('user_id', user.id);
  return NextResponse.json({ success: true });
}
`);

write('app/api/watchlist/route.ts', `import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchStockData } from '@/services/yahoo-finance';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: items } = await supabase.from('watchlists').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  const enriched = await Promise.all((items ?? []).map(async w => {
    const stock = await fetchStockData(w.ticker);
    return { ...w, stock_data: stock, at_target: w.target_price != null && stock?.price != null ? stock.price >= w.target_price : false };
  }));
  return NextResponse.json({ watchlist: enriched });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, target_price, alert_enabled } = await request.json();
  await supabase.from('watchlists').update({ target_price, alert_enabled }).eq('id', id).eq('user_id', user.id);
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await request.json();
  await supabase.from('watchlists').delete().eq('id', id).eq('user_id', user.id);
  return NextResponse.json({ success: true });
}
`);

write('app/api/portfolio-analysis/route.ts', `import { NextResponse } from 'next/server';
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
`);

write('app/api/discover/route.ts', `import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const FALLBACK: Record<string,any[]> = {
  short_term: [
    { ticker:'NVDA', name:'NVIDIA', price:130, category:'short_term', reasoning:'Strong momentum from AI chip demand. High institutional interest and volume.', risk_level:'HIGH', sector:'Technology', halal_note:'Verify on Musaffa.com — semiconductor/AI focus, no obvious haram revenue.' },
    { ticker:'META', name:'Meta Platforms', price:610, category:'short_term', reasoning:'Ad revenue recovery and AI investments driving near-term momentum.', risk_level:'MEDIUM', sector:'Communication Services', halal_note:'Verify on Musaffa.com — advertising revenue; some scholars flag social media concerns.' },
    { ticker:'AMZN', name:'Amazon', price:220, category:'short_term', reasoning:'AWS growth and retail margin expansion creating near-term tailwinds.', risk_level:'MEDIUM', sector:'Consumer Cyclical', halal_note:'Verify on Musaffa.com — mixed revenue; check debt ratios.' },
  ],
  long_term: [
    { ticker:'MSFT', name:'Microsoft', price:430, category:'long_term', reasoning:'Durable moat across cloud, productivity, and AI with consistent free cash flow.', risk_level:'LOW', sector:'Technology', halal_note:'Verify on Musaffa.com — tech/cloud, generally considered compliant by many scholars.' },
    { ticker:'PAVE', name:'Global X U.S. Infrastructure ETF', price:40, category:'long_term', reasoning:'Infrastructure spending tailwind with diversified industrials exposure.', risk_level:'LOW', sector:'Industrials', halal_note:'Verify on Musaffa.com — ETF needs full holdings screen via Musaffa ETF tool.' },
    { ticker:'LLY', name:'Eli Lilly', price:810, category:'long_term', reasoning:'GLP-1 pipeline dominance provides decade-long earnings growth runway.', risk_level:'MEDIUM', sector:'Healthcare', halal_note:'Verify on Musaffa.com — pharmaceutical; generally halal if no haram product lines.' },
  ],
  dividend: [
    { ticker:'JNJ', name:'Johnson & Johnson', price:155, category:'dividend', reasoning:'60+ year Dividend Aristocrat with consistent payout growth.', risk_level:'LOW', sector:'Healthcare', halal_note:'Verify on Musaffa.com — diversified healthcare, check debt-to-asset ratios.' },
    { ticker:'XLE', name:'Energy Select Sector SPDR ETF', price:88, category:'dividend', reasoning:'High yield energy ETF with broad sector exposure.', risk_level:'MEDIUM', sector:'Energy', halal_note:'✅ Confirmed Halal on Musaffa.com.' },
    { ticker:'PFE', name:'Pfizer', price:27, category:'dividend', reasoning:'Attractive dividend yield with pipeline recovery potential.', risk_level:'MEDIUM', sector:'Healthcare', halal_note:'Verify on Musaffa.com — pharma; check full screening.' },
  ],
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const category = (request.nextUrl.searchParams.get('category') ?? 'long_term') as string;
  const [{ data: portfolio }, { data: watchlist }] = await Promise.all([
    supabase.from('portfolios').select('ticker').eq('user_id', user.id),
    supabase.from('watchlists').select('ticker').eq('user_id', user.id),
  ]);
  const existing = [...(portfolio ?? []).map(p => p.ticker), ...(watchlist ?? []).map(w => w.ticker)];
  const stocks = (FALLBACK[category] ?? FALLBACK.long_term).filter((s: any) => !existing.includes(s.ticker));
  return NextResponse.json({ stocks, ai_powered: false });
}
`);

// ─── Dashboard page ───────────────────────────────────────────────────────────
write('app/(dashboard)/dashboard/page.tsx', `import { createClient } from '@/lib/supabase/server';
import { fetchStockData } from '@/services/yahoo-finance';
import StockSearch from '@/components/stock/StockSearch';
import StockCard from '@/components/stock/StockCard';
import { TrendingUp, Star, Briefcase, ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: portfolio }, { data: watchlist }] = await Promise.all([
    supabase.from('portfolios').select('*').eq('user_id', user!.id).limit(4),
    supabase.from('watchlists').select('*').eq('user_id', user!.id).limit(4),
  ]);
  const portfolioItems = await Promise.all((portfolio ?? []).map(async h => {
    const stock = await fetchStockData(h.ticker);
    const price = stock?.price ?? h.purchase_price;
    const val = price * h.quantity; const cost = h.purchase_price * h.quantity;
    return { ...h, stock_data: stock ?? undefined, current_value: val, gain_loss: val - cost, gain_loss_percent: cost > 0 ? ((val - cost)/cost)*100 : 0 };
  }));
  const watchlistItems = await Promise.all((watchlist ?? []).map(async w => {
    const stock = await fetchStockData(w.ticker);
    return { ...w, stock_data: stock ?? undefined, at_target: w.target_price != null && stock?.price != null ? stock.price >= w.target_price : false };
  }));
  const isEmpty = portfolioItems.length === 0 && watchlistItems.length === 0;
  const totalValue = portfolioItems.reduce((s, h) => s + (h.current_value ?? 0), 0);
  const totalCost = portfolioItems.reduce((s, h) => s + h.purchase_price * h.quantity, 0);
  const totalGL = totalValue - totalCost;
  const totalGLPct = totalCost > 0 ? (totalGL / totalCost) * 100 : 0;

  return (
    <div className="space-y-8 page-enter">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-secondary text-sm mt-0.5">Your market overview</p>
        </div>
        <StockSearch placeholder="Search & add stocks..." />
      </div>
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent-green/10 border border-accent-green/20 flex items-center justify-center mb-6">
            <TrendingUp size={28} className="text-accent-green" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Start building your portfolio</h2>
          <p className="text-secondary text-sm max-w-sm mb-8">Search for any stock or ETF above and add it to your portfolio or watchlist.</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {['AAPL','MSFT','NVDA','XLE','LLY','PAVE'].map(t => (
              <Link key={t} href={'/stock/' + t} className="px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-sm font-mono text-secondary hover:text-white hover:border-accent-green/40 transition-all">{t}</Link>
            ))}
          </div>
        </div>
      ) : (
        <>
          {portfolioItems.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Portfolio Value', value: '$' + totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
                { label: 'Total Cost', value: '$' + totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
                { label: 'Total P&L', value: (totalGL >= 0 ? '+' : '') + '$' + Math.abs(totalGL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), positive: totalGL >= 0 },
                { label: 'Return', value: (totalGLPct >= 0 ? '+' : '') + totalGLPct.toFixed(2) + '%', positive: totalGLPct >= 0 },
              ].map(s => (
                <div key={s.label} className="card">
                  <p className="label mb-2">{s.label}</p>
                  <p className={"stat-value " + (s.positive === undefined ? 'text-white' : s.positive ? 'text-accent-green' : 'text-accent-red')}>{s.value}</p>
                </div>
              ))}
            </div>
          )}
          {portfolioItems.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2"><Briefcase size={16} className="text-accent-green" /><h2 className="text-base font-semibold text-white">Portfolio</h2><span className="badge-neutral">{portfolioItems.length}</span></div>
                <Link href="/portfolio" className="flex items-center gap-1 text-xs text-secondary hover:text-white">View all <ArrowRight size={12} /></Link>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {portfolioItems.map(item => <StockCard key={item.id} item={item} mode="portfolio" />)}
              </div>
            </section>
          )}
          {watchlistItems.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2"><Star size={16} className="text-accent-yellow" /><h2 className="text-base font-semibold text-white">Watchlist</h2><span className="badge-neutral">{watchlistItems.length}</span></div>
                <Link href="/watchlist" className="flex items-center gap-1 text-xs text-secondary hover:text-white">View all <ArrowRight size={12} /></Link>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {watchlistItems.map(item => <StockCard key={item.id} item={item} mode="watchlist" />)}
              </div>
            </section>
          )}
          <section className="grid sm:grid-cols-2 gap-3">
            <Link href="/portfolio-analysis" className="card-hover flex items-center gap-4 group">
              <div className="w-10 h-10 rounded-xl bg-accent-blue/10 flex items-center justify-center shrink-0"><TrendingUp size={18} className="text-accent-blue" /></div>
              <div><p className="text-sm font-semibold text-white">Portfolio Analysis</p><p className="text-xs text-secondary">Diversification score & insights</p></div>
              <ArrowRight size={14} className="text-muted ml-auto" />
            </Link>
            <Link href="/discover" className="card-hover flex items-center gap-4 group">
              <div className="w-10 h-10 rounded-xl bg-accent-purple/10 flex items-center justify-center shrink-0"><Sparkles size={18} className="text-accent-purple" /></div>
              <div><p className="text-sm font-semibold text-white">Discover Stocks</p><p className="text-xs text-secondary">Curated ideas by strategy</p></div>
              <ArrowRight size={14} className="text-muted ml-auto" />
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
`);

// ─── Portfolio page ───────────────────────────────────────────────────────────
write('app/(dashboard)/portfolio/page.tsx', `'use client';
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
    const csv = [headers,...rows].map(r => r.join(',')).join('\\n');
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
            { label:'Total P&L', value:(isPos?'+':'')+'\$'+Math.abs(totalGL).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}), positive:isPos },
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
`);

// ─── Watchlist page ───────────────────────────────────────────────────────────
write('app/(dashboard)/watchlist/page.tsx', `'use client';
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
`);

// ─── Stock detail page ────────────────────────────────────────────────────────
write('app/(dashboard)/stock/[ticker]/page.tsx', `import { notFound } from 'next/navigation';
import { fetchStockData, fetchPriceHistory, formatMarketCap, formatPrice, formatPercent } from '@/services/yahoo-finance';
import { createClient } from '@/lib/supabase/server';
import PriceChart from '@/components/charts/PriceChart';
import RecommendationPanel from '@/components/stock/RecommendationPanel';
import NewsPanel from '@/components/stock/NewsPanel';
import AddStockButtons from '@/components/stock/AddStockButtons';
import { TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function StockDetailPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const upper = ticker.toUpperCase();
  const [stock, history] = await Promise.all([fetchStockData(upper), fetchPriceHistory(upper, '6mo')]);
  if (!stock) notFound();
  const isPos = (stock.change_percent ?? 0) >= 0;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: inP }, { data: inW }] = await Promise.all([
    supabase.from('portfolios').select('id').eq('user_id', user!.id).eq('ticker', upper).maybeSingle(),
    supabase.from('watchlists').select('id').eq('user_id', user!.id).eq('ticker', upper).maybeSingle(),
  ]);
  const fiftyTwoPct = stock.fifty_two_week_high && stock.fifty_two_week_low
    ? ((stock.price - stock.fifty_two_week_low) / (stock.fifty_two_week_high - stock.fifty_two_week_low)) * 100 : null;

  return (
    <div className="space-y-5 page-enter">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-surface-2 border border-border flex items-center justify-center shrink-0">
            <span className="font-mono font-bold text-accent-green text-lg">{upper.slice(0,2)}</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{upper}</h1>
            <p className="text-secondary text-sm">{stock.name}</p>
            {stock.sector && <div className="flex gap-1.5 mt-1.5"><span className="badge-neutral text-[10px]">{stock.sector}</span>{stock.industry && <span className="badge-neutral text-[10px]">{stock.industry}</span>}</div>}
          </div>
        </div>
        <AddStockButtons ticker={upper} inPortfolio={!!inP} inWatchlist={!!inW} />
      </div>
      <div className="card">
        <div className="flex items-end gap-4 mb-1">
          <span className="text-4xl font-mono font-bold text-white">{formatPrice(stock.price)}</span>
          <div className={"flex items-center gap-1.5 mb-1 " + (isPos ? 'text-accent-green' : 'text-accent-red')}>
            {isPos ? <TrendingUp size={18}/> : <TrendingDown size={18}/>}
            <span className="font-mono font-semibold">{formatPercent(stock.change_percent)}</span>
            <span className="text-sm">({formatPrice(stock.change)} today)</span>
          </div>
        </div>
        <p className="text-[11px] text-muted mb-4">Prices delayed ~15 min</p>
        <PriceChart ticker={upper} initialData={history} currentPrice={stock.price} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:'Market Cap', value:formatMarketCap(stock.market_cap) },
          { label:'P/E Ratio', value:stock.pe_ratio ? stock.pe_ratio.toFixed(1) : 'N/A' },
          { label:'Beta', value:stock.beta ? stock.beta.toFixed(2) : 'N/A' },
          { label:'Dividend Yield', value:stock.dividend_yield ? (stock.dividend_yield*100).toFixed(2)+'%' : 'None' },
        ].map(s => <div key={s.label} className="card"><p className="label mb-2">{s.label}</p><p className="stat-value text-base">{s.value}</p></div>)}
      </div>
      {fiftyTwoPct !== null && (
        <div className="card">
          <p className="label mb-3">52-Week Range</p>
          <div className="flex justify-between text-xs text-secondary mb-2">
            <span>Low: {formatPrice(stock.fifty_two_week_low)}</span>
            <span className="font-mono font-semibold text-white">{formatPrice(stock.price)}</span>
            <span>High: {formatPrice(stock.fifty_two_week_high)}</span>
          </div>
          <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-accent-red via-accent-yellow to-accent-green rounded-full" style={{ width: Math.min(100,Math.max(0,fiftyTwoPct))+'%' }} />
          </div>
          <p className="text-xs text-secondary mt-2">Currently at {fiftyTwoPct.toFixed(0)}% of 52-week range</p>
        </div>
      )}
      {stock.description && (
        <div className="card">
          <p className="label mb-3">About {stock.name}</p>
          <p className="text-sm text-secondary leading-relaxed line-clamp-4">{stock.description}</p>
        </div>
      )}
      <RecommendationPanel ticker={upper} />
      <NewsPanel ticker={upper} />
      <div className="card border-accent-green/20 bg-accent-green/5">
        <div className="flex items-start gap-3">
          <div className="text-xl mt-0.5">☪️</div>
          <div>
            <p className="text-sm font-semibold text-accent-green mb-1">Halal Compliance Check</p>
            <p className="text-xs text-secondary leading-relaxed">
              Sharia compliance must be independently verified. Use{' '}
              <a href={"https://musaffa.com/stock/"+upper} target="_blank" rel="noopener noreferrer" className="text-accent-green underline inline-flex items-center gap-0.5">
                Musaffa.com <ExternalLink size={10}/>
              </a>{' '}
              to screen this stock for Islamic finance compliance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
`);

// ─── Portfolio Analysis page ──────────────────────────────────────────────────
write('app/(dashboard)/portfolio-analysis/page.tsx', `'use client';
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
          { label:'Total P&L', value:(isPos?'+':'')+'\$'+Math.abs(data.total_gain_loss).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}), positive:isPos },
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
`);

// ─── Discover page ────────────────────────────────────────────────────────────
write('app/(dashboard)/discover/page.tsx', `'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Loader2, Zap, Clock, DollarSign, ExternalLink, Star } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

type Category = 'short_term'|'long_term'|'dividend';
const CATS = [
  { key:'short_term', label:'Short-Term', desc:'Momentum plays', icon:<Zap size={15}/>, color:'text-accent-red' },
  { key:'long_term', label:'Long-Term', desc:'Strong fundamentals', icon:<Clock size={15}/>, color:'text-accent-blue' },
  { key:'dividend', label:'Dividend', desc:'Income stocks', icon:<DollarSign size={15}/>, color:'text-accent-green' },
] as const;
const RISK_COLORS: any = { LOW:'badge-green', MEDIUM:'badge-yellow', HIGH:'badge-red' };

export default function DiscoverPage() {
  const [cat, setCat] = useState<Category>('long_term');
  const [stocks, setStocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string|null>(null);
  const router = useRouter();

  const load = useCallback(async (c: Category) => {
    setLoading(true); setStocks([]);
    const res = await fetch('/api/discover?category='+c);
    const data = await res.json();
    setStocks(data.stocks ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(cat); }, [cat, load]);

  async function addToWatchlist(ticker: string) {
    setAdding(ticker);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from('watchlists').upsert({ user_id: user.id, ticker, asset_type: 'stock', alert_enabled: false }, { onConflict: 'user_id,ticker' });
    setAdding(null); router.refresh();
  }

  return (
    <div className="space-y-6 page-enter">
      <div><h1 className="text-2xl font-bold text-white">Discover</h1><p className="text-secondary text-sm">Curated stock ideas by strategy</p></div>
      <div className="flex items-start gap-3 p-4 bg-accent-green/5 border border-accent-green/20 rounded-xl">
        <span className="text-lg mt-0.5">☪️</span>
        <p className="text-xs text-secondary leading-relaxed"><strong className="text-accent-green">Halal Note:</strong> All suggestions must be independently verified. Use <a href="https://musaffa.com" target="_blank" rel="noopener noreferrer" className="text-accent-green underline inline-flex items-center gap-0.5">Musaffa.com <ExternalLink size={10}/></a> to screen each stock.</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {CATS.map(c => (
          <button key={c.key} onClick={() => setCat(c.key as Category)}
            className={"flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all " + (cat===c.key ? 'bg-surface-3 border-accent-green/40 text-white' : 'bg-surface-1 border-border text-secondary hover:text-white hover:bg-surface-2')}>
            <span className={cat===c.key ? c.color : ''}>{c.icon}</span>{c.label}
          </button>
        ))}
      </div>
      {loading ? <div className="flex flex-col items-center justify-center py-20 gap-4"><Loader2 size={28} className="animate-spin text-accent-green"/><p className="text-secondary text-sm">Loading suggestions...</p></div>
      : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stocks.map((s: any) => (
            <div key={s.ticker} className="card-hover group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-surface-3 flex items-center justify-center shrink-0"><span className="text-xs font-mono font-bold text-accent-green">{s.ticker?.slice(0,2)}</span></div>
                  <div><p className="font-semibold text-white text-sm">{s.ticker}</p><p className="text-xs text-secondary">{s.name}</p></div>
                </div>
                <span className={RISK_COLORS[s.risk_level]??'badge-neutral'}>{s.risk_level}</span>
              </div>
              <p className="text-xs text-secondary leading-relaxed mb-3">{s.reasoning}</p>
              <div className="flex items-start gap-1.5 p-2 bg-accent-green/5 rounded-lg border border-accent-green/15 mb-3">
                <span className="text-sm shrink-0">☪️</span>
                <p className="text-[10px] text-secondary leading-relaxed">{s.halal_note}</p>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><span className="badge-neutral text-[10px]">{s.sector}</span>{s.price && <span className="text-xs font-mono text-secondary">~\${s.price}</span>}</div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => addToWatchlist(s.ticker)} disabled={adding===s.ticker} className="p-1.5 rounded-lg bg-surface-3 hover:bg-accent-yellow/20 text-secondary hover:text-accent-yellow transition-colors" title="Add to Watchlist">
                    {adding===s.ticker ? <Loader2 size={13} className="animate-spin"/> : <Star size={13}/>}
                  </button>
                  <Link href={'/stock/'+s.ticker} className="p-1.5 rounded-lg bg-surface-3 hover:bg-accent-blue/20 text-secondary hover:text-accent-blue transition-colors" title="View Details"><ExternalLink size={13}/></Link>
                </div>
              </div>
            </div>
          ))}
        </div>}
      <p className="text-xs text-muted text-center pb-4">⚠️ For informational purposes only. Not financial advice. Verify Halal status independently.</p>
    </div>
  );
}
`);

// ─── Root redirect ─────────────────────────────────────────────────────────────
write('app/page.tsx', `import { redirect } from 'next/navigation';
export default function Home() { redirect('/dashboard'); }
`);

console.log('\\n✅ All files created successfully!');
console.log('\\nNext steps:');
console.log('1. Create your .env.local file with your Supabase keys');
console.log('2. Run: npm run dev');
console.log('3. Open: http://localhost:3000');
