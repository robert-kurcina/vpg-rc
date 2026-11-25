# Checkpoint 207 / v441 — User-supplied seamless Swamp artwork and Kiev Forest 1111

## Source and diagnosis

The submitted `image(9).png` is the 1254 × 1254-pixel, fully opaque seamless grass/reed texture. Its bytes were copied without recoloring, rescaling, or alteration to `supplied_assets/flat/terrain-swamp-user-v441.png`. The earlier pond-and-reeds Swamp tile and the v439/v440 experimental alternatives remain available as source/history.

The user's 1111 screenshot also exposed a separate, **source-data presentation exception**: standalone Objective: Kiev `maps/kiev.json` defined hex `1111` as **Forest** but had `terrainTextureOpacityMultiplier: 0.52`, unlike its surrounding Forest cells. Kiev–Odessa already supplied `1.0` for the same cell. The v282 visual exception was removed from standalone Kiev and noted in its cell's `styleCorrectionV441` metadata. Forest terrain classification, counter placement, movement rules, and source SVG evidence remain unchanged.

The resulting 1111 Forest texture is rendered at opacity 1.00, with the same v439 Forest tile as adjacent Forest cells. Any remaining texture darkness is part of the shared Forest artwork, not an isolated cell treatment.

## Renderer behavior

`core/presentation.js` now points **Swamp** to the exact new user-supplied texture. Open and Forest continue to reference their existing v439 variants. A generic presentation option `seamlessTerrainTextureSizes: {swamp: 180}` requests a **world/map-anchored repeating SVG pattern**. `core/terrain_tiles.js` defines one `patternUnits="userSpaceOnUse"` pattern and paints each Swamp hex with an absolute-coordinate hex polygon in the same terrain layer, so the pattern phase does not restart at each hex. It is not stretched to each hex shape.

Other terrain tiles continue to use the pre-existing shared renderer and visual order. Swamp PNG display is an authored visual choice; the base terrain palette still records `#616f6fff` for rule-independent fallback fills, while the user-provided bitmap's own gray/green colors are shown unchanged. All imagery comes from the actual engine and the supplied file. No image-generation output is used.

The eight Odessa-extension Swamp cells `0918`, `1117`, `1215`, `1216`, `1316`, `1317`, `1412`, and `1913` previously disabled **all** bitmap texture through a `0` display multiplier. Their bitmap multiplier is now `1` so the replacement artwork appears in both Kiev and Kiev–Odessa. All other extension cells keep their earlier multipliers. The source SVGs and all game-rule data remain intact.

## Validation

- All five maps exported from the real shared engine with **zero map validation errors**. Battle for Moscow has no Swamp hexes; its PNG was byte-identical to v440, although its SVG definition changed to omit the unused Swamp sprite.
- `node tests/seamless-swamp-1111-v441.test.js`: active image identity, per-map embedded pattern usage, geometry and 1111 style invariants.
- `python3 tests/seamless-swamp-browser-v441.py`: real Chromium in-memory SVG draw and decoded submitted bitmap; the current Swamp pattern and Forest opacities were checked.
- Existing v439/v440 tests now verify their archived raster assets and the **current** presentation path instead of incorrectly demanding their superseded Swamp texture remain active.
- `node tests/kiev-source-reviewed-candidate-v433.test.js`: full candidate graph (2,949 assertions) still passes; Kiev gameplay gate remains unchanged.
- `rules/audit/swamp-v441-preservation.json` records source/regression integrity against the archived v440 checkpoint.

`rules/audit/visual/kiev-swamp-1111-v440-v441-comparison.png` joins **crops from real v440 and v441 exported engine PNGs**, not an invented or generated game-map depiction.

## Status

This is a user-requested **visual** revision. It does not independently authorize the gated Kiev or Kiev–Odessa campaigns, and the requested aesthetic remains available for user acceptance/revision.
