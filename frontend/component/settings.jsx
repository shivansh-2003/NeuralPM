/* ============================================================
   NeuralPM — Requirements & Settings/Governance
   ============================================================ */

const REQ_TYPE_COLOR = { 'New Requirement':200, 'Issue':10, 'Blocker':350, 'Scope Change':280 };

function RequirementsPage({ toast }) {
  const { REQUIREMENTS } = window.NPM_DATA;
  const [reqs, setReqs] = useState(REQUIREMENTS);
  const [modal, setModal] = useState(false);
  const [detail, setDetail] = useState(null);
  const [typeF, setTypeF] = useState([]);
  const statusColor = { Open:'var(--text-muted)', 'In Progress':'var(--accent-blue)', Resolved:'var(--success)' };
  const rows = reqs.filter(r=>!typeF.length||typeF.includes(r.type));

  return <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--bg-base)' }} className="neural-grid">
    <div style={{ padding:'14px 24px', borderBottom:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', gap:8, flex:'0 0 auto' }}>
      <span className="type-small">TYPE</span>
      {['New Requirement','Issue','Blocker','Scope Change'].map(t=><button key={t} className={'chip'+(typeF.includes(t)?' active':'')}
        onClick={()=>setTypeF(a=>a.includes(t)?a.filter(x=>x!==t):[...a,t])}>{t}</button>)}
      <div style={{ flex:1 }}></div>
      <button className="btn btn-primary" onClick={()=>setModal(true)}><Icon.plus s={15}/>New</button>
    </div>
    <div style={{ flex:1, overflowY:'auto' }}>
      <div style={{ display:'grid', gridTemplateColumns:'80px 1fr 130px 100px 130px 110px 100px 90px', background:'var(--bg-elevated)', borderBottom:'1px solid var(--border-default)', position:'sticky', top:0, zIndex:5 }}>
        {['ID','Title','Type','Priority','Submitted by','Date','Status','Linked'].map((h,i)=><div key={i} style={{ padding:'10px 16px', fontSize:11, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-muted)' }}>{h}</div>)}
      </div>
      {rows.map((r,i)=><div key={r.id} className="clickable" onClick={()=>setDetail(r)} style={{ display:'grid', gridTemplateColumns:'80px 1fr 130px 100px 130px 110px 100px 90px',
        alignItems:'center', background:i%2?'var(--bg-surface)':'var(--bg-base)', borderBottom:'1px solid var(--border-subtle)', transition:'var(--transition-fast)' }}
        onMouseEnter={e=>e.currentTarget.style.background='var(--bg-hover)'} onMouseLeave={e=>e.currentTarget.style.background=i%2?'var(--bg-surface)':'var(--bg-base)'}>
        <div style={{ padding:'12px 16px', fontFamily:'Geist Mono', fontSize:12, color:'var(--text-muted)' }}>{r.id}</div>
        <div style={{ padding:'12px 16px', fontSize:13.5, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.title}</div>
        <div style={{ padding:'12px 16px' }}><span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:'var(--radius-sm)',
          background:`hsl(${REQ_TYPE_COLOR[r.type]} 50% 50% / 0.12)`, color:`hsl(${REQ_TYPE_COLOR[r.type]} 70% 70%)`, border:`1px solid hsl(${REQ_TYPE_COLOR[r.type]} 50% 50% / 0.25)` }}>{r.type}</span></div>
        <div style={{ padding:'12px 16px' }}><SeverityBadge sev={r.prio} dot={false}/></div>
        <div style={{ padding:'12px 16px', fontSize:13, color:'var(--text-secondary)' }}>{r.by}</div>
        <div style={{ padding:'12px 16px', fontSize:12.5, color:'var(--text-muted)' }}>{r.date}</div>
        <div style={{ padding:'12px 16px' }}><span className="status-pill" style={{ background:'var(--bg-elevated)', color:statusColor[r.status] }}><span className="status-dot" style={{ background:statusColor[r.status] }}></span>{r.status}</span></div>
        <div style={{ padding:'12px 16px', fontFamily:'Geist Mono', fontSize:13, color:'var(--text-secondary)' }}>{r.linked}</div>
      </div>)}
    </div>
    {modal && <NewRequirementModal onClose={()=>setModal(false)} onCreate={(f)=>{
      setReqs(rs=>[{ id:'RQ-0'+(19+rs.length), title:f.title, type:f.type, prio:f.prio, by:'You', date:'just now', status:'Open', linked:0 }, ...rs]);
      setModal(false); toast({kind:'info',text:'Requirement saved. Agents are analysing impact.',icon:<Icon.spark s={15}/>}); }}/>}
    {detail && <RequirementDetail req={detail} onClose={()=>setDetail(null)}/>}
  </div>;
}

function NewRequirementModal({ onClose, onCreate }) {
  const [f,setF] = useState({ title:'', type:'New Requirement', desc:'', prio:'Medium' });
  const [err,setErr] = useState(false);
  return <Modal onClose={onClose} w={520}>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
      <div className="type-heading">New Requirement / Issue</div><button className="icon-btn" onClick={onClose}><Icon.close/></button></div>
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <Field label="Title" req><input className="input" autoFocus value={f.title} onChange={e=>{setF({...f,title:e.target.value});setErr(false);}} style={err?{borderColor:'var(--danger)'}:{}}/>{err&&<div style={{fontSize:12,color:'var(--danger)',marginTop:4}}>Title is required.</div>}</Field>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <Field label="Type" req><select className="input" value={f.type} onChange={e=>setF({...f,type:e.target.value})}>{['New Requirement','Issue','Blocker','Scope Change'].map(o=><option key={o}>{o}</option>)}</select></Field>
        <Field label="Priority" req><select className="input" value={f.prio} onChange={e=>setF({...f,prio:e.target.value})}>{['Critical','High','Medium','Low'].map(o=><option key={o}>{o}</option>)}</select></Field>
      </div>
      <Field label="Description" req><textarea className="input" rows={3} value={f.desc} placeholder="Describe the requirement…" onChange={e=>setF({...f,desc:e.target.value})} style={{ resize:'vertical', fontFamily:'General Sans' }}/></Field>
      <div style={{ border:'1px dashed var(--border-default)', borderRadius:'var(--radius-md)', padding:'16px', textAlign:'center', color:'var(--text-muted)', fontSize:12.5 }}>
        <Icon.clip s={16} style={{ marginBottom:4 }}/><div>Drag & drop attachments (PDF, image, doc)</div></div>
      <div style={{ fontSize:11.5, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:6 }}>
        <Icon.spark s={13} style={{color:'var(--accent-blue)'}}/>On submit: Memory ingests, Risk + Cascade + Assignment agents evaluate impact.</div>
    </div>
    <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:24 }}>
      <button className="btn btn-muted" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={()=>{ if(!f.title.trim()){setErr(true);return;} onCreate(f); }}>Submit</button>
    </div>
  </Modal>;
}

function RequirementDetail({ req, onClose }) {
  return <Drawer width={560} accent="var(--accent-amber)" onClose={onClose}>
    <DrawerHeader onClose={onClose}
      title={<div style={{ display:'flex', alignItems:'center', gap:10 }}><span style={{ fontFamily:'Geist Mono', fontSize:12, color:'var(--text-muted)' }}>{req.id}</span><span className="type-subheading" style={{ fontSize:15 }}>{req.title}</span></div>}
      sub={<div style={{ display:'flex', gap:8, marginTop:8 }}><SeverityBadge sev={req.prio} dot={false}/><span className="chip" style={{ cursor:'default' }}>{req.type}</span></div>}/>
    <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>
      <Section title="IMPACT ANALYSIS">
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <InfoRow k="Linked tasks" v={`${req.linked} tasks`}/>
          <InfoRow k="Affected sprints" v="Sprint 7, Sprint 8"/>
          <InfoRow k="Risks flagged" v={<span style={{ color:'var(--danger)' }}>2 timeline risks</span>}/>
        </div>
      </Section>
      <Section title="VERSION HISTORY — FORGETTING MECHANISM">
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <VersionRow label="Current version" date="2h ago" active/>
          <VersionRow label="v2 — added 10x traffic clause" date="1d ago"/>
          <VersionRow label="v1 — initial draft" date="3d ago" superseded/>
        </div>
      </Section>
    </div>
  </Drawer>;
}
function InfoRow({ k, v }) { return <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'8px 0', borderBottom:'1px solid var(--border-subtle)' }}><span style={{ color:'var(--text-muted)' }}>{k}</span><span style={{ color:'var(--text-secondary)' }}>{v}</span></div>; }
function VersionRow({ label, date, active, superseded }) {
  return <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'var(--bg-elevated)', borderRadius:'var(--radius-md)', border:`1px solid ${active?'var(--accent-blue)':'var(--border-subtle)'}`, opacity:superseded?0.6:1 }}>
    <span style={{ width:7, height:7, borderRadius:'50%', background:active?'var(--accent-blue)':superseded?'var(--danger)':'var(--text-muted)', flex:'0 0 auto' }}></span>
    <span style={{ flex:1, fontSize:13, color:'var(--text-secondary)' }}>{label}</span>
    {superseded && <span style={{ fontSize:10.5, color:'var(--danger)', border:'1px solid rgba(255,45,45,0.4)', borderRadius:'var(--radius-pill)', padding:'1px 8px' }}>Superseded</span>}
    <span className="type-small">{date}</span></div>;
}

