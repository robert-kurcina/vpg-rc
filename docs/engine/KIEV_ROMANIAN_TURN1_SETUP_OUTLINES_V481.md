# Checkpoint 247 / v481 — Romanian setup hex outlines, source-limited visual convention

## User direction and evidence

The user requested restoring the **orange dashed hex outlines** around the Romanian hexes, after agreeing in checkpoint 246/v480 to use the four printed Romanian deployment cells as the **game-only Turn 1 combat target set**. This does *not* certify a historical political boundary beyond the four printed cells. The original visual evidence diagnostic in `docs/engine/KIEV_ROMANIA_TERRITORY_EVIDENCE_V444.md` used orange `#ed8d30`, `4.5` stroke width and `10 4` dash pattern. The current authoritative combat-policy list is `maps/combat-configs/kiev.json:firstTurnTerritorialRestriction.targetHexes`.

The restored individual hex outlines are `0709`, `0809`, `0910`, and `1010`. No Soviet blue dotted border is reintroduced. Orange contours mark the **user-approved setup/Turn-1 game rule** rather than a continuous national frontier. The overlays do not affect any game state or movement graph.

## Implementation

- `maps/registry.json` supplies the same four-cell `hexRegionOutlines` declaration for **Objective: Kiev** and **Kiev–Odessa**. The Kiev extension reuses the same source cells; the other three maps have no region highlights.
- `core/terrain_tiles.js:svgMap` renders a **generic, configurable** non-interactive `setup-region-outlines` SVG layer between hex grid and coordinate labels. The inset `.88` follows the exact prior v444 diagnostic, preserving per-hex separation; all source marks, cities, city dots and deployment icons remain visually separate and on higher layers. Invalid, duplicate or off-board target cells and malformed styles are rejected rather than silently drawn.
- `core/historical_engine_browser_bundle.js` is regenerated from authoritative sources. There is no separate Kiev renderer. `scripts/export-campaign-maps.js` updates the Kiev and Kiev–Odessa SVG/PNG assets with the same shared engine.
- The visual crop at `rules/audit/visual/kiev-romanian-setup-outlines-detail-v481.png` is taken solely from the actual `exports/kiev.png` engine output, magnified without synthesized artwork.
- Source maps (`maps/kiev.json`, `maps/odessa-extension.json`), original scans and SVGs, counters, CRT, and source rules are unchanged. Existing B4M, Arduous and Leningrad SVG exports retain their exact SHA-256 values from checkpoint 245. All non-target game PNGs are preserved byte-for-byte from v479 after verifying their corresponding generated SVGs were unchanged.

## Tests

- `node tests/kiev-romanian-setup-outlines-v481.test.js`: 69 assertions. Exact game policy/visual membership match, 4 per-hex dashed polygons in two engine exports, no overlay in three other maps, proper z-order, preserved city-dot identity, malformed configuration rejection, source fingerprints unchanged.
- `python3 tests/kiev-romanian-borders-browser-v481.py`: 59 Chromium checks using the **real shared browser renderer**, all five original board models and original tile bitmaps, including overlay visibility, 4 exact IDs, non-interactive layer, and preserved five-map functionality.
- `node tests/kiev-turn-one-romania-convention-v480.test.js`: 57 assertions of the source-scoped Turn-1 rule and unchanged production movement gate.
- `node tests/city-dots-only-v457.test.js`: 5,376 dot geometry assertions, no city border regression.
- Additional focused Kiev combat policy, source-candidate movement, Kovel transaction and rule-authorization tests are run before release.

## Current game status

**Kiev is not yet human-playable.** The §10.8 four-hex rule is now adjudicated, implemented and visually marked; the production Kiev graph is still provisional, and an actual seven-turn *human browser* run is not accepted. Kiev–Odessa remains a visual composite. Playable-game count remains **3/5**.
