# Shared human retreat arrows and original Support art — checkpoint 304 / v538

## Scope and provenance

This is **presentation-only**. The existing shared combat resolver, authoritative post-roll legal-action catalogue, CRT, movement/retreat legality, counter faces, maps, gameplay state, and save format are unchanged. The implementation is shared by the active Kiev, Arduous Beginning, Leningrad, and experimental Kiev–Odessa historical browser shells. It makes no claim that Oberlabs' proprietary retreat graphic has been independently reproduced; the visual interaction follows the requested map-guided design.

## Original Support counters

The reported broken images appeared in the standalone Chromium `set_content()` fixtures, which have `about:blank` as their base address. Correct relative filesystem paths cannot resolve there. Source-photo PNG crops were already in `assets/support-counters`; none was missing from the archive. `scripts/build-support-counter-art.py` now additionally writes `core/support_counter_art_bundle.js`: 22 source PNGs in an offline-safe `data:image/png;base64` lookup, with **byte-for-byte identical** decoded pixels. The original PNGs remain as authoritative source assets and as the fallback for consumers not loading the bundle. Every live Support card records its exact source face ID; an image load failure displays the counter's name rather than a broken-image glyph. All four historical shells load the same generated lookup and use the same Support Window.

## Retreat selection

`core/historical_retreat_map_ux.js` transforms only source-validated `view.options` from the current committed die / post-roll page into drawable path segments. It does not discover legal paths, calculate odds, alter casualties, or create a new combat action. Paths missing a valid on-map origin or destination are not drawn. Routes with identical paths but different attacker/defender losses or advances stay distinct **complete combat consequences** under one path preview; routes with identical final destinations but different intermediate hexes remain distinguishable and selectable.

The renderer draws each legal leg as a dark-yellow directional arrow, the universal thick solid dark-yellow legal-hex outline at the destination, and the existing secondary pulsing border. A click/tap on an arrow or highlighted destination stages a path and narrows the result list to the corresponding exact catalogue actions. Overlapping destinations cycle through available validated routes; route buttons permit direct selection when a destination is shared. Keyboard Enter/Space activates focused arrows; Escape cancels the UI-only preview. The action list uses readable combat-result labels rather than raw serialized `retreatPaths` JSON. The actual combat decision is committed **only** by clicking a complete consequence button. Save/Restore and Undo leave adjudication unchanged; transient route selection is cleared after any committed action or restore. When a combat resolves, the arrows disappear. No arrow is ever treated as an independent movement order.

Touch presentation keeps the source map unobstructed by collapsing the shared Support Window when a retreat decision is awaiting confirmation. Fixed the pre-existing first-tap banner layout shift by positioning the transient touch reminder absolutely, avoiding a hit-target relocation between `touchstart` and the synthesized click. Counter positions, map artwork, and scale are unchanged.

## Actual validated example

On the original Kiev starting battle at `0205`, two German Panzer units and the original FK IV face commit d6=3 and the B4M shared CRT produces **EX**. The original legal catalogue supplies a two-hex Soviet retreat from `0205` via `0306` to `0405`. The test confirms that arrow and hex taps stage only a preview, the actual defender stays in `0205` until a complete EX consequence is selected, and then the source-bound combat transaction places it at `0405`. Pending-roll Save/Restore, Undo, reroll, and touch selection were checked in the real Chromium game.

## Tests and remaining qualifications

- `tests/support-counter-embedded-art-v538.py`: byte comparison of 22 embedded photo PNGs against originals, plus four page includes.
- `tests/historical-retreat-map-v538.test.js`: multi-path, joint-defender retreat and casualty/advance option grouping, nonretreat alternatives, short/invalid paths, exact-authoritative-action preservation.
- `tests/odessa-retreat-arrows-browser-v538.py`: original scenario browser, 4 decoded Support counters, committed EX, actual 2-leg route, keyboard, desktop, iPad touch, no mutation before confirmation, pending Save/Restore, combat result, Undo and reroll.
- Existing `tests/support-target-map-browser-v514.py`, `tests/kiev-support-window-browser-v516.py`, `tests/support-window-source-art-v512.py`, `tests/support-counter-url-contract-v516.py`, `tests/odessa-source-setup-browser-v534.py` and the v537 166-assertion seven-turn **Node** integration regression pass. The original v537 full seven-turn **Chromium** regression exceeded the test's 90-second limit after Turn 1; it is **not** claimed as passing on this checkpoint.

ZOC-specific loss/warning coloration is **not** introduced without an explicit validated outcome reason in the legal-action interface. The interface shows any actual loss choices as complete consequences instead of inventing a cause. Full historic Oberlabs pixel parity, untested branch coverage, naval action authorization, and initial source-face choice remain outstanding.
