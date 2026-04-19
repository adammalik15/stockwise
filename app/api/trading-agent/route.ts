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

// ── 6-tier price system ───────────────────────────────────────────────────────
const PRICE_BOUNDS: Record<string, [number,number]> = {
  small:   [0,    25   ],
  medium:  [26,   100  ],
  large:   [101,  200  ],
  big:     [201,  400  ],
  premium: [401,  700  ],
  elite:   [701,  999999],
};

type Tier = 'small'|'medium'|'large'|'big'|'premium'|'elite';
type Halal = 'high'|'medium'|'doubtful';

interface UniverseEntry {
  halal: Halal;
  sector: string;
  tier: Tier;
  description: string;
}

// ── 200+ stock halal universe ─────────────────────────────────────────────────
const UNIVERSE: Record<string, UniverseEntry> = {
  // ── SMALL (< $25) ──────────────────────────────────────────────────────────
  RKLB: { halal:'high',    sector:'Aerospace',        tier:'small',  description:'Space launch & satellite services' },
  RIVN: { halal:'high',    sector:'EV',               tier:'small',  description:'Electric vehicle manufacturer for commercial fleets' },
  LCID: { halal:'high',    sector:'EV',               tier:'small',  description:'Luxury electric vehicle maker' },
  PLUG: { halal:'high',    sector:'Clean Energy',     tier:'small',  description:'Hydrogen fuel cell systems' },
  JOBY: { halal:'high',    sector:'Aviation',         tier:'small',  description:'Electric air taxi developer' },
  SOUN: { halal:'high',    sector:'AI',               tier:'small',  description:'AI-powered voice technology platform' },
  HIMS: { halal:'high',    sector:'Healthcare',       tier:'small',  description:'Telehealth platform — hair loss, weight, wellness' },
  ACHR: { halal:'high',    sector:'Aviation',         tier:'small',  description:'Electric vertical takeoff aircraft' },
  ASTS: { halal:'high',    sector:'Space',            tier:'small',  description:'Space-based broadband cellular network' },
  RXRX: { halal:'high',    sector:'BioTech',          tier:'small',  description:'AI-driven drug discovery platform' },
  BBAI: { halal:'high',    sector:'AI',               tier:'small',  description:'AI analytics for national security' },
  NIO:  { halal:'high',    sector:'EV',               tier:'small',  description:'Chinese premium electric vehicle manufacturer' },
  LAZR: { halal:'high',    sector:'Autonomous',       tier:'small',  description:'Lidar sensors for autonomous vehicles' },
  XPEV: { halal:'high',    sector:'EV',               tier:'small',  description:'Chinese smart electric vehicles' },
  AMPX: { halal:'high',    sector:'Energy Storage',   tier:'small',  description:'Lithium-silicon battery technology' },
  FSLY: { halal:'high',    sector:'Cloud/CDN',        tier:'small',  description:'Edge cloud platform for fast content delivery' },
  SGML: { halal:'high',    sector:'Materials',        tier:'small',  description:'Lithium carbonate producer for EV batteries' },
  VETO: { halal:'high',    sector:'Healthcare',       tier:'small',  description:'Healthcare innovation company' },
  SRPT: { halal:'high',    sector:'BioTech',          tier:'small',  description:'Rare disease gene therapy biotech' },
  RIOT: { halal:'doubtful',sector:'Crypto Mining',    tier:'small',  description:'Bitcoin mining — halal status debated among scholars' },
  PATH: { halal:'high',    sector:'Automation',       tier:'small',  description:'Robotic process automation (RPA) software' },
  ANNA: { halal:'high',    sector:'Healthcare AI',    tier:'small',  description:'AI-powered healthcare analytics' },
  ANGO: { halal:'high',    sector:'Medical Devices',  tier:'small',  description:'Vascular and oncology medical devices' },
  VELO: { halal:'high',    sector:'Healthcare',       tier:'small',  description:'Pharmaceutical development company' },
  SYM:  { halal:'high',    sector:'Robotics',         tier:'small',  description:'AI-powered warehouse robotics' },
  ELVA: { halal:'high',    sector:'EV',               tier:'small',  description:'Electric vehicle charging infrastructure' },
  FLNC: { halal:'high',    sector:'Clean Energy',     tier:'small',  description:'Fluence Energy — grid-scale energy storage' },
  NBIS: { halal:'high',    sector:'Semiconductors',   tier:'small',  description:'Nebius — AI cloud infrastructure' },
  SMTC: { halal:'high',    sector:'Semiconductors',   tier:'small',  description:'Semtech — IoT and wireless semiconductors' },
  ETON: { halal:'high',    sector:'Pharma',           tier:'small',  description:'Specialty pharmaceutical company' },
  KIDS: { halal:'high',    sector:'Healthcare',       tier:'small',  description:'OrthoPediatrics — pediatric orthopedic devices' },
  ISSC: { halal:'high',    sector:'Aerospace',        tier:'small',  description:'Innovative Solutions and Support — avionics' },
  BIRD: { halal:'high',    sector:'Footwear',         tier:'small',  description:'Allbirds — sustainable footwear brand' },
  WTTR: { halal:'high',    sector:'Energy Services',  tier:'small',  description:'Select Water Solutions — oilfield water management' },
  FPS:  { halal:'high',    sector:'Technology',       tier:'small',  description:'Far Peak Acquisition / tech holdings' },
  PTRN: { halal:'high',    sector:'Technology',       tier:'small',  description:'Patron Technology — events tech platform' },
  BUUU: { halal:'high',    sector:'Technology',       tier:'small',  description:'BU Energy — emerging technology' },
  PXED: { halal:'high',    sector:'Healthcare',       tier:'small',  description:'Pharmaceutical development' },
  PPIH: { halal:'high',    sector:'Infrastructure',   tier:'small',  description:'Perion Network — infrastructure' },
  YDDL: { halal:'high',    sector:'Technology',       tier:'small',  description:'Emerging technology company' },
  LUD:  { halal:'high',    sector:'Technology',       tier:'small',  description:'Emerging technology company' },
  UAMY: { halal:'high',    sector:'Materials',        tier:'small',  description:'United States Antimony — rare minerals' },
  WSHP: { halal:'high',    sector:'Healthcare',       tier:'small',  description:'Warship Health — healthcare services' },
  AXGN: { halal:'high',    sector:'Medical Devices',  tier:'small',  description:'Axogen — surgical nerve repair devices' },
  AAOI: { halal:'high',    sector:'Networking',       tier:'small',  description:'Applied Optoelectronics — optical networking' },
  CPNG: { halal:'high',    sector:'E-Commerce',       tier:'small',  description:'Coupang — South Korean e-commerce giant' },
  // ── MEDIUM ($26–$100) ──────────────────────────────────────────────────────
  AMD:  { halal:'high',    sector:'Semiconductors',   tier:'medium', description:'CPUs, GPUs, and AI chips — competing with NVDA in data centers' },
  QCOM: { halal:'high',    sector:'Semiconductors',   tier:'medium', description:'Mobile chipsets and wireless technology licensing' },
  MU:   { halal:'high',    sector:'Semiconductors',   tier:'medium', description:'Memory and storage chips (DRAM, NAND)' },
  SHOP: { halal:'high',    sector:'E-Commerce',       tier:'medium', description:'E-commerce platform for businesses worldwide' },
  NET:  { halal:'high',    sector:'Cloud',            tier:'medium', description:'Global network — CDN, security, DNS' },
  DDOG: { halal:'high',    sector:'Cloud',            tier:'medium', description:'Cloud monitoring and observability platform' },
  ZS:   { halal:'high',    sector:'Cybersecurity',    tier:'medium', description:'Cloud-native zero trust security' },
  CRWD: { halal:'high',    sector:'Cybersecurity',    tier:'medium', description:'Endpoint protection and threat intelligence' },
  OKTA: { halal:'high',    sector:'Cybersecurity',    tier:'medium', description:'Identity and access management (IAM)' },
  PLTR: { halal:'medium',  sector:'AI/Data',          tier:'medium', description:'Data analytics — commercial and government clients' },
  MDB:  { halal:'high',    sector:'Cloud DB',         tier:'medium', description:'MongoDB — NoSQL database platform' },
  ON:   { halal:'high',    sector:'Semiconductors',   tier:'medium', description:'Power and signal management semiconductors' },
  CELH: { halal:'high',    sector:'Beverages',        tier:'medium', description:'Celsius energy drinks — global expansion' },
  SNAP: { halal:'medium',  sector:'Social',           tier:'medium', description:'Snapchat — social media and AR platform' },
  CIEN: { halal:'high',    sector:'Telecom Tech',     tier:'medium', description:'Optical networking equipment and software' },
  SNDK: { halal:'high',    sector:'Storage',          tier:'medium', description:'Flash storage products (SanDisk brand)' },
  TWLO: { halal:'high',    sector:'Cloud',            tier:'medium', description:'Cloud communications APIs — SMS, voice, email' },
  ZETA: { halal:'doubtful',sector:'Ad Tech',          tier:'medium', description:'Data-driven marketing technology platform' },
  RBRK: { halal:'high',    sector:'Cybersecurity',    tier:'medium', description:'Zero-trust data security and ransomware protection' },
  WDC:  { halal:'high',    sector:'Storage',          tier:'medium', description:'Western Digital — hard drives and flash storage' },
  MRVL: { halal:'high',    sector:'Semiconductors',   tier:'medium', description:'Marvell — data infrastructure chips and AI networking' },
  COHR: { halal:'high',    sector:'Photonics',        tier:'medium', description:'Coherent — optical components for AI data centers' },
  ALB:  { halal:'high',    sector:'Materials',        tier:'medium', description:'Albemarle — lithium producer for EV batteries' },
  GTLB: { halal:'high',    sector:'DevOps',           tier:'medium', description:'GitLab — DevSecOps platform for software teams' },
  CRDO: { halal:'high',    sector:'Semiconductors',   tier:'medium', description:'Credo Technology — high-speed connectivity chips' },
  RVMD: { halal:'high',    sector:'BioTech',          tier:'medium', description:'Revolution Medicines — cancer drug pipeline' },
  AKAM: { halal:'high',    sector:'Cloud/CDN',        tier:'medium', description:'Akamai — CDN, cloud security, and edge platform' },
  TER:  { halal:'high',    sector:'Semiconductors',   tier:'medium', description:'Teradyne — semiconductor test equipment' },
  SUPN: { halal:'high',    sector:'Pharma',           tier:'medium', description:'Supernus — neurology specialty pharmaceuticals' },
  KNF:  { halal:'high',    sector:'Manufacturing',    tier:'medium', description:'Knife River — construction materials' },
  TSEM: { halal:'high',    sector:'Semiconductors',   tier:'medium', description:'Tower Semiconductor — specialty chip manufacturing' },
  ALAB: { halal:'high',    sector:'Semiconductors',   tier:'medium', description:'Astera Labs — connectivity chips for AI infrastructure' },
  UMC:  { halal:'high',    sector:'Semiconductors',   tier:'medium', description:'United Microelectronics — chip foundry services' },
  RXO:  { halal:'high',    sector:'Logistics',        tier:'medium', description:'RXO — tech-enabled freight brokerage' },
  ANF:  { halal:'high',    sector:'Retail',           tier:'medium', description:'Abercrombie & Fitch — apparel retail turnaround' },
  FAST: { halal:'high',    sector:'Industrial',       tier:'medium', description:'Fastenal — industrial fasteners and supply chain' },
  JBL:  { halal:'high',    sector:'Manufacturing',    tier:'medium', description:'Jabil — electronics manufacturing services' },
  VSEC: { halal:'high',    sector:'Aerospace',        tier:'medium', description:'VSE Corporation — aerospace MRO services' },
  KO:   { halal:'doubtful',sector:'Beverages',        tier:'medium', description:'Coca-Cola — some alcohol distribution in portfolio' },
  CSX:  { halal:'high',    sector:'Transportation',   tier:'medium', description:'CSX — freight railroad across eastern US' },
  MIRM: { halal:'high',    sector:'Pharma',           tier:'medium', description:'Mirum Pharmaceuticals — rare liver diseases' },
  VRT:  { halal:'high',    sector:'Power Mgmt',       tier:'medium', description:'Vertiv — power and cooling for data centers' },
  // ── LARGE ($101–$200) ──────────────────────────────────────────────────────
  NVDA: { halal:'high',    sector:'Semiconductors',   tier:'large',  description:'Dominant AI GPU manufacturer — powers data centers worldwide' },
  MSFT: { halal:'high',    sector:'Cloud/AI',         tier:'large',  description:'Azure cloud, Office 365, and OpenAI partnership' },
  AAPL: { halal:'medium',  sector:'Consumer Tech',    tier:'large',  description:'iPhone, Mac, services ecosystem — largest market cap' },
  LLY:  { halal:'high',    sector:'Pharma',           tier:'large',  description:'GLP-1 weight loss drugs (Mounjaro, Zepbound) market leader' },
  TMO:  { halal:'high',    sector:'Life Sciences',    tier:'large',  description:'Scientific instruments and lab services' },
  ISRG: { halal:'high',    sector:'Robotic Surgery',  tier:'large',  description:'da Vinci robotic surgical systems' },
  PANW: { halal:'high',    sector:'Cybersecurity',    tier:'large',  description:'Comprehensive cybersecurity — firewall to cloud' },
  NOW:  { halal:'high',    sector:'Cloud SaaS',       tier:'large',  description:'IT service management and enterprise workflow automation' },
  AMAT: { halal:'high',    sector:'Semiconductors',   tier:'large',  description:'Semiconductor manufacturing equipment' },
  HD:   { halal:'high',    sector:'Retail',           tier:'large',  description:'Home improvement retail — housing market play' },
  TSLA: { halal:'medium',  sector:'EV',               tier:'large',  description:'Electric vehicles, energy storage, autonomous driving, Elon-driven' },
  SNOW: { halal:'high',    sector:'Cloud',            tier:'large',  description:'Cloud data warehouse and analytics platform' },
  ABT:  { halal:'high',    sector:'Healthcare',       tier:'large',  description:'Abbott Labs — diagnostics, medical devices, nutrition' },
  JNJ:  { halal:'high',    sector:'Healthcare',       tier:'large',  description:'Johnson & Johnson — pharmaceuticals and medical devices' },
  FRPT: { halal:'high',    sector:'Pet Food',         tier:'large',  description:'Freshpet — fresh refrigerated pet food' },
  MRK:  { halal:'high',    sector:'Pharma',           tier:'large',  description:'Merck — Keytruda cancer drug and vaccines' },
  VLO:  { halal:'high',    sector:'Energy',           tier:'large',  description:'Valero Energy — oil refining and fuel production' },
  CVX:  { halal:'high',    sector:'Energy',           tier:'large',  description:'Chevron — integrated energy company' },
  APP:  { halal:'medium',  sector:'Ad Tech',          tier:'large',  description:'AppLovin — mobile advertising and gaming technology' },
  ANET: { halal:'high',    sector:'Networking',       tier:'large',  description:'Arista Networks — cloud networking switches' },
  // ── BIG ($201–$400) ────────────────────────────────────────────────────────
  AVGO: { halal:'high',    sector:'Semiconductors',   tier:'big',    description:'Broadcom — custom AI chips, networking, and enterprise software' },
  TSM:  { halal:'high',    sector:'Semiconductors',   tier:'big',    description:'Taiwan Semiconductor — manufactures chips for Apple, NVDA, AMD' },
  COST: { halal:'high',    sector:'Retail',           tier:'big',    description:'Costco — membership warehouse with ultra-loyal customers' },
  MA:   { halal:'high',    sector:'Payments',         tier:'big',    description:'Mastercard — payment network (processes, does not lend)' },
  V:    { halal:'high',    sector:'Payments',         tier:'big',    description:'Visa — global payment network technology' },
  ADBE: { halal:'high',    sector:'Software',         tier:'big',    description:'Adobe — creative software (Photoshop, Illustrator, PDF)' },
  ORCL: { halal:'high',    sector:'Cloud',            tier:'big',    description:'Oracle — enterprise database and cloud infrastructure' },
  INTU: { halal:'high',    sector:'SaaS',             tier:'big',    description:'TurboTax, QuickBooks, Credit Karma — financial software' },
  COR:  { halal:'high',    sector:'Healthcare',       tier:'big',    description:'Cencora (AmerisourceBergen) — pharmaceutical distribution' },
  // ── PREMIUM ($401–$700) ────────────────────────────────────────────────────
  ASML: { halal:'high',    sector:'Semiconductors',   tier:'premium',description:'EUV lithography machines — only supplier globally' },
  NVO:  { halal:'high',    sector:'Pharma',           tier:'premium',description:'Novo Nordisk — Ozempic and Wegovy GLP-1 global leader' },
  MSTR: { halal:'doubtful',sector:'Crypto',           tier:'premium',description:'MicroStrategy — primary asset is Bitcoin holdings' },
  // ── ELITE ($701+) ─────────────────────────────────────────────────────────
  LRCX: { halal:'high',    sector:'Semiconductors',   tier:'elite',  description:'Lam Research — etch and deposition semiconductor equipment' },
  BRK:  { halal:'doubtful',sector:'Financial',        tier:'elite',  description:'Berkshire Hathaway — significant insurance and banking exposure' },
};

