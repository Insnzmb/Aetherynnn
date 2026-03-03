const logEl = document.getElementById("log");
const canonEl = document.getElementById("canon");
const choicesEl = document.getElementById("choices");
const altActionsEl = document.getElementById("altActions");
const joinBtn = document.getElementById("join");
const sendBtn = document.getElementById("send");
const inputEl = document.getElementById("input");
const actorSelectEl = document.getElementById("actorSelect");
const hudCharSelectEl = document.getElementById("hudCharSelect");
const couchBarEl = document.getElementById("couchBar");
const couchPlayersEl = document.getElementById("couchPlayers");
const couchHandoffEl = document.getElementById("couchHandoff");
const couchHandoffTitleEl = document.getElementById("couchHandoffTitle");
const couchHandoffSubEl = document.getElementById("couchHandoffSub");
const couchHandoffGoEl = document.getElementById("couchHandoffGo");
let __couchPendingName = "";

const roomEl = document.getElementById("room");
const nameEl = document.getElementById("name");
const roomField = document.getElementById("roomField");
const hintEl = document.getElementById("hint");
const joinPanelEl = document.querySelector(".panel");
const loadGameBtn = document.getElementById("loadGame");
const resumeGameBtn = document.getElementById("resumeGame");

// --- HUD elements (Vitals, Party, Inventory) ---
const hpValEl = document.getElementById("hpVal");
const mpValEl = document.getElementById("mpVal");
const stamValEl = document.getElementById("stamVal");
const locValEl = document.getElementById("locVal");
const hpBarEl = document.getElementById("hpBar");
const mpBarEl = document.getElementById("mpBar");
const stamBarEl = document.getElementById("stamBar");
const partyListEl = document.getElementById("partyList");
const invListEl = document.getElementById("invList");
const invListEquipEl = document.getElementById("invListEquip");
const invSearchEl = document.getElementById("invSearch");
const invSortEl = document.getElementById("invSort");
const invCatsEl = document.getElementById("invCats");
const invActionsDetailsEl = document.querySelector("details.invActions");
const equipListEl = document.getElementById("equipList");
const equipDollEl = document.getElementById("equipDoll");
const equipSlotNodes = Array.from(document.querySelectorAll(".equipSlot[data-slot]"));
const statsListEl = document.getElementById("statsList");
const assetHereListEl = document.getElementById("assetHereList");
const houseActionsEl = document.getElementById("houseActions");
const restHereBtn = document.getElementById("restHereBtn");
const stashHereBtn = document.getElementById("stashHereBtn");

// Purchases/loot requests are disabled (anti-cheat).
const stashBlockEl = document.getElementById("stashBlock");
const stashListEl = document.getElementById("stashList");
const stashMetaEl = document.getElementById("stashMeta");
const stashItemEl = document.getElementById("stashItem");
const stashQtyEl = document.getElementById("stashQty");
const stashDepositBtn = document.getElementById("stashDeposit");
const stashWithdrawBtn = document.getElementById("stashWithdraw");

// Inventory consume controls (code-authoritative)
const consumeItemEl = document.getElementById("consumeItem");
const consumeQtyEl = document.getElementById("consumeQty");
const consumeBtn = document.getElementById("consumeBtn");

// Equipment controls (code-authoritative)
const equipSlotEl = document.getElementById("equipSlot");
const equipItemEl = document.getElementById("equipItem");
const equipBtn = document.getElementById("equipBtn");
const unequipBtn = document.getElementById("unequipBtn");


// Character HUD tabs (Vitals / Items / Equipment / Stats)
const charTabsEl = document.getElementById("charTabs");
const charTabBtns = Array.from(document.querySelectorAll(".miniTab[data-tab]"));
const charPanels = Array.from(document.querySelectorAll(".charPanel[data-panel]"));

const freeformBtn = document.getElementById("freeformBtn");

// --- Map tracker elements ---
const mapCard = document.getElementById("mapCard");
const mapOpenBtn = document.getElementById("mapOpen");
const mapPinCurrentBtn = document.getElementById("mapPinCurrent");
const mapMiniFrame = document.getElementById("mapMiniFrame");
const mapMiniImg = document.getElementById("mapMiniImg");
const mapMiniFog = document.getElementById("mapMiniFog");
const mapMiniPinsLayer = document.getElementById("mapMiniPinsLayer");
const mapMiniDot = document.getElementById("mapMiniDot");
const mapMiniEmpty = document.getElementById("mapMiniEmpty");
const mapMiniHint = document.getElementById("mapMiniHint");
const mapMiniLoc = document.getElementById("mapMiniLoc");
const mapFileMini = document.getElementById("mapFileMini");

const mapViewPanel = document.getElementById("mapViewPanel");
const mapCloseBtn = document.getElementById("mapClose");
const mapFile = document.getElementById("mapFile");
const mapPinModeBtn = document.getElementById("mapPinMode");
const mapRemovePinBtn = document.getElementById("mapRemovePin");
const mapClearMapBtn = document.getElementById("mapClearMap");
const mapClearPinsBtn = document.getElementById("mapClearPins");
const mapExportPinsBtn = document.getElementById("mapExportPins");
const mapImportPinsBtn = document.getElementById("mapImportPins");
const mapPinsText = document.getElementById("mapPinsText");
const mapHelp = document.getElementById("mapHelp");
const mapEmpty = document.getElementById("mapEmpty");
const mapFrame = document.getElementById("mapFrame");
const mapInner = document.getElementById("mapInner");
const mapImg = document.getElementById("mapImg");
const mapCanonOverlay = document.getElementById("mapCanonOverlay");
const mapFog = document.getElementById("mapFog");
const mapPinsLayer = document.getElementById("mapPinsLayer");
const mapDest = document.getElementById("mapDest");
const mapDot = document.getElementById("mapDot");
const mapLocRawEl = document.getElementById("mapLocRaw");
const mapLocKeyEl = document.getElementById("mapLocKey");
const mapSub = document.getElementById("mapSub");
const CANON_MAP_URL = "assets/aetheryn_canon_map.png?v=3";
const CANON_OVERLAY_URL = "assets/aetheryn_canon_overlay.png?v=3";
const MAP_UPLOAD_ENABLED = false; // player should not upload maps

const mapRevealOnMoveChk = document.getElementById("mapRevealOnMove");
const mapRevealRadiusRange = document.getElementById("mapRevealRadius");
const mapTravelModeChk = document.getElementById("mapTravelMode");
const mapAutoSendTravelChk = document.getElementById("mapAutoSendTravel");
const mapResetFogBtn = document.getElementById("mapResetFog");
const mapVisitedChips = document.getElementById("mapVisitedChips");
const mapTravelInfo = document.getElementById("mapTravelInfo");
const mapTravelGoBtn = document.getElementById("mapTravelGo");
const mapTravelClearBtn = document.getElementById("mapTravelClear");

const mapSelect = document.getElementById("mapSelect");
const mapNewBtn = document.getElementById("mapNew");
const mapRenameBtn = document.getElementById("mapRename");
const mapDeleteBtn = document.getElementById("mapDelete");

const mapTravelMethodSel = document.getElementById("mapTravelMethod");
const mapZoomRange = document.getElementById("mapZoom");
const mapZoomVal = document.getElementById("mapZoomVal");
const mapZoomWorldBtn = document.getElementById("mapZoomWorld");
const mapFogToggle = document.getElementById("mapFogToggle");
const mapTravelSpeedInp = document.getElementById("mapTravelSpeed");
const mapMapWidthMilesInp = document.getElementById("mapMapWidthMiles");
const mapAllowTeleportChk = document.getElementById("mapAllowTeleport");

const mapTravelProgress = document.getElementById("mapTravelProgress");
const mapTravelProgressFill = document.getElementById("mapTravelProgressFill");
const mapTravelProgressText = document.getElementById("mapTravelProgressText");
const mapTravelCancelBtn = document.getElementById("mapTravelCancel");


const modeSingleBtn = document.getElementById("modeSingle");
const modeMultiBtn = document.getElementById("modeMulti");

const connDot = document.getElementById("connDot");
const connText = document.getElementById("connText");
const aiStatusEl = document.getElementById("aiStatus");
const aiWaitEl = document.getElementById("aiWait");
const turnStatusEl = document.getElementById("turnStatus");
const aiWaitLabelEl = document.querySelector("#aiWait .aiWaitLabel") || aiWaitEl;
const aiCancelBtn = document.getElementById("aiCancelBtn");
const turnRerollBtn = document.getElementById("turnRerollBtn");
const turnReadyBtn = document.getElementById("turnReadyBtn");
const turnResolveBtn = document.getElementById("turnResolveBtn");

// In-room controls (multiplayer lobby gating)
const roomControlsEl = document.getElementById("roomControls");
const roomPhasePillEl = document.getElementById("roomPhasePill");
const roomCreateCharBtn = document.getElementById("roomCreateChar");
const roomStartGameBtn = document.getElementById("roomStartGame");
const toggleSystem = document.getElementById("toggleSystem");
const toggleCanon = document.getElementById("toggleCanon");
const canonCard = document.getElementById("canonCard");

// View tabs
const viewLobbyBtn = document.getElementById("viewLobby");
const viewPlayBtn = document.getElementById("viewPlay");
const viewChatBtn = document.getElementById("viewChat");
const viewMapBtn = document.getElementById("viewMap");
const viewDiceBtn = document.getElementById("viewDice");
const viewBookBtn = document.getElementById("viewBook");
const viewCodexBtn = document.getElementById("viewCodex");
const viewForcesBtn = document.getElementById("viewForces");
const bookViewPanel = document.getElementById("bookViewPanel");
const codexViewPanel = document.getElementById("codexViewPanel");
const forcesViewPanel = document.getElementById("forcesViewPanel");
const bookTextEl = document.getElementById("bookText");
const bookRefreshBtn = document.getElementById("bookRefresh");
const bookAutoChk = document.getElementById("bookAuto");

// Codex
const codexQueryEl = document.getElementById("codexQuery");
const codexGoBtn = document.getElementById("codexGo");
const codexResultsEl = document.getElementById("codexResults");

// Forces
const forcesControlsEl = document.getElementById("forcesControls");
const forcesListEl = document.getElementById("forcesList");
const unitNameEl = document.getElementById("unitName");
const unitStrEl = document.getElementById("unitStr");
const unitMoraleEl = document.getElementById("unitMorale");
const unitSupplyEl = document.getElementById("unitSupply");
const unitCreateBtn = document.getElementById("unitCreate");
const bookSaveBtn = document.getElementById("bookSave");

// Party chat view
const chatViewPanel = document.getElementById("chatViewPanel");
const chatLogEl = document.getElementById("chatLog");
const chatInputEl = document.getElementById("chatInput");
const chatSendBtn = document.getElementById("chatSend");
const chatBackBtn = document.getElementById("chatBack");

// Dice dock (Play view)
const diceDockEl = document.getElementById("diceDock");
const diceDockToggleBtn = document.getElementById("diceDockToggle");
const diceSidesSel = document.getElementById("diceSides");
const diceCountInp = document.getElementById("diceCount");
const diceModInp = document.getElementById("diceMod");
const diceRollBtn = document.getElementById("diceRoll");
const diceClearBtn = document.getElementById("diceClear");
const diceLogEl = document.getElementById("diceLog");
const quick3d6Btn = document.getElementById("quick3d6");
const quickD20Btn = document.getElementById("quickD20");
const quickD6Btn = document.getElementById("quickD6");

// Load game modal
const loadModal = document.getElementById("loadModal");
const loadSelect = document.getElementById("loadSelect");
const loadMeta = document.getElementById("loadMeta");
const loadGoBtn = document.getElementById("loadGo");
const loadCancelBtn = document.getElementById("loadCancel");
const loadCloseBtn = document.getElementById("loadClose");

// Save/Export (manual save controls)
const saveGameBtn = document.getElementById("saveGame");
const saveAlwaysBtn = document.getElementById("saveAlwaysBtn");
const craftBtn = document.getElementById("craftBtn");
const exportGameBtn = document.getElementById("exportGame");

// Session meta
const bookMetaLine = document.getElementById("bookMetaLine");
const worldClockLine = document.getElementById("worldClockLine");

// Lobby view
const lobbyViewPanel = document.getElementById("lobbyViewPanel");
const lobbyBackBtn = document.getElementById("lobbyBack");
const lobbyRefreshBtn = document.getElementById("lobbyRefresh");
const mmUrlInp = document.getElementById("mmUrl");
const hostPublicUrlInp = document.getElementById("hostPublicUrl");
const inviteRoomCodeInp = document.getElementById('inviteRoomCode');
const lanInviteInp = document.getElementById('lanInvite');
const copyRoomCodeBtn = document.getElementById('copyRoomCode');
const copyLanInviteBtn = document.getElementById('copyLanInvite');
const publishRoomBtn = document.getElementById("publishRoom");
const unpublishRoomBtn = document.getElementById("unpublishRoom");
const quickMatchBtn = document.getElementById("quickMatch");
const joinByCodeBtn = document.getElementById("joinByCode");
const joinCodeRow = document.getElementById("joinCodeRow");
const joinCodeBtns = document.getElementById("joinCodeBtns");
const joinCodeInp = document.getElementById("joinCode");
const joinCodeGoBtn = document.getElementById("joinCodeGo");
const joinCodeCancelBtn = document.getElementById("joinCodeCancel");
const lobbyRoomsEl = document.getElementById("lobbyRooms");

const intakeModal = document.getElementById("intakeModal");
const qNumEl = document.getElementById("qNum");
const qTextEl = document.getElementById("qText");
const aBlockEl = document.getElementById("aBlock");
const intakeBackBtn = document.getElementById("intakeBack");
const intakeNextBtn = document.getElementById("intakeNext");
const intakeRoleBadge = document.getElementById("intakeRole");
const progressBar = document.getElementById("progressBar");


const statsModal = document.getElementById("statsModal");
const statsBodyEl = document.getElementById("statsBody");
const statsSubEl = document.getElementById("statsSub");
const statsTitleEl = document.getElementById("statsTitle");
const statsRoleBadge = document.getElementById("statsRole");
const statsRollAiBtn = document.getElementById("statsRollAi"); // legacy (disabled)
try { if (statsRollAiBtn) { statsRollAiBtn.style.display = "none"; statsRollAiBtn.disabled = true; } } catch {}
const statsSubmitBtn = document.getElementById("statsSubmit");
const statsCloseBtn = document.getElementById("statsClose");


const actionRollModal = document.getElementById("actionRollModal");
const actionRollSubEl = document.getElementById("actionRollSub");
const actionRollAiBtn = document.getElementById("actionRollAi");
const actionRollTotalEl = document.getElementById("actionRollTotal");
const actionRollSubmitBtn = document.getElementById("actionRollSubmit");
const actionRollResultEl = document.getElementById("actionRollResult");

// Turn order (initiative) modal
const turnOrderModal = document.getElementById("turnOrderModal");
const turnOrderSubEl = document.getElementById("turnOrderSub");
const turnOrderHelpEl = document.getElementById("turnOrderHelp");
const turnOrderTotalEl = document.getElementById("turnOrderTotal");
const turnOrderAiBtn = document.getElementById("turnOrderAi");
const turnOrderSubmitBtn = document.getElementById("turnOrderSubmit");
const turnOrderResultEl = document.getElementById("turnOrderResult");


// -------------------- UI Settings (local-only) --------------------
const openSettingsBtn = document.getElementById("openSettings");
const settingsDrawer = document.getElementById("settingsDrawer");
const drawerBackdrop = document.getElementById("drawerBackdrop");
const closeSettingsBtn = document.getElementById("closeSettings");

