# The Arduous Beginning — checkpoint 185 / v419

## Authorized executable geography

The previously user-confirmed 45 blue river hexsides are now **authoritative
river crossings** for this scenario's shared movement and combat engine.
Incidental SVG contacts are **not** authored gameplay river edges, and no
rejected-contact ledger has been restored.

`core/source_reviewed_movement_graph.js` is a scenario-neutral adapter to the
shared grid adjacency function. Its authorization is entirely configuration
based: `maps/movement-configs/graph-sources.json` and the immutable,
source-pinned ledger at `maps/movement-configs/source-reviewed-edge-ledgers.json`.
Both the originating SVG digest and source geometry/cell/rail fingerprint are
checked. The output has 155 terrain-classified cells, 413 reciprocal edges,
85 rail links and exactly 45 river crossings. Kiev and Kiev–Odessa remain gated.

The hexside feature inspector and pathfinder use the same authorized graph;
no map or renderer implementation was duplicated.

## Rules and source-backed candidate opening

Added scenario-specific JSON policies for the existing shared combat and
buildup systems. The universal **Oberlabs B4M CRT** is unchanged. Arduous
adds a -1 shift for forest/swamp, -1 for an all-attackers river crossing,
-1 for Soviet use of an authored fortification (Brest), source-photo-backed
German +2/+1 air-shift markers, source turn replacements, and seven source
scheduled Soviet reinforcing counters including concealed Mechanized Corps.

The first-turn state contains 16 German and 14 Soviet ground counters,
including the fixed 3–4 Brest Garrison. The deterministic fixture is only one
valid candidate selection of the initial unit identities, **not** an
independently certified historical allocation. All ten concealed Mechanized
Corps can be mixed by the same deployment interaction used in Leningrad.

The German Infantry symbols at `0209` and `0211` are **visual overrides**
requested by the user. Their differences from source-validated Soviet
placements remain unresolved in actual setup rules.

## Executed qualification evidence

- Seven turns / seven housekeeping phases: **89 committed actions**, including
  all seven scheduled Soviet reinforcements, concealment preservation,
  mid-campaign and terminal save/restore; result **Soviet victory**.
- This was deliberately a **no-optional-movement/no-optional-combat** smoke
  test; it does **not** establish a fully contested or strategic campaign.
- Shared movement/geography: exact 45 river sides, 85 rail sides; nonadjacent
  movement denied; fixed Brest fortification, river and German air support
  all change odds through the common B4M CRT.
- Browser: the existing generic historical browser shell now accepts both
  Leningrad and Arduous configuration, inventory, candidate fixture and fixed
  source pieces. Chromium executes actual project JS with the unchanged map
  exports; Arduous tests cover 30 counters, deployment mixing, first human
  action, Undo, save/restore. Leningrad opening still loads with 19 counters.
- This test environment blocks HTTP and file navigation. The Chromium harness
  therefore injects the exact project JS, JSON and SVG into an in-memory
  document. The ordinary browser entry remains
  `games/arduous/native-preview/index.html` and can be served by `serve.py`.

See `rules/audit/arduous-seven-turn-smoke-v419.json`,
`rules/audit/arduous-browser-v419.json`,
`rules/audit/arduous-regression-v419.json`, and
`rules/audit/visual/arduous-shared-browser-v419.png`.

## Next qualification gates

1. Contested seven-turn qualification with human moves, actual combat, air
   allocations, retreats, reserves, replacement steps, and verified final
   victory outcomes—not only phase progression.
2. Source-backed reconciliation of the two German deployment presentation
   overrides against the printed Soviet starting setup.
3. Historic initial unit identity certification, separate from legality of
   a candidate placement.
4. Finish Kiev and Kiev–Odessa executable maps and game-phase policies.
