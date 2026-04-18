import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchAnalystTargets } from '@/services/fmp';

const ALPACA_KEY    = process.env.ALPACA_KEY_ID;
const ALPACA_SECRET = process.env.ALPACA_SECRET;
const FINNHUB_KEY   = process.env.FINNHUB_API_KEY;
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ALPACA_BASE   = 'https://data.alpaca.markets/v2/stocks';
const FH_BASE       = 'https://finnhub.io/api/v1';
const ADMIN_EMAIL   = 'adammalik15@gmail.com';

// ── Halal universe ────────────────────────────────────────────────────────────
// halal: 'high' = pre-screened clean | 'medium' = likely ok, verify | 'doubtful' = verify before trading
const UNIVERSE: Record<string, { halal:'high'|'medium'|'doubtful'; sector:string; tier:'small'|'medium'|'large'|'big'; description:string }> = {
  // SMALL < $25
  RKLB:{ halal:'high',    sector:'Aerospace',      tier:'small',  description:'Space launch & satellite services company' },
  RIVN:{ halal:'high',    sector:'EV',             tier:'small',  description:'Electric vehicle manufacturer focused on commercial fleets' },
  LCID:{ halal:'high',    sector:'EV',             tier:'small',  description:'Luxury electric vehicle maker' },
  PLUG:{ halal:'high',    sector:'Clean Energy',   tier:'small',  description:'Hydrogen fuel cell systems provider' },
  JOBY:{ halal:'high',    sector:'Aviation',       tier:'small',  description:'Electric air taxi development company' },
  SOUN:{ halal:'high',    sector:'AI',             tier:'small',  description:'AI-powered voice technology for enterprises' },
  HIMS:{ halal:'high',    sector:'Healthcare',     tier:'small',  description:'Telehealth platform for hair loss, ED, and wellness' },
  ACHR:{ halal:'high',    sector:'Aviation',       tier:'small',  description:'Electric vertical takeoff aircraft developer' },
  ASTS:{ halal:'high',    sector:'Space',          tier:'small',  description:'Space-based broadband cellular network' },
  RXRX:{ halal:'high',    sector:'BioTech',        tier:'small',  description:'AI drug discovery using machine learning' },
  BBAI:{ halal:'high',    sector:'AI',             tier:'small',  description:'AI analytics for national security applications' },
  NIO: { halal:'high',    sector:'EV',             tier:'small',  description:'Chinese premium electric vehicle manufacturer' },
  LAZR:{ halal:'high',    sector:'Autonomous',     tier:'small',  description:'Lidar sensors for autonomous vehicle systems' },
  XPEV:{ halal:'high',    sector:'EV',             tier:'small',  description:'Chinese smart electric vehicle company' },
  AMPX:{ halal:'high',    sector:'Energy Storage', tier:'small',  description:'Lithium-silicon battery technology developer' },
  FSLY:{ halal:'high',    sector:'Cloud/CDN',      tier:'small',  description:'Edge cloud platform for fast content delivery' },
  SGML:{ halal:'high',    sector:'Materials',      tier:'small',  description:'Lithium carbonate producer for EV batteries' },
  VETO:{ halal:'high',    sector:'Healthcare',     tier:'small',  description:'Healthcare innovation company' },
  SRPT:{ halal:'high',    sector:'BioTech',        tier:'small',  description:'Rare disease gene therapy biotech' },
  // MEDIUM $26–$100
  AMD: { halal:'high',    sector:'Semiconductors', tier:'medium', description:'Advanced Micro Devices — CPUs, GPUs, AI chips' },
  QCOM:{ halal:'high',    sector:'Semiconductors', tier:'medium', description:'Mobile chipsets and wireless technology licensing' },
  MU:  { halal:'high',    sector:'Semiconductors', tier:'medium', description:'Memory and storage chips (DRAM, NAND)' },
  SHOP:{ halal:'high',    sector:'E-Commerce',     tier:'medium', description:'E-commerce platform for small and medium businesses' },
  NET: { halal:'high',    sector:'Cloud',          tier:'medium', description:'Global network services — CDN, security, DNS' },
  DDOG:{ halal:'high',    sector:'Cloud',          tier:'medium', description:'Cloud monitoring and observability platform' },
  ZS:  { halal:'high',    sector:'Cybersecurity',  tier:'medium', description:'Cloud-native zero trust security platform' },
  CRWD:{ halal:'high',    sector:'Cybersecurity',  tier:'medium', description:'Endpoint protection and threat intelligence' },
  OKTA:{ halal:'high',    sector:'Cybersecurity',  tier:'medium', description:'Identity and access management (IAM) platform' },
  PLTR:{ halal:'medium',  sector:'AI/Data',        tier:'medium', description:'Data analytics — serves both commercial and government/defense clients' },
  MDB: { halal:'high',    sector:'Cloud DB',       tier:'medium', description:'NoSQL database platform (MongoDB)' },
  ON:  { halal:'high',    sector:'Semiconductors', tier:'medium', description:'Power and signal management semiconductors' },
  CELH:{ halal:'high',    sector:'Beverages',      tier:'medium', description:'Celsius energy drinks — rapid global expansion' },
  SNAP:{ halal:'medium',  sector:'Social',         tier:'medium', description:'Snapchat social media platform' },
  CIEN:{ halal:'high',    sector:'Telecom Tech',   tier:'medium', description:'Optical networking equipment and software' },
  SNDK:{ halal:'high',    sector:'Storage',        tier:'medium', description:'Flash storage products (SanDisk spin-off)' },
  TWLO:{ halal:'high',    sector:'Cloud',          tier:'medium', description:'Cloud communications APIs (SMS, voice, email)' },
  ZETA:{ halal:'doubtful',sector:'Ad Tech',        tier:'medium', description:'Data-driven marketing technology platform' },
  PATH:{ halal:'high',    sector:'Automation',     tier:'medium', description:'Robotic process automation (RPA) software' },
  RBRK:{ halal:'high',    sector:'Cybersecurity',  tier:'medium', description:'Zero-trust data security and ransomware protection' },
  // LARGE $101–$200
  NVDA:{ halal:'high',    sector:'Semiconductors', tier:'large',  description:'Dominant AI GPU manufacturer — powers data centers worldwide' },
  MSFT:{ halal:'high',    sector:'Cloud/AI',       tier:'large',  description:'Cloud (Azure), Office 365, and AI partnership with OpenAI' },
  AAPL:{ halal:'medium',  sector:'Consumer Tech',  tier:'large',  description:'iPhone, Mac, services ecosystem — largest company by market cap' },
  LLY: { halal:'high',    sector:'Pharma',         tier:'large',  description:'GLP-1 weight loss drugs (Mounjaro, Zepbound) market leader' },
  AVGO:{ halal:'high',    sector:'Semiconductors', tier:'large',  description:'Custom AI chips, networking, and enterprise software' },
  TMO: { halal:'high',    sector:'Life Sciences',  tier:'large',  description:'Scientific instruments, lab services, and life science tools' },
  ISRG:{ halal:'high',    sector:'Robotic Surgery',tier:'large',  description:'da Vinci robotic surgical systems — dominant market position' },
  PANW:{ halal:'high',    sector:'Cybersecurity',  tier:'large',  description:'Comprehensive cybersecurity platform — firewall to cloud' },
  NOW: { halal:'high',    sector:'Cloud SaaS',     tier:'large',  description:'IT service management and enterprise workflow automation' },
  AMAT:{ halal:'high',    sector:'Semiconductors', tier:'large',  description:'Semiconductor manufacturing equipment and materials' },
  HD:  { halal:'high',    sector:'Retail',         tier:'large',  description:'Home improvement retail — benefits from housing market' },
  TSLA:{ halal:'medium',  sector:'EV',             tier:'large',  description:'Electric vehicles, energy storage, and autonomous driving' },
  SNOW:{ halal:'high',    sector:'Cloud',          tier:'large',  description:'Cloud data warehouse and analytics platform' },
  // BIG $201+
  NVO: { halal:'high',    sector:'Pharma',         tier:'big',    description:'Novo Nordisk — GLP-1 diabetes and obesity drugs (Ozempic, Wegovy)' },
  MA:  { halal:'high',    sector:'Payments',       tier:'big',    description:'Mastercard payment network — processes but does not lend' },
  V:   { halal:'high',    sector:'Payments',       tier:'big',    description:'Visa payment network — technology company not a bank' },
  COST:{ halal:'high',    sector:'Retail',         tier:'big',    description:'Membership warehouse retail — highly loyal customer base' },
  ADBE:{ halal:'high',    sector:'Software',       tier:'big',    description:'Creative software (Photoshop, Illustrator) and PDF tools' },
  ORCL:{ halal:'high',    sector:'Cloud',          tier:'big',    description:'Enterprise database software and cloud infrastructure' },
  ASML:{ halal:'high',    sector:'Semiconductors', tier:'big',    description:'EUV lithography machines — only supplier globally' },
  TSM: { halal:'high',    sector:'Semiconductors', tier:'big',    description:'Taiwan Semiconductor — manufactures chips for Apple, NVDA, AMD' },
  INTU:{ halal:'high',    sector:'SaaS',           tier:'big',    description:'TurboTax, QuickBooks, and Credit Karma — financial software' },
};

