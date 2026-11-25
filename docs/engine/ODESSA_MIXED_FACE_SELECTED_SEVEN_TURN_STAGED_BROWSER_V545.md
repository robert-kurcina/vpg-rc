# Checkpoint 311 / v545 — source-mixed, face-selected seven-turn replay qualification

## Purpose and scope

Complete a seven-turn **contested** Kiev–Odessa campaign from a **source-verified, non-identity permutation** of all ten original concealed Soviet Mechanized Corps and a **German 49 Mountain Infantry 6–4** physical counter selected as the Turn-3 reinforcement. Preserve the photographed counter pairings, original face IDs, a common B4M Combat Results Table, all previously accepted actual-engine map/counter visuals, retreat arrows, and the original experimental phase rules.

This is a qualification of the current **experimental game**, not a modification to source rules or a claim of historical certification.

## Sources and adjudication

- The ten concealed front/reverse identities are supplied by the v534/v543 source-checked deployment profile, not generated unit strengths.
- German reserve face is `kiev-front-r02c06` (49 Mountain Infantry). The initially held source 29 Infantry (`kiev-front-r01c07`) takes the selected deployed starting position. Source-validated Turn 3 reinforcement allocation is carried into the common buildup engine.
- Opening combat: the same source-legal attack at `0205` by `kiev-front-r01c01` and `kiev-front-r01c03`, FK IV support, committed d6=3, common B4M CRT `EX` and actual reduction of the original Panzer.
- Scheduled six units on Turns 2, 3, 5, and 6 enter by the original source-bound reinforcement edge legality; seven housekeeping transitions produce the original terminal victory evaluation.
- §15.3 of `references/rules/odessa-rules.pdf` specifies naval evacuation/return but **does not identify an evacuation turn phase**. No production phase permission was added, and no rule was invented to pass this milestone.

## Evidence and checks

| Test | Result | Scope |
| --- | --- | --- |
| `node tests/odessa-mixed-selected-replay-v545.test.js` | 98 assertions PASS | Ten distinct original physical identities; 49 Mtn held to Turn 3; seven-turn contested source journal; six reinforcements; replay, Undo, terminal |
| `python3 tests/odessa-mixed-selected-browser-stages-v545.py` | 81 Chromium assertions PASS | Real deployment controls; five authenticated unmodified save stages replayed; visible Turn 3 49 Mtn and Turn 6 Soviet Army Orders; Undo, terminal Save/Restore, 42 original counter SVGs |
| v544 6–4 selection | 383 Node + 37 Chromium PASS | Source-pinned German face selection and browser UI |
| v543 concealed mixing | 155 Node + 45 Chromium PASS | Photographed source permutation and browser UI |
| v534 deployment | 108 Node + 54 Chromium PASS | Original legal placement and save/restore |
| v544 selected-face contested seven-turn | 166 Node PASS | Previous unmodified seven-turn baseline with source selection |
| v541 double-blue retreat | 12 assertions PASS | Dark-blue outer stem, light-blue inner stroke, light-blue destination hex border |
| v538 retreat route | 18 assertions PASS | Engine-validated paths only |
| v537 human catalog cache | 18 assertions PASS | Immutable view cache and Undo/Restore validity |

The five stage files are `rules/audit/saves/odessa-mixed-selected-{turn1-opening,post-exchange,turn3-pre-arrivals,turn6-pre-arrival,terminal}-v545.json`. They are **actual full human campaign saves**, including the authenticated source deployment and complete action journal; they are not edited source state or synthetic visual fixtures. Both the Node engine and the live Chromium page re-run saved journals to reconstruct each game state.

Actual shared-engine browser screenshots: `rules/audit/visual/odessa-mixed-selected-turn3-browser-v545.png`, `rules/audit/visual/odessa-mixed-selected-terminal-browser-v545.png`.

## Falsification and limitations

An attempted **uninterrupted** 7-turn Chromium run from the same real mixed/face-selected setup reached all source Turn-1/2/3 decisions (including the EX and the 49 Mountain arrival) but exceeded the execution window after Turn 3. This is **NOT** a passing uninterrupted seven-turn browser regression. The staged replay tests prove the engine journal, authentic saves, presentation, and specified visible Orders actions, but not the performance or reliability of every transition under one continuous interactive Chromium session. Running the complete interactive session remains P0 and should drive legal-action-catalog performance review before broad UX polish.

Other remaining gaps: source authorization of naval evacuation phase, historical Romanian territorial movement boundaries, additional combat/city-control branches, and full historical certification. Avoid changing the already approved map render, double-blue retreat style, source counter photographs, Support crop, or one shared B4M CRT.
