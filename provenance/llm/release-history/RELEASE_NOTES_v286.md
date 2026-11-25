# v2.86 — Odessa source-registration corrections

## Why this release exists
v2.83 and earlier visually compared the engine with the printed Odessa map but used horizontally and vertically misregistered source geometry. v2.84/v2.85 fixed the diagnostic mapping. v2.86 applies that corrected mapping to **actual engine data**.

**This is an incremental source-data correction, not a certified complete reconstruction.** The original scans and SVGs are untouched. The screenshot is captured by executing `HexTerrainTiles.svgMap` in Chromium; no image generation is involved.

## Corrections implemented
- Source grid: `pixel_x = engine_x - 476.877206`, `pixel_y = engine_y - 660`. Removed obsolete per-axis scaling and offsets from the bitmap-derived River vertices.
- Independent geometric proof: 983 River boundary vertices reprojected. Median distance to printed dark-blue River ink changes from 16.0 source pixels to 0.0; fraction within 3 pixels from 22.7% to 100%.
- Open / Forest: 0715 and 1211 now Open after source-numbered reinspection. The preexisting source-supported classifications (including 0814 Open and 0918 Swamp) are retained.
- Swamp: 1914 classified as Swamp visual candidate based on its printed yellow-brown hatch.
- City: Chisinau moves from 1211 to 1212, a *visual candidate* because its printed urban art approaches a hex boundary. Other City host hexes unchanged.
- Deployment: German Iron Cross moved from 1114 to 1014; printed Soviet star moved 1211 to 1113. The SVG symbol library remains authoritative.
- Map boundary: removed off-board ordinary land cell 1416. Other deleted land cells (1515, 1613, 1713) remain absent.
- Coast: replaced older misregistered face candidates with an explicitly source-reviewed candidate face inventory. Coast rendering still uses shared seeded wavelet routine; the original SVG coast path geometry is audit-only.
- Railway: corrected the inland printed Chisinau–Brăila corridor which was previously routed through coast-facing 1413–1414–1315–1316; the new ordered anchors are `1312,1313,1213,1214,1115,1116,1117,1017`. Exact intervening hexside crossings remain **uncertified**; the printed source crop is included for review.

## Prevented a misleading water change
Source pixels show water at 1514 and 1218, but the current water renderer cannot represent those as **partial-hex Sea connected to the off-map sea**. Marking each as a full Sea cell created isolated Lake-like blue hexagons. Those automatic full-cell replacements were rejected; their Coast membership evidence is preserved separately, and partial water remains a known rendering gap.

## Verification
- All five maps rendered by Chromium executing the bundled shared JavaScript engine; generated SVG strings equal the Node exporter outputs byte-for-byte.
- Four unaffected SVG maps are byte-for-byte unchanged from v2.83.
- Procedural Coast/Lake, layer ordering, official counters, railway adjacency, source SVG path hashes, and map structure pass their targeted tests.
- Original Odessa source bitmap SHA-256 and SVG source paths retained.

## What is still wrong
The visual match is **not complete**. The off-board sea region and partial Coast hexes are not continuously filled; several Railway turns and River-to-Coast confluences still require independent source-edge confirmation. These uncertainties are recorded rather than patched by nearest-center guesswork. Historical Kiev + Odessa gameplay remains visual-only.

Run `python3 serve.py` and open `/maps/index.html`; rebuild exports with `node scripts/export-campaign-maps.js exports` and validate source registration with `python3 tests/verify-v286-source-registration.py`.
