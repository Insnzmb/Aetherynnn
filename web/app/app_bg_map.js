// -------------------- AETHERYN_BG_ENGINE --------------------
// Canvas-driven, subtle animated "world" backgrounds.
// No external assets; palettes are location-based and dark by design.
const bgCanvas = document.getElementById("bgCanvas");
let bgCtx = null;
let bgW = 0, bgH = 0;

const BG = {
  loc: "start",
  palettes: {
    start:    ["#05060a", "#070813", "#04040a", "rgba(122,162,255,.20)", "rgba(199,167,106,.16)"],
    forest:   ["#03110b", "#06140f", "#03070a", "rgba(90,255,190,.10)", "rgba(122,162,255,.10)"],
    ruins:    ["#070812", "#0a0b12", "#05060a", "rgba(199,167,106,.10)", "rgba(122,162,255,.10)"],
    desert:   ["#0b0710", "#0a0a12", "#04040a", "rgba(199,167,106,.14)", "rgba(122,162,255,.08)"],
    mountain: ["#05060a", "#070812", "#03040a", "rgba(122,162,255,.14)", "rgba(255,255,255,.06)"],
    aether:   ["#04050a", "#070818", "#03040a", "rgba(103,232,249,.14)", "rgba(122,162,255,.14)"],
  },
  particles: [],
  fog: [],
  t0: performance.now()
};

function bgResize() {
  if (!bgCanvas) return;
  bgW = bgCanvas.width = Math.floor(window.innerWidth * devicePixelRatio);
  bgH = bgCanvas.height = Math.floor(window.innerHeight * devicePixelRatio);
  bgCanvas.style.width = window.innerWidth + "px";
  bgCanvas.style.height = window.innerHeight + "px";
  bgCtx = bgCanvas.getContext("2d");
}
window.addEventListener("resize", bgResize);

function rand(min, max){ return min + Math.random()*(max-min); }

function bgSeed() {
  BG.particles = [];
  BG.fog = [];
  const count = Math.max(26, Math.min(54, Math.floor(window.innerWidth / 28)));
  for (let i=0;i<count;i++){
    BG.particles.push({
      x: rand(0,1), y: rand(0,1),
      r: rand(0.7, 2.1),
      a: rand(0.05, 0.18),
      s: rand(0.004, 0.016),
      drift: rand(-0.010, 0.010)
    });
  }
  for (let i=0;i<10;i++){
    BG.fog.push({
      x: rand(-0.2,1.2), y: rand(-0.2,1.2),
      r: rand(0.18, 0.46),
      a: rand(0.05, 0.12),
      vx: rand(-0.0018, 0.0018),
      vy: rand(-0.0012, 0.0012),
      phase: rand(0, Math.PI*2)
    });
  }
}

function bgSetLocation(locKey){
  const key = String(locKey || "start").toLowerCase();
  BG.loc = BG.palettes[key] ? key : "start";
}

function bgDraw(now){
  if (!bgCtx) return;

  // Performance guard: on non-host multiplayer clients (and reduce-motion),
  // render the background at a lower rate and skip expensive blur/fog.
  let perfLite = false;
  try {
    perfLite = document.body.classList.contains('perf-lite') || document.body.classList.contains('reduce-motion');
    if (document.hidden) perfLite = true;
  } catch {}

  try {
    if (perfLite) {
      BG._liteLast = BG._liteLast || 0;
      const minMs = 1000 / 15;
      if (now - BG._liteLast < minMs) {
        requestAnimationFrame(bgDraw);
        return;
      }
      BG._liteLast = now;
    }
  } catch {}

  const t = (now - BG.t0) / 1000;

  const [top, mid, bot, glow1, glow2] = BG.palettes[BG.loc] || BG.palettes.start;

  const g = bgCtx.createLinearGradient(0,0,0,bgH);
  g.addColorStop(0, top);
  g.addColorStop(0.55, mid);
  g.addColorStop(1, bot);
  bgCtx.fillStyle = g;
  bgCtx.fillRect(0,0,bgW,bgH);

  function glow(cx, cy, color, radiusPx){
    const rg = bgCtx.createRadialGradient(cx, cy, 0, cx, cy, radiusPx);
    rg.addColorStop(0, color);
    rg.addColorStop(1, "rgba(0,0,0,0)");
    bgCtx.fillStyle = rg;
    bgCtx.fillRect(0,0,bgW,bgH);
  }
  glow(bgW*0.18, bgH*0.22, glow1, Math.min(bgW,bgH)*0.55);
  glow(bgW*0.82, bgH*0.34, glow2, Math.min(bgW,bgH)*0.62);

  // Fog
  if (!perfLite) {
  bgCtx.save();
  bgCtx.globalCompositeOperation = "screen";
  bgCtx.filter = `blur(${Math.floor(24*devicePixelRatio)}px)`;
  for (const f of BG.fog){
    f.x += f.vx; f.y += f.vy;
    if (f.x < -0.3) f.x = 1.3;
    if (f.x > 1.3) f.x = -0.3;
    if (f.y < -0.3) f.y = 1.3;
    if (f.y > 1.3) f.y = -0.3;

    const wobble = 0.03*Math.sin(t*0.35 + f.phase);
    const cx = (f.x + wobble) * bgW;
    const cy = (f.y + wobble*0.6) * bgH;
    const rad = f.r * Math.min(bgW,bgH);
    const rg = bgCtx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    rg.addColorStop(0, `rgba(255,255,255,${f.a})`);
    rg.addColorStop(1, "rgba(255,255,255,0)");
    bgCtx.fillStyle = rg;
    bgCtx.fillRect(0,0,bgW,bgH);
  }
  bgCtx.restore();

  }

  // Particles
  bgCtx.save();
  bgCtx.globalCompositeOperation = perfLite ? "source-over" : "lighter";
  let _pCount = 0;
  for (const p of BG.particles){
    if (perfLite && _pCount++ > 12) break;
    p.y -= p.s;
    p.x += p.drift * 0.002;
    if (p.y < -0.05){ p.y = 1.05; p.x = rand(0,1); }
    const x = p.x * bgW;
    const y = p.y * bgH;
    const r = p.r * devicePixelRatio;
    bgCtx.beginPath();
    bgCtx.fillStyle = `rgba(255,255,255,${p.a})`;
    bgCtx.arc(x,y,r,0,Math.PI*2);
    bgCtx.fill();
  }
  bgCtx.restore();

  // Vignette
  const vg = bgCtx.createRadialGradient(bgW/2, bgH/2, Math.min(bgW,bgH)*0.25, bgW/2, bgH/2, Math.min(bgW,bgH)*0.62);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.74)");
  bgCtx.fillStyle = vg;
  bgCtx.fillRect(0,0,bgW,bgH);

  requestAnimationFrame(bgDraw);
}

(function initBg(){
  if (!bgCanvas) return;
  bgResize();
  bgSeed();
  requestAnimationFrame(bgDraw);
})();

function bgApplyFromTokens(tokens){
  const locTok = (tokens || []).find(t => t.startsWith("loc:"));
  const locRaw = locTok ? locTok.split(":")[1] : "START";
  const key = String(locRaw || "START").toLowerCase().replace(/[^a-z]/g,"");
  const map = {
    start:"start",
    forest:"forest",
    woods:"forest",
    grove:"forest",
    ruins:"ruins",
    cityruins:"ruins",
    desert:"desert",
    dunes:"desert",
    mountain:"mountain",
    peaks:"mountain",
    aether:"aether",
  };
  bgSetLocation(map[key] || "start");
}

// -------------------- MAP TRACKER (local, optional) --------------------
// You upload ANY map image (PNG/JPG/etc). While playing, the server emits canon tokens
// and we read the token "loc: ...". If you've pinned that location key, the red dot moves.
//
// Easiest workflow:
// 1) Upload a map.
// 2) When you reach a new place, click "Pin current location" and click that spot on the map.
// 3) Next time the party returns there, the dot auto-jumps.

const MAP_LIST_KEY = "aetheryn_map_list_v2";
const MAP_ACTIVE_KEY = "aetheryn_map_active_v1";
const MAP_LOC_INDEX_KEY = "aetheryn_map_loc_index_v1";

const MAP_META_KEY_BASE = "aetheryn_map_meta_v2";
const MAP_PINS_KEY_BASE = "aetheryn_map_pins_v1";
const MAP_SETTINGS_KEY_BASE = "aetheryn_map_settings_v1";
const MAP_TRAIL_KEY_BASE = "aetheryn_map_trail_v1";
const IDB_NAME = "aetheryn_assets_v1";
const IDB_STORE = "blobs";

let MAP = {
  activeMapId: "m1",
  mapList: [],
  currentLocRaw: "START",
  currentLocKey: "start",
  pinMode: false,
  meta: null, // { blobKey, filename, ts }
  pins: {},   // { [locKey]: { x, y, raw, ts, visitedTs? } }
  dest: null, // { type:'pin'|'free', x, y, raw?, locKey? }
  travel: null, // { from,to,start,animMs,distanceMiles,realHours,method,speedMph,desc }
  positionOverride: null, // { x,y, label }
  lastXY: null,
  trail: [], // [{x,y,label,ts}]
  settings: {
    // Fog-of-war is optional. Default OFF so the canon map doesn't look "broken" on first open.
    revealOnMove: false,
    revealRadiusPct: 2, // 2–16 (percent-ish)
    travelMode: true,
    autoSendTravel: false,

    // View (local): map zoom/pan
    zoom: 10,

    // Travel rules (UI helper; canon is still LOC token)
    travelMethod: 'walk',
    travelSpeedMph: 3,
    mapWidthMiles: 2800,
    allowTeleport: false
  },
  fogStore: null,  // offscreen canvas
  fogCtx: null,    // offscreen ctx
  fogDirty: false,
  fogSaveT: null,
  landMaskStore: null, // offscreen canvas (alpha=1 on land, 0 on water)
  landMaskCtx: null
};

function normalizeLocKey(raw){
  const s = String(raw || "start").trim().toLowerCase();
  const k = s.replace(/[^a-z0-9]+/g, "");
  return k || "start";
}

function hash32(str){
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0);
}

function mapSuggestXYForLocKey(locKey, baseXY){
  // Deterministic suggestion. If baseXY is provided (e.g., last known position),
  // keep the approx pin near it so narration-driven travel doesn't "teleport" the dot.
  const h = hash32(String(locKey || "start"));
  const ang = ((h >>> 0) / 0xffffffff) * Math.PI * 2;
  const rad = 0.03 + (((h >>> 16) & 0xff) / 255) * 0.03; // 0.03–0.06

  if (baseXY && Number.isFinite(baseXY.x) && Number.isFinite(baseXY.y)) {
    const x = clamp(baseXY.x + Math.cos(ang) * rad, 0.04, 0.96);
    const y = clamp(baseXY.y + Math.sin(ang) * rad, 0.04, 0.96);
    return { x, y };
  }

  // Fallback: stable spread across the map.
  const hx = (h & 0xffff);
  const hy = (h >>> 16) & 0xffff;
  const x = 0.12 + (hx / 65535) * 0.76;
  const y = 0.12 + (hy / 65535) * 0.76;
  return { x, y };
}

