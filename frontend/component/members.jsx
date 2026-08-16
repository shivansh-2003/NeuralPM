/* ============================================================
   NeuralPM — Members Intelligence Hub
   ============================================================ */

function MembersPage({ members, openMember }) {
  const [sort, setSort] = useState({ k:'load', dir:-1 });
  const [roleF, setRoleF] = useState([]);
  const [availF, setAvailF] = useState([]);
  const [overOnly, setOverOnly] = useState(false);
  const roles = [...new Set(members.map(m=>m.role))];

  const rows = useMemo(()=>{
    let arr = members.filter(m=>(!roleF.length||roleF.includes(m.role))&&(!availF.length||availF.includes(m.avail))&&(!overOnly||m.load>85));
    arr.sort((a,b)=>{ const av=a[sort.k],bv=b[sort.k]; return (av<bv?-1:av>bv?1:0)*sort.dir; });
    return arr;
  },[members,sort,roleF,availF,overOnly]);
  const setK = k => setSort(s=>s.k===k?{k,dir:-s.dir}:{k,dir:1});
  const grid = '60px minmax(160px,1.4fr) 1.2fr 150px 90px 100px 120px';
  const Chip = ({label,arr,set,val}) => <button className={'chip'+(arr.includes(val)?' active':'')} onClick={()=>set(a=>a.includes(val)?a.filter(x=>x!==val):[...a,val])}>{label}</button>;

  return <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--bg-base)' }} className="neural-grid">
    <div style={{ padding:'14px 24px', borderBottom:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', flex:'0 0 auto' }}>
      <span className="type-small" style={{ marginRight:4 }}>ROLE</span>
      {roles.map(r=><Chip key={r} label={r.split(' ').slice(-1)[0]} arr={roleF} set={setRoleF} val={r}/>)}
      <span style={{ width:1, height:18, background:'var(--border-subtle)', margin:'0 4px' }}></span>
      {['Available','Busy','On PTO'].map(a=><Chip key={a} label={a} arr={availF} set={setAvailF} val={a}/>)}
      <label className="chip" style={{ background:overOnly?'var(--accent-blue-dim)':undefined, borderColor:overOnly?'var(--accent-blue)':undefined, color:overOnly?'var(--accent-blue)':undefined }}
        onClick={()=>setOverOnly(v=>!v)}>Overloaded only</label>
    </div>
    <div style={{ flex:1, overflowY:'auto' }}>
      <div style={{ display:'grid', gridTemplateColumns:grid, position:'sticky', top:0, background:'var(--bg-elevated)', borderBottom:'1px solid var(--border-default)', zIndex:5 }}>
        {[['',''],['name','Name'],['role','Role'],['load','Load'],['active','Active'],['velocity','Velocity'],['avail','Availability']].map(([k,l],i)=>
          <div key={i} onClick={()=>k&&setK(k)} style={{ padding:'10px 16px', fontSize:11, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase',
            color: sort.k===k?'var(--text-secondary)':'var(--text-muted)', cursor:k?'pointer':'default', display:'flex', gap:5, alignItems:'center' }}>
            {l}{sort.k===k&&(sort.dir>0?<Icon.up s={12}/>:<Icon.down s={12}/>)}</div>)}
      </div>
      {rows.map((m,i)=><div key={m.id} className="clickable" onClick={()=>openMember(m)} style={{ display:'grid', gridTemplateColumns:grid, alignItems:'center',
        background:i%2?'var(--bg-surface)':'var(--bg-base)', borderBottom:'1px solid var(--border-subtle)', transition:'var(--transition-fast)' }}
        onMouseEnter={e=>e.currentTarget.style.background='var(--bg-hover)'} onMouseLeave={e=>e.currentTarget.style.background=i%2?'var(--bg-surface)':'var(--bg-base)'}>
        <div style={{ padding:'12px 16px' }}><Avatar member={m} size={32}/></div>
        <div style={{ padding:'12px 16px', fontSize:13.5, color:'var(--text-primary)', fontWeight:500 }}>{m.name}</div>
        <div style={{ padding:'12px 16px', fontSize:13, color:'var(--text-secondary)' }}>{m.role}</div>
        <div style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:8 }}>
          <ProgressBar value={m.load} color={m.load>85?'var(--danger)':'var(--accent-blue)'}/>
          <span style={{ fontFamily:'Geist Mono', fontSize:11, color:m.load>85?'var(--danger)':'var(--text-muted)', width:30 }}>{m.load}%</span></div>
        <div style={{ padding:'12px 16px', fontFamily:'Geist Mono', fontSize:13, color:'var(--text-secondary)' }}>{m.active}</div>
        <div style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontFamily:'Geist Mono', fontSize:13, color:'var(--text-secondary)' }}>{m.velocity}</span>
          <Sparkline data={m.sprints} w={32} h={16}/></div>
        <div style={{ padding:'12px 16px' }}><AvailBadge avail={m.avail}/></div>
      </div>)}
    </div>
  </div>;
}

function AvailBadge({ avail }) {
  const c = avail==='Available'?{bg:'var(--success-dim)',tx:'var(--success)'}:avail==='On PTO'?{bg:'var(--accent-amber-dim)',tx:'var(--accent-amber)'}:{bg:'var(--bg-elevated)',tx:'var(--text-secondary)'};
  return <span className="status-pill" style={{ background:c.bg, color:c.tx }}><span className="status-dot" style={{ background:c.tx }}></span>{avail}</span>;
}

