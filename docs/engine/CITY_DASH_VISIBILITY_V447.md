# Checkpoint 213 / v447 — Visible inset city dashes

## Root cause and correction

In v446, inset city hexagon borders used `stroke-dasharray="10 4"` with `stroke-width="4.5"` **and rounded line caps**. In SVG, round caps extend each dash by roughly half its stroke width at either end. The 4-unit designed gap was therefore covered by the two 2.25-unit extensions, leaving a nearly solid orange border.

Changed only city-boundary stroke caps to `stroke-linecap="butt"`. The ends no longer extend into the transparent gaps. This reproduces the line-cap treatment of the original temporary Romanian-territory diagnostic (`scripts/export-kiev-romania-diagnostic-v444.js`) while preserving the user's accepted v446 inset geometry.

**Retained:** orange `#ed8d30`, opacity `.95`, 4.5-unit width, dash pattern `10 4`, rounded polygon joins, and hex inset.

## Implementation

- `core/terrain_tiles.js`: city outlines in shared normal/inset/outside paths and provisional-city fallback now have flat butt caps.
- `core/historical_engine_browser_bundle.js`: deterministically regenerated from the same shared source with `scripts/build-historical-browser-bundle.py`.
- `supplied_assets/flat/city-hex-highlight.svg`: optional asset's caps made consistent, though v446 maps use the common polygon path.
- All five map SVG and PNG exports regenerated via `node scripts/export-campaign-maps.js exports --png --width=1800`.

No terrain, rail/river geometry, source map, city membership, counter, campaign state, or shared CRT changes.

## Validation

- `tests/city-dash-visibility-v447.test.js`: verifies every emitted city polygon has the exact orange, dash, width, opacity, and butt caps.
- `tests/city-dash-raster-v447.py`: samples an actual exported Kiev PNG city hex (`0706`) and observes alternating colored segments and clear gaps at pixel resolution.
- `tests/city-outline-inset-v446.test.js`: inset city border behavior retained.
- All five current SVG exports become **exactly byte-identical to v446** when only the city polygon's butt cap is normalized back to round; this demonstrates that the SVG map content and geometry did not otherwise change.
- Kiev source graph, opening preflight, and shared CRT regressions pass. See `rules/audit/city-dashes-v447.json`.

`rules/audit/visual/kiev-city-dashes-v446-v447-comparison.png` compares crops from the genuine v446 and v447 shared-engine PNG exports (not a generated or simulated map).
