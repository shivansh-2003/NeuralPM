/* ============================================================
   NeuralPM — Task Command Center
   ============================================================ */

function FilterBar({ filters, setFilters, onNewTask, members }) {
  const { CATS, SEV, STATUS } = window.NPM_DATA;
  const toggle = (key, val) => setFilters(f => {
    const set = new Set(f[key]); set.has(val)?set.delete(val):set.add(val);
    return { ...f, [key]:[...set] };
  });
  const anyActive = filters.q || filters.status.length || filters.sev.length || filters.cat.length || filters.assignee.length;

  const MultiChip = ({ label, k, opts, render }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef();
    useEffect(()=>{ const h=e=>{ if(ref.current&&!ref.current.contains(e.target)) setOpen(false); };
      document.addEventListener('mousedown',h); return ()=>document.removeEventListener('mousedown',h); },[]);
    const n = filters[k].length;
    return <div ref={ref} style={{ position:'relative' }}>
      <button className={'chip'+(n?' active':'')} onClick={()=>setOpen(o=>!o)}>{label}{n>0&&` · ${n}`}<Icon.down s={12}/></button>
      {open && <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, zIndex:40, background:'var(--bg-elevated)',
        border:'1px solid var(--border-default)', borderRadius:'var(--radius-md)', padding:6, minWidth:170,
        boxShadow:'0 8px 24px rgba(0,0,0,0.4)', animation:'fade-in 120ms ease' }}>
        {opts.map(o=>{ const on=filters[k].includes(o);
          return <div key={o} onClick={()=>toggle(k,o)} className="clickable" style={{ display:'flex', alignItems:'center', gap:8,
            padding:'7px 10px', borderRadius:'var(--radius-sm)', fontSize:13 }}
            onMouseEnter={e=>e.currentTarget.style.background='var(--bg-hover)'}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            <span style={{ width:15, height:15, borderRadius:4, border:`1.5px solid ${on?'var(--accent-blue)':'var(--border-strong)'}`,
              background:on?'var(--accent-blue)':'transparent', display:'inline-flex', alignItems:'center', justifyContent:'center', color:'#fff' }}>
              {on&&<Icon.check s={11}/>}</span>
            {render?render(o):<span style={{color:'var(--text-secondary)'}}>{o}</span>}
          </div>; })}
      </div>}
    </div>;
  };

  return <div style={{ background:'var(--bg-base)', borderBottom:'1px solid var(--border-subtle)', padding:'0 24px',
    height:48, display:'flex', alignItems:'center', gap:8, flex:'0 0 auto', position:'relative', zIndex:30 }}>
    <div style={{ position:'relative', width:240 }}>
      <Icon.search s={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
      <input className="input" style={{ paddingLeft:30, height:30, fontSize:13 }} placeholder="Search tasks…"
        value={filters.q} onChange={e=>setFilters(f=>({...f,q:e.target.value}))}/>
    </div>
    <MultiChip label="Assignee" k="assignee" opts={members.map(m=>m.id)}
      render={id=>{ const m=members.find(x=>x.id===id); return <span style={{display:'flex',alignItems:'center',gap:6}}><Avatar member={m} size={18}/><span style={{color:'var(--text-secondary)'}}>{m.name}</span></span>; }}/>
    <MultiChip label="Status" k="status" opts={STATUS}/>
    <MultiChip label="Severity" k="sev" opts={SEV}/>
    <MultiChip label="Category" k="cat" opts={CATS}/>
    {anyActive && <button onClick={()=>setFilters({q:'',status:[],sev:[],cat:[],assignee:[]})}
      style={{ background:'none', border:'none', color:'var(--accent-blue)', fontSize:12.5, cursor:'pointer', fontFamily:'General Sans' }}>Clear all</button>}
    <div style={{ flex:1 }}></div>
    <button className="btn btn-primary" onClick={onNewTask}><Icon.plus s={15}/>New Task</button>
  </div>;
}

