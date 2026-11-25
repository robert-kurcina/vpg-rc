# Checkpoint 200 / v434 — Objective: Kiev opening inventory and reinforcement preflight

**Scope:** source-checked, configuration-driven opening/arrival candidate and shared engine corrections. **Not a playable Kiev campaign.** The certified Arduous, Leningrad and B4M browser entries remain the only active historical games. Original game-map artwork, source rules, printed counter sheets, source city/river/rail data, shared B4M CRT, and renderer remain unchanged.

## Evidence (supplied files, SHA-256 checked by regression)

- `references/rules/kiev-rules.pdf`: §6.0 setup, §4.0 first-turn phase order, §8.1 nationality stacking, §9.4.1 Italian Motorized, §11.0 arrivals, §12.0 replacements. Exact source SHA is verified against `references/rules/SOURCE_INDEX.json`.
- `references/rules/kiev-player-aid.webp`: the seven-turn replacement-step track. Its source SHA is likewise verified.
- `assets/official-counters/source-sheets/counters-kiev-front.jpg` and `...-back.jpg`: all 40 printed counter pairs, hash pinned in `maps/counter-configs/kiev.json`.
- `maps/source/user-svg/kiev-odessa-main.svg`: source marker geometry, hash pinned by `maps/kiev.json.definitiveTerrainAudit.sourceSvgSha256`. A separate inherited bitmap-reviewed star at `0502` is not upgraded to source-vector authority.

## Source counter accounting

| Inventory | Count | Accounting |
|---|---:|---|
| German Panzer | 3 | On map, Poland |
| German Infantry (including one photographed mountain infantry) | 11 | 7 initial Poland, 3 initial Romania, 1 Turn-3 reinforcement |
| Romanian Army | 1 | On map, Romania |
| Hungarian Infantry | 1 | Turn 2 |
| Slovak Infantry | 1 | Turn 2 |
| Italian CSIR | 1 | Turn 3; **printed face is transcribed infantry, rule text explicitly calls it Motorized** |
| Soviet Infantry Armies | 9 | 4 initial front, 2 fixed rear, 2 reinforcements (Turns 5/6), 1 replacement-only reserve available from Turn 2 |
| Soviet concealed Mechanized Corps | 10 | 6 initial front, 4 fixed rear; do not pre-reveal |
| Air-support markers | 2 | Not ground counters |
| Game-turn marker | 1 | Not a ground counter |
| **Total** | **40** | **37 ground + 2 air support + 1 marker** |

The **30 starting ground** pieces are 14 Axis (3 Panzer, 10 German Infantry, 1 Romanian) and 16 Soviet (6 Armies, 10 Mechanized). The six scheduled ground arrivals plus the one Soviet replacement-only Army account for all remaining seven ground counters. Test-only source-face allocations are not production assignments of named units to positions.

## Map setup discrepancy — **blocking**

Rule §6.0(4) specifies **10** front-line Soviet red-star starting positions. Current `maps/kiev.json` contains **12** star markers: **11 with source SVG IDs** and **one additional bitmap-reviewed, no-SVG-ID marker at `0502` (Kovel)**. The historical scan and source vectors have not been reconciled to a ten-position authoritative subset. The shared validator reads the raw map markers and rejects the `maps/setup/kiev.json` candidate with `Marker count/uniqueness mismatch star`. That failure is intentional; neither the 12-marker map nor the ten-unit rule is silently rewritten.

Six fixed Soviet rear markers **do agree** with §6.0(3): two Infantry Armies at `0406`, `1007`, four Mechanized Corps at `0705`, `0803`, `1106`, `1309`. Seven Polish Axis crosses and four Romanian crosses agree in count with §6.0(7–8); the shared group-specific allowed-hex constraint prevents placing German Polish counters in Romanian-only slots or vice versa. The Polish ten counters must occupy seven cross hexes with three double stacks; the Romanian four must each occupy one Romanian cross. These candidate constraints do not fix a historical allocation of individual photographed face IDs.

## Turn and buildup semantics

