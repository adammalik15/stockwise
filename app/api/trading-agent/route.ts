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
  ANNA: { halal:'high',    sector:'Healthcare AI',    tier:'small',  description:'AI-powered healthcare analytics' },
  ANGO: { halal:'high',    sector:'Medical Devices',  tier:'small',  description:'Vascular and oncology medical devices' },
  VELO: { halal:'high',    sector:'Healthcare',       tier:'small',  description:'Pharmaceutical development company' },
  SYM:  { halal:'high',    sector:'Robotics',         tier:'small',  description:'AI-powered warehouse robotics' },
  ELVA: { halal:'high',    sector:'EV',               tier:'small',  description:'Electric vehicle charging infrastructure' },
  FLNC: { halal:'high',    sector:'Clean Energy',     tier:'small',  description:'Fluence Energy — grid-scale energy storage' },
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
  NBIS: { halal:'high',    sector:'Semiconductors',   tier:'small',  description:'Nebius — AI cloud infrastructure' },
  // ── MEDIUM ($26–$100) ──────────────────────────────────────────────────────
  HIMS: { halal:'high',    sector:'Healthcare',       tier:'medium', description:'Telehealth platform — hair loss, weight, wellness' },
  PATH: { halal:'high',    sector:'Automation',       tier:'medium', description:'Robotic process automation (RPA) software' },
  AMD:  { halal:'high',    sector:'Semiconductors',   tier:'medium', description:'CPUs, GPUs, and AI chips — competing with NVDA in data centers' },
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
  MRK:  { halal:'high',    sector:'Pharma',           tier:'medium', description:'Merck — oncology, vaccines, and specialty pharma' },
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
  ANET: { halal:'high',    sector:'Networking',       tier:'medium', description:'Arista Networks — cloud networking switches' },
  QCOM: { halal:'high',    sector:'Semiconductors',   tier:'medium', description:'Mobile chipsets and wireless technology licensing' },
  // ── LARGE ($101–$200) ──────────────────────────────────────────────────────
  NVDA: { halal:'high',    sector:'Semiconductors',   tier:'large',  description:'Dominant AI GPU manufacturer — powers data centers worldwide' },
  AAPL: { halal:'medium',  sector:'Consumer Tech',    tier:'large',  description:'iPhone, Mac, services ecosystem — largest market cap' },
  TMO:  { halal:'high',    sector:'Life Sciences',    tier:'large',  description:'Scientific instruments and lab services' },
  ISRG: { halal:'high',    sector:'Robotic Surgery',  tier:'large',  description:'da Vinci robotic surgical systems' },
  PANW: { halal:'high',    sector:'Cybersecurity',    tier:'large',  description:'Comprehensive cybersecurity — firewall to cloud' },
  NOW:  { halal:'high',    sector:'Cloud SaaS',       tier:'large',  description:'IT service management and enterprise workflow automation' },
  AMAT: { halal:'high',    sector:'Semiconductors',   tier:'large',  description:'Semiconductor manufacturing equipment' },
  SNOW: { halal:'high',    sector:'Cloud',            tier:'large',  description:'Cloud data warehouse and analytics platform' },
  ABT:  { halal:'high',    sector:'Healthcare',       tier:'large',  description:'Abbott Labs — diagnostics, medical devices, nutrition' },
  JNJ:  { halal:'high',    sector:'Healthcare',       tier:'large',  description:'Johnson & Johnson — pharmaceuticals and medical devices' },
  FRPT: { halal:'high',    sector:'Pet Food',         tier:'large',  description:'Freshpet — fresh refrigerated pet food' },
  VLO:  { halal:'high',    sector:'Energy',           tier:'large',  description:'Valero Energy — oil refining and fuel production' },
  CVX:  { halal:'high',    sector:'Energy',           tier:'large',  description:'Chevron — integrated energy company' },
  LLY:  { halal:'high',    sector:'Pharma',           tier:'large',  description:'GLP-1 weight loss drugs (Mounjaro, Zepbound) market leader' },
  // ── BIG ($201–$400) ────────────────────────────────────────────────────────
  AVGO: { halal:'high',    sector:'Semiconductors',   tier:'big',    description:'Broadcom — custom AI chips, networking, and enterprise software' },
  TSM:  { halal:'high',    sector:'Semiconductors',   tier:'big',    description:'Taiwan Semiconductor — manufactures chips for Apple, NVDA, AMD' },
  V:    { halal:'high',    sector:'Payments',         tier:'big',    description:'Visa — global payment network technology' },
  ADBE: { halal:'high',    sector:'Software',         tier:'big',    description:'Adobe — creative software (Photoshop, Illustrator, PDF)' },
  ORCL: { halal:'high',    sector:'Cloud',            tier:'big',    description:'Oracle — enterprise database and cloud infrastructure' },
  COR:  { halal:'high',    sector:'Healthcare',       tier:'big',    description:'Cencora (AmerisourceBergen) — pharmaceutical distribution' },
  MSFT: { halal:'high',    sector:'Cloud/AI',         tier:'big',    description:'Azure cloud, Office 365, and OpenAI partnership' },
  TSLA: { halal:'medium',  sector:'EV',               tier:'big',    description:'Electric vehicles, energy storage, autonomous driving, Elon-driven' },
  HD:   { halal:'high',    sector:'Retail',           tier:'big',    description:'Home improvement retail — housing market play' },
  APP:  { halal:'medium',  sector:'Ad Tech',          tier:'big',    description:'AppLovin — mobile advertising and gaming technology' },
  // ── PREMIUM ($401–$700) ────────────────────────────────────────────────────
  ASML: { halal:'high',    sector:'Semiconductors',   tier:'premium',description:'EUV lithography machines — only supplier globally' },
  NVO:  { halal:'high',    sector:'Pharma',           tier:'premium',description:'Novo Nordisk — Ozempic and Wegovy GLP-1 global leader' },
  INTU: { halal:'high',    sector:'SaaS',             tier:'premium',description:'TurboTax, QuickBooks, Credit Karma — financial software' },
  MA:   { halal:'high',    sector:'Payments',         tier:'premium',description:'Mastercard — payment network' },
  // ── ELITE ($701+) ─────────────────────────────────────────────────────────
  LRCX: { halal:'high',    sector:'Semiconductors',   tier:'elite',  description:'Lam Research — etch and deposition semiconductor equipment' },
  COST: { halal:'high',    sector:'Retail',           tier:'elite',  description:'Costco — membership warehouse with ultra-loyal customers' },
};

