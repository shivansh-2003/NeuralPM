/* ============================================================
   NeuralPM — Full-screen Premium Memory AI Chatbot Page
   Two-column: conversation + live memory context panel
   ============================================================ */

const CHAT_SUGGESTIONS = [
  { icon:'⚠', text:'What are the biggest risks this sprint?' },
  { icon:'🔍', text:'Why was the Payment API delayed?' },
  { icon:'✦', text:'Who should own the unassigned tasks?' },
  { icon:'📋', text:'Summarise all scope changes this week.' },
  { icon:'🧠', text:'What patterns have you learned about me?' },
  { icon:'⛓', text:'Show me the full blocker chain on payments.' },
];

/* canned answers */
function chatAnswer(q) {
  const t = q.toLowerCase();
  if (t.includes('risk') || t.includes('biggest')) return ANSWERS.risks;
  if (t.includes('payment') || t.includes('delay')) return ANSWERS.payment;
  if (t.includes('pattern') || t.includes('learned')) return ANSWERS.patterns;
  if (t.includes('who') || t.includes('unassigned') || t.includes('own')) return ANSWERS.assignment;
  if (t.includes('blocker') || t.includes('chain')) return ANSWERS.blockers;
  return ANSWERS.scope;
}

const ANSWERS = {
  risks: {
    tokens: [
      {s:'Three risks dominate this sprint:\n'},{s:'1. ',},{s:'Sarah Chen overload',b:1},{s:' — 91% capacity, 6 active tasks '},{cite:'#4418'},
      {s:'\n2. '},{s:'pgvector migration',b:1},{s:' (TK-047) due today, 25% complete '},{cite:'#4421'},
      {s:'\n3. '},{s:'Blocker chain',b:1},{s:' on the payment path — no parallel slack '},{cite:'#4418'},
      {s:'\n\nThe overload alert on Marcus Webb was suppressed — you consistently dismiss those below 70%.'},{cite:'#4388'},
    ],
    mem: ['#4421','#4418','#4388','#4410','#4420'],
    filtered: ['#4401','#3990'],
    prefs: ['risk_tolerance','communication_style'],
  },
  payment: {
    tokens: [
      {s:'Payment API (TK-042) slipped '},{s:'+3 days',b:1},{s:'. Causal chain:\n'},
      {s:'1. Scope change'},{cite:'#4410'},{s:' — 10x launch traffic requirement added\n'},
      {s:'2. Task re-assigned to Sarah'},{cite:'#4402'},{s:' per your backend routing preference\n'},
      {s:'3. Sarah hit 91% load → overload risk raised'},{cite:'#4418'},{s:'\n'},
      {s:'4. Delivery date recomputed by the Cascade Agent'},{cite:'#4421'},
    ],
    mem: ['#4421','#4410','#4402','#4418','#4415'],
    filtered: ['#4401','#4399'],
    prefs: ['assignment_override','communication_style'],
  },
  patterns: {
    tokens: [
      {s:'I\'ve learned '},{s:'6 patterns',b:1},{s:' from your behaviour:\n'},
      {s:'• Backend tasks → Sarah Chen'},{s:' (conf 0.74, 12 observations)\n'},{cite:'#4402'},
      {s:'• Suppress overload risks below 70% (conf 0.67)\n'},{cite:'#4388'},
      {s:'• Protect release date over scope (conf 0.61)\n'},
      {s:'• Daily digest, not real-time alerts (conf 0.43)\n'},
      {s:'\nPatterns above 0.60 actively re-rank my output. Two are still forming confidence.'},
    ],
    mem: ['#4402','#4388','#4410','#4420'],
    filtered: ['#3990','#4205'],
    prefs: ['risk_tolerance','assignment_override','timeline_philosophy'],
  },
  assignment: {
    tokens: [
      {s:'Two tasks are unassigned:\n'},
      {s:'• '},{s:'TK-044',b:1},{s:' (E2E tests) → '},{s:'Ava Thompson',b:1},{s:' — Playwright Expert, 47% load\n'},
      {s:'• '},{s:'TK-048',b:1},{s:' (blocker detection) → '},{s:'Diego Alvarez',b:1},{s:' — graph/platform, 52% load\n'},
      {s:'\nBoth have headroom unlike Sarah (91%) and Lena (88%). Shall I assign?'},
    ],
    mem: ['#4420','#4418','#4402'],
    filtered: ['#4401'],
    prefs: ['assignment_override'],
  },
  blockers: {
    tokens: [
      {s:'The payment path has a '},{s:'3-task blocker chain',b:1},{s:':\n'},
      {s:'TK-042 (Payment API) ← blocks → TK-043 (Checkout) ← blocks → TK-044 (E2E Tests)\n\n'},
      {s:'No parallel slack exists. If '},{s:'either TK-042 or TK-043 slips',b:1},{s:', the demo milestone (Jul 20) is at risk.'},{cite:'#4421'},
      {s:'\n\nSuggested: parallelise E2E tests against staging now — saves 4 days if checkout finishes late.'},
    ],
    mem: ['#4421','#4418','#4410'],
    filtered: ['#3990','#4401'],
    prefs: ['timeline_philosophy'],
  },
  scope: {
    tokens: [
      {s:'Three scope changes this week:\n'},
      {s:'• '},{s:'RQ-018',b:1},{s:' — payment must survive 10x traffic '},{cite:'#4410'},{s:'\n'},
      {s:'• '},{s:'RQ-017',b:1},{s:' — saved-card selection added to checkout\n'},
      {s:'• '},{s:'RQ-016',b:1},{s:' — pgvector migration flagged as blocker\n'},
      {s:'\nRQ-018 is highest-impact: it directly caused the Payment API +3d slip.'},
    ],
    mem: ['#4410','#4421','#4402','#4418'],
    filtered: ['#4399','#3990'],
    prefs: ['communication_style'],
  },
};

