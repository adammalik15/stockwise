'use client';
import { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import type { PricePoint } from '@/types';

type Period = '1d'|'1mo'|'3mo'|'6mo'|'1y'|'2y';

function fmtX(d:string,p:Period){
  const dt=new Date(d);
  if(p==='1d')return dt.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false});
  return dt.toLocaleDateString('en-US',{month:'short',day:'numeric'});
}
function fmtTip(d:string,p:Period){
  const dt=new Date(d);
  if(p==='1d')return dt.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
  return dt.toLocaleDateString('en-US',{month:'short',day:'numeric',year:p==='2y'?'numeric':undefined});
}

interface KeyMove { date:string; pct:number; direction:'up'|'down'; reason?:string }

export default function PriceChart({
  ticker, initialData, currentPrice, defaultPeriod='3mo', keyMoves=[], pdh, pdl,
}:{
  ticker:string; initialData:PricePoint[]; currentPrice:number;
  defaultPeriod?:Period; keyMoves?:KeyMove[]; pdh?:number; pdl?:number;
}){
  const[period,setPeriod]=useState<Period>(defaultPeriod);
  const[data,setData]=useState<PricePoint[]>(initialData);
  const[loading,setLoading]=useState(false);
  const[width,setWidth]=useState(600);
  const containerRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    function upd(){if(containerRef.current)setWidth(containerRef.current.offsetWidth);}
    upd();
    const ro=new ResizeObserver(upd);
    if(containerRef.current)ro.observe(containerRef.current);
    return()=>ro.disconnect();
  },[]);

  // If initialData changes (new ticker loaded), reset
  useEffect(()=>{setData(initialData);setPeriod(defaultPeriod);},[ticker]);

  async function changePeriod(p:Period){
    if(p===period)return;
    setPeriod(p);
    if(p==='1d'){
      // 1d intraday needs separate fetch
      setLoading(true);
      try{
        const res=await fetch(`/api/stocks/${ticker}/history?period=1d`);
        const json=await res.json();
        const hist=json.history??[];
        // If empty (no intraday on free tier), fall back to 1mo
        if(hist.length===0){setPeriod('1mo');const r2=await fetch(`/api/stocks/${ticker}/history?period=1mo`);const j2=await r2.json();setData(j2.history??[]);}
        else setData(hist);
      }finally{setLoading(false);}
      return;
    }
    setLoading(true);
    try{const res=await fetch(`/api/stocks/${ticker}/history?period=${p}`);const json=await res.json();setData(json.history??[]);}
    finally{setLoading(false);}
  }

  const startPrice=data[0]?.close??currentPrice;
  const isPos=currentPrice>=startPrice;
  const stroke=isPos?'#00d4aa':'#ff4d6d';

  // Map key move dates for reference lines
  const moveDates=new Set(keyMoves.map(m=>m.date));

  const Tip=({active,payload}:any)=>{
    if(!active||!payload?.[0])return null;
    const d=payload[0].payload;
    const move=keyMoves.find(m=>m.date===d.date);
    return(
      <div className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-xs max-w-48">
        <p className="text-secondary mb-1">{fmtTip(d.date,period)}</p>
        <p className="font-mono font-semibold text-white">${d.close?.toFixed(2)}</p>
        {move&&<p className={`mt-1 ${move.pct>0?'text-accent-green':'text-accent-red'} text-[10px] leading-tight`}>{move.pct>0?'+':''}{move.pct}% — {move.reason}</p>}
      </div>
    );
  };

  return(
    <div>
      <div className="flex gap-1 mb-3 flex-wrap">
        {(['1d','1mo','3mo','6mo','1y','2y'] as Period[]).map(p=>(
          <button key={p} onClick={()=>changePeriod(p)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              period===p?'bg-accent-green/15 text-accent-green':'text-secondary hover:text-white hover:bg-surface-2'
            }`}>
            {p}
          </button>
        ))}
        {keyMoves.length>0&&<span className="ml-auto text-[9px] text-muted flex items-center gap-1">⚡ key moves shown</span>}
      </div>

      <div ref={containerRef} className="w-full" style={{height:'220px',position:'relative'}}>
        {loading&&(
          <div className="absolute inset-0 flex items-center justify-center bg-surface-1/60 z-10 rounded-lg">
            <div className="w-5 h-5 border-2 border-accent-green/30 border-t-accent-green rounded-full animate-spin"/>
          </div>
        )}
        {data.length===0?(
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted">No chart data available</p>
          </div>
        ):(
          <AreaChart width={width} height={220} data={data} margin={{top:8,right:5,left:0,bottom:5}}>
            <defs>
              <linearGradient id={`pg-${ticker}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.18}/>
                <stop offset="100%" stopColor={stroke} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tickFormatter={d=>fmtX(d,period)} tick={{fill:'#6b6b7e',fontSize:10}} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
            <YAxis domain={['auto','auto']} tick={{fill:'#6b6b7e',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>'$'+v.toFixed(0)} width={52}/>
            <Tooltip content={<Tip/>}/>

            {/* PDH/PDL — The Rumers Box levels */}
            {pdh&&<ReferenceLine y={pdh} stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1} label={{value:'PDH',position:'right',fill:'#f59e0b',fontSize:9}}/>}
            {pdl&&<ReferenceLine y={pdl} stroke="#3b82f6" strokeDasharray="4 3" strokeWidth={1} label={{value:'PDL',position:'right',fill:'#3b82f6',fontSize:9}}/>}

            {/* Key move markers */}
            {keyMoves.map(m=>(
              <ReferenceLine key={m.date} x={m.date} stroke={m.pct>0?'#10b981':'#ef4444'} strokeDasharray="3 2" strokeWidth={1.5}/>
            ))}

            <Area type="monotone" dataKey="close" stroke={stroke} strokeWidth={2} fill={`url(#pg-${ticker})`} dot={false} activeDot={{r:4,fill:stroke,strokeWidth:0}}/>
          </AreaChart>
        )}
      </div>
    </div>
  );
}