const uiThemeSel = document.getElementById("uiTheme");
const uiAccentInp = document.getElementById("uiAccent");
const uiLayoutSel = document.getElementById("uiLayout");
const uiReaderModeChk = document.getElementById("uiReaderMode");
const uiReaderStyleSel = document.getElementById("uiReaderStyle");
const uiRadiusRange = document.getElementById("uiRadius");
const uiGlassRange = document.getElementById("uiGlass");
const uiFontRange = document.getElementById("uiFont");
const uiInputRange = document.getElementById("uiInput");
const uiReduceMotionChk = document.getElementById("uiReduceMotion");
const uiWindowedChk = document.getElementById("uiWindowed");
const uiResetBtn = document.getElementById("uiReset");
const uiDoneBtn = document.getElementById("uiDone");

// AI Model picker (local Ollama)
const aiModelSelect = document.getElementById("aiModelSelect");
const aiModelRefreshBtn = document.getElementById("aiModelRefresh");
const aiModelApplyBtn = document.getElementById("aiModelApply");
const aiModelHint = document.getElementById("aiModelHint");

// Narrator provider/model (hosted APIs)
const aiNarratorProviderSel = document.getElementById("aiNarratorProvider");
const aiNarratorModelInp = document.getElementById("aiNarratorModel");
const aiNarratorApplyBtn = document.getElementById("aiNarratorApply");

const UI_KEY = "aetheryn_ui_v1";
const LAYOUT_KEY = "aetheryn_layout_v3";
const WINDOWED_KEY = "aetheryn_windowed_v1";
const UI_DEFAULTS = {
  theme: "obsidian",
  accent: "#7aa2ff",
  layout: "dashboard",
  readerMode: true,
  readerStyle: "classic",
radius: 18,
  glass: 76,
  font: 100,
  input: 50,
  reduceMotion: false
};

const UI_THEMES = {
  obsidian:   { bg: "#07080f", panel: [15,20,34], card: [0,0,0],  accent: "#7aa2ff", accent2: "#67e8f9" },
  cinder:     { bg: "#09060a", panel: [24,14,18], card: [8,5,7],  accent: "#ff6b6b", accent2: "#f6c177" },
  verdant:    { bg: "#050a08", panel: [10,20,18], card: [0,0,0],  accent: "#5ef2a0", accent2: "#67e8f9" },
  aether:     { bg: "#050610", panel: [10,12,28], card: [0,0,0],  accent: "#67e8f9", accent2: "#7aa2ff" },
  bone:       { bg: "#0b0b0d", panel: [18,18,20], card: [0,0,0],  accent: "#c7a76a", accent2: "#7aa2ff" },

  nocturne:   { bg: "#05050a", panel: [14,16,28], card: [0,0,0],  accent: "#b794f4", accent2: "#67e8f9" },
  bloodmoon:  { bg: "#0a0506", panel: [26,10,14], card: [10,2,4], accent: "#ff4d6d", accent2: "#ffb703" },
  frost:      { bg: "#05080d", panel: [10,18,26], card: [0,0,0],  accent: "#7dd3fc", accent2: "#a5b4fc" },
  cathedral:  { bg: "#07060a", panel: [18,14,22], card: [0,0,0],  accent: "#d4af37", accent2: "#9b87f5" },
  abyss:      { bg: "#04060a", panel: [8,12,18],  card: [0,0,0],  accent: "#22d3ee", accent2: "#34d399" },
  emberglass: { bg: "#07050a", panel: [22,12,26], card: [0,0,0],  accent: "#fb7185", accent2: "#fbbf24" },
  sunken:     { bg: "#041012", panel: [10,22,24], card: [0,0,0],  accent: "#2dd4bf", accent2: "#60a5fa" },
  storm:      { bg: "#05070d", panel: [16,18,28], card: [0,0,0],  accent: "#93c5fd", accent2: "#f9fafb" },
};

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

// Safe localStorage helpers (some environments throw on access; never let that break the UI)
function lsGet(key, fallback = ""){
  try {
    const v = localStorage.getItem(String(key));
    return (v === null || v === undefined) ? fallback : v;
  } catch {
    return fallback;
  }
}
function lsSet(key, value){
  try { localStorage.setItem(String(key), String(value)); } catch {}
}
function lsDel(key){
  try { localStorage.removeItem(String(key)); } catch {}
}


// -------------------- Toasts (non-blocking UX feedback) --------------------
const toastLayerEl = document.getElementById('toastLayer');
function toast(message, type = 'info', title = ''){
  try {
    const layer = toastLayerEl;
    if (!layer) return;
    const msg = String(message || '').trim();
    if (!msg) return;
    const t = String(type || 'info').toLowerCase();

    const el = document.createElement('div');
    el.className = `toast ${t}`;
    const ttl = title ? String(title) : (t === 'error' ? 'Error' : (t === 'success' ? 'Unlocked' : (t === 'warn' ? 'Notice' : 'Info')));
    const tTitle = document.createElement("div");
    tTitle.className = "tTitle";
    tTitle.textContent = ttl;
    const tBody = document.createElement("div");
    tBody.className = "tBody";
    tBody.textContent = msg;
    el.appendChild(tTitle);
    el.appendChild(tBody);
    layer.appendChild(el);

    const ttlMs = t === 'error' ? 5200 : 3400;
    setTimeout(() => {
      try { el.style.opacity = '0'; el.style.transform = 'translateY(-6px)'; } catch {}
      setTimeout(() => { try { el.remove(); } catch {} }, 350);
    }, ttlMs);
  } catch {}
}
window.toast = toast;

function pulseDanger(){
  try {
    document.body.classList.add('pulseDanger');
    setTimeout(() => { try { document.body.classList.remove('pulseDanger'); } catch {} }, 480);
  } catch {}
}
window.pulseDanger = pulseDanger;


// Per-room character name (prevents wrong character when you Load a different save)
function roomCharKey(roomId){
  const rid = String(roomId || '').trim();
  return rid ? ('aetheryn_char_name__' + rid) : 'aetheryn_char_name';
}

function roomCharNamesKey(roomId){
  const rid = String(roomId || '').trim();
  return rid ? ('aetheryn_char_names__' + rid) : 'aetheryn_char_names';
}