function mapSeedApproxPinIfMissing(locKey, locRaw, baseXY){
  try {
    if (!locKey) return;
    if (!MAP.pins) MAP.pins = {};
    if (MAP.pins[locKey]) return;
    const xy = mapSuggestXYForLocKey(locKey, baseXY);
    MAP.pins[locKey] = { x: xy.x, y: xy.y, raw: locRaw || locKey, ts: Date.now(), approx: true };
    saveMapPins();
  } catch {}
}


function migrateLegacySingleMapIfNeeded(defaultId){
  // v22_5 stored keys without map suffix; migrate once into the default map.
  const legacyMeta = lsGet(MAP_META_KEY_BASE);
  const legacyPins = lsGet(MAP_PINS_KEY_BASE);
  const legacySettings = lsGet(MAP_SETTINGS_KEY_BASE);
  const legacyTrail = lsGet(MAP_TRAIL_KEY_BASE);
  if (!legacyMeta && !legacyPins && !legacySettings && !legacyTrail) return;

  try {
    if (legacyMeta && !lsGet(mapKey(MAP_META_KEY_BASE, defaultId))) {
      localStorage.setItem(mapKey(MAP_META_KEY_BASE, defaultId), legacyMeta);
    }
    if (legacyPins && !lsGet(mapKey(MAP_PINS_KEY_BASE, defaultId))) {
      localStorage.setItem(mapKey(MAP_PINS_KEY_BASE, defaultId), legacyPins);
    }
    if (legacySettings && !lsGet(mapKey(MAP_SETTINGS_KEY_BASE, defaultId))) {
      localStorage.setItem(mapKey(MAP_SETTINGS_KEY_BASE, defaultId), legacySettings);
    }
    if (legacyTrail && !lsGet(mapKey(MAP_TRAIL_KEY_BASE, defaultId))) {
      localStorage.setItem(mapKey(MAP_TRAIL_KEY_BASE, defaultId), legacyTrail);
    }
  } catch {}

  try { if (legacyMeta) localStorage.removeItem(MAP_META_KEY_BASE); } catch {}
  try { if (legacyPins) localStorage.removeItem(MAP_PINS_KEY_BASE); } catch {}
  try { if (legacySettings) localStorage.removeItem(MAP_SETTINGS_KEY_BASE); } catch {}
  try { if (legacyTrail) localStorage.removeItem(MAP_TRAIL_KEY_BASE); } catch {}
}

function mapInitMultiMaps(){
  let list = loadMapList();
  let active = loadActiveMapId();

  if (!list || !list.length){
    const id = 'm1';
    list = [{ id, name: 'World' }];
    active = id;
    saveMapList(list);
    saveActiveMapId(active);
    try { migrateLegacySingleMapIfNeeded(id); } catch {}
  }

  // ensure active is valid
  if (!active || !list.some(m => m && m.id === active)){
    active = (list[0] && list[0].id) ? list[0].id : 'm1';
    saveActiveMapId(active);
  }

  MAP.mapList = list;
  MAP.activeMapId = active;

  mapRenderMapSelect();
}

function mapRenderMapSelect(){
  if (!mapSelect) return;
  mapSelect.innerHTML = '';
  const list = Array.isArray(MAP.mapList) ? MAP.mapList : [];
  for (const m of list){
    if (!m || !m.id) continue;
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.name || m.id;
    mapSelect.appendChild(opt);
  }
  mapSelect.value = MAP.activeMapId || (list[0] ? list[0].id : 'm1');
}

function mapGetMapName(id){
  const list = Array.isArray(MAP.mapList) ? MAP.mapList : [];
  const m = list.find(x => x && x.id === id);
  return m ? (m.name || m.id) : id;
}

function mapSetMapList(list){
  MAP.mapList = Array.isArray(list) ? list : [];
  saveMapList(MAP.mapList);
  mapRenderMapSelect();
}

function mapSwitchTo(id){
  if (!id || id === MAP.activeMapId) return;

  // Cancel travel/overrides when switching maps.
  MAP.travel = null;
  MAP.positionOverride = null;
  MAP.dest = null;
  MAP.pinMode = false;
  showEl(mapTravelProgress, false);

  MAP.activeMapId = id;
  saveActiveMapId(id);
  mapRenderMapSelect();

  // Load per-map state
  MAP.pins = loadMapPins();
  MAP.trail = loadMapTrail();
  const _ms = loadMapSettings();
  if (_ms) MAP.settings = { ...MAP.settings, ..._ms };
  MAP.meta = loadMapMeta();

  // Reset fog store; reloaded on image load
  MAP.fogStore = null;
  MAP.fogCtx = null;
  MAP.landMaskStore = null;
  MAP.landMaskCtx = null;

  mapApplySettingsToUI();
  mapLoadFromMeta().then(() => { try { mapUpdateDots(); } catch {} });
}

function mapCreateNewMap(){
  const nm = prompt('New map name:', 'Region');
  if (nm === null) return;
  const id = 'm' + Date.now().toString(16) + '_' + Math.random().toString(16).slice(2, 6);
  const list = Array.isArray(MAP.mapList) ? MAP.mapList.slice() : [];
  list.push({ id, name: String(nm || id).trim() || id });
  mapSetMapList(list);
  mapSwitchTo(id);
  // Encourage immediate upload
  try { mapFile?.click(); } catch {}
}

function mapRenameActiveMap(){
  const id = MAP.activeMapId;
  if (!id) return;
  const cur = mapGetMapName(id) || id;
  const nm = prompt('Rename map:', cur);
  if (nm === null) return;
  const list = (Array.isArray(MAP.mapList) ? MAP.mapList : []).map(m => {
    if (!m || m.id !== id) return m;
    return { ...m, name: String(nm || id).trim() || id };
  });
  mapSetMapList(list);
}

async function mapDeleteActiveMap(){
  const id = MAP.activeMapId;
  if (!id) return;
  const nm = mapGetMapName(id) || id;
  if (!confirm(`Delete map "${nm}"? This removes its image, fog, pins, and trail on THIS browser.`)) return;

  // Delete blobs for this map
  try {
    const metaRaw = lsGet(mapKey(MAP_META_KEY_BASE, id));
    const meta = metaRaw ? JSON.parse(metaRaw) : null;
    if (meta && meta.blobKey) { try { await idbDelBlob(meta.blobKey); } catch {} }
    if (meta && meta.fogBlobKey) { try { await idbDelBlob(meta.fogBlobKey); } catch {} }
  } catch {}

  // Remove local state
  try { localStorage.removeItem(mapKey(MAP_META_KEY_BASE, id)); } catch {}
  try { localStorage.removeItem(mapKey(MAP_PINS_KEY_BASE, id)); } catch {}
  try { localStorage.removeItem(mapKey(MAP_SETTINGS_KEY_BASE, id)); } catch {}
  try { localStorage.removeItem(mapKey(MAP_TRAIL_KEY_BASE, id)); } catch {}

  // Clean loc index
  try {
    const idx = loadLocIndex();
    for (const k of Object.keys(idx)) if (idx[k] === id) delete idx[k];
    saveLocIndex(idx);
  } catch {}

  // Remove from list and switch
  let list = (Array.isArray(MAP.mapList) ? MAP.mapList : []).filter(m => m && m.id !== id);
  if (!list.length) list = [{ id: 'm1', name: 'World' }];
  mapSetMapList(list);
  mapSwitchTo(list[0].id);
}
function loadMapPins(){
  try {
    const raw = lsGet(mapKey(MAP_PINS_KEY_BASE));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === "object") ? parsed : {};
  } catch {
    return {};
  }
}
function saveMapPins(){
  try { localStorage.setItem(mapKey(MAP_PINS_KEY_BASE), JSON.stringify(MAP.pins || {})); } catch {}
  try { mapUpdateLocIndexForActive(); } catch {}
}

function mapUpdateLocIndexForActive(){
  const idx = loadLocIndex();
  const id = MAP.activeMapId || 'm1';
  const pins = (MAP.pins && typeof MAP.pins === 'object') ? MAP.pins : {};

  // Remove stale entries that pointed at this map
  for (const k of Object.keys(idx)){
    if (idx[k] === id && !pins[k]) delete idx[k];
  }
  // Add/refresh entries for this map
  for (const k of Object.keys(pins)) idx[k] = id;

  saveLocIndex(idx);
}

