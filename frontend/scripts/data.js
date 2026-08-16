/* ============================================================
   NeuralPM — Mock data layer
   Believable seed data: members, tasks, risks, memory, prefs.
   Exposed on window.NPM_DATA
   ============================================================ */
(function () {
  const MEMBERS = [
    { id: 'm1', name: 'Sarah Chen', role: 'Senior Backend Engineer', load: 91, active: 6, velocity: 34, avail: 'Busy',
      hue:25, join: 'Mar 2022', sprints: [28, 31, 34, 30, 33, 34],
      skills: [['Node.js','Expert',false],['PostgreSQL','Expert',false],['Python','Intermediate',false],['Redis','Expert',true],['GraphQL','Intermediate',false],['Kafka','Beginner',false]] },
    { id: 'm2', name: 'Marcus Webb', role: 'Frontend Lead', load: 64, active: 4, velocity: 29, avail: 'Available',
      hue:8, join: 'Jan 2021', sprints: [25, 27, 24, 28, 30, 29],
      skills: [['React','Expert',false],['TypeScript','Expert',false],['CSS/Animation','Expert',true],['Next.js','Intermediate',false],['Testing','Intermediate',false]] },
    { id: 'm3', name: 'Priya Nair', role: 'Full-Stack Engineer', load: 78, active: 5, velocity: 31, avail: 'Busy',
      hue:42, join: 'Aug 2021', sprints: [30, 28, 32, 29, 31, 31],
      skills: [['React','Expert',false],['Node.js','Expert',false],['AWS','Intermediate',true],['PostgreSQL','Intermediate',false],['Docker','Intermediate',false]] },
    { id: 'm4', name: 'Diego Alvarez', role: 'API / Platform Engineer', load: 52, active: 3, velocity: 26, avail: 'Available',
      hue:55, join: 'Nov 2022', sprints: [22, 24, 27, 25, 26, 26],
      skills: [['Go','Expert',false],['gRPC','Expert',true],['Kubernetes','Expert',false],['Python','Intermediate',false],['Postgres','Beginner',false]] },
    { id: 'm5', name: 'Ava Thompson', role: 'QA / Test Engineer', load: 47, active: 3, velocity: 23, avail: 'Available',
      hue:16, join: 'Feb 2023', sprints: [20, 22, 21, 24, 23, 23],
      skills: [['Playwright','Expert',false],['Cypress','Expert',false],['Jest','Expert',false],['CI/CD','Intermediate',true],['Python','Beginner',false]] },
    { id: 'm6', name: 'Kenji Watanabe', role: 'Product Designer', load: 71, active: 4, velocity: 27, avail: 'Busy',
      hue:34, join: 'Jun 2021', sprints: [26, 25, 28, 27, 29, 27],
      skills: [['Figma','Expert',false],['Design Systems','Expert',true],['Prototyping','Expert',false],['CSS','Intermediate',false],['User Research','Intermediate',false]] },
    { id: 'm7', name: 'Lena Fischer', role: 'Backend Engineer', load: 88, active: 5, velocity: 28, avail: 'On PTO',
      hue:48, join: 'Sep 2022', sprints: [24, 26, 25, 27, 28, 28],
      skills: [['Python','Expert',false],['Django','Expert',false],['PostgreSQL','Expert',false],['Celery','Intermediate',true],['AWS','Intermediate',false]] },
    { id: 'm8', name: 'Omar Haddad', role: 'Frontend Engineer', load: 59, active: 3, velocity: 24, avail: 'Available',
      hue:4, join: 'Apr 2023', sprints: [21, 23, 22, 25, 24, 24],
      skills: [['React','Intermediate',false],['Vue','Expert',false],['CSS','Expert',false],['TypeScript','Intermediate',true],['Testing','Beginner',false]] },
  ];

  const CATS = ['Frontend','Backend','API','Testing','Design','Other'];
  const SEV = ['Critical','High','Medium','Low'];
  const STATUS = ['Backlog','Ongoing','Review','Completed'];

  // due offsets in days from "today"
  const TASKS = [
    { id:'TK-042', title:'Payment API rate-limit middleware', cat:'Backend', sev:'Critical', who:'m1', status:'Ongoing', prog:60, due:2, deps:['TK-031'], complexity:'High', urgency:'High',
      desc:'Implement token-bucket rate limiting on the payment gateway endpoints. Must coordinate with the Checkout flow and survive a 10x traffic spike during the launch window.' },
    { id:'TK-043', title:'Checkout flow redesign — step 2', cat:'Frontend', sev:'High', who:'m2', status:'Ongoing', prog:45, due:5, deps:['TK-042'], complexity:'Medium', urgency:'High',
      desc:'Rebuild the second step of checkout with the new design-system components. Inline validation, saved-card selection, and a slimmer mobile layout.' },
    { id:'TK-044', title:'End-to-end tests for payment path', cat:'Testing', sev:'High', who:null, status:'Backlog', prog:0, due:8, deps:['TK-042','TK-043'], complexity:'Medium', urgency:'Medium',
      desc:'Author Playwright coverage for the full payment journey: cart, checkout, 3DS challenge, confirmation, and refund. Should run in CI on every payment-service PR.' },
    { id:'TK-045', title:'GraphQL schema for unified search', cat:'API', sev:'Medium', who:'m4', status:'Review', prog:90, due:1, deps:[], complexity:'High', urgency:'Medium',
      desc:'Design and ship the federated GraphQL schema powering global search across tasks, members and memory events.' },
    { id:'TK-046', title:'Member capacity heatmap widget', cat:'Frontend', sev:'Medium', who:'m8', status:'Ongoing', prog:30, due:6, deps:[], complexity:'Low', urgency:'Low',
      desc:'Sprint load heatmap for the analytics tab. Cells colour by daily load; overloaded days outlined in red.' },
    { id:'TK-047', title:'Migrate memory store to pgvector', cat:'Backend', sev:'Critical', who:'m7', status:'Ongoing', prog:25, due:0, deps:[], complexity:'High', urgency:'Critical',
      desc:'Move the embedding store from the legacy index to pgvector with HNSW. Zero-downtime migration with a dual-write window.' },
    { id:'TK-048', title:'Risk Agent — blocker-chain detection', cat:'Backend', sev:'High', who:null, status:'Backlog', prog:0, due:11, deps:['TK-047'], complexity:'High', urgency:'Medium',
      desc:'Graph traversal to surface chains of blocked tasks and predict the critical path slip before it lands.' },
    { id:'TK-049', title:'Settings: governance toggle cards', cat:'Design', sev:'Low', who:'m6', status:'Review', prog:85, due:4, deps:[], complexity:'Low', urgency:'Low',
      desc:'Two-card autonomy selector (Suggest / Auto) with the confirmation state for Auto Mode.' },
    { id:'TK-050', title:'Notification WebSocket fan-out', cat:'Backend', sev:'High', who:'m3', status:'Ongoing', prog:55, due:3, deps:['TK-047'], complexity:'Medium', urgency:'High',
      desc:'Real-time push for new risks, deadline changes and preference threshold crossings. Backpressure-safe.' },
    { id:'TK-051', title:'Skill-matrix editor in profile drawer', cat:'Frontend', sev:'Low', who:'m2', status:'Backlog', prog:0, due:9, deps:[], complexity:'Low', urgency:'Low',
      desc:'Inline editing of proficiency dots with the "Learned" inference badge.' },
    { id:'TK-052', title:'Cascade Agent — what-if recompute', cat:'API', sev:'Medium', who:'m4', status:'Ongoing', prog:40, due:7, deps:['TK-045'], complexity:'High', urgency:'Medium',
      desc:'Debounced downstream date recomputation feeding the What-If Simulator graph.' },
    { id:'TK-053', title:'Decay job: compression tier pass', cat:'Backend', sev:'Medium', who:'m7', status:'Review', prog:95, due:-1, deps:[], complexity:'Medium', urgency:'Medium',
      desc:'Nightly Celery Beat job that re-tiers memory events past the compression threshold.' },
    { id:'TK-054', title:'Mobile nav + command palette', cat:'Frontend', sev:'Low', who:'m8', status:'Backlog', prog:0, due:14, deps:[], complexity:'Low', urgency:'Low',
      desc:'Responsive nav collapse and the ⌘K command palette polish.' },
    { id:'TK-055', title:'Audit log export (CSV/JSON)', cat:'Other', sev:'Low', who:null, status:'Backlog', prog:0, due:18, deps:[], complexity:'Low', urgency:'Low',
      desc:'Exportable agent action audit trail for compliance review.' },
    { id:'TK-056', title:'Memory Autopsy token accounting', cat:'Backend', sev:'Medium', who:'m1', status:'Completed', prog:100, due:-3, deps:[], complexity:'Medium', urgency:'Medium',
      desc:'Precise per-memory token accounting surfaced in the Autopsy summary line.' },
  ];

  const RISKS = [
    { id:'R-01', sev:'Critical', type:'Overload', title:'Sarah Chen approaching overload — 91% capacity',
      reason:'Sarah holds 6 active tasks including two Critical items (TK-042, TK-056 follow-ups). Projected to exceed 100% by the next sprint boundary based on current velocity.',
      items:[{t:'Sarah Chen',k:'m'},{t:'TK-042',k:'t'}], action:'Reassign TK-044 to Diego', state:'active' },
    { id:'R-02', sev:'Critical', type:'Deadline', title:'pgvector migration due today, 25% complete',
      reason:'TK-047 is the dependency root for three downstream tasks but sits at 25% on its due date. A slip here cascades into the Risk Agent and Notification work.',
      items:[{t:'TK-047',k:'t'},{t:'Lena Fischer',k:'m'}], action:'Add 3-day buffer + escalate', state:'active' },
    { id:'R-03', sev:'High', type:'Blocker Chain', title:'Payment path: 3-task blocker chain forming',
      reason:'TK-044 (E2E tests) is blocked by TK-042 and TK-043, both Ongoing. If either slips, the entire payment launch path slips with no parallel slack.',
      items:[{t:'TK-042',k:'t'},{t:'TK-043',k:'t'},{t:'TK-044',k:'t'}], action:'Escalate to PM', state:'active' },
    { id:'R-04', sev:'High', type:'Deadline', title:'Lena on PTO with TK-047 mid-migration',
      reason:'Lena Fischer is marked On PTO while owning the in-flight pgvector migration. No secondary owner is assigned to the dual-write window.',
      items:[{t:'Lena Fischer',k:'m'},{t:'TK-047',k:'t'}], action:'Assign backup owner', state:'active' },
    { id:'R-05', sev:'Medium', type:'Stale Task', title:'TK-051 untouched for 6 days in Backlog',
      reason:'Skill-matrix editor has had no activity and blocks the Members Hub polish milestone. Low urgency but ageing.',
      items:[{t:'TK-051',k:'t'}], action:'Reprioritise or drop', state:'active' },
    { id:'R-06', sev:'Medium', type:'Overload', title:'Priya Nair trending toward overload (78%)',
      reason:'Priya picked up TK-050 on top of four active tasks. Trajectory points to 90%+ if the notification fan-out grows in scope.',
      items:[{t:'Priya Nair',k:'m'}], action:'Hold new assignments', state:'active' },
    // suppressed (overload tolerance learned)
    { id:'R-07', sev:'Medium', type:'Overload', title:'Marcus Webb at 64% — within tolerance',
      reason:'Flagged by the raw heuristic but below your learned overload tolerance band.',
      items:[{t:'Marcus Webb',k:'m'}], action:'Monitor', state:'suppressed' },
    // acknowledged
    { id:'R-08', sev:'Low', type:'Stale Task', title:'TK-055 audit export idle in backlog',
      reason:'Low priority compliance task with no movement. Acknowledged for next planning cycle.',
      items:[{t:'TK-055',k:'t'}], action:'Schedule next sprint', state:'acknowledged' },
  ];

  const MEMORY = [
    { id:'#4421', type:'timeline_shift', tier:'active', rel:0.95, date:'2h ago', sum:'Payment API (TK-042) pushed +3d after rate-limit scope grew' },
    { id:'#4420', type:'assignment', tier:'active', rel:0.92, date:'3h ago', sum:'TK-050 assigned to Priya Nair (override of #1 candidate Diego)' },
    { id:'#4418', type:'risk_flag', tier:'active', rel:0.81, date:'5h ago', sum:'Sarah Chen overload risk raised at 91% capacity' },
    { id:'#4415', type:'task_completed', tier:'active', rel:0.74, date:'8h ago', sum:'TK-056 token accounting marked Completed by Sarah' },
    { id:'#4410', type:'requirement', tier:'active', rel:0.71, date:'1d ago', sum:'Scope change: rate limiting must survive 10x launch spike' },
    { id:'#4402', type:'assignment', tier:'compressed', rel:0.66, date:'4d ago', sum:'Payment API work routed to Sarah (backend pattern)' },
    { id:'#4388', type:'preference', tier:'compressed', rel:0.58, date:'6d ago', sum:'Manager dismisses overload risks below 70% consistently' },
    { id:'#4350', type:'risk_flag', tier:'compressed', rel:0.52, date:'11d ago', sum:'Blocker chain on auth service resolved by reorder' },
    // filtered out
    { id:'#4401', type:'assignment', tier:'superseded', rel:0.05, date:'4d ago', sum:'TK-050 → Diego (initial suggestion)', reason:'Superseded by #4420' },
    { id:'#3990', type:'requirement', tier:'archived', rel:0.04, date:'412d ago', sum:'Legacy SSO requirement', reason:'Archived (>365 days old)' },
    { id:'#4120', type:'assignment', tier:'archived', rel:0.03, date:'380d ago', sum:'Old onboarding flow assignment', reason:'Archived (>365 days old)' },
    { id:'#4399', type:'comment', tier:'superseded', rel:0.02, date:'5d ago', sum:'Draft note replaced by final spec', reason:'Superseded by #4410' },
    { id:'#4205', type:'risk_flag', tier:'archived', rel:0.02, date:'200d ago', sum:'Resolved Q3 deadline risk', reason:'Archived (>365 days old)' },
  ];

  const PREFERENCES = [
    { id:'p1', type:'assignment_override', value:'Backend tasks → Sarah', conf:0.74, evidence:12, last:'2 days ago' },
    { id:'p2', type:'communication_style', value:'Bullet points, low verbosity', conf:0.78, evidence:8, last:'1 day ago' },
    { id:'p3', type:'risk_tolerance', value:'Suppress: overload · Escalate: blocker chain', conf:0.67, evidence:6, last:'3 days ago' },
    { id:'p4', type:'timeline_philosophy', value:'Protect release date over scope', conf:0.61, evidence:4, last:'5 days ago' },
    { id:'p5', type:'review_cadence', value:'Daily standup digest, not real-time', conf:0.43, evidence:3, last:'8 days ago' },
    { id:'p6', type:'category_routing', value:'Testing → Ava when available', conf:0.38, evidence:2, last:'12 days ago' },
  ];

  const OVERRIDE_RATE = [
    { x:'S1', v:62 }, { x:'S2', v:55 }, { x:'S3', v:58 }, { x:'S4', v:44 },
    { x:'S5', v:37 }, { x:'S6', v:31 }, { x:'S7', v:26 }, { x:'S8', v:22 },
  ];

  const REQUIREMENTS = [
    { id:'RQ-018', title:'Payment must survive 10x launch traffic', type:'Scope Change', prio:'Critical', by:'Sarah Chen', date:'2h ago', status:'In Progress', linked:3 },
    { id:'RQ-017', title:'Add saved-card selection to checkout', type:'New Requirement', prio:'High', by:'Kenji Watanabe', date:'1d ago', status:'In Progress', linked:2 },
    { id:'RQ-016', title:'pgvector migration blocking search', type:'Blocker', prio:'Critical', by:'Diego Alvarez', date:'1d ago', status:'Open', linked:4 },
    { id:'RQ-015', title:'Memory autopsy must show token counts', type:'New Requirement', prio:'Medium', by:'Priya Nair', date:'3d ago', status:'Resolved', linked:1 },
    { id:'RQ-014', title:'Heatmap colours unreadable on overload', type:'Issue', prio:'Low', by:'Omar Haddad', date:'4d ago', status:'Open', linked:1 },
    { id:'RQ-013', title:'Decay clock too slow for demos', type:'Issue', prio:'Medium', by:'Lena Fischer', date:'6d ago', status:'Resolved', linked:1 },
  ];

  const NOTIFICATIONS = [
    { id:'n1', agent:'Risk', text:'Risk flagged: Sarah Chen approaching overload (91%)', time:'2 min ago', action:'View Risk', unread:true },
    { id:'n2', agent:'Cascade', text:'Timeline shift: Payment API +3d — 3 tasks affected', time:'18 min ago', action:'See Impact', unread:true },
    { id:'n3', agent:'Assignment', text:'New best-match ready for TK-044 (E2E tests)', time:'41 min ago', action:'Open Task', unread:true },
    { id:'n4', agent:'Memory', text:'Preference confidence crossed 0.6: timeline_philosophy', time:'2h ago', action:'View', unread:false },
    { id:'n5', agent:'Risk', text:'Blocker chain forming on payment path', time:'3h ago', action:'View Risk', unread:false },
  ];

  // Cascade timeline shifts
  const SHIFTS = [
    { id:'s1', task:'Payment API', delta:'+3d', date:'2h ago', cause:'Rate-limit scope change (RQ-018)', downstream:3 },
    { id:'s2', task:'GraphQL schema', delta:'+1d', date:'1d ago', cause:'Review feedback on federation', downstream:1 },
    { id:'s3', task:'pgvector migration', delta:'+2d', date:'2d ago', cause:'Dual-write window extended', downstream:2 },
  ];

  window.NPM_DATA = { MEMBERS, TASKS, RISKS, MEMORY, PREFERENCES, OVERRIDE_RATE, REQUIREMENTS, NOTIFICATIONS, SHIFTS, CATS, SEV, STATUS };
})();
