const logEl = document.getElementById("log");
const canonEl = document.getElementById("canon");
const choicesEl = document.getElementById("choices");
const altActionsEl = document.getElementById("altActions");
const joinBtn = document.getElementById("join");
const sendBtn = document.getElementById("send");
const inputEl = document.getElementById("input");
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
const mapImg = document.getElementById("mapImg");
const mapFog = document.getElementById("mapFog");
const mapPinsLayer = document.getElementById("mapPinsLayer");
const mapDest = document.getElementById("mapDest");
const mapDot = document.getElementById("mapDot");
const mapLocRawEl = document.getElementById("mapLocRaw");
const mapLocKeyEl = document.getElementById("mapLocKey");
const mapSub = document.getElementById("mapSub");
const CANON_MAP_URL = "assets/aetheryn_canon_map.png?v=2";
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


// Per-room character name (prevents wrong character when you Load a different save)
function roomCharKey(roomId){
  const rid = String(roomId || '').trim();
  return rid ? ('aetheryn_char_name__' + rid) : 'aetheryn_char_name';
}
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
  answersPlayer: {},
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
    if (exportGameBtn) {
      exportGameBtn.disabled = !on;
      exportGameBtn.title = on ? `Export save ${activeRoomId}` : 'Join a room to export';
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

function addMsg({ who, tag, text, kind }) {
  const t = (tag || '').toUpperCase();
  const isSystem = (who || '').toUpperCase() === 'SYSTEM' || ['SYSTEM','STATE','MODE','INTAKE'].includes(t);
  if (isSystem && !showSystem) return;

  const div = document.createElement("div");
  div.className = `msg ${kind || ""}`;
  div.innerHTML = `
    <div class="meta">
      <span class="tag">${tag || "LOG"}</span>
      <span>${who || ""}</span>
    </div>
    <div class="body"></div>
  `;
  div.querySelector(".body").innerText = text || "";
  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
}

// -------------------- Stat Allocation Gate (mode:STATS) --------------------
const STAT_KEYS = ["STRIKE","GUARD","VELOCITY","SIGHT","WILL","ECHO"];

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
    if (dock) dock.classList.toggle("hidden", locked);
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
  // Bind the active character locally so other UI elements stay consistent.
  try { if (boundChar) setActiveCharacter(activeRoomId, boundChar); } catch {}

  const role = isHost ? "Host" : "Player";
  if (statsRoleBadge) statsRoleBadge.textContent = role;

  const inStats = (payload && (Object.prototype.hasOwnProperty.call(payload, "haveStats") || Object.prototype.hasOwnProperty.call(payload, "preference") || Object.prototype.hasOwnProperty.call(payload, "charName"))) ? true : hasMode(currentCanonTokens, "STATS");
  const haveStats = !!payload.haveStats || myStatsArePresent(currentCanonTokens);

  if (statsSubEl) {
    if (!inStats) statsSubEl.textContent = "Stat allocation is not required right now.";
    else if (haveStats) statsSubEl.textContent = "Locked. Waiting for others…";
    else statsSubEl.textContent = "Roll your six abilities. No play until locked.";
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
    openStatsModal({ haveStats: haveMine, charName: getMyCharName() || "", preference: "" });
  } else {
    // Leaving stats phase: close modal automatically.
    closeStatsModal();
  }
}


// -------------------- Action Roll Gate (server-specified dice) --------------------
let actionRollPending = false;
let actionRollSpec = { sides: 6, count: 3, dropLowest: false, label: "Action Roll" };

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
  socket.emit('action_roll_submit', { source: 'player', total: v });
  showActionRollResult(`[submitted] ${v}`);
};


// -------------------- Turn Order (Initiative) --------------------
let turnState = { enabled: false, phase: 'OFF', active: '', order: [], expected: [], rolls: {}, round: 1 };
let turnOrderPending = false;

function updateTurnStatusPill() {
  if (!turnStatusEl) return;
  const phase = String(turnState?.phase || 'OFF').toUpperCase();
  const active = String(turnState?.active || '').trim();

  try {
    if (turnRerollBtn) {
      const show = joined && mode === 'multi' && !!isHost && (phase === 'INIT' || phase === 'ACTIVE');
      turnRerollBtn.classList.toggle('hidden', !show);
      turnRerollBtn.disabled = !show;
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
  } else if (phase === 'ACTIVE') {
    turnStatusEl.textContent = active ? `Turn: ${active}` : 'Turn: —';
    {
      const ord = Array.isArray(turnState.order) ? turnState.order : [];
      const round = Number(turnState.round || 1) || 1;
      const line = ord.length ? ('Order: ' + ord.join(' → ')) : 'Turn order active';
      turnStatusEl.title = active ? `Round ${round} • ${line}` : line;
    }
  } else {
    turnStatusEl.textContent = 'Turn: —';
    turnStatusEl.title = 'Turn system idle';
  }
}

function openTurnOrderModal(payload = null) {
  if (!turnOrderModal) return;
  turnOrderPending = true;
  const note = String(payload?.note || 'Roll 1d20 for initiative.');
  if (turnOrderSubEl) turnOrderSubEl.textContent = note;
  if (turnOrderHelpEl) turnOrderHelpEl.innerHTML = `Roll <b>1d20</b>. Highest goes first.`;
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
  socket.emit('turn_roll_submit', { source: 'player', total: v });
  showTurnOrderResult(`[submitted] ${v}`);

// Host: reroll / restart initiative
turnRerollBtn?.addEventListener('click', () => {
  try { if (!socket) connectSocketIfNeeded(); } catch {}
  try { if (socket && joined) socket.emit('turn_reroll'); } catch {}
  try { addMsg({ who: 'SYSTEM', tag: 'TURN', text: 'Host requested an initiative reroll.' }); } catch {}
});

};

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
      socket.emit("peek_action", { kind: a.kind, label: a.label });
    };
    altActionsEl.appendChild(b);
  }
}


let __lastChoicesRaw = [];
function setChoices(choices) {
  const incoming = Array.isArray(choices) ? choices : [];
  const preservePrior = !incoming.length && hasMode(currentCanonTokens, 'PLAY') && Array.isArray(__lastChoicesRaw) && __lastChoicesRaw.length;
  const sourceChoices = preservePrior ? __lastChoicesRaw : incoming;
  try { __lastChoicesRaw = Array.isArray(sourceChoices) ? sourceChoices : []; } catch { __lastChoicesRaw = []; }
  choicesEl.innerHTML = "";


  try { renderAltActions(); } catch {}

  const list = [];
  (sourceChoices || []).forEach((c) => {
    const raw = String(c || "").trim();
    if (!raw) return;
    const low = raw.toLowerCase();
    if (low.startsWith("freeform") || low.startsWith("free form")) return;
    list.push(raw);
  });

  list.forEach((c) => {
    const b = document.createElement("button");
    b.className = "choiceBtn";
    b.innerText = c;
    b.onclick = (e) => {
      // Shift+click lets you edit before sending.
      if (e && e.shiftKey) {
        inputEl.value = c;
        inputEl.focus();
        return;
      }
      sendText(c);
    };
    choicesEl.appendChild(b);
  });

  if (freeformBtn) {
    freeformBtn.textContent = "Freeform";
    freeformBtn.onclick = () => {
      inputEl.value = "";
      inputEl.focus();
    };
  }

  // If the game is currently locked (e.g., mandatory stat allocation), disable choices.
  if (playLockedForStats || playLockedForRoll) {
    try { Array.from(choicesEl.querySelectorAll("button")).forEach(b => b.disabled = true); } catch {}
  }
}

