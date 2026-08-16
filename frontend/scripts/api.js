/* ============================================================
   NeuralPM — Backend API client + mock<->API shape adapters
   Talks to the domain FastAPI service (backend/main.py).
   Set window.NPM_API_BASE before boot.js runs to point elsewhere;
   defaults to the local dev server on :8000.
   ============================================================ */
(function () {
  const BASE = window.NPM_API_BASE || 'http://localhost:8000';

  async function req(method, path, body) {
    const res = await fetch(BASE + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`${method} ${path} -> ${res.status} ${detail}`);
    }
    return res.status === 204 ? null : res.json();
  }

  // ---- enum adapters: backend is lowercase, UI is Title Case ----
  const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
  const STATUS_TO_UI = { backlog: 'Backlog', assigned: 'Backlog', ongoing: 'Ongoing', review: 'Review', completed: 'Completed', cancelled: 'Backlog' };
  const STATUS_TO_API = { Backlog: 'backlog', Ongoing: 'ongoing', Review: 'review', Completed: 'completed' };
  const SEV_SET = new Set(['Critical', 'High', 'Medium', 'Low']);

  function daysFromNow(iso) {
    if (!iso) return 7;
    return Math.round((new Date(iso) - new Date()) / 86400000);
  }
  function isoInDays(days) {
    if (days === '' || days == null) return null;
    const d = new Date();
    d.setDate(d.getDate() + Number(days));
    return d.toISOString();
  }

  function taskFromApi(t) {
    const sev = cap(t.severity);
    return {
      id: t.id,
      title: t.title,
      desc: t.description || '',
      cat: cap(t.category) || 'Other',
      sev: SEV_SET.has(sev) ? sev : 'Medium',
      who: t.assignee_id || null,
      status: STATUS_TO_UI[t.status] || 'Backlog',
      prog: t.progress_pct || 0,
      due: daysFromNow(t.due_date),
      deps: [],
      complexity: 'Medium',
      urgency: cap(t.urgency) || 'Medium',
      desc_full: t.description || 'No description provided.',
    };
  }

  function memberFromApi(m) {
    const level = p => (p >= 5 ? 'Expert' : p >= 3 ? 'Intermediate' : 'Beginner');
    return {
      id: m.id,
      name: m.name,
      role: m.role || 'Team Member',
      load: m.capacity ? Math.min(100, Math.round((m.active_points / m.capacity) * 100)) : 0,
      active: m.active_points,
      velocity: m.velocity_avg,
      avail: m.availability === 'available' ? 'Available' : m.availability === 'pto' ? 'On PTO' : 'Busy',
      hue: Array.from(m.id).reduce((a, c) => a + c.charCodeAt(0), 0) % 360,
      join: new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      // ponytail: backend has no per-sprint velocity history yet — flat placeholder from the rolling avg.
      // Upgrade when assignment_history rollups exist.
      sprints: Array(6).fill(Math.round(m.velocity_avg) || 0),
      skills: (m.skills || []).map(s => [s.skill, level(s.proficiency), s.proficiency >= 5]),
    };
  }

  window.NPM_API = {
    async ensureProject(name) {
      const list = await req('GET', '/projects');
      if (list.length) return list[0];
      return req('POST', '/projects', { name });
    },
    listTasks: (projectId) => req('GET', `/tasks?project_id=${projectId}`).then(ts => ts.map(taskFromApi)),
    createTask: (projectId, f) => req('POST', '/tasks', {
      project_id: projectId,
      title: f.title,
      description: f.desc || null,
      category: (f.cat || '').toLowerCase(),
      severity: (f.sev || 'medium').toLowerCase(),
      due_date: isoInDays(f.due),
    }).then(taskFromApi),
    updateTaskStatus: (taskId, uiStatus) => req('PATCH', `/tasks/${taskId}`, { status: STATUS_TO_API[uiStatus] || 'backlog' }).then(taskFromApi),
    assignTask: (taskId, memberId) => req('PATCH', `/tasks/${taskId}`, { assignee_id: memberId }).then(taskFromApi),
    listMembers: (projectId) => req('GET', `/members?project_id=${projectId}`)
      .then(ms => ms.filter(m => m.availability !== 'deactivated').map(memberFromApi)),
  };
})();