// Note: SOXX and FENY are ETFs — handled separately in the route
// SOXX = iShares Semiconductor ETF, FENY = Fidelity Energy ETF

// ── Behavior profiles ─────────────────────────────────────────────────────────
const BEHAVIOR: Record<string, {primary:string;pattern:string;avoid:string;best:string}> = {
  NVDA: { primary:'AI infrastructure demand and data center GPU orders',       pattern:'Leads AI sector — earnings move ±8-10%. Breakouts sustain on high volume.',             avoid:'VIX > 25 or broad tech selloff',              best:'Momentum breakouts after earnings beats or AI contract wins' },
  AMD:  { primary:'Market share gains vs Intel CPUs and NVDA GPUs',           pattern:'Often lags then catches up to NVDA. Strong on data center revenue beats.',              avoid:'NVDA is falling — AMD typically follows with lag', best:'Dip buys when NVDA has recovered but AMD hasnt' },
  HIMS: { primary:'GLP-1 access and telehealth growth',                       pattern:'FDA news creates 20-35% swings. Earnings ±10-15%.',                                       avoid:'FDA uncertainty or competitor approval news',     best:'Momentum after FDA approvals or coverage expansions' },
  TSLA: { primary:'Elon Musk news, delivery numbers, and interest rate moves', pattern:'Amplifies market 2-3×. Retail-driven. Moving on any Musk tweet.',                        avoid:'Rising rates or Musk controversy weeks',          best:'Momentum setups with strong volume after delivery beats' },
  NVO:  { primary:'Ozempic/Wegovy demand and obesity drug pipeline',          pattern:'Steady uptrend with 5-8% pullbacks on competitor news.',                                  avoid:'Competitor GLP-1 readouts or pricing pressure',   best:'Dip buys on pullbacks in confirmed uptrend' },
  RKLB: { primary:'Launch manifest growth and space economy expansion',        pattern:'Highly volatile — each launch validates or punishes. Retail favourite.',                  avoid:'Delayed launches or SpaceX competition news',     best:'News catalyst after successful launches' },
  PLTR: { primary:'AI platform adoption in government and commercial sectors', pattern:'Moves on government contract wins and AI narrative.',                                      avoid:'Defense budget cuts or macro risk-off',           best:'Momentum breakouts after earnings beats' },
  RIOT: { primary:'Bitcoin price (correlation ~0.92)',                         pattern:'Amplifies BTC moves 2-3×. If BTC flat → RIOT dies. Very retail-driven.',                 avoid:'When Bitcoin is flat or falling',                 best:'When BTC breaks out — RIOT follows with amplification' },
  ALAB: { primary:'AI data center connectivity chip demand',                   pattern:'Moves on AI infrastructure news and NVDA earnings guidance.',                             avoid:'Data center capex slowdown fears',                best:'Momentum breakouts alongside NVDA/AVGO strength' },
  CRDO: { primary:'High-speed data center interconnect chip demand',           pattern:'Moves with AI infrastructure buildout cycle. Earnings ±15-20%.',                         avoid:'Slowdown in hyperscaler capex',                   best:'Breakouts on earnings beats and guidance raises' },
  AVGO: { primary:'Custom AI chips (XPUs) and networking for hyperscalers',    pattern:'Slow steady grinder with big earnings moves. Less volatile than AMD/NVDA.',              avoid:'Hyperscaler capex cuts',                         best:'Dip buys after market-wide pullbacks' },
  ANET: { primary:'Cloud networking switches for AI data centers',             pattern:'Tight range then explosive earnings move. Very institutional.',                            avoid:'Cloud spending slowdown or NVDA earnings miss',   best:'Post-earnings momentum when guidance raised' },
};

