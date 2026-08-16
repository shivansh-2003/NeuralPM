/* ============================================================
   NeuralPM — runtime bootstrap loader (dual-mode)
   - Dev: fetches modules from relative paths, React/Babel from CDN.
   - Bundled (standalone): the super_inline_html bundler exposes each
     declared ext-resource-dependency as window.__resources[id] (a blob
     URL). We prefer those so the file works fully offline.
   Everything is fetched as text and executed as an inline <script>
   (JSX transformed by Babel first) to avoid blob-MIME execution issues.
   ============================================================ */
(function () {
  function R(id, fallback) {
    return (window.__resources && window.__resources[id]) || fallback;
  }
  function injectJS(code) {
    var el = document.createElement('scr' + 'ipt');
    el.textContent = code;
    document.head.appendChild(el);   // executes synchronously
  }
  async function fetchText(url) {
    var res = await fetch(url);
    if (!res.ok) throw new Error('Fetch ' + url + ' -> ' + res.status);
    return res.text();
  }
  var CDN = [
    ['react',    'https://unpkg.com/react@18.3.1/umd/react.development.js'],
    ['reactDom', 'https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js'],
    ['babel',    'https://unpkg.com/@babel/standalone@7.29.0/babel.min.js']
  ];
  var MODS = [
    ['data',       'data.js',        false],
    ['components', 'components.jsx', true],
    ['charts',     'charts.jsx',     true],
    ['nav',        'nav.jsx',        true],
    ['tasks',      'tasks.jsx',      true],
    ['assignment', 'assignment.jsx', true],
    ['chatbot',    'chatbot.jsx',    true],
    ['insights',   'insights.jsx',   true],
    ['cascade',    'cascade.jsx',    true],
    ['members',    'members.jsx',    true],
    ['settings',   'settings.jsx',   true],
    ['chatpage',   'chatpage.jsx',   true],
    ['app',        'app.jsx',        true]
  ];
  function fail(e) {
    console.error(e);
    var r = document.getElementById('root');
    if (r) r.innerHTML = '<pre style="color:#FF6B6B;padding:24px;font-family:monospace;white-space:pre-wrap">'
      + 'NeuralPM failed to load:\n' + (e && e.stack ? e.stack : e) + '</pre>';
  }
  (async function () {
    try {
      for (var i = 0; i < CDN.length; i++) {
        injectJS(await fetchText(R(CDN[i][0], CDN[i][1])));
      }
      for (var j = 0; j < MODS.length; j++) {
        var m = MODS[j];
        var code = await fetchText(R(m[0], m[1]));
        if (m[2]) code = Babel.transform(code, { presets: ['react'], filename: m[1] }).code;
        injectJS(code);
      }
    } catch (e) { fail(e); }
  })();
})();