function totalLen(tokens){ return tokens.reduce((a,t)=>a+(t.cite?6:t.s.length),0); }

const TIER_C = { active:'#FF6B00', compressed:'#A3A3A3', archived:'#4A607A', superseded:'#FF2D2D' };
const TIER_ABBR = { active:'ACT', compressed:'CMPR', archived:'ARCH', superseded:'SUPR' };

function MemoryContextPanel({ activeMemIds, filteredMemIds, prefIds, tokenUsed, tokenTotal }) {
  const { MEMORY, PREFERENCES } = window.NPM_DATA;
  const loadedMems = activeMemIds.map(id => MEMORY.find(m=>m.id===id)).filter(Boolean);
  const filteredMems = filteredMemIds.map(id => MEMORY.find(m=>m.id===id)).filter(Boolean);
  const prefs = prefIds.map(id => PREFERENCES.find(p=>p.type===id)).filter(Boolean);
  const pct = tokenTotal ? Math.round((tokenUsed/tokenTotal)*100) : 0;

  return <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'var(--bg-base)', borderLeft:'1px solid var(--border-subtle)' }}>
    {/* token gauge */}
    <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border-subtle)', flex:'0 0 auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
        <span style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', color:'var(--text-muted)' }}>CONTEXT WINDOW</span>
        <span style={{ fontFamily:'Geist Mono', fontSize:11, color:pct>80?'var(--danger)':'var(--accent-blue)' }}>{tokenUsed.toLocaleString()} / {tokenTotal.toLocaleString()}</span>
      </div>
      <div style={{ height:4, background:'var(--bg-elevated)', borderRadius:2, overflow:'hidden' }}>
        <div style={{ height:'100%', width:pct+'%', borderRadius:2, transition:'width 600ms ease',
          background:`linear-gradient(90deg, var(--accent-blue), ${pct>80?'var(--danger)':'#FF6B00'})` }}></div>
      </div>
      <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:6 }}>{pct}% used · {tokenTotal-tokenUsed} tokens remaining</div>
    </div>

    {/* loaded memories */}
    <div style={{ flex:1, overflowY:'auto', padding:'14px 0' }}>
      {loadedMems.length > 0 && <>
        <div style={{ fontSize:10, fontWeight:600, letterSpacing:'0.12em', color:'var(--text-muted)', padding:'0 20px 8px' }}>LOADED INTO CONTEXT</div>
        {loadedMems.map((m,i) => <MemoryTile key={m.id} m={m} i={i} visible/>)}
      </>}
      {filteredMems.length > 0 && <>
        <div style={{ fontSize:10, fontWeight:600, letterSpacing:'0.12em', color:'var(--text-muted)', padding:'14px 20px 8px' }}>FILTERED OUT</div>
        {filteredMems.map((m,i) => <MemoryTile key={m.id} m={m} i={i} filtered/>)}
      </>}
      {prefs.length > 0 && <>
        <div style={{ fontSize:10, fontWeight:600, letterSpacing:'0.12em', color:'var(--text-muted)', padding:'14px 20px 8px' }}>PREFERENCES APPLIED</div>
        {prefs.map((p,i) => <PrefTile key={p.id} p={p} i={i}/>)}
      </>}
      {loadedMems.length === 0 && <div style={{ padding:'32px 20px', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
        Ask anything — I'll show you exactly which memories I use.
      </div>}
    </div>
  </div>;
}

function MemoryTile({ m, i, visible, filtered }) {
  const tc = TIER_C[m.tier] || 'var(--text-muted)';
  return <div style={{ padding:'10px 20px', borderBottom:'1px solid rgba(26,40,64,0.4)',
    opacity: filtered?0.55:1, animation:`fade-in 250ms ease ${i*40}ms both` }}>
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
      <span style={{ fontFamily:'Geist Mono', fontSize:11, color:filtered?'var(--text-muted)':'var(--accent-blue)', flex:'0 0 auto' }}>{m.id}</span>
      <span style={{ fontSize:9, fontWeight:700, color:tc, background:tc+'22', border:`1px solid ${tc}44`, borderRadius:3, padding:'1px 5px', letterSpacing:'0.06em' }}>{TIER_ABBR[m.tier]||m.tier}</span>
      {!filtered && <span style={{ fontFamily:'Geist Mono', fontSize:10, color:relColor(m.rel), marginLeft:'auto' }}>{m.rel.toFixed(2)}</span>}
    </div>
    <div style={{ fontSize:12, color:filtered?'var(--text-muted)':'var(--text-secondary)', lineHeight:1.4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
      {filtered && m.reason ? m.reason : m.sum}</div>
  </div>;
}

function PrefTile({ p, i }) {
  return <div style={{ padding:'10px 20px', borderBottom:'1px solid rgba(26,40,64,0.4)', animation:`fade-in 250ms ease ${i*40}ms both` }}>
    <div style={{ fontFamily:'Geist Mono', fontSize:11, color:'var(--accent-amber)', marginBottom:3 }}>{p.type}</div>
    <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.4 }}>{p.value}</div>
    <div style={{ display:'flex', gap:8, marginTop:5 }}>
      <MiniBar value={p.conf} w={48}/><span style={{ fontFamily:'Geist Mono', fontSize:10, color:'var(--text-muted)' }}>{p.conf.toFixed(2)}</span>
    </div>
  </div>;
}

/* ---------- Message ---------- */
function PremiumMessage({ msg, streaming, toast, onAutopsyToggle, autopsyOpen }) {
  const [shown, setShown] = useState(streaming ? 0 : 1e9);
  const [feedback, setFeedback] = useState(null);
  const total = msg.role==='agent' ? totalLen(msg.tokens) : 0;
  useEffect(() => {
    if (msg.role!=='agent' || !streaming) return;
    let c = 0; const iv = setInterval(() => { c += 3; setShown(c); if (c >= total) clearInterval(iv); }, 14);
    return () => clearInterval(iv);
  }, []);
  const done = shown >= total;

  if (msg.role === 'user') return (
    <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:28, padding:'0 40px 0 80px' }}>
      <div style={{ background:'linear-gradient(135deg, var(--accent-blue), #CC5500)', borderRadius:'18px 18px 4px 18px',
        padding:'14px 20px', maxWidth:'80%', fontSize:14.5, color:'#fff', lineHeight:1.6, boxShadow:'var(--accent-blue-glow)' }}>{msg.text}</div>
    </div>
  );

  /* render agent tokens */
  let shownCount = 0;
  const rendered = msg.tokens.map((tk, i) => {
    if (tk.cite) { shownCount += 6; return <MemCiteInline key={'c'+i} id={tk.cite}/>; }
    const str = tk.s; if (shownCount >= shown && streaming) return null;
    const take = Math.min(str.length, Math.max(0, shown - shownCount));
    shownCount += str.length;
    const piece = streaming ? str.slice(0, take) : str;
    if (!piece) return null;
    return tk.b ? <strong key={i} style={{ color:'var(--text-primary)', fontWeight:600 }}>{piece}</strong>
      : <span key={i} style={{ whiteSpace:'pre-wrap' }}>{piece}</span>;
  });

  return <div style={{ padding:'0 40px 0 40px', marginBottom:32 }}>
    <div style={{ display:'flex', gap:14, alignItems:'flex-start' }}>
      <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg, var(--accent-blue), #CC5500)',
        display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', flex:'0 0 auto',
        boxShadow:'var(--accent-blue-glow)' }}><Icon.brain s={18}/></div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:11, fontWeight:600, color:'var(--accent-blue)', letterSpacing:'0.1em', marginBottom:8 }}>MEMORY AI</div>
        <div style={{ fontSize:15, color:'var(--text-secondary)', lineHeight:1.7 }}>
          {rendered}
          {streaming && !done && <span style={{ display:'inline-block', width:8, height:16, background:'var(--accent-blue)', marginLeft:2, verticalAlign:'text-bottom', animation:'blink 1s steps(1) infinite', borderRadius:1 }}></span>}
        </div>
        {(!streaming || done) && <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:14 }}>
          <button className="icon-btn" style={{ color:feedback==='up'?'var(--success)':'var(--text-muted)' }} onClick={()=>{ setFeedback('up'); toast&&toast({kind:'success',text:'Reinforced.'}); }}><Icon.thumbUp s={15}/></button>
          <button className="icon-btn" style={{ color:feedback==='down'?'var(--danger)':'var(--text-muted)' }} onClick={()=>setFeedback('down')}><Icon.thumbDown s={15}/></button>
          <div style={{ flex:1 }}></div>
          <button onClick={onAutopsyToggle} style={{ background:'none', border:'none', cursor:'pointer', fontSize:12, color:autopsyOpen?'var(--accent-blue)':'var(--text-muted)', display:'flex', alignItems:'center', gap:5, fontFamily:'General Sans' }}>
            <Icon.search2 s={13}/>{autopsyOpen?'Hide sources':'Show sources'}</button>
        </div>}
      </div>
    </div>
  </div>;
}

