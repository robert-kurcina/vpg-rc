# Checkpoint 138 — Forest shadow foreground rendering (v372)

## Request and resolution

User specifically requests Forest drop-shadow above **Lake, River, Major River, City, Coast and Fortification**. The Checkpoint 137 universal `core/terrain_tiles.js` drew its shadow before Forest tiles and before all those overlays, and its `dry-coast-mask` clipped shadows away from Sea and coastal water. Merely moving the shadow would darken the authentic forest terrain bitmap itself. 

**Implementation:** Same universal `HexTerrainTiles.svgMap`; move shadow draw group to after city markers, before deployment/modifier/label groups. A whole-board clip includes Sea/Coast/Lake; a masking knockout subtracts the original Forest/woods hex interiors so source bitmap art remains intact. Keep Gaussian blur, stroke, +10/+10 displacement and opacity unchanged. No rule change, map edits, per-scenario branch, or new rendering pipeline.

## Validation

- `tests/forest-shadow-foreground-v372.test.js`: five scenarios, SVG layer order; full cell footprint includes Sea; foreground has no dry-coast mask; forest-interior knockout; stable settings and untinted own-terrain interiors.
- `node scripts/export-campaign-maps.js`: actual universal SVG and Inkscape PNG pairs for five scenarios. `rules/audit/forest-shadow-foreground-v372.json`: SHA-256 before/after and per-map pixel deltas; Leningrad water-color overlap evidence.
- `python3 tests/leningrad-approved-visual-regression-v352.test.py`: fresh export matches **v372 candidate**, river wavelets remain ten, approved deployment icons remain 5+5. The originally approved v350 SVG/PNG values are retained unchanged.
- `python3 scripts/verify-native-browser-art-v372.py`: isolated Chromium loads all 40 authentic raster/vector source assets; the Chromium-produced base B4M SVG when exported to PNG pixel-matches the map engine/export PNG; corrupt/missing assets abort.
- `node tests/smoke-current.js`, `node scripts/verify-campaign-maps.js`, `node tests/shared-render-profiles-v356.test.js`, `node tests/hex-visual-features-v318.test.js`: pass.

## Boundary

The user requested the style change, not whole-map approval. Thus the v350 human-approved Leningrad arrangement remains an immutable historical record, while the new v372 full-image output is a fresh candidate pending visual signoff. Current browser test operates in an isolated Chromium DOM because unrestricted hosted navigation is blocked by sandbox policy; it does **not** certify full hosted gameplay. No image-generation tool was used.
