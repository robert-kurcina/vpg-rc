# Checkpoint 203 / v437 — Kiev §6 sample opening and §12 replacement exception

## Scope and source

This is an **offline, source-legal candidate opening** plus two scenario-neutral rules-engine fixes. It does not unlock Objective: Kiev, infer a compulsory historical deployment, or certify the 165-cell movement graph. Kiev–Odessa remains separately gated. Source of truth is `references/rules/kiev-rules.pdf`, **printed page 2 (§6.0)** and **printed page 6 (§12.0)**, the existing source-pinned photographed counter sheets, and the user-approved v436 Kiev map.

Kiev's §6 setup is not an exact face-to-hex manifest. The rules direct players to mix ten concealed Mechanized counters, place two fixed Armies and four fixed Mechanized Corps, then distribute four Armies and six Mechanized over ten Soviet stars. They distribute 14 Axis counters between seven Poland crosses (three double stacks) and four Romania crosses (four singles). Initial Axis Combat begins without Axis Buildup/Movement on turn 1. All actual choices of eligible unit identities remain the players' choices.

## Changes

1. `core/scenario_starting_setup.js` supports **configuration-defined nonadjacent group sets**, validating separation across groups as well as within groups. Kiev's `maps/setup/kiev.json` now checks the four front-line Soviet Armies and two fixed Soviet Armies in one set, matching the printed rule about Armies not occupying adjacent hexes on the same side. Existing single-group setup configuration for other games remains supported.
2. `tests/fixtures/kiev-source-opening-v437.js` allocates each of the **37 printed ground faces** once, produces one source-legal **30-unit** opening layout, and leaves six scheduled arrivals and a one-unit Soviet replacement reserve undeployed. This fixture is **test-only**, not a default historical assignment or production scenario start.
3. `tests/kiev-opening-layout-v437.test.js` validates the full opening through shared setup and source-initial-state assemblers, including source face pairing, side ownership, nationality, ten concealed Mechanized Corps, twenty-seven occupied hexes, three Polish double stacks, all 10 Soviet stars, front/rear Army separation, and first-phase cursor `german-combat`. A synthetic map/movement test proves the new cross-group check catches an adjacency the older single-group rule would miss. The shared opening bridge deliberately rejects attempts to execute Kiev combat because the game movement graph is not yet authorized.
4. `core/historical_buildup_phase.js` adds **source-verified, scenario-configured replacement exclusion** checked against each face's paired revealed side, not just the indistinguishable untried front. Kiev's specific rule is `maps/buildup-configs/kiev.json`: the 4th Soviet Mechanized Corps is `kiev-front-r04c02`, the printed reverse identifier is `4`, and after elimination it cannot be rebuilt (§12.0). The engine contains no Kiev/scenario-specific branch. `tests/kiev-fourth-mechanized-replacement-v437.test.js` verifies counter evidence and exercises the generic runtime on an **explicitly synthetic** policy on already-certified Leningrad geography: the excluded counter is refused and a different Mechanized Corps can still be rebuilt. This test does *not* assert a Leningrad historical rule.

## Verification and boundaries

- Standalone Kiev: 10 Soviet stars, 11 Axis crosses, 2 fixed Soviet Armies, 4 fixed Mechanized Corps. Source-legal sample: 14 Axis + 16 Soviet ground units, all ten Mechanized untried.
- Source face exception tied to the unambiguous back-side identifier, not a hypothetical untried-front identifier.
- The shared B4M CRT, existing art, game map SVG/PNG exports, source PDF, and approved renderer were not edited.
- Live `MapGraph.build(kiev)` and combat controller construction must still reject the *provisional* Kiev map policy. The sample is NOT seven-turn acceptance, starting setup UX, or historical identification certification.
- Rules for entry-border legality, all seven-turn combat/buildup interactions and the Kiev–Odessa seam remain separate work. The v436 Kiev map corrections are preserved.

## Suggested checks

```bash
node tests/kiev-opening-layout-v437.test.js
node tests/kiev-fourth-mechanized-replacement-v437.test.js
node tests/kiev-opening-preflight-v436.test.js
node tests/kiev-source-reviewed-candidate-v433.test.js
node tests/scenario-starting-setup-v357.test.js
node tests/historical-replacement-reserve-v434.test.js
```

The exhaustive long-running contested browser campaigns were not rerun for this focused rules change; do not count them as acceptance evidence here.
