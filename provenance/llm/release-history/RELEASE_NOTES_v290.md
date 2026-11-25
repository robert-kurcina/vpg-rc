# v290 — Restore the shared engine for definitive Kiev–Odessa geometry

The authoritative `kiev-odessa-main.svg` is **configuration evidence**, not an alternate drawing pipeline. Removed `authoritativeSvgMap()` and the composite bypass. The original `svgMap()` now draws all 230 Kiev–Odessa hexes using existing pixel terrain tiles, cities, shared hex numbering, river/shore wavelets, spline railways, and universal reinforcement paths.

## Source geometry converted

- 230 legal cells, as identified from the user SVG hex grid. Every cell has a textured terrain classification.
- User clarification: 20 city-symbol cells are **Open** terrain, and terrain texture opacity is restored to 1 for all cells.
- 105 minor-river and 25 major-river unique physical hexsides, reciprocal when neighboring cells exist, from source SVG vector paths (path-to-side deviation <=4.5 px).
- 32 distinct coastline hexsides use `registeredShorelineLayer()`; **zero sea polygons**. No guessed sea regions, sea tiles, source water contours, or whole-sea clipping.
- 24 rail paths are parsed from the authoritative SVG and given to the existing cubic spline rail renderer. Old Kiev/extension rail source routes and network-snap hints are suppressed for this *composite only*.
- 82 external reinforcement boundary hexsides sourced from the two authoritative SVG outline paths (German west/northwest, Soviet east/northeast), rendered by the universal reinforcement system.
- Previously established settlement labels retained; city positions use the source-defined hex symbols and normal engine city artwork. The three formerly unlabeled southern symbols are assigned their prior historical labels: Balti (1016), Chisinau (1211), Nikolaev (1811). These associations can be reviewed if the SVG mapping differs from user intent.
- Prior faction setup/deployment markers retained in their configured hexes; movement/combat effects remain provisional pending full rules audit.

## Validation and provenance

`node tests/definitive-kiev-odessa-v290.test.js` passes and checks reciprocal river edges, source rail path count, city terrain, shoreline, reinforcement boundaries, no sea polygons, engine renderer reuse, and map validity.

`node tests/official-counters.test.js` passes. Independently regenerated v290 SVGs for Battle for Moscow, Arduous, Leningrad and Kiev standalone are byte-for-byte identical to the v289 exports.

`node scripts/export-campaign-maps.js exports --png --width=1800` regenerates the genuine shared-engine SVG and an Inkscape-rasterized PNG. No generative artwork is involved.

## Known limitations

The 4.5-pixel vector-to-hexside mapping is a visual registration tolerance, not a substitute for independently proving movement/combat rules. Three river sides terminate on the irregular map boundary; they remain in the source-matched configuration and are reported by the validator as off-board-boundary warnings. The user SVG contains no filled sea and none is rendered. The original v289 regression test expected zero coastal hexsides and is superseded by the v290 test.