// ── Indicator math ────────────────────────────────────────────────────────────
function calcRSI(c:number[],p=14):number{if(c.length<p+1)return 50;let g=0,l=0;for(let i=c.length-p;i<c.length;i++){const d=c[i]-c[i-1];d>0?g+=d:l+=Math.abs(d);}const ag=g/p,al=l/p;return al===0?100:Math.round(100-100/(1+ag/al));}
function calcEMA(v:number[],p:number):number[]{const k=2/(p+1),o=[v[0]];for(let i=1;i<v.length;i++)o.push(v[i]*k+o[i-1]*(1-k));return o;}
function emaLast(c:number[],p:number):number{return calcEMA(c,p).slice(-1)[0];}
// Faster MACD 8/17/9 — catches momentum shifts 1-2 days earlier than standard 12/26/9
// Also checks MACD line vs zero to avoid "less bearish" false positives
function calcMACD(c:number[],atr=0):{bullish:boolean;histogram:number;line:number}{
  if(c.length<25)return{bullish:false,histogram:0,line:0};
  const e8=calcEMA(c,8),e17=calcEMA(c,17);
  const line=e8.map((v,i)=>v-e17[i]);
  const sig=calcEMA(line.slice(-9),9);
  const h=line[line.length-1]-sig[sig.length-1];
  const prev=line[line.length-2]-sig[sig.length-2];
  const macdLine=line[line.length-1];
  // Only bullish if histogram expanding AND MACD line not deeply negative
  const zeroFilter=atr>0?macdLine>-(atr*0.5):macdLine>-0.5;
  return{bullish:h>0&&h>prev&&zeroFilter,histogram:parseFloat(h.toFixed(4)),line:parseFloat(macdLine.toFixed(4))};
}
function calcATR(highs:number[],lows:number[],closes:number[],p=14):number{const trs:number[]=[];for(let i=1;i<closes.length;i++)trs.push(Math.max(highs[i]-lows[i],Math.abs(highs[i]-closes[i-1]),Math.abs(lows[i]-closes[i-1])));const r=trs.slice(-p);return r.length?r.reduce((a,b)=>a+b,0)/r.length:0;}
function calcVolumeData(vols:number[]):{ratio:number;todayVol:number;avgVol:number}{if(vols.length<2)return{ratio:1,todayVol:vols[vols.length-1]??0,avgVol:0};const avg=vols.slice(-21,-1).reduce((a,b)=>a+b,0)/Math.max(1,Math.min(20,vols.length-1));const today=vols[vols.length-1];return{ratio:avg>0?parseFloat((today/avg).toFixed(2)):1,todayVol:today,avgVol:Math.round(avg)};}
function calcStoch(highs:number[],lows:number[],closes:number[],kp=14):{k:number;d:number}{if(closes.length<kp)return{k:50,d:50};const ks:number[]=[];for(let i=kp-1;i<closes.length;i++){const hi=Math.max(...highs.slice(i-kp+1,i+1)),lo=Math.min(...lows.slice(i-kp+1,i+1));ks.push(hi===lo?50:((closes[i]-lo)/(hi-lo))*100);}const lastK=ks[ks.length-1],ds=ks.slice(-3);return{k:Math.round(lastK),d:Math.round(ds.reduce((a,b)=>a+b,0)/ds.length)};}
function calcADX(highs:number[],lows:number[],closes:number[],p=14):number{if(closes.length<p*2)return 20;const trs:number[]=[],pdms:number[]=[],mdms:number[]=[];for(let i=1;i<closes.length;i++){trs.push(Math.max(highs[i]-lows[i],Math.abs(highs[i]-closes[i-1]),Math.abs(lows[i]-closes[i-1])));const pd=highs[i]-highs[i-1],md=lows[i-1]-lows[i];pdms.push(pd>0&&pd>md?pd:0);mdms.push(md>0&&md>pd?md:0);}const atr=trs.slice(-p).reduce((a,b)=>a+b,0)/p;if(!atr)return 20;const pdi=pdms.slice(-p).reduce((a,b)=>a+b,0)/p/atr*100,mdi=mdms.slice(-p).reduce((a,b)=>a+b,0)/p/atr*100;return Math.round((pdi+mdi)>0?Math.abs(pdi-mdi)/(pdi+mdi)*100:0);}
// EMA slope: is EMA rising? Compare today vs 5 days ago
function emaSlope(closes:number[],period:number):boolean{
  const emas=calcEMA(closes,period);
  return emas.length>=6&&emas[emas.length-1]>emas[emas.length-6];
}

