# Universal counter-to-hex geometry — v420

The root defect was absolute counter sizing in separate browser views. Battle for Moscow used 46 map units for a 101.9-map-unit hex height. Arduous and Leningrad used 41 even though their hex heights were respectively 50.16 and 66.358. Those values produced inconsistent visual proportions (45%, 82%, 62%).

`WargameCounterVisuals.sizeForHexHeight(hexHeight)` defines **46/101.9 = 0.4514229637** as the universal relative square-counter width and height. `sizeForMap(sourceMap)` uses the map's authoritative `geometry.calibration.pitchY` where supplied, and safely recovers the vertical pitch from consecutive physical hex rows on older B4M map data. The native B4M preview measures the same height from the shared renderer's `ry` (flat-topped hex vertices at ±sin(60°) · ry); the map gallery uses its shared flat-topped hex geometry. Counter templates and faction palettes are not touched.

## Resulting physical sizes

| Game | Hex height | Counter width and height | Ratio |
|---|---:|---:|---:|
| Battle for Moscow | 101.900 | 46.000 | 45.14% |
| The Arduous Beginning | 50.160 | 22.643 | 45.14% |
| Target: Leningrad | 66.358 | 29.955 | 45.14% |
| Objective: Kiev | approx. 66.510 | approx. 30.021 | 45.14% |
| Kiev–Odessa | approx. 66.510 | approx. 30.021 | 45.14% |

Stack visual offsets are likewise counter-size proportional in the shared historical browser. Counter-pool icons are intentionally fixed at 50×50 and are not interpreted as map counters. This is a *presentation-only* change. No game, movement, combat, concealed-face, save format, map-export, source artwork, or CRT logic was changed.

## Evidence

- `node tests/universal-counter-geometry-v420.test.js`: verifies all five approved map SVG hex geometries and their ratios against source calibrations. Rejects invalid geometry.
- `python tests/universal-counter-render-v420.py`: runs real Chromium sessions with original engine JS and engine-rendered maps and official counters, checking B4M, Arduous, and Leningrad at 46, 22.65, and 29.95 units, respectively; screenshots under `rules/audit/visual/universal-counter-*-v420.png`. Because local HTTP is blocked, only the content transport is emulated using byte-identical source files.
- Existing Leningrad click/swap, Arduous browser smoke, shared CRT, and source graph regressions pass.

Historical differences in map dimensions remain source-authoritative. This correction does not imply equal screen pixel sizes, since zoom and viewport dimensions vary by user.