// Behavior profiles — why each stock moves the way it does
const BEHAVIOR_PROFILES: Record<string, { primary_driver:string; pattern:string; avoid_when:string; best_for:string }> = {
  NVDA: { primary_driver:'AI infrastructure demand and data center buildout', pattern:'Leads on AI news, follows broader tech sentiment. Earnings move ±8-10% avg.', avoid_when:'VIX > 25 or broad tech selloff', best_for:'Momentum breakouts on AI catalyst days' },
  AMD:  { primary_driver:'Market share gains vs Intel CPUs and NVDA GPUs', pattern:'Often lags then catches up to NVDA. Strong on data center earnings.', avoid_when:'NVDA is falling — AMD follows with a lag', best_for:'Dip buys when NVDA recovered but AMD hasnt yet' },
  HIMS: { primary_driver:'GLP-1 weight loss drug access and telehealth growth', pattern:'News-driven — FDA decisions create 20-35% swings', avoid_when:'Regulatory uncertainty or competitor announcements', best_for:'Momentum after FDA approvals or coverage expansions' },
  TSLA: { primary_driver:'Elon Musk news, EV delivery numbers, and rate sensitivity', pattern:'Amplifies market moves 2-3×. Retail sentiment stock.', avoid_when:'Rising interest rates or Musk controversy weeks', best_for:'Momentum setups with strong volume confirmation' },
  NVO:  { primary_driver:'Ozempic/Wegovy demand and obesity drug pipeline', pattern:'Steady grinder up with occasional 5-8% pullbacks on competition news', avoid_when:'Competitor GLP-1 data readouts or pricing pressure news', best_for:'Dip buys on temporary pullbacks in uptrend' },
  RKLB: { primary_driver:'Launch manifest growth and space economy expansion', pattern:'Highly volatile. Each launch either validates or punishes. Retail favourite.', avoid_when:'Delayed launches or SpaceX competition announcements', best_for:'News catalyst after successful launches' },
  PLTR: { primary_driver:'AI platform adoption in government and commercial sectors', pattern:'Moves on government contract wins and earnings guidance', avoid_when:'Defense budget cuts or macro risk-off environment', best_for:'Momentum breakouts after earnings beats' },
};

