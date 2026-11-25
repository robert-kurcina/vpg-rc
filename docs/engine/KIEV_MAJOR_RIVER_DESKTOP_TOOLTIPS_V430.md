# Checkpoint 196 / v430 — Kiev Major River rule support and desktop terrain tooltip

## Source

`references/rules/kiev-player-aid.webp`, Terrain Effects Chart, Major River row:
* crossing a Major River counts as one additional hex of movement, except at a railway hexside;
* an attacking unit crossing a Major River has its own attack strength halved, rounding **down for each unit**.

The ordinary River terrain chart separately specifies a -1 attack-odds column shift if *every* attacking unit crosses ordinary River hexsides. Major River does not imply this additional ordinary River shift. These are distinct effects.

## Source-configured shared engine

- `movement_rules.js` and `pathfinding.js` already add the profile's `majorRiverExtraCost` for `edge.majorRiver===true` unless the edge is a rail hexside; the Kiev profile sets the extra cost to `1`. Tests now explicitly cover rail exemption, legal/illegal movement allowance, and crossing costs.
- `historical_combat_odds.js` now supports optional source-configured `majorRiverAttackMultiplier: 0.5` and explicit attacker IDs with per-unit major-river crossing membership. Strength is rounded down per crossing attacker before aggregation, and outcomes still use the same shared B4M CRT. The new effect is rejected without an explicit policy and matching attacker IDs.
- `historical_combat_geography.js` now reports `majorRiver` separately from `river`, deriving the flags only from the source-certified executable edge graph. `historical_combat_phase.js` binds those flags to declared attacker IDs; callers cannot affect the map-bound result by supplying unsupported crossing flags.
- `source_reviewed_movement_graph.js` supports an optional separately verified `majorRiverEdges` field in source-pinned ledgers. Existing Arduous and Leningrad ledgers remain unchanged.
- `maps/combat-configs/kiev-major-river-effects-v430.json` documents Kiev's player-aid policy but does **not** authorize a playable Kiev graph by itself. Kiev stays **provisional / blocked** pending whole-map terrain and edge certification, initial deployment, campaign testing and separate source-policy promotion.

## Desktop terrain tooltip

A shared `core/terrain_tooltips.js` module is included by the B4M native browser and the Arduous/Leningrad historical browser. It shows the hovered hex number, terrain or source-typed city, configured base MP cost, combat-column effects, and authored river/rail hexside references when present. A `Settings → Map display → Terrain and effects tooltips (desktop hover)` toggle defaults to ON, persists with display preferences and never enters saved game state. Hover requires a fine mouse-like pointer **and** a device without touch points; touch events and iPad-sized touch devices never activate the tooltip. The floating element is `pointer-events:none`, so it does not block map selections.

Tooltips describe configured *base* effects only: weather, route-specific legality, combat-phase restrictions, units' nationalities, and stacking may further alter a specific action. This is a reference aid, not an alternative adjudicator.

## Validation and limitations

- Direct Node tests: `tests/kiev-major-river-shared-v430.test.js` (18 assertions), `tests/desktop-terrain-effects-v430.test.js` (14 assertions). Existing combat, movement, source policy, and display suites tested separately.
- Exact historical shared browser bundle regenerated from source with `scripts/build-historical-browser-bundle.py`.
- Actual Chromium renders captured for Arduous and Leningrad showing source-derived tooltip over the same approved map. Settings and touch-pointer branches were exercised in Chromium before a broader browser batch exceeded its execution window.
- Full B4M Chromium hover suite **not completed** because its browser load in the batch exceeded the execution window. B4M integration is source-wired and syntax-checked; no full-browser acceptance claimed for this version.
- No Kiev seven-turn campaign, no Kiev combat-graph activation, and no physical iPad Safari test is claimed.

## Source preservation

No modifications to official counter artwork, map source JSON/SVG, approved five map exports, or shared B4M CRT. This checkpoint modifies shared combat source, the verified-edge adapter schema, browser presentation/settings and tests. No scenario-ID switch or separate renderer was added.
