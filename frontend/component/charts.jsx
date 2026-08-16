/* ============================================================
   NeuralPM — Hand-rolled SVG charts (no external deps)
   ============================================================ */

/* Line/area chart with optional comparison line + amber band */
function LineChart({ data, w=520, h=180, color='var(--accent-blue)', yMax=100, ySuffix='%',
  compare, band, pad={t:16,r:16,b:26,l:36} }) {
  const iw = w-pad.l-pad.r, ih = h-pad.t-pad.b;
  const xs = i => pad.l + (i/(data.length-1))*iw;
  const ys = v => pad.t + ih - (v/yMax)*ih;
  const line = arr => arr.map((d,i)=>`${xs(i)},${ys(d.v)}`).join(' ');
  const area = `${pad.l},${pad.t+ih} ${line(data)} ${pad.l+iw},${pad.t+ih}`;
  const gridY = [0,0.25,0.5,0.75,1].map(f=>pad.t+ih-f*ih);
  return <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display:'block', overflow:'visible' }}>
    {gridY.map((y,i)=><line key={i} x1={pad.l} x2={pad.l+iw} y1={y} y2={y} stroke="var(--border-subtle)" strokeWidth="1"/>)}
    {[0,0.25,0.5,0.75,1].map((f,i)=><text key={i} x={pad.l-8} y={pad.t+ih-f*ih+3} textAnchor="end"
      fontSize="9" fill="var(--text-muted)" fontFamily="Geist Mono">{Math.round(f*yMax)}{ySuffix}</text>)}
    {data.map((d,i)=><text key={i} x={xs(i)} y={h-8} textAnchor="middle" fontSize="9" fill="var(--text-muted)" fontFamily="Geist Mono">{d.x}</text>)}
    {band && <rect x={xs(band[0])} y={pad.t} width={xs(band[1])-xs(band[0])} height={ih} fill="rgba(255,255,255,0.12)"/>}
    <defs><linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity="0.18"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
    <polygon points={area} fill="url(#areaFill)"/>
    {compare && <polyline points={line(compare)} fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeDasharray="4 4"/>}
    <polyline points={line(data)} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    {data.map((d,i)=><circle key={i} cx={xs(i)} cy={ys(d.v)} r="2.5" fill={color}/>)}
  </svg>;
}

/* Donut chart */
function Donut({ slices, size=160, thickness=26, center }) {
  const r = size/2 - thickness/2, cx=size/2, cy=size/2, C=2*Math.PI*r;
  let off = 0;
  const total = slices.reduce((a,s)=>a+s.v,0);
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
    <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-elevated)" strokeWidth={thickness}/>
    {slices.map((s,i)=>{ const frac=s.v/total; const dash=frac*C;
      const el=<circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
        strokeDasharray={`${dash} ${C-dash}`} strokeDashoffset={-off} transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition:'stroke-dasharray 600ms ease' }}/>; off+=dash; return el; })}
    {center && <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
      fontFamily="Syne" fontWeight="700" fontSize="24" fill="var(--text-primary)">{center}</text>}
  </svg>;
}

/* Horizontal confidence bars with 0.6 threshold */
function ConfidenceBars({ prefs }) {
  const w=520, rowH=34, pad={l:150,r:40,t:8,b:8};
  const iw = w-pad.l-pad.r;
  const h = prefs.length*rowH+pad.t+pad.b;
  const thresholdX = pad.l + 0.6*iw;
  return <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display:'block', overflow:'visible' }}>
    {prefs.map((p,i)=>{ const y=pad.t+i*rowH+rowH/2; const active=p.conf>=0.6;
      const barW = p.conf*iw;
      return <g key={p.id} style={{ opacity:active?1:0.5 }}>
        <text x={pad.l-12} y={y+4} textAnchor="end" fontSize="11" fill="var(--text-secondary)" fontFamily="Geist Mono">{p.type}</text>
        <rect x={pad.l} y={y-4} width={iw} height={8} rx={4} fill="var(--bg-elevated)"/>
        <rect x={pad.l} y={y-4} width={barW} height={8} rx={4} fill={active?'var(--success)':'var(--accent-blue)'}
          style={{ transition:'width 600ms ease' }}/>
        <text x={pad.l+barW+8} y={y+4} fontSize="10" fill={active?'var(--success)':'var(--text-muted)'} fontFamily="Geist Mono">{p.conf.toFixed(2)}</text>
      </g>; })}
    <line x1={thresholdX} x2={thresholdX} y1={0} y2={h} stroke="var(--accent-amber)" strokeWidth="1.5" strokeDasharray="4 3"/>
    <text x={thresholdX} y={h-1} textAnchor="middle" fontSize="9" fill="var(--accent-amber)" fontFamily="Geist Mono">Threshold 0.6</text>
  </svg>;
}

Object.assign(window, { LineChart, Donut, ConfidenceBars });