// ── Alpaca SIP candles ────────────────────────────────────────────────────────
async function fetchCandles(ticker:string):Promise<{closes:number[];highs:number[];lows:number[];volumes:number[];dates:string[];price:number}|null>{
  if(!ALPACA_KEY||!ALPACA_SECRET)return null;
  try{
    const start=new Date(Date.now()-140*86400000).toISOString().split('T')[0];
    const res=await fetch(`${ALPACA_BASE}/${ticker}/bars?timeframe=1Day&limit=90&feed=sip&start=${start}&sort=asc`,{headers:{'APCA-API-KEY-ID':ALPACA_KEY,'APCA-API-SECRET-KEY':ALPACA_SECRET},signal:AbortSignal.timeout(8000)});
    if(!res.ok)return null;
    const bars:any[]=(await res.json())?.bars??[];
    if(bars.length<30)return null;
    return{closes:bars.map(b=>b.c),highs:bars.map(b=>b.h),lows:bars.map(b=>b.l),volumes:bars.map(b=>b.v),dates:bars.map(b=>b.t.split('T')[0]),price:bars[bars.length-1].c};
  }catch{return null;}
}

// ── Historical key moves ──────────────────────────────────────────────────────
function detectKeyMoves(c:{closes:number[];highs:number[];lows:number[];volumes:number[];dates:string[]}):{date:string;pct:number;direction:'up'|'down';volume_ratio:number}[]{
  const{closes,volumes,dates}=c;
  const avgVol=volumes.slice(0,-1).reduce((a,b)=>a+b,0)/Math.max(1,volumes.length-1);
  const moves:any[]=[];
  for(let i=1;i<closes.length;i++){
    const pct=((closes[i]-closes[i-1])/closes[i-1])*100;
    if(Math.abs(pct)>=5)moves.push({date:dates[i],pct:parseFloat(pct.toFixed(1)),direction:pct>0?'up':'down',volume_ratio:parseFloat((volumes[i]/Math.max(1,avgVol)).toFixed(1))});
  }
  return moves.sort((a,b)=>Math.abs(b.pct)-Math.abs(a.pct)).slice(0,5);
}

