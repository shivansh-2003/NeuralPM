/* ============================================================
   NeuralPM — Cascade Timeline + What-If Simulator
   ============================================================ */

function CascadeTimeline({ toast, openTask }) {
  const { SHIFTS } = window.NPM_DATA;
  const [expanded, setExpanded] = useState(null);
  const [sim, setSim] = useState(false);
  return <div style={{ padding:'16px 24px 40px' }}>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
      <div className="type-heading">Recent Timeline Shifts</div>
      <button className="btn btn-ghost" onClick={()=>setSim(true)}><Icon.node s={15}/>Open What-If Simulator</button>
    </div>
    {SHIFTS.length===0 ? <div style={{ padding:48, textAlign:'center', color:'var(--text-muted)' }}>No timeline shifts recorded yet.</div> :
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {SHIFTS.map(s=><div key={s.id} className="card" style={{ padding:0, overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', gap:16, padding:'16px 20px' }}>
          <div style={{ width:54, textAlign:'center' }}>
            <div style={{ fontFamily:'Space Grotesk', fontWeight:700, fontSize:20, color:'var(--accent-amber)' }}>{s.delta}</div>
            <div className="type-small">slip</div></div>
          <div style={{ width:1, height:36, background:'var(--border-subtle)' }}></div>
          <div style={{ flex:1 }}>
            <div className="type-subheading" style={{ marginBottom:3 }}>{s.task}</div>
            <div className="type-small">Caused by: {s.cause} · {s.date}</div></div>
          <span className="chip" style={{ cursor:'default' }}>{s.downstream} tasks affected</span>
          <button className="btn btn-ghost" onClick={()=>setExpanded(expanded===s.id?null:s.id)}>
            {expanded===s.id?'Hide':'View'} Impact</button>
        </div>
        {expanded===s.id && <CascadeImpact shift={s} toast={toast} openTask={openTask}/>}
      </div>)}
    </div>}
    {sim && <WhatIfSimulator onClose={()=>setSim(false)} toast={toast}/>}
  </div>;
}

const IMPACT_ROWS = [
  { task:'Payment API', orig:'Jul 10', proj:'Jul 14', delta:'+4d', sev:'amber' },
  { task:'Checkout Flow', orig:'Jul 15', proj:'Jul 19', delta:'+4d', sev:'amber' },
  { task:'End-to-End Tests', orig:'Jul 18', proj:'Jul 22', delta:'+4d', sev:'red' },
];
function CascadeImpact({ shift, toast, openTask }) {
  const [applied, setApplied] = useState(null);
  const scenarios = [
    { name:'Standard Propagation', desc:'Let all downstream dates slip by the same delta.', trade:'Release date moves +4d', dates:'Demo → Jul 24' },
    { name:'Scope Cut', desc:'Drop saved-card selection from checkout to absorb the slip.', trade:'Protects release date', dates:'Demo → Jul 20', pref:true },
    { name:'Parallelise Tests', desc:'Start E2E tests against staging before checkout is final.', trade:'+1 engineer, risk of rework', dates:'Demo → Jul 21' },
  ];
  return <div style={{ borderTop:'1px solid var(--border-subtle)', background:'var(--bg-base)', padding:20 }}>
    <div style={{ background:'var(--danger-dim)', border:'1px solid rgba(255,45,45,0.4)', borderRadius:'var(--radius-md)', padding:'10px 14px',
      marginBottom:18, fontSize:13, color:'#FF8C8C', display:'flex', gap:8, alignItems:'center' }}>
      <Icon.warn s={16}/>New projected date for End-to-End Tests conflicts with milestone: Client Demo (Jul 20).</div>
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
      <div>
        <div className="type-small" style={{ letterSpacing:'0.1em', marginBottom:12 }}>DEPENDENCY MAP</div>
        <MiniDepGraph/>
      </div>
      <div>
        <div className="type-small" style={{ letterSpacing:'0.1em', marginBottom:12 }}>BEFORE / AFTER</div>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
          <thead><tr style={{ color:'var(--text-muted)' }}>{['Task','Original','New','Δ'].map(h=><th key={h} style={{ textAlign:'left', padding:'4px 8px', fontWeight:600, fontSize:10.5, letterSpacing:'0.06em', textTransform:'uppercase' }}>{h}</th>)}</tr></thead>
          <tbody>{IMPACT_ROWS.map((r,i)=><tr key={i} style={{ borderTop:'1px solid var(--border-subtle)' }}>
            <td style={{ padding:'7px 8px', color:'var(--text-secondary)' }}>{r.task}</td>
            <td style={{ padding:'7px 8px', fontFamily:'Geist Mono', color:'var(--text-muted)' }}>{r.orig}</td>
            <td style={{ padding:'7px 8px', fontFamily:'Geist Mono', color:'var(--text-primary)' }}>{r.proj}</td>
            <td style={{ padding:'7px 8px', fontFamily:'Geist Mono', color:r.sev==='red'?'var(--danger)':'var(--accent-amber)' }}>{r.delta}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
    <div className="type-small" style={{ letterSpacing:'0.1em', margin:'22px 0 12px' }}>MITIGATION SCENARIOS</div>
    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
      {scenarios.map((s,i)=><div key={i} style={{ background:'var(--bg-surface)', border:`1px solid ${applied===i?'var(--accent-blue)':s.pref?'var(--accent-amber)':'var(--border-subtle)'}`,
        borderRadius:'var(--radius-md)', padding:14, boxShadow:s.pref?'var(--accent-amber-glow)':'none' }}>
        {s.pref && <div style={{ fontSize:10.5, color:'var(--accent-amber)', fontWeight:600, marginBottom:6 }}>✦ MATCHES YOUR TIMELINE PHILOSOPHY</div>}
        <div className="type-subheading" style={{ marginBottom:6 }}>{s.name}</div>
        <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.5, marginBottom:10 }}>{s.desc}</div>
        <div style={{ fontSize:11.5, color:'var(--text-muted)', marginBottom:4 }}>Trade-off: {s.trade}</div>
        <div style={{ fontSize:11.5, fontFamily:'Geist Mono', color:'var(--text-secondary)', marginBottom:12 }}>{s.dates}</div>
        <button className={'btn '+(applied===i?'btn-success':'btn-primary')} style={{ width:'100%', justifyContent:'center', padding:'6px' }}
          onClick={()=>{ setApplied(i); toast&&toast({kind:'success',text:`Applied "${s.name}" — logged to Memory Agent.`}); }}>
          {applied===i?<><Icon.check s={13}/>Applied</>:'Apply this scenario'}</button>
      </div>)}
    </div>
  </div>;
}

function MiniDepGraph() {
  const nodes = [
    { x:10, y:50, label:'Payment API', date:'Jul 14', c:'amber' },
    { x:130, y:20, label:'Checkout', date:'Jul 19', c:'amber' },
    { x:130, y:80, label:'Notif Svc', date:'Jul 16', c:'blue' },
    { x:250, y:50, label:'E2E Tests', date:'Jul 22', c:'red' },
  ];
  const edges = [[0,1],[0,2],[1,3],[2,3]];
  const col = { amber:'var(--accent-amber)', blue:'var(--accent-blue)', red:'var(--danger)' };
  return <svg width="100%" viewBox="0 0 360 120" style={{ display:'block' }}>
    {edges.map((e,i)=>{ const a=nodes[e[0]],b=nodes[e[1]];
      return <line key={i} x1={a.x+96} y1={a.y+18} x2={b.x} y2={b.y+18} stroke="var(--accent-blue)" strokeWidth="1.5" markerEnd="url(#arr)"/>; })}
    <defs><marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L7 4L0 8z" fill="var(--accent-blue)"/></marker></defs>
    {nodes.map((n,i)=><g key={i}>
      <rect x={n.x} y={n.y} width="96" height="36" rx="4" fill="var(--bg-elevated)" stroke={col[n.c]} strokeWidth="1.5"/>
      <text x={n.x+8} y={n.y+15} fontSize="10" fill="var(--text-primary)" fontFamily="General Sans" fontWeight="500">{n.label}</text>
      <text x={n.x+8} y={n.y+28} fontSize="9" fill="var(--text-muted)" fontFamily="Geist Mono">{n.date}</text>
    </g>)}
  </svg>;
}

/* ---------- What-If Simulator ---------- */
function WhatIfSimulator({ onClose, toast }) {
  const base = [
    { id:'TK-047', label:'pgvector', col:0, row:1, start:0, len:3, deps:[] },
    { id:'TK-042', label:'Payment API', col:1, row:0, start:2, len:4, deps:['TK-047'] },
    { id:'TK-050', label:'Notif fan-out', col:1, row:2, start:3, len:3, deps:['TK-047'] },
    { id:'TK-043', label:'Checkout', col:2, row:0, start:6, len:3, deps:['TK-042'] },
    { id:'TK-044', label:'E2E Tests', col:3, row:1, start:9, len:3, deps:['TK-043','TK-050'] },
  ];
  const [shift, setShift] = useState({}); // id -> extra days
  const [calc, setCalc] = useState(false);
  const milestone = 13; // demo day index

  // propagate shifts downstream
  const computed = useMemo(() => {
    const map = {}; base.forEach(t=>map[t.id]={...t});
    const order = ['TK-047','TK-042','TK-050','TK-043','TK-044'];
    order.forEach(id=>{
      const t = map[id];
      let start = base.find(b=>b.id===id).start + (shift[id]||0);
      t.deps.forEach(d=>{ const dep=map[d]; start = Math.max(start, dep.start+dep.len); });
      t.start = start;
      t.dragged = !!shift[id];
    });
    // downstream affected = end shifts vs base
    order.forEach(id=>{ const t=map[id]; const b=base.find(x=>x.id===id);
      t.affected = (t.start!==b.start) && !shift[id];
      t.conflict = (t.start+t.len) > milestone; });
    return order.map(id=>map[id]);
  }, [shift]);

  const totalDays = 16;
  const dragRef = useRef(null);
  const onDrag = (id, e) => {
    e.preventDefault();
    setCalc(true);
    const startX = e.clientX; const base0 = shift[id]||0;
    const move = (ev) => { const dd = Math.round((ev.clientX-startX)/28); setShift(s=>({...s,[id]:Math.max(0,base0+dd)})); };
    const up = () => { window.removeEventListener('mousemove',move); window.removeEventListener('mouseup',up); setTimeout(()=>setCalc(false),400); };
    window.addEventListener('mousemove',move); window.addEventListener('mouseup',up);
  };
  const anyChange = Object.values(shift).some(v=>v>0);

  return <div style={{ position:'fixed', inset:0, top:'var(--nav-h)', background:'var(--bg-base)', zIndex:80,
    display:'flex', flexDirection:'column' }} className="neural-grid">
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 24px', borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-surface)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}><Icon.node s={18} style={{ color:'var(--accent-blue)' }}/>
        <span className="type-heading">What-If Simulator</span>
        {calc && <span style={{ display:'flex', alignItems:'center', gap:6, color:'var(--text-muted)', fontSize:12 }}><AgentDots/>Calculating…</span>}</div>
      <div style={{ display:'flex', gap:8 }}>
        <button className="btn btn-muted" onClick={()=>setShift({})} disabled={!anyChange}><Icon.refresh s={14}/>Reset to current</button>
        <button className="btn btn-primary" disabled={!anyChange||calc} onClick={()=>{ toast&&toast({kind:'success',text:'Simulated timeline applied to project.'}); onClose(); }}>Apply to Project</button>
        <button className="icon-btn" onClick={onClose}><Icon.close/></button>
      </div>
    </div>
    <div style={{ flex:1, overflow:'auto', padding:32 }}>
      <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:20 }}>Drag any bar right to push its start date — downstream tasks recompute live. Red = milestone conflict (Client Demo, day {milestone}).</div>
      {/* dependency graph */}
      <div style={{ position:'relative', height:200, marginBottom:32 }}>
        <svg width="100%" height="200" style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
          <defs><marker id="arr2" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0 0L8 4.5L0 9z" fill="var(--border-default)"/></marker></defs>
          {computed.map(t=>t.deps.map(d=>{ const from=computed.find(x=>x.id===d); if(!from) return null;
            const fx=from.col*200+150, fy=from.row*64+30, tx=t.col*200+30, ty=t.row*64+30;
            const aff=t.affected||t.dragged;
            return <line key={t.id+d} x1={fx} y1={fy} x2={tx} y2={ty} stroke={aff?'var(--accent-blue)':'var(--border-default)'} strokeWidth={aff?2:1.5} markerEnd="url(#arr2)"/>; }))}
        </svg>
        {computed.map(t=>{ const bc = t.dragged?'var(--accent-amber)':t.conflict?'var(--danger)':t.affected?'var(--accent-blue)':'var(--border-default)';
          return <div key={t.id} style={{ position:'absolute', left:t.col*200, top:t.row*64, width:150, background:'var(--bg-elevated)',
            border:`1px solid ${bc}`, borderRadius:'var(--radius-sm)', padding:'8px 12px',
            boxShadow: t.dragged?'var(--accent-amber-glow)':t.conflict?'0 0 12px rgba(255,45,45,0.25)':'none',
            background: t.conflict?'rgba(59,15,15,0.6)':t.affected?'rgba(12,61,90,0.4)':'var(--bg-elevated)' }}>
            <div style={{ fontSize:12, fontWeight:500, color:'var(--text-primary)' }}>{t.label}</div>
            <div style={{ fontSize:10, fontFamily:'Geist Mono', color:'var(--text-muted)' }}>day {t.start}–{t.start+t.len}</div>
          </div>; })}
      </div>
      {/* gantt */}
      <div style={{ background:'var(--bg-base)', borderTop:'1px solid var(--border-subtle)', paddingTop:16 }}>
        <div className="type-small" style={{ letterSpacing:'0.1em', marginBottom:12 }}>TIMELINE · drag bars to simulate</div>
        <div style={{ position:'relative' }}>
          {/* milestone line */}
          <div style={{ position:'absolute', left:`calc(140px + ${(milestone/totalDays)*100}% * ${'(100% - 140px)/100%'})`, display:'none' }}></div>
          {computed.map(t=>(
            <div key={t.id} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
              <div style={{ width:128, fontSize:12.5, color:'var(--text-secondary)', textAlign:'right', flex:'0 0 auto' }}>{t.label}</div>
              <div style={{ flex:1, position:'relative', height:22, background:'var(--bg-surface)', borderRadius:4, border:'1px solid var(--border-subtle)' }}>
                <div style={{ position:'absolute', left:`${(milestone/totalDays)*100}%`, top:-2, bottom:-2, width:2, background:'var(--danger)', opacity:0.6 }}></div>
                <div onMouseDown={e=>onDrag(t.id,e)} style={{ position:'absolute', left:`${(t.start/totalDays)*100}%`, width:`${(t.len/totalDays)*100}%`,
                  top:2, bottom:2, borderRadius:3, cursor:'ew-resize',
                  background: t.dragged?'rgba(255,255,255,0.35)':t.conflict?'rgba(255,45,45,0.35)':'rgba(255,107,0,0.3)',
                  border:`1px solid ${t.dragged?'var(--accent-amber)':t.conflict?'var(--danger)':'var(--accent-blue)'}` }}></div>
              </div>
            </div>
          ))}
          <div style={{ display:'flex', gap:12, marginTop:6 }}>
            <div style={{ width:128, flex:'0 0 auto' }}></div>
            <div style={{ flex:1, position:'relative', height:14 }}>
              <span style={{ position:'absolute', left:`${(milestone/totalDays)*100}%`, transform:'translateX(-50%)', fontSize:9.5, color:'var(--danger)', fontFamily:'Geist Mono' }}>◆ Client Demo</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>;
}

Object.assign(window, { CascadeTimeline, WhatIfSimulator, CascadeImpact });