function loadMapTrail(){
  try {
    const raw = lsGet(mapKey(MAP_TRAIL_KEY_BASE));
    if (!raw) return [];
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
function saveMapTrail(){
  try { localStorage.setItem(mapKey(MAP_TRAIL_KEY_BASE), JSON.stringify(MAP.trail || [])); } catch {}
}

function loadMapMeta(){
  try {
    const raw = lsGet(mapKey(MAP_META_KEY_BASE));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.blobKey ? parsed : null;
  } catch {
    return null;
  }
}
function saveMapMeta(){
  try {
    if (!MAP.meta) localStorage.removeItem(mapKey(MAP_META_KEY_BASE));
    else localStorage.setItem(mapKey(MAP_META_KEY_BASE), JSON.stringify(MAP.meta));
  } catch {}
}

function loadMapSettings(){
  try {
    const raw = lsGet(mapKey(MAP_SETTINGS_KEY_BASE));
    if (!raw) return null;
    const v = JSON.parse(raw);
    return (v && typeof v === 'object') ? v : null;
  } catch { return null; }
}
function saveMapSettings(){
  try { localStorage.setItem(mapKey(MAP_SETTINGS_KEY_BASE), JSON.stringify(MAP.settings || {})); } catch {}
}

function idbOpen(){
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) return reject(new Error("IndexedDB not available"));
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPutBlob(key, blob){
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(blob, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
async function idbGetBlob(key){
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => { const v = req.result; db.close(); resolve(v || null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}
async function idbDelBlob(key){
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

function mapHasImage(){
  return !!(MAP.meta && mapImg && mapImg.src);
}
function showEl(el, on){ if (!el) return; el.classList.toggle("hidden", !on); }

function mapSetDot(dotEl, imgEl, pin){
  if (!dotEl || !imgEl || !pin) return;
  const w = imgEl.clientWidth || 0;
  const h = imgEl.clientHeight || 0;
  if (!w || !h) return;
  dotEl.style.left = (pin.x * w) + "px";
  dotEl.style.top  = (pin.y * h) + "px";

  // Keep markers readable at high zoom (map image scales, markers inverse-scale).
  try {
    const z = clamp(Number(MAP?.settings?.zoom || 10), 1, 16);
    if (z > 1.01) {
      dotEl.style.transform = `translate(-50%, -50%) scale(${(1 / z).toFixed(4)})`;
      dotEl.style.animation = 'none';
    } else {
      dotEl.style.transform = 'translate(-50%, -50%)';
      dotEl.style.animation = '';
    }
  } catch {}

  showEl(dotEl, true);

}


function mapEnsureLandMask(){
  // Build a land-only alpha mask from the active map image.
  // Result: white pixels (alpha 1) = land, transparent = water.
  // This lets fog-of-war ignore the ocean automatically.
  if (!mapImg || !mapImg.src) return;
  if (!MAP.fogStore) return;

  const w = MAP.fogStore.width;
  const h = MAP.fogStore.height;
  if (!w || !h) return;
  if (MAP.landMaskStore && MAP.landMaskStore.width === w && MAP.landMaskStore.height === h) return;

  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  try { ctx.drawImage(mapImg, 0, 0, w, h); } catch { return; }

  let img;
  try { img = ctx.getImageData(0, 0, w, h); } catch { return; }
  const d = img.data;

  // Heuristic water detection tuned for Aetheryn-style maps:
  // water tends to be blue/cyan with non-trivial saturation.
  for (let i = 0; i < d.length; i += 4){
    const r = d[i], g = d[i+1], b = d[i+2];
    const max = r > g ? (r > b ? r : b) : (g > b ? g : b);
    const min = r < g ? (r < b ? r : b) : (g < b ? g : b);
    const sat = max ? (max - min) / max : 0;

    const blueish = (b > r + 25) && (b > g + 15) && (b > 70);
    const cyanish = (g > r + 20) && (b > r + 40) && (b > 80);
    const watery = (sat > 0.10) && (blueish || cyanish);

    if (watery) {
      d[i] = 0; d[i+1] = 0; d[i+2] = 0; d[i+3] = 0;
    } else {
      d[i] = 255; d[i+1] = 255; d[i+2] = 255; d[i+3] = 255;
    }
  }

  try { ctx.putImageData(img, 0, 0); } catch {}

  MAP.landMaskStore = c;
  MAP.landMaskCtx = ctx;
}

function mapApplyLandMaskToFog(){
  if (!MAP.fogCtx || !MAP.fogStore || !MAP.landMaskStore) return;
  try {
    MAP.fogCtx.save();
    MAP.fogCtx.globalCompositeOperation = 'destination-in';
    MAP.fogCtx.drawImage(MAP.landMaskStore, 0, 0, MAP.fogStore.width, MAP.fogStore.height);
    MAP.fogCtx.restore();
    MAP.fogCtx.globalCompositeOperation = 'source-over';
  } catch {}
}

function mapEnsureFogStore(){
  if (!mapImg || !mapImg.src) return;
  const nw = mapImg.naturalWidth || 0;
  const nh = mapImg.naturalHeight || 0;
  if (!nw || !nh) return;

  if (!MAP.meta) MAP.meta = { blobKey: null, filename: "map", ts: Date.now() };

  let w = Number(MAP.meta.fogW || 0);
  let h = Number(MAP.meta.fogH || 0);
  if (!w || !h){
    const max = 1800;
    const scale = Math.min(1, max / Math.max(nw, nh));
    w = Math.max(512, Math.round(nw * scale));
    h = Math.max(512, Math.round(nh * scale));
    MAP.meta.fogW = w;
    MAP.meta.fogH = h;
    saveMapMeta();
  }

  if (MAP.fogStore && MAP.fogStore.width === w && MAP.fogStore.height === h && MAP.fogCtx) return;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  MAP.fogStore = c;
  MAP.fogCtx = ctx;
  try {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0,0,0,0.94)';
    ctx.fillRect(0, 0, w, h);
  } catch {}

  // Land-only fog (ocean stays visible)
  try { mapEnsureLandMask(); } catch {}
  try { mapApplyLandMaskToFog(); } catch {}
}

async function mapLoadFogFromMeta(){
  if (!mapImg || !mapImg.src) return;
  mapEnsureFogStore();
  if (!MAP.fogCtx || !MAP.fogStore) return;

  // default: fully covered
  MAP.fogCtx.globalCompositeOperation = 'source-over';
  MAP.fogCtx.fillStyle = 'rgba(0,0,0,0.94)';
  MAP.fogCtx.fillRect(0, 0, MAP.fogStore.width, MAP.fogStore.height);

  try { mapEnsureLandMask(); } catch {}
  try { mapApplyLandMaskToFog(); } catch {}

  const fogKey = MAP.meta && MAP.meta.fogBlobKey;
  if (fogKey){
    try {
      const blob = await idbGetBlob(fogKey);
      if (blob){
        const url = URL.createObjectURL(blob);
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Fog load failed'));
          img.src = url;
        });
        URL.revokeObjectURL(url);
        MAP.fogCtx.globalCompositeOperation = 'source-over';
        MAP.fogCtx.drawImage(img, 0, 0, MAP.fogStore.width, MAP.fogStore.height);
        try { mapEnsureLandMask(); } catch {}
        try { mapApplyLandMaskToFog(); } catch {}
      }
    } catch {}
  }

  mapRenderFog();
}

function mapRenderFog(){
  const has = !!(mapImg && mapImg.src);
  const showFog = has && !!MAP.settings.revealOnMove;
  showEl(mapFog, showFog);
  showEl(mapMiniFog, showFog);
  if (!showFog || !MAP.fogStore) return;

  const drawScaled = (canvasEl, imgEl) => {
    if (!canvasEl || !imgEl) return;
    const w = imgEl.clientWidth || 0;
    const h = imgEl.clientHeight || 0;
    if (!w || !h) return;
    canvasEl.width = Math.round(w);
    canvasEl.height = Math.round(h);
    const ctx = canvasEl.getContext('2d');
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    ctx.drawImage(MAP.fogStore, 0, 0, canvasEl.width, canvasEl.height);
  };

  drawScaled(mapFog, mapImg);
  drawScaled(mapMiniFog, mapMiniImg);
}

function mapMarkFogDirty(){
  MAP.fogDirty = true;
  if (MAP.fogSaveT) clearTimeout(MAP.fogSaveT);
  MAP.fogSaveT = setTimeout(() => { mapSaveFog().catch(()=>{}); }, 900);
}

async function mapSaveFog(){
  if (!MAP.fogDirty) return;
  if (!MAP.meta || !MAP.fogStore) return;

  MAP.fogDirty = false;
  const blob = await new Promise((resolve) => {
    try { MAP.fogStore.toBlob(resolve, 'image/png'); }
    catch { resolve(null); }
  });
  if (!blob) return;

  const newKey = 'fog_' + Date.now().toString(16) + '_' + Math.random().toString(16).slice(2);
  await idbPutBlob(newKey, blob);

  // cleanup old fog blob
  if (MAP.meta.fogBlobKey && MAP.meta.fogBlobKey !== newKey){
    try { await idbDelBlob(MAP.meta.fogBlobKey); } catch {}
  }

  MAP.meta.fogBlobKey = newKey;
  MAP.meta.fogW = MAP.fogStore.width;
  MAP.meta.fogH = MAP.fogStore.height;
  saveMapMeta();
}

function mapRevealAt(xn, yn){
  mapEnsureFogStore();
  if (!MAP.fogCtx || !MAP.fogStore) return;
  const r = Math.max(8, Math.round(Math.min(MAP.fogStore.width, MAP.fogStore.height) * (Number(MAP.settings.revealRadiusPct || 2) / 100)));
  const x = xn * MAP.fogStore.width;
  const y = yn * MAP.fogStore.height;

  MAP.fogCtx.save();
  MAP.fogCtx.globalCompositeOperation = 'destination-out';
  MAP.fogCtx.beginPath();
  MAP.fogCtx.arc(x, y, r, 0, Math.PI * 2);
  MAP.fogCtx.fill();
  MAP.fogCtx.restore();

  mapMarkFogDirty();
  mapRenderFog();
}

function mapRevealPath(a, b){
  if (!a || !b) return;
  mapEnsureFogStore();
  if (!MAP.fogCtx || !MAP.fogStore) return;

  const r = Math.max(8, Math.round(Math.min(MAP.fogStore.width, MAP.fogStore.height) * (Number(MAP.settings.revealRadiusPct || 2) / 100)));
  const x0 = a.x * MAP.fogStore.width;
  const y0 = a.y * MAP.fogStore.height;
  const x1 = b.x * MAP.fogStore.width;
  const y1 = b.y * MAP.fogStore.height;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const step = Math.max(6, r * 0.7);
  const n = Math.max(1, Math.ceil(dist / step));

  MAP.fogCtx.save();
  MAP.fogCtx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i <= n; i++){
    const t = i / n;
    const x = x0 + dx * t;
    const y = y0 + dy * t;
    MAP.fogCtx.beginPath();
    MAP.fogCtx.arc(x, y, r, 0, Math.PI * 2);
    MAP.fogCtx.fill();
  }
  MAP.fogCtx.restore();

  mapMarkFogDirty();
  mapRenderFog();
}

function mapResetFog(){
  mapEnsureFogStore();
  if (!MAP.fogCtx || !MAP.fogStore) return;
  MAP.fogCtx.globalCompositeOperation = 'source-over';
  MAP.fogCtx.fillStyle = 'rgba(0,0,0,0.94)';
  MAP.fogCtx.fillRect(0, 0, MAP.fogStore.width, MAP.fogStore.height);
  try { mapEnsureLandMask(); } catch {}
  try { mapApplyLandMaskToFog(); } catch {}
  mapMarkFogDirty();
  mapRenderFog();
}

function mapTrailPush(pt){
  if (!pt) return;
  const last = (MAP.trail && MAP.trail.length) ? MAP.trail[MAP.trail.length - 1] : null;
  const farEnough = !last || (Math.hypot((pt.x - last.x), (pt.y - last.y)) > 0.01);
  if (!farEnough) return;
  MAP.trail.push({ x: pt.x, y: pt.y, label: pt.label || '', ts: Date.now() });
  if (MAP.trail.length > 220) MAP.trail = MAP.trail.slice(MAP.trail.length - 220);
  saveMapTrail();
}



function mapClampPan(panX, panY, zoom){
  try {
    const z = clamp(Number(zoom || 1), 1, 16);
    const vw = mapFrame ? (mapFrame.clientWidth || 0) : 0;
    const vh = mapFrame ? (mapFrame.clientHeight || 0) : 0;
    const bw = mapImg ? (mapImg.clientWidth || 0) : 0;
    const bh = mapImg ? (mapImg.clientHeight || 0) : 0;
    if (!vw || !vh || !bw || !bh) return { panX, panY };

    const sw = bw * z;
    const sh = bh * z;

    // When zoomed in, keep the scaled map covering the viewport (no empty gaps).
    const minX = Math.min(0, vw - sw);
    const maxX = 0;
    const minY = Math.min(0, vh - sh);
    const maxY = 0;

    return { panX: clamp(panX, minX, maxX), panY: clamp(panY, minY, maxY) };
  } catch {
    return { panX, panY };
  }
}

function mapApplyViewTransform(centerPos){
  if (!mapInner) return;
  const has = mapHasImage();
  if (!has) { try { mapInner.style.transform = ""; } catch {} ; return; }

  const z = clamp(Number(MAP.settings.zoom || 10), 1, 16);

  // Auto-center on current party position whenever we update dots.
  let panX = 0, panY = 0;
  try {
    if (centerPos && Number.isFinite(centerPos.x) && Number.isFinite(centerPos.y) && mapFrame && mapImg) {
      const vw = mapFrame.clientWidth || 0;
      const vh = mapFrame.clientHeight || 0;
      const bw = mapImg.clientWidth || 0;
      const bh = mapImg.clientHeight || 0;
      if (vw && vh && bw && bh) {
        const cx = centerPos.x * bw;
        const cy = centerPos.y * bh;
        panX = (vw / 2) - (cx * z);
        panY = (vh / 2) - (cy * z);
      }
    }
  } catch {}

  const clamped = mapClampPan(panX, panY, z);
  panX = clamped.panX; panY = clamped.panY;

  try {
    if (z <= 1.01) mapInner.style.transform = "";
    else mapInner.style.transform = `translate(${Math.round(panX)}px, ${Math.round(panY)}px) scale(${z})`;
  } catch {}
}

function mapUpdateDots(){
  const has = mapHasImage();
  const pin = MAP.pins[MAP.currentLocKey];

  showEl(mapEmpty, !has);
  showEl(mapInner, has);
  showEl(mapImg, has);
  showEl(mapCanonOverlay, has);
  showEl(mapMiniEmpty, !has);
  showEl(mapMiniImg, has);
  showEl(mapPinsLayer, has);
  showEl(mapMiniPinsLayer, has);
  showEl(mapDest, has && !!MAP.dest);

  if (!has){
    showEl(mapDot, false);
    showEl(mapMiniDot, false);
    showEl(mapFog, false);
    showEl(mapMiniFog, false);
    if (mapMiniLoc) mapMiniLoc.textContent = MAP.currentLocRaw || "—";
    if (mapLocRawEl) mapLocRawEl.textContent = MAP.currentLocRaw || "—";
    if (mapLocKeyEl) mapLocKeyEl.textContent = MAP.currentLocKey || "—";
    if (mapVisitedChips) mapVisitedChips.innerHTML = "";
    mapUpdateTravelUI();
    return;
  }

  // fog + overlays
  mapEnsureFogStore();
  mapRenderFog();
  mapRenderPins();
  mapRenderVisitedChips();
  mapRenderDest();

  // Dot position priority:
  // 1) explicit UI override (exploration)
  // 2) pinned location (named places)
  // 3) server-authoritative continuous XY (works even for UNMAPPED)
  const pos = MAP.positionOverride || pin || MAP.serverXY || null;
  if (pos){
    mapSetDot(mapDot, mapImg, pos);
    mapSetDot(mapMiniDot, mapMiniImg, pos);
    if (mapHelp){
      if (MAP.travel) mapHelp.innerHTML = `Traveling by <b>${escapeHtml(MAP.travel.method || 'travel')}</b> (waiting for narration / LOC token).`;
      else if (MAP.positionOverride) mapHelp.innerHTML = `Tracking: <b>exploration</b> position (waiting for LOC token to catch up).`;
      else if (pin && pin.approx) mapHelp.innerHTML = `Tracking: <b>approx</b> for <b>${escapeHtml(MAP.currentLocRaw)}</b>. Click <b>Pin current location</b> to calibrate.`;
      else if (pin) mapHelp.innerHTML = `Tracking: pinned for <b>${escapeHtml(MAP.currentLocRaw)}</b>.`;
      else if (MAP.serverXY) mapHelp.innerHTML = `Tracking: <b>server position</b> (continuous XY). Pin named locations if you want stable markers.`;
    }
  } else {
    showEl(mapDot, false);
    showEl(mapMiniDot, false);
    if (mapHelp) mapHelp.innerHTML = `No pin yet for <b>${escapeHtml(MAP.currentLocRaw)}</b>. Click <b>Pin current location</b>, then click on the map.`;
  }

  if (mapMiniLoc) mapMiniLoc.textContent = MAP.currentLocRaw || "—";
  if (mapLocRawEl) mapLocRawEl.textContent = MAP.currentLocRaw || "—";
  if (mapLocKeyEl) mapLocKeyEl.textContent = MAP.currentLocKey || "—";
  mapUpdateTravelUI();
  try { mapApplyViewTransform(pos); } catch {}
}

function mapSetPinFromClick(ev, imgEl){
  if (!imgEl) return null;
  const rect = imgEl.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const x = (ev.clientX - rect.left) / rect.width;
  const y = (ev.clientY - rect.top) / rect.height;
  return { x: clamp(x, 0, 1), y: clamp(y, 0, 1) };
}

function mapRenderPins(){
  const has = mapHasImage();
  if (!has || !mapPinsLayer || !mapMiniPinsLayer || !mapImg) return;

  const w = mapImg.clientWidth || 0;
  const h = mapImg.clientHeight || 0;
  if (!w || !h) return;

  const clearLayer = (layer) => { while (layer.firstChild) layer.removeChild(layer.firstChild); };
  clearLayer(mapPinsLayer);
  clearLayer(mapMiniPinsLayer);

  const makePin = (layer, pin, key, kind) => {
    const el = document.createElement('div');
    const approxCls = (kind === 'pin' && pin.approx) ? ' approx' : '';
    el.className = 'mapPin' + approxCls + (kind === 'trail' ? ' trail visited' : (pin.visitedTs ? ' visited' : ' unvisited'));
    try {
      const z = clamp(Number(MAP?.settings?.zoom || 10), 1, 16);
      if (z > 1.01) el.style.transform = `translate(-50%, -50%) scale(${(1 / z).toFixed(4)})`;
    } catch {}
    el.style.left = (pin.x * w) + 'px';
    el.style.top = (pin.y * h) + 'px';
    el.title = pin.raw || pin.label || key;
    el.dataset.kind = kind;
    el.dataset.key = key;
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (!MAP.settings.travelMode) return;
      if (kind === 'pin') mapSetDest({ type: 'pin', x: pin.x, y: pin.y, raw: pin.raw || key, locKey: key });
      if (kind === 'trail') mapSetDest({ type: 'free', x: pin.x, y: pin.y, raw: pin.label || 'Wilderness', locKey: null });
      if (MAP.settings.autoSendTravel) mapDoTravel();
    });
    layer.appendChild(el);
  };

  // Named pins
  const entries = Object.entries(MAP.pins || {});
  for (const [k, p] of entries){
    if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') continue;
    makePin(mapPinsLayer, p, k, 'pin');
  }

  // Breadcrumb trail (mostly wilderness clicks)
  const trail = Array.isArray(MAP.trail) ? MAP.trail : [];
  const tail = trail.slice(Math.max(0, trail.length - 90));
  for (let i = 0; i < tail.length; i++){
    const t = tail[i];
    if (!t) continue;
    makePin(mapPinsLayer, { x: t.x, y: t.y, label: t.label }, String(i), 'trail');
  }

  // Mini pins (keep it light)
  const miniW = mapMiniImg ? (mapMiniImg.clientWidth || 0) : 0;
  const miniH = mapMiniImg ? (mapMiniImg.clientHeight || 0) : 0;
  if (mapMiniImg && miniW && miniH){
    const miniMake = (layer, pin, key) => {
      const el = document.createElement('div');
      el.className = 'mapPin visited';
      el.style.left = (pin.x * miniW) + 'px';
      el.style.top = (pin.y * miniH) + 'px';
      el.style.width = '8px';
      el.style.height = '8px';
      el.style.opacity = '.75';
      el.title = pin.raw || key;
      el.style.pointerEvents = 'none';
      layer.appendChild(el);
    };
    const visitedPins = entries.filter(([k,p]) => p && p.visitedTs).slice(0, 18);
    for (const [k,p] of visitedPins) miniMake(mapMiniPinsLayer, p, k);
  }
}

function mapRenderVisitedChips(){
  if (!mapVisitedChips) return;
  mapVisitedChips.innerHTML = "";
  const pins = Object.entries(MAP.pins || {})
    .map(([k,p]) => ({ k, p }))
    .filter(x => x.p && x.p.visitedTs)
    .sort((a,b) => (b.p.visitedTs || 0) - (a.p.visitedTs || 0))
    .slice(0, 10);
  for (const it of pins){
    const btn = document.createElement('button');
    btn.className = 'mapChip';
    btn.textContent = it.p.raw || it.k;
    btn.title = 'Click to travel';
    btn.addEventListener('click', () => {
      if (!MAP.settings.travelMode) return;
      mapSetDest({ type: 'pin', x: it.p.x, y: it.p.y, raw: it.p.raw || it.k, locKey: it.k });
      if (MAP.settings.autoSendTravel) mapDoTravel();
      else openMapModal();
    });
    mapVisitedChips.appendChild(btn);
  }
}

function mapRenderDest(){
  if (!mapDest || !mapImg || !MAP.dest) { showEl(mapDest, false); return; }
  const w = mapImg.clientWidth || 0;
  const h = mapImg.clientHeight || 0;
  if (!w || !h) return;
  mapDest.style.left = (MAP.dest.x * w) + 'px';
  mapDest.style.top = (MAP.dest.y * h) + 'px';
  try {
    const z = clamp(Number(MAP?.settings?.zoom || 10), 1, 16);
    if (z > 1.01) mapDest.style.transform = `translate(-50%, -50%) scale(${(1 / z).toFixed(4)})`;
    else mapDest.style.transform = 'translate(-50%, -50%)';
  } catch {}
  showEl(mapDest, true);
}

function mapSetDest(dest){
  MAP.dest = dest;
  mapRenderDest();
  mapUpdateTravelUI();
}

function mapClearDest(){
  MAP.dest = null;
  showEl(mapDest, false);
  mapUpdateTravelUI();
}

function mapUpdateTravelUI(){
  const traveling = !!MAP.travel;
  const hasDest = !!MAP.dest;

  if (mapTravelGoBtn) mapTravelGoBtn.disabled = traveling || !hasDest;
  if (mapTravelClearBtn) mapTravelClearBtn.disabled = traveling || !hasDest;

  if (mapTravelInfo){
    if (traveling){
      const tr = MAP.travel;
      mapTravelInfo.textContent = `Traveling by ${tr && tr.method ? tr.method : 'travel'}… (waiting for narration / LOC token).`;
    } else if (!hasDest){
      mapTravelInfo.textContent = MAP.settings.travelMode
        ? 'Click a visited marker (or anywhere on the map) to set a destination.'
        : 'Enable Click-to-travel to pick destinations on the map.';
    } else {
      if (MAP.dest.type === 'pin') mapTravelInfo.textContent = `Destination: ${MAP.dest.raw || 'Pinned location'}`;
      else mapTravelInfo.textContent = `Destination: wilderness point (${Math.round(MAP.dest.x*100)}%, ${Math.round(MAP.dest.y*100)}%)`;
    }
  }
}

function mapAspectRatioHW(){
  try {
    const w = Number(mapImg && mapImg.naturalWidth ? mapImg.naturalWidth : 0);
    const h = Number(mapImg && mapImg.naturalHeight ? mapImg.naturalHeight : 0);
    if (w > 0 && h > 0) return h / w;
  } catch {}
  return 1;
}

function mapDistanceMiles(from, to){
  const f = from || { x: 0.5, y: 0.5 };
  const t = to || { x: 0.5, y: 0.5 };
  const wMiles = Number(MAP.settings.mapWidthMiles || 2800);
  const r = mapAspectRatioHW();
  const dx = (t.x - f.x) * wMiles;
  const dy = (t.y - f.y) * wMiles * r;
  const d = Math.hypot(dx, dy);
  return Number.isFinite(d) ? d : 0;
}

function mapFormatEta(hours){
  const h = Number(hours);
  if (!Number.isFinite(h) || h <= 0) return '0';

  // Canon travel framing: "hours" is movement-hours, not 24h/day.
  // We assume ~8 hours of meaningful travel per day (rest, camp, weather, delays).
  const H_PER_DAY = 8;

  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < H_PER_DAY) return `${h.toFixed(1)} hr`;

  const d = h / H_PER_DAY;
  if (d < 14) return `${d.toFixed(1)} days`;
  const w = d / 7;
  if (w < 10) return `${w.toFixed(1)} weeks`;
  const mo = w / 4.345;
  return `${mo.toFixed(1)} months`;
}