// ── Explain move — Finnhub news + Claude, with fallback to training knowledge ──
async function getMoveReason(ticker:string,date:string,pct:number,apiKey:string,sector:string):Promise<string>{
  let headlines:string[]=[];
  if(FINNHUB_KEY){
    try{
      const from=new Date(new Date(date).getTime()-86400000).toISOString().split('T')[0];
      const to=new Date(new Date(date).getTime()+86400000).toISOString().split('T')[0];
      const res=await fetch(`${FH_BASE}/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${FINNHUB_KEY}`,{signal:AbortSignal.timeout(5000)});
      if(res.ok)headlines=(await res.json()).slice(0,5).map((a:any)=>a.headline??'').filter(Boolean);
    }catch{}
  }
  try{
    const prompt=headlines.length>0
      ?`${ticker} moved ${pct>0?'+':''}${pct}% on ${date}. Headlines:\n${headlines.join('\n')}\n\nOne plain sentence (max 20 words) explaining why. No preamble.`
      :`${ticker} (${sector} company) moved ${pct>0?'+':''}${pct}% on ${date}. No news available. Based on typical catalysts for this sector and company type, write one plain sentence (max 20 words) explaining what likely caused this move. Be specific to the company type — e.g. for a biotech say FDA/trial, for a crypto miner say Bitcoin price, etc. No preamble.`;
    const res=await fetch(ANTHROPIC_URL,{method:'POST',headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:80,messages:[{role:'user',content:prompt}]})});
    const d=await res.json();
    return d.content?.[0]?.text?.trim()??'';
  }catch{return pct>0?'Strong buying — likely sector rotation or institutional accumulation':'Heavy selling — likely profit-taking or macro risk-off event';}
}

// ── Catalyst — returns headlines too ─────────────────────────────────────────
async function fetchCatalyst(ticker:string):Promise<{found:boolean;headlines:string[]}>{
  if(!FINNHUB_KEY)return{found:false,headlines:[]};
  try{
    const to=new Date().toISOString().split('T')[0];
    const from=new Date(Date.now()-3*86400000).toISOString().split('T')[0];
    const res=await fetch(`${FH_BASE}/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${FINNHUB_KEY}`,{signal:AbortSignal.timeout(4000)});
    if(!res.ok)return{found:false,headlines:[]};
    const articles:any[]=await res.json();
    if(!Array.isArray(articles))return{found:false,headlines:[]};
    const kw=['beat','upgrade','record','partnership','contract','raised guidance','revenue growth','launch','breakthrough','fda','approval','acqui'];
    const bullish=articles.filter(a=>{const t=((a.headline??'')+(a.summary??'')).toLowerCase();return kw.some(k=>t.includes(k));});
    return{found:bullish.length>0,headlines:bullish.slice(0,3).map(a=>a.headline??'').filter(Boolean)};
  }catch{return{found:false,headlines:[]};}
}

// ── Fundamentals + financials ─────────────────────────────────────────────────
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
      price:q?.c,change:q?.d,changePct:q?.dp,high52w:q?.h,low52w:q?.l,
      name:p?.name,marketCap:p?.marketCapitalization?p.marketCapitalization*1e6:null,
      pe:met['peNormalizedAnnual']??met['peTTM'],
      beta:met['beta'],
      high52:met['52WeekHigh'],low52:met['52WeekLow'],
      revenueGrowth:met['revenueGrowthTTMYoy'],
      grossMargin:met['grossMarginTTM'],
      netMargin:met['netProfitMarginTTM'],
      revenueTTM:met['revenueTTM'],
      ebitdaTTM:met['ebitdTTM'],
      shortInterest:met['shortInterest'],
      float:met['sharesFloat'],
      dividendYield:met['dividendYieldIndicatedAnnual'],
    };
  }catch{return null;}
}

// ── Earnings estimate ─────────────────────────────────────────────────────────
async function fetchNextEarnings(ticker:string):Promise<string|null>{
  if(!FINNHUB_KEY)return null;
  try{
    const res=await fetch(`${FH_BASE}/stock/earnings?symbol=${ticker}&limit=4&token=${FINNHUB_KEY}`,{signal:AbortSignal.timeout(4000)});
    if(!res.ok)return null;
    const data:any[]=await res.json();
    if(!Array.isArray(data)||data.length<2)return null;
    const sorted=data.filter(d=>d.period).sort((a,b)=>new Date(b.period).getTime()-new Date(a.period).getTime());
    if(sorted.length<2)return null;
    const last=new Date(sorted[0].period),prev=new Date(sorted[1].period);
    const interval=Math.round((last.getTime()-prev.getTime())/86400000);
    const avg=Math.max(80,Math.min(105,interval));
    const next=new Date(last.getTime()+avg*86400000);
    return next>new Date()&&next<new Date(Date.now()+180*86400000)?next.toISOString().split('T')[0]:null;
  }catch{return null;}
}

