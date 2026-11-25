# Checkpoint 208 / v442 — Kiev Turn 1–2 combat rule candidates

## Source and authority

The actual supplied `references/rules/kiev-rules.pdf` (SHA-256 `d55e8f0e567d1f8c7907c4fc8368954ec0e5fa8d6fe9e8e71c61acf9bb3c3756`), printed page 5 §10.8 and printed pages 5–6 §10.9. `maps/combat-configs/kiev-turn-rules-v442.json` is an **independent source-verified fragment**, not a certified complete Kiev combat profile. The one exact B4M CRT remains shared across all five historical scenarios.

The relevant rules:

- §10.8: Axis units that **set up in Romania** (0709, 0809, 0910, 1010) may **not attack on Turn 1**. Because Kiev begins with German Combat before any German movement, source setup positions and current positions coincide in that phase.
- §10.8 also restricts **Soviet attacks on Axis units in Romanian territory** during the first Soviet Combat phase to Soviet units **originally set up** at 0708, 0808 or 1110. That second restriction is **not implemented yet**, because its source-grounded territory mask and immutable initial-hex lineage are not yet available. In particular, the four Romanian starting crosses are not the complete geographic definition of Romania.
- §10.9: Soviet Mechanized Corps attacking in Soviet Combat on **Turn 1** receive double attack strength; on **Turn 2** receive +50%. No bonus applies to defenses, other classes, other sides, or later turns.

## Implementation

- `core/historical_combat_declarations.js` accepts an optional source policy `firstTurnCombatRestriction` and blocks designated setup-origin attackers on Turn 1 **only if** the phase schedule begins with an unmoved friendly Combat phase. This is a configuration-driven check, not a scenario-ID branch. `core/historical_combat_phase.js` now forwards the policy into the shared declaration engine.
- `core/historical_combat_odds.js` accepts the generic optional `attackerTurnMultipliers` in the scenario modifiers. Missing or invalid `actor`/`turn` fails closed when a turn bonus is configured. It applies the factor to source-identified attack strengths before configured Major River per-attacker halving and other target-hex effects. Potential fractional outcomes follow the existing odds computation; no independent rounding rule has been invented.
- Both `core/historical_combat_phase.js` preview and `core/historical_combat_consequences.js` real counter-face resolution supply the authoritative owner and turn. Consequence resolution now passes per-attacker certified Major River crossing IDs into `HistoricalCombatOdds.evaluate()`, correcting a preview/commit argument mismatch that would otherwise matter to Kiev once its graph is admitted.
- `core/historical_engine_browser_bundle.js` is regenerated from the same common source files. No alternate browser combat engine was introduced.

## Verified behavior and limitations

`tests/kiev-first-turn-combat-v442.test.js` checks **45 assertions**, including turn-specific multipliers, counter/class filtering, precombat source restrictions, policy rejection, frozen source PDF identity, the closed Kiev graph gate, and full preview/resolution parity using **actual photographed Leningrad counters on already-certified Leningrad geometry with a synthetic temporary policy**. The synthetic checks exercise the implementation without claiming any new Leningrad or Kiev historical rule authorization.

Supporting suites still pass: shared odds, source-declaration, combat consequence, replay, multi-battle, Kiev opening and 2,949 geometry assertions, plus v441 terrain preservation. All five maps' approved SVG/PNG exports and source assets are unchanged.

**Not proved:** a live Kiev turn, full §10.8 Soviet Romanian-border eligibility, a complete Kiev combat configuration, a seven-turn campaign, or the Kiev–Odessa seam. The live `map_movement_graph` Kiev status is still provisional; the tests do **not** inject a fake verified map policy or replace the actual renderer. The next necessary step is permanent source-verified original deployment data and geographic Romanian-region classification before completing §10.8 and lifting the campaign gate.