function mapGetCurrentXY(){
  const pin = MAP.pins && MAP.currentLocKey ? MAP.pins[MAP.currentLocKey] : null;
  return MAP.positionOverride || pin || MAP.lastXY || { x: 0.5, y: 0.5 };
}

function mapBuildTravelMessage(dest){
  if (!dest) return '';

  const fromRaw0 = MAP.currentLocRaw || 'UNMAPPED';
  const fromRaw = (/^(start|unmapped|unknown|\?|—)$/i.test(String(fromRaw0||'').trim())) ? 'an unknown place' : fromRaw0;
  const from = mapGetCurrentXY();
  const to = { x: dest.x, y: dest.y };
  const method = String(MAP.settings.travelMethod || 'walk');
  const speed = Number(MAP.settings.travelSpeedMph || mapDefaultSpeed(method));
  const allowTp = !!MAP.settings.allowTeleport;

  const miles = mapDistanceMiles(from, to);
  const hours = (method === 'teleport') ? 0 : (speed > 0 ? (miles / speed) : 0);
  const eta = mapFormatEta(hours);

  const methodLine = (method === 'teleport')
    ? (allowTp ? 'Teleport (if the party can)' : 'Walk (teleport not allowed)')
    : `${method} ~${speed.toFixed(1)} mph`;

  const mapName = mapGetMapName(MAP.activeMapId || 'm1');

  if (dest.type === 'pin'){
    return [
      `TRAVEL (UI-click): Depart from ${fromRaw} → ${dest.raw}.`,
      `Method: ${methodLine}. Distance: ~${miles.toFixed(1)} miles. Time passes: ~${eta}.`,
      `Narrate the journey and arrival. (Code updates time + LOC; do not change clock/day unless the story demands it.)`
    ].join(' ');
  }

  return [
    `TRAVEL (UI-click): Leave ${fromRaw} and push into the wilderness on map "${mapName}" toward the marked destination.`,
    `Method: ${methodLine}. Distance: ~${miles.toFixed(1)} miles. Time passes: ~${eta}.`,
    `Treat this as exploration: hazards, landmarks, discovery. (Code updates time + position. Do NOT reveal map coordinates/percentages in narration. LOC can remain unknown until discovered/named.)`
  ].join(' ');
}

