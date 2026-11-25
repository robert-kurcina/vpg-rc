# Checkpoint 295 / v529 — Kiev-to-Odessa inherited movement graph reconciliation

## Purpose and evidence hierarchy

The **original Kiev** game has an actual, source-reviewed, executable movement graph: 165 hexes, 442 physical hex connections, 93 railway edges, 72 River edges and 10 Major River edges. This graph is enabled for Kiev's **experimental gameplay**, but this does not certify every historical Kiev setup or AI strategy.

The combined **Kiev–Odessa** map's 261-hex topology is still a **candidate only**: 714 physical connections, of which 100 are excluded by Sea/Coast and 614 are potentially traversable. The composed board uses 117 SVG-route-traced rail connections. Neither the fact that Kiev is runnable nor physical adjacency on the appended board is proof that the *combined* route is certified for gameplay.

`core/composite_inherited_edge_reconciliation.js` independently rebuilds the executable original Kiev graph via `core/map_movement_graph.js` and the read-only appended source graph via `core/composite_land_movement_candidate.js`. Their source registrations, terrain, rail, River, Major River and Sea/Coast status are checked without registering any new game mode.

## Reconciliation results

| Partition | Physical | Traversable candidates | Rail links | River | Major River |
|---|---:|---:|---:|---:|---:|
| Original Kiev portion | 442 | 442 | 92 (original Kiev: 93) | 72 | 10 |
| Kiev–Odessa seam | 24 | 24 | 5 | 4 | 0 |
| Extension internal | 248 | 148 | 20 | 29 | 12 |
| **Combined** | **714** | **614** | **117** | **105** | **22** |

- 165/165 inherited Kiev hexes keep their terrain classification.
- 442/442 original Kiev physical connections remain present in the combined board.
- 441/442 original Kiev connections agree exactly on all four compared edge attributes (Rail, River, Major River, impassability).
- The **single source disagreement** is railway edge `1201:1202`: original Kiev's active source-reviewed graph says `rail=true`, while the combined route-traced ledger says `rail=false`.
- The 172 new traversable candidates are 24 seam edges and 148 extension-internal edges. They remain **unqualified** for gameplay. The 100 blocked edge candidates are all within the extension; the original Kiev and seam partitions have none.

No code chooses which of the conflicting rail claims is correct. The printed/source SVG record and its provenance must be reviewed. No map/counter/renderer/CRT/TEC changes were made.

## Historical versus current extension-json source revisions

The frozen v496 railway ledger correctly retains an older `maps/odessa-extension.json` SHA-256 (`553233dd...`), but that **is not the current file hash** (`7fe21e44...`). The underlying `maps/source/user-svg/kiev-odessa-main.svg` is unchanged (`2b15c3a9...`), and the live route tracer **recomputes the same 117-link list** against the current board. The v529 evidence file pins both archived and current revisions separately without rewriting the v496 ledger.

Older tests `odessa-reconciled-railway-v496.test.js` and `odessa-composite-candidate-v493.test.js` previously compared the historical v496 digest directly against the current extension file and consequently failed. Their SHA assertions now check both versions explicitly, while retaining all previous topology and behavior assertions. This is a correction to stale test assumptions, **not** a hidden map-source change or permission to change the rail routes.

## Validation and limits

The new module rejects source policy drift, map/terrain changes, changed SVG or active extension digest, changed rail tracing, altered disagreement entries, or a policy attempting to grant movement authorization. All 48 new checks pass; the two repaired older suites (3,248 and 2,233 checks), v497 1,785, v528 130, v527 389, v526 265, v521 4,814, setup and naval tests pass.

**Remaining for Kiev–Odessa:** resolve the `1201:1202` inherited rail discrepancy using actual authoritative source evidence, independently qualify the 172 newly traversable candidate edges and movement/country policy, resolve the setup marker discrepancies, then conduct real seven-turn human-browser acceptance. No live Kiev–Odessa action or city-isolation adjudication is enabled by this checkpoint.