function MemCiteInline({ id }) {
  const { MEMORY } = window.NPM_DATA;
  const ev = MEMORY.find(m=>m.id===id);
  return <Tip label={ev?<span><b style={{color:'var(--text-primary)'}}>{ev.type}</b><br/>{ev.sum}</span>:id} w={240}>
    <span style={{ fontFamily:'Geist Mono', fontSize:11, color:'var(--accent-blue)', background:'rgba(255,107,0,0.1)',
      border:'1px solid rgba(255,107,0,0.3)', borderRadius:4, padding:'1px 6px', margin:'0 2px', cursor:'help' }}>{id}</span>
  </Tip>;
}

/* ---------- Main ChatPage ---------- */
function ChatPage({ learning, toast }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [context, setContext] = useState({ mems:[], filtered:[], prefs:[], used:0, total:8192 });
  const [autopsyIdx, setAutopsyIdx] = useState(null);
  const scrollRef = useRef();
  const inputRef = useRef();

  useEffect(() => { if(scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [msgs, thinking]);

  const send = (text) => {
    const q = (text || input).trim(); if(!q) return;
    setInput(''); setMsgs(m=>[...m,{ role:'user', text:q }]); setThinking(true);
    setTimeout(() => {
      const a = chatAnswer(q);
      setThinking(false);
      setMsgs(m=>[...m,{ role:'agent', tokens:a.tokens, answer:a, fresh:true }]);
      setContext({ mems:a.mem||[], filtered:a.filtered||[], prefs:a.prefs||[], used:2400+Math.round(Math.random()*800), total:8192 });
      setAutopsyIdx(null);
    }, 950);
  };

  return <div style={{ flex:1, display:'flex', overflow:'hidden', height:'100%' }}>
    {/* left: conversation */}
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--bg-base)' }}>
      {/* header */}
      <div style={{ padding:'18px 40px', borderBottom:'1px solid var(--border-subtle)', flex:'0 0 auto',
        background:'linear-gradient(180deg, var(--bg-surface) 0%, transparent 100%)', backdropFilter:'blur(8px)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:40, height:40, borderRadius:12, background:'linear-gradient(135deg, var(--accent-blue), #CC5500)',
            display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', boxShadow:'var(--accent-blue-glow)' }}>
            <Icon.brain s={22}/></div>
          <div>
            <div style={{ fontFamily:'Space Grotesk', fontWeight:700, fontSize:18, color:'var(--text-primary)' }}>Memory AI</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--success)', display:'inline-block' }} className="anim-pulse"></span>
              Project memory active · {window.NPM_DATA.MEMORY.filter(m=>m.tier==='active').length} memories loaded
            </div>
          </div>
          {learning && <span style={{ marginLeft:'auto', fontSize:11, fontWeight:600, color:'var(--accent-amber)', background:'var(--accent-amber-dim)', border:'1px solid var(--accent-amber)', borderRadius:'var(--radius-pill)', padding:'3px 10px', display:'flex', alignItems:'center', gap:5 }}>
            <span className="anim-pulse" style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent-amber)', display:'inline-block' }}></span>Learning ON</span>}
        </div>
      </div>

      {/* messages */}
      <div ref={scrollRef} style={{ flex:1, overflowY:'auto', paddingTop:32, paddingBottom:8 }}>
        {msgs.length === 0 && <EmptyChatState onSuggest={send}/>}
        {msgs.map((m,i) => {
          const isLast = i === msgs.length-1;
          return <React.Fragment key={i}>
            <PremiumMessage msg={m} streaming={m.fresh && isLast} toast={toast}
              onAutopsyToggle={()=>setAutopsyIdx(autopsyIdx===i?null:i)} autopsyOpen={autopsyIdx===i}/>
            {autopsyIdx===i && m.answer && <AutopsyInline answer={m.answer}/>}
          </React.Fragment>;
        })}
        {thinking && <ThinkingIndicator/>}
      </div>

      {/* input */}
      <div style={{ padding:'20px 40px 28px', flex:'0 0 auto', background:'linear-gradient(0deg, var(--bg-base) 0%, transparent 100%)' }}>
        <div style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-default)', borderRadius:16,
          padding:'4px 6px 4px 18px', display:'flex', alignItems:'center', gap:10,
          boxShadow:'0 0 0 1px transparent', transition:'var(--transition-fast)' }}
          onFocusCapture={e=>e.currentTarget.style.boxShadow='0 0 0 2px var(--accent-blue), var(--accent-blue-glow)'}
          onBlurCapture={e=>e.currentTarget.style.boxShadow='0 0 0 1px transparent'}>
          <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); send(); } }}
            placeholder="Ask project memory…" style={{ flex:1, background:'none', border:'none', outline:'none',
              color:'var(--text-primary)', fontSize:15, fontFamily:'General Sans', padding:'10px 0', lineHeight:1.4 }}/>
          <button className="icon-btn" style={{ color:'var(--text-muted)' }} title="Attach"><Icon.clip s={18}/></button>
          <button onClick={()=>send()} disabled={!input.trim()&&!thinking}
            style={{ width:42, height:42, borderRadius:10, background:input.trim()?'var(--accent-blue)':'var(--bg-hover)',
              border:'none', cursor:input.trim()?'pointer':'default', display:'flex', alignItems:'center', justifyContent:'center',
              color:input.trim()?'#fff':'var(--text-muted)', transition:'var(--transition-fast)',
              boxShadow:input.trim()?'var(--accent-blue-glow)':'none' }}>
            <Icon.send s={17}/></button>
        </div>
        <div style={{ fontSize:12, color:'var(--text-muted)', textAlign:'center', marginTop:10 }}>
          Memory AI cites every source · override detection {'→'} learning</div>
      </div>
    </div>

    {/* right: memory context panel */}
    <div style={{ width:320, flex:'0 0 auto' }}>
      <MemoryContextPanel activeMemIds={context.mems} filteredMemIds={context.filtered}
        prefIds={context.prefs} tokenUsed={context.used} tokenTotal={context.total}/>
    </div>
  </div>;
}

