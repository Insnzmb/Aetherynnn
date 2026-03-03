const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));

const PORT = Number(process.env.PORT || 8090);
const ROOM_KEY = String(process.env.ROOM_KEY || '').trim();

/**
 * In-memory rooms registry.
 * NOTE: This is intentionally simple. For "real" scale you'd persist to Redis/DB.
 */
const rooms = new Map();

function now() { return Date.now(); }

function requireKey(req, res, next) {
  if (!ROOM_KEY) return next();
  const k = String(req.get('X-ROOM-KEY') || '').trim();
  if (k && k === ROOM_KEY) return next();
  return res.status(401).json({ ok: false, error: 'unauthorized' });
}

function sanitizeRoomPayload(body) {
  const roomId = String(body.roomId || '').trim();
  const hostUrl = String(body.hostUrl || '').trim();
  if (!roomId || roomId.length > 80) return null;
  if (!hostUrl || hostUrl.length > 512) return null;

  // Basic URL sanity (do not over-validate; tunnels vary).
  if (!/^https?:\/\//i.test(hostUrl)) return null;

  const name = String(body.name || `Aetheryn — ${roomId}`).slice(0, 80);
  const players = Math.max(1, Math.min(99, Number(body.players || 1) || 1));
  const maxPlayers = Math.max(players, Math.min(99, Number(body.maxPlayers || 6) || 6));
  const isPublic = body.isPublic !== false;

  return { roomId, hostUrl: hostUrl.replace(/\/+$/, ''), name, players, maxPlayers, isPublic };
}

function cleanup() {
  const cutoff = now() - 60_000;
  for (const [id, r] of rooms.entries()) {
    if (r.lastHeartbeat < cutoff) rooms.delete(id);
  }
}
setInterval(cleanup, 10_000).unref?.();

app.get('/api/rooms', (req, res) => {
  cleanup();
  const list = Array.from(rooms.values())
    .filter(r => r.isPublic)
    .sort((a, b) => (b.players - a.players) || (b.lastHeartbeat - a.lastHeartbeat));
  res.json({ ok: true, rooms: list });
});

app.get('/api/quickmatch', (req, res) => {
  cleanup();
  const list = Array.from(rooms.values())
    .filter(r => r.isPublic)
    .sort((a, b) => (b.players - a.players) || (b.lastHeartbeat - a.lastHeartbeat));
  const room = list.length ? list[0] : null;
  res.json({ ok: true, room });
});

app.post('/api/rooms/register', requireKey, (req, res) => {
  cleanup();
  const p = sanitizeRoomPayload(req.body || {});
  if (!p) return res.status(400).json({ ok: false, error: 'bad_room' });

  const existing = rooms.get(p.roomId);
  rooms.set(p.roomId, {
    ...existing,
    ...p,
    createdAt: existing?.createdAt || now(),
    lastHeartbeat: now(),
  });

  res.json({ ok: true });
});

app.post('/api/rooms/heartbeat', requireKey, (req, res) => {
  cleanup();
  const roomId = String(req.body?.roomId || '').trim();
  if (!roomId) return res.status(400).json({ ok: false, error: 'missing_roomId' });
  const r = rooms.get(roomId);
  if (!r) return res.status(404).json({ ok: false, error: 'not_found' });

  // Allow optional updates.
  const players = req.body?.players != null ? Number(req.body.players) : null;
  const maxPlayers = req.body?.maxPlayers != null ? Number(req.body.maxPlayers) : null;

  r.lastHeartbeat = now();
  if (Number.isFinite(players)) r.players = Math.max(1, Math.min(99, players));
  if (Number.isFinite(maxPlayers)) r.maxPlayers = Math.max(r.players, Math.min(99, maxPlayers));

  res.json({ ok: true });
});

app.post('/api/rooms/unregister', requireKey, (req, res) => {
  const roomId = String(req.body?.roomId || '').trim();
  if (!roomId) return res.status(400).json({ ok: false, error: 'missing_roomId' });
  rooms.delete(roomId);
  res.json({ ok: true });
});

app.get('/', (req, res) => {
  res.type('text/plain').send('Aetheryn Matchmaking is running. Use /api/rooms');
});

app.listen(PORT, () => {
  console.log(`Aetheryn Matchmaking listening on http://0.0.0.0:${PORT}`);
  if (ROOM_KEY) console.log('ROOM_KEY enabled (hosts must send X-ROOM-KEY)');
});
