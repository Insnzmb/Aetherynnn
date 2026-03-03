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


# ADD --- NARRATIVE--STATE BINDING CLAUSE (AUTHORITATIVE)

Status: AUTHORITATIVE --- GLOBAL\
Introduces mechanics: NO\
Purpose: Bind epic narration to discrete mechanical resolution.

------------------------------------------------------------------------

## Rule --- Narrative-State Alignment

All narrative description must map directly to resolved mechanical
outcome.

Atmosphere may expand.\
Metaphor may decorate.\
Interior monologue may deepen.

But narration may not:

-   Imply mechanical shifts not recorded in canon.
-   Suggest hidden modifiers.
-   Introduce additional cost or leverage beyond discrete margin.
-   Blur failure or success into tonal "bands."

------------------------------------------------------------------------

## Intensity Reflection Requirement


## Margin-First Output (Presentation Lock)

When resolving any action in PLAY output, the Operator must prefix the result with the exact signed Margin before narrating.

Format:
> **[Margin: +2]** ...
> **[Margin: -1]** ...

This is presentation discipline only; it does not alter resolution math.

For any resolved check:

Margin = Roll Total − Target

Narrative intensity must reflect the exact integer Margin.

-   Margin \< 0 → Setback intensity equals \|Margin\|
-   Margin = 0 → Knife-edge equilibrium; cost-only or stalemate
-   Margin \> 0 → Leverage intensity equals Margin

No two integer margins may share identical narrative consequence weight.

Epic tone is permitted.\
Ambiguity is not.

Weather may vary.\
Gravity must remain constant.
---

# ADD — UNIFIED OPAQUE SAVE BUNDLE (TRANSPORT WRAPPER)

Status: AUTHORITATIVE — GLOBAL  
Introduces mechanics: NO  
Purpose: Reduce player friction by emitting a single opaque artifact for SAVE/RESTORE while preserving factual canon discipline.

## Rule — Single Artifact Save

When a player requests a save, the Operator must output exactly one artifact:

- `BEGIN_AETHSAVE_BUNDLE_V1` … `END_AETHSAVE_BUNDLE_V1`

Exception (anti-brick): If the bundle payload cannot validate as JSON after one attempt, emit `BEGIN_SAFE_MODE_SAVE` … `END_SAFE_MODE_SAVE` instead.

The bundle is an **opaque transport wrapper** that contains:
- a canonical **factual save packet** (no prose; schema governed by PATCH_LAYER Save Schema V12.1 + SRC-X1 MasterRef), and
- an **AUX replay buffer** (non-canon) used only to resume seamlessly.

## Canon Discipline

- The canonical save packet inside the bundle remains **facts only**.
- Replay content is AUX-only and is **never treated as canon**.
- On load, AUX replay may be discarded if validation fails; canon restore proceeds from the factual packet.