function EmptyChatState({ onSuggest }) {
  return <div style={{ padding:'0 40px 40px', maxWidth:680, margin:'0 auto' }}>
    <div style={{ textAlign:'center', marginBottom:40 }}>
      <div style={{ width:80, height:80, borderRadius:24, background:'linear-gradient(135deg, var(--accent-blue), #CC5500)',
        display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', margin:'0 auto 20px',
        boxShadow:'var(--accent-blue-glow)' }}><Icon.brain s={40}/></div>
      <div style={{ fontFamily:'Space Grotesk', fontWeight:700, fontSize:24, color:'var(--text-primary)', marginBottom:8 }}>Project Memory</div>
      <div style={{ fontSize:14.5, color:'var(--text-secondary)', lineHeight:1.6, maxWidth:480, margin:'0 auto' }}>
        Ask anything about the project — decisions, risks, why something changed, who's best for a task. I'll cite the exact memories behind every answer.</div>
    </div>
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
      {CHAT_SUGGESTIONS.map((s,i)=><div key={i} onClick={()=>onSuggest(s.text)} className="clickable" style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'14px 16px', transition:'var(--transition-base)' }}
        onMouseEnter={e=>{ e.currentTarget.style.borderColor='var(--accent-blue)'; e.currentTarget.style.background='var(--bg-hover)'; }}
        onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--border-subtle)'; e.currentTarget.style.background='var(--bg-elevated)'; }}>
        <div style={{ fontSize:18, marginBottom:6 }}>{s.icon}</div>
        <div style={{ fontSize:13, color:'var(--text-secondary)', lineHeight:1.4 }}>{s.text}</div>
      </div>)}
    </div>
  </div>;
}

