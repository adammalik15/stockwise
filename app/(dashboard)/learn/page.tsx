'use client';

import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

interface Lesson {
  id: string;
  title: string;
  emoji: string;
  plain: string;
  detail: string;
  example?: string;
  islam?: string;
  levels?: { label: string; meaning: string }[];
}

const SECTIONS: { title: string; emoji: string; lessons: Lesson[] }[] = [
  {
    title: 'Trading Basics',
    emoji: '📌',
    lessons: [
      {
        id: 'stock', emoji: '🏢', title: 'What is a Stock?',
        plain: 'A stock is a small piece of ownership in a company. When you buy a share of NVDA, you literally own a fraction of NVIDIA Corporation.',
        detail: 'Companies sell stocks to raise money for growth. As the company grows and becomes more valuable, your shares become worth more. You may also receive dividends — a share of the profits.',
        example: 'If NVIDIA has 10 billion shares outstanding and you own 10 shares, you own 0.0000001% of the company. Small, but real ownership.',
        islam: 'Owning stocks is permitted in Islam when the company\'s business is halal. You are a partner (sharik) in the company, sharing in profits and losses — a concept aligned with Islamic finance principles.',
      },
      {
        id: 'bull', emoji: '🐂', title: 'Bull vs Bear Market',
        plain: 'A bull market is when prices are rising broadly over time. A bear market is when prices are falling broadly — typically defined as a 20%+ decline from recent highs.',
        detail: 'Bull markets are driven by economic growth, investor optimism, and strong corporate earnings. Bear markets are driven by recessions, fear, or external shocks.',
        example: '2020–2021 was a strong bull market. Late 2022 was a bear market as the Fed raised interest rates aggressively.',
        islam: 'Both markets present opportunities for the patient Muslim investor. Dollar-cost averaging through bear markets has historically produced excellent long-term results.',
      },
      {
        id: 'cap', emoji: '💰', title: 'Market Capitalisation',
        plain: 'Market cap = share price × total number of shares. It represents the total market value of a company.',
        detail: 'Mega-cap: $500B+  ·  Large-cap: $10B–$500B  ·  Mid-cap: $2B–$10B  ·  Small-cap: under $2B. Larger companies are generally more stable but grow more slowly.',
        example: 'NVDA at $130/share × 24B shares = ~$3.1 trillion market cap — one of the largest companies in the world.',
      },
      {
        id: 'volume', emoji: '📊', title: 'Why Volume Matters',
        plain: 'Volume is the number of shares traded in a day. It confirms whether a price move has genuine participation behind it.',
        detail: 'A stock jumping 3% on normal volume might be noise. The same jump on 3× normal volume means institutions and large players are buying — much more meaningful.',
        example: 'NVDA usually trades 300M shares/day. If it breaks to a new high on 700M volume, that breakout is likely to sustain. On 150M volume, it may quickly reverse.',
        levels: [
          { label: 'Below 0.8×', meaning: 'Low conviction — price move may not sustain' },
          { label: '1.0–1.3×',   meaning: 'Normal — watch other signals' },
          { label: '1.3–2.0×',   meaning: 'Confirmed — meaningful participation' },
          { label: '2.0×+',      meaning: 'Strong — institutional involvement likely' },
        ],
      },
    ],
  },
  {
    title: 'Technical Indicators',
    emoji: '📈',
    lessons: [
      {
        id: 'rsi', emoji: '⚡', title: 'RSI — Relative Strength Index',
        plain: 'A "fatigue meter" for momentum. Measures how fast and how much a stock has moved recently on a 0–100 scale.',
        detail: 'RSI is calculated by comparing average gains to average losses over 14 days. It tells you if a stock has moved too far too fast (overbought) or fallen too far too fast (oversold).',
        example: 'AMD falls from $100 to $72 in 3 weeks. RSI drops to 24 (oversold). Historically, this level has preceded bounces. Not a guarantee, but a useful signal to watch for reversal.',
        levels: [
          { label: 'Below 30',  meaning: 'Oversold — potential bounce zone, watch for reversal signals' },
          { label: '30–50',     meaning: 'Neutral to recovering — no strong signal' },
          { label: '50–65',     meaning: 'Healthy momentum — ideal for breakout setups' },
          { label: '65–78',     meaning: 'Elevated — momentum strong but watch for fatigue' },
          { label: 'Above 78',  meaning: 'Overbought — our scanner auto-rejects these' },
        ],
        islam: 'RSI helps avoid chasing stocks that have already moved dramatically — consistent with Islamic caution against speculation and excessive risk (maisir).',
      },
      {
        id: 'macd', emoji: '〰️', title: 'MACD — Momentum Trend Indicator',
        plain: 'Shows whether price momentum is accelerating or slowing by comparing two moving averages (12-day and 26-day).',
        detail: 'MACD Line = EMA-12 minus EMA-26. When the MACD line crosses above the Signal line (a 9-day average of MACD), it\'s a bullish signal. The histogram shows the gap between them.',
        example: 'NVDA\'s MACD histogram goes from -0.5 to +0.2 while price is still recovering. This "divergence" often precedes price catching up to the improving momentum.',
        levels: [
          { label: 'Histogram expanding positive', meaning: 'Bullish momentum accelerating — strong signal' },
          { label: 'Histogram positive but shrinking', meaning: 'Bullish but losing steam — prepare to exit' },
          { label: 'Histogram negative', meaning: 'Bearish — momentum against you' },
          { label: 'MACD crossing signal line', meaning: 'Key event — crossover from below = buy signal' },
        ],
      },
      {
        id: 'ema', emoji: '📉', title: 'EMA — Exponential Moving Average',
        plain: 'A running average of recent prices that gives more weight to recent days. Used to identify trend direction and find support/resistance.',
        detail: 'Unlike a simple average, EMA reacts faster to recent price changes. EMA-20 = trend of last 20 days. EMA-50 = medium-term trend. When price is above both, the trend is bullish.',
        example: 'AMD falls from $100 to $82, then bounces off its 50-day EMA at $80. The EMA acted as a support floor — exactly where experienced traders were watching to buy.',
        levels: [
          { label: 'Price above EMA-20 & EMA-50', meaning: 'Bullish — full trend alignment, our top signal' },
          { label: 'Price above EMA-20 only',     meaning: 'Partial — short-term bullish, medium-term uncertain' },
          { label: 'Price below EMA-20 & EMA-50', meaning: 'Bearish — trend against you, avoid long entries' },
        ],
      },
      {
        id: 'atr', emoji: '📏', title: 'ATR — Average True Range',
        plain: 'How much a stock typically moves in a single day in dollar terms. A volatility ruler.',
        detail: 'ATR measures the average of the daily trading range (high minus low, adjusted for gaps) over 14 days. It tells you how wide to set stops and how to size positions properly.',
        example: 'NVDA\'s ATR is $4.50. We set stop-loss 1.5 × ATR = $6.75 below entry. On a $100 entry, stop at $93.25. With $10,000 capital, 3% risk = $300 ÷ $6.75 = ~44 shares.',
        islam: 'ATR-based position sizing is the practical application of protecting wealth (hifz al-mal) — one of the five objectives (maqasid) of Islamic law.',
      },
      {
        id: 'vwap', emoji: '⚖️', title: 'VWAP — Volume-Weighted Average Price',
        plain: 'The average price paid for the stock weighted by how much was traded at each price. The institutional benchmark.',
        detail: 'VWAP resets daily. Large institutions are evaluated on whether they bought below or above VWAP — so it becomes a magnet that price often returns to.',
        example: 'NVDA gaps up 3% at open but the VWAP is $2 below. Through the day, price often drifts back toward VWAP as institutions buy dips there and traders take profits above.',
        levels: [
          { label: 'Price above VWAP', meaning: 'Bullish intraday bias — institutions paying up' },
          { label: 'Price below VWAP', meaning: 'Bearish intraday bias — selling pressure dominant' },
          { label: 'Price crossing VWAP', meaning: 'Momentum shift — watch for direction change' },
        ],
      },
      {
        id: 'obv', emoji: '🌊', title: 'OBV — On-Balance Volume',
        plain: 'Cumulative volume indicator that adds volume on up-days and subtracts it on down-days. Detects hidden accumulation before price moves.',
        detail: 'OBV often leads price. If a stock is range-bound but OBV is steadily rising, institutions are quietly accumulating — a potential breakout signal. The opposite signals distribution.',
        example: 'SHOP trades sideways for 3 weeks between $70–$75. OBV climbs 15% during this period. A week later, SHOP breaks out to $82 on high volume. OBV detected the accumulation early.',
        levels: [
          { label: 'OBV rising with price',  meaning: 'Trend confirmed — both price and volume agree' },
          { label: 'OBV rising, price flat', meaning: 'Accumulation — potential breakout ahead' },
          { label: 'OBV falling, price flat',meaning: 'Distribution — potential breakdown ahead' },
          { label: 'Divergence with price',  meaning: 'Warning — trend may be about to reverse' },
        ],
      },
      {
        id: 'adx', emoji: '🎯', title: 'ADX — Average Directional Index',
        plain: 'Measures trend strength, not direction. Answers the question: "Is this a real trend worth trading, or just noise?"',
        detail: 'ADX is calculated from directional movement — how much each new high extends the previous high (+DI) and each new low extends the previous low (−DI). When +DI > −DI and ADX is rising, the uptrend is genuine.',
        example: 'You see AMD rising every day for a week. ADX is 15 (weak). It might be random noise, not a real trend. Same rise but ADX at 35 (strong)? The trend is real — institutions are positioned.',
        levels: [
          { label: 'ADX below 20',  meaning: 'Weak/sideways — avoid momentum strategies' },
          { label: 'ADX 20–30',     meaning: 'Developing trend — watch for continuation' },
          { label: 'ADX 30–50',     meaning: 'Strong trend — momentum strategies work well' },
          { label: 'ADX above 50',  meaning: 'Very strong — watch for exhaustion and reversal' },
        ],
      },
      {
        id: 'stoch', emoji: '🔄', title: 'Stochastic Oscillator',
        plain: 'Compares the current closing price to its recent high-low range. Faster than RSI at detecting short-term reversals.',
        detail: '%K is the raw stochastic (where is the close relative to the recent range). %D is a 3-day average of %K that smooths the signal. A %K crossing above %D from below is a buy signal.',
        example: 'AMD drops and Stochastic hits 12 (oversold). Two days later, %K crosses above %D from below. Combined with RSI at 32, this double confirmation has historically preceded bounces.',
        levels: [
          { label: 'Below 20',          meaning: 'Oversold — potential bounce, wait for crossover' },
          { label: '20–80',             meaning: 'Neutral range — no extreme signal' },
          { label: 'Above 80',          meaning: 'Overbought — potential reversal, watch for %K/%D cross' },
          { label: '%K crosses above %D', meaning: 'Buy signal (from oversold) or continuation' },
          { label: '%K crosses below %D', meaning: 'Sell signal (from overbought)' },
        ],
      },
    ],
  },
  {
    title: 'Support, Resistance & Levels',
    emoji: '🏔️',
    lessons: [
      {
        id: 'sr2', emoji: '🧱', title: 'Support & Resistance',
        plain: 'Price levels where buying (support) or selling (resistance) has historically concentrated. Think of them as floors and ceilings.',
        detail: 'Support forms at price levels where buyers consistently stepped in to stop a decline. Resistance forms where sellers consistently pushed price back down. The more times a level is tested, the stronger it becomes.',
        example: 'NVDA has bounced three times off $110. This level is now strong support. When price returns to $110 again, many traders set buy orders there — the floor reinforces itself.',
        islam: 'Trading at clear support and resistance levels — rather than guessing — is a disciplined approach aligned with Islamic emphasis on knowledge over speculation.',
      },
      {
        id: 'fib2', emoji: '🌀', title: 'Fibonacci Retracements',
        plain: 'Key support and resistance levels derived from the Fibonacci sequence (1,1,2,3,5,8,13...). Used globally by institutional traders.',
        detail: 'When a stock makes a significant move, it often retraces (pulls back) a predictable portion before continuing. The key levels are 23.6%, 38.2%, 50%, and 61.8% of the prior move.',
        example: 'NVDA rallies from $80 to $140 (range = $60). The 61.8% retracement = $80 + ($60 × 0.382) = $102.92. When NVDA pulls back during a correction, watch $103 as a natural support level.',
        levels: [
          { label: '23.6%', meaning: 'Shallow retracement — strong trend, minor pullback' },
          { label: '38.2%', meaning: 'Normal pullback — healthy correction in uptrend' },
          { label: '50.0%', meaning: 'Midpoint — psychologically important level' },
          { label: '61.8%', meaning: 'Golden ratio — strongest Fibonacci level, often decisive' },
        ],
        islam: 'Fibonacci ratios appear throughout nature and the Quran repeatedly references mathematical harmony in creation (Quran 54:49). Many traders find resonance between Islamic appreciation for divine proportion and these mathematical levels.',
      },
      {
        id: 'pivot2', emoji: '📍', title: 'Pivot Points',
        plain: 'Daily support and resistance levels calculated from the previous day\'s high, low, and close. The original floor-trading benchmarks.',
        detail: 'Pivot Point (PP) = (Previous High + Previous Low + Previous Close) / 3. From PP you calculate R1, R2 (resistance) and S1, S2 (support). These are widely watched by institutional traders.',
        example: 'Yesterday: High $125, Low $118, Close $122. PP = ($125+$118+$122)/3 = $121.67. R1 = 2×$121.67 - $118 = $125.34. If today\'s price bounces off $125.34, the pivot worked.',
      },
    ],
  },
  {
    title: 'Risk Management',
    emoji: '🛡️',
    lessons: [
      {
        id: 'risk', emoji: '⚠️', title: 'The 3% Rule — Position Sizing',
        plain: 'Never risk more than 3% of your total trading capital on any single trade.',
        detail: 'If you have $10,000 in your trading account, max risk per trade = $300. Your stop-loss determines how many shares you buy. If stop is $3 away from entry, max shares = $300 ÷ $3 = 100 shares.',
        example: 'Entry: $50 · Stop: $47.50 · Stop distance: $2.50 · Capital at risk: $10,000 × 3% = $300 · Shares: 300 ÷ 2.50 = 120 shares · Position value: $6,000',
        islam: 'The 3% rule is a practical implementation of not exposing wealth to excessive uncertainty (gharar) — a core prohibition in Islamic finance.',
      },
      {
        id: 'rr2', emoji: '⚖️', title: 'Risk:Reward Ratio',
        plain: 'How much you stand to gain relative to how much you risk. A trade with 1:2 R:R means you risk $1 to potentially make $2.',
        detail: 'A 50% win rate is profitable with 1:2 R:R (10 trades: 5 wins × $200 = +$1000, 5 losses × $100 = -$500, net = +$500). Never take trades with less than 1:1.5 R:R.',
        levels: [
          { label: 'Below 1:1',  meaning: 'Avoid — you\'d need >50% win rate to be profitable' },
          { label: '1:1 to 1:2', meaning: 'Acceptable — minimum we consider' },
          { label: '1:2 to 1:3', meaning: 'Good — our target range' },
          { label: 'Above 1:3',  meaning: 'Excellent — rare but high-quality setups' },
        ],
        islam: 'Positive R:R ratios distinguish structured trading from gambling — trades have defined, calculated outcomes rather than pure chance.',
      },
      {
        id: 'stop', emoji: '🛑', title: 'Stop Loss — Capital Preservation First',
        plain: 'A stop-loss is a pre-set price at which you automatically exit a losing trade. It is not optional.',
        detail: 'We set stop-losses using ATR (volatility-based). Stop = Entry - (ATR × 1.5). This gives the trade enough room to breathe while protecting against large losses. Never move a stop against you.',
        example: 'You buy AMD at $85. ATR = $3.20. Stop = $85 - ($3.20 × 1.5) = $80.20. If AMD falls to $80.20, you exit. The loss is controlled. Without a stop, a further decline to $65 would be catastrophic.',
        islam: 'Protecting wealth (hifz al-mal) is one of the five necessities (daruriyyat) in Islamic jurisprudence. Stop-losses are a practical tool for wealth protection.',
      },
      {
        id: 'drawdown', emoji: '📉', title: '5% Daily Drawdown Rule',
        plain: 'Stop all trading for the rest of the day if your portfolio drops 5% in a single session.',
        detail: 'Bad trading days are real — emotions cloud judgment, the market may be in a panic, and losses compound quickly. A 5% daily limit prevents a bad day from becoming a catastrophic week.',
        example: '$10,000 portfolio. 5% = $500. If three trades all go wrong and you\'re down $500 for the day — stop. Close everything. Review tomorrow. Emotional trading from this point almost always makes things worse.',
        islam: 'The Prophet (ﷺ) said "Do not harm yourself or others" (Hadith — La darar wa la dirar). The 5% rule prevents self-inflicted financial harm in moments of poor judgment.',
      },
    ],
  },
  {
    title: 'Islamic Finance',
    emoji: '🕌',
    lessons: [
      {
        id: 'halalstock', emoji: '✅', title: 'What Makes a Stock Halal?',
        plain: 'A stock is generally halal if the company\'s primary business is permissible and its financial ratios are within Islamic thresholds.',
        detail: 'The AAOIFI (Accounting and Auditing Organization for Islamic Financial Institutions) framework screens stocks in two steps: (1) Business screen — is the core business halal? (2) Financial screen — are debt and interest-based assets below set thresholds?',
        levels: [
          { label: 'Business screen', meaning: 'No alcohol, tobacco, gambling, interest-based finance, weapons, adult entertainment' },
          { label: 'Debt ratio',      meaning: 'Interest-bearing debt must be below 30% of total assets' },
          { label: 'Interest income', meaning: 'Income from interest must be below 5% of total revenue' },
          { label: 'Liquid assets',   meaning: 'Cash + receivables must be below 33% of market cap' },
        ],
        islam: 'Verify every stock on Musaffa.com before investing. Our automated screen is a preliminary filter, not a fatwa.',
      },
      {
        id: 'purification', emoji: '🧹', title: 'Purification (Tazkiyah)',
        plain: 'When a company earns a small portion of income from impermissible sources, you can still invest if that portion is below the threshold — but must "purify" that equivalent amount by donating to charity.',
        detail: 'If 2% of Apple\'s revenue comes from interest income and you earn $500 profit, you donate 2% × $500 = $10 to charity. This cleanses the earnings and makes the investment permissible.',
        example: 'Musaffa.com provides the purification rate per share for each stock. Some brokers are beginning to automate this calculation.',
      },
      {
        id: 'gharar', emoji: '⚠️', title: 'Gharar — Excessive Uncertainty',
        plain: 'Gharar means excessive uncertainty or ambiguity in a financial transaction. It is prohibited in Islamic finance.',
        detail: 'Pure speculation — where you\'re essentially gambling on an outcome you have no information about — is gharar. Trading based on documented signals, analysis, and defined risk management is not gharar because you\'re making an informed, structured decision.',
        example: 'Buying NVDA because "I have a feeling it will go up" = gharar. Buying NVDA because RSI is at 28 (historical buy zone), volume is 2× average, earnings beat expectations, and you have a defined stop at 1.5×ATR = not gharar.',
        islam: 'Our trading framework — signal confirmation, position sizing, stop-losses — is specifically designed to minimise gharar and align trading with Islamic principles of knowledge and structured risk.',
      },
      {
        id: 'zakat', emoji: '💝', title: 'Zakat on Investments',
        plain: 'Zakat is due on investment portfolios that have been held for a full lunar year and exceed the nisab threshold.',
        detail: 'The nisab is the value of 85 grams of gold (approximately $5,500–$7,000 at current prices). If your total net wealth exceeds this, 2.5% zakat is due annually.',
        example: 'Portfolio value: $25,000. Trading profits in the year: $3,000. Cash on hand: $5,000. Total zakatable wealth: $33,000. Zakat = $33,000 × 2.5% = $825 to be donated.',
        islam: 'Consult a qualified Islamic scholar for your specific situation. Zakat calculation for stocks can vary based on the school of thought and whether stocks are held for trading or long-term investment.',
      },
    ],
  },
];

