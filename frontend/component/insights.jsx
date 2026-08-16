/* ============================================================
   NeuralPM — Insights War Room
   Tabs: Risk Radar · Cascade Timeline · Assignment Analytics · System Learning
   ============================================================ */
const RISK_COLOR = { Critical:'var(--critical)', High:'var(--high)', Medium:'var(--medium)', Low:'var(--success)' };

function InsightsWarRoom({ members, learning, toast, openTask, openMember }) {
  const [tab, setTab] = useState('risk');
  const TABS = [['risk','Risk Radar'],['cascade','Cascade Timeline'],['analytics','Assignment Analytics'],['learning','System Learning']];
  return <div className="neural-grid" style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column', background:'var(--bg-base)' }}>
    <div style={{ display:'flex', gap:4, padding:'0 24px', borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-base)', flex:'0 0 auto' }}>
      {TABS.map(([id,label])=>{ const a=tab===id;
        return <button key={id} onClick={()=>setTab(id)} style={{ background:'none', border:'none', cursor:'pointer',
          padding:'14px 14px', fontSize:14, fontWeight:a?600:500, fontFamily:'General Sans',
          color:a?'var(--text-primary)':'var(--text-secondary)', borderBottom:`2px solid ${a?'var(--accent-blue)':'transparent'}` }}>{label}</button>; })}
    </div>
    <div style={{ flex:1, overflowY:'auto' }}>
      {tab==='risk' && <RiskRadar members={members} learning={learning} toast={toast} openTask={openTask} openMember={openMember}/>}
      {tab==='cascade' && <CascadeTimeline toast={toast} openTask={openTask}/>}
      {tab==='analytics' && <AssignmentAnalytics members={members}/>}
      {tab==='learning' && <SystemLearning toast={toast}/>}
    </div>
  </div>;
}

/* ---------- Risk Radar ---------- */
function RiskRadar({ members, learning, toast, openTask, openMember }) {
  const { RISKS } = window.NPM_DATA;
  const [risks, setRisks] = useState(RISKS);
  const [sevFilter, setSevFilter] = useState([]);
  const [typeFilter, setTypeFilter] = useState([]);
  const [showSup, setShowSup] = useState(false);
  const [showAck, setShowAck] = useState(true);
  const [dismissModal, setDismissModal] = useState(null);
  const types = ['Stale Task','Overload','Deadline','Blocker Chain'];

  const active = risks.filter(r=>r.state==='active'
    && (!sevFilter.length||sevFilter.includes(r.sev))
    && (!typeFilter.length||typeFilter.includes(r.type)));
  const acknowledged = risks.filter(r=>r.state==='acknowledged');
  const suppressed = risks.filter(r=>r.state==='suppressed');

  const setState = (id, state) => setRisks(rs=>rs.map(r=>r.id===id?{...r,state}:r));
  const onDismiss = (r) => {
    if (learning) { setDismissModal(r); return; }
    setState(r.id,'dismissed'); toast({kind:'info',text:`Dismissed "${r.type}" — evidence logged silently.`});
  };
  const confirmDismiss = (r, always) => {
    if (always) { setState(r.id,'suppressed'); toast({kind:'warn',text:`Will suppress "${r.type}" risks. Preference written.`,icon:<Icon.brain s={15}/>}); }
    else { setState(r.id,'dismissed'); toast({kind:'info',text:'Dismissed just this once.'}); }
    setDismissModal(null);
  };

  const Chip = ({ label, arr, set, val }) => <button className={'chip'+(arr.includes(val)?' active':'')}
    onClick={()=>set(a=>a.includes(val)?a.filter(x=>x!==val):[...a,val])}>{label}</button>;

  return <div style={{ padding:'16px 24px 40px' }}>
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:18, flexWrap:'wrap' }}>
      {['Critical','High','Medium','Low'].map(s=><Chip key={s} label={s} arr={sevFilter} set={setSevFilter} val={s}/>)}
      <span style={{ width:1, height:18, background:'var(--border-subtle)', margin:'0 4px' }}></span>
      {types.map(t=><Chip key={t} label={t} arr={typeFilter} set={setTypeFilter} val={t}/>)}
      <div style={{ flex:1 }}></div>
      <label className="chip" style={{ background:showSup?'var(--accent-blue-dim)':undefined }} onClick={()=>setShowSup(v=>!v)}>
        <Icon.eye s={13}/>Show suppressed ({suppressed.length})</label>
    </div>

    {active.length===0 && acknowledged.length===0 ? <EmptyRisks/> :
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(420px, 1fr))', gap:16 }}>
      {active.map(r=><RiskCard key={r.id} risk={r} onResolve={()=>{ setState(r.id,'resolved'); toast({kind:'success',text:`Risk resolved — logged to Memory Agent.`}); }}
        onAck={()=>setState(r.id,'acknowledged')} onDismiss={()=>onDismiss(r)} openTask={openTask} openMember={openMember}/>)}
    </div>}

    {showAck && acknowledged.length>0 && <div style={{ marginTop:28 }}>
      <div className="type-small" style={{ letterSpacing:'0.1em', marginBottom:12 }}>ACKNOWLEDGED ({acknowledged.length})</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(420px, 1fr))', gap:16, opacity:0.6 }}>
        {acknowledged.map(r=><RiskCard key={r.id} risk={r} dimmed onResolve={()=>setState(r.id,'resolved')} onAck={()=>setState(r.id,'active')} onDismiss={()=>onDismiss(r)} openTask={openTask} openMember={openMember}/>)}
      </div>
    </div>}

    {showSup && suppressed.length>0 && <div style={{ marginTop:28 }}>
      <div className="type-small" style={{ letterSpacing:'0.1em', marginBottom:12 }}>SUPPRESSED BY PREFERENCE ({suppressed.length})</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(420px, 1fr))', gap:16 }}>
        {suppressed.map(r=><SuppressedCard key={r.id} risk={r} onUnsuppress={()=>{ setState(r.id,'active'); toast({kind:'info',text:`Un-suppressed "${r.type}" — preference removed.`}); }}/>)}
      </div>
    </div>}

    {dismissModal && <Modal onClose={()=>setDismissModal(null)} w={430}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
        <span style={{ color:'var(--accent-amber)' }}><Icon.brain s={20}/></span><div className="type-heading" style={{ fontSize:17 }}>Learning Mode</div></div>
      <div style={{ fontSize:14, color:'var(--text-secondary)', lineHeight:1.55, marginBottom:22 }}>
        Dismiss just this one, or always suppress <b style={{color:'var(--text-primary)'}}>"{dismissModal.type}"</b> risks?</div>
      <div style={{ display:'flex', gap:10 }}>
        <button className="btn btn-muted" style={{ flex:1, justifyContent:'center' }} onClick={()=>confirmDismiss(dismissModal,false)}>Just this once</button>
        <button className="btn btn-primary" style={{ flex:1, justifyContent:'center', background:'var(--accent-amber)' }} onClick={()=>confirmDismiss(dismissModal,true)}>Always suppress this type</button>
      </div>
    </Modal>}
  </div>;
}