const COLS = [
  { k:'id', label:'Task', w:88, sort:'id' },
  { k:'title', label:'Title', w:'minmax(280px,1fr)', sort:'title' },
  { k:'cat', label:'Category', w:110, sort:'cat' },
  { k:'sev', label:'Severity', w:108, sort:'sev' },
  { k:'who', label:'Assignee', w:172, sort:'who' },
  { k:'status', label:'Status', w:130, sort:'status' },
  { k:'prog', label:'Progress', w:120, sort:'prog' },
  { k:'due', label:'Due', w:96, sort:'due' },
  { k:'actions', label:'', w:96 },
];
const SEV_ORDER = { Critical:0, High:1, Medium:2, Low:3 };
const STATUS_ORDER = { Backlog:0, Ongoing:1, Review:2, Completed:3 };

function TaskTable({ tasks, members, onFindMatch, onOpenTask, onStatusChange, onHoverMember }) {
  const [sort, setSort] = useState({ k:'sev', dir:1 });
  const memberOf = id => members.find(m=>m.id===id);
  const grid = COLS.map(c=>typeof c.w==='number'?c.w+'px':c.w).join(' ');

  const sorted = useMemo(() => {
    const arr = [...tasks];
    const { k, dir } = sort;
    arr.sort((a,b)=>{
      let av, bv;
      if (k==='sev') { av=SEV_ORDER[a.sev]; bv=SEV_ORDER[b.sev]; }
      else if (k==='status') { av=STATUS_ORDER[a.status]; bv=STATUS_ORDER[b.status]; }
      else if (k==='who') { av=memberOf(a.who)?.name||'zzz'; bv=memberOf(b.who)?.name||'zzz'; }
      else { av=a[k]; bv=b[k]; }
      if (av<bv) return -1*dir; if (av>bv) return 1*dir; return 0;
    });
    return arr;
  }, [tasks, sort]);

  const setSortKey = k => setSort(s=>s.k===k?{k,dir:-s.dir}:{k,dir:1});

  return <div style={{ flex:1, overflow:'auto', minHeight:0 }}>
    <div style={{ display:'grid', gridTemplateColumns:grid, position:'sticky', top:0, zIndex:10,
      background:'var(--bg-elevated)', borderBottom:'1px solid var(--border-default)' }}>
      {COLS.map(c=>(
        <div key={c.k} onClick={()=>c.sort&&setSortKey(c.sort)} style={{ padding:'10px 16px', fontSize:11, fontWeight:600,
          letterSpacing:'0.08em', textTransform:'uppercase', color: sort.k===c.sort?'var(--text-secondary)':'var(--text-muted)',
          cursor:c.sort?'pointer':'default', userSelect:'none', display:'flex', alignItems:'center', gap:5, fontFamily:'General Sans' }}>
          {c.label}{sort.k===c.sort && (sort.dir>0?<Icon.up s={12}/>:<Icon.down s={12}/>)}
        </div>
      ))}
    </div>
    {sorted.length===0 && <div style={{ padding:'48px 24px', textAlign:'center', color:'var(--text-muted)', fontSize:14 }}>No tasks match your filters.</div>}
    {sorted.map((t,i)=>{
      const m = memberOf(t.who);
      const due = relDue(t.due);
      return <div key={t.id} className="task-row" style={{ display:'grid', gridTemplateColumns:grid, alignItems:'center',
        background: i%2? 'var(--bg-surface)':'var(--bg-base)', borderBottom:'1px solid var(--border-subtle)',
        transition:'background var(--transition-fast)' }}
        onMouseEnter={e=>e.currentTarget.style.background='var(--bg-hover)'}
        onMouseLeave={e=>e.currentTarget.style.background=i%2?'var(--bg-surface)':'var(--bg-base)'}>
        <div style={{ padding:'12px 16px', fontFamily:'Geist Mono', fontSize:12, color:'var(--text-muted)' }}>{t.id}</div>
        <div style={{ padding:'12px 16px', minWidth:0, display:'flex', alignItems:'center', gap:8 }}>
          <span className="clickable" onClick={()=>onOpenTask(t)} style={{ fontSize:13.5, color:'var(--text-primary)', overflow:'hidden',
            textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={t.title}>{t.title}</span>
          {!t.who && <button className="btn btn-ghost find-match-inline" style={{ padding:'2px 8px', fontSize:11, opacity:0.55, flex:'0 0 auto' }}
            onClick={()=>onFindMatch(t)}><Icon.spark s={12}/>Find Match</button>}
        </div>
        <div style={{ padding:'12px 16px' }}><CategoryTag cat={t.cat}/></div>
        <div style={{ padding:'12px 16px' }}><SeverityBadge sev={t.sev}/></div>
        <div style={{ padding:'12px 16px' }}>
          {m ? <span style={{ display:'flex', alignItems:'center', gap:8 }} onMouseEnter={e=>onHoverMember(m,e)} onMouseLeave={()=>onHoverMember(null)}>
            <Avatar member={m} size={24}/><span style={{ fontSize:13, color:'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.name}</span></span>
            : <span style={{ display:'flex', alignItems:'center', gap:8 }}><Avatar member={null} size={24}/><span style={{ fontSize:13, fontStyle:'italic', color:'var(--text-muted)' }}>Unassigned</span></span>}
        </div>
        <div style={{ padding:'12px 16px' }}><StatusDropdown task={t} onChange={s=>onStatusChange(t,s)}/></div>
        <div style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:8 }}>
          <ProgressBar value={t.prog}/><span style={{ fontFamily:'Geist Mono', fontSize:11, color:'var(--text-muted)', width:28 }}>{t.prog}%</span>
        </div>
        <div style={{ padding:'12px 16px', fontSize:12.5, color:due.color, fontWeight: t.due<=3?600:400 }}>{due.label}</div>
        <div style={{ padding:'12px 8px', display:'flex', gap:2, justifyContent:'flex-end' }} className="row-actions">
          <button className="icon-btn" title="Find Best Match" onClick={()=>onFindMatch(t)}><Icon.spark s={15}/></button>
          <button className="icon-btn" title="Edit" onClick={()=>onOpenTask(t)}><Icon.edit s={15}/></button>
        </div>
      </div>;
    })}
  </div>;
}

function StatusDropdown({ task, onChange }) {
  const { STATUS } = window.NPM_DATA;
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(()=>{ const h=e=>{ if(ref.current&&!ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown',h); return ()=>document.removeEventListener('mousedown',h); },[]);
  return <div ref={ref} style={{ position:'relative' }}>
    <span onClick={()=>setOpen(o=>!o)} className="clickable"><StatusPill status={task.status}/></span>
    {open && <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:40, background:'var(--bg-elevated)',
      border:'1px solid var(--border-default)', borderRadius:'var(--radius-md)', padding:5, minWidth:130,
      boxShadow:'0 8px 24px rgba(0,0,0,0.4)' }}>
      {STATUS.map(s=><div key={s} onClick={()=>{ onChange(s); setOpen(false); }} className="clickable"
        style={{ padding:'6px 8px', borderRadius:'var(--radius-sm)' }}
        onMouseEnter={e=>e.currentTarget.style.background='var(--bg-hover)'}
        onMouseLeave={e=>e.currentTarget.style.background='transparent'}><StatusPill status={s}/></div>)}
    </div>}
  </div>;
}

/* ---------- Assignee load tooltip ---------- */
function LoadTooltip({ member, pos }) {
  if (!member) return null;
  return ReactDOM.createPortal(
    <div style={{ position:'fixed', left:pos.x, top:pos.y+24, zIndex:400, background:'var(--bg-elevated)',
      border:'1px solid var(--border-default)', borderRadius:'var(--radius-md)', padding:'12px 14px', minWidth:200,
      boxShadow:'0 8px 24px rgba(0,0,0,0.5)', pointerEvents:'none' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
        <Avatar member={member} size={28}/>
        <div><div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{member.name}</div>
          <div className="type-small">{member.role}</div></div>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:6 }}>
        <span style={{ color:'var(--text-muted)' }}>Load</span>
        <span style={{ fontFamily:'Geist Mono', color: member.load>85?'var(--danger)':'var(--text-secondary)' }}>{member.load}%</span></div>
      <ProgressBar value={member.load} color={member.load>85?'var(--danger)':'var(--accent-blue)'}/>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginTop:8 }}>
        <span style={{ color:'var(--text-muted)' }}>Active tasks</span><span style={{ color:'var(--text-secondary)' }}>{member.active}</span></div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginTop:4 }}>
        <span style={{ color:'var(--text-muted)' }}>Availability</span><span style={{ color: member.avail==='Available'?'var(--success)':member.avail==='On PTO'?'var(--accent-amber)':'var(--text-secondary)' }}>{member.avail}</span></div>
    </div>, document.body);
}