const PRICE_BOUNDS: Record<string, [number,number]> = {
  small:[0,25], medium:[26,100], large:[101,200], big:[201,999999],
};

// ── Indicators ────────────────────────────────────────────────────────────────
function calcRSI(c:number[], p=14):number {
  if(c.length<p+1) return 50;
  let g=0,l=0;
  for(let i=c.length-p;i<c.length;i++){const d=c[i]-c[i-1];d>0?g+=d:l+=Math.abs(d);}
  const ag=g/p,al=l/p;return al===0?100:Math.round(100-100/(1+ag/al));
}
function calcEMA(v:number[],p:number):number[]{const k=2/(p+1),o=[v[0]];for(let i=1;i<v.length;i++)o.push(v[i]*k+o[i-1]*(1-k));return o;}
function emaLast(c:number[],p:number):number{return calcEMA(c,p).slice(-1)[0];}
function calcMACD(c:number[]):{bullish:boolean;histogram:number}{
  if(c.length<35)return{bullish:false,histogram:0};
  const e12=calcEMA(c,12),e26=calcEMA(c,26);
  const line=e12.map((v,i)=>v-e26[i]);
  const sig=calcEMA(line.slice(-9),9);
  const h=line[line.length-1]-sig[sig.length-1];
  const p2=line[line.length-2]-sig[sig.length-2];
  return{bullish:h>0&&h>p2,histogram:parseFloat(h.toFixed(4))};
}
function calcATR(highs:number[],lows:number[],closes:number[],p=14):number{
  const trs:number[]=[];
  for(let i=1;i<closes.length;i++)trs.push(Math.max(highs[i]-lows[i],Math.abs(highs[i]-closes[i-1]),Math.abs(lows[i]-closes[i-1])));
  const r=trs.slice(-p);return r.reduce((a,b)=>a+b,0)/r.length;
}
function calcVolumeRatio(v:number[]):number{
  if(v.length<21)return 1;
  const avg=v.slice(-21,-1).reduce((a,b)=>a+b,0)/20;
  return avg>0?parseFloat((v[v.length-1]/avg).toFixed(2)):1;
}
function calcStoch(highs:number[],lows:number[],closes:number[],kp=14):{k:number;d:number}{
  if(closes.length<kp)return{k:50,d:50};
  const ks:number[]=[];
  for(let i=kp-1;i<closes.length;i++){
    const sl=highs.slice(i-kp+1,i+1),ll=lows.slice(i-kp+1,i+1);
    const hi=Math.max(...sl),lo=Math.min(...ll);
    ks.push(hi===lo?50:((closes[i]-lo)/(hi-lo))*100);
  }
  const lastK=ks[ks.length-1],ds=ks.slice(-3);
  return{k:Math.round(lastK),d:Math.round(ds.reduce((a,b)=>a+b,0)/ds.length)};
}
function calcADX(highs:number[],lows:number[],closes:number[],p=14):number{
  if(closes.length<p*2)return 20;
  const trs:number[]=[],pdms:number[]=[],mdms:number[]=[];
  for(let i=1;i<closes.length;i++){
    trs.push(Math.max(highs[i]-lows[i],Math.abs(highs[i]-closes[i-1]),Math.abs(lows[i]-closes[i-1])));
    const pd=highs[i]-highs[i-1],md=lows[i-1]-lows[i];
    pdms.push(pd>0&&pd>md?pd:0);mdms.push(md>0&&md>pd?md:0);
  }
  const atr=trs.slice(-p).reduce((a,b)=>a+b,0)/p;
  const pdi=pdms.slice(-p).reduce((a,b)=>a+b,0)/p/atr*100;
  const mdi=mdms.slice(-p).reduce((a,b)=>a+b,0)/p/atr*100;
  return Math.round((pdi+mdi)>0?Math.abs(pdi-mdi)/(pdi+mdi)*100:0);
}

