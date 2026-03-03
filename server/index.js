import express from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import os from "os";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { llmChat, normProvider } from "./llm_adapter.js";
import { probeLLM } from "./llm_probe.js";
import { makeTurnManager } from "./turns.js";
import { loadEntityRegistry, validateUnifiedTurnOutput, buildRepairInstruction, extractProperNounPhrases } from "./hallucination_firewall.js";

dotenv.config();

// -------------------- Action roll input mode --------------------
// "auto": server rolls behind the scenes (shown in UI via dice_result) and resolves immediately.
// "prompt" (default): require the player to submit a physical roll or press AI Roll in the modal before resolving.
// Override in server/.env with ACTION_ROLL_MODE=auto if you prefer faster play.
const ACTION_ROLL_MODE = String(process.env.ACTION_ROLL_MODE || "prompt").toLowerCase();

// Turn-start recap UI (private "RECAP" box) is OFF by default.
// We still weave teammate activity into prose via observed_items; this only controls the extra UI nudge.
const TURN_RECAP_UI = String(process.env.TURN_RECAP_UI || "off").toLowerCase() === "on";

// -------------------- LLM PROBE (fail-fast UX) --------------------
// Used for UI status and to avoid "Waiting for AI..." hangs when Ollama is down/misconfigured.
let LLM_STATUS = { ok: false, provider: "unknown", detail: "Not probed yet", hint: "" };

async function refreshLLMStatus() {
  try {
    const s = await probeLLM(process.env);
    LLM_STATUS = (s && typeof s === "object")
      ? { ...s }
      : { ok: false, provider: "unknown", detail: "Probe returned invalid status", hint: "" };
  } catch (e) {
    LLM_STATUS = { ok: false, provider: "unknown", detail: `Probe crashed: ${String(e?.message || e)}`, hint: "" };
  }
  return LLM_STATUS;
}
// -------------------- END LLM PROBE --------------------


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------- Crafting (recipes + foraging/hunting) --------------------
// Code-authoritative recipes live in server/canon/recipes.json (shipped with the build).
const CRAFT_RECIPES_PATH = path.resolve(__dirname, './canon/recipes.json');
let CRAFTING = { version: 1, recipes: [], gather_tables: {} };
function loadCraftingData() {
  try {
    if (fs.existsSync(CRAFT_RECIPES_PATH)) {
      const raw = fs.readFileSync(CRAFT_RECIPES_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        CRAFTING = {
          version: Number(parsed.version || 1) || 1,
          recipes: Array.isArray(parsed.recipes) ? parsed.recipes : [],
          gather_tables: (parsed.gather_tables && typeof parsed.gather_tables === 'object') ? parsed.gather_tables : {}
        };
      }
    }
  } catch {
    CRAFTING = { version: 1, recipes: [], gather_tables: {} };
  }
}
loadCraftingData();

// Consume effects for crafted foods/potions (code-authoritative).
// These are conservative deltas; they never invent meters.
const CONSUME_EFFECTS = {
  'trail rations': [{ meter: 'stamina', delta: 2 }],
  'thornback stew': [{ meter: 'hp', delta: 2 }, { meter: 'stamina', delta: 2 }],
  'reed tea': [{ meter: 'mp', delta: 2 }, { meter: 'stamina', delta: 1 }],
  'healing poultice': [{ meter: 'hp', delta: 4 }],
  'aether draught': [{ meter: 'mp', delta: 4 }],
  'stamina tonic': [{ meter: 'stamina', delta: 4 }],
  'salted fish': [{ meter: 'stamina', delta: 2 }],
  'antidote': [{ meter: 'hp', delta: 1 }, { meter: 'mp', delta: 1 }]
};
// -------------------- END Crafting --------------------


// -------------------- Canon map coords (server-side helpers) --------------------
// Used for: land-only start location + region tagging + quiet-zone detection.
const CANON_MAP_COORDS_PATH = path.resolve(__dirname, '../web/assets/aetheryn_map_canon_coords_v2.json');
let CANON_MAP_COORDS = null;
let CANON_MAP_SETTLEMENTS = [];
let CANON_MAP_MOUNTAINS = [];
try {
  if (fs.existsSync(CANON_MAP_COORDS_PATH)) {
    CANON_MAP_COORDS = JSON.parse(fs.readFileSync(CANON_MAP_COORDS_PATH, 'utf8'));
    CANON_MAP_SETTLEMENTS = Array.isArray(CANON_MAP_COORDS?.settlements)
      ? CANON_MAP_COORDS.settlements
          .map(s => ({
            id: Number(s?.id) || 0,
            name: String(s?.name || '').trim(),
            type: String(s?.type || '').trim(),
            kingdom_id: String(s?.kingdom_id || '').trim(),
            x: Number(Array.isArray(s?.xy) ? s.xy[0] : NaN),
            y: Number(Array.isArray(s?.xy) ? s.xy[1] : NaN)
          }))
          .filter(s => s.name && Number.isFinite(s.x) && Number.isFinite(s.y) && s.x >= 0 && s.x <= 1 && s.y >= 0 && s.y <= 1)
      : [];

    CANON_MAP_MOUNTAINS = Array.isArray(CANON_MAP_COORDS?.features?.mountains)
      ? CANON_MAP_COORDS.features.mountains
          .map(m => ({
            name: String(m?.name || '').trim(),
            polygon: Array.isArray(m?.polygon)
              ? m.polygon
                  .map(pt => [Number(pt?.[0]), Number(pt?.[1])])
                  .filter(pt => pt.length === 2 && pt.every(Number.isFinite))
              : []
          }))
          .filter(m => m.polygon && m.polygon.length >= 3)
      : [];
  }
} catch {
  CANON_MAP_COORDS = null;
  CANON_MAP_SETTLEMENTS = [];
  CANON_MAP_MOUNTAINS = [];
}


// -------------------- Start libraries (server-side, deterministic) --------------------
// Purpose: keep kickoff reliable by choosing a canonical wilderness start point + starter conflict
// server-side (seeded), then letting the LLM only write prose about the chosen setup.
const START_POINTS_LIB_PATH = path.resolve(__dirname, "./canon/start_points_library.json");
const STARTER_CONFLICTS_LIB_PATH = path.resolve(__dirname, "./canon/starter_conflicts_library.json");

let START_POINTS_LIB = null;
let START_POINTS = [];
let START_POINTS_BY_REGION = new Map();

let STARTER_CONFLICTS_LIB = null;
let STARTER_CONFLICTS = [];
let STARTER_CONFLICTS_BY_REGION = new Map();

function _indexStartLibraries() {
  START_POINTS_BY_REGION = new Map();
  STARTER_CONFLICTS_BY_REGION = new Map();

  for (const sp of (START_POINTS || [])) {
    const rid = String(sp?.region_id || "").trim();
    if (!rid) continue;
    if (!START_POINTS_BY_REGION.has(rid)) START_POINTS_BY_REGION.set(rid, []);
    START_POINTS_BY_REGION.get(rid).push(sp);
  }

  for (const c of (STARTER_CONFLICTS || [])) {
    const rid = String(c?.region_id || "").trim();
    if (!rid) continue;
    if (!STARTER_CONFLICTS_BY_REGION.has(rid)) STARTER_CONFLICTS_BY_REGION.set(rid, []);
    STARTER_CONFLICTS_BY_REGION.get(rid).push(c);
  }
}

try {
  if (fs.existsSync(START_POINTS_LIB_PATH)) {
    START_POINTS_LIB = JSON.parse(fs.readFileSync(START_POINTS_LIB_PATH, "utf8"));
    START_POINTS = Array.isArray(START_POINTS_LIB?.start_points) ? START_POINTS_LIB.start_points : [];
  }
  if (fs.existsSync(STARTER_CONFLICTS_LIB_PATH)) {
    STARTER_CONFLICTS_LIB = JSON.parse(fs.readFileSync(STARTER_CONFLICTS_LIB_PATH, "utf8"));
    STARTER_CONFLICTS = Array.isArray(STARTER_CONFLICTS_LIB?.starter_conflicts) ? STARTER_CONFLICTS_LIB.starter_conflicts : [];
  }
} catch {
  START_POINTS_LIB = null;
  START_POINTS = [];
  STARTER_CONFLICTS_LIB = null;
  STARTER_CONFLICTS = [];
}

try { _indexStartLibraries(); } catch {}

function chooseStartPlanFromLibraries(roomId, runId = 0) {
  const rid = String(roomId || "room");
  const r = makeSeededRng(`${rid}|${Number(runId || 0)}|startplan_v1`);

  const regionKeys = Array.from(START_POINTS_BY_REGION.keys()).filter(Boolean);
  const regionId = regionKeys.length ? regionKeys[Math.floor(r() * regionKeys.length)] : "";

  const spList = regionId ? (START_POINTS_BY_REGION.get(regionId) || []) : [];
  const cfList = regionId ? (STARTER_CONFLICTS_BY_REGION.get(regionId) || []) : [];

  const spPool = spList.length ? spList : (Array.isArray(START_POINTS) ? START_POINTS : []);
  const cfPool = cfList.length ? cfList : (Array.isArray(STARTER_CONFLICTS) ? STARTER_CONFLICTS : []);

  const sp = spPool.length ? spPool[Math.floor(r() * spPool.length)] : null;
  const cf = cfPool.length ? cfPool[Math.floor(r() * cfPool.length)] : null;

  const region_name = String(sp?.region_name || cf?.region_name || regionId || "").trim();

  return {
    v: 1,
    seed_key: `${rid}|${Number(runId || 0)}|startplan_v1`,
    region_id: String(sp?.region_id || cf?.region_id || regionId || "").trim(),
    region_name,
    start_point: sp ? { ...sp } : null,
    conflict: cf ? { ...cf } : null,
    createdAt: Date.now()
  };
}

function ensureRoomStartPlan(roomId, { force = false } = {}) {
  const st = getRoomState(roomId);
  if (!st || !st.canon) return null;

  if (!force && st._startPlan && typeof st._startPlan === "object") return st._startPlan;

  const plan = chooseStartPlanFromLibraries(roomId, Number(st.runId || 0) || 0);

  // Apply to tokens conservatively: only if we still look "unplaced".
  try {
    let toks = Array.isArray(st.canon.tokens) ? [...st.canon.tokens] : [];
    const curLoc = extractLoc(toks);
    const curXY = parseXY(toks);

    const sp = plan?.start_point;
    const xy = Array.isArray(sp?.xy) ? sp.xy : null;
    const x = Number(xy?.[0]);
    const y = Number(xy?.[1]);

    if (Number.isFinite(x) && Number.isFinite(y) && (!curXY || !Number.isFinite(curXY.x) || !Number.isFinite(curXY.y))) {
      toks = setXY(toks, x, y);
    }

    // For loc label, use the nearest named anchor settlement (canonical), but the start point itself is wilderness.
    const locLabel = sanitizeTokenField(String(sp?.nearest_anchor || ""), 80);
    if (locLabel && isPlaceholderLoc(curLoc)) {
      toks = setLoc(toks, locLabel);
    }

    // Region token helps weather + local fallback; safe even if loc is hidden in prose.
    const regLabel = sanitizeTokenField(String(plan?.region_name || plan?.region_id || ""), 40);
    if (regLabel) {
      toks = setRegion(toks, regLabel);
    }

    st.canon.tokens = toks;
  } catch {}

  st._startPlan = plan;
  try { saveRoomStateFile(roomId); } catch {}
  return plan;
}

// -------------------- End start libraries --------------------

// -------------------- HALLUCINATION / DRIFT FIREWALL (server-side) --------------------
// Goal: the player never has to correct continuity.
// The server validates model output against retrieved canon + entity registry and regenerates on failure.
const HALLUCINATION_GUARD = String(process.env.HALLUCINATION_GUARD || "on").toLowerCase() !== "off";
const HALLUCINATION_AUDIT = String(process.env.HALLUCINATION_AUDIT || "on").toLowerCase() !== "off";
const HALLUCINATION_MAX_ATTEMPTS = Math.max(1, Math.min(6, Number(process.env.HALLUCINATION_MAX_ATTEMPTS || 3)));
const ENTITY_REGISTRY = loadEntityRegistry({ baseDir: __dirname });

// -------------------- LOCAL SCOPE LOCKDOWN (optional) --------------------
// Purpose: keep the model focused on AETHERYN only. Everything else is refused locally.
// Toggle in server/.env: SCOPE_LOCKDOWN=on|off  (default: on)
const SCOPE_LOCKDOWN = String(process.env.SCOPE_LOCKDOWN || "on").toLowerCase() !== "off";
const SCOPE_STRICTNESS = Number(process.env.SCOPE_STRICTNESS || 2); // 0=off, 1=soft, 2=strict
const META_PREFIX = String(process.env.META_PREFIX || "/");

const SCOPE_KEYWORDS_PATH = path.resolve(__dirname, "scope_blacklist_keywords.json");
let SCOPE_KEYWORDS = null;
try {
  if (fs.existsSync(SCOPE_KEYWORDS_PATH)) {
    SCOPE_KEYWORDS = JSON.parse(fs.readFileSync(SCOPE_KEYWORDS_PATH, "utf8"));
  }
} catch {
  SCOPE_KEYWORDS = null;
}

function normText(s) {
  return String(s || "").toLowerCase();
}

function keywordHit(text, words) {
  const t = normText(text);
  for (const w of (words || [])) {
    const k = normText(w).trim();
    if (!k) continue;
    // basic containment; keep it cheap and predictable
    if (t.includes(k)) return k;
  }
  return "";
}

function detectOutOfScope(text) {
  if (!SCOPE_LOCKDOWN || SCOPE_STRICTNESS <= 0) return { blocked: false };

  const t = String(text || "").trim();
  if (!t) return { blocked: false };

  // Meta commands bypass scope checks (they are handled locally)
  if (t.startsWith(META_PREFIX)) return { blocked: false };

  // Strict mode: block common "pull-out" topics using keyword buckets
  const cats = (SCOPE_KEYWORDS && SCOPE_KEYWORDS.categories) ? SCOPE_KEYWORDS.categories : {};
  const buckets = ["politics", "finance", "medical", "legal", "porn_realworld", "sports", "shopping", "travel"];

  for (const b of buckets) {
    const hit = keywordHit(t, cats[b]);
    if (hit) return { blocked: true, bucket: b, hit };
  }

  // Tech bucket is handled more carefully:
  // - Soft mode: allow (player might be describing an in-world device)
  // - Strict mode: block unless user uses a meta command
  const techHit = keywordHit(t, cats.tech);
  if (techHit && SCOPE_STRICTNESS >= 2) return { blocked: true, bucket: "tech", hit: techHit };

  // High-signal external links: usually out of scope
  if (SCOPE_STRICTNESS >= 2 && /(https?:\/\/|www\.)/i.test(t)) {
    return { blocked: true, bucket: "links", hit: "url" };
  }

  return { blocked: false };
}

function emitLockdownNarration(roomId, reason = "") {
  const st = getRoomState(roomId);
  const why = reason ? ` (${reason})` : "";
  const choices = [
    "Return to the scene (continue play)",
    "Ask about AETHERYN rules/canon (in-world or via /canon <query>)",
    `${META_PREFIX}help (local runtime help)`,
    "Freeform: (an in-world action)"
  ];
  const text =
`AETHERYN LOCKDOWN${why}: This runtime will not answer that topic.\n\nCHOICES:\n- ${choices.join("\n- ")}`;
  io.to(roomId).emit("narration", {
    from: "LOCK",
    text,
    canon_tokens: st.canon.tokens,
    beat_summary: "Out-of-scope request blocked by local lockdown.",
    choices,
    book_meta: st.book?.meta || null
  });
}

function handleMetaCommand(roomId, socket, rawText) {
  const t = String(rawText || "").trim();
  if (!t.startsWith(META_PREFIX)) return false;

  const st = getRoomState(roomId);
  const cmdLine = t.slice(META_PREFIX.length).trim();
  const [cmdRaw, ...rest] = cmdLine.split(/\s+/);
  const cmd = String(cmdRaw || "").toLowerCase();
  const arg = rest.join(" ").trim();

  let outText = "";
  let choices = [
    "Return to the scene (continue play)",
    "Freeform: (in-world action)"
  ];

  if (cmd === "help") {
    outText =
`LOCAL HELP (AETHERYN)\n\nCommands:\n- ${META_PREFIX}help\n- ${META_PREFIX}scope\n- ${META_PREFIX}tokens\n- ${META_PREFIX}canon <query>\n\nLockdown:\n- This runtime only talks AETHERYN. If you need general chat, disable SCOPE_LOCKDOWN in server/.env and restart.`;
  } else if (cmd === "scope") {
    outText =
`SCOPE LOCKDOWN is ${SCOPE_LOCKDOWN ? "ON" : "OFF"} (strictness=${SCOPE_STRICTNESS}).\n\nFull out-of-scope list:\n- server/AETHERYN_SCOPE_DONT_TALK_ABOUT.txt\n\nEdit server/.env to change:\n- SCOPE_LOCKDOWN=on|off\n- SCOPE_STRICTNESS=0|1|2`;
  } else if (cmd === "tokens") {
    outText = `CURRENT_CANON_TOKENS:\n${st.canon.tokens.join("\n")}`;
  } else if (cmd === "canon") {
    const q = arg || "(empty)";
    const chunks = retrieveCanonChunks(q);
    if (!chunks.length) {
      outText = `CANON QUERY: "${q}"\nNo chunks matched. Try different keywords.`;
    } else {
      const preview = chunks.map(c => `\n[CANON_CHUNK ${c.id}]\n${c.text}`).join("\n");
      outText = `CANON QUERY: "${q}"\nTop ${chunks.length} chunks:${preview}`;
    }
  } else if (cmd === "save") {
    try {
      writeRoomStateFileNowSync(roomId);
      if (st.book && Array.isArray(st.book.entries)) {
        saveBook(roomId, st.book.entries, st.book.meta || null);
      }
    } catch {}
    const p = statePaths(roomId);
    const rp = (p.json && fs.existsSync(p.json)) ? p.json : (p.fallbackJson || "");
    outText = `Saved.\n\nRoom state: ${rp}\nBook: ${bookPaths(roomId).json}`;
  } else if (cmd === "saves") {
    let rows = [];
    try {
      const idx = (SAVE_INDEX && typeof SAVE_INDEX === "object") ? SAVE_INDEX : loadSaveIndex();
      const keys = Object.keys(idx || {}).slice(0, 30);
      rows = keys.map(k => {
        const ent = idx[k] || {};
        const ch = ent.character ? ` (${ent.character})` : '';
        return `- ${k}${ch}`;
      });
    } catch {}
    outText = rows.length ? `Available saves (characters):
${rows.join('\n')}` : `No saves found in ${CHAR_SAVES_ROOT}`;
  } else {
    outText = `Unknown command: ${META_PREFIX}${cmd}\nUse ${META_PREFIX}help for commands.`;
  }

  const text = `${outText}\n\nCHOICES:\n- ${choices.join("\n- ")}`;
  io.to(roomId).emit("narration", {
    from: "SYSTEM",
    text,
    canon_tokens: st.canon.tokens,
    beat_summary: "Local meta command executed.",
    choices,
    book_meta: st.book?.meta || null
  });
  return true;
}
// -------------------- END LOCAL SCOPE LOCKDOWN --------------------


const app = express();
app.use(express.json());

const server = http.createServer(app);
// Multiplayer can feel "slow" if the server is busy serializing large state blobs.
// Keep transport overhead low: enable compression and keep pings sensible.
const io = new SocketIOServer(server, {
  cors: { origin: "*" },
  perMessageDeflate: {
    threshold: Number(process.env.SOCKET_COMPRESS_THRESHOLD || 1024),
  },
  pingInterval: Number(process.env.SOCKET_PING_INTERVAL_MS || 25000),
  pingTimeout: Number(process.env.SOCKET_PING_TIMEOUT_MS || 20000),
});

const PORT = process.env.PORT || 8080;

// -------------------- DEV BUILD (AI TRACE) --------------------
// Toggle with DEV_BUILD=on (server/.env or environment). When off, dev UI stays hidden and no extra events are emitted.
const DEV_BUILD = /^(1|true|on|yes)$/i.test(String(process.env.DEV_BUILD || ""));
const DEV_LOG_MAX = Math.max(50, Math.min(2000, Number(process.env.DEV_LOG_MAX || 800)));
const DEV_LOG = [];
const DEV_PENDING = new Map(); // id -> { roomId, role, stage, provider, model, startedAt, ... }

function _devNow(){ return Date.now(); }
function devPush(evt){
  if (!DEV_BUILD) return;
  const e = { ts: _devNow(), ...(evt && typeof evt === 'object' ? evt : { msg: String(evt || '') }) };
  DEV_LOG.push(e);
  while (DEV_LOG.length > DEV_LOG_MAX) DEV_LOG.shift();
  try {
    const rid = String(e.roomId || '').trim();
    if (rid) io.to(rid).emit('dev_event', e);
    else io.emit('dev_event', e);
  } catch {}
}

function devPendingSnapshot(roomId){
  const rid = String(roomId || '').trim();
  const out = [];
  for (const [id, rec] of DEV_PENDING.entries()){
    if (rid && rec?.roomId && rec.roomId !== rid) continue;
    out.push({ id, ...rec, age_ms: _devNow() - (Number(rec?.startedAt) || _devNow()) });
  }
  out.sort((a,b)=> (b.age_ms||0) - (a.age_ms||0));
  return out.slice(0, 50);
}

process.on('unhandledRejection', (reason) => {
  // Keep the process alive for unhandled rejections (often recoverable), but log loudly.
  try { console.error('[AETHERYN] UnhandledRejection:', String(reason?.stack || reason)); } catch {}
  try { devPush({ type: 'server_unhandledRejection', msg: String(reason?.stack || reason) }); } catch {}
});
process.on('uncaughtException', (err) => {
  // Uncaught exceptions leave Node in an unknown state. Exit with a non-zero code.
  try { console.error('[AETHERYN] UncaughtException:', String(err?.stack || err)); } catch {}
  try { devPush({ type: 'server_uncaughtException', msg: String(err?.stack || err) }); } catch {}
  try { process.exit(1); } catch {}
});
// -------------------- END DEV BUILD --------------------

// Probe on boot + every 30s (keeps UI honest even if Ollama starts after the server).
refreshLLMStatus().then(() => { try { io.emit("llm:status", LLM_STATUS); } catch {} });
setInterval(async () => {
  try {
    await refreshLLMStatus();
    try { io.emit("llm:status", LLM_STATUS); } catch {}
  } catch {}
}, 30000).unref();


function getLanIps(){
  try {
    const nets = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(nets || {})) {
      for (const ni of (nets[name] || [])) {
        if (!ni) continue;
        if (ni.family !== 'IPv4') continue;
        if (ni.internal) continue;
        const addr = String(ni.address || '').trim();
        if (addr && !ips.includes(addr)) ips.push(addr);
      }
    }
    return ips;
  } catch {
    return [];
  }
}

app.get('/api/net/info', (_req, res) => {
  res.json({ ok: true, port: Number(PORT) || 8080, ips: getLanIps() });
});

// -------------------- AI busy/idle signal (UI) --------------------
// Emitted to the whole room whenever an interactive model call starts/ends.
// Guarded: if a model call (or resolve pipeline) gets stuck, we auto-clear the UI.
// AI_WAIT_MAX_MS is a UI safety net so players aren't stuck staring at "AI is thinking" forever.
// If set to <= 0, we disable the auto-clear guard (host can still use the Cancel AI button).
const _aiWaitEnv = Number(process.env.AI_WAIT_MAX_MS ?? (Number(process.env.LLM_TIMEOUT_MS ?? 120000) + 45000));
const AI_WAIT_MAX_MS = (Number.isFinite(_aiWaitEnv) && _aiWaitEnv > 0) ? Math.max(1000, _aiWaitEnv) : 0;
const _AI_WAIT_GUARDS = new Map(); // roomId -> timeout

function beginResolve(roomId) {
  try {
    const st = getRoomState(roomId);
    const next = (Number(st._resolveSeq || 0) || 0) + 1;
    st._resolveSeq = next;
    st._resolveInFlight = next;
    st._resolveStartedAt = Date.now();
    return next;
  } catch {
    return 0;
  }
}

function isResolveCurrent(roomId, seq) {
  try {
    const st = getRoomState(roomId);
    return Number(st._resolveInFlight || 0) === Number(seq || 0);
  } catch {
    return true;
  }
}

function endResolve(roomId, seq) {
  try {
    const st = getRoomState(roomId);
    if (Number(st._resolveInFlight || 0) === Number(seq || 0)) {
      st._resolveInFlight = 0;
      st._resolveStartedAt = 0;
    }
  } catch {}
}

function cancelResolve(roomId, reason = "cancel", { quiet = false } = {}) {
  try {
    const st = getRoomState(roomId);
    try { devPush({ type: 'resolve_cancel', roomId: String(roomId||'').trim(), reason: String(reason||'') }); } catch {}

    const next = (Number(st._resolveSeq || 0) || 0) + 1;
    st._resolveSeq = next;
    st._resolveInFlight = 0;
    st._resolveStartedAt = 0;
    try { if (typeof TURNS?.resetResolveLock === 'function') TURNS.resetResolveLock(roomId); } catch {}

    if (!quiet) {
      try { io.to(roomId).emit("system", `GM: cancelled the in-flight resolve (${reason}).`); } catch {}
    }
  } catch {}
}

function emitAiWait(roomId, on, phase = "", detail = "") {
  const rid = String(roomId || "").trim();
  if (!rid) return;

  try { devPush({ type: 'ai_wait', roomId: rid, on: !!on, phase: String(phase||''), detail: String(detail||'') }); } catch {}

  // Clear any prior guard.
  try {
    const prev = _AI_WAIT_GUARDS.get(rid);
    if (prev) clearTimeout(prev);
    _AI_WAIT_GUARDS.delete(rid);
  } catch {}

  // If turning ON, arm an auto-clear.
  if (on && AI_WAIT_MAX_MS > 0) {
    try {
      const t = setTimeout(() => {
        // Auto-unblock UI + invalidate any late-arriving resolve.
        try { cancelResolve(rid, "timeout", { quiet: true }); } catch {}
        try {
          io.to(rid).emit("ai_wait", { on: false, phase: "timeout", detail: `>${AI_WAIT_MAX_MS}ms`, ts: Date.now() });
        } catch {}
        try {
          io.to(rid).emit("ai:error", {
            provider: String(normProvider(getProviderForRole("narrator")) || "unknown"),
            message: `AI timed out after ${AI_WAIT_MAX_MS}ms`,
            hint: "If this repeats: use a smaller local model, or raise LLM_TIMEOUT_MS / LLM_IDLE_TIMEOUT_MS in server/.env.",
            ts: Date.now(),
          });
        } catch {}
      }, AI_WAIT_MAX_MS);
      _AI_WAIT_GUARDS.set(rid, t);
    } catch {}
  }

  try {
    io.to(rid).emit("ai_wait", {
      on: !!on,
      phase: String(phase || ""),
      detail: String(detail || ""),
      ts: Date.now(),
    });
  } catch {}
}

// Optional: explicit AI error event (UI can unstick even if it missed ai_wait=false).
function emitAiError(roomId, err, hint = "") {
  try {
    const message = String(err?.message || err || "Unknown error");
    try { devPush({ type: 'ai_error', roomId: String(roomId||'').trim(), message, hint: String(hint||'') }); } catch {}
    io.to(roomId).emit("ai:error", {
      provider: String(normProvider(getProviderForRole("narrator")) || "unknown"),
      message,
      hint: String(hint || ""),
      ts: Date.now(),
    });
  } catch {}
}

// -------------------- TURN MANAGER (initiative + serialized resolves) --------------------
// Turns are per-room and persistent in the save file (st.turn).
// The resolve lock guarantees only ONE LLM resolve pipeline runs at a time per room.
function handleTurnOrderLocked(roomId) {
  const rid = String(roomId || '').trim();
  if (!rid) return;
  let changed = false;
  try { if (ensureStarterLoadout(rid)) changed = true; } catch {}
  try { if (ensureStarterEquipment(rid)) changed = true; } catch {}

  // Safety net: if initiative locked but the opening scene never rendered, force kickoff now.
  try {
    const stK = getRoomState(rid);
    if (hasModeToken(stK.canon.tokens, 'PLAY') && !hasFlagToken(stK.canon.tokens, 'kickoff_done') && !roomHasAnyNarration(stK)) {
      if (!hasFlagToken(stK.canon.tokens, 'needs_kickoff')) {
        stK.canon.tokens = setFlagToken(stK.canon.tokens, 'needs_kickoff', 1);
        saveRoomStateFile(rid);
      }
      autoStartPlayIfNeeded(rid, { reason: 'turn_order_locked_guard' }).catch(() => {});
    }
  } catch {}

  if (!changed) return;
  try {
    const st = getRoomState(rid);
    io.to(rid).emit('canon_update', {
      roomId: rid,
      canon_tokens: st.canon.tokens,
      book_meta: st.book?.meta || null,
    });
  } catch {}
}

const TURNS = makeTurnManager({ io, getRoomState, normalizeActorName, saveRoomStateFile, onTurnOrderLocked: handleTurnOrderLocked });


// -------------------- LLM STATUS + AUTO MODEL RESOLUTION --------------------
// Goal: keep the UI simple (no model picker), while still being robust.
// - If OLLAMA_MODEL is set and installed, we use it.
// - If it's missing (or set to "auto"), we pick a sensible installed model.
// - If the configured model is not installed, we fall back to the best installed model.
// This avoids the "it doesn't work unless I edit .env" problem.

const OLLAMA_TAGS_CACHE_MS = Number(process.env.OLLAMA_TAGS_CACHE_MS || 30000);
let OLLAMA_TAGS_CACHE = { at: 0, reachable: null, models: [], lastError: "" };

function getOllamaUrl() {
  return String(process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
}

// -------------------- LLM PROVIDER (agnostic) --------------------
// Core rule: gameplay logic MUST NOT depend on provider-specific features.
// We treat model output as text and validate/parse locally.
//
// Providers supported by default:
//  - ollama        (local)
//  - openai_compat (OpenAI-style /v1/chat/completions; many APIs support this)
//
// Back-compat:
//  - NARRATOR_PROVIDER=grok still works (mapped to openai_compat using XAI_* env vars)

function getEnvAny(keys, fallback = "") {
  for (const k of (keys || [])) {
    const v = String(process.env[k] || "").trim();
    if (v) return v;
  }
  return String(fallback || "");
}

function getProviderForRole(role) {
  const r = String(role || "").trim().toUpperCase();
  const p = getEnvAny([
    `LLM_PROVIDER_${r}`,
    "LLM_PROVIDER",
    // legacy narrator selector
    ...(role === "narrator" ? ["NARRATOR_PROVIDER"] : []),
  ], "");

  const n = normProvider(p || "");
  // Default behavior: if nothing is set, keep local-first (Ollama) working.
  // But nothing *depends* on Ollama-only features.
  if (!p) return "ollama";
  return n;
}

function getBaseUrlForRole(role, provider) {
  const p = normProvider(provider);
  const r = String(role || "").trim().toUpperCase();
  const legacyGrok = (role === "narrator" && (String(process.env.NARRATOR_PROVIDER || "").toLowerCase() === "grok"));
  const hasNewNarratorOverride = !!String(process.env.LLM_PROVIDER_NARRATOR || process.env.LLM_BASE_URL_NARRATOR || process.env.LLM_MODEL_NARRATOR || "").trim();
  if (legacyGrok && !hasNewNarratorOverride) {
    return getEnvAny(["XAI_BASE_URL"], "https://api.x.ai");
  }
  if (p === "ollama") return getEnvAny([`LLM_BASE_URL_${r}`, "LLM_BASE_URL", "OLLAMA_URL"], "http://127.0.0.1:11434");
  return getEnvAny([`LLM_BASE_URL_${r}`, "LLM_BASE_URL", "OPENAI_BASE_URL", "XAI_BASE_URL"], "");
}

function getApiKeyForRole(role, provider) {
  const p = normProvider(provider);
  const r = String(role || "").trim().toUpperCase();
  const legacyGrok = (role === "narrator" && (String(process.env.NARRATOR_PROVIDER || "").toLowerCase() === "grok"));
  const hasNewNarratorOverride = !!String(process.env.LLM_PROVIDER_NARRATOR || process.env.LLM_BASE_URL_NARRATOR || process.env.LLM_MODEL_NARRATOR || "").trim();
  if (legacyGrok && !hasNewNarratorOverride) {
    return getEnvAny(["XAI_API_KEY", "GROK_API_KEY"], "");
  }
  if (p === "ollama") return "";

  // If both OpenAI and xAI keys exist, pick the one that matches the selected base URL.
  // This matters because both providers are "openai_compat".
  try {
    if (role === "narrator") {
      const bu = String(getBaseUrlForRole(role, provider) || "").toLowerCase();
      if (bu.includes("api.x.ai")) {
        const k = getEnvAny(["XAI_API_KEY", "GROK_API_KEY"], "");
        if (k) return k;
      }
      if (bu.includes("api.openai.com")) {
        const k = getEnvAny(["OPENAI_API_KEY"], "");
        if (k) return k;
      }
    }
  } catch {}

  return getEnvAny([
    `LLM_API_KEY_${r}`,
    "LLM_API_KEY",
    "OPENAI_API_KEY",
    "XAI_API_KEY",
    "GROK_API_KEY",
  ], "");
}

async function getModelForRole(role, provider) {
  const p = normProvider(provider);
  const r = String(role || "").trim().toUpperCase();

  // Legacy Grok envs.
  const legacyGrok = (role === "narrator" && (String(process.env.NARRATOR_PROVIDER || "").toLowerCase() === "grok"));
  const hasNewNarratorOverride = !!String(process.env.LLM_PROVIDER_NARRATOR || process.env.LLM_BASE_URL_NARRATOR || process.env.LLM_MODEL_NARRATOR || "").trim();
  if (legacyGrok && !hasNewNarratorOverride) {
    return String(process.env.GROK_MODEL || "grok-4-1-fast-reasoning").trim();
  }

  if (p === "ollama") {
    // Preserve existing "auto model resolution" for local use.
    if (role === "book" || role === "summary" || role === "title") return getOllamaModel("book");
    if (role === "narrator") return getOllamaModel("narration");
    return getOllamaModel("rules");
  }

  // OpenAI-compatible: caller sets model explicitly.
  const m = getEnvAny([
    `LLM_MODEL_${r}`,
    `LLM_${r}_MODEL`,
    "LLM_MODEL",
    // legacy
    ...(role === "narrator" ? ["GROK_MODEL"] : []),
  ], "");
  return String(m || "").trim();
}

async function callLLMRole(role, { messages, temperature, maxTokens, timeoutMs, openaiExtra, ollamaOptions, keepAlive, devMeta } = {}) {
  const provider = getProviderForRole(role);
  const baseUrl = getBaseUrlForRole(role, provider);
  const apiKey = getApiKeyForRole(role, provider);
  const model = await getModelForRole(role, provider);

  if (!baseUrl) throw new Error(`LLM base URL missing for provider=${provider}. Set LLM_BASE_URL (or role-specific).`);
  if (!model) throw new Error(`LLM model missing for provider=${provider}. Set LLM_MODEL (or role-specific).`);
  if (normProvider(provider) === "openai_compat" && !apiKey) {
    // Some self-hosted APIs don't require a key; allow blank if explicitly requested.
    const allowBlank = String(process.env.LLM_ALLOW_BLANK_KEY || "").toLowerCase() === "on";
    if (!allowBlank) throw new Error(`LLM API key missing for openai_compat. Set LLM_API_KEY or enable LLM_ALLOW_BLANK_KEY=on.`);
  }

  

// Fail-fast for local Ollama: give a clear error instead of a long silent wait.
if (normProvider(provider) === "ollama") {
  const url = getOllamaUrl();
  const tags = await fetchOllamaTagsCached();
  if (!tags?.reachable) {
    const extra = tags?.lastError ? ` (${tags.lastError})` : "";
    throw new Error(`Ollama is not reachable at ${url}${extra}. Start Ollama or set OLLAMA_URL.`);
  }
  const installed = Array.isArray(tags?.models) ? tags.models : [];
  if (installed.length) {
    const want = String(model || "").trim().toLowerCase();
    const found = installed.some(n => String(n || "").trim().toLowerCase() === want || String(n || "").trim().toLowerCase().startsWith(want + ":"));
    if (!found && want) {
      throw new Error(`Ollama model "${model}" is not installed. Install it (ollama pull ${model}) or change OLLAMA_MODEL / LLM_MODEL.`);
    }
  }
}

  // DEV trace: log every LLM call + duration + errors
  const _devRole = String(role || '').trim() || 'unknown';
  const _devRoomId = String(devMeta?.roomId || '').trim();
  const _devPurpose = String(devMeta?.purpose || '').trim();
  const _devReqId = (DEV_BUILD && typeof crypto?.randomUUID === 'function') ? crypto.randomUUID() : (DEV_BUILD ? crypto.randomBytes(8).toString('hex') : '');
  const _devStart = Date.now();

  // Allow timeoutMs <= 0 to mean "no abort timeout" (useful for slow local models).
  const _effectiveTimeoutMs = (timeoutMs === undefined || timeoutMs === null)
    ? Number(process.env.LLM_TIMEOUT_MS ?? 120000)
    : Number(timeoutMs);

  if (DEV_BUILD && _devReqId) {
    try {
      const promptChars = Array.isArray(messages) ? messages.reduce((s,m)=> s + String(m?.content||'').length, 0) : 0;
      DEV_PENDING.set(_devReqId, {
        roomId: String(_devRoomId || '').trim() || undefined,
        role: _devRole,
        purpose: _devPurpose || null,
        provider: String(normProvider(provider) || ''),
        model: String(model || ''),
        baseUrl: String(baseUrl || ''),
        stage: 'running',
        startedAt: _devStart,
        timeoutMs: _effectiveTimeoutMs,
        maxTokens: (Number.isFinite(Number(maxTokens)) ? Number(maxTokens) : null),
        temperature: (Number.isFinite(Number(temperature)) ? Number(temperature) : null),
        promptChars,
      });
      devPush({
        type: 'llm_start',
        roomId: String(_devRoomId || '').trim() || undefined,
        id: _devReqId,
        role: _devRole,
        purpose: _devPurpose || null,
        provider: String(normProvider(provider) || ''),
        model: String(model || ''),
        timeoutMs: _effectiveTimeoutMs,
        maxTokens: (Number.isFinite(Number(maxTokens)) ? Number(maxTokens) : null),
        promptChars,
      });
    } catch {}
  }

  try {
    const out = await llmChat({
      provider,
      baseUrl,
      apiKey,
      model,
      messages,
      temperature,
      maxTokens,
      // Local models (and some hosted endpoints) can take longer than 20s.
      // Prefer a generous default and let users tighten it if they want.
      timeoutMs: _effectiveTimeoutMs,
      ollama: {
        keepAlive: keepAlive || String(process.env.OLLAMA_KEEP_ALIVE || '30m'),
        options: (ollamaOptions && typeof ollamaOptions === 'object') ? ollamaOptions : {},
      },
      openai: (openaiExtra && typeof openaiExtra === 'object') ? openaiExtra : {},
    });

    if (DEV_BUILD && _devReqId) {
      try {
        const ms = Date.now() - _devStart;
        const replyChars = String(out || '').length;
        const rec = DEV_PENDING.get(_devReqId) || {};
        DEV_PENDING.set(_devReqId, { ...rec, stage: 'done', endedAt: Date.now(), ms, replyChars });
        devPush({ type: 'llm_done', roomId: String(_devRoomId || '').trim() || undefined, id: _devReqId, role: _devRole, purpose: _devPurpose || null, ms, replyChars });
      } catch {}
    }

    return out;
  } catch (e) {
    if (DEV_BUILD && _devReqId) {
      try {
        const ms = Date.now() - _devStart;
        const msg = String(e?.message || e);
        const stack = String(e?.stack || '');
        const rec = DEV_PENDING.get(_devReqId) || {};
        DEV_PENDING.set(_devReqId, { ...rec, stage: 'error', endedAt: Date.now(), ms, error: msg });
        devPush({ type: 'llm_error', roomId: String(_devRoomId || '').trim() || undefined, id: _devReqId, role: _devRole, purpose: _devPurpose || null, ms, error: msg, stack: stack.slice(0, 1600) });
      } catch {}
    }
    throw e;
  } finally {
    if (DEV_BUILD && _devReqId) {
      try { DEV_PENDING.delete(_devReqId); } catch {}
    }
  }

}


function normModelName(s) {
  return String(s || "").trim().toLowerCase();
}

function isAutoModel(s) {
  const t = normModelName(s);
  return !t || t === "auto";
}

async function fetchOllamaTagsCached() {
  const now = Date.now();
  if (OLLAMA_TAGS_CACHE.at && (now - OLLAMA_TAGS_CACHE.at) < OLLAMA_TAGS_CACHE_MS) {
    return OLLAMA_TAGS_CACHE;
  }

  const url = getOllamaUrl();
  const ac = new AbortController();
  // Tags lookup is non-critical and should be tolerant on slower machines.
  const timer = setTimeout(() => ac.abort(), Number(process.env.OLLAMA_TAGS_TIMEOUT_MS || 5000));

  try {
    const resp = await fetch(`${url}/api/tags`, { signal: ac.signal });
    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      OLLAMA_TAGS_CACHE = { at: now, reachable: false, models: [], lastError: `HTTP ${resp.status}: ${t.slice(0, 200)}` };
      return OLLAMA_TAGS_CACHE;
    }
    const data = await resp.json();
    const models = Array.isArray(data?.models) ? data.models.map(m => String(m?.name || "").trim()).filter(Boolean) : [];
    OLLAMA_TAGS_CACHE = { at: now, reachable: true, models, lastError: "" };
    return OLLAMA_TAGS_CACHE;
  } catch (e) {
    const msg = String(e?.name === "AbortError" ? "timeout" : (e?.message || e));
    OLLAMA_TAGS_CACHE = { at: now, reachable: false, models: [], lastError: msg };
    return OLLAMA_TAGS_CACHE;
  } finally {
    clearTimeout(timer);
  }
}

function pickPreferredOllamaModel(installedNames) {
  const names = (installedNames || []).filter(Boolean);
  if (!names.length) return "";

  const n = names.map(x => ({ raw: x, norm: normModelName(x) }));

  const paramSizeB = (norm) => {
    const m = String(norm || "").match(/\b(\d+(?:\.\d+)?)\s*b\b/i);
    if (!m) return null;
    const v = Number(m[1]);
    return Number.isFinite(v) ? v : null;
  };

  // Prefer an AETHERYN-tuned model if present.
  // If multiple exist, prefer the smallest (fastest) by rough parameter size.
  const aethAll = n.filter(x => x.norm.includes("aetheryn"));
  if (aethAll.length) {
    aethAll.sort((a, b) => (paramSizeB(a.norm) ?? 999) - (paramSizeB(b.norm) ?? 999));
    return aethAll[0].raw;
  }

  // Heuristic: prefer models that are likely to run well on consumer hardware.
  // Picking a 27B+ model by default can create multi-minute stalls and timeouts.
  const prefs = [
    // Fast + capable (good defaults)
    "gemma3:4b",
    "llama3.1:8b",
    "llama3:8b",
    "qwen2.5:7b",
    "mistral:7b",
    "gemma2:9b",

    // Medium tier
    "gemma3:12b",
    "qwen2.5:14b",
    "gemma2:27b",

    // Large / last resort
    "gemma3:27b",
    "llama3.1",
    "llama3",
    "qwen2.5",
    "mistral",
    "gemma3",
    "gemma2",
  ];

  const findPref = (p) =>
    n.find(x => x.norm === p)
    || n.find(x => x.norm.startsWith(p + "-"))
    || n.find(x => x.norm.startsWith(p + ":"));

  for (const p of prefs) {
    const hit = findPref(p);
    if (hit) return hit.raw;
  }

  // Otherwise, prefer the smallest parameter size if we can detect it.
  const sized = n
    .map(x => ({ ...x, size: paramSizeB(x.norm) }))
    .filter(x => x.size !== null);
  if (sized.length) {
    sized.sort((a, b) => a.size - b.size);
    return sized[0].raw;
  }

  // Otherwise, first installed model.
  return names[0];
}

async function resolveOllamaModel(envValue, hardFallback = "llama3.1:8b") {
  const configured = String(envValue || "").trim();
  const tags = await fetchOllamaTagsCached();
  const installed = tags?.models || [];

  // If we can't reach Ollama, just use configured (or fallback). We'll error later if it's wrong.
  if (!tags?.reachable) return isAutoModel(configured) ? hardFallback : configured;

  // If auto (or empty), pick from installed.
  if (isAutoModel(configured)) {
    return pickPreferredOllamaModel(installed) || hardFallback;
  }

  // If configured is installed, use it.
  const cfgNorm = normModelName(configured);
  const match = installed.find(m => normModelName(m) === cfgNorm);
  if (match) return match;

  // Allow prefix match for common Ollama naming patterns.
  // Examples:
  // - configured: "gemma3:4b" matches installed: "gemma3:4b-it-q4_K_M"
  // - configured: "gemma3" matches installed: "gemma3:latest" or "gemma3:4b"
  const prefixHit = installed.find(m => normModelName(m).startsWith(cfgNorm));
  if (prefixHit) return prefixHit;

  // If user provided a family name with no tag, prefer family-tag matches ("name:").
  if (!cfgNorm.includes(":")) {
    const famHit = installed.find(m => normModelName(m).startsWith(cfgNorm + ":"));
    if (famHit) return famHit;
  }

  // Configured isn't installed: pick best installed.
  return pickPreferredOllamaModel(installed) || configured;
}

async function getOllamaModel(role = "main") {
  if (role === "book") {
    const bookEnv = process.env.OLLAMA_BOOK_MODEL || "";
    if (!isAutoModel(bookEnv)) {
      // Book model explicitly set: still validate vs installed if possible.
      return resolveOllamaModel(bookEnv, process.env.OLLAMA_MODEL || "llama3.1:8b");
    }
  }
  return resolveOllamaModel(process.env.OLLAMA_MODEL || "llama3.1:8b", "llama3.1:8b");
}

function effectiveNarratorProvider() {
  // Back-compat: older builds used NARRATOR_PROVIDER=grok|ollama.
  // New builds use LLM_PROVIDER_*.
  return getProviderForRole("narrator");
}

// -------------------- BOOK / TRANSCRIPT PERSISTENCE --------------------
// Stores a clean, player-facing "book" transcript on disk inside the game folder.
// Location: aetheryn-web/server/books/
const BOOKS_DIR = path.resolve(__dirname, "books");
if (!fs.existsSync(BOOKS_DIR)) {
  fs.mkdirSync(BOOKS_DIR, { recursive: true });
}


// -------------------- Room state persistence (tokens + summaries) --------------------
// Location: aetheryn-web/server/saves/
// Purpose: keep canonical tokens + compact summaries across server restarts, without printing save blobs.
// Back-compat: we still read from server/state/ if present.
const SAVES_DIR = path.resolve(__dirname, "saves");
const LEGACY_STATE_DIR = path.resolve(__dirname, "state");
if (!fs.existsSync(SAVES_DIR)) fs.mkdirSync(SAVES_DIR, { recursive: true });
if (!fs.existsSync(LEGACY_STATE_DIR)) fs.mkdirSync(LEGACY_STATE_DIR, { recursive: true });

// NEW: Character-scoped saves (server-owned).
// Saves are stored under: server/saves/characters/<CHAR_FOLDER>/<ROOM>.state.json
// The player never manages save files manually.
const CHAR_SAVES_ROOT = path.join(SAVES_DIR, "characters");
if (!fs.existsSync(CHAR_SAVES_ROOT)) fs.mkdirSync(CHAR_SAVES_ROOT, { recursive: true });

const SAVE_INDEX_PATH = path.join(CHAR_SAVES_ROOT, "_index.json");
// roomBase -> { folder, character, updatedAt }
let SAVE_INDEX = loadSaveIndex();

function loadSaveIndex() {
  try {
    if (!fs.existsSync(SAVE_INDEX_PATH)) return {};
    const raw = fs.readFileSync(SAVE_INDEX_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === "object") ? parsed : {};
  } catch {
    return {};
  }
}

function persistSaveIndex() {
  try {
    fs.writeFileSync(SAVE_INDEX_PATH, JSON.stringify(SAVE_INDEX || {}, null, 2), "utf8");
  } catch {}
}

function indexGet(roomBase) {
  try {
    const k = safeFileBase(roomBase);
    const v = (SAVE_INDEX && SAVE_INDEX[k]) ? SAVE_INDEX[k] : null;
    if (v && typeof v === "object") return v;
  } catch {}
  return null;
}

function indexSet(roomBase, entry) {
  try {
    const k = safeFileBase(roomBase);
    if (!SAVE_INDEX || typeof SAVE_INDEX !== "object") SAVE_INDEX = {};
    SAVE_INDEX[k] = entry;
    persistSaveIndex();
  } catch {}
}

function inferPrimaryCharacterNameFromTokens(tokens) {
  try {
    // Prefer explicit pc: tokens
    for (const t of (tokens || [])) {
      const s = String(t || "").trim();
      if (!s.toLowerCase().startsWith("pc:")) continue;
      const nm = s.slice(3).split("|")[0].trim();
      if (nm) return nm;
    }
    // Fallback: first party: token
    for (const t of (tokens || [])) {
      const s = String(t || "").trim();
      if (!s.toLowerCase().startsWith("party:")) continue;
      const nm = s.slice(6).split("/")[0].trim();
      if (nm) return nm;
    }
  } catch {}
  return "";
}

function getPrimaryCharacterName(roomId) {
  try {
    const st = getRoomState(roomId);
    const roster = Array.isArray(st?.playerCharNames) ? st.playerCharNames : [];
    const nm = String(roster[0] || "").trim();
    if (nm) return nm;
    return inferPrimaryCharacterNameFromTokens(st?.canon?.tokens || []);
  } catch {
    return "";
  }
}

function statePaths(roomId) {
  const base = safeFileBase(roomId);

  // Prefer character-scoped path if indexed.
  let charJson = null;
  try {
    const ent = indexGet(base);
    if (ent && ent.folder) {
      const folder = safeFileBase(ent.folder);
      charJson = path.join(CHAR_SAVES_ROOT, folder, `${base}.state.json`);
    }
  } catch {}

  return {
    json: charJson, // may be null
    fallbackJson: path.join(SAVES_DIR, `${base}.state.json`),
    legacyJson: path.join(LEGACY_STATE_DIR, `${base}.state.json`),
  };
}

function loadRoomStateFile(roomId) {
  const { json, fallbackJson, legacyJson } = statePaths(roomId);
  let pathToUse =
    (json && fs.existsSync(json)) ? json :
    (fs.existsSync(fallbackJson) ? fallbackJson :
     (fs.existsSync(legacyJson) ? legacyJson : null));

  // Self-heal: if index is missing but a character-scoped save exists, discover it.
  if (!pathToUse) {
    try {
      const base = safeFileBase(roomId);
      const dirs = fs.readdirSync(CHAR_SAVES_ROOT, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name)
        .slice(0, 500);
      for (const folder of dirs) {
        const full = path.join(CHAR_SAVES_ROOT, folder, `${base}.state.json`);
        if (fs.existsSync(full)) {
          pathToUse = full;
          indexSet(base, { folder, character: folder, updatedAt: new Date().toISOString() });
          break;
        }
      }
    } catch {}
  }

  if (!pathToUse) return null;

  try {
    const raw = fs.readFileSync(pathToUse, "utf8");
    const parsed = JSON.parse(raw);
    const canon_tokens = Array.isArray(parsed?.canon_tokens) ? parsed.canon_tokens : null;
    const memory = (parsed?.memory && typeof parsed.memory === "object") ? parsed.memory : null;
    const lastChoices = Array.isArray(parsed?.lastChoices) ? parsed.lastChoices : null;
    const pendingPurchases = Array.isArray(parsed?.pendingPurchases) ? parsed.pendingPurchases : null;
    const pendingLoot = Array.isArray(parsed?.pendingLoot) ? parsed.pendingLoot : null;
    const ooc = Array.isArray(parsed?.ooc) ? parsed.ooc : null;
    const intakeGlobal = (parsed?.intakeGlobal && typeof parsed.intakeGlobal === "object") ? parsed.intakeGlobal : null;
    const intakeCompleted = !!parsed?.intakeCompleted;
    const playerCharNames = Array.isArray(parsed?.playerCharNames) ? parsed.playerCharNames : null;
    const statsLocks = (parsed?.statsLocks && typeof parsed.statsLocks === "object") ? parsed.statsLocks : null;
    const statsPending = (parsed?.statsPending && typeof parsed.statsPending === "object") ? parsed.statsPending : null;
    const deliveries = Array.isArray(parsed?.deliveries) ? parsed.deliveries : null;
    const prologueDelivered = !!parsed?.prologueDelivered;
    const runId = Number(parsed?.runId || 0) || 0;
    const canon_hash = String(parsed?.canon_hash || "").trim();
    const turn = (parsed?.turn && typeof parsed.turn === "object") ? parsed.turn : null;
    return { canon_tokens, memory, lastChoices, pendingPurchases, pendingLoot, ooc, intakeGlobal, intakeCompleted, playerCharNames, statsLocks, statsPending, deliveries, prologueDelivered, runId, canon_hash, turn };
  } catch {
    return null;
  }
}

// Disk writes are a common source of "multiplayer feels slow" (sync fs blocks the event loop).
// Debounce state saves to coalesce bursts (still preserves correctness; last write wins).
const SAVE_DEBOUNCE_MS = Math.max(0, Number(process.env.SAVE_DEBOUNCE_MS || 250));
const _saveTimersByRoom = new Map();

function writeRoomStateFileNow(roomId) {
  try {
    const st = getRoomState(roomId);
    const base = safeFileBase(roomId);

    // Character-scoped saves:
    // - In couch co-op, the same world state is mirrored into EACH character folder.
    // - This keeps "Save" intuitive: every character can resume independently.
    const roster0 = Array.isArray(st?.playerCharNames) ? st.playerCharNames : [];
    const uniq = [];
    const seen = new Set();
    for (const r of roster0) {
      const nm = sanitizeTokenField(String(r || '').trim(), 80);
      if (!nm) continue;
      const k = nm.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      uniq.push(nm);
    }

    const primaryName = sanitizeTokenField(getPrimaryCharacterName(roomId), 80) || (uniq[0] || "Unknown");
    const names = uniq.length ? uniq : [primaryName];
    if (primaryName && !names.some(n => String(n).toLowerCase() === String(primaryName).toLowerCase())) {
      names.unshift(primaryName);
    }

    const updatedAt = new Date().toISOString();
    const outBase = {
      roomId: base,
      updated_at: updatedAt,
      primaryCharacter: primaryName,
      runId: Number(st?.runId || 0) || 0,
      canon_hash: String(CANON_HASH || ""),
      canon_tokens: Array.isArray(st?.canon?.tokens) ? st.canon.tokens : [],
      memory: st?.memory || null,
      lastChoices: Array.isArray(st?.lastChoices) ? st.lastChoices : [],
      ooc: Array.isArray(st?.ooc) ? st.ooc : [],
      intakeGlobal: st?.intakeGlobal || null,
      intakeCompleted: !!st?.intakeCompleted,
      playerCharNames: Array.isArray(st?.playerCharNames) ? st.playerCharNames : [],
      deliveries: Array.isArray(st?.deliveries) ? st.deliveries : [],
      statsLocks: st?._statsLocks || null,
      statsPending: st?._statsPending || null,
      prologueDelivered: !!st?._prologueDelivered,
      turn: (st && st.turn && typeof st.turn === "object") ? st.turn : null,
    };

    for (const nm of names) {
      const charFolder = safeFileBase(nm || primaryName || 'Unknown');
      const dir = path.join(CHAR_SAVES_ROOT, charFolder);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const jsonPath = path.join(dir, `${base}.state.json`);
      const out = { ...outBase, character: nm };

      // Async write to avoid blocking gameplay/network.
      fs.writeFile(jsonPath, JSON.stringify(out, null, 2), "utf8", () => {
        try {
          // Update index so loads can locate a default file by roomId.
          // We keep the index pointing at the primary character folder.
          if (String(nm || '').toLowerCase() === String(primaryName || '').toLowerCase()) {
            indexSet(base, { folder: charFolder, character: primaryName, updatedAt });
          }
        } catch {}
      });
    }
  } catch {}
}



// Synchronous save (used for explicit Save button / meta-command).
// Autosaves remain async/debounced to keep multiplayer snappy.
function writeRoomStateFileNowSync(roomId) {
  try {
    const st = getRoomState(roomId);
    const base = safeFileBase(roomId);

    const roster0 = Array.isArray(st?.playerCharNames) ? st.playerCharNames : [];
    const uniq = [];
    const seen = new Set();
    for (const r of roster0) {
      const nm = sanitizeTokenField(String(r || '').trim(), 80);
      if (!nm) continue;
      const k = nm.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      uniq.push(nm);
    }

    const primaryName = sanitizeTokenField(getPrimaryCharacterName(roomId), 80) || (uniq[0] || "Unknown");
    const names = uniq.length ? uniq : [primaryName];
    if (primaryName && !names.some(n => String(n).toLowerCase() === String(primaryName).toLowerCase())) {
      names.unshift(primaryName);
    }

    const updatedAt = new Date().toISOString();
    const outBase = {
      roomId: base,
      updated_at: updatedAt,
      primaryCharacter: primaryName,
      runId: Number(st?.runId || 0) || 0,
      canon_hash: String(CANON_HASH || ""),
      canon_tokens: Array.isArray(st?.canon?.tokens) ? st.canon.tokens : [],
      memory: st?.memory || null,
      lastChoices: Array.isArray(st?.lastChoices) ? st.lastChoices : [],
      ooc: Array.isArray(st?.ooc) ? st.ooc : [],
      intakeGlobal: st?.intakeGlobal || null,
      intakeCompleted: !!st?.intakeCompleted,
      playerCharNames: Array.isArray(st?.playerCharNames) ? st.playerCharNames : [],
      deliveries: Array.isArray(st?.deliveries) ? st.deliveries : [],
      statsLocks: st?._statsLocks || null,
      statsPending: st?._statsPending || null,
      prologueDelivered: !!st?._prologueDelivered,
      turn: (st && st.turn && typeof st.turn === "object") ? st.turn : null,
    };

    for (const nm of names) {
      const charFolder = safeFileBase(nm || primaryName || 'Unknown');
      const dir = path.join(CHAR_SAVES_ROOT, charFolder);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const jsonPath = path.join(dir, `${base}.state.json`);
      const out = { ...outBase, character: nm };
      try { fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2), 'utf8'); } catch {}

      try {
        if (String(nm || '').toLowerCase() === String(primaryName || '').toLowerCase()) {
          indexSet(base, { folder: charFolder, character: primaryName, updatedAt });
        }
      } catch {}
    }
  } catch {}
}

function saveRoomStateFile(roomId) {
  try {
    if (SAVE_DEBOUNCE_MS <= 0) return writeRoomStateFileNow(roomId);
    const rid = String(roomId || '').trim();
    if (!rid) return;
    const prev = _saveTimersByRoom.get(rid);
    if (prev) clearTimeout(prev);
    const t = setTimeout(() => {
      _saveTimersByRoom.delete(rid);
      writeRoomStateFileNow(rid);
    }, SAVE_DEBOUNCE_MS);
    _saveTimersByRoom.set(rid, t);
  } catch {}
}

function safeFileBase(roomId) {
  return String(roomId || "room")
    .replace(/[^a-z0-9_-]/gi, "_")
    .slice(0, 80);
}

function bookPaths(roomId) {
  const base = safeFileBase(roomId);
  return {
    json: path.join(BOOKS_DIR, `${base}.book.json`),
    txt: path.join(BOOKS_DIR, `${base}.book.txt`),
  };
}

function splitNarrationFromChoices(text) {
  const s = String(text || "");
  const idx = s.indexOf("CHOICES:");
  if (idx === -1) return { narration: s.trim(), choicesText: "" };
  return {
    narration: s.slice(0, idx).trim(),
    choicesText: s.slice(idx + "CHOICES:".length).trim(),
  };
}

function ensureSentencePunct(s) {
  const t = String(s || "").trim();
  if (!t) return "";
  return /[.!?]\s*$/.test(t) ? t : (t + ".");
}

// Book should read like a book: strip the narrator's interactive prompts (not dialogue).
function bookStripInteractivePrompts(text) {
  let s = String(text || '').trim();
  if (!s) return '';

  // Remove common trailing prompt lines.
  const lines = s.split(/\r?\n/);

  // Strip mechanical scaffolding that can leak into narration (book mode should be prose).
  const isMechanicsLine = (ln) => {
    const t = String(ln || '').trim();
    if (!t) return false;
    return (
      /^\[ROLL\b/i.test(t) ||
      /^\[ACTION_CHECK\b/i.test(t) ||
      /^\*\*\s*\[Margin:\s*[+-]?\d+\s*\]\s*\*\*$/i.test(t)
    );
  };
  while (lines.length && isMechanicsLine(lines[0])) lines.shift();
  while (lines.length && !String(lines[0] || '').trim()) lines.shift();

  const isPromptLine = (ln) => {
    const t = String(ln || '').trim();
    if (!t) return false;
    const low = t.toLowerCase();
    return (
      /^what\s+do\s+you\s+do\??$/.test(low) ||
      /^how\s+do\s+you\s+(respond|proceed|act)\??$/.test(low) ||
      /^choose\b/.test(low) ||
      /^pick\b/.test(low) ||
      /^select\b/.test(low) ||
      /^which\b/.test(low) ||
      /^tell\s+me\b/.test(low) ||
      /^confirm\b/.test(low) ||
      /^answer\b/.test(low)
    );
  };
  while (lines.length && isPromptLine(lines[lines.length - 1])) lines.pop();

  // Also strip a final dangling prompt sentence (very common):
  // "... The air goes still. What do you do?"
  s = lines.join('\n').trim();
  s = s.replace(/\s*(What do you do|How do you respond|How do you proceed|Choose[^\n\r]{0,120}|Pick[^\n\r]{0,120}|Which[^\n\r]{0,120})\?\s*$/i, '').trim();

  return s;
}

function renderBookText(entries) {
  // Book stays a book: only render prose/scaffold entries (no system/news/choice logs).
  const parts = [];
  const ALLOWED = new Set(["prologue", "chapter_start", "scene_header", "chapter_title", "narration"]);
  for (const e of (entries || [])) {
    const kind = String(e?.kind || "narration").trim().toLowerCase();
    if (!ALLOWED.has(kind)) continue;
    const body = String(e?.text || "").trim();
    if (!body) continue;
    parts.push(body);
  }
  return parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

function tailChars(s, maxChars) {
  const t = String(s || "");
  if (!maxChars || maxChars <= 0) return "";
  return t.length <= maxChars ? t : t.slice(t.length - maxChars);
}

function getBookTail(roomId, maxChars = 7000) {
  try {
    const st = getRoomState(roomId);
    const txt = renderBookText(st.book?.entries || []);
    return tailChars(txt, maxChars).trim();
  } catch {
    return "";
  }
}

function getLastNarrationSnippet(roomId, maxChars = 1200) {
  try {
    const st = getRoomState(roomId);
    const entries = st.book?.entries || [];
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i]?.kind === "narration" && entries[i]?.text) {
        return tailChars(entries[i].text, maxChars).trim();
      }
    }
  } catch {}
  return "";
}


function loadBookData(roomId) {
  const { json } = bookPaths(roomId);
  if (!fs.existsSync(json)) return { entries: [], meta: null };
  try {
    const raw = fs.readFileSync(json, "utf8");
    const parsed = JSON.parse(raw);
    const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
    const meta = (parsed?.meta && typeof parsed.meta === "object") ? parsed.meta : null;
    return { entries, meta };
  } catch {
    return { entries: [], meta: null };
  }
}

function saveBook(roomId, entries, meta = null) {
  const { json, txt } = bookPaths(roomId);
  try {
    fs.writeFileSync(
      json,
      JSON.stringify({ roomId, updated_at: new Date().toISOString(), meta, entries }, null, 2),
      "utf8"
    );
  } catch {}
  try {
    fs.writeFileSync(txt, renderBookText(entries), "utf8");
  } catch {}
}

// -------------------- CANON: INDEX + CHUNK RETRIEVAL --------------------
const INDEX_FIRST_PATH = path.resolve(__dirname, "CANON_INDEX_FIRST.txt");
const CHUNKS_DIR = path.resolve(__dirname, "canon_chunks");
const INV_INDEX_PATH = path.resolve(__dirname, "canon_inv_index.json");

const INDEX_FIRST = fs.existsSync(INDEX_FIRST_PATH) ? fs.readFileSync(INDEX_FIRST_PATH, "utf8") : "";
const INV = fs.existsSync(INV_INDEX_PATH) ? JSON.parse(fs.readFileSync(INV_INDEX_PATH, "utf8")) : {};
const LOCKED_PROLOGUE_TEXT = "Aetheryn did not begin as a story. It began as pressure.\n\nBefore banners, before calendars, before anyone had names for the bright and the terrible, the world was already arranging itself into laws: water always sought the low ground, winter always returned, and every living thing borrowed its moment from the same patient soil. Then came residue \u2014 not a substance you can hold, but a wake the world leaves behind when too much happens in one place. It clings to battlefields. It stains old vows. It gathers in the seams between \u201cshould\u201d and \u201cis.\u201d\n\nAcross the Ironfall Range, stone rose like a spine that refused to bow. Along the diagonal river corridor, the continent learned the habit of travel: herds moving with the seasons, caravans following bloom-cycles, boats chasing the same currents their grandparents trusted. Life formed its quiet agreements \u2014 pollinators keeping orchards breathing, decomposers making endings useful, predators shaping the courage of the herd \u2014 and for a time the world was simply busy being alive.\n\nBut people arrived with a different kind of motion.\n\nThey built rules. Then they built institutions to enforce the rules. Then they built stories to justify the institutions. The first cities were not miracles of stone; they were bargains made permanent. Safety for obedience. Bread for tax. Order for silence. Where those bargains held, roads stayed clear and markets flourished. Where they cracked, the cracks learned to widen.\n\nTouched and Untouched were never separate species \u2014 only separate relationships to the unseen. Some learned to speak to fire as if it were a language. Some learned to reach for soul as if identity were clay. Some learned to read the pattern behind the moment. Some learned to pull aether into lattices and wards, shaping residue like a craftsman shapes wire. None of it was free. The world does not give power without also giving consequence.\n\nAs ages turned, the great mistake repeated itself in a thousand local dialects: believing that stability was the same as health. An institution that never bends becomes a cage. A culture that never questions becomes a script. A border that never moves becomes a wound. When pressure has nowhere to go, it does what pressure always does.\n\nIt manifests.\n\nIn Aetheryn, monsters are not \u201canimals with bigger teeth.\u201d They are crisis made flesh \u2014 battle-ready, non-ecological things that arrive when structural stress becomes too concentrated to stay invisible. They do not breed. They do not belong to the food web. They are the world\u2019s alarm bell, and sometimes its punishment. Their forms change with meaning; their mechanics do not.\n\nYet Aetheryn is not a machine built to end you. It is a finite world that refuses to stay still. When a place suffers, it scars. When a scar persists, it becomes history. When history piles high enough, it becomes gravity \u2014 drawing new choices into old consequences.\n\nAnd now \u2014 after all that accumulated motion, after all those bargains and fractures, after all those seasons and scars \u2014 there is a small, living fact the world has not yet decided:\n\nYou.\n\nThis world is yours now.\nWhat you do, and what you refuse to do, will echo.\nWhat you preserve, what you fracture, what you build, and what you abandon \u2014 that is yours to decide.";

const RETRIEVE_K = Number(process.env.RETRIEVE_K || 6);
const RETRIEVE_K_INTAKE = Number(process.env.RETRIEVE_K_INTAKE || Math.min(3, RETRIEVE_K));
const MAX_CHUNK_CHARS = Number(process.env.RETRIEVED_CHUNK_MAX_CHARS || 2600);

// Pinned canon chunks (always included in retrieval to prevent worldbuilding drift)
const PINNED_CANON_CHUNKS = String(process.env.PINNED_CANON_CHUNKS || "14_WORLD_BIBLE_INDEX__0000")
  .split(',')
  .map(s => String(s || '').trim())
  .filter(Boolean);



function computeCanonHash() {
  try {
    const parts = [];
    for (const p of [INDEX_FIRST_PATH, INV_INDEX_PATH, path.resolve(__dirname, "canon_index.json")]) {
      try {
        if (fs.existsSync(p)) parts.push(fs.readFileSync(p));
      } catch {}
    }
    // Include pinned chunk texts (small) so a pinned-bible update changes the hash.
    try {
      for (const cid of (PINNED_CANON_CHUNKS || [])) {
        const f = path.join(CHUNKS_DIR, cid + '.txt');
        if (fs.existsSync(f)) parts.push(fs.readFileSync(f));
      }
    } catch {}

    const h = crypto.createHash('sha256');
    for (const b of parts) h.update(b);
    return h.digest('hex').slice(0, 16);
  } catch {
    return '';
  }
}

const CANON_HASH = computeCanonHash();
function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .match(/[a-z0-9_:\/\-]{2,}/g) || [];
}


// -------------------- BOOK LOOKUP (anti-assumption) --------------------
// Goal: When details matter, prefer checking the saved Book transcript over guessing.
// This is a cheap local search; it does NOT call the model.
// It keeps prompts small (max chars) and avoids "I think/maybe" drift.
const BOOK_LOOKUP_DEFAULT_ON = String(process.env.BOOK_LOOKUP || "on").toLowerCase() !== "off";

const BOOK_LOOKUP_STOPWORDS = new Set([
  "the","and","or","but","if","then","else","so","to","of","in","on","at","for","from","with","without","into","onto","upon","over","under",
  "a","an","as","is","are","was","were","be","been","being","do","does","did","done","have","has","had","having",
  "i","me","my","mine","you","your","yours","we","our","ours","they","them","their","theirs","he","him","his","she","her","hers","it","its",
  "this","that","these","those","here","there","where","when","what","which","who","whom","why","how",
  "not","no","yes","ok","okay","maybe","might","can","could","would","should","will","shall",
  "up","down","left","right","back","again","still","just","very","more","most","less","least",
  "one","two","three","four","five","six","seven","eight","nine","ten"
]);

function buildBookEvidence(roomId, queryText, opts = {}) {
  const enabled = (typeof opts.enabled === "boolean") ? opts.enabled : BOOK_LOOKUP_DEFAULT_ON;
  if (!enabled) return "";

  const maxHits = Number(opts.maxHits || process.env.BOOK_LOOKUP_MAX_HITS || 3);
  const maxChars = Number(opts.maxChars || process.env.BOOK_LOOKUP_MAX_CHARS || 1400);
  const lastN = Number(opts.lastNEntries || process.env.BOOK_LOOKUP_LAST_N_ENTRIES || 140);
  const maxSnippetChars = Number(opts.maxSnippetChars || process.env.BOOK_LOOKUP_MAX_SNIPPET_CHARS || 520);

  const q = String(queryText || "").trim();
  if (!q) return "";

  // Extract a small set of meaningful query terms.
  const rawTerms = tokenize(q)
    .map(t => String(t || "").toLowerCase().trim())
    .filter(t => t.length >= 3)
    .filter(t => !BOOK_LOOKUP_STOPWORDS.has(t))
    .slice(0, 18);

  // De-dupe while preserving order
  const seen = new Set();
  const terms = [];
  for (const t of rawTerms) {
    if (seen.has(t)) continue;
    seen.add(t);
    terms.push(t);
    if (terms.length >= 12) break;
  }
  if (!terms.length) return "";

  const st = getRoomState(roomId);
  const entries = Array.isArray(st?.book?.entries) ? st.book.entries : [];
  if (!entries.length) return "";

  const startIdx = Math.max(0, entries.length - Math.max(20, lastN));
  const window = entries.slice(startIdx);

  const hits = [];

  function scan(win, baseIdx) {
    for (let i = 0; i < win.length; i++) {
      const e = win[i];
      const txt = String(e?.text || "").trim();
      if (!txt) continue;
      const low = txt.toLowerCase();

      let score = 0;
      let firstPos = -1;
      for (const t of terms) {
        const p = low.indexOf(t);
        if (p !== -1) {
          score += 1;
          if (firstPos === -1 || p < firstPos) firstPos = p;
        }
      }
      if (score <= 0) continue;

      // Prefer more recent entries slightly.
      const globalIdx = baseIdx + i;
      const recencyBoost = (globalIdx / Math.max(1, entries.length)) * 0.25;
      hits.push({
        globalIdx,
        kind: String(e?.kind || ""),
        score: score + recencyBoost,
        firstPos,
        text: txt
      });
    }
  }

  // Fast path: scan only recent book entries.
  scan(window, startIdx);

  // Fallback: if the relevant detail is older, scan the full book.
  if (!hits.length && startIdx > 0) {
    scan(entries, 0);
  }

  if (!hits.length) return "";

  hits.sort((a, b) => (b.score - a.score) || (b.globalIdx - a.globalIdx));
  const top = hits.slice(0, Math.max(1, maxHits));

  const parts = [];
  let budget = Math.max(200, maxChars);
  for (let i = 0; i < top.length; i++) {
    const h = top[i];
    const t = h.text;
    const low = t.toLowerCase();

    // Find the earliest matched term (for centering)
    let p = h.firstPos;
    if (p < 0) {
      for (const term of terms) {
        const pp = low.indexOf(term);
        if (pp !== -1) { p = pp; break; }
      }
    }
    if (p < 0) p = Math.max(0, t.length - Math.min(400, t.length));

    const left = Math.max(0, p - Math.floor(maxSnippetChars * 0.55));
    const right = Math.min(t.length, left + maxSnippetChars);
    let snippet = t.slice(left, right).trim();
    if (left > 0) snippet = "…" + snippet;
    if (right < t.length) snippet = snippet + "…";

    const header = `[BOOK HIT ${i + 1} | entry=${h.globalIdx + 1}${h.kind ? ` | kind=${h.kind}` : ""}]`;
    const block = `${header}\n${snippet}`;

    if (block.length > budget) break;
    parts.push(block);
    budget -= block.length + 2;
  }

  if (!parts.length) return "";
  return parts.join("\n\n").slice(0, maxChars).trim();
}
// -------------------- END BOOK LOOKUP --------------------


function extractFirstJsonObject(text) {
  // Recover the first JSON object in a messy response.
  // This is a fallback; primary enforcement is Ollama structured output.
  if (!text) return null;
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    if (depth === 0) {
      const candidate = text.slice(start, i + 1);
      try { return JSON.parse(candidate); } catch { return null; }
    }
  }
  return null;
}

// Unified GM recovery: models sometimes emit multiple JSON-ish blobs or wrap JSON in prose.
// Prefer the JSON object that *looks like* a unified turn payload.
function extractBestUnifiedJsonObject(text) {
  if (!text) return null;
  const s = String(text);

  const candidates = [];
  let start = -1;
  let depth = 0;
  let inStr = false;
  let esc = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (inStr) {
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === '"') { inStr = false; continue; }
      continue;
    }

    if (ch === '"') { inStr = true; continue; }

    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
      continue;
    }

    if (ch === '}') {
      if (depth > 0) depth--;
      if (depth === 0 && start >= 0) {
        const raw = s.slice(start, i + 1);
        try {
          const obj = JSON.parse(raw);
          candidates.push({ obj, rawLen: raw.length, start, end: i + 1 });
        } catch {}
        start = -1;
      }
      continue;
    }
  }

  if (!candidates.length) return null;

  function score(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return 0;
    let sc = 0;
    if (typeof o.narration === 'string') sc += 6;
    if (Array.isArray(o.choices)) sc += 6;
    if (Array.isArray(o.sources)) sc += 6;
    if (Array.isArray(o.ops)) sc += 2;
    if (Array.isArray(o.canon_tokens)) sc += 1;
    if (o.pov && typeof o.pov === 'object') sc += 1;
    return sc;
  }

  candidates.sort((a, b) => (score(b.obj) - score(a.obj)) || (b.rawLen - a.rawLen));
  const best = candidates[0];
  const bestScore = score(best.obj);
  // Require at least two core fields to avoid grabbing an inner metadata object.
  if (bestScore < 12) return null;
  return best.obj;
}

function _uniqStrings(arr) {
  const out = [];
  const seen = new Set();
  for (const x of (Array.isArray(arr) ? arr : [])) {
    const s = String(x || '').trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function _ensureMinChoices(parsed, min = 5) {
  if (!parsed || typeof parsed !== 'object') return;
  if (!Array.isArray(parsed.choices)) parsed.choices = [];
  const raw = parsed.choices;
  const { out } = normalizeChoicesArray(raw);
  const existing = new Set(out.map(x => String(x || '').trim().toLowerCase()).filter(Boolean));

  const defaults = [
    'Look around',
    'Talk to the party',
    'Check inventory',
    'Rest briefly',
    'Freeform: (type your action)'
  ];

  for (const d of defaults) {
    if (out.length >= min) break;
    const key = String(d).toLowerCase();
    if (existing.has(key)) continue;
    raw.push(d);
    out.push(d);
    existing.add(key);
  }

  while (out.length < min) {
    const d = 'Freeform: (type your action)';
    raw.push(d);
    out.push(d);
  }
}

function _injectPinnedSources(parsed, pinnedIds) {
  if (!parsed || typeof parsed !== 'object') return;
  const pins = _uniqStrings(pinnedIds);
  if (!pins.length) return;
  const src = Array.isArray(parsed.sources) ? parsed.sources : [];
  parsed.sources = _uniqStrings([...src, ...pins]);
}

function _prependLocationAnchorIfNeeded(parsed, { currentLoc, locAnchors }) {
  if (!parsed || typeof parsed !== 'object') return false;
  const loc = String(currentLoc || '').trim();
  const anchors = Array.isArray(locAnchors) ? locAnchors.map(a => String(a || '').trim()).filter(Boolean) : [];
  if (!anchors.length) return false;

  const narr = String(parsed.narration || '').trim();
  const low = narr.toLowerCase();
  const has = anchors.some(a => a && low.includes(String(a).toLowerCase()));
  if (has && narr) return false;

  // IMPORTANT: Do not start the sentence with a capitalized preposition like "At".
  // The hallucination firewall extracts proper-noun phrases via capitalization runs;
  // "At Heartwood Spire" gets mis-read as a single non-canonical name.
  // Use a lowercase preposition before the location so only the canonical place name is extracted.
  const anchorSentence = (loc && !isPlaceholderLoc(loc))
    ? `You are at ${loc}. The moment is immediate and physical.`
    : `You are here, at ${anchors[0]}. The moment is immediate and physical.`;

  let next = narr
    ? `${anchorSentence}\n\n${narr}`
    : `${anchorSentence} You take a breath and take stock: what’s within reach, what’s moving, and what danger might be close.`;

  // Ensure we don't fail the minimum narration-length guard due to a tiny stub.
  if (next.length < 140) {
    next = `${next} The air, the ground, and the sounds around you provide enough detail to act without guesswork.`;
  }

  parsed.narration = next;
  return true;
}

function readChunk(chunkId) {
  const fp = path.join(CHUNKS_DIR, `${chunkId}.txt`);
  if (!fs.existsSync(fp)) return "";
  const raw = fs.readFileSync(fp, "utf8");
  return raw.slice(0, MAX_CHUNK_CHARS);
}

// Simple lexical retrieval: score chunks by token overlap via inverted index
function retrieveCanonChunks(queryText) {
  const toks = tokenize(queryText);
  const scores = new Map(); // chunkId -> score

  for (const t of toks) {
    const hits = INV[t];
    if (!hits) continue;
    for (const cid of hits) {
      scores.set(cid, (scores.get(cid) || 0) + 1);
    }
  }

  const pinned = (PINNED_CANON_CHUNKS || []).filter(cid => {
    try { return fs.existsSync(path.join(CHUNKS_DIR, cid + '.txt')); } catch { return false; }
  });

  const k = Math.max(0, RETRIEVE_K - pinned.length);
  const ranked = [...scores.entries()]
    .sort((a,b)=>b[1]-a[1])
    .map(([cid,_score])=>cid)
    .filter(cid => !pinned.includes(cid))
    .slice(0, k);

  const finalIds = [...pinned, ...ranked];
  return finalIds.map(cid => ({ id: cid, text: readChunk(cid) })).filter(x => x.text);
}


// Variant: retrieval with an explicit K (used to reduce prompt load in "unified" pipeline)
function retrieveCanonChunksWithK(queryText, k = RETRIEVE_K) {
  const kk = Math.max(0, Math.min(40, Number(k) || 0));
  if (kk <= 0) return [];
  const toks = tokenize(queryText);
  const scores = new Map(); // chunkId -> score

  for (const t of toks) {
    const hits = INV[t];
    if (!hits) continue;
    for (const cid of hits) {
      scores.set(cid, (scores.get(cid) || 0) + 1);
    }
  }

  const pinned = (PINNED_CANON_CHUNKS || []).filter(cid => {
    try { return fs.existsSync(path.join(CHUNKS_DIR, cid + '.txt')); } catch { return false; }
  });

  const k2 = Math.max(0, kk - pinned.length);
  const ranked = [...scores.entries()]
    .sort((a,b)=>b[1]-a[1])
    .map(([cid,_score])=>cid)
    .filter(cid => !pinned.includes(cid))
    .slice(0, k2);

  const finalIds = [...pinned, ...ranked];
  return finalIds.map(cid => ({ id: cid, text: readChunk(cid) })).filter(x => x.text);
}

app.get("/canon", (_req, res) => {
  res.json({
    index_first_chars: INDEX_FIRST.length,
    chunks_dir: "server/canon_chunks",
    retrieve_k: RETRIEVE_K,
    hint: "The ruleskeeper always reads CANON_INDEX_FIRST.txt then retrieves relevant chunks per turn."
  });
});

app.post("/canon/query", (req, res) => {
  const q = String(req.body?.q || "");
  const chunks = retrieveCanonChunks(q);
  res.json({ q, chunks });
});

// -------------------- BOOK API --------------------
// Returns the saved book transcript (plain text) for a room.
// This is what the "Book" tab/new window reads.
app.get("/api/book", (req, res) => {
  const roomId = String(req.query?.roomId || "").trim();
  if (!roomId) return res.status(400).send("Missing roomId");
  const st = getRoomState(roomId);
  const text = renderBookText(st.book?.entries || []);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.send(text);
});

// -------------------- Saves API --------------------
// Lists room state files on disk so the UI can offer a simple "Load" menu.
app.get("/api/saves/list", (req, res) => {
  const out = [];
  const seen = new Set();

  const pushOne = (roomId, fullPath, sourceLabel, primaryCharacter = "") => {
    try {
      if (!roomId || seen.has(roomId)) return;
      let st = null;
      try { st = fs.statSync(fullPath); } catch { st = null; }
      const { json: bookJson, txt: bookTxt } = bookPaths(roomId);
      const hasBook = fs.existsSync(bookJson) || fs.existsSync(bookTxt);
      const updatedAt = st?.mtime ? st.mtime.toISOString() : null;

      // Try to surface character names (helps the UI pick the right PC after Load).
      let characters = [];
      let metaExtra = "";
      try {
        const raw = fs.readFileSync(fullPath, "utf8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.playerCharNames)) characters = parsed.playerCharNames.filter(Boolean).map(String);
        if (parsed?.character) metaExtra = ` | primary ${String(parsed.character).trim()}`;
      } catch {}

      const meta = `${sourceLabel}${updatedAt ? ` | updated ${updatedAt}` : ""}${hasBook ? " | book" : ""}${primaryCharacter ? ` | ${primaryCharacter}` : ""}${characters.length ? ` | chars ${characters.join(", ")}` : ""}${metaExtra ? metaExtra : ""}`;
      out.push({ roomId, updatedAt, hasBook, source: sourceLabel, meta, characters, primaryCharacter });
      seen.add(roomId);
    } catch {}
  };

  // 1) Character-scoped saves (preferred)
  try {
    const idx = (SAVE_INDEX && typeof SAVE_INDEX === "object") ? SAVE_INDEX : loadSaveIndex();
    for (const [roomId, ent] of Object.entries(idx || {})) {
      const folder = safeFileBase(ent?.folder || "");
      if (!folder) continue;
      const full = path.join(CHAR_SAVES_ROOT, folder, `${safeFileBase(roomId)}.state.json`);
      if (fs.existsSync(full)) {
        pushOne(safeFileBase(roomId), full, "characters", String(ent?.character || ""));
      }
    }
  } catch {}

  // 2) Fallback: any loose files in legacy dirs
  const addDir = (dir, sourceLabel) => {
    let files = [];
    try { files = fs.readdirSync(dir); } catch { files = []; }
    for (const f of files) {
      if (!f.endsWith(".state.json")) continue;
      const base = f.replace(/\.state\.json$/i, "");
      if (seen.has(base)) continue;
      const full = path.join(dir, f);
      pushOne(base, full, sourceLabel, "");
    }
  };

  addDir(SAVES_DIR, "saves");
  addDir(LEGACY_STATE_DIR, "state");

  out.sort((a, b) => {
    const ta = a.updatedAt ? Date.parse(a.updatedAt) : 0;
    const tb = b.updatedAt ? Date.parse(b.updatedAt) : 0;
    return tb - ta;
  });

  res.json({ saves: out });
});


// Force-save the active in-memory room to disk (useful for debugging + manual control).
// Note: autosave is already on; this is just an explicit "Save Now".
app.post("/api/saves/save", async (req, res) => {
  try {
    const roomId = String(req.body?.roomId || "").trim();
    if (!roomId) return res.status(400).json({ ok: false, error: "Missing roomId" });

    // Write immediately (not debounced) so the UI can confirm a save happened.
    try { writeRoomStateFileNowSync(roomId); } catch {}
    try {
      const st = getRoomState(roomId);
      if (st?.book && Array.isArray(st.book.entries)) {
        saveBook(roomId, st.book.entries, st.book.meta || null);
      }
    } catch {}

    const p = statePaths(roomId);
    const filePath =
      (p.json && fs.existsSync(p.json)) ? p.json :
      (fs.existsSync(p.fallbackJson) ? p.fallbackJson :
       (fs.existsSync(p.legacyJson) ? p.legacyJson : ""));

    res.json({ ok: true, roomId: safeFileBase(roomId), path: filePath || null });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// Export a save bundle as a single JSON file (state + book) for backup/sharing.
app.get("/api/saves/export", (req, res) => {
  try {
    const roomIdRaw = String(req.query?.roomId || "").trim();
    if (!roomIdRaw) return res.status(400).send("Missing roomId");
    const roomId = safeFileBase(roomIdRaw);

    const p = statePaths(roomId);
    const statePath =
      (p.json && fs.existsSync(p.json)) ? p.json :
      (fs.existsSync(p.fallbackJson) ? p.fallbackJson :
       (fs.existsSync(p.legacyJson) ? p.legacyJson : ""));

    let stateObj = null;
    if (statePath) {
      try { stateObj = JSON.parse(fs.readFileSync(statePath, "utf8")); } catch { stateObj = null; }
      try { if (stateObj && stateObj.memory) stateObj.memory = stripGmHiddenMemory(stateObj.memory); } catch {}
    } else {
      // No state file yet — export the in-memory state if present.
      try {
        const st = getRoomState(roomId);
        stateObj = {
          roomId: safeFileBase(roomId),
          updated_at: new Date().toISOString(),
          character: getPrimaryCharacterName(roomId) || "",
          runId: Number(st?.runId || 0) || 0,
      canon_hash: String(CANON_HASH || ""),
          canon_tokens: Array.isArray(st?.canon?.tokens) ? st.canon.tokens : [],
          memory: stripGmHiddenMemory(st?.memory || null),
          lastChoices: Array.isArray(st?.lastChoices) ? st.lastChoices : [],
          ooc: Array.isArray(st?.ooc) ? st.ooc : [],
          intakeGlobal: st?.intakeGlobal || null,
          intakeCompleted: !!st?.intakeCompleted,
          playerCharNames: Array.isArray(st?.playerCharNames) ? st.playerCharNames : [],
          deliveries: Array.isArray(st?.deliveries) ? st.deliveries : [],
        };
      } catch {}
    }

    const bp = bookPaths(roomId);
    let bookObj = null;
    if (fs.existsSync(bp.json)) {
      try { bookObj = JSON.parse(fs.readFileSync(bp.json, "utf8")); } catch { bookObj = null; }
    } else {
      try {
        const st = getRoomState(roomId);
        bookObj = { entries: st?.book?.entries || [], meta: st?.book?.meta || null };
      } catch {}
    }

    const bundle = { roomId, exported_at: new Date().toISOString(), state: stateObj, book: bookObj };
    const filename = `aetheryn_save_${roomId}.json`;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(JSON.stringify(bundle, null, 2));
  } catch (e) {
    res.status(500).send(String(e?.message || e));
  }
});

// Return the most recent save (helps Resume work even if localStorage was cleared).
app.get("/api/saves/latest", (req, res) => {
  try {
    let best = null;
    const idx = (SAVE_INDEX && typeof SAVE_INDEX === "object") ? SAVE_INDEX : loadSaveIndex();
    for (const [roomId, ent] of Object.entries(idx || {})) {
      const updatedAt = String(ent?.updatedAt || ent?.updated_at || "").trim();
      const t = updatedAt ? Date.parse(updatedAt) : 0;
      if (!t) continue;
      if (!best || t > best.t) {
        best = { roomId: safeFileBase(roomId), t, updatedAt, character: String(ent?.character || ent?.folder || "").trim() };
      }
    }

    // Fallback: scan loose files if index is empty.
    if (!best) {
      const dirs = [SAVES_DIR, LEGACY_STATE_DIR];
      for (const d of dirs) {
        let files = [];
        try { files = fs.readdirSync(d); } catch { files = []; }
        for (const f of files) {
          if (!f.endsWith(".state.json")) continue;
          const full = path.join(d, f);
          let st = null;
          try { st = fs.statSync(full); } catch { st = null; }
          const t = st?.mtime ? st.mtime.getTime() : 0;
          if (!t) continue;
          if (!best || t > best.t) {
            best = { roomId: safeFileBase(f.replace(/\.state\.json$/i, "")), t, updatedAt: st.mtime.toISOString(), character: "" };
          }
        }
      }
    }

    if (!best) return res.json({ ok: true, save: null });
    res.json({ ok: true, save: { roomId: best.roomId, updatedAt: best.updatedAt, character: best.character || "" } });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.post("/api/book/save", (req, res) => {
  const roomId = String(req.body?.roomId || "").trim();
  if (!roomId) return res.status(400).json({ ok: false, error: "Missing roomId" });
  const st = getRoomState(roomId);
  saveBook(roomId, st.book?.entries || [], st.book?.meta || null);
  res.json({ ok: true });
});

// -------------------- AI STATUS (for UI / debugging) --------------------
// Returns what provider/model the server is actually using.
app.get("/api/ai/status", async (_req, res) => {
  try {
    const rulesProvider = getProviderForRole("rules");
    const narratorProvider = getProviderForRole("narrator");
    const bookProvider = getProviderForRole("book");
    const summaryProvider = getProviderForRole("summary");
    const titleProvider = getProviderForRole("title");

    const rulesBaseUrl = getBaseUrlForRole("rules", rulesProvider);
    const narratorBaseUrl = getBaseUrlForRole("narrator", narratorProvider);
    const bookBaseUrl = getBaseUrlForRole("book", bookProvider);

    const rulesModel = await getModelForRole("rules", rulesProvider);
    const narratorModel = await getModelForRole("narrator", narratorProvider);
    const bookModel = await getModelForRole("book", bookProvider);

    const usesOllama = [rulesProvider, narratorProvider, bookProvider, summaryProvider, titleProvider].some(p => normProvider(p) === "ollama");
    const tags = usesOllama ? await fetchOllamaTagsCached() : null;

    res.json({
      ok: true,
      effective: {
        rules_provider: normProvider(rulesProvider),
        rules_model: rulesModel,
        rules_base_url: rulesBaseUrl,
        narrator_provider: normProvider(narratorProvider),
        narrator_model: narratorModel,
        narrator_base_url: narratorBaseUrl,
        book_provider: normProvider(bookProvider),
        book_model: bookModel,
        book_base_url: bookBaseUrl,
      },
      configured: {
        llm_provider: String(process.env.LLM_PROVIDER || "").trim(),
        llm_base_url: String(process.env.LLM_BASE_URL || "").trim(),
        llm_model: String(process.env.LLM_MODEL || "").trim(),
        llm_provider_rules: String(process.env.LLM_PROVIDER_RULES || "").trim(),
        llm_provider_narrator: String(process.env.LLM_PROVIDER_NARRATOR || "").trim(),
        llm_provider_book: String(process.env.LLM_PROVIDER_BOOK || "").trim(),
        llm_model_rules: String(process.env.LLM_MODEL_RULES || process.env.LLM_RULES_MODEL || "").trim(),
        llm_model_narrator: String(process.env.LLM_MODEL_NARRATOR || process.env.LLM_NARRATOR_MODEL || "").trim(),
        llm_model_book: String(process.env.LLM_MODEL_BOOK || process.env.LLM_BOOK_MODEL || "").trim(),
        // legacy (still supported)
        narrator_provider_legacy: String(process.env.NARRATOR_PROVIDER || "").trim(),
        grok_model_legacy: String(process.env.GROK_MODEL || "").trim(),
        ollama_model_legacy: String(process.env.OLLAMA_MODEL || "").trim(),
        ollama_book_model_legacy: String(process.env.OLLAMA_BOOK_MODEL || "").trim(),
      },
      ollama: usesOllama ? {
        url: getOllamaUrl(),
        reachable: tags?.reachable === true,
        models: tags?.models || [],
        lastError: tags?.lastError || "",
      } : null
    });
  } catch (e) {
    res.json({ ok: false, error: String(e?.message || e || "unknown") });
  }
});

// -------------------- AI CAPABILITIES (keys present) --------------------
// Returns booleans only (never returns secrets) so the UI can show enabled/disabled options.
app.get("/api/ai/caps", (_req, res) => {
  const hasOpenAI = !!String(process.env.OPENAI_API_KEY || "").trim();
  const hasXai = !!String(process.env.XAI_API_KEY || process.env.GROK_API_KEY || "").trim();
  const hasGeneric = !!String(process.env.LLM_API_KEY || "").trim();
  res.json({
    ok: true,
    keys: {
      openai: hasOpenAI,
      xai: hasXai,
      generic: hasGeneric,
    },
    defaults: {
      openai_base_url: String(process.env.OPENAI_BASE_URL || "https://api.openai.com").trim(),
      xai_base_url: String(process.env.XAI_BASE_URL || "https://api.x.ai").trim(),
    }
  });
});

// -------------------- DEV STATUS (AI TRACE) --------------------
app.get('/api/dev/status', (req, res) => {
  const roomId = String(req.query?.roomId || '').trim();
  res.json({
    ok: true,
    dev: DEV_BUILD,
    pending: DEV_BUILD ? devPendingSnapshot(roomId) : [],
    log_size: DEV_BUILD ? DEV_LOG.length : 0,
  });
});

app.get('/api/dev/log', (req, res) => {
  const roomId = String(req.query?.roomId || '').trim();
  const limit = Math.max(10, Math.min(2000, Number(req.query?.limit || 400)));
  if (!DEV_BUILD) return res.json({ ok: true, dev: false, events: [] });
  let list = DEV_LOG;
  if (roomId) list = list.filter(e => String(e?.roomId || '').trim() === roomId);
  const slice = list.slice(Math.max(0, list.length - limit));
  res.json({ ok: true, dev: true, events: slice });
});
// -------------------- END DEV STATUS --------------------

// -------------------- AI MODEL SETTER (simple dropdown UX) --------------------
// Allows the local UI to switch Ollama models without editing .env.
// Notes:
// - This updates process.env in-memory for this running server.
// - To make it persistent, the user can still edit server/.env (optional).
// - In multiplayer, the host machine/server is authoritative.
app.post("/api/ai/model", async (req, res) => {
  try {
    // Model picker is only meaningful for Ollama (it can list installed local models).
    // For hosted APIs, choose the model in server/.env.
    const rulesProvider = getProviderForRole("rules");
    if (normProvider(rulesProvider) !== "ollama") {
      return res.status(400).json({ ok: false, error: "Model switching is only supported when LLM_PROVIDER is ollama." });
    }

    const rawModel = String(req.body?.model || "").trim();
    const applyTo = String(req.body?.applyTo || "both").toLowerCase(); // main | book | both
    if (!rawModel) return res.status(400).json({ ok: false, error: "Missing model" });

    const tags = await fetchOllamaTagsCached();
    const installed = tags?.models || [];

    let chosen = rawModel;
    if (isAutoModel(rawModel)) {
      chosen = "auto";
    } else if (tags?.reachable) {
      // If reachable, resolve to an installed name when possible.
      const cfgNorm = normModelName(rawModel);
      const exact = installed.find(m => normModelName(m) === cfgNorm);
      const prefix = installed.find(m => normModelName(m).startsWith(cfgNorm));
      const fam = (!cfgNorm.includes(":")) ? installed.find(m => normModelName(m).startsWith(cfgNorm + ":")) : "";
      chosen = exact || prefix || fam || rawModel;
    }

    if (applyTo === "main" || applyTo === "both") process.env.OLLAMA_MODEL = chosen;
    if (applyTo === "book" || applyTo === "both") process.env.OLLAMA_BOOK_MODEL = chosen;

    // Persist to server/.env so the selection survives restarts.
    try {
      const envPath = path.resolve(__dirname, ".env");
      const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
      const lines = existing.split(/\r?\n/);
      const setLine = (key, val) => {
        const re = new RegExp(`^${key}=.*$`);
        const idx = lines.findIndex(l => re.test(l));
        const out = `${key}=${val}`;
        if (idx >= 0) lines[idx] = out;
        else lines.push(out);
      };
      if (applyTo === "main" || applyTo === "both") setLine("OLLAMA_MODEL", chosen);
      if (applyTo === "book" || applyTo === "both") setLine("OLLAMA_BOOK_MODEL", chosen);
      const cleaned = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
      fs.writeFileSync(envPath, cleaned, "utf8");
    } catch {}

    // Bust tags cache so status updates feel instant.
    OLLAMA_TAGS_CACHE.at = 0;

    res.json({ ok: true, applied: { model: chosen, applyTo } });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e || "unknown") });
  }
});

// -------------------- NARRATOR PROVIDER SETTER (OpenAI / Grok / Ollama) --------------------
// Lets the web UI switch narrator backend without hand-editing server/.env.
// This only affects the NARRATOR role by design (ruleskeeper remains stable by default).
function persistEnvKeys(keyVals = {}) {
  try {
    const envPath = path.resolve(__dirname, ".env");
    const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
    const lines = existing.split(/\r?\n/);
    const setLine = (key, val) => {
      const re = new RegExp(`^${key}=.*$`);
      const idx = lines.findIndex(l => re.test(l));
      const out = `${key}=${val ?? ""}`;
      if (idx >= 0) lines[idx] = out;
      else lines.push(out);
    };
    for (const [k, v] of Object.entries(keyVals || {})) setLine(String(k), String(v ?? ""));
    const cleaned = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
    fs.writeFileSync(envPath, cleaned, "utf8");
  } catch {}
}


// -------------------- Hosted model auto-selection --------------------
// When switching narrator provider in the UI, auto-pick a valid model from /v1/models
// so users don't accidentally send Ollama-style tags (e.g. gemma3:4b) to hosted APIs.
const MODELS_CACHE = new Map(); // key: `${baseUrl}|${hash(key)}`

function cacheKeyForModels(baseUrl, apiKey) {
  const u = String(baseUrl || "").toLowerCase();
  const k = String(apiKey || "");
  const h = crypto.createHash("sha256").update(k).digest("hex").slice(0, 16);
  return `${u}|${h}`;
}

async function fetchOpenAICompatModels(baseUrl, apiKey) {
  const url = String(baseUrl || "").replace(/\/$/, "");
  if (!url) return { ids: [], error: "missing baseUrl" };
  if (!apiKey) return { ids: [], error: "missing apiKey" };

  const key = cacheKeyForModels(url, apiKey);
  const now = Date.now();
  const hit = MODELS_CACHE.get(key);
  if (hit && (now - hit.at) < 5 * 60 * 1000) {
    return { ids: hit.ids || [], error: "" };
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 12000);

  try {
    const resp = await fetch(`${url}/v1/models`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${apiKey}` },
      signal: ac.signal,
    });
    const raw = await resp.text().catch(() => "");
    if (!resp.ok) return { ids: [], error: `HTTP ${resp.status}: ${raw.slice(0, 220)}` };

    let data = null;
    try { data = JSON.parse(raw); } catch { data = null; }
    const ids = Array.isArray(data?.data) ? data.data.map(m => String(m?.id || "").trim()).filter(Boolean) : [];

    MODELS_CACHE.set(key, { at: now, ids });
    return { ids, error: "" };
  } catch (e) {
    return { ids: [], error: String(e?.message || e || "unknown") };
  } finally {
    clearTimeout(timer);
  }
}

function looksLikeOllamaTag(model) {
  const m = String(model || "").trim();
  if (!m) return false;
  // Ollama tags almost always include a colon (family:tag or family:quant).
  if (m.includes(":")) return true;
  // Cheap heuristic: common local families.
  if (/^(gemma|llama|mistral|qwen|phi|deepseek|mixtral|yi|codellama)/i.test(m)) return true;
  return false;
}

function pickBestModel(ids, kind) {
  const arr = Array.isArray(ids) ? ids.filter(Boolean) : [];
  if (!arr.length) return "";

  const score = (id) => {
    const s = String(id || "").toLowerCase();
    let n = 0;

    if (kind === "xai") {
      if (s.includes("latest")) n += 100;
      if (s.includes("grok-2")) n += 80;
      if (s.startsWith("grok")) n += 40;
      if (s.includes("vision")) n -= 20;
      if (s.includes("audio")) n -= 30;
      if (s.includes("beta")) n -= 5;
      return n;
    }

    // OpenAI (best effort; models list is large and mixed-purpose)
    if (s.includes("gpt-4o-mini")) n += 120;
    else if (s.includes("gpt-4.1-mini")) n += 115;
    else if (s.includes("gpt-4o")) n += 110;
    else if (s.includes("gpt-4.1")) n += 105;
    else if (s.startsWith("gpt-4")) n += 95;
    else if (s.startsWith("gpt-3.5")) n += 50;

    if (/(whisper|tts|dall-e|embedding|realtime|audio|transcribe)/.test(s)) n -= 80;
    if (s.includes("vision")) n -= 20;

    return n;
  };

  let best = arr[0];
  let bestScore = score(best);

  for (const id of arr.slice(1)) {
    const sc = score(id);
    if (sc > bestScore) {
      best = id;
      bestScore = sc;
    }
  }

  return best;
}

// -------------------- End hosted model auto-selection --------------------

app.post("/api/ai/narrator", async (req, res) => {
  try {
    const choiceRaw = String(req.body?.provider || "").trim().toLowerCase();
    const modelRaw = String(req.body?.model || "").trim();

    const baseOpenAI = String(process.env.OPENAI_BASE_URL || "https://api.openai.com").trim() || "https://api.openai.com";
    const baseXai = String(process.env.XAI_BASE_URL || "https://api.x.ai").trim() || "https://api.x.ai";

    let provider = "ollama";
    let baseUrl = "";
    let model = modelRaw;

    if (!choiceRaw || choiceRaw === "ollama" || choiceRaw === "local") {
      provider = "ollama";
      baseUrl = "";
      // Model is handled by Ollama auto selection; leave role model blank.
      model = "";
      process.env.LLM_PROVIDER_NARRATOR = "ollama";
      process.env.LLM_BASE_URL_NARRATOR = "";
      process.env.LLM_MODEL_NARRATOR = "";
    } else if (choiceRaw === "openai") {
      provider = "openai_compat";
      baseUrl = baseOpenAI;

      // Let the UI omit the model: we auto-pick from /v1/models when possible.
      if (!model) model = String(process.env.LLM_MODEL_NARRATOR || process.env.LLM_MODEL || "").trim();

      const apiKey = getEnvAny(["OPENAI_API_KEY", "LLM_API_KEY"], "");
      const list = await fetchOpenAICompatModels(baseUrl, apiKey);

      // Replace Ollama tags (gemma3:4b) or unknown hosted models with a valid hosted model.
      if (!model || looksLikeOllamaTag(model) || (list.ids.length && !list.ids.includes(model))) {
        model = pickBestModel(list.ids, "openai") || "gpt-4o-mini";
      }

      if (!model) {
        return res.status(400).json({ ok: false, error: "Missing model and could not auto-detect one. Set LLM_MODEL_NARRATOR in server/.env." });
      }

      process.env.LLM_PROVIDER_NARRATOR = "openai_compat";
      process.env.LLM_BASE_URL_NARRATOR = baseUrl;
      process.env.LLM_MODEL_NARRATOR = model;
    } else if (choiceRaw === "grok" || choiceRaw === "xai") {
      provider = "openai_compat";
      baseUrl = baseXai;

      // Let the UI omit the model: we auto-pick from /v1/models when possible.
      if (!model) model = String(process.env.LLM_MODEL_NARRATOR || process.env.GROK_MODEL || "").trim();

      const apiKey = getEnvAny(["XAI_API_KEY", "GROK_API_KEY", "LLM_API_KEY"], "");
      const list = await fetchOpenAICompatModels(baseUrl, apiKey);

      // Replace Ollama tags (gemma3:4b) or unknown hosted models with a valid hosted model.
      if (!model || looksLikeOllamaTag(model) || (list.ids.length && !list.ids.includes(model))) {
        model = pickBestModel(list.ids, "xai") || "grok-2-latest";
      }

      if (!model) {
        return res.status(400).json({ ok: false, error: "Missing model and could not auto-detect one. Set LLM_MODEL_NARRATOR (or GROK_MODEL) in server/.env." });
      }

      process.env.LLM_PROVIDER_NARRATOR = "openai_compat";
      process.env.LLM_BASE_URL_NARRATOR = baseUrl;
      process.env.LLM_MODEL_NARRATOR = model;
    } else {
      return res.status(400).json({ ok: false, error: `Unknown provider: ${choiceRaw}` });
    }

    // Persist to server/.env so it survives restarts.
    persistEnvKeys({
      LLM_PROVIDER_NARRATOR: process.env.LLM_PROVIDER_NARRATOR,
      LLM_BASE_URL_NARRATOR: process.env.LLM_BASE_URL_NARRATOR,
      LLM_MODEL_NARRATOR: process.env.LLM_MODEL_NARRATOR,
    });

    res.json({
      ok: true,
      applied: {
        narrator_provider: normProvider(getProviderForRole("narrator")),
        narrator_base_url: getBaseUrlForRole("narrator", provider),
        narrator_model: await getModelForRole("narrator", provider),
      }
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e || "unknown") });
  }
});

// -------------------- In-memory room state --------------------
const stateByRoom = Object.create(null);

const MIN_BEATS_PER_SCENE = Number(process.env.MIN_BEATS_PER_SCENE || 10);
const MIN_SCENES_PER_SESSION = Number(process.env.MIN_SCENES_PER_SESSION || 10);

// -------------------- Canon Map (continuous travel) --------------------
// Canon map image in web/assets/aetheryn_canon_map.png is 2048x1365 => aspect H/W ~ 0.6665
const CANON_MAP_ASPECT_HW = 1365 / 2048;
const MAP_WIDTH_MILES_DEFAULT = Number(process.env.MAP_WIDTH_MILES || 3000);


function extractTokenValue(tokens, prefix) {
  for (const t of (tokens || [])) {
    if (typeof t !== "string") continue;
    if (t.startsWith(prefix)) return t.slice(prefix.length);
  }
  return "";
}

function extractLoc(tokens) {
  // LOC is a narrative-facing label. It must NEVER be used as a coordinate dump.
  // Placeholder values mean "the party does not know (or has not named) this place yet."
  const v1 = extractTokenValue(tokens, "loc:");
  const v2 = extractTokenValue(tokens, "loc=");
  const v = (v1 || v2 || "").trim();
  return v || "UNMAPPED";
}

function isPlaceholderLoc(loc) {
  const s = String(loc || "").trim().toUpperCase();
  return !s || s === "START" || s === "UNMAPPED" || s === "UNKNOWN" || s === "?" || s === "—";
}


// -------------------- Action/Scene anchor extraction (drift guard) --------------------
// Purpose: prevent the model from ignoring the player's action or jumping to an unrelated scene.
const _ANCHOR_STOPWORDS = new Set([
  'a','an','the','and','or','but','if','then','than','as','at','by','for','from','in','into','on','onto','of','off','out','over','to','up','with','within',
  'i','me','my','mine','we','us','our','ours','you','your','yours','he','him','his','she','her','hers','they','them','their','theirs','it','its',
  'this','that','these','those','here','there','now','just','very','really','maybe','perhaps','please','ok','okay','yeah','yep','nope',
  'do','did','does','done','can','could','will','would','should','may','might','must',
  'is','are','was','were','be','been','being','am',
  'roll','rolls','rolled','target','targets','margin','action','check','combat','result','results','total','dice','method','freeform',
]);

const _ANCHOR_KEEP_SHORT = new Set([
  'go','run','hide','look','open','loot','talk','fight','cast','rest','nod','aim','say',
  'left','right','north','south','east','west','up','down',
]);

function extractAnchorWords(raw, { max = 8 } = {}) {
  const s0 = String(raw || '').replace(/\[[^\]]*\]/g, ' '); // strip [ACTION_CHECK ...] etc
  const s1 = s0.replace(/[\/_]+/g, ' ').replace(/[^A-Za-z0-9\s\-']/g, ' ');
  const parts = s1.split(/\s+/).map(w => w.trim()).filter(Boolean);
  const out = [];
  const seen = new Set();

  for (let w of parts) {
    const low = w.toLowerCase();
    if (!low) continue;
    if (_ANCHOR_STOPWORDS.has(low)) continue;
    if (low.length < 4 && !_ANCHOR_KEEP_SHORT.has(low)) continue;
    // Avoid pure numbers and roll-ish noise
    if (/^\d+$/.test(low)) continue;
    // Trim trailing apostrophes/dashes
    w = low.replace(/^[\-']+|[\-']+$/g, '');
    if (!w) continue;
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length >= max) break;
  }
  return out;
}


// -------------------- Compact prompt helpers (speed + memory) --------------------
function startsWithAnyPrefix(s, prefixes) {
  const t = String(s || "").toLowerCase();
  for (const p of (prefixes || [])) {
    const k = String(p || "").toLowerCase();
    if (k && t.startsWith(k)) return true;
  }
  return false;
}

function limitLines(lines, maxLines = 120) {
  const arr = Array.isArray(lines) ? lines.filter(Boolean) : [];
  if (!maxLines || maxLines <= 0) return arr;
  return arr.length <= maxLines ? arr : arr.slice(0, maxLines);
}

function filterTokensForSnapshot(tokens, { loc = "", actor = "", maxLines = 120 } = {}) {
  const tks = Array.isArray(tokens) ? tokens.map(t => String(t || "").trim()).filter(Boolean) : [];
  const L = String(loc || "").trim();
  const A = String(actor || "").trim();

  const always = ["mode:", "loc:", "xy:", "time:", "clock:", "day:", "season:", "weather:", "flag:"];
  const partyish = ["party:", "hp:", "mp:", "stamina:", "stat:", "stats:", "eq:", "equip:", "rel:", "res:"];
  const invish = ["inv:"];
  const assetish = ["asset:", "stash:"];

  const picked = [];

  // Always-important tokens first
  for (const x of tks) {
    if (startsWithAnyPrefix(x, always) || startsWithAnyPrefix(x, partyish)) picked.push(x);
  }

  // Inventory (cap aggressively)
  const inv = tks.filter(x => startsWithAnyPrefix(x, invish));
  picked.push(...inv.slice(0, 24));

  // Assets: prefer assets at current location or owned by actor/party; else cap
  const assets = tks.filter(x => startsWithAnyPrefix(x, assetish));
  const atLoc = [];
  const owned = [];
  const other = [];
  for (const a of assets) {
    const low = a.toLowerCase();
    const hasLoc = L && low.includes(`|loc=${L.toLowerCase()}`);
    const hasOwner = A && low.includes(`|owner=${A.toLowerCase()}`);
    const isParty = low.includes("|owner=party");
    if (hasLoc) atLoc.push(a);
    else if (hasOwner || isParty) owned.push(a);
    else other.push(a);
  }
  picked.push(...atLoc.slice(0, 16));
  picked.push(...owned.slice(0, 16));
  picked.push(...other.slice(0, 12));

  // De-dupe (keep first occurrence)
  const seen = new Set();
  const dedup = [];
  for (const p of picked) {
    const k = p.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    dedup.push(p);
  }

  return limitLines(dedup, maxLines);
}

function getCompactContinuity(roomId, { actor = "" } = {}) {
  const st = getRoomState(roomId);
  const tokens = Array.isArray(st?.canon?.tokens) ? st.canon.tokens : [];
  const loc = extractLoc(tokens);
  const mem = st?.memory || {};
  const lastNarr = getLastNarrationSnippet(roomId, Number(process.env.NARR_LAST_CHARS || 900));
  const snapshotTokens = filterTokensForSnapshot(tokens, { loc, actor, maxLines: Number(process.env.SNAPSHOT_MAX_LINES || 120) });

  return {
    loc,
    snapshotTokens,
    scene_summary: String(mem.scene_summary || "").trim(),
    session_summary: String(mem.session_summary || "").trim(),
    gm_hidden_summary: String(mem.gm_hidden_summary || "").trim(),
    recent_beat_summaries: Array.isArray(mem.beat_summaries) ? mem.beat_summaries.slice(-Number(process.env.RECENT_BEATS_K || 8)) : [],
    last_narration_snippet: String(lastNarr || "").trim()
  };
}

// -------------------- Summary memory (fast continuity, optional LLM compression) --------------------
function ensureMemory(st) {
  if (!st.memory || typeof st.memory !== "object") {
    st.memory = {
      scene_summary: "",
      session_summary: "",
      beat_summaries: [],
      beats_since_summary: 0,
      summarizing: false,
      last_sceneNo: 0,
      last_chapterNo: 0,
      // GM-only continuity (hidden from players): secrets, NPC intent, unseen threats, unresolved clues.
      gm_hidden_summary: "",
    };
  }
  if (!Array.isArray(st.memory.beat_summaries)) st.memory.beat_summaries = [];
  if (!Number.isFinite(Number(st.memory.beats_since_summary))) st.memory.beats_since_summary = 0;
  if (typeof st.memory.gm_hidden_summary !== "string") st.memory.gm_hidden_summary = "";
  return st.memory;
}

// Prevent GM-only continuity notes from leaking through any player-facing API exports.
function stripGmHiddenMemory(mem) {
  try {
    if (!mem || typeof mem !== 'object') return mem;
    const out = { ...mem };
    if ('gm_hidden_summary' in out) delete out.gm_hidden_summary;
    return out;
  } catch {
    return mem;
  }
}

function pushBeatSummary(roomId, beatSummary) {
  const st = getRoomState(roomId);
  const mem = ensureMemory(st);
  const bs = String(beatSummary || "").trim();
  if (!bs) return;

  mem.beat_summaries.push(bs);
  if (mem.beat_summaries.length > 40) mem.beat_summaries = mem.beat_summaries.slice(-40);
  mem.beats_since_summary = Number(mem.beats_since_summary || 0) + 1;

  // Cheap rolling continuity (no extra model calls)
  if (!mem.scene_summary) mem.scene_summary = bs;
  else {
    const joined = (mem.scene_summary + " " + bs).trim();
    mem.scene_summary = joined.length > 2200 ? joined.slice(joined.length - 2200) : joined;
  }

  saveRoomStateFile(roomId);
}

function rollupSceneOnSceneAdvance(roomId) {
  const st = getRoomState(roomId);
  const mem = ensureMemory(st);
  const meta = st.book?.meta || {};
  const sceneNo = Number(meta.sceneNo || 0);
  const chapNo = Number(meta.chapterNo || 0);

  // Detect scene/chapter change and roll current scene summary into session summary
  const changed = (sceneNo && mem.last_sceneNo && sceneNo !== mem.last_sceneNo) || (chapNo && mem.last_chapterNo && chapNo !== mem.last_chapterNo);
  if (!changed) {
    mem.last_sceneNo = sceneNo || mem.last_sceneNo;
    mem.last_chapterNo = chapNo || mem.last_chapterNo;
    return;
  }

  const label = mem.last_sceneNo ? `Scene ${mem.last_sceneNo}` : "Previous scene";
  const s = String(mem.scene_summary || "").trim();
  if (s) {
    const chunk = `${label}: ${s}`;
    mem.session_summary = (mem.session_summary ? (mem.session_summary + "\n\n" + chunk) : chunk).trim();
    if (mem.session_summary.length > 5000) mem.session_summary = mem.session_summary.slice(mem.session_summary.length - 5000);
  }

  // Reset scene summary window
  mem.scene_summary = "";
  mem.beat_summaries = [];
  mem.beats_since_summary = 0;
  mem.last_sceneNo = sceneNo || mem.last_sceneNo;
  mem.last_chapterNo = chapNo || mem.last_chapterNo;

  saveRoomStateFile(roomId);
}

async function callOllamaForSceneSummary({ roomId, continuity, beatWindow }) {

  const system = `
You are AETHERYN_SUMMARY_SCRIBE.
Write a compact, factual continuity summary for the CURRENT SCENE only.

RULES:
- Facts only. Do not invent items, characters, locations, or outcomes.
- 120–220 words.
- Use in-world language. No UI talk. No "choices".
- If details are missing, be conservative and general.
- Output plain text only.
`.trim();

  const user = `
STATE_SNAPSHOT_TOKENS:
${(continuity?.snapshotTokens || []).join("\n")}

EXISTING_SCENE_SUMMARY (may be empty):
${continuity?.scene_summary || "(empty)"}

RECENT_BEAT_SUMMARIES:
${(beatWindow || []).map((b, i) => `${i + 1}) ${b}`).join("\n")}
`.trim();

  const out = await callLLMRole("summary", {
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    temperature: Number(process.env.SUMMARY_TEMPERATURE || 0.2),
    maxTokens: Number(process.env.SUMMARY_MAX_TOKENS || 260),
    ollamaOptions: {
      num_ctx: Number(process.env.SUMMARY_NUM_CTX || 4096),
      top_k: Number(process.env.OLLAMA_TOP_K || 40),
      top_p: Number(process.env.OLLAMA_TOP_P || 0.9),
      repeat_last_n: Number(process.env.OLLAMA_REPEAT_LAST_N || 128),
      repeat_penalty: Number(process.env.OLLAMA_REPEAT_PENALTY || 1.12),
    }
  });

  return String(out || "").trim();
}

function maybeSummarizeSceneAsync(roomId) {
  const st = getRoomState(roomId);
  const mem = ensureMemory(st);

  const enabled = String(process.env.ENABLE_SUMMARY_COMPRESSION || "on").toLowerCase() !== "off";
  const every = Number(process.env.SUMMARY_EVERY_BEATS || 10);
  const windowN = Number(process.env.SUMMARY_WINDOW_BEATS || 12);

  if (!enabled) return;
  if (mem.summarizing) return;
  if (Number(mem.beats_since_summary || 0) < every) return;

  const beatWindow = Array.isArray(mem.beat_summaries) ? mem.beat_summaries.slice(-windowN) : [];
  if (beatWindow.length < Math.min(6, windowN)) return;

  mem.summarizing = true;
  mem.beats_since_summary = 0;

  const actorForSummary = getPrimaryCharacterName(roomId) || "";
  const continuity = getCompactContinuity(roomId, { actor: actorForSummary });

  // Run asynchronously so it doesn't slow the player's turn.
  (async () => {
    try {
      const out = await callOllamaForSceneSummary({ roomId, continuity, beatWindow });
      if (out) {
        mem.scene_summary = out;
        // Keep beat window for short-term recall, but don't let it balloon
        mem.beat_summaries = beatWindow.slice(-windowN);
      }
    } catch {
      // If it fails, keep cheap rolling summary.
    } finally {
      mem.summarizing = false;
      saveRoomStateFile(roomId);
    }
  })();
}


function normalizeBookMeta(meta, entries) {
  const m = (meta && typeof meta === "object") ? meta : {};
  const chapterNo = Number(m.chapterNo || 0);
  const chapterOpen = (typeof m.chapterOpen === "boolean") ? m.chapterOpen : ((entries && entries.length > 0) ? true : false);

  const chapterStartIndex = Number.isFinite(Number(m.chapterStartIndex)) ? Number(m.chapterStartIndex) : 0;
  const sceneNo = Number(m.sceneNo || (chapterOpen ? 1 : 0));
  const beatsInScene = Number(m.beatsInScene || 0);
  const scenesInSession = Number(m.scenesInSession || (chapterOpen ? 1 : 0));
  const sceneBreakRequested = !!m.sceneBreakRequested;
  const lastLoc = String(m.lastLoc || "START");

  return {
    chapterNo,
    chapterOpen,
    chapterStartIndex,
    sceneNo,
    beatsInScene,
    scenesInSession,
    sceneBreakRequested,
    lastLoc,
  };
}

function emitBookMeta(roomId) {
  try {
    const st = getRoomState(roomId);
    io.to(roomId).emit("book_meta", { roomId, meta: st.book?.meta || null });
  } catch {}
}

function ensureChapterOpen(roomId) {
  const st = getRoomState(roomId);
  if (!st.book) st.book = { entries: [], meta: normalizeBookMeta(null, []) };
  if (!st.book.meta) st.book.meta = normalizeBookMeta(null, st.book.entries);

  if (st.book.meta.chapterOpen) return;

  const nextChapter = Number(st.book.meta.chapterNo || 0) + 1;
  st.book.meta.chapterNo = nextChapter;
  st.book.meta.chapterOpen = true;
  st.book.meta.sceneNo = 1;
  st.book.meta.beatsInScene = 0;
  st.book.meta.scenesInSession = 1;
  st.book.meta.sceneBreakRequested = false;
  st.book.meta.lastLoc = extractLoc(st.canon.tokens);
  st.book.meta.chapterStartIndex = st.book.entries.length;

  appendBookEntry(roomId, { kind: "chapter_start", text: `Chapter ${nextChapter}` });
  appendBookEntry(roomId, { kind: "scene_header", text: `— Scene 1 —` });

  saveBook(roomId, st.book.entries, st.book.meta);
  emitBookMeta(roomId);
}

function requestSceneBreak(roomId) {
  const st = getRoomState(roomId);
  ensureChapterOpen(roomId);
  st.book.meta.sceneBreakRequested = true;
  tryAdvanceScene(roomId);
  saveBook(roomId, st.book.entries, st.book.meta);
  emitBookMeta(roomId);
}

function autosaveFlagOn(tokens) {
  const low = (tokens || []).map(t => String(t || '').trim().toLowerCase());
  return low.includes('flag:autosave=on') || low.includes('flag:autosave=1') || low.includes('flag:autosave=true');
}

function autosaveMaybe(roomId, why = "") {
  try {
    const st = getRoomState(roomId);
    if (!autosaveFlagOn(st.canon.tokens)) return;
    const sceneNo = Number(st.book?.meta?.sceneNo || 0);
    if (!sceneNo) return;

    // Canon: autosave at the end of every even-numbered scene.
    if (sceneNo % 2 !== 0) return;

    saveRoomStateFile(roomId);
    try { saveBook(roomId, st.book?.entries || [], st.book?.meta || null); } catch {}
    // Low-noise UX: one line, no spam.
    try { io.to(roomId).emit("system", `Autosaved (Scene ${sceneNo}${why ? `: ${why}` : ""}).`); } catch {}
  } catch {}
}


function tryAdvanceScene(roomId) {
  const st = getRoomState(roomId);
  if (!st.book?.meta?.chapterOpen) return;
  const meta = st.book.meta;

  if (meta.sceneBreakRequested && meta.beatsInScene >= MIN_BEATS_PER_SCENE) {
    meta.sceneNo = Number(meta.sceneNo || 1) + 1;
    meta.scenesInSession = Number(meta.scenesInSession || 1) + 1;
    meta.beatsInScene = 0;
    meta.sceneBreakRequested = false;
    appendBookEntry(roomId, { kind: "scene_header", text: `— Scene ${meta.sceneNo} —` });
    autosaveMaybe(roomId, "scene transition");
  }
}

function onBeatComplete(roomId, canonTokens) {
  const st = getRoomState(roomId);
  if (!st.book?.meta?.chapterOpen) return;

  const meta = st.book.meta;
  meta.beatsInScene = Number(meta.beatsInScene || 0) + 1;

  const newLoc = extractLoc(canonTokens || st.canon.tokens);
  if (newLoc && newLoc !== meta.lastLoc) {
    meta.sceneBreakRequested = true;
    meta.lastLoc = newLoc;
  }

  tryAdvanceScene(roomId);

  saveBook(roomId, st.book.entries, meta);
  emitBookMeta(roomId);
}

function getChapterTextExcerpt(roomId, maxChars = 18000) {
  const st = getRoomState(roomId);
  const meta = st.book?.meta || {};
  const startIdx = Number.isFinite(Number(meta.chapterStartIndex)) ? Number(meta.chapterStartIndex) : 0;
  const entries = (st.book?.entries || []).slice(startIdx);
  const txt = renderBookText(entries);

  if (txt.length <= maxChars) return txt.trim();

  const head = txt.slice(0, Math.min(4000, txt.length));
  const tail = txt.slice(Math.max(0, txt.length - (maxChars - 500)));
  return (head + "\n\n…\n\n" + tail).trim();
}

async function callOllamaForChapterTitle({ roomId, chapterNo, chapterText }) {

  const system = `
You are AETHERYN_CHAPTER_TITLER.
Generate a short, evocative chapter title based ONLY on what happened.
RULES:
- Output ONLY the title text. No quotes. No numbering. No punctuation required.
- 2–8 words. Dark-fantasy tone. Specific > vague.
- Do not invent new events. Do not spoil beyond what is included.
`;

  const user = `
CHAPTER_NUMBER: ${chapterNo}
CHAPTER_TEXT (excerpt):
${chapterText}
`;

  const outRaw = await callLLMRole("title", {
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    temperature: Number(process.env.BOOK_TITLE_TEMPERATURE || 0.7),
    maxTokens: 40,
    ollamaOptions: {
      num_ctx: Number(process.env.OLLAMA_NUM_CTX_TITLE || process.env.OLLAMA_NUM_CTX || 4096),
      repeat_last_n: Number(process.env.OLLAMA_REPEAT_LAST_N || 256),
      repeat_penalty: Number(process.env.OLLAMA_REPEAT_PENALTY || 1.15),
      top_k: Number(process.env.OLLAMA_TOP_K || 40),
      top_p: Number(process.env.OLLAMA_TOP_P || 0.9),
    }
  });

  const out = String(outRaw ?? "").trim().replace(/\s+/g, " ");
  return out.slice(0, 80);
}

async function endSessionAndTitleChapter(roomId) {
  const st = getRoomState(roomId);
  ensureChapterOpen(roomId);

  const meta = st.book.meta;
  const chapterNo = Number(meta.chapterNo || 1);

  if (meta.scenesInSession < MIN_SCENES_PER_SESSION) {
    throw new Error(`Session is too short: need at least ${MIN_SCENES_PER_SESSION} scenes before ending (currently ${meta.scenesInSession}).`);
  }
  if (meta.beatsInScene < MIN_BEATS_PER_SCENE) {
    throw new Error(`Current scene is too short: need at least ${MIN_BEATS_PER_SCENE} beats in the final scene before ending (currently ${meta.beatsInScene}).`);
  }

  const excerpt = getChapterTextExcerpt(roomId, 18000);
  let title = "";
  try {
    title = await callOllamaForChapterTitle({ roomId, chapterNo, chapterText: excerpt });
  } catch {
    title = "Untitled";
  }

  appendBookEntry(roomId, { kind: "chapter_title", text: `Chapter ${chapterNo}: ${title}` });

  meta.chapterOpen = false;
  meta.sceneBreakRequested = false;
  saveBook(roomId, st.book.entries, meta);
  emitBookMeta(roomId);

  return { chapterNo, title };
}

function getRoomState(roomId) {
  if (!stateByRoom[roomId]) {
    const loaded = loadBookData(roomId);
    const entries = loaded?.entries || [];
    const meta = normalizeBookMeta(loaded?.meta, entries);
    stateByRoom[roomId] = {
      // Multiplayer quality-of-life: rooms begin in a neutral lobby state.
      // Host starts the actual game when everyone is connected.
      // (Solo rooms are forced into INTAKE on join.)
      canon: { tokens: (() => { const sp = randomSpawnXY(); return [`loc:UNMAPPED`, `xy:${sp.x.toFixed(4)},${sp.y.toFixed(4)}`, "flag:autosave=on", "mode:LOBBY"]; })() },
      lastChoices: [],
      ooc: [],
      pendingPurchases: [],
      pendingLoot: [],
      deliveries: [],
      hostSocketId: null,
      hostPlayerId: null,
      playersById: Object.create(null),
      socketToPlayerId: Object.create(null),
      // Incremented each time a room goes LOBBY -> INTAKE.
      // Used by clients to avoid stale "I already submitted intake" state when reusing a room code.
      runId: 0,
      intakeGlobal: null,
      intakePlayers: Object.create(null),
      intakeCompleted: false,
      memory: {
        // Compact continuity memory (keeps prompts small)
        scene_summary: "",
        session_summary: "",
        beat_summaries: [],
        beats_since_summary: 0,
        summarizing: false,
        last_sceneNo: Number(meta?.sceneNo || 0),
        last_chapterNo: Number(meta?.chapterNo || 0),
        // GM-only continuity (hidden from players): secrets, NPC intent, unseen threats, unresolved clues.
        gm_hidden_summary: "",
      },
      book: {
        entries,
        meta
      }
    };
// Load persisted tokens/summaries across restarts (if present).
const persisted = loadRoomStateFile(roomId);
if (persisted) {
  if (Array.isArray(persisted.canon_tokens) && persisted.canon_tokens.length) {
    stateByRoom[roomId].canon.tokens = persisted.canon_tokens;
  }
  if (persisted.memory && typeof persisted.memory === "object") {
    stateByRoom[roomId].memory = { ...stateByRoom[roomId].memory, ...persisted.memory };
  }
  if (Array.isArray(persisted.lastChoices)) {
  const norm = normalizeChoicesArray(persisted.lastChoices);
  stateByRoom[roomId].lastChoices = Array.isArray(norm.out) ? norm.out : [];
  try { stateByRoom[roomId]._lastChoicesMeta = Array.isArray(norm.meta) ? norm.meta : []; } catch {}
}
  if (Array.isArray(persisted.pendingPurchases)) stateByRoom[roomId].pendingPurchases = persisted.pendingPurchases;
  if (Array.isArray(persisted.pendingLoot)) stateByRoom[roomId].pendingLoot = persisted.pendingLoot;
  if (Array.isArray(persisted.ooc)) stateByRoom[roomId].ooc = persisted.ooc;
  if (persisted.intakeGlobal) stateByRoom[roomId].intakeGlobal = persisted.intakeGlobal;
  if (persisted.intakeCompleted) stateByRoom[roomId].intakeCompleted = true;
  if (Number.isFinite(persisted.runId) && Number(persisted.runId) > 0) stateByRoom[roomId].runId = Number(persisted.runId) || 0;
  if (Array.isArray(persisted.playerCharNames) && persisted.playerCharNames.length) stateByRoom[roomId].playerCharNames = persisted.playerCharNames;
  if (persisted.statsLocks && typeof persisted.statsLocks === "object") stateByRoom[roomId]._statsLocks = persisted.statsLocks;
  if (persisted.statsPending && typeof persisted.statsPending === "object") stateByRoom[roomId]._statsPending = persisted.statsPending;
  if (Array.isArray(persisted.deliveries)) stateByRoom[roomId].deliveries = persisted.deliveries;
  if (persisted.prologueDelivered) stateByRoom[roomId]._prologueDelivered = true;
  if (persisted.turn && typeof persisted.turn === "object") stateByRoom[roomId].turn = persisted.turn;
  if (persisted.canon_hash && String(persisted.canon_hash).trim() && String(CANON_HASH || '').trim()) {
    if (String(persisted.canon_hash).trim() !== String(CANON_HASH).trim()) {
      stateByRoom[roomId]._canonHashMismatch = { saved: String(persisted.canon_hash).trim(), current: String(CANON_HASH).trim() };
    }
  }
}

// Baseline token repair: remove deprecated placeholders and ensure continuous XY exists.
try { stateByRoom[roomId].canon.tokens = repairBaselineTokens(stateByRoom[roomId].canon.tokens); } catch {}

// Normalize any legacy/packed tokens for HUD reliability (especially vitals).
try {
  const before = stateByRoom[roomId].canon.tokens;
  const after0 = normalizeCanonTokensForCompat(before);
  const after = ensureWorldClock(ensureXY(after0), roomId);
  stateByRoom[roomId].canon.tokens = after;
  // Persist the normalized form so future restarts are clean.
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    try { saveRoomStateFile(roomId); } catch {}
  }
} catch {}


  }
  return stateByRoom[roomId];
}

// -------------------- Token helpers (server-side authority) --------------------

// Back-compat + safety: some older saves (or buggy dumps) may pack multiple protected tokens
// into one comma-separated line, e.g. "hp:cur=8, mp:cur=0, stamina:cur=0".
// We normalize those into separate tokens and standardize meters where possible.
function normalizeCanonTokensForCompat(tokens) {
  const arr = Array.isArray(tokens) ? tokens : [];

  const allowSplit = new Set([
    'loc','time','clock','day','pos','year','doy','season','weather','region','wxday','wxreg',
    'hp','health','mp','mana','aether','stamina','stam',
    'party','res','inv','eq','equip','stash','asset','pc','cfg','mode','flag'
  ]);

  const splitIfPacked = (line) => {
    const s = String(line || '').trim();
    if (!s || !s.includes(',')) return [s];

    const matches = Array.from(s.matchAll(/(?:^|,)\s*([A-Za-z][A-Za-z0-9_-]*)\s*[:=]/g));
    if (matches.length <= 1) return [s];

    const keys = matches.map(m => String(m[1] || '').toLowerCase());
    if (!keys.every(k => allowSplit.has(k))) return [s];

    const parts = s.split(',').map(p => p.trim()).filter(Boolean);
    return parts.length ? parts : [s];
  };

  const normalizeMeter = (line) => {
    const s = String(line || '').trim();
    const m = s.match(/^\s*(hp|mp|stamina|stam)\s*[:=]\s*(.+)$/i);
    if (!m) return s;

    const rawKey = String(m[1] || '').toLowerCase();
    const key = rawKey === 'stam' ? 'stamina' : rawKey;
    const body = String(m[2] || '').trim();

    // Already canonical ratio.
    const rm = body.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (rm) return `${key}:${rm[1]}/${rm[2]}`;

    // cur/max forms.
    const curM = body.match(/cur\s*=\s*(\d+)/i);
    const maxM = body.match(/max\s*=\s*(\d+)/i);
    if (curM && maxM) return `${key}:${curM[1]}/${maxM[1]}`;
    if (curM) return `${key}:${curM[1]}`;

    // Plain number.
    const nm = body.match(/^(\d+)$/);
    if (nm) return `${key}:${nm[1]}`;

    return `${key}:${body}`;
  };

  const out = [];
  for (const t of arr) {
    for (const part of splitIfPacked(t)) {
      out.push(normalizeMeter(part));
    }
  }
  return out;
}

function tokenStartsWithAny(t, prefixes) {
  const s = String(t || "").toLowerCase();
  for (const p of (prefixes || [])) {
    const k = String(p || "").toLowerCase();
    if (k && s.startsWith(k)) return true;
  }
  return false;
}

function preserveProtectedTokens(prevTokens, nextTokens, protectedPrefixes) {
  const prev = Array.isArray(prevTokens) ? prevTokens : [];
  const next = Array.isArray(nextTokens) ? nextTokens : [];
  const prot = prev.filter(t => tokenStartsWithAny(t, protectedPrefixes));
  const stripped = next.filter(t => !tokenStartsWithAny(t, protectedPrefixes));

  // De-dupe protected tokens (keep last occurrence from prev)
  const seen = new Set();
  const protDedup = [];
  for (let i = prot.length - 1; i >= 0; i--) {
    const k = String(prot[i] || "").trim();
    if (!k) continue;
    const low = k.toLowerCase();
    if (seen.has(low)) continue;
    seen.add(low);
    protDedup.push(k);
  }
  protDedup.reverse();

  return stripped.concat(protDedup);
}


// -------------------- Anti-cheat delta guards (code-authoritative gains) --------------------
// Principle: Players may NOT create value from text.
// Non-host turns are allowed to spend/consume/equip, but any *gains* (new items, increased quantities,
// increased currency) must come from host approval or explicit server-side systems.
function parseResMap(tokens) {
  const out = new Map();
  for (const t of (tokens || [])) {
    const s = String(t || "").trim();
    if (!s.toLowerCase().startsWith("res:")) continue;
    const body = s.slice(4).trim();
    const m = body.match(/^([^=]+)=(\d+)$/);
    if (!m) continue;
    out.set(String(m[1] || "").trim().toLowerCase(), Number(m[2]) || 0);
  }
  return out;
}


function parseInvMap(tokens) {
  const out = new Map();
  // Track preferred display casing for each key.
  out._names = new Map();

  const remember = (keyLower, name) => {
    try {
      if (!out._names.has(keyLower) && name) out._names.set(keyLower, name);
    } catch {}
  };

  const add = (nameRaw, qtyRaw) => {
    const nm = sanitizeTokenField(String(nameRaw || '').trim(), 80);
    if (!nm) return;
    const key = nm.toLowerCase();
    const qty = Math.max(0, Math.floor(Number(qtyRaw ?? 1) || 0));
    if (qty <= 0) return;
    out.set(key, (out.get(key) ?? 0) + qty);
    remember(key, nm);
  };

  for (const t of (tokens || [])) {
    const s = String(t || '').trim();
    if (!s) continue;
    const low = s.toLowerCase();

    let body = '';
    if (low.startsWith('inv:') || low.startsWith('inv=')) {
      body = s.split(/[:=]/).slice(1).join(':').trim();
    } else if (low.startsWith('inventory:') || low.startsWith('inventory=')) {
      body = s.split(/[:=]/).slice(1).join(':').trim();
    } else {
      continue;
    }

    if (!body) continue;

    const parts = body
      .replace(/^\[|\]$/g, '')
      .split(/\s*[;|,]+\s*/)
      .map(x => String(x || '').trim())
      .filter(Boolean);

    for (const p of parts) {
      const m = p.match(/^(.+?)\s*=\s*(\d+)$/);
      if (m) add(m[1], m[2]);
      else add(p, 1);
    }
  }

  return out;
}

function _invpTokenMatchesName(tokenStr, name){
  const nm = _pNameKey(name);
  if (!nm) return false;
  const s = String(tokenStr || '').trim();
  const low = s.toLowerCase();
  if (!(low.startsWith('invp:') || low.startsWith('invp=') || low.startsWith('inventoryp:') || low.startsWith('inventoryp='))) return false;
  const body = s.split(/[:=]/).slice(1).join(':');
  const head = String(body || '').split('|')[0].trim();
  return head && head.toLowerCase() === nm.toLowerCase();
}

function parseInvMapFor(tokens, actorName){
  const nm = _pNameKey(actorName);
  if (!nm) return parseInvMap(tokens);

  // Prefer per-character invp:NAME|... if present.
  let body = '';
  for (const t of (tokens || [])) {
    if (!_invpTokenMatchesName(t, nm)) continue;
    const s = String(t || '').trim();
    const raw = s.split(/[:=]/).slice(1).join(':');
    body = String(raw || '').split('|').slice(1).join('|').trim();
    break;
  }
  if (!body) return parseInvMap(tokens);

  const out = new Map();
  out._names = new Map();

  const parts = body
    .replace(/^\[|\]$/g, '')
    .split(/\s*[;|,]+\s*/)
    .map(x => String(x || '').trim())
    .filter(Boolean);

  for (const p of parts) {
    const m = p.match(/^(.+?)\s*=\s*(\d+)$/);
    const nm2 = sanitizeTokenField(String(m ? m[1] : p).trim(), 80);
    if (!nm2) continue;
    const key = nm2.toLowerCase();
    const qty = m ? Math.max(0, Math.floor(Number(m[2]) || 0)) : 1;
    if (qty <= 0) continue;
    out.set(key, (out.get(key) ?? 0) + qty);
    try { if (!out._names.has(key)) out._names.set(key, nm2); } catch {}
  }
  return out;
}

function invEnsureNames(invMap) {
  try {
    if (invMap && !(invMap._names instanceof Map)) invMap._names = new Map();
  } catch {}
  return invMap;
}

function invGetName(invMap, keyLower, fallback) {
  try {
    return invMap?._names?.get(keyLower) || fallback || keyLower;
  } catch {
    return fallback || keyLower;
  }
}

function invSetQty(invMap, keyLower, nameHint, qty) {
  if (!(invMap instanceof Map)) return;
  invEnsureNames(invMap);
  const q = Math.max(0, Math.floor(Number(qty) || 0));
  const nm = nameHint ? sanitizeTokenField(String(nameHint || '').trim(), 80) : '';
  if (nm) {
    try { invMap._names.set(keyLower, nm); } catch {}
  }
  if (q <= 0) {
    invMap.delete(keyLower);
    try { invMap._names.delete(keyLower); } catch {}
  } else {
    invMap.set(keyLower, q);
  }
}

function invAddQty(invMap, keyLower, nameHint, delta) {
  if (!(invMap instanceof Map)) return;
  const cur = invMap.get(keyLower) ?? 0;
  invSetQty(invMap, keyLower, nameHint, Number(cur) + Number(delta || 0));
}


// --- Additional code-authoritative trackers: stash + equipment ---
// Stash is attached to a specific house asset.
// Canon token format (preferred):
//   stash:<ASSET_ID>:Item=Qty;Other=Qty
// Legacy tolerance:
//   stash:Item=Qty  (treated as assetId="__legacy")
function parseStashByAsset(tokens) {
  const by = new Map(); // assetIdRaw (case preserved) -> Map(itemKey -> { name, qty })

  const findAssetKey = (assetIdRaw) => {
    const want = String(assetIdRaw || "").trim();
    if (!want) return "";
    const low = want.toLowerCase();
    for (const k of by.keys()) {
      if (String(k).toLowerCase() === low) return k;
    }
    return want;
  };

  const ensure = (assetIdRaw) => {
    const key = findAssetKey(assetIdRaw);
    if (!key) return null;
    if (!by.has(key)) by.set(key, new Map());
    return by.get(key);
  };

  for (const t of (tokens || [])) {
    const s = String(t || "").trim();
    const low = s.toLowerCase();
    if (!(low.startsWith("stash:") || low.startsWith("stash="))) continue;

    // split prefix, keep rest verbatim
    const body = s.split(/[:=]/).slice(1).join(":").trim();
    if (!body) continue;

    // Preferred: <assetId>:<items...>
    const mm = body.match(/^([^:|]+)\s*[:|]\s*(.+)$/);
    if (mm) {
      const assetId = String(mm[1] || "").trim();
      const rest = String(mm[2] || "").trim();
      if (!assetId || !rest) continue;
      const amap = ensure(assetId);
      if (!amap) continue;

      const parts = rest
        .replace(/^\[|\]$/g, "")
        .split(/\s*[;|,]+\s*/)
        .map(x => String(x || "").trim())
        .filter(Boolean);

      for (const p of parts) {
        const m = p.match(/^(.+?)\s*=\s*(\d+)$/);
        const nm = String((m ? m[1] : p) || "").trim();
        const qty = m ? (Number(m[2]) || 0) : 1;
        if (!nm) continue;
        const key = nm.toLowerCase();
        const prev = amap.get(key);
        amap.set(key, { name: prev?.name || nm, qty: (prev?.qty || 0) + Math.max(0, Math.floor(qty)) });
      }
      continue;
    }

    // Legacy: Item=Qty
    const m = body.match(/^([^=]+)=(\d+)$/);
    if (!m) continue;
    const nm = String(m[1] || "").trim();
    const qty = Number(m[2]) || 0;
    if (!nm) continue;
    const amap = ensure("__legacy");
    if (!amap) continue;
    const key = nm.toLowerCase();
    const prev = amap.get(key);
    amap.set(key, { name: prev?.name || nm, qty: (prev?.qty || 0) + Math.max(0, Math.floor(qty)) });
  }

  return by;
}

function stashTotalsFromByAsset(byAsset) {
  const totals = new Map(); // itemKey -> qtyTotal
  for (const amap of (byAsset?.values?.() || [])) {
    for (const [k, v] of amap.entries()) {
      const qty = Math.max(0, Math.floor(Number(v?.qty) || 0));
      if (qty <= 0) continue;
      totals.set(k, (totals.get(k) || 0) + qty);
    }
  }
  return totals;
}

function removeStashItemEverywhere(byAsset, itemKeyLower) {
  for (const amap of (byAsset?.values?.() || [])) {
    amap.delete(itemKeyLower);
  }
}

function reduceStashItem(byAsset, itemKeyLower, amount) {
  let remaining = Math.max(0, Math.floor(Number(amount) || 0));
  if (remaining <= 0) return 0;

  // deterministic order
  const assetIds = Array.from(byAsset.keys()).sort((a, b) => String(a).toLowerCase().localeCompare(String(b).toLowerCase()));
  for (const aid of assetIds) {
    const amap = byAsset.get(aid);
    if (!amap) continue;
    const cur = Math.max(0, Math.floor(Number(amap.get(itemKeyLower)?.qty) || 0));
    if (cur <= 0) continue;
    const take = Math.min(remaining, cur);
    const next = cur - take;
    if (next <= 0) amap.delete(itemKeyLower);
    else amap.set(itemKeyLower, { name: amap.get(itemKeyLower)?.name || itemKeyLower, qty: next });
    remaining -= take;
    if (remaining <= 0) break;
  }

  return remaining;
}

function rebuildStashTokens(tokens, stashByAsset) {
  const out = [];
  // Remove any existing stash tokens
  for (const t of (tokens || [])) {
    const s = String(t || "").trim();
    const low = s.toLowerCase();
    if (low.startsWith("stash:") || low.startsWith("stash=")) continue;
    out.push(s);
  }

  const by = stashByAsset instanceof Map ? stashByAsset : new Map();
  for (const [assetIdRaw, amap] of by.entries()) {
    const items = [];
    for (const [k, v] of amap.entries()) {
      const qty = Math.max(0, Math.floor(Number(v?.qty) || 0));
      if (qty <= 0) continue;
      const nm = String(v?.name || k || "").trim() || k;
      items.push({ k, nm, qty });
    }
    if (!items.length) continue;

    items.sort((a, b) => String(a.nm).localeCompare(String(b.nm)));
    const list = items.map(it => `${it.nm}=${it.qty}`).join(";");

    if (String(assetIdRaw) === "__legacy") {
      // legacy storage
      for (const it of items) out.push(`stash:${it.nm}=${it.qty}`);
    } else {
      out.push(`stash:${assetIdRaw}:${list}`);
    }
  }

  return out;
}

// --- Gear context (inventory + equipment + stash) for anti-hallucination choice validation ---
function buildGearContext(tokens, actorName = '') {
  const names = new Set();
  const keywords = new Set();
  const lines = [];

  try {
    const inv = invEnsureNames(parseInvMapFor(tokens, actorName));
    const invItems = [];
    for (const [kLower, qty] of inv.entries()) {
      const q = Math.max(0, Math.floor(Number(qty) || 0));
      if (q <= 0) continue;
      const nm = String(invGetName(inv, String(kLower), String(kLower)) || '').trim() || String(kLower);
      invItems.push({ nm, q });
      const low = nm.toLowerCase();
      if (low) {
        names.add(low);
        const cleaned = low.replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9'\- ]+/g, ' ').replace(/\s+/g, ' ').trim();
        if (cleaned) names.add(cleaned);
        const last = (cleaned || low).split(/\s+/).filter(Boolean).slice(-1)[0];
        if (last) keywords.add(last);
      }
    }
    invItems.sort((a,b) => a.nm.localeCompare(b.nm));
    for (const it of invItems) lines.push(`- ${it.nm} (x${it.q})`);
  } catch {}

  try {
    const eq = parseEqMapFor(tokens, actorName);
    const eqItems = [];
    for (const [slot, item] of eq.entries()) {
      const nm = String(item || '').trim();
      if (!nm) continue;
      eqItems.push({ slot, nm });
      const low = nm.toLowerCase();
      if (low) {
        names.add(low);
        const cleaned = low.replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9'\- ]+/g, ' ').replace(/\s+/g, ' ').trim();
        if (cleaned) names.add(cleaned);
        const last = (cleaned || low).split(/\s+/).filter(Boolean).slice(-1)[0];
        if (last) keywords.add(last);
      }
    }
    eqItems.sort((a,b) => a.slot.localeCompare(b.slot));
    if (eqItems.length) {
      lines.push('EQUIPPED:');
      for (const it of eqItems) lines.push(`- ${it.slot}: ${it.nm}`);
    }
  } catch {}

  try {
    const byAsset = parseStashByAsset(tokens);
    const totals = stashTotalsFromByAsset(byAsset);
    const stashItems = [];
    for (const [kLower, qty] of totals.entries()) {
      const q = Math.max(0, Math.floor(Number(qty) || 0));
      if (q <= 0) continue;
      // Find a display name from first occurrence.
      let nm = String(kLower);
      for (const amap of (byAsset?.values?.() || [])) {
        const v = amap.get(kLower);
        if (v?.name) { nm = String(v.name); break; }
      }
      stashItems.push({ nm, q });
      const low = nm.toLowerCase();
      if (low) {
        names.add(low);
        const cleaned = low.replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9'\- ]+/g, ' ').replace(/\s+/g, ' ').trim();
        if (cleaned) names.add(cleaned);
        const last = (cleaned || low).split(/\s+/).filter(Boolean).slice(-1)[0];
        if (last) keywords.add(last);
      }
    }
    stashItems.sort((a,b) => a.nm.localeCompare(b.nm));
    if (stashItems.length) {
      lines.push('STASH:');
      for (const it of stashItems) lines.push(`- ${it.nm} (x${it.q})`);
    }
  } catch {}

  return { names, keywords, lines };
}

function normalizeChoicesArray(raw) {
  const meta = [];
  const out = [];
  for (const c of (Array.isArray(raw) ? raw : [])) {
    if (typeof c === 'string') {
      const s = String(c || '').trim();
      if (s) out.push(s);
      continue;
    }
    if (c && typeof c === 'object') {
      const label = String(c.label || c.text || '').trim();
      const actor = sanitizeTokenField(String(c.actor || c.character || c.for || '').trim(), 80);
      const rendered = actor && label ? `[${actor}] ${label}` : label;
      if (rendered) out.push(rendered);
      meta.push({ label: rendered || label, actor, requires_items: Array.isArray(c.requires_items) ? c.requires_items : [] });
      continue;
    }
    const s = String(c || '').trim();
    if (s) out.push(s);
  }
  return { out, meta };
}


function parseEqMap(tokens) {
  const out = new Map();
  for (const t of (tokens || [])) {
    const s = String(t || '').trim();
    if (!s) continue;
    const low = s.toLowerCase();

    let body = '';
    if (low.startsWith('eq:') || low.startsWith('eq=')) body = s.split(/[:=]/).slice(1).join(':').trim();
    else if (low.startsWith('equip:') || low.startsWith('equip=')) body = s.split(/[:=]/).slice(1).join(':').trim();
    else if (low.startsWith('equipment:') || low.startsWith('equipment=')) body = s.split(/[:=]/).slice(1).join(':').trim();
    else continue;

    if (!body) continue;

    const parts = body
      .replace(/^\[|\]$/g, '')
      .split(/\s*[;|,]+\s*/)
      .map(x => String(x || '').trim())
      .filter(Boolean);

    for (const p of parts) {
      const m = p.match(/^([^=]+?)\s*=\s*(.+)$/);
      if (!m) continue;
      const slotRaw = String(m[1] || '').trim();
      const itemRaw = String(m[2] || '').trim();
      const slot = sanitizeTokenField(slotRaw, 24).toLowerCase().replace(/[^a-z0-9_-]/g, '');
      const item = sanitizeTokenField(itemRaw, 80);
      if (!slot || !item) continue;
      out.set(slot, item);
    }
  }
  return out;
}

function _eqpTokenMatchesName(tokenStr, name){
  const nm = _pNameKey(name);
  if (!nm) return false;
  const s = String(tokenStr || '').trim();
  const low = s.toLowerCase();
  if (!(low.startsWith('eqp:') || low.startsWith('eqp=') || low.startsWith('equipp:') || low.startsWith('equipp='))) return false;
  const body = s.split(/[:=]/).slice(1).join(':');
  const head = String(body || '').split('|')[0].trim();
  return head && head.toLowerCase() === nm.toLowerCase();
}

function parseEqMapFor(tokens, actorName){
  const nm = _pNameKey(actorName);
  if (!nm) return parseEqMap(tokens);
  let body = '';
  for (const t of (tokens || [])) {
    if (!_eqpTokenMatchesName(t, nm)) continue;
    const s = String(t || '').trim();
    const raw = s.split(/[:=]/).slice(1).join(':');
    body = String(raw || '').split('|').slice(1).join('|').trim();
    break;
  }
  if (!body) return parseEqMap(tokens);
  const out = new Map();
  const parts = body
    .replace(/^\[|\]$/g, '')
    .split(/\s*[;|,]+\s*/)
    .map(x => String(x || '').trim())
    .filter(Boolean);
  for (const p of parts) {
    const m = p.match(/^([^=]+?)\s*=\s*(.+)$/);
    if (!m) continue;
    const slot = sanitizeTokenField(String(m[1] || '').trim(), 24).toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const item = sanitizeTokenField(String(m[2] || '').trim(), 80);
    if (!slot || !item) continue;
    out.set(slot, item);
  }
  return out;
}


function rebuildEqTokens(tokens, eqMap) {
  const out = [];
  for (const t of (tokens || [])) {
    const s = String(t || '').trim();
    const low = s.toLowerCase();
    if (
      low.startsWith('eq:') || low.startsWith('eq=') ||
      low.startsWith('equip:') || low.startsWith('equip=') ||
      low.startsWith('equipment:') || low.startsWith('equipment=')
    ) continue;
    out.push(s);
  }

  const pairs = [];
  for (const [slot, item] of (eqMap instanceof Map ? eqMap.entries() : [])) {
    const sl = sanitizeTokenField(String(slot || '').trim(), 24).toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const it = sanitizeTokenField(String(item || '').trim(), 80);
    if (!sl || !it) continue;
    pairs.push([sl, it]);
  }
  pairs.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  for (const [sl, it] of pairs) out.push(`eq:${sl}=${it}`);

  return out;
}

function rebuildEqTokensFor(tokens, actorName, eqMap){
  const nm = _pNameKey(actorName);
  const out = [];
  for (const t of (tokens || [])) {
    const s = String(t || '').trim();
    if (_eqpTokenMatchesName(s, nm)) continue;
    out.push(s);
  }

  const pairs = [];
  for (const [slot, item] of (eqMap instanceof Map ? eqMap.entries() : [])) {
    const sl = sanitizeTokenField(String(slot || '').trim(), 24).toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const it = sanitizeTokenField(String(item || '').trim(), 80);
    if (!sl || !it) continue;
    pairs.push([sl, it]);
  }
  pairs.sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
  if (nm && pairs.length) {
    const body = pairs.map(([sl,it])=>`${sl}=${it}`).join(';');
    out.push(`eqp:${nm}|${body}`);
  }
  return out;
}


// -------------------- Code-authoritative mechanics ops --------------------
// The rulekeeper may propose ops[], but only the server applies them.

function _toInt(v, fallback = 0) {
  const n = Number.parseInt(String(v ?? '').trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

function _findTokenIndex(tokens, key) {
  const k = String(key || '').toLowerCase();
  for (let i = 0; i < (tokens || []).length; i++) {
    const s = String(tokens[i] || '').trim();
    const low = s.toLowerCase();
    if (low.startsWith(k + ':') || low.startsWith(k + '=')) return i;
  }
  return -1;
}

function _removeTokenFamily(tokens, key) {
  const k = String(key || '').toLowerCase();
  const out = [];
  for (const t of (tokens || [])) {
    const s = String(t || '').trim();
    const low = s.toLowerCase();
    if (low.startsWith(k + ':') || low.startsWith(k + '=')) continue;
    out.push(s);
  }
  return out;
}

function _upsertToken(tokens, key, value) {
  const out = Array.isArray(tokens) ? [...tokens] : [];
  const idx = _findTokenIndex(out, key);
  const v = String(value ?? '').trim();
  const tok = `${key}:${v}`;
  if (idx >= 0) out[idx] = tok;
  else out.push(tok);
  return out;
}

function setLoc(tokens, locRaw) {
  const loc = sanitizeTokenField(locRaw, 80) || 'UNMAPPED';
  let out = _removeTokenFamily(tokens, 'loc');
  out.push(`loc:${loc}`);
  return out;
}


function setRegion(tokens, regionRaw) {
  const region = sanitizeTokenField(regionRaw, 40) || '';
  let out = _removeTokenFamily(tokens, 'region');
  if (region) out.push(`region:${region}`);
  return out;
}

// -------------------- Per-character state (location + position) --------------------
// Token format:
//   pstate:<NAME>|x=0.1234|y=0.5678|loc=Ashgate|region=Eryndor|gid=0|sep=0
function _pNameKey(name){
  return sanitizeTokenField(String(name || '').trim(), 80) || '';
}

function buildPStateToken(name, st = {}){
  const nm = _pNameKey(name);
  if (!nm) return '';
  const x = clamp01(st.x);
  const y = clamp01(st.y);
  const loc = sanitizeTokenField(st.loc || '', 80);
  const region = sanitizeTokenField(st.region || '', 40);
  const gid = Number.isFinite(Number(st.gid)) ? Math.max(0, Math.floor(Number(st.gid))) : 0;
  const sep = st.sep ? 1 : 0;
  const parts = [`x=${x.toFixed(4)}`, `y=${y.toFixed(4)}`];
  if (loc) parts.push(`loc=${loc}`);
  if (region) parts.push(`region=${region}`);
  parts.push(`gid=${gid}`);
  parts.push(`sep=${sep}`);
  return `pstate:${nm}|${parts.join('|')}`;
}

function parsePStateToken(token){
  const s = String(token || '').trim();
  if (!/^pstate:/i.test(s)) return null;
  const body = s.split(':').slice(1).join(':');
  const segs = body.split('|').map(x => String(x || '').trim()).filter(Boolean);
  if (!segs.length) return null;
  const name = sanitizeTokenField(segs[0], 80);
  if (!name) return null;
  const out = { name, x: null, y: null, loc: '', region: '', gid: 0, sep: 0 };
  for (const part of segs.slice(1)) {
    const [kRaw, vRaw] = String(part || '').split('=');
    const k = String(kRaw || '').trim().toLowerCase();
    const v = String(vRaw || '').trim();
    if (!k) continue;
    if (k === 'x') out.x = clamp01(parseFloat(v));
    else if (k === 'y') out.y = clamp01(parseFloat(v));
    else if (k === 'loc') out.loc = sanitizeTokenField(v, 80);
    else if (k === 'region') out.region = sanitizeTokenField(v, 40);
    else if (k === 'gid') out.gid = Math.max(0, Math.floor(Number(v) || 0));
    else if (k === 'sep') out.sep = (String(v).trim() === '1' || String(v).toLowerCase() === 'true') ? 1 : 0;
  }
  if (!Number.isFinite(out.x)) out.x = null;
  if (!Number.isFinite(out.y)) out.y = null;
  return out;
}

function getPStates(tokens){
  const by = new Map();
  for (const t of (tokens || [])) {
    const p = parsePStateToken(t);
    if (!p || !p.name) continue;
    by.set(String(p.name).toLowerCase(), p);
  }
  return by;
}

function upsertPState(tokens, name, patch = {}){
  const nm = _pNameKey(name);
  if (!nm) return Array.isArray(tokens) ? [...tokens] : [];
  const key = nm.toLowerCase();
  const out = [];
  let cur = null;
  for (const t of (tokens || [])) {
    const p = parsePStateToken(t);
    if (p && String(p.name || '').toLowerCase() === key) { cur = p; continue; }
    out.push(String(t || '').trim());
  }
  const base = cur || { name: nm, x: null, y: null, loc: '', region: '', gid: 0, sep: 0 };
  const next = {
    ...base,
    ...patch,
    name: nm,
  };
  // Ensure x/y exist.
  if (!Number.isFinite(Number(next.x)) || !Number.isFinite(Number(next.y))) {
    const g = parseXY(out) || parseXY(tokens) || { x: 0.5, y: 0.5 };
    next.x = clamp01(Number.isFinite(Number(next.x)) ? next.x : g.x);
    next.y = clamp01(Number.isFinite(Number(next.y)) ? next.y : g.y);
  }
  out.push(buildPStateToken(nm, next));
  return out;
}

function extractLocFor(tokens, actorName){
  const nm = _pNameKey(actorName);
  if (nm) {
    const ps = getPStates(tokens).get(nm.toLowerCase());
    const loc = String(ps?.loc || '').trim();
    if (loc) return loc;
  }
  return extractLoc(tokens);
}

function setLocFor(tokens, actorName, locRaw){
  const loc = sanitizeTokenField(locRaw, 80) || 'UNMAPPED';
  let out = Array.isArray(tokens) ? [...tokens] : [];
  // Update per-character pstate
  if (_pNameKey(actorName)) {
    const { region } = inferRegionBiome(loc);
    out = upsertPState(out, actorName, { loc, region });
  }
  // Keep global loc as the active actor's loc (UI focus + back-compat).
  out = setLoc(out, loc);
  return out;
}

function extractXYFor(tokens, actorName){
  const nm = _pNameKey(actorName);
  if (nm) {
    const ps = getPStates(tokens).get(nm.toLowerCase());
    if (ps && Number.isFinite(ps.x) && Number.isFinite(ps.y)) return { x: clamp01(ps.x), y: clamp01(ps.y) };
  }
  return parseXY(tokens);
}

function setXYFor(tokens, actorName, x, y){
  let out = Array.isArray(tokens) ? [...tokens] : [];
  if (_pNameKey(actorName)) out = upsertPState(out, actorName, { x: clamp01(x), y: clamp01(y) });
  // Keep global xy as the active actor's xy (UI focus + back-compat).
  out = setXY(out, x, y);
  return out;
}

function ensurePStatesForRoster(tokens, roster){
  let out = Array.isArray(tokens) ? [...tokens] : [];
  const names = Array.isArray(roster) ? roster.map(n => String(n || '').trim()).filter(Boolean) : [];
  if (!names.length) return out;
  const baseXY = parseXY(out) || { x: 0.5, y: 0.5 };
  const baseLoc = extractLoc(out) || 'UNMAPPED';
  const { region } = inferRegionBiome(baseLoc);
  const have = getPStates(out);
  for (const nm of names) {
    const k = sanitizeTokenField(nm, 80).toLowerCase();
    if (!k) continue;
    if (have.has(k)) continue;
    out = upsertPState(out, nm, { x: baseXY.x, y: baseXY.y, loc: baseLoc, region });
  }
  return out;
}


function repairBaselineTokens(tokens) {
  let out = Array.isArray(tokens) ? [...tokens] : [];
  // Replace deprecated START placeholder.
  const loc = extractLoc(out);
  if (!loc || String(loc).trim().toUpperCase() === 'START') {
    out = setLoc(out, 'UNMAPPED');
  }
  // Ensure continuous map position exists.
  out = ensureXY(out);
  return out;
}

function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function hash32FNV(str) {
  // FNV-1a 32-bit
  const s = String(str || "");
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function makeSeededRng(seedStr) {
  // xorshift32
  let x = hash32FNV(String(seedStr || 'seed')) || 0xA3C59AC3;
  return function rand01() {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    const u = (x >>> 0);
    return (u % 1000000) / 1000000;
  };
}

function pointInPoly(pt, poly) {
  const x = Number(pt?.[0]);
  const y = Number(pt?.[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const p = Array.isArray(poly) ? poly : [];
  if (p.length < 3) return false;
  // Ray casting
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const xi = Number(p[i][0]), yi = Number(p[i][1]);
    const xj = Number(p[j][0]), yj = Number(p[j][1]);
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function isQuietZoneByXY(x, y, regionHint = '') {
  // Quiet zones: mountains polygons OR extreme cold (Frostveil region).
  const reg = String(regionHint || '').toLowerCase();
  if (reg.includes('frostveil') || reg.includes('frost')) return true;
  const pt = [clamp01(x), clamp01(y)];
  for (const m of (CANON_MAP_MOUNTAINS || [])) {
    if (pointInPoly(pt, m.polygon)) return true;
  }
  return false;
}

function randomSpawnXY() {
  // Uniform random spawn over the continuous map (0..1, 0..1).
  // Used ONLY for fresh runs; persisted saves keep their position.
  return { x: Math.random(), y: Math.random() };
}

function pickStartFromCanonMap(roomId, runId = 0) {
  // Seeded start by kingdom(region) then settlement. Never ocean.
  // If canon coords are missing, fall back to uniform.
  const list = Array.isArray(CANON_MAP_SETTLEMENTS) ? CANON_MAP_SETTLEMENTS : [];
  if (!list.length) {
    const sp = randomSpawnXY();
    return { x: sp.x, y: sp.y, loc: 'UNMAPPED', kingdom_id: '' };
  }

  const rng = makeSeededRng(`${String(roomId || 'room')}|${Number(runId || 0)}|start_v1`);

  const kingdoms = new Map();
  for (const s of list) {
    const k = String(s.kingdom_id || '').trim() || 'unknown';
    if (!kingdoms.has(k)) kingdoms.set(k, []);
    kingdoms.get(k).push(s);
  }
  const ks = Array.from(kingdoms.keys()).filter(Boolean);
  const kIdx = Math.floor(rng() * ks.length);
  const kid = ks[Math.max(0, Math.min(ks.length - 1, kIdx))];
  const pool = kingdoms.get(kid) || list;
  const sIdx = Math.floor(rng() * pool.length);
  const sel = pool[Math.max(0, Math.min(pool.length - 1, sIdx))] || list[0];

  return {
    x: clamp01(sel.x),
    y: clamp01(sel.y),
    loc: sanitizeTokenField(sel.name, 80) || 'UNMAPPED',
    kingdom_id: sanitizeTokenField(sel.kingdom_id, 40) || ''
  };
}

function pickStartCandidatesFromCanonMap(roomId, runId = 0, k = 18) {
  const list = Array.isArray(CANON_MAP_SETTLEMENTS) ? CANON_MAP_SETTLEMENTS : [];
  if (!list.length) return [];
  const rng = makeSeededRng(`${String(roomId || 'room')}|${Number(runId || 0)}|start_candidates_v1`);
  const picks = [];
  const used = new Set();
  const want = Math.max(6, Math.min(30, Math.floor(Number(k) || 18)));
  for (let i = 0; i < list.length && picks.length < want; i++) {
    const idx = Math.floor(rng() * list.length);
    const sel = list[Math.max(0, Math.min(list.length - 1, idx))];
    if (!sel || !sel.name) continue;
    const id = Number(sel.id) || 0;
    const key = `${id}:${String(sel.name).toLowerCase()}`;
    if (used.has(key)) continue;
    used.add(key);
    picks.push({
      id,
      name: sanitizeTokenField(sel.name, 80) || 'UNMAPPED',
      kingdom_id: sanitizeTokenField(sel.kingdom_id, 40) || '',
      x: clamp01(sel.x),
      y: clamp01(sel.y)
    });
  }
  return picks;
}

async function aiChooseStartLocation(roomId, candidates = []) {
  const list = Array.isArray(candidates) ? candidates.filter(c => c && c.name && Number.isFinite(c.x) && Number.isFinite(c.y)) : [];
  if (!list.length) return null;

  const system =
`You are AETHERYN_START_LOCATOR.
Pick ONE starting location from the provided candidates.

Rules:
- Output ONLY strict JSON.
- Choose exactly one of the candidate IDs.
- Do not add any text.
`;

  const user =
`CANDIDATES (id | name | region):
${list.map(c => `${c.id} | ${c.name} | ${c.kingdom_id || 'unknown'}`).join('\n')}

Return JSON like: {"pick_id": 123}
`;

  let raw = '';
  try {
    raw = await callLLMRole('narrator', {
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: Number(process.env.START_LOC_TEMPERATURE || 0.6),
      maxTokens: 80,
      ollamaOptions: {
        num_ctx: Number(process.env.OLLAMA_NUM_CTX_NARRATOR || process.env.OLLAMA_NUM_CTX || 4096),
        repeat_last_n: Number(process.env.OLLAMA_REPEAT_LAST_N || 256),
        repeat_penalty: Number(process.env.OLLAMA_REPEAT_PENALTY || 1.15),
        top_k: Number(process.env.OLLAMA_TOP_K || 40),
        top_p: Number(process.env.OLLAMA_TOP_P || 0.9),
      }
    });
  } catch {
    raw = '';
  }

  let pickId = null;
  try {
    const parsed = JSON.parse(String(raw || '').trim());
    pickId = Number(parsed?.pick_id);
  } catch {
    const recovered = extractFirstJsonObject(String(raw || '').trim());
    pickId = Number(recovered?.pick_id);
  }

  const chosen = list.find(c => Number(c.id) === Number(pickId)) || list[0];
  return chosen || null;
}

function setXYRandom(tokens) {
  const sp = randomSpawnXY();
  return setXY(tokens, sp.x, sp.y);
}


function parseXY(tokens) {
  const idx = _findTokenIndex(tokens, "xy");
  if (idx < 0) return null;
  const raw = String((tokens || [])[idx] || "");
  const s = raw.includes(":") ? raw.split(":", 2)[1] : (raw.includes("=") ? raw.split("=", 2)[1] : "");
  const parts = String(s || "").split(",").map(x => x.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const x = clamp01(parseFloat(parts[0]));
  const y = clamp01(parseFloat(parts[1]));
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function setXY(tokens, x, y) {
  const xx = clamp01(x);
  const yy = clamp01(y);
  let out = _removeTokenFamily(tokens, "xy");
  out.push(`xy:${xx.toFixed(4)},${yy.toFixed(4)}`);
  return out;
}

function ensureXY(tokens) {
  let out = Array.isArray(tokens) ? [...tokens] : [];
  const cur = parseXY(out);
  if (!cur) out = setXY(out, 0.5, 0.5);
  return out;
}

function mapDistanceMilesServer(from, to, mapWidthMiles) {
  const f = from || { x: 0.5, y: 0.5 };
  const t = to || { x: 0.5, y: 0.5 };
  const w = Number(mapWidthMiles || MAP_WIDTH_MILES_DEFAULT || 3000);
  const dx = (t.x - f.x) * w;
  const dy = (t.y - f.y) * w * CANON_MAP_ASPECT_HW;
  const d = Math.hypot(dx, dy);
  return Number.isFinite(d) ? d : 0;
}

function mapDistanceFeetServer(from, to, mapWidthMiles){
  return mapDistanceMilesServer(from, to, mapWidthMiles) * 5280;
}

function recomputePartyGroups(tokens, roster){
  const names = Array.isArray(roster) ? roster.map(n => String(n || '').trim()).filter(Boolean) : [];
  if (names.length <= 1) return Array.isArray(tokens) ? [...tokens] : [];

  const outTokens = Array.isArray(tokens) ? [...tokens] : [];
  const states = getPStates(outTokens);
  // Ensure missing pstate exists.
  let t0 = ensurePStatesForRoster(outTokens, names);
  const stMap = getPStates(t0);

  const idxBy = new Map();
  names.forEach((n, i) => idxBy.set(sanitizeTokenField(n,80).toLowerCase(), i));

  const parent = new Array(names.length).fill(0).map((_,i)=>i);
  const find = (a)=>{ while(parent[a]!==a){ parent[a]=parent[parent[a]]; a=parent[a]; } return a; };
  const union = (a,b)=>{ const ra=find(a), rb=find(b); if(ra!==rb) parent[rb]=ra; };

  // Determine adjacency based on separation thresholds.
  for (let i=0;i<names.length;i++){
    for (let j=i+1;j<names.length;j++){
      const ni = names[i], nj = names[j];
      const ki = sanitizeTokenField(ni,80).toLowerCase();
      const kj = sanitizeTokenField(nj,80).toLowerCase();
      const si = stMap.get(ki); const sj = stMap.get(kj);
      if (!si || !sj) continue;
      const diFeet = mapDistanceFeetServer({x:si.x,y:si.y},{x:sj.x,y:sj.y}, MAP_WIDTH_MILES_DEFAULT);
      const quiet = isQuietZoneByXY(si.x, si.y, si.region) || isQuietZoneByXY(sj.x, sj.y, sj.region);
      const thresh = quiet ? 700 : 550;
      if (diFeet <= thresh) union(i,j);
    }
  }

  // Map roots -> compact group ids.
  const rootToG = new Map();
  let nextG = 0;
  const groups = new Map();
  for (let i=0;i<names.length;i++){
    const r = find(i);
    if (!rootToG.has(r)) rootToG.set(r, nextG++);
    const gid = rootToG.get(r);
    if (!groups.has(gid)) groups.set(gid, []);
    groups.get(gid).push(names[i]);
  }

  // Determine "main" group as the largest (stable display).
  let mainG = 0;
  let best = -1;
  for (const [gid, arr] of groups.entries()) {
    const sz = arr.length;
    if (sz > best) { best = sz; mainG = gid; }
  }
  if (best <= 0) mainG = 0;

  let out = t0;
  for (let i=0;i<names.length;i++){
    const nm = names[i];
    const gid = rootToG.get(find(i)) || 0;
    const sep = (groups.size > 1 && gid !== mainG) ? 1 : 0;
    out = upsertPState(out, nm, { gid, sep });
  }

  return out;
}

// -------------------- Observable actions ledger (for realism turn handoff) --------------------
// Purpose: when a player's turn begins, they should see what nearby teammates did since their last turn.
// This is NOT POV prose; it is a short list of observable actions.
// Stored on room state:
//   st._obs = [{id,ts,actor,action,outcome,x,y,region}]
//   st._obsSeq = number
//   st._obsSeen = { [actorKey]: lastSeenId }
//   st._turnDigestCache = { [actorKey]: { text, maxId, ts } }

function _obsKey(name){
  return sanitizeTokenField(String(name || '').trim(), 80).toLowerCase();
}

function _ensureObsState(st){
  if (!st || typeof st !== 'object') return;
  if (!Array.isArray(st._obs)) st._obs = [];
  if (!Number.isFinite(Number(st._obsSeq))) st._obsSeq = 0;
  if (!st._obsSeen || typeof st._obsSeen !== 'object') st._obsSeen = {};
  if (!st._turnDigestCache || typeof st._turnDigestCache !== 'object') st._turnDigestCache = {};
  // Per-player/per-character intro delivery ("each player writes their own book").
  // These are presentation flags only; they do not affect canon.
  if (!st._introSeen || typeof st._introSeen !== 'object') st._introSeen = {};
  if (!st._introSeenChar || typeof st._introSeenChar !== 'object') st._introSeenChar = {};
}

function _sanitizeObsAction(text){
  let s = String(text || '').trim();
  if (!s) return '';
  // Ignore the "Return to the scene" helper choice; it's not an observable action.
  if (/^return\s+to\s+the\s+scene\b/i.test(s)) return '';
  // Trim explicit Freeform prefix for readability.
  s = s.replace(/^freeform\s*:\s*/i, '');
  // Keep it short.
  if (s.length > 180) s = s.slice(0, 177) + '...';
  return s;
}

function _safeOutcomeSnippet(beat){
  let s = String(beat || '').trim();
  if (!s) return '';
  // If it looks like tokens / bookkeeping, don't leak it.
  if (/[=:]/.test(s)) return '';
  const low = s.toLowerCase();
  const banned = ['inv', 'inventory', 'res', 'coin', 'aurum', 'hp', 'mp', 'stamina', 'asset', 'army', 'spell', 'unlocked', 'gained', 'lost', 'purchased', 'bought'];
  if (banned.some(w => low.includes(w))) return '';
  // First sentence only.
  s = s.split(/(?<=[.!?])\s+/)[0] || s;
  if (s.length > 140) s = s.slice(0, 137) + '...';
  return s;
}

function recordObservableAction(roomId, { actorName, actionText, beatSummary } = {}){
  const rid = String(roomId || '').trim();
  if (!rid) return;
  const st = getRoomState(rid);
  _ensureObsState(st);
  const actor = sanitizeTokenField(String(actorName || '').trim(), 80);
  if (!actor) return 0;
  let delivered = 0;
  const action = _sanitizeObsAction(actionText);
  if (!action) return;

  const tokens = Array.isArray(st?.canon?.tokens) ? st.canon.tokens : [];
  const xy = extractXYFor(tokens, actor) || parseXY(tokens) || { x: 0.5, y: 0.5 };
  const ps = getPStates(tokens).get(_obsKey(actor));
  const region = sanitizeTokenField(String(ps?.region || ''), 40);

  st._obsSeq = Math.max(0, Math.floor(Number(st._obsSeq) || 0)) + 1;
  const evt = {
    id: st._obsSeq,
    ts: Date.now(),
    actor,
    action,
    outcome: _safeOutcomeSnippet(beatSummary),
    x: clamp01(xy.x),
    y: clamp01(xy.y),
    region
  };
  st._obs.push(evt);
  // Keep it bounded.
  if (st._obs.length > 600) st._obs = st._obs.slice(-500);
}

function buildNearbyDigest(roomId, actorName){
  const rid = String(roomId || '').trim();
  const actor = sanitizeTokenField(String(actorName || '').trim(), 80);
  if (!rid || !actor) return { items: [], maxId: 0, lines: [] };
  const st = getRoomState(rid);
  _ensureObsState(st);
  const key = _obsKey(actor);
  const sinceId = Math.max(0, Math.floor(Number(st._obsSeen?.[key]) || 0));

  const tokens = Array.isArray(st?.canon?.tokens) ? st.canon.tokens : [];
  const axy = extractXYFor(tokens, actor) || parseXY(tokens) || { x: 0.5, y: 0.5 };
  const aps = getPStates(tokens).get(key);
  const aRegion = String(aps?.region || '').trim();

  const outLines = [];
  const items = [];
  let maxId = sinceId;

  const events = Array.isArray(st._obs) ? st._obs : [];
  for (const e of events) {
    if (!e || !Number.isFinite(Number(e.id))) continue;
    const id = Math.floor(Number(e.id));
    if (id <= sinceId) continue;
    maxId = Math.max(maxId, id);
    const who = sanitizeTokenField(String(e.actor || '').trim(), 80);
    if (!who) continue;
    if (_obsKey(who) === key) continue; // don't echo your own actions

    const distFeet = mapDistanceFeetServer({ x: axy.x, y: axy.y }, { x: clamp01(e.x), y: clamp01(e.y) }, MAP_WIDTH_MILES_DEFAULT);
    const quiet = isQuietZoneByXY(axy.x, axy.y, aRegion) || isQuietZoneByXY(clamp01(e.x), clamp01(e.y), String(e.region || ''));
    const thresh = quiet ? 700 : 550;
    if (!(distFeet <= thresh)) continue;

    const near = distFeet <= 100;
    const outcome = e.outcome ? String(e.outcome).trim() : '';
    const act = String(e.action || '').trim();
    if (!act) continue;
    // Human-readable line (debug / optional UI).
    const prefix = near ? '' : 'Some distance away, ';
    const line = `${prefix}${who} ${act}${outcome ? ` (${outcome})` : ''}`;
    outLines.push(line);
    items.push({ who, action: act, outcome, dist_feet: Math.round(distFeet), near: !!near, quiet: !!quiet, region: String(e.region || '').trim() });
    if (outLines.length >= 8) break;
  }

  if (!outLines.length) return { items: [], maxId: sinceId, lines: [] };
  return { items, maxId, lines: outLines };
}

function parseClock(tokens) {
  const idx = _findTokenIndex(tokens, 'clock');
  if (idx < 0) return null;
  const raw = String(tokens[idx] || '').split(/[:=]/).slice(1).join(':').trim();
  const m = raw.match(/^(\d{1,2})\s*:\s*(\d{1,2})$/);
  if (!m) return null;
  const hh = Math.max(0, Math.min(23, _toInt(m[1], 0)));
  const mm = Math.max(0, Math.min(59, _toInt(m[2], 0)));
  return { hh, mm };
}

function parseDay(tokens) {
  const idx = _findTokenIndex(tokens, 'day');
  if (idx < 0) return null;
  const raw = String(tokens[idx] || '').split(/[:=]/).slice(1).join(':').trim();
  const n = _toInt(raw, NaN);
  return Number.isFinite(n) ? Math.max(1, n) : null;
}

function setClock(tokens, hh, mm) {
  const H = Math.max(0, Math.min(23, _toInt(hh, 0)));
  const M = Math.max(0, Math.min(59, _toInt(mm, 0)));
  const val = `${String(H).padStart(2, '0')}:${String(M).padStart(2, '0')}`;
  let out = _removeTokenFamily(tokens, 'clock');
  out.push(`clock:${val}`);
  return out;
}

function setDay(tokens, day) {
  const d = Math.max(1, _toInt(day, 1));
  let out = _removeTokenFamily(tokens, 'day');
  out.push(`day:${d}`);
  return out;
}

function ensureTime(tokens) {
  let out = Array.isArray(tokens) ? [...tokens] : [];
  const d = parseDay(out);
  const c = parseClock(out);
  if (!d) out = setDay(out, 1);
  if (!c) out = setClock(out, 8, 0);
  return out;
}

function advanceTime(tokens, minutes) {
  let out = ensureTime(tokens);
  const c = parseClock(out) || { hh: 8, mm: 0 };
  const d = parseDay(out) || 1;
  const add = Math.max(0, Math.floor(Number(minutes) || 0));
  if (!add) return out;
  const total = c.hh * 60 + c.mm + add;
  const dayInc = Math.floor(total / 1440);
  const rem = total % 1440;
  const hh = Math.floor(rem / 60);
  const mm = rem % 60;
  out = setClock(out, hh, mm);
  if (dayInc) out = setDay(out, d + dayInc);
  return out;
}

// -------------------- World Clock (calendar + season + weather) --------------------
// Canonical calendar (simple, deterministic, code-authoritative).
// We store only day + clock as the primary truth; year/season/weather are derived and upserted for UI.
// Year length is intentionally simple (360 days) for stable seasons and easy math.
const CAL_YEAR_DAYS = 360;
const CAL_SEASON_DAYS = 90;
const CAL_MONTH_DAYS = 30;
const SEASON_NAMES = ["Winter", "Spring", "Summer", "Autumn"];


function worldMinutesFromTokens(tokens) {
  const d = parseDay(tokens) || 1;
  const c = parseClock(tokens) || { hh: 8, mm: 0 };
  return (d - 1) * 1440 + (c.hh * 60 + c.mm);
}

function computeCalendarFromDay(day) {
  const d = Math.max(1, Math.floor(Number(day) || 1));
  const doy0 = (d - 1) % CAL_YEAR_DAYS;
  const year = 1 + Math.floor((doy0 + (d - 1 - doy0)) / CAL_YEAR_DAYS);
  const doy = 1 + doy0;

  const seasonIdx = Math.floor((doy0) / CAL_SEASON_DAYS) % 4;
  const season = SEASON_NAMES[seasonIdx] || "Spring";

  const month = 1 + Math.floor(doy0 / CAL_MONTH_DAYS);
  const dom = 1 + (doy0 % CAL_MONTH_DAYS);

  // A small flavor tag for UI ("Early/Mid/Late").
  const partIdx = Math.floor((doy0 % CAL_SEASON_DAYS) / (CAL_SEASON_DAYS / 3));
  const part = ["Early", "Mid", "Late"][clampInt(partIdx, 0, 2)] || "Mid";

  return { year, doy, season, seasonIdx, month, dom, part };
}

function normPlaceKey(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Region/biome inference is intentionally conservative:
// - It never changes the atlas.
// - It's used only for weather bias + future travel rules.
// - Unknown places default to the current region token (if present), else Eryndor (heartland baseline).
const REGION_BY_PLACE = (() => {
  const m = new Map();

  // Regions (broad)
  for (const x of ["frostveil", "northern expanse", "glacerwall range", "glacierwall range"]) m.set(x, "Frostveil");
  for (const x of ["ebonreach", "the shadowlands"]) m.set(x, "Ebonreach");
  for (const x of ["eryndor", "the heartlands"]) m.set(x, "Eryndor");
  for (const x of ["verdantis", "wildwood east", "verdant bay"]) m.set(x, "Verdantis");
  for (const x of ["emberlands", "eastern highlands", "amberdeep", "sulur gulf"]) m.set(x, "Emberlands");
  for (const x of ["cindralith"]) m.set(x, "Cindralith");

  // Named places seen on the canon map (non-exhaustive; safe to extend without changing the atlas)
  // Frostveil
  for (const x of ["icewatch hold", "ashwind pass"]) m.set(x, "Frostveil");

  // Ebonreach
  for (const x of ["hollow grave", "soulmarsh", "wraithwater delta", "dusken coast"]) m.set(x, "Ebonreach");

  // Eryndor
  for (const x of ["valemarch", "goldenroad", "oldenmoor", "tharwick", "whisper hills", "highfields", "grapevine forest", "sunfall lakes"]) m.set(x, "Eryndor");

  // Verdantis
  for (const x of ["greencoast", "heartwood spire", "glimmering glades", "silverlow river", "green coast"]) m.set(x, "Verdantis");

  // Emberlands
  for (const x of ["amberdeep"]) m.set(x, "Emberlands");

  // Cindralith
  for (const x of ["lachurn", "whitewater echoes", "ruins of stormhold", "stormhold"]) m.set(x, "Cindralith");

  return m;
})();

function inferRegionBiome(tokensOrLoc) {
  const loc = Array.isArray(tokensOrLoc) ? extractLoc(tokensOrLoc) : String(tokensOrLoc || '').trim();
  const key = normPlaceKey(loc);
  const fallbackRegion = Array.isArray(tokensOrLoc) ? (String(getTokenValue(tokensOrLoc, 'region') || '').trim() || '') : '';
  let region = REGION_BY_PLACE.get(key) || REGION_BY_PLACE.get(normPlaceKey(key.split(' ').slice(0, 2).join(' '))) || '';
  if (!region && key === 'wilderness') region = fallbackRegion || 'Eryndor';
  if (!region) region = fallbackRegion || 'Eryndor';

  let biome = "temperate";
  const r = region.toLowerCase();
  if (r.includes("frost")) biome = "tundra";
  else if (r.includes("ebon")) biome = "marsh";
  else if (r.includes("verd")) biome = "forest";
  else if (r.includes("ember")) biome = "desert";
  else if (r.includes("cind")) biome = "coast";
  else biome = "plains";

  return { region, biome };
}

// Simple deterministic hash (FNV-1a 32-bit) to keep weather stable across reloads/saves.
function hash32(str) {
  const s = String(str || "");
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function pickWeighted(r01, weighted) {
  const items = Array.isArray(weighted) ? weighted : [];
  const total = items.reduce((a, b) => a + (Number(b?.w) || 0), 0);
  if (total <= 0) return items[0]?.v || "Clear";
  let x = r01 * total;
  for (const it of items) {
    const w = Number(it?.w) || 0;
    if (w <= 0) continue;
    if (x < w) return it.v;
    x -= w;
  }
  return items[items.length - 1]?.v || "Clear";
}

function generateWeather({ roomId, day, season, region, biome }) {
  const rid = String(roomId || "room");
  const d = Math.max(1, Math.floor(Number(day) || 1));
  const reg = String(region || "Eryndor");
  const bio = String(biome || "plains");
  const sea = String(season || "Spring");

  const h = hash32(`${rid}|${d}|${reg}|${bio}|${sea}|wx`);
  const r01 = (h % 10000) / 10000;

  const s = sea.toLowerCase();
  const b = bio.toLowerCase();

  // Bias tables (low-noise, high meaning).
  // These are intentionally small vocab so the UI stays readable.
  let table = [
    { v: "Clear", w: 40 },
    { v: "Overcast", w: 25 },
    { v: "Rain", w: 20 },
    { v: "Storm", w: 15 },
  ];

  if (b === "tundra") {
    table = [
      { v: "Clear", w: s === "winter" ? 15 : 35 },
      { v: "Overcast", w: 25 },
      { v: "Snow", w: s === "winter" ? 40 : 15 },
      { v: "Blizzard", w: s === "winter" ? 20 : 5 },
      { v: "Storm", w: 5 },
    ];
  } else if (b === "marsh") {
    table = [
      { v: "Fog", w: 25 },
      { v: "Overcast", w: 25 },
      { v: "Rain", w: 30 },
      { v: "Storm", w: 15 },
      { v: "Clear", w: 5 },
    ];
  } else if (b === "forest") {
    table = [
      { v: "Clear", w: 30 },
      { v: "Overcast", w: 25 },
      { v: "Rain", w: 25 },
      { v: "Storm", w: 15 },
      { v: "Fog", w: 5 },
    ];
  } else if (b === "desert") {
    table = [
      { v: "Clear", w: 55 },
      { v: "Heat Haze", w: s === "summer" ? 30 : 15 },
      { v: "Duststorm", w: 15 },
      { v: "Overcast", w: 5 },
    ];
  } else if (b === "coast") {
    table = [
      { v: "Clear", w: 30 },
      { v: "Overcast", w: 25 },
      { v: "Rain", w: 25 },
      { v: "Storm", w: 15 },
      { v: "Fog", w: 5 },
    ];
  } else {
    // plains / temperate
    table = [
      { v: "Clear", w: 35 },
      { v: "Overcast", w: 25 },
      { v: "Rain", w: 25 },
      { v: "Storm", w: 10 },
      { v: "Fog", w: 5 },
    ];
    if (s === "winter") {
      table = [
        { v: "Clear", w: 25 },
        { v: "Overcast", w: 30 },
        { v: "Snow", w: 25 },
        { v: "Storm", w: 10 },
        { v: "Fog", w: 10 },
      ];
    }
  }

  return pickWeighted(r01, table);
}

function ensureWorldClock(tokens, roomId) {
  let out = ensureTime(tokens);

  const day = parseDay(out) || 1;
  const cal = computeCalendarFromDay(day);

  out = _upsertToken(out, "year", String(cal.year));
  out = _upsertToken(out, "doy", String(cal.doy));
  out = _upsertToken(out, "season", `${cal.part} ${cal.season}`);

  const loc = extractLoc(out);
  const { region, biome } = inferRegionBiome(out);
  out = _upsertToken(out, "region", region);

  const wx = String(getTokenValue(out, "weather") || "").trim();
  const wxDay = clampInt(getTokenValue(out, "wxday"), 0, 9999999);
  const wxReg = String(getTokenValue(out, "wxreg") || "").trim();

  if (!wx || wxDay !== day || wxReg !== region) {
    const seasonKey = String(cal.season || "Spring");
    const nextWx = generateWeather({ roomId, day, season: seasonKey, region, biome });
    out = _upsertToken(out, "weather", nextWx);
    out = _upsertToken(out, "wxday", String(day));
    out = _upsertToken(out, "wxreg", region);
  }

  return out;
}

function formatTimeDelta(minutes) {
  const m = Math.max(0, Math.floor(Number(minutes) || 0));
  const days = Math.floor(m / 1440);
  const rem = m % 1440;
  const hh = Math.floor(rem / 60);
  const mm = rem % 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hh) parts.push(`${hh}h`);
  if (mm || !parts.length) parts.push(`${mm}m`);
  return parts.join(" ");
}

function emitTimeNotice(roomId, { beforeTokens, afterTokens, minutes, reason }) {
  try {
    const mode = String(getTokenValue(afterTokens, "mode") || "").trim().toUpperCase();
    if (mode && mode !== "PLAY") return;

    const add = Math.max(0, Math.floor(Number(minutes) || 0));
    if (!add) return;

    const beforeMin = worldMinutesFromTokens(beforeTokens);
    const afterMin = worldMinutesFromTokens(afterTokens);
    const dayChanged = Math.floor(afterMin / 1440) !== Math.floor(beforeMin / 1440);

    // Low-noise: only announce if >= 60 minutes OR the day flips.
    if (!dayChanged && add < 60) return;

    const day = parseDay(afterTokens) || 1;
    const clock = String(getTokenValue(afterTokens, "clock") || "").trim() || "—";
    const season = String(getTokenValue(afterTokens, "season") || "").trim();
    const weather = String(getTokenValue(afterTokens, "weather") || "").trim();

    const why = String(reason || "").trim();
    const suffix = [season, weather].filter(Boolean).join(" • ");
    const msg = `Time passes: +${formatTimeDelta(add)}${why ? ` (${why})` : ""} → Day ${day} ${clock}${suffix ? ` • ${suffix}` : ""}`;
    io.to(roomId).emit("system", msg);
  } catch {}
}

// -------------------- Communication delays (mail/rumor queue) --------------------
function ensureDeliveries(st) {
  if (!st) return;
  if (!Array.isArray(st.deliveries)) st.deliveries = [];
}

function scheduleDelivery(roomId, payload = {}) {
  const st = getRoomState(roomId);
  ensureDeliveries(st);

  const kind = String(payload?.kind || payload?.type || "news").trim().slice(0, 20) || "news";
  const text = String(payload?.text || payload?.message || "").trim().slice(0, 800);
  if (!text) return null;

  const delayDays = Number(payload?.delay_days);
  const delayHours = Number(payload?.delay_hours);
  const delayMinutes = Number(payload?.delay_minutes);

  let mins = 0;
  if (Number.isFinite(delayMinutes)) mins = Math.max(mins, Math.floor(delayMinutes));
  if (Number.isFinite(delayHours)) mins = Math.max(mins, Math.floor(delayHours * 60));
  if (Number.isFinite(delayDays)) mins = Math.max(mins, Math.floor(delayDays * 1440));
  if (!mins) mins = 1440; // default: 1 day

  // Hard bounds: keep it sane.
  mins = clampInt(mins, 60, 60 * 24 * 60); // 1h .. 60 days

  const nowMin = worldMinutesFromTokens(st.canon.tokens);
  const deliverAt = nowMin + mins;

  const id = `D${String(Date.now())}${Math.floor(Math.random() * 1e6)}`;
  const item = {
    id,
    kind,
    text,
    created_at: new Date().toISOString(),
    deliver_at_min: deliverAt,
    // Optional metadata
    from: String(payload?.from || "").trim().slice(0, 80) || null,
  };

  st.deliveries.push(item);
  if (st.deliveries.length > 200) st.deliveries = st.deliveries.slice(-200);
  try { saveRoomStateFile(roomId); } catch {}
  return item;
}

function processDeliveriesDue(roomId, tokens) {
  const st = getRoomState(roomId);
  ensureDeliveries(st);

  const nowMin = worldMinutesFromTokens(tokens);
  const due = [];
  const keep = [];

  for (const d of st.deliveries) {
    const at = Number(d?.deliver_at_min);
    if (Number.isFinite(at) && at <= nowMin) due.push(d);
    else keep.push(d);
  }

  st.deliveries = keep;
  if (due.length) {
    try { saveRoomStateFile(roomId); } catch {}
  }

  return due;
}

function deliverDueMessages(roomId, tokens) {
  const due = processDeliveriesDue(roomId, tokens);
  if (!due.length) return;

  for (const d of due) {
    const kind = String(d?.kind || "news").trim().toUpperCase();
    const text = String(d?.text || "").trim();
    if (!text) continue;

    // Single low-noise system line + a book entry.
    try { io.to(roomId).emit("system", `[${kind}] ${text}`); } catch {}
    // Book stays book: system deliveries are not written into the Book transcript.
  }
}

function advanceTimeWorld(roomId, tokens, minutes, reason = "") {
  const before = ensureWorldClock(tokens, roomId);
  const add = Math.max(0, Math.floor(Number(minutes) || 0));
  if (!add) return before;
  let after = advanceTime(before, add);
  after = ensureWorldClock(after, roomId);

  emitTimeNotice(roomId, { beforeTokens: before, afterTokens: after, minutes: add, reason });
  // Deliver queued messages if time advanced past their deadlines.
  deliverDueMessages(roomId, after);

  return after;
}


function parsePartyToken(s) {
  // Formats (all optional after name):
  //  - party:Name
  //  - party:Name/<hpCur>[/<hpMax>[/<status...>]]
  //  - party:Name/<hpCur>/<hpMax>/<mpCur>/<mpMax>/<stCur>/<stMax>[/<status...>]
  // Back-compat: party:Name/<hpCur>/<status...>  (if 3rd segment is non-numeric)
  const raw = String(s || '').trim();
  const low = raw.toLowerCase();
  if (!(low.startsWith('party:') || low.startsWith('party='))) return null;

  const body = raw.split(/[:=]/).slice(1).join(':').trim();
  const parts = body.split('/').map(x => String(x || '').trim());
  if (!parts.length) return null;

  const name = parts[0] || '';

  const nOrNaN = (v) => {
    const n = _toInt(v, NaN);
    return Number.isFinite(n) ? n : NaN;
  };

  let i = 1;
  const hpCur = parts.length > i ? nOrNaN(parts[i++]) : NaN;

  // If the next segment is non-numeric, treat it as a status-only party token.
  if (!Number.isFinite(hpCur)) {
    const status = parts.slice(1).join('/') || '';
    return { name, hpCur: NaN, hpMax: NaN, mpCur: NaN, mpMax: NaN, stCur: NaN, stMax: NaN, status };
  }

  let hpMax = NaN;
  let mpCur = NaN, mpMax = NaN;
  let stCur = NaN, stMax = NaN;
  let status = '';

  if (parts.length > i) {
    const maybe = nOrNaN(parts[i]);
    if (Number.isFinite(maybe)) {
      hpMax = maybe; i++;

      // Extended fields (only if they look numeric)
      if (parts.length > i && Number.isFinite(nOrNaN(parts[i]))) { mpCur = nOrNaN(parts[i]); i++; }
      if (parts.length > i && Number.isFinite(nOrNaN(parts[i]))) { mpMax = nOrNaN(parts[i]); i++; }
      if (parts.length > i && Number.isFinite(nOrNaN(parts[i]))) { stCur = nOrNaN(parts[i]); i++; }
      if (parts.length > i && Number.isFinite(nOrNaN(parts[i]))) { stMax = nOrNaN(parts[i]); i++; }

      status = parts.slice(i).join('/') || '';
    } else {
      // party:Name/hpCur/<status...>
      status = parts.slice(i).join('/') || '';
    }
  }

  return { name, hpCur, hpMax, mpCur, mpMax, stCur, stMax, status };
}

function rebuildPartyToken(name, hpCur, hpMax, status, mpCur, mpMax, stCur, stMax) {
  const nm = sanitizeTokenField(name, 80) || 'Unknown';

  const cur = Number.isFinite(hpCur) ? Math.max(0, Math.floor(hpCur)) : null;
  const max = Number.isFinite(hpMax) ? Math.max(0, Math.floor(hpMax)) : null;

  const mcur = Number.isFinite(mpCur) ? Math.max(0, Math.floor(mpCur)) : null;
  const mmax = Number.isFinite(mpMax) ? Math.max(0, Math.floor(mpMax)) : null;

  const scur = Number.isFinite(stCur) ? Math.max(0, Math.floor(stCur)) : null;
  const smax = Number.isFinite(stMax) ? Math.max(0, Math.floor(stMax)) : null;

  const st = sanitizeTokenField(status, 120);

  // Build segments conservatively to preserve back-compat.
  const segs = [nm];

  // No numeric hp: keep classic "party:Name[/Status]"
  if (cur == null) {
    if (st) segs.push(st);
    return `party:${segs.join('/')}`;
  }

  // hpCur present
  segs.push(String(cur));

  // hpMax absent: "party:Name/hpCur[/Status]"
  if (max == null) {
    if (st) segs.push(st);
    return `party:${segs.join('/')}`;
  }

  // hpCur + hpMax present
  segs.push(String(max));

  // If any of mp/st is present, emit the extended block (fill missing with 0).
  const haveAnyExtra = (mcur != null || mmax != null || scur != null || smax != null);
  if (haveAnyExtra) {
    segs.push(String(mcur ?? 0));
    segs.push(String(mmax ?? 0));
    segs.push(String(scur ?? 0));
    segs.push(String(smax ?? 0));
  }

  if (st) segs.push(st);
  return `party:${segs.join('/')}`;
}

function applyPartyHpDelta(tokens, targetName, delta) {
  const tgt = String(targetName || '').trim();
  if (!tgt) return tokens;
  const tgtLow = tgt.toLowerCase();
  const out = Array.isArray(tokens) ? [...tokens] : [];

  for (let i = 0; i < out.length; i++) {
    const parsed = parsePartyToken(out[i]);
    if (!parsed) continue;
    if (String(parsed.name || '').trim().toLowerCase() !== tgtLow) continue;
    if (!Number.isFinite(parsed.hpCur)) return tokens;
    const next = Math.max(0, Math.floor(parsed.hpCur + delta));
    const capped = Number.isFinite(parsed.hpMax) ? Math.min(next, parsed.hpMax) : next;
    out[i] = rebuildPartyToken(parsed.name, capped, parsed.hpMax, parsed.status, parsed.mpCur, parsed.mpMax, parsed.stCur, parsed.stMax);
    return out;
  }

  return tokens;
}

function applyPartyStatus(tokens, targetName, status) {
  const tgt = String(targetName || '').trim();
  if (!tgt) return tokens;
  const tgtLow = tgt.toLowerCase();
  const out = Array.isArray(tokens) ? [...tokens] : [];

  for (let i = 0; i < out.length; i++) {
    const parsed = parsePartyToken(out[i]);
    if (!parsed) continue;
    if (String(parsed.name || '').trim().toLowerCase() !== tgtLow) continue;
    out[i] = rebuildPartyToken(parsed.name, parsed.hpCur, parsed.hpMax, status, parsed.mpCur, parsed.mpMax, parsed.stCur, parsed.stMax);
    return out;
  }

  return tokens;
}


function applyPartyMeterDelta(tokens, targetName, meter, delta) {
  const tgt = String(targetName || '').trim();
  if (!tgt) return tokens;
  const tgtLow = tgt.toLowerCase();
  const m = String(meter || '').trim().toLowerCase();
  if (!['hp','mp','stamina','stam'].includes(m)) return tokens;

  const out = Array.isArray(tokens) ? [...tokens] : [];

  for (let i = 0; i < out.length; i++) {
    const parsed = parsePartyToken(out[i]);
    if (!parsed) continue;
    if (String(parsed.name || '').trim().toLowerCase() !== tgtLow) continue;

    const d = Math.floor(Number(delta) || 0);
    if (!d) return tokens;

    if (m === 'hp') {
      if (!Number.isFinite(parsed.hpCur)) return tokens;
      const next = Math.max(0, Math.floor(parsed.hpCur + d));
      const capped = Number.isFinite(parsed.hpMax) ? Math.min(next, parsed.hpMax) : next;
      out[i] = rebuildPartyToken(parsed.name, capped, parsed.hpMax, parsed.status, parsed.mpCur, parsed.mpMax, parsed.stCur, parsed.stMax);
      return out;
    }

    if (m === 'mp') {
      if (!Number.isFinite(parsed.mpCur) || !Number.isFinite(parsed.mpMax)) return tokens;
      const next = Math.max(0, Math.min(parsed.mpMax, Math.floor(parsed.mpCur + d)));
      out[i] = rebuildPartyToken(parsed.name, parsed.hpCur, parsed.hpMax, parsed.status, next, parsed.mpMax, parsed.stCur, parsed.stMax);
      return out;
    }

    // stamina / stam
    if (!Number.isFinite(parsed.stCur) || !Number.isFinite(parsed.stMax)) return tokens;
    const next = Math.max(0, Math.min(parsed.stMax, Math.floor(parsed.stCur + d)));
    out[i] = rebuildPartyToken(parsed.name, parsed.hpCur, parsed.hpMax, parsed.status, parsed.mpCur, parsed.mpMax, next, parsed.stMax);
    return out;
  }

  return tokens;
}


function parseMeterToken(tokens, key) {
  const idx = _findTokenIndex(tokens, key);
  if (idx < 0) return null;
  const raw = String(tokens[idx] || '').split(/[:=]/).slice(1).join(':').trim();
  const m = raw.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!m) return { idx, cur: NaN, max: NaN };
  return { idx, cur: _toInt(m[1], 0), max: _toInt(m[2], 0) };
}

function applyMeterDelta(tokens, key, delta) {
  const out = Array.isArray(tokens) ? [...tokens] : [];
  const info = parseMeterToken(out, key);
  if (!info || info.idx < 0) return out; // do not invent meters
  if (!Number.isFinite(info.cur) || !Number.isFinite(info.max)) return out;
  const next = Math.max(0, Math.min(info.max, Math.floor(info.cur + delta)));
  out[info.idx] = `${key}:${next}/${info.max}`;
  return out;
}

// -------------------- Purchases / World Assets (Pricing, code-authoritative) --------------------
// Prices are code-authoritative. Assets enter state only by in-world buying or finding.
// No "request/approval" queues exist (anti-cheat).
const ASSET_PRICES = {
  house: 2000,
  horse: 250,
  carriage: 600,
  boat: 1200,
};
const ASSET_CURRENCY = String(process.env.ASSET_CURRENCY || "Coin_Aurum").trim() || "Coin_Aurum";


function applyOpsToTokens(roomId, prevTokens, tokens, ops, ctx = {}) {
  let out = Array.isArray(tokens) ? [...tokens] : [];
  const actor = sanitizeTokenField(ctx?.actorName || '', 80) || '';

  // Hard anti-cheat: block "inventory conjuring" attempts.
  // We still allow gains when the player is clearly buying, looting, searching, crafting, earning, etc.
  const pt = String(ctx?.playerText || '').toLowerCase();
  const looksCheaty = (() => {
    if (!pt) return false;
    const cheat = /(spawn|conjure|generate|add\s+to\s+inventory|give\s+myself|grant\s+me|free\s+item|request\s+loot|request\s+purchase|set\s+inventory)/i;
    const legit = /(buy|purchase|pay|trade|barter|loot|search|scavenge|find|take|pick\s*up|steal|craft|harvest|earn|reward|salvage|claim|tame|capture)/i;
    return cheat.test(pt) && !legit.test(pt);
  })();
  let notifiedCheat = false;

  for (const raw of (ops || [])) {
    const op = String(raw?.op || '').trim().toLowerCase();
    if (!op) continue;

    if (op === 'advance_time') {
      const mins = Number.isFinite(Number(raw?.minutes)) ? Number(raw.minutes) : (Number(raw?.hours) * 60);
      const why = String(raw?.reason || '').trim();
      out = advanceTimeWorld(roomId, out, mins, why);
      continue;
    }

    if (op === 'set_loc') {
      let loc = String(raw?.loc || raw?.location || '').trim();
      if (loc) {
        // Never allow coordinate-dumps into LOC.
        const looksCoord = /\d{1,3}\s*%|\bxy\b|\bx\s*=|\by\s*=|\(\s*\d/.test(loc);
        if (looksCoord) loc = 'UNMAPPED';
        out = actor ? setLocFor(out, actor, loc) : setLoc(out, loc);
      }
      continue;
    }

    if (op === 'apply_damage' || op === 'apply_heal') {
      const meter = String(raw?.meter || 'hp').trim().toLowerCase();
      const amt = Math.max(0, Math.floor(Number(raw?.amount || raw?.qty || 0) || 0));
      if (!amt) continue;
      const sign = (op === 'apply_damage') ? -1 : 1;
      const tgt = String(raw?.target || raw?.who || 'self').trim();
      const targetName = (!tgt || tgt.toLowerCase() === 'self') ? actor : tgt;

      if (meter === 'hp') {
        const maybeParty = applyPartyHpDelta(out, targetName, sign * amt);
        if (maybeParty !== out) {
          out = maybeParty;
        } else {
          out = applyMeterDelta(out, 'hp', sign * amt);
        }
      } else if (meter === 'mp' || meter === 'mana' || meter === 'aether') {
        const maybeParty = applyPartyMeterDelta(out, targetName, 'mp', sign * amt);
        if (maybeParty !== out) out = maybeParty;
        else out = applyMeterDelta(out, 'mp', sign * amt);
      } else if (meter === 'stamina' || meter === 'stam') {
        const maybeParty = applyPartyMeterDelta(out, targetName, 'stamina', sign * amt);
        if (maybeParty !== out) out = maybeParty;
        else out = applyMeterDelta(out, 'stamina', sign * amt);
      }
      continue;
    }

    if (op === 'set_party_status') {
      const tgt = String(raw?.target || raw?.who || 'self').trim();
      const targetName = (!tgt || tgt.toLowerCase() === 'self') ? actor : tgt;
      const status = String(raw?.status || '').trim();
      if (status) out = applyPartyStatus(out, targetName, status);
      continue;
    }

    if (op === 'spend_res') {
      const key = String(raw?.key || raw?.res || raw?.resource || '').trim();
      const amt = Math.max(0, Math.floor(Number(raw?.amount || 0) || 0));
      if (!key || !amt) continue;
      const cur = getRes(out, key);
      out = setRes(out, key, Math.max(0, cur - amt));
      continue;
    }

    if (op === 'consume_item') {
      const item = sanitizeTokenField(String(raw?.item || raw?.name || '').trim(), 80);
      const qty = Math.max(0, Math.floor(Number(raw?.qty || raw?.amount || 0) || 0));
      if (!item || !qty) continue;
      const inv = parseInvMapFor(out, actor);
      const k = item.toLowerCase();
      const cur = inv.get(k) || 0;
      invSetQty(inv, k, item, cur - qty);
      out = rebuildInvTokensFor(out, actor, inv);
      continue;
    }

    if (op === 'queue_delivery') {
      // Communication delay queue: a rumor/letter/news arrives later (days–weeks).
      // Does not modify canon tokens; it schedules a future system/book notice.
      scheduleDelivery(roomId, raw);
      continue;
    }

    if (op === 'adjust_pressure' || op === 'adjust_residue') {
      const amt = Math.floor(Number(raw?.amount ?? raw?.delta ?? raw?.value ?? 0) || 0);
      if (!amt) continue;
      const key = (op === 'adjust_pressure') ? 'pressure' : 'residue';
      out = adjustScalarToken(out, key, amt, 0, 9999);
      continue;
    }


    // Deprecated: request ops are not allowed. Ignore if encountered from an old model/snapshot.
    if (op === 'request_loot' || op === 'request_purchase') {
      try { io.to(roomId).emit('system', 'Deprecated request op ignored (use buy/find in-world).'); } catch {}
      continue;
    }

    if (op === 'gain_item') {
      if (looksCheaty) {
        if (!notifiedCheat) {
          notifiedCheat = true;
          try { io.to(roomId).emit('system', 'Anti-cheat: item creation blocked. Items can only be bought or found in play.'); } catch {}
        }
        continue;
      }
      const item = sanitizeTokenField(String(raw?.item || raw?.name || '').trim(), 80);
      const qty = Math.max(1, Math.floor(Number(raw?.qty || raw?.amount || 1) || 1));
      if (!item) continue;
      const inv = parseInvMapFor(out, actor);
      const k = item.toLowerCase();
      invAddQty(inv, k, item, qty);
      out = rebuildInvTokensFor(out, actor, inv);
      continue;
    }

    if (op === 'buy_asset') {
      if (looksCheaty) {
        if (!notifiedCheat) {
          notifiedCheat = true;
          try { io.to(roomId).emit('system', 'Anti-cheat: asset creation blocked. Assets can only be bought or found in play.'); } catch {}
        }
        continue;
      }
      const typeRaw = String(raw?.type || raw?.asset || '').trim().toLowerCase();
      const type = sanitizeTokenField(typeRaw, 40).toLowerCase();
      const aname = sanitizeTokenField(String(raw?.name || raw?.label || '').trim(), 80);
      if (!type || !ASSET_PRICES[type]) continue;

      const loc = extractLocFor(out, actor) || extractLoc(out);
      const owner = actor || 'party';
      const cost = Number(ASSET_PRICES[type] || 0) || 0;
      const funds = getRes(out, ASSET_CURRENCY);
      if (funds < cost) {
        try { io.to(roomId).emit('system', `Purchase blocked: ${owner} cannot afford ${type} (needs ${cost} ${ASSET_CURRENCY}, has ${funds}).`); } catch {}
        continue;
      }
      out = setRes(out, ASSET_CURRENCY, funds - cost);

      const aid = makeId(type.slice(0, 1).toUpperCase());
      const defaultName = type === 'house' ? `${loc} House` : (type === 'horse' ? 'Horse' : type);
      const finalName = aname || defaultName;
      out = addAssetToken(out, { type, id: aid, name: finalName, loc, owner, cost });
      continue;
    }

    if (op === 'gain_asset') {
      if (looksCheaty) {
        if (!notifiedCheat) {
          notifiedCheat = true;
          try { io.to(roomId).emit('system', 'Anti-cheat: asset creation blocked. Assets can only be bought or found in play.'); } catch {}
        }
        continue;
      }
      const typeRaw = String(raw?.type || raw?.asset || '').trim().toLowerCase();
      const type = sanitizeTokenField(typeRaw, 40).toLowerCase();
      if (!type) continue;
      // Restrict to known safe asset types.
      const allowed = new Set(['house','horse','carriage','boat']);
      if (!allowed.has(type)) continue;

      const loc = extractLocFor(out, actor) || extractLoc(out);
      const owner = sanitizeTokenField(String(raw?.owner || raw?.who || actor || 'party').trim(), 80) || 'party';
      const aname = sanitizeTokenField(String(raw?.name || raw?.label || '').trim(), 80);
      const aid = makeId(type.slice(0, 1).toUpperCase());
      const defaultName = type === 'house' ? `${loc} House` : (type === 'horse' ? 'Horse' : type);
      const finalName = aname || defaultName;
      out = addAssetToken(out, { type, id: aid, name: finalName, loc, owner, cost: 0 });
      continue;
    }
  }

  return out;
}


function parseTravelUiMessage(text) {
  const s = String(text || '').trim();
  if (!s.startsWith('TRAVEL (UI-click):')) return null;

  // Pinned destination: "Depart from A → B."
  let dest = '';
  let destType = 'pin';
  let x = null, y = null;

  const mPin = s.match(/→\s*([^\.]+)\./);
  if (mPin) dest = String(mPin[1] || '').trim();

  // Wilderness destination: "toward (12%, 34%)."
  const mWild = s.match(/toward\s*\((\d{1,3})%\s*,\s*(\d{1,3})%\)/i);
  if (mWild) {
    destType = 'wilderness';
    x = Math.max(0, Math.min(100, _toInt(mWild[1], 0)));
    y = Math.max(0, Math.min(100, _toInt(mWild[2], 0)));
  }

  // Time passes: "Time passes: ~2.5 hr." | "~15 min." | "~1.2 days." | "~0."
  let minutes = 0;
  const mTime = s.match(/Time\s+passes\s*:\s*~?\s*([0-9]+(?:\.[0-9]+)?)\s*(min|mins|minute|minutes|hr|hrs|hour|hours|day|days)\b/i);
  if (mTime) {
    const val = Number(mTime[1]);
    const unit = String(mTime[2] || '').toLowerCase();
    if (Number.isFinite(val) && val > 0) {
      if (unit.startsWith('min')) minutes = Math.round(val);
      else if (unit.startsWith('hr') || unit.startsWith('hour')) minutes = Math.round(val * 60);
      else if (unit.startsWith('day')) minutes = Math.round(val * 24 * 60);
    }
  }

  return { dest, destType, x, y, minutes };
}

function applyTravelUiTokens(roomId, tokens, tr) {
  let out = Array.isArray(tokens) ? [...tokens] : [];
  const tt = tr || {};

  if (tt.destType === 'pin' && tt.dest) {
    out = setLoc(out, tt.dest);
  } else {
    // Wilderness placeholder. The rulekeeper should name it via ops:set_loc.
    out = setLoc(out, 'WILDERNESS');
    if (tt.x != null && tt.y != null) {
      out = _upsertToken(out, 'pos', `x=${tt.x};y=${tt.y}`);
    }
  }

  if (tt.minutes) out = advanceTimeWorld(roomId, out, tt.minutes, "Travel");
  // Ensure season/weather are always current after any movement.
  out = ensureWorldClock(out, roomId);
  return out;
}


function mergeNewPartyMembers(prevTokens, currentTokens, candidatePartyTokens) {
  const prev = Array.isArray(prevTokens) ? prevTokens : [];
  const cur = Array.isArray(currentTokens) ? [...currentTokens] : [];
  const cand = Array.isArray(candidatePartyTokens) ? candidatePartyTokens : [];

  const prevNames = new Set();
  for (const t of prev) {
    const parsed = parsePartyToken(t);
    if (parsed && parsed.name) prevNames.add(String(parsed.name).trim().toLowerCase());
  }

  for (const t of cand) {
    const parsed = parsePartyToken(t);
    if (!parsed || !parsed.name) continue;
    const nmLow = String(parsed.name).trim().toLowerCase();
    if (!nmLow || prevNames.has(nmLow)) continue;
    // Sanitize by rebuilding (prevents weird slashes / pipes).
    cur.push(rebuildPartyToken(parsed.name, parsed.hpCur, parsed.hpMax, parsed.status, parsed.mpCur, parsed.mpMax, parsed.stCur, parsed.stMax));
    prevNames.add(nmLow);
  }

  return cur;
}
// -------------------- End code-authoritative mechanics ops --------------------

// Extended anti-cheat:
// - Prevent non-host from increasing combined (inv+stash) counts per item.
// - Prevent equipping items you do not possess (inv+stash <= 0).

function enforceNoFreeGainsWithStashAndEq(prevTokens, nextTokens) {
  const prevRes = parseResMap(prevTokens);
  const nextRes = parseResMap(nextTokens);
  const prevInv = parseInvMap(prevTokens);
  const nextInv = parseInvMap(nextTokens);
  const prevStashBy = parseStashByAsset(prevTokens);
  const nextStashBy = parseStashByAsset(nextTokens);
  const prevStash = stashTotalsFromByAsset(prevStashBy);
  const nextStash = stashTotalsFromByAsset(nextStashBy);
  const prevEq = parseEqMap(prevTokens);
  const nextEq = parseEqMap(nextTokens);

  let changed = false;

  // --- resources ---
  for (const [k, nextV] of nextRes.entries()) {
    const prevV = prevRes.get(k) ?? 0;
    if (nextV > prevV) {
      nextRes.set(k, prevV);
      changed = true;
    }
  }
  for (const [k, prevV] of prevRes.entries()) {
    if (!nextRes.has(k)) {
      nextRes.set(k, prevV);
      changed = true;
    }
  }

  // --- inventory + stash conservation ---
  invEnsureNames(nextInv);
  const allKeys = new Set([
    ...prevInv.keys(), ...nextInv.keys(),
    ...prevStash.keys(), ...nextStash.keys(),
  ]);

  for (const k of allKeys) {
    const pInv = prevInv.get(k) ?? 0;
    const pSt = prevStash.get(k) ?? 0;
    const nInv = nextInv.get(k) ?? 0;
    const nSt = nextStash.get(k) ?? 0;

    const prevTotal = pInv + pSt;
    const nextTotal = nInv + nSt;

    // block creating new items or increasing totals
    if (nextTotal > prevTotal) {
      let excess = nextTotal - prevTotal;

      // clamp by pulling excess from stash first, then inv
      const remainingAfterStash = reduceStashItem(nextStashBy, k, excess);
      const takenFromStash = excess - remainingAfterStash;
      const newStTotal = Math.max(0, Math.floor(nSt - takenFromStash));
      nextStash.set(k, newStTotal);
      excess = remainingAfterStash;

      if (excess > 0) {
        const newInv = Math.max(0, Math.floor(nInv - Math.min(excess, nInv)));
        const nameHint = invGetName(prevInv, k, invGetName(nextInv, k, k));
        invSetQty(nextInv, k, nameHint, newInv);
      }
      changed = true;
    }

    // prevent introducing a brand new item in either inv/stash
    if (prevTotal <= 0 && (nInv > 0 || nSt > 0)) {
      const nameHint = invGetName(prevInv, k, invGetName(nextInv, k, k));
      invSetQty(nextInv, k, nameHint, 0);
      removeStashItemEverywhere(nextStashBy, k);
      nextStash.set(k, 0);
      changed = true;
    }
  }

  // --- equipment ownership ---
  for (const [slot, itemRaw] of nextEq.entries()) {
    const itemKey = String(itemRaw || '').trim().toLowerCase();
    if (!itemKey) continue;
    const have = (nextInv.get(itemKey) ?? 0) + (nextStash.get(itemKey) ?? 0);
    if (have <= 0) {
      if (prevEq.has(slot)) nextEq.set(slot, prevEq.get(slot));
      else nextEq.delete(slot);
      changed = true;
    }
  }

  if (!changed) return nextTokens;

  let out = nextTokens;
  out = rebuildResTokens(out, nextRes);
  out = rebuildInvTokens(out, nextInv);
  out = rebuildStashTokens(out, nextStashBy);
  out = rebuildEqTokens(out, nextEq);
  return out;
}
// --- End stash + equipment trackers ---


function rebuildInvTokens(tokens, invMap) {
  const out = [];
  for (const t of (tokens || [])) {
    const s = String(t || '').trim();
    const low = s.toLowerCase();
    if (
      low.startsWith('inv:') || low.startsWith('inv=') ||
      low.startsWith('inventory:') || low.startsWith('inventory=')
    ) continue;
    out.push(s);
  }

  const map = (invMap instanceof Map) ? invMap : new Map();
  invEnsureNames(map);

  const pairs = [];
  for (const [k, v] of map.entries()) {
    const qty = Math.max(0, Math.floor(Number(v) || 0));
    if (qty <= 0) continue;
    const name = sanitizeTokenField(invGetName(map, k, k), 80) || k;
    pairs.push({ k, name, qty });
  }
  pairs.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  for (const it of pairs) {
    out.push(`inv:${it.name}=${it.qty}`);
  }

  return out;
}

function rebuildInvTokensFor(tokens, actorName, invMap){
  const nm = _pNameKey(actorName);
  const out = [];
  for (const t of (tokens || [])) {
    const s = String(t || '').trim();
    if (_invpTokenMatchesName(s, nm)) continue;
    out.push(s);
  }

  const map = (invMap instanceof Map) ? invMap : new Map();
  invEnsureNames(map);
  const pairs = [];
  for (const [k, v] of map.entries()) {
    const qty = Math.max(0, Math.floor(Number(v) || 0));
    if (qty <= 0) continue;
    const name = sanitizeTokenField(invGetName(map, k, k), 80) || k;
    pairs.push({ name, qty });
  }
  pairs.sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  if (nm && pairs.length) {
    const body = pairs.map(it => `${it.name}=${it.qty}`).join(';');
    out.push(`invp:${nm}|${body}`);
  }
  return out;
}

function rebuildResTokens(tokens, resMap) {
  const out = [];
  for (const t of (tokens || [])) {
    const s = String(t || "").trim();
    if (s.toLowerCase().startsWith("res:")) continue;
    out.push(s);
  }
  for (const [k, v] of resMap.entries()) {
    out.push(`res:${k}=${Math.max(0, Math.floor(Number(v) || 0))}`);
  }
  return out;
}


// -------------------- Crafting helpers --------------------
function _normItemKey(name) {
  return String(name || '').trim().toLowerCase();
}

function listCraftRecipesForActor(st, actorName) {
  const inv = parseInvMapFor(st?.canon?.tokens || [], actorName);
  const out = [];

  const recipes = Array.isArray(CRAFTING?.recipes) ? CRAFTING.recipes : [];
  for (const r of recipes) {
    if (!r || typeof r !== 'object') continue;
    const ingredients = Array.isArray(r.ingredients) ? r.ingredients : [];
    const outputs = Array.isArray(r.outputs) ? r.outputs : [];

    const missing = [];
    let craftable = true;
    for (const ing of ingredients) {
      const item = sanitizeTokenField(String(ing?.item || '').trim(), 80);
      const need = Math.max(1, Math.min(999, Math.floor(Number(ing?.qty) || 0)));
      if (!item) continue;
      const have = inv.get(_normItemKey(item)) ?? 0;
      if (have < need) {
        craftable = false;
        missing.push({ item, have, need });
      }
    }

    out.push({
      id: String(r.id || '').trim(),
      name: String(r.name || r.id || 'Recipe').trim(),
      category: String(r.category || 'Misc').trim(),
      description: String(r.description || '').trim(),
      ingredients: ingredients.map(x => ({ item: String(x?.item || '').trim(), qty: Math.max(1, Math.floor(Number(x?.qty) || 1)) })),
      outputs: outputs.map(x => ({ item: String(x?.item || '').trim(), qty: Math.max(1, Math.floor(Number(x?.qty) || 1)) })),
      craftable,
      missing
    });
  }

  // Sort by category then name for stable UI.
  out.sort((a, b) => (String(a.category).localeCompare(String(b.category)) || String(a.name).localeCompare(String(b.name))));
  return out;
}

function applyInvChangesFor(tokens, actorName, changes) {
  const inv = parseInvMapFor(tokens, actorName);
  const ch = Array.isArray(changes) ? changes : [];

  for (const c of ch) {
    const itemRaw = sanitizeTokenField(String(c?.item || '').trim(), 80);
    const delta = Math.floor(Number(c?.delta) || 0);
    if (!itemRaw || !delta) continue;
    const k = _normItemKey(itemRaw);
    const have = inv.get(k) ?? 0;
    const next = Math.max(0, have + delta);
    invSetQty(inv, k, itemRaw, next);
  }

  return rebuildInvTokensFor(tokens, actorName, inv);
}

function craftRecipeApply(st, actorName, recipeIdRaw, qtyRaw) {
  const recipeId = String(recipeIdRaw || '').trim();
  const qty = Math.max(1, Math.min(99, Math.floor(Number(qtyRaw) || 1)));
  if (!recipeId) return { ok: false, error: 'Missing recipe id.' };

  const recipes = Array.isArray(CRAFTING?.recipes) ? CRAFTING.recipes : [];
  const r = recipes.find(x => String(x?.id || '').trim() === recipeId);
  if (!r) return { ok: false, error: 'Unknown recipe.' };

  const tokens0 = Array.isArray(st?.canon?.tokens) ? [...st.canon.tokens] : [];
  const inv = parseInvMapFor(tokens0, actorName);

  // Validate ingredients
  const ingredients = Array.isArray(r.ingredients) ? r.ingredients : [];
  for (const ing of ingredients) {
    const item = sanitizeTokenField(String(ing?.item || '').trim(), 80);
    const need = Math.max(1, Math.min(999, Math.floor(Number(ing?.qty) || 0))) * qty;
    if (!item) continue;
    const have = inv.get(_normItemKey(item)) ?? 0;
    if (have < need) return { ok: false, error: `Missing ingredients: need ${need} ${item} (have ${have}).` };
  }

  // Consume + produce
  for (const ing of ingredients) {
    const item = sanitizeTokenField(String(ing?.item || '').trim(), 80);
    const need = Math.max(1, Math.min(999, Math.floor(Number(ing?.qty) || 0))) * qty;
    if (!item) continue;
    const k = _normItemKey(item);
    const have = inv.get(k) ?? 0;
    invSetQty(inv, k, item, Math.max(0, have - need));
  }

  const outputs = Array.isArray(r.outputs) ? r.outputs : [];
  for (const out of outputs) {
    const item = sanitizeTokenField(String(out?.item || '').trim(), 80);
    const give = Math.max(1, Math.min(999, Math.floor(Number(out?.qty) || 0))) * qty;
    if (!item) continue;
    const k = _normItemKey(item);
    const have = inv.get(k) ?? 0;
    invSetQty(inv, k, item, have + give);
  }

  st.canon.tokens = rebuildInvTokensFor(tokens0, actorName, inv);

  return {
    ok: true,
    recipe: { id: String(r.id || ''), name: String(r.name || r.id || '') },
    qty,
    consumed: ingredients.map(x => ({ item: String(x?.item || '').trim(), qty: Math.max(1, Math.floor(Number(x?.qty) || 1)) * qty })),
    produced: outputs.map(x => ({ item: String(x?.item || '').trim(), qty: Math.max(1, Math.floor(Number(x?.qty) || 1)) * qty }))
  };
}

function computeGatherLoot(kindRaw, biomeRaw, rollTotalRaw) {
  const kind = String(kindRaw || '').trim().toLowerCase();
  const biome = String(biomeRaw || '').trim().toLowerCase();
  const total = Math.max(1, Math.min(20, Math.floor(Number(rollTotalRaw) || 1)));

  const table = (kind === 'hunt') ? (CRAFTING?.gather_tables?.hunt) : (CRAFTING?.gather_tables?.forage);
  const items = (table && typeof table === 'object') ? (table.items || {}) : {};
  const common = Array.isArray(items.common) ? items.common : [];
  const uncommon = Array.isArray(items.uncommon) ? items.uncommon : [];
  const rare = Array.isArray(items.rare) ? items.rare : [];

  const pick = (arr, n) => {
    const a = Array.isArray(arr) ? arr.filter(Boolean).map(String) : [];
    if (!a.length) return [];
    const out = [];
    for (let i = 0; i < n; i++) out.push(a[(total + i) % a.length]);
    return out;
  };

  const loot = new Map();
  const add = (item, q) => {
    const nm = sanitizeTokenField(String(item || '').trim(), 80);
    if (!nm) return;
    loot.set(nm, (loot.get(nm) ?? 0) + Math.max(1, Math.floor(q || 1)));
  };

  // Simple deterministic bands (no RNG):
  // 1–5: scrap
  // 6–10: modest
  // 11–15: good
  // 16–19: great
  // 20: exceptional
  if (total <= 5) {
    const p = pick(common, 1);
    if (p[0]) add(p[0], 1);
  } else if (total <= 10) {
    const p = pick(common, 2);
    if (p[0]) add(p[0], 1);
    if (p[1]) add(p[1], 1);
  } else if (total <= 15) {
    const p = pick(common, 2);
    if (p[0]) add(p[0], 1);
    if (p[1]) add(p[1], 1);
    const u = pick(uncommon, 1);
    if (u[0]) add(u[0], 1);
  } else if (total <= 19) {
    const p = pick(common, 2);
    if (p[0]) add(p[0], 1);
    if (p[1]) add(p[1], 1);
    const u = pick(uncommon, 1);
    if (u[0]) add(u[0], 1);
    const rr = pick(rare, 1);
    if (rr[0]) add(rr[0], 1);
  } else {
    // 20
    const p = pick(common, 2);
    if (p[0]) add(p[0], 2);
    if (p[1]) add(p[1], 1);
    const u = pick(uncommon, 2);
    if (u[0]) add(u[0], 1);
    if (u[1]) add(u[1], 1);
    const rr = pick(rare, 1);
    if (rr[0]) add(rr[0], 1);
  }

  // Biome flavor (deterministic nudges, still no RNG)
  if (kind === 'forage') {
    if (biome.includes('marsh')) add('Moonmoss', total >= 11 ? 1 : 0);
    if (biome.includes('forest')) add('Wild Greens', total >= 6 ? 1 : 0);
    if (biome.includes('desert')) add('Salt Crystal', total >= 10 ? 1 : 0);
    if (biome.includes('coast')) add('River Reed', total >= 6 ? 1 : 0);
  } else {
    if (biome.includes('coast')) add('Riverfish', total >= 10 ? 1 : 0);
    if (biome.includes('plains') || biome.includes('forest')) add('Thornback Plate Fragment', total === 20 ? 1 : 0);
    if (biome.includes('marsh')) add('Mirehound Fang', total === 20 ? 1 : 0);
  }

  const arr = [];
  for (const [item, qty] of loot.entries()) {
    if (qty > 0) arr.push({ item, qty });
  }
  arr.sort((a, b) => String(a.item).localeCompare(String(b.item)));
  return arr;
}

async function resolvePendingCraftOrGather({ roomId, socket, actor, pending, rollInfo }) {
  const st = getRoomState(roomId);
  const kind = String(pending?.kind || 'action').trim().toLowerCase();

  if (kind === 'gather') {
    const gk = String(pending?.gatherKind || 'forage').trim().toLowerCase();
    const biome = String(pending?.biome || '').trim();
    const loot = computeGatherLoot(gk, biome, rollInfo?.total || 1);
    if (!loot.length) {
      io.to(roomId).emit('system', `${actor} ${gk === 'hunt' ? 'hunts' : 'forages'} (${biome || 'wilderness'}) and finds nothing useful.`);
      return;
    }

    // Apply inventory changes
    const changes = loot.map(x => ({ item: x.item, delta: Math.max(1, Math.floor(Number(x.qty) || 1)) }));
    st.canon.tokens = applyInvChangesFor(st.canon.tokens, actor, changes);

    saveRoomStateFile(roomId);
    emitCanon(roomId, st);

    const line = loot.map(x => `${x.qty} ${x.item}`).join(', ');
    io.to(roomId).emit('system', `${actor} ${gk === 'hunt' ? 'hunts' : 'forages'} (${biome || 'wilderness'}) and finds: ${line}.`);
    return;
  }

  if (kind === 'craft') {
    const recipeId = String(pending?.recipeId || '').trim();
    const qty = Math.max(1, Math.min(99, Math.floor(Number(pending?.qty) || 1)));
    const res = craftRecipeApply(st, actor, recipeId, qty);
    if (!res.ok) {
      socket.emit('error_msg', res.error || 'Craft failed.');
      return;
    }
    saveRoomStateFile(roomId);
    emitCanon(roomId, st);
    const madeLine = (res.produced || []).map(x => `${x.qty} ${x.item}`).join(', ');
    io.to(roomId).emit('system', `${actor} crafts ${madeLine}.`);
    try { socket.emit('craft_done', { ok: true, recipeId, qty, produced: res.produced, consumed: res.consumed }); } catch {}
    return;
  }
}
// -------------------- END Crafting helpers --------------------

function enforceNoFreeGains(prevTokens, nextTokens) {
  const prevRes = parseResMap(prevTokens);
  const nextRes = parseResMap(nextTokens);
  let changed = false;

  // Block currency/resource increases (allow decreases).
  for (const [k, nextV] of nextRes.entries()) {
    const prevV = prevRes.get(k) ?? 0;
    if (nextV > prevV) {
      nextRes.set(k, prevV);
      changed = true;
    }
  }
  // Prevent creation of new resource keys on non-host turns.
  for (const [k, prevV] of prevRes.entries()) {
    if (!nextRes.has(k)) {
      nextRes.set(k, prevV);
      changed = true;
    }
  }

  const prevInv = parseInvMap(prevTokens);
  const nextInv = parseInvMap(nextTokens);
  invEnsureNames(nextInv);

  // Block inventory increases/new items (allow decreases and removals).
  for (const [k, nextV] of nextInv.entries()) {
    const prevV = prevInv.get(k) ?? 0;
    const nameHint = invGetName(prevInv, k, invGetName(nextInv, k, k));
    if (nextV > prevV) {
      invSetQty(nextInv, k, nameHint, prevV);
      changed = true;
    }
    if (!prevInv.has(k) && nextV > 0) {
      invSetQty(nextInv, k, nameHint, 0);
      changed = true;
    }
  }

  if (!changed) return nextTokens;

  let out = nextTokens;
  out = rebuildResTokens(out, nextRes);
  out = rebuildInvTokens(out, nextInv);
  return out;
}
// -------------------- End anti-cheat delta guards --------------------

function getTokenValue(tokens, key) {
  const k = String(key || "").toLowerCase();
  for (const t of (tokens || [])) {
    const s = String(t || "");
    const low = s.toLowerCase();
    if (low.startsWith(k + ":") || low.startsWith(k + "=")) {
      return s.slice(k.length + 1).trim();
    }
  }
  return "";
}



function getIntToken(tokens, key, defVal = 0) {
  const v = getTokenValue(tokens, key);
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? n : defVal;
}

function upsertScalarToken(tokens, key, val) {
  const out = [];
  const k = String(key || "").trim();
  const lowk = k.toLowerCase();
  let wrote = false;
  for (const t of (tokens || [])) {
    const s = String(t || "").trim();
    const low = s.toLowerCase();
    if (low.startsWith(lowk + ":") || low.startsWith(lowk + "=")) {
      if (!wrote) {
        out.push(`${k}:${Math.floor(Number(val) || 0)}`);
        wrote = true;
      }
    } else {
      out.push(s);
    }
  }
  if (!wrote) out.push(`${k}:${Math.floor(Number(val) || 0)}`);
  return out;
}

function adjustScalarToken(tokens, key, delta, minVal = 0, maxVal = 9999) {
  const cur = getIntToken(tokens, key, 0);
  const next = Math.max(minVal, Math.min(maxVal, cur + Math.floor(Number(delta) || 0)));
  return upsertScalarToken(tokens, key, next);
}
function hasModeToken(tokens, mode){
  const want = String(mode || "").trim().toLowerCase();
  if (!want) return false;
  for (const t of (tokens || [])) {
    const s = String(t || "").trim().toLowerCase();
    if (s === `mode:${want}` || s === `mode=${want}`) return true;
  }
  return false;
}

function setModeToken(tokens, mode){
  const m = String(mode || "").trim();
  if (!m) return Array.isArray(tokens) ? [...tokens] : [];
  const out = [];
  for (const t of (tokens || [])) {
    const s = String(t || "").trim();
    const low = s.toLowerCase();
    if (low.startsWith("mode:") || low.startsWith("mode=")) continue;
    out.push(s);
  }
  out.push(`mode:${m}`);
  return out;
}

function hasFlagToken(tokens, key){
  const want = String(key || '').trim().toLowerCase();
  if (!want) return false;
  for (const t of (tokens || [])) {
    const low = String(t || '').trim().toLowerCase();
    if (low === `flag:${want}` || low.startsWith(`flag:${want}=`) || low === `flag=${want}` || low.startsWith(`flag=${want}=`)) return true;
  }
  return false;
}

function clearFlagToken(tokens, key){
  const want = String(key || '').trim().toLowerCase();
  if (!want) return Array.isArray(tokens) ? [...tokens] : [];
  const out = [];
  for (const t of (tokens || [])) {
    const s = String(t || '').trim();
    const low = s.toLowerCase();
    if (low === `flag:${want}` || low.startsWith(`flag:${want}=`) || low === `flag=${want}` || low.startsWith(`flag=${want}=`)) continue;
    out.push(s);
  }
  return out;
}

function setFlagToken(tokens, key, val = 1){
  const k = String(key || '').trim();
  if (!k) return Array.isArray(tokens) ? [...tokens] : [];
  const out = clearFlagToken(tokens, k);
  out.push(`flag:${k}=${String(val)}`);
  return out;
}

function sanitizeTokenField(s, maxLen = 60){
  return String(s || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[|]+/g, " ")
    .replace(/[:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}



function sanitizeKVValue(s, maxLen = 80){
  return String(s || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[|:;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

// Compact, non-mechanical character bio token.
// This is for continuity/context only; mechanics remain code-authoritative.
function buildPcBioToken(charName, answers){
  const nm = sanitizeTokenField(charName, 80) || "Anonymous";
  const a = (answers && typeof answers === "object") ? answers : {};

  const age = sanitizeKVValue(a.q10, 10);
  const touch = sanitizeKVValue(a.q11, 30);
  const magic = sanitizeKVValue(a.q12, 30);
  const cls = sanitizeKVValue(a.q13, 40);
  const job = sanitizeKVValue(a.q14, 80);

  const eyes = sanitizeKVValue(a.app_eye, 30);
  const hair = sanitizeKVValue(a.app_hair, 30);
  const body = sanitizeKVValue(a.app_body, 30);
  const height = sanitizeKVValue(a.app_height, 20);
  const marks = sanitizeKVValue(a.app_marks, 80);

  const parts = [];
  if (age) parts.push(`age=${age}`);
  if (touch) parts.push(`touch=${touch}`);
  if (magic && String(touch || "").toLowerCase().startsWith("touched")) parts.push(`magic=${magic}`);
  if (cls) parts.push(`class=${cls}`);
  if (job) parts.push(`job=${job}`);

  const app = [];
  if (eyes) app.push(`eyes=${eyes}`);
  if (hair) app.push(`hair=${hair}`);
  if (body) app.push(`body=${body}`);
  if (height) app.push(`height=${height}`);
  if (marks) app.push(`marks=${marks}`);
  if (app.length) parts.push(`appearance=${app.join(",")}`);

  const bodyStr = parts.join(";");
  return bodyStr ? `pcbio:${nm}|${bodyStr}` : `pcbio:${nm}|`;
}

// Per-character starting preference token.
// Purpose: in multiplayer, the host cannot silently decide whether another PC starts with the party.
// Values: party | separate
function buildPcStartToken(charName, answers, intakeGlobal){
  const nm = sanitizeTokenField(charName, 80) || "Anonymous";
  const a = (answers && typeof answers === "object") ? answers : {};
  const g = (intakeGlobal && typeof intakeGlobal === "object") ? intakeGlobal : {};

  // If this is truly a solo start (1 player, 0 NPC companions), treat it as "party".
  let players = 1;
  let npcs = 0;
  try { players = Math.max(1, Math.min(8, parseInt(String(g.q1 || "1").trim(), 10) || 1)); } catch {}
  try { npcs = Math.max(0, Math.min(20, parseInt(String(g.q2 || "0").trim(), 10) || 0)); } catch {}

  const globalForm = String(g.q3 || "").toLowerCase();
  const globalTogether = globalForm.includes("together");

  const raw = String(a.q15 || a.start_with_party || "").trim();
  let val = "";
  if (raw) {
    const low = raw.toLowerCase();
    if (low.includes("separate")) val = "separate";
    else if (low.includes("party") || low.includes("with")) val = "party";
  }

  if (!val) val = globalTogether ? "party" : "separate";
  if (players <= 1 && npcs <= 0) val = "party";

  return `pcstart:${nm}=${val}`;
}

function stripTokensByPrefixes(tokens, prefixes){
  const out = [];
  const pre = (prefixes || []).map(p => String(p || "").toLowerCase()).filter(Boolean);
  for (const t of (tokens || [])) {
    const s = String(t || "").trim();
    if (!s) continue;
    const low = s.toLowerCase();
    let keep = true;
    for (const p of pre) {
      if (low.startsWith(p)) { keep = false; break; }
    }
    if (keep) out.push(s);
  }
  return out;
}

function buildCfgTokens(intakeGlobal){
  const g = (intakeGlobal && typeof intakeGlobal === "object") ? intakeGlobal : {};
  const cfg = [];
  const add = (k, v, maxLen = 80) => {
    const val = sanitizeKVValue(v, maxLen);
    if (!val) return;
    cfg.push(`cfg:${k}=${val}`);
  };

  add("dice_player_rolled", g.q0, 20);
  add("players", g.q1, 4);
  add("npcs", g.q2, 4);
  add("start_together", g.q3, 40);
  add("campaign_length", g.q4, 40);
  add("pacing", g.q5, 20);
  add("difficulty", g.q6, 20);
  add("realism", g.q7, 20);
  add("adult_intensity", g.q8, 20);

  return cfg;
}

// Intake completion is code-authoritative.
// We do NOT call the LLM here (fast, reliable, no JSON parsing hazards).
function applyIntakeToTokens(tokens, roomState, playerSockets){
  let out = Array.isArray(tokens) ? [...tokens] : [];

  // Re-submits should not duplicate bios/party/cfg.
  out = stripTokensByPrefixes(out, ["party:", "party=", "pcbio:", "pcbio=", "pcstart:", "pcstart=", "cfg:", "cfg="]);

  try {
    if (roomState?.intakeGlobal) out.push(...buildCfgTokens(roomState.intakeGlobal));
  } catch {}

  const expected = Number(roomState?.expectedPlayers || 0) || 0;

  const seen = new Set();
  const addParty = (nm) => {
    const key = String(nm || "").toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(`party:${nm}`);
  };

  let added = 0;
  const cap = Math.max(1, Math.min(8, expected || 8));
  for (const s of (playerSockets || [])) {
    if (added >= cap) break;
    const rec = roomState?.intakePlayers?.[s.id] || {};
    const jn = rec?.joinName || s.data?.name || "Anonymous";
    const list = Array.isArray(rec?.answersPlayers) ? rec.answersPlayers : [rec?.answers || {}];
    for (let i = 0; i < list.length; i++) {
      if (added >= cap) break;
      const pa = list[i] && typeof list[i] === 'object' ? list[i] : {};
      const raw = String(pa.q9 || (i === 0 ? jn : `${jn} ${i + 1}`) || '').trim();
      const nm = sanitizeTokenField(raw, 80) || "Anonymous";
      addParty(nm);
      out.push(buildPcBioToken(nm, pa));
      out.push(buildPcStartToken(nm, pa, roomState?.intakeGlobal || null));
      added += 1;
    }
  }

  // Move directly into mandatory stats allocation.
  out = setModeToken(out, "STATS");

  // Ensure baseline tokens exist.
  if (!out.some(t => String(t || "").toLowerCase().startsWith("loc:") || String(t || "").toLowerCase().startsWith("loc="))) out.push("loc:UNMAPPED");
  if (!out.some(t => String(t || "").toLowerCase() === "flag:autosave=on" || String(t || "").toLowerCase() === "flag:autosave=off")) out.push("flag:autosave=on");

  // World pressure/residue (foundation for Monster Doctrine). Code-owned.
  if (!out.some(t => String(t || "").toLowerCase().startsWith("pressure:") || String(t || "").toLowerCase().startsWith("pressure="))) out.push("pressure:0");
  if (!out.some(t => String(t || "").toLowerCase().startsWith("residue:") || String(t || "").toLowerCase().startsWith("residue="))) out.push("residue:0");

  // Ensure START placeholder is removed and XY exists.
  try { out = repairBaselineTokens(out); } catch {}

  // Initialize per-character map/location state for the roster.
  try {
    const roster = Array.isArray(roomState?.playerCharNames) ? roomState.playerCharNames : [];
    out = ensurePStatesForRoster(out, roster);
    out = recomputePartyGroups(out, roster);
  } catch {}

  // De-dup exact tokens.
  const uniq = [];
  const set = new Set();
  for (const t of out) {
    const k = String(t || "").trim();
    if (!k) continue;
    if (set.has(k)) continue;
    set.add(k);
    uniq.push(k);
  }
  return uniq;
}

const STAT_KEYS = ["STRIKE","GUARD","VELOCITY","SIGHT","WILL","ECHO"];


function clampInt(n, lo, hi){
  const x = Math.floor(Number(n) || 0);
  return Math.max(lo, Math.min(hi, x));
}

// Starter vitals are derived from rolled stats (simple + predictable; no hidden math).
// These are only initialized if missing on the party token.
function deriveStarterVitalsFromStats(stats){
  const GUARD = Number(stats?.GUARD);
  const ECHO = Number(stats?.ECHO);
  const VELOCITY = Number(stats?.VELOCITY);

  const hpMax = clampInt(8 + Math.floor((Number.isFinite(GUARD) ? GUARD : 10) / 2), 6, 30);
  const mpMax = clampInt(Math.floor((Number.isFinite(ECHO) ? ECHO : 10) / 2), 0, 20);
  const stMax = clampInt(8 + Math.floor((Number.isFinite(VELOCITY) ? VELOCITY : 10) / 2), 6, 30);

  return {
    hpCur: hpMax, hpMax,
    mpCur: mpMax, mpMax,
    stCur: stMax, stMax
  };
}

function ensurePartyTokenFor(name, tokens){
  const nm = sanitizeTokenField(String(name || '').trim(), 80) || '';
  if (!nm) return tokens;
  const want = nm.toLowerCase();
  const out = Array.isArray(tokens) ? [...tokens] : [];
  for (const t of out){
    const p = parsePartyToken(t);
    if (p && String(p.name || '').trim().toLowerCase() === want) return out;
  }
  out.push(`party:${nm}`);
  return out;
}

// Initialize/repair the party token's vitals for a character after they lock stats.
// Only fills missing fields; does not overwrite existing cur values.
function ensurePartyVitalsFromStats(tokens, name, stats){
  const nm = sanitizeTokenField(String(name || '').trim(), 80) || '';
  if (!nm) return tokens;

  let out = ensurePartyTokenFor(nm, tokens);

  const want = nm.toLowerCase();
  const derived = deriveStarterVitalsFromStats(stats || {});

  for (let i = 0; i < out.length; i++){
    const parsed = parsePartyToken(out[i]);
    if (!parsed) continue;
    if (String(parsed.name || '').trim().toLowerCase() !== want) continue;

    const hpMax = Number.isFinite(parsed.hpMax) ? parsed.hpMax : derived.hpMax;
    const hpCur = Number.isFinite(parsed.hpCur) ? parsed.hpCur : derived.hpCur;

    const mpMax = Number.isFinite(parsed.mpMax) ? parsed.mpMax : derived.mpMax;
    const mpCur = Number.isFinite(parsed.mpCur) ? parsed.mpCur : derived.mpCur;

    const stMax = Number.isFinite(parsed.stMax) ? parsed.stMax : derived.stMax;
    const stCur = Number.isFinite(parsed.stCur) ? parsed.stCur : derived.stCur;

    const status = String(parsed.status || '').trim() || 'OK';

    out[i] = rebuildPartyToken(parsed.name || nm, hpCur, hpMax, status, mpCur, mpMax, stCur, stMax);
    return out;
  }

  // If we couldn't find/parse an existing token, append a clean one.
  out.push(rebuildPartyToken(nm, derived.hpCur, derived.hpMax, 'OK', derived.mpCur, derived.mpMax, derived.stCur, derived.stMax));
  return out;
}



function buildPcStatsToken(charName, statsObj){
  const nm = sanitizeTokenField(charName, 80) || "Anonymous";
  const order = STAT_KEYS;
  const pairs = [];
  for (const k of order) {
    const v = statsObj?.[k];
    if (v == null) continue;
    pairs.push(`${k}=${String(v).trim()}`);
  }
  return `pc:${nm}|stats:${pairs.join(";")}`;
}

function tokenIsPcForName(token, charName){
  const nm = sanitizeTokenField(charName, 80);
  if (!nm) return false;
  const lowTok = String(token || "").toLowerCase();
  const lowNm = nm.toLowerCase();
  return lowTok.startsWith(`pc:${lowNm}|`) || lowTok === `pc:${lowNm}`;
}

function hasPcStats(tokens, charName){
  for (const t of (tokens || [])) {
    const s = String(t || "").trim();
    if (!tokenIsPcForName(s, charName)) continue;
    if (s.toLowerCase().includes("|stats:")) return true;
  }
  return false;
}

function upsertPcStats(tokens, charName, statsObj){
  const out = [];
  for (const t of (tokens || [])) {
    const s = String(t || "").trim();
    if (tokenIsPcForName(s, charName) && s.toLowerCase().includes("|stats:")) continue;
    out.push(s);
  }
  out.push(buildPcStatsToken(charName, statsObj));
  return out;
}

function parsePcStatsToken(token){
  const s = String(token || "").trim();
  const m = /^pc:([^|]+)\|stats:(.+)$/i.exec(s);
  if (!m) return null;
  const name = String(m[1] || "").trim();
  const body = String(m[2] || "").trim();
  const stats = {};
  for (const part of body.split(';')) {
    const p = String(part || "").trim();
    if (!p) continue;
    const [kRaw, vRaw] = p.split('=');
    const k = String(kRaw || "").trim().toUpperCase();
    const v = Number(String(vRaw || "").trim());
    if (!k) continue;
    if (!Number.isFinite(v)) continue;
    stats[k] = v;
  }
  return { name, stats };
}

function removePcStatsTokenByName(tokens, charName){
  const out = [];
  for (const t of (tokens || [])) {
    const s = String(t || "").trim();
    if (tokenIsPcForName(s, charName) && s.toLowerCase().includes("|stats:")) continue;
    out.push(s);
  }
  return out;
}

function removeAllPcStatsTokens(tokens){
  const out = [];
  for (const t of (tokens || [])) {
    const s = String(t || "").trim();
    const low = s.toLowerCase();
    if (low.startsWith("pc:") && low.includes("|stats:")) continue;
    out.push(s);
  }
  return out;
}

function getPcNamesFromTokens(tokens){
  const names = [];
  const seen = new Set();
  for (const t of (tokens || [])) {
    const s = String(t || "").trim();
    if (!s.toLowerCase().startsWith("pc:")) continue;
    const body = s.slice(3);
    const nm = body.split("|")[0].trim();
    if (!nm) continue;
    const key = nm.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(nm);
  }
  return names;
}

function rollDie(sides){
  const s = Number(sides);
  if (![6, 20].includes(s)) throw new Error(`Unsupported die: d${s} (AETHERYN uses d6 and d20 only).`);
  try {
    // crypto.randomInt is inclusive of min, exclusive of max
    return crypto.randomInt(1, s + 1);
  } catch {
    return 1 + Math.floor(Math.random() * s);
  }
}

function rollD6(){
  return rollDie(6);
}

function rollD20(){
  return rollDie(20);
}

function rollDice(count, sides){
  const c = Math.max(1, Math.min(200, Number(count) || 1));
  const s = Number(sides);
  const rolls = [];
  for (let i = 0; i < c; i++) rolls.push(rollDie(s));
  return rolls;
}

function roll3d6Sum() {
  const dice = [rollDie(6), rollDie(6), rollDie(6)];
  const total = dice[0] + dice[1] + dice[2];
  return { dice, total };
}

function roll3d6DropLowest() {
  const dice = [rollDie(6), rollDie(6), rollDie(6)];
  const sum = dice[0] + dice[1] + dice[2];
  const dropped = Math.min(dice[0], dice[1], dice[2]);
  const keptSum = sum - dropped;
  return { dice, sum, dropped, total: keptSum };
}

function computeStatsFromRolls(rolls){
  const stats = {};
  const order = STAT_KEYS;
  for (const k of order) {
    const dice = Array.isArray(rolls?.[k]) ? rolls[k].map(n => Number(n)).filter(n => Number.isFinite(n)) : null;
    if (!dice || dice.length !== 3 || dice.some(n => n < 1 || n > 6)) {
      throw new Error(`Invalid dice for ${k}. Expected 3 numbers (1-6).`);
    }
    stats[k] = dice[0] + dice[1] + dice[2];
  }
  return stats;
}

function validateStatTotals(stats){
  const order = STAT_KEYS;
  for (const k of order) {
    const v = Number(stats?.[k]);
    if (!Number.isFinite(v) || v < 3 || v > 18) throw new Error(`Invalid ${k} total: ${stats?.[k]}`);
  }
  return true;
}


function getRes(tokens, resKey) {
  const key = String(resKey || "").trim();
  if (!key) return 0;
  for (const t of (tokens || [])) {
    const s = String(t || "").trim();
    if (!s.toLowerCase().startsWith("res:")) continue;
    // res:Coin_Aurum=17
    const body = s.slice(4).trim();
    const m = body.match(/^([^=]+)=(\d+)$/);
    if (!m) continue;
    const k = String(m[1] || "").trim();
    if (k.toLowerCase() !== key.toLowerCase()) continue;
    return Number(m[2]) || 0;
  }
  return 0;
}

function setRes(tokens, resKey, value) {
  const key = String(resKey || "").trim();
  const v = Math.max(0, Math.floor(Number(value) || 0));
  const out = [];
  let replaced = false;
  for (const t of (tokens || [])) {
    const s = String(t || "").trim();
    if (!s.toLowerCase().startsWith("res:")) {
      out.push(s);
      continue;
    }
    const body = s.slice(4).trim();
    const m = body.match(/^([^=]+)=(\d+)$/);
    if (!m) {
      out.push(s);
      continue;
    }
    const k = String(m[1] || "").trim();
    if (k.toLowerCase() !== key.toLowerCase()) {
      out.push(s);
      continue;
    }
    if (!replaced) {
      out.push(`res:${key}=${v}`);
      replaced = true;
    }
  }
  if (!replaced) out.push(`res:${key}=${v}`);
  return out;
}

function addAssetToken(tokens, asset) {
  const type = String(asset?.type || "").trim();
  const id = String(asset?.id || "").trim();
  const name = String(asset?.name || type || "asset").trim();
  const loc = String(asset?.loc || "").trim();
  const owner = String(asset?.owner || "").trim();
  const cost = Number(asset?.cost || 0) || 0;
  if (!type || !id || !loc) return tokens;
  const line = `asset:${type}|id=${id}|name=${name}|loc=${loc}|owner=${owner}${cost ? `|cost=${cost}` : ""}`;
  return (Array.isArray(tokens) ? tokens : []).concat([line]);
}

function parseAssetTokens(tokens) {
  const out = [];
  for (const t of (tokens || [])) {
    const s = String(t || "").trim();
    const low = s.toLowerCase();
    if (!(low.startsWith("asset:") || low.startsWith("asset="))) continue;

    const body = s.split(/[:=]/).slice(1).join(":").trim();
    const parts = body.split(/\s*\|\s*/).map(x => String(x || "").trim()).filter(Boolean);
    if (!parts.length) continue;

    const a = { type: "", id: "", name: "", loc: "", owner: "", raw: s, meta: {} };

    const first = parts.shift();
    if (/^[^:=]+\s*[:=]/.test(first)) {
      parts.unshift(first);
    } else {
      a.type = String(first || "").trim();
    }

    for (const seg of parts) {
      const m = seg.match(/^([^:=]+)\s*[:=]\s*(.+)$/);
      if (!m) continue;
      const k = String(m[1] || "").trim().toLowerCase();
      const v = String(m[2] || "").trim();
      if (!k) continue;
      if (k === "type" && !a.type) a.type = v;
      else if (k === "id") a.id = v;
      else if (k === "name" || k === "label" || k === "title") a.name = v;
      else if (k === "loc" || k === "location" || k === "area") a.loc = v;
      else if (k === "owner") a.owner = v;
      else a.meta[k] = v;
    }

    if (!a.type || !a.id || !a.loc) continue;
    if (!a.name) a.name = a.type;
    out.push(a);
  }
  return out;
}


function buildUnitToken(u) {
  const name = sanitizeTokenField(String(u?.name || '').trim(), 80);
  if (!name) return '';
  const str = Math.max(0, Math.min(99, Math.floor(Number(u?.str || u?.strength || 0) || 0)));
  const morale = Math.max(-99, Math.min(99, Math.floor(Number(u?.morale || 0) || 0)));
  const supply = sanitizeTokenField(String(u?.supply || 'stable').trim(), 20) || 'stable';
  const loc = sanitizeTokenField(String(u?.loc || '').trim(), 40);
  const owner = sanitizeTokenField(String(u?.owner || '').trim(), 80);

  const parts = [`str=${str}`, `morale=${morale}`, `supply=${supply}`];
  if (loc) parts.push(`loc=${loc}`);
  if (owner) parts.push(`owner=${owner}`);
  return `unit:${name}|${parts.join(';')}`;
}

function parseUnitToken(token) {
  const s = String(token || '').trim();
  const m = /^unit:([^|]+)\|(.+)$/i.exec(s);
  if (!m) return null;
  const name = String(m[1] || '').trim();
  const body = String(m[2] || '').trim();
  const out = { name, str: 0, morale: 0, supply: 'stable', loc: '', owner: '' };
  for (const part of body.split(';')) {
    const p = String(part || '').trim();
    if (!p) continue;
    const [kRaw, vRaw] = p.split('=');
    const k = String(kRaw || '').trim().toLowerCase();
    const v = String(vRaw || '').trim();
    if (k === 'str' || k === 'strength') out.str = Math.floor(Number(v) || 0);
    else if (k === 'morale') out.morale = Math.floor(Number(v) || 0);
    else if (k === 'supply') out.supply = v || out.supply;
    else if (k === 'loc') out.loc = v || '';
    else if (k === 'owner') out.owner = v || '';
  }
  return out;
}

function upsertUnitToken(tokens, u) {
  const out = [];
  const nm = sanitizeTokenField(String(u?.name || '').trim(), 80);
  if (!nm) return Array.isArray(tokens) ? tokens : [];
  const key = nm.toLowerCase();
  for (const t of (tokens || [])) {
    const s = String(t || '').trim();
    const low = s.toLowerCase();
    if (low.startsWith('unit:')) {
      const parsed = parseUnitToken(s);
      if (parsed && String(parsed.name || '').trim().toLowerCase() === key) continue;
    }
    out.push(s);
  }
  out.push(buildUnitToken({ ...u, name: nm }));
  return out;
}

function removeUnitToken(tokens, name) {
  const nm = sanitizeTokenField(String(name || '').trim(), 80);
  if (!nm) return Array.isArray(tokens) ? tokens : [];
  const key = nm.toLowerCase();
  const out = [];
  for (const t of (tokens || [])) {
    const s = String(t || '').trim();
    const low = s.toLowerCase();
    if (!low.startsWith('unit:')) { out.push(s); continue; }
    const parsed = parseUnitToken(s);
    if (parsed && String(parsed.name || '').trim().toLowerCase() === key) continue;
    out.push(s);
  }
  return out;
}


function assetAccessibleToActor(asset, actorName) {
  const owner = String(asset?.owner || "").trim();
  if (!owner) return true; // public
  const o = owner.toLowerCase();
  if (o === "party" || o === "group" || o === "all") return true;
  const me = String(actorName || "").trim().toLowerCase();
  return !!me && o === me;
}

function findUsableHouseAsset(tokens, { actorName, loc, assetId } = {}) {
  const assets = parseAssetTokens(tokens);
  const L = String(loc || "").trim();
  const idWant = String(assetId || "").trim();

  const atLoc = assets.filter(a => String(a.loc || "").trim().toLowerCase() === L.toLowerCase());
  const houses = atLoc.filter(a => {
    const ty = String(a.type || "").toLowerCase();
    return ty.includes("house") || ty === "home";
  });
  const usable = houses.filter(a => assetAccessibleToActor(a, actorName));
  if (!usable.length) return null;

  if (idWant) {
    const found = usable.find(a => String(a.id || "").trim().toLowerCase() === idWant.toLowerCase());
    if (found) return found;
  }
  return usable[0];
}

function makeId(prefix = "A") {
  return `${prefix}${Math.random().toString(16).slice(2, 7).toUpperCase()}${Date.now().toString(16).slice(-4).toUpperCase()}`;
}

function appendBookEntry(roomId, entry) {
  const roomState = getRoomState(roomId);
  if (!roomState.book) roomState.book = { entries: [], meta: normalizeBookMeta(null, []) };
  if (!roomState.book.meta) roomState.book.meta = normalizeBookMeta(null, roomState.book.entries);
  roomState.book.entries.push({
    ts: new Date().toISOString(),
    kind: String(entry?.kind || "narration"),
    text: String(entry?.text || "").trim(),
    meta: entry?.meta || null,
  });

  // Trim runaway logs (keeps the most recent 2000 entries)
  if (roomState.book.entries.length > 2000) {
    roomState.book.entries = roomState.book.entries.slice(-2000);
  }

  // Optional: defer disk writes + UI updates until a resolve finishes (prevents Book from updating mid-turn).
  if (roomState._deferBookUpdates) {
    try {
      roomState._bookDeferDirty = true;
      roomState._bookDeferLast = { kind: String(entry?.kind || 'narration'), text: String(entry?.text || '').trim() };
    } catch {}
    return;
  }

  saveBook(roomId, roomState.book.entries, roomState.book.meta);

  // Real-time Book updates for in-page Book tab
  try {
    const text = renderBookText(roomState.book.entries || []);
    const lastKind = String(entry?.kind || "narration");
    const lastNarration = String(entry?.text || "").trim();
    io.to(roomId).emit("book_update", { roomId, text, lastKind, lastNarration });
  } catch {}
}

function flushBookUpdates(roomId) {
  const roomState = getRoomState(roomId);
  if (!roomState || !roomState.book || !Array.isArray(roomState.book.entries)) return;
  if (!roomState._bookDeferDirty) return;

  roomState._bookDeferDirty = false;
  const last = roomState._bookDeferLast || null;
  roomState._bookDeferLast = null;

  try { saveBook(roomId, roomState.book.entries, roomState.book.meta); } catch {}

  try {
    const text = renderBookText(roomState.book.entries || []);
    const lastKind = last ? String(last.kind || 'narration') : 'narration';
    const lastNarration = last ? String(last.text || '').trim() : '';
    io.to(roomId).emit('book_update', { roomId, text, lastKind, lastNarration });
  } catch {}
}


function getActorName(roomState, socket) {
  const sid = socket?.id;
  const joinName = String(socket?.data?.name || "Anonymous");
  // Prefer a stable socket-bound character name (survives reconnects if client sends it on join).
  const sockChar = String(socket?.data?.charName || "").trim();
  const intakeChar = String(roomState?.intakePlayers?.[sid]?.answers?.q9 || "").trim();
  return sockChar || intakeChar || joinName;
}

function normalizeActorName(roomState, socket) {
  // Canonicalize actor name to the roster when possible (prevents solo "waiting for players" loops
  // caused by joinName/charName mismatches across reconnects).
  let actor = getActorName(roomState, socket);
  const roster = Array.isArray(roomState?.playerCharNames) ? roomState.playerCharNames : [];

  const expectedPlayers = Number(roomState?.expectedPlayers || 0) || 0;
  const soloLike = !!roomState?.isSingle || expectedPlayers === 1;

  // If we're in STATS and there is exactly one pc:...|stats: token, treat that as canonical for this socket.
  // This prevents drift where a player rolled stats under one name and reconnects under another.
  try {
    if (roomState && hasModeToken(roomState.canon?.tokens || [], "STATS") && soloLike) {
      const pcStatsNames = [];
      for (const t of (roomState.canon?.tokens || [])) {
        const parsed = parsePcStatsToken(t);
        if (parsed && parsed.name) pcStatsNames.push(String(parsed.name).trim());
      }
      const uniq = Array.from(new Set(pcStatsNames.filter(Boolean).map(n => sanitizeTokenField(n, 80).toLowerCase())));
      if (uniq.length === 1) {
        const exact = pcStatsNames.find(n => sanitizeTokenField(n, 80).toLowerCase() === uniq[0]);
        if (exact) {
          try { socket.data.charName = exact; } catch {}
          return exact;
        }
      }
    }
  } catch {}

  // Solo: if exactly one roster name exists, always use it.
  if (soloLike && roster.length === 1) {
    const r0 = String(roster[0] || "").trim();
    if (r0) {
      try { socket.data.charName = r0; } catch {}
      return r0;
    }
  }

  const actorKey = sanitizeTokenField(actor, 80).toLowerCase();
  if (roster.length && actorKey) {
    for (const r of roster) {
      const rk = sanitizeTokenField(r, 80).toLowerCase();
      if (rk && rk === actorKey) {
        const rr = String(r || "").trim();
        if (rr) {
          try { socket.data.charName = rr; } catch {}
          return rr;
        }
      }
    }
  }

  // Fallback: trim whitespace for stability.
  actor = String(actor || "").trim() || "Anonymous";
  try { socket.data.charName = actor; } catch {}
  return actor;
}


// -------------------- RULEKEEPER: rules + state update --------------------
const PROTECTED_TOKEN_PREFIXES = [
  'asset:', 'asset=',
  'stash:', 'stash=',
  'res:', 'res=',
  'inv:', 'inv=',
  'eq:', 'eq=',
  'equip:', 'equip=',
  'loc:', 'loc=',
  'time:', 'time=',
  'clock:', 'clock=',
  'day:', 'day=',
  'pressure:', 'pressure=',
  'residue:', 'residue=',
  'pos:', 'pos=',
  'hp:', 'hp=',
  'mp:', 'mp=',
  'stamina:', 'stamina=',
  'party:', 'party=',
  'pc:', 'pc=',
  'pcbio:', 'pcbio=',
  'pcstart:', 'pcstart=',
  'unit:', 'unit=',
  'cfg:', 'cfg=',
  'mode:', 'mode=',
  'flag:', 'flag='
];
// -------------------- AI workload controls --------------------
// Goal: fewer LLM calls and less redundant context.
// Modes:
//  - unified (default): one LLM call per player action (state + narration + choices)
//  - split: rules + narration (2 calls) (legacy)
//  - full: bookscribe + rules + narration (3 calls) (legacy)
const AI_PIPELINE = String(process.env.AI_PIPELINE || "unified").trim().toLowerCase();

// Bookscribe (player choice lines in the Book transcript):
//  - local (default): cheap local rewrite (no LLM call)
//  - llm: use the book model to rewrite actions
//  - off: do not rewrite; store raw action
const BOOKSCRIBE_MODE = String(process.env.BOOKSCRIBE_MODE || "local").trim().toLowerCase();

// Book should read like a book. By default we do NOT record raw player action lines (choices) into the Book.
// Toggle with BOOK_INCLUDE_ACTION_LINES=on if you want a transcript that includes player-declared actions.
const BOOK_INCLUDE_ACTION_LINES = String(process.env.BOOK_INCLUDE_ACTION_LINES || "off").trim().toLowerCase() === "on";

// Unified call output cap
// Default increased to reduce "prologue + choices only" truncation and to allow real scene paragraphs.
const UNIFIED_MAX_TOKENS = Number(process.env.UNIFIED_MAX_TOKENS || 3600);
// Kickoff needs extra headroom (opening scene tends to be longer than normal beats).
const UNIFIED_KICKOFF_MIN_TOKENS = Number(process.env.UNIFIED_KICKOFF_MIN_TOKENS || 3200);

// If kickoff prose keeps failing or getting lost, force a deterministic local opening scene.
// Default: ON (set FORCE_LOCAL_KICKOFF=0 to re-enable LLM kickoff).
const FORCE_LOCAL_KICKOFF = String(process.env.FORCE_LOCAL_KICKOFF || '1').trim() !== '0';

// Retrieval tuning for unified pipeline (smaller = less context work for the model)
const RETRIEVE_K_UNIFIED = Number(process.env.RETRIEVE_K_UNIFIED || Math.min(4, Number(process.env.RETRIEVE_K || 6)));

// Build a conservative list of party:* tokens that should exist based on server-known roster/intake.
// Purpose: if a new player joins (or intake just completed) and the model output doesn't yet include
// a party token for them, we can merge them into canon deterministically.
function buildCandidatePartyTokens(roomState) {
  const out = [];
  const seen = new Set();

  const addName = (name) => {
    const nm = sanitizeTokenField(String(name || '').trim(), 80);
    if (!nm) return;
    const key = nm.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(`party:${nm}`);
  };

  try {
    const roster = Array.isArray(roomState?.playerCharNames) ? roomState.playerCharNames : [];
    for (const n of roster) addName(n);
  } catch {}

  // Fallback during/around intake processing.
  try {
    const intake = roomState?.intakePlayers && typeof roomState.intakePlayers === 'object' ? roomState.intakePlayers : null;
    if (intake) {
      for (const sid of Object.keys(intake)) {
        const p = intake[sid] || {};
        const a = p.answers || {};
        addName(a.q9 || p.joinName || '');
      }
    }
  } catch {}

  // Fallback: if stats tokens exist, treat their names as party members.
  try {
    const toks = Array.isArray(roomState?.canon?.tokens) ? roomState.canon.tokens : [];
    for (const t of toks) {
      const parsed = parsePcStatsToken(t);
      if (parsed?.name) addName(parsed.name);
    }
  } catch {}

  return out;
}






// Compact canon token dump for small local models (especially kickoff).
// Goal: keep the model grounded without blowing the context window.
function compactCanonTokensForPrompt(tokens, { isKickoff = false, maxLines = 280, maxChars = 14000 } = {}) {
  try {
    const arr = Array.isArray(tokens) ? tokens.map(t => String(t || '').trim()).filter(Boolean) : [];
    if (!arr.length) return '';

    // Prefer important token families first.
    const keep = isKickoff
      ? ['mode:', 'flag:', 'loc:', 'pos:', 'xy:', 'party:', 'pc:', 'pcbio:', 'inv:', 'eq:', 'equip:', 'stash:', 'res:', 'asset:', 'unit:', 'time:', 'clock:', 'day:', 'pressure:', 'residue:']
      : ['mode:', 'flag:', 'loc:', 'pos:', 'xy:', 'party:', 'pc:', 'pcbio:', 'inv:', 'eq:', 'equip:', 'stash:', 'res:', 'asset:', 'unit:'];

    const picked = [];
    const seen = new Set();

    const add = (s) => {
      const k = s.toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      picked.push(s);
    };

    // 1) Keep the important families in-order.
    for (const pref of keep) {
      const p = String(pref || '').toLowerCase();
      for (const t of arr) {
        if (t.toLowerCase().startsWith(p)) add(t);
        if (picked.length >= maxLines) break;
      }
      if (picked.length >= maxLines) break;
    }

    // 2) If there's still room, append the tail (recent additions tend to matter).
    if (picked.length < maxLines) {
      for (const t of arr.slice(-Math.max(0, maxLines - picked.length))) {
        if (picked.length >= maxLines) break;
        add(t);
      }
    }

    let out = picked.join('\n');
    if (out.length > maxChars) out = out.slice(0, maxChars) + "\n…(truncated)";
    return out;
  } catch {
    return Array.isArray(tokens) ? tokens.join('\n') : '';
  }
}
async function callLLMUnifiedTurn({ roomId, playerText, actorName, actingPlayerId, observed_items = null, restartCount = 0 }) {
  const roomState = getRoomState(roomId);
  const candidatePartyTokens = buildCandidatePartyTokens(roomState);
  const continuity = getCompactContinuity(roomId, { actor: actorName || "" });
  const recentBeatsText = (continuity.recent_beat_summaries || []).map((b, i) => `${i + 1}) ${b}`).join("\n") || "(empty)";


  // Drift-guard anchors (server-side): keep the model in the current scene and force it to acknowledge the action.
  const currentLoc = extractLoc(roomState?.canon?.tokens || []);
  const isKickoff = String(actorName || '').trim().toUpperCase() === 'SYSTEM' && /^\s*BEGIN_PLAY:/m.test(String(playerText || ''));
  const devPurpose = isKickoff ? 'kickoff_unified' : 'unified_turn';
  const locAnchors = (!isPlaceholderLoc(currentLoc)) ? extractAnchorWords(currentLoc, { max: 6 }) : [];
  // Kickoff (SYSTEM cold-open) is instruction text, not a player action. Do not require action anchors.
  const actionAnchors = isKickoff ? [] : extractAnchorWords(playerText, { max: 8 });

  // Connected players (for POV + identity grounding)
  let connectedPlayers = [];
  try {
    const sockets = await io.in(roomId).fetchSockets();
    connectedPlayers = (sockets || []).map(s => {
      const pid = (roomState.socketToPlayerId && roomState.socketToPlayerId[s.id]) ? String(roomState.socketToPlayerId[s.id]) : String(s?.data?.playerId || '').trim();
      const nm = String(s?.data?.name || 'Anonymous').trim();
      const primary = String(s?.data?.charName || '').trim() || nm;
      const list = (Array.isArray(s?.data?.charNames) && s.data.charNames.length)
        ? s.data.charNames.map(x => String(x || '').trim()).filter(Boolean)
        : (primary ? [primary] : []);
      const isHost = roomState.hostSocketId === s.id;
      return { playerId: (pid || null), name: nm, charName: primary, charNames: list, isHost };
    });
  } catch { connectedPlayers = []; }

  const playersContext = connectedPlayers.length
    ? connectedPlayers.map(p => {
        const chars = Array.isArray(p.charNames) && p.charNames.length ? p.charNames : (p.charName ? [p.charName] : []);
        const who = chars.length > 1 ? chars.join(' + ') : (chars[0] || '(unknown)');
        return `- ${p.playerId || '(unbound)'} :: ${p.name} as ${who}${p.isHost ? ' (HOST)' : ''}`;
      }).join('\n')
    : '(none)';
  const expectedPovIds = connectedPlayers.map(p => String(p.playerId || '').trim()).filter(Boolean);

  // Observable teammate activity (server-side). This is NOT a UI block.
  // It exists solely so the model can weave teammate actions into the next beat's prose.
  const obsItems = Array.isArray(observed_items) ? observed_items.slice(0, 8) : [];
  const obsBlock = obsItems.length
    ? obsItems.map((it, i) => {
        const who = sanitizeTokenField(String(it?.who || '').trim(), 80);
        const act = sanitizeTokenField(String(it?.action || '').trim(), 160);
        const out = sanitizeTokenField(String(it?.outcome || '').trim(), 180);
        const dft = Math.max(0, Math.floor(Number(it?.dist_feet) || 0));
        const near = !!it?.near;
        const quiet = !!it?.quiet;
        return `${i+1}) who=${who || '(unknown)'}; dist_ft=${dft}; near=${near}; quiet=${quiet}; action="${act}"; outcome="${out}"`;
      }).join("\n")
    : "(none)";

  const queryText =
    `${continuity.scene_summary ? ("SCENE_SUMMARY:\n" + continuity.scene_summary + "\n\n") : ""}` +
    `${continuity.last_narration_snippet ? ("RECENT_NARRATION:\n" + continuity.last_narration_snippet + "\n\n") : ""}` +
    `PLAYER_INPUT:\n${playerText}\n\nSNAPSHOT_TOKENS:\n${continuity.snapshotTokens.join("\n")}`;

  const pinnedIds = Array.isArray(PINNED_CANON_CHUNKS) ? PINNED_CANON_CHUNKS : [];

  let lastValidation = null;
  let lastErr = "";

  const baseTimeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? 120000);
  const isIntake = /^\s*INTAKE_COMPLETE/m.test(String(playerText || ""));
  const intakeTimeoutMs = Number(process.env.LLM_TIMEOUT_MS_INTAKE || (baseTimeoutMs * 2));
  // Kickoff (BEGIN_PLAY cold-open) should never hang the UI for minutes.
  // Prefer a shorter timeout and fall back to code-authored prose if needed.
  const kickoffNoTimeout = isKickoff && String(process.env.KICKOFF_NO_TIMEOUT || '0').trim() === '1';
  const kickoffTimeoutMs = kickoffNoTimeout ? 0 : Math.min(baseTimeoutMs, Number(process.env.LLM_TIMEOUT_MS_KICKOFF || 45000));

  const maxAttemptsAll = (HALLUCINATION_GUARD ? HALLUCINATION_MAX_ATTEMPTS : 1);
  // Kickoff: use a lighter prompt by default (no retrieval dump) to keep local models from timing out.
  const kickoffLite = isKickoff && String(process.env.KICKOFF_UNIFIED_LITE || '1').trim() !== '0';
  // Kickoff should be fast; avoid retry spirals—fall back instead.
  const maxAttempts = isKickoff ? 1 : maxAttemptsAll;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Adaptive retrieval: escalate K on retries.
    const k = kickoffLite ? 0 : Math.max(1, Math.min(14, Number(RETRIEVE_K_UNIFIED || 4) + ((attempt - 1) * 3)));
    const retrieved = (k > 0) ? retrieveCanonChunksWithK(queryText, k) : [];
    const retrievedIds = retrieved.map(c => c.id);
    const canonBlock = retrieved.map(c => `\n\n[CANON_CHUNK ${c.id}]\n${c.text}`).join("");

    // Gear context (prevents choices like "use your crowbar" when none exists)
    const gearCtx = buildGearContext(roomState?.canon?.tokens || [], actorName || '');
    const gearPromptBlock = (gearCtx?.lines && gearCtx.lines.length)
      ? gearCtx.lines.join("\n")
      : "(none)";

    const system = `
You are AETHERYN_UNIFIED_GM.
You must do BOTH jobs in ONE response:
1) Update factual state (canon_tokens + ops)
2) Write cinematic narration (narration)

ACTOR_NAME (who sent PLAYER_INPUT):
${sanitizeTokenField(actorName || '', 80) || '(unknown)'}

ACTING_PLAYER_ID (server-authoritative for the sender; do NOT confuse with host):
${String(actingPlayerId || '').trim() || '(unknown)'}

CURRENT_LOC (HARD, scene anchor):
${isPlaceholderLoc(currentLoc) ? 'UNKNOWN' : (String(currentLoc || '').trim() || 'UNKNOWN')}

DRIFT-GUARD ANCHORS (HARD):
- Location anchors: ${locAnchors.length ? locAnchors.join(', ') : '(none)'}
- Action anchors: ${actionAnchors.length ? actionAnchors.join(', ') : '(none)'}

ACTION DISCIPLINE (HARD):
- Your narration MUST explicitly acknowledge the PLAYER_INPUT before adding unrelated atmosphere.
- Mention at least one Action anchor term above (or restate the action clearly).
- Stay in CURRENT_LOC; do not cut away to other places/biomes unless the action is explicit movement AND you include a set_loc op.

PROSE STYLE (HARD):
- Write like a tight scene in a novel: specific verbs, grounded physicality, and human cadence.
- Do NOT dump setting lore unless it is directly prompted by the action.
- No stage directions, no meta commentary, no UI talk.
- Avoid repeating prior beats; each beat should move forward.

PER-PLAYER "BOOK" STYLE (HARD):
- Every pov{} / pov_char{} entry should read like that character's own running book.
- Make each entry understandable without reading other players' POV streams.
- Start with 1–2 sentences that re-anchor the moment (what you see/hear, where you are, what just changed for you).
- If another PC's action is visible/audible, acknowledge it naturally in-line (no headings, no recap lists).

TEAM ACTIVITY INTEGRATION (HARD):
- If OBSERVABLE_TEAM_ACTIVITY below is not "(none)", it represents recent teammate actions the ACTOR could plausibly see/hear.
- You MUST weave those facts into the narration/POV as natural background motion and consequences.
- Do NOT output it as a heading, list, sidebar, or recap. Do NOT say "nearby activity".
- Use it to make the scene feel like a living party, with overlapping motion and quick reactions.

CONTINUITY_MEMORY (not authoritative; if conflict, Canon/Tokens win):
SCENE_SUMMARY:
${continuity.scene_summary || "(empty)"}

RECENT_NARRATION_SNIPPET:
${continuity.last_narration_snippet || "(empty)"}

RECENT_BEAT_SUMMARIES:
${recentBeatsText}

GM_HIDDEN_SUMMARY (server-side only; NEVER reveal directly to players):
${continuity.gm_hidden_summary || "(empty)"}

ALWAYS READ FIRST (binding index + usage rules):
${INDEX_FIRST}

RETRIEVED CANON CHUNKS (binding where applicable):
${canonBlock}

AVAILABLE GEAR (HARD, authoritative):
- You may ONLY reference specific items/tools in narration or choices if they exist here (inventory/equipment/stash) OR are explicitly introduced as a visible scene object this turn.
- If a tool is not listed, do NOT imply it exists. Offer a generic action like "search for tools" instead.
${gearPromptBlock}

CONNECTED PLAYERS (each is an independent viewpoint; host is admin only, not a puppet-master):
${playersContext}

OBSERVABLE_TEAM_ACTIVITY (server-side context; DO NOT output as a list):
${obsBlock}

POV (HARD IN MULTIPLAYER):
- Return a pov{} object mapping each connected playerId to a POV narration for that player.
- POV narration must be limited to what that character can perceive. Never narrate other PCs' private thoughts or intentions.
- Keep events consistent across POVs; differences should be emphasis/angle, not contradictions.

COUCH CO-OP POV (HARD WHEN A DEVICE CONTROLS MULTIPLE CHARACTERS):
- Some players control MORE THAN ONE character on the same device (couch co-op).
- In that case, also return a pov_char{} object mapping EACH CHARACTER NAME to a POV narration for that character.
- The server will only deliver pov_char entries to the device that controls those characters. Other players must never see them.
- pov_char entries must be consistent with each other and with the shared world state.

OUTPUT REQUIREMENT (STRICT):
Return ONLY a single valid JSON object (no markdown, no extra text).
Your output must start with { and end with }.

ANTI-HALLUCINATION / ANTI-DRIFT (HARD):
- You may ONLY assert world facts (history, institutions, geography, named places/factions) if supported by CURRENT_CANON_TOKENS or the RETRIEVED CANON CHUNKS above.
- If something is not supported, you MUST mark it explicitly as one of: UNKNOWN, RUMOR, or THEORY. Do not present it as fact.
- Do NOT invent new places, factions, or institutions. For wilderness: if you cannot ground a proper name, describe it generically ("an unnamed ravine" / "wilderness ridge at the party's coordinates").


TOKEN LEAK PREVENTION (HARD):
- Never print raw token strings (e.g., "loc:...", "xy:...", "mode:...") in narration or POV.
- If CURRENT_LOC is UNMAPPED/UNKNOWN/START, treat the party's exact location as unknown. Describe only what the characters can sense. Do not name the place or reveal coordinates unless the narration itself earns that knowledge.

GM HIDDEN SUMMARY (HARD):
- ALWAYS include gm_hidden_summary in your JSON. It is GM-only and never shown to players.
- It must carry forward any still-relevant hidden facts from the previous GM_HIDDEN_SUMMARY.
- You may include secrets and NPC intent, but they must be grounded in canon/tokens; otherwise mark UNKNOWN/RUMOR/THEORY.

SOURCES (HARD):
- Include a sources[] array listing the CANON_CHUNK IDs you relied on for any strong worldbuilding claim.
- sources[] must contain ONLY IDs from the RETRIEVED CANON CHUNKS (and must include ALL pinned chunk IDs).

IMPORTANT (SIZE + RELIABILITY):
- Prefer to OMIT "canon_tokens". If you omit it (or set it to null), the server will keep the current tokens and apply your ops[].
- Only include "canon_tokens" if you are adding small, non-protected informational tokens.
- Never include protected token families in canon_tokens: loc/time/clock/day/pressure/residue/pos/hp/mp/stamina/party/res/inv/eq/equip/stash/asset/unit/pc/pcbio/cfg/mode/flag.

Allowed ops (do NOT invent new ops):
advance_time, set_loc, apply_damage, apply_heal, set_party_status, consume_item, spend_res, gain_item, buy_asset, gain_asset, queue_delivery, adjust_pressure, adjust_residue

Schema:
{
  "narration": "3-6 paragraphs, naturalistic and story-forward. Present tense. Show concrete sensory detail + character interaction. Use occasional quoted dialogue. Avoid recaps, bullet lists, and meta headings. NO CHOICES BLOCK.",
  "pov": { "p_example": "POV narration for that player (2-5 paragraphs, present tense, second-person)." },
  "pov_char": { "Arden": "POV narration for Arden...", "Kael": "POV narration for Kael..." },
  "canon_tokens": null,
  "beat_summary": "1-3 sentence factual summary of what is now true",
  "gm_hidden_summary": "GM-only continuity notes (60-160 words). Include secrets, NPC intent, unseen threats, and unresolved clues. Facts only. DO NOT reveal directly to players.",
  "choices": [
    "Choice 1",
    "Use a tool from AVAILABLE GEAR to secure a line.",
    "Choice 3",
    "Freeform: ..."
  ],
  "ops": [{"op":"advance_time","minutes":10}],
  "sources": ["${pinnedIds[0] || ''}"]
}

MECHANICS DISPLAY (HARD):
- If PLAYER_INPUT contains "[ACTION_CHECK" or "[COMBAT_CHECK", you MUST use the provided Roll/Target/Delta to determine outcomes.
- Do NOT mention roll totals, targets, modifiers, or deltas/margins in narration or POV. Mechanics stay out of prose.

SCOPE (HARD):
- You only operate inside AETHERYN. Do not answer real-world questions, general advice, news, politics, medicine, law, finance, or unrelated tech.
- If an out-of-scope request slips past the local gate, keep canon_tokens unchanged, set beat_summary to "Out-of-scope request blocked.", and offer choices that return to play.

DISCIPLINE:
MECHANICS ARE CODE-OWNED (HARD):
- You must NOT directly change these token families: loc:, time:, clock:, day:, hp:, mp:, stamina:, party:, res:, inv:, eq:, equip:, stash:, asset:, pc:.
- When travel/time/harm/healing/loot should happen, include an op in ops[]. The server applies ops and keeps tokens authoritative.
- For loot / found items: NEVER add inv:/res: directly. Use ops:[{op:'gain_item', item:'...', qty:N, reason:'...'}].
- For purchased items: pair a spend_res op with a gain_item op (price is narrative / in-world).

CHOICES (HARD):
- ALWAYS return at least 5 choices.
- Include "Freeform: ..." as the last choice.
- Choices should be concrete, player-actionable, and consistent with the narration.
- If a choice depends on a specific item/tool, ONLY use items that exist in AVAILABLE GEAR above.
- Never write choices like "Use your crowbar" unless that item exists. Prefer "Search for a prybar/tool" when uncertain.

No markdown. No extra text. JSON only.
`;

    const bookEvidence = buildBookEvidence(roomId, `${continuity.scene_summary || ""}\n${continuity.last_narration_snippet || ""}\n${playerText || ""}`, {
      maxHits: 2,
      maxChars: 900,
      maxSnippetChars: 420,
      lastNEntries: 180
    });
    const canonTokensDump = isKickoff
      ? compactCanonTokensForPrompt(roomState.canon.tokens, {
          isKickoff: true,
          maxLines: Number(process.env.CANON_DUMP_MAX_LINES_KICKOFF || 120),
          maxChars: Number(process.env.CANON_DUMP_MAX_CHARS_KICKOFF || 6000),
        })
      : roomState.canon.tokens.join("\n");


    const messages = [
      { role: "system", content: system },
      { role: "user", content: `CURRENT_CANON_TOKENS:\n${canonTokensDump}` },
      { role: "user", content:
`CONTINUITY_MEMORY:
SCENE_SUMMARY:
${continuity.scene_summary || "(empty)"}

RECENT_BEAT_SUMMARIES:
${recentBeatsText || "(empty)"}

RECENT_NARRATION_SNIPPET:
${continuity.last_narration_snippet || "(empty)"}` }
    ];

    if (bookEvidence) {
      messages.push({ role: "user", content: `BOOK_LOOKUP_EVIDENCE:\n${bookEvidence}` });
    }
    messages.push({ role: "user", content: `PLAYER_INPUT:\n${playerText}` });

    if (attempt > 1 && lastValidation) {
      messages.push({ role: 'user', content: buildRepairInstruction(lastValidation) });
    }

    const t0 = Date.now();
    emitAiWait(roomId, true, "unified", `attempt ${attempt}/${maxAttempts}`);
    let content = "";
    let callErr = null;

    // Kickoff turns (SYSTEM + BEGIN_PLAY) need extra output headroom to actually write the opening scene.
    const unifiedTokCap = Number(process.env.UNIFIED_MAX_TOKENS || UNIFIED_MAX_TOKENS || 1400);
    const kickoffTokCap = Number(process.env.UNIFIED_MAX_TOKENS_KICKOFF || Math.min(unifiedTokCap, 1100));
    const kickoffNoMax = isKickoff && String(process.env.KICKOFF_NO_MAXTOKENS || '0').trim() === '1';
    // For Ollama, -1 means "no cap". For OpenAI-compat, the adapter will omit max_tokens when <= 0.
    const maxTok = kickoffNoMax
      ? -1
      : (isKickoff ? Math.max(600, Math.min(kickoffTokCap, unifiedTokCap)) : unifiedTokCap);
    try {
      content = await callLLMRole("rules", {
        devMeta: { roomId, purpose: devPurpose },
        messages,
        temperature: Number(process.env.RULES_TEMPERATURE || 0.15),
        maxTokens: maxTok,
        timeoutMs: isIntake ? intakeTimeoutMs : (isKickoff ? kickoffTimeoutMs : undefined),
        ollamaOptions: {
          num_ctx: Number(process.env.OLLAMA_NUM_CTX_RULES || process.env.OLLAMA_NUM_CTX || 4096),
          repeat_last_n: Number(process.env.OLLAMA_REPEAT_LAST_N || 256),
          repeat_penalty: Number(process.env.OLLAMA_REPEAT_PENALTY || 1.15),
          top_k: Number(process.env.OLLAMA_TOP_K || 40),
          top_p: Number(process.env.OLLAMA_TOP_P || 0.9),
        }
      });
    } catch (e) {
      callErr = e;
    } finally {
      const ms = Date.now() - t0;
      emitAiWait(roomId, false, "unified", `${ms}ms`);
    }

    if (callErr) {
      lastErr = `Unified GM call failed (attempt ${attempt}): ${String(callErr?.message || callErr)}`;
      if (isKickoff) {
        // Kickoff should not spam attempts on slow local models; let the caller fall back immediately.
        throw callErr;
      }
      lastValidation = { errors: [lastErr], warnings: [] };
      try {
        devPush({
          type: 'unified_reject',
          roomId: String(roomId || '').trim() || undefined,
          purpose: devPurpose,
          attempt,
          stage: 'llm_error',
          message: lastErr
        });
      } catch {}
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      const recoveredBest = extractBestUnifiedJsonObject(content);
      const recoveredFirst = recoveredBest ? null : extractFirstJsonObject(content);
      const recovered = recoveredBest || recoveredFirst;
      if (recovered) {
        parsed = recovered;
        try {
          devPush({
            type: 'unified_note',
            roomId: String(roomId || '').trim() || undefined,
            purpose: devPurpose,
            attempt,
            message: recoveredBest
              ? 'JSON.parse failed; recovered best-matching unified JSON object from model output.'
              : 'JSON.parse failed; recovered first JSON object from model output.'
          });
        } catch {}
      } else {
        lastErr = `Unified GM did not return valid JSON (attempt ${attempt}).`;
        lastValidation = { errors: [lastErr], warnings: [] };
        try {
          const c = String(content || '');
          const head = c.slice(0, 260);
          const tail = c.length > 520 ? (' … ' + c.slice(-260)) : '';
          devPush({
            type: 'unified_reject',
            roomId: String(roomId || '').trim() || undefined,
            purpose: devPurpose,
            attempt,
            stage: 'json_parse',
            message: lastErr,
            sample: (head + tail)
          });
        } catch {}
        continue;
      }
    }

    // --- Server forgiveness layer (pre-firewall) ---
    // 1) Ensure pinned sources are always present (server already knows what it pinned).
    _injectPinnedSources(parsed, pinnedIds);
    // 2) Ensure at least 5 choices exist (append safe generics rather than hard-failing).
    _ensureMinChoices(parsed, 5);
    // 3) Ensure ops is an array (downstream ops application expects an array).
    if (!Array.isArray(parsed.ops)) parsed.ops = [];

    // Validate output against retrieved canon + registry. Auto-regenerate on failure.
    if (HALLUCINATION_GUARD) {
      let v = validateUnifiedTurnOutput({
        parsed,
        retrievedIds,
        pinnedIds,
        registry: ENTITY_REGISTRY,
        expectedPovIds,
        requirePov: (expectedPovIds.length > 1) && !isKickoff,
        actionAnchors,
        locAnchors,
        gear: (gearCtx && gearCtx.names && gearCtx.keywords) ? { names: gearCtx.names, keywords: gearCtx.keywords } : null
      });

      // 4) If the only thing missing is location grounding (or narration is missing),
      // prepend a short location anchor sentence server-side and re-run the firewall.
      if (!v.ok) {
        const errs = Array.isArray(v.errors) ? v.errors : [];
        const needsLoc = errs.some(e => String(e || '').includes('missing location anchors'));
        const needsNarr = errs.some(e => String(e || '').includes('Missing narration'));
        if (needsLoc || needsNarr) {
          const changed = _prependLocationAnchorIfNeeded(parsed, { currentLoc, locAnchors });
          if (changed) {
            v = validateUnifiedTurnOutput({
              parsed,
              retrievedIds,
              pinnedIds,
              registry: ENTITY_REGISTRY,
              expectedPovIds,
              requirePov: (expectedPovIds.length > 1) && !isKickoff,
              actionAnchors,
              locAnchors,
              gear: (gearCtx && gearCtx.names && gearCtx.keywords) ? { names: gearCtx.names, keywords: gearCtx.keywords } : null
            });
            try {
              devPush({
                type: 'unified_note',
                roomId: String(roomId || '').trim() || undefined,
                purpose: devPurpose,
                attempt,
                message: 'Applied server patch: prepended location anchor sentence and re-validated.'
              });
            } catch {}
          }
        }
      }
      if (!v.ok) {
        lastValidation = v;
        lastErr = (v.errors || []).join(' | ');
        try {
          devPush({
            type: 'unified_reject',
            roomId: String(roomId || '').trim() || undefined,
            purpose: devPurpose,
            attempt,
            stage: 'firewall',
            message: lastErr,
            errors: Array.isArray(v.errors) ? v.errors.slice(0, 20) : [],
            warnings: Array.isArray(v.warnings) ? v.warnings.slice(0, 20) : [],
            details: (v && typeof v.details === 'object') ? v.details : {},
            k,
            retrievedIds: Array.isArray(retrievedIds) ? retrievedIds.slice(0, 16) : [],
            pinnedIds: Array.isArray(pinnedIds) ? pinnedIds.slice(0, 16) : []
          });
        } catch {}
        continue;
      }
    }

    // --- Apply mechanics (server-authoritative) ---
    const prevTokens = Array.isArray(roomState.canon.tokens) ? [...roomState.canon.tokens] : [];
    let nextTokens = Array.isArray(parsed.canon_tokens) ? parsed.canon_tokens : prevTokens;

    nextTokens = preserveProtectedTokens(prevTokens, nextTokens, PROTECTED_TOKEN_PREFIXES);
    nextTokens = mergeNewPartyMembers(prevTokens, nextTokens, candidatePartyTokens);
    nextTokens = enforceNoFreeGainsWithStashAndEq(prevTokens, nextTokens);

    try {
      nextTokens = applyOpsToTokens(roomId, prevTokens, nextTokens, Array.isArray(parsed.ops) ? parsed.ops : [], { actorName: actorName || '', playerText });
    } catch {}

    roomState.canon.tokens = nextTokens;
    const normChoices = normalizeChoicesArray(parsed.choices);
    if (Array.isArray(normChoices.out)) roomState.lastChoices = normChoices.out;
    try { roomState._lastChoicesMeta = Array.isArray(normChoices.meta) ? normChoices.meta : []; } catch {}

    // Update GM-only hidden continuity summary (never sent to clients).
    try {
      const mem = ensureMemory(roomState);
      const gh = String(parsed.gm_hidden_summary || parsed.gm_hidden || "").trim();
      if (gh) {
        mem.gm_hidden_summary = gh.slice(0, 8000);
      } else if (!String(mem.gm_hidden_summary || "").trim()) {
        // Fallback: keep *something* for the GM brain, even if the model omitted the field.
        const bs = String(parsed.beat_summary || "").trim();
        if (bs) mem.gm_hidden_summary = `Known truths so far: ${bs}`.slice(0, 8000);
      }
    } catch {}

    // Track sources for debugging (server-side only).
    try {
      roomState._lastSources = Array.isArray(parsed.sources) ? parsed.sources : [];
    } catch {}

    saveRoomStateFile(roomId);

    return {
      canon_tokens: roomState.canon.tokens,
      beat_summary: String(parsed.beat_summary || ""),
      choices: Array.isArray(normChoices.out) ? normChoices.out : [],
      narration: String(parsed.narration || ""),
      pov: (parsed && typeof parsed.pov === "object" && parsed.pov) ? parsed.pov : null,
      pov_char: (parsed && typeof parsed.pov_char === "object" && parsed.pov_char) ? parsed.pov_char : null,
      sources: Array.isArray(parsed.sources) ? parsed.sources : []
    };
  }

  // If we got here, all attempts failed.
  const extra = lastErr ? ` Last error: ${lastErr}` : '';

  // Self-heal: if the unified output keeps failing validation, fully restart the generation twice,
  // with a short delay. This avoids deadlocks from transient state mismatch.
  const rc = Math.max(0, Math.floor(Number(restartCount) || 0));
  if (!isKickoff && rc < 2) {
    await new Promise(r => setTimeout(r, 2000));
    return await callLLMUnifiedTurn({ roomId, playerText, actorName, actingPlayerId, observed_items, restartCount: rc + 1 });
  }

  throw new Error(`Unified GM output rejected by firewall.${extra}`);
}

// -------------------- NARRATOR (LLM, provider-agnostic) --------------------

async function callLLMForNarration({ roomId, playerText, rulesResult, actorName, restartCount = 0 }) {
  const actorForSummary = getPrimaryCharacterName(roomId) || "";
  const continuity = getCompactContinuity(roomId, { actor: actorForSummary });
  const bookEvidence = buildBookEvidence(roomId, `${continuity.scene_summary || ""}\n${continuity.last_narration_snippet || ""}\n${playerText || ""}\n${JSON.stringify(rulesResult || {}, null, 0)}`);

  const queryText = `${continuity.scene_summary || ''}\n${continuity.last_narration_snippet || ''}\n${playerText || ''}\n${JSON.stringify(rulesResult || {}, null, 0)}`;
  const kNarr = Number(process.env.RETRIEVE_K_NARRATOR || 3);
  const retrieved = retrieveCanonChunksWithK(queryText, Math.max(1, Math.min(8, kNarr)));
  const canonBlock = retrieved.map(c => `\n\n[CANON_CHUNK ${c.id}]\n${c.text}`).join('');

  const baseSystem = `
You are AETHERYN_NARRATOR.
Write vivid, cinematic narration, but NEVER change facts.
Facts come ONLY from RULES_RESULT.

ANTI-HALLUCINATION / ANTI-DRIFT (HARD):
- Do NOT invent new places, factions, institutions, or dated history.
- Any named worldbuilding claim must be supported by RETRIEVED CANON CHUNKS below; otherwise frame it as RUMOR or UNKNOWN.

MECHANICS DISPLAY (HARD):
- If PLAYER_INPUT contains "[ACTION_CHECK" or "[COMBAT_CHECK", you MUST use the provided Roll/Target/Delta to determine outcomes.
- Do NOT mention roll totals, targets, modifiers, or deltas/margins in narration. Mechanics stay out of prose.

Use CONTINUITY_MEMORY to stay consistent with prior scenes.
Use BOOK_LOOKUP_EVIDENCE to resolve details from prior play.
If BOOK_LOOKUP_EVIDENCE and CONTINUITY_MEMORY conflict with RULES_RESULT, RULES_RESULT wins.

RETRIEVED CANON CHUNKS (for grounding + texture):
${canonBlock}

Format:
1) Narration (2-6 paragraphs)
2) Then: "CHOICES:" and list the provided choices exactly, one per line.
`;

  const user = `
CONTINUITY_MEMORY:
SCENE_SUMMARY:
${continuity.scene_summary || "(empty)"}

RECENT_NARRATION_SNIPPET:
${continuity.last_narration_snippet || "(empty)"}

BOOK_LOOKUP_EVIDENCE (verbatim excerpts; may be empty):
${bookEvidence || "(empty)"}

PLAYER_INPUT:
${playerText}

RULES_RESULT (authoritative facts):
${JSON.stringify(rulesResult, null, 2)}
`;

  const suffixPlace = new Set(['pass','range','river','coast','vale','bay','basin','march','reach','hold','holdfast','keep','fort','fortress','city','town','village','hamlet','moor','fen','delta','plains','plateau','gulf','peaks','barrens','crater','spire','orchard']);
  const suffixInst = new Set(['order','guild','sentinels','council','church','abbey','temple','college','archive','registry','census','court','imperium','covenant','confederacy','dominion','crownlands','principalities']);

  let lastIssue = '';
  let lastTextOut = '';

  for (let attempt = 1; attempt <= (HALLUCINATION_GUARD ? 2 : 1); attempt++) {
    const system = attempt === 1 ? baseSystem : (baseSystem + `\n\nFIREWALL REPAIR (HARD):\n${lastIssue}\nRewrite without inventing places/factions/institutions.`);

    const t0 = Date.now();
    emitAiWait(roomId, true, "narrator", `attempt ${attempt}`);
let textOut = "";
let callErr = null;
try {
  textOut = await callLLMRole("narrator", {
    devMeta: { roomId, purpose: 'narration' },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    temperature: Number(process.env.NARRATION_TEMPERATURE || 0.7),
    maxTokens: Number(process.env.NARRATION_MAX_TOKENS || 2200),
    ollamaOptions: {
      num_ctx: Number(process.env.OLLAMA_NUM_CTX_NARRATOR || process.env.OLLAMA_NUM_CTX || 8192),
      repeat_last_n: Number(process.env.OLLAMA_REPEAT_LAST_N || 256),
      repeat_penalty: Number(process.env.OLLAMA_REPEAT_PENALTY || 1.15),
      top_k: Number(process.env.OLLAMA_TOP_K || 40),
      top_p: Number(process.env.OLLAMA_TOP_P || 0.9),
    }
  });
} catch (e) {
  callErr = e;
} finally {
  const ms = Date.now() - t0;
  emitAiWait(roomId, false, "narrator", `${ms}ms`);
}

if (callErr) {
  lastIssue = `Narrator call failed (attempt ${attempt}): ${String(callErr?.message || callErr)}`;
  continue;
}

    lastTextOut = textOut;

    if (!HALLUCINATION_GUARD) return textOut;

    const narrOnly = splitNarrationFromChoices(textOut).narration || String(textOut || '');
    const phrases = extractProperNounPhrases(narrOnly);
    const regAll = ENTITY_REGISTRY?.sets?.all;

    if (regAll && regAll.size && phrases.length) {
      const low = narrOnly.toLowerCase();
      const unknown = [];
      for (const p of phrases) {
        const k = String(p || '').trim().toLowerCase();
        if (!k) continue;
        if (regAll.has(k)) continue;

        const parts = k.split(/\s+/).filter(Boolean);
        const last = parts[parts.length - 1] || '';
        const looksPlace = suffixPlace.has(last);
        const looksInst = suffixInst.has(last);
        if (!looksPlace && !looksInst) continue;

        const idx = low.indexOf(k);
        const left = idx >= 0 ? low.slice(Math.max(0, idx - 80), idx) : '';
        const rumorFramed = /(rumor|rumour|locals\s+say|they\s+say|some\s+say|some\s+call|locals\s+call|nicknamed|called)\b/.test(left);
        if (rumorFramed) continue;

        unknown.push(p);
      }

      if (unknown.length) {
        lastIssue = `Introduced non-canonical place/institution name(s): ${unknown.join('; ')}`;
        continue;
      }
    }

    return textOut;
  }

  // If we got here, narrator regeneration didn't stabilize. Restart the narrator step twice (2s delay) before giving up.
  const rc = Math.max(0, Math.floor(Number(restartCount) || 0));
  if (rc < 2) {
    await new Promise(r => setTimeout(r, 2000));
    return await callLLMForNarration({ roomId, playerText, rulesResult, actorName, restartCount: rc + 1 });
  }

  // Final fallback: return whatever we have (better than blocking play).
  return lastTextOut || "";
}


async function callNarration({ roomId, playerText, rulesResult, actorName }) {
  const provider = normProvider(effectiveNarratorProvider());
  const text = await callLLMForNarration({ roomId, playerText, rulesResult, actorName });
  const from = String(provider || "LLM").toUpperCase();
  return { from, text };
}

// -------------------- Auto-kickoff (post-STATS) --------------------
// UX goal: after mandatory stat allocation, the game should immediately open with narration + choices.
// We only do this if the room is entering PLAY and the Book has no *real* narration yet.

function stripLockedPrologue(text) {
  const s = String(text || '').trim();
  if (!s) return '';

  // Heuristic: if we see the signature prologue line, cut through the known end line.
  const sig = 'aetheryn did not begin as a story.';
  const endSig = 'that is yours to decide.';
  const low = s.toLowerCase();
  const i0 = low.indexOf(sig);
  if (i0 !== -1) {
    const i1 = low.indexOf(endSig, i0);
    if (i1 !== -1) {
      const cut = i1 + endSig.length;
      return s.slice(cut).trim();
    }
  }
  return s;
}

function isPrologueOnlyText(text) {
  const rest = stripLockedPrologue(text);
  if (!rest) return true;

  // If all that's left is a tiny stub or a choices block, it isn't a real scene.
  const body = String(rest || '')
    .replace(/^\s*CHOICES\s*:\s*/i, '')
    .replace(/^\s*[\-\u2022].*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  return body.length < 80;
}



// If narration accidentally contains multiple SCENE blocks (common when POV bundles leak),
// keep only the LAST scene block body. This prevents multi-POV dumps in the Play log.
function collapseMultiSceneText(text){
  const src = String(text || '').replace(/\r\n/g, '\n');
  const re = /(^|\n)SCENE\s*\n\s*[A-Z][A-Z0-9 _\-]{0,24}\s*\n/g;
  let lastIdx = -1;
  let lastLen = 0;
  let m;
  while ((m = re.exec(src)) !== null) {
    lastIdx = m.index + (m[1] ? 1 : 0);
    lastLen = m[0].length - (m[1] ? 1 : 0);
  }
  if (lastIdx < 0) return String(text || '').trim();
  const out = src.slice(lastIdx + lastLen).trim();
  return out || String(text || '').trim();
}



// If the narrator dumps multiple alternative cold-open variants (common on small models),
// keep only the first coherent opening. This runs only when multiple intro markers are present.
function collapseAltOpeningsText(text){
  const src = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!src) return '';
  const paras = src.split(/\n\s*\n+/).map(p => String(p || '').trim()).filter(Boolean);
  const introRe = /^(the first sensation is|you awaken|you wake|you come to yourself|you surface from blackness|adventist winds|the air hangs thick|the world greets you with)/i;

  let introCount = 0;
  for (const p of paras) if (introRe.test(p)) introCount++;
  if (introCount <= 1) return src;

  const keep = [];
  let seen = 0;
  for (const p of paras){
    if (introRe.test(p)) {
      seen++;
      if (seen > 1) break;
    }
    keep.push(p);
  }
  return keep.join('\n\n').trim() || src;
}

function roomHasAnyNarration(roomState) {
  try {
    const entries = roomState?.book?.entries;
    if (!Array.isArray(entries) || !entries.length) return false;
    return entries.some(e => {
      const kind = String(e?.kind || '').toLowerCase();
      if (kind !== 'narration') return false;
      const t = String(e?.text || '').trim();
      if (!t) return false;
      if (isPrologueOnlyText(t)) return false;
      return true;
    });
  } catch {
    return false;
  }
}

function getLastBookNarration(roomState, maxChars = 6000) {
  try {
    const entries = roomState?.book?.entries;
    if (!Array.isArray(entries) || !entries.length) return '';
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i] || {};
      const kind = String(e.kind || '').toLowerCase();
      if (kind !== 'narration' && kind !== 'prologue') continue;
      const t = String(e.text || '').trim();
      if (!t) continue;
      if (kind === 'narration' && isPrologueOnlyText(t)) continue;
      return t.slice(-Math.max(200, Math.min(20000, Math.floor(Number(maxChars) || 6000))));
    }
  } catch {}
  return '';
}


function getPartyNamesFromTokens(tokens){
  const names = [];
  const seen = new Set();
  for (const t of (tokens || [])) {
    const p = parsePartyToken(t);
    if (!p || !p.name) continue;
    const nm = sanitizeTokenField(String(p.name).trim(), 80);
    if (!nm) continue;
    const k = nm.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    names.push(nm);
  }
  return names;
}

// -------------------- Local cold-open fallback (no LLM) --------------------
// Purpose: the game must always be playable even if the model stalls or is misconfigured.
// We keep this conservative: no new facts, no new rare items, no power jumps.
function _seedInt(str) {
  let h = 2166136261;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

function _pickFrom(list, seed) {
  const arr = Array.isArray(list) ? list.filter(Boolean) : [];
  if (!arr.length) return '';
  const idx = Math.abs(Math.floor(seed)) % arr.length;
  return String(arr[idx]);
}

function buildLocalColdOpen(roomId) {
  const st = getRoomState(roomId);
  const tokens = Array.isArray(st?.canon?.tokens) ? st.canon.tokens : [];

  const party = (() => {
    const p = getPartyNamesFromTokens(tokens);
    if (p && p.length) return p;
    const r = Array.isArray(st?.playerCharNames) ? st.playerCharNames : [];
    return r.map(x => String(x || '').trim()).filter(Boolean);
  })();

  const { region, biome } = inferRegionBiome(tokens);
  const weather = String(getTokenValue(tokens, 'weather') || '').trim();
  const season = String(getTokenValue(tokens, 'season') || '').trim();

  
  // Use the same server-chosen start plan as unified kickoff, so local fallback stays consistent.
  const plan = ensureRoomStartPlan(roomId) || null;
  const sp = plan?.start_point || null;
  const cf = plan?.conflict || null;

  const seed = _seedInt(`${roomId}::${Number(st?.runId || 0) || 0}::${String(plan?.region_id || region)}::${String(sp?.id || biome)}`);

  const hooks = [
    'a torn scrap of map pinned under a stone, ink still damp',
    'a thin column of smoke in the near distance, too steady to be natural',
    'a fresh set of footprints that do not match your own',
    'a half-buried locket that feels wrong in the hand, warm despite the cold',
  ];
  const conflicts = [
    'the ground shifts underfoot and something in the ruin groans like it is waking',
    'a distant shout cuts off mid-breath, swallowed by the weather',
    'a slick ledge threatens to give way unless you secure a line',
    'a low, deliberate scraping sound moves just out of sight behind broken stone',
  ];

  const hook = String(cf?.hook || '').trim() || _pickFrom(hooks, seed);
  const conflict = String(cf?.conflict || '').trim() || _pickFrom(conflicts, seed * 31);

  const regionLabel = String(plan?.region_name || region || '').trim();
  const envPhrase = String(sp?.terrain || biome || '').trim();
const baseEnv = [
    season ? season : null,
    weather ? weather : null,
    envPhrase ? envPhrase : null,
    regionLabel ? regionLabel : null,
  ].filter(Boolean).join(' • ');

  // Avoid a repeated stock line that players found annoying.
  const baseEnvClean = String(baseEnv || '').replace(/\s*•\s*/g, ', ').trim();
  const opener = baseEnvClean
    ? `${baseEnvClean}.`
    : '';

  const pov_char = {};
  for (const nm of (party.length ? party : ['You'])) {
    const name = String(nm || '').trim();
    if (!name) continue;
    pov_char[name] = `${opener ? opener + "\n\n" : ''}You surface from blackness with your instincts already moving. ${hook.charAt(0).toUpperCase() + hook.slice(1)}. ${conflict.charAt(0).toUpperCase() + conflict.slice(1)}.`;
  }

  const narr = `${opener ? opener + "\n\n" : ''}You surface from blackness with your instincts already moving. ${hook.charAt(0).toUpperCase() + hook.slice(1)}. ${conflict.charAt(0).toUpperCase() + conflict.slice(1)}.`;

  // Actor-tagged choices (4 per character + one freeform).
  const choices = [];
  const add = (actor, text) => { if (actor && text) choices.push({ actor, text }); };
  for (const nm of (party.length ? party : [])) {
    add(nm, 'Look for immediate threats.');
    add(nm, 'Investigate the hook more closely.');
    add(nm, 'Call out softly—see if anyone answers.');
    add(nm, 'Move to safer footing and take stock of your gear.');
  }
  if (!choices.length) {
    choices.push('Look around.');
    choices.push('Investigate the nearest detail.');
    choices.push('Move cautiously.');
    choices.push('Check your gear.');
  }
  choices.push('Freeform: (type your action)');

  return { narration: narr, pov_char, choices };
}

async function emitLocalKickoff(roomId, { includePrologue = true } = {}) {
  const st = getRoomState(roomId);
  ensureChapterOpen(roomId);

  // Defer Book UI updates until kickoff narration is delivered.
  try { st._deferBookUpdates = true; st._bookDeferDirty = false; st._bookDeferLast = null; } catch {}

  const local = buildLocalColdOpen(roomId);
  const choiceLines = [];
  try {
    for (const c of (Array.isArray(local.choices) ? local.choices : [])) {
      if (c && typeof c === 'object') {
        const a = String(c.actor || '').trim();
        const t = String(c.text || c.label || '').trim();
        if (a && t) { choiceLines.push(`[${a}] ${t}`); continue; }
        if (t) { choiceLines.push(t); continue; }
      }
      const s = String(c || '').trim();
      if (s) choiceLines.push(s);
    }
  } catch {}
  const narration = `${String(local.narration || '').trim()}\n\nCHOICES:\n- ${choiceLines.length ? choiceLines.join('\n- ') : 'Freeform: (type your action)'}`;

  if (includePrologue) {
    try { appendBookEntry(roomId, { kind: 'prologue', text: LOCKED_PROLOGUE_TEXT }); } catch {}
    try { st._prologueDelivered = true; } catch {}
  }

  // Book: store clean narration (no CHOICES block)
  try {
    const clean = splitNarrationFromChoices(narration).narration;
    const bookClean = bookStripInteractivePrompts(clean);
    if (bookClean) appendBookEntry(roomId, { kind: "narration", text: (_sceneTruthFromText(bookClean) || bookClean) });
  } catch {}

  // Persist choices so reconnects get the same options.
  try {
    const norm = normalizeChoicesArray(choiceLines);
    st.lastChoices = Array.isArray(norm.out) ? norm.out : [];
    st._lastChoicesMeta = Array.isArray(norm.meta) ? norm.meta : [];
  } catch {}
  saveRoomStateFile(roomId);

  // Broadcast state (tokens/choices) to everyone, but keep prose private.
  try {
    io.to(roomId).emit('canon_update', {
      roomId,
      canon_tokens: st.canon.tokens,
      book_meta: st.book?.meta || null
    });
  } catch {}

  // Kickoff delivery: send a POV-safe bundle to everyone.
  // This prevents blank screens for non-active players right after the dice roll.
  const truth = _sceneTruthFromText(local.narration || '') || String(local.narration || '').trim();
  try {
    await emitKickoffToAll(roomId, {
    from: 'SYSTEM',
    text: truth,
    truthText: truth,
    canon_tokens: st.canon.tokens,
    beat_summary: 'Opening scene (local fallback).',
    choices: choiceLines,
    book_meta: st.book?.meta || null,
  });
  } catch {}

  // Flush Book updates now that kickoff prose is visible.
  try { st._deferBookUpdates = false; } catch {}
  try { flushBookUpdates(roomId); } catch {}

  // Mark kickoff complete (retry-safe)
  try {
    st.canon.tokens = clearFlagToken(st.canon.tokens, 'needs_kickoff');
    st._autoPlayStarting = false;
    st._autoPlayStarted = true;
    saveRoomStateFile(roomId);
  } catch {}

  return true;
}
// -------------------- End local cold-open fallback --------------------

// -------------------- POV (per-turn, per-character) --------------------
// Design:
// - The server stores ONE shared scene truth (Book narration).
// - At turn start, the active actor receives a POV rewrite derived ONLY from that truth.
// - Other players do not receive other players' screens; they learn what happened naturally on their turns.
const POV_PER_TURN = String(process.env.POV_PER_TURN || 'on').toLowerCase() !== 'off';
const POV_MAX_TOKENS = Math.max(240, Number(process.env.POV_MAX_TOKENS || 1800));

function _povKey(name){
  return sanitizeTokenField(String(name || '').trim(), 80).toLowerCase();
}

function _sceneTruthFromText(raw){
  const s = String(raw || '').trim();
  if (!s) return '';
  const stripGreeting = (t) => String(t || '')
    .replace(/^The world greets you with[^\n]*like a hand on the throat\.[\s\S]*?(\n\n|$)/i, '')
    .trim();
  try {
    const split = splitNarrationFromChoices(s);
    let narr = String(split?.narration || s).trim();
    narr = collapseMultiSceneText(narr);
    narr = bookStripInteractivePrompts(stripLockedPrologue(narr)).trim();
    narr = stripGreeting(narr);
    narr = collapseAltOpeningsText(narr);
    return narr;
  } catch {
    let narr = bookStripInteractivePrompts(stripLockedPrologue(s)).trim();
    narr = collapseMultiSceneText(narr);
    narr = stripGreeting(narr);
    narr = collapseAltOpeningsText(narr);
    return narr;
  }
}


function _ensurePovCache(st){
  if (!st._povCache || typeof st._povCache !== 'object') st._povCache = Object.create(null); // hash -> { key: text }
}

async function generatePovFromTruth(roomId, actorName, truthText){
  const st = getRoomState(roomId);
  if (!POV_PER_TURN) return String(truthText || '').trim();
  const actor = sanitizeTokenField(String(actorName || '').trim(), 80);
  const truth = String(truthText || '').trim();
  if (!actor || !truth) return String(truthText || '').trim();

  _ensurePovCache(st);
  const h = String(hash32FNV(truth) || 0);
  const key = _povKey(actor);
  if (!st._povCache[h]) st._povCache[h] = Object.create(null);
  const hit = st._povCache[h][key];
  if (typeof hit === 'string' && hit.trim()) return hit.trim();

  // Light character context (non-canon-expanding). Keep it tiny.
  let cls = '', bg = '', arche = '';
  try { cls = getPcBioField(st.canon.tokens, actor, 'class') || ''; } catch {}
  try { bg = getPcBioField(st.canon.tokens, actor, 'background') || ''; } catch {}
  try { arche = getPcBioField(st.canon.tokens, actor, 'archetype') || ''; } catch {}

  const system =
`You are AETHERYN_POV_FILTER.
Rewrite SCENE_TRUTH into what ${actor} perceives.

Rules:
- Use SECOND PERSON singular ("you") for ${actor}.
- You MUST NOT add new facts, new characters, new items, new places, or new events.
- If SCENE_TRUTH uses "you" ambiguously, treat it as objective reality and reframe cleanly.
- Keep 2–5 paragraphs. Sensory, grounded, immediate.
- Do NOT include CHOICES. Do NOT include dice/mechanics. Do NOT mention tokens.
`;

  const user =
`CHARACTER:
Name: ${actor}
Class: ${cls || 'unknown'}
Archetype: ${arche || 'unknown'}
Background: ${bg || 'unknown'}

SCENE_TRUTH:
${truth}
`;

  let out = '';
  try {
    out = await callLLMRole('narrator', {
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: Number(process.env.POV_TEMPERATURE || 0.8),
      maxTokens: POV_MAX_TOKENS,
      ollamaOptions: {
        num_ctx: Number(process.env.OLLAMA_NUM_CTX_NARRATOR || process.env.OLLAMA_NUM_CTX || 4096),
        repeat_last_n: Number(process.env.OLLAMA_REPEAT_LAST_N || 256),
        repeat_penalty: Number(process.env.OLLAMA_REPEAT_PENALTY || 1.15),
        top_k: Number(process.env.OLLAMA_TOP_K || 40),
        top_p: Number(process.env.OLLAMA_TOP_P || 0.9),
      }
    });
  } catch {
    out = '';
  }

  const cleaned = sanitizeNarrationText(String(out || '').trim() || truth, st.canon.tokens || []);
  st._povCache[h][key] = cleaned.trim();
  try { saveRoomStateFile(roomId); } catch {}
  return cleaned.trim();
}

// Kickoff delivery helper:
// Send a POV-safe narration bundle to ALL sockets in the room.
// Each client only receives POV entries for characters it owns (filtered in emitNarrationPerPlayer).
async function emitKickoffToAll(roomId, payload = {}){
  const st = getRoomState(roomId);
  const truthText = String(payload.truthText || payload.truth || payload.scene_truth || payload.text || '').trim();

  // Build POV text for the whole party (small N, cached by truth hash).
  let pov_char = null;
  try {
    const toks = st?.canon?.tokens || [];
    const party = getPartyNamesFromTokens(toks) || [];
    const uniq = [];
    const seen = new Set();
    for (const nm0 of party) {
      const nm = sanitizeTokenField(String(nm0 || '').trim(), 80);
      const k = nm.toLowerCase();
      if (!nm || seen.has(k)) continue;
      seen.add(k);
      uniq.push(nm);
      if (uniq.length >= 8) break; // sanity cap
    }
    if (truthText && uniq.length) {
      pov_char = {};
      for (const nm of uniq) {
        try {
          const pov = await generatePovFromTruth(roomId, nm, truthText);
          if (pov) pov_char[nm] = String(pov || '').trim();
        } catch {}
      }
      if (!Object.keys(pov_char).length) pov_char = null;
    }
  } catch {
    pov_char = null;
  }

  // Broadcast per-player (safe filtering happens inside emitNarrationPerPlayer).
  await emitNarrationPerPlayer(roomId, {
    ...payload,
    text: String(payload.text || truthText || '').trim(),
    truthText,
    pov_char,
  });
}

function _fallbackSocketLocalNames(st, s){
  try {
    const direct = (Array.isArray(s?.data?.charNames) && s.data.charNames.length)
      ? s.data.charNames.map(x => String(x || '').trim()).filter(Boolean)
      : [String(s?.data?.charName || '').trim()].filter(Boolean);
    if (direct.length) return direct;

    const pid = (st?.socketToPlayerId && st.socketToPlayerId[s.id])
      ? String(st.socketToPlayerId[s.id])
      : String(s?.data?.playerId || '').trim();
    const rec = (pid && st?.playersById && st.playersById[pid]) ? st.playersById[pid] : null;

    let saved = [];
    if (Array.isArray(rec?.charNames) && rec.charNames.length) {
      saved = rec.charNames.map(x => String(x || '').trim()).filter(Boolean);
    } else {
      const one = String(rec?.charName || '').trim();
      if (one) saved = [one];
    }

    if (!saved.length) {
      const roster = Array.isArray(st?.intakePlayers)
        ? st.intakePlayers.map(p => String(p?.answers?.q9 || '').trim()).filter(Boolean)
        : [];
      if ((!!st?.isSingle || Number(st?.expectedPlayers || 0) === 1) && roster.length === 1) saved = [roster[0]];
    }

    if (saved.length) {
      try { s.data.charNames = saved.slice(); } catch {}
      if (!String(s?.data?.charName || '').trim()) {
        try { s.data.charName = String(saved[0] || '').trim(); } catch {}
      }
    }

    return saved;
  } catch {
    return [];
  }
}

async function emitNarrationToActorOnly(roomId, actorName, payload = {}){
  const st = getRoomState(roomId);
  const actor = sanitizeTokenField(String(actorName || '').trim(), 80);
  if (!actor) return;

  let sockets = [];
  try { sockets = await io.in(roomId).fetchSockets(); } catch { sockets = []; }

  // Prologue injection (once per character, including couch co-op).
  const PROLOGUE = String(LOCKED_PROLOGUE_TEXT || '').trim();
  const hasPrologueAlready = (txt) => {
    const s = String(txt || '').trim();
    if (!s || !PROLOGUE) return false;
    return s.startsWith(PROLOGUE) || s.includes(PROLOGUE.slice(0, 24));
  };
  try { if (!st._introSeenChar) st._introSeenChar = Object.create(null); } catch {}

  // If the caller provides the shared scene truth, we can generate POV streams for every
  // local character on the device (so couch swaps always have prose).
  let truthText = String(payload.truthText || payload.truth || payload.scene_truth || '').trim();
  if (!truthText) {
    // Best-effort fallback: treat payload.text as truth (still stripped/cleaned).
    truthText = _sceneTruthFromText(String(payload.text || '').trim());
  }

  let introDirty = false;

  for (const s of sockets) {
    const localNames = _fallbackSocketLocalNames(st, s);

    const ok = localNames.some(n => String(n||'').trim().toLowerCase() === actor.toLowerCase());
    if (!ok) continue;

    // Build a POV bundle for this device (couch-safe), derived only from scene truth.
    let pov_char = null;
    if (truthText) {
      pov_char = {};
      try {
        const uniq = [];
        const seen = new Set();
        for (const nm0 of localNames) {
          const nm = sanitizeTokenField(String(nm0||'').trim(), 80);
          const k = nm.toLowerCase();
          if (!nm || seen.has(k)) continue;
          seen.add(k);
          uniq.push(nm);
        }

        // Generate POV rewrites (cached by truth hash + actor).
        await Promise.all(uniq.map(async (nm) => {
          try {
            let pov = await generatePovFromTruth(roomId, nm, truthText);
            pov = String(pov || '').trim();
            if (!pov) return;
            pov_char[nm] = pov;
          } catch {}
        }));

        if (!Object.keys(pov_char).length) pov_char = null;
      } catch {
        pov_char = null;
      }
    }

    // Choose visible text for this socket (active local character first).
    const activeChar = String(s?.data?.charName || '').trim();
    const activeKey = activeChar ? activeChar.toLowerCase() : '';

    let chosen = '';
    if (pov_char && activeKey) {
      for (const [k, v] of Object.entries(pov_char)) {
        if (String(k||'').trim().toLowerCase() === activeKey && typeof v === 'string') { chosen = String(v||'').trim(); break; }
      }
    }
    if (!chosen && pov_char && typeof pov_char[actor] === 'string') chosen = String(pov_char[actor]||'').trim();
    if (!chosen) chosen = String(payload.text || '').trim();
    if (!chosen) chosen = String(truthText || '').trim();

    // Inject prologue per character for couch bundles.
    if (pov_char && PROLOGUE) {
      try {
        for (const [nm, txt] of Object.entries(pov_char)) {
          const key = String(nm || '').trim().toLowerCase();
          if (!key) continue;
          if (st._introSeenChar[key]) continue;
          if (hasPrologueAlready(txt)) { st._introSeenChar[key] = true; introDirty = true; continue; }
          pov_char[nm] = `${PROLOGUE}\n\n${String(txt || '').trim()}`.trim();
          st._introSeenChar[key] = true;
          introDirty = true;
        }
      } catch {}
    }

    // Also inject prologue into the chosen view if needed.
    const akey = actor.toLowerCase();
    if (PROLOGUE && !st._introSeenChar[akey] && !hasPrologueAlready(chosen)) {
      chosen = `${PROLOGUE}\n\n${chosen}`.trim();
      st._introSeenChar[akey] = true;
      introDirty = true;
    }

    // Sanitize visible text and bundle entries.
    const tok = st?.canon?.tokens || [];
    let cleanText = sanitizeNarrationText(chosen, tok);
    if (pov_char) {
      const cleaned = {};
      for (const [nm, txt] of Object.entries(pov_char)) {
        const t2 = sanitizeNarrationText(txt, tok);
        if (t2) cleaned[nm] = t2;
      }
      pov_char = Object.keys(cleaned).length ? cleaned : null;
      // Prefer showing the cleaned version of the active character if present.
      try {
        const act = activeKey;
        if (act && pov_char) {
          for (const [k, v] of Object.entries(pov_char)) {
            if (String(k||'').trim().toLowerCase() == act && typeof v === 'string') { cleanText = String(v||'').trim(); break; }
          }
        }
      } catch {}
    }

    const normChoices = normalizeChoicesArray(payload.choices);

    try {
      const out = { ...payload };
      // Strip internal fields that shouldn't travel.
      try { delete out.truthText; } catch {}
      try { delete out.truth; } catch {}
      try { delete out.scene_truth; } catch {}

      s.emit('narration', {
        ...out,
        text: cleanText,
        choices: Array.isArray(normChoices.out) ? normChoices.out : [],
        pov_char,
        povActor: actor,
      });
      delivered++;
    } catch {}
  }

  if (introDirty) {
    try { saveRoomStateFile(roomId); } catch {}
  }

  return delivered;

}

// -------------------- End POV (per-turn) --------------------

function getPcBioField(tokens, actorName, fieldKey){
  const nm = _pNameKey(actorName);
  const want = String(fieldKey || '').trim().toLowerCase();
  if (!nm || !want) return '';
  for (const t of (tokens || [])) {
    const s = String(t || '').trim();
    const low = s.toLowerCase();
    if (!(low.startsWith('pcbio:') || low.startsWith('pcbio='))) continue;
    const body = s.split(/[:=]/).slice(1).join(':');
    const head = String(body || '').split('|')[0].trim();
    if (!head || head.toLowerCase() !== nm.toLowerCase()) continue;
    const rest = String(body || '').split('|').slice(1).join('|');
    const pairs = String(rest || '').split(';').map(x => String(x||'').trim()).filter(Boolean);
    for (const p of pairs) {
      const m = p.match(/^([^=]+)=(.+)$/);
      if (!m) continue;
      const k = String(m[1] || '').trim().toLowerCase();
      const v = String(m[2] || '').trim();
      if (k === want) return v;
    }
  }
  return '';
}

function starterKitCategory(classRaw){
  const low = String(classRaw || '').trim().toLowerCase();
  if (!low) return 'wanderer';
  if (/\b(fighter|warrior|soldier|barbar|paladin|knight|guardian|warlord|champion)\b/.test(low)) return 'martial';
  if (/\b(rogue|thief|assassin|scoundrel|cutpurse|shadow)\b/.test(low)) return 'rogue';
  if (/\b(ranger|hunter|archer|pathfinder|scout|tracker)\b/.test(low)) return 'ranger';
  if (/\b(cleric|priest|templar|acolyte)\b/.test(low)) return 'cleric';
  if (/\b(druid|shaman|warden)\b/.test(low)) return 'druid';
  if (/\b(bard|minstrel|skald|troubadour)\b/.test(low)) return 'bard';
  if (/\b(wizard|mage|sorcer|warlock|witch|arcan|spell)\b/.test(low)) return 'caster';
  return 'wanderer';
}

function ensureStarterLoadout(roomId){
  const st = getRoomState(roomId);
  let tokens = Array.isArray(st.canon.tokens) ? [...st.canon.tokens] : [];

  // Only seed gear on truly fresh runs.
  // v32+: inventories are per-character (invp:<NAME>|...).
  // If a legacy global inv exists OR any invp exists, do not reseed.
  const invLegacy = parseInvMap(tokens);
  if (invLegacy.size > 0) return false;
  try {
    const anyInvp = (tokens || []).some(t => {
      const s = String(t || '').trim().toLowerCase();
      return s.startsWith('invp:') || s.startsWith('invp=') || s.startsWith('inventoryp:') || s.startsWith('inventoryp=');
    });
    if (anyInvp) return false;
  } catch {}

  const party = getPartyNamesFromTokens(tokens);
  const partyCount = Math.max(1, party.length || Number(st.expectedPlayers || 0) || 1);

  // Starter pack (per player). Level 1, practical, not flashy.
  const starter = [
    ['Torch', 1],
    ['Rations', 3],
    ['Waterskin', 1],
    ['Rope', 1],
    ['Tinder Kit', 1],
    ['Bandage', 2],
    ['Rusty Knife', 1],
  ];

  const classExtras = {
    martial: [ ['Whetstone', 1] ],
    rogue: [ ['Lockpick Kit', 1], ['Chalk', 1] ],
    ranger: [ ['Arrows', 12], ['Snare Wire', 1] ],
    caster: [ ['Spell Chalk', 1], ['Ink Vial', 1] ],
    cleric: [ ['Prayer Sigil', 1], ['Simple Incense', 1] ],
    druid: [ ['Herb Pouch', 1], ['Seed Packet', 1] ],
    bard: [ ['Tuning Flute', 1], ['Waxed String', 1] ],
    wanderer: [ ['Map Scrap', 1] ],
  };

  // Strip any stray inv/invp tokens then append per-character starter packs.
  tokens = (tokens || []).filter(t => {
    const s = String(t || '').trim().toLowerCase();
    if (s.startsWith('inv:') || s.startsWith('inv=') || s.startsWith('inventory:') || s.startsWith('inventory=')) return false;
    if (s.startsWith('invp:') || s.startsWith('invp=') || s.startsWith('inventoryp:') || s.startsWith('inventoryp=')) return false;
    return true;
  });

  for (const pc of (party || [])) {
    const nmPc = sanitizeTokenField(String(pc || '').trim(), 80);
    if (!nmPc) continue;
    const inv = new Map();
    inv._names = new Map();
    for (const [name, qty] of starter) {
      const nm = sanitizeTokenField(String(name || '').trim(), 80);
      const q = Math.max(0, Math.floor(Number(qty) || 0));
      if (!nm || !q) continue;
      invAddQty(inv, nm.toLowerCase(), nm, q);
    }
    // Class-flavor extras (still modest).
    try {
      const cls = getPcBioField(tokens, nmPc, 'class');
      const cat = starterKitCategory(cls);
      const extra = Array.isArray(classExtras[cat]) ? classExtras[cat] : [];
      for (const [name, qty] of extra) {
        const nm = sanitizeTokenField(String(name || '').trim(), 80);
        const q = Math.max(0, Math.floor(Number(qty) || 0));
        if (!nm || !q) continue;
        invAddQty(inv, nm.toLowerCase(), nm, q);
      }
    } catch {}

    tokens = rebuildInvTokensFor(tokens, nmPc, inv);
  }

  // Give a small travel stake (currency) so buying basics isn't dead on arrival.
  try {
    const res = parseResMap(tokens);
    const k = String(ASSET_CURRENCY || 'Coin_Aurum').trim().toLowerCase();
    if (!res.has(k)) {
      tokens.push(`res:${ASSET_CURRENCY}=${15 * partyCount}`);
    }
  } catch {}

  st.canon.tokens = tokens;
  saveRoomStateFile(roomId);
  return true;
}

function ensureStarterEquipment(roomId){
  const st = getRoomState(roomId);
  let tokens = Array.isArray(st.canon.tokens) ? [...st.canon.tokens] : [];

  // Only seed on truly fresh runs (no equipment tokens yet).
  const eqLegacy = parseEqMap(tokens);
  if (eqLegacy.size > 0) return false;
  try {
    const anyEqp = (tokens || []).some(t => {
      const s = String(t || '').trim().toLowerCase();
      return s.startsWith('eqp:') || s.startsWith('eqp=') || s.startsWith('equipp:') || s.startsWith('equipp=');
    });
    if (anyEqp) return false;
  } catch {}

  const party = getPartyNamesFromTokens(tokens);

  // Strip any stray eq/eqp tokens then append per-character eqp packs.
  tokens = (tokens || []).filter(t => {
    const s = String(t || '').trim().toLowerCase();
    if (s.startsWith('eq:') || s.startsWith('eq=') || s.startsWith('equip:') || s.startsWith('equip=') || s.startsWith('equipment:') || s.startsWith('equipment=')) return false;
    if (s.startsWith('eqp:') || s.startsWith('eqp=') || s.startsWith('equipp:') || s.startsWith('equipp=')) return false;
    return true;
  });

  const weaponByCat = {
    martial: { mainhand: 'Worn Spear', offhand: 'Wooden Buckler' },
    rogue: { mainhand: 'Dagger', offhand: '' , cloak: 'Tattered Cloak' },
    ranger: { mainhand: 'Hunting Bow', offhand: '' },
    caster: { mainhand: 'Ashwood Staff', offhand: '' },
    cleric: { mainhand: 'Simple Mace', offhand: '' },
    druid: { mainhand: 'Sickle', offhand: '' },
    bard: { mainhand: 'Shortblade', offhand: '' },
    wanderer: { mainhand: 'Walking Stick', offhand: '' },
  };

  for (const pc of (party || [])) {
    const nmPc = sanitizeTokenField(String(pc || '').trim(), 80);
    if (!nmPc) continue;
    const cls = getPcBioField(tokens, nmPc, 'class');
    const cat = starterKitCategory(cls);
    const w = weaponByCat[cat] || weaponByCat.wanderer;

    const eq = new Map();
    eq.set('armor', "Traveler's Garb");
    eq.set('boots', 'Worn Boots');
    if (w && w.cloak) eq.set('cloak', String(w.cloak));
    if (w && w.mainhand) eq.set('mainhand', String(w.mainhand));
    if (w && w.offhand) eq.set('offhand', String(w.offhand));

    tokens = rebuildEqTokensFor(tokens, nmPc, eq);
  }

  st.canon.tokens = tokens;
  saveRoomStateFile(roomId);
  return true;
}





function buildColdOpenPrompt(roomId) {
  const st = getRoomState(roomId);
  const tokensNow = Array.isArray(st?.canon?.tokens) ? st.canon.tokens : [];

  // --- Determine party + starting formation ---
  const party = getPartyNamesFromTokens(tokensNow);
  const partyCanonByKey = new Map();
  for (const n of (party || [])) {
    const nm = String(n || '').trim();
    const k = sanitizeTokenField(nm, 80).toLowerCase();
    if (k && nm) partyCanonByKey.set(k, nm);
  }

  // Parse per-character start tokens: pcstart:Name=party|separate
  const pcStart = new Map(); // nameKey -> 'party'|'separate'
  try {
    for (const t of (tokensNow || [])) {
      const s = String(t || '').trim();
      const low = s.toLowerCase();
      if (!(low.startsWith('pcstart:') || low.startsWith('pcstart='))) continue;
      const body = s.slice(8).trim();
      let name = '';
      let val = '';
      if (body.includes('=')) {
        const parts = body.split('=');
        name = String(parts[0] || '').trim();
        val = String(parts.slice(1).join('=') || '').trim();
      } else if (body.includes('|')) {
        const parts = body.split('|');
        name = String(parts[0] || '').trim();
        val = String(parts.slice(1).join('|') || '').trim();
      }
      const nk = sanitizeTokenField(name, 80).toLowerCase();
      if (!nk) continue;
      const vv = String(val || '').toLowerCase();
      pcStart.set(nk, vv.includes('separate') ? 'separate' : 'party');
    }
  } catch {}

  // Global formation (host answers) with a token fallback.
  let globalFormation = String(st?.intakeGlobal?.q3 || '').trim();
  if (!globalFormation) {
    try {
      for (const t of (tokensNow || [])) {
        const s = String(t || '').trim();
        const low = s.toLowerCase();
        if (!(low.startsWith('cfg:start_together=') || low.startsWith('cfg:start_together:'))) continue;
        globalFormation = s.split(/[:=]/).slice(2).join(':').trim();
        break;
      }
    } catch {}
  }
  const globalTogether = String(globalFormation || '').toLowerCase().includes('together');

  // If this is a true solo start (1 player, 0 NPC companions), ignore formation.
  let players = Math.max(1, Number(st?.expectedPlayers || 1) || 1);
  let npcs = 0;
  try { npcs = Math.max(0, parseInt(String(st?.intakeGlobal?.q2 || '0').trim(), 10) || 0); } catch {}
  if (players <= 1 && npcs <= 0) {
    players = 1;
  }

  // v32.1+: kickoff uses ONE shared scene truth.
  // Per-character POVs are generated from that truth on turn start.
  // (Separated starts can be layered later using pstate groups.)
  const anySeparated = false;

  
  // --- Environment seed (stable per room + spawn) ---
  // Server-side: pick a canonical wilderness start point + an easy starter conflict.
  const plan = ensureRoomStartPlan(roomId) || null;
  const sp = plan?.start_point || null;
  const cf = plan?.conflict || null;

  // Prefer sensory terrain; keep hard place-naming optional (prose can stay local until "earned").
  const biome = String(sp?.terrain || '').trim() || "a field of ash grass and broken posts";
  const hookRaw = String(cf?.hook || '').trim() || "a faint bell sound that stops the moment you look for its source";
  const conflictRaw = String(cf?.conflict || '').trim() || "a small wrong-shaped residue creature is nosing through the mist toward your gear";

  const hook = hookRaw.endsWith('.') ? hookRaw.slice(0, -1) : hookRaw;
  const conflict = conflictRaw; // may already include punctuation/extra clauses

  // A tiny grounding note for the model (do not print in narration).
  const startGrounding =
    `START_CONTEXT (do not print): region=${sanitizeTokenField(String(plan?.region_name || plan?.region_id || ''), 60)}; ` +
    `nearest_anchor=${sanitizeTokenField(String(sp?.nearest_anchor || ''), 80)}; ` +
    `start_point=${sanitizeTokenField(String(sp?.id || ''), 40)}; conflict=${sanitizeTokenField(String(cf?.id || ''), 40)}.`;
// --- Shared scene truth (always) ---
  const roster = (party && party.length) ? party : (Array.isArray(st?.playerCharNames) ? st.playerCharNames : []);
  const rosterLine = (roster || []).map(n => sanitizeTokenField(String(n||'').trim(), 80)).filter(Boolean).join(' | ') || 'You';

  return [
    "BEGIN_PLAY: Intake and stat allocation are complete.",
    "Write ONE shared opening scene (objective truth). Do NOT write separate POV vignettes.",
    startGrounding,
    "Start with a strong cold-open: the party comes to themselves in " + biome + ".",
    "Memory is patchy—names and instincts remain, but the why/how is uncertain.",
    "HARD RULES: Do NOT print raw tokens like loc:/xy:/mode: anywhere.",
    "Do NOT reveal map coordinates or percentages.",
    "If the party has not earned the place-name, do not name it; keep it sensory/local.",
    "Include a small optional spark (not a quest) the party can pursue or ignore: " + hook + ".",
    "STARTING CONFLICT (EASY, solvable in 1–2 turns): " + conflict + ".",
    "Do NOT invent new items beyond the starter gear in canon tokens.",
    "Provide choices as a JSON array in the 'choices' field with 8-12 choices total.",
    "Include at least one 'Freeform: (type your action)' choice.",
    "Optional: you may tag a choice for a character using '[NAME] <choice text>' but ONLY use these names: " + rosterLine + ".",
  ].join(' ');
}


async function autoStartPlayIfNeeded(roomId, { reason = "" } = {}) {
  const st = getRoomState(roomId);
  if (!hasModeToken(st.canon.tokens, "PLAY")) return false;

  // Kickoff is explicitly gated by a server flag to avoid generating a cold-open in legacy saves.
  const needsKickoff = hasFlagToken(st.canon.tokens, 'needs_kickoff');
  if (!needsKickoff) return false;


  const kickoffDone = hasFlagToken(st.canon.tokens, 'kickoff_done');
  // If kickoff has already completed, ignore any stale needs_kickoff flag to prevent loops.
  if (kickoffDone) {
    st.canon.tokens = clearFlagToken(st.canon.tokens, 'needs_kickoff');
    st._autoPlayStarting = false;
    st._autoPlayStarted = true;
    saveRoomStateFile(roomId);
    return false;
  }

  // Prevent duplicate kickoff (race: multiple sockets submitting stats at once).
  // Self-heal: if the server crashed or a timeout left us stuck mid-kickoff, allow a retry.
  try {
    const now = Date.now();
    const hasNarr = roomHasAnyNarration(st);

    if (st._autoPlayStarting) {
      const startedAt = Number(st._autoPlayStartedAt || 0) || 0;
      const ageMs = now - startedAt;
      // If we have no narration and the kickoff flag is still set, treat an old in-progress marker as stale.
      if (!hasNarr && needsKickoff && (ageMs > 90_000 || ageMs < 0 || !startedAt)) {
        st._autoPlayStarting = false;
        st._autoPlayStarted = false;
        saveRoomStateFile(roomId);
      } else {
        return false;
      }
    }

    if (st._autoPlayStarted) {
      // Inconsistent state: marked started but no narration yet and kickoff still required. Reset and retry.
      if (!hasNarr && needsKickoff) {
        st._autoPlayStarting = false;
        st._autoPlayStarted = false;
        saveRoomStateFile(roomId);
      } else {
        return false;
      }
    }
  } catch {
    // If anything about the self-heal check fails, fall back to the conservative behavior.
    if (st._autoPlayStarting) return false;
    if (st._autoPlayStarted) return false;
  }

  // If narration already exists, mark kickoff as complete and stop.
  if (roomHasAnyNarration(st)) {
    st.canon.tokens = clearFlagToken(st.canon.tokens, 'needs_kickoff');
    if (!hasFlagToken(st.canon.tokens, 'kickoff_done')) {
      st.canon.tokens = setFlagToken(st.canon.tokens, 'kickoff_done', 1);
    }
    st._autoPlayStarted = true;
    saveRoomStateFile(roomId);
    return false;
  }

  st._autoPlayStarting = true;
  st._autoPlayStartedAt = Date.now();
  if (reason) st._autoPlayReason = String(reason).slice(0, 80);
  saveRoomStateFile(roomId);

  try {
    if (DEV_BUILD) {
      io.to(roomId).emit('dev_event', {
        kind: 'kickoff_trigger',
        roomId: String(roomId || '').trim() || undefined,
        reason: String(reason || ''),
        needs_kickoff: hasFlagToken(st.canon.tokens, 'needs_kickoff'),
        kickoff_done: hasFlagToken(st.canon.tokens, 'kickoff_done'),
        hasNarration: roomHasAnyNarration(st),
        bookLen: Array.isArray(st?.book?.entries) ? st.book.entries.length : 0,
      });
    }
  } catch {}


  // Nuclear option: make kickoff playable without any model call.
  // This prevents the "cold prologue + choices but no scene" dead-loop.
  if (FORCE_LOCAL_KICKOFF) {
    try {
      const includePrologue = !st._prologueDelivered;
      await emitLocalKickoff(roomId, { includePrologue });
      return true;
    } catch {
      // Fall through to the normal kickoff path.
    }
  }

try {

  // NOTE: Keep kickoff retries minimal and self-contained.
  // Some builds have snapshot helpers defined inside other blocks; avoid hard dependency here.
  const _kickoffSnap = null;
  for (let _kickoffRestart = 0; _kickoffRestart <= 2; _kickoffRestart++) {
    try {

// Ensure the Book has a Chapter/Scene scaffold before the first narration.
  ensureChapterOpen(roomId);

  // Kickoff is generated only after turn order is locked.
  // If the room is still in INIT (or OFF), ensure the turn system is running and return.
  try {
    const phase = String(getRoomState(roomId)?.turn?.phase || 'OFF').toUpperCase();
    const enabled = !!getRoomState(roomId)?.turn?.enabled;
    if (enabled && phase !== 'ACTIVE') {
      await TURNS.startInitiative(roomId);
      return false;
    }
  } catch {}

  // Deterministic wilderness start plan (server-side). Avoids kickoff failures from invented anchors.
  try {
    ensureRoomStartPlan(roomId);
  } catch {}
const includePrologue = !st._prologueDelivered;

  const playerText = buildColdOpenPrompt(roomId);

  let from = String(normProvider(effectiveNarratorProvider()) || "LLM").toUpperCase();

  if (AI_PIPELINE === "unified") {
    // Unified kickoff: one call
    const uni = await callLLMUnifiedTurn({ roomId, playerText, actorName: "SYSTEM" });
    if (!uni || !String(uni.narration || '').trim()) throw new Error('Kickoff returned empty narration');

    // Prefer any choices embedded in narration (legacy), otherwise use the unified JSON choices.
    const narrRaw0 = String(uni.narration || "").trim();
    const split0 = splitNarrationFromChoices(narrRaw0);
    let narr = String(split0.narration || narrRaw0).trim();

    // The locked prologue is injected server-side per-player/character.
    // If the model echoes it (common on small models), strip it so we can judge whether a real starting scene exists.
    narr = stripLockedPrologue(narr);
    narr = collapseMultiSceneText(narr);
    const narrFinal = String(narr || '').trim();

    // Guard: kickoff must include actual scene prose, not just the prologue (or a choices-only dump).
    try {
      const body = narrFinal.replace(/\s+/g, ' ').trim();
      const sentences = (body.match(/[\.!\?]/g) || []).length;
      if (!body || body.length < 220 || sentences < 2 || isPrologueOnlyText(narrRaw0)) {
        throw new Error('Kickoff narration missing starting scene text');
      }
    } catch (e) {
      throw e;
    }

    let choices = (Array.isArray(split0.choices) && split0.choices.length)
      ? split0.choices
      : (Array.isArray(uni.choices) ? uni.choices : []);

    if (!choices.length) choices = [
      "Look around",
      "Talk to someone nearby",
      "Move cautiously forward",
      "Check your gear",
      "Freeform: (type your action)"
    ];

    const hasFreeform = choices.some(c => String(c||"").toLowerCase().startsWith("freeform"));
    if (!hasFreeform) choices.push("Freeform: (type your action)");

    // Build actor-tagged choice objects for the client when possible:
    // "[NAME] Do thing" -> { actor: NAME, text: "Do thing" }
    const choicesForEmit = (() => {
      const toks = Array.isArray(uni.canon_tokens) ? uni.canon_tokens : (getRoomState(roomId)?.canon?.tokens || []);
      const party = getPartyNamesFromTokens(toks) || [];
      const canonByKey = new Map();
      for (const n of party) {
        const nm = String(n || '').trim();
        const k = sanitizeTokenField(nm, 80).toLowerCase();
        if (k && nm) canonByKey.set(k, nm);
      }

      const out = [];
      for (const c0 of (choices || [])) {
        const raw0 = String(c0 || '').trim();
        if (!raw0) continue;

        let actor = "";
        let text = raw0;

        const m = raw0.match(/^\s*\[([^\]]{1,80})\]\s*(.+)\s*$/);
        if (m) {
          actor = String(m[1] || '').trim();
          text = String(m[2] || '').trim();
        }

        if (actor) {
          const k = sanitizeTokenField(actor, 80).toLowerCase();
          const canon = canonByKey.get(k) || actor;
          out.push({ actor: canon, text });
        } else {
          out.push(text);
        }
      }
      return out;
    })();

    if (includePrologue) {
      // Store the prologue once in the Book transcript.
      // Player-facing delivery is handled per-player in emitNarrationPerPlayer()
      // so late-joiners (or couch co-op characters) still get the intro.
      try { appendBookEntry(roomId, { kind: "prologue", text: LOCKED_PROLOGUE_TEXT }); } catch {}
      try { st._prologueDelivered = true; } catch {}
    }

    // Kickoff must persist a real narration entry in the Book; otherwise join/turn-order guards
    // will think the opening never happened and will re-trigger kickoff in a loop.
    const truth0 = _sceneTruthFromText(narrFinal) || narrFinal;
    let bookClean = bookStripInteractivePrompts(stripLockedPrologue(truth0)) || truth0;
    bookClean = String((_sceneTruthFromText(bookClean) || bookClean) || '').trim();
    if (!bookClean || isPrologueOnlyText(bookClean)) {
      // Last-resort: store a minimal, non-prologue, location-anchored truth so the room doesn't loop kickoff.
      const _loc = extractLoc((getRoomState(roomId)?.canon?.tokens) || []);
      const _locLine = isPlaceholderLoc(_loc) ? 'somewhere unfamiliar' : String(_loc || '').trim();
      bookClean = `At ${_locLine || 'somewhere unfamiliar'}, the party regains their senses—and the moment turns sharp with immediate consequence.`;
    }
    if (bookClean) appendBookEntry(roomId, { kind: "narration", text: bookClean });

    onBeatComplete(roomId, uni.canon_tokens);
    pushBeatSummary(roomId, uni.beat_summary);
    rollupSceneOnSceneAdvance(roomId);
    maybeSummarizeSceneAsync(roomId);
    saveRoomStateFile(roomId);

    // Mark kickoff complete ASAP (prevents join/retry loops if POV delivery later fails).
    try {
      const st2 = getRoomState(roomId);
      st2.canon.tokens = clearFlagToken(st2.canon.tokens, 'needs_kickoff');
      st2.canon.tokens = setFlagToken(st2.canon.tokens, 'kickoff_done', 1);
      st2._autoPlayStarting = false;
      st2._autoPlayStarted = true;
      saveRoomStateFile(roomId);
    } catch {}

    // Kickoff delivery: send a POV-safe bundle to everyone.
    // This prevents blank screens for non-active players right after the dice roll.
    try {
      const truth = _sceneTruthFromText(narrFinal) || String(narrFinal || '').trim();
      await emitKickoffToAll(roomId, {
        from,
        text: truth,
        truthText: truth,
        canon_tokens: uni.canon_tokens,
        beat_summary: uni.beat_summary,
        choices: choicesForEmit,
        book_meta: getRoomState(roomId).book?.meta || null,
      });
    } catch {}

    // Mark kickoff complete (retry-safe)
    try {
      const st2 = getRoomState(roomId);
      st2.canon.tokens = clearFlagToken(st2.canon.tokens, 'needs_kickoff');
      st2.canon.tokens = setFlagToken(st2.canon.tokens, 'kickoff_done', 1);
      st2._autoPlayStarting = false;
      st2._autoPlayStarted = true;
      saveRoomStateFile(roomId);

      try {
        if (DEV_BUILD) {
          const stK = getRoomState(roomId);
          io.to(roomId).emit('dev_event', {
            kind: 'kickoff_complete',
            roomId: String(roomId || '').trim() || undefined,
            kickoff_done: hasFlagToken(stK.canon.tokens, 'kickoff_done'),
            needs_kickoff: hasFlagToken(stK.canon.tokens, 'needs_kickoff'),
            hasNarration: roomHasAnyNarration(stK),
            bookLen: Array.isArray(stK?.book?.entries) ? stK.book.entries.length : 0,
          });
        }
      } catch {}

    } catch {}

    return true;
  }

  const rulesResult = await callLLMForState({ roomId, playerText, actorName: "SYSTEM" });
  const narrOut = await callNarration({ roomId, playerText, rulesResult, actorName: "SYSTEM" });
  let narration = String(narrOut.text || '').trim();
  narration = stripLockedPrologue(narration);
  narration = collapseMultiSceneText(narration);
  // If the narrator echoes only the prologue / fails to produce a scene, treat kickoff as failed so we fall back.
  if (!narration || isPrologueOnlyText(narration)) {
    throw new Error('Kickoff narration missing starting scene text');
  }
  if (includePrologue) {
    // Store the prologue once in the Book transcript.
    // Player-facing delivery is handled per-player in emitNarrationPerPlayer().
    try { appendBookEntry(roomId, { kind: "prologue", text: LOCKED_PROLOGUE_TEXT }); } catch {}
    try { st._prologueDelivered = true; } catch {}
  }

  // Book: store clean narration (no CHOICES block)
  const clean = splitNarrationFromChoices(narration).narration;
  const bookClean = bookStripInteractivePrompts(stripLockedPrologue(clean));
  if (bookClean && !isPrologueOnlyText(bookClean)) appendBookEntry(roomId, { kind: "narration", text: (_sceneTruthFromText(bookClean) || bookClean) });

  // Beat accounting: kickoff counts as Beat 1.
  onBeatComplete(roomId, rulesResult.canon_tokens);
  pushBeatSummary(roomId, rulesResult.beat_summary);
  rollupSceneOnSceneAdvance(roomId);
  maybeSummarizeSceneAsync(roomId);
  saveRoomStateFile(roomId);

  // Kickoff delivery: send a POV-safe bundle to everyone.
  // This prevents blank screens for non-active players right after the dice roll.
  try {
    const truth = _sceneTruthFromText(narration) || String(narration || '').trim();
    await emitKickoffToAll(roomId, {
      from: narrOut.from,
      text: truth,
      truthText: truth,
      canon_tokens: rulesResult.canon_tokens,
      beat_summary: rulesResult.beat_summary,
      choices: rulesResult.choices,
      book_meta: getRoomState(roomId).book?.meta || null,
    });
  } catch {}

  // Mark kickoff complete (retry-safe)
  try {
    const st2 = getRoomState(roomId);
    st2.canon.tokens = clearFlagToken(st2.canon.tokens, 'needs_kickoff');
    st2._autoPlayStarting = false;
    st2._autoPlayStarted = true;
    saveRoomStateFile(roomId);
  } catch {}

  return true;
  } catch (e) {
    // No snapshot restore: kickoff should be retry-safe via server-authoritative state + flags.

    // If the local model is stalling, do not spam retries—fall back immediately so the game stays playable.
    try {
      const msg = String(e?.message || e || '');
      if (msg.includes('hard-timeout') || msg.includes('LLM hard-timeout') || msg.includes('exceeded 35000ms')) {
        const stX = getRoomState(roomId);
        const includePrologue = !stX._prologueDelivered;
        await emitLocalKickoff(roomId, { includePrologue });
        return true;
      }
    } catch {}

    if (_kickoffRestart < 2) {
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }
    throw e;
  }
}

return false;

  } catch (e) {
    // Allow retries: keep needs_kickoff flag, clear in-progress marker.
    try {
      const st2 = getRoomState(roomId);
      st2._autoPlayStarting = false;
      st2._autoPlayStarted = false;
      saveRoomStateFile(roomId);
    } catch {}

    // Final safety net: code-authored kickoff so the game is always playable.
    try {
      const st3 = getRoomState(roomId);
      const includePrologue = !st3._prologueDelivered;
      await emitLocalKickoff(roomId, { includePrologue });
      return true;
    } catch {
      throw e;
    }
  }
}




// Post-STATS safeguard:
// If the room is already in PLAY, all roster stats are locked, and the Book has no narration yet,
// force a kickoff (prevents a blank Play area in couch co-op / edge-case mode transitions).
async function kickoffIfReadyAfterStats(roomId, { reason = "post_stats_guard" } = {}) {
  const rid = String(roomId || "").trim();
  if (!rid) return false;

  const st = getRoomState(rid);
  if (!st) return false;
  if (!hasModeToken(st.canon.tokens, "PLAY")) return false;
  if (roomHasAnyNarration(st)) return false;

  // Require that all known player characters have stats before opening.
  let roster = Array.isArray(st.playerCharNames) ? st.playerCharNames : [];
  roster = roster.map(n => String(n || "").trim()).filter(Boolean);
  if (!roster.length) {
    // Fallback: derive from committed pc:...|stats: tokens.
    try { roster = getPcNamesFromTokens(st.canon.tokens) || []; } catch { roster = []; }
  }
  if (!roster.length) return false;
  const allHaveStats = roster.every(nm => hasPcStats(st.canon.tokens, nm));
  if (!allHaveStats) return false;

  try {
    if (!hasFlagToken(st.canon.tokens, "needs_kickoff")) {
      st.canon.tokens = setFlagToken(st.canon.tokens, "needs_kickoff", 1);
      saveRoomStateFile(rid);
    }
  } catch {}

  try {
    const started = await autoStartPlayIfNeeded(rid, { reason });
    return !!started;
  } catch (e) {
    try { io.to(rid).emit("error_msg", `Opening scene failed: ${String(e?.message || e)}`); } catch {}
    return false;
  }
}

function localBookscribe(actor, actionText) {
  const a = String(actor || "Someone").trim() || "Someone";
  const raw = String(actionText || "").trim();
  if (!raw) return `${a} acts.`;

  // UI travel messages should not appear verbatim in the Book.
  if (raw.startsWith('TRAVEL (UI-click):')) {
    const m = raw.match(/→\s*([^\.]+)\./);
    const dest = m ? String(m[1] || '').trim() : '';
    if (dest) return ensureSentencePunct(`${a} sets out toward ${dest}`);
    const mw = raw.match(/toward\s*\((\d{1,3})%\s*,\s*(\d{1,3})%\)/i);
    if (mw) return ensureSentencePunct(`${a} strikes out into the wilds`);
    return ensureSentencePunct(`${a} begins the journey`);
  }

  // Keep it cheap and conservative: do not invent outcomes.
  // If the player wrote in first-person, shift to third-person where possible.
  let s = raw;
  s = s.replace(/^\s*freeform\s*:\s*/i, '');
  s = s.replace(/^\s*i\b/i, a);
  s = s.replace(/^\s*my\b/i, `${a}'s`);
  s = s.replace(/^\s*me\b/i, a);

  // If the player wrote a question as an action, rewrite into an intent.
  if (/\?\s*$/.test(s)) {
    const low = s.toLowerCase();
    if (/^(do|can|could|would|should)\s+i\b/.test(low)) {
      s = `${a} tries to find out ${s.replace(/\?\s*$/, '')}`;
    } else if (/^is\s+there\b/.test(low) || /^are\s+there\b/.test(low)) {
      s = `${a} looks to see whether ${s.replace(/\?\s*$/, '')}`;
    }
  }

  // If it's an imperative ("Look around"), prefix actor (unless it already starts with a name-like token).
  const startsNameLike = /^[A-Za-z][A-Za-z\-' ]{1,32}\b/.test(s);
  if (!s.toLowerCase().startsWith(a.toLowerCase()) && !startsNameLike) {
    s = `${a} ${s}`;
  }

  s = s.replace(/\s+/g, " ").trim();
  return ensureSentencePunct(s);
}

// -------------------- BOOKSCRIBE (LLM, provider-agnostic) --------------------
async function callLLMForBookLine({ roomId, actor, actionText }) {

  const lastNarr = getLastNarrationSnippet(roomId, 1400);

  const system = `
You are AETHERYN_BOOKSCRIBE.
Rewrite the player's action as in-world narration that reads like a novel.
RULES:
- Output ONLY the rewritten narration line(s). No quotes. No headers. No bullet points.
- 1–2 sentences. Dark-fantasy tone. Present tense.
- Do NOT invent outcomes, new items, new characters, new locations, or new facts.
- You may only rephrase what the action *attempts* to do.
- Never mention UI, buttons, "choices", "player", "chat", or "AI".
`;

  const user = `
RECENT_NARRATION_SNIPPET (for tone/continuity; may be empty):
${lastNarr || "(none)"}

ACTOR:
${actor}

RAW_ACTION:
${String(actionText || "").trim()}
`;

  const out = await callLLMRole("book", {
    devMeta: { roomId, purpose: 'book_line' },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    temperature: Number(process.env.BOOKSCRIBE_TEMPERATURE || 0.6),
    maxTokens: Number(process.env.BOOK_MAX_TOKENS || 120),
    ollamaOptions: {
      num_ctx: Number(process.env.OLLAMA_NUM_CTX_BOOK || process.env.OLLAMA_NUM_CTX || 4096),
      repeat_last_n: Number(process.env.OLLAMA_REPEAT_LAST_N || 256),
      repeat_penalty: Number(process.env.OLLAMA_REPEAT_PENALTY || 1.15),
      top_k: Number(process.env.OLLAMA_TOP_K || 40),
      top_p: Number(process.env.OLLAMA_TOP_P || 0.9),
    }
  });

  return String(out || "").trim();
}



// -------------------- Socket.IO multiplayer --------------------
io.on("connection", (socket) => {

// LLM status snapshot for this client (helps avoid silent hangs).
try { socket.emit("llm:status", LLM_STATUS); } catch {}
socket.on("llm:probe", async () => {
  try {
    const s = await refreshLLMStatus();
    try { socket.emit("llm:status", s); } catch {}
    try { io.emit("llm:status", s); } catch {}
  } catch {}
});


  // Track join order per room (helps choose a stable host when the original host disconnects).
  function markJoin(roomState, sid) {
    try {
      if (!roomState._joinOrder) roomState._joinOrder = Object.create(null);
      roomState._joinOrder[sid] = roomState._joinOrder[sid] || Date.now();
    } catch {}
  }

  function unmarkJoin(roomState, sid) {
    try {
      if (roomState && roomState._joinOrder) delete roomState._joinOrder[sid];
    } catch {}
  }

  async function ensureHost(roomId) {
    const st = getRoomState(roomId);
    let sockets = [];
    try { sockets = await io.in(roomId).fetchSockets(); } catch { sockets = []; }
    if (!sockets.length) {
      st.hostSocketId = null;
      saveRoomStateFile(roomId);
      return null;
    }
    const hostExists = sockets.some(s => s.id === st.hostSocketId);
    if (hostExists) return st.hostSocketId;

    // Pick the earliest joiner still connected.
    let best = sockets[0];
    let bestTs = Number(st._joinOrder?.[best.id] || Date.now());
    for (const s of sockets) {
      const ts = Number(st._joinOrder?.[s.id] || Date.now());
      if (ts < bestTs) { best = s; bestTs = ts; }
    }

st.hostSocketId = best.id;
try {
  ensureIdentityMaps(st);
  const pid = getPlayerIdForSocket(st, best.id);
  if (pid) st.hostPlayerId = pid;
  for (const rec of Object.values(st.playersById || {})) {
    if (rec && typeof rec === 'object') rec.isHost = (rec.socketId === st.hostSocketId);
  }
} catch {}
saveRoomStateFile(roomId);
    return st.hostSocketId;
  }



// --- Multiplayer identity: server-authoritative player IDs (prevents "everyone is the host") ---
function ensureIdentityMaps(st) {
  try {
    if (!st.playersById) st.playersById = Object.create(null);
    if (!st.socketToPlayerId) st.socketToPlayerId = Object.create(null);
    if (!st.hostPlayerId) st.hostPlayerId = null;
  } catch {}
}

function genPlayerId() {
  return 'p_' + Math.random().toString(36).slice(2, 10);
}

function bindSocketToPlayer(roomId, st, socket) {
  ensureIdentityMaps(st);
  const joinName = String(socket?.data?.name || 'Anonymous').trim();
  const wantChar = String(socket?.data?.charName || '').trim();
  const joinKey = joinName.toLowerCase();
  const charKey = wantChar.toLowerCase();

  // Try to rebind to an existing player record by matching join name or character name.
  let reuse = null;
  try {
    for (const [pid, rec] of Object.entries(st.playersById || {})) {
      const rn = String(rec?.name || '').trim().toLowerCase();
      const rc = String(rec?.charName || '').trim().toLowerCase();
      if (charKey && rc && rc === charKey) { reuse = pid; break; }
      if (!reuse && joinKey && rn && rn === joinKey) { reuse = pid; }
    }
  } catch {}

  // If we are rebinding (reconnect/refresh) and the client didn't send their couch roster,
  // restore it from the last known player record so multi-character devices can keep working.
  const prev = (reuse && st.playersById && st.playersById[reuse]) ? st.playersById[reuse] : null;
  const sockList = Array.isArray(socket?.data?.charNames) ? socket.data.charNames : [];
  const restoredList = (!sockList.length && Array.isArray(prev?.charNames) && prev.charNames.length) ? prev.charNames : sockList;
  try { socket.data.charNames = restoredList; } catch {}
  if (!String(socket?.data?.charName || '').trim()) {
    const restoredChar = String(prev?.charName || '').trim();
    if (restoredChar) {
      try { socket.data.charName = restoredChar; } catch {}
    }
  }

  const pid = reuse || genPlayerId();
  const isHost = st.hostSocketId === socket.id;

  st.socketToPlayerId[socket.id] = pid;
  st.playersById[pid] = {
    playerId: pid,
    name: joinName,
    charName: String(socket?.data?.charName || '').trim() || String(prev?.charName || '').trim() || joinName,
    charNames: restoredList,
    socketId: socket.id,
    isHost: !!isHost,
    lastSeenAt: Date.now()
  };

  if (isHost) st.hostPlayerId = pid;

  try { socket.data.playerId = pid; } catch {}
  return pid;
}

function getPlayerIdForSocket(st, sid) {
  try {
    const pid = st?.socketToPlayerId?.[sid];
    return pid ? String(pid) : null;
  } catch { return null; }
}

async function getConnectedPlayerContexts(roomId) {
  const st = getRoomState(roomId);
  ensureIdentityMaps(st);
  let sockets = [];
  try { sockets = await io.in(roomId).fetchSockets(); } catch { sockets = []; }
  const out = [];
  for (const s of sockets) {
    const pid = getPlayerIdForSocket(st, s.id) || String(s?.data?.playerId || '').trim() || null;
    const nm = String(s?.data?.name || 'Anonymous').trim();
    const cn = String(s?.data?.charName || '').trim() || nm;
    const isHost = st.hostSocketId === s.id;
    out.push({ playerId: pid || '(unbound)', name: nm, charName: cn, isHost });
  }
  return out;
}

  socket.on("join", async ({ roomId, name, charName, charNames }) => {
    if (!roomId) return;
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.name = name || "Anonymous";
    // Optional local roster for couch co-op (trusted only for this connection).
    try {
      const list = Array.isArray(charNames) ? charNames : [];
      const uniq = [];
      const seen = new Set();
      for (const raw of list) {
        const s = String(raw || '').trim();
        if (!s) continue;
        const k = s.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        uniq.push(s);
      }
      socket.data.charNames = uniq;
    } catch { socket.data.charNames = []; }

    socket.data.charName = (charName || (Array.isArray(socket.data.charNames) && socket.data.charNames[0]) || "");

    const roomState = getRoomState(roomId);
    // Ensure this socket has a bound server-authoritative playerId.
    try { if (!socket.data.playerId) bindSocketToPlayer(roomId, roomState, socket); } catch {}

    // If this is a loaded room with an existing roster and the client didn't send charName,
    // try to bind them to a known character (prevents save/resume name drift).
    try {
      const roster = Array.isArray(roomState.playerCharNames) ? roomState.playerCharNames : [];
      const want = String(socket.data.charName || '').trim();
      if (!want && roster.length) {
        const joinName = String(socket.data.name || '').trim().toLowerCase();
        const hit = roster.find(r => String(r || '').trim().toLowerCase() === joinName);
        if (hit) socket.data.charName = String(hit).trim();
        else if ((!!roomState.isSingle || Number(roomState.expectedPlayers || 0) === 1) && roster.length === 1) socket.data.charName = String(roster[0] || '').trim();
      }
    } catch {}

    const actorName = normalizeActorName(roomState, socket);

    // Bind this socket to a stable server-authoritative playerId.
    const playerId = bindSocketToPlayer(roomId, roomState, socket);

    // Record join order for host reassignment.
    markJoin(roomState, socket.id);

    // Device-level intake expectation (prevents extra tabs/spectators from blocking).
    try {
      if (!!roomState.isSingle && !Number.isFinite(Number(roomState.expectedDevices || 0))) {
        roomState.expectedDevices = 1;
      }
    } catch {}
    // Room code convention: solo-* is always single-player.
    try {
      if (String(roomId || "").toLowerCase().startsWith("solo-")) {
        roomState.isSingle = true;
        // expectedPlayers is the number of characters (may be >1 for couch co-op).
      }
    } catch {}

    // Solo rooms should start straight into INTAKE (no lobby gating).
    try {
      if (!!roomState.isSingle || Number(roomState.expectedPlayers || 0) === 1) {
        if (!hasModeToken(roomState.canon.tokens, "INTAKE") && hasModeToken(roomState.canon.tokens, "LOBBY")) {
          roomState.canon.tokens = setModeToken(roomState.canon.tokens, "INTAKE");
          saveRoomStateFile(roomId);
        }
      }
    } catch {}
    // Ensure the host is always the first *connected* player in the room.
    // (If the original host disconnects, the next earliest joiner becomes host automatically.)
    try {
      if (!roomState.hostSocketId) roomState.hostSocketId = socket.id;
      await ensureHost(roomId);
    } catch {}
    const isHost = roomState.hostSocketId === socket.id;
    socket.emit("host_status", { isHost });
    socket.emit("state", {
      roomId,
      isHost,
      playerId: String(socket.data.playerId || ""),
      actorName,
      lastNarration: getLastBookNarration(roomState, 6000),
      myCharNames: (() => {
        try {
          const fromSock = Array.isArray(socket.data?.charNames) ? socket.data.charNames : [];
          if (fromSock.length) return fromSock;
          const rec = roomState?.intakePlayers?.[socket.id];
          const list = [];
          if (rec && Array.isArray(rec.answersPlayers)) {
            for (const p of rec.answersPlayers) {
              const nm = String(p?.q9 || '').trim();
              if (nm) list.push(nm);
            }
          } else {
            const nm = String(rec?.answers?.q9 || '').trim();
            if (nm) list.push(nm);
          }
          if (list.length) return list;
        } catch {}
        return actorName ? [actorName] : [];
      })(),
      playerCharNames: Array.isArray(roomState.playerCharNames) ? roomState.playerCharNames : [],
      runId: Number(roomState.runId || 0) || 0,
      intakeGlobalPresent: !!roomState.intakeGlobal,
      canon_tokens: roomState.canon.tokens,
      lastChoices: roomState.lastChoices,
      ooc: roomState.ooc || [],
      book_meta: roomState.book?.meta || null
    });


    // Canon version notice (host-only, once): helps diagnose save/canon mismatches without player policing.
    try {
      if (isHost && roomState._canonHashMismatch && !roomState._canonHashMismatch.notified) {
        roomState._canonHashMismatch.notified = true;
        saveRoomStateFile(roomId);
        socket.emit('system', `Notice: this save was created under canon ${roomState._canonHashMismatch.saved}, current canon is ${roomState._canonHashMismatch.current}. Continuity firewall will keep play consistent.`);
      }
    } catch {}

    // Turn state sync (initiative + current active player).
    try { await TURNS.syncToSocket(roomId, socket); } catch {}
    try {
      if (hasModeToken(roomState.canon.tokens, "PLAY")) {
        // Don't start initiative until the opening scene exists.
        // Otherwise players can land in turn order with blank prose ("blind" game start).
        const needsKickoff = (!hasFlagToken(roomState.canon.tokens, 'kickoff_done')) && (hasFlagToken(roomState.canon.tokens, 'needs_kickoff') || !roomHasAnyNarration(roomState));
        if (needsKickoff) {
          try {
            if (!hasFlagToken(roomState.canon.tokens, 'needs_kickoff')) {
              roomState.canon.tokens = setFlagToken(roomState.canon.tokens, 'needs_kickoff', 1);
              saveRoomStateFile(roomId);
            }
          } catch {}

          autoStartPlayIfNeeded(roomId, { reason: 'join_kickoff_guard' })
            .then(() => TURNS.startInitiative(roomId).catch(() => {}))
            .catch(() => {});
        } else {
          // Ensure a missing/legacy save gets a turn state.
          await TURNS.startInitiative(roomId);
        }
      }
    } catch {}


    // Self-heal: if the room is in PLAY but the Book has no opening narration yet,
    // generate an opening scene once on join (prevents a blank Play log).
    try {
      if (hasModeToken(roomState.canon.tokens, 'PLAY') && !hasFlagToken(roomState.canon.tokens, 'kickoff_done') && !roomHasAnyNarration(roomState)) {
        if (!hasFlagToken(roomState.canon.tokens, 'needs_kickoff')) {
          roomState.canon.tokens = setFlagToken(roomState.canon.tokens, 'needs_kickoff', 1);
          saveRoomStateFile(roomId);
        }
        autoStartPlayIfNeeded(roomId, { reason: 'join_missing_opening' })
          .catch((e) => { try { socket.emit('error_msg', `Opening scene failed: ${String(e?.message || e)}`); } catch {} });
      }
    } catch {}

    // If the room is in stat-allocation phase, prompt this socket to allocate (or wait).
    try {
      if (hasModeToken(roomState.canon.tokens, "STATS")) {
        const pref = roomState.intakeGlobal?.q0 || "";
        const list = Array.isArray(socket.data?.charNames) && socket.data.charNames.length
          ? socket.data.charNames
          : [normalizeActorName(roomState, socket)];
        let pick = String(list[0] || '').trim();
        let haveStats = pick ? hasPcStats(roomState.canon.tokens, pick) : false;
        for (const nm0 of list) {
          const nm = String(nm0 || '').trim();
          if (!nm) continue;
          if (!hasPcStats(roomState.canon.tokens, nm)) { pick = nm; haveStats = false; break; }
        }
        if (pick) socket.emit("stats_required", { charName: pick, haveStats, preference: pref, myCharNames: list });

        // Important: if the socket already has stats (especially in solo / reconnect cases),
        // re-check whether we can leave STATS immediately.
        try { maybeExitStatsPhase(roomId).catch(() => {}); } catch {}
      } else if (hasModeToken(roomState.canon.tokens, "PLAY")) {
        // If a player joins mid-campaign without stats, prompt them (server still enforces on action).
        const pref = roomState.intakeGlobal?.q0 || "";
        const list = Array.isArray(socket.data?.charNames) && socket.data.charNames.length
          ? socket.data.charNames
          : [getActorName(roomState, socket)];
        for (const nm0 of list) {
          const nm = String(nm0 || '').trim();
          if (!nm) continue;
          if (!hasPcStats(roomState.canon.tokens, nm)) {
            socket.emit("stats_required", { charName: nm, haveStats: false, preference: pref, myCharNames: list });
            break;
          }
        }
      }
    } catch {}

    saveRoomStateFile(roomId);
    io.to(roomId).emit("system", `${socket.data.name} joined room ${roomId}`);
  });

  // Client can switch which local character is "active" (couch co-op).
  // This affects which PC name the server binds to for actions/stats/inventory.
  socket.on('set_active_character', (payload = {}) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const st = getRoomState(roomId);
    const raw = String(payload?.charName || '').trim();
    const nm = sanitizeTokenField(raw, 80);
    if (!nm) return;

    // In multiplayer, never allow arbitrary character impersonation.
    // Prefer the server-side remembered couch roster; fall back to the bound player record.
    let allowed = Array.isArray(socket.data?.charNames) ? socket.data.charNames : [];
    try {
      const pid = getPlayerIdForSocket(st, socket.id) || String(socket.data?.playerId || '').trim() || null;
      if ((!allowed || !allowed.length) && pid && st.playersById && Array.isArray(st.playersById[pid]?.charNames) && st.playersById[pid].charNames.length) {
        allowed = st.playersById[pid].charNames;
        try { socket.data.charNames = allowed; } catch {}
      }
    } catch {}
    // If we still don't have a roster, only allow re-selecting the currently bound character.
    if (!allowed || !allowed.length) {
      const cur = String(socket.data?.charName || '').trim();
      allowed = cur ? [cur] : [];
    }

    const ok = allowed.some(n => String(n || '').trim().toLowerCase() === nm.toLowerCase());
    const soloLike = !!st.isSingle || Number(st.expectedPlayers || 0) === 1;
    if (!ok && !soloLike) {
      socket.emit('error_msg', 'That character is not registered on this device.');
      return;
    }

    socket.data.charName = nm;
    try { socket.emit('active_character', { charName: nm }); } catch {}
  });

  socket.on("disconnect", async () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const st = getRoomState(roomId);
    unmarkJoin(st, socket.id);

    // Identity: unbind this socket from player mapping (player record stays for rebind).
    try { if (st.socketToPlayerId) delete st.socketToPlayerId[socket.id]; } catch {}
    try {
      if (st.playersById) {
        for (const rec of Object.values(st.playersById)) {
          if (rec && rec.socketId === socket.id) { rec.socketId = null; rec.lastSeenAt = Date.now(); rec.isHost = false; }
        }
      }
    } catch {}

    // Turn system: if someone leaves during initiative, remove them so the room can't be stuck.
    // If the active player leaves mid-turn, skip to the next.
    try {
      const list = Array.isArray(socket.data?.charNames) && socket.data.charNames.length
        ? socket.data.charNames
        : [normalizeActorName(st, socket)];
      for (const nm0 of list) {
        const nm = String(nm0 || '').trim();
        if (!nm) continue;
        TURNS.handleDisconnect(roomId, nm);
      }
    } catch {}

    // Basic presence signal.
    try { io.to(roomId).emit("system", `${socket.data.name} left.`); } catch {}

    // If the host left, automatically promote the earliest connected player.
    try {
      const prevHost = st.hostSocketId;
      await ensureHost(roomId);
      if (st.hostSocketId && st.hostSocketId !== prevHost) {
        const sockets = await io.in(roomId).fetchSockets();
        for (const s of sockets) {
          try { s.emit('host_status', { isHost: s.id === st.hostSocketId }); } catch {}
          try { s.emit('room_meta', { runId: Number(st.runId || 0) || 0, intakeGlobalPresent: !!st.intakeGlobal }); } catch {}
        }
        io.to(roomId).emit('system', 'Host disconnected. A new host has been assigned automatically.');
      }
    } catch {}
  });

  // Host-only: move a multiplayer room from LOBBY -> INTAKE.
  // Purpose: let players join the room first, then start character creation together.
  socket.on("room_start_game", async (payload, ack) => {
    try {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      const st = getRoomState(roomId);
      const isHost = st.hostSocketId === socket.id;
      if (!isHost) {
        try { if (typeof ack === 'function') ack({ ok: false, error: 'Only the host can start the game.' }); } catch {}
        socket.emit("error_msg", "Only the host can start the game.");
        return;
      }
      if (!hasModeToken(st.canon.tokens, "LOBBY")) {
        const phaseNow = String(tokenValue(st.canon.tokens || [], ['mode']) || '').trim().toUpperCase();
        if (phaseNow === 'INTAKE') {
          try {
            socket.emit('intake_reset', {
              roomId,
              runId: Number(st.runId || 0) || 0,
              intakeGlobalPresent: !!st.intakeGlobal,
            });
            socket.emit('canon_update', {
              roomId,
              canon_tokens: st.canon.tokens,
              book_meta: st.book?.meta || null,
              runId: Number(st.runId || 0) || 0,
              intakeGlobalPresent: !!st.intakeGlobal,
            });
            socket.emit('state', {
              roomId,
              isHost: true,
              playerId: String(socket.data.playerId || ''),
              actorName: normalizeActorName(st, socket),
              lastNarration: getLastBookNarration(st, 6000),
              myCharNames: Array.isArray(socket.data?.charNames) ? socket.data.charNames : [],
              playerCharNames: Array.isArray(st.playerCharNames) ? st.playerCharNames : [],
              runId: Number(st.runId || 0) || 0,
              intakeGlobalPresent: !!st.intakeGlobal,
              canon_tokens: st.canon.tokens,
              lastChoices: st.lastChoices,
              ooc: st.ooc || [],
              book_meta: st.book?.meta || null,
            });
          } catch {}
          try { if (typeof ack === 'function') ack({ ok: true, phase: 'INTAKE', replay: true, runId: Number(st.runId || 0) || 0 }); } catch {}
          return;
        }
        try { if (typeof ack === 'function') ack({ ok: false, error: `Game already started (${phaseNow || 'not in LOBBY'}).` }); } catch {}
        socket.emit("error_msg", `Game already started (${phaseNow || 'not in LOBBY'}).` );
        return;
      }

      // Starting from LOBBY is treated as a fresh run.
      // Clear stale intake data so the host is forced to answer campaign-length/pacing/etc again.
      try {
        st.intakeGlobal = null;
        st.intakePlayers = Object.create(null);
        st.intakeCompleted = false;
        st._intakeProcessing = false;
        st.playerCharNames = [];
        st.expectedPlayers = undefined;
        st.isSingle = false;
        st.expectedDevices = undefined;
      } catch {}

      // Snapshot how many connected devices are expected to submit intake.
      try {
        const sockets = await io.in(roomId).fetchSockets();
        st.expectedDevices = Math.max(1, Math.min(8, sockets.length || 1));
      } catch {
        st.expectedDevices = 1;
      }

      // Increment run id (clients use this to avoid stale "already submitted" local storage).
      try { st.runId = (Number(st.runId || 0) || 0) + 1; } catch {}

      // -------------------- Fresh-run hard reset --------------------
      // Starting from LOBBY is a new run. Do NOT carry over:
      // - Book transcript, last choices, turn order, per-character stats/inventory/equipment
      // Otherwise the server can think kickoff already happened (old narration exists)
      // and players can land in PLAY with blank prose + stale choices.
      try { st.lastChoices = []; st._lastChoicesMeta = []; } catch {}
      try { st.ooc = []; } catch {}
      try { st.pendingPurchases = []; } catch {}
      try { st.pendingLoot = []; } catch {}
      try { st.deliveries = []; } catch {}
      try { st._autoPlayStarting = false; st._autoPlayStarted = false; st._autoPlayStartedAt = 0; delete st._autoPlayReason; } catch {}
      try { st._prologueDelivered = false; } catch {}
      try { st._introSeen = Object.create(null); st._introSeenChar = Object.create(null); } catch {}
      try { st._obs = []; st._obsSeen = Object.create(null); st._turnDigestCache = Object.create(null); } catch {}
      try { delete st.turn; } catch {}
      try { delete st.memory; } catch {}
      try {
        st.book = { entries: [], meta: normalizeBookMeta(null, []) };
        saveBook(roomId, st.book.entries, st.book.meta);
      } catch {}
      try { st._statsLocks = Object.create(null); st._statsPending = Object.create(null); } catch {}

      // Reset canonical tokens to a minimal baseline:
      // keep config + autosave flag, then set fresh loc/xy/start/time/mode.
      const keep = [];
      try {
        for (const t of (st.canon.tokens || [])) {
          const s = String(t || '').trim();
          const low = s.toLowerCase();
          if (low.startsWith('cfg:') || low.startsWith('cfg=')) { keep.push(s); continue; }
          if (low.startsWith('flag:autosave') || low.startsWith('flag=autosave')) { keep.push(s); continue; }
        }
      } catch {}
      st.canon.tokens = keep;
      // -------------------- End fresh-run hard reset --------------------

      let tokens = st.canon.tokens;
      // Fresh run: seeded, land-only start from canon-map settlements (never ocean).
      const sp = pickStartFromCanonMap(roomId, st.runId);
      tokens = setLoc(tokens, sp.loc || 'UNMAPPED');
      tokens = setXY(tokens, sp.x, sp.y);
      try {
        const startVal = `${String(sp.kingdom_id || '').trim() || ''}|${String(sp.loc || '').trim() || ''}`.trim();
        if (startVal) tokens = _upsertToken(tokens, 'start', sanitizeTokenField(startVal, 120));
      } catch {}
      // Fresh run baseline pressures.
      try { tokens = _upsertToken(tokens, 'pressure', '0'); } catch {}
      try { tokens = _upsertToken(tokens, 'residue', '0'); } catch {}
      tokens = ensureWorldClock(tokens, roomId);
      tokens = setModeToken(tokens, "INTAKE");
      st.canon.tokens = tokens;

      saveRoomStateFile(roomId);

      io.to(roomId).emit("system", "Host started the game. Intake is now open (host must set campaign settings)." );
      // Tell clients to reset any cached intake-submitted flags for this room.
      try {
        io.to(roomId).emit('intake_reset', {
          roomId,
          runId: Number(st.runId || 0) || 0,
          intakeGlobalPresent: false,
        });
      } catch {}
      io.to(roomId).emit("canon_update", {
        roomId,
        canon_tokens: st.canon.tokens,
        book_meta: st.book?.meta || null,
        runId: Number(st.runId || 0) || 0,
        intakeGlobalPresent: !!st.intakeGlobal,
      });
      try {
        const sockets = await io.in(roomId).fetchSockets();
        for (const s of sockets) {
          try {
            s.emit('state', {
              roomId,
              isHost: st.hostSocketId === s.id,
              playerId: String(s.data?.playerId || ''),
              actorName: normalizeActorName(st, s),
              lastNarration: getLastBookNarration(st, 6000),
              myCharNames: (() => {
                try {
                  const fromSock = Array.isArray(s.data?.charNames) ? s.data.charNames : [];
                  if (fromSock.length) return fromSock;
                  const rec = st?.intakePlayers?.[s.id];
                  const list = [];
                  if (rec && Array.isArray(rec.answersPlayers)) {
                    for (const p of rec.answersPlayers) {
                      const nm = String(p?.q9 || '').trim();
                      if (nm) list.push(nm);
                    }
                  } else {
                    const nm = String(rec?.answers?.q9 || '').trim();
                    if (nm) list.push(nm);
                  }
                  if (list.length) return list;
                } catch {}
                const nm = normalizeActorName(st, s);
                return nm ? [nm] : [];
              })(),
              playerCharNames: Array.isArray(st.playerCharNames) ? st.playerCharNames : [],
              runId: Number(st.runId || 0) || 0,
              intakeGlobalPresent: !!st.intakeGlobal,
              canon_tokens: st.canon.tokens,
              lastChoices: st.lastChoices,
              ooc: st.ooc || [],
              book_meta: st.book?.meta || null,
            });
          } catch {}
        }
      } catch {}
      try { if (typeof ack === 'function') ack({ ok: true, phase: 'INTAKE', runId: Number(st.runId || 0) || 0 }); } catch {}
    } catch (e) {
      try { if (typeof ack === 'function') ack({ ok: false, error: String(e?.message || e) }); } catch {}
      socket.emit("error_msg", String(e?.message || e));
    }
  });

  // Client-driven self-heal: if a device ends up in PLAY with choices but no scene prose,
  // it can request a deterministic local kickoff scene. Safe: server only responds when
  // PLAY is active and the Book has no real narration yet.
  socket.on("request_local_kickoff", async () => {
    try {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      const st = getRoomState(roomId);
      if (!st) return;
      if (!hasModeToken(st.canon.tokens, 'PLAY')) return;
      if (roomHasAnyNarration(st)) return;

      // Deduplicate per run.
      const run = Number(st.runId || 0) || 0;
      if (Number(st._localKickoffForcedRun || 0) === run) return;
      st._localKickoffForcedRun = run;
      saveRoomStateFile(roomId);

      const includePrologue = !st._prologueDelivered;
      await emitLocalKickoff(roomId, { includePrologue });
    } catch {}
  });

  // -------------------- Purchases / Loot Requests (DISABLED) --------------------
  // Nobody can "request" items/assets via UI events. Acquisitions are handled in-world via
  // code-authoritative ops (gain_item / buy_asset / gain_asset) from the GM pipeline.
  socket.on("purchase_request", () => {
    socket.emit("error_msg", "Requests are disabled. Buy or find assets through play.");
  });
  socket.on("purchase_decision", () => {
    socket.emit("error_msg", "Requests are disabled.");
  });
  socket.on("loot_request", () => {
    socket.emit("error_msg", "Requests are disabled. Find items through play.");
  });
  socket.on("loot_decision", () => {
    socket.emit("error_msg", "Requests are disabled.");
  });

// -------------------- House stash + Rest (code-authoritative) --------------------
  // These are pure bookkeeping operations. No model calls.
  // Rules:
  // - Only works at an owned house asset located at current loc:.
  // - Deposit/withdraw conserves totals (can't create items).
  // - Rest sets hp/mp/stamina current to max (only if those tokens exist).

  function stashKeyFor(byAsset, assetIdRaw) {
    const want = String(assetIdRaw || "").trim();
    if (!want) return "";
    const low = want.toLowerCase();
    for (const k of byAsset.keys()) {
      if (String(k).toLowerCase() === low) return k;
    }
    return want;
  }

  function parseMeter(tokens, key) {
    const k = String(key || "").trim().toLowerCase();
    for (let i = 0; i < (tokens || []).length; i++) {
      const s = String(tokens[i] || "").trim();
      const low = s.toLowerCase();
      if (!(low.startsWith(k + ":") || low.startsWith(k + "="))) continue;
      const body = s.slice(k.length + 1).trim();
      const m = body.match(/^(\d+)\s*\/\s*(\d+)$/);
      if (!m) return { idx: i, cur: null, max: null };
      return { idx: i, cur: Number(m[1]) || 0, max: Number(m[2]) || 0 };
    }
    return { idx: -1, cur: null, max: null };
  }

  function setMeter(tokens, key, cur, max) {
    const k = String(key || "").trim();
    const out = Array.isArray(tokens) ? [...tokens] : [];
    const info = parseMeter(out, k);
    if (info.idx < 0) return out; // do not invent max values
    const cc = Math.max(0, Math.floor(Number(cur) || 0));
    const mm = Math.max(0, Math.floor(Number(max) || 0));
    out[info.idx] = `${k}:${Math.min(cc, mm || cc)}/${mm || cc}`;
    return out;
  }

  socket.on("stash_transfer", (payload = {}) => {
    try {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      const st = getRoomState(roomId);
      const actor = normalizeActorName(st, socket);
      const loc = extractLoc(st.canon.tokens);

      const direction = String(payload?.direction || "").trim().toLowerCase();
      if (!(direction === "deposit" || direction === "withdraw")) throw new Error("Invalid stash direction.");
      const qty = Math.max(1, Math.min(999, Math.floor(Number(payload?.qty) || 0)));
      const itemRaw = String(payload?.item || "").trim();
      if (!itemRaw) throw new Error("Missing item name.");
      const itemKey = itemRaw.toLowerCase();

      const house = findUsableHouseAsset(st.canon.tokens, { actorName: actor, loc, assetId: payload?.assetId });
      if (!house) throw new Error("No usable house stash here.");

      // Inventory (per-character)
      const inv = parseInvMapFor(st.canon.tokens, actor);
      const haveInv = inv.get(itemKey) ?? 0;

      // Stash (per house)
      const by = parseStashByAsset(st.canon.tokens);
      const akey = stashKeyFor(by, house.id);
      if (!by.has(akey)) by.set(akey, new Map());
      const amap = by.get(akey);
      const haveSt = Math.max(0, Math.floor(Number(amap.get(itemKey)?.qty) || 0));
      const nameSt = String(amap.get(itemKey)?.name || itemRaw).trim() || itemRaw;

      if (direction === "deposit") {
        if (haveInv < qty) throw new Error(`You don't have enough of that in inventory (have ${haveInv}).`);
        invSetQty(inv, itemKey, itemRaw, haveInv - qty);
        amap.set(itemKey, { name: nameSt, qty: haveSt + qty });
      } else {
        if (haveSt < qty) throw new Error(`You don't have enough of that in stash (have ${haveSt}).`);
        amap.set(itemKey, { name: nameSt, qty: haveSt - qty });
        invSetQty(inv, itemKey, itemRaw, haveInv + qty);
        if ((amap.get(itemKey)?.qty || 0) <= 0) amap.delete(itemKey);
      }

      // Cleanup zeros
      if ((inv.get(itemKey) ?? 0) <= 0) invSetQty(inv, itemKey, itemRaw, 0);
      if (amap.size === 0) by.delete(akey);

      let tokens = st.canon.tokens;
      tokens = rebuildInvTokensFor(tokens, actor, inv);
      tokens = rebuildStashTokens(tokens, by);
      st.canon.tokens = tokens;
      saveRoomStateFile(roomId);

      io.to(roomId).emit("canon_update", {
        roomId,
        canon_tokens: st.canon.tokens,
        book_meta: st.book?.meta || null,
      });

      io.to(roomId).emit("system", `${actor} ${direction === 'deposit' ? 'deposited' : 'withdrew'} ${qty} ${itemRaw} ${direction === 'deposit' ? 'into' : 'from'} ${house.name || 'House'} stash.`);
    } catch (e) {
      socket.emit("error_msg", String(e?.message || e));
    }
  });

  socket.on("rest_at_house", (payload = {}) => {
    try {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      const st = getRoomState(roomId);
      const actor = normalizeActorName(st, socket);
      const loc = extractLoc(st.canon.tokens);

      const house = findUsableHouseAsset(st.canon.tokens, { actorName: actor, loc, assetId: payload?.assetId });
      if (!house) throw new Error("No usable house to rest at here.");

      let tokens = Array.isArray(st.canon.tokens) ? [...st.canon.tokens] : [];
      const hp = parseMeter(tokens, "hp");
      const mp = parseMeter(tokens, "mp");
      const stn = parseMeter(tokens, "stamina");

      if (hp.idx >= 0 && hp.max != null) tokens = setMeter(tokens, "hp", hp.max, hp.max);
      if (mp.idx >= 0 && mp.max != null) tokens = setMeter(tokens, "mp", mp.max, mp.max);
      if (stn.idx >= 0 && stn.max != null) tokens = setMeter(tokens, "stamina", stn.max, stn.max);

      // Also restore party-embedded vitals (preferred for per-character sync).
      try {
        const nm = String(actor || '').trim().toLowerCase();
        for (let i = 0; i < tokens.length; i++) {
          const p = parsePartyToken(tokens[i]);
          if (!p || !p.name) continue;
          if (String(p.name).trim().toLowerCase() !== nm) continue;
          const hpCur = Number.isFinite(p.hpMax) ? p.hpMax : p.hpCur;
          const mpCur = Number.isFinite(p.mpMax) ? p.mpMax : p.mpCur;
          const stCur = Number.isFinite(p.stMax) ? p.stMax : p.stCur;
          tokens[i] = rebuildPartyToken(p.name, hpCur, p.hpMax, p.status || 'OK', mpCur, p.mpMax, stCur, p.stMax);
          break;
        }
      } catch {}

      // Long rest is a real block of time.
      tokens = advanceTimeWorld(roomId, tokens, 8 * 60, "Long rest");

      st.canon.tokens = tokens;
      saveRoomStateFile(roomId);

      io.to(roomId).emit("canon_update", {
        roomId,
        canon_tokens: st.canon.tokens,
        book_meta: st.book?.meta || null,
      });

      io.to(roomId).emit("system", `${actor} rests at ${house.name || 'House'}. Vitals restored (if tracked).`);
    } catch (e) {
      socket.emit("error_msg", String(e?.message || e));
    }
  });

  // -------------------- Inventory: consume + equipment (code-authoritative) --------------------
  // These operations prevent "I totally ate rations" drift and stop equipment from being a narrative loophole.
  // Rules:
  // - Consume decreases inv: (cannot create items).
  // - Equip moves 1 unit from inv: into eq:<slot>=<item>. If slot already used, old item returns to inv:.
  // - Unequip moves the slotted item back to inv:.

  const cleanSlot = (s) => String(s || '').trim().toLowerCase().slice(0, 24).replace(/[^a-z0-9_-]/g, '');
  const cleanItemName = (s) => sanitizeTokenField(String(s || '').trim(), 80);

  function emitCanon(roomId, st) {
    io.to(roomId).emit("canon_update", {
      roomId,
      canon_tokens: st.canon.tokens,
      book_meta: st.book?.meta || null,
    });
  }


  // -------------------- Continuous Map Travel (every pixel is a destination) --------------------
  const defaultTravelMph = (method) => {
    const m = String(method || "walk").toLowerCase();
    if (m === "horse") return 6;
    if (m === "carriage") return 5;
    if (m === "sail") return 4;
    if (m === "climb") return 2;
    if (m === "portal") return 999;
    return 3; // walk
  };

  const isPortalAllowedByTokens = (tokens) => {
    const tks = Array.isArray(tokens) ? tokens.map(x => String(x || "")) : [];
    return tks.some(x =>
      /flag:(portal|teleport)/i.test(x) ||
      /travel:(portal|teleport)/i.test(x) ||
      /portal/i.test(x) ||
      /waygate/i.test(x)
    );
  };

  socket.on("travel:request", (payload = {}) => {
    try {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      const st = getRoomState(roomId);

      const actor = normalizeActorName(st, socket) || 'Someone';

      // Destination
      const destIn = payload.dest || payload.to || payload.destination;
      if (!destIn) return;
      const to = { x: clamp01(destIn.x), y: clamp01(destIn.y) };

      // Current XY (server-authoritative) — per-character.
      let tokens = ensureXY(st.canon.tokens);
      tokens = ensurePStatesForRoster(tokens, Array.isArray(st.playerCharNames) ? st.playerCharNames : []);
      const from = extractXYFor(tokens, actor) || parseXY(tokens) || { x: 0.5, y: 0.5 };

      // Method / speed
      let method = String(payload.method || payload.mode || "walk").toLowerCase();
      const portalOk = isPortalAllowedByTokens(tokens);
      if (method === "portal" && !portalOk) method = "walk";

      let mph = Number(payload.mph);
      if (!Number.isFinite(mph) || mph <= 0) mph = defaultTravelMph(method);
      // Clamp to prevent silly/cheaty speeds (except portal, which is gated)
      if (method !== "portal") mph = Math.min(25, Math.max(0.5, mph));

      const miles = mapDistanceMilesServer(from, to, MAP_WIDTH_MILES_DEFAULT);

      let minutesPassed = 0;
      if (miles > 0.01) {
        if (method === "portal") minutesPassed = 1;
        else minutesPassed = Math.max(1, Math.round((miles / mph) * 60));
      }

      // Location label:
      // - Pin travel can set LOC to that pin's label (a discovered/named place).
      // - Free travel must NEVER dump coordinates into LOC. For free clicks we keep LOC unchanged.
      const destType = String(payload.destType || payload.type || "free").toLowerCase();
      const destRaw = String(payload.destRaw || payload.raw || "").trim();
      const willSetLoc = (destType === "pin" && destRaw);

      // Apply canon updates (code-authoritative): per-actor xy (+ optional loc) + time
      tokens = setXYFor(tokens, actor, to.x, to.y);
      if (willSetLoc) tokens = setLocFor(tokens, actor, destRaw);
      tokens = advanceTime(tokens, minutesPassed);
      tokens = ensureWorldClock(tokens, roomId);

      // Update separation groups after movement.
      try {
        const roster = Array.isArray(st.playerCharNames) ? st.playerCharNames : [];
        tokens = recomputePartyGroups(tokens, roster);
      } catch {}

      st.canon.tokens = tokens;
      saveRoomStateFile(roomId);

      // Notify clients (map UI + HUD)
      io.to(roomId).emit("travel:applied", {
        roomId,
        by: socket.id,
        actor,
        from,
        to,
        method,
        mph,
        miles,
        minutesPassed,
        loc: (willSetLoc ? destRaw : null)
      });

      emitCanon(roomId, st);
    } catch {}
  });

  // Pin/calibration: let the server learn the "true" XY for the current LOC.
  // This keeps future travel distances and multiplayer positions consistent.
  socket.on("map_pin", (payload = {}) => {
    try {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      const st = getRoomState(roomId);

      const actor = normalizeActorName(st, socket) || 'Someone';

      const x = clamp01(payload.x);
      const y = clamp01(payload.y);

      let tokens = ensureXY(st.canon.tokens);
      tokens = setXYFor(tokens, actor, x, y);
      tokens = ensureWorldClock(tokens, roomId);

      try {
        const roster = Array.isArray(st.playerCharNames) ? st.playerCharNames : [];
        tokens = recomputePartyGroups(tokens, roster);
      } catch {}

      st.canon.tokens = tokens;
      saveRoomStateFile(roomId);

      emitCanon(roomId, st);
    } catch {}
  });
  socket.on('consume_item', (payload = {}) => {
    try {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      const st = getRoomState(roomId);
      const actor = normalizeActorName(st, socket);

      const itemRaw = cleanItemName(payload?.item);
      const qty = Math.max(1, Math.min(999, Math.floor(Number(payload?.qty) || 0)));
      if (!itemRaw) throw new Error('Missing item name.');

      const inv = parseInvMapFor(st.canon.tokens, actor);
      const k = itemRaw.toLowerCase();
      const have = inv.get(k) ?? 0;
      if (have < qty) throw new Error(`Not enough in inventory (have ${have}).`);
      const next = have - qty;
      invSetQty(inv, k, itemRaw, next);

      st.canon.tokens = rebuildInvTokensFor(st.canon.tokens, actor, inv);

      // Code-authoritative consume effects for certain foods/potions.
      try {
        const eff = CONSUME_EFFECTS[String(itemRaw || '').trim().toLowerCase()];
        if (eff && Array.isArray(eff) && eff.length) {
          for (const e of eff) {
            const meter = String(e?.meter || '').trim().toLowerCase();
            const delta = Math.floor(Number(e?.delta) || 0);
            if (!meter || !delta) continue;
            // Update the global meters (if present) and the actor's party token (preferred for per-PC sync).
            st.canon.tokens = applyMeterDelta(st.canon.tokens, meter, delta);
            st.canon.tokens = applyPartyMeterDelta(st.canon.tokens, actor, meter, delta);
          }
        }
      } catch {}

      saveRoomStateFile(roomId);
      emitCanon(roomId, st);
      io.to(roomId).emit('system', `${actor} consumes ${qty} ${itemRaw}.`);
    } catch (e) {
      socket.emit('error_msg', String(e?.message || e));
    }
  });

  
  // -------------------- Crafting / Recipes / Forage / Hunt --------------------
  socket.on('craft_list', (_payload = {}) => {
    try {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      const st = getRoomState(roomId);
      const actor = normalizeActorName(st, socket);
      const loc = extractLoc(st.canon.tokens);
      const { region, biome } = inferRegionBiome(st.canon.tokens);
      const recipes = listCraftRecipesForActor(st, actor);
      socket.emit('craft_list', { ok: true, region, biome, loc, recipes });
    } catch (e) {
      socket.emit('error_msg', String(e?.message || e));
    }
  });

  socket.on('craft_make', (payload = {}) => {
    try {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      const st = getRoomState(roomId);
      const actor = normalizeActorName(st, socket);

      // Avoid crafting mid-combat.
      const mode = String(getTokenValue(st.canon.tokens, 'mode') || '').trim().toUpperCase();
      if (mode === 'COMBAT') {
        socket.emit('error_msg', 'Crafting is disabled during COMBAT.');
        return;
      }

      // Light throttle.
      const now = Date.now();
      const last = Number(socket.data._craftLastAt || 0);
      if (now - last < 500) return;
      socket.data._craftLastAt = now;

      const recipeId = String(payload?.recipeId || '').trim();
      const qty = Math.max(1, Math.min(99, Math.floor(Number(payload?.qty) || 1)));

      const res = craftRecipeApply(st, actor, recipeId, qty);
      if (!res.ok) throw new Error(res.error || 'Craft failed.');

      saveRoomStateFile(roomId);
      emitCanon(roomId, st);

      const madeLine = (res.produced || []).map(x => `${x.qty} ${x.item}`).join(', ');
      io.to(roomId).emit('system', `${actor} crafts ${madeLine}.`);
      try { socket.emit('craft_done', { ok: true, recipeId, qty, produced: res.produced, consumed: res.consumed }); } catch {}
      try {
        const { region, biome, loc } = { ...inferRegionBiome(st.canon.tokens), loc: extractLoc(st.canon.tokens) };
        socket.emit('craft_list', { ok: true, region, biome, loc, recipes: listCraftRecipesForActor(st, actor) });
      } catch {}
    } catch (e) {
      socket.emit('error_msg', String(e?.message || e));
    }
  });

  socket.on('gather_start', (payload = {}) => {
    try {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      const st = getRoomState(roomId);
      const actor = normalizeActorName(st, socket);

      const mode = String(getTokenValue(st.canon.tokens, 'mode') || '').trim().toUpperCase();
      if (mode === 'COMBAT') {
        socket.emit('error_msg', 'Gathering is disabled during COMBAT.');
        return;
      }

      // Throttle.
      const now = Date.now();
      const last = Number(socket.data._gatherLastAt || 0);
      if (now - last < 800) return;
      socket.data._gatherLastAt = now;

      const kind = String(payload?.kind || 'forage').trim().toLowerCase();
      const biome = sanitizeTokenField(String(payload?.biome || '').trim(), 40) || inferRegionBiome(st.canon.tokens).biome;

      // Use the existing Action Roll modal (1d20) but resolve without invoking the GM.
      socket.data._pendingActionRoll = {
        kind: 'gather',
        gatherKind: (kind === 'hunt') ? 'hunt' : 'forage',
        biome,
        actor,
        spec: { sides: 20, count: 1, dropLowest: false, label: (kind === 'hunt') ? 'Hunt Roll' : 'Forage Roll' },
        target: 10,
        text: `${kind === 'hunt' ? 'Hunt' : 'Forage'} (${biome})`
      };

      socket.emit('action_roll_required', {
        actor,
        spec: { sides: 20, count: 1, dropLowest: false, label: (kind === 'hunt') ? 'Hunt Roll' : 'Forage Roll' },
        label: (kind === 'hunt') ? 'Hunt Roll' : 'Forage Roll',
        note: `Roll 1d20 to ${kind === 'hunt' ? 'hunt' : 'forage'} in ${biome}.`
      });
    } catch (e) {
      socket.emit('error_msg', String(e?.message || e));
    }
  });
  // -------------------- END Crafting --------------------

socket.on('equip_item', (payload = {}) => {
    try {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      const st = getRoomState(roomId);
      const actor = normalizeActorName(st, socket);

      const slot = cleanSlot(payload?.slot);
      const itemRaw = cleanItemName(payload?.item);
      if (!slot) throw new Error('Missing slot.');
      if (!itemRaw) throw new Error('Missing item name.');

      const inv = parseInvMapFor(st.canon.tokens, actor);
      const eq = parseEqMapFor(st.canon.tokens, actor);

      const k = itemRaw.toLowerCase();
      const have = inv.get(k) ?? 0;
      if (have < 1) throw new Error(`You don't have that item in inventory (have ${have}).`);

      // If slot is occupied, return old item to inventory.
      const prevItem = String(eq.get(slot) || '').trim();
      if (prevItem) {
        const pk = prevItem.toLowerCase();
        invAddQty(inv, pk, prevItem, 1);
      }

      // Move one of the new item into the slot.
      invSetQty(inv, k, itemRaw, have - 1);
      eq.set(slot, itemRaw);

      let tokens = st.canon.tokens;
      tokens = rebuildInvTokensFor(tokens, actor, inv);
      tokens = rebuildEqTokensFor(tokens, actor, eq);
      st.canon.tokens = tokens;
      saveRoomStateFile(roomId);
      emitCanon(roomId, st);
      io.to(roomId).emit('system', `${actor} equips ${itemRaw} to ${slot}.`);
    } catch (e) {
      socket.emit('error_msg', String(e?.message || e));
    }
  });

  socket.on('unequip_item', (payload = {}) => {
    try {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      const st = getRoomState(roomId);
      const actor = normalizeActorName(st, socket);

      const slot = cleanSlot(payload?.slot);
      if (!slot) throw new Error('Missing slot.');

      const inv = parseInvMapFor(st.canon.tokens, actor);
      const eq = parseEqMapFor(st.canon.tokens, actor);

      const item = String(eq.get(slot) || '').trim();
      if (!item) throw new Error('Nothing equipped in that slot.');

      const k = item.toLowerCase();
      invAddQty(inv, k, item, 1);
      eq.delete(slot);

      let tokens = st.canon.tokens;
      tokens = rebuildInvTokensFor(tokens, actor, inv);
      tokens = rebuildEqTokensFor(tokens, actor, eq);
      st.canon.tokens = tokens;
      saveRoomStateFile(roomId);
      emitCanon(roomId, st);
      io.to(roomId).emit('system', `${actor} unequips ${item} from ${slot}.`);
    } catch (e) {
      socket.emit('error_msg', String(e?.message || e));
    }
  });

  
  socket.on('move_equipped', (payload = {}) => {
    try {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      const st = getRoomState(roomId);
      const actor = normalizeActorName(st, socket);

      const from = cleanSlot(payload?.from);
      const to = cleanSlot(payload?.to);
      if (!from) throw new Error('Missing from slot.');
      if (!to) throw new Error('Missing to slot.');
      if (from === to) return;

      const inv = parseInvMapFor(st.canon.tokens, actor);
      const eq = parseEqMapFor(st.canon.tokens, actor);

      const item = String(eq.get(from) || '').trim();
      if (!item) throw new Error('Nothing equipped in the source slot.');

      // If destination is occupied, return its item to inventory.
      const prevItem = String(eq.get(to) || '').trim();
      if (prevItem) {
        const pk = prevItem.toLowerCase();
        invAddQty(inv, pk, prevItem, 1);
      }

      eq.delete(from);
      eq.set(to, item);

      let tokens = st.canon.tokens;
      tokens = rebuildInvTokensFor(tokens, actor, inv);
      tokens = rebuildEqTokensFor(tokens, actor, eq);
      st.canon.tokens = tokens;

      saveRoomStateFile(roomId);
      emitCanon(roomId, st);
      io.to(roomId).emit('system', `${actor} moves equipped ${item} (${from} → ${to}).`);
    } catch (e) {
      socket.emit('error_msg', String(e?.message || e));
    }
  });

// -------------------- GM Tools (Host only) --------------------
  socket.on("request_scene_break", () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const roomState = getRoomState(roomId);
    const isHost = roomState.hostSocketId === socket.id;
    if (!isHost) return;
    requestSceneBreak(roomId);
    io.to(roomId).emit("system", `GM: requested a scene break (will apply after >= ${MIN_BEATS_PER_SCENE} beats).`);
  });

  socket.on("end_session", async () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const roomState = getRoomState(roomId);
    const isHost = roomState.hostSocketId === socket.id;
    if (!isHost) return;

    try {
      const out = await endSessionAndTitleChapter(roomId);
      io.to(roomId).emit("system", `Session ended. Chapter ${out.chapterNo} titled: ${out.title}`);
      io.to(roomId).emit("chapter_titled", out);
    } catch (err) {
      socket.emit("error_msg", String(err?.message || err));
    }
  });


socket.on("intake_submit", async (payload) => {
  const roomId = socket.data.roomId;
  if (!roomId) return;
  const roomState = getRoomState(roomId);

  const isHost = roomState.hostSocketId === socket.id;

  // Store global intake only from host
  if (payload?.answersGlobal && isHost) {
    roomState.intakeGlobal = payload.answersGlobal;
    try {
      io.to(roomId).emit('room_meta', {
        runId: Number(roomState.runId || 0) || 0,
        intakeGlobalPresent: true,
      });
    } catch {}
  }

  // Store per-player answers
  {
    const joinName = String(payload?.joinName || socket.data.name || "Anonymous");
    const devicePlayers = Math.max(1, Math.min(8, Math.floor(Number(payload?.devicePlayers || 0) || 0) || (Array.isArray(payload?.answersPlayers) ? payload.answersPlayers.length : 1)));
    const answersPlayers = Array.isArray(payload?.answersPlayers) ? payload.answersPlayers.slice(0, devicePlayers) : [payload?.answersPlayer || {}];
    const first = (answersPlayers[0] && typeof answersPlayers[0] === 'object') ? answersPlayers[0] : (payload?.answersPlayer || {});
    roomState.intakePlayers[socket.id] = {
      joinName,
      devicePlayers,
      answersPlayers,
      answers: first
    };
    // Bind local roster to this socket connection.
    try {
      const list = [];
      const seen = new Set();
      for (const p of answersPlayers) {
        const nm = String(p?.q9 || '').trim();
        const key = nm.toLowerCase();
        if (!nm || seen.has(key)) continue;
        seen.add(key);
        list.push(nm);
      }
      socket.data.charNames = list;
      const want = String(payload?.activeCharName || socket.data.charName || '').trim();
      if (want && list.some(n => n.toLowerCase() === want.toLowerCase())) socket.data.charName = want;
      else socket.data.charName = list[0] || String(first?.q9 || '').trim() || socket.data.charName || '';
    } catch {}
  }


  saveRoomStateFile(roomId);

  io.to(roomId).emit("system", `${socket.data.name}: submitted intake.`);

  // Decide if intake can complete:
  const socketsInRoom = await io.in(roomId).fetchSockets();
  const playerSockets = socketsInRoom.filter(s => !!(roomState.intakePlayers && roomState.intakePlayers[s.id]));

  // Device-level expectation: set when the host starts the room from LOBBY.
  let expectedDevices = 1;
  try {
    const n = parseInt(String(roomState.expectedDevices || '').trim(), 10);
    if (Number.isFinite(n) && n > 0) expectedDevices = Math.max(1, Math.min(8, n));
  } catch {}

  // Persist mode (single vs multi) but DO NOT force character count to 1 (couch co-op can be >1).
  try {
    roomState.isSingle = String(payload?.mode || '').toLowerCase() === 'single' || !!roomState.isSingle;
    if (!!roomState.isSingle) expectedDevices = 1;
    roomState.expectedDevices = expectedDevices;
  } catch {}

  // Compute how many characters are represented by submitted device intakes.
  let expectedPlayers = 0;
  try {
    for (const s of playerSockets) {
      const rec = roomState.intakePlayers?.[s.id];
      const dp = Math.max(1, Math.min(8, Math.floor(Number(rec?.devicePlayers || 1) || 1)));
      expectedPlayers += dp;
    }
  } catch {}
  expectedPlayers = Math.max(1, Math.min(8, expectedPlayers || 1));

  // Persist for later phases (especially STATS gating / reconnect self-heal).
  try { roomState.expectedPlayers = expectedPlayers; } catch {}

  const haveGlobal = !!roomState.intakeGlobal || (!!roomState.isSingle && isHost);
  const havePlayers = playerSockets.length >= 1;
  const haveEnoughDevices = playerSockets.length >= expectedDevices;
  const haveEnoughPlayers = haveEnoughDevices;

  // Help the client understand "why nothing happened".
  // (Common cases: waiting on other players / waiting on host campaign settings.)
  try {
    if (!roomState.intakeCompleted) {
      if (!haveGlobal) {
        socket.emit("system", "Intake saved. Waiting for the host to finish campaign settings.");
      } else if (!haveEnoughPlayers) {
        const need = Math.max(0, expectedDevices - playerSockets.length);
        socket.emit("system", `Intake saved. Waiting for ${need} more device(s) to submit intake.`);
      } else {
        socket.emit("system", "Intake complete. Processing with AI...");
      }
    }
  } catch {}

if (havePlayers && haveGlobal && haveEnoughPlayers && !roomState.intakeCompleted) {
    // Avoid duplicate processing if multiple clients submit simultaneously.
    if (roomState._intakeProcessing) {
      try { socket.emit("system", "Intake is already being processed. Waiting for AI..."); } catch {}
      return;
    }

    roomState._intakeProcessing = true;
    saveRoomStateFile(roomId);

    // Persist a stable roster of player character names for STATS gating (survives reconnects).
    try {
      const roster = [];
      let sumRequested = 0;
      const counts = Object.create(null);

      const addName = (raw) => {
        const base = sanitizeTokenField(String(raw || '').trim(), 80) || 'Anonymous';
        const key = base.toLowerCase();
        counts[key] = (counts[key] || 0) + 1;
        const nm = counts[key] === 1 ? base : `${base} #${counts[key]}`;
        // Hard cap to 8 player characters.
        if (roster.length >= 8) return null;
        roster.push(nm);
        return nm;
      };

      for (const s of playerSockets) {
        const rec = roomState.intakePlayers?.[s.id] || null;
        const joinName = String(rec?.joinName || s.data?.name || 'Anonymous').trim();
        const list = Array.isArray(rec?.answersPlayers) ? rec.answersPlayers : [rec?.answers || {}];
        const localNames = [];

        const dp = Math.max(1, Math.min(8, Math.floor(Number(rec?.devicePlayers || list.length || 1) || 1)));
        sumRequested += dp;

        for (let i = 0; i < list.length; i++) {
          const pa = list[i] && typeof list[i] === 'object' ? list[i] : {};
          const rawName = String(pa.q9 || (i === 0 ? joinName : `${joinName} ${i + 1}`) || '').trim();
          const nm = addName(rawName);
          if (!nm) break;
          try { pa.q9 = nm; } catch {}
          localNames.push(nm);
        }

        // Bind to socket for immediate use
        try { s.data.charNames = localNames; } catch {}
        try { s.data.charName = localNames[0] || s.data.charName || ''; } catch {}

        // Persist the canonical (disambiguated) roster onto the server-side player record
        // so reconnects/refreshes don't lose couch co-op identity.
        try {
          const pid = getPlayerIdForSocket(roomState, s.id) || String(s.data?.playerId || '').trim();
          if (pid && roomState.playersById && roomState.playersById[pid]) {
            roomState.playersById[pid].charNames = localNames;
            roomState.playersById[pid].charName = localNames[0] || roomState.playersById[pid].charName || '';
          }
        } catch {}
      }

      if (sumRequested > 8) {
        try { io.to(roomId).emit('system', `Party size requested (${sumRequested}) exceeds the max (8). Extra characters beyond 8 were not created.`); } catch {}
      }

      roomState.playerCharNames = roster;
      roomState.expectedPlayers = Math.max(1, Math.min(8, roster.length || 1));
      // Ensure cfg:players is code-authoritative.
      try {
        if (roomState.intakeGlobal && typeof roomState.intakeGlobal === 'object') {
          roomState.intakeGlobal.q1 = String(roomState.expectedPlayers);
        }
      } catch {}
    } catch {}

    // Intake completion is code-authoritative (no LLM call here).


    try {
      try { io.to(roomId).emit("system", "GM: finalizing intake..."); } catch {}

      // Intake completion is a host-authoritative state build, regardless of which client submits last.
      roomState.canon.tokens = applyIntakeToTokens(roomState.canon.tokens, roomState, playerSockets);

      // Mark intake complete ONLY after the AI step succeeds.
      const stNow = getRoomState(roomId);
      stNow.intakeCompleted = true;
      stNow._intakeProcessing = false;

      // Start a new Chapter (Session) in the Book. Title is added ONLY at end of session.
      ensureChapterOpen(roomId);

      // Force stat allocation immediately after character creation (no play until done).
      try { stNow._statsRollCount = Object.create(null); } catch {}
      try { stNow.canon.tokens = removeAllPcStatsTokens(stNow.canon.tokens); } catch {}
      stNow.canon.tokens = setModeToken(stNow.canon.tokens, "STATS");
      saveRoomStateFile(roomId);

      // Ping all players to open their Stat Allocation window (or show "waiting" if already done).
      try {
        for (const s of playerSockets) {
          const pref = stNow.intakeGlobal?.q0 || "";
          const list = Array.isArray(s.data?.charNames) && s.data.charNames.length
            ? s.data.charNames
            : [normalizeActorName(stNow, s)];
          let pick = String(list[0] || '').trim();
          let haveStats = pick ? hasPcStats(stNow.canon.tokens, pick) : false;
          for (const nm0 of list) {
            const nm = String(nm0 || '').trim();
            if (!nm) continue;
            if (!hasPcStats(stNow.canon.tokens, nm)) { pick = nm; haveStats = false; break; }
          }
          if (pick) s.emit("stats_required", { charName: pick, haveStats, preference: pref, myCharNames: list });
        }
      } catch {}

      // IMPORTANT: during mandatory stat allocation, the narrator must stay silent.
      // We only broadcast state so clients can lock play and open the Stats modal.
      try {
        const stAfter = getRoomState(roomId);
        io.to(roomId).emit("canon_update", {
          roomId,
          canon_tokens: stAfter.canon.tokens,
          lastChoices: stAfter.lastChoices,
          book_meta: stAfter.book?.meta || null
        });
      } catch {}

    } catch (err) {
      // Do NOT leave the room stuck in a half-completed intake.
      try {
        roomState._intakeProcessing = false;
        roomState.intakeCompleted = false;
        saveRoomStateFile(roomId);
      } catch {}

      try {
        io.to(roomId).emit(
          "system",
          "GM: intake processing failed (often a slow model / big prompt). Open Settings → AI Model and choose a smaller model, or increase LLM_TIMEOUT_MS in server/.env, then re-submit intake."
        );
      } catch {}

      io.to(roomId).emit("error_msg", String(err?.message || err));
    emitAiError(roomId, err);
    }
  }
});

  
  // -------------------- Stat Allocation (Mandatory) --------------------
  async function maybeExitStatsPhase(roomId){
    const st = getRoomState(roomId);
    if (!hasModeToken(st.canon.tokens, "STATS")) return;

    // Absolute rule: single-player should never be stuck waiting for players.
    // If the room expects 1 player (or was started in single mode), exit STATS as soon as *any* valid
    // pc:...|stats: token exists for the canonical solo character.
	    try {
	      const expected = Number(st.expectedPlayers || 0) || 0;
	      const roster = Array.isArray(st.playerCharNames) ? st.playerCharNames : [];
	      // "True solo" means 1 device AND 1 character. If the roster has multiple names,
	      // this is couch co-op and must complete stats for the whole roster.
	      const isTrueSolo = !!st.isSingle && expected === 1 && roster.length <= 1;
	      if (isTrueSolo) {
	        const sockets = await io.in(roomId).fetchSockets();

	        // Extra guard: if the connected socket advertises multiple local characters,
	        // treat it as couch co-op even if expectedPlayers was left at 1.
	        const hasCouchRoster = (sockets || []).some(s => Array.isArray(s?.data?.charNames) && s.data.charNames.length > 1);
	        if (!hasCouchRoster) {

        let canonName = String((roster[0] || "")).trim();
        if (!canonName) {
          // Fallback: if there is exactly one pc stats token, treat its name as canonical.
          const names = [];
          for (const t of (st.canon.tokens || [])) {
            const parsed = parsePcStatsToken(t);
            if (parsed?.name) names.push(String(parsed.name).trim());
          }
          const uniq = Array.from(new Set(names.map(n => sanitizeTokenField(n, 80).toLowerCase()).filter(Boolean)));
          if (uniq.length === 1) canonName = names.find(n => sanitizeTokenField(n, 80).toLowerCase() === uniq[0]) || canonName;
        }
        if (!canonName && sockets.length) canonName = normalizeActorName(st, sockets[0]);

	        if (canonName) {
          // Self-heal: if stats exist under a drifted name, rewrite to canonical and continue.
          const pcStats = [];
          for (const t of (st.canon.tokens || [])) {
            const parsed = parsePcStatsToken(t);
            if (parsed && parsed.name && parsed.stats && Object.keys(parsed.stats).length) pcStats.push(parsed);
          }
          if (pcStats.length === 1 && !hasPcStats(st.canon.tokens, canonName)) {
            let nextTokens = Array.isArray(st.canon.tokens) ? [...st.canon.tokens] : [];
            nextTokens = removePcStatsTokenByName(nextTokens, pcStats[0].name);
            nextTokens = upsertPcStats(nextTokens, canonName, pcStats[0].stats);
            st.canon.tokens = nextTokens;
            saveRoomStateFile(roomId);
          }

          if (hasPcStats(st.canon.tokens, canonName)) {
            st.canon.tokens = setModeToken(st.canon.tokens, "PLAY");
            st.canon.tokens = clearFlagToken(st.canon.tokens, 'kickoff_done');
            st.canon.tokens = setFlagToken(st.canon.tokens, 'needs_kickoff', 1);
            saveRoomStateFile(roomId);

            // Turn order is server-sided and instant. The opening scene is generated only
            // after initiative locks (handleTurnOrderLocked).
            try { io.to(roomId).emit("system", "Stats locked. Rolling turn order..."); } catch {}
            try { await TURNS.startInitiative(roomId); } catch {}

            try {
              io.to(roomId).emit("canon_update", {
                roomId,
                canon_tokens: st.canon.tokens,
                book_meta: st.book?.meta || null,
              });
            } catch {}
	            return;
	          }
	        }
	        }
      }
    } catch {}

    const roster = Array.isArray(st.playerCharNames) ? st.playerCharNames : [];
    const rosterKeys = new Set(
      roster
        .map(n => sanitizeTokenField(n, 80).toLowerCase())
        .filter(Boolean)
    );

    const sockets = await io.in(roomId).fetchSockets();

    // ---- Solo hardening / self-heal ----
    // If there's only ONE connected socket, we should never be stuck in STATS because of name drift.
    // We repair the pc:...|stats: token name to match the room's canonical character name (roster[0] if present),
    // then immediately leave STATS.
    try {
      if (sockets.length === 1) {
        const sole = sockets[0];
	        const soleHasCouchRoster = Array.isArray(sole?.data?.charNames) && sole.data.charNames.length > 1;
	        // Couch co-op (multiple local characters on one device) must NOT auto-exit STATS.
	        // Each character must lock stats individually.
	        if (soleHasCouchRoster) {
	          // fall through to normal roster/socket-based gating below
	        } else {
        const canonName = String((Array.isArray(st.playerCharNames) && st.playerCharNames.length ? st.playerCharNames[0] : normalizeActorName(st, sole)) || "").trim() || "Anonymous";

        // Gather all existing pc stats tokens.
        const pcStats = [];
        for (const t of (st.canon.tokens || [])) {
          const parsed = parsePcStatsToken(t);
          if (parsed && parsed.name && parsed.stats && Object.keys(parsed.stats).length) pcStats.push(parsed);
        }

        if (pcStats.length) {
          const canonKey = sanitizeTokenField(canonName, 80).toLowerCase();

          const alreadyCanon = pcStats.find(p => sanitizeTokenField(p.name, 80).toLowerCase() === canonKey);

          // Only auto-heal/auto-exit in SOLO when we're confident this is the same character:
          // - the canonical name already has a stats token, OR
          // - there is exactly one stats token and a 1-name roster (name drift).
          const rosterIsSolo = Array.isArray(st.playerCharNames) && st.playerCharNames.length === 1;
          if (alreadyCanon || (pcStats.length === 1 && rosterIsSolo)) {
            const primary = alreadyCanon || pcStats[0];

            // Normalize: remove all pc stats tokens then upsert a single canonical one.
            let nextTokens = Array.isArray(st.canon.tokens) ? [...st.canon.tokens] : [];
            for (const p of pcStats) {
              nextTokens = removePcStatsTokenByName(nextTokens, p.name);
            }
            nextTokens = upsertPcStats(nextTokens, canonName, primary.stats);
            st.canon.tokens = setModeToken(nextTokens, "PLAY");
            st.canon.tokens = clearFlagToken(st.canon.tokens, 'kickoff_done');
            st.canon.tokens = setFlagToken(st.canon.tokens, 'needs_kickoff', 1);
            saveRoomStateFile(roomId);

            try {
              io.to(roomId).emit("system", "Stats locked. Opening scene...");
              const started = await autoStartPlayIfNeeded(roomId, { reason: "post_stats_solo_heal" });
              if (!started) {
                io.to(roomId).emit("canon_update", {
                  roomId,
                  canon_tokens: st.canon.tokens,
                  book_meta: st.book?.meta || null,
                });
              }
            } catch (e) {
              try { io.to(roomId).emit('error_msg', `Opening scene failed: ${String(e?.message || e)}`); } catch {}
              io.to(roomId).emit("canon_update", {
                roomId,
                canon_tokens: st.canon.tokens,
                book_meta: st.book?.meta || null,
              });
            }

            // Start turn order (solo auto-locks to the only player).
            try { await TURNS.startInitiative(roomId); } catch {}
            return;
          }
        }
	        }
      }
    } catch {}

    // Only connected *player* sockets should block leaving STATS.
    // - If a fresh socket joins mid-STATS but hasn't submitted intake yet, it should NOT block.
    // - Names are normalized to roster entries when possible.
    let needNames = [];

    // If the room has a roster (including couch co-op characters), require stats for the roster.
    // This prevents multi-character devices from accidentally leaving STATS early.
    if (roster.length) {
      needNames = [...roster];
    } else {
      const seen = new Set();
      for (const s of sockets) {
        const hasIntake = !!(st.intakePlayers && st.intakePlayers[s.id]);
        const nm = String(normalizeActorName(st, s) || "").trim();
        if (!nm) continue;

        const key = sanitizeTokenField(nm, 80).toLowerCase();
        if (!key) continue;

        const inRoster = rosterKeys.size ? rosterKeys.has(key) : true;
        if (!inRoster && !hasIntake) continue; // ignore spectators / late-joiners without intake

        if (seen.has(key)) continue;
        seen.add(key);
        needNames.push(nm);
      }
    }

    // Solo hardening: if the game has a 1-name roster, only that name is required (even if joinName differs).
    if (roster.length === 1 && String(roster[0] || "").trim()) {
      needNames = [String(roster[0]).trim()];
    }

    // Fallbacks for edge cases (server restart mid-STATS, etc.)
    if (needNames.length === 0) {
      if (roster.length) needNames = [...roster];
      else {
        const pcNames = getPcNamesFromTokens(st.canon.tokens);
        if (pcNames.length) needNames = [...pcNames];
      }
    }

    if (needNames.length === 0) return;

    const allDone = needNames.every(nm => hasPcStats(st.canon.tokens, nm));
    if (!allDone) return;

    st.canon.tokens = setModeToken(st.canon.tokens, "PLAY");
    st.canon.tokens = clearFlagToken(st.canon.tokens, 'kickoff_done');
    st.canon.tokens = setFlagToken(st.canon.tokens, 'needs_kickoff', 1);
    saveRoomStateFile(roomId);

    // Turn order is server-sided and instant. The opening scene is generated only
    // after initiative locks (handleTurnOrderLocked).
    try { io.to(roomId).emit("system", "All stats locked. Rolling turn order..."); } catch {}
    try { await TURNS.startInitiative(roomId); } catch {}

    try {
      io.to(roomId).emit("canon_update", {
        roomId,
        canon_tokens: st.canon.tokens,
        book_meta: st.book?.meta || null,
      });
    } catch {}
  }

  
// -------------------- Stats: per-stat, one roll each (server-enforced) --------------------
function _statsEnsure(st){
  if (!st._statsLocks) st._statsLocks = Object.create(null);      // actorKey -> { STR:true, ... }
  if (!st._statsPending) st._statsPending = Object.create(null);  // actorKey -> { rolls:{}, totals:{} }
}

function _actorKey(name){
  return String(name || "").trim().toLowerCase();
}

// Resolve which local character this socket is trying to roll/lock stats for.
// Client may provide charName explicitly (couch co-op); server still validates against the
// socket's registered roster to prevent impersonation.
function resolveStatsActor(st, socket, requestedName){
  const reqRaw = String(requestedName || '').trim();
  if (!reqRaw) return normalizeActorName(st, socket);
  const req = sanitizeTokenField(reqRaw, 80);
  if (!req) return normalizeActorName(st, socket);

  const canonKey = (n) => sanitizeTokenField(String(n || '').trim(), 80).toLowerCase();
  const baseKey  = (n) => canonKey(String(n || '').replace(/\s*#\d+\s*$/i, '').trim());

  // Allowed roster for this socket.
  let allowed = Array.isArray(socket?.data?.charNames) ? socket.data.charNames : [];
  try {
    const pid = getPlayerIdForSocket(st, socket.id) || String(socket?.data?.playerId || '').trim() || null;
    if ((!allowed || !allowed.length) && pid && st.playersById && Array.isArray(st.playersById[pid]?.charNames) && st.playersById[pid].charNames.length) {
      allowed = st.playersById[pid].charNames;
      try { socket.data.charNames = allowed; } catch {}
    }
  } catch {}

  // Last fallback: only the currently bound character.
  if (!allowed || !allowed.length) {
    const cur = String(socket?.data?.charName || '').trim();
    allowed = cur ? [cur] : [];
  }

  const reqC = canonKey(req);
  const reqB = baseKey(req);
  let match = allowed.find(n => canonKey(n) === reqC) || allowed.find(n => baseKey(n) === reqB);

  const expectedPlayers = Number(st?.expectedPlayers || 0) || 0;
  const soloLike = !!st?.isSingle || expectedPlayers === 1;
  if (!match && soloLike) match = req;

  if (!match) {
    socket.emit('error_msg', 'That character is not registered on this device.');
    return null;
  }

  try { socket.data.charName = String(match).trim(); } catch {}
  return String(match).trim();
}

function _statsSnapshotForActor(st, actor){
  _statsEnsure(st);
  const key = _actorKey(actor);
  const locks = st._statsLocks[key] || Object.create(null);
  const pending = st._statsPending[key] || null;
  return { locks, pending };
}

async function handleStatsRollOne({ statKey, charName } = {}){
  const roomId = socket.data.roomId;
  if (!roomId) return;
  const st = getRoomState(roomId);

  const actor = resolveStatsActor(st, socket, charName);
  if (!actor) return;

  const myCharNames = (Array.isArray(socket.data?.charNames) && socket.data.charNames.length) ? socket.data.charNames : [actor];

  const inStats = hasModeToken(st.canon.tokens, "STATS");
  const inPlay = hasModeToken(st.canon.tokens, "PLAY");
  const already = hasPcStats(st.canon.tokens, actor);

  // Allow rolling in STATS phase, or in PLAY if this actor is missing stats (late join / mismatch recovery).
  if (!(inStats || (inPlay && !already))) return;

  if (already) {
    socket.emit("stats_required", { charName: actor, haveStats: true, preference: st.intakeGlobal?.q0 || "", pending: null, myCharNames });
    return;
  }

  const k = String(statKey || "").trim().toUpperCase();
  if (!STAT_KEYS.includes(k)) {
    socket.emit("error_msg", "Invalid stat key.");
    return;
  }

  _statsEnsure(st);
  const akey = _actorKey(actor);
  if (!st._statsLocks[akey]) st._statsLocks[akey] = Object.create(null);
  if (!st._statsPending[akey]) st._statsPending[akey] = { rolls: Object.create(null), totals: Object.create(null) };

  if (st._statsLocks[akey][k]) {
    socket.emit("error_msg", `${k} has already been rolled for this character.`);
    socket.emit("stats_required", { charName: actor, haveStats: false, preference: st.intakeGlobal?.q0 || "", pending: st._statsPending[akey], myCharNames });
    return;
  }

  const r = roll3d6Sum();
  st._statsLocks[akey][k] = true;
  st._statsPending[akey].rolls[k] = r.dice;
  st._statsPending[akey].totals[k] = r.total;

  // Persist so reconnect/load can't fish rerolls.
  saveRoomStateFile(roomId);

  socket.emit("stats_roll_one_result", { charName: actor, statKey: k, dice: r.dice, total: r.total, pending: st._statsPending[akey] });
  socket.emit("stats_required", { charName: actor, haveStats: false, preference: st.intakeGlobal?.q0 || "", pending: st._statsPending[akey], myCharNames });
}

async function handleStatsCommitPending(payload = {}){
  const roomId = socket.data.roomId;
  if (!roomId) return;
  const st = getRoomState(roomId);

  const actor = resolveStatsActor(st, socket, payload?.charName);
  if (!actor) return;

  const myCharNames = (Array.isArray(socket.data?.charNames) && socket.data.charNames.length) ? socket.data.charNames : [actor];

  const inStats = hasModeToken(st.canon.tokens, "STATS");
  const inPlay = hasModeToken(st.canon.tokens, "PLAY");
  const already = hasPcStats(st.canon.tokens, actor);

  // Allow rolling in STATS phase, or in PLAY if this actor is missing stats (late join / mismatch recovery).
  if (!(inStats || (inPlay && !already))) return;

  if (already) {
    socket.emit("stats_required", { charName: actor, haveStats: true, preference: st.intakeGlobal?.q0 || "", pending: null, myCharNames });
    return;
  }

  _statsEnsure(st);
  const akey = _actorKey(actor);
  const pend = st._statsPending[akey];
  if (!pend || !pend.totals) {
    socket.emit("error_msg", "No pending stat rolls found.");
    socket.emit("stats_required", { charName: actor, haveStats: false, preference: st.intakeGlobal?.q0 || "", pending: pend || null, myCharNames });
    return;
  }

  const totals = pend.totals;
  const keys = STAT_KEYS;
  for (const kk of keys){
    if (!Number.isFinite(Number(totals[kk]))) {
      socket.emit("error_msg", "Roll all six stats (one time each) before locking.");
      socket.emit("stats_required", { charName: actor, haveStats: false, preference: st.intakeGlobal?.q0 || "", pending: pend, myCharNames });
      return;
    }
  }

  try { validateStatTotals(totals); } catch (e) {
    socket.emit("error_msg", String(e?.message || e));
    return;
  }

  st.canon.tokens = upsertPcStats(st.canon.tokens, actor, totals);
  st.canon.tokens = ensurePartyVitalsFromStats(st.canon.tokens, actor, totals);

  // Ensure per-character map/location state exists after stats lock (covers late join / old saves).
  try {
    const roster = Array.isArray(st.playerCharNames) ? st.playerCharNames : [];
    st.canon.tokens = ensurePStatesForRoster(st.canon.tokens, roster);
    st.canon.tokens = recomputePartyGroups(st.canon.tokens, roster);
  } catch {}

  // Magic starter kit: 1 utility spell + 1 battle spell (rest must be learned/purchased).
  try { st.canon.tokens = ensureStarterSpellsForActor(st.canon.tokens, actor); } catch {}
  // Once committed, pending can be cleared (locks stay, so saves can't be used to re-fish without host reset).
  delete st._statsPending[akey];

  saveRoomStateFile(roomId);

  io.to(roomId).emit("canon_update", {
    roomId,
    canon_tokens: st.canon.tokens,
    book_meta: st.book?.meta || null,
  });

  socket.emit("stats_committed", { charName: actor, method: "dice", rolls: pend.rolls, totals: totals });

  try { if (inStats) await maybeExitStatsPhase(roomId); } catch {}
  try { await kickoffIfReadyAfterStats(roomId, { reason: "post_stats_commit" }); } catch {}

  // Couch co-op: if this device owns multiple characters, prompt the next missing one.
  try {
    const st2 = getRoomState(roomId);
    if (hasModeToken(st2.canon.tokens, 'STATS')) {
      const pref = st2.intakeGlobal?.q0 || '';
      const list = (Array.isArray(socket.data?.charNames) && socket.data.charNames.length) ? socket.data.charNames : [actor];
      for (const nm0 of list) {
        const nm = String(nm0 || '').trim();
        if (!nm) continue;
        if (!hasPcStats(st2.canon.tokens, nm)) {
          socket.data.charName = nm;
          socket.emit('stats_required', { charName: nm, haveStats: false, preference: pref, pending: st2._statsPending ? st2._statsPending[_actorKey(nm)] : null, myCharNames: list });
          break;
        }
      }
    }
  } catch {}
}

// New: per-stat roll once
socket.on("stats_roll_one", handleStatsRollOne);
socket.on("stats_commit_pending", handleStatsCommitPending);

// Back-compat: older clients may try to roll all stats at once.
socket.on("stats_roll", () => {
  socket.emit("error_msg", "Stats are rolled one ability at a time. Use the Roll buttons on each stat row.");
});
socket.on("stats_roll_ai", () => {
  socket.emit("error_msg", "Stats are rolled one ability at a time. Use the Roll buttons on each stat row.");
});

// Generic dice roller (d6/d20 only). This is purely mechanical and NEVER calls the model.
  socket.on("dice_roll", (payload = {}) => {
    try {
      const sides = Number(payload?.sides);
      const count = Math.max(1, Math.min(50, Number(payload?.count) || 1));
      const modifier = Math.max(-50, Math.min(50, Number(payload?.modifier) || 0));
      const label = String(payload?.label || "").slice(0, 80);
      const dropLowest = !!payload?.dropLowest;

      if (![6, 20].includes(sides)) throw new Error("Only d6 and d20 are supported.");
      const rolls = rollDice(count, sides);
      const sum = rolls.reduce((a,b)=>a+b, 0);

      // Optional: 3d6 drop lowest (sum of top two dice). Still uses only d6.
      let dropped = null;
      let keptSum = null;
      let total = sum + modifier;
      if (dropLowest && sides === 6 && count === 3) {
        dropped = Math.min(...rolls);
        keptSum = sum - dropped;
        total = keptSum + modifier;
      }

      socket.emit("dice_result", {
        sides,
        count,
        modifier,
        rolls,
        sum,
        total,
        label,
        dropLowest: (dropLowest && sides === 6 && count === 3) ? true : false,
        dropped,
        keptSum,
        ts: Date.now(),
      });
    } catch (e) {
      socket.emit("error_msg", String(e?.message || e));
    }
  });

  



function _cfgNum(tokens, key, defVal) {
  try {
    const lowKey = String(key || "").trim().toLowerCase();
    for (const t of (tokens || [])) {
      const s = String(t || "").trim();
      if (!s.toLowerCase().startsWith("cfg:")) continue;
      const body = s.slice(4);
      const [kRaw, vRaw] = body.split("=");
      const k = String(kRaw || "").trim().toLowerCase();
      if (k !== lowKey) continue;
      const n = Number(String(vRaw || "").trim());
      return Number.isFinite(n) ? n : defVal;
    }
  } catch {}
  return defVal;
}

function clampInt(n, a, b) {
  const x = Math.floor(Number(n) || 0);
  return Math.max(a, Math.min(b, x));
}

function computeBaseTargetFromCfg(tokens, maxTarget = 18) {
  // Difficulty 1–10 maps to a reasonable target for the active die range.
  const diff = clampInt(_cfgNum(tokens, 'difficulty', 5), 1, 10);

  // 3d6 (3–18): keep the older gentle curve (≈7–14).
  if (Number(maxTarget) === 18) {
    const base = Math.round(6.5 + (diff * 0.75));
    return clampInt(base, 3, 18);
  }

  // d20 (1–20): slightly higher baseline (≈9–18).
  const base = Math.round(8 + diff);
  return clampInt(base, 5, 20);
}

function rollRangeFromSpec(spec) {
  const sides = Math.max(1, Math.floor(Number(spec?.sides) || 6));
  const count = Math.max(1, Math.floor(Number(spec?.count) || 1));
  const dropLowest = !!spec?.dropLowest;
  if (dropLowest && count >= 2) return { min: 1 * (count - 1), max: sides * (count - 1) };
  return { min: 1 * count, max: sides * count };
}

function computeActionRollSpec(st, actorName, actionText) {
  const tokens = st?.canon?.tokens || [];
  const mode = String(getTokenValue(tokens, 'mode') || '').trim().toUpperCase();
  const t = String(actionText || '').toLowerCase();

  // Combat-y intents: default to 1d20. Everything else stays 3d6.
  const combatish = (mode === 'COMBAT') || /(attack|strike|shoot|stab|slash|swing|punch|kick|cast|aim|parry|block|dodge|grapple|wrestle|kill)/i.test(t);
  if (combatish) return { sides: 20, count: 1, dropLowest: false };

  return { sides: 6, count: 3, dropLowest: false };
}

function computeActionTarget(st, actorName, actionText, rollSpec = null) {
  const tokens = st?.canon?.tokens || [];
  const maxT = (Number(rollSpec?.sides) === 20) ? 20 : 18;
  const minT = (maxT === 20) ? 5 : 3;
  let target = computeBaseTargetFromCfg(tokens, maxT);

  const t = String(actionText || "").toLowerCase();

  // Lightweight keyword shaping. This is conservative and intentionally boring.
  const bump = (d) => { target = clampInt(target + d, minT, maxT); };

  // Easy intents
  if (/(look|glance|listen|search|scan|check|inspect|read)/i.test(t)) bump(-1);

  // Standard traversal / positioning
  if (/(walk|move|approach|follow|track|climb|jump|swim|crawl)/i.test(t)) bump(0);

  // Risky / contested actions
  if (/(sneak|hide|steal|pickpocket|lockpick|pick\s+lock|lie|deceive|intimidate|persuade|haggle)/i.test(t)) bump(+1);

  // Highly technical / dangerous
  if (/(ritual|ward|aether|residue|soul|summon|bind|disarm\s+trap|defuse|poison|leap\s+gap|scale\s+wall)/i.test(t)) bump(+2);

  // Explicitly reckless
  if (/(rush|charge|all\s+out|no\s+regard|reckless)/i.test(t)) bump(+1);

  // If the player asks for something clearly trivial, soften.
  if (/(carefully|slowly|patiently|take\s+my\s+time)/i.test(t)) bump(-1);

  return clampInt(target, minT, maxT);
}

function fmtSigned(n) {
  const x = Math.floor(Number(n) || 0);
  return (x >= 0 ? `+${x}` : `${x}`);
}

function ensureMarginPrefix(narration, margin) {
  const m = fmtSigned(margin);
  const prefix = `**[Margin: ${m}]**`;

  let s = String(narration || "").trim();
  if (!s) return prefix;

  // Replace incorrect margin if present at the very start.
  s = s.replace(/^\s*(\*\*\s*)?\[Margin:\s*[+-]?\d+\s*\](\s*\*\*)?\s*/i, "");

  return `${prefix}\n\n${s}`.trim();
}




function sanitizeNarrationText(text, tokens) {
  let s = String(text || "");

  // Strip raw token lines and internal debug headers if a model regurgitates prompt context.
  s = s.replace(/^\s*(CURRENT_CANON_TOKENS|SNAPSHOT_TOKENS|CANON_TOKENS|RULES_RESULT)\s*:\s*.*$/gmi, "");
  s = s.replace(/^\s*(loc|xy|mode|flag|clock|day|time|pressure|residue)\s*[:=].*$/gmi, "");

  // Strip any mechanics scaffolding if it leaks into prose.
  s = s.replace(/^\s*\[(ACTION_CHECK|COMBAT_CHECK)\b[^\n\r]*$/gmi, "");
  s = s.replace(/^\s*\*\*\s*\[Margin:\s*[+-]?\d+\s*\]\s*\*\*\s*$/gmi, "");

  // Strip mechanical delta/margin mentions if the model paraphrases them (keep geography deltas intact).
  s = s.replace(/\b(?:margin|delta)\b[^\n\r\.]{0,40}\b(?:roll|target|total)\b[^\n\r\.]{0,40}/gi, "");
  s = s.replace(/\b(?:margin|delta)\b\s*[:=]?\s*[+-]?\d+\b/gi, "");


  const curLoc = extractLoc(tokens || []);
  const unknownLoc = isPlaceholderLoc(curLoc);

  // Replace token-style loc leaks inside sentences.
  s = s.replace(/\bloc\s*[:=]\s*([^\n\r]{1,80})/gi, (_m, v) => {
    const raw = String(v || "").trim();
    if (!raw) return "";
    if (unknownLoc) return "somewhere unknown";
    // Never leak coordinate-like loc labels.
    if (/[0-9]|%/.test(raw)) return "the wilds";
    return raw;
  });

  // Drop xy leaks (never show coordinates/percentages).
  s = s.replace(/\bxy\s*[:=]\s*[0-9\.\s,]{3,40}/gi, "");

  // Cleanup: collapse whitespace and obvious token artifacts.
  s = s.replace(/[ \t]{2,}/g, " ");
  s = s.replace(/\s+([,.;:!?])/g, "$1");
  s = s.replace(/\n{3,}/g, "\n\n");

  // If a model dumps multiple SCENE blocks, keep only the last block body.
  try { s = collapseMultiSceneText(s); } catch {}

  // Remove the stock greeting chunk if it appears (players disliked it).
  s = s.replace(/(^|\n)\s*The world greets you with[^\n]*like a hand on the throat\.[\s\S]*?(\n\s*\n|$)/gi, (_m, p1) => (p1 ? '\n' : ''));




  return s.trim();
}





async function emitNarrationPerPlayer(roomId, payload = {}) {
  const st = getRoomState(roomId);
  try { _ensureObsState(st); } catch {}
  const pov = (payload && typeof payload.pov === 'object' && payload.pov) ? payload.pov : null;
  const povCharAll = (payload && typeof payload.pov_char === 'object' && payload.pov_char) ? payload.pov_char : null;
  let sockets = [];
  try { sockets = await io.in(roomId).fetchSockets(); } catch { sockets = []; }

  // Add the locked intro/prologue once per player (online) or once per character (couch co-op).
  // This makes each POV stream feel like its own "book" even when the room started before you joined.
  const PROLOGUE = String(LOCKED_PROLOGUE_TEXT || '').trim();
  const hasPrologueAlready = (txt) => {
    const s = String(txt || '').trim();
    if (!s || !PROLOGUE) return false;
    return s.startsWith(PROLOGUE) || s.includes(PROLOGUE.slice(0, 24));
  };
  let introDirty = false;

  for (const s of sockets) {
    const pid = (st.socketToPlayerId && st.socketToPlayerId[s.id]) ? String(st.socketToPlayerId[s.id]) : String(s?.data?.playerId || '').trim();
    const localNames = (Array.isArray(s?.data?.charNames) && s.data.charNames.length)
      ? s.data.charNames.map(x => String(x || '').trim()).filter(Boolean)
      : [String(s?.data?.charName || '').trim()].filter(Boolean);
    const localKeys = new Set(localNames.map(n => n.toLowerCase()));

    // Filter pov_char so players never receive other players' POV streams.
    let pov_char = null;
    if (povCharAll && typeof povCharAll === 'object') {
      const filtered = {};
      for (const [k, v] of Object.entries(povCharAll)) {
        const key = String(k || '').trim();
        if (!key) continue;
        if (!localKeys.has(key.toLowerCase())) continue;
        if (typeof v !== 'string') continue;
        filtered[key] = v;
      }
      if (Object.keys(filtered).length) pov_char = filtered;
    }

    // Choose the visible text for this socket:
    // - if pov_char includes the socket's active character, use it
    // - else use the per-playerId pov entry
    // - else fall back to payload.text
    const activeChar = String(s?.data?.charName || '').trim();
    const activeKey = activeChar ? activeChar.toLowerCase() : '';
    let fromChar = '';
    if (pov_char && activeKey) {
      if (typeof pov_char[activeChar] === 'string') fromChar = String(pov_char[activeChar]).trim();
      if (!fromChar) {
        for (const [k, v] of Object.entries(pov_char)) {
          if (String(k || '').trim().toLowerCase() === activeKey && typeof v === 'string') {
            fromChar = String(v).trim();
            break;
          }
        }
      }
      // If the socket controls characters but no activeChar match exists, use the first available.
      if (!fromChar && localNames.length >= 1) {
        for (const nm of localNames) {
          if (nm && typeof pov_char[nm] === 'string') { fromChar = String(pov_char[nm]).trim(); break; }
        }
      }
    }

    const povText = (pov && pid && typeof pov[pid] === 'string') ? String(pov[pid]).trim() : '';
    const chosen = fromChar || povText || String(payload.text || '').trim();

    // Intro injection logic:
    // - If we're delivering a pov_char bundle, the client will render each entry.
    //   We inject per-character, and keep the top-level chosen text clean.
    // - Otherwise we inject once per playerId.
    let chosenWithIntro = chosen;
    if (!pov_char) {
      try {
        if (pid && PROLOGUE && !st._introSeen[pid] && !hasPrologueAlready(chosenWithIntro)) {
          chosenWithIntro = `${PROLOGUE}\n\n${chosenWithIntro}`.trim();
          st._introSeen[pid] = true;
          introDirty = true;
        }
      } catch {}
    }

    const cleanText = sanitizeNarrationText(chosenWithIntro, st?.canon?.tokens || []);

    // Inject intro per character in couch co-op POV maps.
    if (pov_char && PROLOGUE) {
      try {
        for (const [nm, txt] of Object.entries(pov_char)) {
          const key = String(nm || '').trim().toLowerCase();
          if (!key) continue;
          if (st._introSeenChar[key]) continue;
          if (hasPrologueAlready(txt)) { st._introSeenChar[key] = true; introDirty = true; continue; }
          pov_char[nm] = `${PROLOGUE}\n\n${String(txt || '').trim()}`.trim();
          st._introSeenChar[key] = true;
          introDirty = true;
        }
      } catch {}
    }
    let choiceSource = payload.choices;
    try {
      const fallbackChoices = Array.isArray(st?.lastChoices) ? st.lastChoices : [];
      if (!(Array.isArray(choiceSource) && choiceSource.length) && fallbackChoices.length) choiceSource = fallbackChoices;
    } catch {}
    const normChoices = normalizeChoicesArray(choiceSource);
    try {
      // IMPORTANT: never leak the full pov map to clients.
      const out = { ...payload };
      try { delete out.pov; } catch {}
      try { delete out.pov_char; } catch {}
      s.emit('narration', {
        ...out,
        text: cleanText,
        choices: Array.isArray(normChoices.out) ? normChoices.out : [],
        pov_char,
        povFor: pid || null
      });
    } catch {}
  }

  if (introDirty) {
    try { saveRoomStateFile(roomId); } catch {}
  }
}

// Emit a nearby-activity digest ONLY to the socket(s) controlling the active actor.
// Online: the one player who owns that character.
// Couch co-op: the device that owns that character.
async function cacheTurnDigestForActor(roomId, actorName){
  const rid = String(roomId || '').trim();
  const actor = sanitizeTokenField(String(actorName || '').trim(), 80);
  if (!rid || !actor) return;
  const st = getRoomState(rid);
  _ensureObsState(st);

  const dig = buildNearbyDigest(rid, actor);
  if (!dig || !(Array.isArray(dig.items) && dig.items.length)) return;

  // Cache so the AI can consume the same digest on the actor's next resolve.
  const k = _obsKey(actor);
  st._turnDigestCache[k] = { items: dig.items, lines: dig.lines || [], maxId: dig.maxId, ts: Date.now() };
  // IMPORTANT: do NOT advance _obsSeen here.
  // We only mark "seen" once the digest has been consumed into prose.
  try { saveRoomStateFile(rid); } catch {}
}

// Turn-start recap: a short, private, POV-safe nudge for the next actor.
// This is intentionally code-authored (no model call) and uses the same observable digest filtering.
// It helps each player feel like they're reading their own "book" and reduces scrollback hunting.
async function emitTurnRecapToActor(roomId, actorName){
  const rid = String(roomId || '').trim();
  const actor = sanitizeTokenField(String(actorName || '').trim(), 80);
  if (!rid || !actor) return;
  const st = getRoomState(rid);
  try { _ensureObsState(st); } catch {}

  const k = _obsKey(actor);
  const cached = st?._turnDigestCache?.[k];
  const lines = cached && Array.isArray(cached.lines) ? cached.lines.slice(0, 8) : [];
  if (!lines.length) return;

  // Light prose wrapper (no bullets, no mechanics).
  const text = (() => {
    const bits = [];
    for (const ln of lines) {
      const s = String(ln || '').trim();
      if (!s) continue;
      bits.push(s.replace(/\s+/g, ' '));
    }
    if (!bits.length) return '';
    const joined = bits.join(' — ');
    return `While you were weighing your next move, you caught fragments of motion nearby: ${joined}.`;
  })();
  if (!text) return;

  // Deliver only to sockets that control this actor (online or couch co-op).
  try {
    const sockets = await io.in(rid).fetchSockets();
    for (const s of (sockets || [])) {
      const localNames = (Array.isArray(s?.data?.charNames) && s.data.charNames.length)
        ? s.data.charNames.map(x => String(x || '').trim()).filter(Boolean)
        : [String(s?.data?.charName || '').trim()].filter(Boolean);
      const ok = localNames.some(n => String(n||'').trim().toLowerCase() === actor.toLowerCase());
      if (!ok) continue;
      try { s.emit('turn_recap', { actor, text, ts: Date.now() }); } catch {}
    }
  } catch {}
}

// -------------------- Units / Retinues (host-authoritative) --------------------
socket.on("unit_create", (payload = {}) => {
  const roomId = socket.data.roomId;
  if (!roomId) return;
  const st = getRoomState(roomId);
  const isHost = st.hostSocketId === socket.id;
  if (!isHost) return;

  const actor = normalizeActorName(st, socket);
  const name = sanitizeTokenField(String(payload?.name || '').trim(), 80);
  if (!name) return;

  const u = {
    name,
    str: Math.floor(Number(payload?.str || 0) || 0),
    morale: Math.floor(Number(payload?.morale || 0) || 0),
    supply: String(payload?.supply || 'stable').trim() || 'stable',
    loc: extractLoc(st.canon.tokens),
    owner: actor || 'host'
  };

  st.canon.tokens = upsertUnitToken(st.canon.tokens, u);
  saveRoomStateFile(roomId);

  try { io.to(roomId).emit("system", `Host created unit: ${name}`); } catch {}
  try {
    io.to(roomId).emit("canon_update", {
      roomId,
      canon_tokens: st.canon.tokens,
      book_meta: st.book?.meta || null
    });
  } catch {}
});

socket.on("unit_update", (payload = {}) => {
  const roomId = socket.data.roomId;
  if (!roomId) return;
  const st = getRoomState(roomId);
  const isHost = st.hostSocketId === socket.id;
  if (!isHost) return;

  const name = sanitizeTokenField(String(payload?.name || '').trim(), 80);
  if (!name) return;

  const u = {
    name,
    str: Math.floor(Number(payload?.str) || 0),
    morale: Math.floor(Number(payload?.morale) || 0),
    supply: String(payload?.supply || 'stable').trim() || 'stable',
    loc: extractLoc(st.canon.tokens),
    owner: 'party'
  };

  st.canon.tokens = upsertUnitToken(st.canon.tokens, u);
  saveRoomStateFile(roomId);

  try {
    io.to(roomId).emit("canon_update", {
      roomId,
      canon_tokens: st.canon.tokens,
      book_meta: st.book?.meta || null
    });
  } catch {}
});

socket.on("unit_delete", (payload = {}) => {
  const roomId = socket.data.roomId;
  if (!roomId) return;
  const st = getRoomState(roomId);
  const isHost = st.hostSocketId === socket.id;
  if (!isHost) return;

  const name = sanitizeTokenField(String(payload?.name || '').trim(), 80);
  if (!name) return;

  st.canon.tokens = removeUnitToken(st.canon.tokens, name);
  saveRoomStateFile(roomId);

  try { io.to(roomId).emit("system", `Host removed unit: ${name}`); } catch {}
  try {
    io.to(roomId).emit("canon_update", {
      roomId,
      canon_tokens: st.canon.tokens,
      book_meta: st.book?.meta || null
    });
  } catch {}
});

// -------------------- Turn Order (Initiative) --------------------
// Players must roll 1d20 to establish turn order when the room enters PLAY.
socket.on("turn_roll_submit", async (payload = {}) => {
  const roomId = socket.data.roomId;
  if (!roomId) return;
  try { await TURNS.submitInitiative(roomId, socket, payload); } catch {}
});

// Host-only: reroll initiative / restart turn order.
socket.on('turn_reroll', async () => {
  const roomId = socket.data.roomId;
  if (!roomId) return;
  const st = getRoomState(roomId);
  const isHost = st.hostSocketId === socket.id;
  if (!isHost) {
    socket.emit('error_msg', 'Only the host can reroll initiative.');
    return;
  }
  try {
    await TURNS.startInitiative(roomId, { force: true });
    io.to(roomId).emit('system', 'Host restarted initiative. Roll 1d20 again.');
  } catch (e) {
    socket.emit('error_msg', String(e?.message || e));
  }
});

socket.on('round_resolve_now', async () => {
  const roomId = socket.data.roomId;
  if (!roomId) return;
  const st = getRoomState(roomId);
  const isHost = st.hostSocketId === socket.id;
  const isSingle = !!st.isSingle || Number(st.expectedPlayers || 0) === 1 || String(roomId || '').toLowerCase().startsWith('solo-');
  if (!isHost && !isSingle) {
    socket.emit('error_msg', 'Only the host can force-resolve a round.');
    return;
  }
  try {
    await resolveSimultaneousRound(roomId, { reason: 'host_force', fillMissing: true });
  } catch (e) {
    socket.emit('error_msg', String(e?.message || e));
  }
});

// Cancel a stuck AI resolve (manual unstick).
socket.on('ai_cancel', () => {
  const roomId = socket.data.roomId;
  if (!roomId) return;
  const st = getRoomState(roomId);
  const isHost = st.hostSocketId === socket.id;
  const isSingle = !!st.isSingle || Number(st.expectedPlayers || 0) === 1 || String(roomId || '').toLowerCase().startsWith('solo-');
  if (!isHost && !isSingle) {
    socket.emit('error_msg', 'Only the host can cancel AI in multiplayer.');
    return;
  }
  try { cancelResolve(roomId, 'manual'); } catch {}
  try { emitAiWait(roomId, false, 'cancel', 'manual'); } catch {}
  try { emitAiError(roomId, new Error('AI resolve cancelled'), 'Try again. If it repeats: use a smaller local model or raise LLM_TIMEOUT_MS.'); } catch {}
});


// -------------------- Shared action resolution (roll injected, mechanics stay out of prose) --------------------
function buildRollInfoFromSpec(spec, target, source = "site") {
  const sides = Number(spec?.sides) || 6;
  const count = Math.max(1, Math.floor(Number(spec?.count) || 1));
  const dropLowest = !!spec?.dropLowest;

  const rolls = rollDice(count, sides);
  const sum = rolls.reduce((a, b) => a + b, 0);

  let dropped = null;
  let keptSum = null;
  let total = sum;

  if (dropLowest && sides === 6 && count === 3) {
    dropped = Math.min(...rolls);
    keptSum = sum - dropped;
    total = keptSum;
  }

  const tgt = Math.floor(Number(target) || 0);
  const tot = Math.floor(Number(total) || 0);
  const margin = tot - tgt;

  return {
    method: `${count}d${sides}${dropLowest ? "_drop_lowest" : ""}`,
    total: tot,
    dice: rolls,
    sum,
    dropped,
    keptSum,
    target: tgt,
    margin,
    source: String(source || "site").slice(0, 20),
    spec: { sides, count, dropLowest }
  };
}

function emitAutoDiceResult(socket, rollInfo, label = "Action Roll") {
  try {
    const spec = rollInfo?.spec || {};
    const sides = Number(spec?.sides) || 6;
    const count = Number(spec?.count) || 1;
    const dropLowest = !!spec?.dropLowest && sides === 6 && count === 3;

    socket.emit("dice_result", {
      sides,
      count,
      modifier: 0,
      rolls: Array.isArray(rollInfo?.dice) ? rollInfo.dice : [],
      sum: Number(rollInfo?.sum || 0),
      total: Number(rollInfo?.total || 0),
      label: String(label || "").slice(0, 80),
      dropLowest,
      dropped: dropLowest ? rollInfo?.dropped : null,
      keptSum: dropLowest ? rollInfo?.keptSum : null,
      ts: Date.now(),
    });
  } catch {}
}



function emitAutoDiceResultToSocketId(roomId, socketId, rollInfo, label = "Action Roll") {
  try {
    const sid = String(socketId || "").trim();
    if (!sid) return;
    const spec = rollInfo?.spec || {};
    const sides = Number(spec?.sides) || 6;
    const count = Number(spec?.count) || 1;
    const dropLowest = !!spec?.dropLowest && sides === 6 && count === 3;

    io.to(sid).emit("dice_result", {
      sides,
      count,
      modifier: 0,
      rolls: Array.isArray(rollInfo?.dice) ? rollInfo.dice : [],
      sum: Number(rollInfo?.sum || 0),
      total: Number(rollInfo?.total || 0),
      label: String(label || "").slice(0, 80),
      dropLowest,
      dropped: dropLowest ? rollInfo?.dropped : null,
      keptSum: dropLowest ? rollInfo?.keptSum : null,
      ts: Date.now(),
    });
  } catch {}
}


function snapshotRoomForAiRetry(roomId) {
  const st = getRoomState(roomId);
  let bookLen = 0;
  try { bookLen = Array.isArray(st?.book?.entries) ? st.book.entries.length : 0; } catch {}
  let bookMeta = null;
  try { bookMeta = st?.book?.meta ? JSON.parse(JSON.stringify(st.book.meta)) : null; } catch { bookMeta = null; }

  return {
    canonTokens: Array.isArray(st?.canon?.tokens) ? [...st.canon.tokens] : [],
    lastChoices: Array.isArray(st?.lastChoices) ? [...st.lastChoices] : [],
    lastChoicesMeta: Array.isArray(st?._lastChoicesMeta) ? JSON.parse(JSON.stringify(st._lastChoicesMeta)) : [],
    lastSources: Array.isArray(st?._lastSources) ? [...st._lastSources] : [],
    bookLen,
    bookMeta,
    prologueDelivered: !!st?._prologueDelivered,
    autoPlay: {
      starting: !!st?._autoPlayStarting,
      started: !!st?._autoPlayStarted,
      startedAt: st?._autoPlayStartedAt || null,
      reason: st?._autoPlayReason || "",
    }
  };
}

function restoreRoomFromAiSnapshot(roomId, snap) {
  if (!snap || typeof snap !== "object") return;
  const st = getRoomState(roomId);

  try { st.canon.tokens = Array.isArray(snap.canonTokens) ? [...snap.canonTokens] : []; } catch {}
  try { st.lastChoices = Array.isArray(snap.lastChoices) ? [...snap.lastChoices] : []; } catch {}
  try { st._lastChoicesMeta = Array.isArray(snap.lastChoicesMeta) ? snap.lastChoicesMeta : []; } catch {}
  try { st._lastSources = Array.isArray(snap.lastSources) ? [...snap.lastSources] : []; } catch {}

  try {
    if (!st.book) st.book = { entries: [], meta: null };
    if (!Array.isArray(st.book.entries)) st.book.entries = [];
    const keep = Math.max(0, Math.floor(Number(snap.bookLen) || 0));
    st.book.entries = st.book.entries.slice(0, keep);
    if (snap.bookMeta) st.book.meta = snap.bookMeta;
  } catch {}

  try { st._prologueDelivered = !!snap.prologueDelivered; } catch {}
  try {
    if (snap.autoPlay) {
      st._autoPlayStarting = !!snap.autoPlay.starting;
      st._autoPlayStarted = !!snap.autoPlay.started;
      st._autoPlayStartedAt = snap.autoPlay.startedAt;
      st._autoPlayReason = snap.autoPlay.reason;
    }
  } catch {}

  try { saveRoomStateFile(roomId); } catch {}
  try { if (st.book && Array.isArray(st.book.entries)) saveBook(roomId, st.book.entries, st.book.meta || null); } catch {}
}


async function resolveActionWithRoll({ roomId, socket, actor, text, rollInfo }) {
  if (!roomId || !socket) return;
  const rawText = String(text || "").trim();
  if (!rawText) return;

  const st0 = getRoomState(roomId);
  const actorName = String(actor || "").trim() || normalizeActorName(st0, socket) || "Someone";
  const actingPlayerId = String(socket.data.playerId || "").trim();

  // Determine whether this is a combat check (d20) or an action check (3d6).
  const checkTag = (Number(rollInfo?.spec?.sides) === 20) ? "COMBAT_CHECK" : "ACTION_CHECK";
  const checkLabel = (checkTag === "COMBAT_CHECK") ? "Combat Roll" : "Action Roll";

  // Inject roll into the model input (AI never rolls; it must consume this integer).
  const baseModelInput =
    `${rawText}\n\n[${checkTag} ${String(rollInfo?.method || "").trim() || "roll"}] ` +
    `Roll=${Number(rollInfo?.total || 0)} Target=${Number(rollInfo?.target || 0)} Delta=${fmtSigned(Number(rollInfo?.margin || 0))}`;

  try {
    await TURNS.withRoomResolveLock(roomId, async () => {
      const _seq = beginResolve(roomId);
      try {
        // Code-authoritative travel (UI-click): apply immediately before model calls.
        try {
          const tr = parseTravelUiMessage(rawText);
          if (tr) {
            const roomState = getRoomState(roomId);
            roomState.canon.tokens = applyTravelUiTokens(roomId, roomState.canon.tokens, tr);
            saveRoomStateFile(roomId);
          }
        } catch {}

        const roomState = getRoomState(roomId);
        // Realism: teammate activity is observable context.
        // We do NOT show it as a "Nearby Activity" UI block; we weave it into prose.
        // Cache is built at turn start; we mark it "seen" only after a successful resolve.
        let modelInput = baseModelInput;
        let observedItems = null;
        let observedMaxId = 0;
        try {
          _ensureObsState(roomState);
          const kObs = _obsKey(actorName);
          const cached = roomState?._turnDigestCache?.[kObs];
          if (cached && Array.isArray(cached.items) && cached.items.length) {
            observedItems = cached.items;
            observedMaxId = Math.max(0, Math.floor(Number(cached.maxId) || 0));
          }
        } catch {}

        // Book should only track actual play, not intake/stat questionnaires.
        const modeNowForBook = String(getTokenValue(roomState.canon.tokens, "mode") || "").trim().toUpperCase();
        const allowBook = modeNowForBook !== "INTAKE" && modeNowForBook !== "STATS";

        if (allowBook) { try { roomState._deferBookUpdates = true; roomState._bookDeferDirty = false; roomState._bookDeferLast = null; } catch {} }

        if (allowBook) ensureChapterOpen(roomId);

        // Book: store the player's declared action as a clean "choice" line (no mechanics).
        if (allowBook && BOOK_INCLUDE_ACTION_LINES) {
          let choiceLine = "";
          const bsMode = String(BOOKSCRIBE_MODE || "local").toLowerCase();
          if (bsMode === "llm") {
            try {
              choiceLine = await callLLMForBookLine({ roomId, actor: actorName, actionText: rawText });
            } catch {
              choiceLine = `${actorName} acts: ${rawText}`;
            }
          } else if (bsMode === "off") {
            choiceLine = `${actorName}: ${rawText}`;
          } else {
            choiceLine = localBookscribe(actorName, rawText);
          }
          choiceLine = ensureSentencePunct(choiceLine);
          appendBookEntry(roomId, { kind: "choice", text: choiceLine, meta: { actor: actorName } });
        }

        // Visible mechanical roll output should be UI-only, not prose.
        // Dice results belong in the UI, not the prose.
        // Avoid double-emitting when the client already requested an AI roll in prompt mode.
        const _src = String(rollInfo?.source || "").toLowerCase();
        const _emit = (ACTION_ROLL_MODE !== "prompt") || (_src && _src !== "site");
        if (_emit) emitAutoDiceResult(socket, rollInfo, checkLabel);

        io.to(roomId).emit("system", `${socket.data.name}: sent an action`);

        // Spotlight delivery: the actor sees the resolved POV immediately;
        // the next actor receives a POV rewrite of the updated shared scene at turn start.
        let _turnTruth = '';
        let _turnChoices = [];
        let _turnFrom = '';
        let _turnBeatSummary = '';
        let _turnCanonTokens = null;

        const _aiSnap = snapshotRoomForAiRetry(roomId);
        for (let _aiRestart = 0; _aiRestart <= 2; _aiRestart++) {
          try {

        let from = String(normProvider(effectiveNarratorProvider()) || "LLM").toUpperCase();

        if (AI_PIPELINE === "unified") {
          const uni = await callLLMUnifiedTurn({ roomId, playerText: modelInput, actorName: actorName, actingPlayerId, observed_items: observedItems });
          let choices = Array.isArray(uni.choices) ? uni.choices : [];
          let narr = String(uni.narration || "").trim();
          narr = splitNarrationFromChoices(narr).narration || narr;
        narr = collapseMultiSceneText(narr);

          if (!choices.length) choices = Array.isArray(getRoomState(roomId).lastChoices) ? getRoomState(roomId).lastChoices : [];
          if (!choices.length) choices = [
            "Look around",
            "Talk to someone nearby",
            "Move cautiously forward",
            "Check your gear",
            "Freeform: (type your action)"
          ];
          const hasFreeform = choices.some(c => String(c || "").toLowerCase().startsWith("freeform"));
          if (!hasFreeform) choices.push("Freeform: (type your action)");

          _turnTruth = String(narr || '').trim();
          _turnChoices = Array.isArray(choices) ? choices : [];
          _turnFrom = from;
          _turnBeatSummary = String(uni.beat_summary || '').trim();
          _turnCanonTokens = uni.canon_tokens;

          if (!isResolveCurrent(roomId, _seq)) return;

          if (allowBook) {
            const bookClean = bookStripInteractivePrompts(stripLockedPrologue(_turnTruth));
            if (bookClean && !isPrologueOnlyText(bookClean)) appendBookEntry(roomId, { kind: "narration", text: (_sceneTruthFromText(bookClean) || bookClean) });
          }

          onBeatComplete(roomId, uni.canon_tokens);
          pushBeatSummary(roomId, uni.beat_summary);
          rollupSceneOnSceneAdvance(roomId);
          maybeSummarizeSceneAsync(roomId);
          saveRoomStateFile(roomId);

          // Broadcast state (tokens/choices) to everyone, but keep prose private.
          try {
            const stNow = getRoomState(roomId);
            io.to(roomId).emit('canon_update', {
              roomId,
              canon_tokens: stNow.canon.tokens,
              lastChoices: stNow.lastChoices,
              book_meta: stNow.book?.meta || null
            });
          } catch {}

          // Actor POV now.
          try {
            const truth = _sceneTruthFromText(_turnTruth);
            const povText = await generatePovFromTruth(roomId, actorName, truth);
            await emitNarrationToActorOnly(roomId, actorName, {
              from,
              text: povText,
    truthText: truth,
              canon_tokens: uni.canon_tokens,
              beat_summary: uni.beat_summary,
              choices,
              book_meta: getRoomState(roomId).book?.meta || null
            });
          } catch {
            await emitNarrationToActorOnly(roomId, actorName, {
              from,
              text: _turnTruth,
              canon_tokens: uni.canon_tokens,
              beat_summary: uni.beat_summary,
              choices,
              book_meta: getRoomState(roomId).book?.meta || null
            });
          }

          // Consume the actor's cached observable digest now that the prose has been emitted.
          try {
            if (observedItems && observedMaxId) {
              const stNow = getRoomState(roomId);
              _ensureObsState(stNow);
              const kObs = _obsKey(actorName);
              stNow._obsSeen[kObs] = Math.max(0, Math.floor(Number(observedMaxId) || 0));
              try { delete stNow._turnDigestCache[kObs]; } catch {}
              try { saveRoomStateFile(roomId); } catch {}
            }
          } catch {}

          // Record an observable action event so nearby teammates can react on their turns.
          try { recordObservableAction(roomId, { actorName, actionText: rawText, beatSummary: uni.beat_summary }); } catch {}
        } else {
          const rulesResult = await callLLMForState({ roomId, playerText: modelInput, actorName: actorName });
          const narrOut = await callNarration({ roomId, playerText: modelInput, rulesResult, actorName: actorName });
          const narration = narrOut.text;
          from = narrOut.from;

          _turnTruth = String(splitNarrationFromChoices(narration).narration || narration || '').trim();
          _turnChoices = Array.isArray(rulesResult.choices) ? rulesResult.choices : [];
          _turnFrom = from;
          _turnBeatSummary = String(rulesResult.beat_summary || '').trim();
          _turnCanonTokens = rulesResult.canon_tokens;

          if (!isResolveCurrent(roomId, _seq)) return;

          if (allowBook) {
            const clean = splitNarrationFromChoices(narration).narration;
            const bookClean = bookStripInteractivePrompts(stripLockedPrologue(clean));
            if (bookClean && !isPrologueOnlyText(bookClean)) appendBookEntry(roomId, { kind: "narration", text: (_sceneTruthFromText(bookClean) || bookClean) });
          }

          onBeatComplete(roomId, rulesResult.canon_tokens);
          pushBeatSummary(roomId, rulesResult.beat_summary);
          rollupSceneOnSceneAdvance(roomId);
          maybeSummarizeSceneAsync(roomId);
          saveRoomStateFile(roomId);

          // Broadcast state (tokens/choices) to everyone, but keep prose private.
          try {
            const stNow = getRoomState(roomId);
            io.to(roomId).emit('canon_update', {
              roomId,
              canon_tokens: stNow.canon.tokens,
              lastChoices: stNow.lastChoices,
              book_meta: stNow.book?.meta || null
            });
          } catch {}

          // Actor POV now.
          try {
            const truth = _sceneTruthFromText(_turnTruth);
            const povText = await generatePovFromTruth(roomId, actorName, truth);
            await emitNarrationToActorOnly(roomId, actorName, {
              from,
              text: povText,
    truthText: truth,
              canon_tokens: rulesResult.canon_tokens,
              beat_summary: rulesResult.beat_summary,
              choices: rulesResult.choices,
              book_meta: getRoomState(roomId).book?.meta || null
            });
          } catch {
            await emitNarrationToActorOnly(roomId, actorName, {
              from,
              text: _turnTruth,
              canon_tokens: rulesResult.canon_tokens,
              beat_summary: rulesResult.beat_summary,
              choices: rulesResult.choices,
              book_meta: getRoomState(roomId).book?.meta || null
            });
          }

          // Consume the actor's cached observable digest now that the prose has been emitted.
          try {
            if (observedItems && observedMaxId) {
              const stNow = getRoomState(roomId);
              _ensureObsState(stNow);
              const kObs = _obsKey(actorName);
              stNow._obsSeen[kObs] = Math.max(0, Math.floor(Number(observedMaxId) || 0));
              try { delete stNow._turnDigestCache[kObs]; } catch {}
              try { saveRoomStateFile(roomId); } catch {}
            }
          } catch {}

          // Record an observable action event so nearby teammates can react on their turns.
          try { recordObservableAction(roomId, { actorName, actionText: rawText, beatSummary: rulesResult.beat_summary }); } catch {}
        }
    break;
  } catch (e) {
    try { restoreRoomFromAiSnapshot(roomId, _aiSnap); } catch {}
    if (_aiRestart < 2) {
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }
    throw e;
  }
}

// Turn ends after a successful resolve.
        let nextActor = '';
        try {
          TURNS.advanceTurn(roomId);
          nextActor = String(getRoomState(roomId)?.turn?.active || '').trim();
        } catch {}

        // Turn-start POV for the next actor (scene combined, derived from shared truth).
        try {
          if (nextActor && _turnTruth) {
            const truth = _sceneTruthFromText(_turnTruth);
            const povText = await generatePovFromTruth(roomId, nextActor, truth);
            await emitNarrationToActorOnly(roomId, nextActor, {
              from: _turnFrom || 'GM',
              text: povText,
    truthText: truth,
              canon_tokens: _turnCanonTokens || getRoomState(roomId)?.canon?.tokens || [],
              beat_summary: _turnBeatSummary,
              choices: _turnChoices,
              book_meta: getRoomState(roomId).book?.meta || null
            });
          }
        } catch {}
        // Turn start digest for the next actor (cached for prose integration).
        try {
          if (nextActor) await cacheTurnDigestForActor(roomId, nextActor);
        } catch {}

        // Optional UI-only recap for the next actor.
        // Default OFF: we want the "living book" prose to carry continuity naturally.
        try {
          if (TURN_RECAP_UI && nextActor) await emitTurnRecapToActor(roomId, nextActor);
        } catch {}
      } finally {
        // Flush Book updates only after the turn resolves (narration emitted).
        try { const stB = getRoomState(roomId); stB._deferBookUpdates = false; } catch {}
        try { flushBookUpdates(roomId); } catch {}

        endResolve(roomId, _seq);
      }
    });
  } catch (err) {
    try { cancelResolve(roomId, "error", { quiet: true }); } catch {}
    try { emitAiWait(roomId, false, "error", String(err?.message || err).slice(0, 60)); } catch {}
    try { io.to(roomId).emit("error_msg", String(err?.message || err)); } catch {}
    try { emitAiError(roomId, err); } catch {}
  }
}

// -------------------- Simultaneous intent rounds --------------------
// In SIMULTANEOUS mode, players submit one "intent" each during PLAN,
// then the server resolves in initiative order and broadcasts one round narration.
async function callLLMForRoundNarration({ roomId, round, beatLines, canonTokens }) {
  const rid = String(roomId || '').trim();
  const beats = Array.isArray(beatLines) ? beatLines.map(s => String(s || '').trim()).filter(Boolean) : [];
  const canon = String(canonTokens || '').trim();

  const system = `
You are the Aetheryn narrator.

TASK:
Write ONE cohesive round summary (3–6 paragraphs), present tense, naturalistic, story-forward.
Use concrete sensory detail and occasional quoted dialogue. No bullet lists. No headings. No meta talk.
Do NOT include a "CHOICES" block.

HARD CONSTRAINTS:
- You may ONLY state facts that are supported by the ROUND_BEATS below and CURRENT_CANON_TOKENS.
- Do NOT invent new named places, factions, institutions, or NPC names.
- Do NOT mention dice, targets, rolls, modifiers, deltas, or any mechanics numbers.
- Avoid recaps of the whole campaign; write only what happened THIS round.

OUTPUT:
Plain prose only.
`.trim();

  const user = `
CURRENT_CANON_TOKENS (do not print raw tokens):
${canon || '(empty)'}

ROUND_BEATS (facts to narrate, in order):
${beats.length ? beats.map((b,i)=>`${i+1}) ${b}`).join('\n') : '(empty)'}
`.trim();

  try {
    const out = await callLLMRole('narrator', {
      devMeta: { roomId: rid, purpose: 'round_narration' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: Number(process.env.ROUND_NARR_TEMPERATURE || 0.65),
      maxTokens: Number(process.env.ROUND_NARR_MAX_TOKENS || 1600),
      timeoutMs: Number(process.env.ROUND_NARR_TIMEOUT_MS || 120000),
      ollamaOptions: {
        num_ctx: Number(process.env.OLLAMA_NUM_CTX_NARRATOR || process.env.OLLAMA_NUM_CTX || 4096),
        repeat_last_n: Number(process.env.OLLAMA_REPEAT_LAST_N || 256),
        repeat_penalty: Number(process.env.OLLAMA_REPEAT_PENALTY || 1.15),
        top_k: Number(process.env.OLLAMA_TOP_K || 40),
        top_p: Number(process.env.OLLAMA_TOP_P || 0.9),
      }
    });
    return String(out || '').trim();
  } catch {
    // Fallback: stitch beats into a minimal readable paragraph.
    const flat = beats.join(' ');
    return flat ? flat : 'The party holds position, listening to the world breathe between decisions.';
  }
}

async function resolveSimultaneousRound(roomId, { reason = 'manual', fillMissing = true } = {}) {
  const rid = String(roomId || '').trim();
  if (!rid) return;

  const st0 = getRoomState(rid);
  const mode = String(st0?.turn?.mode || '').toUpperCase();
  const phase = String(st0?.turn?.phase || '').toUpperCase();
  if (mode !== 'SIMULTANEOUS' || phase !== 'PLAN') return;

  // Transition to RESOLVING and snapshot the intents/order.
  const roundData = TURNS.beginResolvingRound(rid, { fillMissing, defaultIntent: 'Hold position and reassess.' });
  if (!roundData) return;

  const order = Array.isArray(roundData.order) ? roundData.order : [];
  const intents = (roundData.intents && typeof roundData.intents === 'object') ? roundData.intents : {};
  const roundNo = Number(roundData.round || 1) || 1;

  if (!order.length) {
    try { TURNS.finishResolvingRound(rid, { incrementRound: false }); } catch {}
    return;
  }

  const aiSnap = snapshotRoomForAiRetry(rid);
  let turnSnap = null;
  try { turnSnap = JSON.parse(JSON.stringify(getRoomState(rid).turn || {})); } catch { turnSnap = null; }

  await TURNS.withRoomResolveLock(rid, async () => {
    const beatLines = [];
    const allowBook = (() => {
      try {
        const st = getRoomState(rid);
        const m = String(getTokenValue(st.canon.tokens, 'mode') || '').trim().toUpperCase();
        return m !== 'INTAKE' && m !== 'STATS';
      } catch { return true; }
    })();

    if (allowBook) {
      try { ensureChapterOpen(rid); } catch {}
    }

    // Defer Book UI updates until the full round is resolved (prevents mid-round Book flicker).
    if (allowBook) {
      try { const stB = getRoomState(rid); stB._deferBookUpdates = true; stB._bookDeferDirty = false; stB._bookDeferLast = null; } catch {}
    }

    for (const actor of order) {
      const k = String(actor || '').trim().toLowerCase();
      const rec = intents[k] || null;
      const rawText = String(rec?.text || 'Hold position and reassess.').trim();
      const actingPlayerId = String(rec?.playerId || '').trim() || null;
      const socketId = String(rec?.socketId || '').trim() || null;

      // Book: record declared action lines (optional).
      if (allowBook && BOOK_INCLUDE_ACTION_LINES) {
        try {
          const bsMode = String(BOOKSCRIBE_MODE || 'local').toLowerCase();
          let choiceLine = '';
          if (bsMode === 'llm') {
            try { choiceLine = await callLLMForBookLine({ roomId: rid, actor: actor, actionText: rawText }); } catch { choiceLine = `${actor} acts: ${rawText}`; }
          } else if (bsMode === 'off') {
            choiceLine = `${actor}: ${rawText}`;
          } else {
            choiceLine = localBookscribe(actor, rawText);
          }
          choiceLine = ensureSentencePunct(choiceLine);
          appendBookEntry(rid, { kind: 'choice', text: choiceLine, meta: { actor } });
        } catch {}
      }

      // Roll + inject mechanics into the model input (server rolls; mechanics stay out of prose).
      const stNow = getRoomState(rid);
      const rollSpec = computeActionRollSpec(stNow, actor, rawText);
      const tgt = computeActionTarget(stNow, actor, rawText, rollSpec);
      const rollInfo = buildRollInfoFromSpec(rollSpec, tgt, 'site');

      const checkTag = (Number(rollInfo?.spec?.sides) === 20) ? 'COMBAT_CHECK' : 'ACTION_CHECK';
      const modelInput =
        `${rawText}\n\n[${checkTag} ${String(rollInfo?.method || '').trim() || 'roll'}] ` +
        `Roll=${Number(rollInfo?.total || 0)} Target=${Number(rollInfo?.target || 0)} Delta=${fmtSigned(Number(rollInfo?.margin || 0))}`;

      // UI-only dice result to the owning device (no prose leakage).
      try {
        const lbl = (checkTag === 'COMBAT_CHECK') ? 'Combat Roll' : 'Action Roll';
        if (socketId) emitAutoDiceResultToSocketId(rid, socketId, rollInfo, lbl);
      } catch {}

      // Resolve via unified GM (updates canon + choices server-side).
      const uni = await callLLMUnifiedTurn({ roomId: rid, playerText: modelInput, actorName: actor, actingPlayerId });

      const beat = String(uni.beat_summary || '').trim();
      if (beat) beatLines.push(`${actor}: ${beat}`);

      // Track beat + continuity (server-side only)
      try { onBeatComplete(rid, uni.canon_tokens); } catch {}
      try { pushBeatSummary(rid, uni.beat_summary); } catch {}
      try { rollupSceneOnSceneAdvance(rid); } catch {}
      try { maybeSummarizeSceneAsync(rid); } catch {}
      try { saveRoomStateFile(rid); } catch {}

      // For teammate observability next round.
      try { recordObservableAction(rid, { actorName: actor, actionText: rawText, beatSummary: uni.beat_summary }); } catch {}
    }

    // After all intents resolve, narrate ONCE for the round.
    const stEnd = getRoomState(rid);
    const canonDump = compactCanonTokensForPrompt(stEnd?.canon?.tokens || [], { isKickoff: false, maxLines: 160, maxChars: 7000 });
    let roundNarr = await callLLMForRoundNarration({ roomId: rid, round: roundNo, beatLines, canonTokens: canonDump });
    roundNarr = collapseMultiSceneText(splitNarrationFromChoices(roundNarr).narration || roundNarr);
    const truth = _sceneTruthFromText(roundNarr);

    // Book: store one narration entry for the whole round.
    if (allowBook) {
      try {
        const bookClean = bookStripInteractivePrompts(stripLockedPrologue(roundNarr));
        if (bookClean && !isPrologueOnlyText(bookClean)) appendBookEntry(rid, { kind: 'narration', text: (_sceneTruthFromText(bookClean) || bookClean) });
      } catch {}
    }

    // Broadcast state (tokens/choices) to everyone.
    try {
      io.to(rid).emit('canon_update', {
        roomId: rid,
        canon_tokens: stEnd.canon.tokens,
        book_meta: stEnd.book?.meta || null
      });
    } catch {}

    // Broadcast one POV-safe narration bundle to all (filtered per socket).
    try {
      await emitKickoffToAll(rid, {
        from: 'GM',
        text: roundNarr,
        truthText: truth,
        canon_tokens: stEnd.canon.tokens,
        beat_summary: beatLines.join(' | '),
        choices: stEnd.lastChoices,
        book_meta: stEnd.book?.meta || null,
        meta: { kind: 'round', round: roundNo, reason: String(reason || '') }
      });
    } catch {
      try {
        io.to(rid).emit('narration', {
          from: 'GM',
          text: sanitizeNarrationText(roundNarr, stEnd?.canon?.tokens || []),
          canon_tokens: stEnd.canon.tokens,
          beat_summary: beatLines.join(' | '),
          choices: stEnd.lastChoices,
          book_meta: stEnd.book?.meta || null,
          meta: { kind: 'round', round: roundNo, reason: String(reason || '') }
        });
      } catch {}
    }

    // Flush Book updates now that the round narration has been delivered.
    if (allowBook) {
      try { const stB = getRoomState(rid); stB._deferBookUpdates = false; } catch {}
      try { flushBookUpdates(rid); } catch {}
    }

    // Back to planning.
    try { TURNS.finishResolvingRound(rid, { incrementRound: true }); } catch {}
  }).catch((err) => {
    try { const stB = getRoomState(rid); stB._deferBookUpdates = false; stB._bookDeferDirty = false; stB._bookDeferLast = null; } catch {}

    // Hard failure: restore snapshot and go back to planning.
    try { restoreRoomFromAiSnapshot(rid, aiSnap); } catch {}
    try {
      const st = getRoomState(rid);
      if (turnSnap) st.turn = turnSnap;
      else {
        try { st.turn.phase = 'PLAN'; st.turn.intents = {}; st.turn.updatedAt = Date.now(); } catch {}
      }
      saveRoomStateFile(rid);
      try { TURNS.emitTurnUpdate(rid); } catch {}
    } catch {}
    try { emitAiError(rid, err, 'Round resolution failed. Try again or use a smaller model.'); } catch {}
  });
}


// -------------------- END shared action resolution --------------------

// -------------------- Action Roll Gate (3d6 sum) --------------------
// Every player action must be followed by a roll (discrete integer, no bands/ranges).
// "AI Roll" = server dice roller. "Player Roll" = physical dice, user types the kept total.
socket.on("action_roll_submit", async (payload = {}) => {
  const roomId = socket.data.roomId;
  if (!roomId) return;

  const st = getRoomState(roomId);
  const pending = socket.data._pendingActionRoll;
  // Use the actor attached to the pending action when available (prevents cross-character mismatch).
  let actor = String(pending?.actor || '').trim();
  if (!actor) {
    // Optional override for couch co-op
    try {
      const wantRaw = String(payload?.actor || '').trim();
      const want = sanitizeTokenField(wantRaw, 80);
      if (want) {
        const allowed = Array.isArray(socket.data?.charNames) ? socket.data.charNames : [];
        const ok = !!st.isSingle || !allowed.length || allowed.some(n => String(n || '').trim().toLowerCase() === want.toLowerCase());
        if (ok) socket.data.charName = want;
      }
    } catch {}
    actor = normalizeActorName(st, socket);
  }
  const spec = pending?.spec || { sides: 6, count: 3, dropLowest: false };
  const rr = rollRangeFromSpec(spec);

  // Turn-based enforcement: the roll submit must come from the active player.
  try {
    if (hasModeToken(st.canon.tokens, 'PLAY')) {
      await TURNS.startInitiative(roomId);
    }
    const phase = String(st?.turn?.phase || 'OFF').toUpperCase();
    if (phase === 'INIT') {
      try { TURNS.promptIfNeeded(roomId, socket); } catch {}
      socket.emit('error_msg', 'Turn order not set. Roll initiative (1d20) first.');
      return;
    }
    if (!TURNS.canActorAct(roomId, actor)) {
      const active = String(st?.turn?.active || '').trim();
      socket.emit('error_msg', active ? `Not your turn. Waiting for ${active}.` : 'Not your turn.');
      return;
    }
  } catch {}

  if (!pending) {
    socket.emit("error_msg", "No pending roll.");
    return;
  }
  try {
    const k = String(pending?.kind || 'action').trim().toLowerCase();
    if (k === 'action' && !pending.text) {
      socket.emit("error_msg", "No pending action roll. Send an action first.");
      return;
    }
  } catch {}

  // Accept either:
  // - dice: [..] matching the requested dice, OR
  // - total: the final integer from physical dice.
  let dice = Array.isArray(payload?.dice) ? payload.dice.map(n => Number(n)).filter(n => Number.isFinite(n)) : null;
  let total = Number(payload?.total);

  const sides = Number(spec?.sides) || 6;
  const count = Math.max(1, Math.floor(Number(spec?.count) || 1));
  const dropLowest = !!spec?.dropLowest;

  if (dice && dice.length === count) {
    if (dice.some(n => n < 1 || n > sides)) {
      socket.emit('error_msg', `Invalid dice. Expected ${count} values in 1–${sides}.`);
      return;
    }
    const sum = dice.reduce((a,b)=>a+b, 0);
    if (dropLowest && sides === 6 && count === 3) {
      total = sum - Math.min(...dice);
    } else {
      total = sum;
    }
  } else {
    dice = null;
  }

  if (!Number.isFinite(total) || total < rr.min || total > rr.max) {
    socket.emit('error_msg', `Invalid roll total. Expected ${rr.min}–${rr.max} for ${count}d${sides}${dropLowest ? ' drop-lowest' : ''}.`);
    return;
  }

  const target = Number.isFinite(Number(pending?.target)) ? Number(pending.target) : computeActionTarget(st, actor, pending?.text || "", spec);
  const margin = Math.floor(total) - Math.floor(target);

  // Clear pending before resolving (prevents double-submit spam).
  delete socket.data._pendingActionRoll;

  const rollInfo = {
    method: `${count}d${sides}${dropLowest ? '_drop_lowest' : ''}`,
    total: Math.floor(total),
    dice,
    target: Math.floor(target),
    margin: Math.floor(margin),
    source: String(payload?.source || 'player').slice(0, 20),
    spec: { sides, count, dropLowest }
  };

  // Ack to the client so the UI can unlock immediately.
  try { socket.emit("action_roll_done", { ok: true, roll: rollInfo }); } catch {}

  // Some rolls are code-authoritative (crafting / forage / hunt) and should not invoke the GM.
  try {
    const kind = String(pending?.kind || 'action').trim().toLowerCase();
    if (kind && kind !== 'action') {
      await resolvePendingCraftOrGather({ roomId, socket, actor, pending, rollInfo });
      return;
    }
  } catch {}

  // Now resolve the actual turn using the stored action text + this roll result.
  const text = String(pending.text || "").trim();
  if (!text) return;

  await resolveActionWithRoll({ roomId, socket, actor, text, rollInfo });
});

socket.on("stats_submit_rolls", async () => {
  // Typed stat rolls are disabled to prevent reroll fishing. Use per-stat server rolls.
  try {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const st = getRoomState(roomId);
    const actor = normalizeActorName(st, socket);
    const myCharNames = (Array.isArray(socket.data?.charNames) && socket.data.charNames.length) ? socket.data.charNames : (actor ? [actor] : []);
    socket.emit("error_msg", "Typed stat rolls are disabled. Roll each stat once using the Roll buttons, then Lock Stats.");
    socket.emit("stats_required", { charName: actor || "", haveStats: actor ? hasPcStats(st.canon.tokens, actor) : false, preference: st.intakeGlobal?.q0 || "", pending: actor ? (st._statsPending ? st._statsPending[String(actor||'').trim().toLowerCase()] : null) : null, myCharNames });
  } catch {}
});

  // -------------------- Party Chat (Out-of-character) --------------------
  socket.on("ooc_message", ({ text }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const msg = {
      from: String(socket.data.name || "Anonymous"),
      text: String(text || "").slice(0, 2000),
      ts: Date.now(),
    };
    const roomState = getRoomState(roomId);
    if (!Array.isArray(roomState.ooc)) roomState.ooc = [];
    roomState.ooc.push(msg);
    if (roomState.ooc.length > 500) roomState.ooc = roomState.ooc.slice(-500);
    saveRoomStateFile(roomId);
    io.to(roomId).emit("ooc_message", msg);
  });



  // -------------------- Quick Party Actions (in-world, no turn, no time advance) --------------------
  // Purpose: fast collaboration (talk/plan/trade/whistle) that does NOT consume a turn.
  // Visibility: only to nearby party members (same proximity group). This is NOT POV prose.
  socket.on('party_quick', async (payload = {}) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const st = getRoomState(roomId);
    if (!hasModeToken(st.canon.tokens, 'PLAY')) {
      socket.emit('error_msg', 'Party actions are only available in PLAY.');
      return;
    }

    // Basic throttle to prevent spam.
    const now = Date.now();
    const last = Number(socket.data._partyQuickLastAt || 0);
    if (now - last < 600) return;
    socket.data._partyQuickLastAt = now;

    const actor = normalizeActorName(st, socket) || 'Someone';
    const kind = String(payload?.kind || 'talk').trim().toLowerCase();
    let note = String(payload?.text || '').trim();
    if (note.length > 220) note = note.slice(0, 217) + '...';

    // Optional direct target (for natural back-and-forth). If set, only the actor + target receive it.
    const targetRaw = String(payload?.target || payload?.replyTo || '').trim();
    const target = sanitizeTokenField(targetRaw, 80);

    // Ensure per-character states/groups exist so we can scope delivery by proximity.
    try {
      const roster = getPartyNamesFromTokens(st.canon.tokens) || [];
      st.canon.tokens = ensurePStatesForRoster(st.canon.tokens, roster);
      st.canon.tokens = recomputePartyGroups(st.canon.tokens, roster);
      saveRoomStateFile(roomId);
    } catch {}

    const tokens = Array.isArray(st?.canon?.tokens) ? st.canon.tokens : [];
    const ps = getPStates(tokens);
    const aKey = _obsKey(actor);
    const aGid = Number(ps.get(aKey)?.gid || 0) || 0;
    const axy = ps.get(aKey) && Number.isFinite(ps.get(aKey).x) && Number.isFinite(ps.get(aKey).y)
      ? { x: ps.get(aKey).x, y: ps.get(aKey).y, region: ps.get(aKey).region || '' }
      : (parseXY(tokens) || { x: 0.5, y: 0.5, region: '' });

    const verb = (() => {
      if (kind === 'talk') return 'says';
      if (kind === 'plan') return 'plans';
      if (kind === 'trade') return 'offers a trade';
      if (kind === 'whistle' || kind === 'call') return 'signals';
      return 'does';
    })();

    const text = (() => {
      if (kind === 'talk') return note ? `${actor} says: “${note}”` : `${actor} speaks to the group.`;
      if (kind === 'plan') return note ? `${actor} proposes a plan: ${note}` : `${actor} gestures for a quick plan.`;
      if (kind === 'trade') return note ? `${actor} offers a trade: ${note}` : `${actor} offers to trade.`;
      if (kind === 'whistle' || kind === 'call') return note ? `${actor} signals (${kind}): ${note}` : `${actor} uses a sharp ${kind} to get attention.`;
      return note ? `${actor} ${verb}: ${note}` : `${actor} ${verb}.`;
    })();

    // Determine which characters are eligible to receive this quick action.
    // - Talk/plan/trade require <= 100 ft to be heard/used (unless it's a whistle/call).
    // - Whistle/call can reach the whole nearby group (<= 550 ft, or 700 ft in quiet zones).
    const roster = getPartyNamesFromTokens(tokens) || [];
    const recipients = new Set();
    const wantDirected = !!target;
    if (wantDirected) {
      recipients.add(_pNameKey(actor));
      recipients.add(_pNameKey(target));
    } else {
      for (const cn of roster) {
        const ck = _obsKey(cn);
        const gid = Number(ps.get(ck)?.gid || 0) || 0;
        if (gid !== aGid) continue;
        recipients.add(_pNameKey(cn));
      }
    }

    // Apply 100 ft hearing constraint for talk/plan/trade.
    if (kind === 'talk' || kind === 'plan' || kind === 'trade') {
      const keep = new Set();
      for (const cn of recipients) {
        if (!cn) continue;
        if (cn.toLowerCase() === _pNameKey(actor).toLowerCase()) { keep.add(cn); continue; }
        const stC = ps.get(_obsKey(cn));
        if (!stC || !Number.isFinite(stC.x) || !Number.isFinite(stC.y)) continue;
        const dFeet = mapDistanceFeetServer({ x: axy.x, y: axy.y }, { x: stC.x, y: stC.y }, MAP_WIDTH_MILES_DEFAULT);
        if (dFeet <= 100) keep.add(cn);
      }
      // If nobody else can hear, instruct to whistle/call.
      const onlySelf = (keep.size <= 1);
      if (onlySelf) {
        socket.emit('error_msg', 'No one is within 100 ft to hear you. Use Whistle/Call to signal, or move closer.');
        return;
      }
      recipients.clear();
      for (const cn of keep) recipients.add(cn);
    }

    // Broadcast only to sockets that control at least one eligible character.
    try {
      const sockets = await io.in(roomId).fetchSockets();
      for (const s of (sockets || [])) {
        const list = (Array.isArray(s?.data?.charNames) && s.data.charNames.length)
          ? s.data.charNames.map(x => String(x || '').trim()).filter(Boolean)
          : (String(s?.data?.charName || '').trim() ? [String(s.data.charName).trim()] : []);
        if (!list.length) continue;
        let ok = false;
        for (const cn of list) {
          const nm = _pNameKey(cn);
          if (!nm) continue;
          if (recipients.has(nm)) { ok = true; break; }
        }
        if (!ok) continue;
        try { s.emit('party_quick_msg', { from: actor, kind, text, ts: now, target: target || '' }); } catch {}
      }
    } catch {}

    // Record as an observable action so it can appear in turn-start digests as well.
    try { recordObservableAction(roomId, { actorName: actor, actionText: `${kind}: ${note || verb}` }); } catch {}
  });



  // -------------------- Auto Trade (two-party, explicit accept/decline, no time advance) --------------------
  // Trade rules:
  // - Both parties must be nearby.
  // - Item transfer allowed only if <= 5 ft OR both are in a rest/camp structure (house/inn/etc.).
  // - No party pool: inventory is per-character (invp:<NAME>|...).
  socket.on('trade_request', async (payload = {}) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const st = getRoomState(roomId);
    if (!hasModeToken(st.canon.tokens, 'PLAY')) {
      socket.emit('error_msg', 'Trade is only available in PLAY.');
      return;
    }

    const from = normalizeActorName(st, socket) || '';
    const to = sanitizeTokenField(String(payload?.to || payload?.target || '').trim(), 80);
    if (!from || !to) {
      socket.emit('error_msg', 'Trade requires a target player.');
      return;
    }
    if (from.toLowerCase() === to.toLowerCase()) {
      socket.emit('error_msg', 'You cannot trade with yourself.');
      return;
    }

    const giveItem = sanitizeTokenField(String(payload?.giveItem || payload?.give || payload?.item || '').trim(), 80);
    const giveQty = Math.max(1, Math.floor(Number(payload?.giveQty || payload?.qty || 1) || 1));
    const wantItem = sanitizeTokenField(String(payload?.wantItem || payload?.want || '').trim(), 80);
    const wantQty = wantItem ? Math.max(1, Math.floor(Number(payload?.wantQty || 1) || 1)) : 0;
    if (!giveItem) {
      socket.emit('error_msg', 'Trade requires an item to give.');
      return;
    }

    // Ensure per-character states/groups exist.
    try {
      const roster = getPartyNamesFromTokens(st.canon.tokens) || [];
      st.canon.tokens = ensurePStatesForRoster(st.canon.tokens, roster);
      st.canon.tokens = recomputePartyGroups(st.canon.tokens, roster);
    } catch {}

    const tokens = Array.isArray(st.canon.tokens) ? st.canon.tokens : [];
    const ps = getPStates(tokens);
    const fromSt = ps.get(_obsKey(from));
    const toSt = ps.get(_obsKey(to));
    if (!fromSt || !toSt) {
      socket.emit('error_msg', 'Trade failed: missing location state for one of the players.');
      return;
    }

    // Must be in same scene group to initiate.
    if (Number(fromSt.gid || 0) !== Number(toSt.gid || 0)) {
      socket.emit('error_msg', `${to} is too far away to trade.`);
      return;
    }

    // Validate inventory availability for the offer.
    const invFrom = parseInvMapFor(tokens, from);
    const kGive = giveItem.toLowerCase();
    const haveGive = Number(invFrom.get(kGive) || 0) || 0;
    if (haveGive < giveQty) {
      socket.emit('error_msg', `Trade failed: you do not have enough ${giveItem} (need ${giveQty}, have ${haveGive}).`);
      return;
    }

    // Create a pending trade record.
    const tradeId = `TR_${crypto.randomBytes(6).toString('hex')}`;
    if (!st._trades || typeof st._trades !== 'object') st._trades = {};
    st._trades[tradeId] = {
      id: tradeId,
      from,
      to,
      give: { item: giveItem, qty: giveQty },
      want: wantItem ? { item: wantItem, qty: wantQty } : null,
      ts: Date.now(),
      status: 'pending'
    };
    saveRoomStateFile(roomId);

    const tradePayload = { tradeId, from, to, giveItem, giveQty, wantItem, wantQty, ts: Date.now() };

    // Deliver to both involved sockets only (privacy).
    try {
      const sockets = await io.in(roomId).fetchSockets();
      for (const s of (sockets || [])) {
        const list = (Array.isArray(s?.data?.charNames) && s.data.charNames.length)
          ? s.data.charNames.map(x => String(x || '').trim()).filter(Boolean)
          : (String(s?.data?.charName || '').trim() ? [String(s.data.charName).trim()] : []);
        if (!list.length) continue;
        const hasFrom = list.some(n => String(n||'').trim().toLowerCase() === from.toLowerCase());
        const hasTo = list.some(n => String(n||'').trim().toLowerCase() === to.toLowerCase());
        if (!hasFrom && !hasTo) continue;
        try { s.emit('trade_request', tradePayload); } catch {}
      }
    } catch {}

    // Record as observable action (nearby players can see bartering gestures).
    try { recordObservableAction(roomId, { actorName: from, actionText: `offers a trade to ${to}` }); } catch {}
  });


  socket.on('trade_response', async (payload = {}) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const st = getRoomState(roomId);
    if (!hasModeToken(st.canon.tokens, 'PLAY')) return;

    const tradeId = String(payload?.tradeId || '').trim();
    if (!tradeId) return;
    const accept = !!payload?.accept;

    const rec = st._trades && st._trades[tradeId] ? st._trades[tradeId] : null;
    if (!rec || rec.status !== 'pending') return;

    const to = String(rec.to || '').trim();
    const from = String(rec.from || '').trim();

    // Verify this socket controls the target character.
    const responder = sanitizeTokenField(String(payload?.actor || to).trim(), 80) || to;
    const myNames = (Array.isArray(socket.data?.charNames) && socket.data.charNames.length)
      ? socket.data.charNames.map(n => String(n||'').trim()).filter(Boolean)
      : (String(socket.data?.charName || '').trim() ? [String(socket.data.charName).trim()] : []);
    if (!myNames.some(n => n.toLowerCase() === to.toLowerCase()) || responder.toLowerCase() !== to.toLowerCase()) {
      socket.emit('error_msg', 'Trade response rejected: you are not the target of this trade.');
      return;
    }

    if (!accept) {
      rec.status = 'declined';
      saveRoomStateFile(roomId);
      try {
        const sockets = await io.in(roomId).fetchSockets();
        for (const s of (sockets || [])) {
          const list = (Array.isArray(s?.data?.charNames) && s.data.charNames.length)
            ? s.data.charNames.map(x => String(x || '').trim()).filter(Boolean)
            : (String(s?.data?.charName || '').trim() ? [String(s.data.charName).trim()] : []);
          if (!list.length) continue;
          const hasFrom = list.some(n => String(n||'').trim().toLowerCase() === from.toLowerCase());
          const hasTo = list.some(n => String(n||'').trim().toLowerCase() === to.toLowerCase());
          if (!hasFrom && !hasTo) continue;
          try { s.emit('trade_result', { tradeId, ok: false, status: 'declined', from, to, message: `${to} declined the trade.` }); } catch {}
        }
      } catch {}
      return;
    }

    // Recompute proximity for enforcement.
    try {
      const roster = getPartyNamesFromTokens(st.canon.tokens) || [];
      st.canon.tokens = ensurePStatesForRoster(st.canon.tokens, roster);
      st.canon.tokens = recomputePartyGroups(st.canon.tokens, roster);
    } catch {}

    const tokens0 = Array.isArray(st.canon.tokens) ? st.canon.tokens : [];
    const ps = getPStates(tokens0);
    const fromSt = ps.get(_obsKey(from));
    const toSt = ps.get(_obsKey(to));
    if (!fromSt || !toSt) {
      socket.emit('error_msg', 'Trade failed: missing location state.');
      return;
    }
    if (Number(fromSt.gid || 0) !== Number(toSt.gid || 0)) {
      socket.emit('error_msg', 'Trade failed: target is no longer nearby.');
      return;
    }

    const distFeet = mapDistanceFeetServer({ x: fromSt.x, y: fromSt.y }, { x: toSt.x, y: toSt.y }, MAP_WIDTH_MILES_DEFAULT);
    const locFrom = extractLocFor(tokens0, from) || '';
    const locTo = extractLocFor(tokens0, to) || '';
    const isRestLoc = (loc) => {
      const low = String(loc || '').toLowerCase();
      if (!low) return false;
      const kws = ['house','inn','camp','tent','cabin','hut','lodge','shelter','room'];
      if (kws.some(k => low.includes(k))) return true;
      try {
        const assets = parseAssetTokens(tokens0);
        return assets.some(a => String(a.type||'').toLowerCase() === 'house' && String(a.loc||'').toLowerCase() === low);
      } catch { return false; }
    };
    const restOk = (isRestLoc(locFrom) && isRestLoc(locTo) && locFrom && locTo && locFrom.toLowerCase() === locTo.toLowerCase());
    if (!(distFeet <= 5 || restOk)) {
      socket.emit('error_msg', `Trade blocked: you must be within 5 ft to exchange items (or both be in the same rest/camp structure). Current distance ≈ ${Math.round(distFeet)} ft.`);
      return;
    }

    // Apply the transfer.
    const giveItem = sanitizeTokenField(String(rec.give?.item || '').trim(), 80);
    const giveQty = Math.max(1, Math.floor(Number(rec.give?.qty || 1) || 1));
    const wantItem = sanitizeTokenField(String(rec.want?.item || '').trim(), 80);
    const wantQty = wantItem ? Math.max(1, Math.floor(Number(rec.want?.qty || 1) || 1)) : 0;

    const invFrom = parseInvMapFor(tokens0, from);
    const invTo = parseInvMapFor(tokens0, to);

    const haveGive = Number(invFrom.get(giveItem.toLowerCase()) || 0) || 0;
    if (haveGive < giveQty) {
      socket.emit('error_msg', `Trade failed: ${from} no longer has enough ${giveItem}.`);
      rec.status = 'failed';
      saveRoomStateFile(roomId);
      return;
    }

    if (wantItem) {
      const haveWant = Number(invTo.get(wantItem.toLowerCase()) || 0) || 0;
      if (haveWant < wantQty) {
        socket.emit('error_msg', `Trade failed: you do not have enough ${wantItem} (need ${wantQty}).`);
        return;
      }
    }

    // Mutate inventories.
    invAddQty(invFrom, giveItem.toLowerCase(), giveItem, -giveQty);
    invAddQty(invTo, giveItem.toLowerCase(), giveItem, giveQty);
    if (wantItem) {
      invAddQty(invTo, wantItem.toLowerCase(), wantItem, -wantQty);
      invAddQty(invFrom, wantItem.toLowerCase(), wantItem, wantQty);
    }

    let tokens1 = tokens0;
    tokens1 = rebuildInvTokensFor(tokens1, from, invFrom);
    tokens1 = rebuildInvTokensFor(tokens1, to, invTo);

    st.canon.tokens = tokens1;
    rec.status = 'completed';
    saveRoomStateFile(roomId);

    const summary = `${from} traded ${giveQty}× ${giveItem} to ${to}` + (wantItem ? ` for ${wantQty}× ${wantItem}` : '');
    try {
      const sockets = await io.in(roomId).fetchSockets();
      for (const s of (sockets || [])) {
        const list = (Array.isArray(s?.data?.charNames) && s.data.charNames.length)
          ? s.data.charNames.map(x => String(x || '').trim()).filter(Boolean)
          : (String(s?.data?.charName || '').trim() ? [String(s.data.charName).trim()] : []);
        if (!list.length) continue;
        const hasFrom = list.some(n => String(n||'').trim().toLowerCase() === from.toLowerCase());
        const hasTo = list.some(n => String(n||'').trim().toLowerCase() === to.toLowerCase());
        if (!hasFrom && !hasTo) continue;
        try { s.emit('trade_result', { tradeId, ok: true, status: 'completed', from, to, message: summary }); } catch {}
      }
    } catch {}

    // Update HUDs.
    try {
      io.to(roomId).emit('canon_update', { roomId, canon_tokens: st.canon.tokens, lastChoices: st.lastChoices, book_meta: st.book?.meta || null });
    } catch {}

    // Observable handoff.
    try { recordObservableAction(roomId, { actorName: from, actionText: `trades with ${to}` }); } catch {}
  });



  // -------------------- Quick Peek Actions (Info-only) --------------------
  // These are "helper" buttons above the main choices: they do NOT advance time,
  // do NOT trigger mandatory rolls, and do NOT mutate canon state.
  socket.on("peek_action", async (payload = {}) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const st = getRoomState(roomId);
    if (!hasModeToken(st.canon.tokens, "PLAY")) {
      socket.emit("error_msg", "Peek actions are only available in PLAY.");
      return;
    }

    // Basic throttle to prevent spam.
    const now = Date.now();
    const last = Number(socket.data._peekLastAt || 0);
    if (now - last < 900) return;
    socket.data._peekLastAt = now;

    const actor = normalizeActorName(st, socket) || "Someone";
    const kind = String(payload?.kind || payload?.action || "look").trim().toLowerCase();
    const label = sanitizeTokenField(String(payload?.label || kind).trim(), 48) || kind;

    // Purely code-driven peeks (no model).
    if (kind === "gear" || kind === "inventory") {
      try {
        const inv = parseInvMapFor(st.canon.tokens, actor);
        const eq = parseEqMapFor(st.canon.tokens, actor);
        const invList = Array.from(inv.entries())
          .filter(([_, q]) => (Number(q) || 0) > 0)
          .sort((a,b)=>String(invGetName(inv, a[0], a[0])).localeCompare(String(invGetName(inv, b[0], b[0]))))
          .map(([k,q]) => `${invGetName(inv, k, k)} x${q}`);
        const eqList = Array.from(eq.entries())
          .sort((a,b)=>String(a[0]).localeCompare(String(b[0])))
          .map(([slot,item]) => `${slot}: ${item}`);

        const text =
          `Gear check:
` +
          `${eqList.length ? ("Equipped: " + eqList.join(", ")) : "Equipped: (nothing)"}
` +
          `${invList.length ? ("Inventory: " + invList.join(", ")) : "Inventory: (empty)"}`;

        // Peek results are private to the requester (not a turn, not shared POV).
        socket.emit("peek_result", { from: "SYSTEM", actor, kind, label, text });
        return;
      } catch {}
    }

    const continuity = getCompactContinuity(roomId, { actor });

    const system = `
You are AETHERYN_NARRATOR.
This is an INFO-ONLY aside to help the player perceive the current situation.
RULES:
- Do NOT advance time.
- Do NOT resolve outcomes, start fights, introduce new NPCs, or create new items.
- Do NOT change any facts or canon tokens.
- Output 1–2 short paragraphs, present tense, grounded in SNAPSHOT_TOKENS + SCENE_SUMMARY.
- NO "CHOICES:" block.
If a critical detail is missing, ask ONE clear question at the end.
`;

    const user = `
SCENE_SUMMARY:
${continuity.scene_summary || "(empty)"}

RECENT_NARRATION_SNIPPET:
${continuity.last_narration_snippet || "(empty)"}

SNAPSHOT_TOKENS:
${(continuity.snapshotTokens || []).join("\n")}

PEEK_REQUEST:
${label}
`;

    emitAiWait(roomId, true, "narrator", "peek");
    let out = "";
    try {
      out = await callLLMRole("narrator", {
        devMeta: { roomId, purpose: 'peek' },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
        temperature: 0.45,
        maxTokens: 260,
        ollamaOptions: {
          num_ctx: Number(process.env.OLLAMA_NUM_CTX_NARRATOR || process.env.OLLAMA_NUM_CTX || 4096),
          repeat_last_n: Number(process.env.OLLAMA_REPEAT_LAST_N || 256),
          repeat_penalty: Number(process.env.OLLAMA_REPEAT_PENALTY || 1.15),
          top_k: Number(process.env.OLLAMA_TOP_K || 40),
          top_p: Number(process.env.OLLAMA_TOP_P || 0.9),
        }
      });
    } catch (e) {
      socket.emit("error_msg", String(e?.message || e));
      return;
    } finally {
      emitAiWait(roomId, false, "narrator", "peek");
    }

    const from = String(normProvider(effectiveNarratorProvider()) || "LLM").toUpperCase();
    const text = String(out || "").trim();
    if (!text) return;

    // Peek results are private to the requester (prevents cross-player leakage in online MP).
    socket.emit("peek_result", { from, actor, kind, label, text });
  });

  socket.on("player_message", async (payload = {}) => {
    const roomId = socket.data.roomId;
    const text = payload?.text;
    if (!roomId || !text) return;

    // Meta commands are handled locally (no model call).
    if (handleMetaCommand(roomId, socket, text)) return;

    // Scope lockdown: refuse anything outside AETHERYN.
    const gate = detectOutOfScope(text);
    if (gate && gate.blocked) {
      emitLockdownNarration(roomId, `bucket:${gate.bucket} hit:${gate.hit}`);
      return;
    }
    const roomState = getRoomState(roomId);

    // Optional per-message actor override (for couch co-op).
    try {
      const wantRaw = String(payload?.actor || '').trim();
      const want = sanitizeTokenField(wantRaw, 80);
      if (want) {
        const allowed = Array.isArray(socket.data?.charNames) ? socket.data.charNames : [];
        const soloLike = !!roomState.isSingle || Number(roomState.expectedPlayers || 0) === 1;
        let ok = false;
        if (soloLike) ok = true;
        else if (allowed.length) ok = allowed.some(n => String(n || '').trim().toLowerCase() === want.toLowerCase());
        else {
          // If we don't have a roster for this socket, don't allow switching identities.
          const cur = String(socket.data?.charName || '').trim();
          ok = !!cur && cur.toLowerCase() === want.toLowerCase();
        }
        if (ok) socket.data.charName = want;
      }
    } catch {}

    const actor = normalizeActorName(roomState, socket);

    // Lobby gate: don't run gameplay or AI turns until the host starts the game.
    if (hasModeToken(roomState.canon.tokens, "LOBBY")) {
      socket.emit("error_msg", "This room is in LOBBY. The host must Start Game before anyone can act.");
      return;
    }

    // Hard gate: no gameplay until mandatory stat allocation is complete.
    if (hasModeToken(roomState.canon.tokens, "STATS")) {
      const have = hasPcStats(roomState.canon.tokens, actor);
      const pref = roomState.intakeGlobal?.q0 || "";
      const myCharNames = (Array.isArray(socket.data?.charNames) && socket.data.charNames.length) ? socket.data.charNames : [actor];
      const expected = Number(roomState.expectedPlayers || 0) || 0;
      const isTrueSolo = (!!roomState.isSingle || String(roomId || "").toLowerCase().startsWith("solo-")) && expected === 1;

      try {
        if (!have) {
          socket.emit("error_msg", "Stat allocation required before play.");
          socket.emit("stats_required", { charName: actor, haveStats: false, preference: pref, myCharNames });
          return;
        }

        // If YOU are done, always attempt to advance the room out of STATS.
        await maybeExitStatsPhase(roomId);
        let st2 = getRoomState(roomId);

        // Single-player must never be blocked by extra sockets/tabs/views.
        // If stats exist for this actor but the room somehow remains in STATS, force-play.
        if (isTrueSolo && hasPcStats(st2.canon.tokens, actor) && hasModeToken(st2.canon.tokens, "STATS")) {
          // Force-exit STATS safely (rare edge case: drifted roster/sockets).
          // IMPORTANT: if the Book has no narration yet, we must still generate an opening scene
          // so the Play area isn't blank and players aren't forced to "poke" the AI.
          st2.canon.tokens = setModeToken(st2.canon.tokens, "PLAY");
          st2.canon.tokens = clearFlagToken(st2.canon.tokens, 'kickoff_done');
          if (!roomHasAnyNarration(st2)) {
            st2.canon.tokens = setFlagToken(st2.canon.tokens, 'needs_kickoff', 1);
          }
          saveRoomStateFile(roomId);
          io.to(roomId).emit("canon_update", {
            roomId,
            canon_tokens: st2.canon.tokens,
            lastChoices: st2.lastChoices,
            book_meta: st2.book?.meta || null,
          });

          // If we just forced into PLAY with no opening scene yet, generate it now.
          // (Also starts initiative after the kickoff so the first action is properly gated.)
          try {
            const started = await autoStartPlayIfNeeded(roomId, { reason: 'forced_exit_stats' });
            if (started) {
              try { await TURNS.startInitiative(roomId); } catch {}
            }
          } catch (e) {
            try { socket.emit('error_msg', `Opening scene failed: ${String(e?.message || e)}`); } catch {}
          }

          // Do not process the player's message in the same tick; the opening scene + turn gate
          // should land first so the UI has something to play on.
          return;
        }

        const st3 = getRoomState(roomId);
        if (!hasModeToken(st3.canon.tokens, "STATS")) {
          // proceed with the message normally (refresh local view of state)
          roomState.canon.tokens = st3.canon.tokens;
        } else {
          socket.emit("error_msg", "Waiting for all players to finish stat allocation.");
          socket.emit("stats_required", { charName: actor, haveStats: true, preference: pref, myCharNames });
          return;
        }

      } catch {
        const msg = have ? "Waiting for all players to finish stat allocation." : "Stat allocation required before play.";
        socket.emit("error_msg", msg);
        socket.emit("stats_required", { charName: actor, haveStats: have, preference: pref, myCharNames });
        return;
      }
    }

    // Per-player gate: nobody gets to act without locked stats in any gameplay mode (PLAY / COMBAT / etc).
    // (INTAKE and STATS are the only non-gameplay modes.)
    const modeNow = String(getTokenValue(roomState.canon.tokens, 'mode') || '').trim().toUpperCase();
    const gameplayMode = modeNow && modeNow !== 'INTAKE' && modeNow !== 'STATS';
    if (gameplayMode) {
      const have = hasPcStats(roomState.canon.tokens, actor);
      if (!have) {
        socket.emit('error_msg', 'Stat allocation required before play.');
        const myCharNames = (Array.isArray(socket.data?.charNames) && socket.data.charNames.length) ? socket.data.charNames : [actor];
        socket.emit('stats_required', { charName: actor, haveStats: false, preference: roomState.intakeGlobal?.q0 || '', myCharNames });
        return;
      }
    }

    // -------------------- Turn-based gate (initiative + active player) --------------------
    // In multiplayer, the room requires initiative (1d20) before anyone can act.
    // Once active, only the current player may submit an action.
    try {
      if (hasModeToken(roomState.canon.tokens, 'PLAY')) {
        await TURNS.startInitiative(roomId);
      }
      const phase = String(roomState?.turn?.phase || 'OFF').toUpperCase();
      if (phase === 'INIT') {
        try { TURNS.promptIfNeeded(roomId, socket); } catch {}
        socket.emit('error_msg', 'Turn order not set. Roll initiative (1d20) first.');
        return;
      }

      // Simultaneous intent mode:
      // - PLAN: everyone submits/updates an intent (no immediate resolution)
      // - RESOLVING: server-only (players wait)
      const turnMode = String(roomState?.turn?.mode || '').toUpperCase();
      if (turnMode === 'SIMULTANEOUS') {
        if (phase === 'PLAN') {
          try {
            const r = TURNS.submitIntent(roomId, socket, { actorName: actor, text: String(text || '').trim() });
            if (!r || !r.ok) {
              socket.emit('error_msg', 'Unable to submit intent.');
              return;
            }
            socket.emit('system', `Intent set for ${r.actor}. (${r.readyCount}/${r.totalCount})`);
            if (r.allReady) {
              await resolveSimultaneousRound(roomId, { reason: 'all_ready', fillMissing: false });
            }
          } catch (e) {
            socket.emit('error_msg', String(e?.message || e));
          }
          return;
        }
        if (phase === 'RESOLVING') {
          socket.emit('error_msg', 'Resolving the round… please wait.');
          return;
        }
      }

      if (!TURNS.canActorAct(roomId, actor)) {
        const active = String(roomState?.turn?.active || '').trim();
        socket.emit('error_msg', active ? `Not your turn. Waiting for ${active}.` : 'Not your turn.');
        return;
      }
    } catch {}

    // -------------------- Action resolution (server-authoritative rolls) --------------------
    // Default is AUTO: the server rolls and resolves immediately (dice results show in the UI).
    // Set ACTION_ROLL_MODE=prompt in server/.env to require physical rolls / modal submit.
    if (ACTION_ROLL_MODE === "prompt") {
      if (!socket.data._pendingActionRoll) {
        const rollSpec = computeActionRollSpec(roomState, actor, text);
        const tgt = computeActionTarget(roomState, actor, text, rollSpec);
        socket.data._pendingActionRoll = { text: String(text).trim(), actor, target: tgt, spec: rollSpec, ts: Date.now() };
        socket.emit('action_roll_required', {
          roomId,
          actor,
          spec: rollSpec,
          label: (Number(rollSpec.sides) === 20 ? 'Combat Roll' : 'Action Roll'),
          note: (Number(rollSpec.sides) === 20
            ? `Roll 1d20 (1–20) vs Target ${tgt}. Delta = Roll − Target.`
            : `Roll 3d6 (sum 3–18) vs Target ${tgt}. Delta = Roll − Target.`)
        });
      } else {
        socket.emit("error_msg", "A roll is required to resolve your last action. Submit it before acting again.");
        const spec2 = socket.data._pendingActionRoll?.spec || computeActionRollSpec(roomState, actor, socket.data._pendingActionRoll?.text || "");
        const tgt = Number(socket.data._pendingActionRoll?.target) || computeActionTarget(roomState, actor, socket.data._pendingActionRoll?.text || "", spec2);
        socket.emit("action_roll_required", {
          roomId,
          actor,
          spec: spec2,
          label: (Number(spec2.sides) === 20 ? 'Combat Roll' : 'Action Roll'),
          note: (Number(spec2.sides) === 20 ? `Roll 1d20 (1–20) vs Target ${tgt}. Delta = Roll − Target.` : `Roll 3d6 (sum 3–18) vs Target ${tgt}. Delta = Roll − Target.`)
        });
      }
      return;
    }

    // AUTO roll + immediate resolve
    {
      const rollSpec = computeActionRollSpec(roomState, actor, text);
      const tgt = computeActionTarget(roomState, actor, text, rollSpec);
      const rollInfo = buildRollInfoFromSpec(rollSpec, tgt, "site");
      await resolveActionWithRoll({ roomId, socket, actor, text: String(text).trim(), rollInfo });
      return;
    }


    // Book should only track actual play, not intake/stat questionnaires.
    const modeNowForBook = String(getTokenValue(roomState.canon.tokens, 'mode') || '').trim().toUpperCase();
    const allowBook = modeNowForBook !== 'INTAKE' && modeNowForBook !== 'STATS';

    // Ensure the Book has an active Chapter/Scene scaffold.
    if (allowBook) ensureChapterOpen(roomId);

    // Book: store the player's declared action as a clean "choice" line.
    if (allowBook && BOOK_INCLUDE_ACTION_LINES) {
      let choiceLine = "";
      const bsMode = String(BOOKSCRIBE_MODE || "local").toLowerCase();
      if (bsMode === "llm") {
        try {
          choiceLine = await callLLMForBookLine({ roomId, actor, actionText: text });
        } catch {
          choiceLine = `${actor} acts: ${String(text).trim()}`;
        }
      } else if (bsMode === "off") {
        choiceLine = `${actor}: ${String(text).trim()}`;
      } else {
        choiceLine = localBookscribe(actor, text);
      }
      choiceLine = ensureSentencePunct(choiceLine);
      appendBookEntry(roomId, { kind: "choice", text: choiceLine, meta: { actor } });
    }

    io.to(roomId).emit("system", `${socket.data.name}: sent an action`);

    try {
      let from = String(normProvider(effectiveNarratorProvider()) || "LLM").toUpperCase();

      // Observable teammate activity for this actor (weaved into prose; never shown as a UI block).
      let observedItems = null;
      let observedMaxId = 0;
      try {
        const stObs = getRoomState(roomId);
        _ensureObsState(stObs);
        const kObs = _obsKey(actor);
        const cached = stObs?._turnDigestCache?.[kObs];
        if (cached && Array.isArray(cached.items) && cached.items.length) {
          observedItems = cached.items;
          observedMaxId = Math.max(0, Math.floor(Number(cached.maxId) || 0));
        }
      } catch {}

      // Unified pipeline: one model call for state + narration + choices.
      if (AI_PIPELINE === "unified") {
        const uni = await callLLMUnifiedTurn({ roomId, playerText: text, actorName: actor, actingPlayerId: String(socket.data.playerId || ""), observed_items: observedItems });
        let choices = Array.isArray(uni.choices) ? uni.choices : [];
        let narr = String(uni.narration || "").trim();
        narr = splitNarrationFromChoices(narr).narration || narr;
        narr = collapseMultiSceneText(narr);

        if (!choices.length) choices = Array.isArray(getRoomState(roomId).lastChoices) ? getRoomState(roomId).lastChoices : [];
        if (!choices.length) choices = [
          "Look around",
          "Talk to someone nearby",
          "Move cautiously forward",
          "Check your gear",
          "Freeform: (type your action)"
        ];
        const hasFreeform = choices.some(c => String(c||"").toLowerCase().startsWith("freeform"));
        if (!hasFreeform) choices.push("Freeform: (type your action)");

        const narration = `${collapseMultiSceneText(narr)}

CHOICES:
- ${choices.join("\n- ")}`;

        if (allowBook) {
          const clean = splitNarrationFromChoices(narration).narration;
          const bookClean = bookStripInteractivePrompts(stripLockedPrologue(clean));
          if (bookClean && !isPrologueOnlyText(bookClean)) appendBookEntry(roomId, { kind: "narration", text: (_sceneTruthFromText(bookClean) || bookClean) });
        }

        onBeatComplete(roomId, uni.canon_tokens);
        pushBeatSummary(roomId, uni.beat_summary);
        rollupSceneOnSceneAdvance(roomId);
        maybeSummarizeSceneAsync(roomId);
        saveRoomStateFile(roomId);

        await emitNarrationPerPlayer(roomId, {
          from,
          text: narration,
          pov: uni.pov || null,
          pov_char: null, // combined scene (no POV bundles)
          canon_tokens: uni.canon_tokens,
          beat_summary: uni.beat_summary,
          choices,
          book_meta: getRoomState(roomId).book?.meta || null
        });

        // Consume cached observable digest now that prose has been emitted.
        try {
          if (observedItems && observedMaxId) {
            const stNow = getRoomState(roomId);
            _ensureObsState(stNow);
            const kObs = _obsKey(actor);
            stNow._obsSeen[kObs] = Math.max(0, Math.floor(Number(observedMaxId) || 0));
            try { delete stNow._turnDigestCache[kObs]; } catch {}
            try { saveRoomStateFile(roomId); } catch {}
          }
        } catch {}

        // Record an observable action event so nearby teammates can react on their turns.
        try { recordObservableAction(roomId, { actorName: actor, actionText: text, beatSummary: uni.beat_summary }); } catch {}

      } else {
        const rulesResult = await callLLMForState({ roomId, playerText: text, actorName: actor });
        const narrOut = await callNarration({ roomId, playerText: text, rulesResult, actorName: actor });
        const narration = narrOut.text;
        from = narrOut.from;

        if (allowBook) {
          const clean = splitNarrationFromChoices(narration).narration;
          const bookClean = bookStripInteractivePrompts(stripLockedPrologue(clean));
          if (bookClean && !isPrologueOnlyText(bookClean)) appendBookEntry(roomId, { kind: "narration", text: (_sceneTruthFromText(bookClean) || bookClean) });
        }

        onBeatComplete(roomId, rulesResult.canon_tokens);
        pushBeatSummary(roomId, rulesResult.beat_summary);
        rollupSceneOnSceneAdvance(roomId);
        maybeSummarizeSceneAsync(roomId);
        saveRoomStateFile(roomId);

        await emitNarrationPerPlayer(roomId, {
          from,
          text: narration,
          canon_tokens: rulesResult.canon_tokens,
          beat_summary: rulesResult.beat_summary,
          choices: rulesResult.choices,
          book_meta: getRoomState(roomId).book?.meta || null
        });

        // Consume cached observable digest now that prose has been emitted.
        try {
          if (observedItems && observedMaxId) {
            const stNow = getRoomState(roomId);
            _ensureObsState(stNow);
            const kObs = _obsKey(actor);
            stNow._obsSeen[kObs] = Math.max(0, Math.floor(Number(observedMaxId) || 0));
            try { delete stNow._turnDigestCache[kObs]; } catch {}
            try { saveRoomStateFile(roomId); } catch {}
          }
        } catch {}

        // Record an observable action event so nearby teammates can react on their turns.
        try { recordObservableAction(roomId, { actorName: actor, actionText: text, beatSummary: rulesResult.beat_summary }); } catch {}
      }
} catch (err) {
      io.to(roomId).emit("error_msg", String(err?.message || err));
    emitAiError(roomId, err);
    }
  });

  // disconnect handler is defined earlier (includes host reassignment)
});

// -------------------- Static web path (Windows-safe) --------------------
const webDir = path.resolve(__dirname, "..", "web");
app.use((req, res, next) => {
  try {
    const p = String(req.path || '');
    if (req.method === 'GET' && (p === '/' || p.startsWith('/app/') || p.startsWith('/assets/') || p.endsWith('.js') || p.endsWith('.css') || p.endsWith('.html') || p.endsWith('.png') || p.endsWith('.json'))) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
    }
  } catch {}
  next();
});
app.use(express.static(webDir, { etag: false, lastModified: false }));
app.get("/", (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.sendFile(path.join(webDir, "index.html"));
});

// If the port is busy (or another fatal listen error occurs), fail loudly.
// This avoids the "server exited (code 0)" silent failure pattern.
try {
  server.on('error', (err) => {
    try { console.error('[AETHERYN] Server listen error:', String(err?.code || ''), String(err?.message || err)); } catch {}
    try { process.exit(1); } catch {}
  });
} catch {}

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`DEV_BUILD: ${DEV_BUILD ? 'ON' : 'off'} (dev console + AI trace)`);
  (async () => {
    try {
      const rulesProvider = getProviderForRole("rules");
      const narratorProvider = getProviderForRole("narrator");
      const bookProvider = getProviderForRole("book");

      const rulesModel = await getModelForRole("rules", rulesProvider);
      const narratorModel = await getModelForRole("narrator", narratorProvider);
      const bookModel = await getModelForRole("book", bookProvider);

      console.log(`LLM rules:    ${normProvider(rulesProvider)} :: ${rulesModel}`);
      console.log(`LLM narrator: ${normProvider(narratorProvider)} :: ${narratorModel}`);
      console.log(`LLM book:     ${normProvider(bookProvider)} :: ${bookModel}`);

      const usesOllama = [rulesProvider, narratorProvider, bookProvider].some(p => normProvider(p) === "ollama");
      if (usesOllama) {
        const tags = await fetchOllamaTagsCached();
        const reach = tags?.reachable ? "reachable" : "not reachable";
        const extra = tags?.models?.length ? ` (installed: ${tags.models.length})` : "";
        console.log(`Ollama URL: ${getOllamaUrl()}`);
        console.log(`Ollama status: ${reach}${extra}`);
      }
    } catch {}
  })();
  console.log(`Retrieval: K=${RETRIEVE_K} maxChunkChars=${MAX_CHUNK_CHARS}`);
});