// ── Signal engine ─────────────────────────────────────────────────────────────
function analyzeSetup(candles:{closes:number[];highs:number[];lows:number[];volumes:number[];price:number},catalystFound:boolean):{setup:string;confidence:number;factors:string[];atr:number;entry:number;indicators:any}|null{
  const{closes,highs,lows,volumes,price}=candles;
  const rsi     = calcRSI(closes);
  const atr     = calcATR(highs,lows,closes);
  const macd    = calcMACD(closes,atr);          // faster 8/17/9 with zero-line filter
  const volData = calcVolumeData(volumes);
  const ema9    = emaLast(closes,9);             // NEW: short-term EMA
  const ema20   = emaLast(closes,20);
  const ema50   = emaLast(closes,50);
  const stoch   = calcStoch(highs,lows,closes);
  const adx     = calcADX(highs,lows,closes);
  const ema20Rising = emaSlope(closes,20);        // NEW: EMA slope check

  // ── Improvement 2: tier-based volume threshold ─────────────────────────────
  // Small price stocks need higher volume to confirm (proxy by price tier)
  const volMin = price < 25 ? 2.0 : price < 100 ? 1.5 : 1.2;
  if(volData.ratio < volMin) return null;

  // ── Hard rejects ───────────────────────────────────────────────────────────
  if(rsi > 75 || rsi < 22) return null;          // Improvement 1: tightened overbought from 78→75

  // ── Improvement 6: tighter sideways chop filter (3%→5%) ───────────────────
  const s20  = closes.slice(-20);
  const mean = s20.reduce((a,b)=>a+b,0)/20;
  const std  = Math.sqrt(s20.reduce((a,b)=>a+(b-mean)**2,0)/20);
  if((2*std)/mean < 0.05 && volData.ratio < 2.0) return null;

  const factors:string[] = []; let score = 0;

  // ── Factor 1: EMA stack alignment (Improvement 5) ─────────────────────────
  const fullStack = price>ema9 && price>ema20 && price>ema50 && ema9>ema20;
  if(fullStack){
    score++;
    factors.push('Full EMA stack — price above 9, 20 & 50 EMA, all aligned');
  } else if(price>ema20 && price>ema50){
    score++;
    factors.push('Trend aligned — price above 20 & 50 EMA');
  } else if(price>ema20){
    factors.push('Partial trend — above 20 EMA only');
  }

  // ── Factor 2: EMA-20 slope bonus (Improvement 7) ──────────────────────────
  if(ema20Rising && (price>ema20)){
    score++;
    factors.push('EMA-20 rising — trend actively strengthening');
  }

  // ── Factor 3: RSI — tightened zones (Improvement 1) ──────────────────────
  if(rsi>=50 && rsi<=65){
    score++;
    factors.push(`RSI ${rsi} — healthy momentum, not overbought`);
  } else if(rsi>65 && rsi<=75){
    factors.push(`RSI ${rsi} — elevated, reduce position size`);
  } else if(rsi>=28 && rsi<42){
    // Tightened dip zone: was 30-48, now 28-42 (Improvement 1)
    score++;
    factors.push(`RSI ${rsi} — genuinely oversold, bounce zone`);
  } else if(rsi>=42 && rsi<50){
    // 42-50 is neutral — no edge, skip
    factors.push(`RSI ${rsi} — neutral zone, no clear signal`);
  }

  // ── Factor 4: Volume (always counted if passed threshold) ─────────────────
  score++;
  factors.push(`Volume ${volData.ratio.toFixed(1)}× avg — ${volData.ratio>=2?'strong institutional interest':volData.ratio>=1.5?'confirmed participation':'minimum threshold met'}`);

  // ── Factor 5: ATR expansion — tightened threshold 1.08→1.15 (Improvement 3) ─
  const atrPrev = calcATR(highs.slice(0,-5),lows.slice(0,-5),closes.slice(0,-5));
  if(atr > atrPrev*1.15){
    score++;
    factors.push('ATR expanding 15%+ — meaningful volatility increase');
  }

  // ── Factor 6: MACD (faster 8/17/9 with zero-line filter) ──────────────────
  if(macd.bullish){
    score++;
    factors.push('MACD bullish — momentum accelerating above zero line');
  }

  // ── Factor 7: ADX — used as filter now (Improvement 4) ───────────────────
  // Not a scoring factor — used as a gate later

  // ── Factor 8: Stochastic confirmation bonus (Improvement 8) ───────────────
  if(rsi<42 && stoch.k<25){
    // Double oversold confirmation
    score++;
    factors.push(`RSI+Stochastic both oversold — high-quality dip setup`);
  } else if(rsi>=50 && stoch.k>50 && stoch.k<75){
    score++;
    factors.push('Stochastic confirming momentum in healthy zone');
  }

  if(catalystFound){ score++; factors.push('Bullish news catalyst in past 72h'); }

  if(score < 4) return null;

  // ── Determine setup type ───────────────────────────────────────────────────
  const high20 = Math.max(...closes.slice(-21,-1));
  let setup: string;
  if(price>high20 && volData.ratio>=1.8)           setup = 'Momentum Breakout';
  else if(rsi<42 && price>ema20)                   setup = 'Dip Buy Reversal';
  else if(catalystFound && volData.ratio>=1.5)     setup = 'News Catalyst';
  else if(score>=5)                                setup = 'Momentum Breakout';
  else return null;

  // ── Improvement 4: ADX as hard gate by setup type ─────────────────────────
  if(setup==='Momentum Breakout' && adx<20) return null;  // Breakouts need real trend
  if(setup==='Dip Buy Reversal'  && adx<15) return null;  // Dip buys need at least weak trend

  // ── Improvement ATR-based entry (not fixed %) ─────────────────────────────
  let entry: number;
  if(setup==='Momentum Breakout')
    entry = parseFloat((price + atr*0.10).toFixed(2));  // 10% of daily range above
  else if(setup==='Dip Buy Reversal')
    entry = parseFloat((price - atr*0.15).toFixed(2));  // 15% of daily range below
  else
    entry = price; // News Catalyst — buy at market open

  const trend = price>ema20&&price>ema50?'bullish':price<ema20&&price<ema50?'bearish':'neutral';

  return{
    setup,confidence:Math.min(10,score),factors,atr,entry,
    indicators:{
      rsi,rsiSignal:rsi<28?'oversold':rsi<50?'neutral':rsi<65?'building':rsi<75?'elevated':'overbought',
      macd,atr,atrPct:parseFloat(((atr/price)*100).toFixed(2)),
      volR:volData.ratio,todayVol:volData.todayVol,avgVol:volData.avgVol,
      ema9:parseFloat(ema9.toFixed(2)),ema20:parseFloat(ema20.toFixed(2)),ema50:parseFloat(ema50.toFixed(2)),
      ema20Rising,fullEmaStack:fullStack,
      stochK:stoch.k,stochD:stoch.d,
      adx,adxStr:adx<20?'weak':adx<30?'moderate':adx<50?'strong':'very_strong',
      trend,
    },
  };
}

// ── S&R levels ────────────────────────────────────────────────────────────────
function calcLevels(c:{closes:number[];highs:number[];lows:number[]},price:number){
  const{closes,highs,lows}=c;
  const n=closes.length;
  // Pivot points from previous session
  const pdh=parseFloat(highs[n-2].toFixed(2));  // Previous Day High (Rumers Box top)
  const pdl=parseFloat(lows[n-2].toFixed(2));   // Previous Day Low  (Rumers Box bottom)
  const pdm=parseFloat(((pdh+pdl)/2).toFixed(2)); // Box midpoint — indecision zone
  const pp=(pdh+pdl+closes[n-2])/3;
  const r1=2*pp-pdl,r2=pp+(pdh-pdl),s1=2*pp-pdh,s2=pp-(pdh-pdl);
  // Fibonacci from 60-bar swing
  const swingHi=Math.max(...highs.slice(-60)),swingLo=Math.min(...lows.slice(-60));
  const range=swingHi-swingLo,isUp=(price-swingLo)>(swingHi-price);
  const base=isUp?swingLo:swingHi,sign=isUp?1:-1;
  const atr=calcATR(highs,lows,closes);
  return{
    pdh,pdl,pdm,  // Previous Day High/Low/Mid — The Rumers Box levels
    r2:parseFloat(r2.toFixed(2)),r1:parseFloat(r1.toFixed(2)),
    s1:parseFloat(s1.toFixed(2)),s2:parseFloat(s2.toFixed(2)),
    pivot:parseFloat(pp.toFixed(2)),
    fib382:parseFloat((base+sign*range*0.382).toFixed(2)),
    fib500:parseFloat((base+sign*range*0.500).toFixed(2)),
    fib618:parseFloat((base+sign*range*0.618).toFixed(2)),
    swingHi:parseFloat(swingHi.toFixed(2)),swingLo:parseFloat(swingLo.toFixed(2)),
    atr:parseFloat(atr.toFixed(2)),
  };
}

