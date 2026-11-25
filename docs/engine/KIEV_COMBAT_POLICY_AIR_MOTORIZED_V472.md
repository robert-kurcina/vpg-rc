# Checkpoint 238 / v472 — Kiev source-backed combat profile (not game activation)

## Purpose and authoritative sources

This checkpoint gathers **Objective: Kiev** combat rules into one candidate configuration, `maps/combat-configs/kiev.json`, without authorizing Kiev game play. Its basis is the archived printed `references/rules/kiev-rules.pdf` (§§8.1, 10.1–10.9, 11), `references/rules/kiev-player-aid.webp`, photographed original front/reverse sheets, the existing source-checked `maps/buildup-configs/kiev.json`, and the identical Oberlabs *Battle for Moscow* CRT chosen for **all five historical games**. The new test pins the primary-file SHA-256 identities and checks the candidate against the older source fragments.

The profile records forest, swamp and Major City defensive odds-column shifts; conditional ordinary-river crossing shift; individual Major River attacking-strength halving; swamp reductions for attacking Tank/Mechanized classes; Soviet Mechanized attacking multipliers on Turns 1 and 2; Axis Romania-set-up no-attack restriction on Turn 1; two-hex retreats; and one German air marker per attack subject to per-turn use. All are configuration, not scenario-ID branches. Original movement, buildup, retreat and combat rules are still evaluated by the **one shared engine**. No independent Kiev CRT has been introduced.

## Photographed-face and rulebook discrepancy: Italian CSIR

`kiev-front-r04c01` visibly bears an **Infantry** symbol and `Italy CSIR` identification with printed `4-4` (reverse `kiev-back-r04c08`, `2-4`). However §11 and the existing source-checked reinforcement schedule describe the Turn-3 CSIR as **Motorized Infantry**; the reinforcement slot is `t3-italian-motorized`. The generic source-face validator previously rejected a combat unit having `unit.class = motorized` but a photographed `infantry` glyph. A generic mapping of all Italian infantry or all infantry to motorized would be unsupported.

The profile now permits **only this exact photographed face**, printed identifier and affiliation to be classified `motorized` for shared gameplay, while preserving its original infantry-looking artwork and printed values. `core/historical_combat_consequences.js` verifies the face pair and full claimed identity before applying the exception. `core/historical_combat_odds.js` admits motorized attack strengths and turn modifiers without calling motorized units Tank/Mechanized for swamp reduction. A separate test confirms the Italian counter's full special-movement allowance, compared with ordinary infantry's half allowance, on the **test-only provisional** Kiev movement graph. Neither the source PDF nor the images were modified.

## Photographed German air support

Two original German `+1` air-support markers on the Kiev counter sheet are `kiev-front-r03c01` and `kiev-front-r03c02`, visibly marked **FK IV** and **FK V**, respectively. The printed rules' illustration refers to an **FK II** marker; that illustration is not a third photographed piece, and the mismatch should not be resolved by inventing a new counter. Both source-photographed markers are registered with their exact face IDs and one-step shift. The shared support adjudicator and regression exercise their permitted single-marker attack use and per-turn exhaustion on a certified test board. Other modes are not activated in a Kiev campaign.

## Fail-closed Romanian territory rule

The four **Romanian starting hexes** (`0709`, `0809`, `0910`, `1010`) are not a complete country-boundary definition. §10.8 also restricts Soviet Turn-1 attacks **against Axis units within Romanian territory**, permitting only attackers originally deployed at `0708`, `0808`, or `1110`. The full set of Romanian-territory target hexes remains unsupported by a complete source-certified mask: the v470 review workbench begins with **154 unclassified cells**. Draft user markings are not promoted to rules.

Consequently this policy explicitly sets `requireFirstTurnTerritorialRestriction: true` and `firstTurnTerritorialRestriction: null`. The scenario-neutral `core/historical_combat_declarations.js` refuses to instantiate a combat controller when a required complete mask is absent. A regression checks that failure and separately verifies a narrow **synthetic** complete test-region policy can be evaluated. Production `Graph.build(Kiev)` remains source-gated; neither the Kiev setup browser nor the composite has had gameplay enabled.

## Tests and limits

`node tests/kiev-combat-policy-v472.test.js --write-audit`: **158 assertions passed**. It pins source PDF, printed aid and photographed face pairs; verifies shared CRT; full 30-unit photographed original setup classification; exact Italian exception and negative controls; isolated Kiev candidate special movement; missing Romanian-territory rejection; air identity and usage constraints; Turn-1/Turn-2 special attack strengths; and a **real shared combat commit/DE/Undo** involving original photographed Kiev Italian and Soviet counters. For the latter combat transaction the units are **deliberately placed synthetically on already certified Leningrad map hexsides**. That proves a common-engine integration path but does not validate Kiev's still-provisional movement graph, live setup, national border or seven-turn campaign.

Regression audit: `rules/audit/kiev-combat-policy-v472.json`. Focused older Kiev (territory/origin/opening), shared combat and air, Arduous and CRT tests passed. Chromium ran Kiev setup-only (**40 assertions**), Kiev territory review (**34 assertions**), and an Arduous human-controls trajectory (**35 actions into Turn 2**). The heavy Fleet catalogue test exceeded its bounded execution window and is **not counted as passing**. The v470 territory review's outdated baseline checksum for a shared engine source was narrowed to genuinely immutable **source/map** assets; changes in shared engine modules legitimately require new tests rather than treating old package hashes as eternal invariants.

## Unfinished and deliberately preserved

- Kiev requires a **complete, evidenced Romanian territory mask** with §10.8 rule acceptance, not a conjectured border from starting crosses.
- Kiev still needs **promotion of a source-certified full movement graph** and genuine seven-turn contested browser acceptance, including the many untested gameplay branches.
- German air marker integration has been tested on a certified **synthetic** combat board, not in a fully authorized Kiev campaign. A complete campaign support/action workflow is not claimed.
- Kiev–Odessa remains incomplete; optional B4M two-unit stacking and a unified grand campaign remain at the last two deferred priorities.
- Approved map exports, source SVGs, counter art and common B4M CRT are unchanged.
