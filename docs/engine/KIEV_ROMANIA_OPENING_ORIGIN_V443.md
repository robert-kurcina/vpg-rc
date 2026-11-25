# Checkpoint 209 / v443 — Kiev first-turn territorial combat provenance

## Source and governing rule

The supplied `references/rules/kiev-rules.pdf`, printed page 5, §10.8, distinguishes **Soviet units originally deployed at 0708, 0808, or 1110** from other Soviet units which may move to that border on Turn 1. Only the former may attack Axis units **in Romania** during the first game turn. The preexisting v442 Axis Turn-1 restrictions and §10.9 Mechanized-Corps multipliers are preserved.

The source PDF is pinned by the SHA-256 in `maps/combat-configs/kiev-turn-rules-v443.json`. The game map does not yet contain a certified complete country-territory mask. Romania cannot safely be equated with its four initial Axis setup crosses, because those do not establish all potential target cells after movement.

## What changed

1. `core/scenario_starting_setup.js` adds a persistent `openingHex` to every **source-validated starting ground unit**. It equals the actual physical source marker hex; gameplay movement continues changing only `hex`, and cloned opening snapshots retain the initial field. Reinforcement units are not assigned an invented opening position.
2. `core/historical_combat_declarations.js` adds optional `combatPolicy.firstTurnTerritorialRestriction`. The configured side/turn/target-hex mask must have unique source-board cells and carry `targetRegionEvidence` with `coverage: complete` and a nonempty provenance. During that first-turn combat phase, every participant attacking a specified territory target must have an `openingHex` in the configured eligible-origin set. An attacker with missing or ineligible opening lineage is rejected. No first-turn or territory rule is automatically enabled for other scenarios.
3. The source-reviewed origin trio is captured in the new `maps/combat-configs/kiev-turn-rules-v443.json` as **`firstTurnTerritorialOriginCandidate` only**, not an executable territory restriction. The v442 historical rules fragment is left byte-identical.
4. Browser module rebuilt from the same shared source; no separate Kiev logic or alternate renderer.

## Validation

- `tests/kiev-romania-origin-v443.test.js`: **100 assertions**. All 30 legal sample starting units have source-correct initial positions; saved opening snapshots are detached; one-step movement preserves the initial field; synthetic territory declaration accepts the initially eligible source unit even after moving, blocks an ineligible origin and missing lineage, and ceases restricting after Turn 1. The existing Leningrad photographed-counter phase controller exercises the full declaration path under a *temporary synthetic policy*. Invalid, duplicate, missing and partial territory definitions are rejected.
- Kiev original opening, preflight, geography candidate and v442 early-combat regressions pass. Shared movement and historical combat regressions pass.
- **No Kiev production activation:** `G.build(kiev)` still rejects the noncertified geography for gameplay. There is no new Roman territory classification in any map file.
- `rules/audit/kiev-romania-origin-v443.json` records source pins, protected files, scope and limitations.

## Explicit remaining blocker

Recover and independently certify the complete set of Romanian territory hexes from the authoritative original map/rulebook, including land that is not an initial Axis deployment marker. Only after the source-reviewed territory mask is complete should the `firstTurnTerritorialRestriction` field be enabled in the eventual Kiev combat profile and full seven-turn integration tests run. Kiev–Odessa remains independently gated for its expansion seam and rules.
