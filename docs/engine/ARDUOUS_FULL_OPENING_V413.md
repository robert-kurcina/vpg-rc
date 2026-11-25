# Checkpoint 179 / v413 — The Arduous Beginning source-backed starting deployment

## Source and results

The rules PDF **The Arduous Beginning, v1.0**, printed page 2 §6.0, states:
- Three Soviet Infantry Armies and four concealed Mechanized Corps are assigned to seven **starred** frontline hexes, exactly one counter per star; the placed frontline Armies must not be adjacent.
- Three fixed Soviet Infantry Armies and three fixed Soviet Mechanized Corps begin at the named rear locations: Minsk (one of each), Baranovichi (one Mechanized), Velikie Luki (one Army), Gomel (one of each).
- The separately printed **3–4 Soviet Brest Garrison** begins at Brest-Litovsk. It is a one-step counter whose playable face is the reverse of its location-marker face.
- Germany places **two full-strength units on each black cross**, with eight crosses in the supplied map: 16 ground units total (five Panzer Corps and eleven Infantry Corps). Germany opens Turn 1 in the **Combat Phase**, not the Build-up or normal Movement Phase.
- The source sheet contains 40 counters: 16 German ground, 10 Soviet Infantry Armies, 10 Soviet concealed Mechanized Corps, two German Air Support markers, one Turn marker, and one Brest location marker / Garrison.
- Page 6 §11.0: Soviet reinforcements are Turn 1 (two Infantry Armies and two Mechanized Corps), Turn 2 (one of each), Turn 3 (one Infantry Army), for seven reserve ground counters. No additional German ground counters are held for later turns.

**Candidate opening roster:** 16 German and 14 Soviet starting pieces, including the fixed Garrison (30 total). There are 29 source front faces placed using the ordinary deployment mechanism plus the one source-backed reverse-only Garrison.

## Why the earlier SVG metadata cannot be used as the setup authority

The physical map has eight German crosses (not seven), seven Soviet stars and three authored fixed Infantry Army symbols. Its `fixedMechanized` metadata has three deficiencies relative to §6.0:
1. Brest (`0211`) is tagged `fixedMechanized`, but the rule specifies the 3–4 Garrison there.
2. Baranovichi (`0609`) has a named city marker but no `fixedMechanized` marker.
3. The authored fixed Mechanized glyphs at Minsk (`0907`) and Gomel (`1510`) have German faction metadata, although the rules explicitly place Soviet Mechanized Corps there.

The new **generic** `scenario_starting_setup` support for `cityAnchors` binds a source-configured marker slot to a *verified city label and cell ID* when the rulebook is more precise than contradictory graphics metadata. This check does not alter the map, the renderer, or the source SVG. It rejects renamed or missing city labels and does not accept an arbitrary unregistered hex. For this scenario the three fixed Mechanized anchors are Minsk `0907`, Baranovichi `0609`, Gomel `1510`. Three fixed Infantry positions still use their original authored SVG markers.

## Integration

- `maps/setup/arduous-inventory.json` — printed counter classes, forty-face inventory, 36 ordinary ground faces, groups, the seven reserve units and §11 reinforcement schedule.
- `core/historical_source_face_inventory.js` — **scenario-neutral** source-face classification and strict all-ground-counter allocation, with duplicate-face and mirror-face checks.
- `maps/setup/arduous.json` — map slot counts, 29 initial selectable counter placements, source-backed named cities, Soviet Army non-adjacency, and mixing all ten concealed Soviet Mechanized Corps (including the seven starting and three reserve counters).
- `core/scenario_starting_setup.js` — generic named-city anchor resolution, without scenario ID branches.
- `core/historical_deployment_session.js` — preserves fixed pieces in the deployment preview; source-counter swapping, pool exchanges, mixed-identity permutations, save/restore. Existing Leningrad deployment flows are unchanged. Its permutation path supports inventory-declared **reserve groups** when included in the source policy.
- `core/scenario_opening_bridge.js` — optional `fixedPolicy` merges exceptional source pieces into a shared candidate opening. For Arduous the reverse-only Brest piece now survives handoff, rather than disappearing at the start of play.
- `core/historical_source_initial_state.js` — independent generic source-validated candidate opening assembler and cross-owner/stack/identity checks.
- `tests/arduous-full-source-opening-v413.test.js` — source roster, fixed-city binding, source faces, initial state, swap, concealed mixing, save/restore, source tampering rejections, first phase, and lack of movement permission.
- `rules/audit/arduous-opening-source-v413.json` — reproducible named-city and source-image hashes, counter inventory, setup counts and known SVG annotation conflicts.

## Evidence and limitations

The full candidate initial state and the shared pregame deployment session pass 49 targeted checks. The selected 45 historical/source/rendering regression suites pass, including Leningrad's existing setup and B4M campaign comparison. The Leningrad real Chromium click-to-swap test passes after rebuilding the shared browser bundle from its same source modules. The actual map SVG/PNG exports and shared B4M CRT are byte-identical to v412.

**Not claimed:** source-authoritative Arduous grid registration or river hexside combat attribution, verified movement graph, fully playable seven-turn campaign, strategic AI acceptance or an Arduous player-facing browser. The verified-first policy still rejects `MapMovementGraph.build(map)` with `source-geometry-not-gameplay-certified`.

## Next P0

1. Verify the 45 internal river-side candidates against the original five vector paths and scan. The Arduous rules say rivers modify combat **but not movement costs**; do not conflate those two systems.
2. Certify physical board adjacency and 85 source rail links against the authoritative SVG and scan, preserving the three explicitly removed visual rail links. Bind the resulting movement and combat-side policies without hardcoded scenario branches.
3. Execute the source-backed 30-unit opening in the shared browser, complete all seven turns with scripted legal human controls, and then test AI/human alternatives. Objective: Kiev and Kiev–Odessa follow.
