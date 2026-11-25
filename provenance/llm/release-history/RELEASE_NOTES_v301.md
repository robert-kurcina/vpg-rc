# v301 — Leningrad authoritative SVG geometry registration

Source: `maps/source/user-svg/leningrad-main.svg` (exact supplied file). The shared JavaScript engine still renders all maps. Only `maps/leningrad.json` is replaced.

- The SVG contains 200 hexgrid objects, including a duplicated grid object at 2008. The map therefore has 199 unique cells.
- The terrain layers register 88 Open symbols (87 unique), 44 Forest, 20 Swamp and 47 Sea positions. One of the Sea symbols overlaps the authored city of Liepaja (0208). The previously established universal **city terrain is Open** rule takes precedence there. Final: 89 Open, 44 Forest, 20 Swamp, 46 Sea.
- 13 minor city symbols and one in-grid major-city symbol are mapped to existing named city labels. A second authored major-city instance `use462` is 289 engine pixels from the nearest grid center; it remains in the import audit, not assigned to a guessed hex.
- 15 deployment markers imported from exact SVG uses and definitions. Source-authored factions and classes retained.
- 14 railway SVG polylines yield 80 adjacent-center connections and 10 exterior exits, rendered using universal center–face midpoint–center rails. No spline artwork is substituted or game-movement link asserted.
- 10 minor river paths, 1 coastline path and 4 lake paths preserved as source evidence and converted to corresponding visual hexsides (75 river, 12 coast, 10 lake candidate sides).
- Both reinforcement source paths converted into border-edge selections (9 German, 14 Soviet candidates). These render beneath terrain according to the universal boundary-layer rule.
- Sea renders as solid water-colored tiles, with no hex grid outlines or additional procedural Sea region polygons. Its visualization is independent from traversal rule adjudication.
- Geometry-derived water and rail sides **are not certified gameplay rules**. The map continues to be a visualization candidate pending movement/combat adjudication.
- Tests: `node tests/leningrad-svg-v301.test.js`, `node tests/official-counters.test.js`, `node tests/city-forest-layer-v295.test.js`.
- The four other map SVG exports match v300 byte-for-byte; their configurations were not edited.

`evidence-v301/import-audit.json` preserves the numeric registration audit and unmapped source element. No image generation was used.
