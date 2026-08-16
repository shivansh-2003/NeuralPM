/* ============================================================
   NeuralPM — Memory Chatbot + Memory Autopsy (visual signature)
   ============================================================ */

const SUGGESTED = [
  "What are the biggest risks this sprint?",
  "Why was the Payment API delayed?",
  "Who is best for unassigned tasks?",
  "Summarise requirement changes this week.",
];

/* canned answers keyed loosely by query content */
function answerFor(q) {
  const t = q.toLowerCase();
  if (t.includes('risk')) return {
    text: [
      { s:"Three risks dominate this sprint:" },
      { s:"\n• " }, { s:"Sarah Chen overload", b:1 }, { s:" — 91% capacity, 6 active tasks " }, { cite:"#4418" },
      { s:"\n• " }, { s:"pgvector migration", b:1 }, { s:" (TK-047) due today at 25% " }, { cite:"#4421" },
      { s:"\n• " }, { s:"Blocker chain", b:1 }, { s:" on the payment path — no parallel slack." },
      { s:"\nThe overload pattern matches one you usually tolerate below 70%, so I've suppressed the Marcus Webb flag." },
    ],
    autopsy: AUTOPSY_RISK,
  };
  if (t.includes('payment') || t.includes('delay')) return {
    text: [
      { s:"Payment API (TK-042) slipped " }, { s:"+3 days", b:1 }, { s:". The causal chain:" },
      { s:"\n1. Scope change " }, { cite:"#4410" }, { s:" — rate limiting must survive a 10x launch spike" },
      { s:"\n2. Re-assigned to Sarah " }, { cite:"#4402" }, { s:" (your backend routing preference)" },
      { s:"\n3. Sarah hit 91% load → overload risk " }, { cite:"#4418" },
      { s:"\n4. Delivery date recomputed by the Cascade Agent " }, { cite:"#4421" },
    ],
    autopsy: AUTOPSY_PAYMENT,
  };
  if (t.includes('best') || t.includes('unassigned') || t.includes('who')) return {
    text: [
      { s:"Two tasks are unassigned: TK-044 (E2E tests) and TK-048 (blocker-chain detection)." },
      { s:"\n• " }, { s:"TK-044", b:1 }, { s:" → " }, { s:"Ava Thompson", b:1 }, { s:" (Playwright Expert, 47% load)" },
      { s:"\n• " }, { s:"TK-048", b:1 }, { s:" → " }, { s:"Diego Alvarez", b:1 }, { s:" (graph/platform, 52% load)" },
      { s:"\nBoth have headroom this sprint, unlike Sarah and Lena." },
    ],
    autopsy: AUTOPSY_DEFAULT,
  };
  return {
    text: [
      { s:"This week's requirement changes:" },
      { s:"\n• " }, { s:"RQ-018", b:1 }, { s:" — payment must survive 10x traffic " }, { cite:"#4410" },
      { s:"\n• " }, { s:"RQ-017", b:1 }, { s:" — saved-card selection added to checkout" },
      { s:"\n• " }, { s:"RQ-016", b:1 }, { s:" — pgvector migration marked as a blocker" },
      { s:"\nRQ-018 is the highest-impact: it directly caused the Payment API slip." },
    ],
    autopsy: AUTOPSY_DEFAULT,
  };
}

const AUTOPSY_RISK = {
  summary: 'Context used: 3,247 / 8,192 tokens — 8 memories loaded, 5 filtered out',
  loaded: ['#4421','#4418','#4410','#4402','#4388','#4350','#4420','#4415'],
  filtered: ['#4401','#3990','#4399','#4205','#4120'],
  prefs: [['risk_tolerance','conf 0.67','Overload risks below 70% suppressed'],['communication_style','conf 0.78','Response formatted as bullet points']],
};
const AUTOPSY_PAYMENT = {
  summary: 'Context used: 2,940 / 8,192 tokens — 7 memories loaded, 4 filtered out',
  loaded: ['#4421','#4410','#4402','#4418','#4415','#4350','#4420'],
  filtered: ['#4401','#3990','#4399','#4205'],
  prefs: [['assignment_override','conf 0.74','Sarah prioritised in ranking'],['communication_style','conf 0.78','Response formatted as numbered chain']],
};
const AUTOPSY_DEFAULT = {
  summary: 'Context used: 2,610 / 8,192 tokens — 6 memories loaded, 3 filtered out',
  loaded: ['#4420','#4418','#4410','#4402','#4415','#4350'],
  filtered: ['#4401','#3990','#4399'],
  prefs: [['communication_style','conf 0.78','Response formatted as bullet points']],
};

