# Checkpoint 289 / v523 — Kiev–Odessa inherited source-face roster binding

## Authority

The supplied `references/rules/odessa-rules.pdf` §6.0(3),(4),(7), read together with `references/rules/kiev-rules.pdf` §6, is authoritative for setup. The original counter-sheet JPEGs and `maps/counter-configs` determine printed source faces and back/front relationships. All source PDFs and four photographed counter sheets are SHA-256 checked by the diagnostic code.

This increment is **source-identity binding, not a complete Odessa campaign setup or gameplay activation**. The base Kiev `candidate.json` is only a test allocation: it is not an authoritative starting game.

## Implemented

`core/composite_setup_roster_binding.js` combines the existing original Kiev face inventory with the eight Odessa supplemental design records, retaining the project’s single shared source-inventory implementation. The new `maps/setup-configs/kiev-odessa-source-face-bindings-v523.json` makes these links declarative.

| Requirement | Result | Qualification |
|---|---|---|
| Inherited Romanian infantry | `Rom 3`, original Kiev face `kiev-front-r02c08`, reverse `kiev-back-r02c01` | Photographed source face; no new synthetic historical identity |
| German infantry initially in Romania | Three player-selected units from the 11 Kiev German infantry faces | Face IDs, original front/back pairs and counter affiliations verified; exact three printed identities not fixed by Odessa §6 |
| Additional Romanian ground units | Romanian Home Army, Romanian 4th Army, Romanian cavalry | Bound to Odessa supplement faces, preserving user-supplied sheet provenance |
| Total Romanian ground | 1 original + 3 supplement = 4 | Romanian Air is excluded, arriving on Turn 2 |
| Soviet rear `1309` | Explicitly authorized *setup position* by Odessa §6.0(3), corroborated by original Kiev map | Combined SVG still has no fixed Mechanized icon there |
| Combined extra `0706` marker | Reported as visual disagreement, not another authorized rear setup position | No marker deletion or relocation |
| Frontline red stars | 12 active combined marks versus 11 required occupied frontline hexes | Both user-approved `1111` and original `1113` remain; no source-preference guess |

The module validates an entire candidate Kiev face allocation using the already-tested `historical_source_face_inventory` grouping rules before identifying the Romanian/German source faces. It does **not** assign starting hexes, remove stars, infer Romania's full territory, allocate runtime game-unit IDs or enable Kiev–Odessa.

The test suite confirms that German printed identities remain player-selectable. In particular, a 6-4 German infantry counter ordinarily selected for Turn 3 can exchange groups with another eligible 6-4 face if the source rules do not mandate a particular printed designation; the original roster count and printed strength constraint still apply. No fixed source identity is inferred from the synthetic Kiev candidate fixture.

## Remaining gates

- Resolve the frontline 11-unit versus 12-star visual ledger without overwriting the explicitly approved `1111` marker.
- Decide whether to bring the combined SVG fixed-mechanized picture at `1309` into alignment with the rulebook, while preserving original source artwork/provenance.
- Verify enough Romania territorial hexes to present legal player choices; the four original orange Kiev *setup* hexes alone are not a certified whole-country boundary.
- Assign runtime IDs and build the complete player-selected 7-turn starting roster with the Fleet, Coastal Army, cavalry, air and reinforcement schedules.
- Certify combined movement/eastern-edge communication, then perform genuine human-browser full-campaign acceptance.

## Verification

The new adversarial source-face binding test passes 46 assertions. The pre-existing §6 setup preflight passes 49 assertions. Odessa roster, Romanian reconciliation, Black Sea Fleet/air, naval return, victory/isolation, Bessarabia annexation and source map graph tests also pass. The original five SVG/PNG map exports, the TEC, source rule PDFs, and original counter sheets are unchanged.