// ── Build plan ────────────────────────────────────────────────────────────────
function buildPlan(ticker:string,candles:any,analysis:any,capital:number,meta:any,fundamentals:any,targets:any,keyMoves:any[],earningsDate:string|null,catalystHeadlines:string[],behavior:any){
  // Use Finnhub real-time price if available, else Alpaca last close
  const price=fundamentals?.price&&fundamentals.price>0 ? fundamentals.price : candles.price;
  const{entry,atr}=analysis;
  const stopDist=atr*1.5;
  const stop=parseFloat((entry-stopDist).toFixed(2));
  const tp1=parseFloat((entry+atr*2.0).toFixed(2));
  const tp2=parseFloat((entry+atr*3.5).toFixed(2));
  const shares=Math.max(1,Math.floor((capital*0.03)/stopDist));
  const levels=calcLevels(candles,price);
  const avgDailyPct=parseFloat((candles.closes.slice(-30).reduce((s:number,c:number,i:number,a:number[])=>i>0?s+Math.abs((c-a[i-1])/a[i-1]*100):s,0)/29).toFixed(2));

  // Dollar financials: calculate from TTM revenue + margins
  const revTTM=fundamentals?.revenueTTM??null; // already in dollars from Finnhub metric
  const grossProfit=revTTM&&fundamentals?.grossMargin!=null?Math.round(revTTM*(fundamentals.grossMargin/100)):null;
  const netIncome=revTTM&&fundamentals?.netMargin!=null?Math.round(revTTM*(fundamentals.netMargin/100)):null;

  return{
    ticker,setup_type:analysis.setup,confidence:analysis.confidence,
    factors:analysis.factors,catalystHeadlines,
    meta:{halal:meta.halal,sector:meta.sector,description:meta.description,behavior},
    price:parseFloat(price.toFixed(2)),
    priceSource:fundamentals?.price>0?'realtime':'delayed',
    change:fundamentals?.changePct??0,
    entry,entryLo:parseFloat((entry*0.998).toFixed(2)),entryHi:entry,
    stop,tp1,tp2,
    shares,positionValue:parseFloat((shares*entry).toFixed(2)),maxLoss:parseFloat((shares*stopDist).toFixed(2)),
    rr:parseFloat(((atr*2)/stopDist).toFixed(1)),
    holdDays:analysis.setup==='News Catalyst'?'1 day':'1–3 days',
    indicators:analysis.indicators,levels,
    fundamentals:{
      marketCap:fundamentals?.marketCap??null,pe:fundamentals?.pe??null,beta:fundamentals?.beta??null,
      high52:fundamentals?.high52??null,low52:fundamentals?.low52??null,
      revenueGrowth:fundamentals?.revenueGrowth??null,
      revenueTTM:revTTM,grossProfit,netIncome,
      grossMarginPct:fundamentals?.grossMargin??null,netMarginPct:fundamentals?.netMargin??null,
      shortInterest:fundamentals?.shortInterest??null,float:fundamentals?.float??null,
    },
    targets:targets&&targets.targetConsensus?{
      consensus:targets.targetConsensus,high:targets.targetHigh,low:targets.targetLow,median:targets.targetMedian,
      upside:parseFloat((((targets.targetConsensus-price)/price)*100).toFixed(1)),
    }:null,
    keyMoves,earningsDate,
    volatility:{atrPct:analysis.indicators.atrPct,avgDailyPct},
    chartData:candles.closes.slice(-60).map((c:number,i:number)=>({
      date:candles.dates[candles.dates.length-60+i]??'',
      close:c,
    })),
  };
}

async function batchFetch<T>(tickers:string[],fn:(t:string)=>Promise<T|null>,concurrency=8,delayMs=600):Promise<Map<string,T|null>>{
  const map=new Map<string,T|null>();
  for(let i=0;i<tickers.length;i+=concurrency){
    const batch=tickers.slice(i,i+concurrency);
    await Promise.all(batch.map(async t=>{map.set(t,await fn(t));}));
    if(i+concurrency<tickers.length)await new Promise(r=>setTimeout(r,delayMs));
  }
  return map;
}

// ── Generate behavior profile for any stock via Claude ───────────────────────
async function generateBehavior(ticker:string,sector:string,description:string,apiKey:string):Promise<{primary:string;pattern:string;avoid:string;best:string}|null>{
  try{
    const res=await fetch(ANTHROPIC_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},
      body:JSON.stringify({
        model:'claude-sonnet-4-6',max_tokens:200,
        messages:[{role:'user',content:`For the stock ${ticker} (${sector} sector: ${description}), provide a brief trading behavior profile in this exact JSON format with no other text:
{"primary":"what primarily drives this stock's price movements","pattern":"typical movement behavior and earnings reaction","avoid":"when NOT to trade this (market conditions or catalysts)","best":"what type of setup works best for this stock"}
Keep each field under 15 words. Be specific to this company.`}],
      }),
    });
    const d=await res.json();
    const txt=d.content?.[0]?.text?.trim()??'';
    const m=txt.match(/\{[\s\S]*\}/);
    if(m)return JSON.parse(m[0]);
    return null;
  }catch{return null;}
}

// ── Pick One ranking — Claude compares all setups and picks best ──────────────
async function generatePickOne(setups:any[],apiKey:string):Promise<string>{
  if(setups.length<=1)return '';
  try{
    const summary=setups.map((s,i)=>
      `${i+1}. ${s.ticker} (${s.meta?.sector}) — Confidence ${s.confidence}/10, R:R 1:${s.rr}, Setup: ${s.setup_type}, ATR%: ${s.volatility?.atrPct}%, Earnings: ${s.earningsDate??'none in 90d'}, Analyst upside: ${s.targets?.upside!=null?s.targets.upside+'%':'N/A'}`
    ).join('\n');
    const res=await fetch(ANTHROPIC_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},
      body:JSON.stringify({
        model:'claude-sonnet-4-6',max_tokens:120,
        messages:[{role:'user',content:`You are a professional momentum trader. Given these setups, which single one would you prioritise today if you could only enter one trade? Answer in 2 sentences max. Start with the ticker name.\n\n${summary}`}],
      }),
    });
    const d=await res.json();
    return d.content?.[0]?.text?.trim()??'';
  }catch{return '';}
}

