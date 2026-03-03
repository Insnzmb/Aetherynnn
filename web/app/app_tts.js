// -------------------- Text-to-Speech (local browser) --------------------
// Uses the Web Speech API (speechSynthesis) on the client.
// No server load; settings are per-browser via localStorage.

(function(){
  'use strict';

  const KEY = 'aetheryn_tts_v1';

  const lsGetSafe = (k, fb='') => {
    try {
      if (typeof lsGet === 'function') return lsGet(k, fb);
      const v = localStorage.getItem(String(k));
      return (v === null || v === undefined) ? fb : v;
    } catch { return fb; }
  };
  const lsSetSafe = (k, v) => {
    try {
      if (typeof lsSet === 'function') return lsSet(k, v);
      localStorage.setItem(String(k), String(v));
    } catch {}
  };

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  const defaults = {
    enabled: false,
    autoNarration: true,
    readChoices: false,
    interrupt: true,
    voice: '', // voiceURI or name
    rate: 0.95,
    pitch: 1.0,
    volume: 1.0,
    scope: 'gm' // gm | all
  };

  function load(){
    try {
      const raw = lsGetSafe(KEY, '');
      if (!raw) return { ...defaults };
      const parsed = JSON.parse(raw);
      return { ...defaults, ...(parsed || {}) };
    } catch {
      return { ...defaults };
    }
  }

  let state = load();

  const synth = (typeof window !== 'undefined') ? window.speechSynthesis : null;
  const supported = !!(synth && typeof window.SpeechSynthesisUtterance !== 'undefined');

  // UI nodes
  const ttsToggleBtn = document.getElementById('ttsToggleBtn');
  const ttsEnabledChk = document.getElementById('ttsEnabled');
  const ttsAutoNarrationChk = document.getElementById('ttsAutoNarration');
  const ttsReadChoicesChk = document.getElementById('ttsReadChoices');
  const ttsInterruptChk = document.getElementById('ttsInterrupt');
  const ttsVoiceSel = document.getElementById('ttsVoice');
  const ttsRateRange = document.getElementById('ttsRate');
  const ttsPitchRange = document.getElementById('ttsPitch');
  const ttsVolumeRange = document.getElementById('ttsVolume');
  const ttsSpeakLastBtn = document.getElementById('ttsSpeakLast');
  const ttsTestBtn = document.getElementById('ttsTest');
  const ttsStopBtn = document.getElementById('ttsStop');
  const ttsHintEl = document.getElementById('ttsHint');

  let voices = [];
  let lastNarration = '';
  let lastChoices = [];
  let pendingSpeakChoices = false;

  function save(){
    try { lsSetSafe(KEY, JSON.stringify(state)); } catch {}
  }

  function setState(patch){
    state = { ...state, ...(patch || {}) };
    save();
    syncUi();
    syncTopbar();
  }

  function normalizeForSpeech(t){
    let s = String(t || '').replace(/\r/g, '');
    if (!s.trim()) return '';

    // Drop code fences / inline code.
    s = s.replace(/```[\s\S]*?```/g, ' ');
    s = s.replace(/`([^`]+)`/g, '$1');

    // Markdown links: [text](url) -> text
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');

    // Headings / bullets become sentence breaks.
    s = s.replace(/^\s*#+\s*/gm, '');
    s = s.replace(/^\s*[-*+]\s+/gm, '');

    // Remove obvious token-noise lines when they appear verbatim.
    s = s.replace(/^\s*(loc|time|clock|day|hp|mp|stamina|stam|inv|eq|equip|stash|asset|pc|party|res)\s*[:=].*$/gmi, '');

    // Treat paragraph breaks as pauses.
    s = s.replace(/\n{2,}/g, '. ');
    s = s.replace(/\n+/g, ' ');

    // Normalize whitespace.
    s = s.replace(/\s+/g, ' ').trim();

    // Tiny niceties.
    s = s.replace(/\s+([,.;!?])/g, '$1');
    return s;
  }

  function cleanText(t){
    return normalizeForSpeech(t);
  }

  function splitIntoSentences(s){
    const text = cleanText(s);
    if (!text) return [];

    // Very compatible sentence splitter (no lookbehind).
    const out = [];
    let buf = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      buf += ch;
      if (ch === '.' || ch === '!' || ch === '?') {
        // End a sentence when followed by space (or end of string).
        const next = (i + 1 < text.length) ? text[i + 1] : '';
        if (!next || next === ' ') {
          const s2 = buf.trim();
          if (s2) out.push(s2);
          buf = '';
        }
      }
    }
    const tail = buf.trim();
    if (tail) out.push(tail);
    return out.length ? out : [text];
  }

  function chunkLong(s, maxLen){
    const text = cleanText(s);
    if (!text) return [];
    if (text.length <= maxLen) return [text];

    // Split by words.
    const words = text.split(' ').filter(Boolean);
    const chunks = [];
    let cur = '';
    for (const w of words) {
      if (!cur) {
        cur = w;
        continue;
      }
      if ((cur.length + 1 + w.length) <= maxLen) {
        cur += ' ' + w;
      } else {
        chunks.push(cur);
        cur = w;
      }
    }
    if (cur) chunks.push(cur);
    return chunks.length ? chunks : [text];
  }

  function chunkText(text, maxLen=240){
    const sentences = splitIntoSentences(text);
    const out = [];

    let buf = '';
    for (const s of sentences) {
      if (!buf) {
        buf = s;
        continue;
      }
      if ((buf.length + 1 + s.length) <= maxLen) {
        buf += ' ' + s;
      } else {
        // Flush buf (may still be too long)
        out.push(...chunkLong(buf, maxLen));
        buf = s;
      }
    }
    if (buf) out.push(...chunkLong(buf, maxLen));

    return out.map(x => x.trim()).filter(Boolean);
  }

  function refreshVoices(){
    if (!supported) return;
    try {
      voices = synth.getVoices() || [];
    } catch {
      voices = [];
    }

    if (!ttsVoiceSel) return;

    const selected = String(state.voice || '');
    const keepAuto = ttsVoiceSel.querySelector('option[value=""]');
    ttsVoiceSel.innerHTML = '';
    if (keepAuto) {
      ttsVoiceSel.appendChild(keepAuto);
    } else {
      const o = document.createElement('option');
      o.value = '';
      o.textContent = 'Auto';
      ttsVoiceSel.appendChild(o);
    }

    const seen = new Set();
    for (const v of voices) {
      const id = String(v.voiceURI || v.name || '').trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);

      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = `${v.name || 'Voice'} (${v.lang || '—'})${v.default ? ' • default' : ''}`;
      ttsVoiceSel.appendChild(opt);
    }

    // restore selection
    ttsVoiceSel.value = selected;
  }

  function scoreVoice(v){
    try {
      const name = String(v?.name || '').toLowerCase();
      const lang = String(v?.lang || '').toLowerCase();
      let score = 0;

      // Language fit
      if (lang.startsWith('en')) score += 40;

      // Quality-ish keywords (varies by platform)
      if (name.includes('natural')) score += 80;
      if (name.includes('neural')) score += 70;
      if (name.includes('online')) score += 35;
      if (name.includes('microsoft')) score += 25;
      if (name.includes('google')) score += 25;

      // Penalize known robotic engines
      if (name.includes('espeak') || name.includes('festival')) score -= 80;
      if (name.includes('robot')) score -= 40;

      // Slight bias toward the platform default
      if (v?.default) score += 8;

      return score;
    } catch { return 0; }
  }

  function pickVoice(){
    if (!supported) return null;
    const want = String(state.voice || '').trim();
    if (want) {
      const exact = voices.find(v => (v.voiceURI && v.voiceURI === want) || (v.name && v.name === want));
      if (exact) return exact;
    }

    if (!Array.isArray(voices) || !voices.length) return null;

    // Best guess: highest scored voice.
    const sorted = voices.slice().sort((a, b) => scoreVoice(b) - scoreVoice(a));
    return sorted[0] || voices.find(v => v.default) || voices[0] || null;
  }
  let _queue = [];
  let _draining = false;
  let _seq = 0;

  function stop(){
    if (!supported) return;
    _seq++;
    _queue = [];
    _draining = false;
    try { synth.cancel(); } catch {}
  }

  function _pauseForChunk(chunk){
    const s = String(chunk || '').trim();
    const last = s ? s[s.length - 1] : '';
    if (last === '?' || last === '!') return 240;
    if (last === '.') return 190;
    if (last === ',' || last === ';' || last === ':') return 140;
    return 110;
  }

  function _drain(){
    if (!supported) return;
    if (_draining) return;
    if (!_queue.length) return;

    _draining = true;
    const mySeq = _seq;

    const step = () => {
      if (mySeq != _seq) { _draining = false; return; }
      if (!_queue.length) { _draining = false; return; }

      const item = _queue.shift();
      const u = new SpeechSynthesisUtterance(String(item?.text || ''));
      try {
        if (item?.voice) u.voice = item.voice;
        if (item?.lang) u.lang = item.lang;
      } catch {}
      u.rate = item?.rate ?? 1;
      u.pitch = item?.pitch ?? 1;
      u.volume = item?.volume ?? 1;

      const pause = _pauseForChunk(item?.text);

      u.onend = () => {
        if (mySeq != _seq) { _draining = false; return; }
        _draining = false;
        setTimeout(() => step(), pause);
      };
      u.onerror = () => {
        if (mySeq != _seq) { _draining = false; return; }
        _draining = false;
        setTimeout(() => step(), 120);
      };

      try { synth.speak(u); } catch {
        _draining = false;
        setTimeout(() => step(), 120);
      }
    };

    step();
  }

  function speak(text, opts = {}){
    if (!supported) return;
    if (!state.enabled) return;

    const interrupt = (typeof opts.interrupt === 'boolean') ? opts.interrupt : !!state.interrupt;
    if (interrupt) stop();

    const cleaned = cleanText(text);
    if (!cleaned) return;

    const chunks = chunkText(cleaned, 220);
    if (!chunks.length) return;

    const v = pickVoice();
    const rate = clamp(Number(state.rate || 1), 0.5, 2.0);
    const pitch = clamp(Number(state.pitch || 1), 0.0, 2.0);
    const volume = clamp(Number(state.volume || 1), 0.0, 1.0);

    for (const c of chunks) {
      _queue.push({
        text: c,
        voice: v || null,
        lang: v?.lang || '',
        rate, pitch, volume
      });
    }

    _drain();
  }

  function speakLast(){
    const t = cleanText(lastNarration);
    if (t) speak(t, { interrupt: true });
  }

  function speakChoicesNow(){
    if (!Array.isArray(lastChoices) || !lastChoices.length) return;
    const line = 'Choices: ' + lastChoices.map((c, i) => {
      let raw = '';
      if (c && typeof c === 'object') {
        const actor = String(c.actor || c.character || c.for || '').trim();
        const text = String(c.label || c.text || '').trim();
        raw = actor && text ? `${actor}: ${text}` : (text || actor);
      } else {
        raw = String(c || '').trim();
      }
      return `${i + 1}. ${raw.replace(/^\s*\d+\)\s*/, '')}`;
    }).join(' ... ');
    speak(line, { interrupt: false });
  }

  function syncTopbar(){
    if (!ttsToggleBtn) return;
    ttsToggleBtn.classList.toggle('active', !!state.enabled);
    ttsToggleBtn.title = state.enabled ? 'Text-to-speech: ON' : 'Text-to-speech: OFF';
    ttsToggleBtn.setAttribute('aria-label', ttsToggleBtn.title);
  }

  function syncUi(){
    // Hint
    if (ttsHintEl) {
      if (!supported) {
        ttsHintEl.textContent = 'TTS is not supported in this browser.';
      } else {
        ttsHintEl.textContent = 'Note: some browsers require one click (Test / Speak last) before auto-read can start.';
      }
    }

    // Disable controls if unsupported
    const disable = !supported;
    const nodes = [
      ttsEnabledChk, ttsAutoNarrationChk, ttsReadChoicesChk, ttsInterruptChk,
      ttsVoiceSel, ttsRateRange, ttsPitchRange, ttsVolumeRange,
      ttsSpeakLastBtn, ttsTestBtn, ttsStopBtn
    ].filter(Boolean);
    for (const n of nodes) {
      try { n.disabled = disable; } catch {}
    }

    if (ttsEnabledChk) ttsEnabledChk.checked = !!state.enabled;
    if (ttsAutoNarrationChk) ttsAutoNarrationChk.checked = !!state.autoNarration;
    if (ttsReadChoicesChk) ttsReadChoicesChk.checked = !!state.readChoices;
    if (ttsInterruptChk) ttsInterruptChk.checked = !!state.interrupt;

    if (ttsRateRange) ttsRateRange.value = String(clamp(Number(state.rate || 1), 0.7, 1.3));
    if (ttsPitchRange) ttsPitchRange.value = String(clamp(Number(state.pitch || 1), 0.7, 1.3));
    if (ttsVolumeRange) ttsVolumeRange.value = String(clamp(Number(state.volume || 1), 0.0, 1.0));

    if (ttsVoiceSel) {
      // If voices aren't loaded yet, refreshVoices will repopulate.
      try { ttsVoiceSel.value = String(state.voice || ''); } catch {}
    }
  }

  function shouldSpeakMsg(msg){
    if (!supported || !state.enabled) return false;
    if (!state.autoNarration) return false;

    const who = String(msg?.who || '').toUpperCase();
    const tag = String(msg?.tag || '').toUpperCase();
    const kind = String(msg?.kind || '').toLowerCase();

    // Never read system spam by default.
    if (who === 'SYSTEM' || tag === 'SYSTEM' || tag === 'STATE' || tag === 'MODE') return false;

    if (String(state.scope || 'gm') === 'all') {
      return true;
    }

    // GM narration focus (default)
    if (kind === 'gm') return true;
    if (tag === 'SCENE' || tag === 'LOOK' || tag === 'PEEK') return true;
    return false;
  }

  function onMsg(msg){
    try {
      if (!shouldSpeakMsg(msg)) return;
      const text = cleanText(msg?.text || '');
      if (!text) return;
      lastNarration = text;
      speak(text, { interrupt: !!state.interrupt });
      try {
        if (pendingSpeakChoices && state.readChoices && Array.isArray(lastChoices) && lastChoices.length) {
          pendingSpeakChoices = false;
          speakChoicesNow();
        }
      } catch {}
    } catch {}
  }

  // Called directly from the narration event so we can optionally speak choices.
  function onNarration(payload){
    try {
      const narr = cleanText(payload?.text || '');
      if (narr) lastNarration = narr;
      const ch = Array.isArray(payload?.choices) ? payload.choices : [];
      lastChoices = ch;

      if (!supported || !state.enabled) return;
      if (!state.autoNarration) return;

      if (state.readChoices && ch.length) {
        // Speak choices AFTER the narration is actually enqueued/spoken.
        pendingSpeakChoices = true;
      }
    } catch {}
  }

  // Wire UI
  ttsToggleBtn?.addEventListener('click', () => {
    const next = !state.enabled;
    setState({ enabled: next });
    if (!next) stop();
    // If enabling, do a tiny silent-ish nudge via hint (no auto speak).
  });

  ttsEnabledChk?.addEventListener('change', () => {
    const next = !!ttsEnabledChk.checked;
    setState({ enabled: next });
    if (!next) stop();
  });

  ttsAutoNarrationChk?.addEventListener('change', () => setState({ autoNarration: !!ttsAutoNarrationChk.checked }));
  ttsReadChoicesChk?.addEventListener('change', () => setState({ readChoices: !!ttsReadChoicesChk.checked }));
  ttsInterruptChk?.addEventListener('change', () => setState({ interrupt: !!ttsInterruptChk.checked }));

  ttsVoiceSel?.addEventListener('change', () => setState({ voice: String(ttsVoiceSel.value || '') }));
  ttsRateRange?.addEventListener('input', () => setState({ rate: Number(ttsRateRange.value || 1) || 1 }));
  ttsPitchRange?.addEventListener('input', () => setState({ pitch: Number(ttsPitchRange.value || 1) || 1 }));
  ttsVolumeRange?.addEventListener('input', () => setState({ volume: Number(ttsVolumeRange.value || 1) || 1 }));

  ttsSpeakLastBtn?.addEventListener('click', () => speakLast());
  ttsTestBtn?.addEventListener('click', () => {
    setState({ enabled: true });
    speak('Aetheryn text to speech is online.', { interrupt: true });
  });
  ttsStopBtn?.addEventListener('click', () => stop());

  // Voice list loading is async in many browsers.
  if (supported) {
    try { refreshVoices(); } catch {}
    try {
      window.speechSynthesis.onvoiceschanged = () => {
        try { refreshVoices(); } catch {}
      };
    } catch {}
  }

  // Initial UI sync
  syncUi();
  syncTopbar();

  // Expose a tiny API for the rest of the app.
  window.AETH_TTS = {
    supported,
    getState: () => ({ ...state }),
    setState: (p) => setState(p),
    speak,
    stop,
    speakLast,
    onMsg,
    onNarration,
  };

})();