function mapShowTravelProgress(on){
  showEl(mapTravelProgress, !!on);
  if (!on){
    if (mapTravelProgressFill) mapTravelProgressFill.style.width = '0%';
    if (mapTravelProgressText) mapTravelProgressText.textContent = '—';
  }
}

function mapUpdateTravelProgressUI(frac){
  if (!MAP.travel) return;
  const tr = MAP.travel;
  if (mapTravelProgressFill) mapTravelProgressFill.style.width = `${Math.round(frac * 100)}%`;
  if (mapTravelProgressText){
    const eta = mapFormatEta(tr.realHours);
    mapTravelProgressText.textContent = `Traveling (${Math.round(frac*100)}%) • ~${tr.distanceMiles.toFixed(1)} mi • ~${eta}`;
  }
}

function mapUpdateDotOnly(pos){
  const has = mapHasImage();
  if (!has || !pos) return;
  mapSetDot(mapDot, mapImg, pos);
  mapSetDot(mapMiniDot, mapMiniImg, pos);
}

function mapFinishTravel(){
  const tr = MAP.travel;
  if (!tr) return;

  const finalPos = { x: tr.to.x, y: tr.to.y, label: tr.to.label || tr.to.raw || 'Wilderness' };
  MAP.positionOverride = finalPos;
  MAP.lastXY = { x: finalPos.x, y: finalPos.y };
  mapTrailPush({ x: finalPos.x, y: finalPos.y, label: finalPos.label });

  MAP.travel = null;
  mapUpdateTravelProgressUI(1);
  setTimeout(() => { if (!MAP.travel) mapShowTravelProgress(false); }, 1200);

  // Full refresh so chips/pins/etc stay consistent.
  mapUpdateDots();
}

function mapTravelTick(){
  const tr = MAP.travel;
  if (!tr) return;
  const now = performance.now();
  const t = tr.animMs > 0 ? clamp((now - tr.start) / tr.animMs, 0, 1) : 1;

  const x = tr.from.x + (tr.to.x - tr.from.x) * t;
  const y = tr.from.y + (tr.to.y - tr.from.y) * t;
  const pos = { x, y, label: tr.to.label || tr.to.raw || 'Wilderness' };

  // Reveal in bursts so we don't redraw constantly.
  if (MAP.settings.revealOnMove){
    if (!tr._lastReveal) tr._lastReveal = { x: tr.from.x, y: tr.from.y };
    if (!tr._lastRevealTs || (now - tr._lastRevealTs) > 120){
      mapRevealPath(tr._lastReveal, pos);
      mapRevealAt(pos.x, pos.y);
      tr._lastReveal = { x: pos.x, y: pos.y };
      tr._lastRevealTs = now;
    }
  }

  MAP.positionOverride = pos;
  MAP.lastXY = { x: pos.x, y: pos.y };
  mapUpdateDotOnly(pos);
  mapUpdateTravelProgressUI(t);

  if (t < 1){
    requestAnimationFrame(mapTravelTick);
  } else {
    mapFinishTravel();
  }
}

function mapStartTravel(dest){
  if (!dest) return;

  // Cancel any previous travel.
  MAP.travel = null;

  const from = mapGetCurrentXY();
  const to = { x: dest.x, y: dest.y, raw: dest.raw, label: dest.raw || 'Wilderness' };

  let method = String(MAP.settings.travelMethod || 'walk');
  if (method === 'teleport' && !MAP.settings.allowTeleport) method = 'walk';

  const speed = Number(MAP.settings.travelSpeedMph || mapDefaultSpeed(method));
  const miles = mapDistanceMiles(from, to);
  const hours = (method === 'teleport') ? 0 : (speed > 0 ? (miles / speed) : 0);

  // Animation is a UI convenience; canon travel time is in the message.
  const animMs = (method === 'teleport') ? 800 : clamp((miles / 25) * 1000, 1200, 18000);

  MAP.travel = {
    from: { x: from.x, y: from.y },
    to: { x: to.x, y: to.y, raw: to.raw, label: to.label },
    start: performance.now(),
    animMs,
    distanceMiles: miles,
    realHours: hours,
    method,
    speedMph: speed,
    destType: dest.type
  };

  mapShowTravelProgress(true);
  mapUpdateTravelProgressUI(0);
  mapTravelTick();
}

function mapCancelTravel(){
  if (!MAP.travel){
    mapShowTravelProgress(false);
    return;
  }
  MAP.travel = null;
  MAP.positionOverride = null;
  mapShowTravelProgress(false);
  mapUpdateDots();
}

function mapDoTravel(){
  if (!MAP.dest) return;

  // Require an active socket/room. Travel is server-authoritative.
  if (!socket || !joined){
    addMsg({ who: "SYSTEM", tag: "MAP", text: "Join a room first. Map travel is server-authoritative." });
    return;
  }

  const dest = MAP.dest;
  const method = String(MAP.settings.travelMethod || (mapTravelMethodSel ? mapTravelMethodSel.value : 'walk') || 'walk');
  const mph = Number(MAP.settings.travelSpeedMph || mapDefaultSpeed(method));

  // Mark travel as pending so mapApplyFromTokens can bind the next LOC to this coordinate.
  MAP.travel = {
    pending: true,
    method,
    requestedAt: Date.now(),
    destType: dest.type,
    requestedDest: { x: dest.x, y: dest.y, raw: dest.raw || '', locKey: dest.locKey || null }
  };

  mapShowTravelProgress(true);
  if (mapTravelProgressFill) mapTravelProgressFill.style.width = '0%';
  if (mapTravelProgressText) mapTravelProgressText.textContent = 'Travel requested — awaiting server.';

  // Ask server to apply travel (time + LOC + XY handled by code).
  try {
    socket.emit("travel:request", {
      dest: { x: dest.x, y: dest.y },
      method,
      mph,
      destType: dest.type,
      destRaw: dest.raw || ''
    });
  } catch {}

  // Optional narration helper (kept as a convenience, not a requirement).
  const msg = mapBuildTravelMessage(dest);
  if (msg){
    if (MAP.settings.autoSendTravel) sendText(msg);
    else {
      if (inputEl) inputEl.value = msg;
      inputEl?.focus();
    }
  }

  mapClearDest();
}

function mapEnterPinMode(){
  MAP.pinMode = true;
  if (mapHelp) mapHelp.innerHTML = `Pinning mode: click the map to place <b>${escapeHtml(MAP.currentLocRaw)}</b>.`;
  if (mapSub) mapSub.textContent = "Pinning mode is ON — click the map to place the dot.";
}
function mapExitPinMode(){
  MAP.pinMode = false;
  if (mapSub) mapSub.textContent = "Pin your current location once per place. After that, the red dot auto-tracks from the LOC token. Fog is optional.";
}


function isPortalAllowedByTokens(tokens){
  const tks = Array.isArray(tokens) ? tokens.map(x=>String(x||"")) : [];
  return tks.some(x => /\bflag:(portal|teleport)\b/i.test(x) || /\btravel:(portal|teleport)\b/i.test(x) || /\bportal\b/i.test(x) || /\bwaygate\b/i.test(x));
}

function mapDefaultSpeed(method){
  const m = String(method || '').toLowerCase();
  if (m === 'horse') return 6;
  if (m === 'carriage') return 5;
  if (m === 'sail') return 4;
  if (m === 'climb') return 2;
  if (m === 'portal') return 999;
  return 3; // walk
}

function mapSyncTeleportOption(){ /* teleport checkbox removed; portal is a travel method if the world allows it */ }