let __canonJoinedCache = "";
let __hudRaf = 0;
let __hudPendingTokens = null;
let __lastLocForVisuals = "";

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

  try { if (_locChanged) bgApplyFromTokens(t); } catch {}
  // Map work can be heavy; only run when LOC changes, or when the Map tab is visible.
  try { if (_locChanged || viewMode === 'map') mapApplyFromTokens(t); } catch {}
  try { updateStatsGateFromTokens(t); } catch {}

  // HUD parsing/rendering is the heavy part; do it at most once per frame.
  try { _scheduleHudUpdate(t); } catch {}
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
    try { if (payload?.actorName) setMyCharName(activeRoomId, payload.actorName); } catch {}
    setChoices(payload.lastChoices || payload.choices || []);
    updateBookMeta(payload.book_meta || null);
    try { setOocHistory(payload.ooc || []); } catch {}
    addMsg({ who: "SYSTEM", tag: "STATE", text: `Joined room: ${payload.roomId}` });

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
    if (Array.isArray(payload.lastChoices) || Array.isArray(payload.choices)) setChoices(payload.lastChoices || payload.choices || []);
    updateBookMeta(payload.book_meta || null);
    if (viewMode === 'book') refreshBook();

    // If the host flips the room into INTAKE after you joined, auto-open character creation.
    try { updateRoomControls(payload.canon_tokens || currentCanonTokens); } catch {}
    try { maybeAutoOpenIntake(payload.canon_tokens || currentCanonTokens); } catch {}
  });


  socket.on("stats_required", (payload) => {
    try { setAiWait(false); } catch {}
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
        active: String(t.active || ''),
        order: Array.isArray(t.order) ? t.order : [],
        expected: Array.isArray(t.expected) ? t.expected : [],
        rolls: (t.rolls && typeof t.rolls === 'object') ? t.rolls : {},
        round: Number(t.round || 1) || 1,
      };
    }
  } catch {}

  try { updateTurnStatusPill(); } catch {}

  // Turn lock: you can't act until initiative is done, and only on your turn.
  try {
    if (!joined) { setTurnLock(false); return; }
    const phase = String(turnState?.phase || 'OFF').toUpperCase();
    if (phase === 'INIT') {
      setTurnLock(true);
      return;
    }
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
          socket.emit('action_roll_submit', { source: 'site', total, dice });
        }
      }

      if (isTurn) {
        const total = Math.floor(Number(payload?.total));
        const dice = Array.isArray(payload?.rolls) ? payload.rolls.map(n => Number(n)).filter(n => Number.isFinite(n)) : [];
        showTurnOrderResult(`[AI Roll] d20=${dice.length ? dice[0] : '?'} → total=${Number.isFinite(total) ? total : '?'}`);
        if (socket && Number.isFinite(total)) {
          socket.emit('turn_roll_submit', { source: 'site', total, dice });
        }
      }
    } catch {}
  });


  socket.on("narration", (payload) => {
    try { setAiWait(false); } catch {}
    const full = payload.text || "";
    const split = splitNarrationAndChoices(full);
    const text = split.narration;
    addMsg({
      who: payload.from || "GM",
      tag: "SCENE",
      text,
      kind: "gm"
    });
    setCanonTokens(payload.canon_tokens || []);
    const ch = (payload.choices && payload.choices.length) ? payload.choices : (split.choices.length ? split.choices : extractChoicesFromNarration(full));
    setChoices(ch || []);
    updateBookMeta(payload.book_meta || null);

    // If you're reading in Book view, refresh so it feels instant.
    if (viewMode === 'book') refreshBook();
  });



  socket.on("book_update", (payload) => {
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


saveGameBtn?.addEventListener('click', async () => {
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
});

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

  socket.emit('join', { roomId: activeRoomId, name, charName });
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

  socket.emit("player_message", { text: t });
  addMsg({ who: "YOU", tag: "ACTION", text: t, kind: "you" });
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
const DRAFT_PLAYER_KEY = "aetheryn_intake_player_draft_v1";

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
  intake.answersPlayer = { ...(loadDraft(DRAFT_PLAYER_KEY) || {}) };

  // Sensible defaults
  if (!intake.answersGlobal.q0) intake.answersGlobal.q0 = "Player rolls (I type results)";
  if (!intake.answersGlobal.q1) intake.answersGlobal.q1 = "1";
  if (intake.answersGlobal.q2 == null) intake.answersGlobal.q2 = "0";
  if (!intake.answersGlobal.q3) intake.answersGlobal.q3 = "Together (same starting scene)";
  if (!intake.answersGlobal.q4) intake.answersGlobal.q4 = "6";
  if (!intake.answersGlobal.q5) intake.answersGlobal.q5 = "5";
  if (!intake.answersGlobal.q6) intake.answersGlobal.q6 = "5";
  if (!intake.answersGlobal.q7) intake.answersGlobal.q7 = "5";
  if (!intake.answersGlobal.q8) intake.answersGlobal.q8 = "3";

  const joinName = lsGet("aetheryn_join_name") || "Anonymous";
  if (!intake.answersPlayer.q9) intake.answersPlayer.q9 = joinName;
  if (!intake.answersPlayer.q11) intake.answersPlayer.q11 = "Touched (uses magic)";
  if (!intake.answersPlayer.q12) intake.answersPlayer.q12 = "Fire";

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
  if (intakeSubEl) {
    intakeSubEl.textContent = showGlobalSection
      ? "Fill everything below. The story begins after you hit Submit."
      : "Fill your character sheet. The story begins after everyone submits.";
  }

  intakeRoleBadge.textContent = (mode === "multi" && !isHost) ? "Player" : (mode === "multi" ? "Host" : "Solo");

  qNumEl.textContent = "INTAKE";
  qTextEl.textContent = showGlobalSection
    ? "Campaign settings + character creation (all at once)."
    : "Character creation (all at once).";

  const joinName = lsGet("aetheryn_join_name") || "Anonymous";
  const g = intake.answersGlobal || {};
  const p = intake.answersPlayer || {};

  const autoSkipFormation = (Number(g.q1 || 0) === 1 && Number(g.q2 || 0) === 0);

  aBlockEl.innerHTML = `
    <div class="intakeSheet">
      ${showGlobalSection ? `
      <div class="section">
        <div class="sectionHeader">
          <div class="sectionTitle">Campaign settings</div>
          <div class="sectionSub">These set tone, pacing, and how hard the world bites back.</div>
        </div>

        <div class="charGrid" style="grid-template-columns: 1fr 1fr;">
          <div class="field" id="f_g_q1">
            <label>Party size (Q1) — human players</label>
            <input id="g_q1" type="number" min="1" max="8" value="${escHtml(g.q1 ?? "")}" />
            <div class="help">How many humans are playing right now.</div>
            ${renderScaleHelpInline('q1')}
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
    saveDraft(DRAFT_PLAYER_KEY, intake.answersPlayer);
    updateProgressBar(showGlobalSection);
  }

  // Attach listeners
  const allInputs = aBlockEl.querySelectorAll("input, textarea, select");
  allInputs.forEach(el => {
    el.addEventListener("input", () => { syncMagic(); readAndStoreAll(); updatePreview(); });
    el.addEventListener("change", () => { syncMagic(); readAndStoreAll(); updatePreview(); });
  });

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
  const prevAuto = (Number(prev.q1||0) === 1 && Number(prev.q2||0) === 0);
  const q0 = String(intake.answersGlobal?.q0 || prev.q0 || "Player rolls (I type results)").trim();
  const q1 = String(document.getElementById("g_q1")?.value || "").trim();
  const q2 = String(document.getElementById("g_q2")?.value || "").trim();

  const pCount = Number(q1 || 0);
  const npcCount = Number(q2 || 0);
  const autoSkip = (pCount === 1 && npcCount === 0);

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
  must('q1'); must('q2'); must('q4'); must('q5'); must('q6'); must('q7'); must('q8');

  const n1 = Number(g.q1);
  const n2 = Number(g.q2);
  if (!Number.isFinite(n1) || n1 < 1 || n1 > 8) errs.push('q1');
  if (!Number.isFinite(n2) || n2 < 0 || n2 > 20) errs.push('q2');

  const autoSkip = (n1 === 1 && n2 === 0);
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

function readPlayerFormAnswers(liveStore=false){
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

  if (liveStore) intake.answersPlayer = { ...(intake.answersPlayer || {}), ...data };
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
  const p = intake.answersPlayer || {};

  const req = [];
  if (showGlobalSection) {
    req.push('g:q0','g:q1','g:q2','g:q4','g:q5','g:q6','g:q7','g:q8');
    const autoSkip = (Number(g.q1||0)===1 && Number(g.q2||0)===0);
    if (!autoSkip) req.push('g:q3');
  }

  req.push('p:q9','p:q10','p:q11','p:q13','p:q14');
  const touched = String(p.q11||'').startsWith('Touched');
  if (touched) req.push('p:q12');

  let ok = 0;
  for (const id of req) {
    const [grp,k] = id.split(':');
    const src = (grp==='g') ? g : p;
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

  const perr = validatePlayerForm(pdata);
  if (perr) {
    markInvalidPlayer();
    return alert(perr);
  }

  // Persist character name for HUD highlight
  setMyCharName(activeRoomId, pdata.q9);

  // Persist drafts too
  saveDraft(DRAFT_GLOBAL_KEY, intake.answersGlobal);
  saveDraft(DRAFT_PLAYER_KEY, intake.answersPlayer);

  submitIntake();
};

// Back acts as "Close" (keeps your draft).
if (intakeBackBtn) intakeBackBtn.onclick = () => {
  // Save drafts on close.
  saveDraft(DRAFT_GLOBAL_KEY, intake.answersGlobal);
  saveDraft(DRAFT_PLAYER_KEY, intake.answersPlayer);
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

  const charName = String(intake?.answersPlayer?.q9 || "").trim();
  if (charName) setMyCharName(activeRoomId, charName);

  const payload = {
    kind: "AETH_INTAKE_V1",
    mode,
    isHost,
    joinName,
    answersGlobal: (mode === "multi" && !isHost) ? null : intake.answersGlobal,
    answersPlayer: intake.answersPlayer
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



// -------------------- HUD (Vitals / Party / Inventory) --------------------
function cleanTokenLine(t){
  return String(t || "").trim().replace(/^[•\-*]+\s*/g, "");
}

function escapeRegExp(s){
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


function expandTokenLineForLookup(rawLine){
  const s = cleanTokenLine(rawLine);
  if (!s) return [""];
  if (!s.includes(',')) return [s];

  // Only split when the comma-separated segments look like *separate tokens*.
  // This avoids breaking things like: inv:Torch=1, Rope=1
  const matches = Array.from(s.matchAll(/(?:^|,)\s*([A-Za-z][A-Za-z0-9_.-]*)\s*[:=]/g));
  if (matches.length <= 1) return [s];

  const allow = new Set([
    'loc','hp','health','mp','mana','aether','stamina','stam',
    'mode','flag','res','party','eq','equip','inv','stash','asset','pc',
    'time','clock','day','pos','year','doy','season','weather','region','cfg'
  ]);
  const keys = matches.map(m => String(m[1] || '').toLowerCase());
  if (!keys.every(k => allow.has(k))) return [s];

  const parts = s.split(',').map(p => p.trim()).filter(Boolean);
  return parts.length ? parts : [s];
}

function tokenValue(tokens, keys) {
  const ks = (keys || []).map(k => String(k).toLowerCase()).filter(Boolean);
  for (const t of (tokens || [])) {
    for (const seg of expandTokenLineForLookup(t)) {
      const s0 = String(seg || '').trim();
      if (!s0) continue;
      const low = s0.toLowerCase();
      for (const k of ks) {
        if (low.startsWith(k + ":") || low.startsWith(k + "=")) {
          return s0.slice(k.length + 1).trim();
        }
        const m = s0.match(new RegExp("^\\s*" + escapeRegExp(k) + "\\s*[:=]\\s*(.+)$", "i"));
        if (m) return String(m[1] || "").trim();
      }
    }
  }
  return "";
}



function parseRatio(val) {
  const s = String(val || "").trim();
  if (!s) return null;

  // cur/max formats (any order): "cur=8,max=10" or "max=10 cur=8"
  const curM = s.match(/cur\s*=\s*(\d+)/i);
  const maxM = s.match(/max\s*=\s*(\d+)/i);
  if (curM && maxM) return { cur: Number(curM[1]), max: Number(maxM[1]) };
  if (curM) return { cur: Number(curM[1]), max: null };

  // 8/10 formats
  const m = s.match(/(\d+)\s*\/\s*(\d+)/);
  if (m) return { cur: Number(m[1]), max: Number(m[2]) };

  // "8 of 10" / "8 out of 10"
  const m2 = s.match(/(\d+)\s*(?:of|out\s*of)\s*(\d+)/i);
  if (m2) return { cur: Number(m2[1]), max: Number(m2[2]) };

  // single number (or number-ish)
  const n = Number(s.replace(/[^0-9.]/g, ""));
  if (Number.isFinite(n)) return { cur: n, max: null };

  return null;
}

function setVital(valEl, barEl, val) {
  const s = String(val || "").trim();
  const r = parseRatio(s);

  let display = s;
  if (r) {
    const cur = Number.isFinite(r.cur) ? Math.floor(r.cur) : 0;
    if (r.max != null && Number.isFinite(r.max) && r.max > 0) {
      display = `${cur}/${Math.floor(r.max)}`;
    } else {
      display = String(cur);
    }
  }

  if (valEl) valEl.textContent = display || "—";
  if (!barEl) return;

  if (!r || !r.max) {
    barEl.style.width = "0%";
    return;
  }

  const pct = Math.max(0, Math.min(100, Math.round((r.cur / r.max) * 100)));
  barEl.style.width = pct + "%";
}

// -------------------- Drag & Drop helpers --------------------
function setDragPayload(ev, payload){
  try {
    if (!ev || !ev.dataTransfer) return;
    ev.dataTransfer.setData('application/x-aetheryn', JSON.stringify(payload || {}));
    if (payload && payload.item) ev.dataTransfer.setData('text/plain', String(payload.item));
    ev.dataTransfer.effectAllowed = 'move';
  } catch {}
}

function getDragPayload(ev){
  try {
    const raw = ev?.dataTransfer?.getData('application/x-aetheryn') || '';
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function ddMarkOver(el, on){
  try { el && el.classList.toggle('dropOver', !!on); } catch {}
}

function matchName(a, b) {
  const x = String(a || "").toLowerCase();
  const y = String(b || "").toLowerCase();
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}


function parsePartyFromTokens(tokens) {
  const out = [];
  for (const t of (tokens || [])) {
    const s = String(t || "");
    if (!s.toLowerCase().startsWith("party:")) continue;
    let raw = s.split(":").slice(1).join(":").trim();
    raw = raw.replace(/^\[|\]$/g, "");
    const parts = raw
      .split(/\s*[;|]+\s*/)
      .map(x => x.trim())
      .filter(Boolean);

    for (const p of parts) {
      const seg = p.split("/").map(x => x.trim()).filter(Boolean);
      if (!seg.length) continue;

      const name = seg[0] || "Unknown";

      const nOrNull = (v) => {
        const n = Number(String(v || "").trim());
        return Number.isFinite(n) ? Math.floor(n) : null;
      };

      let i = 1;
      const hpCurN = seg.length > i ? nOrNull(seg[i++]) : null;

      let hpMaxN = null, mpCurN = null, mpMaxN = null, stCurN = null, stMaxN = null;
      let status = "";

      if (hpCurN != null) {
        const maybeHpMax = seg.length > i ? nOrNull(seg[i]) : null;
        if (maybeHpMax != null) {
          hpMaxN = maybeHpMax; i++;

          const maybeMpCur = seg.length > i ? nOrNull(seg[i]) : null;
          const maybeMpMax = seg.length > (i + 1) ? nOrNull(seg[i + 1]) : null;
          const maybeStCur = seg.length > (i + 2) ? nOrNull(seg[i + 2]) : null;
          const maybeStMax = seg.length > (i + 3) ? nOrNull(seg[i + 3]) : null;

          if (maybeMpCur != null && maybeMpMax != null && maybeStCur != null && maybeStMax != null) {
            mpCurN = maybeMpCur; mpMaxN = maybeMpMax;
            stCurN = maybeStCur; stMaxN = maybeStMax;
            i += 4;
          }

          status = seg.slice(i).join(" / ") || "";
        } else {
          status = seg.slice(i).join(" / ") || "";
        }
      } else {
        status = seg.slice(1).join(" / ") || "";
      }

      const hp = (hpCurN != null) ? (hpMaxN != null ? `${hpCurN}/${hpMaxN}` : String(hpCurN)) : "";
      const mp = (mpCurN != null) ? (mpMaxN != null ? `${mpCurN}/${mpMaxN}` : String(mpCurN)) : "";
      const stamina = (stCurN != null) ? (stMaxN != null ? `${stCurN}/${stMaxN}` : String(stCurN)) : "";

      out.push({ name, hp, mp, stamina, status });
    }
  }

  const by = new Map();
  for (const m of out) by.set(String(m.name || "").toLowerCase(), m);
  return [...by.values()];
}


function renderParty(members) {
  if (!partyListEl) return;
  const meName = (getMyCharName() || lsGet("aetheryn_join_name") || "").trim();

  partyListEl.innerHTML = "";
  if (!members || !members.length) {
    const empty = document.createElement("div");
    empty.className = "invEmpty";
    empty.textContent = "No party data yet.";
    partyListEl.appendChild(empty);
    return;
  }

  for (const m of members) {
    const row = document.createElement("div");
    row.className = "partyRow" + (meName && matchName(m.name, meName) ? " you" : "");

    const left = document.createElement("div");
    const nm = document.createElement("div");
    nm.className = "name";
    nm.textContent = m.name;
    left.appendChild(nm);

    if (m.status) {
      const sub = document.createElement("div");
      sub.className = "sub";
      sub.textContent = m.status;
      left.appendChild(sub);
    }

    const hp = document.createElement("div");
    hp.className = "hp";
    hp.textContent = m.hp ? ("HP " + m.hp) : "HP —";

    row.appendChild(left);
    row.appendChild(hp);
    partyListEl.appendChild(row);
  }
}

function extractInventoryFromTokens(tokens) {
  const parts = [];
  for (const t of (tokens || [])) {
    const s = String(t || "");
    const low = s.toLowerCase();
    if (
      low.startsWith("inv:") ||
      low.startsWith("inv=") ||
      low.startsWith("inventory:") ||
      low.startsWith("inventory=")
    ) {
      const raw = s.split(/[:=]/).slice(1).join(":").trim();
      const split = raw
        .replace(/^\[|\]$/g, "")
        .split(/\s*[;|,]+\s*/)
        .map(x => x.trim())
        .filter(Boolean);
      for (const p of split) parts.push(p);
    }
  }

  const acc = new Map();
  for (const p of parts) {
    const m = p.match(/^(.+?)\s*=\s*(\d+)$/);
    const name = (m ? m[1] : p).trim();
    const qty = m ? Number(m[2]) : 1;
    if (!name) continue;
    const key = name.toLowerCase();
    acc.set(key, { key, name, qty: (acc.get(key)?.qty || 0) + qty });
  }

  return [...acc.values()];
}

// -------------------- Inventory UX (filter/sort/categories + quick actions) --------------------
let __invRaw = [];
let __invUi = { q: '', cat: 'all', sort: 'name' };
let __invSeen = {}; // { [key]: { qty:number, ts:number } }

function invLoadSeen(){
  try { return JSON.parse(lsGet('aetheryn_inv_seen_v1') || '{}') || {}; } catch { return {}; }
}
function invSaveSeen(obj){
  try { localStorage.setItem('aetheryn_inv_seen_v1', JSON.stringify(obj || {})); } catch {}
}

function invCategoryOf(name){
  const s = String(name || '').toLowerCase();
  if (!s) return 'misc';
  if (/(potion|elixir|tonic|bandage|salve|ration|food|water|wine|beer|tea|herb|antidote|medicine)/i.test(s)) return 'consumables';
  if (/(sword|axe|dagger|knife|bow|spear|mace|hammer|staff|wand|crossbow|arrow|bolt|shield)/i.test(s)) return 'weapons';
  if (/(armor|helm|helmet|gauntlet|glove|boot|greave|cloak|robe|mail|plate|leather|ring|amulet|belt)/i.test(s)) return 'armor';
  if (/(torch|lantern|oil|rope|hook|lockpick|kit|tinder|flint|map|compass|tool|needle|thread|chalk|bucket)/i.test(s)) return 'tools';
  if (/(gem|jewel|gold|silver|coin|aurum|relic|idol|art|pearl)/i.test(s)) return 'valuables';
  if (/(ore|ingot|wood|lumber|cloth|hide|leather|fur|bone|scale|crystal|shard|powder|salt)/i.test(s)) return 'materials';
  if (/(key|sigil|token|letter|note|contract|deed|permit|pass)/i.test(s)) return 'quest';
  return 'misc';
}

function invLabel(cat){
  const m = {
    all: 'All',
    consumables: 'Consumables',
    weapons: 'Weapons',
    armor: 'Armor',
    tools: 'Tools',
    valuables: 'Valuables',
    materials: 'Materials',
    quest: 'Quest',
    misc: 'Misc'
  };
  return m[cat] || String(cat || 'All');
}

function invUpdateSeen(items){
  const seen = __invSeen && typeof __invSeen === 'object' ? __invSeen : {};
  const now = Date.now();
  const next = { ...seen };
  const byKey = new Map((items || []).map(it => [String(it?.key || '').toLowerCase(), it]));
  for (const [k, it] of byKey.entries()){
    const prev = next[k];
    const q = Number(it?.qty || 0) || 0;
    if (!prev || q > Number(prev.qty || 0)) next[k] = { qty: q, ts: now };
    else next[k] = { qty: q, ts: Number(prev.ts || now) };
  }
  __invSeen = next;
  invSaveSeen(next);
}

function invBuildCats(items){
  const counts = {};
  for (const it of (items || [])){
    const c = invCategoryOf(it?.name);
    counts[c] = (counts[c] || 0) + 1;
  }
  return counts;
}

function invRenderCats(items){
  if (!invCatsEl) return;
  const counts = invBuildCats(items);
  const cats = ['all', 'consumables', 'weapons', 'armor', 'tools', 'valuables', 'materials', 'quest', 'misc']
    .filter(c => c === 'all' || (counts[c] || 0) > 0);
  invCatsEl.innerHTML = '';
  for (const c of cats){
    const btn = document.createElement('button');
    btn.className = 'invChip' + ((__invUi.cat || 'all') === c ? ' active' : '');
    const n = c === 'all' ? (items || []).length : (counts[c] || 0);
    btn.textContent = `${invLabel(c)}${n ? ` (${n})` : ''}`;
    btn.addEventListener('click', () => { __invUi.cat = c; invRenderAll(); });
    invCatsEl.appendChild(btn);
  }
}

function invApplyFilters(items){
  const q = String(__invUi.q || '').trim().toLowerCase();
  const cat = String(__invUi.cat || 'all');
  let list = Array.isArray(items) ? items.slice() : [];
  if (q) list = list.filter(it => String(it?.name || '').toLowerCase().includes(q));
  if (cat && cat !== 'all') list = list.filter(it => invCategoryOf(it?.name) === cat);

  const sort = String(__invUi.sort || 'name');
  if (sort === 'qty') list.sort((a,b) => (Number(b.qty||0) - Number(a.qty||0)) || String(a.name||'').localeCompare(String(b.name||'')));
  else if (sort === 'recent') {
    list.sort((a,b) => (Number(__invSeen[String(b.key||'').toLowerCase()]?.ts||0) - Number(__invSeen[String(a.key||'').toLowerCase()]?.ts||0)) || String(a.name||'').localeCompare(String(b.name||'')));
  } else {
    list.sort((a,b) => String(a.name||'').localeCompare(String(b.name||'')));
  }
  return list;
}

function invRenderAll(){
  const items = Array.isArray(__invRaw) ? __invRaw : [];
  invRenderCats(items);
  const filtered = invApplyFilters(items);
  renderInventoryInto(invListEl, filtered, { actions: true });
  const byName = items.slice().sort((a,b) => String(a.name||'').localeCompare(String(b.name||'')));
  renderInventoryInto(invListEquipEl, byName, { actions: false });
}

// Wire inventory inputs
try {
  __invSeen = invLoadSeen();
  invSearchEl?.addEventListener('input', () => { __invUi.q = String(invSearchEl.value || ''); invRenderAll(); });
  invSortEl?.addEventListener('change', () => { __invUi.sort = String(invSortEl.value || 'name'); invRenderAll(); });
} catch {}

function renderInventoryInto(listEl, items, opts = {}){
  if (!listEl) return;
  listEl.innerHTML = "";

  const list = Array.isArray(items) ? items : [];
  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "invEmpty";
    empty.textContent = "Empty";
    listEl.appendChild(empty);
    return;
  }

  for (const it of list) {
    const row = document.createElement("div");
    row.className = "invItem";
    row.draggable = true;

    const nm = document.createElement("span");
    nm.className = "invName";
    nm.textContent = it.name;

    const right = document.createElement('div');
    right.className = 'invRight';

    const qty = document.createElement("span");
    qty.className = "qty invQty";
    qty.textContent = "×" + String(it.qty);
    right.appendChild(qty);

    if (opts && opts.actions) {
      const btns = document.createElement('div');
      btns.className = 'invBtns';

      const useBtn = document.createElement('button');
      useBtn.className = 'invBtn';
      useBtn.type = 'button';
      useBtn.textContent = 'Use';
      useBtn.title = 'Narrate using this item (no automatic bookkeeping)';
      useBtn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        if (inputEl) {
          inputEl.value = `I use ${it.name}. `;
          inputEl.focus();
          try { inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length); } catch {}
        }
      });

      const consumeOne = document.createElement('button');
      consumeOne.className = 'invBtn';
      consumeOne.type = 'button';
      consumeOne.textContent = 'Consume';
      consumeOne.title = 'Prefill consume controls';
      consumeOne.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        try { if (invActionsDetailsEl) invActionsDetailsEl.open = true; } catch {}
        if (consumeItemEl) consumeItemEl.value = it.name;
        if (consumeQtyEl) consumeQtyEl.value = '1';
        try { consumeItemEl?.focus(); } catch {}
      });

      const equipQuick = document.createElement('button');
      equipQuick.className = 'invBtn';
      equipQuick.type = 'button';
      equipQuick.textContent = 'Equip';
      equipQuick.title = 'Jump to Equipment and prefill the item name';
      equipQuick.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        try { setCharTab('equipment'); } catch {}
        if (equipItemEl) equipItemEl.value = it.name;
        try { equipItemEl?.focus(); } catch {}
      });

      btns.appendChild(useBtn);
      btns.appendChild(consumeOne);
      btns.appendChild(equipQuick);

      // If a house stash is available, offer a quick prefill for deposit.
      if (currentHouseAsset && stashItemEl && stashQtyEl) {
        const stashBtn = document.createElement('button');
        stashBtn.className = 'invBtn';
        stashBtn.type = 'button';
        stashBtn.textContent = 'Stash';
        stashBtn.title = 'Prefill stash deposit controls';
        stashBtn.addEventListener('click', (e) => {
          e.preventDefault(); e.stopPropagation();
          try { stashItemEl.value = it.name; stashQtyEl.value = '1'; stashItemEl.focus(); } catch {}
        });
        btns.appendChild(stashBtn);
      }

      right.appendChild(btns);
    }

    row.appendChild(nm);
    row.appendChild(right);

    row.addEventListener("dragstart", (ev) => {
      try {
        setDragPayload(ev, { type: "inv", item: it.name, qty: it.qty });
      } catch {}
    });

    listEl.appendChild(row);
  }
}

