# v289 — Definitive Kiev–Odessa user SVG import

The user's `/mnt/data/kiev-odessa-main.svg` (SHA-256 `89a5ca41af5bd34f760d9564003dfcd6fee7dbe5de7e0c07606c39d321fdcf6f`) replaces all obsolete Kiev–Odessa composite visual paths. This is a source-authoritative vector import: it does not assume v288's scan extraction, procedural shoreline, raster-derived river fragments, or previously inferred purple water polygon are valid.

## Converted and rendered through the game engine

- 230 hex grid polygons (v288 had 234). Removed obsolete `0818`, `1018`, `1218`, `1415` from the composite only.
- 141 open terrain references at 139 unique hexes, 52 forest hexes, 19 swamp hexes. No source open texture is invented on 20 city-symbol hexes.
- 18 minor and two major city symbols. Their names are not in the definitive SVG; existing historic names must not be assumed source-certified.
- Ten minor and four major river paths; seven coast paths; 24 railway paths; nine deployments; two reinforcement outline paths; empty source lake and fortification layers.
- Every source vector geometry, style and transform is converted into `maps/odessa-extension.json -> authoritativeCompositeSvg.layers` with its source SVG provenance. The actual game renderer (`core/terrain_tiles.js`) composes these explicit vector layers and draws 230 hex number labels from the calibrated engine grid. The old repeated `0101` source placeholders are ignored.
- Water path geometry also produces 105 minor river, 25 major river, and 32 coastline *candidate* hexsides (21 source water paths, none unmatched), saved in `authoritativeWaterEdgeCandidates`. These candidates are NOT rules-certified movement/combat edges.
- Standalone Kiev remains on the original v288 `maps/kiev.json`: composite-only semantics are stored under `authoritativeCellOverrides` and applied only by `maps/composer.js`.

## Unresolved interpretation (do not invent)

- The 20 source city-symbol hexes have no separately stated underlying open/forest/swamp terrain in the SVG. Their map terrain is `null` until authored ground type is supplied; visual city symbols are intact.
- A shoreline path is not a closed sea region. The source coast is rendered exactly; no inferred partial-hex sea interior or arbitrary filled ocean is invented.
- The user's SVG contains no city-name labels, and its source hex number elements are placeholders. We do not invent names or transcribe repeated numbers.
- The source SVG's lakes and fortifications layers are empty. The 9 deployment symbols do not by themselves encode faction ownership.
- Previously registered river/rail and entry-edge game *rules* are not retroactively certified by visual similarity; source candidates are retained for subsequent review.

## Validation

`node tests/authoritative-kiev-odessa-v289.test.js` passes. `node tests/official-counters.test.js` passes. The legacy v278 water-z validator is inapplicable to the source SVG layer renderer and does not pass for the new composite. Maps export using `node scripts/export-campaign-maps.js exports --png --width=1800` and pass shared map validation for all five maps. Older v286–v288 fixture tests that hard-code superseded Odessa hexes/terrain/coastline source inevitably fail and should not be mistaken for v289 regression failures.

## Reproducible import

1. Put the original user SVG at `/mnt/data/kiev-odessa-main.svg` or set `AUTHORITATIVE_SVG`.
2. Run `python3 scripts/import-kiev-odessa-authoritative.py`.
3. Run `python3 scripts/register-authoritative-water.py`.
4. Run `python3 scripts/finalize-authoritative-composite.py`.
5. Run `node tests/authoritative-kiev-odessa-v289.test.js` and regenerate exports.

The v289 PNG is produced from the game engine SVG by Inkscape. It is not a generated image or browser screenshot.
