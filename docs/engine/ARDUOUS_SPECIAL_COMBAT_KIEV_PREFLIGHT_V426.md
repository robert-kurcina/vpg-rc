# Checkpoint 192 / v426 — Arduous combat controls; Objective: Kiev source preflight

## Arduous: ordinary ground die, retreat and advance via actual browser controls

`python3 tests/arduous-human-special-combat-v426.py` exercises the existing shared historical browser using the actual Arduous candidate setup, original map SVG, official counters, and generated shared browser-engine bundle. All committed decisions are made through visible Chromium controls (battle checkboxes, action buttons, die entry, Undo), not a direct engine `choose()` or baseline AI invocation.

A source-valid three-attacker battle against hex `0305` is declared after completing German air/sea support. A German air marker is committed; the browser exposes a regular d6 control rather than automatic NE. The test enters `4`, gets CRT outcome `EX` and 32 validated consequence choices, saves/restores the pending die, then clicks a consequence containing both a defensive retreat route and an attacker advance. It verifies real game-state change, exact post-combat save/restore, Undo, and deterministic restoration of the same final journal after recommitting the die.

The pending die remains bound to the preceding combat state and cannot be changed during post-roll choice. The test intentionally exercises one reproducible opening combat rather than claiming a complete contested browser replay of checkpoint 188's 184-action campaign. In particular it does not verify every later-turn replacement or every valid retreat branch. See `rules/audit/arduous-human-special-combat-v426.json`.

## Shared browser: complete access to individually legal battle proposals

The shared UI's combined battle panel previously showed only the first 100 proposals and instructed users to use an engine API for the remainder. That violated the browser-only playability goal even though the engine itself had verified the omitted proposals.

`core/historical_browser_app.js` now applies the existing Orders filter to the proposal list as well. Typing a defender hex or attacker counter ID narrows the visible checked-box proposals. The source catalog and underlying validation remain identical; no proposal is fabricated or removed from game rules. Selection survives filter changes, including temporarily hidden checked proposals. A count displays how many proposals match and how many are selected; at most 100 are rendered at once for responsiveness. The actual Arduous browser check `tests/arduous-human-battle-filter-v426.py` verifies filtering, selection persistence and a valid committed battle. Its initial tested source state has 82 proposals, so the >100-item rendering cap has not yet been exercised with a source-valid board containing more than 100.

## Objective: Kiev — historical source graph preflight (superseded by v427)

**Superseded:** The 97/58/3 rail counts below describe checkpoint 192 and are no longer active. The v427 definitive SVG reconstruction has 93 links with 186 reciprocal annotations. The old diagnostic test and its audit were retired. See `docs/engine/KIEV_RAIL_RECONCILIATION_V427.md`.



`node tests/kiev-source-topology-preflight-v426.test.js --write-audit` reads `maps/kiev.json`, the authored `maps/source/user-svg/kiev-map-temp(5).svg`, and the shared hex neighbor implementation. It verifies the following invariants without approving any candidate feature:

| Observation | Current source |
|---|---:|
| Classified physical hexes | 165 |
| Adjacent internal hex pairs | 442 |
| Connected components | 1 |
| Registered adjacent rail center-links | 97 |
| Registered rail links lacking complete reciprocal rail-side annotations | 58 |
| Rail-side annotated pairs absent from the center-link set | 3 |
| Paired provisional river hexsides | 10 |
| Terrain cells without gameplay-certified provenance | 113 |

The 58 and 3 rail discrepancies are *differences between two provisional records*, not evidence that one or the other must be discarded. A future source review must compare them with the authoritative authored SVG. All 97 registered rail center-links are physically adjacent. The two records are not silently merged or used to authorize movement. The three discrepant rail-side pairs are recorded in the generated audit alongside the exact 58 registered links requiring annotation reconciliation.

The Kiev graph registry remains `provisional` and the production `MapMovementGraph.build(kiev)` still refuses with `source-geometry-not-gameplay-certified`. Existing shared B4M CRT, source map JSON, renderer, and all five approved map exports have not changed. These counts are a preflight for the next development phase, **not** Kiev game certification.

## Acceptance boundary

The Arduous complete seven-turn human-control progression (v425) and the contested engine-only seven-turn run (v422) remain separately established. This checkpoint tests previously missing complex UI branches; it does not merge them into a full 184-action browser replay, does not certify historical opening identities, and does not establish physical iPad Safari behavior. Kiev and Kiev–Odessa remain unavailable for complete campaigns.
