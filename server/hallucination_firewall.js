import fs from 'fs';
import path from 'path';

function norm(s) {
  return String(s || '').trim().toLowerCase();
}

export function loadEntityRegistry({ baseDir }) {
  try {
    const fp = path.join(baseDir, 'entity_registry.json');
    if (!fs.existsSync(fp)) {
      return { version: 'missing', policy: {}, sets: {}, raw: null };
    }
    const raw = JSON.parse(fs.readFileSync(fp, 'utf8'));
    const policy = (raw && typeof raw.policy === 'object') ? raw.policy : {};

    const collect = (...arrs) => {
      const out = new Set();
      for (const a of arrs) {
        for (const x of (Array.isArray(a) ? a : [])) {
          const k = norm(x);
          if (k) out.add(k);
        }
      }
      return out;
    };

    const sets = {
      places: collect(raw.places),
      institutions: collect(raw.institutions),
      factions: collect(raw.factions),
      scars: collect(raw.scars),
      history_events: collect(raw.history_events),
      cosmology_terms: collect(raw.cosmology_terms)
    };

    // Master allow-set: anything in any category.
    const all = collect(
      raw.places,
      raw.institutions,
      raw.factions,
      raw.scars,
      raw.history_events,
      raw.cosmology_terms
    );

    return { version: String(raw.version || 'unknown'), policy, sets: { ...sets, all }, raw };
  } catch {
    return { version: 'error', policy: {}, sets: {}, raw: null };
  }
}

const CONNECTORS = new Set(['of', 'the', 'and', 'de', 'la', 'da', 'del']);
const STOP_SINGLE = new Set([
  'a', 'an', 'the', 'i', 'we', 'you', 'he', 'she', 'they', 'it', 'my', 'your', 'our', 'their',
  'this', 'that', 'these', 'those', 'one', 'two', 'three', 'four', 'five',
  'day', 'night', 'dawn', 'dusk', 'morning', 'evening'
]);

const PLACE_SUFFIXES = [
  'pass','range','river','coast','vale','bay','basin','march','reach','hold','holdfast','keep','fort','fortress',
  'city','town','village','hamlet','moor','fen','delta','plains','plateau','gulf','peaks','barrens','crater','spire','orchard'
];

const INSTITUTION_SUFFIXES = [
  'order','guild','sentinels','council','church','abbey','temple','college','archive','registry','census','court','imperium',
  'covenant','confederacy','dominion','crownlands','principalities'
];

function hasSuffixHint(phraseNorm, suffixes) {
  // Check last word suffix hint
  const parts = phraseNorm.split(/\s+/).filter(Boolean);
  if (!parts.length) return false;
  const last = parts[parts.length - 1];
  return suffixes.includes(last);
}

function isRumorFramed(textLower, phraseLower) {
  const idx = textLower.indexOf(phraseLower);
  if (idx < 0) return false;
  const left = textLower.slice(Math.max(0, idx - 80), idx);
  return /(rumor|rumour|locals\s+say|they\s+say|some\s+say|some\s+call|locals\s+call|nicknamed|called)\b/.test(left);
}