// ── Alpaca: fetch candles (SIP — full market volume) ─────────────────────────
async function fetchCandles(ticker:string):Promise<{closes:number[];highs:number[];lows:number[];volumes:number[];vwaps:number[];dates:string[];price:number}|null>{
  if(!ALPACA_KEY||!ALPACA_SECRET)return null;
  try{
    const start=new Date(Date.now()-140*86400000).toISOString().split('T')[0];
    const res=await fetch(`${ALPACA_BASE}/${ticker}/bars?timeframe=1Day&limit=90&feed=sip&start=${start}&sort=asc`,{
      headers:{'APCA-API-KEY-ID':ALPACA_KEY,'APCA-API-SECRET-KEY':ALPACA_SECRET},
      signal:AbortSignal.timeout(8000),
    });
    if(!res.ok)return null;
    const data=await res.json();
    const bars:any[]=data?.bars??[];
    if(bars.length<30)return null;
    return{
      closes: bars.map((b:any)=>b.c),
      highs:  bars.map((b:any)=>b.h),
      lows:   bars.map((b:any)=>b.l),
      volumes:bars.map((b:any)=>b.v),
      vwaps:  bars.map((b:any)=>b.vw??b.c),
      dates:  bars.map((b:any)=>b.t.split('T')[0]),
      price:  bars[bars.length-1].c,
    };
  }catch{return null;}
}

// ── Detect significant historical moves ───────────────────────────────────────
function detectKeyMoves(candles:{closes:number[];highs:number[];lows:number[];volumes:number[];dates:string[]}):
  {date:string;pct:number;direction:'up'|'down';volume_ratio:number}[] {
  const{closes,volumes,dates}=candles;
  const moves:any[]=[];
  const avgVol=volumes.slice(0,volumes.length-1).reduce((a,b)=>a+b,0)/Math.max(1,volumes.length-1);
  for(let i=1;i<closes.length;i++){
    const pct=((closes[i]-closes[i-1])/closes[i-1])*100;
    if(Math.abs(pct)>=5){// 5%+ is significant
      moves.push({date:dates[i],pct:parseFloat(pct.toFixed(1)),direction:pct>0?'up':'down',volume_ratio:parseFloat((volumes[i]/Math.max(1,avgVol)).toFixed(1))});
    }
  }
  return moves.sort((a,b)=>Math.abs(b.pct)-Math.abs(a.pct)).slice(0,5);
}

// ── Get news for a specific date to explain the move ─────────────────────────
async function getMoveReason(ticker:string,date:string,pct:number,apiKey:string):Promise<string>{
  // Fetch news around that date
  let headlines:string[]=[];
  if(FINNHUB_KEY){
    try{
      const from=new Date(new Date(date).getTime()-86400000).toISOString().split('T')[0];
      const to=new Date(new Date(date).getTime()+86400000).toISOString().split('T')[0];
      const res=await fetch(`${FH_BASE}/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${FINNHUB_KEY}`,{signal:AbortSignal.timeout(5000)});
      if(res.ok){const articles=await res.json();headlines=(Array.isArray(articles)?articles:[]).slice(0,5).map((a:any)=>a.headline??'');}
    }catch{}
  }
  if(headlines.length===0)return pct>0?'Strong buying pressure — possible market-wide momentum or sector rotation':'Heavy selling pressure — possible market-wide risk-off or sector rotation';
  try{
    const res=await fetch(ANTHROPIC_URL,{
      method:'POST',headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},
      body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:80,messages:[{role:'user',content:`${ticker} moved ${pct>0?'+':''}${pct}% on ${date}. News headlines:\n${headlines.join('\n')}\n\nExplain in ONE plain sentence (max 20 words) why it moved. No preamble.`}]}),
    });
    const d=await res.json();return d.content?.[0]?.text?.trim()??'Significant price move — news context unavailable';
  }catch{return 'Significant price move — AI explanation unavailable';}
}

