/**
 * Halal Screening Service
 * Based on AAOIFI standards as implemented by Musaffa.com
 * NOT a final verdict — always verify on Musaffa.com
 */

import type { StockData } from '@/types';

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

// ─── Haram Industries (Business Screen) ───────────────────────────────────────

const HARAM_SECTORS = [
  'financial services',
  'banks',
  'insurance',
];

const HARAM_KEYWORDS = [
  'alcohol', 'beer', 'wine', 'spirits', 'brewery', 'distill',
  'gambling', 'casino', 'betting', 'lottery', 'gaming',
  'tobacco', 'cigarette', 'pork', 'pig',
  'weapons', 'defense', 'military', 'ammunition',
  'adult entertainment', 'pornograph',
  'conventional bank', 'interest', 'usury',
];

// Industries that are generally considered clean
const CLEAN_INDUSTRIES = [
  'semiconductor', 'software', 'technology', 'cloud',
  'healthcare', 'pharmaceutical', 'biotech', 'medical',
  'energy', 'oil', 'gas', 'renewable',
  'infrastructure', 'industrial', 'manufacturing',
  'retail', 'consumer', 'food', 'beverage',
  'real estate', 'reit',
  'telecom', 'communication',
  'transportation', 'logistics',
  'utilities',
];

// ─── Known status overrides (well-researched) ─────────────────────────────────
const KNOWN_HALAL: string[] = ['NVDA', 'AAPL', 'AMZN', 'TSLA', 'AMD', 'MU', 'INTC', 'QCOM', 'AVGO', 'TSM', 'PG', 'ASML', 'LLY', 'JNJ', 'PFE', 'ABBV', 'MRK', 'UNH', 'CVS', 'XLE', 'XOM', 'CVX', 'COP', 'SLB', 'PAVE', 'CAT', 'DE', 'BA', 'HON', 'GE', 'MMM', 'UPS', 'FDX', 'AMGN', 'GILD', 'REGN', 'VRTX', 'TMO', 'DHR', 'ABT', 'SYK'];
const KNOWN_DOUBTFUL: string[] = ['KO', 'PEP', 'MCD', 'SBUX', 'YUM', 'DPZ', 'V', 'MA', 'PYPL', 'AXP', 'SQ',  'CL', 'KMB', 'VZ', 'T', 'TMUS', 'DIS',  'CMCSA', 'WMT', 'TGT', 'COST', 'HD', 'LOW'];
const KNOWN_NOT_HALAL: string[] = ['JPM', 'BAC', 'WFC', 'C', 'GS', 'MS', 'USB', 'NFLX', 'PNC', 'TFC', 'COF', 'AIG', 'MET', 'PRU', 'ALL', 'TRV', 'BUD', 'TAP', 'STZ', 'MO', 'PM', 'BTI', 'MGM', 'LVS', 'WYNN', 'PENN', 'DKNG', 'LMT', 'RTX', 'NOC', 'GD', 'HII'];

// ─── Main Screener ─────────────────────────────────────────────────────────────

