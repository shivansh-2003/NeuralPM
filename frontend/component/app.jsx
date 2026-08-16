/* ============================================================
   NeuralPM — App root (state, routing, overlay orchestration)
   ============================================================ */

function App() {
  const D = window.NPM_DATA;
  const [page, setPage] = useState('tasks');
  const [learning, setLearning] = useState(false);
  const [governance, setGovernance] = useState('suggest');

  // live backend state — tasks/members come from the FastAPI domain API (see scripts/api.js).
  // Everything else on this page (risks, memory, preferences, insights) is still D's mock data —
  // those agents don't have real endpoints yet.
  const [projectId, setProjectId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const project = await NPM_API.ensureProject('Demo Project');
        setProjectId(project.id);
        const [ts, ms] = await Promise.all([NPM_API.listTasks(project.id), NPM_API.listMembers(project.id)]);
        setTasks(ts); setMembers(ms);
      } catch (e) {
        console.error(e);
        setLoadError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // overlays
  const [search, setSearch] = useState(false);
  const [bell, setBell] = useState(false);
  const [notifs, setNotifs] = useState(D.NOTIFICATIONS);
  const [chatbot, setChatbot] = useState(false);
  const [chatSeed, setChatSeed] = useState(null);
  const [assignTask, setAssignTask] = useState(null);
  const [detailTask, setDetailTask] = useState(null);
  const [profileMember, setProfileMember] = useState(null);
  const [newTask, setNewTask] = useState(false);
  const [hoverMember, setHoverMember] = useState(null);
  const [hoverPos, setHoverPos] = useState({x:0,y:0});

  // filters
  const [filters, setFilters] = useState({ q:'', status:[], sev:[], cat:[], assignee:[] });
  // toasts
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((t) => { const id = Math.random(); setToasts(ts=>[...ts,{...t,id}]); }, []);
  const dismissToast = id => setToasts(ts=>ts.filter(t=>t.id!==id));

  const unread = notifs.filter(n=>n.unread).length;

  // keyboard
  useEffect(() => {
    const h = (e) => { if ((e.metaKey||e.ctrlKey)&&e.key==='k'){ e.preventDefault(); setSearch(s=>!s); } };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);

  const filtered = useMemo(() => {
    return tasks.filter(t=>{
      if (filters.q && !t.title.toLowerCase().includes(filters.q.toLowerCase()) && !t.id.toLowerCase().includes(filters.q.toLowerCase())) return false;
      if (filters.status.length && !filters.status.includes(t.status)) return false;
      if (filters.sev.length && !filters.sev.includes(t.sev)) return false;
      if (filters.cat.length && !filters.cat.includes(t.cat)) return false;
      if (filters.assignee.length && !filters.assignee.includes(t.who)) return false;
      return true;
    });
  }, [tasks, filters]);

  const onStatusChange = (task, status) => {
    setTasks(ts=>ts.map(t=>t.id===task.id?{...t,status,prog:status==='Completed'?100:t.prog}:t)); // optimistic
    NPM_API.updateTaskStatus(task.id, status)
      .then(updated=>setTasks(ts=>ts.map(t=>t.id===task.id?updated:t)))
      .catch(e=>toast({kind:'error',text:`Failed to update ${task.id}: ${e.message}`}));
    if (status==='Completed') toast({kind:'success',text:`${task.id} completed — Risk & Cascade agents re-evaluating.`});
  };
  const onAssign = (task, member, pattern) => {
    setTasks(ts=>ts.map(t=>t.id===task.id?{...t,who:member.id}:t)); // optimistic
    NPM_API.assignTask(task.id, member.id)
      .then(updated=>setTasks(ts=>ts.map(t=>t.id===task.id?updated:t)))
      .catch(e=>toast({kind:'error',text:`Failed to assign ${task.id}: ${e.message}`}));
    toast({kind:'info',text:`${task.id} assigned to ${member.name}.`,icon:<Icon.spark s={15}/>});
    if (pattern) toast({kind:'warn',text:`New pattern learned (conf 0.70).`,icon:<Icon.brain s={15}/>});
    setTimeout(()=>toast({kind:'warn',text:`Risk Agent: check ${member.name}'s load (${member.load}%).`,icon:<Icon.warn s={15}/>}), 1400);
  };
  const onCreateTask = (f) => {
    if (!projectId) { toast({kind:'error',text:'Backend not connected yet.'}); return; }
    NPM_API.createTask(projectId, f).then(nt => {
      setTasks(ts=>[nt,...ts]); setNewTask(false);
      toast({kind:'info',text:`${nt.id} created. Finding best match…`,icon:<Icon.spark s={15}/>});
      setTimeout(()=>setAssignTask(nt), 300);
    }).catch(e=>toast({kind:'error',text:`Failed to create task: ${e.message}`}));
  };

  const openTaskById = (idOrTask) => { const t = typeof idOrTask==='string'?tasks.find(x=>x.id===idOrTask):idOrTask; if(t) setDetailTask(t); };
  const openMemberByName = (m) => { const mm = typeof m==='string'?members.find(x=>x.name===m):m; if(mm) setProfileMember(mm); };
  const openChatbotSeed = (mem) => { setChatSeed(mem); setChatbot(true); };

  const anyOverlay = search||bell||chatbot||assignTask||detailTask||profileMember||newTask;

  return <div style={{ height:'100vh', display:'flex', flexDirection:'column' }}>
    <TopNav page={page} setPage={setPage} learning={learning} setLearning={setLearning}
      unread={unread} onBell={()=>{ setBell(true); setNotifs(ns=>ns.map(n=>({...n,unread:false}))); }} onSearch={()=>setSearch(true)}/>

    {/* PAGES */}
    {page==='tasks' && <div className="neural-grid" style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--bg-base)' }}>
      {loadError && <div style={{ padding:'8px 24px', background:'var(--danger)', color:'#fff', fontSize:12.5, flex:'0 0 auto' }}>
        Backend unreachable — {loadError}. Is `uvicorn main:app --port 8000` running?</div>}
      <FilterBar filters={filters} setFilters={setFilters} members={members} onNewTask={()=>projectId&&setNewTask(true)}/>
      <TaskTable tasks={loading?[]:filtered} members={members} onFindMatch={setAssignTask} onOpenTask={setDetailTask}
        onStatusChange={onStatusChange} onHoverMember={(m,e)=>{ if(m&&e){ const r=e.currentTarget.getBoundingClientRect(); setHoverPos({x:r.left,y:r.bottom}); setHoverMember(m); } else setHoverMember(null); }}/>
    </div>}
    {page==='members' && <MembersPage members={members} openMember={setProfileMember}/>}
    {page==='insights' && <InsightsWarRoom members={members} learning={learning} toast={toast} openTask={openTaskById} openMember={openMemberByName}/>}
    {page==='requirements' && <RequirementsPage toast={toast}/>}
    {page==='settings' && <SettingsPage learning={learning} setLearning={setLearning} governance={governance} setGovernance={setGovernance} toast={toast}/>}
    {page==='memory' && <ChatPage learning={learning} toast={toast}/>}

    {/* FLOATING + OVERLAYS */}
    {/* hide FAB on memory page */}
    <ChatbotButton onClick={()=>{ setChatSeed(null); setChatbot(true); }} open={chatbot || page==='memory'}/>
    {hoverMember && <LoadTooltip member={hoverMember} pos={hoverPos}/>}

    {(assignTask||detailTask||profileMember) && <div className="overlay" onClick={()=>{ setAssignTask(null); setDetailTask(null); setProfileMember(null); }}></div>}
    {assignTask && <AssignmentDrawer task={assignTask} members={members} learning={learning} prefOn={true}
      onClose={()=>setAssignTask(null)} onAssign={onAssign} toast={toast}/>}
    {detailTask && <TaskDetailDrawer task={detailTask} members={members} onClose={()=>setDetailTask(null)}
      onFindMatch={(t)=>{ setDetailTask(null); setAssignTask(t); }} onStatusChange={onStatusChange}/>}
    {profileMember && <MemberProfileDrawer member={profileMember} onClose={()=>setProfileMember(null)}/>}

    {chatbot && <ChatbotDrawer onClose={()=>setChatbot(false)} learning={learning} toast={toast} seedMemory={chatSeed}/>}
    {newTask && <NewTaskModal onClose={()=>setNewTask(false)} onCreate={onCreateTask} tasks={tasks}/>}
    {search && <CommandPalette onClose={()=>setSearch(false)} setPage={setPage}
      openMember={setProfileMember} openTask={setDetailTask} openChatbot={openChatbotSeed}/>}
    {bell && <><div className="overlay" onClick={()=>setBell(false)}></div>
      <NotificationsDrawer onClose={()=>setBell(false)} notifs={notifs} setNotifs={setNotifs}
        onAction={(n)=>{ setBell(false); if(n.agent==='Risk'||n.agent==='Cascade'||n.agent==='Memory') setPage('insights'); else setPage('tasks'); }}/></>}

    {/* toasts */}
    <div style={{ position:'fixed', bottom:24, right:chatbot?444:88, zIndex:200, display:'flex', flexDirection:'column', gap:10, alignItems:'flex-end' }}>
      {toasts.map(t=><Toast key={t.id} toast={t} onDismiss={()=>dismissToast(t.id)}/>)}
    </div>
  </div>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
