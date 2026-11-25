# Rule-aware legal-path search (v318 Checkpoint 71)

`WargameLegalPathfinding.search(ctx, {unitId, mode?, maxStates?, maxDepth?})`
uses the **same** `movement_rules.move()` legality decision as executed game movement.
It enumerates path prefixes on `pathfinding.compile()`'s verified adjacency graph;
only prefixes accepted by movement adjudication are returned or expanded. Enemy
ZOC stops further expansion, and positive movement costs cap exploration.
`WargameMovementBinding.legalRoutes(binding, phase, units, turn, unitId, options)`
provides the certified-map entry point. The static `routes()` API is unchanged.

Returns `reachable()`, `pathTo(hexId)`, `costTo(hexId)`, `withinBudget(mp)`,
`origin` and `expanded`. All paths are immutable copies in the result API;
search does not change authoritative game state.

This is **bounded** route enumeration, not a guarantee of complete path
coverage for all possible rules. It rejects provisional map graphs through
existing graph certification, and throws `search-limit-exceeded` if `maxStates`
would truncate the exploration. `maxDepth` restricts candidate path length.
The result for a destination is the lowest-cost validated candidate (with
deterministic lexical tie-breaks). It does not use an all-pairs matrix.

Known conservative limitation: a route requiring **transit through** a hex
whose *intermediate stop* is illegal due to stacking is pruned; rule-aware
pass-through permissions need an explicit movement-rules API before relaxing
this. Specialized weather, supply, and historical unit-class rules are not
claimed as implemented merely because this route enumerator exists.

No default browser or Solo AI cutover is enabled in this checkpoint.