function ThinkingIndicator() {
  return <div style={{ padding:'0 40px 20px', display:'flex', gap:14, alignItems:'flex-start' }}>
    <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg, var(--accent-blue), #CC5500)',
      display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', flex:'0 0 auto', opacity:0.7 }}><Icon.brain s={18}/></div>
    <div style={{ paddingTop:8 }}>
      <div style={{ fontSize:11, fontWeight:600, color:'var(--accent-blue)', letterSpacing:'0.1em', marginBottom:10 }}>MEMORY AI</div>
      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
        <span style={{ fontSize:12, color:'var(--text-muted)' }}>Searching memory</span>
        <AgentDots/>
      </div>
    </div>
  </div>;
}

function AutopsyInline({ answer }) {
  const { MEMORY } = window.NPM_DATA;
  const byId = id => MEMORY.find(m=>m.id===id);
  const tc = { active:'#FF6B00', compressed:'#A3A3A3', archived:'#4A607A', superseded:'#FF2D2D' };
  return <div style={{ margin:'0 40px 28px 90px', background:'var(--bg-base)', border:'1px solid var(--border-default)', borderRadius:'var(--radius-md)', padding:18, fontFamily:'Geist Mono', fontSize:11 }}>
    <div style={{ color:'var(--accent-blue)', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>▸ {answer.mem.length} loaded · {answer.filtered.length} filtered · {answer.prefs.length} prefs applied</div>
    {answer.mem.map(id=>{ const m=byId(id); if(!m) return null; return <div key={id} style={{ display:'flex', gap:10, padding:'3px 0', borderBottom:'1px solid rgba(26,40,64,0.5)' }}>
      <span style={{ color:'#FF6B00', width:44 }}>{id}</span>
      <span style={{ color:'var(--text-muted)', width:80, overflow:'hidden', textOverflow:'ellipsis' }}>{m.type}</span>
      <span style={{ color:relColor(m.rel), width:30 }}>{m.rel.toFixed(2)}</span>
      <span style={{ color:tc[m.tier]||'var(--text-muted)', width:40 }}>{TIER_ABBR[m.tier]||m.tier}</span>
      <span style={{ color:'var(--text-secondary)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.sum}</span>
    </div>; })}
    {answer.filtered.map(id=>{ const m=byId(id); if(!m) return null; return <div key={id} style={{ display:'flex', gap:10, padding:'3px 0', opacity:0.5 }}>
      <span style={{ color:'var(--text-muted)', width:44 }}>{id}</span>
      <span style={{ color:'var(--text-muted)', width:80 }}>{m.type}</span>
      <span style={{ color:'var(--danger)', flex:1 }}>{m.reason||'Filtered'}</span>
    </div>; })}
  </div>;
}

Object.assign(window, { ChatPage, MemoryContextPanel });
