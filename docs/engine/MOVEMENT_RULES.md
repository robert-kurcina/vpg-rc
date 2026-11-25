# Shared movement legality — v318 Checkpoint 56

`WargameMovementRules.move({profile,board,phase,units,turn}, {unitId,path,mode})` returns `{ok:true,cost,remaining,to,unitId}` or `{ok:false,reason}`.

- Source-backed Arduous movement values live in `maps/movement-configs/arduous.json`.
- Hexes require a known terrain category **and** `verified:true`. Neighbor connections require explicit edges with `verified:true`; rail discount requires `edge.rail:true`. This is a fail-closed contract, not automatic geography extraction.
- Unit `class`, `size`, movement points, actor and hex are scenario data, not inferred from art colors or printed counter numbers.
- The resolver validates a requested explicit path and the final stack. This initial slice does not enumerate all possible paths, enforce phase-end overstack removal, track prior moves across special/ordinary phases, validate victory/supply, or resolve combat.
- The legal-action example is in `tests/cross-game-movement-v318.test.js`, using `WargamePhaseActions.legal/execute` to ensure a rejected action cannot mutate the source state.
- Synthetic fixtures establish rule interpretation only. `maps/arduous.json` has untranscribed rail edges and provisional terrain fields; direct map execution is not enabled.
- Other historical games require their **own** verified movement profile and verified map binding. Never silently inherit Arduous defaults.