function uniqList(arr){
  const out = [];
  const seen = new Set();
  for (const raw of (Array.isArray(arr) ? arr : [])) {
    const s = String(raw || '').trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

function getMyCharNames(roomId){
  const rid = String(roomId || activeRoomId || '').trim();
  try {
    const raw = lsGet(roomCharNamesKey(rid));
    if (!raw) {
      const single = getMyCharName(rid);
      return single ? [single] : [];
    }
    const parsed = JSON.parse(raw);
    const list = uniqList(parsed);
    if (!list.length) {
      const single = getMyCharName(rid);
      return single ? [single] : [];
    }
    return list;
  } catch {
    const single = getMyCharName(rid);
    return single ? [single] : [];
  }
}

function setMyCharNames(roomId, arr){
  const rid = String(roomId || activeRoomId || '').trim();
  const list = uniqList(arr);
  try { if (rid) lsSet(roomCharNamesKey(rid), JSON.stringify(list)); } catch {}

  // Keep active name sane.
  try {
    const active = String(getMyCharName(rid) || '').trim();
    if (!active && list.length) setMyCharName(rid, list[0]);
    else if (active && list.length && !list.some(n => n.toLowerCase() === active.toLowerCase())) setMyCharName(rid, list[0]);
  } catch {}

  try { syncActorSelect(); } catch {}
}

function _canonPartyNames(tokens){
  const out = [];
  const seen = new Set();
  for (const raw of (Array.isArray(tokens) ? tokens : [])) {
    const s = String(raw || '').trim();
    if (!s || !/^party[:=]/i.test(s)) continue;
    const body = s.split(/[:=]/).slice(1).join(':').trim();
    if (!body) continue;
    const name = String(body.split('/')[0] || '').trim();
    if (!name) continue;
    const k = name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(name);
  }
  return out;
}

function _nameLooseKey(name){
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function _namesLooselyMatch(a, b){
  const aa = _nameLooseKey(a);
  const bb = _nameLooseKey(b);
  if (!aa || !bb) return false;
  if (aa === bb) return true;
  if (aa.startsWith(bb + ' ') || bb.startsWith(aa + ' ')) return true;
  const a0 = aa.split(' ')[0] || '';
  const b0 = bb.split(' ')[0] || '';
  if (a0 && b0 && a0 === b0) return true;
  return false;
}

function _isSoloLikeRoomLocal(roomId){
  const rid = String(roomId || activeRoomId || '').trim();
  if (!rid) return false;
  if (rid.toLowerCase().startsWith('solo-')) return true;
  try { return String(lsGet('aetheryn_single_room', '') || '').trim() === rid; } catch {}
  return false;
}

function _healLocalRosterFromTokens(roomId, tokens){
  const rid = String(roomId || activeRoomId || '').trim();
  if (!rid || !_isSoloLikeRoomLocal(rid)) return [];

  const party = _canonPartyNames(tokens);
  if (!party.length) return [];

  let current = [];
  try { current = getMyCharNames(rid) || []; } catch { current = []; }

  const overlaps = current.some(n => party.some(pn => _namesLooselyMatch(n, pn)));
  if (!current.length || !overlaps) {
    try { setMyCharNames(rid, party); } catch {}
    current = party.slice();
  }

  let active = '';
  try { active = String(getMyCharName(rid) || '').trim(); } catch { active = ''; }
  if (!active || !party.some(pn => _namesLooselyMatch(active, pn))) {
    const pick = party.find(pn => current.some(n => _namesLooselyMatch(n, pn))) || party[0];
    if (pick) {
      try { setMyCharName(rid, pick); } catch {}
      active = pick;
    }
  }

  try {
    const healed = getMyCharNames(rid) || [];
    return healed.length ? healed : party;
  } catch {
    return party;
  }
}

function setActiveCharacter(roomId, name){
  const rid = String(roomId || activeRoomId || '').trim();
  const nm = String(name || '').trim();
  if (!nm) return;
  setMyCharName(rid, nm);
  try { syncActorSelect(); } catch {}
  try { syncHudCharSelect(); } catch {}
  try { if (window.AETH_LOG && typeof window.AETH_LOG.render === 'function') window.AETH_LOG.render(rid); } catch {}
  try {
    if (socket && joined) socket.emit('set_active_character', { charName: nm });
  } catch {}

    // Re-filter the last received choices immediately (prevents showing another player's options after a couch swap).
  try { if (typeof setChoices === 'function') setChoices(__lastChoicesRaw); } catch {}

// Immediate local refresh (otherwise the HUD waits for the next canon_update).
  try { if (typeof updateHudFromTokens === 'function') updateHudFromTokens(currentCanonTokens); } catch {}
}

function syncActorSelect(){
  if (!actorSelectEl) return;
  const rid = String(activeRoomId || '').trim();
  const names = getMyCharNames(rid);
  const show = false; // character switching happens via the couch co-op bar
  actorSelectEl.classList.toggle('hidden', !show);
  if (!show) {
    try { actorSelectEl.innerHTML = ''; } catch {}
    try { syncHudCharSelect(); } catch {}
    try { syncCouchBar(); } catch {}
    return;
  }

  const active = String(getMyCharName(rid) || '').trim();
  const opts = names.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
  actorSelectEl.innerHTML = opts;
  if (active) {
    const hit = names.find(n => n.toLowerCase() === active.toLowerCase());
    actorSelectEl.value = hit || names[0];
  } else {
    actorSelectEl.value = names[0] || '';
    if (names[0]) setMyCharName(rid, names[0]);
  }

  try { syncHudCharSelect(); } catch {}
}

function syncHudCharSelect(){
  if (!hudCharSelectEl) return;
  const rid = String(activeRoomId || '').trim();
  let names = getMyCharNames(rid);
  const active0 = String(getMyCharName(rid) || '').trim();
  // In couch co-op, character switching is handled by the couch bar.
  // Hide this selector entirely to avoid duplicate swap UI.
  try {
    if (Array.isArray(names) && names.length > 1) {
      hudCharSelectEl.classList.add('hidden');
      try { hudCharSelectEl.innerHTML = ''; } catch {}
      return;
    }
  } catch {}
  if ((!names || !names.length) && active0) names = [active0];
  const show = !!(names && names.length);
  hudCharSelectEl.classList.toggle('hidden', !show);
  if (!show) {
    try { hudCharSelectEl.innerHTML = ''; } catch {}
    return;
  }

  const active = active0;
  const opts = names.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
  hudCharSelectEl.innerHTML = opts;

  // If there's only one character, keep it visible but non-interactive.
  try { hudCharSelectEl.disabled = names.length <= 1; } catch {}

  if (active) {
    const hit = names.find(n => n.toLowerCase() === active.toLowerCase());
    hudCharSelectEl.value = hit || names[0];
  } else {
    hudCharSelectEl.value = names[0] || '';
    if (names[0]) setMyCharName(rid, names[0]);
  }
}



function syncCouchBar(){
  if (!couchBarEl || !couchPlayersEl) return;
  const rid = String(activeRoomId || '').trim();
  const names = (typeof getMyCharNames === 'function') ? (getMyCharNames(rid) || []) : [];
  const show = Array.isArray(names) && names.length > 1;
  couchBarEl.classList.toggle('hidden', !show);
  if (!show) {
    try { couchPlayersEl.innerHTML = ''; } catch {}
    return;
  }

  const active = String(getMyCharName(rid) || names[0] || '').trim();
  couchPlayersEl.innerHTML = '';

  for (const nm0 of names) {
    const nm = String(nm0 || '').trim();
    if (!nm) continue;
    const btn = document.createElement('button');
    btn.className = 'couchBtn' + ((active && nm.toLowerCase() === active.toLowerCase()) ? ' active' : '');
    btn.type = 'button';
    btn.textContent = nm;
    btn.onclick = () => {
      if (!nm) return;
      if (active && nm.toLowerCase() === active.toLowerCase()) return;
      __couchPendingName = nm;
      // Privacy handoff overlay (grandma-proof).
      if (couchHandoffEl && couchHandoffGoEl) {
        try { if (couchHandoffTitleEl) couchHandoffTitleEl.textContent = `Pass the screen to ${nm}`; } catch {}
        try { if (couchHandoffSubEl) couchHandoffSubEl.textContent = "Only this character's choices and sheet will be visible."; } catch {}
        couchHandoffEl.classList.remove('hidden');
        return;
      }
      try { setActiveCharacter(rid, nm); } catch {}
    };
    couchPlayersEl.appendChild(btn);
  }
}

if (couchHandoffGoEl) {
  couchHandoffGoEl.addEventListener('click', () => {
    try { if (couchHandoffEl) couchHandoffEl.classList.add('hidden'); } catch {}
    const rid = String(activeRoomId || '').trim();
    const nm = String(__couchPendingName || '').trim();
    __couchPendingName = '';
    if (nm) {
      try { setActiveCharacter(rid, nm); } catch {}
      try { syncCouchBar(); } catch {}
    }
  });
}
actorSelectEl?.addEventListener('change', () => {
  try { setActiveCharacter(activeRoomId, actorSelectEl.value); } catch {}
});

hudCharSelectEl?.addEventListener('change', () => {
  try { setActiveCharacter(activeRoomId, hudCharSelectEl.value); } catch {}
});

function getMyCharName(roomId){
  const rid = String(roomId || activeRoomId || '').trim();
  const per = rid ? String(lsGet(roomCharKey(rid), '')).trim() : '';
  if (per) return per;

  // Legacy fallback is ONLY safe for the same room you were already in.
  const legacy = String(lsGet('aetheryn_char_name', '')).trim();
  if (!legacy) return '';

  if (!rid) return legacy;
  const last = String(lsGet('aetheryn_active_room', '')).trim();
  const solo = String(lsGet('aetheryn_single_room', '')).trim();
  if (rid === last || rid === solo) return legacy;
  return '';
}
function setMyCharName(roomId, name){
  const rid = String(roomId || activeRoomId || '').trim();
  const nm = String(name || '').trim();
  if (rid) lsSet(roomCharKey(rid), nm);
  // Keep legacy key updated for backward compatibility
  if (nm) lsSet('aetheryn_char_name', nm);
  try { syncActorSelect(); } catch {}
  try { syncHudCharSelect(); } catch {}
  try { if (typeof updateHudFromTokens === 'function') updateHudFromTokens(currentCanonTokens); } catch {}
}
function clearMyCharName(roomId){
  const rid = String(roomId || activeRoomId || '').trim();
  if (rid) lsDel(roomCharKey(rid));
}

// Surface uncaught UI errors in the hint bar so "buttons broke" is debuggable.
try {
  window.addEventListener('error', (ev) => {
    try {
      const msg = (ev && (ev.message || ev.error?.message)) ? String(ev.message || ev.error.message) : 'Unknown error';
      console.error('AETHERYN UI error:', ev.error || ev);
      if (typeof hintEl !== 'undefined' && hintEl) hintEl.textContent = `UI error: ${msg}`;
    } catch {}
  });
  window.addEventListener('unhandledrejection', (ev) => {
    try {
      const msg = ev?.reason?.message ? String(ev.reason.message) : String(ev?.reason || 'Unhandled rejection');
      console.error('AETHERYN UI rejection:', ev?.reason || ev);
      if (typeof hintEl !== 'undefined' && hintEl) hintEl.textContent = `UI error: ${msg}`;
    } catch {}
  });
} catch {}

function loadUi(){
  try {
    const raw = lsGet(UI_KEY);
    if (!raw) return { ...UI_DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...UI_DEFAULTS, ...(parsed || {}) };
  } catch {
    return { ...UI_DEFAULTS };
  }
}

function saveUi(s){
  try { localStorage.setItem(UI_KEY, JSON.stringify(s)); } catch {}
}

function rgba(rgb, a){
  const [r,g,b] = rgb;
  return `rgba(${r},${g},${b},${a})`;
}

function applyUi(s){
  const theme = UI_THEMES[s.theme] || UI_THEMES.obsidian;

  // Body layout + motion
  document.body.dataset.layout = s.layout || "standard";
  document.body.classList.toggle("reduce-motion", !!s.reduceMotion);

  // Reader mode (Book tab only)
  document.body.classList.toggle("reader-mode", !!s.readerMode);
  document.body.dataset.readerStyle = (s.readerStyle || "classic");

  // Geometry
  const r = clamp(Number(s.radius || 18), 10, 28);
  document.documentElement.style.setProperty("--r", r + "px");
  document.documentElement.style.setProperty("--r2", (r + 4) + "px");

  // Typography
  const fontScale = clamp(Number(s.font || 100) / 100, 0.9, 1.15);
  document.documentElement.style.setProperty("--font-scale", String(fontScale));

  // Colors
  document.documentElement.style.setProperty("--bg", theme.bg);
  document.documentElement.style.setProperty("--accent", (s.accent || theme.accent));
  document.documentElement.style.setProperty("--accent2", theme.accent2);

  // Glass / surfaces
  const glassA = clamp(Number(s.glass || 76) / 100, 0.4, 0.95);
  const cardA = clamp(glassA - 0.54, 0.14, 0.32);
  document.documentElement.style.setProperty("--panel-glass", rgba(theme.panel, glassA));
  document.documentElement.style.setProperty("--card-glass", rgba(theme.card, cardA));

  // Inputs
  const inputA = clamp(Number(s.input || 50) / 100, 0.2, 0.9);
  document.documentElement.style.setProperty("--input-glass", `rgba(255,255,255,${(inputA * 0.10).toFixed(3)})`);
}

function openDrawer(){
  settingsDrawer?.classList.remove("hidden");
  drawerBackdrop?.classList.remove("hidden");
}

function closeDrawer(){
  settingsDrawer?.classList.add("hidden");
  drawerBackdrop?.classList.add("hidden");
}

let uiState = loadUi();
applyUi(uiState);

function syncUiControls(){
  if (uiThemeSel) uiThemeSel.value = uiState.theme;
  if (uiAccentInp) uiAccentInp.value = uiState.accent;
  if (uiLayoutSel) uiLayoutSel.value = uiState.layout;
  if (uiReaderModeChk) uiReaderModeChk.checked = !!uiState.readerMode;
  if (uiReaderStyleSel) uiReaderStyleSel.value = uiState.readerStyle || "classic";
  if (uiRadiusRange) uiRadiusRange.value = String(uiState.radius);
  if (uiGlassRange) uiGlassRange.value = String(uiState.glass);
  if (uiFontRange) uiFontRange.value = String(uiState.font);
  if (uiInputRange) uiInputRange.value = String(uiState.input);
  if (uiReduceMotionChk) uiReduceMotionChk.checked = !!uiState.reduceMotion;
  if (uiWindowedChk) uiWindowedChk.checked = (lsGet(WINDOWED_KEY) || "").trim() === "1";
}

function commitUi(partial){
  uiState = { ...uiState, ...(partial || {}) };
  applyUi(uiState);
  saveUi(uiState);
}

syncUiControls();

// -------------------- AI Model Picker (simple) --------------------
function opt(label, value){
  const o = document.createElement('option');
  o.value = value;
  o.textContent = label;
  return o;
}

async function refreshAiModelPicker(){
  if (!aiModelSelect) return;

  if (aiModelApplyBtn) aiModelApplyBtn.disabled = (mode === 'multi' && !isHost);

  aiModelSelect.innerHTML = "";
  aiModelSelect.appendChild(opt('Auto (recommended)', 'auto'));

  try {
    const resp = await fetch('/api/ai/status', { cache: 'no-store' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (!data || !data.ok) throw new Error('bad payload');

    const effProv = String(data?.effective?.rules_provider || data?.effective?.narrator_provider || '').trim();
    const effModel = String(data?.effective?.rules_model || data?.effective?.narrator_model || '').trim();
    const isOllama = String(effProv).toLowerCase() === 'ollama' && !!data?.ollama;

    if (!isOllama) {
      aiModelSelect.innerHTML = "";
      aiModelSelect.appendChild(opt(effModel ? `${effModel} (${effProv || 'provider'})` : `Configured in server/.env`, effModel || 'configured'));
      aiModelSelect.value = effModel || 'configured';
      aiModelSelect.disabled = true;
      if (aiModelApplyBtn) aiModelApplyBtn.disabled = true;
      if (aiModelHint) {
        const lines = [];
        lines.push(`Provider: ${effProv || 'unknown'}`);
        if (effModel) lines.push(`Model: ${effModel}`);
        lines.push('Configure LLM_BASE_URL / LLM_API_KEY / LLM_MODEL in server/.env.');
        if (mode === 'multi' && !isHost) lines.push('Multiplayer: only the host can change server-side settings.');
        aiModelHint.textContent = lines.join(' ');
      }
      return;
    }

    const models = Array.isArray(data?.ollama?.models) ? data.ollama.models.slice() : [];
    aiModelSelect.disabled = false;
    models.sort((a,b)=>String(a).localeCompare(String(b)));
    for (const m of models) aiModelSelect.appendChild(opt(m, m));

    const configured = String(data?.configured?.ollama_model || '').trim();
    const effective = String(data?.effective?.rules_model || data?.effective?.narrator_model || '').trim();
    const reachable = data?.ollama?.reachable === true;

    // Prefer showing the configured selection if it exists; else fall back to auto.
    if (!configured || configured.toLowerCase() === 'auto') {
      aiModelSelect.value = 'auto';
    } else {
      // If the configured model isn't in the list, inject it so the UI reflects reality.
      const exists = models.some(x => String(x).trim() === configured);
      if (!exists) aiModelSelect.appendChild(opt(configured + ' (configured)', configured));
      aiModelSelect.value = configured;
    }

    const lines = [];
    if (!reachable) lines.push('Ollama not reachable (is it running?).');
    if (effective) lines.push(`Currently using: ${effective}`);
    if (mode === 'multi' && !isHost) lines.push('Multiplayer: only the host can Apply the room model.');
    aiModelHint.textContent = lines.join(' ') || '—';
  } catch (e) {
    if (aiModelHint) aiModelHint.textContent = 'AI model list unavailable (server not running yet).';
  }
}

async function applyAiModelSelection(){
  if (!aiModelSelect) return;
  if (aiModelSelect.disabled) {
    alert('This AI backend does not support in-UI model switching. Configure LLM_MODEL in server/.env.');
    return;
  }
  if (mode === 'multi' && !isHost) {
    alert('Only the host can change the room AI model.');
    return;
  }
  const model = String(aiModelSelect.value || 'auto');
  try {
    const resp = await fetch('/api/ai/model', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, applyTo: 'both' })
    });
    const data = await resp.json().catch(()=>({}));
    if (!resp.ok || !data?.ok) throw new Error(data?.error || `HTTP ${resp.status}`);
    await refreshAiStatus();
    await refreshAiModelPicker();
    addMsg({ who: 'SYSTEM', tag: 'MODE', text: `AI model applied: ${data?.applied?.model || model}`, kind: 'system' });
  } catch (e) {
    alert(`Could not apply model: ${String(e?.message || e)}`);
  }
}

// -------------------- Narrator Provider Picker (OpenAI / Grok / Ollama) --------------------
async function refreshAiNarratorControls(){
  if (!aiNarratorProviderSel || !aiNarratorModelInp) return;
  try {
    const [stResp, capsResp] = await Promise.all([
      fetch('/api/ai/status', { cache: 'no-store' }),
      fetch('/api/ai/caps', { cache: 'no-store' }).catch(()=>null),
    ]);
    if (!stResp.ok) throw new Error(`HTTP ${stResp.status}`);
    const st = await stResp.json();
    const caps = capsResp ? await capsResp.json().catch(()=>null) : null;

    const eff = st?.effective || {};
    const nProv = String(eff.narrator_provider || '').toLowerCase();
    const nBase = String(eff.narrator_base_url || '').toLowerCase();
    const nModel = String(eff.narrator_model || '').trim();

    let choice = 'ollama';
    if (nProv === 'ollama') choice = 'ollama';
    else if (nBase.includes('api.x.ai')) choice = 'grok';
    else if (nBase.includes('api.openai.com')) choice = 'openai';
    else choice = 'openai';

    aiNarratorProviderSel.value = choice;
    aiNarratorModelInp.value = nModel;
    aiNarratorModelInp.disabled = (choice === 'ollama');

    // Disable options when the key isn't present (booleans only, never shows the secret).
    try {
      const hasOpenAI = !!(caps?.keys?.openai || caps?.keys?.generic);
      const hasXai = !!(caps?.keys?.xai || caps?.keys?.generic);
      const opts = Array.from(aiNarratorProviderSel.querySelectorAll('option'));
      for (const o of opts) {
        if (o.value === 'openai') o.disabled = !hasOpenAI;
        if (o.value === 'grok') o.disabled = !hasXai;
      }
    } catch {}

    if (aiNarratorApplyBtn) aiNarratorApplyBtn.disabled = (mode === 'multi' && !isHost);
  } catch {
    // If server isn't reachable yet, keep UI usable.
    try {
      aiNarratorProviderSel.value = 'ollama';
      aiNarratorModelInp.value = '';
      aiNarratorModelInp.disabled = true;
    } catch {}
  }
}

async function applyNarratorConfig(opts = {}){
  if (!aiNarratorProviderSel) return;
  const auto = !!opts.auto;

  if (mode === 'multi' && !isHost) {
    // Don't spam alerts during normal play.
    if (!auto) alert('Only the host can change the narrator backend.');
    return;
  }

  const provider = String(aiNarratorProviderSel.value || 'ollama');
  let model = String(aiNarratorModelInp?.value || '').trim();

  // Hosted providers: allow blank model (server will auto-pick a valid one).
  // Also: prevent obvious Ollama tags from being sent to hosted APIs.
  if (provider === 'ollama') {
    model = '';
  } else {
    if (!model || model.includes(':')) model = '';
  }

  try {
    const resp = await fetch('/api/ai/narrator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, model })
    });
    const data = await resp.json().catch(()=>({}));
    if (!resp.ok || !data?.ok) throw new Error(data?.error || `HTTP ${resp.status}`);
    await refreshAiStatus();
    await refreshAiModelPicker();
    await refreshAiNarratorControls();
    const ap = data?.applied || {};
    addMsg({ who: 'SYSTEM', tag: 'MODE', text: `Narrator backend applied: ${(ap.narrator_base_url || ap.narrator_provider || provider)}${ap.narrator_model ? ` • ${ap.narrator_model}` : ''}`, kind: 'system' });
  } catch (e) {
    if (!auto) alert(`Could not apply narrator backend: ${String(e?.message || e)}`);
  }
}


openSettingsBtn?.addEventListener("click", async () => {
  syncUiControls();
  openDrawer();
  await refreshAiModelPicker();
  await refreshAiNarratorControls();
});
closeSettingsBtn?.addEventListener("click", closeDrawer);
uiDoneBtn?.addEventListener("click", closeDrawer);
drawerBackdrop?.addEventListener("click", closeDrawer);
window.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });

aiModelRefreshBtn?.addEventListener('click', () => refreshAiModelPicker());
aiModelApplyBtn?.addEventListener('click', () => applyAiModelSelection());
aiNarratorProviderSel?.addEventListener('change', async () => {
  const provider = String(aiNarratorProviderSel.value || 'ollama');

  try {
    if (aiNarratorModelInp) {
      aiNarratorModelInp.disabled = (provider === 'ollama');

      // If they switch from local -> hosted and the model looks like an Ollama tag, clear it.
      if (provider !== 'ollama') {
        const cur = String(aiNarratorModelInp.value || '').trim();
        if (!cur || cur.includes(':')) aiNarratorModelInp.value = '';
        aiNarratorModelInp.placeholder = 'Auto (server will pick a valid model)';
      } else {
        aiNarratorModelInp.value = '';
        aiNarratorModelInp.placeholder = '';
      }
    }
  } catch {}

  // Auto-apply on selection change (singleplayer or host only).
  try {
    if (mode !== 'multi' || isHost) {
      await applyNarratorConfig({ auto: true });
    }
  } catch {}
});

aiNarratorApplyBtn?.addEventListener('click', () => applyNarratorConfig());

uiThemeSel?.addEventListener("change", () => commitUi({ theme: uiThemeSel.value }));
uiAccentInp?.addEventListener("input", () => commitUi({ accent: uiAccentInp.value }));
uiLayoutSel?.addEventListener("change", () => commitUi({ layout: uiLayoutSel.value }));
uiReaderModeChk?.addEventListener("change", () => { commitUi({ readerMode: !!uiReaderModeChk.checked }); if (viewMode === 'book') refreshBook(); });
uiReaderStyleSel?.addEventListener("change", () => { commitUi({ readerStyle: uiReaderStyleSel.value }); if (viewMode === 'book') refreshBook(); });
uiRadiusRange?.addEventListener("input", () => commitUi({ radius: Number(uiRadiusRange.value) }));
uiGlassRange?.addEventListener("input", () => commitUi({ glass: Number(uiGlassRange.value) }));
uiFontRange?.addEventListener("input", () => commitUi({ font: Number(uiFontRange.value) }));
uiInputRange?.addEventListener("input", () => commitUi({ input: Number(uiInputRange.value) }));
uiReduceMotionChk?.addEventListener("change", () => commitUi({ reduceMotion: !!uiReduceMotionChk.checked }));
uiWindowedChk?.addEventListener("change", () => {
  // This toggle now means: "unlock layout editing (drag/resize)".
  // The layout itself should *stay put* even when editing is off.
  try { localStorage.setItem(WINDOWED_KEY, uiWindowedChk.checked ? "1" : "0"); } catch {}
  try { document.body.dataset.layoutEdit = uiWindowedChk.checked ? "1" : "0"; } catch {}
  // If the player enables editing, ensure windowed layout is active immediately.
  if (uiWindowedChk.checked) {
    try { document.body.dataset.windowed = "1"; } catch {}
    try { initPlayerLayout(); } catch {}
  }
});
uiResetBtn?.addEventListener("click", () => { commitUi({ ...UI_DEFAULTS }); syncUiControls(); });

let socket = null;
let showSystem = (lsGet('aetheryn_show_system') ?? '0') === '1';
let showCanon = (lsGet('aetheryn_show_canon') ?? '0') === '1';

