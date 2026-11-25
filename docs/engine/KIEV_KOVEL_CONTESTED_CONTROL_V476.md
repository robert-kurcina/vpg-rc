# Checkpoint 242 / v476 — Objective: Kiev, Kovel city capture and recapture

## Scope and finding

A **new, isolated 69-assertion Node regression** verifies that the original shared campaign, combat, forced-retreat, advance, and city-control systems can adjudicate **a real named victory city changing hands twice during Turn 1** on Kiev's source-reviewed 165-hex **candidate** map. Both battles use actual photographed Kiev counters in a permitted source-constrained *sample* starting arrangement. The source map, rules, historical CRT, approved renderer, generated exports, counter art, game engine, and production authorization registries are unchanged.

**This does not make Kiev playable.** The graph is still `provisional`, and the complete §10.8 Romania country mask is still absent. The test injects the already-pinned v435 graph into its own Node process and disables the missing-mask *requirement* only in a copied test combat profile. Both workarounds are automatically discarded; the production graph and combat-policy gate are tested before and after. Source approval for Romanian territory and live movement remains necessary. This test has no playable browser view, and no graphic or Web image is substituted for an engine render.

## Historical rules and source controls

- `references/rules/kiev-rules.pdf`, **printed page 2, §5.0:** a city is controlled by the last unit to pass through or occupy it. The German-controlled starting cities are Lublin and Iasi, **2 of 16**. The Axis requires all 16 for victory after Turn 7, 15 for a draw, and 14 or fewer means Soviet victory.
- Same PDF, **printed page 5, §§10.6–10.7:** the original printed combat outcomes and retreat/advance choices. The project's common **Oberlabs B4M CRT** remains in force for all five games by prior user decision; the test uses that CRT, *not* the separate printed Kiev CRT.
- Source-authored `maps/kiev.json`: Kovel is precisely **`0502`**. The registered candidate graph certifies the `0402`–`0502` side for the test, and contains 165 cells / 442 reciprocal physical edges. This is physical graph provenance, not live campaign approval.
- The initial counter faces and locations come from `tests/fixtures/kiev-source-opening-v437.js`: explicitly source-legal, **not a mandatory or exact historical opening**. The test records unchanged SHA-256 fingerprints of the source rulebook, definitive SVG, original map, graph authorization and combat configuration.

## Genuine shared-engine transactions

| Turn-1 stage | Action | Outcome and state |
|---|---|---|
| Start | Initial source fixture | Kovel `0502` Soviet; Axis city score **2/16** |
| German combat | Original German unit `kiev-front-r02c03` attacks the original Soviet counter `kiev-front-r05c02` at Kovel. The post-roll action catalogue supplies the **die 2 → EX** choice, with no German air-support marker. | The one-step Soviet defender is eliminated; the German attacker is reduced and may **choose** to advance. The engine accepts both advance and decline as distinct real actions. |
| German advance | The original German attacker elects to advance to Kovel. | The defender is absent, the reduced German counter occupies `0502`; on **finish-combat**, Kovel becomes German and the score rises to **3/16**. Declining advance instead leaves Kovel Soviet. |
| Soviet combat | Original Soviet unit `kiev-front-r03c05` attacks the reduced German at Kovel. The shared catalogue supplies the **die 1 → DR** outcome. | German unit retreats legally from `0502` through `0601` to `0701`, and the Soviet attacker advances into `0502`. At **finish-combat**, Kovel reverts to Soviet and Axis city score returns to **2/16**. |
| Housekeeping | Finish Soviet movement and Turn-1 housekeeping | The city control remains Soviet at the start of Turn 2; journal save/restore reconstructs the same state. |

**Negative and reversible branches:** A forged, nonadjacent two-hex German retreat is rejected without state mutation; the alternative German **decline-to-advance** leaves Kovel Soviet even though the Soviet defender is eliminated. Pre-roll and post-roll journal restores, exact Undo, and later turn-boundary save/restore are asserted. The user-driven battle and consequence declarations always go through the **original shared-engine transaction APIs**; there are no direct counter-position or city-control mutations in the test.

## Verification

- `node tests/kiev-kovel-contested-control-v476.test.js --write-audit` — **69 assertions, 14 real shared-campaign actions**.
- Previous Kiev seven-turn diagnostics **v474/v475**, shared CRT, historical action discovery, historical combat choices and buildup tests, source-reviewed graph test (**2,949 assertions**), Kiev combat, first-turn restrictions, nationality stacking, and additional source-related suites passed.
- Actual Kiev setup-only Chromium **40 checks** and territory-review Chromium **34 checks** passed; those UIs still explicitly reject live Kiev gameplay.
- The Arduous contested campaign printed a PASS result in its separate captured test log during the broad regression batch; the batch itself hit its execution deadline before reporting every exit status, so it is not used as a new full-suite acceptance claim.
- `python3 tools/check-package-layout-v417.py` passed.

Machine-readable result and the full **14-action** phase journal: `rules/audit/kiev-kovel-contested-control-v476.json`.

## Remaining playability blockers

1. Establish the **complete certified Romanian territory coverage** required by §10.8. The existing 4 Romanian and 7 Polish setup markers are *not* the whole country border; the other 154 cells of the v470 review tool remain unreviewed by default.
2. Explicitly review and authorize Kiev's source-candidate movement graph; it remains production-gated.
3. Run a **real Kiev browser seven-turn campaign** through the single shared engine after the required source authorizations, including human-controlled alternative action paths.
4. Complete and authorize the separately joined Kiev–Odessa geography and its campaign rules. The unrelated optional B4M two-unit stacking and grand-campaign integration remain last priorities.

This work extends gameplay branch coverage, **not the count of playable games**: Battle for Moscow, Arduous, and Leningrad remain the three playable browser configurations; Kiev remains setup-only; Kiev–Odessa remains unavailable.
