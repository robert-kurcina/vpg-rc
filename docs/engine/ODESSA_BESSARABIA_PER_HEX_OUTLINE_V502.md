# Kiev–Odessa: Bessarabia uses Romanian-style per-hex outlines (v502)

Checkpoint **268 / v502** replaces **only** the continuous outer mauve Bessarabian perimeter from checkpoint 267 with **19 separate mauve hex polygons**, matching the existing four orange Romanian setup hexes. The actual common engine renders all 23 outlines through the already-existing `hexRegionOutlines` option in `core/terrain_tiles.js`. No mockup, source-map repaint, engine fork, or new rendering code is involved.

The combined board (`maps/registry.json`, `kiev-odessa.renderOptions.hexRegionOutlines`) retains the Romanian group with four `hostCell` IDs and adds a Bessarabia group containing precisely the user-approved IDs `1111, 1112, 1113, 1114, 1115, 1116, 1211, 1212, 1213, 1214, 1215, 1312, 1313, 1314, 1315, 1316, 1413, 1414, 1514`. The per-cell outline matches Romania's **stroke width 4.5**, **dash 10 4**, and **inset 0.88**, but retains Bessarabia's approved **mauve #9475A9** instead of Romanian orange. The previous `territoryOutlines` opt-in is removed from this scenario. Internal hexsides now carry outlines from *both* adjacent cells, as requested, rather than disappearing into a single continuous boundary.

The independent **gameplay territory data** remains in the composed map's `sourceTerritory` field, stamped from `maps/odessa-extension.json`: 19 user-adjudicated Bessarabian cells, 242 unclassified, with standalone Kiev unchanged. None of the missing Romania/outside classifications is inferred, and no unfinished movement, annexation, Fleet, or campaign rule is unlocked. The original author-provided map SVG, other four map exports, rule PDFs, counter art, and shared B4M CRT are untouched.

## Verification

- `node tests/odessa-bessarabia-per-hex-v502.test.js`: verifies exact 19 + 4 polygons, matched border geometry/style, original source membership, absence of the previous perimeter, current SVG export, and standalone isolation.
- `python3 tests/odessa-bessarabia-per-hex-browser-v502.py`: Chromium renders the **actual shared-engine SVG**, verifies 19 mauve/4 orange outlines and style parity, tests rail layer and absence of perimeter, and records the enlarged source-based image in `rules/audit/visual/odessa-bessarabia-per-hex-browser-v502.png`.
- Existing v501 territorial membership test is retained and updated to check canonical membership and **current** (v502) presentation, without misrepresenting its old 36 exposed hexsides as still drawn. Its original v501 visual evidence and source decision audit remain archived.
- Version v502 regenerates **only** `exports/kiev-odessa.svg` and `.png`; the four other map exports are copied from v501 unchanged.
- Audit details and hashes: `rules/audit/odessa-bessarabia-per-hex-v502.json`.