let viewMode = (lsGet('aetheryn_view_mode') || 'play');
// normalize persisted view
if (!['play','lobby','chat','map','book'].includes(viewMode)) viewMode = 'play';
let bookPollTimer = null;

let joined = false;
let currentLocRaw = "START";
let currentHouseAsset = null;
let currentCanonTokens = [];
let playLockedForStats = false;
let playLockedForRoll = false;
let playLockedForTurn = false;
let pendingStatKey = null; // when using the in-modal forge buttons

let mode = "single"; // "single" | "multi"
let activeRoomId = null;
let isHost = false;
let serverIntakeGlobalPresent = false;
let currentRunId = 0;

// --- Multiplayer client performance guard ---
// Non-host clients should stay snappy even on weak GPUs/CPUs.
// We auto-enable a lighter visual mode (no blur, static background, fewer expensive effects).
function applyAutoPerfLite(){
  try {
    const on = (mode === 'multi' && !isHost);
    document.body.classList.toggle('perf-lite', on);
  } catch {}
}

// -------------------- Intake Question Set (locked order) --------------------
// Based on 08_INTAKE_PROTOCOL_CONSOLIDATED.md locked questions Q0-Q14.
// Web UI collects answers in order and submits a structured packet to the ruleskeeper.
const Q_GLOBAL = [
    {
    id: "q1",
    label: "Party size: How many human players are playing in this campaign right now? (1–8)",
    type: "number",
    min: 1,
    max: 8
  },
  {
    id: "q2",
    label: "NPC companions: How many non-player party members travel with the group at the start? (0–20)",
    type: "number",
    min: 0,
    max: 20
  },
  {
    id: "q3",
    label: "Starting formation: Are the players beginning the story together as a group, or are they separated and will meet later? (Ignored automatically if there is only 1 player and 0 NPC companions.)",
    type: "choice",
    options: ["Together (same starting scene)", "Separated (meet later)"]
  },
  {
    id: "q4",
    label: "Campaign length: How long should this campaign be? (1–12; higher = longer story arc)",
    type: "number",
    min: 1,
    max: 12
  },
  {
    id: "q5",
    label: "Pacing: How fast should events unfold? (1–10; 1 = slow/roleplay-heavy, 10 = rapid/action-heavy)",
    type: "number",
    min: 1,
    max: 10
  },
  {
    id: "q6",
    label: "Difficulty: How punishing should the world be? (1–10; 1 = forgiving, 10 = brutal)",
    type: "number",
    min: 1,
    max: 10
  },
  {
    id: "q7",
    label: "Realism severity: How strictly should consequences and realism apply? (1–10; higher = harsher injuries, scarcity, and long-term consequences)",
    type: "number",
    min: 1,
    max: 10
  },
  {
    id: "q8",
    label: "Adult content intensity: How intense should mature themes be? (1–10; 1 = minimal, 10 = very intense).",
    type: "number",
    min: 1,
    max: 10
  },
];

const Q_PER_PLAYER = [
  {
    id: "q9",
    label: "Character name: What is your character's name? (By default, we use the name you typed when joining the server.)",
    type: "text",
    defaultFromJoinName: true
  },
  {
    id: "q10",
    label: "Character age: How old is your character? (Must be 18 or older.)",
    type: "number",
    min: 18,
    max: 200
  },
  {
    id: "q11",
    label: "Magic status: Is your character Touched (can wield magic) or Untouched (no magic)?",
    type: "choice",
    options: ["Touched (uses magic)", "Untouched (no magic)"]
  },
  {
    id: "q12",
    label: "Magic affinity: If Touched, what is your primary affinity/class? (Skipped automatically if Untouched.)",
    type: "choice",
    options: ["Fire", "Water", "Air", "Earth", "Soul", "Aether"],
    optionalWhen: { q11: "Untouched (no magic)" }
  },
  {
    id: "q13",
    label: "Archetype/class: What is your character's role or class? (Examples: Street-Savant, Knight-Errant, Herbalist, Tracker, Scholar, etc.)",
    type: "text"
  },
  {
    id: "q14",
    label: "Background/job: What did your character do before the story begins? (A past job, calling, or life situation—anything that shapes them.)",
    type: "text"
  },
  {
    id: "q15",
    label: "Starting position: Are you starting the opening scene with the party, or separately? (This is per-character so the host can’t decide for you.)",
    type: "choice",
    options: ["Start with party", "Start separately"]
  },
];

const PLAYER_FORM_STEP_COUNT = 1;

const SCALE_HELP = {
  q1: { title: "Players", left: "1 = solo", mid: "3 = classic party", right: "8 = chaos choir" },
  q2: { title: "NPC companions", left: "0 = none", mid: "2 = small crew", right: "8 = entourage" },
  q4: { title: "Campaign length", left: "1 = short arc", mid: "6 = campaign arc", right: "12 = saga" },
  q5: { title: "Pacing", left: "1 = slow / roleplay-heavy", mid: "5 = balanced", right: "10 = rapid / action-heavy" },
  q6: { title: "Difficulty", left: "1 = forgiving", mid: "5 = risky", right: "10 = brutal" },
  q7: { title: "Realism severity", left: "1 = cinematic", mid: "5 = grounded", right: "10 = harsh scarcity + lasting wounds" },
  q8: { title: "Mature themes", left: "1 = minimal", mid: "5 = present", right: "10 = intense" },
};

const APPEAR_SUGGEST = {
  eyes: ["amber","blue","brown","grey","green","hazel","violet","black","silver"],
  hair: ["black","brown","blonde","red","white","grey","auburn","silver","blue","green"],
  body: ["slim","athletic","stocky","curvy","lean","broad","towering","compact"],
};

let intake = {
  step: 0,
  phase: "global", // global | player | done
  answersGlobal: {},
  answersPlayer: {}, // legacy (single)
  answersPlayers: [],
  devicePlayers: 1,
  activePlayerIdx: 0,
};

function uuid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

function setConn(connected) {
  connDot.classList.toggle("on", connected);
  connDot.classList.toggle("off", !connected);
  connText.textContent = connected ? "Connected" : "Disconnected";
  if (!connected) {
    setAiStatusUnknown();
    try { setAiWait(false); } catch {}
  }
  try { updateSaveButtons(); } catch {}
}


function updateSaveButtons(){
  const on = !!(joined && String(activeRoomId || '').trim());
  try {
    if (saveGameBtn) {
      saveGameBtn.disabled = !on;
      saveGameBtn.title = on ? `Save room ${activeRoomId}` : 'Join a room to save';
    }
    if (saveAlwaysBtn) {
      saveAlwaysBtn.disabled = !on;
      saveAlwaysBtn.title = on ? `Save room ${activeRoomId}` : 'Join a room to save';
    }

    if (exportGameBtn) {
      exportGameBtn.disabled = !on;
      exportGameBtn.title = on ? `Export save ${activeRoomId}` : 'Join a room to export';
    }
    if (craftBtn) {
      craftBtn.disabled = !on;
      craftBtn.title = on ? 'Crafting' : 'Join a room to craft';
    }
  } catch {}
}

function setAiStatusUnknown(){
  if (!aiStatusEl) return;
  aiStatusEl.textContent = "AI: —";
  aiStatusEl.title = "AI status unavailable";
}

// -------------------- AI "thinking" indicator --------------------
let aiWaitState = { on: false, phase: "", since: 0 };
let aiWaitTimer = null;

function setAiWait(on, phase = "", detail = "") {
  aiWaitState.on = !!on;
  aiWaitState.phase = String(phase || "");
  if (aiWaitState.on && !aiWaitState.since) aiWaitState.since = Date.now();
  if (!aiWaitState.on) aiWaitState.since = 0;

  if (!aiWaitEl) return;

  if (!aiWaitState.on) {
    aiWaitEl.classList.add('hidden');
    try { if (aiCancelBtn) aiCancelBtn.disabled = true; } catch {}
    if (aiWaitTimer) { clearInterval(aiWaitTimer); aiWaitTimer = null; }
    return;
  }

  aiWaitEl.classList.remove('hidden');
  try { if (aiCancelBtn) aiCancelBtn.disabled = false; } catch {}
  const phaseLabel = aiWaitState.phase ? ` • ${aiWaitState.phase}` : '';
  if (aiWaitLabelEl) aiWaitLabelEl.textContent = `Waiting for AI…${phaseLabel}`;

  // Keep the tooltip fresh with elapsed seconds.
  if (aiWaitTimer) clearInterval(aiWaitTimer);
  aiWaitTimer = setInterval(() => {
    try {
      if (!aiWaitState.on) return;
      const s = Math.max(0, Math.floor((Date.now() - (aiWaitState.since || Date.now())) / 1000));
      const ph = aiWaitState.phase ? `phase=${aiWaitState.phase}` : 'phase=?';
      const d = detail ? ` • ${detail}` : '';
      aiWaitEl.title = `AI working (${ph}) • ${s}s${d}`;
    } catch {}
  }, 500);
}


// AI cancel (unstick)
aiCancelBtn?.addEventListener('click', () => {
  try { if (!socket) connectSocketIfNeeded(); } catch {}
  try { if (socket && joined) socket.emit('ai_cancel'); } catch {}
  try { setAiWait(false); } catch {}
  try { addMsg({ who: 'SYSTEM', tag: 'AI', text: 'Cancel requested (if the AI was stuck).' }); } catch {}
});

function setCharTab(next, persist = true){
  if (!charTabBtns.length || !charPanels.length) return;
  const tab = String(next || 'vitals').toLowerCase();

  for (const b of charTabBtns) {
    const on = String(b.dataset.tab || '').toLowerCase() === tab;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  }
  for (const p of charPanels) {
    const on = String(p.dataset.panel || '').toLowerCase() === tab;
    p.classList.toggle('active', on);
  }

  if (persist) {
    try { localStorage.setItem('aetheryn_char_tab_v1', tab); } catch {}
  }
}

// Wire Character tab buttons
try {
  for (const b of (charTabBtns || [])) {
    b.type = "button";
    b.addEventListener("click", () => {
      const tab = String(b.dataset.tab || "vitals");
      setCharTab(tab);
    });
  }
  const savedTab = lsGet("aetheryn_char_tab_v1", "vitals");
  if (savedTab) setCharTab(savedTab, false);
} catch {}

// Consume inventory items (code-authoritative; no AI bookkeeping)
consumeBtn?.addEventListener('click', () => {
  if (!joined) return alert('Press Start first.');
  const item = String(consumeItemEl?.value || '').trim();
  const qty = Math.max(1, Math.min(999, Number(consumeQtyEl?.value || 1) || 1));
  if (!item) return alert('Type an item name first (example: Ration).');
  try { socket.emit('consume_item', { item, qty }); } catch {}
  addMsg({ who: 'SYSTEM', tag: 'INV', text: `Consume requested (${item} x${qty}).` });
});

// Equip / Unequip (code-authoritative)
equipBtn?.addEventListener('click', () => {
  if (!joined) return alert('Press Start first.');
  const slot = String(equipSlotEl?.value || '').trim();
  const item = String(equipItemEl?.value || '').trim();
  if (!slot) return alert('Pick a slot first.');
  if (!item) return alert('Type an item name first.');
  try { socket.emit('equip_item', { slot, item }); } catch {}
  addMsg({ who: 'SYSTEM', tag: 'EQ', text: `Equip requested (${slot} ← ${item}).` });
});

unequipBtn?.addEventListener('click', () => {
  if (!joined) return alert('Press Start first.');
  const slot = String(equipSlotEl?.value || '').trim();
  if (!slot) return alert('Pick a slot first.');
  try { socket.emit('unequip_item', { slot }); } catch {}
  addMsg({ who: 'SYSTEM', tag: 'EQ', text: `Unequip requested (${slot}).` });
});

restHereBtn?.addEventListener('click', () => {
  if (!currentHouseAsset) return;
  // Code-handled: restore vitals (if hp/mp/stamina tokens exist) when resting at an owned house.
  try {
    if (socket && joined) socket.emit('rest_at_house', { assetId: currentHouseAsset.id });
  } catch {}

  // Still narrate it for the story.
  const nm = currentHouseAsset.name || 'my house';
  const id = currentHouseAsset.id || '';
  const idp = id ? ` (asset ${id})` : '';
  sendText(`I rest at ${nm}${idp}. I secure the place, recover, and take proper time.`);
});

stashHereBtn?.addEventListener('click', () => {
  if (!currentHouseAsset) return;
  setCharTab('items');
  const nm = currentHouseAsset.name || 'my house';
  const id = currentHouseAsset.id || '';
  const idp = id ? ` (asset ${id})` : '';
  const tmpl = `I access my house stash at ${nm}${idp} and I store/retrieve: `;
  if (inputEl) {
    inputEl.value = tmpl;
    inputEl.focus();
    inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
  }
});

function stashMove(direction){
  if (!joined) return alert('Press Start first.');
  if (!currentHouseAsset) return;
  const item = String(stashItemEl?.value || '').trim();
  const qty = Math.max(1, Math.min(999, Number(stashQtyEl?.value || 1) || 1));
  if (!item) return alert('Type an item name first (example: Torch).');
  try {
    socket.emit('stash_transfer', { assetId: currentHouseAsset.id, direction, item, qty });
  } catch {}
}

stashDepositBtn?.addEventListener('click', () => stashMove('deposit'));
stashWithdrawBtn?.addEventListener('click', () => stashMove('withdraw'));