function mapApplySettingsToUI(){
  // New minimal UI: a single Fog toggle.
  if (typeof mapFogToggle !== 'undefined' && mapFogToggle) mapFogToggle.checked = !!MAP.settings.revealOnMove;
  else if (mapRevealOnMoveChk) mapRevealOnMoveChk.checked = !!MAP.settings.revealOnMove;
  if (mapRevealRadiusRange) mapRevealRadiusRange.value = String(clamp(Number(MAP.settings.revealRadiusPct || 2), 2, 16));
  if (mapTravelModeChk) mapTravelModeChk.checked = !!MAP.settings.travelMode;
  if (mapAutoSendTravelChk) mapAutoSendTravelChk.checked = !!MAP.settings.autoSendTravel;

  if (mapAllowTeleportChk) mapAllowTeleportChk.checked = !!MAP.settings.allowTeleport;
  mapSyncTeleportOption();

  if (mapTravelMethodSel) mapTravelMethodSel.value = String(MAP.settings.travelMethod || 'walk');
  if (mapTravelSpeedInp) mapTravelSpeedInp.value = String(Number(MAP.settings.travelSpeedMph || mapDefaultSpeed(MAP.settings.travelMethod)));
  if (mapMapWidthMilesInp) mapMapWidthMilesInp.value = String(Number(MAP.settings.mapWidthMiles || 2800));


  // View: sync zoom UI + default to zoomed-in for travel scale
  try {
    const z = clamp(Number(MAP.settings.zoom || 10), 1, 16);
    if (mapZoomRange) mapZoomRange.value = String(z);
    if (mapZoomVal) mapZoomVal.textContent = `${z.toFixed(1)}×`;
  } catch {}
}


function mapReadSettingsFromUI(){
  // Fog is optional and local-only.
  if (typeof mapFogToggle !== 'undefined' && mapFogToggle) MAP.settings.revealOnMove = !!mapFogToggle.checked;
  else if (mapRevealOnMoveChk) MAP.settings.revealOnMove = !!mapRevealOnMoveChk.checked;
  MAP.settings.revealRadiusPct = clamp(Number(MAP.settings.revealRadiusPct || 2), 2, 16);

  // Map UI is minimal: travel is always enabled; only method is user-selectable.
  MAP.settings.travelMode = true;
  MAP.settings.autoSendTravel = false;

  const meth = mapTravelMethodSel ? String(mapTravelMethodSel.value || 'walk') : String(MAP.settings.travelMethod || 'walk');
  MAP.settings.travelMethod = meth;

  // Speed is derived from method; players cannot set it.
  MAP.settings.travelSpeedMph = mapDefaultSpeed(meth);

  // Keep map width internal (not user-controlled).
  MAP.settings.mapWidthMiles = clamp(Number(MAP.settings.mapWidthMiles || 2800), 500, 6000);

  // View: zoom is local-only, but persisted per-map (helps travel scale visibility).
  try {
    const z = mapZoomRange ? Number(mapZoomRange.value) : Number(MAP.settings.zoom || 10);
    MAP.settings.zoom = clamp(Number.isFinite(z) ? z : 10, 1, 16);
    if (mapZoomVal) mapZoomVal.textContent = `${Number(MAP.settings.zoom || 10).toFixed(1)}×`;
  } catch {}
}


function openMapModal(){
  setView('map');
  try { mapRenderMapSelect(); } catch {}
  try { mapApplySettingsToUI(); } catch {}

  // Default: zoom in for travel-scale readability unless the user explicitly changed it.
  try {
    if (!MAP.settings._zoomUserSet) {
      MAP.settings.zoom = 10;
      if (mapZoomRange) mapZoomRange.value = '10';
      if (mapZoomVal) mapZoomVal.textContent = '10.0×';
      saveMapSettings();
    }
  } catch {}

  try { mapReadSettingsFromUI(); } catch {}
  try { mapUpdateDots(); } catch {}
}
function closeMapModal(){
  mapExitPinMode();
  setView('play');
}

async function mapEnsureCanonMapLoaded(){
  // Store canon map in IDB once, then use it like an uploaded map (so fog persistence works)
  try {
    if (MAP.meta && MAP.meta.blobKey) return;
    const existing = loadMapMeta();

    // MIGRATE_OLD_CANON_MAP: force-refresh canon map + fog when the bundled map asset changes.
    if (existing && existing.name === "Aetheryn (Canon)" && (existing.blobKey === "canon_map_v2" || existing.blobKey === "canon_map_v1")) {
      try { await idbDelBlob(existing.blobKey); } catch {}
      if (existing.fogBlobKey) { try { await idbDelBlob(existing.fogBlobKey); } catch {} }
      MAP.meta = null;
      saveMapMeta();
    } else if (existing && existing.blobKey) {
      MAP.meta = existing;
      return;
    }

    const resp = await fetch(CANON_MAP_URL, { cache: "force-cache" });
    const blob = await resp.blob();
    const blobKey = "canon_map_v3";
    await idbPutBlob(blobKey, blob);
    // cleanup old canon blobs (safe no-ops if missing)
    try { await idbDelBlob("canon_map_v2"); } catch {}
    try { await idbDelBlob("canon_fog_v2"); } catch {}
    // fog key is separate so fog persists
    const fogBlobKey = "canon_fog_v3";
    MAP.meta = { blobKey, fogBlobKey, name: "Aetheryn (Canon)", createdAt: Date.now() };
    saveMapMeta();
  } catch (e) {
    // If fetch fails, we still render without meta (no fog persistence)
  }
}

async function mapLoadFromMeta(){
  MAP.meta = loadMapMeta();
  if (!MAP.meta || !MAP.meta.blobKey){
    await mapEnsureCanonMapLoaded();
  }
  if (MAP.meta && MAP.meta.blobKey){
    try {
      const blob = await idbGetBlob(MAP.meta.blobKey);
      if (blob){
        const url = URL.createObjectURL(blob);
        const isCanon = !!(MAP.meta && MAP.meta.name === "Aetheryn (Canon)");
        if (mapImg) mapImg.src = url;
        if (mapCanonOverlay) {
          if (isCanon) { mapCanonOverlay.src = CANON_OVERLAY_URL; mapCanonOverlay.classList.remove("hidden"); }
          else { mapCanonOverlay.removeAttribute("src"); mapCanonOverlay.classList.add("hidden"); }
        }
        if (mapMiniImg) mapMiniImg.src = url;
        setTimeout(() => { mapLoadFogFromMeta().catch(()=>{}); }, 0);
        return;
      }
    } catch {}
  }
  // Fallback (no IDB)
  try {
    if (mapImg) mapImg.src = CANON_MAP_URL;
    if (mapCanonOverlay) { mapCanonOverlay.src = CANON_OVERLAY_URL; mapCanonOverlay.classList.remove("hidden"); }
    if (mapMiniImg) mapMiniImg.src = CANON_MAP_URL;
    setTimeout(() => { mapLoadFogFromMeta().catch(()=>{}); }, 0);
  } catch {}
}


async function mapStoreUploadedFile(file){
  if (!file) return;
  try {
    const oldFog = MAP.meta && MAP.meta.fogBlobKey ? { fogBlobKey: MAP.meta.fogBlobKey, fogW: MAP.meta.fogW, fogH: MAP.meta.fogH } : null;
    const blobKey = "map_" + Date.now().toString(16) + "_" + Math.random().toString(16).slice(2);
    await idbPutBlob(blobKey, file);

    // cleanup old blob
    if (MAP.meta && MAP.meta.blobKey && MAP.meta.blobKey !== blobKey) {
      try { await idbDelBlob(MAP.meta.blobKey); } catch {}
    }

    MAP.meta = { blobKey, filename: file.name || "map", ts: Date.now(), ...(oldFog || {}) };
    saveMapMeta();

    const url = URL.createObjectURL(file);
    if (mapImg) mapImg.src = url;
    if (mapCanonOverlay) { mapCanonOverlay.removeAttribute("src"); mapCanonOverlay.classList.add("hidden"); }
    if (mapMiniImg) mapMiniImg.src = url;

    // Refresh fog overlay for the new map
    setTimeout(() => { mapLoadFogFromMeta().catch(()=>{}); }, 0);

  } catch (e) {
    addMsg({ who: "SYSTEM", tag: "MAP", text: "Map upload failed: " + String(e?.message || e), kind: "sys" });
  }
}

async function mapClearMap(){
  if (MAP.meta && MAP.meta.blobKey) {
    try { await idbDelBlob(MAP.meta.blobKey); } catch {}
  }
  if (MAP.meta && MAP.meta.fogBlobKey){
    try { await idbDelBlob(MAP.meta.fogBlobKey); } catch {}
  }
  MAP.meta = null;
  saveMapMeta();
  MAP.fogStore = null;
  MAP.fogCtx = null;
  if (mapImg) mapImg.removeAttribute("src");
  if (mapCanonOverlay) mapCanonOverlay.removeAttribute("src");
  if (mapMiniImg) mapMiniImg.removeAttribute("src");
  mapUpdateDots();
}

function mapRemoveCurrentPin(){
  const k = MAP.currentLocKey;
  if (!k) return;
  if (MAP.pins && MAP.pins[k]) {
    delete MAP.pins[k];
    saveMapPins();
    mapUpdateDots();
  }
}
function mapClearAllPins(){
  MAP.pins = {};
  saveMapPins();
  MAP.trail = [];
  saveMapTrail();
  MAP.positionOverride = null;
  MAP.dest = null;
  mapUpdateDots();
}

function mapExportPins(){
  try {
    const txt = JSON.stringify(MAP.pins || {}, null, 2);
    if (mapPinsText) mapPinsText.value = txt;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).catch(()=>{});
    }
    addMsg({ who: "SYSTEM", tag: "MAP", text: "Pins exported (copied to clipboard when allowed).", kind: "sys" });
  } catch {}
}
function mapImportPins(){
  const raw = (mapPinsText ? mapPinsText.value : "") || "";
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") throw new Error("Bad JSON");
    MAP.pins = parsed;
    saveMapPins();
    mapUpdateDots();
    addMsg({ who: "SYSTEM", tag: "MAP", text: "Pins imported.", kind: "sys" });
  } catch (e) {
    addMsg({ who: "SYSTEM", tag: "MAP", text: "Import failed: " + String(e?.message || e), kind: "sys" });
  }
}

