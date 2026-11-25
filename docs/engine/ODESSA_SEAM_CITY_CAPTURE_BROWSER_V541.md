# Checkpoint 307 / v541 — contested Kiev–Odessa seam crossing and Chisinau capture

## Implemented and verified

The shared historical campaign, with its original source-configured experimental combined map, now has a reproducible **three-turn contested acceptance path** that starts with a real original Kiev battle (`0205`, two Panzer attackers, FK IV air support, d6=3, common B4M CRT `EX`). An original Panzer is reduced. The original Romanian Cavalry Corps (already reduced and displaying its corrected pale-blue source field) then moves on source-validated shared movement orders:

| Turn | Phase | Exact route | Adjudicated outcome |
|---|---|---|---|
| 1 | German Special Movement | `1010 → 1011` | Crosses one of the 24 candidate traversable Kiev-to-Odessa seam edges |
| 2 | German Movement | `1011 → 1112` | Cavalry continues in the original Odessa extension; Chisinau remains Soviet |
| 3 | German Movement | `1112 → 1211` | Cavalry enters original printed Chisinau city; `state.cityControl.Chisinau` changes from `soviet` to `german` |

Turns 1 and 2 complete all intermediate phases and housekeeping. The Turn 2 and Turn 3 German scheduled ground reinforcements are admitted normally, using the source-bound Buildup roster. No artificial unit relocation, fabricated city control, guessed geography, or direct state patch is used. No independent gameplay module has been added.

## Shared browser improvement

`core/historical_browser_app.js` now compares the authoritative *before* and *after* `state.cityControl` dictionaries on a **successfully committed human action**. When a city actually changes its owner, the player receives an unobtrusive status message such as `City control changed — Chisinau: soviet → german`. Moves that do not change the city ledger produce no notice. This is derived only from game state, not from a visual city marker or predicted movement result. Rejected actions and mere movement declarations cannot report capture. The change affects presentation only; campaign action legality, original CRT, casualty results, and save format are unchanged.

## Regressions / provenance

- `tests/odessa-contested-seam-city-capture-v541.test.js`: **54 Node assertions**, original EX, exact cross-seam edge provenance, verified legal action catalog, all three moves, invalid move rejection, phase transitions, intermediate reinforcement deployment, snapshots, Undo and Save/Restore; emits three complete original-source human saves before each move.
- `tests/odessa-seam-city-browser-v541.py`: **42 Chromium assertions**. Restores those exact source-replayed pre-movement saves and uses **visible Orders buttons** for each route and movement resolution, confirming original counter rendering, correct city state, no fabricated earlier control changes, actual capture notice, Undo and Save/Restore. Each saved state is produced by the complete Node-journal path, not by fixture mutation. The browser avoids a wasteful re-render of all earlier phases.
- `tests/odessa-retreat-blue-style-v541.test.js`: **12 assertions**, preserving approved v540 double-blue route stems, light-blue hex outlines, and distinct gold Support highlighting.
- Existing qualification checks on the combined experimental movement graph (**56**), source-constrained setup editor (**108**), Kiev/Odessa Coast/ZOC (**103**), and retreat route model (**18**) passed.

Evidence: `rules/audit/visual/odessa-seam-chisinau-browser-v541.png` is an **actual Chromium screenshot from the shared engine**, with original counter-art projection. Three replay-verified prior-move save files are in `rules/audit/saves/odessa-pre-movement-turn{1,2,3}-v541.json`.

## Limits

This closes one contested seam/city-control **acceptance path**, not exhaustive seam-graph or historical movement certification. The 261-hex graph remains explicitly experimental; Romanian territorial classification is incomplete. Starting source-face pool choices, concealed Soviet identity mixing, source-authorized naval evacuation phase, unusual combat branches, and a new complete seven-turn Chromium regression remain outstanding. The prior checkpoint's approved double-blue retreat arrows are retained. No source rules PDF, original bitmap or counter-sheet photograph, CRT, source map, or victory policy was edited.
