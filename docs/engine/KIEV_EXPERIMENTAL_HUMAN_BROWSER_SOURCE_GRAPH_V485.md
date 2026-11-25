# Checkpoint 251 / v485 — Objective: Kiev experimental human-browser campaign

## Authorized scope

Promoted the **source-reviewed** Kiev 165-hex / 442-edge movement graph to `status: verified` in the shared movement registry, with explicit scope `source-svg-geometry-for-experimental-gameplay`. The authorization is **for running an experimental human campaign using the user's SVG**, not a claim that all printed starting identities, every historical rule, strategic AI, or full seven-turn human-browser trajectory have been certified.

The map's `image-grid-contrast-fit-visual-candidate` calibration label remains unchanged; the source-typed terrain, rail, river, and Major River entries are pinned to the reviewed SVG ledger. Five discrepancies in the visual River/Major River annotations were reconciled in v484 before this promotion. Original SVGs, original rules, common CRT, city/terrain rendering, Romanian marker layer and all five map exports remain untouched.

Kiev–Odessa's composite graph is **not** promoted by Kiev's authorization and remains unplayable.

## Implementation

- `maps/movement-configs/graph-sources.json`: Kiev authorization changed to source-verified with explicit experimental scope; unrelated scenarios unchanged.
- `maps/movement-configs/kiev.json`: executable status updated; rule parameters unchanged.
- `games/kiev/setup-preview/config.json` and `index.html`: source-validated setup now leads into the existing historical human campaign controller at German Combat Turn 1, with explicit warning that the deployment is illustrative. Combat, buildup and housekeeping policies are loaded from their established files.
- `scripts/build-historical-browser-bundle.py` and resulting shared browser bundle: registered the existing `tests/fixtures/kiev-source-opening-v437.js` as a scenario fixture, not a new renderer or engine.
- Shared Kiev movement-review audit and browser revised to describe bounded experimental graph authorization; user review drafts remain distinct, source-pinned and unable to modify rules.
- Project homepage updated to link to Kiev experimental human gameplay.

## Evidence and limits

The v485 Node test validates a **production graph build** (no test-local source authorization), 165 cells, 442 edges, 93 rail connections, 72 ordinary rivers, 10 Major Rivers, a real shared campaign session, first player combat, phase advancement, save/restore, Undo, and source-drift rejection. Kiev–Odessa remains gated.

Chromium v485 exercises the genuine Kiev map art and counters in the shared controller, 30 counter setup, concealed Corps mixing, real legal movement, action journal, save/restore, Undo, Turn 1 housekeeping into Turn 2, and mobile control rendering. Its local-file harness inlines the same packaged JS/CSS/data and the actual exported map image because localhost browser navigation is restricted in this test environment. The shipped page references the approved engine SVG normally.

A synchronous browser script attempting a whole seven-turn campaign exceeded its test time limit. Accordingly, **a seven-turn human-browser acceptance is NOT claimed**. The earlier seven-turn Kiev Node diagnostics remain valid separately, but their example starting allocation is not a certified historical opening. Baseline deterministic AI is a test controller, not validated competitive AI.

The older v318 `map-certification-readiness` test compares against a historical snapshot whose Kiev SHA predates map updates already present in v484. It is retained as provenance, not claimed to pass on the current map; current geometry is checked instead by source-reviewed candidate, v484 river, and v485 production-binding regressions.

## Playability classification

**Four of five** scenarios now have runnable shared-engine historical browser interfaces, counting Kiev **experimental**. This is not four of five historically fully certified games. Kiev–Odessa is still gated. Further priorities: controlled seven-turn human-browser acceptance, source-accurate opening roster reconciliation, branching combat/replacement validation, strategic AI qualification and later Oberlabs UX parity.
