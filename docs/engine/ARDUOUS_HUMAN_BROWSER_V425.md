# Checkpoint 191 / v425 — Arduous seven-turn browser controls and route-search audit

## Result: browser-controlled turn progression

The actual Arduous browser, using bundled engine JavaScript, current exported map SVG, and source-counter config, completed Turns 1–7 through scripted clicks on the player-facing controls. The script does **not** execute actions through the autoplay/AI controller. It uses the ordinary buttons, battle checkboxes, die/no-die controls, and save/restore interface; choices are scripted rather than made by a human strategist.

Command: `python3 tests/arduous-human-browser-v425.py` (supports `--resume`, `--progress`, `--max-actions` and `--max-seconds`). The test stores resumable stage data outside the release audit and verifies the saved game in a fresh browser context on each resumed stage. Local fixture loading is used because HTTP navigation is restricted in the test environment; original project script and SVG bytes are loaded, rather than a simulated renderer.

| Observed metric | v425 |
|---|---:|
| Turns through terminal adjudication | 7 |
| Clicks/commitments through browser controls | 101 |
| Committed game actions | 99 |
| Manual movement selections | 4 |
| Battle declarations | 2 |
| Post-combat consequence choices | 2 |
| Automatic NE resolutions | 2 |
| Regular d6 commits in this specific run | 0 |
| Reinforcement placements | 4 |
| Baseline AI action submissions | 0 |
| Browser JavaScript exceptions | 0 |
| Final result | Soviet victory |
| Save/restore across successive browser contexts | Passed |

Evidence: `rules/audit/arduous-human-browser-v425.json` and the actual Chromium terminal image at `rules/audit/visual/arduous-human-terminal-v425.png`.

**Do not overstate this result.** The v425 UI choices were not the same as the stronger v422 contested engine-only trace (184 actions, 14 battles, seven reinforcements, six replacements, three advances/retreats each). v425 certifies a complete browser-operated progression path, *not* normal-d6, air tactics, replacement, retreat and advance UI coverage, nor historically final starting counter identities. Those paths still need specific UI testing. The two user-requested German Infantry map presentation overrides are intentionally not incorporated into source-backed gameplay deployment. Physical Safari on an iPad is not tested.

## Shared pathfinder performance correction

The production `core/legal_pathfinding.js` previously retained every authorized, non-cyclic route prefix, even when the prefix could not improve any reachable destination. In the larger Arduous campaign, the expanding number of redundant prefixes multiplied costly movement adjudications and, in turn, slowed the human action catalog.

The new search skips a prefix only if an existing prefix reaches **the same hex**, incurs **no greater movement cost**, has visited **a subset of the current path's hexes**, and for equal costs has a lexicographically no-greater path key. The visited-set condition is essential: merely choosing the least-cost route to a hex would incorrectly discard alternative legal transit paths on boards where previously visited hexes matter. For source movement rules, subsequent paths depend on the current hex, remaining movement points, visited hexes, static occupancy and ZOC; none of these is loosened by this check.

Verification:

- `node tests/legal-pathfinding-dominance-v425.test.js`: 80 independently enumerated small-board cases; all 466 legal paths, destination costs, and tie-break paths matched the unpruned authoritative `movement_rules.move` oracle.
- Development differential comparison: 27 complete individual movement searches from a saved live Arduous campaign state produced identical legal destination/path/cost arrays to the checkpoint-190 algorithm. Nine searches explored fewer route states, e.g. one expanded 1,318 states previously and 297 states after pruning. The old algorithm was used for the comparison only; no duplicate pathfinder is shipped.
- Existing `legal-pathfinding-v318.test.js` and cross-game movement and browser regressions pass. The shared engine, game rules, source map connectivity, certified 45 Arduous river sides, CRT, counter artwork, and five approved exported maps are not modified.

The browser preview now returns its *currently displayed* authoritative legal-choice catalog, instead of recomputing it on every diagnostic `view()` call. While the deployment interface is active it retains the previous live view behavior.

A second, larger performance issue was eager enumeration of all valid **two- and three-battle combinations** on every human refresh. The human browser only presents individually validated proposals and lets the user check a group of them; its full combination is subsequently verified by the authoritative combat transaction. `Catalog.discover({enumerateCombinedPlans:false})` therefore serves humans without the unused exponential combination search. The default catalog, baseline/autoplay decision process, and the three-battle AI tests still use full bounded enumeration. The human view marks combined plans as **not enumerated**, never as exhaustive. `tests/human-lazy-combat-plans-v425.test.js` proves the human can commit a legal three-battle combination even without eagerly enumerating it. The static Chromium bundle has been regenerated with both optimizations from the exact shared source files.

Rendering and direct player action submission still use the same source-validation gateway.

## Next work

1. Test ordinary d6 and multiple post-roll consequence/advance/retreat/replacement choices in Arduous's actual browser, using a reproducible source-legal action sequence.
2. Certify unique historical starting identities and resolve the `0209`/`0211` presentation-vs-gameplay discrepancy only through an explicit scenario rule decision.
3. Complete Objective: Kiev source topology, starting deployment and shared-engine campaign, then combined Kiev–Odessa. Do not reintroduce a separate game-specific engine.
