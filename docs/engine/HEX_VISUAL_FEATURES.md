# Checkpoint 69 — canonical per-hex visual-feature view

`core/hex_visual_features.js` provides `normalize(map)`, `hex(view,id)`, `side(view,id,dir)`, `shared(view,id,dir)`.

Each hex has six sides in the existing renderer order `N NE SE S SW NW` (1..6). Each side includes the renderer-derived midpoint and endpoints; `railStubs` are visual center-to-midpoint connections (a source link generates two stubs, one on each hex). Coast, river, lake-edge and reinforcement marks are recorded as side `features` when already present in source registrations. An edge is stored once in `view.edges` with reciprocal per-hex access. Source SVG IDs and status are retained where present; absent source IDs remain null.

**This is a read-only normalization of existing registered map features, not a fresh extraction of every original SVG curve.** Long authored SVG water/rail/reinforcement geometry remains unchanged and should still be used for faithful visual curves. Some features (especially lake areas) are represented by terrain/water-body regions rather than side marks; converting *all* such boundaries requires a separate extraction and classification pass.

**Visual ≠ rules.** Every record reports `semantics: visual-only`. No rail stub, river/coast mark, or reinforcement line automatically grants movement, blocking, entry, or combat effects. Certified movement continues to be governed by `core/map_movement_graph.js`, `core/movement_binding.js`, `core/movement_rules.js` and scenario rule configurations. In particular, the Kiev–Odessa composite's definitive authoring path currently contains no registered hex-center rail links; source rail curves are preserved separately, not silently converted into links.

The normalizer does not replace the currently approved renderer and does not write back to map configs. Future rendering consumption must be explicitly compared against existing output. Source attributes that are provisional stay provisional.
