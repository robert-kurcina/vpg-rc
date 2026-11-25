# Checkpoint 231 / v465 — Fleet no-retreat post-roll completeness

## Source and scope

- Source: `references/rules/leningrad-rules.pdf`, printed p. 6, §13.2 (also referenced by §10.6).
- Source SHA-256: `74d332e052e735e2378027a06f95e9715392773f249561bf1c00cae08a2bbfa7`.
- Published rule: Soviet ground defenders in a port city with the Baltic Fleet can **ignore the retreat portion** of DR, DRL, and EX; a damaged Fleet retains this privilege (but no longer gives the odds-column shift).
- This checkpoint changes the **shared read-only post-roll proposal catalogue**, not the authoritative combat engine or CRT.

## Defect and correction

The shared consequence resolver already accepted `ignoreRetreat:true` with mandatory DRL or EX casualties, as previously tested by `historical-port-fleet-retreat-v382.test.js`. But the proposal generator (`core/historical_campaign_action_catalog.js`) created a bare `{ignoreRetreat:true}` separately from the mandatory-casualty search. A bare choice works for ordinary DR and the single-defender DRL shortcut, but not for EX with compulsory attacker losses or a two-defender DRL requiring a selected casualty. Thus a valid result could be missing from the player-facing catalogue even though direct combat resolution would accept it.

For each source-certified casualty branch, the generator now proposes `{...loss, ignoreRetreat:true}` **when a Soviet defender survives and the source-authenticated Fleet marker at the defended port permits it**. This occurs before the more expensive retreat-route enumeration, so an eligible choice is not obscured by the existing candidate validation budget. Each proposal is still individually checked by the *same authoritative campaign transaction*; the result is never fabricated.

## Regression evidence

- `node tests/historical-fleet-ignore-retreat-catalog-v465.test.js`: **121 assertions** with certified Riga `0707`, photographed Leningrad counter faces and test-only battle placements.
- DR, DRL, EX, damaged-Fleet EX, and two-defender stacked-Corps DRL: verified source outcomes, mandatory-loss choices, original surviving defender at Riga, die immutability, human menu visibility, save/restore, Undo, and source transaction agreement.
- One-step defender eliminated by its mandatory loss cannot claim exemption; absent Fleet cannot authorize it.
- Before this change, the isolated single-Army Riga EX had **0** `ignoreRetreat:true` options in the catalogue while direct resolution accepted the action. After the fix, it has **2 source-validated** EX no-retreat choices on the first page. Two stacked Corps now have both DRL defender-loss choices offered.
- `node tests/historical-postroll-cursor-v464.test.js`: **24 assertions**.
- `node tests/historical-port-fleet-retreat-v382.test.js`: **54 assertions**.
- `node tests/historical-human-decision-gateway-v401.test.js`: **37 assertions**.
- `node tests/historical-postcasualty-retreat-v393.test.js`: **155 assertions**.
- `node tests/kiev-first-turn-combat-v442.test.js`: **45 assertions**.
- `node tests/city-dots-only-v457.test.js`: **5,376 assertions**.
- `python3 tests/arduous-postroll-paging-browser-v461.py`: **49 Chromium assertions**.
- `python3 tests/arduous-cancellable-postroll-browser-v464.py`: **54 Chromium assertions**.

## Explicit limitations

- The changed Leningrad source-bound tests are **headless campaign/human-decision tests**, not a complete new Leningrad Chromium port-defense session; the unchanged browser UI is separately covered by Arduous pagination tests.
- A large older fleet-displacement catalogue suite and a larger historical combat-decision suite exceeded their individual execution windows in this pass; their outcome is **not** reported as passing or failing.
- Source-valid **EX** casualty/retreat/Fleet combinations beyond the shared 4,096-attempt safety limit remain non-exhaustive. This fix restores a *specific missing legal branch*, not a claim of global consequence completeness.
- All five historical map exports, v463 City dot styling, source counters, scenario combat profiles, and the one shared B4M CRT remain unchanged.
- The optional Battle for Moscow two-unit stacking study remains second-to-last priority; the unified campaign study remains last.
