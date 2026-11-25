# The Arduous Beginning — contested seven-turn campaign acceptance (v422)

## Scope and result

A complete seven-turn Arduous candidate campaign was run against the actual **shared historical campaign session** from the 30-unit source-opening fixture. Unlike the earlier 89-action smoke test, it committed legal ground moves and ground battles, including outcomes requiring retreat, advance, replacements, and reinforcement placement.

The new repeatable regression is `tests/arduous-contested-seven-turn-v422.test.js`; its machine-readable result is `rules/audit/arduous-contested-seven-turn-v422.json`.

| Recorded metric | Result |
|---|---:|
| Completed turns / housekeeping | 7 |
| Committed engine actions | 184 |
| Resolved ground movements | 27 |
| Committed and resolved battles | 14 |
| Combat turns | 1, 2, 3, 4, 5, 6, 7 |
| Actual committed combat d6 values | 4, 1, 1, 6, 1, 4, 2 |
| Source reinforcements admitted | 7 |
| Replacement actions | 6 |
| Post-combat retreats | 3 |
| Post-combat advances | 3 |
| Air-support decisions | 7 |
| Terminal result | Soviet victory, 0 German-controlled victory cities |
| Turn-3 save/restore and terminal save/restore | Exact snapshot agreement |

The controlled opening uses the candidate `tests/fixtures/arduous-source-setup-v419.js` allocation. The deterministic selector's seed is `7`, and its reinforcement per-phase budget is `4`, sufficient to place all first-turn source-scheduled counters. The old selector budget of `3` yielded only six arrivals in the initial diagnostic campaign; the underlying engine did not reject a seventh reinforcement. This is a **test controller option**, not a change in historical reinforcement rules.

All gameplay actions were accepted by the original `core/historical_campaign_session.js` transaction API; the deterministic action catalog proposes actions, not an alternate adjudicator. The exact single shared B4M CRT applies to this game. Combat dice are selected deterministically from seed and committed state *before* post-roll choices are offered; there is no result-shopping or forced outcome. Automatic NE results consume no d6.

## Verified versus outstanding

- **Verified:** actual legal movement, combat declarations, battle resolutions, air marker commitments, retreats, advances, reinforcement placement, replacements, seven-turn terminal scoring, and save replay.
- **Not verified:** optimal or adversarial AI strategy; historically unique counter assignment (the starting allocation is still a candidate); human UI execution of every branch through seven turns; exhaustive branch coverage; completeness of original rules transcription beyond the observed situations.
- **Source-policy conflict still explicit:** German Infantry *presentation* markers at Arduous `0209` and `0211` are not changes to the published Soviet starting-force logic (including the Brest Garrison). This is not silently reconciled.
- **Deferred:** Oberlabs-oriented UX alignment, Kiev topology and gameplay, and the combined Kiev–Odessa campaign.

This pass changes test evidence, documentation, and packaging only. The shared CRT, map JSON/SVG/PNG, rules engine, UI, counter artwork, 45 accepted Arduous river sides, and Settings defaults are unchanged.
