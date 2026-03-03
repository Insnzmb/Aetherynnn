// LLM adapter: provider-agnostic chat call.
// Supports:
//  - openai_compat: OpenAI-style /v1/chat/completions (used by many hosted APIs)
//  - ollama:        Ollama /api/chat (streaming NDJSON)
//
// Design goal: game logic must NOT depend on provider-specific structured outputs.
// Treat output as TEXT and parse/validate locally.

export function normProvider(p) {
  const t = String(p || "").trim().toLowerCase();
  if (!t) return "openai_compat";
  if (t === "openai" || t === "openai-compat" || t === "openai_compatible" || t === "openai_compat") return "openai_compat";
  if (t === "ollama") return "ollama";
  // Aliases commonly used in configs
  if (t === "grok" || t === "xai") return "openai_compat";
  return t;
}

function stripTrailingSlash(u) {
  return String(u || "").replace(/\/$/, "");
}

// Dual timeout:
// - idle timeout: abort if NO progress for idleMs
// - hard timeout: abort regardless after totalMs
// This prevents "streams forever" / "silent hang" states.
function withDualTimeout({ idleMs = 120000, totalMs = 120000 } = {}) {
  const ac = new AbortController();
  let idleTimer = null;
  let totalTimer = null;
  let abortWhy = "";

  const armIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      abortWhy = `LLM idle-timeout: no data for ${Math.max(50, Number(idleMs) || 0)}ms`;
      try { ac.abort(); } catch {}
    }, Math.max(50, Number(idleMs) || 120000));
  };

  // Total timeout is always armed once.
  totalTimer = setTimeout(() => {
    abortWhy = `LLM hard-timeout: exceeded ${Math.max(50, Number(totalMs) || 0)}ms`;
    try { ac.abort(); } catch {}
  }, Math.max(50, Number(totalMs) || 120000));

  armIdle();

  return {
    ac,
    tick: () => armIdle(),
    why: () => abortWhy,
    done: () => {
      if (idleTimer) clearTimeout(idleTimer);
      if (totalTimer) clearTimeout(totalTimer);
    },
  };
}

function isAbortLike(e) {
  const name = String(e?.name || "");
  const msg = String(e?.message || e || "");
  return name === "AbortError" || /aborted|abort/i.test(msg);
}