async function refreshAiStatus(){
  if (!aiStatusEl) return;
  try {
    const resp = await fetch('/api/ai/status', { cache: 'no-store' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (!data || !data.ok) throw new Error('bad payload');

    const eff = data.effective || {};
    const provider = String(eff.narrator_provider || eff.rules_provider || 'unknown').toUpperCase();
    const model = String(eff.narrator_model || eff.rules_model || '').trim();
    aiStatusEl.textContent = `AI: ${provider}${model ? ` • ${model}` : ''}`;

    const tips = [];
    if (eff.rules_model) tips.push(`Rules: ${String(eff.rules_provider || 'unknown').toUpperCase()} • ${eff.rules_model}`);
    if (eff.book_model) tips.push(`Book: ${String(eff.book_provider || 'unknown').toUpperCase()} • ${eff.book_model}`);

    if (data.ollama && data.ollama.url) tips.push(`Ollama URL: ${data.ollama.url}`);
    if (data.ollama && data.ollama.reachable === false) tips.push('Ollama: not reachable');
    if (data.ollama && Array.isArray(data.ollama.models) && data.ollama.models.length) {
      tips.push(`Installed: ${data.ollama.models.length} model(s)`);
    }
    aiStatusEl.title = tips.join(' | ') || 'AI status';
  } catch {
    setAiStatusUnknown();
  }
}

// -------------------- Per-character Play log (POV-safe for online + couch) --------------------
// We keep a separate message stream per local character. This prevents POV bleed in couch co-op
// and makes it possible to show only the local roster in online multiplayer.

const __LOG_STORE = new Map(); // roomId -> { sys: [], shared: [], byChar: Map(lowerName -> msg[]) }

function _getLogStore(roomId){
  const rid = String(roomId || activeRoomId || '').trim();
  if (!rid) return { sys: [], shared: [], byChar: new Map() };
  if (!__LOG_STORE.has(rid)) __LOG_STORE.set(rid, { sys: [], shared: [], byChar: new Map() });
  return __LOG_STORE.get(rid);
}

function _storeMsg(roomId, scopeName, msg, isSystem, isShared){
  const rid = String(roomId || activeRoomId || '').trim();
  const st = _getLogStore(rid);
  const rec = { who: msg.who || '', tag: msg.tag || '', text: msg.text || '', kind: msg.kind || '', ts: Date.now(), meta: msg.meta || null };

  if (isSystem) {
    st.sys.push(rec);
    if (st.sys.length > 200) st.sys.splice(0, st.sys.length - 200);
    return;
  }

  if (isShared) {
    if (!Array.isArray(st.shared)) st.shared = [];
    st.shared.push(rec);
    if (st.shared.length > 260) st.shared.splice(0, st.shared.length - 260);
    return;
  }

  if (!scopeName) {
    st.sys.push(rec);
    if (st.sys.length > 200) st.sys.splice(0, st.sys.length - 200);
    return;
  }

  const key = String(scopeName || '').trim().toLowerCase();
  if (!key) {
    st.sys.push(rec);
    if (st.sys.length > 200) st.sys.splice(0, st.sys.length - 200);
    return;
  }

  if (!st.byChar.has(key)) st.byChar.set(key, []);
  const arr = st.byChar.get(key);
  arr.push(rec);
  if (arr.length > 350) arr.splice(0, arr.length - 350);
}

function _visiblePlayStream(roomId){
  const rid = String(roomId || activeRoomId || '').trim();
  const st = _getLogStore(rid);
  const byChar = (st && st.byChar instanceof Map) ? st.byChar : new Map();
  const nonEmpty = [];
  for (const [k, arr] of byChar.entries()) {
    const rows = Array.isArray(arr) ? arr : [];
    if (rows.length) nonEmpty.push([String(k || '').trim().toLowerCase(), rows]);
  }

  let activeName = '';
  let activeKey = '';
  try {
    activeName = String(getMyCharName(rid) || '').trim();
    activeKey = activeName ? activeName.toLowerCase() : '';
  } catch {
    activeName = '';
    activeKey = '';
  }
  if (activeKey && byChar.has(activeKey)) {
    const arr = Array.isArray(byChar.get(activeKey)) ? byChar.get(activeKey) : [];
    if (arr.length) return { key: activeKey, name: activeName, arr, reason: 'active' };
  }

  let localNames = [];
  try { localNames = (typeof getMyCharNames === 'function') ? (getMyCharNames(rid) || []) : []; } catch { localNames = []; }
  for (const nm0 of (localNames || [])) {
    const nm = String(nm0 || '').trim();
    const key = nm.toLowerCase();
    if (!nm || !key || !byChar.has(key)) continue;
    const arr = Array.isArray(byChar.get(key)) ? byChar.get(key) : [];
    if (!arr.length) continue;
    if (!activeKey) {
      try { setMyCharName(rid, nm); } catch {}
    }
    return { key, name: nm, arr, reason: 'local-roster' };
  }

  if (nonEmpty.length === 1) {
    const [key, arr] = nonEmpty[0];
    const guessed = (localNames || []).find(n => String(n || '').trim().toLowerCase() === key) || key;
    if (!activeKey && ((!localNames || !localNames.length) || localNames.length === 1)) {
      try { setMyCharName(rid, guessed); } catch {}
    }
    return { key, name: guessed, arr, reason: 'sole-stream' };
  }

  if (nonEmpty.length > 1) {
    nonEmpty.sort((a, b) => {
      const ats = Number(a?.[1]?.[a[1].length - 1]?.ts || 0);
      const bts = Number(b?.[1]?.[b[1].length - 1]?.ts || 0);
      return bts - ats;
    });
    const [key, arr] = nonEmpty[0];
    return { key, name: key, arr, reason: 'latest-fallback' };
  }

  return { key: '', name: '', arr: [], reason: 'none' };
}

function _countVisiblePlayMsgs(roomId){
  const rid = String(roomId || activeRoomId || '').trim();
  const st = _getLogStore(rid);
  let n = Array.isArray(st?.shared) ? st.shared.length : 0;
  try {
    if (st?.byChar instanceof Map) {
      for (const arr of st.byChar.values()) {
        n += Array.isArray(arr) ? arr.length : 0;
      }
    }
  } catch {}
  return n;
}

function renderPlayLog(roomId){
  const rid = String(roomId || activeRoomId || '').trim();
  if (!logEl) return;
  const st = _getLogStore(rid);
  const visible = _visiblePlayStream(rid);

  logEl.innerHTML = '';

  const renderOne = ({ who, tag, text, kind, meta }) => {
    const div = document.createElement('div');
    div.className = `msg ${kind || ''}`;
    div.innerHTML = `
      <div class="meta">
        <span class="tag">${escapeHtml(tag || 'LOG')}</span>
        <span>${escapeHtml(who || '')}</span>
      </div>
      <div class="body"></div>
    `;
    const bodyEl = div.querySelector('.body');
    bodyEl.innerText = text || '';

    // Inline interaction widgets (trade + quick replies). These do NOT advance turns/time.
    try {
      const rid2 = String(roomId || activeRoomId || '').trim();
      const myChars = (typeof getMyCharNames === 'function') ? (getMyCharNames(rid2) || []) : [];
      const mySet = new Set((myChars || []).map(n => String(n||'').trim().toLowerCase()).filter(Boolean));

      // Trade request card: Accept/Decline only visible to the target controller.
      if (String(kind || '').toLowerCase() === 'trade' && meta && meta.tradeId) {
        const status = String(meta.status || 'pending');
        const toName = String(meta.to || '').trim();
        const canAct = toName && mySet.has(toName.toLowerCase());

        const box = document.createElement('div');
        box.className = 'tradeBox';
        const summary = document.createElement('div');
        summary.className = 'tradeSummary';
        summary.textContent = String(meta.summary || '').trim();
        if (summary.textContent) box.appendChild(summary);

        if (status === 'pending' && canAct) {
          const row = document.createElement('div');
          row.className = 'tradeBtns';

          const btnA = document.createElement('button');
          btnA.className = 'ghost small';
          btnA.textContent = 'Accept';
          btnA.onclick = () => {
            try {
              if (!socket) connectSocketIfNeeded();
              if (!socket) return;
              socket.emit('trade_response', { tradeId: meta.tradeId, accept: true, actor: toName });
              meta.status = 'responded';
              renderPlayLog(rid2);
            } catch {}
          };

          const btnD = document.createElement('button');
          btnD.className = 'ghost small';
          btnD.textContent = 'Decline';
          btnD.onclick = () => {
            try {
              if (!socket) connectSocketIfNeeded();
              if (!socket) return;
              socket.emit('trade_response', { tradeId: meta.tradeId, accept: false, actor: toName });
              meta.status = 'responded';
              renderPlayLog(rid2);
            } catch {}
          };

          row.appendChild(btnA);
          row.appendChild(btnD);
          box.appendChild(row);
        } else if (status && status !== 'pending') {
          const stEl = document.createElement('div');
          stEl.className = 'tradeStatus';
          stEl.textContent = `Status: ${status}`;
          box.appendChild(stEl);
        }

        bodyEl.appendChild(document.createElement('br'));
        bodyEl.appendChild(box);
      }

      // Party quick message reply helper.
      if (String(kind || '').toLowerCase() === 'party' && meta && meta.from && meta.kind) {
        const fromNm = String(meta.from || '').trim();
        const k2 = String(meta.kind || '').trim().toLowerCase();
        const isReplyable = (k2 === 'talk' || k2 === 'plan') && fromNm && !mySet.has(fromNm.toLowerCase());
        if (isReplyable) {
          const row = document.createElement('div');
          row.className = 'partyBtns';
          const btnR = document.createElement('button');
          btnR.className = 'ghost small';
          btnR.textContent = 'Reply';
          btnR.onclick = () => {
            try {
              const txt = String(prompt(`Reply to ${fromNm}:`) || '').trim();
              if (!txt) return;
              if (!socket) connectSocketIfNeeded();
              if (!socket) return;
              socket.emit('party_quick', { kind: 'talk', text: txt, target: fromNm });
            } catch {}
          };
          row.appendChild(btnR);
          bodyEl.appendChild(document.createElement('br'));
          bodyEl.appendChild(row);
        }
      }
    } catch {}

    logEl.appendChild(div);
  };

  if (showSystem) {
    for (const m of (st.sys || [])) renderOne(m);
  }

  // Shared stream: visible across POV tabs (used for shared scene text + party quick actions).
  for (const m of (st.shared || [])) renderOne(m);

  for (const m of (visible.arr || [])) renderOne(m);

  logEl.scrollTop = logEl.scrollHeight;
}

function markTradeInLogs(roomId, tradeId, status){
  try {
    const rid = String(roomId || activeRoomId || '').trim();
    if (!rid || !tradeId) return;
    const st = _getLogStore(rid);
    const want = String(tradeId).trim();
    const applyArr = (arr) => {
      for (const m of (arr || [])) {
        if (!m || !m.meta || !m.meta.tradeId) continue;
        if (String(m.meta.tradeId).trim() !== want) continue;
        m.meta.status = String(status || 'done');
      }
    };
    applyArr(st.shared);
    for (const arr of st.byChar.values()) applyArr(arr);
    renderPlayLog(rid);
  } catch {}
}

try { window.AETH_LOG = { render: renderPlayLog, store: __LOG_STORE, markTrade: markTradeInLogs }; } catch {}

function addMsg({ who, tag, text, kind, povChar, meta }) {
  const t = (tag || '').toUpperCase();
  const isSystem = (who || '').toUpperCase() === 'SYSTEM' || ['SYSTEM','STATE','MODE','INTAKE'].includes(t);

  const rid = String(activeRoomId || '').trim();
  let scope = String(povChar || '').trim();

  // Shared stream: any non-system message without an explicit povChar is treated as shared scene text.
  // This prevents couch co-op POV switching from showing a blank log.
  const isShared = (!isSystem && !scope);

  if (!scope && !isSystem && !isShared) {
    try { scope = String(getMyCharName(rid) || '').trim(); } catch { scope = ''; }
  }

  _storeMsg(rid, scope, { who, tag, text, kind, meta }, !!isSystem, !!isShared);
  renderPlayLog(rid);

  // Optional: read narration aloud (client-side TTS).
  try {
    if (window.AETH_TTS && typeof window.AETH_TTS.onMsg === 'function') {
      window.AETH_TTS.onMsg({ who, tag, text, kind });
    }
  } catch {}
}

// -------------------- Stat Allocation Gate (mode:STATS) --------------------
const STAT_KEYS = ["STRIKE","GUARD","VELOCITY","SIGHT","WILL","ECHO"];

// Pending stat rolls are server authoritative, but the client caches them so a
// modal close/reopen doesn't "wipe" what you already rolled (common in couch co-op).
let __statsPendingCache = Object.create(null);

function _statsPendingStorageKey(roomId, charName){
  const rid = String(roomId || activeRoomId || '').trim();
  const nm = String(charName || '').trim();
  if (!rid || !nm) return '';
  return `aetheryn_stats_pending_v1__${rid}__${nm.toLowerCase()}`;
}

function cacheStatsPending(roomId, charName, pending){
  const k = _statsPendingStorageKey(roomId, charName);
  if (!k) return;
  if (!pending || typeof pending !== 'object') return;
  __statsPendingCache[k] = pending;
  try { localStorage.setItem(k, JSON.stringify(pending)); } catch {}
}

function getCachedStatsPending(roomId, charName){
  const k = _statsPendingStorageKey(roomId, charName);
  if (!k) return null;
  const mem = __statsPendingCache[k];
  if (mem && typeof mem === 'object') return mem;
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (v && typeof v === 'object') {
      __statsPendingCache[k] = v;
      return v;
    }
  } catch {}
  return null;
}

function hasMode(tokens, want) {
  const w = String(want || "").trim().toLowerCase();
  if (!w) return false;
  return (tokens || []).some(t => {
    const s = String(t || "").trim().toLowerCase();
    return s === `mode:${w}` || s === `mode=${w}`;
  });
}

function parsePcStatsForMe(tokens) {
  const me = String(getMyCharName() || "").trim();
  if (!me) return null;
  const meLow = me.toLowerCase();

  for (const t of (tokens || [])) {
    const s = String(t || "").trim();
    const low = s.toLowerCase();
    if (!low.startsWith("pc:")) continue;

    const pipeIdx = s.indexOf("|");
    const namePart = (pipeIdx === -1 ? s.slice(3) : s.slice(3, pipeIdx)).trim();
    if (!namePart || namePart.toLowerCase() !== meLow) continue;

    const statsIdx = low.indexOf("|stats:");
    if (statsIdx === -1) continue;

    const raw = s.slice(statsIdx + 7).trim(); // after "|stats:"
    const parts = raw.split(/[;|,]+/).map(x => x.trim()).filter(Boolean);
    const out = {};
    for (const p of parts) {
      const m = p.match(/^([A-Za-z]{2,8})\s*[:=]\s*(\d{1,2})\s*$/);
      if (m) out[m[1].toUpperCase()] = Number(m[2]);
    }
    return out;
  }
  return null;
}

function myStatsArePresent(tokens) {
  const pc = parsePcStatsForMe(tokens);
  if (!pc) return false;
  return STAT_KEYS.every(k => Number.isFinite(pc[k]));
}

function applyInteractionLock() {
  const locked = !!(playLockedForStats || playLockedForRoll || playLockedForTurn);
  try { sendBtn.disabled = locked; } catch {}
  try { inputEl.disabled = locked; } catch {}
  try { freeformBtn.disabled = locked; } catch {}

  // Disable choice buttons if present
  try {
    const btns = choicesEl ? Array.from(choicesEl.querySelectorAll("button")) : [];
    for (const b of btns) b.disabled = locked;
  } catch {}

  // If locked (stats or roll), keep the choice dock out of view (prevents weird turn-skips).
  try {
    const dock = document.querySelector(".choiceDock");
    const hideDock = !!(playLockedForStats || playLockedForRoll);
    if (dock) dock.classList.toggle("hidden", hideDock);
  } catch {}
}

function setPlayLock(locked) {
  playLockedForStats = !!locked;
  applyInteractionLock();
}

function setRollLock(locked) {
  playLockedForRoll = !!locked;
  applyInteractionLock();
}

function setTurnLock(locked) {
  playLockedForTurn = !!locked;
  applyInteractionLock();
}


function renderStatsDiceForm(pending = null) {
  if (!statsBodyEl) return;

  const gridId = "statsGrid";
  const resId = "statsResult";
  statsBodyEl.innerHTML = `
    <div class="statsGrid" id="${gridId}"></div>
    <div class="statsHint">
      Roll each stat <b>one time</b>. The server locks each row the moment you roll it.
      <br/>When all six totals are filled, click <b>Lock Stats</b>.
    </div>
    <div class="statsResult" id="${resId}" style="display:none"><pre></pre></div>
  `;

  const grid = document.getElementById(gridId);
  if (!grid) return;

  for (const key of STAT_KEYS) {
    const row = document.createElement("div");
    row.className = "statRow";
    row.dataset.stat = key;
    row.innerHTML = `
      <div class="label">${key}</div>
      <input class="die" inputmode="numeric" type="number" min="1" max="6" placeholder="d6" disabled>
      <input class="die" inputmode="numeric" type="number" min="1" max="6" placeholder="d6" disabled>
      <input class="die" inputmode="numeric" type="number" min="1" max="6" placeholder="d6" disabled>
      <div class="total" data-total="${key}">—</div>
      <button type="button" class="ghost tiny rollStatBtn" data-rollstat="${key}" title="Roll 3d6 for ${key}">Roll</button>
    `;
    grid.appendChild(row);
  }

  // Apply pending values (from server) if any
  try { applyPendingToStatsForm(pending); } catch {}

  // Per-stat Roll buttons (server enforced: one roll per stat)
  grid.querySelectorAll("button.rollStatBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = String(btn.getAttribute("data-rollstat") || "").trim().toUpperCase();
      if (!key) return;
      if (!socket) connectSocketIfNeeded();
      if (!socket) return;
      btn.disabled = true;
      // Include the currently selected character so couch co-op can't drift back to Player 1.
      const actor = String((window.__statsActor || getMyCharName(activeRoomId) || '')).trim();
      socket.emit("stats_roll_one", { statKey: key, charName: actor });
      setTimeout(() => { try { btn.disabled = false; } catch {} }, 1500); // if server rejects, it re-enables via applyPendingToStatsForm
    });
  });

  // Lock Stats enabled only when all six totals exist
  try { updateStatsSubmitEnabled(); } catch {}
}

