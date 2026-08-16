/* ============================================================
   NeuralPM — Top navigation, command palette, notifications
   ============================================================ */

function LearningToggle({ on, onToggle }) {
  return <button onClick={onToggle} title="Learning Mode"
    style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'5px 11px', borderRadius:'var(--radius-pill)',
      cursor:'pointer', transition:'var(--transition-base)', fontFamily:'General Sans', fontSize:11, fontWeight:600,
      letterSpacing:'0.08em',
      background: on?'var(--accent-amber-dim)':'var(--bg-elevated)',
      border:`1px solid ${on?'var(--accent-amber)':'var(--border-default)'}`,
      color: on?'var(--accent-amber)':'var(--text-muted)',
      boxShadow: on?'var(--accent-amber-glow)':'none' }}>
    <span style={{ width:6, height:6, borderRadius:'50%', background: on?'var(--accent-amber)':'var(--text-muted)',
      boxShadow: on?'0 0 6px var(--accent-amber)':'none' }} className={on?'anim-pulse':''}></span>
    LM {on?'ON':'OFF'}
  </button>;
}

const NAV_ITEMS = [
  { id:'tasks', label:'Task Command Center' },
  { id:'members', label:'Members' },
  { id:'insights', label:'Insights War Room' },
  { id:'requirements', label:'Requirements' },
  { id:'memory', label:'Memory AI', accent:true },
];

function TopNav({ page, setPage, learning, setLearning, unread, onBell, onSearch }) {
  return <div style={{ height:'var(--nav-h)', background:'var(--bg-surface)', borderBottom:'1px solid var(--border-subtle)',
    padding:'0 24px', display:'flex', alignItems:'center', gap:28, flex:'0 0 auto', position:'relative', zIndex:60 }}>
    <div onClick={()=>setPage('tasks')} className="clickable" style={{ display:'flex', alignItems:'center', gap:9 }}>
      <span style={{ width:22, height:22, borderRadius:6, background:'linear-gradient(135deg, var(--accent-blue), #CC5500)',
        display:'inline-flex', alignItems:'center', justifyContent:'center', color:'#fff', boxShadow:'var(--accent-blue-glow)' }}>
        <Icon.brain s={14}/></span>
      <span style={{ fontFamily:'Space Grotesk', fontWeight:700, fontSize:16, letterSpacing:'0.1em', color:'var(--text-primary)' }}>NEURAL PM</span>
    </div>
    <nav style={{ display:'flex', gap:4, height:'100%', alignItems:'stretch' }}>
      {NAV_ITEMS.map(n => {
        const active = page===n.id;
        return <button key={n.id} onClick={()=>setPage(n.id)} style={{ background:'none', border:'none', cursor:'pointer',
          padding:'0 12px', fontSize:13, fontWeight:500, fontFamily:'General Sans',
          color: active?'var(--text-primary)':'var(--text-secondary)',
          borderBottom:`2px solid ${active?'var(--accent-blue)':'transparent'}`, transition:'var(--transition-fast)' }}
          onMouseEnter={e=>{ if(!active) e.currentTarget.style.color='var(--text-primary)'; }}
          onMouseLeave={e=>{ if(!active) e.currentTarget.style.color='var(--text-secondary)'; }}>
          {n.accent && <span style={{ width:7,height:7,borderRadius:'50%',background:'var(--accent-blue)',boxShadow:'0 0 6px var(--accent-blue)' }} className={active?'':'anim-pulse'}></span>}{n.label}</button>;
      })}
    </nav>
    <div style={{ flex:1 }}></div>
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <button className="icon-btn" onClick={onSearch} title="Search (⌘K)"><Icon.search s={17}/></button>
      <button className="icon-btn" onClick={onBell} title="Notifications" style={{ position:'relative' }}>
        <Icon.bell s={17}/>
        {unread>0 && <span style={{ position:'absolute', top:3, right:3, width:7, height:7, borderRadius:'50%',
          background:'var(--danger)', border:'1.5px solid var(--bg-surface)' }}></span>}
      </button>
      <LearningToggle on={learning} onToggle={()=>setLearning(v=>!v)} />
      <button onClick={()=>setPage('settings')} className="icon-btn" title="Settings"><Icon.gear s={16}/></button>
      <div className="clickable" style={{ width:30, height:30, borderRadius:'50%',
        background:'linear-gradient(135deg, hsl(25 90% 48%), hsl(5 70% 38%))', display:'inline-flex',
        alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, color:'#fff', marginLeft:2 }}>YO</div>
    </div>
  </div>;
}

