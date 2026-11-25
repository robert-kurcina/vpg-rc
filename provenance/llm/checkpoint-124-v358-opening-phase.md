# Checkpoint 124 / v358 — shared candidate setup to first-phase integration

Input archive: `hex_wargame_v357_CHECKPOINT_123_SHARED_SETUP_SOURCE_AUDIT.zip`.

## Added

- `core/scenario_opening_bridge.js`: generic, opt-in controller factory binding verified source-face setup to the **actual `PhaseRuntime.start` cursor**, with copied state, config, and map and no scenario-name branches.
- `tests/scenario-opening-bridge-v358.test.js` (44 assertions): tests 19 source-face units; first German combat; real source-backed attack declaration `0310` to `0309` and 2:1 odds; rejects combat outcome/finish; guards input mutation, illegal setup and mismatched configs. An intentionally changed first-movement *test configuration* proves 19-unit movement/Undo compatibility; it is NOT historical Turn 1.
- `tools/audit-scenario-opening-v358.js`, `rules/audit/scenario-opening-integration-v358.json`: executable audit using existing v357 **test-only** source-face selection.
- `core/SCENARIO_OPENING_BRIDGE.md`: interface, provisional identity constraints, and real gameplay blockers.

## Critical boundaries

- All 19 unit IDs are actual verified face IDs, but their test-selected allocation is not an authoritative historical formation assignment.
- The fixed Soviet rear markers have two unresolved printed-coordinate disagreements: PDF `1305` vs displayed `1306`, and PDF `1701` vs displayed `1702`. Source SVG/counters and approved map are unchanged.
- German turn 1 begins at the combat phase, NOT ordinary movement. Declaration, selection and odds preview are bounded; no die, CRT consequence, loss, retreat, reveal, advance, combat undo or phase completion is authorized.
- Existing lower combat modules still contain source-specific logic. This checkpoint adds a **generic bridge**, not complete multi-scenario rules parity.

## Verification

- 17 targeted JavaScript suites passed including 44 assertions in the new bridge test (setup 72, inventory 68, combat, phase, movement, renderer, five-game contract and smoke).
- Leningrad v350 approved visual baseline test passed (one Python test), SVG footprint tests passed (five Python tests).
- Fresh exports for all five maps: ten PNG/SVG pairs byte-identical to v357 archive, no fatal validation errors; `rules/audit/cp124-render-nonregression-v358.json`.
- No scenario map, original source asset, renderer or runtime phase configuration changed.
