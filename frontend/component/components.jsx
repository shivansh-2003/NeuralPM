/* ============================================================
   NeuralPM — Shared primitives, icons, helpers
   Exported to window for cross-file use.
   ============================================================ */
const { useState, useEffect, useRef, useMemo, useCallback } = React;

/* ---------- Icons (stroke, 1.6, currentColor) ---------- */
const I = (p) => <svg width={p.s||16} height={p.s||16} viewBox="0 0 24 24" fill="none"
  stroke="currentColor" strokeWidth={p.w||1.7} strokeLinecap="round" strokeLinejoin="round"
  style={p.style} className={p.className}>{p.children}</svg>;

const Icon = {
  search:(p)=><I {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></I>,
  bell:(p)=><I {...p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></I>,
  brain:(p)=><I {...p}><path d="M12 5a3 3 0 0 0-5.6-1.5A2.5 2.5 0 0 0 4 6a2.5 2.5 0 0 0 .5 4.5A2.5 2.5 0 0 0 7 15a3 3 0 0 0 5 2"/><path d="M12 5a3 3 0 0 1 5.6-1.5A2.5 2.5 0 0 1 20 6a2.5 2.5 0 0 1-.5 4.5A2.5 2.5 0 0 1 17 15a3 3 0 0 1-5 2"/><path d="M12 5v12"/></I>,
  close:(p)=><I {...p}><path d="M18 6L6 18M6 6l12 12"/></I>,
  plus:(p)=><I {...p}><path d="M12 5v14M5 12h14"/></I>,
  pin:(p)=><I {...p}><path d="M12 17v5M5 9l4 4 6-1 4-4-9-9-4 4 1 6z" transform="rotate(45 12 9)"/></I>,
  send:(p)=><I {...p}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></I>,
  clip:(p)=><I {...p}><path d="M21 9l-9 9a4 4 0 0 1-6-6l9-9a3 3 0 0 1 4 4l-9 9a1 1 0 0 1-2-2l8.5-8.5"/></I>,
  up:(p)=><I {...p}><path d="M7 14l5-5 5 5"/></I>,
  down:(p)=><I {...p}><path d="M7 10l5 5 5-5"/></I>,
  check:(p)=><I {...p}><path d="M20 6L9 17l-5-5"/></I>,
  eye:(p)=><I {...p}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></I>,
  edit:(p)=><I {...p}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></I>,
  trash:(p)=><I {...p}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></I>,
  search2:(p)=><I {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></I>,
  thumbUp:(p)=><I {...p}><path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1zM7 11l4-8a2 2 0 0 1 2 2v3h5a2 2 0 0 1 2 2.3l-1.4 6A2 2 0 0 1 16.6 20H7"/></I>,
  thumbDown:(p)=><I {...p}><path d="M17 13V4h3a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1zM17 13l-4 8a2 2 0 0 1-2-2v-3H6a2 2 0 0 1-2-2.3l1.4-6A2 2 0 0 1 7.4 4H17"/></I>,
  shield:(p)=><I {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></I>,
  bolt:(p)=><I {...p}><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/></I>,
  warn:(p)=><I {...p}><path d="M10.3 3.3L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></I>,
  refresh:(p)=><I {...p}><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/></I>,
  filter:(p)=><I {...p}><path d="M3 4h18l-7 8v6l-4 2v-8L3 4z"/></I>,
  cmd:(p)=><I {...p}><path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"/></I>,
  cols:(p)=><I {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18"/></I>,
  arrowRight:(p)=><I {...p}><path d="M5 12h14M13 6l6 6-6 6"/></I>,
  gear:(p)=><I {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 2.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H7a1.6 1.6 0 0 0 1-1.5V1a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V7a1.6 1.6 0 0 0 1.5 1H23a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></I>,
  node:(p)=><I {...p}><rect x="3" y="8" width="7" height="8" rx="1.5"/><rect x="14" y="3" width="7" height="6" rx="1.5"/><rect x="14" y="15" width="7" height="6" rx="1.5"/><path d="M10 11h2v-4h2M10 13h2v5h2"/></I>,
  spark:(p)=><I {...p}><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.5 2.5M16.5 16.5L19 19M19 5l-2.5 2.5M7.5 16.5L5 19"/></I>,
};

/* ---------- color helpers ---------- */
const SEV_MAP = {
  Critical:{ bg:'rgba(255,45,45,0.12)', bd:'rgba(255,45,45,0.35)', tx:'#FF6B6B', dot:'#FF2D2D' },
  High:    { bg:'rgba(255,107,107,0.12)', bd:'rgba(255,107,107,0.35)', tx:'#FF8C8C', dot:'#FF6B6B' },
  Medium:  { bg:'rgba(255,255,255,0.08)', bd:'rgba(255,255,255,0.30)', tx:'#FFFFFF', dot:'#FFFFFF' },
  Low:     { bg:'rgba(255,107,0,0.10)', bd:'rgba(255,107,0,0.40)', tx:'#FF8C42', dot:'#FF6B00' },
};
const CAT_HUE = { Frontend:28, Backend:10, API:42, Testing:55, Design:18, Other:35 };

function SeverityBadge({ sev, dot=true }) {
  const c = SEV_MAP[sev];
  return <span className="sev-badge" style={{ background:c.bg, border:`1px solid ${c.bd}`, color:c.tx }}>
    {dot && <span style={{ width:6, height:6, borderRadius:'50%', background:c.dot }}></span>}{sev}
  </span>;
}

function CategoryTag({ cat }) {
  const h = CAT_HUE[cat] ?? 210;
  return <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:'var(--radius-sm)',
    background:`hsl(${h} 50% 50% / 0.12)`, color:`hsl(${h} 70% 70%)`, border:`1px solid hsl(${h} 50% 50% / 0.25)`,
    fontFamily:'General Sans' }}>{cat}</span>;
}

const STATUS_MAP = {
  Backlog:  { bg:'var(--bg-elevated)', tx:'var(--text-muted)' },
  Ongoing:  { bg:'var(--accent-blue-dim)', tx:'var(--accent-blue)' },
  Review:   { bg:'var(--accent-amber-dim)', tx:'var(--accent-amber)' },
  Completed:{ bg:'var(--success-dim)', tx:'var(--success)' },
};
function StatusPill({ status }) {
  const c = STATUS_MAP[status];
  return <span className="status-pill" style={{ background:c.bg, color:c.tx }}>
    <span className={'status-dot'+(status==='Ongoing'?' anim-pulse':'')} style={{ background:c.tx }}></span>{status}
  </span>;
}

function Avatar({ member, size=24, ring }) {
  if (!member) return <span style={{ width:size, height:size, borderRadius:'50%', border:'1.5px dashed var(--text-muted)',
    display:'inline-block', flex:'0 0 auto' }}></span>;
  const initials = member.name.split(' ').map(w=>w[0]).join('').slice(0,2);
  return <span style={{ width:size, height:size, borderRadius:'50%', flex:'0 0 auto',
    background:`linear-gradient(135deg, hsl(${member.hue} 55% 42%), hsl(${member.hue+30} 55% 32%))`,
    color:'#fff', display:'inline-flex', alignItems:'center', justifyContent:'center',
    fontSize:size*0.4, fontWeight:600, fontFamily:'General Sans', letterSpacing:'0.02em',
    boxShadow: ring?`0 0 0 2px var(--bg-surface), 0 0 0 3px ${ring}`:'none' }}>{initials}</span>;
}

function AgentDots() {
  return <span className="agent-dots"><span></span><span></span><span></span></span>;
}

function ProgressBar({ value, h=4, color='var(--accent-blue)', track='var(--border-subtle)' }) {
  return <div style={{ height:h, background:track, borderRadius:h/2, overflow:'hidden', width:'100%' }}>
    <div style={{ height:'100%', width:`${value}%`, background:color, borderRadius:h/2, transition:'width 600ms cubic-bezier(0.16,1,0.3,1)' }}></div>
  </div>;
}

function MiniBar({ value, max=1, h=4, w=64 }) {
  const pct = Math.min(100, (value/max)*100);
  return <span style={{ display:'inline-block', width:w, height:h, background:'var(--bg-elevated)', borderRadius:h/2, verticalAlign:'middle', overflow:'hidden' }}>
    <span style={{ display:'block', height:'100%', width:`${pct}%`, borderRadius:h/2,
      background:`linear-gradient(90deg, var(--accent-blue), ${pct>=60?'var(--success)':'var(--accent-blue)'})` }}></span>
  </span>;
}

/* score color logic */
function scoreColor(v) { return v>=80?'var(--success)':v>=60?'var(--accent-amber)':'var(--text-muted)'; }
function relColor(v) { return v>0.8?'var(--success)':v>=0.5?'var(--accent-amber)':'var(--text-muted)'; }

/* Tooltip — hover wrapper */
function Tip({ label, children, w=240 }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({x:0,y:0});
  const ref = useRef(null);
  const onEnter = () => { const r = ref.current.getBoundingClientRect(); setPos({ x:r.left+r.width/2, y:r.top }); setShow(true); };
  return <span ref={ref} onMouseEnter={onEnter} onMouseLeave={()=>setShow(false)} style={{ display:'inline-flex' }}>
    {children}
    {show && ReactDOM.createPortal(
      <div style={{ position:'fixed', left:pos.x, top:pos.y-8, transform:'translate(-50%,-100%)', zIndex:500,
        background:'var(--bg-elevated)', border:'1px solid var(--border-default)', borderRadius:'var(--radius-sm)',
        padding:'8px 12px', fontSize:12, color:'var(--text-secondary)', maxWidth:w, lineHeight:1.5,
        boxShadow:'0 4px 16px rgba(0,0,0,0.4)', pointerEvents:'none', fontFamily:'General Sans' }}>{label}</div>,
      document.body)}
  </span>;
}

/* Drawer scaffold — entrance keyframe has a capture-safe (visible) from-state */
function Drawer({ width=480, accent, onClose, children, zIndex=120, closing }) {
  useEffect(() => {
    const h = (e) => { if (e.key==='Escape') onClose(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return <div className="drawer" style={{ width, zIndex, animation:'drawer-in var(--transition-slow)' }}>
    {accent && <div className="drawer-accent" style={{ background:accent }}></div>}
    {children}
  </div>;
}

function DrawerHeader({ title, sub, onClose, right }) {
  return <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--border-subtle)', display:'flex',
    alignItems:'flex-start', justifyContent:'space-between', gap:12, flex:'0 0 auto' }}>
    <div style={{ minWidth:0 }}>{title}{sub}</div>
    <div style={{ display:'flex', gap:4, alignItems:'center' }}>{right}
      <button className="icon-btn" onClick={onClose}><Icon.close /></button></div>
  </div>;
}

/* Modal scaffold */
function Modal({ onClose, children, w=480 }) {
  useEffect(() => {
    const h = (e) => { if (e.key==='Escape') onClose(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return <div className="overlay" onClick={onClose} style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
    <div className="modal-box" style={{ maxWidth:w, width:'100%', animation:'modal-in 280ms cubic-bezier(0.16,1,0.3,1)' }} onClick={e=>e.stopPropagation()}>{children}</div>
  </div>;
}

/* Sparkline */
function Sparkline({ data, w=48, h=18, color='var(--accent-blue)' }) {
  const min = Math.min(...data), max = Math.max(...data), rng = max-min||1;
  const pts = data.map((d,i)=>`${(i/(data.length-1))*w},${h-((d-min)/rng)*h}`).join(' ');
  return <svg width={w} height={h} style={{ display:'block' }}>
    <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}

/* Toast system */
function Toast({ toast, onDismiss }) {
  const C = { info:'var(--accent-blue)', warn:'var(--accent-amber)', success:'var(--success)', error:'var(--danger)' };
  const timer = useRef();
  const start = useCallback(() => { timer.current = setTimeout(onDismiss, 4200); }, [onDismiss]);
  useEffect(() => { start(); return () => clearTimeout(timer.current); }, [start]);
  return <div onMouseEnter={()=>clearTimeout(timer.current)} onMouseLeave={start}
    style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-default)',
    borderLeft:`3px solid ${C[toast.kind]||C.info}`, borderRadius:'var(--radius-md)', padding:'12px 16px',
    minWidth:280, maxWidth:360, animation:'toast-in 300ms cubic-bezier(0.16,1,0.3,1)', display:'flex', gap:10, alignItems:'flex-start' }}>
    <span style={{ color:C[toast.kind]||C.info, marginTop:1 }}>{toast.icon || <Icon.bell s={15}/>}</span>
    <div style={{ flex:1 }}>
      {toast.title && <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{toast.title}</div>}
      <div style={{ fontSize:12.5, color:'var(--text-secondary)', lineHeight:1.45 }}>{toast.text}</div>
    </div>
    <button className="icon-btn" style={{ width:20, height:20 }} onClick={onDismiss}><Icon.close s={13}/></button>
  </div>;
}

function relDue(days) {
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, color:'var(--danger)' };
  if (days === 0) return { label:'Today', color:'var(--danger)' };
  if (days <= 3) return { label:`${days}d left`, color:'var(--warning)' };
  return { label:`${days}d`, color:'var(--text-secondary)' };
}

Object.assign(window, {
  Icon, SeverityBadge, CategoryTag, StatusPill, Avatar, AgentDots, ProgressBar, MiniBar,
  scoreColor, relColor, Tip, Drawer, DrawerHeader, Modal, Sparkline, Toast, relDue,
  SEV_MAP, CAT_HUE, STATUS_MAP,
  useState, useEffect, useRef, useMemo, useCallback,
});