function applyPendingToStatsForm(pending = null){
  if (!statsBodyEl) return;
  const grid = statsBodyEl.querySelector("#statsGrid");
  if (!grid) return;

  const rolls = pending && pending.rolls && typeof pending.rolls === "object" ? pending.rolls : null;
  const totals = pending && pending.totals && typeof pending.totals === "object" ? pending.totals : null;

  for (const key of STAT_KEYS){
    const row = grid.querySelector(`.statRow[data-stat="${key}"]`);
    if (!row) continue;

    const inputs = Array.from(row.querySelectorAll("input.die"));
    const totEl = row.querySelector(`[data-total="${key}"]`);
    const btn = row.querySelector(`button.rollStatBtn[data-rollstat="${key}"]`);
    const r = rolls && Array.isArray(rolls[key]) ? rolls[key].map(n=>Number(n)) : null;
    const t = totals && Number.isFinite(Number(totals[key])) ? Number(totals[key]) : null;

    if (r && r.length === 3 && r.every(n => Number.isFinite(n))) {
      for (let i=0;i<3;i++){
        if (inputs[i]) inputs[i].value = String(r[i]);
      }
    }

    if (t !== null) {
      if (totEl) totEl.textContent = String(t);
      if (btn) btn.disabled = true; // rolled once: locked
    } else {
      if (totEl) totEl.textContent = "—";
      if (btn) btn.disabled = false;
    }
  }

  updateStatsSubmitEnabled();
}

function updateStatsSubmitEnabled(){
  if (!statsSubmitBtn || !statsBodyEl) return;
  const grid = statsBodyEl.querySelector("#statsGrid");
  if (!grid) { statsSubmitBtn.disabled = true; return; }
  let ok = true;
  for (const key of STAT_KEYS){
    const totEl = grid.querySelector(`.total[data-total="${key}"]`);
    const v = totEl ? Number(String(totEl.textContent||"").trim()) : NaN;
    if (!Number.isFinite(v)) { ok = false; break; }
  }
  statsSubmitBtn.disabled = !ok;
}

function applyStatsRollOneResult(payload = {}){
  if (!payload) return;
  const pending = payload.pending || null;
  applyPendingToStatsForm(pending);
}

function collectStatsRollsFromInputs(strict = true) {
  const grid = statsBodyEl ? statsBodyEl.querySelector("#statsGrid") : null;
  if (!grid) throw new Error("Stat form not ready.");

  const rows = Array.from(grid.querySelectorAll(".statRow"));
  const rolls = {};
  for (let i = 0; i < STAT_KEYS.length; i++) {
    const key = STAT_KEYS[i];
    const row = rows[i];
    const dice = Array.from(row.querySelectorAll("input.die")).map(x => Number(x.value));
    if (strict) {
      if (dice.some(n => !Number.isFinite(n))) throw new Error(`Missing dice for ${key}.`);
      if (dice.some(n => n < 1 || n > 6)) throw new Error(`Dice for ${key} must be 1–6.`);
      if (dice.length !== 3) throw new Error(`Need 3 dice for ${key}.`);
    }
    rolls[key] = dice.filter(n => Number.isFinite(n));
  }
  return rolls;
}

function showStatsResult(payload) {
  const box = statsBodyEl ? statsBodyEl.querySelector("#statsResult") : null;
  if (!box) return;
  box.style.display = "block";
  const pre = box.querySelector("pre");
  if (!pre) return;

  const name = payload?.charName ? `Character: ${payload.charName}\n` : "";
  const method = payload?.method ? `Method: ${payload.method.toUpperCase()}\n` : "";
  const rolls = payload?.rolls || {};
  const totals = payload?.totals || {};
  const lines = [];
  for (const k of STAT_KEYS) {
    const r = rolls[k];
    const t = totals[k];
    if (Array.isArray(r) && r.length) lines.push(`${k}: [${r.join(", ")}] → ${t ?? "?"}`);
    else if (t != null) lines.push(`${k}: ${t}`);
  }
  pre.textContent = `${name}${method}${lines.join("\n")}`.trim();
}

function openStatsModal(payload = {}) {
  try { pendingStatKey = null; } catch {}
  if (!statsModal) return;

  const boundChar = String(payload?.charName || getMyCharName(activeRoomId) || "").trim();

  // Remember the currently bound actor for this modal (used by per-stat roll/lock to avoid drift).
  try { window.__statsActor = boundChar; } catch {}

  // Cache pending rolls so a manual close/reopen doesn't lose the in-progress grid.
  try {
    if (payload && payload.pending && boundChar) cacheStatsPending(activeRoomId, boundChar, payload.pending);
    if (payload && !payload.pending && boundChar) {
      const cached = getCachedStatsPending(activeRoomId, boundChar);
      if (cached) payload.pending = cached;
    }
  } catch {}

  // Surface which character is being rolled (vital for couch co-op).
  try {
    if (statsTitleEl) statsTitleEl.textContent = boundChar ? `Stat Allocation — ${boundChar}` : "Stat Allocation";
  } catch {}

  // If the server is asking for a specific character, bind the active character locally too.
  try {
    const nm = String(payload?.charName || '').trim();
    if (nm) setActiveCharacter(activeRoomId, nm);
  } catch {}

  const role = isHost ? "Host" : "Player";
  if (statsRoleBadge) statsRoleBadge.textContent = role;

  const inStats = (payload && (Object.prototype.hasOwnProperty.call(payload, "haveStats") || Object.prototype.hasOwnProperty.call(payload, "preference") || Object.prototype.hasOwnProperty.call(payload, "charName"))) ? true : hasMode(currentCanonTokens, "STATS");
  // Server is authoritative on whether the currently requested character has locked stats.
  // (Client tokens can be stale during reconnects / mid-transition.)
  const haveStats = (payload && Object.prototype.hasOwnProperty.call(payload, 'haveStats'))
    ? !!payload.haveStats
    : myStatsArePresent(currentCanonTokens);

  // In the stats gate, closing the modal is a footgun (it hides required UI).
  // Allow closing only when your stats are already locked.
  try {
    const inPlay = hasMode(currentCanonTokens, 'PLAY');
    const mustComplete = !haveStats && (inStats || inPlay);
    if (statsCloseBtn) {
      statsCloseBtn.disabled = !!mustComplete;
      statsCloseBtn.title = mustComplete ? 'Finish and lock stats to continue.' : 'Close';
    }
  } catch {}

  if (statsSubEl) {
    if (!inStats) statsSubEl.textContent = "Stat allocation is not required right now.";
    else if (haveStats) statsSubEl.textContent = boundChar ? `Locked for ${boundChar}. Waiting for others…` : "Locked. Waiting for others…";
    else statsSubEl.textContent = boundChar ? `Rolling for ${boundChar}. Roll your six abilities (one time each).` : "Roll your six abilities. No play until locked.";
  }

  // If we have a result payload, show it (and disable edits).
  if (payload && payload.totals) {
    renderStatsDiceForm(payload?.pending || null);
    showStatsResult(payload);
    try {
      statsBodyEl.querySelectorAll("input.die").forEach(i => i.disabled = true);
      if (statsSubmitBtn) statsSubmitBtn.disabled = true;
      if (statsRollAiBtn) statsRollAiBtn.disabled = true;
    } catch {}
  } else if (!haveStats) {
    renderStatsDiceForm(payload?.pending || null);
    // Enable only when all six totals exist. (renderStatsDiceForm() will compute this.)
    // Do NOT force-disable here or the Lock Stats button will never become clickable.
    try { updateStatsSubmitEnabled(); } catch {}
    if (statsRollAiBtn) statsRollAiBtn.disabled = false;
  } else {
    if (statsBodyEl) statsBodyEl.innerHTML = `<div class="statsHint">Locked. Waiting…</div>`;
    if (statsSubmitBtn) statsSubmitBtn.disabled = true;
    if (statsRollAiBtn) statsRollAiBtn.disabled = true;
  }

  statsModal.classList.remove("hidden");
}

function closeStatsModal() {
  try { pendingStatKey = null; } catch {}
  if (!statsModal) return;
  statsModal.classList.add("hidden");
}

function updateStatsGateFromTokens(tokens) {
  const inStats = hasMode(tokens, "STATS");
  const haveMine = myStatsArePresent(tokens);

  // Per-player enforcement: even if the room is in PLAY, you cannot act without locked stats.
  const inPlay = hasMode(tokens, "PLAY");
  const needStatsNow = (joined && inPlay && !haveMine);

  // In STATS phase, lock play for everyone (even if you already submitted).
  // In PLAY phase, lock only if *you* are missing stats.
  setPlayLock(inStats || needStatsNow);

  // If in stats phase: open modal either for rolling or waiting.
  if (inStats || needStatsNow) {
    if (!statsModal || !statsModal.classList.contains("hidden")) return;
    const nm = getMyCharName() || "";
    openStatsModal({ haveStats: haveMine, charName: nm, preference: "", pending: (nm ? getCachedStatsPending(activeRoomId, nm) : null) });
  } else {
    // Leaving stats phase: close modal automatically.
    closeStatsModal();
  }
}


// -------------------- Action Roll Gate (server-specified dice) --------------------
let actionRollPending = false;
let actionRollSpec = { sides: 6, count: 3, dropLowest: false, label: "Action Roll" };
let actionRollActor = '';

function rollRangeFromSpec(spec){
  const sides = Math.max(1, Math.floor(Number(spec?.sides) || 6));
  const count = Math.max(1, Math.floor(Number(spec?.count) || 1));
  const dropLowest = !!spec?.dropLowest;
  if (dropLowest && count >= 2) {
    return { min: 1 * (count - 1), max: sides * (count - 1), sides, count, dropLowest };
  }
  return { min: 1 * count, max: sides * count, sides, count, dropLowest };
}

function openActionRollModal(payload = null) {
  if (!actionRollModal) return;

  actionRollPending = true;

  try { actionRollActor = String(payload?.actor || '').trim(); } catch { actionRollActor = ''; }

  const spec = payload && payload.spec ? payload.spec : null;
  actionRollSpec = {
    sides: Number(spec?.sides) || 6,
    count: Number(spec?.count) || 3,
    dropLowest: (spec ? !!spec.dropLowest : false),
    label: String(payload?.label || "Action Roll")
  };

  if (actionRollSubEl) {
    actionRollSubEl.textContent = String(payload?.note || "Roll the required dice, then submit the kept total.");
  }

  try {
    const r = rollRangeFromSpec(actionRollSpec);
    if (actionRollTotalEl) {
      actionRollTotalEl.min = String(r.min);
      actionRollTotalEl.max = String(r.max);
      actionRollTotalEl.placeholder = `${r.min}–${r.max}`;
    }
    const helpEls = actionRollModal ? Array.from(actionRollModal.querySelectorAll('.help')) : [];
    if (helpEls.length) {
      const how = `${r.count}d${r.sides}${r.dropLowest ? ' (drop lowest)' : ''}`;
      helpEls[0].innerHTML = `Roll <b>${how}</b>. If you roll real dice, type your final total below. Or press <b>AI Roll</b> to use the built-in roller.`;
    }
  } catch {}
  try { if (actionRollTotalEl) actionRollTotalEl.value = ""; } catch {}
  try {
    if (actionRollResultEl) {
      actionRollResultEl.style.display = "none";
      const pre = actionRollResultEl.querySelector("pre");
      if (pre) pre.textContent = "";
    }
  } catch {}

  setRollLock(true);
  actionRollModal.classList.remove("hidden");
}

function closeActionRollModal() {
  actionRollPending = false;
  if (!actionRollModal) return;
  actionRollModal.classList.add("hidden");
  setRollLock(false);
}

function showActionRollResult(text) {
  if (!actionRollResultEl) return;
  actionRollResultEl.style.display = "block";
  const pre = actionRollResultEl.querySelector("pre");
  if (pre) pre.textContent = String(text || "");
}

if (actionRollAiBtn) actionRollAiBtn.onclick = () => {
  if (!socket) connectSocketIfNeeded();
  requestDiceRoll({ sides: actionRollSpec.sides, count: actionRollSpec.count, modifier: 0, label: actionRollSpec.label || 'Action Roll', dropLowest: !!actionRollSpec.dropLowest });
};

if (actionRollSubmitBtn) actionRollSubmitBtn.onclick = () => {
  if (!socket) connectSocketIfNeeded();
  const v = Math.floor(Number(actionRollTotalEl ? actionRollTotalEl.value : NaN));
  const r = rollRangeFromSpec(actionRollSpec);
  if (!Number.isFinite(v)) {
    showActionRollResult(`Type your total (${r.min}–${r.max}), or click AI Roll.`);
    return;
  }
  if (v < r.min || v > r.max) {
    const how = `${r.count}d${r.sides}${r.dropLowest ? ' drop-lowest' : ''}`;
    showActionRollResult(`Total must be ${r.min}–${r.max} for ${how}.`);
    return;
  }
  socket.emit('action_roll_submit', { source: 'player', total: v, actor: actionRollActor || (getMyCharName(activeRoomId) || '') });
  showActionRollResult(`[submitted] ${v}`);
};


// -------------------- Turn Order (Initiative) --------------------
let turnState = { enabled: false, phase: 'OFF', active: '', order: [], expected: [], rolls: {}, round: 1 };
let turnOrderActor = '';
let turnOrderPending = false;

function updateTurnStatusPill() {
  if (!turnStatusEl) return;
  const phase = String(turnState?.phase || 'OFF').toUpperCase();
  const active = String(turnState?.active || '').trim();
  const tmode = String(turnState?.mode || 'SEQUENTIAL').toUpperCase();

  // Host controls
  try {
    if (turnRerollBtn) {
      const show = joined && mode === 'multi' && !!isHost && (phase === 'INIT' || (phase === 'ACTIVE' && tmode !== 'SIMULTANEOUS'));
      turnRerollBtn.classList.toggle('hidden', !show);
      turnRerollBtn.disabled = !show;
    }
  } catch {}

  // Simultaneous round controls
  try {
    if (turnReadyBtn) {
      const show = joined && tmode === 'SIMULTANEOUS' && phase === 'PLAN';
      turnReadyBtn.classList.toggle('hidden', !show);
      turnReadyBtn.disabled = !show;
    }
    if (turnResolveBtn) {
      const show = joined && tmode === 'SIMULTANEOUS' && phase === 'PLAN' && !!isHost;
      turnResolveBtn.classList.toggle('hidden', !show);
      turnResolveBtn.disabled = !show;
    }
  } catch {}

  if (phase === 'INIT') {
    const exp = Array.isArray(turnState.expected) ? turnState.expected.length : 0;
    const got = turnState.rolls ? Object.keys(turnState.rolls).length : 0;
    turnStatusEl.textContent = `Turn: initiative ${got}/${exp}`;
    {
      const missing = (turnState.expected || []).filter(n => !((turnState.rolls || {})[String(n||'').toLowerCase()] != null));
      turnStatusEl.title = missing.length ? ('Waiting on: ' + missing.join(', ')) : 'Waiting for initiative rolls';
    }
    return;
  }

  if (tmode === 'SIMULTANEOUS') {
    const round = Number(turnState.round || 1) || 1;
    const ready = Number(turnState.readyCount || 0) || 0;
    const total = Number(turnState.totalCount || 0) || 0;
    const ord = Array.isArray(turnState.order) ? turnState.order : [];
    const intents = (turnState.intents && typeof turnState.intents === 'object') ? turnState.intents : {};

    if (phase === 'PLAN') {
      turnStatusEl.textContent = `Round ${round}: intents ${ready}/${total || ord.length || 0}`;
      const missing = ord.filter(n => !intents[String(n || '')]);
      turnStatusEl.title = ord.length
        ? (`Order: ${ord.join(' → ')}${missing.length ? (' • Waiting: ' + missing.join(', ')) : ''}`)
        : `Round ${round} planning`;
      return;
    }
    if (phase === 'RESOLVING') {
      turnStatusEl.textContent = `Round ${round}: resolving…`;
      turnStatusEl.title = ord.length ? ('Order: ' + ord.join(' → ')) : `Round ${round} resolving`;
      return;
    }
  }

  if (phase === 'ACTIVE') {
    turnStatusEl.textContent = active ? `Turn: ${active}` : 'Turn: —';
    {
      const ord = Array.isArray(turnState.order) ? turnState.order : [];
      const round = Number(turnState.round || 1) || 1;
      const line = ord.length ? ('Order: ' + ord.join(' → ')) : 'Turn order active';
      turnStatusEl.title = active ? `Round ${round} • ${line}` : line;
    }
    return;
  }

  turnStatusEl.textContent = 'Turn: —';
  turnStatusEl.title = 'Turn system idle';
}