// ── Finnhub: fundamentals ─────────────────────────────────────────────────────
async function fetchFundamentals(ticker:string):Promise<any>{
  if(!FINNHUB_KEY)return null;
  try{
    const[qRes,pRes,mRes]=await Promise.all([
      fetch(`${FH_BASE}/quote?symbol=${ticker}&token=${FINNHUB_KEY}`),
      fetch(`${FH_BASE}/stock/profile2?symbol=${ticker}&token=${FINNHUB_KEY}`),
      fetch(`${FH_BASE}/stock/metric?symbol=${ticker}&metric=all&token=${FINNHUB_KEY}`),
    ]);
    const[q,p,m]=await Promise.all([qRes.json(),pRes.json(),mRes.json()]);
    const met=m?.metric??{};
    return{
      price:q?.c,change:q?.d,changePct:q?.dp,
      name:p?.name,marketCap:p?.marketCapitalization?p.marketCapitalization*1e6:null,
      pe:met['peNormalizedAnnual'],beta:met['beta'],
      high52:met['52WeekHigh'],low52:met['52WeekLow'],
      dividendYield:met['dividendYieldIndicatedAnnual'],
      revenueGrowth:met['revenueGrowthTTMYoy'],
      shortInterest:met['shortInterest'],
      float:met['sharesFloat'],
    };
  }catch{return null;}
}

// ── Finnhub: earnings date ────────────────────────────────────────────────────
async function fetchNextEarnings(ticker:string):Promise<string|null>{
  if(!FINNHUB_KEY)return null;
  try{
    const from=new Date().toISOString().split('T')[0];
    const to=new Date(Date.now()+90*86400000).toISOString().split('T')[0];
    // Use per-ticker earnings history to estimate
    const res=await fetch(`${FH_BASE}/stock/earnings?symbol=${ticker}&limit=4&token=${FINNHUB_KEY}`,{signal:AbortSignal.timeout(4000)});
    if(!res.ok)return null;
    const data=await res.json();
    if(!Array.isArray(data)||data.length<2)return null;
    const sorted=data.filter((d:any)=>d.period).sort((a:any,b:any)=>new Date(b.period).getTime()-new Date(a.period).getTime());
    if(sorted.length<2)return null;
    const last=new Date(sorted[0].period),prev=new Date(sorted[1].period);
    const interval=Math.round((last.getTime()-prev.getTime())/86400000);
    const avg=Math.max(80,Math.min(105,interval));
    const next=new Date(last.getTime()+avg*86400000);
    if(next>new Date()&&next<new Date(Date.now()+180*86400000))return next.toISOString().split('T')[0];
    return null;
  }catch{return null;}
}

// ── Catalyst check ────────────────────────────────────────────────────────────
async function hasCatalyst(ticker:string):Promise<boolean>{
  if(!FINNHUB_KEY)return false;
  try{
    const to=new Date().toISOString().split('T')[0];
    const from=new Date(Date.now()-3*86400000).toISOString().split('T')[0];
    const res=await fetch(`${FH_BASE}/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${FINNHUB_KEY}`,{signal:AbortSignal.timeout(4000)});
    if(!res.ok)return false;
    const articles=await res.json();
    if(!Array.isArray(articles))return false;
    const kw=['beat','upgrade','record','partnership','contract','raised guidance','revenue growth','launch','breakthrough','fda','approval'];
    return articles.some((a:any)=>{const t=((a.headline??'')+(a.summary??'')).toLowerCase();return kw.some(k=>t.includes(k));});
  }catch{return false;}
}

