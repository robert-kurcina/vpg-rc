# Source-to-movement graph contract — v318 Checkpoint 58

The movement board is **derived from** the approved map configuration, not a second geographical data source. `WargameMapMovementGraph.build(map)` constructs an `M.move()`-compatible `{cells,edges}` object, preserving original source IDs and requiring source-registered hexside rail connections.

## Activation boundary

- Target: Leningrad (`leningrad.json`) uses authoritative user-SVG v301 terrain (`authoritative-user-svg-v301`), the source-grid-snap-v301 railway registration, and registered shoreline hexsides. It is eligible for a bounded real-map movement-graph test.
- The Arduous Beginning and Objective: Kiev still include provisional terrain and candidate hexside status. The adapter **rejects** their maps rather than treating approved visual rendering as certified movement-rule geography.
- The Odessa extension needs composition with Kiev and its own certified movement features; the stand-alone extension is not a runnable movement map.

These restrictions **do not** challenge the previously approved fidelity of rendered maps. They identify data evidence needed for legal-action adjudication. The generated adjacency is geometric, but rail and impassable shoreline semantics are imported from the map, not inferred from appearance or a secondary bitmap.

## Guardrails

- Retain the exact source cell IDs and source-coordinate neighbor routine from `core/terrain_tiles.js`.
- Terrain cannot be promoted to executable unless its source-status passes the scenario-specific gate.
- Railway connections must agree with reciprocal source-registered tile-edge annotations. Missing, nonadjacent or candidate railway edges fail closed.
- Sea or registered shoreline crossing is impassable. `core/movement_rules.js` remains the only shared movement-cost and ZOC adjudicator.
- Unknown historical scenarios and unsupported map revisions must not inherit Leningrad's verification policy.

## Scope limits

This is a **movement-legality adapter**, not scenario activation. It does not yet verify full route-finding, human UX integration, deployment and stacking at phase completion, supply, combat, rail allocation or victory. Preserve the original B4M engine and SVG renderers.

## Checkpoint 59 — explicit source authorization registry

The map-to-movement-graph builder no longer embeds Leningrad provenance labels as universal rules. `maps/movement-configs/graph-sources.json` contains a record per current map with a status (`verified` or `provisional`). Source authorization requires the exact map ID, game name, image SHA-256, geometry-calibration status, and per-feature provenance labels. Rail registration still requires reciprocal side annotations. No caller override is accepted; source-policy changes require an audited configuration edit.

The registry is loaded by CommonJS in the current tested runtime; a browser rollout must provide the registry through an explicitly tested loader instead of silently accepting unknown data. Source-image SHA-256 alone does not cryptographically certify the entire JSON map or every gameplay rule. A future source audit should add a digest for canonicalized gameplay bindings once the audit process is defined.

Arduous/Kiev remain `provisional`, and the Odessa extension is not an independent eligible map. See `tests/map-movement-graph-source-policy-v318.test.js` for acceptance and rejection checks.