function MemCite({ id }) {
  const { MEMORY } = window.NPM_DATA;
  const ev = MEMORY.find(m=>m.id===id);
  return <Tip label={ev?<span><b style={{color:'var(--text-primary)'}}>{ev.type}</b> · {ev.date}<br/>{ev.sum}</span>:id} w={220}>
    <span style={{ fontFamily:'Geist Mono', fontSize:11, color:'var(--accent-blue)', background:'var(--bg-elevated)',
      border:'1px solid var(--border-subtle)', borderRadius:3, padding:'1px 5px', margin:'0 1px', cursor:'help' }}>{id}</span>
  </Tip>;
}

function renderTokens(tokens, count) {
  // tokens are segments; we flatten to characters for streaming
  let shown = 0; const out = [];
  for (let i=0;i<tokens.length;i++){
    const tk = tokens[i];
    if (tk.cite) { out.push(<MemCite key={'c'+i} id={tk.cite}/>); shown += 6; continue; }
    const str = tk.s;
    if (shown >= count) break;
    const take = Math.min(str.length, count - shown);
    const piece = str.slice(0, take);
    out.push(tk.b ? <b key={i} style={{color:'var(--text-primary)',fontWeight:600}}>{piece}</b>
      : <span key={i} style={{whiteSpace:'pre-wrap'}}>{piece}</span>);
    shown += str.length;
  }
  return out;
}
function totalLen(tokens){ return tokens.reduce((a,t)=>a+(t.cite?6:t.s.length),0); }