export function extractProperNounPhrases(text) {
  const s = String(text || '');
  if (!s) return [];

  // Match sequences of capitalized words, allowing connectors like "of" in between.
  // Examples: "Bay of Verdant", "War of Seven Witnesses", "Frostveil Dominion".
  const re = /\b[A-Z][\w'\-]{1,}(?:\s+(?:of|the|and|de|la|da|del)\s+[A-Z][\w'\-]{1,}|\s+[A-Z][\w'\-]{1,})+\b/g;
  const out = new Set();
  let m;
  while ((m = re.exec(s)) !== null) {
    let phr = String(m[0] || '').trim();
    if (!phr) continue;

    // Normalize common sentence-starter stopwords that can incorrectly attach to a canonical name.
    // Example: "At Heartwood Spire" should validate against registry entry "Heartwood Spire".
    // This keeps the drift guard strict without producing false positives.
    const words = phr.split(/\s+/).filter(Boolean);
    if (words.length >= 3) {
      const first = words[0];
      if (/^(At|In|On|Within|From|To|Into|Near|Beyond|Around|Inside|Outside|Under|Over|The|A|An)$/.test(first)) {
        phr = words.slice(1).join(' ');
      }
    }

    if (!phr) continue;
    // Filter out pure sentence-starters like "The World" that add noise.
    const low = norm(phr);
    if (!low) continue;
    out.add(phr);
  }
  return Array.from(out);
}

export function validateUnifiedTurnOutput({ parsed, retrievedIds = [], pinnedIds = [], registry, expectedPovIds = [], requirePov = false, gear = null, actionAnchors = [], locAnchors = [] }) {
  const errors = [];
  const warnings = [];

  const obj = (parsed && typeof parsed === 'object') ? parsed : null;
  if (!obj) return { ok: false, errors: ['Output is not a JSON object.'], warnings, details: {} };

  const narration = String(obj.narration || '').trim();


  const povObj = (obj.pov && typeof obj.pov === 'object') ? obj.pov : null;
  const povTexts = [];
  if (povObj) {
    for (const v of Object.values(povObj)) {
      if (typeof v === 'string' && v.trim()) povTexts.push(String(v).trim());
    }
  }
  const allNarrText = [narration, ...povTexts].filter(Boolean).join("\n\n");
  if (!narration) errors.push('Missing narration.');

// "Lost/confused" guard: reject out-of-world assistant disclaimers and internal token leaks.
if (/(as an ai|language model|i\s+(?:cannot|can't)|i\s+am\s+unable|i\s+do\s+not\s+have\s+access)/i.test(allNarrText)) {
  errors.push('Out-of-world assistant text detected (AI disclaimer).');
}

// Unified schema: narration must NOT include a CHOICES block.
if (/\n\s*CHOICES\s*:/i.test(narration) || /^\s*CHOICES\s*:/i.test(narration)) {
  errors.push('Narration must not include a CHOICES block (unified schema).');
}

// Do not allow raw internal token families to appear anywhere in narration/POV.
if (/\b(?:loc|xy|mode|flag|clock|day|time|pressure|residue)\s*[:=]/i.test(allNarrText)) {
  errors.push('Narration leaked internal token text (loc/xy/mode/etc).');
}

// Prevent "silent non-response": require a minimum narration length.
if (narration.length && narration.length < 120) {
  errors.push('Narration too short/empty; regenerate with a real scene.');
}


  // Action/scene drift guard: narration must actually address the player's input and stay anchored to the current location.
  const lowAll = narration.toLowerCase();
  const act = Array.isArray(actionAnchors) ? actionAnchors.map(x => norm(x)).filter(Boolean) : [];
  const loc = Array.isArray(locAnchors) ? locAnchors.map(x => norm(x)).filter(Boolean) : [];

  if (act.length) {
    const hit = act.some(a => lowAll.includes(a));
    if (!hit) errors.push("Narration does not acknowledge the player's action (missing action anchors).");
  }

  if (loc.length) {
    const hit = loc.some(a => lowAll.includes(a));
    if (!hit) errors.push("Narration appears ungrounded in the current location (missing location anchors).");
  }


  // Choices may be strings or objects like {label, requires_items:[]}
  const rawChoices = Array.isArray(obj.choices) ? obj.choices : [];
  const choices = rawChoices.map(c => {
    if (typeof c === 'string') return c;
    if (c && typeof c === 'object') return String(c.label || c.text || '').trim();
    return String(c || '').trim();
  }).filter(Boolean);
  if (choices.length < 5) errors.push('choices must contain at least 5 options.');

  // Optional: validate gear references inside choices.
  // gear: { names:Set(lower item names), keywords:Set(lower keywords) }
  const gearNames = gear?.names instanceof Set ? gear.names : null;
  const gearKeywords = gear?.keywords instanceof Set ? gear.keywords : null;

  // Include items gained in this same turn's ops (so "gain_item" + "use it" doesn't deadlock validation).
  const opsForGear = Array.isArray(obj.ops) ? obj.ops : [];
  const availNames = gearNames ? new Set(Array.from(gearNames)) : null;
  const availKeywords = gearKeywords ? new Set(Array.from(gearKeywords)) : null;
  try {
    for (const o of opsForGear) {
      const op = String(o?.op || '').trim().toLowerCase();
      if (op !== 'gain_item') continue;
      const itemRaw = String(o?.item || '').trim();
      if (!itemRaw) continue;
      const k = norm(itemRaw);
      if (!k) continue;
      const cleaned = k.replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9'\- ]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (availNames) { availNames.add(k); if (cleaned) availNames.add(cleaned); }
      if (availKeywords) {
        const last = (cleaned || k).split(/\s+/).filter(Boolean).slice(-1)[0] || (cleaned || k);
        if (last) availKeywords.add(last);
      }
    }
  } catch {}

  const gNames = availNames || gearNames;
  const gKeywords = availKeywords || gearKeywords;


  // Tool-ish noun list to avoid flagging environment uses like "use the door".
  const TOOLISH = new Set([
    'crowbar','lockpick','lockpicks','pick','picks','pickaxe','axe','hatchet','shovel','spade','hammer','mallet','chisel','saw',
    'lantern','torch','rope','knife','dagger','sword','bow','arrow','arrows','bolt','bolts','crossbow',
    'potion','elixir','salve','scroll','key','keys','bandage','tinder','kit','flint','steel','waterskin','rations'
  ]);
  if (gKeywords) {
    for (const k of gKeywords) TOOLISH.add(String(k));
  }

  const SAFE_NON_GEAR = new Set(['hands','hand','fists','fist','voice','eyes','mind','body','breath','feet']);

  function choiceHasUnknownGear(choiceText) {
    if (!choiceText || !(gNames || gKeywords)) return null;
    const t = String(choiceText).trim();
    const low = t.toLowerCase();

    // 1) Strong possession pattern: "use your <thing>" => <thing> must match gear.
    const poss = low.match(/\buse\s+your\s+([a-z][a-z0-9'\- ]{1,40})/i);
    if (poss) {
      const phr = String(poss[1] || '').trim().replace(/[\.,;:!?\)]$/, '');
      const k = norm(phr);
      if (!k || SAFE_NON_GEAR.has(k)) return null;
      if (gNames?.has(k)) return null;
      const last = k.split(/\s+/).filter(Boolean).slice(-1)[0] || k;
      if (gKeywords?.has(last)) return null;
      return `Choice implies possession of item not in inventory/equipment: "${phr}"`;
    }

    // 2) Generic tool usage pattern: only enforce if it looks tool-ish.
    const gen = low.match(/\b(?:use|using|with)\s+(?:the|a|an)\s+([a-z][a-z0-9'\- ]{1,40})/i);
    if (gen) {
      const phr = String(gen[1] || '').trim().replace(/[\.,;:!?\)]$/, '');
      const k = norm(phr);
      if (!k || SAFE_NON_GEAR.has(k)) return null;

      const words = k.split(/\s+/).filter(Boolean);
      const looksToolish = words.some(w => TOOLISH.has(w));
      if (!looksToolish) return null;

      if (gNames?.has(k)) return null;
      const last = words.slice(-1)[0] || k;
      if (gKeywords?.has(last)) return null;
      return `Choice references tool-ish item not available: "${phr}"`;
    }

    // 3) "Pick up / take / grab" a tool-ish item: disallow unless it exists in known gear (or is framed generically).
    const pickup = low.match(/\b(?:pick\s*up|grab|take)\s+(?:the|a|an)\s+([a-z][a-z0-9'\- ]{1,40})/i);
    if (pickup) {
      const phr = String(pickup[1] || '').trim().replace(/[\.,;:!?\)]$/, '');
      const k = norm(phr);
      if (!k) return null;
      const words = k.split(/\s+/).filter(Boolean);
      const looksToolish = words.some(w => TOOLISH.has(w));
      if (!looksToolish) return null;
      if (gNames?.has(k)) return null;
      const last = words.slice(-1)[0] || k;
      if (gKeywords?.has(last)) return null;
      return `Choice offers a tool that has not been established: "${phr}"`;
    }

    return null;
  }

  if ((gNames || gKeywords) && rawChoices.length) {
    // Validate declared requires_items when present.
    for (const rc of rawChoices) {
      if (rc && typeof rc === 'object' && Array.isArray(rc.requires_items)) {
        for (const it of rc.requires_items) {
          const k = norm(it);
          if (!k) continue;
          const last = k.split(/\s+/).filter(Boolean).slice(-1)[0] || k;
          if (gNames?.has(k) || gKeywords?.has(last)) continue;
          // requires_items is advisory UI metadata; do not hard-fail the entire turn.
          warnings.push(`Choice requires item not in available gear (metadata): ${String(it)}`);
        }
      }
    }

    // Validate choice text for implied gear that isn't present.
    for (const c of choices) {
      const why = choiceHasUnknownGear(c);
      if (why) {
        errors.push(why);
        break;
      }
    }
  }

  // Sources enforcement.
  const sources = Array.isArray(obj.sources) ? obj.sources.map(x => String(x || '').trim()).filter(Boolean) : [];
  if (!sources.length) errors.push('Missing sources: provide canon chunk IDs used this turn.');

  const ridSet = new Set((retrievedIds || []).map(String));
  const pinSet = new Set((pinnedIds || []).map(String));
  const allowed = new Set([...ridSet, ...pinSet]);
  const badSources = sources.filter(cid => !allowed.has(cid));
  if (badSources.length) errors.push(`Invalid sources (not retrieved this turn): ${badSources.join(', ')}`);



// POV enforcement (multiplayer): require pov entries for each expected playerId.
if (requirePov && Array.isArray(expectedPovIds) && expectedPovIds.filter(Boolean).length > 1) {
  if (!povObj) errors.push('Missing pov{}: multiplayer requires per-player POV narration.');
  else {
    const missing = expectedPovIds.filter(pid => pid && !(Object.prototype.hasOwnProperty.call(povObj, pid)));
    if (missing.length) errors.push('pov{} missing entries for playerId(s): ' + missing.join(', '));
  }
}

  // Require pinned chunk included (keeps the "World Bible" always grounding the run).
  const missingPinned = (pinnedIds || []).filter(cid => cid && !sources.includes(cid));
  if (missingPinned.length) errors.push(`sources must include pinned canon chunk(s): ${missingPinned.join(', ')}`);

  // Dated-history guard: if narration contains explicit years/dates, require at least one history-ish chunk.
  const hasDate = /\b(?:year\s*)?[+-]?\d{3,5}\b/i.test(allNarrText) || /\b(bg|ag)\b/i.test(allNarrText);
  if (hasDate) {
    const hasHistorySource = sources.some(cid => /WORLD_(?:LORE_)?HISTORY|HISTORY/i.test(cid));
    if (!hasHistorySource) errors.push('Narration mentions dates/years, but sources include no history/timeline chunk.');
  }



  // Mechanics drift guard (lightweight): narration must not silently grant/restore/inflict.
  const ops = Array.isArray(obj.ops) ? obj.ops : [];
  const opSet = new Set(ops.map(o => String(o?.op || '').trim().toLowerCase()).filter(Boolean));

  const claimsLoot = /(you\s+(?:gain|receive|acquire|take|pick\s*up|pocket)|added\s+to\s+your\s+inventory)/i.test(allNarrText);
  if (claimsLoot && !(opSet.has('gain_item') || opSet.has('buy_asset') || opSet.has('gain_asset') || opSet.has('spend_res'))) {
    errors.push('Narration implies gaining items/resources, but ops[] contains no gain_item/buy/gain/spend operation.');
  }

  const claimsHeal = /(you\s+(?:heal|recover|are\s+healed)|wounds?\s+(?:close|knit))/i.test(allNarrText);
  if (claimsHeal && !opSet.has('apply_heal')) {
    warnings.push('Narration implies healing but ops[] has no apply_heal. (If this is only descriptive relief, ignore.)');
  }

  const claimsDamage = /(you\s+(?:take|suffer)\s+\d+\s+(?:damage|harm))/i.test(allNarrText);
  if (claimsDamage && !opSet.has('apply_damage')) {
    warnings.push('Narration states explicit damage but ops[] has no apply_damage.');
  }
  // Proper noun drift guard (places/institutions/factions only).
  const reg = registry?.sets?.all instanceof Set ? registry.sets.all : new Set();
  const policy = registry?.policy || {};

  if (reg.size) {
    const textLower = narration.toLowerCase();
    const phrases = extractProperNounPhrases(narration);
    const unknown = [];

    for (const p of phrases) {
      const pl = norm(p);
      if (!pl) continue;
      if (reg.has(pl)) continue;

      // Allow rumor-framed inventions (explicitly marked as rumor).
      if (policy.allow_new_local_nicknames && isRumorFramed(textLower, pl)) continue;

      // If it looks like a place or institution by suffix, treat as drift.
      const looksPlace = hasSuffixHint(pl, PLACE_SUFFIXES);
      const looksInst = hasSuffixHint(pl, INSTITUTION_SUFFIXES);

      if (looksPlace && policy.disallow_new_places) unknown.push(p);
      else if (looksInst && (policy.disallow_new_institutions || policy.disallow_new_factions)) unknown.push(p);
      // Otherwise likely a person name; allow.
    }

    if (unknown.length) {
      errors.push(`Introduced non-canonical place/institution name(s): ${unknown.join('; ')}`);
    }

    // Single-word "big nouns" drift guard (optional): only enforce if they are in the registry.
    // We do not block new NPC first names.
  } else {
    warnings.push('Entity registry missing or empty; proper-noun drift guard is limited.');
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    details: {
      sources,
      narration_len: narration.length
    }
  };
}

export function buildRepairInstruction(validation) {
  const errs = Array.isArray(validation?.errors) ? validation.errors : [];
  const warns = Array.isArray(validation?.warnings) ? validation.warnings : [];

  const lines = [];
  lines.push('VALIDATION FAILED. You must regenerate the JSON output and fix the following issues:');
  for (const e of errs) lines.push(`- ${String(e)}`);
  if (warns.length) {
    lines.push('WARNINGS (not fatal, but avoid if possible):');
    for (const w of warns) lines.push(`- ${String(w)}`);
  }

  lines.push('REPAIR RULES (HARD):');
  lines.push('- Output ONLY a single valid JSON object. No markdown. No extra text.');
  lines.push('- Never refuse or output policy talk. If you cannot ground a proper noun, describe it generically and/or mark it UNKNOWN/RUMOR/THEORY.');
  lines.push('- Do NOT invent new places, factions, or institutions. Use canon names or describe generically ("an unnamed hamlet", "a nameless ravine").');
  lines.push('- If you include a new nickname, frame it explicitly as rumor ("locals call it...").');
  lines.push('- sources[] must list only canon chunk IDs retrieved this turn, and must include the pinned chunk(s).');
  return lines.join('\n');
}

