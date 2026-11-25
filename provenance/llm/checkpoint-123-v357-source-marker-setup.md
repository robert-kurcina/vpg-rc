# Checkpoint 123 / v357: Shared historical setup, no rendering changes

Source project: `hex_wargame_v356_CHECKPOINT_122_UNIVERSAL_RENDER_CONFIG.zip`.

Changes:
- Universal setup adjudicator `core/scenario_starting_setup.js` with typed
  marker-capacity, starting-group, source-face and nonadjacent-group checks.
- Leningrad's scenario-only data in `maps/setup/leningrad.json`.
- Registration of the Leningrad deployment domain in the shared scenario registry.
- Test-only explicit face/physical-cell fixture, positive and adversarial setup tests,
  and an executable source audit (`tools/audit-leningrad-source-setup-v357.js`).
- Protected map/terrain/renderer SVGs and all original source imagery unchanged.

Bounded proof:
- All 19 starting ground face IDs can be selected explicitly and assigned
  to the five approved German crosses, five Soviet frontline stars and
  five SVG-derived Soviet fixed unit markers, meeting stack and army-adjacency rules.
- `source-registered` marker SVG IDs correspond to actual source SVG element IDs;
  the source SVG has no printed hex-label text, so source-number association
  is not independently certified by the authored SVG geometry alone.
- The PDF `§6.0` printed identifiers `1305`, `1701` conflict with displayed
  numbers `1306`, `1702` at the existing mechanized symbols. Three other rear
  identifiers agree. No display offset, marker move or coordinate cutover was attempted.
- Counter choice fixture is test-only, not a claimed authentic historical
  formation-to-hex assignment; setup is NOT production activated.

Verification:
- New generic validator test, 72 assertions, passed.
- Existing v355 inventory/PDF audit, shared scenario registry, v356 universal render,
  v345 approved deployment, v350 river renderer, v352 approved PNG regression,
  v346 source grid footprint, v347-v354 projection/state/save/controller,
  movement/setup/reinforcement and five-game smoke tests passed.
- Freshly exported all ten PNG/SVG files, identical to the v356 archive exports.

Remaining: source numbering discrepancy and historical role-to-formation choices,
phase initial-state integration, combat transaction pipeline, entire Leningrad game,
and three other non-playable historical configurations. Canonical migration deferred.
