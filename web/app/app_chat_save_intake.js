// -------------------- Party Chat (OOC) --------------------
function addOocMsg(payload){
  if (!chatLogEl) return;
  const from = String(payload?.from || 'Anonymous');
  const text = String(payload?.text || '');
  const ts = Number(payload?.ts || Date.now());

  const el = document.createElement('div');
  el.className = 'oocMsg';
  el.innerHTML = `
    <div class="oocMeta">
      <span>${escapeHtml(from)}</span>
      <span>${new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    </div>
    <div class="oocBody">${escapeHtml(text).replace(/\n/g, '<br>')}</div>
  `;

  chatLogEl.appendChild(el);
  chatLogEl.scrollTop = chatLogEl.scrollHeight;
}

function setOocHistory(list){
  if (!chatLogEl) return;
  chatLogEl.innerHTML = '';
  (Array.isArray(list) ? list : []).slice(-200).forEach(addOocMsg);
}

function sendOoc(){
  const t = String(chatInputEl?.value || '').trim();
  if (!t) return;
  if (socket && activeRoomId) socket.emit('ooc_message', { text: t });
  else addOocMsg({ from: 'LOCAL', text: t, ts: Date.now() });
  if (chatInputEl) chatInputEl.value = '';
}

chatSendBtn?.addEventListener('click', sendOoc);
chatInputEl?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendOoc();
  }
});
function renderBookHtml(rawText) {
  const raw = String(rawText || "").trim();
  if (!raw) {
    return `<article class="bookPage"><div class="bookEmpty">(Book is empty yet — play a scene and it will appear here.)</div></article>`;
  }

  const blocks = raw.split(/\n\s*\n+/g).map(b => String(b || "").trim()).filter(Boolean);

  let html = `<article class="bookPage">`;
  let dropNext = true;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const norm = block.split(/\n+/g).map(l => l.trim()).join(" ").trim();

    // Chapter start: "Chapter N"
    if (/^Chapter\s+\d+$/i.test(norm)) {
      html += `<header class="bk-chapterHeader">`;
      html += `<div class="bk-ornament" aria-hidden="true">✦ ✦ ✦</div>`;
      html += `<div class="bk-chapterKicker">${escapeHtml(norm)}</div>`;
      html += `</header>`;
      dropNext = true;
      continue;
    }

    // Scene header: "— Scene N —"
    if (/^—\s*Scene\s+\d+\s*—$/i.test(norm)) {
      const m = norm.match(/Scene\s+(\d+)/i);
      const n = m ? m[1] : "";
      html += `<div class="bk-scene">`;
      html += `<div class="bk-divider" aria-hidden="true">✦ ✦ ✦</div>`;
      html += `<div class="bk-sceneLabel">Scene ${escapeHtml(n)}</div>`;
      html += `</div>`;
      dropNext = true;
      continue;
    }

    // Chapter title at end: "Chapter N: Title"
    if (/^Chapter\s+\d+\s*:\s+.+/i.test(norm)) {
      html += `<footer class="bk-chapterEnd">`;
      html += `<div class="bk-ornament" aria-hidden="true">✦ ✦ ✦</div>`;
      html += `<div class="bk-chapterEndTitle">${escapeHtml(norm)}</div>`;
      html += `</footer>`;
      dropNext = true;
      continue;
    }

    // Paragraph
    const safe = escapeHtml(block).replace(/\n/g, "<br>");
    const cls = ["bk-p", dropNext ? "bk-dropcap" : ""].filter(Boolean).join(" ");
    html += `<p class="${cls}">${safe}</p>`;
    dropNext = false;
  }

  html += `</article>`;
  return html;
}

function setBookText(txt) {
  if (!bookTextEl) return;
  const t = String(txt || "");
  if (uiState.readerMode) {
    bookTextEl.innerHTML = renderBookHtml(t);
  } else {
    bookTextEl.textContent = t || "(Book is empty yet — play a scene and it will appear here.)";
  }
}

// -------------------- Prose self-heal (client-side) --------------------
// If a device lands in PLAY with choices but no starting scene, request a server-authored local kickoff.
// This is deliberately dumb and reliable.
const __PROLOGUE_SIG = 'Aetheryn did not begin as a story.';

function _looksLikePrologueOnly(txt) {
  const s = String(txt || '').trim();
  if (!s) return true;
  const idx = s.indexOf(__PROLOGUE_SIG);
  // If we see the signature and not much else beyond it, treat as prologue-only.
  if (idx >= 0) {
    const rest = s.slice(idx + __PROLOGUE_SIG.length).replace(/\s+/g, ' ').trim();
    return rest.length < 180;
  }
  return false;
}

function _getLastVisibleLogText(roomId) {
  try {
    const rid = String(roomId || activeRoomId || '').trim();
    const visible = (typeof _visiblePlayStream === 'function') ? _visiblePlayStream(rid) : null;
    const arr = Array.isArray(visible?.arr) ? visible.arr : [];
    if (arr.length) return String(arr[arr.length - 1]?.text || '').trim();

    const store = window.AETH_LOG && window.AETH_LOG.store;
    if (!rid || !(store instanceof Map)) return '';
    const st = store.get(rid);
    if (!st) return '';

    const shared = (st && Array.isArray(st.shared)) ? st.shared : [];
    if (shared.length) return String(shared[shared.length - 1]?.text || '').trim();
    return '';
  } catch {
    return '';
  }
}

function _normSceneText(txt) {
  return String(txt || '').replace(/\s+/g, ' ').trim();
}

function _ensureSharedSceneLog(roomId, text) {
  try {
    const rid = String(roomId || activeRoomId || '').trim();
    const incoming = String(text || '').trim();
    if (!rid || !incoming) return false;

    const want = _normSceneText(incoming);
    const visible = _normSceneText(_getLastVisibleLogText(rid));
    if (visible && visible === want) return false;

    const store = window.AETH_LOG && window.AETH_LOG.store;
    if (store instanceof Map) {
      const st = store.get(rid);
      const shared = (st && Array.isArray(st.shared)) ? st.shared : [];
      const lastShared = shared.length ? _normSceneText(shared[shared.length - 1]?.text || '') : '';
      if (lastShared && lastShared === want) return false;
    }

    addMsg({ who: 'GM', tag: 'SCENE', text: incoming, kind: 'gm' });
    return true;
  } catch {
    return false;
  }
}

// Back-compat name (older callers)
function _getLastSharedLogText(roomId) {
  return _getLastVisibleLogText(roomId);
}

function _requestLocalKickoffOnce(roomId, runId, why = 'client_self_heal') {
  try {
    const rid = String(roomId || activeRoomId || '').trim();
    const run = Number(runId || 0) || 0;
    if (!rid) return;
    window.__AETH_KICKOFF_REQ = window.__AETH_KICKOFF_REQ || Object.create(null);
    const key = `${rid}::${run}`;
    if (window.__AETH_KICKOFF_REQ[key]) return;
    window.__AETH_KICKOFF_REQ[key] = true;
    if (!socket) connectSocketIfNeeded();
    if (!socket) return;
    socket.emit('request_local_kickoff', { why });
  } catch {}
}


