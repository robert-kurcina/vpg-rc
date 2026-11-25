# Checkpoint 260 / v494 — Source-authored Coast and Sea impassability

## Error corrected

Checkpoint 259 incorrectly described seven source-authored Coast hexsides between two land-classified hex centers as possible traversable connections. The previous diagnostic derived a `land-land` category from the **centers** of neighboring hexes and then inferred that coastline artwork might be decorative. That inference is false for this project.

The user's original `maps/source/user-svg/kiev-odessa-main.svg` explicitly identifies these coastline segments in the `coasts` layer. The `maps/odessa-extension.json` authored-shore records source-pin each to original SVG `path624` through `path629`, and tag them `kind: "coast"`.

**Ground movement cannot enter Sea and cannot cross any authored Coast hexside**, whether or not both neighboring hex centers are land-classified. This was already how `core/map_movement_graph.js` handles `authoredShoreHexsides` for generic executable movement graphs, independent of the source cell terrain values.

## Seven corrected source-tagged barriers

| Hexside | Original SVG path | Movement consequence |
| --- | --- | --- |
| `1315:1414` | `path624` | Impassable Coast |
| `1413:1513` | `path629` | Impassable Coast |
| `1513:1612` | `path628` | Impassable Coast |
| `1513:1514` | `path625` | Impassable Coast |
| `1712:1812` | `path626` | Impassable Coast |
| `1812:1813` | `path627` | Impassable Coast |
| `1812:1913` | `path627` | Impassable Coast |

## Read-only topology counts

- 261 map hexes; 714 geometric neighbor connections.
- 93 connections touch Sea and are impassable.
- 31 physical connections have an authored Coast barrier; the 32nd shoreline record is off the board.
- 24 Coast barriers overlap already impassable Sea-adjacent connections.
- **Seven** Coast barriers join land-classified hex centers; those are impassable too.
- Therefore **100 distinct geometric edges are impassable by Sea or Coast** (93 + 7).
- **614 remaining geometric edges** are *not excluded by these two barrier types*. They are NOT certified legal movement links and remain subject to all other map/game rules.

The source SVG, authoritative Coast annotations, original Odessa rules, five exports, shared CRT and executable movement kernel have not been modified. Kiev–Odessa gameplay remains unauthorized; this fixes the review interpretation and its regression guard. The read-only browser workbench now describes these seven as barriers rather than decorative visual candidates.
