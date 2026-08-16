/* ============================================================
   NeuralPM — Find Best Match (Assignment Agent) + Task Detail
   ============================================================ */

/* compute believable candidate scores for a task */
function computeCandidates(task, members, prefApplied) {
  // pick members by category affinity
  const catSkill = { Frontend:['React','Vue','CSS','TypeScript','CSS/Animation'], Backend:['Node.js','Python','PostgreSQL','Go','Django','Celery'],
    API:['Go','gRPC','GraphQL','Node.js'], Testing:['Playwright','Cypress','Jest','CI/CD'], Design:['Figma','Design Systems','Prototyping'], Other:[] };
  const wanted = catSkill[task.cat]||[];
  const scored = members.map(m => {
    const skillHit = m.skills.filter(s=>wanted.includes(s[0])).reduce((a,s)=>a+(s[1]==='Expert'?34:s[1]==='Intermediate'?20:10),0);
    const skill = Math.min(98, 50 + skillHit);
    const workload = Math.max(20, 100 - m.load);
    const velocity = Math.min(96, 50 + m.velocity);
    const affinity = 60 + ((m.id.charCodeAt(1)*7 + task.id.charCodeAt(3)*3) % 38);
    let overall = Math.round(skill*0.4 + workload*0.25 + velocity*0.2 + affinity*0.15);
    return { m, skill, workload, velocity, affinity, overall, pref:false };
  }).sort((a,b)=>b.overall-a.overall);

  let top3 = scored.slice(0,3);
  // preference: backend tasks → Sarah re-rank
  if (prefApplied && task.cat==='Backend') {
    const sarah = scored.find(c=>c.m.id==='m1');
    if (sarah && top3[0].m.id!=='m1') {
      sarah.pref = true; sarah.overall = Math.min(96, sarah.overall+11);
      top3 = [sarah, ...top3.filter(c=>c.m.id!=='m1')].slice(0,3);
    } else if (sarah) { sarah.pref = true; }
  }
  return top3;
}

function FactorRow({ label, score }) {
  const c = scoreColor(score);
  return <div style={{ display:'flex', alignItems:'center', gap:10, padding:'3px 0' }}>
    <span className="type-small" style={{ width:128, flex:'0 0 auto' }}>{label}</span>
    <div style={{ flex:1 }}><ProgressBar value={score} h={2} color={c}/></div>
    <span style={{ fontFamily:'Geist Mono', fontSize:12, color:c, width:24, textAlign:'right' }}>{score}</span>
  </div>;
}

function CandidateCard({ cand, rank, onAssign, onProfile }) {
  const c = scoreColor(cand.overall);
  const isPref = cand.pref;
  return <div style={{ background:'var(--bg-elevated)', borderRadius:'var(--radius-md)', padding:16, marginBottom:8,
    border:`1px solid ${rank===1?'var(--border-strong)':'var(--border-subtle)'}`,
    boxShadow: isPref?'var(--accent-amber-glow)':'none', position:'relative', transition:'var(--transition-base)' }}>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
      <div style={{ display:'flex', gap:11, alignItems:'center' }}>
        <span style={{ fontFamily:'Geist Mono', fontSize:11, color:'var(--text-muted)' }}>#{rank}</span>
        <Avatar member={cand.m} size={36} ring={rank===1?'var(--accent-blue)':undefined}/>
        <div>
          <div style={{ fontSize:13.5, fontWeight:600, color:'var(--text-primary)' }}>{cand.m.name}</div>
          <div className="type-small">{cand.m.role}</div>
        </div>
      </div>
      <div style={{ textAlign:'right' }}>
        <div style={{ fontFamily:'Space Grotesk', fontWeight:700, fontSize:40, lineHeight:1, color:c }}>{cand.overall}</div>
        <div className="type-small" style={{ marginTop:2 }}>match</div>
      </div>
    </div>
    {isPref && <Tip label="Your learned preference re-ranked this candidate." w={210}>
      <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, color:'var(--accent-amber)',
        background:'var(--accent-amber-dim)', border:'1px solid var(--accent-amber)', borderRadius:'var(--radius-pill)',
        padding:'2px 9px', marginBottom:10 }}>✦ Preference applied</span></Tip>}
    <div style={{ marginBottom:12 }}>
      <FactorRow label="Skill & Tech Match" score={cand.skill}/>
      <FactorRow label="Workload & Availability" score={cand.workload}/>
      <FactorRow label="Velocity & Performance" score={cand.velocity}/>
      <FactorRow label="Context Affinity" score={cand.affinity}/>
    </div>
    <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.5, marginBottom:12,
      paddingLeft:10, borderLeft:'2px solid var(--border-default)' }}>
      {isPref ? `You usually route backend work to ${cand.m.name.split(' ')[0]} — preference boosted this match.`
        : rank===1 ? `Strongest skill overlap with low contention on ${cand.m.name.split(' ')[0]}'s current sprint.`
        : `Solid fit; slightly higher current load than #1.`}
    </div>
    <div style={{ display:'flex', gap:8 }}>
      <button className="btn btn-primary" style={{ flex:1, justifyContent:'center' }} onClick={()=>onAssign(cand, rank)}>Assign</button>
      <button className="btn btn-muted" onClick={()=>onProfile(cand.m)} style={{ padding:'8px 12px' }}>Profile</button>
    </div>
  </div>;
}