// ── Signal analysis ───────────────────────────────────────────────────────────
function analyzeSetup(candles:{closes:number[];highs:number[];lows:number[];volumes:number[];price:number},catalyst:boolean):{setup:string;confidence:number;factors:string[];atr:number;indicators:any}|null{
  const{closes,highs,lows,volumes,price}=candles;
  const rsi=calcRSI(closes);
  const macd=calcMACD(closes);
  const atr=calcATR(highs,lows,closes);
  const volR=calcVolumeRatio(volumes);
  const ema20=emaLast(closes,20);
  const ema50=emaLast(closes,50);
  const stoch=calcStoch(highs,lows,closes);
  const adx=calcADX(highs,lows,closes);
  const vwap=candles.closes[candles.closes.length-1]; // approximation

  if(volR<1.3)return null;
  if(rsi>78||rsi<22)return null;
  const s20=closes.slice(-20),mean=s20.reduce((a,b)=>a+b,0)/20;
  const std=Math.sqrt(s20.reduce((a,b)=>a+(b-mean)**2,0)/20);
  if((2*std)/mean<0.03&&volR<2.0)return null;

  const factors:string[]=[]; let score=0;
  if(price>ema20&&price>ema50){score++;factors.push('Trend aligned — price above 20 & 50 EMA');}
  else if(price>ema20){factors.push('Partial trend — above 20 EMA only');}
  if(rsi>=50&&rsi<=65){score++;factors.push(`RSI ${rsi} — healthy momentum zone`);}
  else if(rsi>65&&rsi<=75){factors.push(`RSI ${rsi} — elevated, consider smaller position`);}
  else if(rsi>=30&&rsi<48){score++;factors.push(`RSI ${rsi} — oversold bounce zone`);}
  score++;factors.push(`Volume ${volR.toFixed(1)}× average — ${volR>=2?'strong institutional interest':'confirmed participation'}`);
  const atrPrev=calcATR(highs.slice(0,-5),lows.slice(0,-5),closes.slice(0,-5));
  if(atr>atrPrev*1.08){score++;factors.push('ATR expanding — volatility supporting the move');}
  if(macd.bullish){score++;factors.push('MACD bullish — momentum accelerating');}
  if(catalyst){score++;factors.push('Bullish news catalyst in past 72h');}
  if(score<4)return null;

  const high20=Math.max(...closes.slice(-21,-1));
  let setup:string;
  if(price>high20&&volR>=1.8)setup='Momentum Breakout';
  else if(rsi<45&&price>ema20)setup='Dip Buy Reversal';
  else if(catalyst&&volR>=1.5)setup='News Catalyst';
  else if(score>=5)setup='Momentum Breakout';
  else return null;

  const trend=price>ema20&&price>ema50?'bullish':price<ema20&&price<ema50?'bearish':'neutral';
  const rsiSignal=rsi<30?'oversold':rsi<50?'neutral':rsi<65?'building':rsi<75?'elevated':'overbought';
  const adxStr=adx<20?'weak':adx<30?'moderate':adx<50?'strong':'very_strong';

  return{setup,confidence:Math.min(10,score),factors,atr,indicators:{rsi,rsiSignal,macd,atr,atrPct:parseFloat(((atr/price)*100).toFixed(2)),volR,ema20:parseFloat(ema20.toFixed(2)),ema50:parseFloat(ema50.toFixed(2)),stochK:stoch.k,stochD:stoch.d,adx,adxStr,trend,vwap:parseFloat(price.toFixed(2))}};
}

// ── Support & Resistance ──────────────────────────────────────────────────────
function calcLevels(candles:{closes:number[];highs:number[];lows:number[];dates:string[]},price:number){
  const{closes,highs,lows}=candles;
  const last=closes[closes.length-1],prev2=closes[closes.length-2]??last;
  const pp=(highs[highs.length-2]+lows[lows.length-2]+prev2)/3;
  const r1=2*pp-lows[lows.length-2],r2=pp+(highs[highs.length-2]-lows[lows.length-2]),s1=2*pp-highs[highs.length-2],s2=pp-(highs[highs.length-2]-lows[lows.length-2]);
  const slice60=closes.slice(-60);
  const swingHi=Math.max(...highs.slice(-60)),swingLo=Math.min(...lows.slice(-60));
  const range=swingHi-swingLo,isUp=(price-swingLo)>(swingHi-price);
  const base=isUp?swingLo:swingHi,sign=isUp?1:-1;
  const atr=calcATR(highs,lows,closes);
  return{
    r2:parseFloat(r2.toFixed(2)),r1:parseFloat(r1.toFixed(2)),
    s1:parseFloat(s1.toFixed(2)),s2:parseFloat(s2.toFixed(2)),
    pivot:parseFloat(pp.toFixed(2)),
    fib382:parseFloat((base+sign*range*0.382).toFixed(2)),
    fib500:parseFloat((base+sign*range*0.500).toFixed(2)),
    fib618:parseFloat((base+sign*range*0.618).toFixed(2)),
    swingHi:parseFloat(swingHi.toFixed(2)),swingLo:parseFloat(swingLo.toFixed(2)),
    entryLo:parseFloat((price-atr*0.3).toFixed(2)),
    stop:parseFloat((s1-atr*0.5).toFixed(2)),
    tp1:parseFloat(r1.toFixed(2)),tp2:parseFloat(r2.toFixed(2)),atr:parseFloat(atr.toFixed(2)),
  };
}