function renderInventory(items) {
  __invRaw = Array.isArray(items) ? items.slice() : [];
  try { invUpdateSeen(__invRaw); } catch {}
  invRenderAll();
}


function extractEquipmentFromTokens(tokens) {
  const parts = [];
  for (const t of (tokens || [])) {
    const s = String(t || "");
    const low = s.toLowerCase();
    if (
      low.startsWith("eq:") || low.startsWith("eq=") ||
      low.startsWith("equip:") || low.startsWith("equip=") ||
      low.startsWith("equipment:") || low.startsWith("equipment=")
    ) {
      const raw = s.split(/[:=]/).slice(1).join(":").trim();
      const split = raw
        .replace(/^\[|\]$/g, "")
        .split(/\s*[;|,]+\s*/)
        .map(x => x.trim())
        .filter(Boolean);
      for (const p of split) parts.push(p);
    }
  }

  const out = [];
  for (const p of parts) {
    const slotMatch = p.match(/^([^=]+)=([^=]+)$/);
    if (slotMatch) {
      const a = slotMatch[1].trim();
      const b = slotMatch[2].trim();
      const qtyMatch = b.match(/^(.+?)\s*\((\d+)\)$/);
      if (qtyMatch) {
        out.push({ slot: a, name: qtyMatch[1].trim(), qty: Number(qtyMatch[2]) || 1 });
      } else {
        const num = Number(b);
        if (!Number.isNaN(num) && String(num) === b) {
          out.push({ slot: "", name: a, qty: num || 1 });
        } else {
          out.push({ slot: a, name: b, qty: 1 });
        }
      }
    } else {
      const m = p.match(/^(.+?)\s*=\s*(\d+)$/);
      const name = (m ? m[1] : p).trim();
      const qty = m ? Number(m[2]) : 1;
      if (name) out.push({ slot: "", name, qty });
    }
  }

  const by = new Map();
  for (const it of out) {
    const key = (String(it.slot || "").toLowerCase() + "|" + String(it.name || "").toLowerCase()).trim();
    if (!key) continue;
    const prev = by.get(key);
    by.set(key, {
      slot: it.slot || prev?.slot || "",
      name: it.name || prev?.name || "",
      qty: (prev?.qty || 0) + (it.qty || 1)
    });
  }

  return [...by.values()].sort((a, b) => {
    const sa = (a.slot || "").localeCompare(b.slot || "");
    if (sa) return sa;
    return (a.name || "").localeCompare(b.name || "");
  });
}

