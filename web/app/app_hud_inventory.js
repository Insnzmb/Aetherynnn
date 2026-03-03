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

function _findPerCharToken(tokens, families, actorName){
  const nm = String(actorName || '').trim().toLowerCase();
  if (!nm) return '';
  const fam = Array.isArray(families) ? families.map(x => String(x||'').toLowerCase()) : [];
  for (const t of (tokens || [])) {
    const s = String(t || '').trim();
    const low = s.toLowerCase();
    if (!fam.some(f => low.startsWith(f + ':') || low.startsWith(f + '='))) continue;
    const body = s.split(/[:=]/).slice(1).join(':');
    const head = String(body || '').split('|')[0].trim().toLowerCase();
    if (head && head === nm) return s;
  }
  return '';
}

function extractInventoryFromTokensFor(tokens, actorName){
  const hit = _findPerCharToken(tokens, ['invp','inventoryp'], actorName);
  if (!hit) {
    // Couch co-op privacy: do not fall back to a shared inventory token when multiple local characters exist.
    try {
      const rid = String(globalThis.activeRoomId || '').trim();
      const names = (typeof globalThis.getMyCharNames === 'function') ? (globalThis.getMyCharNames(rid) || []) : [];
      if (Array.isArray(names) && names.length > 1) return [];
    } catch {}
    return extractInventoryFromTokens(tokens);
  }
  const body = hit.split(/[:=]/).slice(1).join(':');
  const rest = String(body || '').split('|').slice(1).join('|').trim();
  if (!rest) return [];
  const parts = rest
    .replace(/^\[|\]$/g, "")
    .split(/\s*[;|,]+\s*/)
    .map(x => x.trim())
    .filter(Boolean);
  const out = [];
  for (const p of parts) {
    const m = p.match(/^(.+?)\s*=\s*(\d+)$/);
    const name = (m ? m[1] : p).trim();
    const qty = m ? (Number(m[2]) || 0) : 1;
    if (name && qty > 0) out.push({ name, qty });
  }
  const by = new Map();
  for (const it of out) {
    const key = String(it.name || '').toLowerCase();
    if (!key) continue;
    by.set(key, { name: it.name, qty: (by.get(key)?.qty || 0) + (it.qty || 0) });
  }
  return [...by.values()].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
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

    const nmWrap = document.createElement("div");
    nmWrap.className = "invNameWrap";

    const nm = document.createElement("span");
    nm.className = "invName";
    nm.textContent = it.name;
    nmWrap.appendChild(nm);

    // Optional: provenance flavor (cosmetic only)
    try {
      const prov = (window.AETH_FUN && typeof window.AETH_FUN.getItemProvenance === "function") ? window.AETH_FUN.getItemProvenance(it.name) : "";
      if (prov) {
        const pv = document.createElement("span");
        pv.className = "invProv";
        pv.textContent = prov;
        nmWrap.appendChild(pv);
      }
    } catch {}

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

    row.appendChild(nmWrap);
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
  try { if (window.AETH_FUN && typeof window.AETH_FUN.onInventoryChange === "function") window.AETH_FUN.onInventoryChange(__invRaw); } catch {}
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

function extractEquipmentFromTokensFor(tokens, actorName){
  const hit = _findPerCharToken(tokens, ['eqp','equipp'], actorName);
  if (!hit) {
    // Couch co-op privacy: do not fall back to shared equipment when multiple local characters exist.
    try {
      const rid = String(globalThis.activeRoomId || '').trim();
      const names = (typeof globalThis.getMyCharNames === 'function') ? (globalThis.getMyCharNames(rid) || []) : [];
      if (Array.isArray(names) && names.length > 1) return [];
    } catch {}
    return extractEquipmentFromTokens(tokens);
  }
  const body = hit.split(/[:=]/).slice(1).join(':');
  const rest = String(body || '').split('|').slice(1).join('|').trim();
  if (!rest) return [];
  const parts = rest
    .replace(/^\[|\]$/g, "")
    .split(/\s*[;|,]+\s*/)
    .map(x => x.trim())
    .filter(Boolean);

  const out = [];
  for (const p of parts) {
    const slotMatch = p.match(/^([^=]+)=([^=]+)$/);
    if (slotMatch) {
      const slot = slotMatch[1].trim();
      const name = slotMatch[2].trim();
      if (slot && name) out.push({ slot, name, qty: 1 });
    }
  }

  return out.sort((a,b)=>String(a.slot||'').localeCompare(String(b.slot||'')));
}

function renderEquipment(items) {
  try { if (window.AETH_FUN && typeof window.AETH_FUN.onEquipmentChange === "function") window.AETH_FUN.onEquipmentChange(Array.isArray(items)?items:[]); } catch {}
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

    row.appendChild(nmWrap);

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
    } catch {
      return false;
    }
  };

  const getScrollParent = (el) => {
    try {
      let cur = el;
      while (cur && cur !== document.body && cur !== document.documentElement) {
        const st = window.getComputedStyle(cur);
        const oy = String(st.overflowY || '').toLowerCase();
        if ((oy === 'auto' || oy === 'scroll') && (cur.scrollHeight - cur.clientHeight) > 4) return cur;
        cur = cur.parentElement;
      }
    } catch {}
    return null;
  };

  const autoScrollDuringDrag = (target, ev) => {
    try {
      const sp = getScrollParent(target) || target;
      if (!sp || typeof sp.scrollTop !== 'number') return;
      if ((sp.scrollHeight - sp.clientHeight) <= 4) return;

      const rect = sp.getBoundingClientRect();
      const y = Number(ev?.clientY);
      if (!Number.isFinite(y)) return;

      const margin = 44;
      const maxStep = 30;

      const topZone = rect.top + margin;
      const botZone = rect.bottom - margin;

      if (y < topZone) {
        const p = Math.min(1, Math.max(0, (topZone - y) / margin));
        sp.scrollTop -= Math.ceil(maxStep * p);
      } else if (y > botZone) {
        const p = Math.min(1, Math.max(0, (y - botZone) / margin));
        sp.scrollTop += Math.ceil(maxStep * p);
      }
    } catch {}
  };

  const onOver = (ev) => {
    if (!hasDnD(ev)) return;
    ev.preventDefault();
    ddMarkOver(ev.currentTarget, true);
    try { autoScrollDuringDrag(ev.currentTarget, ev); } catch {}
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
    const meKey = String((getMyCharName && getMyCharName()) || lsGet('aetheryn_join_name') || '').trim().toLowerCase();
    const partySig = _sigTokens(t, ['party:','party=']) + '|' + meKey;
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
    const joinName = (lsGet("aetheryn_join_name") || "").trim();
    const meName = (getMyCharName() || joinName).trim();
    const invSig = (_findPerCharToken(t, ['invp','inventoryp'], meName) || '') + "\n" + _sigTokens(t, ['inv:','inv=','inventory:','inventory=']) + '|' + meName.toLowerCase();
    if (invSig !== __hudSig.inv) {
      __hudSig.inv = invSig;
      const inv = extractInventoryFromTokensFor(t, meName);
      renderInventory(inv);
    }
  } catch {}

  // Equipment
  try {
    const joinName = (lsGet("aetheryn_join_name") || "").trim();
    const meName = (getMyCharName() || joinName).trim();
    const eqSig = (_findPerCharToken(t, ['eqp','equipp'], meName) || '') + "\n" + _sigTokens(t, ['eq:','eq=','equip:','equip=','equipment:','equipment=']) + '|' + meName.toLowerCase();
    if (eqSig !== __hudSig.eq) {
      __hudSig.eq = eqSig;
      const eq = extractEquipmentFromTokensFor(t, meName);
      renderEquipment(eq);
    }
  } catch {}

  // World assets + house stash (depends on current location)
  try {
    const joinName = (lsGet("aetheryn_join_name") || "").trim();
    const meName = (getMyCharName() || joinName).trim();

    const assetsSig = _sigTokens(t, ['asset:','asset=','stash:','stash=']) + '|' + String(currentLocRaw||'') + '|' + meName.toLowerCase();
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
    const joinName = (lsGet("aetheryn_join_name") || "").trim();
    const meName = (getMyCharName() || joinName).trim();
    const statsSig = _sigTokens(t, ['pc:','pc=','stats:','stats=']) + '|' + meName.toLowerCase();
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