function RiskCard({ risk, onResolve, onAck, onDismiss, dimmed, openTask, openMember }) {
  return <div className="card" style={{ borderLeft:`3px solid ${RISK_COLOR[risk.sev]}`, padding:'16px 20px',
    animation: risk._new?'row-in 300ms ease':undefined }}>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
      <SeverityBadge sev={risk.sev}/>
      <span className="chip" style={{ cursor:'default' }}>{risk.type}</span>
    </div>
    <div className="type-subheading" style={{ fontSize:14.5, marginBottom:6 }}>{risk.title}</div>
    <div style={{ fontSize:13, color:'var(--text-secondary)', lineHeight:1.5, marginBottom:12,
      display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{risk.reason}</div>
    <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:14 }}>
      {risk.items.map((it,i)=><span key={i} className="chip" onClick={()=>it.k==='t'?openTask&&openTask(it.t):openMember&&openMember(it.t)}
        style={{ background:'var(--bg-elevated)' }}>{it.k==='m'?<Icon.brain s={11} style={{opacity:0.5}}/>:<span style={{fontFamily:'Geist Mono',fontSize:10,color:'var(--text-muted)'}}>#</span>}{it.t}</span>)}
    </div>
    <button className="btn btn-ghost" style={{ width:'100%', justifyContent:'center', marginBottom:10, padding:'7px' }}>
      <Icon.spark s={13}/>Suggested: {risk.action}</button>
    <div style={{ display:'flex', gap:8 }}>
      <button className="btn btn-success" style={{ flex:1, justifyContent:'center', padding:'6px' }} onClick={onResolve}><Icon.check s={14}/>Resolve</button>
      <button className="btn btn-muted" style={{ flex:1, justifyContent:'center', padding:'6px' }} onClick={onAck}><Icon.eye s={14}/>{dimmed?'Restore':'Acknowledge'}</button>
      <button className="btn btn-danger" style={{ flex:1, justifyContent:'center', padding:'6px' }} onClick={onDismiss}><Icon.close s={14}/>Dismiss</button>
    </div>
  </div>;
}

function SuppressedCard({ risk, onUnsuppress }) {
  return <div className="card" style={{ borderLeft:`3px solid var(--border-default)`, padding:'16px 20px',
    opacity:0.5, filter:'grayscale(0.3)', position:'relative' }}
    onMouseEnter={e=>e.currentTarget.querySelector('.unsup').style.opacity=1}
    onMouseLeave={e=>e.currentTarget.querySelector('.unsup').style.opacity=0}>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
      <Tip label={`You reliably dismiss ${risk.type.toLowerCase()} risks — showing this below the main board.`} w={230}>
        <span style={{ fontSize:11, fontWeight:600, color:'var(--accent-amber)', background:'var(--accent-amber-dim)',
          border:'1px solid var(--accent-amber)', borderRadius:'var(--radius-pill)', padding:'2px 9px', cursor:'help' }}>Hidden by preference</span></Tip>
      <button className="unsup" onClick={onUnsuppress} style={{ opacity:0, transition:'var(--transition-fast)', background:'none',
        border:'none', color:'var(--accent-blue)', fontSize:12, cursor:'pointer', fontFamily:'General Sans' }}>Un-suppress</button>
    </div>
    <div className="type-subheading" style={{ fontSize:14, marginBottom:6 }}>{risk.title}</div>
    <div style={{ fontSize:12.5, color:'var(--text-muted)', lineHeight:1.5 }}>{risk.reason}</div>
  </div>;
}

function EmptyRisks() {
  return <div style={{ textAlign:'center', padding:64 }}>
    <div style={{ color:'var(--success)', display:'inline-flex', marginBottom:14 }}><Icon.shield s={26}/></div>
    <div className="type-heading" style={{ color:'var(--text-secondary)' }}>No active risks — the project looks healthy.</div>
  </div>;
}

/* ---------- Assignment Analytics ---------- */
function AssignmentAnalytics({ members }) {
  const days = ['M','T','W','T','F','M','T','W','T','F'];
  const loadAt = (m,d) => Math.max(8, Math.min(100, m.load + (((m.id.charCodeAt(1)*7 + d*13) % 40) - 18)));
  const cellColor = v => v>90?'#FF2D2D':v>75?'var(--high)':v>55?'var(--accent-amber)':v>35?'#5B8C2A':'var(--success)';
  return <div style={{ padding:'20px 24px 40px' }}>
    <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16, marginBottom:24 }}>
      <Metric label="Suggestions accepted" value="74%" delta="+6%" up sub="manager did not override"/>
      <Metric label="Overrides this sprint" value="8" delta="-3" up sub="vs 11 last sprint"/>
      <Metric label="Avg time-to-assign" value="1.4h" delta="-0.5h" up sub="faster matching"/>
    </div>
    <div className="card" style={{ marginBottom:24 }}>
      <div className="type-heading" style={{ marginBottom:4 }}>Load Distribution Heatmap</div>
      <div className="type-small" style={{ marginBottom:18 }}>Daily load across the current sprint · red outline = overloaded (&gt;90%)</div>
      <div style={{ display:'grid', gridTemplateColumns:`160px repeat(${days.length}, 1fr)`, gap:4, alignItems:'center' }}>
        <div></div>{days.map((d,i)=><div key={i} style={{ textAlign:'center', fontSize:10, color:'var(--text-muted)', fontFamily:'Geist Mono' }}>{d}</div>)}
        {members.map(m=><React.Fragment key={m.id}>
          <div style={{ fontSize:12.5, color:'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.name}</div>
          {days.map((d,i)=>{ const v=loadAt(m,i);
            return <Tip key={i} label={`${m.name} · Day ${i+1} · ${v}% load`}><div style={{ height:26, borderRadius:3, background:cellColor(v),
              opacity:0.85, outline: v>90?'2px solid #FF2D2D':'none', cursor:'default' }}></div></Tip>; })}
        </React.Fragment>)}
      </div>
    </div>
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
      <div className="card">
        <div className="type-heading" style={{ marginBottom:14 }}>Top Performers</div>
        {[...members].sort((a,b)=>b.velocity/b.load-a.velocity/a.load).slice(0,3).map((m,i)=>
          <div key={m.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 0', borderBottom: i<2?'1px solid var(--border-subtle)':'none' }}>
            <span style={{ fontFamily:'Geist Mono', fontSize:13, color:'var(--accent-blue)' }}>#{i+1}</span>
            <Avatar member={m} size={28}/><div style={{ flex:1 }}><div style={{ fontSize:13, color:'var(--text-primary)' }}>{m.name}</div>
            <div className="type-small">{m.velocity} pts/sprint · {m.load}% load</div></div>
            <Sparkline data={m.sprints} w={48} h={18} color="var(--success)"/></div>)}
      </div>
      <div className="card">
        <div className="type-heading" style={{ marginBottom:14 }}>Skill Gaps</div>
        {[['API','3.2d avg time-to-assign'],['Testing','2.8d avg time-to-assign'],['Design','2.1d avg time-to-assign']].map((g,i)=>
          <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom: i<2?'1px solid var(--border-subtle)':'none' }}>
            <CategoryTag cat={g[0]}/><span className="type-small" style={{ color:'var(--accent-amber)' }}>{g[1]}</span></div>)}
      </div>
    </div>
  </div>;
}
function Metric({ label, value, delta, up, sub }) {
  return <div className="card">
    <div className="type-small" style={{ marginBottom:8 }}>{label}</div>
    <div style={{ display:'flex', alignItems:'baseline', gap:10 }}>
      <span style={{ fontFamily:'Space Grotesk', fontWeight:700, fontSize:32, color:'var(--text-primary)' }}>{value}</span>
      <span style={{ fontSize:13, color:up?'var(--success)':'var(--danger)', display:'flex', alignItems:'center', gap:2 }}>
        {up?<Icon.up s={14}/>:<Icon.down s={14}/>}{delta}</span></div>
    <div className="type-small" style={{ marginTop:4 }}>{sub}</div>
  </div>;
}

/* ---------- System Learning ---------- */
function SystemLearning({ toast }) {
  const { OVERRIDE_RATE, PREFERENCES } = window.NPM_DATA;
  const [prefs, setPrefs] = useState(PREFERENCES);
  const [editPref, setEditPref] = useState(null);
  const [delPref, setDelPref] = useState(null);
  return <div style={{ padding:'20px 24px 48px', maxWidth:1080, margin:'0 auto' }}>
    <div className="card" style={{ marginBottom:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:18 }}>
        <div><div className="type-heading">Override Rate</div>
          <div className="type-small" style={{ color:'var(--success)', marginTop:2 }}>Falling = system learning</div></div>
        <div style={{ fontFamily:'Space Grotesk', fontWeight:700, fontSize:28, color:'var(--success)' }}>22%</div>
      </div>
      <LineChart data={OVERRIDE_RATE} w={1000} h={200}/>
    </div>
    <div className="card" style={{ marginBottom:20 }}>
      <div className="type-heading" style={{ marginBottom:4 }}>Preference Confidence</div>
      <div className="type-small" style={{ marginBottom:18 }}>Bars past 0.6 actively re-rank agent output</div>
      <ConfidenceBars prefs={prefs}/>
    </div>
    <div className="card">
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
        <div className="type-heading">Preference Registry</div>
        <span className="type-small">Managed by you</span></div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr style={{ background:'var(--bg-elevated)', borderBottom:'1px solid var(--border-default)' }}>
            {['Type','Value Summary','Confidence','Evidence','Last Observed',''].map((h,i)=>
              <th key={i} style={{ textAlign: i>1&&i<5?'left':'left', padding:'10px 14px', fontSize:11, fontWeight:600, letterSpacing:'0.08em',
                textTransform:'uppercase', color:'var(--text-muted)' }}>{h}</th>)}</tr></thead>
          <tbody>{prefs.map((p,i)=><tr key={p.id} className="pref-row" style={{ background:i%2?'var(--bg-surface)':'var(--bg-base)', borderBottom:'1px solid var(--border-subtle)' }}>
            <td style={{ padding:'12px 14px', fontFamily:'Geist Mono', fontSize:12, color:'var(--accent-blue)' }}>{p.type}</td>
            <td style={{ padding:'12px 14px', color:'var(--text-secondary)' }}>{p.value}</td>
            <td style={{ padding:'12px 14px' }}><div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontFamily:'Geist Mono', fontSize:12, color:p.conf>=0.6?'var(--success)':'var(--text-muted)' }}>{p.conf.toFixed(2)}</span>
              <MiniBar value={p.conf} w={44}/></div></td>
            <td style={{ padding:'12px 14px', fontFamily:'Geist Mono', fontSize:12, color:'var(--text-muted)' }}>{p.evidence}</td>
            <td style={{ padding:'12px 14px', color:'var(--text-muted)', fontSize:12.5 }}>{p.last}</td>
            <td style={{ padding:'12px 14px' }}><div style={{ display:'flex', gap:4, justifyContent:'flex-end' }}>
              <button className="icon-btn" onClick={()=>setEditPref(p)}><Icon.edit s={14}/></button>
              <button className="icon-btn" onClick={()=>setDelPref(p)} style={{ color:'var(--danger)' }}><Icon.trash s={14}/></button></div></td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
    {editPref && <Modal onClose={()=>setEditPref(null)} w={440}>
      <div className="type-heading" style={{ marginBottom:16 }}>Edit Preference</div>
      <Field label="Type"><input className="input" value={editPref.type} disabled style={{ opacity:0.6 }}/></Field>
      <div style={{ height:12 }}></div>
      <Field label="Value (JSON / summary)"><textarea className="input" rows={3} defaultValue={editPref.value} style={{ fontFamily:'Geist Mono', fontSize:12 }}/></Field>
      <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:20 }}>
        <button className="btn btn-muted" onClick={()=>setEditPref(null)}>Cancel</button>
        <button className="btn btn-primary" onClick={()=>{ setEditPref(null); toast&&toast({kind:'success',text:'Preference updated.'}); }}>Save</button></div>
    </Modal>}
    {delPref && <Modal onClose={()=>setDelPref(null)} w={420}>
      <div className="type-heading" style={{ marginBottom:12 }}>Remove learned preference?</div>
      <div style={{ fontSize:14, color:'var(--text-secondary)', lineHeight:1.55, marginBottom:22 }}>
        The system will return to raw scoring for <b style={{color:'var(--text-primary)',fontFamily:'Geist Mono',fontSize:13}}>{delPref.type}</b>. Evidence history is retained.</div>
      <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
        <button className="btn btn-muted" onClick={()=>setDelPref(null)}>Cancel</button>
        <button className="btn btn-danger" onClick={()=>{ setPrefs(ps=>ps.filter(x=>x.id!==delPref.id)); setDelPref(null); toast&&toast({kind:'info',text:'Preference removed.'}); }}>Remove</button></div>
    </Modal>}
  </div>;
}

Object.assign(window, { InsightsWarRoom, RiskCard, AssignmentAnalytics, SystemLearning, RISK_COLOR });