// ── Main ──────────────────────────────────────────────────────────────────────
export async function POST(request:NextRequest){
  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  if(!ALPACA_KEY||!ALPACA_SECRET)return NextResponse.json({signal:'NO_TRADE',reason:'ALPACA_KEY_ID and ALPACA_SECRET not configured in Vercel.',scanned:0,setups:[]});

  const body=await request.json().catch(()=>({}));
  const{price_range='medium',capital=10000,specific_ticker=null}=body;
  const anthropicKey=process.env.ANTHROPIC_API_KEY;
  const isAdmin=user.email===ADMIN_EMAIL;

  async function enrichAndBuild(ticker:string,candles:any,analysis:any|null,meta:any):Promise<any>{
    const[fundamentals,targets,earningsDate,catalyst]=await Promise.all([
      fetchFundamentals(ticker),fetchAnalystTargets(ticker),fetchNextEarnings(ticker),fetchCatalyst(ticker),
    ]);
    const keyMoves=detectKeyMoves(candles);
    const movesWithReasons=anthropicKey
      ?await Promise.all(keyMoves.slice(0,4).map(async m=>({...m,reason:await getMoveReason(ticker,m.date,m.pct,anthropicKey,meta.sector)})))
      :keyMoves.map(m=>({...m,reason:'Enable ANTHROPIC_API_KEY for AI explanations'}));
    // Behavior: use manual profile if available, else Claude-generate it
    const behavior=BEHAVIOR[ticker]??(anthropicKey?await generateBehavior(ticker,meta.sector,meta.description,anthropicKey):null);
    const{data:certs}=await supabase.from('halal_certifications').select('*').eq('ticker',ticker);
    const userCert=certs?.find((c:any)=>c.certified_by===user!.id)??null;
    // Use real-time price from fundamentals for display
    const displayPrice=fundamentals?.price&&fundamentals.price>0?fundamentals.price:candles.price;
    if(!analysis){
      const atr=calcATR(candles.highs,candles.lows,candles.closes);
      const revTTM=fundamentals?.revenueTTM??null;
      return{
        ticker,no_signal:true,
        reason_rejected:'Does not meet all required signal criteria right now — volume, RSI, or trend alignment not confirmed.',
        meta:{halal:meta.halal,sector:meta.sector,description:meta.description,behavior},
        price:parseFloat(displayPrice.toFixed(2)),
        priceSource:fundamentals?.price>0?'realtime':'delayed',
        change:fundamentals?.changePct??0,
        indicators:{
          rsi:calcRSI(candles.closes),macd:calcMACD(candles.closes),atr,
          atrPct:parseFloat((atr/displayPrice*100).toFixed(2)),
          ...calcVolumeData(candles.volumes) as any,
          ema20:parseFloat(emaLast(candles.closes,20).toFixed(2)),ema50:parseFloat(emaLast(candles.closes,50).toFixed(2)),
          stochK:calcStoch(candles.highs,candles.lows,candles.closes).k,adx:calcADX(candles.highs,candles.lows,candles.closes),
        },
        levels:calcLevels(candles,displayPrice),
        fundamentals:{
          marketCap:fundamentals?.marketCap??null,pe:fundamentals?.pe??null,beta:fundamentals?.beta??null,
          high52:fundamentals?.high52??null,low52:fundamentals?.low52??null,
          revenueGrowth:fundamentals?.revenueGrowth??null,
          revenueTTM:revTTM,
          grossProfit:revTTM&&fundamentals?.grossMargin!=null?Math.round(revTTM*(fundamentals.grossMargin/100)):null,
          netIncome:revTTM&&fundamentals?.netMargin!=null?Math.round(revTTM*(fundamentals.netMargin/100)):null,
          grossMarginPct:fundamentals?.grossMargin??null,netMarginPct:fundamentals?.netMargin??null,
        },
        targets:targets&&targets.targetConsensus?{consensus:targets.targetConsensus,high:targets.targetHigh,low:targets.targetLow,median:targets.targetMedian,upside:parseFloat((((targets.targetConsensus-displayPrice)/displayPrice)*100).toFixed(1))}:null,
        keyMoves:movesWithReasons,earningsDate,catalystHeadlines:catalyst.headlines,
        chartData:candles.closes.slice(-60).map((c:number,i:number)=>({date:candles.dates[candles.dates.length-60+i]??'',close:c})),
        volatility:{atrPct:parseFloat((atr/displayPrice*100).toFixed(2)),avgDailyPct:0},
        userCert,canEdit:isAdmin,
      };
    }
    return{...buildPlan(ticker,candles,analysis,capital,meta,fundamentals,targets,movesWithReasons,earningsDate,catalyst.headlines,behavior),userCert,canEdit:isAdmin};
  }

  // ── Mode B: specific ticker ───────────────────────────────────────────────
  if(specific_ticker){
    const ticker=(specific_ticker as string).toUpperCase().trim();
    const candles=await fetchCandles(ticker);
    if(!candles)return NextResponse.json({signal:'NO_DATA',reason:`Could not fetch data for ${ticker}. Verify the ticker symbol and try again.`,scanned:0,setups:[]});
    const meta=UNIVERSE[ticker]??{halal:'doubtful',sector:'Unknown',tier:'medium',description:'Custom ticker — verify all details before trading'};
    const catalyst=await fetchCatalyst(ticker);
    const analysis=analyzeSetup(candles,catalyst.found);
    const card=await enrichAndBuild(ticker,candles,analysis,meta);
    return NextResponse.json({signal:card.no_signal?'NO_SIGNAL':'SETUPS_FOUND',scanned:1,found:card.no_signal?0:1,isAdmin,setups:[card],generated_at:new Date().toISOString()});
  }

  // ── Mode A: auto scan (single tier) ──────────────────────────────────────
  const bounds=PRICE_BOUNDS[price_range]??PRICE_BOUNDS.medium;
  const candidates=Object.entries(UNIVERSE).filter(([,m])=>PRICE_BOUNDS[m.tier]&&PRICE_BOUNDS[m.tier][0]<=bounds[1]&&PRICE_BOUNDS[m.tier][1]>=bounds[0]).map(([t])=>t);
  if(!candidates.length)return NextResponse.json({signal:'NO_TRADE',reason:'No candidates for selected range.',scanned:0,setups:[]});

  const candleMap=await batchFetch(candidates,fetchCandles,8,600);
  const inRange=candidates.filter(t=>{const c=candleMap.get(t);return c&&c.price>=bounds[0]&&c.price<=bounds[1];});

  if(!inRange.length){
    const fetched=candidates.filter(t=>!!candleMap.get(t)).length;
    return NextResponse.json({signal:'NO_TRADE',reason:fetched===0?'Could not fetch market data from Alpaca. Check your API keys in Vercel.':`${fetched} stocks fetched — none currently priced in the ${price_range} range. Try a different range.`,scanned:0,setups:[]});
  }

  // Catalyst check in parallel
  const catalystMap=new Map<string,{found:boolean;headlines:string[]}>();
  await Promise.all(inRange.map(async t=>{catalystMap.set(t,await fetchCatalyst(t));}));

  const validSetups:any[]=[],rejectLog:string[]=[];
  for(const ticker of inRange){
    const candles=candleMap.get(ticker);const cat=catalystMap.get(ticker)??{found:false,headlines:[]};
    if(!candles)continue;
    const analysis=analyzeSetup(candles,cat.found);
    if(!analysis){rejectLog.push(`${ticker}: RSI ${calcRSI(candles.closes)}, Vol ${calcVolumeData(candles.volumes).ratio}×`);continue;}
    const meta=UNIVERSE[ticker];
    validSetups.push(await enrichAndBuild(ticker,candles,analysis,meta));
  }

  validSetups.sort((a,b)=>b.confidence-a.confidence);
  if(!validSetups.length)return NextResponse.json({signal:'NO_TRADE',reason:`Scanned ${inRange.length} stocks in the ${price_range} range. No setups qualified today — capital preservation is the right call.`,scanned:inRange.length,reject_sample:rejectLog.slice(0,6),setups:[]});

  // Generate "Pick One" intelligence if multiple setups
  const pickOne=validSetups.length>1&&anthropicKey?await generatePickOne(validSetups,anthropicKey):'';

  return NextResponse.json({signal:'SETUPS_FOUND',scanned:inRange.length,found:validSetups.length,setups:validSetups.slice(0,5),pickOne,isAdmin,generated_at:new Date().toISOString()});
}
