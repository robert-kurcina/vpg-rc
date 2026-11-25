# Shared weighted routing — Checkpoint 70

`core/pathfinding.js` supplies a deterministic, advisory Dijkstra search over
**already certified** `core/map_movement_graph.js` board edges. It does not
extract geometry, certify source data, or authorize a player action.

- `compile(board)`: reads `board.cells` and `board.edges` and indexes only
  `verified: true` edges; rejects duplicate, malformed and unknown endpoints.
- `search(graph, {origin,target?,maxCost?,edgeCost?,blocked?})`: one-source
  shortest paths, predecessor reconstruction, and movement-budget search.
  Ties have deterministic hex-ID ordering. Positive finite directed costs only.
- `terrainCost(profile, edgeStep)`: advisory costs using the same terrain,
  railway and explicitly typed major-river values as the movement profile.
- `core/movement_binding.js::routes(binding,origin,options)`: uses the exact
  source-certified movement graph and validated profile already consumed by
  `movement_binding.move()`.

**Separation of authority:** Routes can suggest a path but cannot prove it is
legal. The movement rule validator (`movement_rules.move`) remains the sole
validator for phase/actor, unit class, special movement, ZOCs, stacking,
occupied hexes and movement budget. An advisory shortest path may therefore
be rejected. No automatic legality promotion from SVG art or tentative rail
links is allowed.

**Scope:** Source-certified Leningrad map and synthetic weighted graphs pass
bounded tests; Arduous, Kiev and Odessa remain fail-closed. No all-pairs matrix,
cache, AI heuristic changes, historical game activation or browser cutover.
For a small number of objectives, one Dijkstra run per origin/profile is
preferable to rebuilding Floyd–Warshall matrices for each changing board state.

**Future:** expose rule-aware path-state exploration (e.g., EZOC-ending flags,
rail-only modes) through a shared state-transition cost evaluator, evaluate
strategic AI usage separately from gameplay authority, and cache only immutable
static distance fields where invalidation is explicit.
