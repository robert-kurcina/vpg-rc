# Checkpoint 269 / v503 — Romania and Bessarabia below River, Lake and Coast

User request: change **both** the orange Romanian four-hex setup outline treatment and the mauve 19-hex Bessarabia outline treatment so water draws on top of the colored dashes. All maps must remain outputs of the one shared engine, not source-map edits or image approximations.

## Implementation

Moved the existing `hexRegionOutlines` SVG group in `core/terrain_tiles.js::svgMap` from *after* the water feature pass to *immediately before* `sharedBoundaryLayer(..., 'features', ...)`. The effective order is now:

1. Terrain, including Forest and Swamp, with the historical city ground treatment;
2. Fortifications;
3. **Per-hex `setup-region-outlines`** (orange Romania + mauve Bessarabia);
4. `rivers` (including both source-registered and engine-authored River/Major River);
5. `water-bodies` (Lakes/Coasts/Sea and source water-route additions);
6. Roads, railways, hex grid, numbers, cities, deployment icons.

There is no new per-scenario renderer, no new graphical tile treatment and no custom paint pass. The existing shared renderer still takes the exact same scenario-configured stroke, inset, dash, and `hostCell` data. Original user-supplied SVG, fixed terrains, vector shorelines, movement topology, counter facings, and shared CRT are unchanged. The optional legacy *continuous* `territoryOutlines` renderer is unaffected and remains unused by the combined map.

The standalone Kiev map also contains the four orange setup polygons; its export must reflect the corrected order. The other three maps have no `hexRegionOutlines` configured, so their exports are preserved byte-for-byte.

## Scope and data

- Four Romanian setup cells: `0709`, `0809`, `0910`, `1010`; orange `#ed8d30`.
- Bessarabia: the existing **19** user-adjudicated hex IDs, mauve `#9475A9`.
- Both: stroke width `4.5`, `10 4` dash, `0.88` inset, original transparency and blend behavior.
- Bessarabia gameplay classification remains exactly 19 confirmed cells and 242 unclassified cells on the combined 261-cell board. Neither additional Romanian territory nor an `outside` region has been inferred. No additional Kiev–Odessa rules have been enabled.

## Verification

- `node tests/territory-outline-water-layer-v503.test.js`: renderer and saved SVG ordering, exact polygon IDs, style/membership, and cross-scenario isolation.
- `python3 tests/territory-outline-water-browser-v503.py`: actual headless Chromium render of the **distributed shared-engine SVG**; checks strict order and 4 + 19 polygons; archives a high-DPI screenshot.
- Original `tests/odessa-bessarabia-per-hex-v502.test.js` and `tests/odessa-user-bessarabia-v501.test.js` still pass.
- The older `tests/kiev-romanian-setup-outlines-v481.test.js` had become stale at v502 because it counted all `setup-region-outline` polygons as Romanian, yielding 23 rather than four on Kiev–Odessa. The test has been correctly scoped to Romanian `data-region` without weakening its four-hex source assertions, and passes again.
- Actual-engine 1360×1350 (combined) and 1269×841 (Kiev) PNGs compared with checkpoint 268 show differences only where territory outlines interact with water, not relocated territory, redrawn contours or map source changes. See `rules/audit/odessa-territory-under-water-v503.json` for pixel-difference bounds and hashes.
- Package audit compares every pre-existing source entry with v502, and verifies the three unaffected map exports are unchanged.

**Gameplay status unchanged:** Kiev–Odessa remains diagnostic/non-playable pending full territorial and source-qualified rules/setup coverage.