function renderEquipment(items) {
  const list = Array.isArray(items) ? items : [];

  // Known slots from the paper-doll UI (if present)
  const knownSlots = new Set((equipSlotNodes || []).map(el => String(el?.dataset?.slot || '').toLowerCase()).filter(Boolean));

  // Build a slot -> item map
  const bySlot = new Map();
  for (const it of list){
    const slot = String(it?.slot || '').trim().toLowerCase();
    const name = String(it?.name || '').trim();
    if (slot && name) bySlot.set(slot, name);
  }

  // Paint the doll slots
  try {
    for (const el of (equipSlotNodes || [])) {
      const slot = String(el?.dataset?.slot || '').toLowerCase();
      const item = slot ? (bySlot.get(slot) || '') : '';
      const itemEl = el.querySelector('[data-slot-item]') || el.querySelector('.slotItem');
      if (itemEl) itemEl.textContent = item || '—';
      el.classList.toggle('hasItem', !!item);
      el.draggable = !!item;
      el.dataset.item = item || '';
    }
  } catch {}

  // Render a compact list for unknown/extra equipment entries
  if (!equipListEl) return;
  equipListEl.innerHTML = "";

  const leftovers = [];
  for (const it of list) {
    const slot = String(it?.slot || '').trim();
    const name = String(it?.name || '').trim();
    const qty = Number(it?.qty || 1) || 1;

    if (!slot) {
      if (name) leftovers.push({ label: name, qty });
      continue;
    }

    const slotLow = slot.toLowerCase();
    if (!knownSlots.has(slotLow)) {
      leftovers.push({ label: `${slot}: ${name}`, qty });
    }
  }

  if (!leftovers.length) {
    const empty = document.createElement("div");
    empty.className = "invEmpty";
    empty.textContent = "—";
    equipListEl.appendChild(empty);
    return;
  }

  for (const it of leftovers) {
    const row = document.createElement("div");
    row.className = "invItem";

    const nm = document.createElement("span");
    nm.className = "invName";
    nm.textContent = it.label;

    row.appendChild(nm);

    if (it.qty && it.qty !== 1) {
      const qty = document.createElement("span");
      qty.className = "qty invQty";
      qty.textContent = "×" + String(it.qty);
      row.appendChild(qty);
    }

    equipListEl.appendChild(row);
  }
}


