# Checkpoint 287 / v521 — Objective: Odessa twenty-city victory qualification

## Original source

`references/rules/odessa-rules.pdf` §5.0 defines 20 city hexes on the combined board and seven turns. The original initial Axis cities are Lublin, Iasi, and Braila (active map spelling: **Brăila**, hostCell `1016`); the other 17 start Soviet-controlled. The extension supersedes conflicting base-game rules (§0.0).

## Exact Turn-7 results

| Axis cities | Remaining Soviet cities | Communication to red eastern edge | Result |
|---|---|---|---|
| 20 | 0 | Not needed | German victory |
| 19 | 1 | Last Soviet city isolated | German victory |
| 19 | 1 | Last Soviet city not isolated | Draw |
| 18 | 2 | Neither Soviet city isolated | Soviet victory |
| 18 | 2 | Either or both Soviet cities isolated | Draw |
| 17 or fewer | 3 or more | Not needed | Soviet victory |

The source specifies no intermediate-turn victory adjudication: the result is evaluated at the end of Game Turn 7.

## Implementation

- Added a generic `two-tier-city-isolation-v1` mode to `core/historical_housekeeping_phase.js`. Existing Leningrad conditional-draw and Arduous/Kiev simple-count modes are unchanged.
- Added `maps/housekeeping-configs/kiev-odessa-candidate-v521.json`, with the exact 20 source-reviewed city names and `hostCell` assignments from `maps/victory-configs/odessa-source-city-ledger-v497.json`.
- Preserved the three starting Axis cities from §5.0; the map and source hashes are checked by regression.
- The evaluator checks both remaining Soviet cities separately at the 18-Axis threshold and rejects missing, non-boolean, or unauthorized isolation results. Merely counting empty Soviet cities or assuming unoccupied routes communicate is not allowed.
- `close` returns a terminal verdict only from the final system housekeeping phase. It leaves early turns nonterminal.
- The shared browser bundle was rebuilt to keep it aligned with the source module.

## Qualification evidence

`tests/odessa-victory-isolation-v521.test.js` exercises all 20 possibilities for a single surviving Soviet city and all 190 pairs with four isolation combinations per pair. It also tests the end-of-turn gate, corrupted source city mappings, invalid policies, source pin checks, and absence of a certified communication graph.

**Important scope limitation:** The test supplies an explicit controlled communication predicate for each city. This qualifies §5.0 outcome logic, not historical route isolation. The 261-cell Kiev–Odessa movement connectivity and its eastern red-border communications have not been authorized for full gameplay. The new policy remains a candidate, and Kiev–Odessa is not playable.

## Remaining P0

1. Certify the combined 261-cell graph and Romania/outside country classifications while preserving the 19 user-approved Bessarabian cells.
2. Bind original initial deployments and scheduled reinforcements to the combined counter inventory and seven-turn phases.
3. Establish actual eastern-edge communication tests for Soviet-controlled cities; then activate this victory profile in an end-to-end campaign.
4. Reconcile timing authority for §15.3 naval evacuation and verify port ownership, combat, Fleet, reinforcements, Undo and restoration across a full human-browser seven-turn game.
