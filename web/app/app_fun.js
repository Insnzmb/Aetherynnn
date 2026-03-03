// -------------------- Fun Layer (cosmetic only) --------------------
// Adds Journal index, Codex discovery, Rumor Board, relationship heat, badges,
// loot provenance flavor, impact feedback, campfire recap, soundscape, and
// choice framing helpers.

(function(){
  'use strict';

  const $ = (id) => document.getElementById(id);

  // UI nodes (all optional)
  const journalToggleBtn = $('journalToggle');
  const journalPane = $('journalPane');
  const journalSearch = $('journalSearch');
  const journalClear = $('journalClear');
  const journalPinBtn = $('journalPin');
  const journalList = $('journalList');
  const threadList = $('threadList');

  const campfireBtn = $('campfireBtn');

  const rumorList = $('rumorList');

  const codexTabs = $('codexTabs');
  const codexPanelDiscover = $('codexPanelDiscover');
  const codexPanelSearch = $('codexPanelSearch');
  const codexPanelRelations = $('codexPanelRelations');
  const codexPanelBadges = $('codexPanelBadges');
  const codexDiscoverList = $('codexDiscoverList');

  const relName = $('relName');
  const relAdd = $('relAdd');
  const relList = $('relList');

  const badgeList = $('badgeList');

  // Soundscape settings
  const ambEnabled = $('ambEnabled');
  const ambAuto = $('ambAuto');
  const ambStyle = $('ambStyle');
  const ambIntensity = $('ambIntensity');

  const LS = {
    base: (roomId, runId, kind) => `aeth_fun_${kind}_${String(roomId||'').trim()}_${Number(runId||0) || 0}`,
    get: (k, fb='') => {
      try { return (typeof lsGet === 'function') ? lsGet(k, fb) : (localStorage.getItem(k) ?? fb); } catch { return fb; }
    },
    set: (k, v) => {
      try { return (typeof lsSet === 'function') ? lsSet(k, v) : localStorage.setItem(k, String(v)); } catch {}
    },
    del: (k) => {
      try { return (typeof lsDel === 'function') ? lsDel(k) : localStorage.removeItem(k); } catch {}
    }
  };

  function roomId(){
    try { return String(window.activeRoomId || '').trim() || String(window.roomEl?.value || '').trim() || 'solo'; } catch { return 'solo'; }
  }
  function runId(){
    try {
      if (typeof window.currentRunId === 'number') return window.currentRunId;
      if (typeof getRoomRunId === 'function') return getRoomRunId(roomId());
    } catch {}
    return 0;
  }

  function nowTs(){ return Date.now(); }

  function loadJson(key, fb){
    try {
      const raw = LS.get(key, '');
      if (!raw) return fb;
      const v = JSON.parse(raw);
      return (v && typeof v === 'object') ? v : fb;
    } catch { return fb; }
  }
  function saveJson(key, obj){
    try { LS.set(key, JSON.stringify(obj)); } catch {}
  }

  // -------------------- Fun state --------------------
  function loadState(){
    const rid = roomId();
    const rrun = runId();
    const st = {
      journal: loadJson(LS.base(rid, rrun, 'journal'), { entries: [], pinned: [] }),
      threads: loadJson(LS.base(rid, rrun, 'threads'), { open: [] }),
      codex: loadJson(LS.base(rid, rrun, 'codex'), { entries: [] }),
      relations: loadJson(LS.base(rid, rrun, 'relations'), { items: [] }),
      badges: loadJson(LS.base(rid, rrun, 'badges'), { unlocked: {} }),
      provenance: loadJson(LS.base(rid, rrun, 'prov'), { map: {} }),
      rumors: loadJson(LS.base(rid, rrun, 'rumors'), { list: [], idx: 0 }),
      ui: loadJson(LS.base(rid, rrun, 'ui'), { journalOpen: false, journalQuery: '', codexTab: 'discover' }),
    };
    return st;
  }

  let state = loadState();
  let stateKey = roomId() + "|" + runId();
  let lastInvSnap = Object.create(null);
  let lastEquipSnap = Object.create(null);
  let lastLoc = '';
  let rumorTimer = null;

  function persistAll(){
    const rid = roomId();
    const rrun = runId();
    saveJson(LS.base(rid, rrun, 'journal'), state.journal);
    saveJson(LS.base(rid, rrun, 'threads'), state.threads);
    saveJson(LS.base(rid, rrun, 'codex'), state.codex);
    saveJson(LS.base(rid, rrun, 'relations'), state.relations);
    saveJson(LS.base(rid, rrun, 'badges'), state.badges);
    saveJson(LS.base(rid, rrun, 'prov'), state.provenance);
    saveJson(LS.base(rid, rrun, 'rumors'), state.rumors);
    saveJson(LS.base(rid, rrun, 'ui'), state.ui);
  }



  function ensureStateCurrent(){
    try {
      const k = roomId() + "|" + runId();
      if (k !== stateKey) {
        stateKey = k;
        state = loadState();
        lastInvSnap = Object.create(null);
        lastEquipSnap = Object.create(null);
        lastLoc = '';
      }
    } catch {}
  }

  // -------------------- Helpers --------------------
  function pickLocFromTokens(tokens){
    try {
      if (typeof tokenValue === 'function') {
        const v = tokenValue(tokens || [], ['loc','world.location','location']);
        return String(v || '').trim();
      }
    } catch {}
    return '';
  }

  function pickRegionFromTokens(tokens){
    try {
      if (typeof tokenValue === 'function') {
        const v = tokenValue(tokens || [], ['region','biome']);
        return String(v || '').trim();
      }
    } catch {}
    return '';
  }

  function shortText(s, n=240){
    const t = String(s || '').replace(/\s+/g,' ').trim();
    if (!t) return '';
    return t.length <= n ? t : (t.slice(0, n-1) + '…');
  }

  function extractQuestions(text){
    const t = String(text || '').trim();
    if (!t) return [];
    const out = [];
    // direct question sentences
    for (const m of t.matchAll(/([^?.!\n]{8,}\?)/g)) {
      const q = String(m[1] || '').trim();
      if (q && q.length <= 180) out.push(q);
    }
    // If none, generate a light thread prompt
    if (!out.length) {
      const ent = extractEntities(t).filter(x => x.length >= 4)[0] || '';
      if (ent) out.push(`What is the truth behind “${ent}”?`);
      else out.push('What is the next thing this place is hiding?');
    }
    return uniq(out).slice(0, 2);
  }

  function extractEntities(text){
    const t = String(text || '');
    const out = [];
    // Simple proper-noun-ish capture; keep conservative.
    // Captures: Frostveil, Whitewater Echoes, Emberlands
    const rx = /\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){0,3})\b/g;
    for (const m of t.matchAll(rx)) {
      const s = String(m[1] || '').trim();
      if (!s) continue;
      // ignore sentence-start common words
      if (/^(The|A|An|And|But|Then|When|With|Without|You|Your|I|We|They|He|She|It)$/i.test(s)) continue;
      out.push(s);
    }
    return uniq(out).slice(0, 8);
  }

  function uniq(arr){
    const seen = new Set();
    const out = [];
    for (const a of (arr || [])) {
      const k = String(a || '').trim();
      if (!k) continue;
      const low = k.toLowerCase();
      if (seen.has(low)) continue;
      seen.add(low);
      out.push(k);
    }
    return out;
  }

  function tagBeat(text){
    const t = String(text || '').toLowerCase();
    const tags = [];
    const add = (x) => { if (!tags.includes(x)) tags.push(x); };

    if (/travel|road|path|journey|ride|sail|march/.test(t)) add('travel');
    if (/attack|fight|blood|wound|strike|battle|ambush/.test(t)) add('combat');
    if (/talk|negotiate|bargain|promise|plead|convince/.test(t)) add('social');
    if (/clue|mystery|strange|sigil|whisper|hidden|investigate|rumor/.test(t)) add('mystery');
    if (/rest|camp|sleep|recover/.test(t)) add('rest');
    if (/found|loot|picked up|took|acquired|received/.test(t)) add('loot');

    return tags.slice(0, 3);
  }

  function relationLabel(score){
    if (score <= -2) return 'Cold';
    if (score === -1) return 'Wary';
    if (score === 0) return 'Neutral';
    if (score === 1) return 'Warm';
    return 'Allied';
  }

  function scoreToPct(score){
    const s = Math.max(-2, Math.min(2, Number(score)||0));
    // map -2..+2 to 10..90
    return 50 + (s * 20);
  }

  // -------------------- Choice framing helper --------------------
  function classifyChoice(text){
    const t = String(text || '').toLowerCase();
    let approach = 'Clever';
    let risk = 'Medium';

    const has = (re) => re.test(t);

    if (has(/attack|strike|fight|kill|charge|smash|ambush/)) { approach='Bold'; risk='High'; }
    else if (has(/sneak|hide|steal|shadow|quiet|slip|crawl/)) { approach='Careful'; risk='Medium'; }
    else if (has(/talk|ask|plead|convince|negotiate|bargain|parley|apolog/)) { approach='Kind'; risk='Low'; }
    else if (has(/run|flee|escape|retreat/)) { approach='Careful'; risk='High'; }
    else if (has(/investigate|search|examine|study|analy|inspect|decode/)) { approach='Clever'; risk='Low'; }
    else if (has(/pray|listen|wait|rest|camp/)) { approach='Careful'; risk='Low'; }

    if (has(/risk|danger|forbid|curse|blood|dark|unknown|alone/)) risk = 'High';

    return { approach, risk };
  }

  // -------------------- Badges --------------------
  const BADGES = [
    { id:'dockwake', name:'Dockwake', desc:'You began. The world did not ask permission.' },
    { id:'fogwalker', name:'Fogwalker', desc:'You moved beyond the safe edges and kept going.' },
    { id:'keepit', name:'Keep It', desc:'Your first tangible find. Objects are promises.' },
    { id:'namesmatter', name:'Names Matter', desc:'A new entry in your Codex. The world gained a noun.' },
    { id:'oathbound', name:'Oathbound', desc:'You tracked a relationship. Memory is a weapon.' },
  ];

  function unlockBadge(id){
    try {
      if (!id) return;
      if (state.badges.unlocked[id]) return;
      state.badges.unlocked[id] = nowTs();
      persistAll();
      renderBadges();
      if (typeof window.toast === 'function') {
        const b = BADGES.find(x => x.id === id);
        window.toast(b ? b.name : 'Badge unlocked', 'success', 'Unlocked');
      }
    } catch {}
  }

  // -------------------- Rendering --------------------
  function renderThreads(){
    if (!threadList) return;
    threadList.innerHTML = '';
    const list = Array.isArray(state.threads.open) ? state.threads.open.slice(0, 8) : [];
    if (!list.length) {
      threadList.innerHTML = `<div class="subtle">No threads yet.</div>`;
      return;
    }
    for (const th of list) {
      const el = document.createElement('div');
      el.className = 'threadItem';
      el.innerHTML = `<div class="q"></div>`;
      el.querySelector('.q').textContent = String(th.q || '—');
      threadList.appendChild(el);
    }
  }

  function renderJournal(){
    if (!journalList) return;
    const q = String(state.ui.journalQuery || '').toLowerCase().trim();
    const entries = Array.isArray(state.journal.entries) ? state.journal.entries.slice().reverse() : [];
    const pinned = new Set((state.journal.pinned || []).map(String));

    const filtered = entries.filter(e => {
      if (!q) return true;
      const hay = (String(e.loc||'') + ' ' + String(e.text||'') + ' ' + String((e.tags||[]).join(' '))).toLowerCase();
      return hay.includes(q);
    });

    journalList.innerHTML = '';
    if (!filtered.length) {
      journalList.innerHTML = `<div class="subtle">No entries.</div>`;
      return;
    }

    const max = Math.min(120, filtered.length);
    for (let i = 0; i < max; i++) {
      const e = filtered[i];
      const el = document.createElement('div');
      el.className = 'journalItem';

      const dt = new Date(Number(e.ts || 0) || Date.now());
      const time = dt.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
      const tags = Array.isArray(e.tags) ? e.tags : [];

      el.innerHTML = `
        <div class="meta">
          <span class="loc"></span>
          <span class="time"></span>
          <span class="tags"></span>
        </div>
        <div class="body"></div>
        <div class="actions"></div>
      `;

      el.querySelector('.loc').textContent = e.loc || '—';
      el.querySelector('.time').textContent = time;
      el.querySelector('.body').textContent = e.text || '';

      const tagsEl = el.querySelector('.tags');
      if (tagsEl) {
        tagsEl.innerHTML = '';
        for (const t of tags) {
          const chip = document.createElement('span');
          chip.className = 'journalTag';
          chip.textContent = t;
          tagsEl.appendChild(chip);
        }
        if (pinned.has(String(e.id))) {
          const chip = document.createElement('span');
          chip.className = 'journalTag';
          chip.textContent = 'pinned';
          tagsEl.appendChild(chip);
        }
      }

      const actions = el.querySelector('.actions');
      if (actions) {
        const mk = (label, fn, cls='ghost small') => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = cls;
          b.textContent = label;
          b.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); fn(); });
          return b;
        };
        actions.appendChild(mk('Pin', () => pinEntry(e.id)));
        actions.appendChild(mk('Search', () => jumpCodexSearch(e.loc || '')));
      }

      journalList.appendChild(el);
    }
  }

  function renderCodexDiscover(){
    if (!codexDiscoverList) return;
    const entries = Array.isArray(state.codex.entries) ? state.codex.entries.slice().sort((a,b) => (Number(b.ts||0)-Number(a.ts||0))) : [];
    codexDiscoverList.innerHTML = '';
    if (!entries.length) {
      codexDiscoverList.innerHTML = `<div class="subtle">No discoveries yet.</div>`;
      return;
    }
    for (const e of entries.slice(0, 120)) {
      const el = document.createElement('div');
      el.className = 'codexDiscItem';
      const dt = new Date(Number(e.ts||0) || Date.now());
      const when = dt.toLocaleDateString([], { month:'short', day:'2-digit' });
      el.innerHTML = `<span class="kind"></span><span class="name"></span><span class="when"></span>`;
      el.querySelector('.kind').textContent = String(e.kind || 'entry');
      el.querySelector('.name').textContent = String(e.name || '—');
      el.querySelector('.when').textContent = when;
      el.addEventListener('click', () => jumpCodexSearch(e.name || ''));
      codexDiscoverList.appendChild(el);
    }
  }

  function renderRelations(){
    if (!relList) return;
    const items = Array.isArray(state.relations.items) ? state.relations.items.slice().sort((a,b) => String(a.name||'').localeCompare(String(b.name||''))) : [];
    relList.innerHTML = '';
    if (!items.length) {
      relList.innerHTML = `<div class="subtle">No relationships tracked yet.</div>`;
      return;
    }

    for (const r of items) {
      const score = Math.max(-2, Math.min(2, Number(r.score)||0));
      const el = document.createElement('div');
      el.className = 'relItem';
      el.innerHTML = `
        <div class="relTop"><span class="relName"></span><span class="relState"></span></div>
        <div class="relMeter"><div class="relFill"></div></div>
        <div class="relControls"></div>
      `;
      el.querySelector('.relName').textContent = r.name || '—';
      el.querySelector('.relState').textContent = relationLabel(score);
      el.querySelector('.relFill').style.width = scoreToPct(score) + '%';

      const controls = el.querySelector('.relControls');
      const mk = (label, fn) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'ghost small';
        b.textContent = label;
        b.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); fn(); });
        return b;
      };
      if (controls) {
        controls.appendChild(mk('−', () => setRelationScore(r.name, score - 1)));
        controls.appendChild(mk('+', () => setRelationScore(r.name, score + 1)));
        controls.appendChild(mk('Delete', () => deleteRelation(r.name)));
      }

      relList.appendChild(el);
    }
  }

  function renderBadges(){
    if (!badgeList) return;
    badgeList.innerHTML = '';
    for (const b of BADGES) {
      const unlocked = !!state.badges.unlocked[b.id];
      const el = document.createElement('div');
      el.className = 'badge' + (unlocked ? '' : ' locked');
      el.innerHTML = `<div class="bName"></div><div class="bDesc"></div>`;
      el.querySelector('.bName').textContent = b.name;
      el.querySelector('.bDesc').textContent = unlocked ? b.desc : 'Locked.';
      badgeList.appendChild(el);
    }
  }

  function renderRumors(){
    if (!rumorList) return;
    const list = Array.isArray(state.rumors.list) ? state.rumors.list : [];
    rumorList.innerHTML = '';
    if (!list.length) {
      rumorList.innerHTML = `<div class="subtle">No rumors yet. Play a beat and the board will fill.</div>`;
      return;
    }
    const start = Number(state.rumors.idx || 0) || 0;
    const slice = [];
    for (let i = 0; i < Math.min(5, list.length); i++) {
      slice.push(list[(start + i) % list.length]);
    }
    for (const r of slice) {
      const el = document.createElement('div');
      el.className = 'rumor';
      el.innerHTML = `<div class="rText"></div><div class="rMeta"></div>`;
      el.querySelector('.rText').textContent = r.text || '—';
      el.querySelector('.rMeta').textContent = (r.loc ? `Near ${r.loc}` : '—');
      rumorList.appendChild(el);
    }
  }

  // -------------------- Mutators --------------------
  function pinEntry(id){
    try {
      const sid = String(id || '').trim();
      if (!sid) return;
      const arr = Array.isArray(state.journal.pinned) ? state.journal.pinned : [];
      const has = arr.includes(sid);
      state.journal.pinned = has ? arr.filter(x => x !== sid) : [sid, ...arr].slice(0, 40);
      persistAll();
      renderJournal();
      if (typeof window.toast === 'function') window.toast(has ? 'Unpinned.' : 'Pinned.', 'info', 'Journal');
    } catch {}
  }

  function addThread(q){
    try {
      const txt = String(q || '').trim();
      if (!txt) return;
      const list = Array.isArray(state.threads.open) ? state.threads.open : [];
      const low = txt.toLowerCase();
      if (list.some(x => String(x.q||'').toLowerCase() == low)) return;
      state.threads.open = [{ q: txt, ts: nowTs() }, ...list].slice(0, 30);
      persistAll();
      renderThreads();
      if (typeof window.toast === 'function') window.toast(txt, 'info', 'Thread added');
    } catch {}
  }

  function addCodexEntry(kind, name, ts, opts = {}){
    try {
      const nm = String(name || '').trim();
      if (!nm) return false;
      const k = String(kind || 'entry').trim().toLowerCase();
      const list = Array.isArray(state.codex.entries) ? state.codex.entries : [];
      const low = nm.toLowerCase();
      if (list.some(e => String(e.name||'').toLowerCase() === low)) return false;
      state.codex.entries = [{ kind: k, name: nm, ts: Number(ts||nowTs()) }, ...list].slice(0, 250);
      persistAll();
      renderCodexDiscover();
      unlockBadge('namesmatter');
      if (!opts.silent && typeof window.toast === 'function') window.toast(nm, 'success', 'New Codex entry');
      return true;
    } catch { return false; }
  }

  function setRelationScore(name, score){
    try {
      const nm = String(name || '').trim();
      if (!nm) return;
      const list = Array.isArray(state.relations.items) ? state.relations.items : [];
      const s = Math.max(-2, Math.min(2, Number(score)||0));
      const idx = list.findIndex(x => String(x.name||'').toLowerCase() === nm.toLowerCase());
      if (idx === -1) list.push({ name: nm, score: s });
      else list[idx].score = s;
      state.relations.items = list;
      persistAll();
      renderRelations();
    } catch {}
  }

  function addRelation(name){
    try {
      const nm = String(name || '').trim();
      if (!nm) return;
      const list = Array.isArray(state.relations.items) ? state.relations.items : [];
      if (list.some(x => String(x.name||'').toLowerCase() === nm.toLowerCase())) return;
      state.relations.items = [{ name: nm, score: 0 }, ...list].slice(0, 80);
      persistAll();
      renderRelations();
      unlockBadge('oathbound');
      if (typeof window.toast === 'function') window.toast(nm, 'success', 'Relation tracked');
    } catch {}
  }

  function deleteRelation(name){
    try {
      const nm = String(name || '').trim();
      if (!nm) return;
      const list = Array.isArray(state.relations.items) ? state.relations.items : [];
      state.relations.items = list.filter(x => String(x.name||'').toLowerCase() !== nm.toLowerCase());
      persistAll();
      renderRelations();
    } catch {}
  }

  function jumpCodexSearch(query){
    try {
      const q = String(query || '').trim();
      if (!q) return;
      // Switch view to Codex + Search tab
      if (typeof window.setView === 'function') window.setView('codex');
      setCodexTab('search');
      const qEl = document.getElementById('codexQuery');
      if (qEl) qEl.value = q;
      // Trigger search if UI handler exists
      const go = document.getElementById('codexGo');
      if (go) go.click();
    } catch {}
  }

  // -------------------- Loot provenance --------------------
  function getItemProvenance(name){
    try {
      const nm = String(name || '').trim();
      if (!nm) return '';
      const key = nm.toLowerCase();
      return String(state.provenance.map[key] || '');
    } catch { return ''; }
  }

  function setItemProvenance(name, prov){
    try {
      const nm = String(name || '').trim();
      const pv = String(prov || '').trim();
      if (!nm || !pv) return;
      const key = nm.toLowerCase();
      if (state.provenance.map[key]) return; // keep first origin
      state.provenance.map[key] = pv;
      persistAll();
    } catch {}
  }

  function provLine(itemName, locStr){
    const nm = String(itemName || '').trim();
    const loc = String(locStr || '').trim();
    const low = nm.toLowerCase();

    const where = loc ? ` — ${loc}` : '';

    if (/(torch|lantern|lamp)/.test(low)) return `Resin-wrapped, smoke-scented${where}.`;
    if (/(sword|blade|dagger|knife)/.test(low)) return `Notched steel, honest wear${where}.`;
    if (/(coin|gold|silver|res)/.test(low)) return `Warm from too many hands${where}.`;
    if (/(rope|cord|line)/.test(low)) return `Fibers rough, well-oiled${where}.`;
    if (/(cloak|armor|mail|helm)/.test(low)) return `Stitched and scuffed${where}.`;
    return `Found with a story attached${where}.`;
  }

  // -------------------- Rumors --------------------
  function regenRumors(loc, entities){
    const l = String(loc || '').trim();
    const ent = Array.isArray(entities) ? entities : [];
    const e0 = ent[0] || 'a stranger';

    const list = [
      { text:`A lantern-light procession was seen near ${l || 'the old roads'}.`, loc:l },
      { text:`Someone is paying too much for scrap marked with a spiral sigil.`, loc:l },
      { text:`${e0} was mentioned in a whisper and then everyone changed the subject.`, loc:l },
      { text:`A door that wasn’t there yesterday is there now. Nobody agrees where.`, loc:l },
      { text:`The wind carries music at dusk—wrong notes, familiar rhythm.`, loc:l },
      { text:`A trader swears a map pin moved while they watched it.`, loc:l },
    ];

    state.rumors.list = uniq(list.map(x => x.text)).map(t => ({ text:t, loc:l }));
    state.rumors.idx = 0;
    persistAll();
    renderRumors();
  }

  function rotateRumors(){
    try {
      const list = Array.isArray(state.rumors.list) ? state.rumors.list : [];
      if (!list.length) return;
      state.rumors.idx = (Number(state.rumors.idx || 0) + 1) % list.length;
      persistAll();
      renderRumors();
    } catch {}
  }

  // -------------------- Soundscape (generated locally) --------------------
  let audio = {
    ctx: null,
    gain: null,
    src: null,
    filter: null,
    lfo: null,
    lfoGain: null,
    style: 'off',
  };

  function loadAmbSettings(){
    const raw = LS.get('aeth_amb_v1', '');
    const d = { enabled:false, auto:true, style:'auto', intensity:0.35 };
    try {
      if (!raw) return d;
      const p = JSON.parse(raw);
      return { ...d, ...(p||{}) };
    } catch { return d; }
  }

  let amb = loadAmbSettings();

  function saveAmb(){
    try { LS.set('aeth_amb_v1', JSON.stringify(amb)); } catch {}
  }

  function ensureAudio(){
    try {
      if (audio.ctx) return true;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      audio.ctx = new Ctx();
      audio.gain = audio.ctx.createGain();
      audio.gain.gain.value = 0;
      audio.gain.connect(audio.ctx.destination);
      return true;
    } catch { return false; }
  }

  function makeNoiseBuffer(ctx, seconds=2){
    const sr = ctx.sampleRate;
    const len = Math.max(1, Math.floor(sr * seconds));
    const buf = ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i=0;i<len;i++) data[i] = (Math.random()*2-1) * 0.7;
    return buf;
  }

  function startAmbient(style){
    if (!ensureAudio()) return;
    const ctx = audio.ctx;
    if (!ctx) return;

    stopAmbient();

    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(ctx, 2.4);
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';

    const gain = ctx.createGain();
    gain.gain.value = 0;

    // LFO to gently move the filter for life.
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 120;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    // Style tuning
    const s = String(style || 'wind');
    if (s === 'forest') { filter.type='bandpass'; filter.frequency.value = 850; lfo.frequency.value = 0.12; lfoGain.gain.value = 180; }
    else if (s === 'desert') { filter.type='lowpass'; filter.frequency.value = 520; lfo.frequency.value = 0.06; lfoGain.gain.value = 120; }
    else if (s === 'sea') { filter.type='lowpass'; filter.frequency.value = 420; lfo.frequency.value = 0.045; lfoGain.gain.value = 140; }
    else if (s === 'ruins') { filter.type='bandpass'; filter.frequency.value = 320; lfo.frequency.value = 0.05; lfoGain.gain.value = 90; }
    else if (s === 'city') { filter.type='bandpass'; filter.frequency.value = 1200; lfo.frequency.value = 0.10; lfoGain.gain.value = 220; }
    else { filter.type='lowpass'; filter.frequency.value = 700; lfo.frequency.value = 0.08; lfoGain.gain.value = 140; }

    src.connect(filter);
    filter.connect(gain);
    gain.connect(audio.gain);

    lfo.start();
    src.start();

    audio.src = src;
    audio.filter = filter;
    audio.lfo = lfo;
    audio.lfoGain = lfoGain;
    audio.style = s;

    setAmbientIntensity(amb.intensity);
  }

  function stopAmbient(){
    try { audio.src && audio.src.stop(); } catch {}
    try { audio.lfo && audio.lfo.stop(); } catch {}
    audio.src = null;
    audio.filter = null;
    audio.lfo = null;
    audio.lfoGain = null;
    audio.style = 'off';
  }

  function setAmbientIntensity(v){
    try {
      if (!audio.gain) return;
      const x = Math.max(0, Math.min(1, Number(v) || 0));
      // gentle scaling
      audio.gain.gain.value = x * 0.22;
    } catch {}
  }

  function chooseAmbientStyle(tokens){
    const loc = pickLocFromTokens(tokens);
    const region = pickRegionFromTokens(tokens);
    const t = (loc + ' ' + region).toLowerCase();

    if (/desert|dune|sand|emberlands|cinder/.test(t)) return 'desert';
    if (/tropic|jungle|verdant|forest|wald/.test(t)) return 'forest';
    if (/sea|coast|dock|harbor|fjord|water/.test(t)) return 'sea';
    if (/ruin|crypt|cathedral|vault/.test(t)) return 'ruins';
    if (/city|market|street|district/.test(t)) return 'city';
    return 'wind';
  }

  function syncSoundUi(){
    if (ambEnabled) ambEnabled.checked = !!amb.enabled;
    if (ambAuto) ambAuto.checked = !!amb.auto;
    if (ambStyle) ambStyle.value = String(amb.style || 'auto');
    if (ambIntensity) ambIntensity.value = String(Math.max(0, Math.min(1, Number(amb.intensity)||0.35)));
  }

  function applySoundFromTokens(tokens){
    if (!amb.enabled) { stopAmbient(); return; }
    const wanted = (amb.style && amb.style !== 'auto') ? amb.style : (amb.auto ? chooseAmbientStyle(tokens) : 'wind');
    if (!wanted) return;
    if (audio.style !== wanted) startAmbient(wanted);
    setAmbientIntensity(amb.intensity);
  }

  // -------------------- Hooks --------------------
  function onTokens(tokens){
    try { ensureStateCurrent(); } catch {}
    try {
      const loc = pickLocFromTokens(tokens);
      if (loc && loc !== lastLoc) {
        // Milestone: left START
        if (lastLoc && lastLoc.toUpperCase() === 'START' && loc.toUpperCase() !== 'START') unlockBadge('fogwalker');
        lastLoc = loc;
      }
      applySoundFromTokens(tokens);
    } catch {}
  }

  function onNarration({ payload, narration, choices }){
    try { ensureStateCurrent(); } catch {}
    try {
      // Ensure per-room state tracks room/run changes.
      const rid = roomId();
      const rrun = runId();
      const baseKey = LS.base(rid, rrun, 'journal');
      // If loadState was from a different room/run, reload.
      if (!LS.get(baseKey, '')) {
        state = loadState();
      }

      const tokens = Array.isArray(payload?.canon_tokens) ? payload.canon_tokens : (window.currentCanonTokens || []);
      const loc = pickLocFromTokens(tokens) || lastLoc || '—';
      lastLoc = loc || lastLoc;

      const text = String(narration || '').trim();
      if (!text) return;

      // Impact feedback
      const low = text.toLowerCase();
      if (/blood|scream|danger|ambush|death|curse|shadow\b|panic/.test(low)) {
        try { if (typeof window.pulseDanger === 'function') window.pulseDanger(); } catch {}
      }

      const entry = {
        id: String(nowTs()) + '_' + Math.floor(Math.random()*9999),
        ts: nowTs(),
        loc,
        text: shortText(text, 320),
        tags: tagBeat(text),
        choices: Array.isArray(choices) ? choices.slice(0, 8) : [],
        from: String(payload?.from || 'GM')
      };

      const entries = Array.isArray(state.journal.entries) ? state.journal.entries : [];
      state.journal.entries = [...entries, entry].slice(-300);

      // Thread extraction
      for (const q of extractQuestions(text)) addThread(q);
      // Codex unlocks (cap feedback so it doesn't spam)
      const newly = [];
      if (loc && loc !== '—') {
        if (addCodexEntry('place', loc, entry.ts, { silent: true })) newly.push(loc);
      }
      for (const ent of extractEntities(text)) {
        const kind = (/order|guild|clan|house|court|legion/i.test(ent)) ? 'faction' : 'name';
        if (addCodexEntry(kind, ent, entry.ts, { silent: true })) newly.push(ent);
      }
      if (newly.length && typeof window.toast === 'function') {
        const head = newly[0];
        const more = newly.length > 1 ? ` (+${newly.length - 1})` : '';
        window.toast(`${head}${more}`, 'success', 'New Codex');
      }

      // Rumors refresh
      regenRumors(loc, extractEntities(text));

      // Badges
      unlockBadge('dockwake');

      persistAll();
      renderThreads();
      renderJournal();
      renderCodexDiscover();
      renderBadges();
      renderRelations();
      renderRumors();

    } catch {}
  }

  function onInventoryChange(items){
    try { ensureStateCurrent(); } catch {}
    try {
      const list = Array.isArray(items) ? items : [];
      const snap = Object.create(null);
      for (const it of list) {
        const nm = String(it?.name || '').trim();
        if (!nm) continue;
        const q = Math.max(0, Math.floor(Number(it?.qty || 0)));
        snap[nm.toLowerCase()] = q;
      }

      const loc = pickLocFromTokens(window.currentCanonTokens || []) || lastLoc || '';

      // detect gains
      for (const [k, q] of Object.entries(snap)) {
        const prev = Number(lastInvSnap[k] || 0);
        if (q > prev) {
          const name = list.find(x => String(x?.name||'').toLowerCase() === k)?.name || k;
          const prov = provLine(name, loc);
          setItemProvenance(name, prov);
          if (typeof window.toast === 'function') window.toast(`${name} ×${q - prev}`, 'success', 'Loot');
          unlockBadge('keepit');
        }
      }

      lastInvSnap = snap;
    } catch {}
  }

  function onEquipmentChange(items){
    try { ensureStateCurrent(); } catch {}
    try {
      const list = Array.isArray(items) ? items : [];
      const snap = Object.create(null);
      for (const it of list) {
        const slot = String(it?.slot || '').trim().toLowerCase();
        const nm = String(it?.name || '').trim();
        if (!slot) continue;
        snap[slot] = nm;
      }
      // detect changes
      const changed = [];
      for (const [slot, nm] of Object.entries(snap)) {
        if (String(lastEquipSnap[slot] || '') !== String(nm || '')) changed.push({slot,nm});
      }
      if (changed.length && typeof window.toast === 'function') {
        const c = changed[0];
        window.toast(`${c.slot.toUpperCase()}: ${c.nm || '—'}`, 'info', 'Equipped');
      }
      lastEquipSnap = snap;
    } catch {}
  }

  // -------------------- Campfire recap --------------------
  function campfireRecap(){
    try {
      const entries = Array.isArray(state.journal.entries) ? state.journal.entries : [];
      if (!entries.length) {
        if (typeof window.toast === 'function') window.toast('No beats yet.', 'warn', 'Campfire');
        return;
      }
      const last = entries[entries.length - 1];
      const prev = entries.length >= 2 ? entries[entries.length - 2] : null;
      const th = Array.isArray(state.threads.open) ? state.threads.open[0] : null;

      const recap = [];
      recap.push(`Recap. ${prev ? prev.text + ' ' : ''}${last.text}`);
      if (th && th.q) recap.push(`Thread. ${th.q}`);
      recap.push('Next beat: follow the loudest clue, or the quietest fear.');

      const text = recap.join(' ');

      if (window.AETH_TTS && typeof window.AETH_TTS.speak === 'function') {
        window.AETH_TTS.speak(text, { interrupt: true });
      } else {
        if (typeof window.toast === 'function') window.toast(text, 'info', 'Campfire');
      }

    } catch {}
  }

  // -------------------- UI wiring --------------------
  function setJournalOpen(on){
    const yes = !!on;
    state.ui.journalOpen = yes;
    try { document.body.classList.toggle('journal-open', yes); } catch {}
    persistAll();
  }

  function setCodexTab(tab){
    const t = String(tab || 'discover');
    state.ui.codexTab = t;

    // buttons
    try {
      const btns = codexTabs ? Array.from(codexTabs.querySelectorAll('.codexTab[data-codextab]')) : [];
      for (const b of btns) {
        const k = String(b.getAttribute('data-codextab') || '');
        const on = (k === t);
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      }
    } catch {}

    // panels
    try {
      const set = (el, on) => el && el.classList.toggle('active', !!on);
      set(codexPanelDiscover, t === 'discover');
      set(codexPanelSearch, t === 'search');
      set(codexPanelRelations, t === 'relations');
      set(codexPanelBadges, t === 'badges');
    } catch {}

    persistAll();
  }

  // Expose a tiny API for the rest of the app.
  window.AETH_FUN = {
    onNarration,
    onTokens,
    onInventoryChange,
    onEquipmentChange,
    getItemProvenance,
    classifyChoice,
    setCodexTab,
  };

  // Initial UI sync
  function init(){
    try {
      // Restore UI state
      document.body.classList.toggle('journal-open', !!state.ui.journalOpen);
      if (journalSearch) journalSearch.value = String(state.ui.journalQuery || '');

      // Journal toggle
      journalToggleBtn?.addEventListener('click', () => setJournalOpen(!document.body.classList.contains('journal-open')));
      journalClear?.addEventListener('click', () => { if (journalSearch) journalSearch.value=''; state.ui.journalQuery=''; persistAll(); renderJournal(); });
      journalSearch?.addEventListener('input', () => { state.ui.journalQuery = String(journalSearch.value||''); persistAll(); renderJournal(); });
      journalPinBtn?.addEventListener('click', () => {
        const entries = Array.isArray(state.journal.entries) ? state.journal.entries : [];
        const last = entries.length ? entries[entries.length-1] : null;
        if (last) pinEntry(last.id);
      });

      campfireBtn?.addEventListener('click', campfireRecap);

      // Codex tabs
      if (codexTabs) {
        codexTabs.addEventListener('click', (ev) => {
          const btn = ev?.target?.closest?.('.codexTab[data-codextab]');
          if (!btn) return;
          const tab = String(btn.getAttribute('data-codextab')||'');
          if (tab) setCodexTab(tab);
        });
      }

      // Relations
      relAdd?.addEventListener('click', () => {
        const nm = String(relName?.value || '').trim();
        if (!nm) return;
        addRelation(nm);
        if (relName) relName.value = '';
      });
      relName?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          relAdd?.click();
        }
      });

      // Soundscape controls
      syncSoundUi();
      ambEnabled?.addEventListener('change', () => {
        amb.enabled = !!ambEnabled.checked;
        saveAmb();
        applySoundFromTokens(window.currentCanonTokens || []);
      });
      ambAuto?.addEventListener('change', () => {
        amb.auto = !!ambAuto.checked;
        saveAmb();
        applySoundFromTokens(window.currentCanonTokens || []);
      });
      ambStyle?.addEventListener('change', () => {
        amb.style = String(ambStyle.value || 'auto');
        saveAmb();
        applySoundFromTokens(window.currentCanonTokens || []);
      });
      ambIntensity?.addEventListener('input', () => {
        amb.intensity = Math.max(0, Math.min(1, Number(ambIntensity.value || 0.35)));
        saveAmb();
        setAmbientIntensity(amb.intensity);
      });

      // Unlock audio on first user gesture (browser autoplay rules)
      try {
        document.addEventListener('pointerdown', async () => {
          try {
            if (!amb.enabled) return;
            if (!ensureAudio()) return;
            if (audio.ctx && audio.ctx.state === "suspended") await audio.ctx.resume();
            applySoundFromTokens(window.currentCanonTokens || []);
          } catch {}
        }, { once: true });
      } catch {}


      // Rumor rotation
      if (rumorTimer) clearInterval(rumorTimer);
      rumorTimer = setInterval(rotateRumors, 18000);

      // Default codex tab
      setCodexTab(state.ui.codexTab || 'discover');

      renderThreads();
      renderJournal();
      renderCodexDiscover();
      renderRelations();
      renderBadges();
      renderRumors();

      // Apply sound for current tokens
      applySoundFromTokens(window.currentCanonTokens || []);

    } catch {}
  }

  // Run now (scripts load at end of body)
  init();

})();