function AssignmentDrawer({ task, members, learning, prefOn, onClose, onAssign, toast }) {
  const [loading, setLoading] = useState(true);
  const [cands, setCands] = useState([]);
  const [learnModal, setLearnModal] = useState(null); // {cand, rank}
  const allCapacity = members.every(m=>m.load>80);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => { setCands(computeCandidates(task, members, prefOn)); setLoading(false); }, 1100);
    return () => clearTimeout(t);
  }, [task, prefOn]);

  const doAssign = (cand, rank) => {
    if (learning && rank!==1) { setLearnModal({ cand, rank }); return; }
    finalize(cand);
  };
  const finalize = (cand, pattern) => {
    onAssign(task, cand.m, pattern);
    setLearnModal(null);
    onClose();
  };

  return <Drawer width={480} accent="var(--accent-blue)" onClose={onClose}>
    <div style={{ padding:'16px 24px 18px', borderBottom:'1px solid var(--border-subtle)', flex:'0 0 auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span className="type-small" style={{ display:'flex', alignItems:'center', gap:6, color:'var(--accent-blue)' }}>
          <Icon.spark s={13}/>ASSIGNMENT AGENT</span>
        <button className="icon-btn" onClick={onClose}><Icon.close/></button>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:10 }}>
        <span className="type-subheading" style={{ fontSize:15 }}>{task.title}</span>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8 }}>
        <SeverityBadge sev={task.sev}/><CategoryTag cat={task.cat}/>
        <span className="type-small">Complexity: {task.complexity} · Urgency: {task.urgency}</span>
      </div>
    </div>
    <div style={{ flex:1, overflowY:'auto', padding:16 }}>
      {allCapacity && <div style={{ background:'var(--accent-amber-dim)', border:'1px solid var(--accent-amber)', borderRadius:'var(--radius-md)',
        padding:'10px 12px', marginBottom:12, fontSize:12.5, color:'var(--accent-amber)', display:'flex', gap:8 }}>
        <Icon.warn s={15}/>All members near capacity — candidates shown, but expect contention.</div>}
      {loading ? <div>
        <div style={{ display:'flex', alignItems:'center', gap:8, color:'var(--text-muted)', fontSize:12.5, marginBottom:14 }}>
          <AgentDots/> Scoring candidates against {members.length} members…</div>
        {[1,2,3].map(i=><div key={i} className="shimmer" style={{ height:176, borderRadius:'var(--radius-md)', marginBottom:8 }}></div>)}
      </div> : cands.map((c,i)=><CandidateCard key={c.m.id} cand={c} rank={i+1} onAssign={doAssign} onProfile={()=>{}}/>) }
    </div>
    <div style={{ borderTop:'1px solid var(--border-subtle)', padding:'12px 16px', display:'flex', gap:8, flex:'0 0 auto' }}>
      <button className="btn btn-muted" style={{ flex:1, justifyContent:'center' }} onClick={()=>{ setLoading(true); setTimeout(()=>{setCands(computeCandidates(task,members,prefOn));setLoading(false);},900); }}>
        <Icon.refresh s={14}/>Refresh</button>
      <button className="btn btn-ghost" style={{ flex:1, justifyContent:'center' }} onClick={onClose}>Assign manually</button>
    </div>
    {learnModal && <Modal onClose={()=>setLearnModal(null)} w={420}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
        <span style={{ color:'var(--accent-amber)' }}><Icon.brain s={20}/></span>
        <div className="type-heading" style={{ fontSize:17 }}>Learning Mode</div>
      </div>
      <div style={{ fontSize:14, color:'var(--text-secondary)', lineHeight:1.55, marginBottom:22 }}>
        You picked <b style={{color:'var(--text-primary)'}}>{learnModal.cand.m.name}</b> (#{learnModal.rank}) over the top suggestion.
        Is this a one-time exception, or a new pattern you'd like me to learn?
      </div>
      <div style={{ display:'flex', gap:10 }}>
        <button className="btn btn-muted" style={{ flex:1, justifyContent:'center' }} onClick={()=>finalize(learnModal.cand)}>One-time</button>
        <button className="btn btn-primary" style={{ flex:1, justifyContent:'center', background:'var(--accent-amber)' }}
          onClick={()=>finalize(learnModal.cand, true)}>New pattern</button>
      </div>
    </Modal>}
  </Drawer>;
}

