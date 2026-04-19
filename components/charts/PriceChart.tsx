'use client';
import { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import type { PricePoint } from '@/types';

type Period = '1d'|'1mo'|'3mo'|'6mo'|'1y'|'2y';

function fmtX(d:string,p:Period){
  if(p==='1d'){
    // d may be ISO with time or just date
    const dt=new Date(d);
    if(isNaN(dt.getTime()))return d;
    return dt.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false});
  }
  const dt=new Date(d+'T12:00:00'); // noon UTC avoids timezone date-shift
  return dt.toLocaleDateString('en-US',{month:'short',day:'numeric'});
}

function fmtTip(d:string,p:Period){
  const dt=new Date(p==='1d'?d:d+'T12:00:00');
  if(p==='1d')return dt.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
  return dt.toLocaleDateString('en-US',{month:'short',day:'numeric',year:p==='2y'?'numeric':undefined});
}

interface KeyMove{date:string;pct:number;direction:'up'|'down';reason?:string}

export default function PriceChart({
  ticker, initialData, currentPrice, defaultPeriod='3mo', keyMoves=[], pdh, pdl,
}:{
  ticker:string; initialData:PricePoint[]; currentPrice:number;
  defaultPeriod?:Period; keyMoves?:KeyMove[]; pdh?:number; pdl?:number;
}){
  const[period,setPeriod]=useState<Period>(defaultPeriod);
  const[data,setData]=useState<PricePoint[]>(initialData);
  const[loading,setLoading]=useState(false);
  const[notice,setNotice]=useState('');
  const[width,setWidth]=useState(600);
  const containerRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    function upd(){if(containerRef.current)setWidth(containerRef.current.offsetWidth);}
    upd();
    const ro=new ResizeObserver(upd);
    if(containerRef.current)ro.observe(containerRef.current);
    return()=>ro.disconnect();
  },[]);

  useEffect(()=>{setData(initialData);setPeriod(defaultPeriod);setNotice('');},[ticker]);

  async function changePeriod(p:Period){
    if(p===period)return;
    setNotice('');
    if(p==='1d'){
      setLoading(true);
      try{
        const res=await fetch(`/api/stocks/${ticker}/history?period=1d`);
        const json=await res.json();
        const hist=json.history??[];
        if(hist.length>0){
          setPeriod('1d');
          setData(hist);
        } else {
          // Market closed — show last trading session from current data (1-bar slice)
          // Fetch 1mo and show just the last day's data as a flat reference
          setNotice('Market closed — showing last session');
          const r2=await fetch(`/api/stocks/${ticker}/history?period=1mo`);
          const j2=await r2.json();
          const bars:PricePoint[]=j2.history??[];
          if(bars.length>0){
            // Show just the last bar as a single point (flat line at close)
            const last=bars[bars.length-1];
            setData([last]);
          }
          setPeriod('1d');
        }
      }finally{setLoading(false);}
      return;
    }
    setPeriod(p);
    setLoading(true);
    try{
      const res=await fetch(`/api/stocks/${ticker}/history?period=${p}`);
      const json=await res.json();
      setData(json.history??[]);
    }finally{setLoading(false);}
  }

  const startPrice=data[0]?.close??currentPrice;
  const isPos=currentPrice>=startPrice;
  const stroke=isPos?'#00d4aa':'#ff4d6d';

  const Tip=({active,payload}:any)=>{
    if(!active||!payload?.[0])return null;
    const d=payload[0].payload;
    const move=keyMoves.find(m=>m.date===d.date);
    return(
      <div className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-xs max-w-52">
        <p className="text-secondary mb-1">{fmtTip(d.date,period)}</p>
        <p className="font-mono font-semibold text-white">${d.close?.toFixed(2)}</p>
        {move&&<p className={`mt-1 text-[10px] leading-tight ${move.pct>0?'text-accent-green':'text-accent-red'}`}>{move.pct>0?'+':''}{move.pct}% — {move.reason}</p>}
      </div>
    );
  };

  return(
    <div>
      <div className="flex gap-1 mb-3 flex-wrap items-center">
        {(['1d','1mo','3mo','6mo','1y','2y'] as Period[]).map(p=>(
          <button key={p} onClick={()=>changePeriod(p)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${period===p?'bg-accent-green/15 text-accent-green':'text-secondary hover:text-white hover:bg-surface-2'}`}>
            {p}
          </button>
        ))}
        {notice&&<span className="text-[9px] text-muted ml-1 italic">{notice}</span>}
        {keyMoves.length>0&&!notice&&<span className="ml-auto text-[9px] text-muted">⚡ key move markers</span>}
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
          <AreaChart width={width} height={220} data={data} margin={{top:8,right:16,left:0,bottom:5}}>
            <defs>
              <linearGradient id={`pg-${ticker}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.18}/>
                <stop offset="100%" stopColor={stroke} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tickFormatter={d=>fmtX(d,period)}
              tick={{fill:'#6b6b7e',fontSize:10}} axisLine={false} tickLine={false}
              interval="preserveStartEnd"/>
            <YAxis domain={['auto','auto']}
              tick={{fill:'#6b6b7e',fontSize:10}} axisLine={false} tickLine={false}
              tickFormatter={v=>'$'+v.toFixed(0)} width={52}/>
            <Tooltip content={<Tip/>}/>

            {/* Rumers Box — PDH/PDL */}
            {pdh&&<ReferenceLine y={pdh} stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1.5}
              label={{value:'PDH',position:'insideRight',fill:'#f59e0b',fontSize:9}}/>}
            {pdl&&<ReferenceLine y={pdl} stroke="#3b82f6" strokeDasharray="4 3" strokeWidth={1.5}
              label={{value:'PDL',position:'insideRight',fill:'#3b82f6',fontSize:9}}/>}

            {/* Key move vertical markers */}
            {keyMoves.map(m=>(
              <ReferenceLine key={m.date} x={m.date}
                stroke={m.pct>0?'#10b981':'#ef4444'}
                strokeDasharray="3 2" strokeWidth={1.5} strokeOpacity={0.7}/>
            ))}

            <Area type="monotone" dataKey="close"
              stroke={stroke} strokeWidth={2}
              fill={`url(#pg-${ticker})`} dot={false}
              activeDot={{r:4,fill:stroke,strokeWidth:0}}/>
          </AreaChart>
        )}
      </div>
    </div>
  );
}
