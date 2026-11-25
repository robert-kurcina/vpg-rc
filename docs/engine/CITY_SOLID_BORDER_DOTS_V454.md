# Checkpoint 220 / v454 — Black solid city border with half-density dots aligned on top

## User request and rendering decision

The v453 city highlight consisted of separate black dots on an inset city hexagon. The requested revision reduces their count by approximately one half, adds a separate thicker black city perimeter, and moves the dots onto **that same perimeter**.

- **Solid base:** black `#000000`, width **2.8** viewBox units, no dash array, round joins. The ordinary grid is thinner.
- **Dot overlay:** black `#000000`, round caps, diameter **6.0** viewBox units, short dashes `0.1 14.1` (period **14.2**, exactly twice the v453 `0.1 7` period **7.1**).
- **Alignment:** both strokes use **exactly the same six corner coordinates**, with the solid border emitted first and dots emitted on top, so this is **not** a second offset ring. The city hex remains at the accepted inset `.93` radii.
- **Contrast constraint:** because both elements are black, the dots must be larger than the 2.8-unit baseline to remain distinguishable. The 6.0-unit dots protrude from either side of the continuous border.
- **Configuration:** `core/presentation.js` exposes shared `cityBorderSolidWidth`, `cityBorderWidth`, and `cityBorderDotGap`, and `core/terrain_tiles.js` uses the common city border helper in both drawing paths. The shared historic browser bundle is rebuilt from source.
- **Optional art:** `supplied_assets/flat/city-hex-highlight.svg` matches the same two-polygon treatment. All five historical map profiles use the shared vector polygons (no per-scenario city art overrides).

## Validation and scope

- `node tests/city-double-border-v454.test.js`: **868 assertions**, 73 paired city border/dot polygons across all five actual-engine SVG exports, same cell ID and identical points, black colors, correct layer, solid base, round half-density dots.
- `python3 tests/city-solid-dots-raster-v454.py`: checks actual-engine Kiev PNG at Tarnopol 0706. Across 34 sampled pixels on the northern side, the central path is continuously black. At an offset outside the solid stroke, **two visible round-dot lobes** and two clear spaces remain.
- Historical city style regression tests v445–v453 updated to check accepted current behavior; prior visual data and tests are retained as history, not a separate renderer.
- All five 1800px SVG/PNG exports regenerated with the existing shared engine. Each export passes structural validation with **zero geometry errors**. Existing source warnings are unchanged.
- Comparison to the complete v453 package: all five SVG files are **byte-identical outside their `city-hex-highlights` layer** and all 73 city polygons retain the exact previous IDs and six points. **584 of 587** protected engine/maps/asset/rules/art files are byte-identical; the three intended protected changes are `core/terrain_tiles.js`, `core/presentation.js`, and the regenerated `core/historical_engine_browser_bundle.js`.
- A separate shared optional artwork SVG is updated. Map source geometry, terrain bitmap artwork, rivers, railways, supply, combat rules, scenario setup, and shared B4M CRT are unchanged.

## Screenshots

- Actual-engine Kiev crop: `rules/audit/visual/kiev-black-city-border-dots-v454.png`.
- Genuine rendered PNG before/after: `rules/audit/visual/kiev-city-borders-v453-v454-comparison.png`. The v453 left panel comes from the archived v453 engine export, not from a newly drawn approximation.

## Active gameplay and deferrals

Arduous German city capture → westward communication → captured-city replacement through player-facing controls is still WIP; this user-directed visual change did not implement or certify that task. Battle for Moscow optional two-unit stacking remains second-to-last priority. The unified campaign exploration remains absolute last.
