# Checkpoint 122 — Shared Rendering Profiles / v356

**Request:** One rendering engine for all five games; only configuration changes by scenario.

**Before:** `core/presentation.js` embedded per-game `MAPS`, `arduous`/`leningrad` adjustment branches, and `theme` logic. `core/terrain_tiles.js` embedded palettes keyed by scenario. `scripts/export-campaign-maps.js` and `maps/index.html` duplicated a Battle for Moscow render override. The old map verifier asserted obsolete reinforcement layer ordering and a retired Leningrad cell count.

**After:** `maps/registry.json` provides all five `renderOptions`, dimensions, per-game palettes and artwork references. Universal `core/presentation.js` reads the registry in Node and receives the same registry in the browser via `configureProfiles`. Both exporter and viewer use `P.options(...)` plus path-appropriate asset resolution and `HexTerrainTiles.svgMap(board, opts)`. The renderer retains only a generic fallback palette and has no scenario-name branching. Original scenario JSON and original source SVGs are unchanged.

**Strong tests:** `node tests/shared-render-profiles-v356.test.js` verifies all profiles, absence of scenario branches in the renderer and both consumers, ID independence, and a config-only color mutation changing SVG output. `python3 scripts/verify-shared-browser-render-v356.py` executes real Chromium JS for all five map selections with inline local source and registry (no HTTP server dependency): 147/155/197/165/261 cells, 10 smooth Leningrad rivers, zero JS errors. `node scripts/verify-campaign-maps.js` verifies existing exports, manifest hash, current layer order and the approved v350 Leningrad baseline; its obsolete predecessor was copied without edits under `provenance/llm/retired-tests/`.

**Output parity:** Regenerated five SVG+PNG pairs from modified code in a fresh directory. All ten files matched Checkpoint 121/v355 byte-for-byte; Leningrad matched the immutable v350 approved full-image SHA. Audit in `rules/audit/universal-render-profiles-v356.json`. All 25 checked original source files and map configuration JSON references remained byte-identical to v355.

**Limit:** This establishes **rendering** implementation convergence, not yet complete **gameplay** parity. The Oberlabs Battle for Moscow gameplay baseline remains operational; other games remain incomplete. The browser test runs real browser JS but inlines source and mocks file reads because headless HTTP requests are restricted by the execution environment, not because the application requires special mocking in normal use.

**Next development:** Historical Leningrad starting setup for all 19 initial counters using existing approved map and verified coordinate translation; avoid unnecessarily blocking full gameplay on speculative complete canonical-ID migration.
