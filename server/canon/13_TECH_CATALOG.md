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

# 13_TECH_CATALOG.md — CORE TECH & RELICS (STARTER PACK)

Status: **AUTHORITATIVE — CATALOG**
Introduces mechanics: **YES (Item Tags + Explicit Effects)**
Purpose: Provide a concrete starter catalog so the Operator does not hallucinate gear/relic logic.

---

## Tag Key (Operator Logic)

- **[Consumable]**: Destroyed on use.
- **[Volatile]**: On a bad mishap, harms the user or nearby environment (details are item-specific).
- **[Crisis]**: Behavior shifts under high Crisis (explicitly described on the item).

---

## Universal Item Discipline (Binding)

1) **No permanent dice changes.** Items never change dice size.
2) **No stacking flat bonuses.** If multiple items could apply, only the single strongest applies.
3) **Narrow leverage only.** If an item shifts odds, it does so in a tight context (one action type) and is always paired with a cost, risk, or limitation.
4) **Facts over vibes.** Inventory entries should be factual tokens (`inv:Item=Qty`, `tag:...`), not prose.

**Margin Shift Notation (when used):** `MS:+1` means “treat the final Margin as +1” in the specific context named. MS never stacks with any other MS.

---

## Standard Gear (Tech)

1. **Sun-Spark Lantern** — [Light 30ft] [Fuel: Oil]  
   Reveals residue smears and fine particulate ash that normal light hides.

2. **Iron-Ration Brick** — [Consumable] [3 Uses]  
   Removes `cond:Hungry` for one day per use. Tastes like regret.

3. **Climbing Pitons** — [Gear]  
   Grants permission to attempt climbs that would otherwise be “no.” If a climb would result in a fall, you may convert it to a hang + `cond:Strained` **once per scene**.

4. **Filter-Mask** — [Gear]  
   Negates inhaled toxins/spores (does not protect against skin contact).

5. **Signal Flare** — [Consumable]  
   Visible for miles. Also visible to things you’d rather not meet.

6. **Healer’s Kit** — [Gear] [5 Uses]  
   Stabilize a dying ally without a roll. Does not restore lost vitality.

7. **Crowbar** — [Gear]  
   **MS:+1** on a single “force-open / pry” action. Loud.

8. **Oil Flask** — [Consumable] [Volatile]  
   Creates a burning surface (GM adjudicates as a hazard zone). Mishap: splash-back.

9. **Whetstone** — [Consumable] [1 Use]  
   The next weapon strike that hits gains **MS:+1**. Cannot be stacked with other MS.

10. **Bedroll** — [Gear]  
   Prevents `cond:Exhausted` from “sleeping rough” in normal weather (does not override extreme cold, injury, or fear conditions).

---

## Relics (Tier I & II)

Relics always include an explicit **Cost**. Any numeric leverage is expressed as **MS** and never stacks.

11. **Whispering Compass (Tier I)**  
   Effect: Points to the nearest *fresh* water source within a day’s travel.  
   Cost: You hear faint sobbing whenever you follow it.

12. **Ember-Ring (Tier I)**  
   Effect: **MS:+1** when resisting cold exposure.  
   Cost: Requires double water rations while worn.

13. **Glass-Key (Tier I)** — [Consumable]  
   Effect: Opens any mundane lock **once**, then shatters.  
   Cost: The shatter is loud enough to carry.

14. **Silent-Step Boots (Tier II)**  
   Effect: **MS:+1** on stealthy movement actions.  
   Cost: You cannot speak while wearing them.

15. **Lens of Truth (Tier II)**  
   Effect: Reveals invisible entities and glamours while active.  
   Cost: Gain `stress:+1/round` while maintained.

16. **Blood-Iron Shield (Tier II)**  
   Effect: Once per round, reduce the attacker’s successful hit Margin by **2** (to a minimum of 0).  
   Cost: You cannot be healed by magic while holding it.

17. **Gravity-Hammer (Tier II)**  
   Effect: On a hit, you may force a knockdown outcome (GM expresses as displacement/prone) **once per round**.  
   Cost: Unwieldy—requires exceptional Strength or you gain `cond:Strained` after each attack.

18. **Aether-Jar (Tier II)** — [Volatile]  
   Effect: Captures one spell aimed at you (negates it) if activated in time.  
   Cost: Must be “emptied” (an action) within 1 minute or it cracks and releases residue.

19. **Memory-Quill (Tier I)**  
   Effect: Writes down what you speak perfectly (useful for oaths, names, coordinates).  
   Cost: Ink is your blood (1 vitality/harm/HP as used by the current engine).

20. **Rot-Bane Amulet (Tier II)**  
   Effect: Immunity to disease and ordinary rot-spores.  
   Cost: Food tastes like ash; long meals become difficult.

---
End of File.
