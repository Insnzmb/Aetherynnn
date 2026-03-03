/*
  Aetheryn Web — Robust Local Launcher
  ----------------------------------
  Why this exists:
  - Windows .bat parsing is fragile when paths contain special chars.
  - This launcher does the real work in Node (which you already need),
    making startup predictable.

  What it does:
  - Ensures server/.env exists (copies from .env.example if missing)
  - Ensures npm deps are installed for server + matchmaking
  - Picks free ports (starting at PORT=8080, MM=8090) if the defaults are busy
  - Starts both processes and opens your browser to the game
*/

const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SERVER_DIR = path.join(ROOT, 'server');
const MM_DIR = path.join(ROOT, 'matchmaking');

function log(msg = '') {
  process.stdout.write(String(msg) + os.EOL);
}

function fatal(msg) {
  log('');
  log('FATAL: ' + msg);
  process.exit(1);
}

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function readText(p) {
  return fs.readFileSync(p, 'utf8');
}

function writeText(p, s) {
  fs.writeFileSync(p, s, 'utf8');
}

function parseDotEnv(text) {
  const out = {};
  const lines = String(text || '').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    // strip surrounding quotes
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function ensureEnvFiles() {
  const envPath = path.join(SERVER_DIR, '.env');
  if (!exists(envPath)) {
    const ex = path.join(SERVER_DIR, '.env.example');
    if (exists(ex)) {
      log('Creating server/.env from server/.env.example');
      writeText(envPath, readText(ex));
    } else {
      log('Creating minimal server/.env');
      writeText(envPath, 'PORT=8080\n');
    }
  }
  // matchmaking has no dotenv usage; keep the example around only.
}

function run(cmd, args, cwd) {
  const isWin = process.platform === 'win32';
  const r = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: isWin, // helps resolve npm.cmd on Windows
  });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed with code ${r.status}`);
}

function ensureDeps(dir, label) {
  const pkg = path.join(dir, 'package.json');
  if (!exists(pkg)) return;
  const nm = path.join(dir, 'node_modules');
  const hasNM = exists(nm) && fs.statSync(nm).isDirectory();
  // quick sanity: confirm at least express exists (and socket.io for the server)
  const needs = [path.join(nm, 'express')];
  if (label === 'server') needs.push(path.join(nm, 'socket.io'));
  const ok = hasNM && needs.every(exists);
  if (ok) {
    log(`Dependencies present (${label}).`);
    return;
  }
  log(`Installing dependencies (${label})...`);
  run('npm', ['install'], dir);
}

function canBind(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', () => resolve(false));
    // IMPORTANT:
    // The server listens on all interfaces by default. If we only probe 127.0.0.1,
    // we can falsely think a port is free when another process is bound on a different
    // interface / IPv6 dual-stack. Probe 0.0.0.0 to match the actual listen behavior.
    srv.listen({ port, host: '0.0.0.0' }, () => {
      srv.close(() => resolve(true));
    });
  });
}

async function pickFreePort(start, maxTries = 50) {
  const base = Number(start) || 0;
  for (let i = 0; i <= maxTries; i++) {
    const p = base + i;
    // Avoid privileged ports or nonsense.
    if (p < 1024 || p > 65535) continue;
    // eslint-disable-next-line no-await-in-loop
    const ok = await canBind(p);
    if (ok) return p;
  }
  return 0;
}

function openBrowser(url) {
  const plat = process.platform;
  try {
    if (plat === 'win32') {
      spawn('cmd', ['/c', 'start', '', url], { stdio: 'ignore', shell: true });
    } else if (plat === 'darwin') {
      spawn('open', [url], { stdio: 'ignore' });
    } else {
      spawn('xdg-open', [url], { stdio: 'ignore' });
    }
  } catch {
    // non-fatal
  }
}

function startProc(label, cwd, env, cmd, args) {
  log(`Starting ${label}...`);
  const child = spawn(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  child.on('exit', (code) => {
    log(`${label} exited (code ${code}).`);
  });
  return child;
}

(async function main() {
  log('=== AETHERYN WEB: One-Click Launcher ===');
  log(`Folder: ${ROOT}`);
  log('');

  if (!exists(path.join(SERVER_DIR, 'index.js'))) fatal('Missing server/index.js (zip is incomplete).');
  if (!exists(path.join(ROOT, 'web', 'index.html'))) fatal('Missing web/index.html (zip is incomplete).');

  // sanity: node + npm
  try {
    run('node', ['-v'], ROOT);
  } catch {
    fatal('Node.js was not found in PATH. Install Node.js (LTS), then run RUN_WINDOWS.bat again.');
  }
  try {
    run('npm', ['-v'], ROOT);
  } catch {
    fatal('npm was not found in PATH. Reinstall Node.js (it includes npm), then rerun.');
  }

  ensureEnvFiles();

  // Read preferred ports
  const envPath = path.join(SERVER_DIR, '.env');
  const envObj = parseDotEnv(readText(envPath));
  const preferredPort = Number(envObj.PORT || 8080) || 8080;
  const preferredMmPort = Number(envObj.MATCHMAKING_PORT || 8090) || 8090;

  // DEV BUILD flag (dev console + AI trace)
  // Priority: explicit process env (RUN_*_DEV) > server/.env (for persistent opt-in)
  const devBuildRaw = String(process.env.DEV_BUILD || envObj.DEV_BUILD || '').trim();
  const devBuildOn = /^(1|true|on|yes)$/i.test(devBuildRaw);

  const port = await pickFreePort(preferredPort);
  if (!port) fatal(`Could not find a free port starting at ${preferredPort}.`);

  let mmPort = await pickFreePort(preferredMmPort);
  if (!mmPort) fatal(`Could not find a free matchmaking port starting at ${preferredMmPort}.`);
  if (mmPort === port) {
    mmPort = await pickFreePort(preferredMmPort + 1);
    if (!mmPort) fatal('Could not find a free matchmaking port (conflict).');
  }

  log(`Server port: ${port}`);
  log(`Matchmaking port: ${mmPort}`);
  log(`DEV_BUILD: ${devBuildOn ? 'on' : 'off'} (dev console + AI trace)`);
  log('');

  // Install deps (idempotent)
  ensureDeps(SERVER_DIR, 'server');
  if (exists(path.join(MM_DIR, 'index.js'))) ensureDeps(MM_DIR, 'matchmaking');
  log('');

  // Start processes
  const serverChild = startProc('Aetheryn Server', SERVER_DIR, { PORT: String(port), DEV_BUILD: devBuildOn ? 'on' : 'off' }, 'node', ['index.js']);
  let mmChild = null;
  if (exists(path.join(MM_DIR, 'index.js'))) {
    mmChild = startProc('Aetheryn Matchmaking', MM_DIR, { PORT: String(mmPort), DEV_BUILD: devBuildOn ? 'on' : 'off' }, 'node', ['index.js']);
  }

  const url = `http://localhost:${port}`;
  log('');
  log(`Opening: ${url}`);
  openBrowser(url);

  if (mmPort !== 8090) {
    log('');
    log('NOTE: Matchmaking did not start on 8090.');
    log(`In the Lobby tab, set Matchmaking URL to: http://localhost:${mmPort}`);
  }

  log('');
  log('Leave this window open while playing. Press Ctrl+C to stop.');

  // If server exits, stop matchmaking too.
  serverChild.on('exit', () => {
    try { mmChild?.kill?.('SIGTERM'); } catch {}
  });

  // Keep alive.
  process.stdin.resume();
})();
