/* ============================================================
   NeuralPM Landing v2 — scroll, counters, conversation demo
   ============================================================ */

/* ---------- Scroll reveal ---------- */
function initReveal() {
  var io = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (e.isIntersecting) { e.target.classList.add('revealed'); io.unobserve(e.target); }
    });
  }, { threshold: 0.10 });
  document.querySelectorAll('.reveal').forEach(function(el) { io.observe(el); });
}

/* ---------- Animated counters ---------- */
function animateCounters() {
  var io = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      var target = +el.dataset.to;
      var suffix = el.dataset.suffix || '';
      var start = performance.now(), dur = 1600;
      (function frame(now) {
        var ease = 1 - Math.pow(1 - Math.min((now-start)/dur, 1), 3);
        el.textContent = Math.round(ease * target) + suffix;
        if (ease < 1) requestAnimationFrame(frame);
      })(start);
      io.unobserve(el);
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('.counter').forEach(function(el) { io.observe(el); });
}

/* ---------- Nav shrink ---------- */
function initNav() {
  var nav = document.getElementById('lp-nav');
  window.addEventListener('scroll', function() {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });
}

/* ---------- Hero mock chat conversation ---------- */
function initHeroConvo() {
  var wrap = document.getElementById('mock-convo');
  if (!wrap) return;
  var steps = [
    { role:'user', text:'Why was the Payment API delayed?' },
    { role:'agent', chunks:['Payment API (TK-042) slipped ','[+3 days]',' — causal chain:\n\n1. Scope change ','[#4410]',' — 10× traffic\n2. Re-routed to Sarah ','[#4402]','\n3. Sarah hit 91% load ','[#4418]','\n4. Cascade recomputed ','[#4421]'] },
  ];
  var citations = ['[#4410]','[#4402]','[#4418]','[#4421]','[+3 days]'];
  var started = false;
  var io = new IntersectionObserver(function(entries) {
    if (!entries[0].isIntersecting || started) return;
    started = true; io.disconnect();
    var i = 0;
    function nextStep() {
      if (i >= steps.length) return;
      var step = steps[i++];
      if (step.role === 'user') {
        var el = document.createElement('div');
        el.className = 'mc-user'; el.textContent = step.text; wrap.appendChild(el);
        setTimeout(nextStep, 600);
      } else {
        var agWrap = document.createElement('div'); agWrap.className = 'mc-agent-wrap'; wrap.appendChild(agWrap);
        var icon = document.createElement('div'); icon.className = 'mc-agent-icon'; agWrap.appendChild(icon);
        icon.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5a3 3 0 0 0-5.6-1.5A2.5 2.5 0 0 0 4 6a2.5 2.5 0 0 0 .5 4.5A2.5 2.5 0 0 0 7 15a3 3 0 0 0 5 2"/><path d="M12 5a3 3 0 0 1 5.6-1.5A2.5 2.5 0 0 1 20 6a2.5 2.5 0 0 1-.5 4.5A2.5 2.5 0 0 1 17 15a3 3 0 0 1-5 2"/><path d="M12 5v12"/></svg>';
        var bubble = document.createElement('div'); bubble.className = 'mc-agent'; agWrap.appendChild(bubble);
        var cursor = document.createElement('span'); cursor.className = 'mc-cursor'; bubble.appendChild(cursor);
        var chunks = step.chunks; var ci = 0;
        function nextChunk() {
          if (ci >= chunks.length) { cursor.remove(); return; }
          var chunk = chunks[ci++];
          var isCite = citations.indexOf(chunk) >= 0;
          if (isCite) {
            var span = document.createElement('span'); span.className = 'mc-cite'; span.textContent = chunk;
            bubble.insertBefore(span, cursor);
          } else {
            var text = document.createTextNode(''); bubble.insertBefore(text, cursor);
            var chars = chunk.split(''); var ci2 = 0;
            (function typeChar() {
              if (ci2 >= chars.length) { setTimeout(nextChunk, 40); return; }
              text.textContent += chars[ci2++]; wrap.scrollTop = 9999;
              setTimeout(typeChar, chars[ci2-1]==='\n'?80:22);
            })();
            return;
          }
          setTimeout(nextChunk, 80);
        }
        nextChunk();
      }
    }
    setTimeout(nextStep, 800);
  }, { threshold: 0.3 });
  io.observe(wrap.parentElement);
}

/* ---------- Memory panel tick ---------- */
function initMemPanel() {
  var items = document.querySelectorAll('.mcp-item');
  var io = new IntersectionObserver(function(entries) {
    if (!entries[0].isIntersecting) return; io.disconnect();
    items.forEach(function(el, i) {
      setTimeout(function() { el.classList.add('visible'); }, 300 + i*120);
    });
  }, { threshold: 0.3 });
  if (items.length) io.observe(items[0].parentElement);
}

/* ---------- Bento terminal demo ---------- */
function initBentoTerminal() {
  var el = document.getElementById('bento-terminal');
  if (!el) return;
  var lines = [
    { c:'comment', s:'▸ 2,940 / 8,192 tokens — 7 loaded, 4 filtered' },
    { c:'label2', s:'LOADED' },
    { c:'row', s:'#4421  timeline_shift   0.95  ACT  Payment API +3d' },
    { c:'row', s:'#4418  risk_flag         0.81  ACT  Sarah 91% overload' },
    { c:'row', s:'#4410  requirement       0.71  ACT  10x traffic scope' },
    { c:'row', s:'#4402  assignment        0.66  CMPR Routed → Sarah' },
    { c:'row', s:'#4388  preference        0.58  CMPR Tolerance learned' },
    { c:'label2', s:'FILTERED' },
    { c:'filt', s:'#4401  assignment        0.05  SUPR Superseded by #4420' },
    { c:'filt', s:'#3990  requirement       0.04  ARCH Archived >365 days' },
    { c:'label2', s:'PREFERENCES' },
    { c:'pref', s:'assignment_override  (0.74)  → Sarah first' },
    { c:'pref', s:'communication_style  (0.78)  → Bullet format' },
  ];
  var io = new IntersectionObserver(function(entries) {
    if (!entries[0].isIntersecting) return; io.disconnect();
    var i = 0;
    (function go() {
      if (i >= lines.length) return;
      var d = document.createElement('div');
      d.className = 'bt-line bt-'+lines[i].c; d.textContent = lines[i++].s; el.appendChild(d);
      setTimeout(go, 60 + Math.random()*60);
    })();
  }, { threshold: 0.3 });
  io.observe(el);
}

window.addEventListener('DOMContentLoaded', function() {
  initReveal(); animateCounters(); initNav(); initHeroConvo(); initMemPanel(); initBentoTerminal();
});