- The first turn begins at **German Combat**, skipping the first German Buildup and Movement (§6.0(9)); existing `maps/phase-configs/kiev.json` already encodes this.
- The *published* reinforcement schedule is exactly: Turn 2 Slovak + Hungarian; Turn 3 one 6-4 German Infantry + Italian Motorized; Turn 5 Soviet Infantry Army; Turn 6 Soviet Infantry Army. The shared candidate policy has **six** distinct scheduled ground slots; unused arrivals are lost under §11.0.
- The Player Aid replacement step vectors for turns 1–7 are Axis `[0,0,0,1,1,1,1]` and Soviet `[0,2,2,3,3,4,4]`.
- Generic source nationality is preserved on arrival, independently of the controlling player: `hungarian`, `slovak`, `italian`, `romanian` remain distinct from `german`. The shared buildup placement checks `nationalStackExclusions`, including Kiev's prohibition of Romanian/Hungarian mixed stacks.
- Generic **replacement-only reserve** support accepts a specifically source-listed, previously undeployed counter no earlier than the configured first turn, admits it at its reduced strength for one step, records first admission once and blocks a second same-phase restore. This is not interchangeable with a scheduled reinforcement. An isolated synthetic fixture on the certified Leningrad game board exercises the actual transaction; it is **not** a Leningrad historical-rule claim.
- The photographed Italian face is classified as `infantry` by the visual transcription, while the rulebook assigns *motorized* gameplay status. This is represented as `printedKind: infantry` and `class: motorized` in the candidate reinforcement slot, without editing source art.

## Implementation and checks

- `maps/setup/kiev-inventory.json`: scenario-neutral source-face pool and allocation constraints, no production default unit assignment.
- `maps/setup/kiev.json`: **deliberately blocked** setup specification; exact source deployment markers, formation sizes, nation regions, and concealed group.
- `maps/buildup-configs/kiev.json`: seven-turn source track, six future arrivals, printed-nationality bindings, candidate boundary hexes, and reserve group. **The existing SVG entry-boundary registration is visual-source-guided, *not separately certified as rules movement entry*.**
- `core/historical_source_face_inventory.js`: generic alternative printed kinds, matching reversible source face type, and group-constrained strengths.
- `core/scenario_starting_setup.js`: generic source whitelist per deployment group plus verified multi-kind printed face matching.
- `core/historical_buildup_phase.js`: generic source-verified allied nationality, national-stacking exclusions, and source-only first-admission reserve rebuilding. No scenario-ID branches.
- `tests/kiev-opening-preflight-v434.test.js`: 289 assertions, pinned rules/SVG/counter sources, 40-unit accounting, marker discrepancies, group regions, nation-specific reinforcements, source track, and continued live-map rejection.
- `tests/historical-replacement-reserve-v434.test.js`: 17 separate source-engine reserve transaction assertions using an explicitly *synthetic* Leningrad-compatible configuration.
- `rules/audit/kiev-opening-preflight-v434.json`: machine-readable source SHA, unit, setup and track facts plus the remaining blocker list.

## Not yet certified or executable

1. **First and foremost, reconcile 10 published Soviet frontline slots with the 12 stored map markers** using the authoritative vector and printed map; do not infer which two markers to remove or ignore.
2. Explicit historical source-face allocation/setup; nationality and stack legality across the complete action cycle; actual first-turn combat from source setup.
3. The Kiev source-reviewed movement graph remains **diagnostic/provisional** (`maps/movement-configs/graph-sources.json`), and `MapGraph.build(kiev)` still rejects it. This checkpoint does not override the gate.
4. Entry-border paths are not separately rules-certified; test candidate border eligibility before promoting reinforcements.
5. Remaining special cases include the Soviet 4th Mechanized Corps replacement ban, full rules-accurate combat/buildup interactions, and a seven-turn human/browser acceptance trace.
6. The Kiev–Odessa map seam and expansion have their own source-rule and gameplay certification work; the 165-hex Kiev geography candidate does not certify them.

All five exported maps, printed counters, original source PDFs, terrain tile renderer, and CRT are untouched by this checkpoint. The shared historical browser bundle is rebuilt from the updated source modules.