function openTurnOrderModal(payload = null) {
  if (!turnOrderModal) return;
  turnOrderPending = true;
  turnOrderActor = String(payload?.actor || '').trim();
  const note = String(payload?.note || 'Roll 1d20 for initiative.');
  if (turnOrderSubEl) turnOrderSubEl.textContent = turnOrderActor ? (`${turnOrderActor}: ${note}`) : note;
  if (turnOrderHelpEl) turnOrderHelpEl.innerHTML = turnOrderActor ? `Roll <b>1d20</b> for <b>${escapeHtml(turnOrderActor)}</b>. Highest goes first.` : `Roll <b>1d20</b>. Highest goes first.`;
  try { if (turnOrderTotalEl) turnOrderTotalEl.value = ''; } catch {}
  try {
    if (turnOrderResultEl) {
      turnOrderResultEl.style.display = 'none';
      const pre = turnOrderResultEl.querySelector('pre');
      if (pre) pre.textContent = '';
    }
  } catch {}
  turnOrderModal.classList.remove('hidden');
}

function closeTurnOrderModal() {
  turnOrderPending = false;
  if (!turnOrderModal) return;
  turnOrderModal.classList.add('hidden');
}

function showTurnOrderResult(text) {
  if (!turnOrderResultEl) return;
  turnOrderResultEl.style.display = 'block';
  const pre = turnOrderResultEl.querySelector('pre');
  if (pre) pre.textContent = String(text || '');
}

if (turnOrderAiBtn) turnOrderAiBtn.onclick = () => {
  if (!socket) connectSocketIfNeeded();
  requestDiceRoll({ sides: 20, count: 1, modifier: 0, label: 'Turn Order', dropLowest: false });
};

if (turnOrderSubmitBtn) turnOrderSubmitBtn.onclick = () => {
  if (!socket) connectSocketIfNeeded();
  const v = Math.floor(Number(turnOrderTotalEl ? turnOrderTotalEl.value : NaN));
  if (!Number.isFinite(v) || v < 1 || v > 20) {
    showTurnOrderResult('Type your initiative roll (1–20), or press AI Roll.');
    return;
  }
  socket.emit('turn_roll_submit', { source: 'player', total: v, actor: turnOrderActor || (getMyCharName(activeRoomId) || '') });
  showTurnOrderResult(`[submitted] ${v}`);
};

// Host: reroll / restart initiative
turnRerollBtn?.addEventListener('click', () => {
  try { if (!socket) connectSocketIfNeeded(); } catch {}
  try { if (socket && joined) socket.emit('turn_reroll'); } catch {}
  try { addMsg({ who: 'SYSTEM', tag: 'TURN', text: 'Host requested an initiative reroll.' }); } catch {}
});

// Simultaneous rounds: quick intent + host resolve
turnReadyBtn?.addEventListener('click', () => {
  try { if (!socket) connectSocketIfNeeded(); } catch {}
  try {
    const actor = String(getMyCharName(activeRoomId) || '').trim();
    if (!actor) return;
    if (socket && joined) {
      socket.emit('player_message', { text: 'Hold position and reassess.', actor });
      addMsg({ who: 'SYSTEM', tag: 'TURN', text: `Intent set: ${actor} holds.` });
    }
  } catch {}
});

turnResolveBtn?.addEventListener('click', () => {
  try { if (!socket) connectSocketIfNeeded(); } catch {}
  try { if (socket && joined) socket.emit('round_resolve_now'); } catch {}
  try { addMsg({ who: 'SYSTEM', tag: 'TURN', text: 'Host requested round resolution (missing intents default to Hold).' }); } catch {}
});

// -------------------- Dice Roller (d6 / d20 only) --------------------
function diceTs(ts) {
  try {
    const d = new Date(Number(ts) || Date.now());
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return ""; }
}

function addDiceResult(payload = {}) {
  if (!diceLogEl) return;
  const sides = Number(payload.sides);
  const rolls = Array.isArray(payload.rolls) ? payload.rolls : [];
  const mod = Number(payload.modifier) || 0;
  const sum = Number(payload.sum);
  const total = Number(payload.total);
  const label = String(payload.label || "").trim();
  const when = diceTs(payload.ts);

  let extra = "";
  try {
    if (payload && payload.dropLowest && sides === 6 && rolls.length === 3) {
      const d = Number(payload.dropped);
      const kept = Number(payload.keptSum);
      if (Number.isFinite(d) && Number.isFinite(kept)) {
        extra = `drop=${d} kept=${kept}`;
      }
    }
    const low = label.toLowerCase();
    if (sides === 20 && rolls.length === 2 && (low.includes("adv") || low.includes("dis"))) {
      const hi = Math.max(...rolls);
      const lo = Math.min(...rolls);
      const pick = low.includes("dis") ? lo : hi;
      extra = `picked=${pick} (${low.includes("dis") ? "dis" : "adv"})  final=${pick + mod}`;
    }
  } catch {}

  const meta = `${when} • ${rolls.length || 0}d${sides}${mod ? (mod > 0 ? `+${mod}` : `${mod}`) : ""}`;
  const body = `${label ? label + "\n" : ""}[${rolls.join(", ")}]  sum=${Number.isFinite(sum) ? sum : "?"}${mod ? `  mod=${mod}` : ""}  total=${Number.isFinite(total) ? total : "?"}${extra ? "\n" + extra : ""}`;

  const wrap = document.createElement('div');
  wrap.className = 'diceEntry';
  wrap.innerHTML = `<div class="meta"><span>DICE</span><span>${escapeHtml(meta)}</span></div><div class="big">${escapeHtml(String(Number.isFinite(total) ? total : '?'))}</div><div class="body">${escapeHtml(body)}</div>`;
  diceLogEl.prepend(wrap);
}

function requestDiceRoll({ sides = 20, count = 1, modifier = 0, label = "", dropLowest = false } = {}) {
  connectSocketIfNeeded();
  if (!socket) return;
  socket.emit('dice_roll', {
    sides: Number(sides),
    count: Number(count),
    modifier: Number(modifier),
    label: String(label || ""),
    dropLowest: !!dropLowest
  });
}


function applyDiceResultToStatsModal(payload = {}) {
  if (!statsModal || statsModal.classList.contains('hidden')) return;
  const key = String(pendingStatKey || '').trim();
  if (!key) return;

  const sides = Number(payload?.sides);
  const rolls = Array.isArray(payload?.rolls) ? payload.rolls.map(n => Number(n)) : [];
  if (sides !== 6 || rolls.length !== 3 || rolls.some(n => !Number.isFinite(n) || n < 1 || n > 6)) return;

  const row = statsBodyEl ? statsBodyEl.querySelector(`.statRow[data-stat="${key}"]`) : null;
  if (!row) return;

  const inputs = Array.from(row.querySelectorAll('input.die'));
  if (inputs.length !== 3) return;
  for (let i = 0; i < 3; i++) {
    inputs[i].value = String(rolls[i]);
  }

  pendingStatKey = null;
  // Trigger recalculation.
  for (const inp of inputs) {
    try { inp.dispatchEvent(new Event('input', { bubbles: true })); } catch {}
  }
}


function splitNarrationAndChoices(text) {
  const s = String(text || "");
  const m = s.match(/(^|\n)\s*(?:\*\*|__|#+\s*)?choices\s*:\s*(?:\*\*|__)?/i);
  if (!m || m.index == null) return { narration: s.trim(), choices: [] };
  const idx = Number(m.index) + String(m[1] || '').length;
  const narration = s.slice(0, idx).trim();
  const after = s.slice(idx + String(m[0] || '').length - String(m[1] || '').length);
  const choices = after
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => l.replace(/^[-*•]\s*/, ''))
    .map(l => l.replace(/^\d+[.)]\s*/, ''))
    .filter(Boolean);
  return { narration, choices };
}



const ALT_ACTIONS = [
  { kind: "look", label: "Look", tip: "Quick sensory snapshot (no time advance)." },
  { kind: "investigate", label: "Investigate", tip: "Notable details / clues (no time advance)." },
  { kind: "listen", label: "Listen", tip: "Sounds, movement, distant signs (no time advance)." },
  { kind: "gear", label: "Check Gear", tip: "Summarize inventory + equipped (no time advance)." },
  { kind: "party:talk", label: "Talk", tip: "Say something to nearby party (no turn)." },
  { kind: "party:plan", label: "Plan", tip: "Propose a quick plan (no turn)." },
  { kind: "party:trade", label: "Trade", tip: "Offer a trade (no turn; auto-transfer on accept)." },
  { kind: "party:whistle", label: "Whistle", tip: "Signal nearby party (no turn)." },
];

function renderAltActions(){
  if (!altActionsEl) return;
  altActionsEl.innerHTML = "";

  const hint = document.createElement("span");
  hint.className = "altHint";
  hint.textContent = "Quick:";
  altActionsEl.appendChild(hint);

  for (const a of ALT_ACTIONS){
    const b = document.createElement("button");
    b.className = "ghost small";
    b.textContent = a.label;
    if (a.tip) b.title = a.tip;

    // Only require that you're in a room. Allow peeks even while an action roll is pending.
    const disable = !joined || playLockedForStats;
    b.disabled = disable;

    b.onclick = () => {
      if (!socket) connectSocketIfNeeded();
      if (!socket) return;
      const k = String(a.kind || '').trim();
      if (k.startsWith('party:')) {
        const sub = k.slice('party:'.length).trim() || 'talk';
        let note = '';
        if (sub === 'talk') note = String(prompt('What do you say to nearby party?') || '').trim();
        if (sub === 'plan') note = String(prompt('What plan do you propose?') || '').trim();
        if (sub === 'trade') {
          // Auto-trade: structured offer -> accept/decline.
          const partyNames = (() => {
            const out = [];
            const seen = new Set();
            for (const t0 of (currentCanonTokens || [])) {
              const s = String(t0 || '').trim();
              if (!s.toLowerCase().startsWith('party:')) continue;
              let raw = s.split(':').slice(1).join(':').trim();
              raw = raw.replace(/^\[|\]$/g, '');
              const parts = raw.split(/\s*[;|]+\s*/).map(x=>String(x||'').trim()).filter(Boolean);
              for (const p of parts) {
                const name = String(p.split('/')[0] || '').trim();
                const key = name.toLowerCase();
                if (!name || seen.has(key)) continue;
                seen.add(key);
                out.push(name);
              }
            }
            return out;
          })();

          const me = String(getMyCharName(activeRoomId) || '').trim();
          const targets = partyNames.filter(n => String(n||'').trim().toLowerCase() !== me.toLowerCase());
          if (!targets.length) { window.toast?.('No trade targets found.', 'error'); return; }
          const to = String(prompt(`Trade with who?\nAvailable: ${targets.join(', ')}`) || '').trim();
          if (!to) return;

          const giveLine = String(prompt('Give what item? (example: Rope)') || '').trim();
          if (!giveLine) return;
          const giveQty = Math.max(1, Math.floor(Number(prompt('Give quantity? (number)') || '1') || 1));

          const wantLine = String(prompt('Want what item? (optional; leave blank for gift)') || '').trim();
          let wantQty = 0;
          if (wantLine) wantQty = Math.max(1, Math.floor(Number(prompt('Want quantity? (number)') || '1') || 1));

          socket.emit('trade_request', { to, giveItem: giveLine, giveQty, wantItem: wantLine, wantQty });
          return;
        }

        socket.emit('party_quick', { kind: sub, text: note });
        return;
      }
      socket.emit("peek_action", { kind: a.kind, label: a.label });
    };
    altActionsEl.appendChild(b);
  }
}




function classifyChoiceFallback(text){
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

  // If the choice itself signals danger.
  if (has(/risk|danger|forbid|curse|blood|dark|unknown|alone/)) risk = 'High';

  return { approach, risk };
}



// Cache the most recent server choice payload so couch swaps can re-filter instantly.
let __lastChoicesRaw = [];
let __lastNonEmptyChoicesRaw = [];
function _choicePayloadHasRenderableEntries(choices) {
  for (const c of (Array.isArray(choices) ? choices : [])) {
    const raw = (c && typeof c === 'object') ? String(c.label || c.text || '').trim() : String(c || '').trim();
    if (!raw) continue;
    const low = raw.toLowerCase();
    if (low.startsWith('freeform') || low.startsWith('free form')) continue;
    return true;
  }
  return false;
}
function setChoices(choices) {
  const incoming = Array.isArray(choices) ? choices : [];
  const hasRenderableIncoming = _choicePayloadHasRenderableEntries(incoming);
  const preservePrior = (!incoming.length || !hasRenderableIncoming) && hasMode(currentCanonTokens, 'PLAY') && Array.isArray(__lastNonEmptyChoicesRaw) && __lastNonEmptyChoicesRaw.length;
  const sourceChoices = preservePrior ? __lastNonEmptyChoicesRaw : incoming;
  try { __lastChoicesRaw = Array.isArray(sourceChoices) ? sourceChoices : []; } catch { __lastChoicesRaw = []; }
  if (hasRenderableIncoming) {
    try { __lastNonEmptyChoicesRaw = incoming.slice(); } catch { __lastNonEmptyChoicesRaw = []; }
  }
  if (!choicesEl) return;
  choicesEl.innerHTML = "";


  try { renderAltActions(); } catch {}

  // Who am I allowed to act as on this device? (couch co-op safe)
  let myNames = [];
  try { myNames = getMyCharNames(activeRoomId) || []; } catch { myNames = []; }
  if (!myNames.length) {
    try { myNames = _healLocalRosterFromTokens(activeRoomId, currentCanonTokens) || []; } catch { myNames = []; }
  }

  const list = [];
  (sourceChoices || []).forEach((c) => {
    let raw = "";
    let actor = "";

    if (c && typeof c === "object") {
      raw = String(c.label || c.text || "").trim();
      actor = String(c.actor || c.character || c.for || "").trim();
    } else {
      raw = String(c || "").trim();
    }

    if (!raw) return;

    // Parse "[Actor] Do thing" / "Actor: Do thing" fallback formats.
    if (!actor) {
      let mm = raw.match(/^\s*\[([^\]]{1,80})\]\s*(.+)\s*$/);
      if (mm) {
        actor = String(mm[1] || "").trim();
        raw = String(mm[2] || "").trim();
      } else {
        mm = raw.match(/^\s*([^:]{1,80})\s*:\s*(.+)\s*$/);
        if (mm) {
          actor = String(mm[1] || "").trim();
          raw = String(mm[2] || "").trim();
        }
      }
    }

    const low = raw.toLowerCase();
    if (low.startsWith("freeform") || low.startsWith("free form")) return;

    list.push({ text: raw, actor });
  });

  const activeName = String(getMyCharName(activeRoomId) || '').trim();

  const appendChoice = ({ text: c, actor }, scoped = true) => {
    const mine = !!(actor && myNames.some(n => _namesLooselyMatch(actor, n)));
    const mineCount = Array.isArray(myNames) ? myNames.length : 0;

    if (scoped && actor && mineCount) {
      if (!mine) return false;
      if (mineCount > 1 && activeName && !_namesLooselyMatch(actor, activeName)) return false;
    }

    const b = document.createElement("button");
    b.className = "choiceBtn";

    const meta = (window.AETH_FUN && typeof window.AETH_FUN.classifyChoice === "function")
      ? (window.AETH_FUN.classifyChoice(c) || classifyChoiceFallback(c))
      : classifyChoiceFallback(c);

    const pills = [];
    if (actor) pills.push(`<span class="choicePill">${escapeHtml(String(actor))}</span>`);
    if (meta && meta.approach) pills.push(`<span class="choicePill">${escapeHtml(String(meta.approach))}</span>`);
    if (meta && meta.risk) pills.push(`<span class="choicePill">Risk: ${escapeHtml(String(meta.risk))}</span>`);

    b.innerHTML = `<div class="choiceMeta">${pills.join("")}</div><div class="choiceText">${escapeHtml(c)}</div>`;

    b.onclick = (e) => {
      if (b.disabled) return;

      // If couch co-op: auto-focus the right local character before sending.
      if (actor && mineCount > 1 && mine) {
        try { setActiveCharacter(activeRoomId, actor); } catch {}
      }

      // Shift+click lets you edit before sending.
      if (e && e.shiftKey) {
        inputEl.value = c;
        inputEl.focus();
        return;
      }
      sendText(c);
    };

    choicesEl.appendChild(b);
    return true;
  };

  let rendered = 0;
  for (const entry of list) {
    if (appendChoice(entry, true)) rendered += 1;
  }

  if (!rendered && list.length) {
    // Self-heal: stale local roster data should never blank the dock.
    for (const entry of list) {
      if (appendChoice(entry, false)) rendered += 1;
    }
  }

  if (!rendered && hasMode(currentCanonTokens, 'PLAY')) {
    const fallback = [
      'Look around carefully.',
      'Check your gear.',
      'Listen for danger.',
      'Move cautiously and take stock.'
    ];
    for (const text of fallback) appendChoice({ text, actor: '' }, false);
  }

  if (freeformBtn) {
    freeformBtn.textContent = "Freeform";
    freeformBtn.onclick = () => {
      inputEl.value = "";
      inputEl.focus();
    };
  }

  // If the game is currently locked (stats/action roll/initiative), disable choices (but keep them visible).
  if (playLockedForStats || playLockedForRoll || playLockedForTurn) {
    try { Array.from(choicesEl.querySelectorAll("button")).forEach(b => b.disabled = true); } catch {}
  }
}