async function refreshBook() {
  if (!bookTextEl) return;
  if (!activeRoomId) {
    setBookText("Start or join a room to generate a book transcript.");
    return;
  }
  try {
    const resp = await fetch(`/api/book?roomId=${encodeURIComponent(activeRoomId)}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const txt = await resp.text();
    setBookText(txt);
  } catch (e) {
    setBookText("Could not load book transcript. Is the server running?");
  }
}

function setView(next) {
  const allowed = ['lobby','play','chat','map','book','codex','forces'];
  viewMode = allowed.includes(next) ? next : 'play';
  localStorage.setItem('aetheryn_view_mode', viewMode);

  document.body.classList.toggle('view-book', viewMode === 'book');
  document.body.classList.toggle('view-chat', viewMode === 'chat');
  document.body.classList.toggle('view-map', viewMode === 'map');
  document.body.classList.toggle('view-lobby', viewMode === 'lobby');
  document.body.classList.toggle('view-codex', viewMode === 'codex');
  document.body.classList.toggle('view-forces', viewMode === 'forces');

  // Tabs
  viewLobbyBtn?.classList.toggle('active', viewMode === 'lobby');
  viewPlayBtn?.classList.toggle('active', viewMode === 'play');
  viewChatBtn?.classList.toggle('active', viewMode === 'chat');
  viewMapBtn?.classList.toggle('active', viewMode === 'map');
  viewBookBtn?.classList.toggle('active', viewMode === 'book');
  viewCodexBtn?.classList.toggle('active', viewMode === 'codex');
  viewForcesBtn?.classList.toggle('active', viewMode === 'forces');

  viewLobbyBtn?.setAttribute('aria-selected', viewMode === 'lobby' ? 'true' : 'false');
  viewPlayBtn?.setAttribute('aria-selected', viewMode === 'play' ? 'true' : 'false');
  viewChatBtn?.setAttribute('aria-selected', viewMode === 'chat' ? 'true' : 'false');
  viewMapBtn?.setAttribute('aria-selected', viewMode === 'map' ? 'true' : 'false');
  viewBookBtn?.setAttribute('aria-selected', viewMode === 'book' ? 'true' : 'false');
  viewCodexBtn?.setAttribute('aria-selected', viewMode === 'codex' ? 'true' : 'false');
  viewForcesBtn?.setAttribute('aria-selected', viewMode === 'forces' ? 'true' : 'false');

  // Panel visibility
  lobbyViewPanel?.classList.toggle('hidden', viewMode !== 'lobby');
  chatViewPanel?.classList.toggle('hidden', viewMode !== 'chat');
  mapViewPanel?.classList.toggle('hidden', viewMode !== 'map');
  bookViewPanel?.classList.toggle('hidden', viewMode !== 'book');
  codexViewPanel?.classList.toggle('hidden', viewMode !== 'codex');
  forcesViewPanel?.classList.toggle('hidden', viewMode !== 'forces');
  logEl?.classList.toggle('hidden', viewMode !== 'play');
  // Hide play-only docks outside the Play tab (prevents UI bleeding behind other panels).
  try { document.querySelector('.choiceDock')?.classList.toggle('hidden', viewMode !== 'play'); } catch {}
  try { document.querySelector('.composer')?.classList.toggle('hidden', viewMode !== 'play'); } catch {}
  try { diceDockEl?.classList.toggle('hidden', viewMode !== 'play'); } catch {}


  // If a panel was hidden during initial layout, it measured as 0×0.
  // Anchor it the first time it becomes visible.
  try {
    // Only detach/anchor into floating windows when windowed layout is active.
    if (document.body?.dataset?.windowed === "1") {
      requestAnimationFrame(() => {
        try { _anchorFixed(lobbyViewPanel); } catch {}
        try { _anchorFixed(chatViewPanel); } catch {}
        try { _anchorFixed(mapViewPanel); } catch {}
        try { _anchorFixed(bookViewPanel); } catch {}
        try { _anchorFixed(codexViewPanel); } catch {}
        try { _anchorFixed(forcesViewPanel); } catch {}
        // Play-view panels can also be hidden while browsing tabs.
        // Anchor them on first reveal so resizing one never stretches the others.
        try { _anchorFixed(logEl); } catch {}
        try { _anchorFixed(document.querySelector('.side')); } catch {}
        try { _anchorFixed(document.querySelector('.choiceDock')); } catch {}
        try { _anchorFixed(document.querySelector('footer.composer')); } catch {}
      });
    }
  } catch {}

  // Book polling only in book view
  if (viewMode === 'book') {
    refreshBook();
    if (bookPollTimer) clearInterval(bookPollTimer);
    bookPollTimer = setInterval(() => {
      try { if (document.hidden) return; } catch {}
      if (bookAutoChk && !bookAutoChk.checked) return;
      refreshBook();
    }, (mode === 'multi' ? 15000 : 5000));
  } else {
    if (bookPollTimer) clearInterval(bookPollTimer);
    bookPollTimer = null;
  }

  // Map refresh when entering map view
  if (viewMode === 'map') {
    try { mapRenderMapSelect(); } catch {}
    try { mapApplySettingsToUI(); } catch {}

    // Default: zoom in for travel-scale readability unless the user explicitly changed it.
    try {
      if (window.MAP && MAP.settings && !MAP.settings._zoomUserSet) {
        MAP.settings.zoom = 10;
        if (window.mapZoomRange) mapZoomRange.value = '10';
        if (window.mapZoomVal) mapZoomVal.textContent = '10.0×';
        try { saveMapSettings(); } catch {}
      }
    } catch {}

    // Re-read settings from UI so zoom immediately takes effect when the panel becomes visible.
    try { mapReadSettingsFromUI(); saveMapSettings(); } catch {}
    try { mapRenderFog(); } catch {}
    try { mapUpdateDots(); } catch {}
  }

  // Lobby refresh when entering lobby view
  if (viewMode === 'lobby') {
    try { lobbyUpdateInvites(); } catch {}
    try { lobbyRefreshRooms(); } catch {}
  }
}

function connectSocketIfNeeded() {
  if (socket) return;

  socket = io();

  // Optional modules (loaded as separate scripts)
  try { if (window.AETH_CRAFT && typeof window.AETH_CRAFT.bindSocket === 'function') window.AETH_CRAFT.bindSocket(socket); } catch {}

  socket.on("connect", () => {
    setConn(true);
    try { setAiWait(false); } catch {}
    refreshAiStatus();
  });
  socket.on("disconnect", () => { setConn(false); try { setAiWait(false); } catch {} });

  // Server-driven AI busy/idle indicator.
  socket.on("ai_wait", (payload) => {
    try {
      const on = !!payload?.on;
      const phase = String(payload?.phase || "");
      const detail = String(payload?.detail || "");
      setAiWait(on, phase, detail);
    } catch {}
  });


// Server-pushed LLM status (fast feedback; complements /api/ai/status polling).
socket.on("llm:status", (s) => {
  try {
    console.log("[LLM STATUS]", s);
    if (!aiStatusEl) return;
    const ok = !!s?.ok;
    const provider = String(s?.provider || "unknown");
    aiStatusEl.textContent = ok ? `AI: online (${provider})` : `AI: offline (${provider})`;
    aiStatusEl.title = String(s?.detail || "");
  } catch {}
});

// Explicit AI errors (unblocks UI even if something goes sideways).
socket.on("ai:error", (e) => {
  try {
    console.warn("[AI ERROR]", e);
    try { setAiWait(false); } catch {}
    const msg = `AI Error: ${String(e?.message || "Unknown error")}${e?.hint ? ("\n" + String(e.hint)) : ""}`;
    if (typeof window.toast === "function") window.toast(msg, "error");
    else addMsg({ who: "ERROR", tag: "AI", text: msg, kind: "sys" });
  } catch {}
});

// Manual probe for debugging (window.probeLLM()).
try { window.probeLLM = () => socket && socket.emit("llm:probe"); } catch {}

  socket.on("host_status", (payload) => {
    isHost = !!payload.isHost;
    try { applyAutoPerfLite(); } catch {}
    intakeRoleBadge.textContent = isHost ? "Host" : "Player";
    try { if (forcesControlsEl) forcesControlsEl.classList.toggle('hidden', !isHost); } catch {}

    try { updateRoomControls(currentCanonTokens); } catch {}

    // Item/asset request approvals are disabled (anti-cheat).
  });

  // Room metadata updates (run id, whether host has submitted campaign settings).
  socket.on('room_meta', (payload) => {
    try {
      if (payload?.runId != null) setRoomRunId(activeRoomId, payload.runId);
      if (payload?.intakeGlobalPresent != null) serverIntakeGlobalPresent = !!payload.intakeGlobalPresent;
    } catch {}
    try { updateRoomControls(currentCanonTokens); } catch {}
  });

  // When host starts a fresh run, the server tells everyone to reset stale intake flags.
  socket.on('intake_reset', (payload) => {
    try {
      const rid = String(payload?.roomId || activeRoomId || '').trim();
      if (rid) {
        setRoomRunId(rid, payload?.runId || 0);
        serverIntakeGlobalPresent = !!payload?.intakeGlobalPresent;
        // Clear "submitted" flag for this run.
        try { lsDel(intakeSubmittedKey(rid)); } catch {}
      }
    } catch {}

    // Auto-open intake to keep the flow frictionless.
    try { openIntake(); } catch {}
  });

  socket.on("state", (payload) => {
    try {
      if (payload?.isHost != null) isHost = !!payload.isHost;
      try { applyAutoPerfLite(); } catch {}
      if (payload?.runId != null) setRoomRunId(activeRoomId, payload.runId);
      if (payload?.intakeGlobalPresent != null) serverIntakeGlobalPresent = !!payload.intakeGlobalPresent;
      intakeRoleBadge.textContent = isHost ? 'Host' : 'Player';
    } catch {}
    setCanonTokens(payload.canon_tokens || []);
    try {
      if (Array.isArray(payload?.myCharNames) && payload.myCharNames.length) setMyCharNames(activeRoomId, payload.myCharNames);
      if (payload?.actorName) setMyCharName(activeRoomId, payload.actorName);
      try { syncActorSelect(); } catch {}
    } catch {}
    setChoices(_resolveIncomingChoices(payload));
    updateBookMeta(payload.book_meta || null);
    try { setOocHistory(payload.ooc || []); } catch {}
    addMsg({ who: "SYSTEM", tag: "STATE", text: `Joined room: ${payload.roomId}` });

    // If we joined mid-run (or refreshed), rehydrate the Play log with the last Book narration.
    // This prevents a blank Play area that makes it look like "the AI isn't doing anything".
    try {
      const last = String(payload?.lastNarration || '').trim();
      if (last) {
        const rid = String(payload?.roomId || activeRoomId || '').trim();
        const run = Number(payload?.runId || 0) || 0;
        const key = `${rid}::${run}`;
        window.__AETH_BOOT_NARR_SHOWN = window.__AETH_BOOT_NARR_SHOWN || Object.create(null);
        const already = !!window.__AETH_BOOT_NARR_SHOWN[key];
        const lastShared = _getLastVisibleLogText(rid);
        const alreadyHas = lastShared && lastShared === last;
        if (!already && !alreadyHas) {
          window.__AETH_BOOT_NARR_SHOWN[key] = true;
          _ensureSharedSceneLog(rid, last);
        }
      }
    } catch {}

    // Hard self-heal: if we're in PLAY but only have prologue/empty prose, request a local kickoff.
    try {
      const tokens = payload.canon_tokens || [];
      if (hasMode(tokens, 'PLAY')) {
        const rid = String(payload?.roomId || activeRoomId || '').trim();
        const run = Number(payload?.runId || 0) || 0;
        const lastBook = String(payload?.lastNarration || '').trim();
        const lastLog = _getLastVisibleLogText(rid);
        const need = (!lastBook || _looksLikePrologueOnly(lastBook)) || (!lastLog || _looksLikePrologueOnly(lastLog));
        if (need) _requestLocalKickoffOnce(rid, run, 'state_play_no_scene');
      }
    } catch {}

    // Once the game is running, remove the start/load box entirely.
    try {
      if (joinPanelEl) {
        joinPanelEl.classList.add("hidden");
        joinPanelEl.setAttribute("aria-hidden", "true");
        // Let the UI settle for a tick, then remove from DOM.
        setTimeout(() => { try { joinPanelEl.remove(); } catch {} }, 50);
      }
    } catch {}
    const tokens = payload.canon_tokens || [];
    try { updateRoomControls(tokens); } catch {}
    try { maybeAutoOpenIntake(tokens); } catch {}

    // Friendly hint in multiplayer: LOBBY means "waiting for host".
    try {
      if (mode === 'multi' && hasMode(tokens, 'LOBBY')) {
        addMsg({ who: 'SYSTEM', tag: 'SYSTEM', text: 'Room is in LOBBY. Create your character, then the host clicks Start Game.' });
      }
    } catch {}

  });

  socket.on("system", (msg) => addMsg({ who: "SYSTEM", tag: "SYSTEM", text: msg }));

  // Map travel confirmation (server-authoritative).
  socket.on("travel:applied", (data) => {
    try {
      if (!data || !data.to) return;
      // Keep MAP.travel intact until the next canon_update so mapApplyFromTokens can bind pins correctly.
      if (MAP && MAP.travel && MAP.travel.pending) {
        try { MAP.travel.serverAppliedAt = Date.now(); } catch {}
      }

      // Visual feedback: only after server confirms travel (prevents click-reveal cheating).
      try {
        const from = data.from || null;
        const to = data.to || null;
        if (to && Number.isFinite(to.x) && Number.isFinite(to.y)) {
          // Temporary override so the dot moves immediately; LOC update will take over on canon_update.
          MAP.positionOverride = { x: clamp(to.x, 0, 1), y: clamp(to.y, 0, 1), label: data.loc || "Wilderness" };
          if (MAP.settings && MAP.settings.revealOnMove && from && Number.isFinite(from.x) && Number.isFinite(from.y)) {
            mapRevealPath({ x: clamp(from.x, 0, 1), y: clamp(from.y, 0, 1) }, { x: MAP.positionOverride.x, y: MAP.positionOverride.y });
            mapRevealAt(MAP.positionOverride.x, MAP.positionOverride.y);
            MAP.lastXY = { x: MAP.positionOverride.x, y: MAP.positionOverride.y };
          }
          mapUpdateDots();
        }
      } catch {}

      // Progress UI
      try {
        mapShowTravelProgress(true);
        mapUpdateTravelProgressUI(1);
        if (mapTravelProgressText) {
          const mins = Number(data.minutesPassed || 0) || 0;
          const miles = Number(data.miles || 0) || 0;
          mapTravelProgressText.textContent = `Travel applied (${miles.toFixed(1)} mi, +${mins} min). Updating…`;
        }
        // Hide shortly; canon_update will also clear any lingering UI.
        setTimeout(() => { try { mapShowTravelProgress(false); } catch {} }, 900);
      } catch {}
    } catch {}
  });

  socket.on("canon_update", (payload) => {
    try { setAiWait(false); } catch {}
    if (!payload) return;
    try {
      if (payload?.runId != null) setRoomRunId(activeRoomId, payload.runId);
      if (payload?.intakeGlobalPresent != null) serverIntakeGlobalPresent = !!payload.intakeGlobalPresent;
    } catch {}
    if (Array.isArray(payload.canon_tokens)) setCanonTokens(payload.canon_tokens);
    try { if (window.AETH_CRAFT && typeof window.AETH_CRAFT.onCanonUpdate === 'function') window.AETH_CRAFT.onCanonUpdate(payload); } catch {}
    setChoices(_resolveIncomingChoices(payload));
    updateBookMeta(payload.book_meta || null);
    if (viewMode === 'book') refreshBook();

    // If the host flips the room into INTAKE after you joined, auto-open character creation.
    try { updateRoomControls(payload.canon_tokens || currentCanonTokens); } catch {}
    try { maybeAutoOpenIntake(payload.canon_tokens || currentCanonTokens); } catch {}
  });


  socket.on("stats_required", (payload) => {
    try { setAiWait(false); } catch {}
    // Server may disambiguate / rename characters (e.g., "Alex #2").
    // Persist any server-provided roster so couch co-op can reliably switch characters.
    try {
      const list = Array.isArray(payload?.myCharNames) ? payload.myCharNames : null;
      const nm = String(payload?.charName || '').trim();
      if (list && list.length) {
        setMyCharNames(activeRoomId, list);
      } else if (nm) {
        const cur = (typeof getMyCharNames === 'function') ? (getMyCharNames(activeRoomId) || []) : [];
        if (!cur.some(x => String(x||'').trim().toLowerCase() === nm.toLowerCase())) {
          setMyCharNames(activeRoomId, [...cur, nm]);
        }
      }
    } catch {}
    // Open (or refresh) the stat allocation modal. The canonical lock still comes from mode:STATS.
    try { openStatsModal(payload || {}); } catch {}
  });

  socket.on("stats_committed", (payload) => {
    try { setAiWait(false); } catch {}
    try { openStatsModal(payload || {}); } catch {}
	  });


// Per-stat roll results (server authority). Register ONCE (not nested).
socket.on("stats_roll_one_result", (payload) => {
  try { setAiWait(false); } catch {}
  try { applyStatsRollOneResult(payload || {}); } catch {}
  try {
    openStatsModal({
      pending: payload?.pending || null,
      haveStats: false,
      charName: payload?.charName || ""
    });
  } catch {}
});

// Turn system: initiative + active player updates
socket.on('turn_update', (payload) => {
  try {
    const t = payload?.turn || null;
    if (t && typeof t === 'object') {
      turnState = {
        enabled: !!t.enabled,
        phase: String(t.phase || 'OFF'),
        mode: String(t.mode || 'SEQUENTIAL'),
        active: String(t.active || ''),
        order: Array.isArray(t.order) ? t.order : [],
        expected: Array.isArray(t.expected) ? t.expected : [],
        rolls: (t.rolls && typeof t.rolls === 'object') ? t.rolls : {},
        intents: (t.intents && typeof t.intents === 'object') ? t.intents : {},
        readyCount: Number(t.readyCount || 0) || 0,
        totalCount: Number(t.totalCount || 0) || 0,
        round: Number(t.round || 1) || 1,
      };
    }
  } catch {}

  try { updateTurnStatusPill(); } catch {}

  // If the current active turn belongs to one of my local couch co-op characters,
  // auto-select it so the UI unlocks without the player having to guess.
  try {
    const phase = String(turnState?.phase || 'OFF').toUpperCase();
    if (phase === 'ACTIVE') {
      const active = String(turnState?.active || '').trim();
      if (active) {
        const names = (typeof getMyCharNames === 'function') ? (getMyCharNames(activeRoomId) || []) : [];
        const hit = names.find(n => String(n||'').trim().toLowerCase() === active.toLowerCase());
        const cur = String(getMyCharName(activeRoomId) || '').trim();
        if (hit && (!cur || cur.toLowerCase() !== hit.toLowerCase())) {
          try { setActiveCharacter(activeRoomId, hit); } catch {}
        }
      }
    }
  } catch {}

  // Turn lock: you can't act until initiative is done.
// - SEQUENTIAL: only on your turn
// - SIMULTANEOUS: PLAN allows intent submission; RESOLVING is locked
  try {
    if (!joined) { setTurnLock(false); return; }
    const phase = String(turnState?.phase || 'OFF').toUpperCase();
    const mode = String(turnState?.mode || 'SEQUENTIAL').toUpperCase();

    if (phase === 'INIT') { setTurnLock(true); return; }

    if (mode === 'SIMULTANEOUS') {
      if (phase === 'RESOLVING') { setTurnLock(true); return; }
      // PLAN (and OFF) are unlocked so players can submit/update intent.
      setTurnLock(false);
      return;
    }

    // Legacy sequential
    if (phase === 'ACTIVE') {
      const me = String(getMyCharName() || '').trim();
      const active = String(turnState?.active || '').trim();
      if (!me || !active) { setTurnLock(true); return; }
      setTurnLock(me.toLowerCase() !== active.toLowerCase());
      return;
    }
    setTurnLock(false);
  } catch {
    try { setTurnLock(false); } catch {}
  }
});


socket.on('turn_order_required', (payload) => {
  try { openTurnOrderModal(payload || null); } catch {}
});

socket.on('turn_roll_done', (payload) => {
  try {
    if (payload?.ok) {
      closeTurnOrderModal();
    } else {
      showTurnOrderResult(String(payload?.message || 'Unable to submit initiative roll.'));
    }
  } catch {}
});

// Mandatory action roll gate (server-enforced)
socket.on("action_roll_required", (payload) => {
  try { setAiWait(false); } catch {}
  try { openActionRollModal(payload || null); } catch {}
});

socket.on("action_roll_done", (_payload) => {
  try { setAiWait(false); } catch {}
  try { closeActionRollModal(); } catch {}
});

socket.on("ooc_message", (payload) => { try { addOocMsg(payload); } catch {} });

  // Quick party collaboration actions (no turn/time advance). Scoped server-side to nearby group.
  socket.on('party_quick_msg', (payload) => {
    try {
      const txt = String(payload?.text || '').trim();
      if (!txt) return;
      addMsg({
        who: 'PARTY',
        tag: String(payload?.kind || 'PARTY').toUpperCase(),
        text: txt,
        kind: 'party',
        meta: { from: String(payload?.from || '').trim(), kind: String(payload?.kind || '').trim().toLowerCase(), target: String(payload?.target || '').trim() }
      });
    } catch {}
  });

  // Auto trade: request + result (no time/turn advance)
  socket.on('trade_request', (payload) => {
    try {
      const from = String(payload?.from || '').trim();
      const to = String(payload?.to || '').trim();
      const giveItem = String(payload?.giveItem || '').trim();
      const giveQty = Number(payload?.giveQty || 0) || 0;
      const wantItem = String(payload?.wantItem || '').trim();
      const wantQty = Number(payload?.wantQty || 0) || 0;
      const tradeId = String(payload?.tradeId || '').trim();
      if (!tradeId) return;
      const summary = `${from} → ${to}: ${giveQty}× ${giveItem}` + (wantItem ? ` for ${wantQty}× ${wantItem}` : '');
      addMsg({
        who: 'TRADE',
        tag: 'TRADE',
        text: `Trade offer: ${summary}`,
        kind: 'trade',
        meta: { tradeId, from, to, giveItem, giveQty, wantItem, wantQty, status: 'pending', summary }
      });
    } catch {}
  });

  socket.on('trade_result', (payload) => {
    try {
      const tradeId = String(payload?.tradeId || '').trim();
      const status = String(payload?.status || (payload?.ok ? 'completed' : 'done')).trim();
      const msg = String(payload?.message || '').trim();
      if (tradeId && window.AETH_LOG && typeof window.AETH_LOG.markTrade === 'function') {
        window.AETH_LOG.markTrade(activeRoomId, tradeId, status);
      }
      if (msg) addMsg({ who: 'TRADE', tag: 'TRADE', text: msg, kind: 'party' });
    } catch {}
  });

  // Info-only peek results (does not advance the turn)
  socket.on("peek_result", (payload) => {
    try {
      const who = payload?.from || "GM";
      const tag = String(payload?.kind || "LOOK").toUpperCase();
      const txt = String(payload?.text || "").trim();
      if (!txt) return;
      addMsg({ who, tag, text: txt, kind: "gm" });
    } catch {}
  });

  // Dice roller: purely mechanical results from the server (no model calls).
  socket.on("dice_result", (payload) => {
    try { setAiWait(false); } catch {}
    try { addDiceResult(payload); } catch {}

    // If we're currently resolving a mandatory action roll, auto-submit the kept total to the server.
    try {
      const label = String(payload?.label || "");
      const isAction = actionRollPending && actionRollModal && !actionRollModal.classList.contains('hidden')
        && String(actionRollSpec?.label || 'Action Roll') === label
        && Number(payload?.sides) === Number(actionRollSpec?.sides)
        && Number(payload?.count) === Number(actionRollSpec?.count);

      const isTurn = turnOrderPending && turnOrderModal && !turnOrderModal.classList.contains('hidden')
        && label === 'Turn Order'
        && Number(payload?.sides) === 20
        && Number(payload?.count) === 1;

      if (isAction) {
        const total = Math.floor(Number(payload?.total));
        const dice = Array.isArray(payload?.rolls) ? payload.rolls.map(n => Number(n)).filter(n => Number.isFinite(n)) : [];
        const extra = payload?.dropLowest ? ` drop=${payload?.dropped} kept=${payload?.keptSum}` : '';
        showActionRollResult(`[AI Roll] dice=[${dice.join(', ')}] → total=${Number.isFinite(total) ? total : '?'}` + extra);
        if (socket && Number.isFinite(total)) {
          socket.emit('action_roll_submit', { source: 'site', total, dice, actor: (typeof actionRollActor === 'string' ? actionRollActor : '') });
        }
      }

      if (isTurn) {
        const total = Math.floor(Number(payload?.total));
        const dice = Array.isArray(payload?.rolls) ? payload.rolls.map(n => Number(n)).filter(n => Number.isFinite(n)) : [];
        showTurnOrderResult(`[AI Roll] d20=${dice.length ? dice[0] : '?'} → total=${Number.isFinite(total) ? total : '?'}`);
        if (socket && Number.isFinite(total)) {
          socket.emit('turn_roll_submit', { source: 'site', total, dice, actor: (typeof turnOrderActor === 'string' ? turnOrderActor : '') });
        }
      }
    } catch {}
  });


  socket.on("narration", (payload) => {
    try { setAiWait(false); } catch {}

    const full = payload.text || "";
    const split0 = splitNarrationAndChoices(full);

    const povCharMap = (payload && typeof payload.pov_char === 'object' && payload.pov_char) ? payload.pov_char : null;

    const rid = String(activeRoomId || '').trim();
    let activeName = '';
    try { activeName = String(getMyCharName(rid) || '').trim(); } catch { activeName = ''; }
    const activeKey = activeName ? activeName.toLowerCase() : '';

    // Server may explicitly indicate which character this narration is for.
    const povActor = String(payload?.povActor || '').trim();

    // Choices are delivered out-of-band in payload.choices (do NOT scrape them from POV prose).
    const ch = (payload.choices && payload.choices.length)
      ? payload.choices
      : (split0.choices.length ? split0.choices : extractChoicesFromNarration(full));

    if (povCharMap) {
      // POV bundle: store each local character's POV separately (couch co-op safe).
      const rid2 = String(activeRoomId || '').trim();
      let myNames = [];
      try { myNames = (typeof getMyCharNames === 'function') ? (getMyCharNames(rid2) || []) : []; } catch { myNames = []; }
      const mySet = new Set((myNames || []).map(n => String(n||'').trim().toLowerCase()).filter(Boolean));

      let storedAny = false;
      try {
        for (const [k, v] of Object.entries(povCharMap)) {
          const nm = String(k || '').trim();
          const txt0 = (typeof v === 'string') ? String(v || '').trim() : '';
          if (!nm || !txt0) continue;
          if (mySet.size && !mySet.has(nm.toLowerCase())) continue;
          storedAny = true;
          addMsg({ who: payload.from || 'GM', tag: 'SCENE', text: txt0, kind: 'gm', povChar: nm });
        }
      } catch {}

      // Fallback: if the bundle was empty, show the raw narration.
      if (!storedAny) {
        const sp = splitNarrationAndChoices(String(full || ''));
        const txt = String(sp.narration || full).trim() || '(The scene fails to render — try a different action to continue.)';
        const scope = povActor || activeName || undefined;
        addMsg({ who: payload.from || 'GM', tag: 'SCENE', text: txt, kind: 'gm', povChar: scope });
      }

      setCanonTokens(payload.canon_tokens || []);
      setChoices((ch && ch.length) ? ch : _resolveIncomingChoices(payload, full));

      // TTS / fun hooks should operate on the currently active character's POV when present.
      try {
        let shownText = '';
        if (activeKey) {
          for (const [k, v] of Object.entries(povCharMap)) {
            if (String(k||'').trim().toLowerCase() === activeKey && typeof v === 'string') { shownText = String(v||'').trim(); break; }
          }
        }
        if (!shownText) shownText = String(full || '').trim();
        if (window.AETH_TTS && typeof window.AETH_TTS.onNarration === 'function') {
          window.AETH_TTS.onNarration({ text: shownText, choices: ch || [] });
        }
      } catch {}

      updateBookMeta(payload.book_meta || null);

      try {
        if (window.AETH_FUN && typeof window.AETH_FUN.onNarration === 'function') {
          window.AETH_FUN.onNarration({ payload, narration: String(full || ''), choices: ch || [] });
        }
      } catch {}

      if (viewMode === 'book') refreshBook();
      return;
    }

    // Non-POV delivery (normal online): one stream, one message.
    const split = splitNarrationAndChoices(full);
    let narrationText = String(split.narration || full).trim();
    if (!narrationText) narrationText = "(The scene fails to render — try a different action to continue.)";

    // Store under the intended POV character (or fall back to the device's active character).
    const scope = povActor || activeName || undefined;
    addMsg({ who: payload.from || 'GM', tag: 'SCENE', text: narrationText, kind: 'gm', povChar: scope });
    setCanonTokens(payload.canon_tokens || []);
    setChoices((ch && ch.length) ? ch : _resolveIncomingChoices(payload, full));

    try {
      if (window.AETH_TTS && typeof window.AETH_TTS.onNarration === 'function') {
        window.AETH_TTS.onNarration({ text: narrationText, choices: ch || [] });
      }
    } catch {}

    updateBookMeta(payload.book_meta || null);

    try {
      if (window.AETH_FUN && typeof window.AETH_FUN.onNarration === 'function') {
        window.AETH_FUN.onNarration({ payload, narration: narrationText, choices: ch || [] });
      }
    } catch {}

    if (viewMode === 'book') refreshBook();
  });

  // Private, POV-safe recap shown to the next active actor at turn start.
  socket.on('turn_recap', (payload = {}) => {
    try {
      const actor = String(payload?.actor || '').trim();
      const text = String(payload?.text || '').trim();
      if (!text) return;
      addMsg({ who: 'GM', tag: 'RECAP', text, kind: 'gm', povChar: actor || undefined });
    } catch {}
  });

  // NOTE: The old "Nearby Activity" digest is intentionally disabled.
  // Observable teammate actions are now woven into the next player's prose instead.
  socket.on("book_update", (payload) => {
    // Safe backfill: if Book is advancing but Play has literally no scene prose yet,
    // seed the Play log for single-character sessions only. This avoids the "Book updates, Play is blank" trap
    // without leaking other players' private POV text in couch co-op.
    try {
      const kind = String(payload?.lastKind || '').trim().toLowerCase();
      const lastNarration = String(payload?.lastNarration || '').trim();
      const isSceneLike = !kind || kind === 'narration' || kind === 'prologue' || kind === 'scene_header' || kind === 'chapter_start' || kind === 'chapter_title';
      if (lastNarration && isSceneLike) {
        _ensureSharedSceneLog(activeRoomId, lastNarration);
      }
      if (kind === 'prologue' && hasMode(currentCanonTokens, 'PLAY')) {
        const run = Number(getRoomRunId(activeRoomId) || 0) || 0;
        _requestLocalKickoffOnce(activeRoomId, run, 'book_update_prologue_only');
      }
    } catch {}

    // Normal Book tab live-update behavior
    if (!bookTextEl) return;
    if (viewMode !== 'book') return;
    if (bookAutoChk && !bookAutoChk.checked) return;
    if (payload && typeof payload.text === 'string') {
      setBookText(payload.text);
    }
  });


  socket.on("book_meta", (payload) => {
    updateBookMeta(payload?.meta || null);
  });

  socket.on("error_msg", (msg) => {
    try { setAiWait(false); } catch {}
    addMsg({ who: "ERROR", tag: "ERROR", text: msg });

    // Self-heal UX: if intake/stats failed (timeouts are common on slow local models),
    // reopen the relevant modal so the player isn't stuck staring at a paused screen.
    try {
      const m = String(msg || '');
      if (hasMode(currentCanonTokens, 'INTAKE')) {
        if (/timed out/i.test(m) || /intake/i.test(m) || /rulekeeper/i.test(m)) {
          openIntake();
        }
      }
      if (hasMode(currentCanonTokens, 'STATS')) {
        if (/timed out/i.test(m)) {
          try { openStatsModal({}); } catch {}
        }
      }
    } catch {}
  });
}

function setMode(next) {
  mode = next;
  try { applyAutoPerfLite(); } catch {}
  modeSingleBtn.classList.toggle("active", mode === "single");
  modeMultiBtn.classList.toggle("active", mode === "multi");

  if (mode === "single") {
    roomField.style.display = "none";
    hintEl.textContent = "Single player: New Game starts fresh. Resume continues your last save. Load can open any server save.";
    if (joinBtn) joinBtn.textContent = "New Game";
    if (resumeGameBtn) {
      resumeGameBtn.textContent = "Resume";
      resumeGameBtn.style.display = "inline-flex";
      resumeGameBtn.disabled = !String(lsGet('aetheryn_single_room','')).trim();
    }
    if (loadGameBtn) loadGameBtn.textContent = "Load";
  } else {
    roomField.style.display = "grid";
    hintEl.textContent = "Multiplayer: Join a shared room code. New Room generates a fresh room.";
    if (joinBtn) joinBtn.textContent = "Join";
    if (resumeGameBtn) {
      resumeGameBtn.textContent = "New Room";
      resumeGameBtn.style.display = "inline-flex";
      resumeGameBtn.disabled = false;
    }
    if (loadGameBtn) loadGameBtn.textContent = "Load Save";
  }
}


if (modeSingleBtn) modeSingleBtn.onclick = () => setMode("single");
if (modeMultiBtn) modeMultiBtn.onclick = () => setMode("multi");
setMode("single");

// URL params helper (for lobby links): ?room=ROOMCODE&name=Zombie&mode=multi
try {
  const u = new URL(window.location.href);
  const qRoom = u.searchParams.get('room');
  const qName = u.searchParams.get('name');
  const qMode = u.searchParams.get('mode');
  if (qName && nameEl) nameEl.value = qName;
  if (qRoom && roomEl) {
    roomEl.value = qRoom;
    setMode(qMode === 'single' ? 'single' : 'multi');
  }
} catch {}

setConn(false);
setAiStatusUnknown();
refreshAiStatus();
setInterval(() => {
  try {
    if (document.visibilityState === 'visible') refreshAiStatus();
  } catch {}
}, 45000);
if (toggleSystem) {
  toggleSystem.checked = showSystem;
  toggleSystem.onchange = () => {
    showSystem = !!toggleSystem.checked;
    localStorage.setItem('aetheryn_show_system', showSystem ? '1' : '0');
    try { if (window.AETH_LOG && typeof window.AETH_LOG.render === 'function') window.AETH_LOG.render(activeRoomId); } catch {}
  };
}

if (toggleCanon) {
  toggleCanon.checked = showCanon;
  toggleCanon.onchange = () => {
    showCanon = !!toggleCanon.checked;
    localStorage.setItem('aetheryn_show_canon', showCanon ? '1' : '0');
    applyCanonVisibility();
  };
}
applyCanonVisibility();
updateBookMeta(null);

if (viewLobbyBtn) viewLobbyBtn.onclick = () => setView('lobby');
if (viewPlayBtn) viewPlayBtn.onclick = () => setView('play');
if (viewChatBtn) viewChatBtn.onclick = () => setView('chat');
if (viewMapBtn) viewMapBtn.onclick = () => setView('map');
if (viewBookBtn) viewBookBtn.onclick = () => setView('book');
if (viewCodexBtn) viewCodexBtn.onclick = () => setView('codex');
if (viewForcesBtn) viewForcesBtn.onclick = () => setView('forces');
if (chatBackBtn) chatBackBtn.onclick = () => setView('play');
if (lobbyBackBtn) lobbyBackBtn.onclick = () => setView('play');

function closeLoadModal(){
  loadModal?.classList.add('hidden');
}

function openLoadModal(list){
  if (!loadModal || !loadSelect) return;
  loadSelect.innerHTML = '';
  const saves = Array.isArray(list) ? list : [];
  for (const s of saves) {
    const opt = document.createElement('option');
    opt.value = s.roomId || '';
    const when = s.updatedAt ? new Date(s.updatedAt).toLocaleString() : '';
    const chars = Array.isArray(s.characters) ? s.characters : [];
    const primary = String(s.primaryCharacter || "").trim();
    const chTxt = primary ? ` • ${primary}` : (chars.length ? ` • ${chars.join(', ')}` : '');
    opt.textContent = when ? `${s.roomId} — ${when}${chTxt}` : `${s.roomId}${chTxt}`;
    opt.dataset.meta = s.meta || '';
    try { opt.dataset.chars = JSON.stringify(chars); } catch { opt.dataset.chars = '[]'; }
    loadSelect.appendChild(opt);
  }
  if (loadSelect.options.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No saves found.';
    opt.dataset.meta = '';
    opt.dataset.chars = '[]';
    loadSelect.appendChild(opt);
  }
  loadModal.classList.remove('hidden');
  try { loadSelect.dispatchEvent(new Event('change')); } catch {}
}

loadSelect?.addEventListener('change', () => {
  const o = loadSelect.options[loadSelect.selectedIndex];
  if (!o) return;
  let chars = [];
  try { chars = JSON.parse(o.dataset.chars || '[]') || []; } catch { chars = []; }
  const meta = String(o.dataset.meta || '').trim();
  const chLine = chars.length ? `Characters: ${chars.join(', ')}` : '';
  const bits = [meta, chLine].filter(Boolean);
  loadMeta.textContent = o.value ? (bits.length ? bits.join(' • ') : (o.textContent || o.value)) : '—';
});

loadCancelBtn?.addEventListener('click', closeLoadModal);
loadCloseBtn?.addEventListener('click', closeLoadModal);

loadGoBtn?.addEventListener('click', () => {
  const roomId = (loadSelect?.value || '').trim();
  if (!roomId) return;

  // Try to pick a sensible character name for this save.
  let chars = [];
  try {
    const o = loadSelect.options[loadSelect.selectedIndex];
    chars = o ? (JSON.parse(o.dataset.chars || '[]') || []) : [];
  } catch { chars = []; }

  let charName = String(getMyCharName(roomId) || '').trim();
  const joinName = (nameEl?.value.trim() || '').toLowerCase();

  if (!charName && joinName && chars.length) {
    const hit = chars.find(c => String(c||'').trim().toLowerCase() === joinName);
    if (hit) charName = String(hit).trim();
  }
  if (!charName && chars.length === 1) {
    charName = String(chars[0] || '').trim();
  }
  if (charName) setMyCharName(roomId, charName);

  if (mode === 'single') {
    lsSet('aetheryn_single_room', roomId);
    if (resumeGameBtn) resumeGameBtn.disabled = false;
  } else {
    if (roomEl) roomEl.value = roomId;
  }

  closeLoadModal();
  doJoinRoom(roomId, { forceBlankChar: !charName });
});


loadGameBtn?.addEventListener('click', async () => {
  connectSocketIfNeeded();
  try {
    const resp = await fetch('/api/saves/list');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    openLoadModal(data?.saves || []);
  } catch {
    alert('Could not load save list. Is the server running?');
  }
});


async function doSaveNow(){
  if (!String(activeRoomId || '').trim()) return alert('Join a room first.');
  try {
    const resp = await fetch('/api/saves/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: activeRoomId })
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${resp.status}`);
    addMsg({ who: 'SYSTEM', tag: 'SAVE', text: `Saved: ${data?.roomId || activeRoomId}`, kind: 'sys' });
  } catch (e) {
    alert(`Save failed: ${String(e?.message || e)}`);
  }
}