function LessonCard({ lesson }: { lesson: Lesson }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card p-0 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-surface-2 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{lesson.emoji}</span>
          <span className="text-sm font-semibold text-white">{lesson.title}</span>
        </div>
        {open ? <ChevronUp size={14} className="text-muted shrink-0" /> : <ChevronDown size={14} className="text-muted shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border">
          <p className="text-sm text-secondary leading-relaxed mt-3">{lesson.plain}</p>
          <p className="text-xs text-muted leading-relaxed">{lesson.detail}</p>

          {lesson.example && (
            <div className="bg-surface-2 rounded-xl p-3 border border-border">
              <p className="text-[10px] text-accent-green font-bold uppercase tracking-wide mb-1">Example</p>
              <p className="text-xs text-secondary leading-relaxed">{lesson.example}</p>
            </div>
          )}

          {lesson.levels && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted uppercase tracking-wide font-bold">How to read it</p>
              {lesson.levels.map(l => (
                <div key={l.label} className="flex gap-3 text-xs">
                  <span className="font-mono font-bold text-accent-green w-32 shrink-0">{l.label}</span>
                  <span className="text-secondary">{l.meaning}</span>
                </div>
              ))}
            </div>
          )}

          {lesson.islam && (
            <div className="bg-accent-green/5 border border-accent-green/20 rounded-xl p-3">
              <p className="text-[10px] text-accent-green font-bold mb-1">🕌 Islamic Finance Context</p>
              <p className="text-xs text-secondary leading-relaxed">{lesson.islam}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function LearnPage() {
  const [openSection, setOpenSection] = useState<string | null>('Technical Indicators');

  return (
    <div className="space-y-5 page-enter">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BookOpen size={20} className="text-accent-green" />
          Trading Education
        </h1>
        <p className="text-secondary text-sm mt-0.5">
          Plain-English guides to every indicator, concept, and Islamic finance principle used in Ziqron
        </p>
      </div>

      {SECTIONS.map(section => (
        <div key={section.title} className="space-y-2">
          <button
            onClick={() => setOpenSection(openSection === section.title ? null : section.title)}
            className="w-full flex items-center justify-between p-3 bg-surface-2 rounded-xl border border-border hover:bg-surface-3 transition-colors"
          >
            <span className="text-sm font-bold text-white flex items-center gap-2">
              <span>{section.emoji}</span> {section.title}
              <span className="text-[10px] text-muted font-normal">({section.lessons.length} topics)</span>
            </span>
            {openSection === section.title
              ? <ChevronUp size={14} className="text-muted" />
              : <ChevronDown size={14} className="text-muted" />
            }
          </button>

          {openSection === section.title && (
            <div className="space-y-2 pl-2">
              {section.lessons.map(lesson => (
                <LessonCard key={lesson.id} lesson={lesson} />
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="card p-4 border border-accent-yellow/20 bg-accent-yellow/5">
        <p className="text-xs text-accent-yellow font-semibold mb-1">⚠️ Educational Disclaimer</p>
        <p className="text-xs text-secondary leading-relaxed">
          This education library is for informational purposes only. Technical analysis does not guarantee future performance.
          Always consult a qualified Islamic finance scholar for halal rulings specific to your situation.
          Ziqron is not a financial advisor. You bear full responsibility for your investment decisions.
        </p>
      </div>
    </div>
  );
}
