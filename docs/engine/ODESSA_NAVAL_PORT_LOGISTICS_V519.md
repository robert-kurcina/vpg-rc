# Checkpoint 285 / v519 — Odessa Fleet port replacement and evacuation candidate

**Scope:** source-qualified rules transactions, **not a playable Kiev–Odessa campaign**. Source is the supplied `references/rules/odessa-rules.pdf`, especially §12.2 and both §15.3 headings (*Convoying Replacements* and *Evacuating Ports*). The source PDF SHA-256 is pinned by `maps/buildup-configs/kiev-odessa-naval-logistics-candidate-v519.json`.

## Implemented

1. The optional source-backed `navalReplacementPolicy` binds the ordinary `historical_buildup_phase.replace()` operation to the same shared `historical_naval_logistics` module as transport. A **reduced Soviet on-map ground unit** at the **same Soviet-controlled port as the active Black Sea Fleet** may restore one replacement step without a land communication path to the east edge. The ordinary photographed face pairing, source owner, replacement turn allowance, one-step expenditure, and no-double-rebuild checks still apply. Without the opt-in, the existing buildup rule is unchanged.
2. The diagnostic naval transport transaction takes one Soviet ground unit from the same controlled port as the Fleet, validates another controlled receiving port or off-map evacuation, and requires an explicit d6 result. On **1**, a full-strength multi-step source counter is reduced; a reduced or one-step unit is eliminated. Rolls **2–6** cause no damage. The Fleet itself does not move or suffer damage from the transported unit's check.
3. Port-to-port transport requires a separately supplied **source-qualified receiving-port stacking check**. It refuses unverified stacking, enemy port control and forged source faces.
4. Surviving off-map evacuees are recorded with their **source counter face/state** and `firstReturnTurn = evacuatedTurn + 1`. The eligibility query rejects same-turn return and permits any subsequent turn up to the configured seven-turn game ending. It does **not** bypass the ordinary Soviet reinforcement admission rules.
5. The two approved source ports are Odessa (`1513`) and Nikolaev (`1811`), bound to the photographed Black Sea Fleet front and DAMAGED reverse via the existing `historical_port_support` module.

## Source caveats and scope limitations

- §15.3 **does not state a distinct phase for evacuating a ground unit**. The candidate transport transaction therefore makes no historical phase-authority claim; the complete Kiev–Odessa legal-action catalogue must resolve this before offering the action in the live browser.
- **Off-map return admission is not implemented.** The module reports eligibility only; returning a unit must run through the historical Soviet reinforcement pipeline, including authorized entry, EZOC, stacking, face identity and any relevant geographic restrictions.
- The complete Odessa source-bound buildup roster, entry boundaries, city-control progression, and legal combined-board movement graph are not yet approved. No historical campaign, save/restore re-entry transaction, or Player vs AI capability is claimed for this candidate.
- This work does not change the Oberlabs-compatible CRT, five approved engine map exports, regional outlines, TEC, or Support Window.

## Tests

`node tests/odessa-naval-logistics-v519.test.js --write-audit`: 162 candidate assertions including source hashes, Fleet control, both approved ports, 6 die faces, unit reduction/elimination, earliest return, source-face checks, atomicity, and fail-closed stacking. The existing shared historical buildup campaign regression and prior Odessa Fleet/air/annexation regressions pass independently. The common browser bundle is rebuilt from unchanged shared source modules plus the new opt-in helper.

## Next priority

Bind actual Kiev–Odessa initial and reinforcement counter allocations to the full combined map, resolve the evacuation timing from authoritative play guidance or an explicit user adjudication, and commit **naval transport, evacuation, and subsequent reinforcement admission** as journaled game actions with Undo/save/restore acceptance.