saveGameBtn?.addEventListener('click', doSaveNow);
saveAlwaysBtn?.addEventListener('click', doSaveNow);

exportGameBtn?.addEventListener('click', () => {
  if (!String(activeRoomId || '').trim()) return alert('Join a room first.');
  const url = `/api/saves/export?roomId=${encodeURIComponent(activeRoomId)}`;
  try { window.open(url, '_blank'); } catch { window.location.href = url; }
});

if (bookRefreshBtn) bookRefreshBtn.onclick = () => refreshBook();
if (bookSaveBtn) {
  if (bookSaveBtn) bookSaveBtn.onclick = async () => {
    if (!activeRoomId) return;
    try {
      await fetch('/api/book/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: activeRoomId })
      });
      refreshBook();
    } catch {}
  };
}
// Apply initial view
setView(viewMode);

// -------------------- Start / Resume / Load --------------------
function randomRoomCode(){
  const a = ['ashen','eldrian','cinder','nocturne','aether','obsidian','ember','frost','wyrd','hollow','iron','veil'];
  const b = ['gate','cairn','haven','spire','wald','crypt','fjord','torch','sigil','warren','bastion','knot'];
  const aa = a[Math.floor(Math.random()*a.length)] || 'aeth';
  const bb = b[Math.floor(Math.random()*b.length)] || 'room';
  const nn = Math.floor(100 + Math.random()*900);
  return `${aa}-${bb}-${nn}`;
}