function extractStatsFromTokens(tokens) {
  // Preferred: pc:<Name>|stats:STRIKE=..;... (server authoritative)
  try {
    const pc = parsePcStatsForMe(tokens);
    if (pc) {
      const order = ["STRIKE","GUARD","VELOCITY","SIGHT","WILL","ECHO"];
      const arr = [];
      for (const k of order) {
        if (pc[k] == null) continue;
        arr.push({ key: k, val: String(pc[k]) });
      }
      if (arr.length) return arr;
    }
  } catch {}

  const out = new Map();

  const addKV = (k, v) => {
    const key = String(k || "").trim().toUpperCase();
    if (!key) return;
    const val = String(v ?? "").trim();
    if (!val) return;
    out.set(key, val);
  };

  const parseKVList = (raw) => {
    const split = String(raw || "")
      .replace(/^\[|\]$/g, "")
      .split(/\s*[;|,]+\s*/)
      .map(x => x.trim())
      .filter(Boolean);
    for (const seg of split) {
      let m = seg.match(/^([^:=\s]+)\s*[:=]\s*(.+)$/);
      if (!m) m = seg.match(/^([^\s]+)\s+(.+)$/);
      if (m) addKV(m[1], m[2]);
    }
  };

  for (const t of (tokens || [])) {
    const s = String(t || "");
    const low = s.toLowerCase();

    if (
      low.startsWith("stats:") || low.startsWith("stats=") ||
      low.startsWith("stat:")  || low.startsWith("stat=")  ||
      low.startsWith("abilities:") || low.startsWith("abilities=") ||
      low.startsWith("attributes:") || low.startsWith("attributes=")
    ) {
      const raw = s.split(/[:=]/).slice(1).join(":").trim();
      parseKVList(raw);
      continue;
    }

    const m = s.match(/^\s*([A-Za-z]{2,10})\s*[:=]\s*(.+?)\s*$/);
    if (m) {
      const k = m[1].toLowerCase();
      if (["strike","guard","velocity","sight","will","echo","per","luck","luc","spd","speed","aeth","str","dex","con","int","wis","cha"].includes(k)) {
        addKV(m[1], m[2]);
      }
    }
  }

  const order = ["STRIKE","GUARD","VELOCITY","SIGHT","WILL","ECHO","AETH","PER","LUC","LUCK","SPD","SPEED"];
  const keys = [...out.keys()];
  keys.sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia !== -1 || ib !== -1) {
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    }
    return a.localeCompare(b);
  });

  return keys.map(k => ({ key: k, val: out.get(k) }));
}

function renderStats(stats) {
  if (!statsListEl) return;
  statsListEl.innerHTML = "";

  const base = ["STRIKE","GUARD","VELOCITY","SIGHT","WILL","ECHO"];
  const map = new Map((stats || []).map(s => [s.key, s.val]));

  const rows = [];
  if (map.size) {
    for (const [k, v] of map.entries()) rows.push({ k, v });
  } else {
    for (const k of base) rows.push({ k, v: "—" });
  }

  for (const r of rows) {
    const row = document.createElement("div");
    row.className = "statRow";

    const k = document.createElement("div");
    k.className = "k";
    k.textContent = r.k;

    const v = document.createElement("div");
    v.className = "v";
    v.textContent = r.v;

    row.appendChild(k);
    row.appendChild(v);
    statsListEl.appendChild(row);
  }
}


let hudDndInited = false;

function initHudDragDrop(){
  if (hudDndInited) return;
  hudDndInited = true;

  const hasDnD = (ev) => {
    try {
      const types = Array.from(ev?.dataTransfer?.types || []);
      return types.includes('application/x-aetheryn');
    } catch { return false; }
  };

  const onOver = (ev) => {
    if (!hasDnD(ev)) return;
    ev.preventDefault();
    ddMarkOver(ev.currentTarget, true);
  };
  const onLeave = (ev) => ddMarkOver(ev.currentTarget, false);

  // Drop EQUIPPED -> Inventory  (unequip)
  const invDropTargets = [invListEl, invListEquipEl].filter(Boolean);
  for (const el of invDropTargets){
    el.addEventListener('dragover', onOver);
    el.addEventListener('dragleave', onLeave);
    el.addEventListener('drop', (ev) => {
      ddMarkOver(el, false);
      if (!hasDnD(ev)) return;
      ev.preventDefault();
      const p = getDragPayload(ev);
      if (!p) return;

      if (p.type === 'equip' && p.slot) {
        if (!joined) return alert('Press Start first.');
        try { socket.emit('unequip_item', { slot: String(p.slot) }); } catch {}
      }

      // Drop STASH -> Inventory (withdraw 1)
      if (p.type === 'stash' && p.item) {
        if (!joined) return alert('Press Start first.');
        if (!currentHouseAsset || !currentHouseAsset.id) return;
        try { socket.emit('stash_transfer', { assetId: currentHouseAsset.id, direction: 'withdraw', item: String(p.item), qty: 1 }); } catch {}
      }
    });
  }

  // Drop INV -> Stash (deposit 1)
  if (stashListEl){
    stashListEl.addEventListener('dragover', onOver);
    stashListEl.addEventListener('dragleave', onLeave);
    stashListEl.addEventListener('drop', (ev) => {
      ddMarkOver(stashListEl, false);
      if (!hasDnD(ev)) return;
      ev.preventDefault();
      const p = getDragPayload(ev);
      if (!p) return;
      if (p.type !== 'inv' || !p.item) return;
      if (!joined) return alert('Press Start first.');
      if (!currentHouseAsset || !currentHouseAsset.id) return;
      try { socket.emit('stash_transfer', { assetId: currentHouseAsset.id, direction: 'deposit', item: String(p.item), qty: 1 }); } catch {}
    });
  }

  // Paper-doll equip slots
  for (const slotEl of (equipSlotNodes || [])) {
    if (!slotEl) continue;

    slotEl.addEventListener('dragstart', (ev) => {
      const slot = String(slotEl.dataset.slot || '');
      const item = String(slotEl.dataset.item || '');
      if (!slot || !item) return;
      try { setDragPayload(ev, { type: 'equip', slot, item }); } catch {}
    });

    slotEl.addEventListener('dragover', onOver);
    slotEl.addEventListener('dragleave', onLeave);
    slotEl.addEventListener('drop', (ev) => {
      ddMarkOver(slotEl, false);
      if (!hasDnD(ev)) return;
      ev.preventDefault();

      const destSlot = String(slotEl.dataset.slot || '').trim();
      if (!destSlot) return;

      const p = getDragPayload(ev);
      if (!p) return;

      // INV -> Slot (equip 1)
      if (p.type === 'inv' && p.item) {
        if (!joined) return alert('Press Start first.');
        try { socket.emit('equip_item', { slot: destSlot, item: String(p.item) }); } catch {}
        return;
      }

      // Slot -> Slot (move)
      if (p.type === 'equip' && p.slot) {
        const from = String(p.slot || '').trim();
        if (!from || from === destSlot) return;
        if (!joined) return alert('Press Start first.');
        try { socket.emit('move_equipped', { from, to: destSlot }); } catch {}
        return;
      }
    });
  }
}

// Try once at boot (safe no-op if the new UI isn't present yet)
try { initHudDragDrop(); } catch {}


let __hudSig = { loc: '', party: '', vitals: '', inv: '', eq: '', assets: '', stats: '', clock: '' };
let __hudPartyCache = [];

function _sigTokens(tokens, starts){
  const s = Array.isArray(starts) ? starts.map(x => String(x||'').toLowerCase()) : [];
  if (!s.length) return '';
  const out = [];
  for (const t of (tokens || [])) {
    const raw = String(t || '');
    const low = raw.toLowerCase();
    for (const p of s) {
      if (low.startsWith(p)) { out.push(raw); break; }
    }
  }
  return out.join('\n');
}

