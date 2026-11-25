# Checkpoint 265 / v499 — Kiev–Odessa Home Army, annexation, Hungarian entry (non-live candidate)

## Source and boundaries

Original `references/rules/odessa-rules.pdf`, **printed page 1, §§9.4.4–9.4.5**, states:

- The **Romanian Home Army** (source face `H`, red movement rating `3-5-3`) operates **only in Romania** until **Bessarabia**, the territory between the Prut and Dniester rivers, is vacated by *all* Soviet units. Romania then annexes Bessarabia, permitting the Home Army to operate there; later Soviet re-entry **does not reverse annexation**.
- The Home Army can **attack** across the Russo-Romanian border but may **not Advance After Combat** across that border. Ordinary movement across the border becomes possible after annexation; the combat advance prohibition remains independent.
- **Hungarian units may never enter Romania or Bessarabia**, in addition to the existing §8.1 prohibition on Hungarian–Romanian stacking.

These are not generic nationality-based Home Army rules: the limitation applies to the actual photographed Home Army identity, **not** the 4th Romanian Army, Romanian cavalry, or all Romanian infantry. The source photo lists the Home Army identity under `romanian-home-army`, with front faces `odessa-front-r01c05` / `-r02c05` and reverse faces `odessa-back-r01c04` / `-r02c04`.

## Implementation

`maps/movement-configs/kiev-odessa-territory-candidate-v499.json` extends the opt-in v498 cavalry candidate with data-only `territorialPolicy`. The **shared** `core/movement_rules.js` now validates source-identity-bound special units, forbidden nationality/region pairs, the exact source-certified cell-region field, and a persistent annexation flag. Each step of an ordinary movement path is checked; legal pathfinding inherits this because it calls the same movement adjudicator. `core/historical_combat_consequences.js` checks territorial access before Advance After Combat, which costs no movement points but still must obey border/entry restrictions.

`bessarabiaAnnexation(ctx)` is **pure and opt-in**. It proposes a cloned `territory.bessarabiaAnnexed` status: when no Soviet unit remains in certified Bessarabia it latches **true** and later re-entry cannot reset it. The function refuses to adjudicate if even one playable land cell has unknown country classification, a Soviet unit is off the supplied board, or annexation state is malformed. It is not yet invoked by a production turn/action lifecycle.

`territorialAccess` requires both origin and each destination to have an explicit `sourceTerritory` in `romania` / `bessarabia` / `outside` and `territoryEvidence: source-certified`; it **never infers country from 4 initial Romanian setup crosses, nearby cities, map tint guesses, or a source-only rail/river edge**. Ordinary Romanian counters lacking any source identity are withheld in the candidate. Home Army photo/identity disagreement fails closed; unrelated games have no territorial policy and are not altered.

## Acceptance and limits

`node tests/odessa-territorial-restrictions-v499.test.js`: **57 assertions** on source PDF checksum, exact front/reverse Home Army photos, malformed-profile rejection, candidate normal movement, post-annexation entry, immutable annexation latch after Soviet re-entry, Home Army *combat advance* distinction, Hungarian exclusion, regular Romanian exemption, pathfinder restriction, the exact 261-hex/714-edge source-derived composite, 117 railway links, 100 Sea/Coast ground barriers, and rejection of unverified country geography. Synthetic region labels are clearly **fixture-only** and are **not copied to historical map cells**.

The combined map still has **zero certified `sourceTerritory` land labels**. Therefore neither an actual Home Army move across the historical border nor an on-board Bessarabia annexation can be authorized. No original maps, SVG, scanned counters, rules PDF, renderer, shared CRT, or five engine-generated map exports were altered. The Kiev–Odessa campaign remains **non-playable**; the other four browser interfaces remain runnable, with Kiev still **experimental**.

## Explicit remaining work

1. Independently source-certify the **complete country/region mask** for all 261 cells (land cells must not remain `unknown`); do not promote the Kiev four-hex Romania setup mask into a national border. Verify which candidate land cells lie in Bessarabia and which hexsides actually cross the border.
2. Source-bind the actual Home Army and other Odessa counters in the genuine starting roster. Invoke the monotonic annexation state transition on the shared action lifecycle and preserve it through Undo/save/restore, including elimination, movement, retreat and reinforcement events.
3. Extend the actual **forced retreat** and post-combat human choice enumeration to respect entry restrictions, and regression-test real gameplay; this checkpoint does **not** claim those integrations. Combat *declaration* across the border remains allowed.
4. Complete Odessa setup, reinforcement schedule, Black Sea Fleet/port effects, victory isolation, and full human/AI campaign acceptance. Source-region certification and campaign authorization remain **CLOSED**.
