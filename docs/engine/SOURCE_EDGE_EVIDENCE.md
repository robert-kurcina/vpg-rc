# Historical SVG source-edge audit

Run from the project root:

```
node tools/audit-source-edges-v318.js --write
node tests/source-edge-trace-v318.test.js
```

The report `rules/audit/arduous-kiev-svg-edge-trace-v427.json` records original SVG hashes, candidate rail pairs, supporting SVG element IDs, grid adjacency and reciprocal hexside-feature diagnostics. The report is read-only and deterministic. Kiev source comparisons now use the definitive authored Kiev–Odessa SVG and 93 source-certified internal railway crossings, rather than the superseded Kiev temporary SVG; see `docs/engine/KIEV_RAIL_RECONCILIATION_V427.md`. This does not authorize Kiev movement.

**Evidence boundary:** an SVG ID match identifies a source path, not proof of the path's exact geography. A neighbor relationship from the shared grid establishes candidate topology, not legal railroad movement. Kiev's candidate `majorRiver` entries are not verified gameplay classifications. No existing map movement policy is promoted by this report. Do not change the approved SVGs or infer missing terrain from the absence of a forest/swamp marker.