function updateHudFromTokens(tokens) {
  const t = Array.isArray(tokens) ? tokens : [];

  // Location (LOC)
  let locNow = 'START';
  try {
    const locRaw = tokenValue(t, ["loc", "world.location"]);
    locNow = (String(locRaw || "START").trim() || 'START');
    if (locNow !== __hudSig.loc) {
      __hudSig.loc = locNow;
      currentLocRaw = locNow;
      if (locValEl) locValEl.textContent = currentLocRaw || '—';
    }
  } catch {}

  // Party
  let party = __hudPartyCache;
  try {
    const partySig = _sigTokens(t, ['party:','party=']);
    if (partySig !== __hudSig.party) {
      __hudSig.party = partySig;
      party = parsePartyFromTokens(t);
      __hudPartyCache = party;
      renderParty(party);
    }
  } catch {}

  // Vitals
  try {
    const joinName = (lsGet("aetheryn_join_name") || "").trim();
    const meName = (getMyCharName() || joinName).trim();

    const vitalsSig = _sigTokens(t, ['hp:','hp=','mp:','mp=','stamina:','stamina=','stam:','stam=']) + '|' + __hudSig.party + '|' + meName;
    if (vitalsSig !== __hudSig.vitals) {
      __hudSig.vitals = vitalsSig;

      let hp = tokenValue(t, ["hp", "health"]);
      let mp = tokenValue(t, ["mp", "mana", "aether"]);
      let stam = tokenValue(t, ["stamina", "stam"]);

      if (meName && party.length) {
        const me = party.find(m => matchName(m.name, meName));
        if (me) {
          if (!hp && me.hp) hp = String(me.hp);
          if (!mp && me.mp) mp = String(me.mp);
          if (!stam && me.stamina) stam = String(me.stamina);
        }
      }

      setVital(hpValEl, hpBarEl, hp);
      setVital(mpValEl, mpBarEl, mp);
      setVital(stamValEl, stamBarEl, stam);
    }
  } catch {}

  // Inventory
  try {
    const invSig = _sigTokens(t, ['inv:','inv=','inventory:','inventory=']);
    if (invSig !== __hudSig.inv) {
      __hudSig.inv = invSig;
      const inv = extractInventoryFromTokens(t);
      renderInventory(inv);
    }
  } catch {}

  // Equipment
  try {
    const eqSig = _sigTokens(t, ['eq:','eq=','equip:','equip=','equipment:','equipment=']);
    if (eqSig !== __hudSig.eq) {
      __hudSig.eq = eqSig;
      const eq = extractEquipmentFromTokens(t);
      renderEquipment(eq);
    }
  } catch {}

  // World assets + house stash (depends on current location)
  try {
    const joinName = (lsGet("aetheryn_join_name") || "").trim();
    const meName = (getMyCharName() || joinName).trim();

    const assetsSig = _sigTokens(t, ['asset:','asset=','stash:','stash=']) + '|' + String(currentLocRaw||'');
    if (assetsSig !== __hudSig.assets) {
      __hudSig.assets = assetsSig;
      const assets = extractAssetsFromTokens(t);
      const here = assetsAtLoc(assets, currentLocRaw);

      renderAssetsHere(here, meName);
      mapUpdateTravelMethodsFromAssets(here, meName);

      const stashBy = extractStashFromTokens(t);
      const house = (here || []).find(a => {
        const ty = String(a?.type || '').toLowerCase();
        return (ty.includes('house') || ty === 'home') && assetAccessibleToMe(a, meName);
      });
      currentHouseAsset = house || null;
      renderHouseUi(currentHouseAsset, currentHouseAsset ? (stashBy.get(currentHouseAsset.id) || []) : []);
    }
  } catch {}

  // Stats
  try {
    const statsSig = _sigTokens(t, ['pc:','pc=','stats:','stats=']);
    if (statsSig !== __hudSig.stats) {
      __hudSig.stats = statsSig;
      const stats = extractStatsFromTokens(t);
      renderStats(stats);
    }
  } catch {}

  // World clock
  try {
    const clockSig = _sigTokens(t, ['day:','day=','clock:','clock=','season:','season=','weather:','weather=']);
    if (clockSig !== __hudSig.clock) {
      __hudSig.clock = clockSig;
      updateWorldClockFromTokens(t);
    }
  } catch {}
}


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
    revealOnMove: true,
    revealRadiusPct: 8, // 2–16 (percent-ish)
    travelMode: true,
    autoSendTravel: false,

    // Travel rules (UI helper; canon is still LOC token)
    travelMethod: 'walk',
    travelSpeedMph: 3,
    mapWidthMiles: 300,
    allowTeleport: false
  },
  fogStore: null,  // offscreen canvas
  fogCtx: null,    // offscreen ctx
  fogDirty: false,
  fogSaveT: null
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
  showEl(dotEl, true);
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
}