function MemoryAutopsy({ data }) {
  const { MEMORY } = window.NPM_DATA;
  const byId = id => MEMORY.find(m=>m.id===id);
  const tierColor = { active:'var(--tier-active)', compressed:'var(--tier-compressed)', archived:'var(--tier-archived)', superseded:'var(--tier-superseded)' };
  const Row = ({ m, filtered }) => (
    <div style={{ display:'flex', gap:12, padding:'4px 0', borderBottom:'1px solid rgba(26,40,64,0.5)',
      opacity: filtered?0.7:1, fontFamily:'Geist Mono', fontSize:11, alignItems:'center' }}>
      <span style={{ color: filtered?'var(--text-muted)':'var(--accent-blue)', width:46, flex:'0 0 auto' }}>{m.id}</span>
      <span style={{ color:'var(--text-muted)', width:96, flex:'0 0 auto', overflow:'hidden', textOverflow:'ellipsis' }}>{m.type}</span>
      {!filtered && <span style={{ color:relColor(m.rel), width:32, flex:'0 0 auto' }}>{m.rel.toFixed(2)}</span>}
      <span style={{ flex:'0 0 auto' }}><span style={{ fontSize:9, fontWeight:600, color:tierColor[m.tier], background:`${tierColor[m.tier]}22`,
        border:`1px solid ${tierColor[m.tier]}55`, borderRadius:3, padding:'1px 5px', textTransform:'uppercase' }}>{m.tier}</span></span>
      {filtered ? <span style={{ color: m.tier==='superseded'?'var(--danger)':'var(--tier-archived)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.reason}</span>
        : <span style={{ color:'var(--text-secondary)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.sum}</span>}
    </div>
  );
  const H = ({ children }) => <div style={{ fontSize:10, fontWeight:500, letterSpacing:'0.12em', color:'var(--text-muted)', margin:'12px 0 6px' }}>{children}</div>;
  return <div style={{ background:'var(--bg-base)', border:'1px solid var(--border-default)', borderRadius:'var(--radius-md)',
    padding:16, marginTop:8, fontFamily:'Geist Mono' }}>
    <div style={{ fontSize:11, color:'var(--text-muted)', borderBottom:'1px solid var(--border-subtle)', paddingBottom:8, marginBottom:4,
      display:'flex', alignItems:'center', gap:8 }}>
      <span style={{ color:'var(--accent-blue)' }}>▸</span>{data.summary}</div>
    <H>LOADED</H>
    {data.loaded.map((id,i)=>{ const m=byId(id); return m&&<div key={id}><Row m={m}/></div>; })}
    <H>FILTERED OUT</H>
    {data.filtered.map((id,i)=>{ const m=byId(id); return m&&<div key={id}><Row m={m} filtered/></div>; })}
    <H>PREFERENCES APPLIED</H>
    {data.prefs.map((p,i)=><div key={i} style={{ display:'flex', gap:8, padding:'3px 0', fontSize:11 }}>
      <span style={{ color:'var(--accent-amber)' }}>{p[0]}</span>
      <span style={{ color:'var(--text-muted)' }}>({p[1]})</span>
      <span style={{ color:'var(--text-secondary)', flex:1 }}>→ {p[2]}</span></div>)}
  </div>;
}

function ChatMessage({ msg, streaming, learning, toast }) {
  const [shown, setShown] = useState(streaming?0:1e9);
  const [autopsy, setAutopsy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [downReason, setDownReason] = useState(false);
  const total = msg.role==='agent'?totalLen(msg.tokens):0;
  useEffect(() => {
    if (msg.role!=='agent' || !streaming) return;
    let c = 0; const iv = setInterval(()=>{ c += 4; setShown(c); if (c>=total){ clearInterval(iv); } }, 16);
    return () => clearInterval(iv);
  }, []);

  if (msg.role==='user') return <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:14 }}>
    <div style={{ background:'var(--accent-blue-dim)', border:'1px solid rgba(255,107,0,0.3)', borderRadius:'12px 12px 2px 12px',
      padding:'10px 14px', maxWidth:'85%', fontSize:13, color:'var(--text-primary)', lineHeight:1.5 }}>{msg.text}</div>
  </div>;

  const done = shown>=total;
  return <div style={{ marginBottom:18 }}>
    <div style={{ fontSize:13, color:'var(--text-secondary)', lineHeight:1.6, maxWidth:'100%' }}>
      {renderTokens(msg.tokens, streaming?shown:1e9)}
      {streaming && !done && <span style={{ display:'inline-block', width:7, height:14, background:'var(--accent-blue)', marginLeft:1, verticalAlign:'text-bottom', animation:'blink 1s steps(1) infinite' }}></span>}
    </div>
    {(!streaming || done) && <>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8 }}>
        <button className="icon-btn" style={{ width:24, height:24, color: feedback==='up'?'var(--success)':'var(--text-muted)' }}
          onClick={()=>{ setFeedback('up'); toast&&toast({kind:'success',text:'Reinforced communication_style preference.',icon:<Icon.brain s={15}/>}); }}><Icon.thumbUp s={14}/></button>
        <button className="icon-btn" style={{ width:24, height:24, color: feedback==='down'?'var(--danger)':'var(--text-muted)' }}
          onClick={()=>{ setFeedback('down'); setDownReason(true); }}><Icon.thumbDown s={14}/></button>
        <div style={{ flex:1 }}></div>
        <button onClick={()=>setAutopsy(a=>!a)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:11.5,
          color: autopsy?'var(--accent-blue)':'var(--text-muted)', display:'flex', alignItems:'center', gap:5, fontFamily:'General Sans' }}>
          <Icon.search2 s={13}/>{autopsy?'Hide':'Explain this answer'}</button>
      </div>
      {downReason && <div style={{ marginTop:8, display:'flex', gap:6 }}>
        <input className="input" style={{ height:30, fontSize:12 }} placeholder="What was wrong with this answer?"
          onKeyDown={e=>{ if(e.key==='Enter'){ setDownReason(false); toast&&toast({kind:'info',text:'Feedback logged to Memory Agent.'}); } }}/>
      </div>}
      {autopsy && <MemoryAutopsy data={msg.autopsy}/>}
    </>}
  </div>;
}

function ChatbotDrawer({ onClose, learning, toast, seedMemory }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [pinned, setPinned] = useState(false);
  const scrollRef = useRef();
  useEffect(()=>{ scrollRef.current && (scrollRef.current.scrollTop = scrollRef.current.scrollHeight); }, [msgs, thinking]);

  const send = (text) => {
    const q = (text||input).trim(); if(!q) return;
    setInput(''); setMsgs(m=>[...m,{ role:'user', text:q }]); setThinking(true);
    setTimeout(() => {
      const a = answerFor(q);
      setThinking(false);
      setMsgs(m=>[...m,{ role:'agent', tokens:a.text, autopsy:a.autopsy, fresh:true }]);
    }, 900);
  };

  return <Drawer width={420} accent="var(--accent-blue)" onClose={onClose} zIndex={140}>
    <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border-subtle)', display:'flex', alignItems:'center',
      justifyContent:'space-between', flex:'0 0 auto' }}>
      <div style={{ display:'flex', alignItems:'center', gap:9 }}>
        <span style={{ color:'var(--accent-blue)' }}><Icon.brain s={18}/></span>
        <span className="type-subheading">Project Memory</span>
      </div>
      <div style={{ display:'flex', gap:2 }}>
        <button className="icon-btn" onClick={()=>setPinned(p=>!p)} style={{ color:pinned?'var(--accent-blue)':'var(--text-muted)' }} title="Pin"><Icon.pin s={15}/></button>
        <button className="icon-btn" onClick={onClose}><Icon.close/></button>
      </div>
    </div>
    <div ref={scrollRef} className="neural-grid" style={{ flex:1, overflowY:'auto', padding:16, background:'var(--bg-base)' }}>
      {msgs.length===0 && <div>
        {seedMemory && <div style={{ background:'var(--bg-elevated)', border:'1px solid var(--accent-blue)', borderRadius:'var(--radius-md)',
          padding:12, marginBottom:16 }}>
          <div className="type-small" style={{ color:'var(--accent-blue)', marginBottom:4 }}>HIGHLIGHTED MEMORY {seedMemory.id}</div>
          <div style={{ fontSize:13, color:'var(--text-secondary)' }}>{seedMemory.sum}</div></div>}
        <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:14, lineHeight:1.5 }}>
          Ask anything about the project's history, decisions, and risks. I'll cite the exact memories I used.</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {SUGGESTED.map((s,i)=><div key={i} onClick={()=>send(s)} className="clickable" style={{ background:'var(--bg-elevated)',
            border:'1px solid var(--border-default)', borderRadius:'var(--radius-md)', padding:'10px 12px', fontSize:12,
            color:'var(--text-secondary)', lineHeight:1.4, transition:'var(--transition-fast)' }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor='var(--accent-blue)'; e.currentTarget.style.color='var(--text-primary)'; }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--border-default)'; e.currentTarget.style.color='var(--text-secondary)'; }}>{s}</div>)}
        </div>
      </div>}
      {msgs.map((m,i)=><ChatMessage key={i} msg={m} streaming={m.fresh&&i===msgs.length-1} learning={learning} toast={toast}/>)}
      {thinking && <div style={{ display:'flex', alignItems:'center', gap:8, color:'var(--text-muted)', fontSize:12.5 }}><AgentDots/> searching memory…</div>}
    </div>
    <div style={{ borderTop:'1px solid var(--border-subtle)', padding:'12px 16px', background:'var(--bg-surface)', flex:'0 0 auto',
      display:'flex', gap:8, alignItems:'center' }}>
      <button className="icon-btn" title="Attach"><Icon.clip s={17}/></button>
      <input className="input" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') send(); }}
        placeholder="Ask project memory…" style={{ flex:1 }}/>
      <button className="btn btn-primary" style={{ width:36, height:36, padding:0, justifyContent:'center', flex:'0 0 auto' }} onClick={()=>send()}><Icon.send s={16}/></button>
    </div>
  </Drawer>;
}

function ChatbotButton({ onClick, open }) {
  if (open) return null;
  return <button onClick={onClick} style={{ position:'fixed', bottom:24, right:24, width:48, height:48, borderRadius:'50%',
    background:'var(--accent-blue)', boxShadow:'var(--accent-blue-glow)', border:'none', cursor:'pointer', zIndex:90,
    display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', transition:'var(--transition-base)' }}
    onMouseEnter={e=>{ e.currentTarget.style.transform='scale(1.05)'; e.currentTarget.style.filter='brightness(1.1)'; }}
    onMouseLeave={e=>{ e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.filter='none'; }}>
    <Icon.brain s={22}/></button>;
}

Object.assign(window, { ChatbotDrawer, ChatbotButton, MemoryAutopsy });
