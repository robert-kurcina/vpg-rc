# Checkpoint 248 / v482 — Kiev terrain chart and Romanian railway z-order

## Implemented

- Moved the shared, configuration-driven `setup-region-outlines` SVG layer **below the road and railway layers** and above underlying terrain/river/coast artwork. It remains pointer-inert and below the grid, coordinates, and counters. The same renderer controls both Kiev and Kiev–Odessa; no scenario-specific renderer was introduced.
- The existing four orange `#ed8d30`, 4.5-pixel, `10 4` dashed Romanian setup outlines remain at `0709`, `0809`, `0910`, `1010`. Their inset and membership remain unchanged.
- Added `tools/terrain-effects-chart/index.html` as a mobile-friendly Kiev Terrain Effects Chart, linked from Kiev's deployment browser, the map viewer when the Kiev or Kiev–Odessa map is selected, and the project home.
- Chart artwork consists of **ten image crops from the actual newly exported Kiev map PNG**, with a flat-top transparent hex mask applied to each sample. It uses the currently accepted open/forest/swamp art and live map features, not web images, a synthetic illustration, or symbols pasted over a chart.
- Nine rows follow the printed Kiev player aid (`references/rules/kiev-player-aid.webp`): Open, Forest, Swamp, City, Major City, River, Major River, Railway/Railroad, Star/Cross. The tenth row is Romanian setup hex; its user-approved Turn 1 combat interpretation comes from the printed Kiev rulebook §§6.0(7), 10.8 and checkpoint 246/v480. No Romanian national border is asserted.
- Chart art regeneration is included after normal full-PNG map exports (`scripts/export-campaign-maps.js` invoking `scripts/build-kiev-terrain-chart-art.py`). No chart artwork is independently drawn by a separate rendering engine.

## Romanian entry — source rule

**Underlying terrain/hexside still applies. No separate Romanian movement cost or odds-column adjustment.** In Turn 1, an Axis unit initially deployed in one of the four named Romanian hexes cannot attack. Only Soviet units **originally** deployed in `0708`, `0808`, or `1110` can attack Axis units occupying the four named Romanian hexes during Turn 1. The rule is tied to unit opening lineage rather than unit current location. The marker is game-only; it does not prove that these four cells exhaust the historical Romanian national boundary.

## Regression evidence

- `node tests/kiev-terrain-effects-chart-v482.test.js`: 135 assertions (chart rows, source sample types, image presence, authoritative Turn 1 IDs, terrain/hexside effects, z-order on both Kiev exports, no marker on other three maps).
- `python tests/kiev-terrain-effects-chart-browser-v482.py`: 19 Chromium checks including all ten actual engine PNG icons, desktop/mobile chart layouts, Romanian rule text, four orange SVG regions, and railway z-order.
- `node tests/kiev-romanian-setup-outlines-v481.test.js`: 73 assertions with the updated approved layering.
- `node tests/kiev-turn-one-romania-convention-v480.test.js`: 57 assertions; the historical combat code and rule policy are unchanged.
- `python tests/cleaned-map-browser-v479.py`: 46 checks across all five maps, rendered by the real shared SVG map engine in Chromium.

Browser evidence: `rules/audit/visual/kiev-terrain-effects-chart-browser-v482.png`. Engine export crop: `rules/audit/visual/kiev-romanian-railway-above-outline-v482.png`. Neither is an image-generation or web-search result.

## Unchanged / not claimed

- Map source geometry, combat rules, source counter images, original historical rules, City-dot art, and the common Oberlabs B4M CRT are unchanged.
- Battle for Moscow, Arduous, and Leningrad exported map files retain their exact checkpoint 247 bytes.
- Kiev's source-reviewed movement graph is still provisional and the gameplay authorization gate remains closed. Kiev–Odessa is not yet playable. Browser-playable games remain 3/5.
- The Kiev Terrain Effects Chart is the Kiev rule profile only. It is not silently applied to Battle for Moscow, Arduous, or Leningrad; the composite Kiev–Odessa inherits the Kiev base map visuals pending authorization of the expansion's rules.