// Note: SOXX and FENY are ETFs — handled separately in the route
// SOXX = iShares Semiconductor ETF, FENY = Fidelity Energy ETF

// ── Behavior profiles ─────────────────────────────────────────────────────────
const BEHAVIOR: Record<string, {primary:string;pattern:string;avoid:string;best:string}> = {
  NVDA: { primary:'AI GPU demand — data center orders and AI infrastructure spending', pattern:'Leads AI sector. Earnings move ±8-10%. Breakouts sustain on volume.', avoid:'VIX > 25 or broad tech selloff', best:'Momentum breakouts after earnings beats or AI contract announcements' },
  AMD:  { primary:'Market share gains vs Intel CPUs and NVDA GPUs in data centers', pattern:'Often lags NVDA then catches up. Strong on data center revenue beats.', avoid:'When NVDA is falling — AMD follows with 1-2 day lag', best:'Dip buys when NVDA has recovered but AMD has not yet followed' },
  HIMS: { primary:'GLP-1 weight loss drug access and telehealth platform growth', pattern:'FDA news creates 20-35% swings. Earnings ±10-15%. Very news-driven.', avoid:'FDA approval uncertainty or major competitor GLP-1 announcements', best:'Momentum after FDA approvals, coverage expansions, or earnings beats' },
  TSLA: { primary:'Elon Musk news, delivery numbers, and macro interest rate sensitivity', pattern:'Amplifies market moves 2-3x. Retail-driven. Reacts to any Musk tweet.', avoid:'Rising interest rates or Musk controversy weeks', best:'Momentum setups with strong volume confirmation after delivery beats' },
  NVO:  { primary:'Ozempic/Wegovy global demand and obesity drug pipeline expansion', pattern:'Steady grinder with 5-8% pullbacks on competitor drug data readouts.', avoid:'Competitor GLP-1 trial results or pricing pressure from legislation', best:'Dip buys at key support on pullbacks within confirmed uptrend' },
  RKLB: { primary:'Launch manifest growth and satellite services revenue expansion', pattern:'Highly volatile — each launch validates or punishes. Strong retail following.', avoid:'Launch delays, SpaceX competition news, or macro risk-off environment', best:'News catalyst after successful launches and contract wins' },
  PLTR: { primary:'AI platform adoption in government and commercial sectors', pattern:'Moves on government contract wins and AI narrative. S&P inclusion amplified it.', avoid:'Defense budget cut fears or macro risk-off environment', best:'Momentum breakouts after earnings beats with raised guidance' },
  RIOT: { primary:'Bitcoin price correlation — moves 2-3x BTC in both directions', pattern:'If BTC moves -> RIOT amplifies it. If BTC flat -> RIOT dies. Pure retail play.', avoid:'When Bitcoin is in a flat range or falling', best:'When BTC breaks out to new range — RIOT follows with amplification' },
  ALAB: { primary:'AI data center connectivity chip demand from hyperscalers', pattern:'Moves on AI infrastructure news and NVDA/AVGO earnings guidance.', avoid:'Data center capex slowdown fears or hyperscaler earnings misses', best:'Momentum breakouts alongside NVDA/AVGO strength' },
  CRDO: { primary:'High-speed data center interconnect chip demand for AI workloads', pattern:'Moves with AI infrastructure buildout cycle. Earnings ±15-20%.', avoid:'Slowdown in hyperscaler capital expenditure', best:'Breakouts on earnings beats and forward guidance raises' },
  AVGO: { primary:'Custom AI chips (XPUs) for hyperscalers and network infrastructure', pattern:'Slow steady grinder with big earnings moves. Less volatile than AMD/NVDA.', avoid:'Hyperscaler capex cut announcements', best:'Dip buys after broad market pullbacks — it recovers reliably' },
  ANET: { primary:'Cloud networking switches for AI data center buildouts', pattern:'Tight range then explosive earnings move. Very institutional ownership.', avoid:'Cloud spending slowdown or NVDA earnings guidance cut', best:'Post-earnings momentum when guidance is raised' },
  SHOP: { primary:'E-commerce platform growth and merchant services expansion globally', pattern:'Moves on GMV growth and take-rate expansion. Earnings +-8-12%.', avoid:'Consumer spending slowdown fears or Amazon competitive pressure', best:'Breakouts after earnings with strong GMV growth guidance' },
  MSFT: { primary:'Azure cloud growth and AI monetization through Copilot products', pattern:'Slow grinder, steady uptrend. Low beta. Moves on cloud segment growth.', avoid:'Cloud capex concerns or AI ROI skepticism from enterprise clients', best:'Dip buys at 50-day EMA support — very reliable bounce level' },
  CRWD: { primary:'Endpoint security market share gains and platform consolidation trend', pattern:'Moves on deal wins and net new ARR. Earnings +-6-10%. Strong momentum.', avoid:'Enterprise IT budget freeze news or major security breach at competitor', best:'Momentum breakouts after earnings beats with ARR acceleration' },
  PANW: { primary:'Cybersecurity platform consolidation and platformization strategy', pattern:'Strong secular trend. Earnings moves +-5-8%. Institutional favorite.', avoid:'When government IT spending is being questioned', best:'Dip buys during broad market weakness — sector is defensive' },
  MRVL: { primary:'Custom AI chip design wins and data center networking chips', pattern:'Highly correlated to AI infrastructure cycle. Earnings +-10-15%.', avoid:'AI infrastructure spending pause or major customer inventory buildup', best:'Breakouts on AI design win announcements' },
  MU:   { primary:'Memory chip pricing cycle — DRAM and NAND supply/demand balance', pattern:'Highly cyclical. Moves on memory pricing. Earnings can swing +-15-20%.', avoid:'Memory oversupply news or China export restriction headlines', best:'Dip buys when memory pricing trough is confirmed by management' },
  QCOM: { primary:'Mobile chipset licensing and diversification into IoT and auto chips', pattern:'Steady dividend payer. Moves on iPhone cycle and design win news.', avoid:'Apple in-house chip development news or China handset weakness', best:'Dip buys around key support — reliable bounce level stock' },
  NET:  { primary:'Zero-trust network security and cloud edge platform adoption', pattern:'High-growth SaaS. Moves on large enterprise deal wins. Earnings +-8-12%.', avoid:'Macro slowdown affecting enterprise software spending', best:'Momentum breakouts after earnings beats with accelerating net new ARR' },
  DDOG: { primary:'Cloud observability and monitoring platform for DevOps teams', pattern:'Pure growth SaaS. Moves on net new ARR and customer count growth.', avoid:'Cloud spending optimization or enterprise consolidation waves', best:'Breakouts post-earnings when usage-based revenue accelerates' },
  PATH: { primary:'Robotic process automation market and AI agent workflow adoption', pattern:'Highly correlated to enterprise software spending cycle.', avoid:'Enterprise IT budget freeze or RPA competitive pressure from Microsoft', best:'Breakouts on enterprise deal announcements and ARR acceleration' },
  ZETA: { primary:'Data-driven marketing technology and identity resolution platform', pattern:'Moves on customer growth and platform expansion.', avoid:'Digital ad spending slowdowns or privacy regulation tightening', best:'Momentum after earnings beats with raised full-year guidance' },
  VRT:  { primary:'Power management and cooling solutions for AI data centers', pattern:'Direct beneficiary of AI data center buildout. Moves with data center capex.', avoid:'Data center construction pause or power grid capacity constraints', best:'Momentum breakouts alongside NVDA data center earnings beats' },
  SNOW: { primary:'Cloud data warehouse consumption revenue and AI workload adoption', pattern:'Consumption-based SaaS — very volatile earnings. Revenue tied to actual usage.', avoid:'Cloud optimization waves where customers reduce data workloads', best:'Breakouts when product revenue acceleration is confirmed on earnings' },
  AAPL: { primary:'iPhone supercycle expectations and Services revenue growth', pattern:'Moves on iPhone shipment estimates and App Store/Services margin expansion.', avoid:'Consumer spending slowdown or China market weakness', best:'Dip buys at 200-day EMA — Apple is the ultimate buy-the-dip stock' },
  LLY:  { primary:'GLP-1 drug demand globally — Mounjaro and Zepbound weight loss', pattern:'Steady long-term uptrend with occasional 5-10% corrections on supply news.', avoid:'Drug pricing legislation news or manufacturing capacity constraint headlines', best:'Dip buys during market pullbacks — fundamental thesis very strong' },
  MRK:  { primary:'Oncology drug pipeline led by Keytruda cancer treatment', pattern:'Steady compounder. Moves on Keytruda sales growth and pipeline readouts.', avoid:'Major pipeline failure news or biosimilar competition for Keytruda', best:'Dip buys at support — defensive healthcare stock with growth' },
  TSM:  { primary:'Global semiconductor manufacturing capacity and AI chip production', pattern:'Steady compounder. Moves on NVIDIA order growth and foundry capacity news.', avoid:'China-Taiwan geopolitical tensions or ASML equipment export restrictions', best:'Dip buys during geopolitical fear selloffs — business fundamentals intact' },
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
// CRITICAL: sort=desc (newest first) + reverse = always get the 90 MOST RECENT bars
// sort=asc+start+limit returns oldest N bars, not newest — PDH/PDL would be months stale
async function fetchCandles(ticker:string):Promise<{closes:number[];highs:number[];lows:number[];volumes:number[];dates:string[];price:number}|null>{
  if(!ALPACA_KEY||!ALPACA_SECRET)return null;
  try{
    const res=await fetch(`${ALPACA_BASE}/${ticker}/bars?timeframe=1Day&limit=90&feed=sip&sort=desc`,{
      headers:{'APCA-API-KEY-ID':ALPACA_KEY,'APCA-API-SECRET-KEY':ALPACA_SECRET},
      signal:AbortSignal.timeout(8000),
    });
    if(!res.ok)return null;
    const raw:any[]=(await res.json())?.bars??[];
    if(raw.length<30)return null;
    const bars=raw.slice().reverse(); // ascending: bars[0]=oldest, bars[n-1]=most recent session
    return{
      closes: bars.map((b:any)=>b.c),
      highs:  bars.map((b:any)=>b.h),
      lows:   bars.map((b:any)=>b.l),
      volumes:bars.map((b:any)=>b.v),
      dates:  bars.map((b:any)=>b.t.split('T')[0]),
      price:  bars[bars.length-1].c,
    };
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

// ── Explain key moves — batch all moves for a stock in ONE Claude call ────────
async function getMoveReasons(ticker:string,moves:{date:string;pct:number}[],apiKey:string,sector:string):Promise<string[]>{
  if(!moves.length) return [];
  // Fetch news for the date range covering all moves
  let allHeadlines: Record<string,string[]> = {};
  if(FINNHUB_KEY){
    await Promise.all(moves.map(async m=>{
      try{
        const from=new Date(new Date(m.date).getTime()-86400000).toISOString().split('T')[0];
        const to=new Date(new Date(m.date).getTime()+86400000).toISOString().split('T')[0];
        const res=await fetch(`${FH_BASE}/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${FINNHUB_KEY}`,{signal:AbortSignal.timeout(4000)});
        if(res.ok){
          const articles=await res.json();
          allHeadlines[m.date]=(Array.isArray(articles)?articles:[]).slice(0,3).map((a:any)=>a.headline??'').filter(Boolean);
        }
      }catch{}
    }));
  }
  try{
    const moveText=moves.map(m=>{
      const heads=allHeadlines[m.date]??[];
      return `${m.date}: ${m.pct>0?'+':''}${m.pct}% ${heads.length?'| Headlines: '+heads.join(' | '):'| No news found'}`;
    }).join('\n');
    const res=await fetch(ANTHROPIC_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},
      body:JSON.stringify({
        model:'claude-sonnet-4-6',max_tokens:300,
        messages:[{role:'user',content:`${ticker} is a ${sector} company. Explain each price move in ONE plain sentence (max 15 words). If no news, infer from typical catalysts for this company type. Return ONLY a JSON array of strings, one per move, in same order:\n${moveText}\nFormat: ["reason1","reason2",...]`}],
      }),
    });
    const d=await res.json();
    const raw=(d.content?.[0]?.text??'').trim().replace(/^```[a-z]*\s*/,'').replace(/\s*```\s*$/,'').trim();
    try{
      const arr=JSON.parse(raw);
      if(Array.isArray(arr))return arr.map(String);
    }catch{}
    const idx=raw.indexOf('[');const last=raw.lastIndexOf(']');
    if(idx>=0&&last>idx){try{const arr=JSON.parse(raw.slice(idx,last+1));if(Array.isArray(arr))return arr.map(String);}catch{}}
    return moves.map(m=>m.pct>0?'Strong buying — likely sector momentum or institutional accumulation':'Heavy selling — likely profit-taking or macro risk-off');
  }catch{
    return moves.map(m=>m.pct>0?'Strong buying pressure in the session':'Heavy selling pressure in the session');
  }
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
  // Previous Day High/Low = last completed bar (Rumers Box)
  // bars are sorted asc: bars[n-1] = most recent session, bars[n-2] = prior session
  // For PDH/PDL use bars[n-1] since that IS the previous completed trading day
  const pdh=parseFloat(highs[n-1].toFixed(2));
  const pdl=parseFloat(lows[n-1].toFixed(2));
  const pdm=parseFloat(((pdh+pdl)/2).toFixed(2));
  // Pivot points from prior session (bars[n-1])
  const pp=(pdh+pdl+closes[n-1])/3;
  const r1=parseFloat((2*pp-pdl).toFixed(2));
  const r2=parseFloat((pp+(pdh-pdl)).toFixed(2));
  const s1=parseFloat((2*pp-pdh).toFixed(2));
  const s2=parseFloat((pp-(pdh-pdl)).toFixed(2));
  // Fibonacci from 60-bar swing (for longer-term context)
  const swingHi=Math.max(...highs.slice(-60));
  const swingLo=Math.min(...lows.slice(-60));
  const range=swingHi-swingLo;
  const isUp=(price-swingLo)>(swingHi-price);
  const base=isUp?swingLo:swingHi,sign=isUp?1:-1;
  const atr=calcATR(highs,lows,closes);
  return{
    pdh,pdl,pdm,
    r2,r1,s1,s2,
    pivot:parseFloat(pp.toFixed(2)),
    fib382:parseFloat((base+sign*range*0.382).toFixed(2)),
    fib500:parseFloat((base+sign*range*0.500).toFixed(2)),
    fib618:parseFloat((base+sign*range*0.618).toFixed(2)),
    swingHi:parseFloat(swingHi.toFixed(2)),
    swingLo:parseFloat(swingLo.toFixed(2)),
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
        model:'claude-sonnet-4-6',max_tokens:250,
        messages:[{role:'user',content:`Stock: ${ticker} | Sector: ${sector} | About: ${description}\nReturn ONLY valid JSON (no markdown, no explanation):\n{"primary":"main catalyst driving price 12 words max","pattern":"typical movement pattern and earnings behavior 15 words max","avoid":"when NOT to trade this 12 words max","best":"best setup type for this stock 12 words max"}`}],
      }),
    });
    const d=await res.json();
    const raw=(d.content?.[0]?.text??'').trim().replace(/^```[a-z]*\s*/,'').replace(/\s*```\s*$/,'').trim();
    try{return JSON.parse(raw);}catch{}
    const idx=raw.indexOf('{');const last=raw.lastIndexOf('}');
    if(idx>=0&&last>idx){try{return JSON.parse(raw.slice(idx,last+1));}catch{}}
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
  const userId = user.id;
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
    const movesWithReasons = anthropicKey
      ? await (async () => {
          const reasons = await getMoveReasons(ticker, keyMoves.slice(0,4).map(m=>({date:m.date,pct:m.pct})), anthropicKey, meta.sector);
          return keyMoves.slice(0,4).map((m,i)=>({...m,reason:reasons[i]??'Significant price move — historical context unavailable'}));
        })()
      : keyMoves.slice(0,4).map(m=>({...m,reason:'Enable ANTHROPIC_API_KEY for AI explanations'}));
    // Behavior: use manual profile if available, else Claude-generate it
    const behavior=BEHAVIOR[ticker]??(anthropicKey?await generateBehavior(ticker,meta.sector,meta.description,anthropicKey):null);
    const{data:certs}=await supabase.from('halal_certifications').select('*').eq('ticker',ticker);
    const userCert=certs?.find((c:any)=>c.certified_by===userId)??null;
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
  // Scan ALL universe stocks — actual Alpaca price determines range match
  // 20 concurrent, no delay — ~120 stocks takes 3-4s, within Vercel 10s limit
  const candidates=Object.keys(UNIVERSE);
  const candleMap=await batchFetch(candidates,fetchCandles,20,0);
  const inRange=candidates.filter(t=>{const c=candleMap.get(t);return c&&c.price>=bounds[0]&&c.price<=bounds[1];});

  if(!inRange.length){
    const fetched=candidates.filter(t=>!!candleMap.get(t)).length;
    return NextResponse.json({signal:'NO_TRADE',reason:fetched===0?'Could not fetch market data from Alpaca. Check your API keys in Vercel.':`${fetched} stocks fetched — none currently priced in the ${price_range} range. Try a different range.`,scanned:0,setups:[]});
  }

  // Catalyst check in parallel
  const catalystMap=new Map<string,{found:boolean;headlines:string[]}>();
  await Promise.all(inRange.map(async t=>{catalystMap.set(t,await fetchCatalyst(t));}));

  // Signal check (synchronous, fast) — collect qualifying stocks
  const rejectLog:string[]=[];
  const qualifyingSetups:{ticker:string;candles:any;analysis:any;meta:any}[]=[];
  for(const ticker of inRange){
    const candles=candleMap.get(ticker);const cat=catalystMap.get(ticker)??{found:false,headlines:[]};
    if(!candles)continue;
    const analysis=analyzeSetup(candles,cat.found);
    if(!analysis){rejectLog.push(`${ticker}: RSI ${calcRSI(candles.closes)}, Vol ${calcVolumeData(candles.volumes).ratio}×`);continue;}
    qualifyingSetups.push({ticker,candles,analysis,meta:UNIVERSE[ticker]});
  }

  // Enrich ALL qualifying stocks IN PARALLEL — avoids serial 3-4s per stock timeout
  const validSetups=await Promise.all(
    qualifyingSetups.map(({ticker,candles,analysis,meta})=>enrichAndBuild(ticker,candles,analysis,meta))
  );

  validSetups.sort((a,b)=>b.confidence-a.confidence);
  if(!validSetups.length)return NextResponse.json({signal:'NO_TRADE',reason:`Scanned ${inRange.length} stocks in the ${price_range} range. No setups qualified today — capital preservation is the right call.`,scanned:inRange.length,reject_sample:rejectLog.slice(0,6),setups:[]});

  // Generate "Pick One" intelligence if multiple setups
  const pickOne=validSetups.length>1&&anthropicKey?await generatePickOne(validSetups,anthropicKey):'';

  return NextResponse.json({signal:'SETUPS_FOUND',scanned:inRange.length,found:validSetups.length,setups:validSetups.slice(0,5),pickOne,isAdmin,generated_at:new Date().toISOString()});
}