function clearNewGameLocal(){
  // “Completely over” means no remembered character sheet/intake drafts.
  try { lsDel('aetheryn_char_name'); } catch {}
  try { lsDel(DRAFT_GLOBAL_KEY); } catch {}
  try { lsDel(DRAFT_PLAYER_KEY); } catch {}
}

// Intake submission marker (per room). Used to auto-open intake when the host starts the game.
function roomRunIdKey(roomId){
  return `aetheryn_room_runid_${String(roomId || '').trim()}`;
}
function getRoomRunId(roomId){
  try {
    const n = parseInt(String(lsGet(roomRunIdKey(roomId)) || '0').trim(), 10);
    return Number.isFinite(n) ? n : 0;
  } catch { return 0; }
}
function setRoomRunId(roomId, runId){
  try {
    const rid = String(roomId || '').trim();
    if (!rid) return;
    const n = Math.max(0, Math.floor(Number(runId) || 0));
    lsSet(roomRunIdKey(rid), String(n));
    currentRunId = n;
  } catch {}
}

function intakeSubmittedKey(roomId){
  const rid = String(roomId || '').trim();
  const run = getRoomRunId(rid);
  return `aetheryn_intake_submitted_${rid}_${run}`;
}
function getIntakeSubmitted(roomId){
  try { return (lsGet(intakeSubmittedKey(roomId)) || '').trim() === '1'; } catch { return false; }
}
function setIntakeSubmitted(roomId, on){
  try {
    const k = intakeSubmittedKey(roomId);
    if (!k || k.endsWith('_')) return;
    if (on) lsSet(k, '1');
    else lsDel(k);
  } catch {}
}

