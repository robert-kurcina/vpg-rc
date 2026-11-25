# Checkpoint 239 / v473 — Kiev ground-only Air Corps through shared campaign transactions

## Source, scope and correction

The original `references/rules/kiev-rules.pdf` §10.5 permits the Axis attacker to commit **at most one** German Air Support marker to a battle after terrain effects, each counter once per turn. The photographed source counter sheets show the two `+1` markers **FK IV** (`kiev-front-r03c01`) and **FK V** (`kiev-front-r03c02`). Unlike Leningrad, Objective: Kiev has **no Fleet or air-to-sea target**. The v472 historical air subsystem nevertheless began every air-enabled German combat phase in the generic `air-sea-open` state, requiring an irrelevant no-naval-action click before battles could be declared.

The shared `core/historical_air_support.js` now validates the optional configuration value `airSupport.navalAttackMode: "none"`; it rejects unknown values and a contradictory concurrently configured Fleet/port policy, and explicitly disallows naval strikes when this mode is selected. The **same** `core/historical_combat_phase.js` skips the irrelevant pre-battle naval window for that configuration, starting at `awaiting-declarations`. `maps/combat-configs/kiev.json` opts into this mode. No scenario-ID branch or separate Kiev engine was introduced. Leningrad and Arduous retain their existing air-window behavior, avoiding unreviewed changes to their established tests and browser flows.

## Actual shared-engine workflow acceptance

The test `tests/kiev-ground-air-campaign-v473.test.js` executes the real shared **campaign session** and **read-only legal-action catalog**, not merely low-level `Air.ground()` calls. With two source-photographed Kiev German counters and two original concealed Soviet Mechanized counters **synthetically placed on independently certified Leningrad hexsides**, it checks:

- The combat phase immediately offers declarations, not a naval strike/skip command; both battles must be declared before rolling.
- The catalogue offers `no air`, FK IV and FK V before the first die, with none chosen automatically.
- Once FK IV is consumed in the first genuine shared-CRT `DE` transaction, only FK V remains available on the second battle, and FK IV reuse is rejected.
- FK V supports the second battle; both markers appear once in the Turn-3 air-use ledger. A malformed die is rejected without modifying the pending commitment.
- Complete campaign journal save/restore and Undo preserve pre-die locks, source counters and the air-use register; combat can advance to the next normal movement phase.
- The Kiev live movement graph still throws its source-certification error and the required §10.8 Romanian-territory mask remains null. Test-only policy rebinding is **not** an approved Kiev campaign position, an authorization to play, or a source-certified territory boundary.

This test reuses the approved photographed German and Soviet faces, authoritative shared B4M CRT and certified hexside geometry. It does **not** modify or reinterpret the Leningrad historical scenario: its Kiev combat profile, Kiev pieces and synthetic positions are confined to the test process.

## Test results and unchanged baselines

`node tests/kiev-ground-air-campaign-v473.test.js --write-audit`: **52 assertions passed**. Audit: `rules/audit/kiev-ground-air-campaign-v473.json`.

Passed regressions: Kiev combat v472 (158), nationality retreat v471 (55), territory review v470 (54), original early-turn Kiev combat v442 (45), original-hex territory lineage v443 (100); shared air-sea v385 (163), combat session v386 (84), campaign action catalog v390 (109), campaign continuation v387 (110), post-casualty retreat v393 (155), buildup v388 (88); Arduous large-EX branch v467 (536); City dots v457 (5,376). Kiev deployment Chromium (40), territory workbench Chromium (34), and Arduous human-browser stage (35 decisions into Turn 2) also passed. No claim is made about the older Fleet catalogue long-running test.

`core/historical_engine_browser_bundle.js` rebuilt with the same 48 shared modules. All five approved historical map exports, original SVGs/PNG source maps, counter art, source rulebooks and the shared B4M CRT are unchanged.

## Remaining blockers and design tradeoff

This is a bounded integration improvement, not a claim that Kiev is playable. The full Romanian national boundary for §10.8 remains uncertified (the review initially had 154 unclassified hexes); Kiev's movement graph still cannot pass the production authorization gate; the seven-turn Kiev contested browser acceptance and the Kiev–Odessa expansion remain open.

An alternative would have been to skip the naval window globally whenever no Fleet is present. That would change Arduous and potentially Leningrad opening behavior far beyond the Kiev blocker and invalidate established transaction histories. The deliberate opt-in instead keeps the change narrow and reversible; global modernization of other game UX is deferred until gameplay completion. The `navalAttackMode` setting is a scenario-neutral rule switch, not Kiev-specific code.