export async function llmChat({
  provider,
  baseUrl,
  apiKey,
  model,
  messages,
  temperature,
  maxTokens,
  timeoutMs,
  // Optional provider-specific extras
  ollama = {},
  openai = {},
} = {}) {
  const p = normProvider(provider);
  const url = stripTrailingSlash(baseUrl);
  const mm = String(model || "").trim();
  const msgs = Array.isArray(messages) ? messages : [];
  const temp = Number.isFinite(Number(temperature)) ? Number(temperature) : undefined;
  // maxTokens semantics:
  // - undefined/null => omit token cap
  // - <= 0          => treated as "no cap" (for Ollama we pass through, OpenAI-compat omits)
  const mt = Number.isFinite(Number(maxTokens)) ? Number(maxTokens) : undefined;

  // Semantics:
  // - timeoutMs is a HARD CAP for the whole request
  // - LLM_IDLE_TIMEOUT_MS (optional) aborts if no bytes arrive for a while
  //
  // NOTE: Some users prefer *no* hard/idle timeouts for slow local models.
  // If timeoutMs <= 0 OR LLM_DISABLE_ABORT=on, we do not arm AbortController timers.
  const disableAbort = (
    (Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) <= 0) ||
    String(process.env.LLM_DISABLE_ABORT || '').trim().toLowerCase() === 'on'
  );

  const totalTimeoutMs = disableAbort
    ? null
    : Math.max(50, Number(timeoutMs ?? process.env.LLM_TIMEOUT_MS ?? 120000));
  const idleTimeoutMs = disableAbort
    ? null
    : Math.max(50, Number(process.env.LLM_IDLE_TIMEOUT_MS || totalTimeoutMs));

  const timers = disableAbort ? null : withDualTimeout({ idleMs: idleTimeoutMs, totalMs: totalTimeoutMs });
  const done = () => { try { timers?.done?.(); } catch {} };
  const tick = () => { try { timers?.tick?.(); } catch {} };
  const why = () => { try { return timers?.why?.() || ''; } catch { return ''; } };
  const signal = disableAbort ? undefined : timers.ac.signal;

  try {
    if (p === "ollama") {
      // Streamed NDJSON. We reset the *idle* timeout whenever bytes arrive.
      const keepAlive = String(ollama.keepAlive || "30m");
      const options = (ollama.options && typeof ollama.options === "object") ? ollama.options : {};

      const body = {
        model: mm,
        keep_alive: keepAlive,
        messages: msgs,
        stream: true,
        options: {
          ...(temp !== undefined ? { temperature: temp } : {}),
          ...(mt !== undefined ? { num_predict: mt } : {}),
          ...options,
        },
      };

      let resp;
      try {
        resp = await fetch(`${url}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          ...(signal ? { signal } : {}),
        });
      } catch (e) {
        if (isAbortLike(e)) {
          throw new Error(`${why() || "LLM request aborted"}. Fix: start Ollama, choose a smaller model, or raise LLM_TIMEOUT_MS / LLM_IDLE_TIMEOUT_MS.`);
        }
        throw e;
      }

      if (!resp.ok) {
        const t = await resp.text().catch(() => "");
        throw new Error(`LLM(ollama) HTTP ${resp.status}: ${t.slice(0, 500)}`);
      }

      const reader = resp.body?.getReader?.();
      if (!reader) {
        // Fallback if streaming isn't available.
        const data = await resp.json().catch(() => ({}));
        return String(data?.message?.content ?? "");
      }

      const dec = new TextDecoder();
      let buf = "";
      let out = "";

      try {
        while (true) {
          const { value, done: rdDone } = await reader.read();
          if (value) {
              tick();
            buf += dec.decode(value, { stream: true });
            let idx;
            while ((idx = buf.indexOf("\n")) >= 0) {
              const line = buf.slice(0, idx).trim();
              buf = buf.slice(idx + 1);
              if (!line) continue;
              let obj = null;
              try { obj = JSON.parse(line); } catch { obj = null; }
              if (!obj) continue;
              const chunk = String(obj?.message?.content ?? "");
              if (chunk) out += chunk;
              if (obj?.done === true) return out;
            }
          }
          if (rdDone) break;
        }
      } catch (e) {
        if (isAbortLike(e)) {
          throw new Error(`${why() || "LLM request aborted"}. Fix: choose a smaller model, or raise LLM_TIMEOUT_MS / LLM_IDLE_TIMEOUT_MS.`);
        }
        throw e;
      }

      return out;
    }

    // Default: OpenAI-compatible chat completions (non-stream for maximum compatibility).
    const headers = {
      "Content-Type": "application/json",
      ...(apiKey ? { "Authorization": `Bearer ${apiKey}` } : {}),
    };

    const body = {
      model: mm,
      messages: msgs,
      ...(temp !== undefined ? { temperature: temp } : {}),
      // OpenAI-compatible APIs generally don't accept "unlimited" tokens. If mt <= 0, omit.
      ...(mt !== undefined && mt > 0 ? { max_tokens: mt } : {}),
      ...(openai && typeof openai === "object" ? openai : {}),
    };

    let resp;
    try {
      resp = await fetch(`${url}/v1/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        ...(signal ? { signal } : {}),
      });
    } catch (e) {
      if (isAbortLike(e)) {
        throw new Error(`${why() || "LLM request aborted"}. Fix: verify base URL/key/model, or raise LLM_TIMEOUT_MS.`);
      }
      throw e;
    }

    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      throw new Error(`LLM(openai_compat) HTTP ${resp.status}: ${t.slice(0, 500)}`);
    }

    const data = await resp.json().catch(() => ({}));
    return String(data?.choices?.[0]?.message?.content ?? "");
  } finally {
    done();
  }
}
