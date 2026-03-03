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


# ADD --- Narrative Exclusion Clause

Status: AUTHORITATIVE --- SAVE INTEGRITY\
Introduces mechanics: NO

------------------------------------------------------------------------

Narrative prose must never enter:

-   CAN
-   INV
-   WORLD
-   PARTY
-   FLAGS
-   RELATIONS

Save packets store factual state only.

Epic narration exists only in runtime output. Never in storage.
---

# ADD — SINGLE-FILE SAVE (PLAYER UX)

Status: AUTHORITATIVE — PLAYER WORKFLOW  
Introduces mechanics: NO  
Purpose: Players should never juggle multiple files/blocks.

## How to Save

Type:

SAVE NOW

The GM will ask whether you want a **book-formatted narrative export** (YES/NO).

- If you answer **YES**, the GM will provide a downloadable chapter-style text export **first** (non-canon), then output your **one** opaque save bundle.
- If you answer **NO**, the GM will output your **one** opaque save bundle immediately.

The save bundle is always the **final** output of the SAVE NOW procedure.

Optional (any time outside locked procedures): you may also use:

EXPORT BOOK

to request a fresh book-formatted export without saving.


## How to Resume

Paste the bundle exactly and type:

RESTORE

Do not edit the bundle. Do not split it. One paste only.

## What’s inside (simple explanation)

- Your *real* save (facts-only) is inside the bundle.
- The last prose + last choices are stored as an AUX replay buffer for seamless continuation.
- AUX is not canon and can be discarded if corrupted; the factual save remains authoritative.
---

# ADD — AUTOSAVE (OPTIONAL)

AUTOSAVE is **ON by default**.

- To disable autosave:
  - `AUTOSAVE OFF`
- To re-enable:
  - `AUTOSAVE ON`

When AUTOSAVE is ON, the GM will automatically provide a save bundle at the end of **every other Scene** (Scenes 2, 4, 6, …).

You can still request a save at any time with:

SAVE NOW

---

# ADD — ANTI-BRICK SAFE_MODE SAVE (LAST RESORT)

Status: AUTHORITATIVE — SAVE INTEGRITY
Introduces mechanics: NO
Purpose: Prevent JSON bricking from killing campaigns.

## When SAFE_MODE is used

If the GM cannot generate a valid `AETHSAVE_BUNDLE_V1` because the internal JSON payload fails validation after **one** attempt, the GM must output a SAFE_MODE save block instead.

SAFE_MODE is rare, but it is always preferable to losing the campaign.

## SAFE_MODE Format (Verbatim)

BEGIN_SAFE_MODE_SAVE
VERSION: V12.2
TIME: [ISO Timestamp]
MODE: [INTAKE/PROSE/COMBAT]
LOCATION: [Region/Site]
---
CANON_FACTS:
- flag: [Token]
- inv: [Item=Qty]
- party: [Name/HP/Status]
---
END_SAFE_MODE_SAVE

## How to Restore from SAFE_MODE

Paste the SAFE_MODE block into a new chat and type:

RESTORE

The GM will rebuild the missing required fields via Intake only where needed, then resume play.
