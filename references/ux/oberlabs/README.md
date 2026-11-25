# Oberlabs UX screenshot review — Checkpoint 31

Seven supplied screenshots (4336×2624 each) were inspected and registered in `manifest.json`; reduced-size review copies are included. Original PNG SHA-256 hashes preserve provenance, while the full source archive remains the user's supplied `oberlabs-ux-set.zip`. The JPEG review copies are not authoritative visual assets.

## Observations from the screenshots

- Landing view: subdued game map, large Battle for Moscow title, a primary start/player-mode selection area.
- Tournament rules: a document-like reading surface with game-specific setup, play information, and reference text.
- In-game: hex map remains visible behind a phase/status panel and an overlay reference window.
- Reference window: header tabs `Sequence of Play`, `How To...`, `Terrain Effects Chart`, `Combat Results Table`, and `Close`. The first two contain text and diagrams; the latter two include tabular data.
- Terrain chart: terrain/feature glyphs, movement effect, combat effect, and notes; examples include forest, city, major city, fortification, river, railroad, setup location, and mud. Its entries and exceptions MUST be configuration-driven rather than cloned from Battle for Moscow.
- CRT: odds columns and six-sided die rows plus explanatory notes; common CRT output comes from the already-approved shared historical CRT, while modifiers and notes remain per game.

## Architectural decision

Reuse a single presentation shell and shared reference-window component for every Russian Campaign game. Drive titles, phase progression, contextual instructions, chart rows, combat modifiers, and optional tabs from the active game configuration. Do not force each historical game into Battle for Moscow's specific phase rules or map dimensions. The Kiev–Odessa view composes Kiev with the Odessa expansion instead of creating a separate Odessa game.

## Verification boundary

This checkpoint archives reference evidence, defines a machine-checked presentation contract and updates PLAN.md. No production UI, map renderer, or engine mechanics have been changed. Existing B4M UI remains the operational baseline. These screenshots alone do not establish runtime behavior or verify responsive/mobile layout.