/* ---------- Settings ---------- */
function SettingsPage({ learning, setLearning, governance, setGovernance, toast }) {
  const [tab, setTab] = useState('gov');
  const [threshold, setThreshold] = useState(0.6);
  const [compress, setCompress] = useState(90);
  const [archive, setArchive] = useState(365);
  const [autoConfirm, setAutoConfirm] = useState(false);
  const NAV = [['gov','Governance'],['memory','Memory & Decay'],['learn','Learning Mode'],['notif','Notifications']];

  return <div style={{ flex:1, display:'flex', overflow:'hidden', background:'var(--bg-base)' }} className="neural-grid">
    <div style={{ width:220, borderRight:'1px solid var(--border-subtle)', padding:'20px 12px', flex:'0 0 auto', background:'var(--bg-surface)' }}>
      <div className="type-small" style={{ padding:'0 12px 12px', letterSpacing:'0.1em' }}>SETTINGS</div>
      {NAV.map(([id,label])=>{ const a=tab===id;
        return <button key={id} onClick={()=>setTab(id)} style={{ display:'block', width:'100%', textAlign:'left', background:a?'var(--bg-hover)':'none',
          border:'none', borderLeft:`2px solid ${a?'var(--accent-blue)':'transparent'}`, color:a?'var(--text-primary)':'var(--text-secondary)',
          padding:'10px 12px', fontSize:14, cursor:'pointer', fontFamily:'General Sans', borderRadius:'0 var(--radius-sm) var(--radius-sm) 0' }}>{label}</button>; })}
    </div>
    <div style={{ flex:1, overflowY:'auto', padding:'28px 32px', maxWidth:760 }}>
      {tab==='gov' && <div>
        <div className="type-display" style={{ fontSize:22, marginBottom:6 }}>Governance</div>
        <div className="type-body" style={{ marginBottom:24 }}>Control how much autonomy the agents have. Per-project — visible to all managers.</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          {[['suggest','Suggest Mode',<Icon.bolt s={22}/>,'Agents propose actions; you approve before anything executes.'],
            ['auto','Auto Mode',<Icon.spark s={22}/>,'Agents execute immediately and notify you. Undo within 10 minutes.']].map(([id,title,ic,desc])=>{
            const sel = governance===id;
            return <div key={id} onClick={()=>{ setGovernance(id); if(id==='auto'){setAutoConfirm(true);} }} className="clickable"
              style={{ background:'var(--bg-surface)', border:`1px solid ${sel?'var(--accent-blue)':'var(--border-subtle)'}`, borderRadius:'var(--radius-lg)', padding:24,
              boxShadow:sel?'var(--accent-blue-glow)':'none', transition:'var(--transition-base)' }}>
              <div style={{ color:sel?'var(--accent-blue)':'var(--text-secondary)', marginBottom:12 }}>{ic}</div>
              <div className="type-heading" style={{ marginBottom:8 }}>{title}</div>
              <div className="type-body" style={{ fontSize:13 }}>{desc}</div>
              {id==='auto' && sel && autoConfirm && <div style={{ marginTop:14, background:'var(--accent-amber-dim)', border:'1px solid var(--accent-amber)', borderRadius:'var(--radius-md)', padding:'10px 12px', display:'flex', gap:8, alignItems:'flex-start' }}>
                <Icon.warn s={15} style={{ color:'var(--accent-amber)', flex:'0 0 auto', marginTop:1 }}/>
                <span style={{ fontSize:12, color:'var(--accent-amber)' }}>Agents now act without approval. You can undo within 10 minutes.</span></div>}
            </div>; })}
        </div>
      </div>}
      {tab==='memory' && <div>
        <div className="type-display" style={{ fontSize:22, marginBottom:6 }}>Memory & Decay</div>
        <div className="type-body" style={{ marginBottom:24 }}>Tune how the Memory Agent compresses and archives events over time.</div>
        <SliderRow label="Compression threshold" value={compress} set={setCompress} min={30} max={365} unit="days"/>
        <SliderRow label="Archive threshold" value={archive} set={setArchive} min={90} max={730} unit="days"/>
        <ToggleRow label="Demo acceleration" desc="5-minute decay cycles instead of nightly" defon/>
        <div style={{ display:'flex', gap:10, marginTop:20 }}>
          <button className="btn btn-ghost" onClick={()=>toast({kind:'info',text:'Preview: 14 events would re-tier.'})}>Preview impact</button>
          <button className="btn btn-muted" onClick={()=>toast({kind:'success',text:'Decay pass triggered.'})}>Run decay pass now</button></div>
      </div>}
      {tab==='learn' && <div>
        <div className="type-display" style={{ fontSize:22, marginBottom:6 }}>Learning Mode</div>
        <div className="type-body" style={{ marginBottom:24 }}>When ON, overrides and repeated dismissals prompt to capture a pattern.</div>
        <ToggleRow label="Learning Mode" desc="Capture preferences from your overrides" on={learning} onToggle={()=>setLearning(v=>!v)}/>
        <div style={{ marginTop:24 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
            <span style={{ fontSize:13, fontWeight:600, color:'var(--text-secondary)' }}>Confidence threshold</span>
            <span style={{ fontFamily:'Geist Mono', fontSize:13, color:'var(--accent-blue)' }}>{threshold.toFixed(2)}</span></div>
          <Slider value={threshold} set={setThreshold} min={0.3} max={0.9} step={0.01} marker={0.6}/>
          <div className="type-small" style={{ marginTop:8 }}>Higher = more evidence required before a preference influences decisions.</div>
        </div>
        <div style={{ marginTop:28, borderTop:'1px solid var(--border-subtle)', paddingTop:20 }}>
          <button className="btn btn-danger" onClick={()=>toast({kind:'warn',text:'This would clear all learned preferences.'})}>Reset all preferences</button>
          <div className="type-small" style={{ marginTop:8 }}>Removes derived preferences; evidence history is retained.</div></div>
      </div>}
      {tab==='notif' && <div>
        <div className="type-display" style={{ fontSize:22, marginBottom:6 }}>Notifications</div>
        <div className="type-body" style={{ marginBottom:24 }}>Per-user delivery preferences.</div>
        {['Assignment suggestions','Risk flags','Cascade impacts','Memory chatbot responses'].map((l,i)=><ToggleRow key={i} label={l} defon={i<3}/>)}
        <div style={{ marginTop:20 }}><Field label="Non-critical frequency"><select className="input" style={{ maxWidth:240 }}><option>Real-time</option><option>Digest (end of day)</option></select></Field></div>
      </div>}
    </div>
  </div>;
}

function SliderRow({ label, value, set, min, max, unit }) {
  return <div style={{ marginBottom:22 }}>
    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
      <span style={{ fontSize:13, fontWeight:600, color:'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontFamily:'Geist Mono', fontSize:13, color:'var(--accent-blue)' }}>{value} {unit}</span></div>
    <Slider value={value} set={set} min={min} max={max} step={1}/>
  </div>;
}
function Slider({ value, set, min, max, step, marker }) {
  const pct = ((value-min)/(max-min))*100;
  const markerPct = marker!=null?((marker-min)/(max-min))*100:null;
  const ref = useRef();
  const onDown = (e) => { const move=(ev)=>{ const r=ref.current.getBoundingClientRect(); let p=(ev.clientX-r.left)/r.width; p=Math.max(0,Math.min(1,p));
    let v=min+p*(max-min); v=Math.round(v/step)*step; set(+v.toFixed(2)); };
    move(e); const up=()=>{ window.removeEventListener('mousemove',move); window.removeEventListener('mouseup',up); };
    window.addEventListener('mousemove',move); window.addEventListener('mouseup',up); };
  return <div ref={ref} onMouseDown={onDown} style={{ position:'relative', height:14, cursor:'pointer', display:'flex', alignItems:'center' }}>
    <div style={{ position:'absolute', left:0, right:0, height:4, background:'var(--bg-elevated)', borderRadius:2 }}></div>
    <div style={{ position:'absolute', left:0, width:`${pct}%`, height:4, background:'var(--accent-blue)', borderRadius:2 }}></div>
    {markerPct!=null && <div style={{ position:'absolute', left:`${markerPct}%`, top:-3, bottom:-3, width:0, borderLeft:'1.5px dashed var(--accent-amber)' }}>
      <span style={{ position:'absolute', top:14, left:'50%', transform:'translateX(-50%)', fontSize:9, color:'var(--accent-amber)', fontFamily:'Geist Mono', whiteSpace:'nowrap' }}>Default</span></div>}
    <div style={{ position:'absolute', left:`${pct}%`, transform:'translateX(-50%)', width:14, height:14, borderRadius:'50%', background:'var(--accent-blue)', border:'2px solid #fff' }}></div>
  </div>;
}
function ToggleRow({ label, desc, on, onToggle, defon }) {
  const [local, setLocal] = useState(defon||false);
  const isOn = on!=null?on:local;
  const flip = onToggle||(()=>setLocal(v=>!v));
  return <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 0', borderBottom:'1px solid var(--border-subtle)' }}>
    <div><div style={{ fontSize:14, color:'var(--text-primary)', fontWeight:500 }}>{label}</div>{desc&&<div className="type-small" style={{ marginTop:2 }}>{desc}</div>}</div>
    <button onClick={flip} style={{ width:42, height:24, borderRadius:999, border:'none', cursor:'pointer', position:'relative', flex:'0 0 auto',
      background:isOn?'var(--accent-blue)':'var(--bg-elevated)', transition:'var(--transition-base)' }}>
      <span style={{ position:'absolute', top:3, left:isOn?21:3, width:18, height:18, borderRadius:'50%', background:'#fff', transition:'var(--transition-base)' }}></span></button>
  </div>;
}

Object.assign(window, { RequirementsPage, SettingsPage });
