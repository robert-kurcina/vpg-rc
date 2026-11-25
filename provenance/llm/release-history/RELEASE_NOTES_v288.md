# v288 — Kiev–Odessa water compositing and sea registration repair

## Confirmed fixes

1. **Critical Kiev river regression:** Odessa's bitmap-river mode was suppressing ALL original SVG river paths across the composite. The shared renderer now retains `board.authoredSourceVectors` (Kiev's river paths) while replacing only the Odessa extension's source river paths with its 983-vertex source-registered bitmap ink. Preserves original shared `authoredRiverRibbon` variable-width river renderer.
2. **Duplicate sea rendering:** Odessa's `1813` sea cell was being rendered in generic cyan as a whole-hex water region over the published purple source sea. Skip this generic body whenever the source-sea interior is in use; leave all other maps' sea/lake logic unchanged.
3. **Sea spillover:** The source sea polygon extended outside the irregular printed playable hex footprint, creating floating purple fragments. Clip it to the union of playable hex polygons, preserving its original full source contour in the source configuration.
4. **Detached coastal decorations:** Compare all 20 provisional annotated coast sides to the printed sea boundary. Four are more than the source tolerance (12 px) from the sea's edge (`1118:SE`, `1315:SE`, `1415:NW`, `1612:SE`); quarantine their procedural wavelets rather than painting disconnected bands. Their records remain UNCHANGED and are reported in `evidence-v288/water-registration-audit.json` for later manual correction. The remaining 16 use the existing seeded five-segment wavelets.
5. **Source integrity:** no changes to the original provided SVG or printed raster files, no fabricated gameplay river network, no new unverified sea cells or borders.

## Validation

- Node regressions: `tests/water-topology-v288.test.js`, `tests/water-restoration-v287.test.js`, `tests/odessa-source-terrain.test.js`, `tests/official-counters.test.js`.
- Scenario and render invariants: `scripts/verify-campaign-maps.js`, `scripts/verify-v278-water-z.js`, `scripts/verify-v281-lower-coast.js`, `scripts/verify-v280-source-hexside.js`.
- Five maps regenerated with the same `core/terrain_tiles.js` renderer and rasterized using Inkscape. Engine SVG render is **not** a Chromium interaction screenshot.

## Important limitations; do not label this complete

- Kiev SVG source river centerlines are source-authoritative for art, NOT a gameplay-certified reciprocal 6-sided river crossing graph.
- Odessa's source-river bitmap geometry and 20 provisional coastline annotations remain visually registered, not movement/combat-certified.
- The four quarantined coast annotations require source review; some sea/estuary boundaries remain geometrically discontinuous or are not hexside-aligned.
- Only Battle for Moscow is represented as playable in the historical archive; Kiev-Odessa remains a display-candidate map.

## To reproduce

`python3 serve.py` -> `/maps/index.html` -> Kiev + Odessa. Run `node scripts/export-campaign-maps.js exports --png --width=1800` to reproduce exports; run `node scripts/export-water-audit-v288.js` to reproduce annotated coastline audit.
