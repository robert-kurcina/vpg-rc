# Kiev–Odessa: user-approved Bessarabia territory and shared-engine perimeter (v501)

Checkpoint 267 / v501 records the **exact** 19 `hostCell` IDs supplied by the user on 2026-11-22, in the existing combined Kiev–Odessa board, as `sourceTerritory: "bessarabia"`, with evidence `user-adjudicated` and the user-instruction provenance string. The classifications are applied **only during Odessa composition** (`maps/odessa-extension.json` + `maps/composer.js`); the 165-cell standalone Kiev base is unchanged. Selected hex `1211` has unresolved *terrain* metadata; this is independent from its newly confirmed political classification.

Canonical IDs: `1111`, `1112`, `1113`, `1114`, `1115`, `1116`, `1211`, `1212`, `1213`, `1214`, `1215`, `1312`, `1313`, `1314`, `1315`, `1316`, `1413`, `1414`, `1514`.

The single shared renderer (`core/terrain_tiles.js`) reads `sourceTerritory` from the composited cells. A *generic* opt-in `territoryOutlines` profile draws only the exposed hexside segments between the selected region and non-member cells, in muted mauve `#9475A9`, below routes/hexgrid/labels. There are **19 member hexes and 36 exposed perimeter sides**. Inner shared sides have no mauve stroke, source terrain, rivers, cities and railways retain their original layers, and no image generation/mock renderer is used. The approved outer border is visible by default on the real `kiev-odessa` map viewer and exported SVG/PNG; no other scenario selects this outline. Browser Chromium inspected the exact exported shared-engine SVG.

## Scope and failsafe qualification

These 19 IDs are authoritative as the **user-adjudicated Bessarabia set**. All **242 other cells remain unclassified**; they are **not** inferred as Romania, outside or Sea. The engine's territorial rule gateway still requires source-certified and complete region evidence on a gameplay-authorized board. Hence this work **does not** declare Romania's border, enable the Home Army's movement, trigger Bessarabia annexation, promote Odessa into play, or modify original game art/rules/CRT. Previous diagnostic suggestion that `1413` was `outside` was illustrative and is superseded by the explicit user's Bessarabia assignment.

## Verification and reproducibility

- `node tests/odessa-user-bessarabia-v501.test.js` verifies exact set membership, 19 connected cells, 36 external sides, 242 unknown classifications, and Kiev isolation; 127 assertions.
- `python tests/odessa-bessarabia-browser-v501.py` embeds the actual engine SVG into Chromium, verifying exact displayed region and preserved Rails/City setup layers; browser check passed.
- Existing `tests/odessa-territorial-lifecycle-v500.test.js` (45), `tests/odessa-territorial-restrictions-v499.test.js` (57), `tests/odessa-cavalry-special-movement-v498.test.js` (169), and `tests/odessa-source-land-city-graph-v497.test.js` (1,785) passed.
- `exports/kiev-odessa.svg` and `.png` generated using `scripts/export-campaign-maps.js` and Inkscape; the *other four SVG/PNG pairs* are retained byte-for-byte from checkpoint 266. Browser evidence in `rules/audit/visual/odessa-bessarabia-browser-v501.png`.
- Source SVG, printed reference scan, source rule PDFs, five-game common B4M CRT and all live movement rules remain unchanged.
