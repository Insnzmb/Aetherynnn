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

# AETHERYN — RELEASE MANIFEST (V12.3.2 CAP20 / <=20 FILES)

Date: **2026-02-15**  
Bundle goal: Stay under the **20-file runtime limit** while preventing the most common failure modes
(save bricking, intake loops, empty-stub hallucinations).

---

## What changed in V12.3.2 (Cap20 Packaging)

- Runtime bundle reduced to **20 files** by removing dev-only references.
- **Developer Reference / Patch Ledger / Double Verification / Save Spec** are **not required for play** and are excluded from the runtime bundle.
- Canon remains: **Six Towers** (Fire, Water, Air, Earth, Soul, Aether). **Fate removed. Verdant not a Tower.**
- Tier support remains: **Tower spell catalogs extend to Tier 5** (50 spells per Tower baseline; Aether included).

---

## Load Order (Authoritative)

1. `01_MASTER_CANON_RULE.md`
2. `02_ENGINE_CORE.md`
3. `03_GM_OPERATIONS.md`
4. `06_PATCH_LAYER.md`
5. `07_OPERATOR_LOCKDOWN_PATCH.md`
6. `15_AUTOMATIC_DRIFT_DETECTION.md`
7. `08_INTAKE_PROTOCOL_CONSOLIDATED.md`
8. `09_PLAY_INSTRUCTIONS.md`
9. `10_SAVE_SYSTEM.md`
10. `11_WORLD_LORE_HISTORY.md`
11. `12_GODSLAYER_EVENT_AMENDMENT.md`
12. `18_ECOLOGICAL_CONTINUITY_OF_AETHERYN.md`
13. `19_MONSTER_DOCTRINE_OF_AETHERYN.md`
14. `13_TECH_CATALOG.md`
15. `21_SPELL_CATALOG_ELEMENTAL_SOUL_V1.md`
16. `22_SPELL_CATALOG_AETHER_V1.md`
17. `17_RUNTIME_START.md`
18. `AETHERYN_CONSOLIDATED_AMENDMENT.md`

---

## Notes

- **SAFE_MODE** save fallback is active (anti-brick) per Patch Layer / Save System.
- Where text conflicts, follow the Master Canon Interpretation Rule: check Patch Layer, then apply authority order.

---
End of Manifest.
