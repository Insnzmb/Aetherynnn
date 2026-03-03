// server/turns.js
// Turn manager (initiative + serialized resolution) for Aetheryn Web.
//
// Goals:
// - ONE authoritative turn at a time per room.
// - Players roll for turn order (initiative) using 1d20.
// - Server never races LLM calls: all resolves are serialized per room.
//
// Notes:
// - This module is dependency-injected to avoid circular imports.
// - Turn state is stored on the room state object as `st.turn`.

function keyName(n) {
  return String(n || "").trim().toLowerCase();
}

function uniqNames(list) {
  const out = [];
  const seen = new Set();
  for (const raw of (list || [])) {
    const nm = String(raw || "").trim();
    if (!nm) continue;
    const k = keyName(nm);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(nm);
  }
  return out;
}

function clampInt(n, lo, hi) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return NaN;
  return Math.max(lo, Math.min(hi, v));
}

export function makeTurnManager({ io, getRoomState, normalizeActorName, saveRoomStateFile, onTurnOrderLocked }) {
  const resolveChains = new Map(); // roomId -> Promise

  // Initiative rolling mode:
  // - "auto" (default): server rolls 1d20 for each expected actor instantly.
  // - "prompt": clients are prompted to roll/submit.
  const TURN_ORDER_ROLL_MODE = String(process.env.TURN_ORDER_ROLL_MODE || 'auto').toLowerCase();

  // Turn mode:
  // - "sequential" (legacy): one active actor at a time (traditional initiative turns)
  // - "simultaneous" (recommended): everyone submits an intent, then the server resolves in initiative order
  const TURN_MODE_DEFAULT = String(process.env.TURN_MODE || 'simultaneous').toLowerCase();

  function rollD20() {
    return 1 + Math.floor(Math.random() * 20);
  }

  function fireTurnOrderLocked(roomId, st) {
    try {
      ensureTurnState(st);
      // Only fire once per INIT -> ACTIVE transition.
      if (st.turn._lockedNotified) return;
      st.turn._lockedNotified = true;
      st.turn.lockedAt = Date.now();
      saveRoomStateFile(roomId);
    } catch {}

    try {
      if (typeof onTurnOrderLocked === 'function') onTurnOrderLocked(roomId);
    } catch {}
  }

  function socketActors(st, socket) {
    try {
      const list = [];
      const fromSock = Array.isArray(socket?.data?.charNames) ? socket.data.charNames : [];
      if (fromSock.length) list.push(...fromSock);

      if (!list.length) {
        const rec = st?.intakePlayers?.[socket?.id];
        if (rec && Array.isArray(rec.answersPlayers)) {
          for (const p of rec.answersPlayers) {
            const nm = String(p?.q9 || '').trim();
            if (nm) list.push(nm);
          }
        } else {
          const nm = String(rec?.answers?.q9 || '').trim();
          if (nm) list.push(nm);
        }
      }

      if (!list.length) list.push(String(normalizeActorName(st, socket) || '').trim());
      return uniqNames(list);
    } catch {
      return uniqNames([String(normalizeActorName(st, socket) || '').trim()]);
    }
  }

  function finalizeIfComplete(roomId, st) {
    ensureTurnState(st);
    if (!st.turn.enabled) return false;
    if (String(st.turn.phase || '') !== 'INIT') return false;
    const roster = Array.isArray(st.turn.expected) ? st.turn.expected : [];
    if (roster.length <= 1) {
      const solo = String(roster[0] || '').trim() || '';
      if (!solo) {
        st.turn.phase = 'OFF';
        st.turn.order = [];
        st.turn.active = '';
        st.turn.currentIdx = 0;
        st.turn.round = 1;
        st.turn.updatedAt = Date.now();
        saveRoomStateFile(roomId);
        emitTurnUpdate(roomId);
        return true;
      }
      st.turn.phase = 'ACTIVE';
      st.turn.order = [solo];
      st.turn.active = solo;
      st.turn.currentIdx = 0;
      st.turn.round = 1;
      st.turn.updatedAt = Date.now();
      if (st.turn.rolls && st.turn.rolls[keyName(solo)] == null) st.turn.rolls[keyName(solo)] = 20;
      saveRoomStateFile(roomId);
      emitTurnUpdate(roomId);
      fireTurnOrderLocked(roomId, st);
      return true;
    }

    const haveAll = roster.every(n => {
      const kk = keyName(n);
      return st.turn.rolls && st.turn.rolls[kk] != null;
    });
    if (!haveAll) return false;

    const scored = roster.map((n, idx) => ({
      name: n,
      idx,
      roll: Number(st.turn.rolls[keyName(n)]) || 0,
    }));
    scored.sort((a, b) => (b.roll !== a.roll ? (b.roll - a.roll) : (a.idx - b.idx)));

    st.turn.order = scored.map(s => s.name);
    st.turn.currentIdx = 0;
    st.turn.round = 1;
    st.turn.updatedAt = Date.now();

    const isSim = String(st.turn.mode || '').toUpperCase() === 'SIMULTANEOUS';
    if (isSim && st.turn.order.length > 1) {
      st.turn.phase = 'PLAN';
      st.turn.active = '';
      st.turn.intents = {};
      st.turn.planningAt = Date.now();
    } else {
      st.turn.phase = 'ACTIVE';
      st.turn.active = st.turn.order[0] || '';
    }

    saveRoomStateFile(roomId);

    try {
      const line = scored.map(s => `${s.name}(${s.roll})`).join(', ');
      io.to(roomId).emit('system', `Turn order locked: ${line}.`);
      if (isSim && st.turn.order.length > 1) {
        io.to(roomId).emit('system', `— Round ${st.turn.round} planning — Everyone submit an intent (your action) before resolution.`);
      } else if (st.turn.active) {
        io.to(roomId).emit('system', `It is now ${st.turn.active}'s turn.`);
      }
    } catch {}

    emitTurnUpdate(roomId);
    fireTurnOrderLocked(roomId, st);
    return true;
  }

  function ensureTurnState(st) {
    if (!st.turn || typeof st.turn !== "object") {
      st.turn = {
        enabled: true,
        // OFF | INIT | ACTIVE (sequential) | PLAN | RESOLVING (simultaneous)
        phase: "OFF",
        // SEQUENTIAL | SIMULTANEOUS
        mode: (TURN_MODE_DEFAULT.startsWith('sim') ? 'SIMULTANEOUS' : 'SEQUENTIAL'),
        expected: [],
        rolls: {},
        order: [],
        currentIdx: 0,
        round: 1,
        active: "",
        // Simultaneous-intent round buffer: { [actorKey]: { actor, text, playerId, socketId, at } }
        intents: {},
        planningAt: 0,
        startedAt: 0,
        updatedAt: 0,
      };
    }
    if (!st.turn.rolls || typeof st.turn.rolls !== "object") st.turn.rolls = {};
    if (!Array.isArray(st.turn.expected)) st.turn.expected = [];
    if (!Array.isArray(st.turn.order)) st.turn.order = [];
    // Normalize mode
    const m0 = String(st.turn.mode || TURN_MODE_DEFAULT || '').trim().toUpperCase();
    st.turn.mode = m0.startsWith('SIM') ? 'SIMULTANEOUS' : 'SEQUENTIAL';
    if (!st.turn.intents || typeof st.turn.intents !== "object") st.turn.intents = {};
    st.turn.planningAt = Number(st.turn.planningAt || 0) || 0;
    st.turn.enabled = st.turn.enabled !== false;
  }

  function snapshot(st) {
    ensureTurnState(st);

  // -------------------- Simultaneous intent mode helpers --------------------
  // In SIMULTANEOUS mode, the room alternates:
  // PLAN (collect intents from all actors) -> RESOLVING (server resolves in initiative order) -> PLAN (next round)
  function submitIntent(roomId, socket, { actorName, text } = {}) {
    const st = getRoomState(roomId);
    ensureTurnState(st);
    const mode = String(st.turn.mode || 'SEQUENTIAL').toUpperCase();
    if (mode !== 'SIMULTANEOUS') return { ok: false, reason: 'not_simultaneous' };

    const phase = String(st.turn.phase || 'OFF').toUpperCase();
    if (phase !== 'PLAN') return { ok: false, reason: 'not_planning' };

    const order = Array.isArray(st.turn.order) ? st.turn.order : [];
    if (!order.length) return { ok: false, reason: 'no_order' };

    const want = String(actorName || '').trim();
    if (!want) return { ok: false, reason: 'no_actor' };

    const canonical = order.find(n => keyName(n) === keyName(want));
    if (!canonical) return { ok: false, reason: 'actor_not_in_order' };

    const k = keyName(canonical);
    if (!k) return { ok: false, reason: 'bad_actor' };

    const pid = String(socket?.data?.playerId || '').trim() || null;
    const sid = String(socket?.id || '').trim() || null;

    const t = String(text || '').trim();
    if (!t) return { ok: false, reason: 'empty_text' };

    st.turn.intents[k] = { actor: canonical, text: t.slice(0, 2000), playerId: pid, socketId: sid, at: Date.now() };
    st.turn.updatedAt = Date.now();
    if (!st.turn.planningAt) st.turn.planningAt = Date.now();
    saveRoomStateFile(roomId);
    emitTurnUpdate(roomId);

    const readyCount = order.filter(n => !!st.turn.intents[keyName(n)]).length;
    const totalCount = order.length;
    const allReady = totalCount > 0 && readyCount >= totalCount;

    return { ok: true, actor: canonical, readyCount, totalCount, allReady };
  }

  function beginResolvingRound(roomId, { fillMissing = true, defaultIntent = 'Hold position and reassess.' } = {}) {
    const st = getRoomState(roomId);
    ensureTurnState(st);
    const mode = String(st.turn.mode || 'SEQUENTIAL').toUpperCase();
    if (mode !== 'SIMULTANEOUS') return null;

    const phase = String(st.turn.phase || 'OFF').toUpperCase();
    if (phase !== 'PLAN') return null;

    const order = Array.isArray(st.turn.order) ? [...st.turn.order] : [];
    if (!order.length) return null;

    const intents0 = (st.turn.intents && typeof st.turn.intents === 'object') ? st.turn.intents : {};
    const intents = {};
    for (const nm of order) {
      const k = keyName(nm);
      const hit = intents0[k];
      if (hit && typeof hit === 'object' && String(hit.text || '').trim()) {
        intents[k] = { ...hit, actor: nm, text: String(hit.text || '').trim() };
      } else if (fillMissing) {
        intents[k] = { actor: nm, text: String(defaultIntent || '').trim(), playerId: null, socketId: null, at: Date.now() };
      }
    }

    st.turn.phase = 'RESOLVING';
    st.turn.updatedAt = Date.now();
    saveRoomStateFile(roomId);
    emitTurnUpdate(roomId);

    return { order, intents, round: Number(st.turn.round || 1) || 1 };
  }

  function finishResolvingRound(roomId, { incrementRound = true } = {}) {
    const st = getRoomState(roomId);
    ensureTurnState(st);
    const mode = String(st.turn.mode || 'SEQUENTIAL').toUpperCase();
    if (mode !== 'SIMULTANEOUS') return false;

    // Advance round counter and go back to planning.
    if (incrementRound) {
      st.turn.round = (Number(st.turn.round || 1) || 1) + 1;
      try { io.to(roomId).emit('system', `— Round ${st.turn.round} planning —`); } catch {}
    }
    st.turn.phase = 'PLAN';
    st.turn.active = '';
    st.turn.currentIdx = 0;
    st.turn.intents = {};
    st.turn.planningAt = Date.now();
    st.turn.updatedAt = Date.now();
    saveRoomStateFile(roomId);
    emitTurnUpdate(roomId);
    return true;
  }

  function isSimultaneous(roomId) {
    try {
      const st = getRoomState(roomId);
      ensureTurnState(st);
      return String(st.turn.mode || 'SEQUENTIAL').toUpperCase() === 'SIMULTANEOUS';
    } catch { return false; }
  }

  return {
      enabled: !!st.turn.enabled,
      phase: String(st.turn.phase || "OFF"),
      mode: String(st.turn.mode || "SEQUENTIAL"),
      expected: Array.isArray(st.turn.expected) ? st.turn.expected : [],
      rolls: st.turn.rolls || {},
      order: Array.isArray(st.turn.order) ? st.turn.order : [],
      currentIdx: Number(st.turn.currentIdx || 0) || 0,
      round: Number(st.turn.round || 1) || 1,
      active: String(st.turn.active || ""),
      // Simultaneous intent status
      intents: (() => {
        try {
          const o = Array.isArray(st.turn.order) ? st.turn.order : [];
          const intents = (st.turn.intents && typeof st.turn.intents === 'object') ? st.turn.intents : {};
          const out = {};
          for (const nm of o) out[String(nm || '')] = !!intents[keyName(nm)];
          return out;
        } catch { return {}; }
      })(),
      readyCount: (() => {
        try {
          const o = Array.isArray(st.turn.order) ? st.turn.order : [];
          const intents = (st.turn.intents && typeof st.turn.intents === 'object') ? st.turn.intents : {};
          return o.filter(n => !!intents[keyName(n)]).length;
        } catch { return 0; }
      })(),
      totalCount: (() => {
        try { return (Array.isArray(st.turn.order) ? st.turn.order.length : 0) || 0; } catch { return 0; }
      })(),
      startedAt: Number(st.turn.startedAt || 0) || 0,
      updatedAt: Number(st.turn.updatedAt || 0) || 0,
    };
  }

  // -------------------- Simultaneous intent mode helpers --------------------
  // NOTE:
  // These helpers must live at the makeTurnManager scope (not nested inside snapshot),
  // because the server calls them directly via the exported turn manager.
  // A previous patch accidentally nested them inside snapshot(), causing a ReferenceError
  // at module init time and the server to exit immediately.
  function submitIntent(roomId, socket, { actorName, text } = {}) {
    const st = getRoomState(roomId);
    ensureTurnState(st);
    const mode = String(st.turn.mode || 'SEQUENTIAL').toUpperCase();
    if (mode !== 'SIMULTANEOUS') return { ok: false, reason: 'not_simultaneous' };

    const phase = String(st.turn.phase || 'OFF').toUpperCase();
    if (phase !== 'PLAN') return { ok: false, reason: 'not_planning' };

    const order = Array.isArray(st.turn.order) ? st.turn.order : [];
    if (!order.length) return { ok: false, reason: 'no_order' };

    const want = String(actorName || '').trim();
    if (!want) return { ok: false, reason: 'no_actor' };

    const canonical = order.find(n => keyName(n) === keyName(want));
    if (!canonical) return { ok: false, reason: 'actor_not_in_order' };

    const k = keyName(canonical);
    if (!k) return { ok: false, reason: 'bad_actor' };

    const pid = String(socket?.data?.playerId || '').trim() || null;
    const sid = String(socket?.id || '').trim() || null;

    const t = String(text || '').trim();
    if (!t) return { ok: false, reason: 'empty_text' };

    st.turn.intents[k] = { actor: canonical, text: t.slice(0, 2000), playerId: pid, socketId: sid, at: Date.now() };
    st.turn.updatedAt = Date.now();
    if (!st.turn.planningAt) st.turn.planningAt = Date.now();
    saveRoomStateFile(roomId);
    emitTurnUpdate(roomId);

    const readyCount = order.filter(n => !!st.turn.intents[keyName(n)]).length;
    const totalCount = order.length;
    const allReady = totalCount > 0 && readyCount >= totalCount;

    return { ok: true, actor: canonical, readyCount, totalCount, allReady };
  }

  function beginResolvingRound(roomId, { fillMissing = true, defaultIntent = 'Hold position and reassess.' } = {}) {
    const st = getRoomState(roomId);
    ensureTurnState(st);
    const mode = String(st.turn.mode || 'SEQUENTIAL').toUpperCase();
    if (mode !== 'SIMULTANEOUS') return null;

    const phase = String(st.turn.phase || 'OFF').toUpperCase();
    if (phase !== 'PLAN') return null;

    const order = Array.isArray(st.turn.order) ? [...st.turn.order] : [];
    if (!order.length) return null;

    const intents0 = (st.turn.intents && typeof st.turn.intents === 'object') ? st.turn.intents : {};
    const intents = {};
    for (const nm of order) {
      const k = keyName(nm);
      const hit = intents0[k];
      if (hit && typeof hit === 'object' && String(hit.text || '').trim()) {
        intents[k] = { ...hit, actor: nm, text: String(hit.text || '').trim() };
      } else if (fillMissing) {
        intents[k] = { actor: nm, text: String(defaultIntent || '').trim(), playerId: null, socketId: null, at: Date.now() };
      }
    }

    st.turn.phase = 'RESOLVING';
    st.turn.updatedAt = Date.now();
    saveRoomStateFile(roomId);
    emitTurnUpdate(roomId);

    return { order, intents, round: Number(st.turn.round || 1) || 1 };
  }

  function finishResolvingRound(roomId, { incrementRound = true } = {}) {
    const st = getRoomState(roomId);
    ensureTurnState(st);
    const mode = String(st.turn.mode || 'SEQUENTIAL').toUpperCase();
    if (mode !== 'SIMULTANEOUS') return false;

    if (incrementRound) {
      st.turn.round = (Number(st.turn.round || 1) || 1) + 1;
      try { io.to(roomId).emit('system', `— Round ${st.turn.round} planning —`); } catch {}
    }
    st.turn.phase = 'PLAN';
    st.turn.active = '';
    st.turn.currentIdx = 0;
    st.turn.intents = {};
    st.turn.planningAt = Date.now();
    st.turn.updatedAt = Date.now();
    saveRoomStateFile(roomId);
    emitTurnUpdate(roomId);
    return true;
  }

  function isSimultaneous(roomId) {
    try {
      const st = getRoomState(roomId);
      ensureTurnState(st);
      return String(st.turn.mode || 'SEQUENTIAL').toUpperCase() === 'SIMULTANEOUS';
    } catch { return false; }
  }

  // Reset the per-room resolve/serialization lock (host tools + watchdog recovery)
  function resetResolveLock(roomId) {
    const rid = String(roomId || '').trim();
    if (!rid) return;

    // Match the server-side resolver's fields when present.
    try {
      const state = getRoomState(rid);
      if (state) {
        delete state.resolveLock;
        delete state.isResolving;
        delete state.currentResolvePromise;
      }
    } catch {}

    // Also clear the local serialization chain used by this module.
    try { resolveChains.delete(rid); } catch {}
  }

  function emitTurnUpdate(roomId) {
    try {
      const st = getRoomState(roomId);
      io.to(roomId).emit("turn_update", { roomId, turn: snapshot(st), ts: Date.now() });
    } catch {}
  }

  async function computeRoster(roomId) {
    const st = getRoomState(roomId);
    const roster0 = Array.isArray(st.playerCharNames) ? st.playerCharNames : [];
    let roster = uniqNames(roster0);
    if (roster.length) return roster;

    // Fallback: derive from connected sockets (supports couch co-op: multiple actors per device).
    try {
      const sockets = await io.in(roomId).fetchSockets();
      const names = [];
      for (const s of sockets) {
        try { names.push(...socketActors(st, s)); } catch {}
      }
      roster = uniqNames(names);
    } catch {
      roster = [];
    }
    return roster;
  }

  async function startInitiative(roomId, { force = false } = {}) {
    const st = getRoomState(roomId);
    ensureTurnState(st);
    if (!st.turn.enabled) return;

    // Don’t restart if already active unless forced.
    if (!force && st.turn.phase && st.turn.phase !== "OFF") {
      emitTurnUpdate(roomId);
      return;
    }

    // New initiative cycle: clear lock notification.
    try { st.turn._lockedNotified = false; st.turn.lockedAt = 0; } catch {}

    const roster = await computeRoster(roomId);
    if (roster.length <= 1) {
      const solo = String(roster[0] || "").trim() || "Solo";
      st.turn.phase = "ACTIVE";
      st.turn.expected = [solo];
      st.turn.rolls = { [keyName(solo)]: 20 };
      st.turn.order = [solo];
      st.turn.currentIdx = 0;
      st.turn.round = 1;
      st.turn.active = solo;
      st.turn.startedAt = Date.now();
      st.turn.updatedAt = Date.now();
      saveRoomStateFile(roomId);
      emitTurnUpdate(roomId);
      fireTurnOrderLocked(roomId, st);
      return;
    }

    st.turn.phase = "INIT";
    st.turn.expected = roster;
    st.turn.rolls = {};
    st.turn.order = [];
    st.turn.currentIdx = 0;
    st.turn.round = 1;
    st.turn.active = "";
    st.turn.startedAt = Date.now();
    st.turn.updatedAt = Date.now();
    saveRoomStateFile(roomId);

    // Default behavior: server-side instant initiative (no modal, no AI).
    if (TURN_ORDER_ROLL_MODE !== 'prompt') {
      try {
        for (const n of roster) {
          const kk = keyName(n);
          if (!kk) continue;
          st.turn.rolls[kk] = rollD20();
        }
        st.turn.updatedAt = Date.now();
        saveRoomStateFile(roomId);
      } catch {}
      finalizeIfComplete(roomId, st);
      return;
    }

    try { io.to(roomId).emit("system", "Turn order: roll 1d20 to set initiative."); } catch {}
    emitTurnUpdate(roomId);

    // Prompt each connected player to roll if they are in the expected roster.
    try {
      const sockets = await io.in(roomId).fetchSockets();
      for (const s of sockets) {
        const actors = socketActors(st, s);
        for (const actor0 of actors) {
          const actor = String(actor0 || '').trim();
          if (!actor) continue;
          const k = keyName(actor);
          const inRoster = roster.some(n => keyName(n) === k);
          if (!inRoster) continue;
          if (st.turn.rolls && st.turn.rolls[k] != null) continue;
          try {
            s.emit("turn_order_required", {
              roomId,
              actor,
              spec: { sides: 20, count: 1, dropLowest: false, label: "Turn Order" },
              note: "Roll 1d20 for initiative. Highest goes first. Ties break by join order.",
            });
          } catch {}
          break; // one prompt at a time per device
        }
      }
    } catch {}
  }

  function canActorAct(roomId, actorName) {
    try {
      const st = getRoomState(roomId);
      ensureTurnState(st);
      if (!st.turn.enabled) return true;

      const phase = String(st.turn.phase || "OFF").toUpperCase();
      const mode = String(st.turn.mode || "SEQUENTIAL").toUpperCase();

      if (phase === "OFF") return true;
      if (phase === "INIT") return false;

      if (mode === "SIMULTANEOUS") {
        if (phase === "PLAN") return true;        // everyone may submit/update intent
        if (phase === "RESOLVING") return false;  // resolution is server-only
      }

      // Sequential legacy: only the active actor can act.
      const active = String(st.turn.active || "").trim();
      if (!active) return false;
      return keyName(active) === keyName(actorName);
    } catch {
      return true;
    }
  }

  function promptIfNeeded(roomId, socket) {
    try {
      const st = getRoomState(roomId);
      ensureTurnState(st);
      if (!st.turn.enabled) return;
      if (String(st.turn.phase || "") !== "INIT") return;

      const roster = Array.isArray(st.turn.expected) ? st.turn.expected : [];
      if (!roster.length) return;

      // Couch co-op: a single socket may own multiple actors. Prompt ONE at a time.
      const actors = socketActors(st, socket);
      for (const actor0 of actors) {
        const actor = String(actor0 || "").trim();
        if (!actor) continue;
        const k = keyName(actor);
        const inRoster = roster.some(n => keyName(n) === k);
        if (!inRoster) continue;
        if (st.turn.rolls && st.turn.rolls[k] != null) continue;

        socket.emit("turn_order_required", {
          roomId,
          actor,
          spec: { sides: 20, count: 1, dropLowest: false, label: "Turn Order" },
          note: "Roll 1d20 for initiative. Highest goes first. Ties break by join order.",
        });
        break;
      }
    } catch {}
  }


  async function submitInitiative(roomId, socket, { total, actor } = {}) {
    const st = getRoomState(roomId);
    ensureTurnState(st);

    if (!st.turn.enabled) {
      try { socket.emit("turn_roll_done", { ok: false, message: "Turn system is disabled." }); } catch {}
      return;
    }

    if (String(st.turn.phase || "") !== "INIT") {
      try { socket.emit("turn_roll_done", { ok: false, message: "Turn order is not currently being rolled." }); } catch {}
      emitTurnUpdate(roomId);
      return;
    }

    const roster = Array.isArray(st.turn.expected) ? st.turn.expected : [];
    const myActors = socketActors(st, socket);

    // Pick which actor this roll is for.
    let picked = String(actor || "").trim();

    if (picked) {
      const hit = myActors.find(n => keyName(n) === keyName(picked));
      if (hit) picked = hit;
    } else {
      // If the client didn't specify, assume "first missing" for this device.
      for (const a0 of myActors) {
        const a = String(a0 || "").trim();
        if (!a) continue;
        const inRoster = roster.some(n => keyName(n) === keyName(a));
        if (!inRoster) continue;
        const kk = keyName(a);
        if (st.turn.rolls && st.turn.rolls[kk] != null) continue;
        picked = a;
        break;
      }
    }

    if (!picked) picked = String(normalizeActorName(st, socket) || "").trim();

    const canonical = roster.find(n => keyName(n) === keyName(picked));
    if (!canonical) {
      try { socket.emit("turn_roll_done", { ok: false, message: "That actor is not in the initiative roster." }); } catch {}
      return;
    }

    // Ensure this socket is allowed to roll for that actor.
    const allowed = myActors.some(n => keyName(n) === keyName(canonical));
    if (!allowed) {
      try { socket.emit("turn_roll_done", { ok: false, message: "That character is not registered on this device." }); } catch {}
      return;
    }

    const v = clampInt(total, 1, 20);
    if (!Number.isFinite(v)) {
      try { socket.emit("turn_roll_done", { ok: false, message: "Invalid initiative roll. Expected 1–20." }); } catch {}
      return;
    }

    const k = keyName(canonical);
    if (st.turn.rolls && st.turn.rolls[k] != null) {
      try { socket.emit("turn_roll_done", { ok: false, message: `Initiative already submitted for ${canonical}.` }); } catch {}
      return;
    }

    st.turn.rolls[k] = v;
    st.turn.updatedAt = Date.now();
    saveRoomStateFile(roomId);

    try { socket.emit("turn_roll_done", { ok: true, actor: canonical, total: v }); } catch {}
    emitTurnUpdate(roomId);

    // If all rolls are in, lock the order; otherwise prompt the next local actor if needed.
    const done = finalizeIfComplete(roomId, st);
    if (!done) {
      try { promptIfNeeded(roomId, socket); } catch {}
    }
  }


  // Disconnect handling:
  // - INIT: remove the leaver from expected so the room can't be stuck forever.
  // - ACTIVE: remove the leaver from order; if they were active, advance to next.
  function handleDisconnect(roomId, actorName) {
    try {
      const st = getRoomState(roomId);
      ensureTurnState(st);
      if (!st.turn.enabled) return;
      const who = String(actorName || '').trim();
      if (!who) return;
      const k = keyName(who);
      const phase = String(st.turn.phase || 'OFF');

      if (phase === 'INIT') {
        const before = Array.isArray(st.turn.expected) ? st.turn.expected : [];
        st.turn.expected = before.filter(n => keyName(n) !== k);
        try { if (st.turn.rolls) delete st.turn.rolls[k]; } catch {}
        st.turn.updatedAt = Date.now();
        saveRoomStateFile(roomId);
        emitTurnUpdate(roomId);
        finalizeIfComplete(roomId, st);
        return;
      }

      if (phase === 'ACTIVE' || phase === 'PLAN' || phase === 'RESOLVING') {
        const mode = String(st.turn.mode || 'SEQUENTIAL').toUpperCase();
        const order0 = Array.isArray(st.turn.order) ? st.turn.order : [];
        const order = order0.filter(n => keyName(n) !== k);
        st.turn.order = order;

        // Remove any pending intent for this actor.
        try { if (st.turn.intents) delete st.turn.intents[k]; } catch {}

        if (!order.length) {
          st.turn.phase = 'OFF';
          st.turn.active = '';
          st.turn.currentIdx = 0;
          st.turn.round = 1;
          st.turn.updatedAt = Date.now();
          saveRoomStateFile(roomId);
          emitTurnUpdate(roomId);
          return;
        }

        // Simultaneous intent mode: keep planning/resolving state, no active spotlight.
        if (mode === 'SIMULTANEOUS' && (phase === 'PLAN' || phase === 'RESOLVING')) {
          st.turn.active = '';
          st.turn.currentIdx = 0;
          st.turn.updatedAt = Date.now();
          saveRoomStateFile(roomId);
          try { io.to(roomId).emit('system', `${who} left.`); } catch {}
          emitTurnUpdate(roomId);
          return;
        }

        // Sequential ACTIVE mode:

        let idx = Number(st.turn.currentIdx || 0) || 0;
        if (idx >= order.length) idx = 0;
        const active = String(st.turn.active || '').trim();
        if (keyName(active) === k) {
          // Active player left: next in line becomes active.
          st.turn.active = order[idx] || order[0] || '';
          st.turn.updatedAt = Date.now();
          saveRoomStateFile(roomId);
          try { io.to(roomId).emit('system', `${who} left. Skipping their turn.`); } catch {}
          try { if (st.turn.active) io.to(roomId).emit('system', `It is now ${st.turn.active}'s turn.`); } catch {}
          emitTurnUpdate(roomId);
          return;
        }

        // Non-active player left: keep current active.
        st.turn.currentIdx = idx;
        st.turn.updatedAt = Date.now();
        saveRoomStateFile(roomId);
        emitTurnUpdate(roomId);
        return;
      }
    } catch {}
  }

  function advanceTurn(roomId) {
    const st = getRoomState(roomId);
    ensureTurnState(st);
    if (!st.turn.enabled) return;
    if (String(st.turn.phase || "") !== "ACTIVE") return;
    const order = Array.isArray(st.turn.order) ? st.turn.order : [];
    if (!order.length) return;

    let idx = Number(st.turn.currentIdx || 0) || 0;
    idx += 1;
    if (idx >= order.length) {
      idx = 0;
      st.turn.round = (Number(st.turn.round || 1) || 1) + 1;
      try { io.to(roomId).emit("system", `— Round ${st.turn.round} —`); } catch {}
    }
    st.turn.currentIdx = idx;
    st.turn.active = order[idx] || "";
    st.turn.updatedAt = Date.now();
    saveRoomStateFile(roomId);

    try {
      if (st.turn.active) io.to(roomId).emit("system", `It is now ${st.turn.active}'s turn.`);
    } catch {}
    emitTurnUpdate(roomId);
  }

  function withRoomResolveLock(roomId, fn) {
    const rid = String(roomId || "").trim();
    if (!rid) return Promise.resolve().then(fn);

    const timeoutMs = Math.max(1000, Number(process.env.TURN_RESOLVE_TIMEOUT_MS || (Number(process.env.LLM_TIMEOUT_MS || 120000) + 30000)));

    const runWithTimeout = async () => {
      let timer = null;
      try {
        return await Promise.race([
          Promise.resolve().then(fn),
          new Promise((_, rej) => {
            timer = setTimeout(() => {
              rej(new Error(`Turn resolve timed out after ${timeoutMs}ms`));
            }, timeoutMs);
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    };

    const prev = resolveChains.get(rid) || Promise.resolve();
    const next = prev.then(runWithTimeout, runWithTimeout);
    // Keep chain alive even if next rejects.
    resolveChains.set(rid, next.catch(() => {}));
    return next;
  }

  async function syncToSocket(roomId, socket) {
    try {
      const st = getRoomState(roomId);
      ensureTurnState(st);
      socket.emit("turn_update", { roomId, turn: snapshot(st), ts: Date.now() });
      promptIfNeeded(roomId, socket);
    } catch {}
  }

  return {
    startInitiative,
    submitInitiative,
    canActorAct,
    promptIfNeeded,
    advanceTurn,
    emitTurnUpdate,
    withRoomResolveLock,
    resetResolveLock,
    syncToSocket,
    handleDisconnect,
    // simultaneous intent helpers
    submitIntent,
    beginResolvingRound,
    finishResolvingRound,
    isSimultaneous,
  };
}