function getCanonMode(tokens){
  try {
    const v = tokenValue(tokens || [], ['mode']);
    return String(v || '').trim().toUpperCase();
  } catch { return ''; }
}

function updateRoomControls(tokens){
  if (!roomControlsEl) return;
  if (!joined || mode !== 'multi') {
    roomControlsEl.classList.add('hidden');
    return;
  }
  const phase = getCanonMode(tokens || currentCanonTokens);
  const show = (phase === 'LOBBY' || phase === 'INTAKE');
  roomControlsEl.classList.toggle('hidden', !show);
  if (roomPhasePillEl) roomPhasePillEl.textContent = phase || '—';
  if (roomCreateCharBtn) roomCreateCharBtn.classList.toggle('hidden', !show);
  if (roomStartGameBtn) {
    const canStart = (phase === 'LOBBY' && !!isHost);
    roomStartGameBtn.classList.toggle('hidden', !canStart);
    roomStartGameBtn.disabled = !canStart;
  }
}

function maybeAutoOpenIntake(tokens){
  const phase = getCanonMode(tokens || currentCanonTokens);
  if (phase === 'LOBBY') return;
  if (phase !== 'INTAKE') return;
  if (mode === 'single') {
    openIntake();
    return;
  }
  if (mode === 'multi') {
    // Host must always answer campaign settings for a new run.
    if (isHost && !serverIntakeGlobalPresent) {
      openIntake();
      return;
    }
    if (!getIntakeSubmitted(activeRoomId)) {
      openIntake();
    }
  }
}

function _emitStartGameWithAck(){
  if (!socket) return;
  try { setAiWait(true, 'room', 'Starting game…'); } catch {}
  const clear = () => { try { setAiWait(false); } catch {} };
  try { roomStartGameBtn.disabled = true; } catch {}
  let settled = false;
  try {
    socket.emit('room_start_game', { roomId: activeRoomId }, (resp) => {
      settled = true;
      clear();
      try { roomStartGameBtn.disabled = false; } catch {}
      if (!resp?.ok && resp?.error) addMsg({ who: 'ERROR', tag: 'ERROR', text: String(resp.error) });
      try {
        const phase = String(resp?.phase || '').trim().toUpperCase();
        if (resp?.ok && phase === 'INTAKE') openIntake();
      } catch {}
    });
  } catch (e) {
    clear();
    try { roomStartGameBtn.disabled = false; } catch {}
    addMsg({ who: 'ERROR', tag: 'ERROR', text: String(e?.message || e) });
    return;
  }
  setTimeout(() => {
    if (settled) return;
    clear();
    try { roomStartGameBtn.disabled = false; } catch {}
    addMsg({ who: 'SYSTEM', tag: 'ROOM', text: 'Start Game is still syncing. If the room phase changed to INTAKE, Character will open automatically.' });
  }, 2500);
}

function doJoinRoom(roomId, opts = {}){
  const rid = String(roomId || '').trim();
  if (!rid) return;

  const name = (nameEl?.value.trim() || 'Anonymous').slice(0, 40);
  connectSocketIfNeeded();

  activeRoomId = rid;

  // Choose the correct character name for this room (per-room storage).
  let charName = '';
  if (!opts.forceBlankChar) {
    charName = String(getMyCharName(rid) || '').trim();
  }

  const charNames = (typeof getMyCharNames === 'function') ? (getMyCharNames(rid) || []) : [];

  socket.emit('join', { roomId: activeRoomId, name, charName, charNames });
  joined = true;
  try { updateSaveButtons(); } catch {}

  // Persist active room so Book view/new tab can find it.
  lsSet('aetheryn_active_room', activeRoomId);

  // Store join name for intake defaults
  lsSet('aetheryn_join_name', name);

  if (mode === 'single') {
    lsSet('aetheryn_single_room', activeRoomId);
    if (resumeGameBtn) resumeGameBtn.disabled = false;
  }

  addMsg({ who: 'SYSTEM', tag: 'MODE', text: mode === 'single' ? `Single Player: ${activeRoomId}` : `Multiplayer: ${activeRoomId}` });
  try { lobbyUpdateInvites(); } catch {}
}

function startNewGame(){
  if (mode === 'single') {
    clearNewGameLocal();
    const rid = `solo-${uuid()}`;
    doJoinRoom(rid, { forceBlankChar: true });
    return;
  }

  // Multiplayer “New Game” = join the room code you typed (host decides what it means).
  const rid = String(roomEl?.value || '').trim();
  if (!rid) return alert('Enter a Room Code for multiplayer.');
  doJoinRoom(rid, {});
}

async function resumeGame(){
  if (mode === 'single') {
    let saved = String(lsGet('aetheryn_single_room','') || '').trim();

    // If localStorage was cleared (or this is a new browser), fall back to the server's latest save.
    if (!saved) {
      try {
        const resp = await fetch('/api/saves/latest');
        const data = await resp.json().catch(() => ({}));
        const rid = String(data?.save?.roomId || '').trim();
        if (rid) {
          saved = rid;
          try { lsSet('aetheryn_single_room', rid); } catch {}
          const ch = String(data?.save?.character || '').trim();
          if (ch) {
            try { setMyCharName(rid, ch); } catch {}
          }
        }
      } catch {}
    }

    if (!saved) {
      // Nothing to resume → start fresh.
      return startNewGame();
    }
    doJoinRoom(saved, {});
    return;
  }

  // Multiplayer “Resume” slot becomes “New Room” to avoid nuking anyone’s existing save.
  const rid = randomRoomCode();
  if (roomEl) roomEl.value = rid;
  doJoinRoom(rid, {});
}

if (joinBtn) joinBtn.onclick = startNewGame;
if (resumeGameBtn) resumeGameBtn.onclick = () => { resumeGame(); };

// In-room multiplayer controls
if (roomCreateCharBtn) {
  roomCreateCharBtn.addEventListener('click', () => {
    if (!joined) return alert('Join a room first.');
    openIntake();
  });
}

if (roomStartGameBtn) {
  roomStartGameBtn.addEventListener('click', () => {
    if (!joined) return alert('Join a room first.');
    if (!socket) connectSocketIfNeeded();
    if (!socket) return;
    if (socket.connected) {
      _emitStartGameWithAck();
      return;
    }
    try { setAiWait(true, 'room', 'Connecting…'); } catch {}
    socket.once('connect', () => {
      try { _emitStartGameWithAck(); } catch {}
    });
  });
}


function sendText(text) {
  if (!joined) return alert("Press Start first.");
  const t = String(text || "").trim();
  if (!t) return;

if (playLockedForRoll) {
  addMsg({ who: "SYSTEM", tag: "ROLL", text: "A roll is required to resolve your last action. Submit it before acting again." });
  try { openActionRollModal(); } catch {}
  return;
}

if (playLockedForStats) {
  addMsg({ who: "SYSTEM", tag: "STATS", text: "Stat allocation is required (or the party is still allocating). Finish stats before playing." });
  try { openStatsModal({ haveStats: myStatsArePresent(currentCanonTokens) }); } catch {}
  return;
}

  const actor = (getMyCharName(activeRoomId) || '');
  socket.emit("player_message", { text: t, actor });
  // Keep your own actions inside the correct character's book stream (couch co-op safe).
  addMsg({ who: "YOU", tag: "ACTION", text: t, kind: "you", povChar: String(actor || '').trim() || undefined });
}

function send() {
  const text = inputEl.value.trim();
  if (!text) return;
  sendText(text);
  inputEl.value = "";
}

if (sendBtn) sendBtn.onclick = send;
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

// -------------------- Intake UI --------------------
// Intake is a single interactive sheet (not step-by-step):
// - Host/single fills Campaign Settings + their Character Sheet
// - Non-host multiplayer fills only their Character Sheet
// We keep the locked Q0–Q14 keys in the payload so the ruleskeeper stays happy.

const intakeSubEl = document.getElementById("intakeSub");

const DRAFT_GLOBAL_KEY = "aetheryn_intake_global_draft_v1";
const DRAFT_PLAYER_KEY = "aetheryn_intake_player_draft_v1"; // legacy (single)
const DRAFT_PLAYERS_KEY = "aetheryn_intake_players_draft_v2"; // new (multi on one device)

function devicePlayersKey(roomId){
  const rid = String(roomId || activeRoomId || '').trim();
  return rid ? ('aetheryn_device_players__' + rid) : 'aetheryn_device_players';
}

function clampInt(n, lo, hi){
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

function getDevicePlayers(roomId){
  try {
    const raw = lsGet(devicePlayersKey(roomId));
    const n = parseInt(String(raw || '').trim(), 10);
    return clampInt(n || 1, 1, 8);
  } catch { return 1; }
}

function setDevicePlayers(roomId, n){
  try { lsSet(devicePlayersKey(roomId), String(clampInt(n, 1, 8))); } catch {}
}

function loadDraft(key){
  try {
    const raw = lsGet(key);
    if (!raw) return {};
    const v = JSON.parse(raw);
    return (v && typeof v === 'object') ? v : {};
  } catch { return {}; }
}

function saveDraft(key, obj){
  try { localStorage.setItem(key, JSON.stringify(obj || {})); } catch {}
}

function openIntake() {
  intakeModal.classList.remove("hidden");

  // Restore drafts instead of nuking progress.
  intake.answersGlobal = { ...(loadDraft(DRAFT_GLOBAL_KEY) || {}) };
  // Multi-character (couch co-op) draft
  let draft = null;
  try { draft = loadDraft(DRAFT_PLAYERS_KEY); } catch { draft = null; }
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) draft = {};

  // Legacy migration
  const legacySingle = loadDraft(DRAFT_PLAYER_KEY) || {};

  intake.devicePlayers = clampInt(draft.devicePlayers ?? getDevicePlayers(activeRoomId) ?? 1, 1, 8);
  intake.activePlayerIdx = clampInt(draft.activePlayerIdx ?? 0, 0, 7);
  if (intake.activePlayerIdx >= intake.devicePlayers) intake.activePlayerIdx = 0;

  const players = Array.isArray(draft.players) ? draft.players : [];
  intake.answersPlayers = [];
  for (let i = 0; i < intake.devicePlayers; i++) {
    const base = (players[i] && typeof players[i] === 'object') ? players[i] : (i === 0 ? legacySingle : {});
    intake.answersPlayers.push({ ...(base || {}) });
  }

  // Sensible defaults
  if (!intake.answersGlobal.q0) intake.answersGlobal.q0 = "Player rolls (I type results)";
  if (intake.answersGlobal.q2 == null) intake.answersGlobal.q2 = "0";
  if (!intake.answersGlobal.q3) intake.answersGlobal.q3 = "Together (same starting scene)";
  if (!intake.answersGlobal.q4) intake.answersGlobal.q4 = "6";
  if (!intake.answersGlobal.q5) intake.answersGlobal.q5 = "5";
  if (!intake.answersGlobal.q6) intake.answersGlobal.q6 = "5";
  if (!intake.answersGlobal.q7) intake.answersGlobal.q7 = "5";
  if (!intake.answersGlobal.q8) intake.answersGlobal.q8 = "3";

    const joinName = lsGet("aetheryn_join_name") || "Anonymous";

  const _formation = String(intake.answersGlobal.q3 || "");
  const _defaultStart = (/separated/i.test(_formation)) ? "Start separately" : "Start with party";

  for (let i = 0; i < intake.answersPlayers.length; i++) {
    const p = intake.answersPlayers[i];
    if (!p.q9) p.q9 = (i === 0) ? joinName : `${joinName} ${i + 1}`;
    if (!p.q11) p.q11 = "Touched (uses magic)";
    if (!p.q12) p.q12 = "Fire";
    if (!p.q15) p.q15 = _defaultStart;
  }

  // Persist device player count so future joins default correctly.
  try { setDevicePlayers(activeRoomId, intake.devicePlayers); } catch {}

  renderIntake();
}