// ── Build full plan ───────────────────────────────────────────────────────────
function buildPlan(ticker:string,candles:any,analysis:any,capital:number,meta:any,fundamentals:any,targets:any,keyMoves:any[],earningsDate:string|null){
  const{price}=candles;
  const stopDist=analysis.atr*1.5,shares=Math.max(1,Math.floor((capital*0.03)/stopDist));
  const levels=calcLevels(candles,price);
  const sparkline=candles.closes.slice(-30).map((c:number,i:number)=>({c,d:candles.dates[candles.dates.length-30+i]??''}));
  return{
    ticker,setup_type:analysis.setup,confidence:analysis.confidence,factors:analysis.factors,
    meta:{halal:meta.halal,sector:meta.sector,description:meta.description,behavior:BEHAVIOR_PROFILES[ticker]??null},
    price:parseFloat(price.toFixed(2)),change:fundamentals?.changePct??0,
    entry:parseFloat(price.toFixed(2)),stop:parseFloat((price-stopDist).toFixed(2)),
    tp1:parseFloat((price+analysis.atr*2).toFixed(2)),tp2:parseFloat((price+analysis.atr*3.5).toFixed(2)),
    shares,positionValue:parseFloat((shares*price).toFixed(2)),maxLoss:parseFloat((shares*stopDist).toFixed(2)),
    rr:parseFloat(((analysis.atr*2)/stopDist).toFixed(1)),
    holdDays:analysis.setup==='News Catalyst'?'1 day':'1–3 days',
    indicators:analysis.indicators,levels,
    fundamentals:{
      marketCap:fundamentals?.marketCap??null,pe:fundamentals?.pe??null,beta:fundamentals?.beta??null,
      high52:fundamentals?.high52??null,low52:fundamentals?.low52??null,revenueGrowth:fundamentals?.revenueGrowth??null,
      shortInterest:fundamentals?.shortInterest??null,float:fundamentals?.float??null,
    },
    targets:targets?{consensus:targets.targetConsensus,high:targets.targetHigh,low:targets.targetLow,median:targets.targetMedian,upside:targets.targetConsensus?parseFloat((((targets.targetConsensus-price)/price)*100).toFixed(1)):null}:null,
    keyMoves,sparkline,earningsDate,
    volatilityProfile:{atrPct:analysis.indicators.atrPct,avgDailyPct:parseFloat((candles.closes.slice(-30).reduce((s:number,c:number,i:number,a:number[])=>i>0?s+Math.abs((c-a[i-1])/a[i-1]*100):s,0)/29).toFixed(2))},
  };
}

async function batchFetch<T>(tickers:string[],fn:(t:string)=>Promise<T|null>,concurrency=8,delayMs=600):Promise<Map<string,T|null>>{
  const map=new Map<string,T|null>();
  for(let i=0;i<tickers.length;i+=concurrency){
    const batch=tickers.slice(i,i+concurrency);
    const res=await Promise.all(batch.map(async t=>({t,v:await fn(t)})));
    res.forEach(({t,v})=>map.set(t,v));
    if(i+concurrency<tickers.length)await new Promise(r=>setTimeout(r,delayMs));
  }
  return map;
}