function mapApplyFromTokens(tokens){
  const t = Array.isArray(tokens) ? tokens : [];

  // Previous position (for fog + trail)
  let prevPos = null;
  try { prevPos = mapGetCurrentXY(); } catch {}

  // LOC (label only; can be unknown)
  let locRaw = "";
  try { locRaw = tokenValue(t, ["loc"]); } catch {}
  if (!locRaw) {
    try { locRaw = tokenValue(t, ["world.location"]); } catch {}
  }
  locRaw = String(locRaw || "").trim() || "UNMAPPED";
  const locUp = String(locRaw || "").trim().toUpperCase();
  const locIsPlaceholder = (!locUp || locUp === "START" || locUp === "UNMAPPED" || locUp === "UNKNOWN" || locUp === "?" || locUp === "—");

  MAP.currentLocRaw = locRaw;
  MAP.currentLocKey = locIsPlaceholder ? "unmapped" : normalizeLocKey(locRaw);

  // XY (continuous position is authoritative for the map dot)
  let xyRaw = "";
  try { xyRaw = String(tokenValue(t, ["xy"]) || "").trim(); } catch {}
  let xy = null;
  if (xyRaw) {
    const parts = xyRaw.split(",").map(x => x.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const x = clamp(parseFloat(parts[0]), 0, 1);
      const y = clamp(parseFloat(parts[1]), 0, 1);
      if (Number.isFinite(x) && Number.isFinite(y)) xy = { x, y };
    }
  }

  if (xy) {
    MAP.serverXY = { x: xy.x, y: xy.y, label: (locIsPlaceholder ? "" : (MAP.currentLocRaw || "")) };
  } else {
    MAP.serverXY = null;
  }

  // Auto-switch maps when the current (named) LOC is pinned on another map.
  try {
    if (!locIsPlaceholder) {
      const idx = loadLocIndex();
      const mapped = idx && MAP.currentLocKey ? idx[MAP.currentLocKey] : null;
      if (mapped && mapped !== MAP.activeMapId) {
        mapSwitchTo(mapped);
        setTimeout(() => { try { mapApplyFromTokens(tokens); } catch {} }, 0);
        return;
      }
    }
  } catch {}

  // Pin-binding support for narration-driven travel:
  // If the player clicked a pin and the GM later updates LOC to that pin name, record its coordinate.
  try {
    if (!MAP.pins) MAP.pins = {};
    const pendingDest = (MAP.travel && MAP.travel.pending && MAP.travel.requestedDest) ? MAP.travel.requestedDest : null;
    const hasPendingPin = pendingDest && pendingDest.locKey && MAP.currentLocKey && pendingDest.locKey === MAP.currentLocKey;

    if (pendingDest && hasPendingPin && xy && MAP.currentLocKey) {
      const existing = MAP.pins[MAP.currentLocKey];
      if (!existing || existing.approx) {
        MAP.pins[MAP.currentLocKey] = {
          x: xy.x, y: xy.y,
          raw: MAP.currentLocRaw,
          ts: Date.now(),
          visitedTs: Date.now(),
          approx: false
        };
        saveMapPins();
      } else {
        existing.raw = MAP.currentLocRaw;
      }
    }

    // For named locations, keep a placeholder pin so visited markers can work.
    if (!locIsPlaceholder && MAP.currentLocKey) {
      if (!MAP.pins[MAP.currentLocKey]) {
        mapSeedApproxPinIfMissing(MAP.currentLocKey, MAP.currentLocRaw, (xy || prevPos || MAP.lastXY || null));
      } else {
        MAP.pins[MAP.currentLocKey].raw = MAP.currentLocRaw;
      }
    }
  } catch {}

  // Clear travel UI once server updates arrive.
  if (MAP.travel) {
    MAP.travel = null;
    showEl(mapTravelProgress, false);
  }
  if (MAP.positionOverride) MAP.positionOverride = null;

  // Fog-of-war reveal is driven by movement, not by LOC names.
  if (MAP.settings.revealOnMove && xy) {
    const next = { x: xy.x, y: xy.y };
    if (prevPos && Number.isFinite(prevPos.x) && Number.isFinite(prevPos.y)) {
      mapRevealPath({ x: prevPos.x, y: prevPos.y }, next);
    }
    mapRevealAt(next.x, next.y);
    MAP.lastXY = next;
  } else if (xy) {
    MAP.lastXY = { x: xy.x, y: xy.y };
  }

  // Trail nodes: only record named, non-approx places (keeps trail clean).
  try {
    if (!locIsPlaceholder && MAP.currentLocKey && MAP.pins && MAP.pins[MAP.currentLocKey] && !MAP.pins[MAP.currentLocKey].approx) {
      const p = MAP.pins[MAP.currentLocKey];
      if (!p.visitedTs) { p.visitedTs = Date.now(); saveMapPins(); }
      mapTrailPush({ x: p.x, y: p.y, label: p.raw || MAP.currentLocRaw });
    }
  } catch {}

  mapUpdateDots();
}



// Wire UI
mapSelect?.addEventListener('change', () => { try { mapSwitchTo(String(mapSelect.value || '')); } catch {} });
mapNewBtn?.addEventListener('click', () => { try { mapCreateNewMap(); } catch {} });
mapRenameBtn?.addEventListener('click', () => { try { mapRenameActiveMap(); } catch {} });
mapDeleteBtn?.addEventListener('click', () => { try { mapDeleteActiveMap(); } catch {} });

mapOpenBtn?.addEventListener("click", () => setView('map'));
mapCloseBtn?.addEventListener("click", closeMapModal);
mapPinCurrentBtn?.addEventListener("click", () => { setView('map'); mapEnterPinMode(); });
mapPinModeBtn?.addEventListener("click", () => { setView('map'); mapEnterPinMode(); });
mapRemovePinBtn?.addEventListener("click", mapRemoveCurrentPin);
mapClearMapBtn?.addEventListener("click", mapClearMap);
mapClearPinsBtn?.addEventListener("click", () => { if (confirm("Clear ALL map pins?")) mapClearAllPins(); });
mapExportPinsBtn?.addEventListener("click", mapExportPins);
mapImportPinsBtn?.addEventListener("click", mapImportPins);

mapTravelModeChk?.addEventListener('change', mapReadSettingsFromUI);
mapAutoSendTravelChk?.addEventListener('change', mapReadSettingsFromUI);
mapTravelMethodSel?.addEventListener('change', () => {
  const m = String(mapTravelMethodSel.value || 'walk');
  if (m !== 'custom') {
    const d = mapDefaultSpeed(m);
    const cur = Number(mapTravelSpeedInp ? mapTravelSpeedInp.value : MAP.settings.travelSpeedMph);
    const prevDef = mapDefaultSpeed(MAP.settings.travelMethod);
    // If you were on the old default, snap to the new default.
    if (mapTravelSpeedInp && (Math.abs(cur - prevDef) < 0.01 || !Number.isFinite(cur) || cur <= 0)) mapTravelSpeedInp.value = String(d);
  }
  mapReadSettingsFromUI();
});
mapTravelSpeedInp?.addEventListener('input', mapReadSettingsFromUI);
mapMapWidthMilesInp?.addEventListener('input', mapReadSettingsFromUI);
mapAllowTeleportChk?.addEventListener('change', mapReadSettingsFromUI);

mapZoomRange?.addEventListener('input', () => {
  try { MAP.settings._zoomUserSet = true; } catch {}
  try { mapReadSettingsFromUI(); saveMapSettings(); } catch {}
  try { mapUpdateDots(); } catch {}
});

// Fog toggle (local-only)
try {
  if (typeof mapFogToggle !== 'undefined' && mapFogToggle) {
    mapFogToggle.addEventListener('change', () => {
      try { mapReadSettingsFromUI(); saveMapSettings(); } catch {}
      try {
        if (MAP.settings.revealOnMove) {
          mapEnsureFogStore();
          mapLoadFogFromMeta().catch(()=>{});
        } else {
          // Hide fog immediately.
          showEl(mapFog, false);
          showEl(mapMiniFog, false);
        }
      } catch {}
      try { mapRenderFog(); } catch {}
      try { mapUpdateDots(); } catch {}
    });
  }
} catch {}

mapZoomWorldBtn?.addEventListener('click', () => {
  try {
    if (mapZoomRange) mapZoomRange.value = '1';
    MAP.settings.zoom = 1;
    MAP.settings._zoomUserSet = true;
    if (mapZoomVal) mapZoomVal.textContent = '1.0×';
    saveMapSettings();
  } catch {}
  try { mapUpdateDots(); } catch {}
});

mapTravelGoBtn?.addEventListener('click', mapDoTravel);
mapTravelClearBtn?.addEventListener('click', mapClearDest);
mapTravelCancelBtn?.addEventListener('click', mapCancelTravel);

function bindMapFileInput(inp){
  if (!MAP_UPLOAD_ENABLED) return; // locked: canon map only
  inp?.addEventListener("change", async () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    await mapStoreUploadedFile(f);
    inp.value = "";
    mapUpdateDots();
  })
}
bindMapFileInput(mapFile);
bindMapFileInput(mapFileMini);

// Map click interactions:
// - Pin mode: click to place the current LOC pin
// - Travel mode: click anywhere to set a destination (wilderness)
mapFrame?.addEventListener("click", (ev) => {
  if (!mapImg || !mapImg.src) return;
  const xy = mapSetPinFromClick(ev, mapImg);
  if (!xy) return;

  if (MAP.pinMode){
    // Pin mode is CALIBRATION ONLY.
    // It binds the current LOC key to coordinates, but it must NOT:
    // - reveal fog
    // - mark visited
    // - advance the trail
    // Those should happen ONLY when travel actually occurs (LOC changes / travel completes).
    MAP.pins[MAP.currentLocKey] = { ...xy, raw: MAP.currentLocRaw, ts: Date.now() };
    saveMapPins();
    // Tell the server the true XY for the current LOC so multiplayer + travel math stay consistent.
    try {
      if (socket && joined) socket.emit('map_pin', { locRaw: MAP.currentLocRaw, locKey: MAP.currentLocKey, x: xy.x, y: xy.y });
    } catch {}
    mapExitPinMode();
    mapUpdateDots();
    return;
  }

  if (MAP.settings.travelMode){
    mapSetDest({ type: 'free', x: xy.x, y: xy.y, raw: 'Wilderness' });
    if (MAP.settings.autoSendTravel) mapDoTravel();
  }
});

// Keep dot aligned
window.addEventListener("resize", () => { try { mapUpdateDots(); } catch {} });
mapImg?.addEventListener("load", () => {
  try {
    mapEnsureFogStore();
    mapLoadFogFromMeta().catch(()=>{});
    mapUpdateDots();
  } catch {}
});
mapMiniImg?.addEventListener("load", () => { try { mapUpdateDots(); } catch {} });

// Init
try { mapInitMultiMaps(); } catch {}
MAP.meta = loadMapMeta();
MAP.pins = loadMapPins();
MAP.trail = loadMapTrail();
const _ms = loadMapSettings();
if (_ms) MAP.settings = { ...MAP.settings, ..._ms };
mapApplySettingsToUI();
// Enforce locked mechanics + new continent scale on load
try { mapReadSettingsFromUI(); saveMapSettings(); } catch {}
mapLoadFromMeta().then(() => { try { mapUpdateDots(); } catch {} });





/* -------------------- Player Layout: move + resize panels (local only) -------------------- */
// (layout key defined near UI settings)

// Keep the top bar clickable no matter how many floating windows you stack.
const Z_TOPBAR = 10000;
// Floating windows may overlap each other, but should not cover the top bar.
const Z_MAX_PANEL = 9000;

function _loadLayout(){
  try { return JSON.parse(lsGet(LAYOUT_KEY) || "{}") || {}; } catch { return {}; }
}
function _saveLayout(obj){
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(obj || {})); } catch {}
}
function _ensureHandle(el, key){
  if (!el) return null;
  if (el.querySelector(":scope > .moveHandle")) return el.querySelector(":scope > .moveHandle");
  const h = document.createElement("div");
  h.className = "moveHandle";
  h.innerHTML = `<span aria-hidden="true">≡</span><button class="miniBtn" type="button" title="Reset this panel">Reset</button>`;
  el.appendChild(h);
  // Prevent click-through on reset
  const btn = h.querySelector("button.miniBtn");
  btn?.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    const layout = _loadLayout();
    delete layout[key];
    _saveLayout(layout);
    try {
      el.style.transform = "";
      el.style.zIndex = "";
      // Restore base anchor (captured when first detached)
      if (el.dataset.baseLeft) el.style.left = el.dataset.baseLeft;
      if (el.dataset.baseTop) el.style.top = el.dataset.baseTop;
      if (el.dataset.baseW) el.style.width = el.dataset.baseW;
      if (el.dataset.baseH) el.style.height = el.dataset.baseH;
    } catch {}
  });
  return h;
}

