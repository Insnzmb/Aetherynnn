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


# AUTOMATIC DRIFT DETECTION (Correctness-Only)

## Goal
Detect when the AI’s current draft output diverges from established canon, file authority order, or previously confirmed decisions.

**Important:** This logic must NOT trigger or force any save-file behavior. It is purely a correctness check.

---
## What “drift” means here
Drift is any of the following:
1. **Contradiction drift:** output conflicts with a higher-authority file.
2. **Duplication drift:** output redefines an existing rule as if new.
3. **Authority drift:** a lower file or patch overrides a higher file without permission.
4. **Mode drift:** narrative proceeds while Intake Mode should be active.
5. **Resolution drift:** dice system boundaries are crossed mid-resolution.
6. **Inventory drift:** inventory/resources change without a recorded, in-world cause.

---
## When to run drift detection
Run after drafting (after Double Verification Pass 2), but before sending output.

---
## Drift Detection Procedure (Deterministic)
### Step A — Declare dependency set
List (internally) which sections/files the draft relies on (max 3–7 anchors).

### Step B — Canon consistency check
For each anchor:
- Confirm the draft does not conflict with the anchor’s explicit rules.
- If conflict exists: mark as DRIFT and stop.

### Step C — Duplicate rule scan (lightweight)
Ask: “Am I introducing a new rule that already exists?”
- If yes: DRIFT → rewrite as a reference to the existing rule or write a patch note that *clarifies* (not redefines).

### Step D — Mode + authority check
- If Intake Mode is active, narrative must not proceed.
- If authority is unclear, escalate instead of inventing.

### Step E — Output gate
If any DRIFT is detected:
- Do NOT proceed with the drafted output.
- Regenerate output that matches canon.

**No saves. No autosaves. No save prompts.**

---
## Minimal “silent” behavior
Unless the user requested diagnostics, the AI should silently correct drift and present only the corrected output.

---

---

## Drift Detection Extension — Living World Integrity (ADDENDUM — 2026-02-13)

This addendum extends drift detection definitions without adding mechanics.

### Additional drift categories

7. **Retcon drift:** prior FACT is edited or silently overwritten instead of appended via a new event (revelation or record tampering).
8. **Spotlight drift:** world events are unnaturally bent to preserve player relevance (plot armor, forced hooks, “villain waits” behavior).
9. **Ledger drift:** PERCEPTION is treated as FACT (or FACT is treated as merely “rumor”), causing continuity corruption.

### Correction rule (discipline)

- Fix continuity by **adding** a new FACT (revelation / forgery) and updating PERCEPTION.
- Do not “repair” by editing or reinterpreting old FACT.

---
---

## Drift Detection Extension — Save-State Desynchronization (ADDENDUM — 2026-02-13)

This addendum extends drift detection definitions without adding mechanics.

### Additional drift category

10. **Save-State Desync drift:** AUX replay (or resume prose) contradicts restored canonical factual state.

### Correction rule (discipline)

- Canon state prevails.
- Discard AUX replay if it contradicts canon tokens.
- Resume using canonical state with a minimal re-entry prompt (no recap unless requested).


---

## Drift Detection Extension — Worldbuilding Drift (ADDENDUM — 2026-02-25)

This addendum extends drift detection without adding mechanics.

### Additional drift categories

11. Geography drift: a place-name, river, range, capital, or region label changes without an explicit in-world event.
12. Institution drift: an institution’s mandate, behavior, uniforms, or legal reflexes change between scenes without cause.
13. Cultural drift: a region’s speech, taboos, trade goods, or day-to-day habits “average out” into generic fantasy.
14. Chronology drift: dates or era labels contradict the active baseline (Neutral Year +312) without explicitly invoking archival dispute.

### Correction rule (discipline)

- If the conflict is accidental, correct silently and continue.
- If the conflict is story-relevant (forged records, Quiet Erasure, disputed archives), explicitly mark the statement as PERCEPTION or ARCHIVAL and preserve the active baseline as FACT.

---