function MemberProfileDrawer({ member, onClose }) {
  const { TASKS } = window.NPM_DATA;
  const m = member;
  const tasks = TASKS.filter(t=>t.who===m.id);
  const palette = ['var(--accent-blue)','var(--accent-amber)','var(--success)','#A3A3A3','#FF8C8C'];
  const slices = (tasks.length?tasks:[{title:'Idle',id:'-'}]).slice(0,5).map((t,i)=>({ label:t.title, v:20+((t.id?t.id.charCodeAt(3):5)%30), color:palette[i%palette.length] }));
  const velData = m.sprints.map((v,i)=>({ x:'S'+(i+1), v }));
  const teamAvg = m.sprints.map((v,i)=>({ x:'S'+(i+1), v:26+((i*3)%6) }));
  const dots = (lvl) => { const n=lvl==='Expert'?3:lvl==='Intermediate'?2:1;
    return <span style={{ display:'inline-flex', gap:3 }}>{[0,1,2].map(i=><span key={i} style={{ width:5, height:5, borderRadius:'50%', background:i<n?'var(--accent-blue)':'var(--border-default)' }}></span>)}</span>; };
  const history = [
    { t:'TK-042 Payment API', d:'2d ago', score:88, out:'On track' },
    { t:'TK-056 Token accounting', d:'5d ago', score:91, out:'Completed on time' },
    { t:'TK-047 pgvector migration', d:'1w ago', score:84, out:'Delayed' },
    { t:'TK-031 Auth refactor', d:'2w ago', score:79, out:'Completed on time' },
  ];

  return <Drawer width={600} accent="var(--accent-blue)" onClose={onClose}>
    <DrawerHeader onClose={onClose}
      title={<div style={{ display:'flex', gap:16, alignItems:'center' }}>
        <Avatar member={m} size={56}/>
        <div><div className="type-display" style={{ fontSize:22 }}>{m.name}</div>
          <div className="type-body" style={{ marginTop:2 }}>{m.role} · joined {m.join}</div></div></div>}
      right={<AvailBadge avail={m.avail}/>}/>
    <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>
      <div style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:24 }}>Currently working on <b style={{color:'var(--text-primary)'}}>{m.active} tasks</b> at {m.load}% capacity this sprint.</div>

      <Section title="SKILL MATRIX">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
          {m.skills.map((s,i)=><div key={i} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'8px 11px' }}>
            <div style={{ fontSize:12.5, color:'var(--text-primary)', marginBottom:6, display:'flex', alignItems:'center', gap:5 }}>
              {s[2] && <span style={{ color:'var(--accent-amber)', fontSize:11 }}>✦</span>}{s[0]}</div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:10.5, color:'var(--text-muted)' }}>{s[1]}</span>{dots(s[1])}</div></div>)}
        </div>
      </Section>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
        <Section title="WORKLOAD">
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
            <Donut slices={slices} size={150} center={m.load+'%'}/>
            <div style={{ width:'100%', marginTop:12 }}>{slices.map((s,i)=><div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
              <span style={{ width:8, height:8, borderRadius:2, background:s.color, flex:'0 0 auto' }}></span>
              <span style={{ fontSize:11.5, color:'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.label}</span></div>)}</div>
          </div>
        </Section>
        <Section title="VELOCITY (6 SPRINTS)">
          <LineChart data={velData} compare={teamAvg} w={260} h={170} yMax={40} ySuffix=""/>
          <div style={{ display:'flex', gap:14, fontSize:11, marginTop:8 }}>
            <span style={{ display:'flex', alignItems:'center', gap:5, color:'var(--text-secondary)' }}><span style={{ width:14, height:2, background:'var(--accent-blue)' }}></span>{m.name.split(' ')[0]}</span>
            <span style={{ display:'flex', alignItems:'center', gap:5, color:'var(--text-muted)' }}><span style={{ width:14, height:2, background:'var(--text-muted)', borderTop:'2px dashed' }}></span>Team avg</span></div>
        </Section>
      </div>

      <Section title="ASSIGNMENT HISTORY">
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
          <thead><tr style={{ color:'var(--text-muted)' }}>{['Task','Assigned','Score','Outcome'].map(h=><th key={h} style={{ textAlign:'left', padding:'6px 8px', fontSize:10.5, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' }}>{h}</th>)}</tr></thead>
          <tbody>{history.map((h,i)=><tr key={i} style={{ borderTop:'1px solid var(--border-subtle)' }}>
            <td style={{ padding:'8px', color:'var(--text-secondary)' }}>{h.t}</td>
            <td style={{ padding:'8px', color:'var(--text-muted)' }}>{h.d}</td>
            <td style={{ padding:'8px', fontFamily:'Geist Mono', color:scoreColor(h.score) }}>{h.score}</td>
            <td style={{ padding:'8px', color: h.out==='Delayed'?'var(--danger)':h.out==='On track'?'var(--accent-blue)':'var(--success)' }}>{h.out}</td></tr>)}</tbody>
        </table>
      </Section>

      <Section title="MANAGER CONTROLS">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <Field label="Capacity this sprint (%)"><input className="input" type="number" defaultValue={m.load}/></Field>
          <Field label="Availability"><select className="input" defaultValue={m.avail}>{['Available','Busy','On PTO'].map(o=><option key={o}>{o}</option>)}</select></Field>
        </div>
        <div style={{ height:12 }}></div>
        <Field label="Manager notes (private)"><textarea className="input" rows={2} placeholder="Visible only to managers…" style={{ fontFamily:'General Sans' }}/></Field>
      </Section>
    </div>
  </Drawer>;
}

Object.assign(window, { MembersPage, MemberProfileDrawer, AvailBadge });