async function mapLoadFogFromMeta(){
  if (!mapImg || !mapImg.src) return;
  mapEnsureFogStore();
  if (!MAP.fogCtx || !MAP.fogStore) return;

  // default: fully covered
  MAP.fogCtx.globalCompositeOperation = 'source-over';
  MAP.fogCtx.fillStyle = 'rgba(0,0,0,0.94)';
  MAP.fogCtx.fillRect(0, 0, MAP.fogStore.width, MAP.fogStore.height);

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
  const r = Math.max(8, Math.round(Math.min(MAP.fogStore.width, MAP.fogStore.height) * (Number(MAP.settings.revealRadiusPct || 8) / 100)));
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

  const r = Math.max(8, Math.round(Math.min(MAP.fogStore.width, MAP.fogStore.height) * (Number(MAP.settings.revealRadiusPct || 8) / 100)));
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

function mapUpdateDots(){
  const has = mapHasImage();
  const pin = MAP.pins[MAP.currentLocKey];

  showEl(mapEmpty, !has);
  showEl(mapImg, has);
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

  // dot position: pinned token OR temporary exploration override
  const pos = MAP.positionOverride || pin || null;
  if (pos){
    mapSetDot(mapDot, mapImg, pos);
    mapSetDot(mapMiniDot, mapMiniImg, pos);
    if (mapHelp){
      if (MAP.travel) mapHelp.innerHTML = `Traveling by <b>${escapeHtml(MAP.travel.method || 'travel')}</b> (waiting for narration / LOC token).`;
      else if (MAP.positionOverride) mapHelp.innerHTML = `Tracking: <b>exploration</b> position (waiting for LOC token to catch up).`;
      else if (pin && pin.approx) mapHelp.innerHTML = `Tracking: <b>approx</b> for <b>${escapeHtml(MAP.currentLocRaw)}</b>. Click <b>Pin current location</b> to calibrate.`;
      else if (pin) mapHelp.innerHTML = `Tracking: pinned for <b>${escapeHtml(MAP.currentLocRaw)}</b>.`;
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
  const wMiles = Number(MAP.settings.mapWidthMiles || 3000);
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

  const fromRaw = MAP.currentLocRaw || 'START';
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
    `TRAVEL (UI-click): Leave ${fromRaw} and push into the wilderness on map "${mapName}" toward (${Math.round(dest.x*100)}%, ${Math.round(dest.y*100)}%).`,
    `Method: ${methodLine}. Distance: ~${miles.toFixed(1)} miles. Time passes: ~${eta}.`,
    `Treat this as exploration: hazards, landmarks, discovery. (Code updates time + a coordinate-LOC label; you may narratively NAME it, but avoid changing LOC unless you mean to rename it.)`
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
  if (mapSub) mapSub.textContent = "Upload a map, then pin your current location once per place. After that, the red dot auto-tracks from the LOC token.";
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
  if (mapRevealOnMoveChk) mapRevealOnMoveChk.checked = !!MAP.settings.revealOnMove;
  if (mapRevealRadiusRange) mapRevealRadiusRange.value = String(clamp(Number(MAP.settings.revealRadiusPct || 8), 2, 16));
  if (mapTravelModeChk) mapTravelModeChk.checked = !!MAP.settings.travelMode;
  if (mapAutoSendTravelChk) mapAutoSendTravelChk.checked = !!MAP.settings.autoSendTravel;

  if (mapAllowTeleportChk) mapAllowTeleportChk.checked = !!MAP.settings.allowTeleport;
  mapSyncTeleportOption();

  if (mapTravelMethodSel) mapTravelMethodSel.value = String(MAP.settings.travelMethod || 'walk');
  if (mapTravelSpeedInp) mapTravelSpeedInp.value = String(Number(MAP.settings.travelSpeedMph || mapDefaultSpeed(MAP.settings.travelMethod)));
  if (mapMapWidthMilesInp) mapMapWidthMilesInp.value = String(Number(MAP.settings.mapWidthMiles || 3000));
}


function mapReadSettingsFromUI(){
  // Locked mechanics: fog reveals by narration/exploration only.
  MAP.settings.revealOnMove = true;
  MAP.settings.revealRadiusPct = clamp(Number(MAP.settings.revealRadiusPct || 8), 2, 16);

  // Map UI is minimal: only travel method is user-selectable.
  MAP.settings.travelMode = false;
  MAP.settings.autoSendTravel = false;

  const meth = mapTravelMethodSel ? String(mapTravelMethodSel.value || 'walk') : String(MAP.settings.travelMethod || 'walk');
  MAP.settings.travelMethod = meth;

  // Speed is derived from method; players cannot set it.
  MAP.settings.travelSpeedMph = mapDefaultSpeed(meth);

  // Keep map width internal (not user-controlled).
  MAP.settings.mapWidthMiles = clamp(Number(MAP.settings.mapWidthMiles || 3000), 500, 6000);
}


function openMapModal(){
  setView('map');
  try { mapRenderMapSelect(); } catch {}
  try { mapApplySettingsToUI(); } catch {}
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
    if (existing && existing.blobKey) { MAP.meta = existing; return; }

    const resp = await fetch(CANON_MAP_URL, { cache: "force-cache" });
    const blob = await resp.blob();
    const blobKey = "canon_map_v2";
    await idbPutBlob(blobKey, blob);
    // fog key is separate so fog persists
    const fogBlobKey = "canon_fog_v2";
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
        if (mapImg) mapImg.src = url;
        if (mapMiniImg) mapMiniImg.src = url;
        setTimeout(() => { mapLoadFogFromMeta().catch(()=>{}); }, 0);
        return;
      }
    } catch {}
  }
  // Fallback (no IDB)
  try {
    if (mapImg) mapImg.src = CANON_MAP_URL;
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

  // Capture previous position so narration-driven travel can reveal fog between points.
  const prevLocKey = MAP.currentLocKey;
  let prevPos = null;
  try { prevPos = mapGetCurrentXY(); } catch {}

  // Prefer LOC token; tolerate loc= and some legacy world.location variants.
  let locRaw = "";
  try { locRaw = tokenValue(t, ["loc"]); } catch {}
  if (!locRaw) {
    try { locRaw = tokenValue(t, ["world.location"]); } catch {}
  }
  locRaw = String(locRaw || "START").trim() || "START";

  MAP.currentLocRaw = locRaw;
  MAP.currentLocKey = normalizeLocKey(MAP.currentLocRaw);
  const locChanged = !!(prevLocKey && MAP.currentLocKey && prevLocKey !== MAP.currentLocKey);

  // Auto-switch maps when the current LOC is pinned on another map.
  try {
    const idx = loadLocIndex();
    const mapped = idx && MAP.currentLocKey ? idx[MAP.currentLocKey] : null;
    if (mapped && mapped !== MAP.activeMapId) {
      mapSwitchTo(mapped);
      // Re-apply once the new map state is loaded.
      setTimeout(() => { try { mapApplyFromTokens(tokens); } catch {} }, 0);
      return;
    }
  } catch {}

  // Always ensure there's at least a placeholder pin for the current LOC,
  // so the dot updates immediately even before calibration.
  try {
    if (!MAP.pins) MAP.pins = {};

    // If travel was initiated via the map UI, bind the next LOC to that destination coordinate.
    // This is how fog-of-war works for narration-driven travel without letting clicks reveal the map.
    const pendingDest = (MAP.travel && MAP.travel.pending && MAP.travel.requestedDest) ? MAP.travel.requestedDest : null;
    if (pendingDest && locChanged && MAP.currentLocKey) {
      const px = Number(pendingDest.x);
      const py = Number(pendingDest.y);
      if (Number.isFinite(px) && Number.isFinite(py)) {
        const existing = MAP.pins[MAP.currentLocKey];
        if (!existing || existing.approx) {
          MAP.pins[MAP.currentLocKey] = {
            x: clamp(px, 0, 1),
            y: clamp(py, 0, 1),
            raw: MAP.currentLocRaw,
            ts: Date.now(),
            visitedTs: Date.now(),
            approx: false
          };
          saveMapPins();
        } else {
          existing.raw = MAP.currentLocRaw;
        }
        // Prime reveal path from where we were.
        if (prevPos && Number.isFinite(prevPos.x) && Number.isFinite(prevPos.y)) {
          MAP.lastXY = { x: prevPos.x, y: prevPos.y };
        }
      }
    }

    if (MAP.currentLocKey && !MAP.pins[MAP.currentLocKey]) {
      mapSeedApproxPinIfMissing(MAP.currentLocKey, MAP.currentLocRaw, prevPos || MAP.lastXY || null);
    } else if (MAP.currentLocKey && MAP.pins[MAP.currentLocKey]) {
      // keep the raw label up-to-date
      MAP.pins[MAP.currentLocKey].raw = MAP.currentLocRaw;
    }
  } catch {}

  // LOC token overrides any in-progress travel (pending or animating).
  if (MAP.travel) {
    MAP.travel = null;
    showEl(mapTravelProgress, false);
  }

  // When the GM updates LOC, we consider that authoritative.
  if (MAP.positionOverride) MAP.positionOverride = null;

  const pin = (MAP.pins && MAP.currentLocKey) ? MAP.pins[MAP.currentLocKey] : null;
  const isApprox = !!(pin && pin.approx);

  // Fog reveal is narration-driven: whenever LOC updates, reveal around the current dot.
  // If the pin is only an approximate placeholder, we still reveal fog (so travel feels responsive),
  // but we do NOT mark it as a visited travel node until the player pins/calibrates it.
  if (pin){
    if (MAP.settings.revealOnMove){
      const next = { x: pin.x, y: pin.y };
      if (MAP.lastXY) mapRevealPath(MAP.lastXY, next);
      mapRevealAt(next.x, next.y);
      MAP.lastXY = next;
    } else {
      MAP.lastXY = { x: pin.x, y: pin.y };
    }

    if (!isApprox){
      if (!pin.visitedTs) { pin.visitedTs = Date.now(); saveMapPins(); }
      mapTrailPush({ x: pin.x, y: pin.y, label: pin.raw || MAP.currentLocRaw });
    }
  }

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

// -------------------- Matchmaking Lobby --------------------
let mmHeartbeatTimer = null;
let mmPublished = false;

function mmBaseUrl() {
  const saved = lsGet('aetheryn_mm_url');
  const v = (mmUrlInp?.value || saved || 'http://localhost:8090').trim();
  return v.replace(/\/+$/, '');
}

function hostPublicUrl() {
  const saved = lsGet('aetheryn_host_public_url');
  const v = (hostPublicUrlInp?.value || saved || '').trim();
  return v.replace(/\/+$/, '');
}

async function mmFetch(path, opts = {}) {
  const base = mmBaseUrl();
  const url = `${base}${path}`;
  const o = Object.assign({ headers: {} }, opts);
  // No auth needed for reads; hosts may set X-ROOM-KEY if they configured one.
  const key = lsGet('aetheryn_mm_room_key') || '';
  if (key) o.headers['X-ROOM-KEY'] = key;
  if (o.body && !(o.headers['Content-Type'])) o.headers['Content-Type'] = 'application/json';
  const resp = await fetch(url, o);
  return resp;
}

function lobbySetHint(msg) {
  const el = document.getElementById('mmHint');
  if (el) el.textContent = msg;
}

function lobbyPersistInputs() {
  try {
    if (mmUrlInp) localStorage.setItem('aetheryn_mm_url', mmUrlInp.value.trim());
    if (hostPublicUrlInp) localStorage.setItem('aetheryn_host_public_url', hostPublicUrlInp.value.trim());
  } catch {}
}

function lobbyInitInputs() {
  try {
    if (mmUrlInp) mmUrlInp.value = lsGet('aetheryn_mm_url') || 'http://localhost:8090';
    if (hostPublicUrlInp) hostPublicUrlInp.value = lsGet('aetheryn_host_public_url') || '';
  } catch {}
}


async function lobbyUpdateInvites(){
  try {
    const roomId = (activeRoomId || roomEl?.value || '').trim();
    if (inviteRoomCodeInp) inviteRoomCodeInp.value = roomId || '';
    if (!roomId) {
      if (lanInviteInp) lanInviteInp.value = '';
      return;
    }

    // Ask the server for LAN IPs (works on host machine and on LAN).
    let base = location.origin;
    try {
      const resp = await fetch('/api/net/info', { cache: 'no-store' });
      if (resp.ok) {
        const data = await resp.json().catch(()=>null);
        const port = Number(data?.port || 0) || (location.port ? Number(location.port) : 8080);
        const ips = Array.isArray(data?.ips) ? data.ips : [];
        const ip = ips.find(x => String(x||'').includes('.')) || '';
        if (ip) base = `http://${ip}:${port}`;
      }
    } catch {}

    const link = `${base.replace(/\/+$/, '')}/?mode=multi&room=${encodeURIComponent(roomId)}`;
    if (lanInviteInp) lanInviteInp.value = link;

    // Convenience: auto-fill the host URL for LAN publishing if the field is empty.
    try {
      const cur = String(hostPublicUrlInp?.value || '').trim();
      if (hostPublicUrlInp && (!cur || /localhost|127\.0\.0\.1/i.test(cur))) {
        hostPublicUrlInp.value = base;
      }
    } catch {}
  } catch {}
}

async function copyToClipboard(text){
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(String(text || ''));
      return true;
    }
  } catch {}
  return false;
}

try {
  copyRoomCodeBtn?.addEventListener('click', async () => {
    const t = String(inviteRoomCodeInp?.value || activeRoomId || '').trim();
    if (!t) return;
    const ok = await copyToClipboard(t);
    if (ok) lobbySetHint('Room code copied.');
  });
  copyLanInviteBtn?.addEventListener('click', async () => {
    const t = String(lanInviteInp?.value || '').trim();
    if (!t) return;
    const ok = await copyToClipboard(t);
    if (ok) lobbySetHint('Invite link copied.');
  });
} catch {}

function lobbyRenderRooms(list) {
  if (!lobbyRoomsEl) return;
  const rooms = Array.isArray(list) ? list : [];
  if (!rooms.length) {
    lobbyRoomsEl.innerHTML = `<div class="hint">No public rooms found.</div>`;
    return;
  }
  lobbyRoomsEl.innerHTML = '';
  for (const r of rooms) {
    const card = document.createElement('div');
    card.className = 'roomCard';
    const safeName = String(r.name || r.roomId || 'Room');
    const meta = `${r.players || 1}/${r.maxPlayers || 6}`;
    const url = String(r.hostUrl || '');
    card.innerHTML = `
      <div class="roomTop">
        <div class="roomName">${escapeHtml(safeName)}</div>
        <div class="roomMeta">${escapeHtml(meta)} • ${escapeHtml(String(r.roomId || ''))}</div>
      </div>
      <div class="roomUrl" title="${escapeHtml(url)}">${escapeHtml(url)}</div>
      <div class="roomBtns">
        <button class="primary small" data-join="1">Join</button>
        <button class="ghost small" data-copy="1">Copy Link</button>
      </div>
    `;
    const joinBtn = card.querySelector('[data-join]');
    const copyBtn = card.querySelector('[data-copy]');
    const link = url ? `${url.replace(/\/+$/, '')}/?mode=multi&room=${encodeURIComponent(r.roomId || '')}` : '';
    if (joinBtn) {
      joinBtn.addEventListener('click', () => {
        if (!link) return;
        window.location.href = link;
      });
    }
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        try {
          if (navigator.clipboard && link) {
            await navigator.clipboard.writeText(link);
            lobbySetHint('Link copied.');
          }
        } catch {
          lobbySetHint('Could not copy link.');
        }
      });
    }
    lobbyRoomsEl.appendChild(card);
  }
}

