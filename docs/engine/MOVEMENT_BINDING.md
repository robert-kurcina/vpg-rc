# Verified hexside-to-movement binding (Checkpoint 62)

`core/movement_binding.js` is an additive adapter shared by future historical scenario action handlers. `build(map, movementProfile)` reconstructs the authorized movement graph from the existing map configuration, inspects the same map with the shared hexside ledger, and rejects any mismatched adjacency, rail, river or impassability flags. It does not create new map geography.

Use `move(binding, phase, units, turn, request)` to invoke the existing universal `movement_rules.move()` against that verified board. A river designation does not imply a *major river*: the existing movement validator charges the major-river surcharge only for explicitly marked `majorRiver` edges. This adapter does not infer such a designation.

Currently only Target: Leningrad's bounded, source-registered map is accepted. The Arduous Beginning, Kiev, and Kiev–Odessa map inputs remain provisional for movement; `build()` fails rather than interpreting SVG polylines, coastline appearance, or adjacent geometry as permission. This is a legal-movement adapter, **not** scenario activation, unit roster placement, combat, or browser integration.

The authoritative source-policy registry is loaded through CommonJS by the existing graph builder. Browser packaging must ship the same policy data and enforce identical checks before browser-level game actions can use this adapter. The current B4M UI and all approved SVG renderers are unchanged.
