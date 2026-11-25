# Checkpoint 237 / v471 — Shared national stacking across combat retreats

## Source and identified defect

The original `references/rules/kiev-rules.pdf`, **printed page 3, §8.1**, states that Romanian and Hungarian units **may never stack together**. The archived rulebook is SHA-256 `d55e8f0e567d1f8c7907c4fc8368954ec0e5fa8d6fe9e8e71c61acf9bb3c3756`. Its scenario profile already lists `nationalStackExclusions: [["romanian", "hungarian"]]`. Ordinary movement and buildup had national-stack checks, but the shared safe-retreat preview, the source-forced-retreat enumerator (including ordered combinations), and both post-combat resolution paths lacked the same check. This made an unlawful mixed-nationality retreat appear legal when the target had capacity under the general two-counter stacking limit.

This was a **shared-engine implementation defect**, not an incomplete historical rule. It matters directly to Objective: Kiev and to any later scenario that configures the same exclusion. It does **not** require or justify bypassing Kiev's still-unapproved Romanian national-*territory* boundary, which is a separate §10.8 rule.

## Delivered

- The scenario-neutral `movement_rules.nationalStackLegal(profile, units)` checks configured prohibited nationality pairs, with the established Axis `unit.nationality || unit.owner` fallback and closed validation for malformed pairs. An unconfigured scenario does not acquire a new national ban.
- The original movement adjudicator and buildup `allowedNationalStack` now use that same predicate, avoiding divergent nationality comparisons.
- `historical_retreat_options` excludes mixed-nationality landing hexes in its **read-only safe choice** list and its joint defender combinations.
- `historical_forced_retreat` excludes them in first legal two-hex choices, outward extension destinations, joint survivor assignment, and order-dependent choices. The actual `apply()` requires a candidate produced by the corrected enumerator.
- The bounded fallback in `historical_combat_consequences` independently rejects a mixed-nationality surviving stack when the forced-retreat mode is not configured.
- The browser bundle is rebuilt directly from those same source modules, preserving **one shared gameplay implementation**. No map rendering, counter art, CRT, rules profile, source SVG, export, campaign authorization policy, or deployment state has changed.

## Verification and limits

`node tests/kiev-nationality-retreat-v471.test.js --write-audit` passes **55 assertions**, including same-nationality / Italian negative controls; permitted vs prohibited real source-board movement; buildup eligibility; safe-only and forced retreat alternatives; forged-route rejection; actual combat transactions with full original photographed counter pairs and source-certified Leningrad hexside geometry; legal DR resolution; failure atomicity; and Undo. These **combat positions and Romanian/Hungarian classifications are deliberately synthetic** and do not claim authentic Leningrad nationalities. Leningrad is used solely as an already-certified physical board; the Kiev graph itself remains blocked by the production source policy.

Additional source/cross-game checks passed: Kiev opening inventory **289**, Kiev source-legal opening **180**, Kiev §10.8 originating setup **100**, Kiev isolated first-turn combat **45**, Kiev territory review **57**, Arduous stacked EX/DRL oracle **93**, large EX fairness **536**, forced-retreat **298**, overstack extension **39**, joint-order **30**, joint-safety **35**, post-casualty **155**, safe-only retreat **516**, buildup **88**, and cross-game movement **28**. The existing actual Kiev setup-only browser ran **40 Chromium assertions** with the regenerated common engine bundle; an Arduous human-browser stage advanced **35 decisions** into Turn 2. One unrelated full Fleet consequence-catalogue run exceeded a bounded test invocation and is **not claimed as passing in this checkpoint**; earlier bounded Fleet tests remain separately documented.

No gameplay promotion is implied: the source-reviewed Kiev movement graph remains **provisional**, the complete national-*territory* mask needed for Turn 1 §10.8 is **uncertified** (154 cells initially unreviewed in the v470 diagnostic), and Kiev/combined Kiev–Odessa have **no authorized full campaigns**. This change closes only the §8.1 national-stacking loophole in shared retreat legality.

## Next

Continue Kiev historical campaign special-rule integration, including independent Romania-country boundary evidence for §10.8 and full seven-turn acceptance, without silently promoting the geography-only candidate or altering the original common B4M CRT. Then complete the Kiev–Odessa composite; keep optional B4M stacking and unified grand-campaign exploration deferred as previously ordered.
