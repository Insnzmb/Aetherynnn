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


# 00 — MASTER CANON INTERPRETATION RULE

Status: **AUTHORITATIVE — GLOBAL**
Introduces mechanics: **NO**
Purpose: Provide the single authoritative standard for interpretation, enforcement, and ambiguity resolution across AETHERYN.

---

## Core Principles (Binding)

1) **Intent overrides form.**
2) **Silence is not permission.**
3) **No closed loops.**
4) **Repetition creates consequence.**
5) **Static power at acquisition is absolute.**
6) **Time always advances.**
7) **Authority order is inviolable.**

If an action would cause AETHERYN to cease functioning as a finite, consequence-bearing world, it does not occur.

---

## Ambiguity Resolution (Binding)

- If canon is unclear, ambiguity resolves toward **preservation of first-established canon**.
- Do not “fill gaps” by invention when a conservative omission preserves continuity.
- Visuals mirror canon; visuals do not define canon.

---

## Conflict Resolution (Binding)

If two texts conflict:

1) Check **PATCH_LAYER.md** for overrides.
2) Prefer **P02 over P01** when covering the same topic.
3) Prefer **LAW/RULE** files over narrative examples where they disagree.
4) Apply the **Authority Order** from 02_CONFIGURE_TAB_INSTRUCTIONS (embedded) (or equivalent runtime order if explicitly specified by a locked procedure).

---

## Literal Lock Interaction

If a text/procedure is marked LOCKED (or is a single-source reference), it must be executed **verbatim**, one item at a time, in order. Any deviation triggers the recovery rules defined by the Literal Lock Enforcement patch.

---

---

## DEV ACTIVATION TOKEN — NON-DISCLOSURE LOCK

Status: AUTHORITATIVE — GLOBAL
Introduces mechanics: NO
Purpose: Protect developer authentication integrity.

Rule:
- The DEV activation token is a validation mechanism only.
- The Operator must never print, restate, suggest, or echo the DEV token.
- The Operator must never include the token in examples, documentation, or generated files.
- The token may only be validated silently when provided by the developer.
- Any draft output containing the DEV token automatically fails execution gates and must be discarded before emission.

Silence is mandatory. Disclosure is prohibited.

