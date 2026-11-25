# v307 — Leningrad Coast geometry and printed hex coordinates

Authoritative source: `maps/source/user-svg/leningrad-main(2).svg` (SHA-256 ea1c83d00eea0212c530b98fd794125959175ad9d1cfa067aef78d6d73502447), cross-checked against `maps/source/leningrad-map-scan(2).jpg`.

## Corrections
- The source Coast is a continuous 53-segment polyline (`path482`). Render the exact points using the shared water route layer at 20 px stroke, without re-snapping or procedurally warping its centerline. Suppress the 47 provisional Coast-side wavelets in this map only; retain those 47 candidates separately for gameplay audits.
- In Leningrad, show the printed column number one less than the existing engine's internal column index: Liepāja `0208` internally displays `0108`, Pärnu `0804` displays `0704`, Tallinn `0901` displays `0801`. This is a presentation-only mapping and does not mutate cell IDs, railway graph, deployments, or movement adjacency.
- Suppress grid side drawing where the grid edge exactly coincides with one of the authored Coast segments. Preserve other grid edges and the Sea grid-edge suppression.
- Preserve four exact source Lake paths and ten River paths, the 197-cell source-derived footprint, Sea masking, and all other terrain/railway/deployment geometry.

## Validation
- `node tests/leningrad-coast-coordinates-v307.test.js` PASS.
- `node tests/official-counters.test.js` PASS.
- Exported all five maps through `scripts/export-campaign-maps.js`; map validation errors: 0.
- Other four maps' PNG/SVG exports match v306 byte-for-byte.

The underlying provisional terrain/map game logic still uses the pre-v307 internal cell IDs. A separate coordinated renumbering would be needed before using printed coordinates in gameplay queries or scenario rules; this release intentionally avoids changing gameplay topology.