/* ---------- New Task modal ---------- */
function NewTaskModal({ onClose, onCreate, tasks }) {
  const { CATS } = window.NPM_DATA;
  const [f, setF] = useState({ title:'', desc:'', cat:'Frontend', sev:'Medium', due:'', deps:[] });
  const [err, setErr] = useState(false);
  const submit = () => { if(!f.title.trim()){ setErr(true); return; } onCreate(f); };
  return <Modal onClose={onClose} w={520}>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
      <div className="type-heading">New Task</div>
      <button className="icon-btn" onClick={onClose}><Icon.close/></button>
    </div>
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <Field label="Title" req>
        <input className="input" autoFocus value={f.title} placeholder="What needs to be done?"
          onChange={e=>{ setF({...f,title:e.target.value}); setErr(false); }}
          style={err?{borderColor:'var(--danger)'}:{}}/>
        {err && <div style={{ fontSize:12, color:'var(--danger)', marginTop:4 }}>Title is required.</div>}
      </Field>
      <Field label="Description">
        <textarea className="input" rows={3} value={f.desc} placeholder="Add context for the agents…"
          onChange={e=>setF({...f,desc:e.target.value})} style={{ resize:'vertical', fontFamily:'General Sans' }}/>
      </Field>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <Field label="Category"><select className="input" value={f.cat} onChange={e=>setF({...f,cat:e.target.value})}>{CATS.map(c=><option key={c}>{c}</option>)}</select></Field>
        <Field label="Severity"><select className="input" value={f.sev} onChange={e=>setF({...f,sev:e.target.value})}>{['Critical','High','Medium','Low'].map(c=><option key={c}>{c}</option>)}</select></Field>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <Field label="Due in (days)"><input className="input" type="number" min="0" value={f.due} placeholder="e.g. 7" onChange={e=>setF({...f,due:e.target.value})}/></Field>
        <Field label="Assignee"><div style={{ fontSize:12.5, color:'var(--text-muted)', padding:'9px 0' }}>Leave blank → Find Best Match opens after create</div></Field>
      </div>
      <div style={{ fontSize:11.5, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:6 }}>
        <Icon.spark s={13} style={{color:'var(--accent-blue)'}}/>On create, Memory + Risk + Cascade agents evaluate impact.</div>
    </div>
    <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:24 }}>
      <button className="btn btn-muted" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={submit}>Create Task</button>
    </div>
  </Modal>;
}

function Field({ label, req, children }) {
  return <div><div style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:6 }}>{label}{req&&<span style={{color:'var(--danger)'}}> *</span>}</div>{children}</div>;
}

Object.assign(window, { FilterBar, TaskTable, StatusDropdown, LoadTooltip, NewTaskModal, Field });