/* ---------- Task Detail Drawer ---------- */
function TaskDetailDrawer({ task, members, onClose, onFindMatch, onStatusChange }) {
  const m = members.find(x=>x.id===task.who);
  const { TASKS } = window.NPM_DATA;
  const upstream = (task.deps||[]).map(d=>TASKS.find(t=>t.id===d)).filter(Boolean);
  const downstream = TASKS.filter(t=>(t.deps||[]).includes(task.id));
  const activity = [
    { ic:<Icon.spark s={13}/>, c:'var(--accent-blue)', txt:`Best-match computed by Assignment Agent`, t:'2h ago' },
    { ic:<Icon.warn s={13}/>, c:'var(--danger)', txt:`Risk Agent flagged dependency contention`, t:'5h ago' },
    { ic:<Icon.edit s={13}/>, c:'var(--text-muted)', txt:`Due date shifted +3d (Cascade Agent)`, t:'1d ago' },
    { ic:<Icon.plus s={13}/>, c:'var(--success)', txt:`Task created`, t:'3d ago' },
  ];
  return <Drawer width={600} accent="var(--accent-blue)" onClose={onClose}>
    <DrawerHeader onClose={onClose}
      title={<div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ fontFamily:'Geist Mono', fontSize:12, color:'var(--text-muted)' }}>{task.id}</span>
        <span className="type-subheading" style={{ fontSize:15 }}>{task.title}</span></div>}
      sub={<div style={{ display:'flex', gap:8, marginTop:8 }}><SeverityBadge sev={task.sev}/><CategoryTag cat={task.cat}/><StatusPill status={task.status}/></div>}/>
    <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>
      <div style={{ fontSize:13.5, color:'var(--text-secondary)', lineHeight:1.6, marginBottom:20 }}>{task.desc}</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:22 }}>
        <div><div className="type-small" style={{ marginBottom:6 }}>ASSIGNEE</div>
          {m?<div style={{ display:'flex', alignItems:'center', gap:8 }}><Avatar member={m} size={26}/><span style={{ fontSize:13, color:'var(--text-primary)' }}>{m.name}</span></div>
            :<button className="btn btn-ghost" onClick={()=>onFindMatch(task)}><Icon.spark s={14}/>Find Best Match</button>}</div>
        <div><div className="type-small" style={{ marginBottom:6 }}>PROGRESS</div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}><ProgressBar value={task.prog}/><span style={{ fontFamily:'Geist Mono', fontSize:12, color:'var(--text-muted)' }}>{task.prog}%</span></div></div>
      </div>
      <Section title="DEPENDENCY MAP">
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <DepRow label="Upstream (blocks this)" items={upstream} empty="No upstream dependencies"/>
          <DepRow label="Downstream (blocked by this)" items={downstream} empty="No downstream tasks"/>
        </div>
      </Section>
      <Section title="ACTIVITY LOG — MEMORY AGENT EVENTS">
        <div style={{ display:'flex', flexDirection:'column' }}>
          {activity.map((a,i)=><div key={i} style={{ display:'flex', gap:12, paddingBottom:14, position:'relative' }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
              <span style={{ width:24, height:24, borderRadius:'50%', background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)',
                display:'inline-flex', alignItems:'center', justifyContent:'center', color:a.c, flex:'0 0 auto' }}>{a.ic}</span>
              {i<activity.length-1 && <span style={{ flex:1, width:1, background:'var(--border-subtle)', marginTop:2 }}></span>}
            </div>
            <div style={{ paddingTop:3 }}><div style={{ fontSize:13, color:'var(--text-secondary)' }}>{a.txt}</div>
              <div className="type-small" style={{ marginTop:2 }}>{a.t}</div></div>
          </div>)}
        </div>
      </Section>
    </div>
    <div style={{ borderTop:'1px solid var(--border-subtle)', padding:'12px 24px', display:'flex', gap:10, flex:'0 0 auto' }}>
      <button className="btn btn-ghost" onClick={()=>onFindMatch(task)}><Icon.spark s={14}/>Re-run Best Match</button>
    </div>
  </Drawer>;
}

function Section({ title, children }) {
  return <div style={{ marginBottom:24 }}>
    <div className="type-small" style={{ letterSpacing:'0.1em', marginBottom:12 }}>{title}</div>{children}</div>;
}
function DepRow({ label, items, empty }) {
  return <div>
    <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:6 }}>{label}</div>
    {items.length===0 ? <div style={{ fontSize:12.5, color:'var(--text-muted)', fontStyle:'italic' }}>{empty}</div>
      : <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>{items.map(t=>
        <span key={t.id} className="chip" style={{ gap:6 }}><span style={{ fontFamily:'Geist Mono', fontSize:11, color:'var(--text-muted)' }}>{t.id}</span>{t.title.slice(0,28)}</span>)}</div>}
  </div>;
}

Object.assign(window, { AssignmentDrawer, TaskDetailDrawer, computeCandidates, Section });