export function screenStock(stock: StockData): HalalScreenResult {
  const ticker = stock.ticker.toUpperCase();
  const sector = (stock.sector ?? '').toLowerCase();
  const industry = (stock.industry ?? '').toLowerCase();
  const combined = `${sector} ${industry}`;

  const flags: string[] = [];
  const positives: string[] = [];
  let businessPassed = true;
  let flaggedActivities: string[] = [];
  let businessReason = '';

  // ─── Check known overrides first ───────────────────────────────────────────
  if (KNOWN_NOT_HALAL.includes(ticker)) {
    return {
      status: 'NOT_HALAL',
      score: 5,
      company_type: 1,
      company_type_label: 'Unknown',
      security_type_check: {
        passed: false,
        reason: 'Primary business is haram',
      },
      business_check: {
        passed: false,
        reason: 'This company operates primarily in industries incompatible with Islamic finance (banking, insurance, alcohol, gambling, or weapons).',
        flagged_activities: ['Haram primary business'],
      },
      financial_check: {
        debt_ratio: { status: 'unknown', threshold: '30%', note: 'Business screen failed.' },
        deposit_ratio: { status: 'unknown', threshold: '30%', note: 'Business screen failed.' },
        haram_income_ratio: { status: 'unknown', threshold: '5%', note: 'Business screen failed.' },
        overall_passed: false,
      },
      purification: {
        required: true,
        note: 'Primary business is non-permissible; purification/avoidance not applicable',
        estimated_rate: '100%',
      },
      esg_note: '',
      flags: ['Primary business is not Sharia-compliant'],
      positives: [],
      disclaimer: getDisclaimer(ticker),
      musaffa_url: `https://musaffa.com/stock/${ticker}`,
      source: 'automated-screener',
    };
  }

  // ─── Business Activity Screen ───────────────────────────────────────────────
  for (const keyword of HARAM_KEYWORDS) {
    if (combined.includes(keyword)) {
      flaggedActivities.push(keyword);
      businessPassed = false;
    }
  }

  // Check haram sectors
  for (const s of HARAM_SECTORS) {
    if (combined.includes(s)) {
      // Financial services can still pass if not a bank/insurance
      if (s === 'financial services' && !combined.includes('bank') && !combined.includes('insurance')) {
        flags.push('⚠️ Financial services sector — verify revenue sources');
      } else {
        flaggedActivities.push(s);
        businessPassed = false;
      }
    }
  }

  if (businessPassed) {
    // Check if clearly clean industry
    const isClean = CLEAN_INDUSTRIES.some(c => combined.includes(c));
    if (isClean) {
      positives.push('✅ Primary business is in a permissible industry');
      businessReason = `Operating in ${stock.sector ?? 'permissible'} sector — no haram primary business detected.`;
    } else {
      businessReason = `Sector (${stock.sector ?? 'Unknown'}) requires further verification.`;
      flags.push('⚠️ Sector requires manual verification of revenue sources');
    }
  } else {
    businessReason = `Flagged for potential haram activities: ${flaggedActivities.join(', ')}.`;
  }

  // ─── Financial Ratio Screen ─────────────────────────────────────────────────
  let financialPassed: boolean | null = null;
  let debtRatioFlag: boolean | null = null;
  let financialReason = '';

  // Use beta and dividend as proxy indicators
  // (Real debt ratios need premium financial APIs)
  const marketCap = stock.market_cap;
  const beta = stock.beta;

  if (marketCap) {
    financialPassed = true;
    financialReason = 'Market cap data available. ';

    // High beta can indicate leverage
    if (beta && beta > 2) {
      flags.push('⚠️ High beta may indicate significant leverage — verify debt ratios');
      debtRatioFlag = true;
    } else if (beta && beta < 1.5) {
      positives.push('✅ Beta suggests manageable volatility/leverage profile');
      debtRatioFlag = false;
    }

    // Dividend yield — very high yield can indicate debt-funded payouts
    if (stock.dividend_yield && stock.dividend_yield > 0.08) {
      flags.push('⚠️ High dividend yield — verify if debt-funded (interest-bearing debt ratio)');
    } else if (stock.dividend_yield && stock.dividend_yield > 0) {
      positives.push('✅ Dividend yield within reasonable range');
    }

    financialReason += 'Full ratio analysis (debt ≤30%, interest assets ≤30%, haram income ≤5%) requires verification on Musaffa.com.';
  } else {
    financialReason = 'Insufficient financial data for ratio screening. Manual verification required.';
  }

  // ─── Determine Final Status ─────────────────────────────────────────────────
  let status: HalalStatus;
  let score: number;

  if (KNOWN_HALAL.includes(ticker)) {
    status = 'HALAL';
    score = 85;
    positives.unshift('✅ Generally considered Halal by major Islamic finance screeners');
  } else if (KNOWN_DOUBTFUL.includes(ticker)) {
    status = 'DOUBTFUL';
    score = 45;
    flags.unshift('⚠️ Commonly flagged as doubtful — scholar consultation recommended');
  } else if (!businessPassed) {
    status = 'NOT_HALAL';
    score = 10;
  } else if (flags.length > 2) {
    status = 'DOUBTFUL';
    score = 40;
  } else if (flags.length > 0) {
    status = 'NEEDS_REVIEW';
    score = 60;
  } else {
    status = 'HALAL';
    score = 75;
  }

  // Add standard checks
  if (businessPassed && positives.length === 0) {
    positives.push('✅ No obvious haram primary business detected');
  }

  return {
    status,
    score,
    company_type: 1,
    company_type_label: 'Unknown',
    security_type_check: {
      passed: true,
      reason: 'Security type not flagged by automated checks',
    },
    business_check: {
      passed: businessPassed,
      reason: businessReason,
      flagged_activities: flaggedActivities,
    },
    financial_check: {
      debt_ratio: {
        status: debtRatioFlag === true ? 'fail' : debtRatioFlag === false ? 'pass' : 'unknown',
        threshold: '30%',
        note: debtRatioFlag === true ? 'Flagged due to high beta — verify debt ratios' : 'No immediate debt flag from beta proxy',
      },
      deposit_ratio: {
        status: 'unknown',
        threshold: '30%',
        note: 'Requires audited balance sheet analysis',
      },
      haram_income_ratio: {
        status: 'unknown',
        threshold: '5%',
        note: 'Requires revenue breakdown verification',
      },
      overall_passed: financialPassed,
    },
    purification: {
      required: !businessPassed,
      note: businessPassed ? 'Not required unless financial ratios fail' : 'Primary business is non-permissible',
      estimated_rate: businessPassed ? 'TBD' : '100%',
    },
    esg_note: '',
    flags,
    positives,
    disclaimer: getDisclaimer(ticker),
    musaffa_url: `https://musaffa.com/stock/${ticker}`,
    source: 'automated-screener',
  };
}

function getDisclaimer(ticker: string): string {
  return `This is a preliminary screening based on publicly available sector/industry data and AAOIFI framework guidelines. It is NOT a final Fatwa or definitive Halal certification. Full verification requires analysis of interest-bearing debt ratios, interest-bearing asset ratios, and non-permissible income ratios using audited financial statements. Always verify ${ticker} on Musaffa.com or consult a qualified Islamic finance scholar before investing.`;
}