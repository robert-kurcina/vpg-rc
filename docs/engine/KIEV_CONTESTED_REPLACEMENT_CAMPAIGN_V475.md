# Checkpoint 241 / v475 — Kiev contested combat and replacements on original candidate map

## Result

An **isolated Node diagnostic** advances all **seven historical Objective: Kiev turns** over the **unchanged 165-hex Kiev source-reviewed candidate graph** through the original shared campaign, combat, legal-action discovery, movement, replacement, reinforcement, housekeeping, journal replay, and Undo modules. It records **146 committed actions**, including **27 genuine Kiev-map legal ground moves**, **3 independently resolved battles**, **3 replacement transactions**, **all 6 scheduled source-face ground reinforcement arrivals**, and **7 housekeeping completions**. The terminal adjudication for this deliberately limited activity is **Soviet victory; 2/16 Axis-controlled cities**. The new test passed **159 assertions**.

**This is NOT an authorized Kiev game, a browser campaign, a full historical setup allocation, or an AI-vs-human/AI-vs-AI acceptance test.** It is broader integration coverage of documented possible actions. It is not the same as v422 Arduous's many-engagement contested campaign or an independently certified Kiev seven-turn playthrough.

## Actual source-face transactions

| Turn | Actor | Original Kiev target | Mechanism | Verified result |
|---|---|---|---|---|
| 1 | German | `0205` | Two original German attackers, FK IV `kiev-front-r03c01`, committed die **3** | Shared B4M CRT **EX** reduces a photographed German Panzer Corps and the defending Soviet Army; mandatory Soviet two-hex retreat is selected through the actual validated post-roll catalogue |
| 1 | German | `0401` | Separate original German attacker, FK V `kiev-front-r03c02` | Below-minimum odds yield automatic **NE**, **no die**; both unique German air markers are used on different declared battles |
| 1 | Soviet | `0204` | Two photographed Soviet Mechanized Corps, source-validated post-movement declaration, committed die **6** | Shared CRT **AL** destroys the Soviet **18th Mechanized** (`kiev-front-r04c03`), while the attack remains a real failed Soviet counterattack |
| 2 | Soviet buildup | Original Soviet Army reduced at `0205`, then at `0405` | One source replacement step | On-board reduced **5th Soviet Army** restored to original full-strength face |
| 2 | Soviet buildup | Original **18th Mechanized** eliminated in the Turn 1 Soviet attack | Second source replacement step, safe sourced eastern entry hex `1601` selected by action catalogue | Off-map **18th Mechanized** rebuilt as **revealed-one-step**, with printed reverse face **2·1·6** and the unit's previous identity retained |
| 4 | German buildup | Original reduced German Panzer Corps at western setup hex | One German replacement step | On-board Panzer counter restored to original full-strength face |

No fake units, arbitrary combat losses, free counter flips, hand-authored retreat paths, or direct edits to session state were used to obtain these results. The combat choices were enumerated and transaction-validated by the original shared source-bound action catalogue; the actual shared engine committed each result. In each turn, later source-legal movement remains deliberately bounded to one adjacent step for selected original units: **not strategic play**.

Tests reject the source-forbidden Turn 1 Romanian-deployed German attack, an invalid d7 after FK IV commitment, a Turn 1 Soviet replacement request with no allowance, and an attempted Soviet overspend after its Turn 2 replacement steps have been consumed. The catalogue is confirmed read-only; a mid-game save/restore roundtrip preserves the newly rebuilt unit's revealed identity and full replacement ledger, and the final seven-turn journal, terminal state, Undo and final recommit are exact.

## Source and boundary constraints

- The original `references/rules/kiev-rules.pdf` (§§4, 6, 10, 12), user-supplied `maps/source/user-svg/kiev-odessa-main.svg`, original map JSON, and production `graph-sources.json` are fingerprint-pinned in the regression receipt.
- Source-verified candidate geometry remains **165 hexes, 442 physical edges, 93 rail sides, 72 river sides and 10 Major River sides**; it is not a production-authorized movement graph.
- `maps/movement-configs/graph-sources.json` still marks Kiev **`provisional`**. The test temporarily injects existing v435 graph evidence into an isolated **Node process's memory only**, reverts it before exit, and checks the original policy gate remains closed.
- `maps/combat-configs/kiev.json` still requires complete source-certified Romanian territory for Soviet first-turn attacks against Axis units in Romania (§10.8). It remains `null` and **fails closed**. The test explicitly copies that policy and disables the missing-mask requirement **in its own process only**; no nationality or territorial mask is fabricated or promoted to gameplay.
- The 30 deployed counters are selected from photographed original Kiev faces using the explicitly **source-legal but not mandatory historical** test fixture. The German starting Romanian restriction is still enforced. The initial Soviet concealed mechanized identity is revealed through actual combat and retained on replacement; the distinct **4th Soviet Mechanized Corps** remains excluded from replacement under the original source policy, covered independently by `tests/kiev-fourth-mechanized-replacement-v437.test.js`.
- The five approved source-geometry and engine-rendered map exports, source artwork, common B4M CRT, original game engine, live scenarios, and UI are **not changed**. No Web imagery, generated maps, or mockups are introduced.

**Consequences:** Objective: Kiev is still **setup-only** in the production browser. Kiev–Odessa remains **not playable**. This test does not resolve the full Romanian territory boundary, authorize the Kiev graph, certify the exact historical starting arrangement, or establish meaningful strategic AI. Both a genuinely authorized seven-turn human browser campaign and a full contested/alternative-branch acceptance remain outstanding.

## Regression record and reproduction

From the project root:

```bash
node tests/kiev-contested-replacement-campaign-v475.test.js --write-audit
node tests/kiev-seven-turn-diagnostic-v474.test.js
node tests/kiev-ground-air-campaign-v473.test.js
node tests/kiev-combat-policy-v472.test.js
node tests/kiev-nationality-retreat-v471.test.js
node tests/kiev-fourth-mechanized-replacement-v437.test.js
node tests/kiev-source-reviewed-candidate-v433.test.js
node tests/arduous-contested-seven-turn-v422.test.js
python3 tests/kiev-setup-page-browser-v469.py
python3 tests/kiev-territory-review-browser-v470.py
python3 tools/check-package-layout-v417.py
```

Additional executed passing regressions: historical buildup v388, combat decisions v392, action catalogue v390, path plans v391, bounded post-roll cursor v464, large-EX fairness v467, Kiev territory review v470, and universal B4M CRT v316. The longer action-catalogue invocation was not initially completed within its combined batch; it subsequently **reported PASS** in its captured output. This release does **not** claim an exhaustive Fleet catalogue, multi-branch Kiev browser campaign, or an unspecified full-suite pass.

Structured evidence: `rules/audit/kiev-contested-replacement-campaign-v475.json`. The unchanged v474 smoke regression remains included and runnable.

## Next work

1. Establish the **complete source-certifiable Romanian territory boundary** without guessing from four Romanian and seven Polish starting hexes. Keep draft reviews separate from historical country law.
2. Complete explicit review and authorization of the Kiev movement graph; until then all historical gameplay remains disabled.
3. After those blockers are resolved, enable **actual Kiev campaign browser** play through the single shared engine, then run seven-turn contested and alternative rules-branch acceptance.
4. Apply the completed Kiev game to the Kiev–Odessa expansion by configuration, not per-game engine forks. Grand-campaign integration and optional Battle for Moscow two-unit stacking are last priorities.
