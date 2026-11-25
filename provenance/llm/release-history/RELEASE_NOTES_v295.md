# v295 — City ground, city borders, terrain painter order, forest shadow

- Uses the existing `HexTerrainTiles.svgMap()` renderer. No image generator or replacement engine.
- Kiev–Odessa city-hex borders are yellow, stroke width 11.6 px (previously 5.8 px); polygon enlarged to place the inner edge at approximately the game-grid boundary. The border is a separate layer beneath rivers, railway and city symbols and above terrain.
- Kiev (1404) and Odessa (1513) visually overlay their Open ground texture with opaque #ccc polygons. Gameplay terrain classification remains unchanged.
- Kiev–Odessa terrain passes now paint Open/other, then Swamp, then forest. Forest uses original bitmap art in its own layer.
- A separate 25%-opacity shadow layer is below Forest, above Swamp; 20 px upward and leftward offset; 10 px perimeter stroke and Gaussian blur sigma=5 px.
- Other campaigns retain existing visuals and painter order (v294 regenerated SVGs byte-for-byte unchanged).
- Tests: `node tests/city-forest-layer-v295.test.js`, plus deployment alpha v294, rails/deployment v291 and official counters.
- All five map SVG/PNG exports generated through the shared JavaScript renderer and Inkscape, with zero validation errors. River gameplay semantics remain provisional as in v294.
