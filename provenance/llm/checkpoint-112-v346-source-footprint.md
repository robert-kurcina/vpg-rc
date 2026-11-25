# Checkpoint 112 / v346 — Source SVG footprint reconciliation

Source of truth for this checkpoint: `maps/source/user-svg/leningrad-main.svg`.
No raster scan was used to infer hex ownership. SVG path centers were calculated
from `sodipodi:cx/cy`, authored SVG `matrix(...)` transforms and containing
hexgrid layer `translate(...)`, converted from source millimeters at 96 dpi.
Inkscape `--query-all` supplied independent terrain-element bounding boxes.

200 paths are drawn in the source SVG's `hexgrid` layer. `path68` and `path172`
are exact overlapping duplicates, hence only 199 unique outlined positions.
The unique grid-only locations `path142` (position corresponding to legacy
internal `1801`) and `path144` (legacy internal `2001`) have no open, forest,
swamp or sea SVG geometry at their centers and appear as blank northern-edge
outlines over the source page background. All 197 runtime terrain cells match
197 distinct SVG outline centers to within 0.02 source export pixel units.

This resolves the 197/199 *source-grid outline versus runtime terrain footprint*
count discrepancy. It does not certify printed source IDs, change the physical
movement graph or authorize placing counters on unpainted outlines.

Baseline: the user's approved v345 LEFT deployment, rendered through the
universal engine. The Leningrad map JSON, common renderer and generated SVG/PNG
are byte-identical to the approved v345 files. Historical v301/v302 tests and
v341 rekey test received test-only updates; original tests are retained in
`provenance/llm/retired-tests/`.
