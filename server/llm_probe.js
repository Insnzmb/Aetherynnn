// server/llm_probe.js
// ES module. Lightweight LLM reachability probe used for UI + fail-fast UX.
// NOTE: This probe is intentionally conservative (no billable cloud calls).

const DEFAULT_TIMEOUT_MS = 3500;

export function detectProvider(env = process.env) {
  // Respect explicit provider selection if present.
  const explicit = String(env.LLM_PROVIDER || "").trim().toLowerCase();
  if (explicit) return explicit;

  // Otherwise, infer from keys (cloud-first), but keep existing server default behavior (ollama).
  if (String(env.OPENAI_API_KEY || "").trim()) return "openai";
  if (String(env.GROK_API_KEY || env.XAI_API_KEY || "").trim()) return "grok";
  if (String(env.LLM_API_KEY || "").trim()) return "openai_compat";

  return "ollama";
}

async function fetchWithTimeout(url, opts = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), Math.max(50, Number(timeoutMs) || DEFAULT_TIMEOUT_MS));
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

function getOllamaBaseUrl(env = process.env) {
  const u = String(env.OLLAMA_URL || env.OLLAMA_HOST || "http://127.0.0.1:11434").trim();
  return u.replace(/\/$/, "");
}

function pickProbeModel(env = process.env) {
  // Match typical project envs.
  const m = String(env.OLLAMA_MODEL || env.OLLAMA_MODEL_NAME || env.LLM_MODEL || "aetheryn").trim();
  return m || "aetheryn";
}

async function probeOllama(env = process.env) {
  const baseUrl = getOllamaBaseUrl(env);
  const model = pickProbeModel(env);

  let res;
  try {
    res = await fetchWithTimeout(`${baseUrl}/api/tags`, { method: "GET" }, 2500);
  } catch (e) {
    return {
      ok: false,
      provider: "ollama",
      detail: `Cannot reach Ollama at ${baseUrl}. Start Ollama or set OLLAMA_URL/OLLAMA_HOST.`,
      hint: `Try: ollama serve   (or set OLLAMA_URL=http://<ip>:11434)`,
    };
  }

  if (!res.ok) {
    return {
      ok: false,
      provider: "ollama",
      detail: `Ollama /api/tags failed (HTTP ${res.status}).`,
      hint: `Check OLLAMA_URL/OLLAMA_HOST and that this is an Ollama server.`,
    };
  }

  let data;
  try {
    data = await res.json();
  } catch {
    return {
      ok: false,
      provider: "ollama",
      detail: "Non-JSON response from Ollama /api/tags.",
      hint: "Check Ollama logs.",
    };
  }

  const names = (Array.isArray(data?.models) ? data.models : [])
    .map((m) => (m && typeof m.name === "string" ? m.name : ""))
    .filter(Boolean);

  // If the user configured an explicit model, verify it exists.
  // If they use 'auto', accept as long as any model exists.
  const cfg = String(env.OLLAMA_MODEL || env.LLM_MODEL || "").trim();
  const cfgIsAuto = !cfg || String(cfg).trim().toLowerCase() === "auto";

  if (!names.length) {
    return {
      ok: false,
      provider: "ollama",
      detail: `Ollama is reachable at ${baseUrl}, but no models are installed.`,
      hint: `Install a model: ollama pull llama3.1:8b  (or build your AETHERYN Modelfile).`,
    };
  }

  if (!cfgIsAuto) {
    const found = names.some((n) => n === model || n.startsWith(model + ":") || n.toLowerCase().startsWith(model.toLowerCase() + ":"));
    if (!found) {
      return {
        ok: false,
        provider: "ollama",
        detail: `Model "${model}" not found.`,
        hint: `Run: ollama pull ${model}   (or create it from your Modelfile).`,
      };
    }
  }

  return {
    ok: true,
    provider: "ollama",
    detail: `Ollama OK — ${cfgIsAuto ? "auto model" : `model \"${model}\"`} ready`,
  };
}

export async function probeLLM(env = process.env) {
  const provider = detectProvider(env);

  if (String(provider).toLowerCase() === "ollama") {
    return await probeOllama(env);
  }

  // For cloud providers, avoid billable probes; just confirm keys are present.
  if (String(provider).toLowerCase() === "openai") {
    const ok = !!String(env.OPENAI_API_KEY || "").trim();
    return { ok, provider: "openai", detail: ok ? "OPENAI_API_KEY detected — ready" : "OPENAI_API_KEY missing" };
  }
  if (String(provider).toLowerCase() === "grok" || String(provider).toLowerCase() === "xai") {
    const ok = !!String(env.GROK_API_KEY || env.XAI_API_KEY || "").trim();
    return { ok, provider: "grok", detail: ok ? "GROK/XAI key detected — ready" : "GROK/XAI key missing" };
  }

  // Generic OpenAI-compatible.
  const ok = !!String(env.LLM_API_KEY || "").trim() || String(env.LLM_ALLOW_BLANK_KEY || "").toLowerCase() === "on";
  return { ok: !!ok, provider: "openai_compat", detail: ok ? "LLM_API_KEY present (or blank allowed) — ready" : "LLM_API_KEY missing" };
}
