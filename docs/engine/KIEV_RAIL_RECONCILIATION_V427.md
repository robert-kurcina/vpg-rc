# Objective: Kiev — definitive railway geometry reconciliation (v427)

## Decision and source hierarchy

The currently approved Objective: Kiev map is rendered from 24 railway paths in `maps/source/user-svg/kiev-odessa-main.svg` (SHA-256 `2b15c3a92a282a7efc27d54bcd8994470f0fce8ee5417d5d734969fcd2c4ab7e`). These are the same routes supplied to the accepted renderer by `maps/odessa-extension.json`, with small per-junction display snaps in standalone Kiev. The **older** 36-path `kiev-map-temp(5).svg` is a real supplied source, but it is not the SVG whose railway geometry is used in the current approved visual export. The two SVGs disagree on nine internal rail sides; merging them would invent connections.

The new `tools/rebuild-kiev-rails-v427.py` verifies the exact definitive SVG bytes and every raw SVG path vertex after the pinned affine registration. It independently enumerates each finite geometric shared side (using the existing calibrated hex centers and grid neighbors), intersects each source route with those finite sides, rejects vertex-touch ambiguities, and derives a single `hexCenterRailConnections` table. The same connections generate both reciprocal `tileEdges` rail annotations; there are no hand-maintained rail-side records.

## Result

| Check | Value |
|---|---:|
| Kiev hexes | 165 |
| Adjacent internal hex pairs | 442 |
| Definitive SVG routes | 24 |
| Source crossing rail links | **93** |
| Reciprocal side annotations | **186** |
| Prior registry links | 97 |
| Prior links not supported by definitive routes | 5 |
| Definitive crossings missing from prior registry | 1 |
| Unpaired or orphaned rail sides | **0** |

Previously registered but absent from the definitive source graph: `0101–0102`, `0101–0201`, `0306–0406`, `0711–0810`, `1501–1601`.

New finite-source crossing added: `0501–0502`. The extended-line crossings at `1410–1511` and `1711–1810` are explicitly excluded because neither crosses a real rendered hexside.

The older temporary SVG yields 96 intersections with unbounded Voronoi sides, but only 79 intersections with the actual finite rendered sides. Its registration is not the source for the approved map. The intermediate 95-link definitive SVG result included two prolonged-boundary false positives; the corrected finite-side check excludes them.

## Preservation and negative checks

- The approved Kiev PNG is byte-identical after regeneration; the Kiev SVG changes only its rail-link-count metadata (`97` → `93`). All other four SVG/PNG exports remain unchanged.
- Source SVG files, shared renderer, one common B4M CRT, official counter artwork, and gameplay engine code are unchanged.
- The 165-hex physical grid, source-visible city labels, Coast and river artwork, and the combined Kiev–Odessa **visual** map remain unchanged.
- Tests reject changes to definitive source path vertices, mismatched display-route geometry, absent or nonreciprocal rail features, source hash mismatches and unauthorized Kiev movement-graph construction.
- `maps/movement-configs/graph-sources.json` is **unchanged**: Kiev terrain remains provisional in 113 hexes and river sides remain unapproved. `Graph.build(kiev)` must still refuse gameplay.
- The nine pre-existing Kiev exterior rail stubs are preserved as **uncertified metadata**; this rebuild certifies internal crossings only and does not classify external rail exits.
- Kiev–Odessa's composite map uses definitive authored visual routes but intentionally has no executable `hexCenterRailConnections`. Its movement graph requires separate certification, including extension seam links.

The earlier v426 preflight's 58 + 3 discrepancy is historical diagnostic evidence, not an open discrepancy or an instruction to remove those 61 links. The current working candidate graph is the 93-link reconstruction.

## Reproduce

```bash
python tools/rebuild-kiev-rails-v427.py
node tests/kiev-definitive-rail-v427.test.js
python tests/kiev-definitive-rail-v427.test.py
node scripts/export-campaign-maps.js
```

The comparison audit is `rules/audit/kiev-rail-reconstruction-v427.json`; the visual diagnostic overlays only the six changed hexsides on the real shared-engine export at `rules/audit/visual/kiev-rail-source-reconciliation-v427.png`.
