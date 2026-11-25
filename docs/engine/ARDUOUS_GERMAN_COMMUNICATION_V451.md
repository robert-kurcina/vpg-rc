# Checkpoint 217 / v451 — Arduous German west-edge replacement and communication certification

## Source rule (verified against actual supplied PDF)

`references/rules/arduous-rules.pdf`, printed page **6**, §§12.0–12.4:

- From Turn 4, the German receives one replacement step per turn (the scenario-configured turn track); an eliminated two-step counter returns on its one-step reverse face for one step, and cannot be raised to full strength in the same Build-Up.
- §12.3 makes German off-map placement and communication equivalent to Soviet §12.2 but uses the **west (black) map border**, rather than east (red).
- A friendly controlled city was last entered by that player's unit; starting ownership of all cities is Soviet.
- Except for the origin, a communication path cannot enter an enemy-occupied hex or enemy ZOC. **Friendly units never cancel enemy ZOC.**
- Unused replacement steps expire at the end of the phase (§12.4).

The printed rulebook is source-pinned by the SHA-256 recorded in `rules/audit/arduous-german-communication-v451.json`.

## Implemented / certified behavior

No engine changes were necessary: `core/historical_buildup_phase.js` already provides the required directional entry edges, city control checks, west/east graph connectivity, EZOC exclusions, stack validation, reduced source-face selection, and one-step accounting. The v451 regression `tests/arduous-german-communication-v451.test.js` adds the previously missing **German-specific** source-graph and replacement transaction tests.

- Validated the existing candidate starting lineup through the source setup validator. Uses the photographed `arduous-front-r01c06` German infantry counter and its explicitly paired reverse face.
- Source west-edge entry set is exactly `0105`–`0110`. With this **candidate** opening's occupancy/EZOC, `0105` and `0106` are legal entry destinations when the counter is off-map; the other four are blocked. This is **not** a statement that other setup choices or later turns always leave those hexes blocked.
- German rebuilds are unavailable in Turn 3 and legal from Turn 4; an admitted counter returns on its reduced reverse face for one replacement step, and the same phase cannot spend a second German replacement.
- All 12 registered cities are reachable to the west when the board is clear. German city reentry requires German city control **and** westward communication; Soviet-owned or isolated German-owned cities reject the action.
- Encirclement blocks city communication, including attempts to trace through friendly counters in enemy ZOC. The origin remains exempt from the ZOC test **for communication** but an off-map replacement still cannot enter an EZOC at the western border.
- An independent, side-safe graph oracle with a different BFS traversal compares with the shared engine for **130 deterministic occupancy cases × 12 cities = 1,560 assertions**, in addition to the transaction checks.

**Result:** `1,644` assertions passed. Other focused Arduous, Kiev and v447 city-style regressions also passed. Seven-turn **no-elective-combat** smoke and mixed-combat persistent-session suites passed; the longer 184-action contested browser run was not claimed.

## Strict limits and next task

The elimination of German units and city captures in this v451 test are **test-only counterfactuals**; their replacement transactions are genuine executions of the common source-configured engine. This does **not** establish a real Chromium player-action journal that first eliminates a German counter, later captures a city, then rebuilds that counter at a communicating city or west edge. That browser acceptance remains the next gameplay branch. There is no new independent city ownership or supply system.

No changes to the five approved map exports, city outlines, v441 terrain, source counter art, historical source PDFs, shared engine, common B4M CRT, or deferred priority ordering. B4M optional stacking is still second-to-last and unified game exploration is absolute last.
