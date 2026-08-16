/* ===================================================================
   NeuralPM — IGNITION motion engine
   Scroll reveals · particles · agent scenes · cascade simulator
   =================================================================== */
(function () {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* watchdog: some embedded contexts freeze rAF + CSS transitions. If no rAF
     tick lands quickly, declare the environment frozen and snap everything
     to its final state (transitions disabled via html.no-anim). */
  let rafOK = false;
  const onFrozen = [];
  requestAnimationFrame(() => { rafOK = true; });
  setTimeout(() => {
    if (rafOK) return;
    document.documentElement.classList.add('no-anim');
    onFrozen.forEach(fn => { try { fn(); } catch (e) { /* noop */ } });
  }, 250);
  const frozen = () => !rafOK;
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));

  /* ---------- scroll progress + nav ---------- */
  const progress = $('#progress'), nav = $('#nav');
  function onScroll() {
    const h = document.documentElement;
    const max = h.scrollHeight - h.clientHeight;
    progress.style.width = (max ? (h.scrollTop / max) * 100 : 0) + '%';
    nav.classList.toggle('on', h.scrollTop > 100);
  }
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- hero eyebrow char stagger ---------- */
  const eyebrow = $('#hero-eyebrow');
  if (eyebrow) {
    const text = eyebrow.textContent;
    eyebrow.textContent = '';
    text.split('').forEach((ch, i) => {
      const s = document.createElement('span');
      s.textContent = ch === ' ' ? '\u00A0' : ch;
      s.style.transitionDelay = (i * 20) + 'ms';
      eyebrow.appendChild(s);
    });
  }
  const hero = $('#hero');
  (function () {
    let fired = false;
    const go = () => {
      if (fired) return; fired = true;
      hero.classList.add('loaded', 'revealed');
      $$('.line', hero).forEach((l, i) => { l.style.transitionDelay = (120 + i * 90) + 'ms'; });
      setTimeout(() => $('.think', hero).classList.add('lit'), (reduced || frozen()) ? 0 : 2100);
    };
    requestAnimationFrame(() => requestAnimationFrame(go));
    setTimeout(go, 350);
  })();

  /* ---------- generic reveal observer ---------- */
  const lit = new WeakSet();
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting || lit.has(e.target)) return;
      lit.add(e.target);
      e.target.classList.add('revealed');
      $$('.line', e.target).forEach((l, i) => { l.style.transitionDelay = (i * 110) + 'ms'; });
      $$('.count', e.target.classList.contains('count') ? e.target.parentElement : e.target)
        .forEach(runCount);
      if (e.target.classList.contains('count')) runCount(e.target);
      io.unobserve(e.target);
    });
  }, { threshold: 0.2 });
  $$('.reveal, .reveal-lines, .pain, .feat, .metric, .mockup, .sim-wrap').forEach(el => io.observe(el));
  onFrozen.push(() => {
    $$('.reveal, .reveal-lines, .pain, .feat, .metric, .mockup, .sim-wrap').forEach(el => el.classList.add('revealed'));
    $$('.count').forEach(runCount);
  });
  // pains + feats: stagger via observation order
  $$('.pain').forEach((el, i) => el.style.transitionDelay = (i * 150) + 'ms');
  $$('.feat').forEach((el, i) => el.style.transitionDelay = (i * 100) + 'ms');

  /* ---------- count-up ---------- */
  const counted = new WeakSet();
  function runCount(el) {
    if (counted.has(el)) return; counted.add(el);
    const to = parseFloat(el.dataset.to), dec = +(el.dataset.dec || 0);
    if (reduced || frozen()) { el.textContent = to.toFixed(dec); return; }
    const t0 = performance.now(), dur = 1100;
    (function tick() {
      const p = Math.min(1, (performance.now() - t0) / dur);
      const ease = 1 - Math.pow(1 - p, 3);
      el.textContent = (to * ease).toFixed(dec);
      if (p < 1) setTimeout(tick, 24);
    })();
  }
  $$('.count').forEach(el => io.observe(el));

  /* ---------- cursor glow + tilt on cards ---------- */
  if (!reduced) $$('.card').forEach(card => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
      card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
      if (card.dataset.tilt !== undefined) {
        const rx = ((e.clientY - r.top) / r.height - 0.5) * -4;
        const ry = ((e.clientX - r.left) / r.width - 0.5) * 4;
        card.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-2px)`;
      }
    });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  });

  /* ---------- mockup parallax ---------- */
  const mockup = $('#mockup');
  if (mockup && !reduced) {
    const stage = mockup.parentElement;
    stage.addEventListener('pointermove', (e) => {
      if (!mockup.classList.contains('revealed')) return;
      const r = stage.getBoundingClientRect();
      const ry = ((e.clientX - r.left) / r.width - 0.5) * 5;
      const rx = 2 + ((e.clientY - r.top) / r.height - 0.5) * -4;
      mockup.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    });
    stage.addEventListener('pointerleave', () => { mockup.style.transform = ''; });
  }

  /* ---------- particle burst on CTA clicks ---------- */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-burst]');
    if (!btn || reduced) return;
    for (let i = 0; i < 10; i++) {
      const p = document.createElement('div');
      const a = Math.random() * Math.PI * 2, d = 30 + Math.random() * 30;
      p.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;width:3px;height:3px;border-radius:50%;pointer-events:none;z-index:300;background:${i % 3 ? '#FF6B00' : '#FFFFFF'};transition:transform 420ms cubic-bezier(0.16,1,0.3,1),opacity 420ms;`;
      document.body.appendChild(p);
      requestAnimationFrame(() => {
        p.style.transform = `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px)`;
        p.style.opacity = '0';
      });
      setTimeout(() => p.remove(), 480);
    }
  });

  /* ---------- canvas helper: run loop only while visible ---------- */
  function canvasLoop(canvas, draw) {
    const ctx = canvas.getContext('2d');
    let running = false, raf = 0, t = 0;
    // getBoundingClientRect can return 0 if called before layout resolves;
    // fall back to parent size or viewport so the first frame is always full-size.
    function sz() {
      const r = canvas.getBoundingClientRect();
      return {
        width:  r.width  > 2 ? r.width  : (canvas.parentElement ? canvas.parentElement.offsetWidth  : window.innerWidth),
        height: r.height > 2 ? r.height : (canvas.parentElement ? canvas.parentElement.offsetHeight : window.innerHeight),
        left: r.left, top: r.top
      };
    }
    function fit() {
      const s = sz();
      canvas.width  = s.width  * devicePixelRatio;
      canvas.height = s.height * devicePixelRatio;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    }
    fit(); window.addEventListener('resize', () => { fit(); draw(ctx, sz(), t); });
    // first static frame after a short delay so layout has settled
    setTimeout(() => { fit(); draw(ctx, sz(), 1); }, 80);
    function frame() { t += 1; draw(ctx, sz(), t); if (running) raf = requestAnimationFrame(frame); }
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !running && !reduced) { running = true; raf = requestAnimationFrame(frame); }
      else if (!e.isIntersecting && running) { running = false; cancelAnimationFrame(raf); }
      if (reduced && e.isIntersecting) { fit(); draw(ctx, sz(), 1); }
    }).observe(canvas);
    return ctx;
  }

  /* ---------- HERO particles ---------- */
  (function () {
    const canvas = $('#hero-canvas');
    if (!canvas) return;
    // Force full-viewport fill before first layout tick
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:0;display:block;';
    const N = window.innerWidth < 700 ? 70 : 220;
    const pts = [], mouse = { x: -9999, y: -9999 };
    for (let i = 0; i < N; i++) pts.push({
      x: Math.random(), y: Math.random(),
      vy: 0.0002 + Math.random() * 0.0004, ph: Math.random() * Math.PI * 2,
      r: 0.8 + Math.random() * 1.2, o: 0.15 + Math.random() * 0.25,
      kx: 0, ky: 0,
    });
    hero.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    });
    hero.addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; });
    hero.addEventListener('click', (e) => {
      const r = canvas.getBoundingClientRect();
      const cx = e.clientX - r.left, cy = e.clientY - r.top;
      pts.forEach(p => {
        const dx = p.x * r.width - cx, dy = p.y * r.height - cy;
        const d = Math.hypot(dx, dy);
        if (d < 200 && d > 0.01) { const f = (200 - d) / 200 * 14; p.kx += dx / d * f; p.ky += dy / d * f; }
      });
    });
    canvasLoop(canvas, (ctx, r, t) => {
      ctx.clearRect(0, 0, r.width, r.height);
      const px = [];
      for (const p of pts) {
        p.y -= p.vy; if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); }
        p.kx *= 0.9; p.ky *= 0.9;
        let x = p.x * r.width + Math.sin(t * 0.01 + p.ph) * 8 + p.kx;
        let y = p.y * r.height + p.ky;
        const dx = x - mouse.x, dy = y - mouse.y, d = Math.hypot(dx, dy);
        if (d < 150 && d > 0.01) { const f = (150 - d) / 150 * 18; x += dx / d * f; y += dy / d * f; }
        px.push([x, y, p]);
      }
      ctx.lineWidth = 0.5;
      for (let i = 0; i < px.length; i++) for (let j = i + 1; j < px.length; j++) {
        const dx = px[i][0] - px[j][0], dy = px[i][1] - px[j][1];
        const dd = dx * dx + dy * dy;
        if (dd < 10000) {
          ctx.strokeStyle = `rgba(255,107,0,${0.06 * (1 - dd / 10000)})`;
          ctx.beginPath(); ctx.moveTo(px[i][0], px[i][1]); ctx.lineTo(px[j][0], px[j][1]); ctx.stroke();
        }
      }
      for (const [x, y, p] of px) {
        ctx.fillStyle = p.r > 1.5 ? `rgba(255,255,255,${p.o * 0.6})` : `rgba(255,107,0,${p.o})`;
        ctx.beginPath(); ctx.arc(x, y, p.r, 0, 7); ctx.fill();
      }
    });
  })();

  /* ---------- AGENT scenes ---------- */
  const sceneDraw = {
    orbital(ctx, r, t) {
      ctx.clearRect(0, 0, r.width, r.height);
      const cx = r.width / 2, cy = r.height / 2;
      for (let k = 0; k < 5; k++) {
        const rx = 90 + k * 55, ry = rx * 0.42;
        ctx.strokeStyle = 'rgba(255,107,0,0.10)'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, -0.3, 0, 7); ctx.stroke();
        for (let m = 0; m < 7 + k * 2; m++) {
          const a = t * (0.004 - k * 0.0005) + m * (Math.PI * 2 / (7 + k * 2));
          const x = cx + Math.cos(a) * rx * Math.cos(-0.3) - Math.sin(a) * ry * Math.sin(-0.3);
          const y = cy + Math.cos(a) * rx * Math.sin(-0.3) + Math.sin(a) * ry * Math.cos(-0.3);
          const big = (m + k) % 5 === 0;
          ctx.fillStyle = big ? 'rgba(255,107,0,0.8)' : 'rgba(255,255,255,0.3)';
          ctx.beginPath(); ctx.arc(x, y, big ? 3 : 1.5, 0, 7); ctx.fill();
          if (big) { ctx.fillStyle = 'rgba(255,107,0,0.12)'; ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); ctx.fill(); }
        }
      }
    },
    radar(ctx, r, t) {
      ctx.clearRect(0, 0, r.width, r.height);
      const cx = r.width / 2, cy = r.height / 2, R = Math.min(r.width, r.height) * 0.42;
      for (let k = 1; k <= 4; k++) {
        ctx.strokeStyle = 'rgba(42,42,42,0.8)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx, cy, R * k / 4, 0, 7); ctx.stroke();
      }
      const a = t * 0.012;
      const grad = ctx.createConicGradient ? ctx.createConicGradient(a, cx, cy) : null;
      if (grad) {
        grad.addColorStop(0, 'rgba(255,107,0,0.16)'); grad.addColorStop(0.12, 'rgba(255,107,0,0)');
        grad.addColorStop(1, 'rgba(255,107,0,0)');
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(255,107,0,0.7)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke();
      const blips = [[0.7, 0.5, 1], [0.3, 2.2, 0], [0.85, 3.6, 1], [0.5, 4.8, 0], [0.62, 5.7, 0]];
      blips.forEach(([rr, ba, red], i) => {
        const x = cx + Math.cos(ba) * R * rr, y = cy + Math.sin(ba) * R * rr;
        const pulse = 0.5 + 0.5 * Math.sin(t * 0.05 + i * 2);
        ctx.fillStyle = red ? `rgba(255,45,45,${0.4 + pulse * 0.5})` : `rgba(255,107,0,${0.3 + pulse * 0.4})`;
        ctx.beginPath(); ctx.arc(x, y, red ? 4 : 3, 0, 7); ctx.fill();
      });
    },
    network(ctx, r, t) {
      ctx.clearRect(0, 0, r.width, r.height);
      if (!ctx._nodes) {
        ctx._nodes = [];
        for (let i = 0; i < 26; i++) ctx._nodes.push({
          x: 0.1 + Math.random() * 0.8, y: 0.12 + Math.random() * 0.76,
          ph: Math.random() * 7, big: i % 6 === 0,
        });
      }
      const ns = ctx._nodes.map(n => [
        n.x * r.width + Math.sin(t * 0.008 + n.ph) * 14,
        n.y * r.height + Math.cos(t * 0.006 + n.ph) * 12, n]);
      ctx.lineWidth = 0.7;
      ctx.setLineDash([4, 6]); ctx.lineDashOffset = -t * 0.4;
      for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
        const dx = ns[i][0] - ns[j][0], dy = ns[i][1] - ns[j][1], dd = dx * dx + dy * dy;
        if (dd < 24000) {
          ctx.strokeStyle = `rgba(255,107,0,${0.16 * (1 - dd / 24000)})`;
          ctx.beginPath(); ctx.moveTo(ns[i][0], ns[i][1]); ctx.lineTo(ns[j][0], ns[j][1]); ctx.stroke();
        }
      }
      ctx.setLineDash([]);
      for (const [x, y, n] of ns) {
        ctx.fillStyle = n.big ? 'rgba(255,107,0,0.85)' : 'rgba(255,255,255,0.35)';
        ctx.beginPath(); ctx.arc(x, y, n.big ? 4 : 2, 0, 7); ctx.fill();
      }
    },
    constellation(ctx, r, t) {
      ctx.clearRect(0, 0, r.width, r.height);
      if (!ctx._stars) {
        ctx._stars = [];
        for (let i = 0; i < 110; i++) ctx._stars.push({
          a: Math.random() * 7, d: Math.random(), o: 0.1 + Math.random() * 0.35, ph: Math.random() * 7,
        });
      }
      const cx = r.width / 2, cy = r.height / 2, R = Math.max(r.width, r.height) * 0.62;
      const rot = t * 0.0006;
      const ps = ctx._stars.map(s => [
        cx + Math.cos(s.a + rot) * s.d * R, cy + Math.sin(s.a + rot) * s.d * R * 0.7, s]);
      ctx.lineWidth = 0.5;
      for (let i = 0; i < ps.length; i += 4) {
        const j = (i + 7) % ps.length;
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.beginPath(); ctx.moveTo(ps[i][0], ps[i][1]); ctx.lineTo(ps[j][0], ps[j][1]); ctx.stroke();
      }
      for (const [x, y, s] of ps) {
        const tw = 0.7 + 0.3 * Math.sin(t * 0.02 + s.ph);
        ctx.fillStyle = `rgba(255,255,255,${s.o * tw})`;
        ctx.beginPath(); ctx.arc(x, y, 1.2, 0, 7); ctx.fill();
      }
    },
  };
  $$('.agent-scene').forEach(scene => {
    canvasLoop($('canvas', scene), sceneDraw[scene.dataset.scene]);
  });
  // sticky description switcher
  const descs = $$('.agent-desc');
  (function(){
    const ob = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const idx = e.target.dataset.idx;
        descs.forEach(d => d.classList.toggle('on', d.dataset.agent === idx));
      });
    }, { threshold: 0.55 });
    $$('.agent-scene').forEach(s => ob.observe(s));
  })();

  /* ---------- CASCADE simulator ---------- */
  (function () {
    const canvas = $('#sim-canvas');
    if (!canvas) return;
    const alertEl = $('#sim-alert');
    const NODES = [
      { id: 0, label: 'Payment API', x: 0.16, y: 0.5, r: 34, root: true },
      { id: 1, label: 'Auth Service', x: 0.38, y: 0.24, r: 24 },
      { id: 2, label: 'Checkout Flow', x: 0.42, y: 0.62, r: 24 },
      { id: 3, label: 'Email Notifications', x: 0.58, y: 0.4, r: 24 },
      { id: 4, label: 'E2E Tests', x: 0.62, y: 0.78, r: 24 },
      { id: 5, label: 'Documentation', x: 0.74, y: 0.18, r: 24 },
      { id: 6, label: 'Client Demo', x: 0.8, y: 0.58, r: 24 },
      { id: 7, label: 'Release', x: 0.92, y: 0.42, r: 28, milestone: true },
    ];
    const EDGES = [[0,1],[0,2],[1,3],[2,4],[3,5],[2,6],[4,6],[5,7],[6,7],[3,6]];
    // depth from root for shockwave delay
    const depth = [0,1,1,2,2,3,3,4];
    NODES.forEach(n => { n.hx = n.x; n.hy = n.y; n.vx = 0; n.vy = 0; n.px = 0; n.py = 0; n.bounce = 0; n.alarm = 0; });
    let drag = null, waveT = -1, waveFrom = null, conflict = false;
    const ctx = canvasLoop(canvas, draw);

    function nodeAt(mx, my, r) {
      for (const n of NODES) {
        const x = n.px, y = n.py;
        if (Math.hypot(mx - x, my - y) < n.r + 8) return n;
      }
      return null;
    }
    function pos(e) {
      const r = canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top, r];
    }
    canvas.addEventListener('pointerdown', (e) => {
      const [mx, my] = pos(e);
      const n = nodeAt(mx, my);
      if (n) { drag = n; canvas.classList.add('dragging'); canvas.setPointerCapture(e.pointerId); }
    });
    canvas.addEventListener('pointermove', (e) => {
      const [mx, my, r] = pos(e);
      if (drag) {
        drag.x = Math.max(0.04, Math.min(0.96, mx / r.width));
        drag.y = Math.max(0.07, Math.min(0.93, my / r.height));
        const tooFar = Math.abs(drag.x - drag.hx) > 0.18 || Math.abs(drag.y - drag.hy) > 0.3;
        if (tooFar !== conflict) {
          conflict = tooFar;
          alertEl.classList.toggle('on', conflict);
          if (conflict) NODES[7].alarm = 1;
        }
      } else {
        canvas.style.cursor = nodeAt(mx, my) ? 'grab' : 'default';
      }
    });
    function release() {
      if (!drag) return;
      // shockwave from dragged node
      waveT = 0; waveFrom = drag;
      const moved = drag;
      NODES.forEach(n => {
        if (n !== moved) setTimeout(() => { n.bounce = 1; }, (Math.abs(depth[n.id] - depth[moved.id]) + 1) * 130);
      });
      drag = null; canvas.classList.remove('dragging');
      alertEl.classList.remove('on'); conflict = false;
    }
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);

    function draw(c, r, t) {
      c.clearRect(0, 0, r.width, r.height);
      // springs back toward home (gentle)
      NODES.forEach(n => {
        if (n !== drag) {
          n.vx += (n.hx - n.x) * 0.002; n.vy += (n.hy - n.y) * 0.002;
          n.vx *= 0.92; n.vy *= 0.92;
          n.x += n.vx; n.y += n.vy;
        }
        n.px = n.x * r.width; n.py = n.y * r.height;
        n.bounce *= 0.93; n.alarm *= 0.985;
      });
      // edges
      EDGES.forEach(([a, b], i) => {
        const A = NODES[a], B = NODES[b];
        const hot = drag && (A === drag || B === drag);
        c.strokeStyle = hot ? 'rgba(255,107,0,0.7)' : 'rgba(42,42,42,0.9)';
        c.lineWidth = hot ? 1.5 : 1;
        c.beginPath(); c.moveTo(A.px, A.py); c.lineTo(B.px, B.py); c.stroke();
        // traveling data dot
        const p = ((t * 0.002) + i * 0.13) % 1;
        const dx = A.px + (B.px - A.px) * p, dy = A.py + (B.py - A.py) * p;
        c.fillStyle = 'rgba(255,107,0,0.55)';
        c.beginPath(); c.arc(dx, dy, 1.6, 0, 7); c.fill();
      });
      // shockwave
      if (waveT >= 0 && waveFrom) {
        waveT += 4;
        const o = Math.max(0, 1 - waveT / 220);
        if (o <= 0) waveT = -1;
        else {
          c.strokeStyle = `rgba(255,107,0,${o * 0.6})`; c.lineWidth = 1;
          c.beginPath(); c.arc(waveFrom.px, waveFrom.py, waveT, 0, 7); c.stroke();
        }
      }
      // nodes
      NODES.forEach(n => {
        const scale = 1 + n.bounce * 0.12 * Math.sin(Math.min(1, n.bounce) * Math.PI);
        const R = n.r * scale;
        const isDrag = n === drag;
        // alarm aura
        if (n.alarm > 0.05) {
          c.fillStyle = `rgba(255,45,45,${n.alarm * 0.18})`;
          c.beginPath(); c.arc(n.px, n.py, R + 14, 0, 7); c.fill();
        }
        c.fillStyle = isDrag ? '#1F1F1F' : '#0A0A0A';
        c.strokeStyle = isDrag ? '#FFFFFF' : n.root ? '#FF6B00' : n.alarm > 0.4 ? '#FF2D2D' : '#2A2A2A';
        c.lineWidth = n.root || isDrag ? 1.5 : 1;
        c.beginPath(); c.arc(n.px, n.py, R, 0, 7); c.fill(); c.stroke();
        if (isDrag) { c.shadowColor = 'rgba(255,255,255,0.4)'; c.shadowBlur = 16; c.stroke(); c.shadowBlur = 0; }
        c.fillStyle = n.root ? '#FF6B00' : n.milestone ? '#FFFFFF' : '#A3A3A3';
        c.font = `${n.root ? 600 : 400} 10px 'Geist Mono', monospace`;
        c.textAlign = 'center';
        c.fillText(n.label, n.px, n.py + R + 16);
      });
    }
  })();

  /* ---------- MEMORY constellation bg ---------- */
  (function () {
    const canvas = $('#mem-stars');
    if (canvas) canvasLoop(canvas, sceneDraw.constellation);
  })();

  /* ---------- MEMORY terminal typewriter ---------- */
  (function () {
    const term = $('#terminal');
    if (!term) return;
    const LINES = [
      ['tl-q', '> explain why the payment api was delayed'],
      ['', ''],
      ['tl-dim', 'Context used: 3,247 / 8,192 tokens'],
      ['tl-dim', '8 memories loaded, 5 filtered out'],
      ['', ''],
      ['tl-hd', '[LOADED]'],
      ['tl-row', '#4421  timeline_shift   0.95  ACTIVE      "Payment API +3d"'],
      ['tl-row', '#4418  risk_flag        0.81  ACTIVE      "Sarah overload"'],
      ['tl-row', '#4402  assignment       0.66  COMPRESSED  "Payment API → Sarah"'],
      ['', ''],
      ['tl-hd', '[FILTERED OUT]'],
      ['tl-filt', '#4401  assignment       0.05  Superseded by #4420'],
      ['tl-filt', '#3990  requirement      0.04  Archived (>365 days)'],
      ['', ''],
      ['tl-hd', '[PREFERENCES APPLIED]'],
      ['tl-pref', 'assignment_override (conf 0.74) → Sarah prioritised'],
      ['tl-pref', 'communication_style (conf 0.78) → bullet format'],
      ['', ''],
      ['tl-q', '> The delay: requirement change (Jun 12) → overloaded'],
      ['tl-q', '  engineer → +40% duration → downstream shift of 3 days.'],
    ];
    let started = false;
    function startTerminal() {
      if (started) return;
      started = true;
      if (reduced || frozen()) {
        LINES.forEach(([cls, txt]) => {
          const ln = document.createElement('span');
          ln.className = 'ln ' + cls; ln.textContent = txt; term.appendChild(ln);
        });
        return;
      }
      const STEP = frozen() ? 0 : 9, LINE_GAP = frozen() ? 0 : 140;
      let li = 0;
      const cursor = document.createElement('span'); cursor.className = 't-cursor';
      (function nextLine() {
        if (li >= LINES.length) { cursor.remove(); return; }
        const [cls, txt] = LINES[li++];
        const ln = document.createElement('span');
        ln.className = 'ln ' + cls;
        term.appendChild(ln); term.appendChild(cursor);
        if (!txt) { setTimeout(nextLine, LINE_GAP || 1); return; }
        let ci = 0;
        (function typeChar() {
          ln.textContent = txt.slice(0, ++ci);
          ln.appendChild && term.appendChild(cursor);
          if (ci < txt.length) setTimeout(typeChar, STEP);
          else setTimeout(nextLine, LINE_GAP || 1);
        })();
      })();
    }
    new IntersectionObserver(([e]) => { if (e.isIntersecting) startTerminal(); }, { threshold: 0.35 }).observe(term);
    onFrozen.push(startTerminal);
  })();

  /* ---------- CTA ---------- */
  (function () {
    const h = $('#cta-h'), eyebrow = $('#cta-eyebrow');
    const reveal = () => {
      eyebrow.classList.add('flicker');
      h.classList.add('revealed');
      setTimeout(() => $('.forge', h).classList.add('lit'), (reduced || frozen()) ? 0 : 1500);
    };
    new IntersectionObserver(([e], ob) => {
      if (!e.isIntersecting) return;
      ob.disconnect();
      reveal();
    }, { threshold: 0.4 }).observe(h);
    onFrozen.push(reveal);
  })();
})();