// ── Main ──────────────────────────────────────────────────────────────────────
export async function POST(request:NextRequest){
  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});

  if(!ALPACA_KEY||!ALPACA_SECRET)return NextResponse.json({signal:'NO_TRADE',reason:'ALPACA_KEY_ID and ALPACA_SECRET not configured in Vercel environment variables.',scanned:0,setups:[]});

  const body=await request.json().catch(()=>({}));
  const{price_ranges=['small','medium','large','big'],capital=10000,specific_ticker=null}=body;
  const anthropicKey=process.env.ANTHROPIC_API_KEY;
  const isAdmin=user.email===ADMIN_EMAIL;

  // ── Mode B: specific ticker evaluation ──────────────────────────────────
  if(specific_ticker){
    const ticker=(specific_ticker as string).toUpperCase().trim();
    const[candles,fundamentals,targets,earningsDate,catalyst]=await Promise.all([
      fetchCandles(ticker),fetchFundamentals(ticker),fetchAnalystTargets(ticker),fetchNextEarnings(ticker),hasCatalyst(ticker),
    ]);
    if(!candles)return NextResponse.json({signal:'NO_TRADE',reason:`Could not fetch market data for ${ticker}. Check the ticker and try again.`,scanned:0,setups:[]});
    const analysis=analyzeSetup(candles,catalyst);
    const keyMoves=detectKeyMoves(candles);
    const movesWithReasons=anthropicKey?await Promise.all(keyMoves.map(async m=>({...m,reason:await getMoveReason(ticker,m.date,m.pct,anthropicKey)}))):keyMoves.map(m=>({...m,reason:'AI explanation requires ANTHROPIC_API_KEY'}));
    const meta=UNIVERSE[ticker]??{halal:'doubtful',sector:'Unknown',tier:'medium',description:'Custom ticker — verify all details before trading'};
    if(!analysis)return NextResponse.json({signal:'NO_SETUP',ticker,reason:'This ticker does not meet required signal criteria right now.',scanned:1,candles_available:true,price:candles.price,fundamentals,targets,keyMoves:movesWithReasons,earningsDate,sparkline:candles.closes.slice(-30).map((c,i)=>({c,d:candles.dates[candles.dates.length-30+i]??''})),meta,setups:[]});
    const plan=buildPlan(ticker,candles,analysis,capital,meta,fundamentals,targets,movesWithReasons,earningsDate);
    const{data:certs}=await supabase.from('halal_certifications').select('*').eq('ticker',ticker);
    const userCert=certs?.find((c:any)=>c.certified_by===user.id)??null;
    return NextResponse.json({signal:'SETUPS_FOUND',scanned:1,found:1,isAdmin,setups:[{...plan,userCert,canEdit:isAdmin}],generated_at:new Date().toISOString()});
  }

  // ── Mode A: auto scan ────────────────────────────────────────────────────
  const selectedTiers=new Set<string>(price_ranges);
  const candidates=Object.entries(UNIVERSE).filter(([,m])=>selectedTiers.has(m.tier)).map(([t])=>t);
  if(candidates.length===0)return NextResponse.json({signal:'NO_TRADE',reason:'No candidates for selected ranges.',scanned:0,setups:[]});

  const candleMap=await batchFetch(candidates,fetchCandles,8,600);
  const selectedBounds=(price_ranges as string[]).map((r:string)=>PRICE_BOUNDS[r]).filter(Boolean);
  const inRange=candidates.filter(t=>{const c=candleMap.get(t);return c&&selectedBounds.some(([min,max])=>c.price>=min&&c.price<=max);});

  if(inRange.length===0){
    const fetched=candidates.filter(t=>candleMap.get(t)!==null).length;
    return NextResponse.json({signal:'NO_TRADE',reason:fetched===0?'Could not fetch market data from Alpaca. Check your API keys in Vercel.':`${fetched} stocks fetched but none matched selected price range(s). Try "All Ranges".`,scanned:0,setups:[]});
  }

  const catalystMap=await batchFetch(inRange,hasCatalyst,10,300);
  const validSetups:any[]=[],rejectLog:string[]=[];

  for(const ticker of inRange){
    const candles=candleMap.get(ticker);const catalyst=catalystMap.get(ticker)??false;
    if(!candles)continue;
    const analysis=analyzeSetup(candles,catalyst);
    if(!analysis){rejectLog.push(`${ticker}: RSI ${calcRSI(candles.closes)}, Vol ${calcVolumeRatio(candles.volumes).toFixed(1)}×`);continue;}
    const meta=UNIVERSE[ticker];
    // Fetch enrichment in parallel for qualifying stocks only
    const[fundamentals,targets,earningsDate]=await Promise.all([fetchFundamentals(ticker),fetchAnalystTargets(ticker),fetchNextEarnings(ticker)]);
    const keyMoves=detectKeyMoves(candles);
    const movesWithReasons=anthropicKey?await Promise.all(keyMoves.slice(0,3).map(async m=>({...m,reason:await getMoveReason(ticker,m.date,m.pct,anthropicKey)}))):keyMoves.map(m=>({...m,reason:'Historical move — AI explanation requires API key'}));
    const{data:certs}=await supabase.from('halal_certifications').select('*').eq('ticker',ticker);
    const userCert=certs?.find((c:any)=>c.certified_by===user.id)??null;
    validSetups.push({...buildPlan(ticker,candles,analysis,capital,meta,fundamentals,targets,movesWithReasons,earningsDate),userCert,canEdit:isAdmin});
  }

  validSetups.sort((a,b)=>b.confidence-a.confidence);

  if(validSetups.length===0)return NextResponse.json({signal:'NO_TRADE',reason:`Scanned ${inRange.length} halal stocks. No setups met all required criteria today. Capital preservation is the right decision.`,scanned:inRange.length,reject_sample:rejectLog.slice(0,5),setups:[]});

  return NextResponse.json({signal:'SETUPS_FOUND',scanned:inRange.length,found:validSetups.length,setups:validSetups.slice(0,5),isAdmin,generated_at:new Date().toISOString()});
}
