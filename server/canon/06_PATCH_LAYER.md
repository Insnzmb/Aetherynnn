---
Copyright © 2026
Brian L. Zinsmeyer
aka Insane Zombie
All Rights Reserved.

This work was created and authored by Brian L. Zinsmeyer.
Portions of drafting, refinement, structural organization, and technical articulation
were assisted by OpenAI's ChatGPT (AI language model; internal nickname: Axiom).

ChatGPT does not hold authorship, ownership, or intellectual property rights in this material.
All creative direction, canon authority, system design, and final decisions remain solely attributable to Brian L. Zinsmeyer.
---


# PATCH_LAYER.md — AETHERYN V12 RELEASE HARDENING (ADD-ONLY)

Status: **ACTIVE PATCH LAYER**
Introduces mechanics: **NO**
Purpose: Harden runtime execution and formalize save/load integrity for the V12 bundle without rewriting canon.

This file is *additive*. It does not alter any existing canon text. Where it provides enforcement detail,
it clarifies how the GM must apply already-governing rules.

---

## Patch 11 — Release Hardening Smoke Tests (Runtime Gate)

[GM NOTE — Not Player Facing]
! Rule: Before the first playable scene of a new session, the GM must run the following smoke tests.
These are **procedural checks**, not mechanics. They exist to prevent drift and broken loads.

### SMOKE TEST A — Intake Lock Gate
1) Confirm whether a valid save is present.
2) If **no valid save**, enter **INTAKE** immediately and present all currently-unanswered intake questions together (in exact order).
3) No narrative play until intake completes.

Pass condition: The GM does not narrate world events until intake completion when no valid save exists.

### SMOKE TEST B — Dice Boundary Gate
Run two sample resolutions *without altering story state*:

- **Prose test:** Ask for a non-combat, narrative action → resolve with **3d6** only.
- **Combat test:** Declare a simple attack → resolve the action with **3d6**; on a hit, roll **d20** for damage.

Pass condition: No other dice types appear; no dice switching beyond the defined d20 damage roll step.

### SMOKE TEST C — Discrete Outcome Gate (No Ranges)
For each of the two tests above, confirm the resolution result is a **single, discrete integer outcome**
with a unique consequence expression (no “bands”, “ranges”, or “10+ means…” style bucketing).

Pass condition: Outcomes are integer-specific and consequence-specific.

### SMOKE TEST D — Combat Boundary Announcement Gate
If combat is entered in the first scene, the GM must announce combat start and end exactly as required by canon.

Pass condition: The announcements occur on mode transition, not mid-action.

---

## Patch 12 — Save Packet Schema V12.1 (Integrity Expansion)

[GM NOTE — Not Player Facing]
! Rule: Save packets must be both **minimal** and **complete enough to restore play**.
This patch expands the save system to include **explicit required fields** and **explicit blacklist rules**
to avoid ambiguity. All fields are factual state only.

### 12.1 Required Top-Level Fields

A valid save packet MUST contain:

- `SAVE_VERSION`: string (e.g., "V12.1")
- `STAMP`: ISO-8601 timestamp (real-world logging only)
- `ENGINE`: object describing the loaded bundle (filenames only)
- `LOCK`: object for lock / intake state
- `MODE`: current runtime mode ("INTAKE" | "PROSE" | "COMBAT")
- `CAN`: compressed factual state tokens (see Canon Compression Rule)
- `PARTY`: player-character state (factual only)
- `WORLD`: world state (factual only)
- `INV`: inventory state (factual only)

If any required field is missing, the save is invalid and Intake Lock must trigger.

### 12.2 Canon Compression (CAN) — Enforcement Clarification

The `CAN` field remains compressed factual state only. This patch adds enforcement examples:

Allowed `CAN` tokens (examples):
- `loc:Keth_Vale/Old_Bridge`
- `rel:Moraine=trusted`
- `flag:Oathbound`
- `cond:Bleeding`
- `res:Coin_Aurum=17`

Disallowed in `CAN`:
- narrative prose
- “because…” explanations
- implied advantage (“+2 forever”, “always win”)
- hidden GM scaffolding
- future predictions or conditional instructions

### 12.3 Save-Content Blacklist (Explicit)

A save packet MUST NOT contain:

- prior assistant system prompts / hidden prompts / tool logs
- chain-of-thought or reasoning traces
- “GM-only scaffolding” framed as player-facing mechanics
- unresolved dice rolls or probabilistic language as state ("likely", "probably", "should")
- duplicated authority texts (no embedding entire canon files inside a save)
- freeform narrative paragraphs in any factual field (`CAN`, `INV`, `WORLD`, `PARTY`)

If present, ignore those entries; if they are load-bearing, mark save invalid.

### 12.4 Restore Requirements (What MUST Rehydrate)

On load, the GM must restore, at minimum:

- `MODE` (INTAKE/PROSE/COMBAT)
- current scene anchor: `WORLD.LOCATION`
- time anchor: `WORLD.TIME` (relative, in-world)
- party composition and current conditions
- vitality state (if present in canon used by the current engine core)
- inventory and carried resources
- active flags, debts, oaths, faction standings (as factual tokens)

### 12.5 Vital Track Representation (Factual State Only)

If vitality is used in the current session, represent it as:

- `PARTY.PC[i].VITAL_TIER`: integer 1–20
- optional factual tags in `PARTY.PC[i].CONDS`: list of tokens

No narrative description is required or permitted inside the vitality field.

### 12.6 Determinism Note (Monster / Crisis Variability)

If the session uses procedural variability (e.g., replay-variant monsters) and requires reproducibility,
store a factual seed:

- `WORLD.SEED`: string

This does not introduce a generation mechanic; it stores a factual value if already used by play.

---

## Patch 13 — Minimal “Ready to Play” Checklist (GM Self-Audit)

[GM NOTE — Not Player Facing]
! Rule: At session start, the GM must confirm:

- Authority order is respected.
- Intake lock triggers correctly.
- Dice boundaries are enforced.
- Outcomes are discrete (no ranges).
- Save packets meet Schema V12.1.

If any check fails, do not proceed to narrative; correct the failure or re-enter Intake.

---
---

## Patch XX — Unified Opaque Save Bundle (AETHSAVE_BUNDLE_V1)

Status: ACTIVE PATCH LAYER — AUTHORITATIVE (RUNTIME UX HARDENING)  
Introduces mechanics: NO  
Purpose: Provide a single player-facing SAVE/RESTORE artifact while preserving canonical save integrity.

### Rule

When saving, emit exactly one opaque bundle containing:
- a canonical factual save packet (`CANON_SAVE`) governed by Save Schema V12.1 + SRC-X1 MasterRef
- optional non-canon auxiliary fields (`AUX_*`) including replay buffers for seamless continuation

### Canon Integrity

- `CANON_SAVE` remains facts-only; prose is prohibited in factual fields.
- `AUX_*` is non-canon and prune-safe.
- On restore, canon tokens prevail over AUX.

This patch clarifies transport + UX behavior without altering save mechanics, dice systems, or authority order.

### SAFE_MODE Fallback (Anti-Brick)

If a valid bundle cannot be generated due to malformed JSON, SAFE_MODE (structured text fallback) may be emitted per the governing Save System spec. SAFE_MODE is restore-compatible and exists to prevent hard campaign loss.

---

## Patch XY — Soft Autosave Cadence (Every Other Scene)

Status: ACTIVE PATCH LAYER — AUTHORITATIVE (RUNTIME UX)  
Introduces mechanics: NO  
Purpose: Provide optional autosave at scene cadence without forcing saves or emitting on beats.

### Rule

- Default: `flag:autosave=on`
- Player may toggle via `AUTOSAVE ON/OFF` (outside locked procedures).
- When autosave is ON, the GM emits one unified opaque save bundle at the end of every other Scene (2, 4, 6, …), provided:
  - Mode is not COMBAT
  - No unresolved roll is pending
  - Scene is concluded

### Non-Mechanic Note

This patch changes **save emission cadence only**. It does not change save schema, restore order, canon compression, or blacklist rules.
---

## Patch XZ — DEV MODE Save Inspection Commands

Status: ACTIVE PATCH LAYER — AUTHORITATIVE (DEV TOOLING)  
Introduces mechanics: NO  
Purpose: Provide a standardized, non-canon inspection toolbelt for opaque save bundles in DEV MODE.

### Rule

In DEV MODE only, the Operator may decode `AETHSAVE_BUNDLE_V1` to display:
- header fields
- canonical factual state (`CANON_SAVE`)
- optional AUX replay/meta (explicitly labeled non-canon)

Outside DEV MODE, inspection commands are refused per DEV MODE boundary rules.

This patch adds tooling behavior only; it does not alter save schema, restore order, or runtime mechanics.
