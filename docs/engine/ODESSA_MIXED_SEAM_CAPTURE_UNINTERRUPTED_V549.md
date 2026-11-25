# Checkpoint 315 / v549 — uninterrupted mixed-start Kiev–Odessa with contested seam crossing and Chisinau capture

## Result

A **single uninterrupted actual Chromium human-browser session** combines the previously separate qualification paths for source-constrained initial setup, Turn-1 combat, Kiev-to-Odessa seam movement, city-control changes, scheduled reinforcements, and the complete seven-turn phase sequence.

The browser uses the official shared map export and source-configured original SVG counter renderer; it does **not** inject staged saves, manually change game state, introduce new terrain or edit the original rules. The original authored starting layout remains an experimental source-constrained sample. The ten original concealed Soviet Mechanized Corps are mixed by the visible browser setup control, and the selectable German 49 Mountain Infantry face is assigned to Turn 3 through the visible setup selector.

A genuine original FK IV-supported Turn-1 battle rolls d6=3 and returns the common Battle for Moscow CRT **Exchange (EX)** with a reduced Panzer. The source-validated Romanian Cavalry Corps then crosses the actual base/extension seam and captures Chisinau:

| Turn | Phase | Original cavalry action | City control afterward |
|---|---|---|---|
| 1 | German special movement | `1010 → 1011` | Soviet |
| 2 | German movement | `1011 → 1112` | Soviet |
| 3 | German movement | `1112 → 1211` | German |

The Turn-3 capture is initiated and resolved using the actual visible Orders buttons. It displays the committed **`Chisinau: soviet → german`** notification. The test verifies that a movement declaration does not prematurely relocate the unit or change the ledger. A forged path to `9999` is rejected without state mutation. Capture supports Undo (restoring the cavalry and the Soviet city) and an identical replay and authenticated Save/Restore. No initial action is invented to circumvent source rules.

The same browser session then proceeds through Turns 4–7, all six original scheduled later arrivals, the seven housekeeping transitions, real terminal scoring, and restoration of its exact 42-counter end state. The captured city remains Axis-held throughout the conclusion. **183 assertions pass** in the actual browser on two consecutive runs.

## Evidence

- `tests/odessa-mixed-seam-city-seven-turn-browser-v549.py` — one uninterrupted Chromium session, 183 assertions. No staged save restore or test-engine shortcuts for intermediate turns. The random Soviet concealment mixing is intentionally not asserted to a fixed permutation; the physical IDs remain unique.
- `rules/audit/visual/odessa-mixed-seam-chisinau-capture-v549.png` — actual browser after the Turn-3 capture, showing city control notice, source map, source SVG counters.
- `rules/audit/visual/odessa-mixed-selected-seven-turn-browser-v549.png` — actual browser at the terminal campaign state.
- `rules/audit/saves/odessa-mixed-selected-seven-turn-browser-v549.json` — complete authenticated final human-session journal, not a synthetic fixture.
- `rules/audit/odessa-v549-protected-code-source-audit.json` — SHA-256 comparison against checkpoint 314, **373 files identical** under the shared engine, source maps, game configs, assets, exports, and references.

## Archived campaign saves

A separate compatibility check established that the **three original v541 pre-movement campaign save fixtures no longer match the subsequent source/configuration hashes**. They are correctly rejected by the existing authenticated campaign restore contract with `Campaign source/configuration mismatch`, without changing the current browser state. **15 Chromium assertions pass** in `tests/odessa-archived-campaign-source-gate-v549.py`; a newly saved current campaign still round-trips. These are version-bound **campaign** saves, not the legacy **deployment editor** saves whose v1/v2 compatibility was qualified earlier. Changing the current engine to accept an incompatible source hash would silently reinterpret the historical journal and is deliberately avoided.

Cross-regressions passing in this build: v541 original source seam/capture **54 Node** assertions, v544 selected 49 Mountain seven-turn campaign **166 Node**, v545 mixed-selected replay **98 Node**, v548 read-only probe **154 Node**, and v541 approved double-blue retreat style **12 Node**.

## Verification limits

This is **acceptance testing only**. No combat policy, phase authority, JavaScript renderer, scenario configuration, source counter SVG template, photographic counter sheet, CRT, map geometry, two-tone retreat style or Support counter viewport has been modified. All earlier source rules and game behavior remain in force.

One successful, constrained contested campaign is not broad adversarial battle coverage. The Romanian political-region classifier and Home Army/Hungarian exclusions remain source-incomplete; traversing these particular reviewed hexes does **not** certify country-wide movement. The Odessa §15.3 naval ground evacuation is still withheld from live actions because the original rules do not identify its authorized phase. Exact victory communication and other high-complexity branches remain experimental.

## Next development priority

Expand the contested outcome matrix to include verified alternative CRT consequences, city recapture, and nationality-sensitive legal-movement/retreat cases. Resolve naval-evacuation phase authority only from the source rules or a clearly labeled nonhistorical variant. Complete historical certification separately; do not infer it from a passing smoke or one contested path.
