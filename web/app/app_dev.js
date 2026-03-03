// -------------------- DEV CONSOLE (AI TRACE) --------------------
// Enabled only when the server exposes DEV_BUILD=on.
// Safe in release builds: it stays hidden and inert.

(function(){
  const devBtn = document.getElementById('devBtn');
  const devPanel = document.getElementById('devPanel');
  const devClose = document.getElementById('devClose');
  const devClear = document.getElementById('devClear');
  const devCopy = document.getElementById('devCopy');
  const devLogEl = document.getElementById('devLog');
  const devMetaLine = document.getElementById('devMetaLine');

  if (!devBtn || !devPanel || !devLogEl) return;

  let DEV_ENABLED = false;
  // Force the DEV UI (button + panel) to appear even when the server is not in DEV_BUILD.
  // Useful when someone says "dev mode isn't working" — they can open the panel and see why.
  // Enable by adding ?devui=1 once (it persists via localStorage), or Ctrl+Shift+D.
  let DEV_UI_FORCED = false;
  try {
    const u = new URL(String(window.location.href || ''));
    const q = String(u.searchParams.get('devui') || '').toLowerCase();
    if (q === '1' || q === 'on' || q === 'true' || q === 'yes') {
      try { localStorage.setItem('AETHERYN_DEV_UI', 'on'); } catch {}
    }
    DEV_UI_FORCED = (function(){
      try { return String(localStorage.getItem('AETHERYN_DEV_UI') || '').toLowerCase() === 'on'; } catch { return false; }
    })();
  } catch {}

  let lines = [];
  const MAX_LINES = 900;
  let pollTimer = null;

  function devUiActive(){
    return DEV_ENABLED || DEV_UI_FORCED;
  }

  function fmtTs(ts){
    try {
      const d = new Date(Number(ts || Date.now()));
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '.' + String(d.getMilliseconds()).padStart(3,'0');
    } catch { return String(ts || ''); }
  }

  function fmtEvt(e){
    const type = String(e?.type || 'event');
    const role = e?.role ? String(e.role) : '';
    const purpose = e?.purpose ? String(e.purpose) : '';
    const ms = (e?.ms != null) ? `${Math.round(Number(e.ms))}ms` : '';
    const msg = e?.message || e?.msg || '';
    const detail = e?.detail || '';

    const bits = [type];
    if (role) bits.push(role);
    if (purpose) bits.push(`(${purpose})`);
    if (ms) bits.push(ms);

    let tail = '';
    if (msg) tail = String(msg);
    else if (detail) tail = String(detail);
    else if (e?.error) tail = String(e.error);

    // compact summary for llm_* events
    if (type === 'llm_start') {
      const p = e?.provider ? String(e.provider) : '';
      const m = e?.model ? String(e.model) : '';
      const pc = (e?.promptChars != null) ? `prompt=${e.promptChars}` : '';
      const mt = (e?.maxTokens != null) ? `maxTok=${e.maxTokens}` : '';
      const to = (e?.timeoutMs != null) ? `timeout=${e.timeoutMs}` : '';
      tail = [p, m, pc, mt, to].filter(Boolean).join(' • ');
    }
    if (type === 'llm_done') {
      const rc = (e?.replyChars != null) ? `reply=${e.replyChars}` : '';
      tail = [rc].filter(Boolean).join(' ');
    }


    // Why the server is retrying (unified firewall / parsing).
    if (type === 'unified_reject') {
      const stage = e?.stage ? String(e.stage) : '';
      const at = (e?.attempt != null) ? String(e.attempt) : '';
      const pur = e?.purpose ? String(e.purpose) : '';
      const k = (e?.k != null) ? String(e.k) : '';
      const errs = Array.isArray(e?.errors) ? e.errors : [];
      const warns = Array.isArray(e?.warnings) ? e.warnings : [];
      const msg2 = e?.message ? String(e.message) : '';
      const lines2 = [];
      const meta = [];
      if (pur) meta.push(`purpose=${pur}`);
      if (stage) meta.push(`stage=${stage}`);
      if (at) meta.push(`attempt=${at}`);
      if (k) meta.push(`k=${k}`);
      if (meta.length) lines2.push(meta.join(' '));
      if (errs.length) {
        lines2.push('Errors:');
        for (const x of errs.slice(0, 12)) lines2.push(`- ${String(x)}`);
      } else if (msg2) {
        lines2.push(`Error: ${msg2}`);
      }
      if (warns.length) {
        lines2.push('Warnings:');
        for (const x of warns.slice(0, 8)) lines2.push(`- ${String(x)}`);
      }
      if (e?.sample) {
        lines2.push('Sample:');
        lines2.push(String(e.sample));
      }
      tail = lines2.join('\n');
    }

    if (type === 'unified_note') {
      const pur = e?.purpose ? String(e.purpose) : '';
      const at = (e?.attempt != null) ? `attempt=${e.attempt}` : '';
      tail = [pur ? `purpose=${pur}` : '', at, String(e?.message || '')].filter(Boolean).join(' ');
    }

    const head = `[${fmtTs(e?.ts)}] ${bits.join(' ')}${e?.id ? ` #${String(e.id).slice(0,8)}` : ''}`;
    return tail ? `${head} — ${tail}` : head;
  }

  function render(){
    if (!devLogEl) return;
    devLogEl.textContent = lines.join('\n');
    devLogEl.scrollTop = devLogEl.scrollHeight;
  }

  function addLine(s){
    lines.push(String(s || ''));
    while (lines.length > MAX_LINES) lines.shift();
    render();
  }

  async function refreshStatus(){
    if (!devUiActive()) return;
    try {
      const rid = (typeof activeRoomId !== 'undefined' && activeRoomId) ? String(activeRoomId) : '';
      const url = rid ? `/api/dev/status?roomId=${encodeURIComponent(rid)}` : '/api/dev/status';
      const resp = await fetch(url);
      const data = await resp.json().catch(()=>({}));
      const pending = Array.isArray(data?.pending) ? data.pending : [];
      const pendLine = pending.length
        ? `Pending: ${pending.length}  |  ` + pending.map(p => `${p.role || 'llm'}${p.purpose ? ':'+p.purpose : ''} ${Math.round((p.age_ms||0)/1000)}s`).slice(0,6).join(' • ')
        : 'Pending: 0';
      if (devMetaLine) {
        const flag = (data?.dev === true) ? 'DEV_BUILD=on' : 'DEV_BUILD=off';
        devMetaLine.textContent = `${pendLine}  |  Log size: ${data?.log_size || 0}  |  ${flag}`;
      }
    } catch {
      if (devMetaLine) devMetaLine.textContent = 'DEV: status unavailable (server not running?)';
    }
  }

  async function pullRecent(){
    if (!devUiActive()) return;
    try {
      const rid = (typeof activeRoomId !== 'undefined' && activeRoomId) ? String(activeRoomId) : '';
      const url = rid ? `/api/dev/log?roomId=${encodeURIComponent(rid)}&limit=250` : '/api/dev/log?limit=250';
      const resp = await fetch(url);
      const data = await resp.json().catch(()=>({}));
      const evts = Array.isArray(data?.events) ? data.events : [];
      for (const e of evts) addLine(fmtEvt(e));
    } catch {}
  }

  function open(){
    devPanel.classList.remove('hidden');
    if (!DEV_ENABLED) {
      addLine(`[${fmtTs(Date.now())}] DEV UI is visible, but the server is NOT in DEV_BUILD.`);
      addLine(`Enable it by launching with RUN_WINDOWS_DEV.bat / RUN_MAC_LINUX_DEV.sh, OR set DEV_BUILD=on in server/.env and restart.`);
    }
    pullRecent();
    refreshStatus();
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(refreshStatus, 1500);
  }
  function close(){
    devPanel.classList.add('hidden');
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  devBtn.addEventListener('click', () => {
    if (devPanel.classList.contains('hidden')) open();
    else close();
  });
  devClose?.addEventListener('click', close);
  devPanel?.addEventListener('click', (e) => {
    // click-outside closes
    if (e.target === devPanel) close();
  });
  window.addEventListener('keydown', (e) => {
    // Ctrl+Shift+D toggles visibility of the DEV UI (persists in localStorage).
    try {
      if (e.key && String(e.key).toLowerCase() === 'd' && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        DEV_UI_FORCED = !DEV_UI_FORCED;
        try { localStorage.setItem('AETHERYN_DEV_UI', DEV_UI_FORCED ? 'on' : 'off'); } catch {}
        if (DEV_UI_FORCED) {
          devBtn.classList.remove('hidden');
          addLine(`[${fmtTs(Date.now())}] DEV UI forced ON (Ctrl+Shift+D).`);
          if (!DEV_ENABLED) addLine(`Server DEV_BUILD is still off — launch the DEV script or set DEV_BUILD=on in server/.env.`);
        } else {
          if (!DEV_ENABLED) devBtn.classList.add('hidden');
          close();
        }
      }
    } catch {}
    if (e.key === 'Escape' && !devPanel.classList.contains('hidden')) close();
  });

  devClear?.addEventListener('click', () => {
    lines = [];
    render();
    refreshStatus();
  });
  devCopy?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      addLine(`[${fmtTs(Date.now())}] copied to clipboard`);
    } catch {
      addLine(`[${fmtTs(Date.now())}] copy failed (browser clipboard blocked)`);
    }
  });

  async function boot(){
    try {
      const resp = await fetch('/api/dev/status');
      const data = await resp.json().catch(()=>({}));
      DEV_ENABLED = data?.dev === true;
      if (DEV_ENABLED || DEV_UI_FORCED) {
        devBtn.classList.remove('hidden');
      }
      if (DEV_ENABLED) addLine(`[${fmtTs(Date.now())}] DEV console enabled (server DEV_BUILD=on)`);
      else if (DEV_UI_FORCED) addLine(`[${fmtTs(Date.now())}] DEV UI forced ON (server DEV_BUILD=off)`);
    } catch {
      DEV_ENABLED = false;
      if (DEV_UI_FORCED) {
        devBtn.classList.remove('hidden');
        addLine(`[${fmtTs(Date.now())}] DEV UI forced ON (server status unavailable)`);
      }
    }

    // Live stream via socket.io if available
    const attach = () => {
      try {
        if (!DEV_ENABLED) return;
        if (!socket || typeof socket.on !== 'function') return;
        if (socket.__devAttached) return;
        socket.__devAttached = true;
        socket.on('dev_event', (evt) => {
          try { addLine(fmtEvt(evt)); } catch { addLine(String(evt || 'dev_event')); }
        });
      } catch {}
    };

    // attach now + later (socket is created after joining)
    attach();
    setInterval(attach, 800);
  }

  boot();
})();