/* ---------- Command palette ---------- */
function CommandPalette({ onClose, setPage, openMember, openTask, openChatbot }) {
  const { TASKS, MEMBERS, MEMORY } = window.NPM_DATA;
  const [scope, setScope] = useState('Tasks');
  const [q, setQ] = useState('');
  const inputRef = useRef();
  useEffect(()=>{ inputRef.current && inputRef.current.focus(); }, []);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (scope==='Tasks') return TASKS.filter(x=>!t||x.title.toLowerCase().includes(t)||x.id.toLowerCase().includes(t)).slice(0,8);
    if (scope==='Members') return MEMBERS.filter(x=>!t||x.name.toLowerCase().includes(t)||x.role.toLowerCase().includes(t)).slice(0,8);
    return MEMORY.filter(x=>!t||x.sum.toLowerCase().includes(t)||x.id.includes(t)).filter(x=>x.tier!=='superseded'&&x.tier!=='archived').slice(0,8);
  }, [q, scope]);

  return <div className="overlay" onClick={onClose} style={{ display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:'12vh' }}>
    <div onClick={e=>e.stopPropagation()} style={{ width:'min(620px,92vw)', background:'var(--bg-elevated)',
      border:'1px solid var(--border-default)', borderRadius:'var(--radius-lg)', overflow:'hidden',
      boxShadow:'0 24px 64px rgba(0,0,0,0.6)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 18px', borderBottom:'1px solid var(--border-subtle)' }}>
        <Icon.search s={18} style={{ color:'var(--text-muted)' }}/>
        <input ref={inputRef} value={q} onChange={e=>setQ(e.target.value)} placeholder={`Search ${scope.toLowerCase()}…`}
          style={{ flex:1, background:'none', border:'none', outline:'none', color:'var(--text-primary)', fontSize:15, fontFamily:'General Sans' }}/>
        <kbd style={{ fontSize:11, color:'var(--text-muted)', border:'1px solid var(--border-default)', borderRadius:4, padding:'2px 6px', fontFamily:'Geist Mono' }}>ESC</kbd>
      </div>
      <div style={{ display:'flex', gap:4, padding:'10px 14px', borderBottom:'1px solid var(--border-subtle)' }}>
        {['Tasks','Members','Memory'].map(s=><button key={s} onClick={()=>setScope(s)} className={'chip'+(scope===s?' active':'')}>{s}</button>)}
      </div>
      <div style={{ maxHeight:'46vh', overflowY:'auto', padding:6 }}>
        {!q && <div style={{ fontSize:10, letterSpacing:'0.12em', color:'var(--text-muted)', padding:'8px 12px 4px', fontWeight:600 }}>RECENT</div>}
        {results.length===0 && <div style={{ padding:'24px 14px', color:'var(--text-muted)', fontSize:13 }}>No results for "{q}"</div>}
        {results.map((r,i)=>{
          let main, sub, onClick, ic;
          if (scope==='Tasks') { main=r.title; sub=<StatusPill status={r.status}/>; ic=<Icon.node s={15}/>;
            onClick=()=>{ setPage('tasks'); openTask(r); onClose(); }; }
          else if (scope==='Members') { main=r.name; sub=<span style={{fontSize:12,color:'var(--text-muted)'}}>{r.role} · {r.load}%</span>; ic=<Avatar member={r} size={22}/>;
            onClick=()=>{ setPage('members'); openMember(r); onClose(); }; }
          else { main=r.sum; sub=<span style={{fontSize:11,color:'var(--text-muted)',fontFamily:'Geist Mono'}}>{r.type} · {r.date}</span>; ic=<span style={{fontFamily:'Geist Mono',fontSize:11,color:'var(--accent-blue)'}}>{r.id}</span>;
            onClick=()=>{ openChatbot(r); onClose(); }; }
          return <div key={i} onClick={onClick} className="clickable" style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px',
            borderRadius:'var(--radius-sm)', transition:'var(--transition-fast)' }}
            onMouseEnter={e=>e.currentTarget.style.background='var(--bg-hover)'}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            <span style={{ color:'var(--text-muted)', width:24, display:'inline-flex', justifyContent:'center' }}>{ic}</span>
            <span style={{ flex:1, fontSize:13.5, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{main}</span>
            {sub}
          </div>;
        })}
      </div>
    </div>
  </div>;
}

/* ---------- Notifications drawer ---------- */
const AGENT_ICON = {
  Risk:<Icon.warn s={15}/>, Cascade:<Icon.node s={15}/>, Assignment:<Icon.spark s={15}/>, Memory:<Icon.brain s={15}/>,
};
const AGENT_COLOR = { Risk:'var(--danger)', Cascade:'var(--accent-blue)', Assignment:'var(--accent-amber)', Memory:'var(--accent-blue)' };

function NotificationsDrawer({ onClose, notifs, setNotifs, onAction }) {
  return <Drawer width={380} onClose={onClose}>
    <DrawerHeader onClose={onClose}
      title={<div className="type-subheading">Notifications</div>}
      sub={<div className="type-small" style={{ marginTop:2 }}>{notifs.filter(n=>n.unread).length} unread</div>}
      right={<button className="btn btn-muted" style={{ padding:'5px 10px', fontSize:12 }}
        onClick={()=>setNotifs(ns=>ns.map(n=>({...n,unread:false})))}>Mark all read</button>}/>
    <div style={{ flex:1, overflowY:'auto', padding:12 }}>
      {notifs.map(n=>(
        <div key={n.id} style={{ background: n.unread?'var(--bg-hover)':'var(--bg-base)', border:'1px solid var(--border-subtle)',
          borderRadius:'var(--radius-md)', padding:'12px 14px', marginBottom:8, position:'relative' }}>
          {n.unread && <span style={{ position:'absolute', top:14, right:14, width:6, height:6, borderRadius:'50%', background:'var(--accent-blue)' }}></span>}
          <div style={{ display:'flex', gap:10 }}>
            <span style={{ color:AGENT_COLOR[n.agent], marginTop:1 }}>{AGENT_ICON[n.agent]}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, color:'var(--text-primary)', lineHeight:1.45, paddingRight:10 }}>{n.text}</div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:8 }}>
                <span className="type-small">{n.time}</span>
                <button className="btn btn-ghost" style={{ padding:'4px 10px', fontSize:11.5 }}
                  onClick={()=>{ onAction(n); setNotifs(ns=>ns.map(x=>x.id===n.id?{...x,unread:false}:x)); }}>{n.action}</button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </Drawer>;
}

Object.assign(window, { TopNav, CommandPalette, NotificationsDrawer, LearningToggle, AGENT_ICON, AGENT_COLOR });