// Detach a panel from the grid/layout flow (so resizing one doesn't stretch others).
// We anchor its current on-screen rectangle into a fixed-position window.
function _anchorFixed(el){
  if (!el) return;
  if (el.dataset.anchored === '1') return;
  const r = el.getBoundingClientRect();
  // Hidden panels will measure ~0; we'll anchor them when they first become visible.
  if (!Number.isFinite(r.width) || r.width < 40 || r.height < 40) return;
  try {
    el.style.position = 'fixed';
    el.style.left = `${Math.round(r.left)}px`;
    el.style.top = `${Math.round(r.top)}px`;
    el.style.width = `${Math.round(r.width)}px`;
    el.style.height = `${Math.round(r.height)}px`;
    el.style.margin = '0';
    el.dataset.baseLeft = el.style.left;
    el.dataset.baseTop = el.style.top;
    el.dataset.baseW = el.style.width;
    el.dataset.baseH = el.style.height;
    el.dataset.anchored = '1';
  } catch {}
}
function _applyLayoutToEl(el, key){
  const layout = _loadLayout();
  const st = layout[key];
  if (!st) return;
  const dx = Number(st.dx||0), dy = Number(st.dy||0);
  const w = Number(st.w||0), h = Number(st.h||0);
  const z = Number(st.z||0);
  try {
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    if (Number.isFinite(w) && w>0) el.style.width = `${w}px`;
    if (Number.isFinite(h) && h>0) el.style.height = `${h}px`;
    if (z>0) el.style.zIndex = String(Math.min(Z_MAX_PANEL, z));
  } catch {}
}
function _bumpZ(el, key){
  const layout = _loadLayout();
  const curMax = Object.values(layout).reduce((m,v)=>Math.max(m, Number(v?.z||0)), 10);
  const z = Math.min(Z_MAX_PANEL, Math.max(11, curMax + 1));
  layout[key] = { ...(layout[key]||{}), z };
  _saveLayout(layout);
  try { el.style.zIndex = String(z); } catch {}
}
function makePanelMovable(el, key){
  if (!el) return;
  _anchorFixed(el);
  el.classList.add("movablePanel");
  const handle = _ensureHandle(el, key);
  _applyLayoutToEl(el, key);

  // If this panel doesn't have a saved state yet, snapshot its current size so
  // the layout becomes "sticky" (so turning editing off doesn't revert the UI).
  try {
    const layout = _loadLayout();
    if (!layout[key]) {
      const r = el.getBoundingClientRect();
      if (Number.isFinite(r.width) && r.width > 40 && Number.isFinite(r.height) && r.height > 40) {
        layout[key] = { dx: 0, dy: 0, w: Math.round(r.width), h: Math.round(r.height), z: Number(layout[key]?.z || 0) || 0 };
        _saveLayout(layout);
      }
    }
  } catch {}

  const clampToViewport = (dx, dy) => {
    try {
      const baseLeft = parseInt(el.dataset.baseLeft || el.style.left || "0", 10) || 0;
      const baseTop  = parseInt(el.dataset.baseTop  || el.style.top  || "0", 10) || 0;
      const r = el.getBoundingClientRect();
      const w = Math.max(1, r.width || 1);
      const h = Math.max(1, r.height || 1);
      let minTop = 8;
      const tb = document.querySelector('.topbar');
      if (tb) {
        const tbr = tb.getBoundingClientRect();
        minTop = Math.max(minTop, Math.round(tbr.bottom) + 8);
      }
      const minLeft = 8;
      const maxLeft = Math.max(minLeft, window.innerWidth  - w - 8);
      const maxTop  = Math.max(minTop,  window.innerHeight - h - 8);
      const left = clamp(baseLeft + dx, minLeft, maxLeft);
      const top  = clamp(baseTop  + dy, minTop,  maxTop);
      return { dx: Math.round(left - baseLeft), dy: Math.round(top - baseTop) };
    } catch {
      return { dx, dy };
    }
  };

  // Persist resize (native CSS resize corner)
  const ro = new ResizeObserver(() => {
    const r = el.getBoundingClientRect();
    const layout = _loadLayout();
    layout[key] = { ...(layout[key]||{}), w: Math.round(r.width), h: Math.round(r.height) };
    _saveLayout(layout);
  });
  try { ro.observe(el); } catch {}

  let dragging = false;
  let sx=0, sy=0, startDx=0, startDy=0;

  const onDown = (e) => {
    // Layout locked: keep positions, but do not allow dragging.
    if (document.body?.dataset?.layoutEdit !== "1") return;
    // Don't start dragging when the user is clicking an actual control inside the handle
    // (e.g., the per-panel Reset button). Pointerdown-preventDefault would swallow its click.
    try {
      const t = e?.target;
      if (t && typeof t.closest === 'function' && t.closest('button, a, input, select, textarea')) return;
    } catch {}
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    dragging = true;
    el.classList.add("moving");
    _bumpZ(el, key);

    const layout = _loadLayout();
    const st = layout[key] || {};
    startDx = Number(st.dx||0);
    startDy = Number(st.dy||0);
    sx = e.clientX; sy = e.clientY;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };
  const onMove = (e) => {
    if (!dragging) return;
    const rawDx = startDx + (e.clientX - sx);
    const rawDy = startDy + (e.clientY - sy);
    const { dx, dy } = clampToViewport(rawDx, rawDy);
    try { el.style.transform = `translate(${dx}px, ${dy}px)`; } catch {}
    const layout = _loadLayout();
    layout[key] = { ...(layout[key]||{}), dx: Math.round(dx), dy: Math.round(dy) };
    _saveLayout(layout);
  };
  const onUp = () => {
    dragging = false;
    el.classList.remove("moving");
    window.removeEventListener("pointermove", onMove);
  };

  handle?.addEventListener("pointerdown", onDown);

  // Bring to front when clicked
  el.addEventListener("pointerdown", () => { try { _bumpZ(el, key); } catch {} }, { passive:true });
}


function seedDefaultWindowedLayout(force){
  // Seed a sane default window arrangement the first time someone enables windowed mode.
  const hasLayout = !!((lsGet(LAYOUT_KEY) || '').trim());
  if (hasLayout && !force) return;

  const margin = 12;
  const tb = document.querySelector('.topbar');
  const top = (tb ? tb.getBoundingClientRect().bottom : 0) + margin;

  const playLog = document.getElementById('log');
  const sideBar = document.querySelector('.side');
  const choicesDock = document.querySelector('.choiceDock');
  const composer = document.querySelector('footer.composer');

  // Anchor the visible play panels so we have baseLeft/baseTop.
  try { _anchorFixed(playLog); } catch {}
  try { _anchorFixed(sideBar); } catch {}
  try { _anchorFixed(choicesDock); } catch {}
  try { _anchorFixed(composer); } catch {}

  const sideW = Math.min(420, Math.max(280, Math.round(window.innerWidth * 0.26)));
  const choicesH = Math.min(260, Math.max(160, Math.round(window.innerHeight * 0.20)));
  const composerH = Math.min(120, Math.max(72, Math.round(window.innerHeight * 0.09)));

  const mainW = Math.max(320, window.innerWidth - sideW - margin * 3);
  const availH = Math.max(320, window.innerHeight - top - margin);
  const mainH = Math.max(240, availH - choicesH - composerH - margin * 2);

  const want = {
    playLog:    { left: margin, top, w: mainW, h: mainH, z: 20 },
    sideBar:    { left: margin * 2 + mainW, top, w: sideW, h: mainH, z: 21 },
    choicesDock:{ left: margin, top: top + mainH + margin, w: window.innerWidth - margin * 2, h: choicesH, z: 22 },
    composer:   { left: margin, top: top + mainH + margin + choicesH + margin, w: window.innerWidth - margin * 2, h: composerH, z: 23 },
  };

  const layout = {};

  function place(el, key, rect){
    if (!el || !rect) return;
    const baseLeft = parseInt(el.dataset.baseLeft || el.style.left || '0', 10) || 0;
    const baseTop  = parseInt(el.dataset.baseTop  || el.style.top  || '0', 10) || 0;
    layout[key] = {
      dx: Math.round(rect.left - baseLeft),
      dy: Math.round(rect.top - baseTop),
      w: Math.round(rect.w),
      h: Math.round(rect.h),
      z: Math.round(rect.z || 0)
    };
  }

  place(playLog, 'playLog', want.playLog);
  place(sideBar, 'sideBar', want.sideBar);
  place(choicesDock, 'choicesDock', want.choicesDock);
  place(composer, 'composer', want.composer);

  _saveLayout(layout);

  try { _applyLayoutToEl(playLog, 'playLog'); } catch {}
  try { _applyLayoutToEl(sideBar, 'sideBar'); } catch {}
  try { _applyLayoutToEl(choicesDock, 'choicesDock'); } catch {}
  try { _applyLayoutToEl(composer, 'composer'); } catch {}
}

function initPlayerLayout(){
  // Idempotent: may be called when the user toggles editing on.
  if (window.__AETH_LAYOUT_INITED__) return;
  window.__AETH_LAYOUT_INITED__ = true;

  const hadSavedLayout = !!(lsGet(LAYOUT_KEY) || "").trim();

  const panels = [
    [document.getElementById("log"), "playLog"],
    [document.querySelector(".side"), "sideBar"],
    [document.getElementById("lobbyViewPanel"), "lobbyPanel"],
    [document.getElementById("chatViewPanel"), "chatPanel"],
    [document.getElementById("mapViewPanel"), "mapPanel"],
    [document.getElementById("bookViewPanel"), "bookPanel"],
    [document.querySelector(".choiceDock"), "choicesDock"],
    [document.querySelector("footer.composer"), "composer"],
  ];
  panels.forEach(([el,key]) => { try { makePanelMovable(el, key); } catch {} });
  if (!hadSavedLayout) { try { seedDefaultWindowedLayout(true); } catch {} }


  // Reset Layout button
  document.getElementById("layoutReset")?.addEventListener("click", () => {
    try { localStorage.removeItem(LAYOUT_KEY); } catch {}
    location.reload();
  });

  // Keyboard reset
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && String(e.key||"").toLowerCase() === "l") {
      e.preventDefault();
      try { localStorage.removeItem(LAYOUT_KEY); } catch {}
      location.reload();
    }
  });
}

try {
  const editEnabled = (lsGet(WINDOWED_KEY) || "").trim() === "1";
  const hasLayout = !!(lsGet(LAYOUT_KEY) || "").trim();
  const windowedActive = hasLayout || editEnabled;
  try { document.body.dataset.windowed = windowedActive ? "1" : "0"; } catch {}
  try { document.body.dataset.layoutEdit = editEnabled ? "1" : "0"; } catch {}
  if (windowedActive) initPlayerLayout();
} catch {}

// Keep tabs clickable even when windows overlap.
try {
  const tb = document.querySelector('.topbar');
  if (tb) {
    tb.style.position = tb.style.position || 'relative';
    tb.style.zIndex = String(Z_TOPBAR);
  }
} catch {}