function closeIntake() {
  intakeModal.classList.add("hidden");
}

function escHtml(s){
  return String(s||"")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/\"/g,"&quot;")
    .replace(/'/g,"&#39;");
}

function datalistHtml(id, arr){
  const opts = (arr||[]).map(x=>`<option value="${escHtml(x)}"></option>`).join("");
  return `<datalist id="${id}">${opts}</datalist>`;
}

function renderScaleHelpInline(qid){
  const help = SCALE_HELP[qid];
  if (!help) return "";
  return `
    <div class="scaleHelp">
      <div><strong>${escHtml(help.title)}:</strong> ${escHtml(help.left)} • ${escHtml(help.mid)} • ${escHtml(help.right)}</div>
      <div class="scaleBar"><div class="scaleFill"></div></div>
      <div class="row"><span>${escHtml(help.left)}</span><span>${escHtml(help.mid)}</span><span>${escHtml(help.right)}</span></div>
    </div>
  `;
}

function renderIntake() {
  const showGlobalSection = !(mode === "multi" && !isHost);
  // Pull these early so the header/sub can show who we're editing (important for couch co-op).
  const joinName = lsGet("aetheryn_join_name") || "Anonymous";
  const g = intake.answersGlobal || {};
  const devicePlayers = clampInt(intake.devicePlayers ?? getDevicePlayers(activeRoomId) ?? 1, 1, 8);
  intake.devicePlayers = devicePlayers;
  const activeIdx = clampInt(intake.activePlayerIdx ?? 0, 0, Math.max(0, devicePlayers - 1));
  intake.activePlayerIdx = activeIdx;
  const players = Array.isArray(intake.answersPlayers) ? intake.answersPlayers : [];
  const p = (players[activeIdx] && typeof players[activeIdx] === 'object') ? players[activeIdx] : {};
  const editName = String(p?.q9 || (activeIdx === 0 ? joinName : `${joinName} ${activeIdx + 1}`) || '').trim();

  if (intakeSubEl) {
    const base = showGlobalSection
      ? "Fill everything below. The story begins after you hit Submit."
      : "Fill your character sheet. The story begins after everyone submits.";
    const who = devicePlayers > 1
      ? ` Editing: ${editName || `Character ${activeIdx + 1}`} (${activeIdx + 1}/${devicePlayers}).`
      : (editName ? ` Editing: ${editName}.` : '');
    intakeSubEl.textContent = (base + who).trim();
  }

  intakeRoleBadge.textContent = (mode === "multi" && !isHost) ? "Player" : (mode === "multi" ? "Host" : "Solo");

  qNumEl.textContent = "INTAKE";
  qTextEl.textContent = showGlobalSection
    ? "Campaign settings + character creation (all at once)."
    : "Character creation (all at once).";

  // (joinName/g/devicePlayers/activeIdx/players/p already computed above)

  // Only auto-skip formation in true solo (single device, 1 local player, 0 NPCs).
  const autoSkipFormation = (mode === 'single' && devicePlayers === 1 && Number(g.q2 || 0) === 0);

  aBlockEl.innerHTML = `
    <div class="intakeSheet">
      <div class="section">
        <div class="sectionHeader">
          <div class="sectionTitle">This device</div>
          <div class="sectionSub">Couch co-op means multiple humans sharing one screen.</div>
        </div>

        <div class="charGrid" style="grid-template-columns: 1fr 1fr;">
          <div class="field" id="f_local_players">
            <label>Players on this device (couch co-op)</label>
            <input id="local_players" type="number" min="1" max="8" value="${escHtml(devicePlayers)}" />
            <div class="help">Set 1 for solo. Set 2+ if multiple humans are sharing this screen.</div>
          </div>

          <div class="field" id="f_local_edit" style="${devicePlayers > 1 ? '' : 'display:none'}">
            <label>Editing character</label>
            <select id="local_char_idx">
              ${(Array.from({ length: devicePlayers }).map((_, i) => {
                const nm = String((intake.answersPlayers?.[i]?.q9) || (i===0 ? joinName : `${joinName} ${i+1}`)).trim();
                const label = nm ? `${i + 1}: ${nm}` : `Character ${i + 1}`;
                return `<option value="${i}" ${i === activeIdx ? 'selected' : ''}>${escHtml(label)}</option>`;
              })).join('')}
            </select>
            <div class="help">If you added more than 1, fill them out one at a time.</div>
          </div>
        </div>
      </div>

      ${showGlobalSection ? `
      <div class="section">
        <div class="sectionHeader">
          <div class="sectionTitle">Campaign settings</div>
          <div class="sectionSub">These set tone, pacing, and how hard the world bites back.</div>
        </div>

        <div class="charGrid" style="grid-template-columns: 1fr 1fr;">
          <div class="field" id="f_g_q1">
            <label>Party size (computed)</label>
            <input id="g_q1" type="text" value="${escHtml(mode === 'single' ? String(devicePlayers) : 'Computed after everyone submits') }" readonly />
            <div class="help">In multiplayer, the total party size is automatically calculated from each device’s couch co-op count.</div>
          </div>

          <div class="field" id="f_g_q2">
            <label>NPC companions (Q2)</label>
            <input id="g_q2" type="number" min="0" max="20" value="${escHtml(g.q2 ?? "")}" />
            <div class="help">How many non-player party members travel with you at the start.</div>
            ${renderScaleHelpInline('q2')}
          </div>

          <div class="field wide" id="f_g_q3">
            <label>Starting formation (Q3)</label>
            <div style="display:flex; gap:10px; flex-wrap:wrap; opacity:${autoSkipFormation ? '0.55' : '1'};">
              <label class="opt" style="margin:0;"><input type="radio" name="g_q3" value="Together (same starting scene)" ${autoSkipFormation ? 'disabled' : ''}/> <div>Together (same starting scene)</div></label>
              <label class="opt" style="margin:0;"><input type="radio" name="g_q3" value="Separated (meet later)" ${autoSkipFormation ? 'disabled' : ''}/> <div>Separated (meet later)</div></label>
            </div>
            <div class="help">${autoSkipFormation ? 'Auto-skipped: solo start (1 player, 0 NPCs).' : 'Together starts as a group. Separated means you meet later.'}</div>
          </div>

          <div class="field" id="f_g_q4">
            <label>Campaign length (Q4)</label>
            <div class="rangeRow">
              <input id="g_q4" type="range" min="1" max="12" step="1" value="${escHtml(g.q4 ?? "6")}" />
              <span class="pill" id="g_q4_val">${escHtml(g.q4 ?? "6")}</span>
            </div>
            ${renderScaleHelpInline('q4')}
          </div>

          <div class="field" id="f_g_q5">
            <label>Pacing (Q5)</label>
            <div class="rangeRow">
              <input id="g_q5" type="range" min="1" max="10" step="1" value="${escHtml(g.q5 ?? "5")}" />
              <span class="pill" id="g_q5_val">${escHtml(g.q5 ?? "5")}</span>
            </div>
            ${renderScaleHelpInline('q5')}
          </div>

          <div class="field" id="f_g_q6">
            <label>Difficulty (Q6)</label>
            <div class="rangeRow">
              <input id="g_q6" type="range" min="1" max="10" step="1" value="${escHtml(g.q6 ?? "5")}" />
              <span class="pill" id="g_q6_val">${escHtml(g.q6 ?? "5")}</span>
            </div>
            ${renderScaleHelpInline('q6')}
          </div>

          <div class="field" id="f_g_q7">
            <label>Realism severity (Q7)</label>
            <div class="rangeRow">
              <input id="g_q7" type="range" min="1" max="10" step="1" value="${escHtml(g.q7 ?? "5")}" />
              <span class="pill" id="g_q7_val">${escHtml(g.q7 ?? "5")}</span>
            </div>
            ${renderScaleHelpInline('q7')}
          </div>

          <div class="field" id="f_g_q8">
            <label>Mature themes (Q8)</label>
            <div class="rangeRow">
              <input id="g_q8" type="range" min="1" max="10" step="1" value="${escHtml(g.q8 ?? "3")}" />
              <span class="pill" id="g_q8_val">${escHtml(g.q8 ?? "3")}</span>
            </div>
            ${renderScaleHelpInline('q8')}
          </div>
        </div>
      </div>
      ` : ""}

      <div class="section">
        <div class="sectionHeader">
          <div class="sectionTitle">Character sheet</div>
          <div class="sectionSub">Type freely or pick from suggestions. You can edit anything before Submit.</div>
        </div>

        <div class="charForm">
          <div class="charGrid">
            <div class="field" id="f_p_q9">
              <label>Character name (Q9)</label>
              <input id="pc_q9" type="text" placeholder="Name" value="${escHtml(p.q9 ?? joinName)}" />
              <div class="help">Displayed in the party list and the book.</div>
            </div>

            <div class="field" id="f_p_q10">
              <label>Age (Q10) — 18+</label>
              <input id="pc_q10" type="number" min="18" max="200" placeholder="18" value="${escHtml(p.q10 ?? "")}" />
              <div class="help">Age gates tone and mature content.</div>
            </div>

            <div class="field wide" id="f_p_q11">
              <label>Magic status (Q11)</label>
              <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <label class="opt" style="margin:0;"><input type="radio" name="pc_magic" value="Touched (uses magic)" /> <div>Touched (uses magic)</div></label>
                <label class="opt" style="margin:0;"><input type="radio" name="pc_magic" value="Untouched (no magic)" /> <div>Untouched (no magic)</div></label>
              </div>
              <div class="help">Untouched skips affinity and plays as a non-mage.</div>
            </div>

            <div class="field" id="f_p_q12">
              <label>Affinity (Q12) — Touched only</label>
              <select id="pc_q12">
                <option>Fire</option><option>Water</option><option>Air</option><option>Earth</option><option>Soul</option><option>Aether</option>
              </select>
              <div class="help">Primary magical leaning. (Disabled if Untouched.)</div>
            </div>

            <div class="field" id="f_p_q13">
              <label>Archetype / class (Q13)</label>
              <input id="pc_q13" type="text" placeholder="Street-Savant, Knight-Errant, Tracker…" value="${escHtml(p.q13 ?? "")}" />
              <div class="help">Your role in the party — can be weird.</div>
            </div>

            <div class="field wide" id="f_p_q14">
              <label>Background / what you did before (Q14)</label>
              <textarea id="pc_q14" placeholder="A job, calling, curse, debt, oath…">${escHtml(p.q14 ?? "")}</textarea>
            </div>

            <div class="field">
              <label>Eye color</label>
              <input id="pc_eye" list="dlEyes" placeholder="amber, grey…" value="${escHtml(p.app_eye ?? "")}" />
            </div>

            <div class="field">
              <label>Hair color</label>
              <input id="pc_hair" list="dlHair" placeholder="black, silver…" value="${escHtml(p.app_hair ?? "")}" />
            </div>

            <div class="field">
              <label>Body type</label>
              <input id="pc_body" list="dlBody" placeholder="athletic, stocky…" value="${escHtml(p.app_body ?? "")}" />
            </div>

            <div class="field">
              <label>Height / build</label>
              <input id="pc_height" placeholder="tall, compact, 6'1\u2033…" value="${escHtml(p.app_height ?? "")}" />
            </div>

            <div class="field wide">
              <label>Distinctive marks / style</label>
              <textarea id="pc_marks" placeholder="scars, tattoos, jewelry, cloak, cane, scent of smoke…">${escHtml(p.app_marks ?? "")}</textarea>
            </div>
          </div>

          <div class="charPreview">
            <div class="t">Live preview</div>
            <div class="s" id="charPreviewText">…</div>
          </div>
        </div>

        ${datalistHtml("dlEyes", APPEAR_SUGGEST.eyes)}
        ${datalistHtml("dlHair", APPEAR_SUGGEST.hair)}
        ${datalistHtml("dlBody", APPEAR_SUGGEST.body)}
      </div>
    </div>
  `;

  // Wire up defaults for radios/selects
  // Global radios
  if (showGlobalSection) {

    const g3 = aBlockEl.querySelectorAll("input[name=g_q3]");
    const g3Val = autoSkipFormation ? "N/A (auto-skipped: solo start)" : String(g.q3||"");
    g3.forEach(r => { if (r.value === g3Val) r.checked = true; if (autoSkipFormation) r.checked = false; });
    if (autoSkipFormation) intake.answersGlobal.q3 = "N/A (auto-skipped: solo start)";

    // Range pills
    ["q4","q5","q6","q7","q8"].forEach(k => {
      const inp = document.getElementById(`g_${k}`);
      const val = document.getElementById(`g_${k}_val`);
      if (inp && val) val.textContent = String(inp.value);
    });
  }

  // Player radios + affinity select
  const magicDefault = String(p.q11 || "Touched (uses magic)");
  const affinityDefault = String(p.q12 || "Fire");

  const radios = aBlockEl.querySelectorAll("input[name=pc_magic]");
  radios.forEach(r => { if (r.value === magicDefault) r.checked = true; });

  const sel = document.getElementById("pc_q12");
  if (sel) sel.value = affinityDefault;

  function syncMagic() {
    const m = aBlockEl.querySelector("input[name=pc_magic]:checked")?.value || "";
    const touched = m.startsWith("Touched");
    if (sel) {
      sel.disabled = !touched;
      if (!touched) sel.value = "Fire";
    }
  }

  function updatePreview(){
    const data = readPlayerFormAnswers(true);
    const lines = [];
    lines.push(`${data.q9 || joinName}${data.q10 ? `, ${data.q10}` : ""}`);
    if (data.q11) lines.push(data.q11);
    if (data.q11 && data.q11.startsWith("Touched")) lines.push(`Affinity: ${data.q12 || "—"}`);
    if (data.q13) lines.push(`Class: ${data.q13}`);
    if (data.q14) lines.push(`Past: ${data.q14}`);

    const looks = [];
    if (data.app_eye) looks.push(`Eyes: ${data.app_eye}`);
    if (data.app_hair) looks.push(`Hair: ${data.app_hair}`);
    if (data.app_body) looks.push(`Build: ${data.app_body}`);
    if (data.app_height) looks.push(`Height: ${data.app_height}`);
    if (data.app_marks) looks.push(`Marks: ${data.app_marks}`);
    if (looks.length) lines.push("\nAppearance:\n" + looks.join("\n"));

    const el = document.getElementById("charPreviewText");
    if (el) el.textContent = lines.filter(Boolean).join("\n");
  }

  function readAndStoreAll(){
    if (showGlobalSection) readGlobalAnswers(true);
    readPlayerFormAnswers(true);
    saveDraft(DRAFT_GLOBAL_KEY, intake.answersGlobal);
    // Persist multi-character draft
    try {
      setDevicePlayers(activeRoomId, intake.devicePlayers || 1);
      saveDraft(DRAFT_PLAYERS_KEY, {
        devicePlayers: clampInt(intake.devicePlayers || 1, 1, 8),
        activePlayerIdx: clampInt(intake.activePlayerIdx || 0, 0, 7),
        players: Array.isArray(intake.answersPlayers) ? intake.answersPlayers : []
      });
      // Legacy mirror (first character)
      saveDraft(DRAFT_PLAYER_KEY, (Array.isArray(intake.answersPlayers) && intake.answersPlayers[0]) ? intake.answersPlayers[0] : (intake.answersPlayer || {}));
    } catch {}
    updateProgressBar(showGlobalSection);
  }

  // Attach listeners
  const allInputs = aBlockEl.querySelectorAll("input, textarea, select");
  allInputs.forEach(el => {
    const _id = String(el?.id || '');
    // These controls trigger a structural re-render and must not auto-store into the wrong character.
    if (_id === 'local_players' || _id === 'local_char_idx') return;
    el.addEventListener("input", () => { syncMagic(); readAndStoreAll(); updatePreview(); });
    el.addEventListener("change", () => { syncMagic(); readAndStoreAll(); updatePreview(); });
  });

  // Local couch co-op controls need a structural re-render.
  try {
    const lp = document.getElementById('local_players');
    if (lp) {
      lp.addEventListener('change', () => {
        const n = clampInt(lp.value, 1, 8);
        const prevN = clampInt(intake.devicePlayers || 1, 1, 8);
        if (n === prevN) return;

        // IMPORTANT: store the currently visible character form into the *currently active* index
        // BEFORE we change devicePlayers / activePlayerIdx. Otherwise we risk writing Character A's
        // form into Character B's slot.
        const prevIdx = clampInt(intake.activePlayerIdx ?? 0, 0, Math.max(0, prevN - 1));
        try {
          if (showGlobalSection) readGlobalAnswers(true);
          readPlayerFormAnswers(true, prevIdx);
        } catch {}

        intake.devicePlayers = n;
        setDevicePlayers(activeRoomId, n);
        if (!Array.isArray(intake.answersPlayers)) intake.answersPlayers = [];

        // Grow/shrink answersPlayers while preserving existing data.
        const joinName = lsGet('aetheryn_join_name') || 'Anonymous';
        const next = [];
        for (let i = 0; i < n; i++) {
          const base = (intake.answersPlayers[i] && typeof intake.answersPlayers[i] === 'object') ? intake.answersPlayers[i] : {};
          next[i] = { ...base };
          if (!next[i].q9) next[i].q9 = (i === 0) ? joinName : `${joinName} ${i + 1}`;
          if (!next[i].q11) next[i].q11 = 'Touched (uses magic)';
          if (!next[i].q12) next[i].q12 = 'Fire';
        }
        intake.answersPlayers = next;

        // Keep the editor focused on the closest surviving character.
        intake.activePlayerIdx = Math.min(prevIdx, n - 1);

        // Persist drafts without re-reading the old DOM into the new index.
        try {
          saveDraft(DRAFT_GLOBAL_KEY, intake.answersGlobal);
          saveDraft(DRAFT_PLAYERS_KEY, {
            devicePlayers: clampInt(intake.devicePlayers || 1, 1, 8),
            activePlayerIdx: clampInt(intake.activePlayerIdx || 0, 0, 7),
            players: Array.isArray(intake.answersPlayers) ? intake.answersPlayers : []
          });
          saveDraft(DRAFT_PLAYER_KEY, (Array.isArray(intake.answersPlayers) && intake.answersPlayers[0]) ? intake.answersPlayers[0] : (intake.answersPlayer || {}));
        } catch {}

        renderIntake();
      });
    }

    const selIdx = document.getElementById('local_char_idx');
    if (selIdx) {
      selIdx.addEventListener('change', () => {
        const prevIdx = clampInt(intake.activePlayerIdx ?? 0, 0, Math.max(0, (intake.devicePlayers || 1) - 1));
        const nextIdx = clampInt(selIdx.value, 0, Math.max(0, (intake.devicePlayers || 1) - 1));
        if (nextIdx === prevIdx) return;

        // Store the currently visible form into the previous character BEFORE switching.
        try {
          if (showGlobalSection) readGlobalAnswers(true);
          readPlayerFormAnswers(true, prevIdx);
        } catch {}

        intake.activePlayerIdx = nextIdx;

        // Persist drafts without re-reading the old DOM into the new index.
        try {
          saveDraft(DRAFT_GLOBAL_KEY, intake.answersGlobal);
          saveDraft(DRAFT_PLAYERS_KEY, {
            devicePlayers: clampInt(intake.devicePlayers || 1, 1, 8),
            activePlayerIdx: clampInt(intake.activePlayerIdx || 0, 0, 7),
            players: Array.isArray(intake.answersPlayers) ? intake.answersPlayers : []
          });
          saveDraft(DRAFT_PLAYER_KEY, (Array.isArray(intake.answersPlayers) && intake.answersPlayers[0]) ? intake.answersPlayers[0] : (intake.answersPlayer || {}));
        } catch {}

        renderIntake();
      });
    }
  } catch {}

  syncMagic();
  readAndStoreAll();
  updatePreview();

  // Buttons
  intakeBackBtn.disabled = false;
  intakeNextBtn.textContent = "Submit";
  intakeNextBtn.disabled = false;
}

function readGlobalAnswers(liveStore=false){
  const prev = intake.answersGlobal || {};
  const prevAuto = (mode === 'single' && Number(prev.q2||0) === 0 && clampInt(intake.devicePlayers || 1, 1, 8) === 1);
  const q0 = String(intake.answersGlobal?.q0 || prev.q0 || "Player rolls (I type results)").trim();
  const q2 = String(document.getElementById("g_q2")?.value || "").trim();

  // Party size is code-authoritative now.
  const q1 = (mode === 'single') ? String(clampInt(intake.devicePlayers || 1, 1, 8)) : "";
  const pCount = (mode === 'single') ? Number(q1 || 0) : NaN;
  const npcCount = Number(q2 || 0);
  const autoSkip = (mode === 'single' && pCount === 1 && npcCount === 0);

  const q3 = autoSkip
    ? "N/A (auto-skipped: solo start)"
    : String(aBlockEl.querySelector("input[name=g_q3]:checked")?.value || "").trim();

  const q4 = String(document.getElementById("g_q4")?.value || "").trim();
  const q5 = String(document.getElementById("g_q5")?.value || "").trim();
  const q6 = String(document.getElementById("g_q6")?.value || "").trim();
  const q7 = String(document.getElementById("g_q7")?.value || "").trim();
  const q8 = String(document.getElementById("g_q8")?.value || "").trim();

  const data = { q0, q1, q2, q3, q4, q5, q6, q7, q8 };
  if (liveStore) intake.answersGlobal = { ...(intake.answersGlobal||{}), ...data };

  // Range pills
  ["q4","q5","q6","q7","q8"].forEach(k => {
    const inp = document.getElementById(`g_${k}`);
    const val = document.getElementById(`g_${k}_val`);
    if (inp && val) val.textContent = String(inp.value);
  });

  // If formation auto-skip toggled, re-render to disable/enable the formation block.
  if (prevAuto !== autoSkip) {
    // Delay re-render to avoid fighting the current input event.
    setTimeout(() => renderIntake(), 0);
  }

  return data;
}

function validateGlobalAnswers(g){
  const errs = [];
  const must = (k) => { if (!String(g[k]||"").trim()) errs.push(k); };
  must('q2'); must('q4'); must('q5'); must('q6'); must('q7'); must('q8');

  const n2 = Number(g.q2);
  if (!Number.isFinite(n2) || n2 < 0 || n2 > 20) errs.push('q2');

  const autoSkip = (mode === 'single' && clampInt(intake.devicePlayers || 1, 1, 8) === 1 && n2 === 0);
  if (!autoSkip && !String(g.q3||"").trim()) errs.push('q3');

  const inRange = (k, lo, hi) => {
    const n = Number(g[k]);
    if (!Number.isFinite(n) || n < lo || n > hi) errs.push(k);
  };
  inRange('q4', 1, 12);
  inRange('q5', 1, 10);
  inRange('q6', 1, 10);
  inRange('q7', 1, 10);
  inRange('q8', 1, 10);

  return errs;
}

function validatePlayerForm(data){
  if (!data.q9) return "Character name is required.";
  const age = Number(data.q10);
  if (!Number.isFinite(age) || age < 18) return "Age must be 18 or older.";
  if (!data.q11) return "Pick Touched or Untouched.";
  if (data.q11.startsWith("Touched") && (!data.q12 || data.q12 === "N/A")) return "Pick an affinity (or choose Untouched).";
  if (!data.q13) return "Archetype/class is required.";
  if (!data.q14) return "Background/job is required.";
  return "";
}

function readPlayerFormAnswers(liveStore=false, forceIdx=null){
  const joinName = lsGet("aetheryn_join_name") || "Anonymous";
  const q9 = String(document.getElementById("pc_q9")?.value || "").trim() || joinName;
  const q10 = String(document.getElementById("pc_q10")?.value || "").trim();
  const q11 = String(aBlockEl.querySelector("input[name=pc_magic]:checked")?.value || "").trim();
  const q12sel = document.getElementById("pc_q12");
  const q12 = String(q12sel?.value || "").trim();
  const q13 = String(document.getElementById("pc_q13")?.value || "").trim();
  const q14 = String(document.getElementById("pc_q14")?.value || "").trim();

  const app_eye = String(document.getElementById("pc_eye")?.value || "").trim();
  const app_hair = String(document.getElementById("pc_hair")?.value || "").trim();
  const app_body = String(document.getElementById("pc_body")?.value || "").trim();
  const app_height = String(document.getElementById("pc_height")?.value || "").trim();
  const app_marks = String(document.getElementById("pc_marks")?.value || "").trim();

  const data = {
    q9,
    q10,
    q11,
    q12: q11.startsWith("Touched") ? q12 : "N/A",
    q13,
    q14,
    app_eye,
    app_hair,
    app_body,
    app_height,
    app_marks
  };

  if (liveStore) {
    const idx = (forceIdx != null)
      ? clampInt(forceIdx, 0, Math.max(0, (intake.devicePlayers || 1) - 1))
      : clampInt(intake.activePlayerIdx ?? 0, 0, Math.max(0, (intake.devicePlayers || 1) - 1));
    if (!Array.isArray(intake.answersPlayers)) intake.answersPlayers = [];
    if (!intake.answersPlayers[idx]) intake.answersPlayers[idx] = {};
    intake.answersPlayers[idx] = { ...(intake.answersPlayers[idx] || {}), ...data };
    // Legacy mirror (first character)
    if (idx === 0) intake.answersPlayer = { ...(intake.answersPlayers[0] || {}) };
  }
  return data;
}

function clearInvalid(){
  aBlockEl.querySelectorAll('.field.invalid').forEach(el => el.classList.remove('invalid'));
}

function markInvalidFields(keys){
  (keys||[]).forEach(k => {
    const el = document.getElementById(`f_g_${k}`);
    if (el) el.classList.add('invalid');
  });
}

function markInvalidPlayer(){
  // highlight the core required blocks
  ['q9','q10','q11','q12','q13','q14'].forEach(k => {
    const el = document.getElementById(`f_p_${k}`);
    if (el) el.classList.add('invalid');
  });
}

function updateProgressBar(showGlobalSection){
  // Rough completion meter for psychological encouragement.
  const g = intake.answersGlobal || {};
  const players = Array.isArray(intake.answersPlayers) ? intake.answersPlayers : [];
  const p = (players[intake.activePlayerIdx || 0] && typeof players[intake.activePlayerIdx || 0] === 'object') ? players[intake.activePlayerIdx || 0] : {};

  const req = [];
  if (showGlobalSection) {
    req.push('g:q0','g:q2','g:q4','g:q5','g:q6','g:q7','g:q8');
    const autoSkip = (mode === 'single' && clampInt(intake.devicePlayers || 1, 1, 8) === 1 && Number(g.q2||0)===0);
    if (!autoSkip) req.push('g:q3');
  }

  // Count required fields across ALL local characters.
  for (let i = 0; i < Math.max(1, (intake.devicePlayers || 1)); i++) {
    const pp = (players[i] && typeof players[i] === 'object') ? players[i] : {};
    req.push(`p${i}:q9`,`p${i}:q10`,`p${i}:q11`,`p${i}:q13`,`p${i}:q14`);
    const touched = String(pp.q11||'').startsWith('Touched');
    if (touched) req.push(`p${i}:q12`);
  }

  let ok = 0;
  for (const id of req) {
    const [grp,k] = id.split(':');
    let src = g;
    if (grp !== 'g') {
      const m = grp.match(/^p(\d+)$/);
      const idx = m ? Number(m[1]) : 0;
      src = (players[idx] && typeof players[idx] === 'object') ? players[idx] : {};
    }
    const v = String(src[k]||'').trim();
    if (!v) continue;
    ok += 1;
  }

  const pct = Math.round((ok / Math.max(1, req.length)) * 100);
  progressBar.style.width = pct + "%";
}

if (intakeNextBtn) intakeNextBtn.onclick = () => {
  const showGlobalSection = !(mode === "multi" && !isHost);
  clearInvalid();

  // Store latest
  if (showGlobalSection) readGlobalAnswers(true);
  const pdata = readPlayerFormAnswers(true);

  // Validate
  if (showGlobalSection) {
    const bad = validateGlobalAnswers(intake.answersGlobal || {});
    if (bad.length) {
      markInvalidFields(bad);
      return alert("Campaign settings: please fix the highlighted fields.");
    }
  }

  // Validate ALL local characters.
  const players = Array.isArray(intake.answersPlayers) ? intake.answersPlayers : [];
  const n = clampInt(intake.devicePlayers || players.length || 1, 1, 8);
  const namesSeen = new Set();
  for (let i = 0; i < n; i++) {
    const pp = (players[i] && typeof players[i] === 'object') ? players[i] : {};
    const err = validatePlayerForm(pp);
    const nm = String(pp.q9 || '').trim();
    const key = nm.toLowerCase();
    if (!err && key && namesSeen.has(key)) {
      // Duplicate local names make the game state ambiguous.
      intake.activePlayerIdx = i;
      renderIntake();
      markInvalidPlayer();
      return alert(`Duplicate character name on this device: "${nm}". Give each local character a unique name.`);
    }
    if (key) namesSeen.add(key);
    if (err) {
      intake.activePlayerIdx = i;
      renderIntake();
      markInvalidPlayer();
      return alert(`Character ${i + 1}: ${err}`);
    }
  }

  // Persist local character roster (for the action dropdown + server actor binding)
  try {
    const roster = players.slice(0, n).map(pp => String(pp?.q9 || '').trim()).filter(Boolean);
    setMyCharNames(activeRoomId, roster);
    const activeName = String((players[intake.activePlayerIdx || 0]?.q9) || roster[0] || '').trim();
    if (activeName) setActiveCharacter(activeRoomId, activeName);
  } catch {}

  // Persist drafts too
  saveDraft(DRAFT_GLOBAL_KEY, intake.answersGlobal);
  try {
    saveDraft(DRAFT_PLAYERS_KEY, {
      devicePlayers: clampInt(intake.devicePlayers || 1, 1, 8),
      activePlayerIdx: clampInt(intake.activePlayerIdx || 0, 0, 7),
      players: Array.isArray(intake.answersPlayers) ? intake.answersPlayers : []
    });
  } catch {}

  submitIntake();
};

// Back acts as "Close" (keeps your draft).
if (intakeBackBtn) intakeBackBtn.onclick = () => {
  // Save drafts on close.
  saveDraft(DRAFT_GLOBAL_KEY, intake.answersGlobal);
  try {
    saveDraft(DRAFT_PLAYERS_KEY, {
      devicePlayers: clampInt(intake.devicePlayers || 1, 1, 8),
      activePlayerIdx: clampInt(intake.activePlayerIdx || 0, 0, 7),
      players: Array.isArray(intake.answersPlayers) ? intake.answersPlayers : []
    });
    saveDraft(DRAFT_PLAYER_KEY, (Array.isArray(intake.answersPlayers) && intake.answersPlayers[0]) ? intake.answersPlayers[0] : (intake.answersPlayer || {}));
  } catch {}
  closeIntake();
};

// -------------------- Stats Modal UI --------------------

if (statsSubmitBtn) {
  
if (statsSubmitBtn) statsSubmitBtn.onclick = () => {
  try {
    if (!socket) connectSocketIfNeeded();
    if (!socket) return;
    statsSubmitBtn.disabled = true;
    // Include actor explicitly so couch co-op can lock stats for the correct local character.
    const actor = String((window.__statsActor || getMyCharName(activeRoomId) || '')).trim();
    socket.emit("stats_commit_pending", { charName: actor });
    setTimeout(() => { try { statsSubmitBtn.disabled = false; } catch {} }, 1200);
  } catch (err) {
    alert(String(err?.message || err));
  }
};

}

if (statsCloseBtn) {
  if (statsCloseBtn) statsCloseBtn.onclick = () => closeStatsModal();
}

// -------------------- Dice View UI --------------------
function readDiceInputs() {
  const sides = Number(diceSidesSel?.value || 20);
  const count = Math.max(1, Math.min(50, Number(diceCountInp?.value || 1)));
  const modifier = Math.max(-50, Math.min(50, Number(diceModInp?.value || 0)));
  return { sides, count, modifier };
}

if (diceClearBtn) {
  if (diceClearBtn) diceClearBtn.onclick = () => {
    if (diceLogEl) diceLogEl.innerHTML = "";
  };
}

if (diceRollBtn) {
  if (diceRollBtn) diceRollBtn.onclick = () => {
    const { sides, count, modifier } = readDiceInputs();
    requestDiceRoll({ sides, count, modifier, label: "" });
  };
}

if (quick3d6Btn) quick3d6Btn.onclick = () => requestDiceRoll({ sides: 6, count: 3, modifier: 0, label: "3d6", dropLowest: false });
if (quickD20Btn) quickD20Btn.onclick = () => requestDiceRoll({ sides: 20, count: 1, modifier: 0, label: "d20" });
if (quickD6Btn) quickD6Btn.onclick = () => requestDiceRoll({ sides: 6, count: 1, modifier: 0, label: "d6" });

function submitIntake() {
  const joinName = lsGet("aetheryn_join_name") || "Anonymous";

  const devicePlayers = clampInt(intake.devicePlayers || 1, 1, 8);
  const players = Array.isArray(intake.answersPlayers) ? intake.answersPlayers.slice(0, devicePlayers) : [];
  const activeIdx = clampInt(intake.activePlayerIdx || 0, 0, Math.max(0, devicePlayers - 1));
  const activeName = String(players?.[activeIdx]?.q9 || players?.[0]?.q9 || '').trim();
  if (activeName) setMyCharName(activeRoomId, activeName);
  try { setMyCharNames(activeRoomId, players.map(p => String(p?.q9 || '').trim()).filter(Boolean)); } catch {}

  const payload = {
    kind: "AETH_INTAKE_V1",
    mode,
    isHost,
    joinName,
    answersGlobal: (mode === "multi" && !isHost) ? null : intake.answersGlobal,
    devicePlayers,
    activeCharName: activeName,
    answersPlayers: players,
    // legacy compatibility
    answersPlayer: players[0] || intake.answersPlayer || {}
  };

  socket.emit("intake_submit", payload);
  addMsg({ who: "SYSTEM", tag: "INTAKE", text: "Intake submitted. Waiting for the GM..." });
  try { setIntakeSubmitted(activeRoomId, true); } catch {}
  closeIntake();
}
function extractChoicesFromNarration(text){
  if(!text) return [];
  const idx = text.indexOf('CHOICES:');
  if(idx === -1) return [];
  const after = text.slice(idx + 'CHOICES:'.length);
  const lines = after.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  // strip leading bullets
  const cleaned = lines.map(l=>l.replace(/^[-*•]\s*/,'')).filter(Boolean);
  // stop if looks like next section
  return cleaned.slice(0, 8);
}



