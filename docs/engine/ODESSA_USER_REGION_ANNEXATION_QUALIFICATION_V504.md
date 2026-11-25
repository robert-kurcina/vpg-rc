# Checkpoint 270 / v504 — Bessarabia annexation from exact 19-cell user region

## Source authority and scope

Source: `references/rules/odessa-rules.pdf`, §9.4.4, states that once **Bessarabia** (the light-tinted area between the Prut and Dniester rivers) contains no Soviet units, Romania annexes it and the Home Army may operate there; Soviet re-entry does not reverse this effect. §9.4.5 prohibits Hungarian entry into Romania and Bessarabia. The source **does not** say that annexation requires identification of Romania and Soviet territory across every other board hex.

The user explicitly established Bessarabia as these **19 hostCells** on 2026-11-22:

`1111 1112 1113 1114 1115 1116 1211 1212 1213 1214 1215 1312 1313 1314 1315 1316 1413 1414 1514`

The source map retains their classifications as `user-adjudicated`; the other **242** composite cells remain politically `unknown` (`sourceTerritory` absent). The game board still contains **261 hexes** and the diagnostic topology still has **714 physical neighbor links / 100 Sea-and-Coast barriers / 117 reconciled railway links**.

## Implementation

- New opt-in profile `maps/movement-configs/kiev-odessa-territory-candidate-v504.json` adds an `approvedFootprint` to the existing territory policy. The original v499 profile remains unchanged for comparison. The footprint pins the composite map ID, 261-cell count, approved 19 IDs, evidence class, and exact adjudication provenance.
- `core/composite_land_movement_candidate.js` now forwards only the explicitly present `sourceTerritory`, `territoryEvidence` and `territorySource` fields from the authoritative composed map to the **read-only diagnostic board**; it does not fabricate any other political data or grant production movement authorization.
- `core/movement_rules.js` adds optional footprint validation. For an opted-in profile, annexation depends on verified matching **all 19** exact Bessarabian cells and the absence of Soviet units within those cells. It need not assume a classification for the remaining cells. There is still a legacy full-country-evidence path for existing synthetic profile tests.
- The same footprint guard is required before Home Army or Hungarian within-Bessarabia access adjudication. Unreviewed origins/destinations remain `territory-unverified`. An extra or missing Bessarabia classification, changed source provenance, wrong board identity/count, or unsafe map evidence rejects the qualification.
- Existing immutable `core/territorial_state_transition.js` carries a single permanent annexation flag/event. Undo and replay are verified as **diagnostic candidate semantics**, not a live Odessa game session.

## Acceptance and limitations

`node tests/odessa-bessarabia-annexation-footprint-v504.test.js`: 157 assertions on the actual 261-hex read-only composite, including each hostCell, entry and retreat boundaries, tampering, last-Soviet-departure, permanent re-entry, idempotence and deterministic state replay.

Existing Odessa territorial (v499), lifecycle (v500), cavalry (v498), source land graph (v497), and water-layer presentation (v503) tests pass. The shared browser bundle was rebuilt from the same source. No SVG, map export, color, dashed hex outline, river/coast layer order, CRT, or original PDF changed.

**NOT a live Odessa campaign:** Source-bound initial counter identities, accurate Romania/outside country mask, Fleet/port resolution, reinforcements, victory/isolation, and actual game Undo/save/restore still remain outstanding. The composite production graph remains deliberately unregistered. The original Romanian setup markers (four orange hexes) are not a complete Romania country mask.

Next: qualify Romania/outside territory boundary from the supplied source map, add the full Odessa source setup and port rules, and only then authorize a real historical campaign graph/browser session.