async function lobbyRefreshRooms() {
  lobbyInitInputs();
  lobbyPersistInputs();
  if (!lobbyRoomsEl) return;
  lobbyRoomsEl.innerHTML = `<div class="hint">Loading rooms…</div>`;
  try {
    const resp = await mmFetch('/api/rooms', { method: 'GET' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    lobbyRenderRooms(data.rooms || data || []);
    lobbySetHint('Rooms updated.');
  } catch (e) {
    lobbyRoomsEl.innerHTML = `<div class="hint">Could not reach matchmaking server.</div>`;
    lobbySetHint('Could not reach matchmaking server. Check the URL.');
  }
}

async function mmRegisterOrHeartbeat(kind) {
  const roomId = (activeRoomId || roomEl?.value || '').trim();
  if (!roomId) {
    lobbySetHint('Start or join a room first, then publish it.');
    return false;
  }
  const hostUrl = hostPublicUrl();
  if (!hostUrl) {
    lobbySetHint('Enter your Public Join URL (tunnel / reachable host URL) before publishing.');
    return false;
  }
  const payload = {
    roomId,
    name: `Aetheryn — ${roomId}`,
    hostUrl,
    players: 1,
    maxPlayers: 6,
    isPublic: true,
  };
  const path = kind === 'heartbeat' ? '/api/rooms/heartbeat' : '/api/rooms/register';
  try {
    const resp = await mmFetch(path, { method: 'POST', body: JSON.stringify(payload) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return true;
  } catch {
    lobbySetHint('Publish failed. Matchmaking server unreachable or rejected the request.');
    return false;
  }
}

async function lobbyPublishRoom() {
  lobbyPersistInputs();
  const ok = await mmRegisterOrHeartbeat('register');
  if (!ok) return;
  mmPublished = true;
  if (publishRoomBtn) publishRoomBtn.disabled = true;
  if (unpublishRoomBtn) unpublishRoomBtn.disabled = false;
  lobbySetHint('Room published. Keep this tab open while hosting (heartbeat runs automatically).');

  if (mmHeartbeatTimer) clearInterval(mmHeartbeatTimer);
  mmHeartbeatTimer = setInterval(async () => {
    try {
      const ok2 = await mmRegisterOrHeartbeat('heartbeat');
      if (!ok2) {
        // If heartbeat fails, keep trying but warn.
        lobbySetHint('Matchmaking heartbeat failed (will retry).');
      }
    } catch {}
  }, 15000);
  lobbyRefreshRooms();
}

async function lobbyUnpublishRoom() {
  const roomId = (activeRoomId || roomEl?.value || '').trim();
  if (!roomId) return;
  try {
    await mmFetch('/api/rooms/unregister', { method: 'POST', body: JSON.stringify({ roomId }) });
  } catch {}
  mmPublished = false;
  if (publishRoomBtn) publishRoomBtn.disabled = false;
  if (unpublishRoomBtn) unpublishRoomBtn.disabled = true;
  if (mmHeartbeatTimer) clearInterval(mmHeartbeatTimer);
  mmHeartbeatTimer = null;
  lobbySetHint('Room unpublished.');
  lobbyRefreshRooms();
}

async function lobbyQuickMatch() {
  lobbyPersistInputs();
  lobbySetHint('Searching for an open room…');
  try {
    const resp = await mmFetch('/api/quickmatch', { method: 'GET' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const r = data.room;
    if (!r || !r.hostUrl) {
      lobbySetHint('No open rooms found.');
      return;
    }
    const link = `${String(r.hostUrl).replace(/\/+$/, '')}/?mode=multi&room=${encodeURIComponent(r.roomId || '')}`;
    window.location.href = link;
  } catch {
    lobbySetHint('Quick match failed. Check matchmaking URL.');
  }
}

function lobbyToggleJoinByCode(show) {
  if (joinCodeRow) joinCodeRow.style.display = show ? '' : 'none';
  if (joinCodeBtns) joinCodeBtns.style.display = show ? '' : 'none';
}

function lobbyJoinByCodeGo() {
  const code = (joinCodeInp?.value || '').trim();
  if (!code) return;
  // Join on the current host (you still need the host URL). This is mainly for "join friend" when you already opened their server.
  setMode('multi');
  if (roomEl) roomEl.value = code;
  lobbyToggleJoinByCode(false);
  setView('play');
  lobbySetHint('Room code filled. Press Start.');
}

// Wire lobby events
try {
  lobbyInitInputs();
  mmUrlInp?.addEventListener('change', lobbyPersistInputs);
  hostPublicUrlInp?.addEventListener('change', lobbyPersistInputs);
  lobbyRefreshBtn?.addEventListener('click', lobbyRefreshRooms);
  publishRoomBtn?.addEventListener('click', lobbyPublishRoom);
  unpublishRoomBtn?.addEventListener('click', lobbyUnpublishRoom);
  quickMatchBtn?.addEventListener('click', lobbyQuickMatch);
  joinByCodeBtn?.addEventListener('click', () => lobbyToggleJoinByCode(true));
  joinCodeCancelBtn?.addEventListener('click', () => lobbyToggleJoinByCode(false));
  joinCodeGoBtn?.addEventListener('click', lobbyJoinByCodeGo);
} catch {}


// -------------------- Codex (canon search UI) --------------------
async function codexSearch(q) {
  const query = String(q || '').trim();
  if (!query) return;
  if (!codexResultsEl) return;

  codexResultsEl.innerHTML = `<div class="subtle">Searching…</div>`;
  try {
    const resp = await fetch('/canon/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query })
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const chunks = Array.isArray(data?.chunks) ? data.chunks : [];

    if (!chunks.length) {
      codexResultsEl.innerHTML = `<div class="subtle">No matches. Try different keywords.</div>`;
      return;
    }

    codexResultsEl.innerHTML = '';
    for (const c of chunks) {
      const wrap = document.createElement('div');
      wrap.className = 'codexChunk';
      wrap.innerHTML = `<div class="cid">CANON_CHUNK ${escapeHtml(String(c.id || ''))}</div><pre>${escapeHtml(String(c.text || ''))}</pre>`;
      codexResultsEl.appendChild(wrap);
    }
  } catch {
    codexResultsEl.innerHTML = `<div class="subtle">Codex query failed. Is the server running?</div>`;
  }
}

if (codexGoBtn) codexGoBtn.addEventListener('click', () => codexSearch(codexQueryEl?.value || ''));
if (codexQueryEl) {
  codexQueryEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') codexSearch(codexQueryEl.value || '');
  });
}

// -------------------- Units / Retinues (Forces) --------------------
function parseUnitToken(tok) {
  const s = String(tok || '').trim();
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

function renderForcesFromTokens(tokens) {
  if (!forcesListEl) return;

  // Host-only controls
  if (forcesControlsEl) forcesControlsEl.classList.toggle('hidden', !isHost);

  const units = [];
  for (const t of (tokens || [])) {
    if (!String(t || '').toLowerCase().startsWith('unit:')) continue;
    const u = parseUnitToken(t);
    if (u) units.push(u);
  }

  if (!units.length) {
    forcesListEl.innerHTML = `<div class="subtle">No units tracked yet.</div>`;
    return;
  }

  forcesListEl.innerHTML = '';
  for (const u of units) {
    const card = document.createElement('div');
    card.className = 'unitCard';

    const pill = (txt) => `<span class="pill">${escapeHtml(txt)}</span>`;
    const name = escapeHtml(u.name || 'Unit');

    card.innerHTML = `
      <div class="row">
        <div class="name">${name}</div>
        ${pill(`STR ${Number.isFinite(u.str) ? u.str : 0}`)}
        ${pill(`Morale ${Number.isFinite(u.morale) ? u.morale : 0}`)}
        ${pill(`Supply ${u.supply || 'stable'}`)}
        ${u.loc ? pill(`Loc ${u.loc}`) : ''}
        ${u.owner ? pill(`Owner ${u.owner}`) : ''}
      </div>
      <div class="actions"></div>
    `;

    const actions = card.querySelector('.actions');

    if (isHost && actions) {
      const mkBtn = (label, onClick) => {
        const b = document.createElement('button');
        b.className = 'ghost';
        b.type = 'button';
        b.textContent = label;
        b.addEventListener('click', onClick);
        return b;
      };

      actions.appendChild(mkBtn('STR +', () => socket?.emit('unit_update', { name: u.name, str: (u.str || 0) + 1, morale: u.morale, supply: u.supply })));
      actions.appendChild(mkBtn('STR -', () => socket?.emit('unit_update', { name: u.name, str: (u.str || 0) - 1, morale: u.morale, supply: u.supply })));
      actions.appendChild(mkBtn('Morale +', () => socket?.emit('unit_update', { name: u.name, str: u.str, morale: (u.morale || 0) + 1, supply: u.supply })));
      actions.appendChild(mkBtn('Morale -', () => socket?.emit('unit_update', { name: u.name, str: u.str, morale: (u.morale || 0) - 1, supply: u.supply })));
      actions.appendChild(mkBtn('Delete', () => socket?.emit('unit_delete', { name: u.name })));
    }

    forcesListEl.appendChild(card);
  }
}

if (unitCreateBtn) {
  unitCreateBtn.addEventListener('click', () => {
    if (!socket) connectSocketIfNeeded();
    if (!isHost) {
      addMsg({ who: 'SYSTEM', tag: 'SYSTEM', text: 'Only the host can create Units/Retinues.' });
      return;
    }
    const name = String(unitNameEl?.value || '').trim();
    const str = Math.floor(Number(unitStrEl?.value || 0));
    const morale = Math.floor(Number(unitMoraleEl?.value || 0));
    const supply = String(unitSupplyEl?.value || 'stable').trim();
    if (!name) return;
    socket.emit('unit_create', { name, str, morale, supply });
    try { unitNameEl.value = ''; } catch {}
  });
}