let __canonJoinedCache = "";
let __hudRaf = 0;
let __hudPendingTokens = null;
let __lastLocForVisuals = "";
let __lastXYForVisuals = "";

function _scheduleHudUpdate(tokens){
  __hudPendingTokens = Array.isArray(tokens) ? tokens : [];
  if (__hudRaf) return;
  __hudRaf = requestAnimationFrame(() => {
    __hudRaf = 0;
    const t = __hudPendingTokens || [];
    __hudPendingTokens = null;
    try { updateHudFromTokens(t); } catch {}
  });
}

function setCanonTokens(tokens) {
  const t = Array.isArray(tokens) ? tokens : [];
  currentCanonTokens = t;

  // Resume self-heal: in solo/couch rooms, rebuild the local roster from party tokens
  // when browser storage drifted out of sync with the save.
  try { _healLocalRosterFromTokens(activeRoomId, t); } catch {}

  // Only build the big canon string when dev-view is enabled.
  try {
    if (showCanon && canonEl) {
      // Join canon tokens into a human-readable block (dev view only)
      const joined = t.join("\n");
      if (joined !== __canonJoinedCache) {
        __canonJoinedCache = joined;
        canonEl.textContent = joined;
      }
    }
  } catch {}

  // Visuals (only when LOC changes) + gameplay gates.
  let _locNow = 'START';
  try { _locNow = String(tokenValue(t, ['loc','world.location']) || 'START').trim() || 'START'; } catch {}
  const _locChanged = (_locNow !== __lastLocForVisuals);
  if (_locChanged) __lastLocForVisuals = _locNow;

  let _xyNow = '';
  try { _xyNow = String(tokenValue(t, ['xy']) || '').trim(); } catch {}
  const _xyChanged = (_xyNow !== __lastXYForVisuals);
  if (_xyChanged) __lastXYForVisuals = _xyNow;

  try { if (_locChanged) bgApplyFromTokens(t); } catch {}
  // Map work can be heavy; run when LOC or XY changes, or when the Map tab is visible.
  try { if (_locChanged || _xyChanged || viewMode === 'map') mapApplyFromTokens(t); } catch {}
  try { updateStatsGateFromTokens(t); } catch {}

  // HUD parsing/rendering is the heavy part; do it at most once per frame.
  try { _scheduleHudUpdate(t); } catch {}

  // Fun layer hook (journal/codex/ambience), cosmetic only
  try { if (window.AETH_FUN && typeof window.AETH_FUN.onTokens === 'function') window.AETH_FUN.onTokens(t); } catch {}

}

function applyCanonVisibility() {
  if (!canonCard) return;
  canonCard.classList.toggle('hidden', !showCanon);
}

function updateBookMeta(meta) {
  if (!bookMetaLine) return;
  if (!meta) {
    bookMetaLine.textContent = "—";
    return;
  }

  const chapterNo = Number(meta.chapterNo || 0);
  const chapterOpen = !!meta.chapterOpen;
  const sceneNo = Number(meta.sceneNo || 0);
  const beats = Number(meta.beatsInScene || 0);
  const scenes = Number(meta.scenesInSession || 0);
  const pending = meta.sceneBreakRequested ? " • scene break queued" : "";

  // Defaults match server env defaults unless you change them.
  const MIN_BEATS = 10;
  const MIN_SCENES = 10;

  if (chapterOpen) {
    bookMetaLine.textContent = `Chapter ${chapterNo} (title at end) • Scene ${sceneNo} • Beat ${beats}/${MIN_BEATS} • Scenes ${scenes}/${MIN_SCENES}${pending}`;
  } else if (chapterNo > 0) {
    bookMetaLine.textContent = `Chapter ${chapterNo} complete • next session will be Chapter ${chapterNo + 1}`;
  } else {
    bookMetaLine.textContent = "No chapter yet — finish intake to begin.";
  }
}

function updateWorldClockFromTokens(tokens){
  if (!worldClockLine) return;
  const t = Array.isArray(tokens) ? tokens : [];
  const day = String(tokenValue(t, ["day"]) || "").trim();
  const clock = String(tokenValue(t, ["clock"]) || "").trim();
  const season = String(tokenValue(t, ["season"]) || "").trim();
  const weather = String(tokenValue(t, ["weather"]) || "").trim();

  let line = `Day ${day || "—"} • ${clock || "—"}`;
  if (season) line += ` • ${season}`;
  if (weather) line += ` • ${weather}`;
  worldClockLine.textContent = line;
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// -------------------- World Assets (Tokens) --------------------
// Vehicles/props live in the world, not in inventory.
// Token format (ruleskeeper encouraged):
//   asset:<type>|id=<ID>|name=<Name>|loc=<LOC>|owner=<Owner>|... 
// Examples:
//   asset:horse|id=H1|name=Ashen Mare|loc=FROSTFORD|owner=Zombie
//   asset:carriage|id=C1|name=Road Wagon|loc=FROSTFORD|owner=party
//   asset:boat|id=B1|name=Lantern Skiff|loc=SABLEWATER|owner=Zombie
//   asset:house|id=HOME1|name=Frostford House|loc=FROSTFORD|owner=Zombie|cost=2000
// Stash tokens (optional; attached to a house asset):
//   stash:<ASSET_ID>:Item=Qty
//   stash:HOME1:Torch=2

function extractAssetsFromTokens(tokens){
  const out = [];
  for (const tok of (tokens || [])) {
    const s = String(tok || '').trim();
    const low = s.toLowerCase();
    if (!(low.startsWith('asset:') || low.startsWith('asset='))) continue;

    const body = s.split(/[:=]/).slice(1).join(':').trim();
    const parts = body.split(/\s*\|\s*/).map(x => x.trim()).filter(Boolean);
    if (!parts.length) continue;

    const a = { type: '', id: '', name: '', loc: '', owner: '', raw: s, meta: {} };

    // First segment is usually the type, unless it is key=value.
    const first = parts.shift();
    if (/^[^:=]+\s*[:=]/.test(first)) {
      parts.unshift(first);
    } else {
      a.type = String(first || '').trim();
    }

    for (const seg of parts) {
      const m = seg.match(/^([^:=]+)\s*[:=]\s*(.+)$/);
      if (!m) continue;
      const k = String(m[1] || '').trim().toLowerCase();
      const v = String(m[2] || '').trim();
      if (!k) continue;
      if (k === 'type' && !a.type) a.type = v;
      else if (k === 'id') a.id = v;
      else if (k === 'name' || k === 'label' || k === 'title') a.name = v;
      else if (k === 'loc' || k === 'location' || k === 'area') a.loc = v;
      else if (k === 'owner') a.owner = v;
      else a.meta[k] = v;
    }

    a.type = String(a.type || '').trim();
    if (!a.type) continue;
    if (!a.id) a.id = `${a.type}-${Math.random().toString(16).slice(2,8)}`;
    if (!a.name) a.name = a.type;

    out.push(a);
  }
  return out;
}

function extractStashFromTokens(tokens){
  // returns Map(assetId -> [{name, qty}])
  const by = new Map();
  for (const tok of (tokens || [])) {
    const s = String(tok || '').trim();
    const low = s.toLowerCase();
    if (!(low.startsWith('stash:') || low.startsWith('stash='))) continue;

    const body = s.split(/[:=]/).slice(1).join(':').trim();
    // Expected: <assetId>:Item=Qty OR <assetId>|Item=Qty
    const mm = body.match(/^([^:|]+)\s*[:|]\s*(.+)$/);
    if (!mm) continue;
    const assetId = String(mm[1] || '').trim();
    const rest = String(mm[2] || '').trim();
    if (!assetId || !rest) continue;

    const parts = rest
      .replace(/^\[|\]$/g,'')
      .split(/\s*[;|,]+\s*/)
      .map(x => x.trim())
      .filter(Boolean);

    const acc = new Map();
    for (const p of parts) {
      const m = p.match(/^(.+?)\s*=\s*(\d+)$/);
      const name = (m ? m[1] : p).trim();
      const qty = m ? (Number(m[2]) || 0) : 1;
      if (!name) continue;
      const key = name.toLowerCase();
      acc.set(key, { name, qty: (acc.get(key)?.qty || 0) + qty });
    }

    const list = [...acc.values()].sort((a,b)=>a.name.localeCompare(b.name));
    by.set(assetId, list);
  }
  return by;
}

function assetAccessibleToMe(asset, meName){
  const owner = String(asset?.owner || '').trim();
  if (!owner) return true; // public
  const o = owner.toLowerCase();
  if (o === 'party' || o === 'group' || o === 'all') return true;
  const me = String(meName || '').trim().toLowerCase();
  return !!me && o === me;
}

function assetsAtLoc(assets, locRaw){
  const raw = String(locRaw || '').trim();
  const key = normalizeLocKey(raw);
  return (assets || []).filter(a => {
    const aLocRaw = String(a?.loc || '').trim();
    if (!aLocRaw) return false;
    if (aLocRaw.toLowerCase() === raw.toLowerCase()) return true;
    return normalizeLocKey(aLocRaw) === key;
  });
}

function renderAssetsHere(here, meName){
  if (!assetHereListEl) return;
  assetHereListEl.innerHTML = '';

  if (!here || !here.length) {
    const empty = document.createElement('div');
    empty.className = 'invEmpty';
    empty.textContent = 'None visible.';
    assetHereListEl.appendChild(empty);
    return;
  }

  const order = { house: 1, home: 1, inn: 2, stable: 3, horse: 4, mount: 4, carriage: 5, wagon: 5, boat: 6, ship: 6 };
  const list = [...here].sort((a,b)=> (order[(a.type||'').toLowerCase()]||50) - (order[(b.type||'').toLowerCase()]||50));

  for (const a of list) {
    const row = document.createElement('div');
    row.className = 'assetRow';

    const left = document.createElement('div');
    left.className = 'left';

    const nm = document.createElement('div');
    nm.className = 'nm';
    nm.textContent = a.name || a.type;

    const sub = document.createElement('div');
    sub.className = 'sub';
    const own = a.owner ? `Owner: ${a.owner}` : 'Public';
    const idp = a.id ? ` • ${a.id}` : '';
    sub.textContent = `${own}${idp}`;

    left.appendChild(nm);
    left.appendChild(sub);

    const tag = document.createElement('div');
    tag.className = 'assetTag';
    const t = String(a.type || '').toUpperCase();
    tag.textContent = assetAccessibleToMe(a, meName) ? t : `${t} (not yours)`;

    row.appendChild(left);
    row.appendChild(tag);
    assetHereListEl.appendChild(row);
  }
}

function mapUpdateTravelMethodsFromAssets(here, meName){
  if (!mapTravelMethodSel) return;

  const usable = (here || []).filter(a => assetAccessibleToMe(a, meName));
  const types = usable.map(a => String(a.type || '').toLowerCase());

  const hasHorse = types.some(t => t.includes('horse') || t.includes('mount'));
  const hasCarriage = types.some(t => t.includes('carriage') || t.includes('wagon') || t.includes('cart'));
  const hasBoat = types.some(t => t.includes('boat') || t.includes('ship') || t.includes('skiff') || t.includes('barge') || t.includes('sail'));

  const allowed = [
    { value: 'walk', label: 'Walk' },
    ...(hasHorse ? [{ value: 'horse', label: 'Horse' }] : []),
    ...((hasHorse && hasCarriage) ? [{ value: 'carriage', label: 'Carriage' }] : []),
    ...(hasBoat ? [{ value: 'sail', label: 'Boat/Sail' }] : []),
  ];

  const cur = String(mapTravelMethodSel.value || MAP.settings.travelMethod || 'walk');
  const wantPortal = isPortalAllowedByTokens(currentCanonTokens) || types.some(t => t.includes('portal') || t.includes('gate') || t.includes('waygate'));

  mapTravelMethodSel.innerHTML = '';
  for (const optDef of allowed){
    const opt = document.createElement('option');
    opt.value = optDef.value;
    opt.textContent = optDef.label;
    mapTravelMethodSel.appendChild(opt);
  }

  if (wantPortal){
    const opt = document.createElement('option');
    opt.value = 'portal';
    opt.textContent = 'Portal (if able)';
    mapTravelMethodSel.appendChild(opt);
  }

  const allowedVals = new Set(allowed.map(o => o.value));
  if (wantPortal) allowedVals.add('portal');

  mapTravelMethodSel.value = allowedVals.has(cur) ? cur : 'walk';
  MAP.settings.travelMethod = String(mapTravelMethodSel.value || 'walk');
}

function renderHouseUi(house, stashItems){
  if (houseActionsEl) houseActionsEl.classList.toggle('hidden', !house);
  if (stashBlockEl) stashBlockEl.classList.toggle('hidden', !house);

  if (stashMetaEl) {
    if (!house) stashMetaEl.textContent = '—';
    else stashMetaEl.textContent = `${house.name || 'House'} • ${house.id}`;
  }

  if (!stashListEl) return;
  stashListEl.innerHTML = '';

  if (!house) return;

  const list = Array.isArray(stashItems) ? stashItems : [];
  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'invEmpty';
    empty.textContent = 'Empty';
    stashListEl.appendChild(empty);
    return;
  }

  for (const it of list) {
    const row = document.createElement('div');
    row.className = 'invItem';
    row.draggable = true;

    const nm = document.createElement('span');
    nm.className = 'invName';
    nm.textContent = it.name;

    const qty = document.createElement('span');
    qty.className = 'qty invQty';
    qty.textContent = '×' + String(it.qty);

    row.appendChild(nm);
    row.appendChild(qty);

    row.addEventListener('dragstart', (ev) => {
      try { setDragPayload(ev, { type: 'stash', item: it.name, qty: it.qty }); } catch {}
    });

    stashListEl.appendChild(row);
  }
}





try { window.__AETH_BUILD__ = 'v44b-btn-cachefix1'; console.log('[AETHERYN] UI build v44b-btn-cachefix1 loaded'); } catch {}
