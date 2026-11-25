# Checkpoint 409 / v643 — Optional turn-scoped Fleet controller budgets

## Observation

The controller counted `declare-fleet-attack` and `declare-fleet-move` against the entire campaign action journal. The checkpoint 408 operational harness set `maxFleetMoves:2` and `maxFleetAttacks:3`, therefore these were total-campaign controller limits, not source-rule allowances or per-turn allocations. This limited multi-turn naval controller activity even when the authoritative action catalog could offer further legal options.

## Implementation

`core/historical_campaign_autoplay.js` adds validated `fleetBudgetScope: 'campaign' | 'turn'`, defaulting to `'campaign'`. In `turn` mode the declaration count resets after the latest committed `finish-housekeeping`, the authoritative end-of-turn marker. No phase IDs, source rules, counter identities, CRT calculations, maps, or Fleet movement adjudication change. Every candidate still goes through source-bound discovery and transaction validation. Counts cover declaration actions only, not the associated dice rolls. The normal per-turn `fleetUsed` restriction remains enforced separately. The option is opt-in so existing policies and deterministic runs retain the historical controller behavior.

`fleetDeclarationCount` is exported for direct regression testing and shared verbatim by the 62-module browser engine bundle. This exposes a testable boundary; it is not a separate engine.

## Actual verification

- `node tests/historical-fleet-budget-scope-v643.test.js`: passed 15 assertions: policy default, explicit opt-in, invalid policy rejection, counts across a simulated housekeeping turn boundary, nested combat actions, distinction between naval declaration and roll, and empty journal.
- `python scripts/build-historical-browser-bundle.py` followed by `--check`: passed, 62 modules.
- `node tests/kiev-operational-phase-v639.test.js`: passed, operational phase assertions (29, 44, 49 reported in sequence).
- `node tests/historical-operational-qualification-v642.test.js kiev-odessa standard 7 30`: passed the 30-action bounded condition and exact terminal-state restore, ~9.9 seconds, using the unchanged default campaign-wide budget.
- The broader combined regression command hit the execution time limit while running an inherited multi-scenario test; do not claim it passed.

## Qualification limits and next steps

The optional per-turn controller policy is **not** qualified across a complete multi-turn Fleet campaign, a current Chromium game session, both CRTs, or the B4M native engine. Source limits on Fleet actions are enforced by existing action adjudication, not inferred from this budget. A complete Kiev–Odessa operational campaign previously timed out at 180 seconds (checkpoint 408); this patch alone does not establish its completion or remove that performance blocker. Next: finish the Kiev–Odessa campaign with per-turn naval coverage, compare against campaign-wide control on matched seeds, capture Fleet declarations per turn, final journal parity, terminal victory, and runtime; then extend to other scenarios and browser user-facing play. No default-policy promotion yet.
