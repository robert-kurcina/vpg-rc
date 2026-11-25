# Checkpoint 262 / v496 — Source-traced railway reconciliation and ordinary-ground shortcuts

## Decision and scope

User adjudication: the two physical neighbor connections `1106:1107` and `1106:1205` are **ordinary direct ground routes, not railway links**. Railway travel between those respective destinations follows the supplied SVG through `1206`. Neither adjacency is blocked merely for lacking track. In an otherwise unobstructed open-terrain position, one direct hex costs 1 MP; two consecutive railway hexes cost 2 MP. The common CRT has no bearing on choosing the route.

This checkpoint reconciles **derived railway hexside annotations in an isolated review copy**, without modifying the user's original SVG, either scenario's source map JSON, any rendered map, production graph authorization, historical rules, or counter artwork. Unlike an approximate line overlay, the reconciled side list is produced from the 24 already-registered author-traced rail paths (141 centered vertices and 15 recognized edge stubs).

## Implementation

- `maps/movement-configs/odessa-source-route-rail-ledger-v496.json`: deterministic ledger of all **117** adjacent source-traced rail connections, with SVG `path` IDs, source-file SHA-256 checksums, and the two explicitly nonrail annotations.
- `core/composite_rail_reconciliation.js`: validates the source path trace and old annotation discrepancies, clones the composed map, removes the **42** existing provisional rail-side pairs, and installs the **117** source-traced pairs reciprocally. Net effect: 77 new rail-side pairs, 40 retained, 2 corrected exclusions; all unrelated river, major-river, Coast and city annotations preserved. Its output is labeled `diagnostic-not-gameplay-authorized` and is **never passed to the production map binding**.
- `scripts/build-odessa-reconciled-rail-ledger-v496.js`: fail-closed generator; requires 117 traced source pairs, the two exact exclusions, and 77 previously unrepresented source pairs.
- `tools/odessa-movement-review/index.html`: actual-engine map review filters for all traced rails, 77 newly identified pairs, and the two ground shortcuts. Source routes and approved terrain graphics remain unchanged.

## Movement and safety tests

`tests/odessa-reconciled-railway-v496.test.js` runs **3,247 assertions**, including:

- All 714 physical neighbor pairs retain geometry and reciprocal side data.
- All 117 track connections agree with the pinned SVG source trace and have reciprocal rail-side annotations in the derived copy.
- No traced rail link crosses Sea or an authored Coast hexside; the full 100 Sea/Coast barriers remain impassable.
- Ordinary routing favors direct `1106 → 1107` or `1106 → 1205` (1 MP each); rail-only routing follows `1106 → 1206 → 1107` or `1106 → 1206 → 1205` (2 MP each).
- The shared movement rule adjudicator independently accepts the ordinary routes, rejects the nonexistent direct rail connection, and accepts the two-step rail detour in a synthetic, enemy-free Kiev-profile context. This is a **test-only** board, not an Odessa playable campaign.
- Missing, invented, or inconsistent source annotations are rejected. Production `map_movement_graph.build()` continues rejecting the original and reconciled composite configurations.

`tests/odessa-reconciled-rail-browser-v496.py` performs actual Chromium checks on the unchanged shared-engine Kiev–Odessa map export, showing the 77 new track pairs and the two direct ground shortcuts. The browser points are diagnostics, not synthetic screenshots or a parallel renderer.

## Remaining work

The source-traced rail ledger is now a complete **railway evidence candidate**, not a complete movement certificate. Additional requirements include reviewing the extension's terrain/river semantics, Odessa-specific Fleet/port/cavalry/turn/victory rules and source setup, and then full human campaign acceptance. No live Kiev–Odessa campaign is enabled by this change. The other four game interfaces and all five engine map exports remain unchanged.
