# Universal Rendering Contract — Checkpoint 122 / v356

**One renderer, five data profiles.** All campaigns use `HexTerrainTiles.svgMap(board, options)` from `core/terrain_tiles.js` for map SVG generation. There are no per-game rendering algorithms. Scenario differences live in configuration rather than renderer branches.

## Source of configuration

- `maps/registry.json`: five render profiles in `renderOptions` (terrain `palette`, wavelet depth, river parameters, overlay art); dimensions and display labels.
- `maps/<scenario>.json`: cells, geometry, physical hexsides, historical source registration, coast/lake/rail/rivers and deployment data.
- `maps/odessa-extension.json`: expansion geometry composed onto Kiev by shared `maps/composer.js`.
- `core/presentation.js`: shared defaults and profile merge; loads the registry directly in Node, accepts the same registry through `configureProfiles(maps)` in the browser.
- `scripts/export-campaign-maps.js` and `maps/index.html`: same `HexTerrainTiles.svgMap` call; the differences are export-time embedded images versus browser-relative artwork URLs, plus interactive display toggles.

## Guardrails

1. Never add a `board.id === 'leningrad'` or other game-name branch to the shared renderer, presentation, exporter, or viewer.
2. River/Major River share color; Lake/Coast share color. All wavelets, terrain textures, outlines, markers and rail rendering are universal functions taking parameters/source geometry from configuration.
3. Historical SVG paths remain authored source evidence, not a replacement renderer. Rendering alone does not certify gameplay adjacency or rules.
4. Preserve the approved v345 deployment and v350 Leningrad smooth-river visual baseline. Never re-key or reposition cells to make a visual refactor work.
5. `node tests/shared-render-profiles-v356.test.js` tests profiles, absence of name branches and output independence from map name. `python3 scripts/verify-shared-browser-render-v356.py` checks all five maps in a real browser JS runtime. Export freshly and compare all ten hashes to the approved archives before declaring parity.
6. The current `scripts/verify-campaign-maps.js` checks layer #0 entry-edge stacking, live file hashes and data profiles; it preserves the historical v350 visual approval while comparing current exports to the separately hashed v373 shadow-free candidate. Forest/Woods must have no drop-shadow elements (`tests/forest-no-shadow-v373.test.js`). Superseded shadow-on tests are in `provenance/llm/retired-tests/`.
7. Shared **gameplay** parity is a separate release requirement: B4M remains the executable reference; four other historical scenarios are not yet certified executable. Do not claim playable-engine convergence merely because renderers are unified.
