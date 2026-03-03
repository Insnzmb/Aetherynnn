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
