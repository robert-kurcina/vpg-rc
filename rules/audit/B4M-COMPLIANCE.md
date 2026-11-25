# B4M v317: preliminary compliance and executable baseline

## Scope and evidence

This is a **starting audit, not a claim of rules compliance**. The register `b4m-manifest.json` contains 28 implementation-to-rule mappings in sections 4–12. Source sections are present in the bundled `references/rules/b4m-rules.pdf` (original user-provided document). The manifest's denominator counts identified implementation behaviors, **not all clauses in the PDF or Player Aid**. Eight mapped behaviors now have independent PDF-derived assertions (`enforced-and-tested` for their stated boundary cases); 19 remain `implemented-unverified` and one is `source-conflict`. Comprehensive Oberlabs differential evidence is still missing. Setup details, movement subclauses, player-aid turn sequence, and optional rules still need clause-level decomposition.

## Frozen executable trace

Run `node rules/tests/freeze-b4m.js` to verify the v316 legacy engine against the captured `rules/tests/fixtures/b4m-balanced-seed123456.json` baseline. To deliberately replace the baseline after an approved rules change, use `node rules/tests/freeze-b4m.js --write` and review the diff. Fixture pins the exact engine, scenario and rules-profile SHA-256, initial move/combat projections, and hashes of all state snapshots, turn event sequences, seed, ownership and unit positions/strengths. It covers automated setup and fourteen half-turns (seven German and seven Soviet) with policy `balanced` and seed 123456.

**Interpretation:** a passing test demonstrates *regression stability*, not conformity to an external reference. A stable bug will also pass. Do not silently update hashes after edits. Add independent Oberlabs-oracle and rules-PDF tests in the next iteration.

## Status and risk

- Preliminary inventory: 28 mapped observations; 8 have independent rule-derived assertions, 19 have only executable evidence, 1 has a source-versus-API discrepancy; 0 have been differential-tested against a separate Oberlabs executable. No valid percentage of complete B4M rules can yet be assigned.
- Real baseline: fourteen side-turns replay deterministically on the existing code. `node rules/tests/b4m-source-assertions.js` checks §§5, 6, 10, 12 (limited cases). `node rules/tests/b4m-reinforcement-retreat.js` checks §§9.3 and 11 against source-derived boundary conditions (17 candidate red-border entries and 181 enumerated retreat routes in the initial scenario; numbers are not coverage measures).
- The v316 map exports, assets, CRT, and existing browser engine are unchanged.
- `discrepancies.json` separates a resolved *documentation ambiguity* (mud movement versus mud infantry combat strength) from remaining retreat and coverage questions.
- New focused checks: `node rules/tests/b4m-combat-choice-matrix.js` covers all 36 legacy CRT preview/resolution combinations, invalid explicit orders, declined advance and full-strength Moscow DR stand-fast. `node rules/tests/b4m-known-replacement-gap.js` is an **expected-gap reproducer**, not a compliance pass: same-turn Soviet enter+restore is currently permitted by the public API despite printed §10.1. Independent Oberlabs parity for replacements remains open.

Missing verification: enemy-ZOC reinforcement exclusions with adversarial placement; standalone source-to-engine retreat outcome adjudication; manual setup legality and swapping; normal versus mud replacements; full combat results and player choices; reinforcement boundary; independent Oberlabs oracle; complete source clause/Player Aid audit; human/AI browser paths.

## Next iteration

Extract rule-specific fixtures from the legacy engine and independently compare them with the bundled player aid/PDF or the Oberlabs reference. Freeze UI/AI-versus-AI behavior separately. Do not start the common kernel migration until the v317 acceptance gate has actual source coverage rather than only a reproducibility fixture.

## Checkpoint 3 — combat choices and a replacement source conflict

The CRT resolver and preview agree on every (1:1–6:1, die 1–6) cell of the existing profile. This checks use of the matrix, not independent proof of the matrix transcription. Explicit invalid choice tests confirm no mutation in four tested cases. The printed §9.3 major-city stand-fast rule is asserted for a full-strength Moscow defender on DR.

Discrepancy B4M-AUDIT-004: `applyReplacement` does not enforce §10.1 per-unit same-turn limits across calls. The current AI replacement policy may incidentally avoid the sequence, but any future human/shared-action API must explicitly track replacement-use history. Do not change the Oberlabs-authoritative legacy engine until parity is checked.

## v317 Checkpoint 4 — executable characterization (not independent compliance)

- `rules/tests/b4m-multiattacker-phase.js`: two attacking units, user-supplied EX loss order, explicit declined advance, no seeded RNG draw when supplying die. Pass.
- The same test captures 14 sequential AI half-turn event logs through turn seven, including side/turn transitions and final game state. Pass.
- The existing source-tested inventory remains **8 / 28**, with **19 unverified** and **1 source-conflict**. These characterization assertions are *not* newly claimed source-tested rules.
- **B4M-AUDIT-005:** `playSide` combines phase operations internally; a nine-phase interactive action interface is not yet implemented. Independent Oberlabs phase and replacement parity remains outstanding.
- No `legacy/engine.js` edits in this checkpoint.

## Checkpoint 6 — invalid action / RNG interaction

`node rules/tests/b4m-invalid-choice-rng.js` passes eight deterministic rejection checks. An invalid explicit choice with `roll=null` consumes one PRNG value before throwing, but does not change units/control/events; specifying the roll explicitly leaves every state field unchanged. This is **legacy characterization, not source-derived compliance**. See `B4M-AUDIT-006`; the original Oberlabs UI's sequencing of roll and player choice remains unverified. The existing preliminary rule inventory counts are unchanged.

The Checkpoint 3 reference to a currently permissible same-turn enter+restore sequence is historical: it was fixed by user-authorized ruling at Checkpoint 5, verified by `b4m-known-replacement-gap.js`.

## Checkpoint 6A — die timing and deferred direct-API issue

In the current human UI, attack declaration precedes `prepareCurrentHumanBattle()`'s stored die roll; casualty, retreat and advance decisions follow result revelation. The resolver then receives an explicit die. `B4M-AUDIT-006` is therefore **not demonstrated as a human UI bug**; it is a narrower invalid-call RNG side effect in the direct engine API. Deferred until common action API design; independently verify upstream Oberlabs. Distinguish a pre-commit roll (may be hidden or drive options) from a post-action roll (determines outcome after commitment). No engine change or new source-rule coverage claimed.

## Checkpoint 7 — retreat resolver tests

`node rules/tests/b4m-retreat-adjudication.js` now verifies five focused combat-state transitions: DR to an explicitly chosen empty non-ZOC endpoint; DRL pre-retreat strength loss; no-route DR elimination when all adjacent hexes are hostile-occupied; rejection of an invalid explicit destination without mutation; and exactly one step lost when a full-strength defender traverses one enemy ZOC. These are **legacy executable characterization tests** with selected PDF §9.3 boundaries, not an upstream Oberlabs differential oracle. The preliminary eight-of-28 source-tested tally is unchanged. Remaining high-risk questions include reduced defenders, multiple alternative retreat routes, EX+retreat interaction, and independent browser workflow comparison.

### v317 Checkpoint 9: combat Undo contract

- Source-level UI wiring confirms the stored-die handoff to combat resolution, JSON snapshot Undo, and reset of transient consequence selections.
- Six executable seeded fixtures reproduce the same combat state and result after restoring the snapshot, with no extra random draw; `rules/tests/b4m-human-combat-undo.js` has 38 assertions.
- This is not browser-click automation or independent upstream Oberlabs parity. The selection reset is tracked as deferred `B4M-AUDIT-007`.

## Checkpoint 10 — actual browser-level UX regression (local implementation)

`python rules/tests/b4m-browser-combat-undo.py` loads the unchanged HTML and JS in headless Chromium. It injects deterministic legal fixtures into the UI closure only in test memory, then **clicks the visible Resolve and Undo controls**. All six combat result types (AL, NE, DR, EX, DRL, DE) pass resolve → undo → identical replay. A two-combat queue also passes, preserving the second battle's stored die, first battle's result and nested undo history. Earlier rule and asset tests pass. This is the **local browser implementation**, not an independent upstream Oberlabs web-site comparison; manual attack declaration through map clicks and browser replacement flow remain untested. Source-derived 8/28 preliminary mapping counts are unchanged. `B4M-AUDIT-007` remains deferred.

## v317 Checkpoint 12 — differential provenance boundary

The two-browser harness `rules/tests/b4m-dual-browser-parity.py` runs **two local derivative engine files** (frozen v316 and active v317) under identical current legacy UI scripts. It does not run the independent original Oberlabs executable. Six checkpoints agree on full serialized state and generated UI controls; a seventh agrees on state but shows the intentionally changed replacement-option API/UI after a unit enters in the same turn. See `rules/audit/differential/local-v316-v317.json`.

Independent upstream *documentation* observed at https://oberlabs.com/b4m/ confirms the eight German/Russian phase descriptions and defender-first battle-announcement UX (with highlighted attackers, computed odds, and a queued battle). It does **not** yet certify that this project's UI matches upstream behavior at runtime.

`B4M-AUDIT-008`: replacement UI uses a fixed 70-option slice which can hide legal actions; remain WIP pending upstream comparison.

## Checkpoint 13 — dual-browser player actions

`rules/tests/b4m-dual-browser-parity.py` now compares 17 checkpoints using real Chromium contexts: 16 matched complete state/UI results (including map-click movement, defender-first declaration, stored combat die, Shock UI placement and Undo), followed by one **expected** difference for user-approved replacement policy. Fixtures initialize legal states; UI actions run through the production browser event handlers. Both contexts still share the bundled UI and game assets, so this is an **internal local v316↔v317 differential**, not proof of independent upstream Oberlabs equivalence. Eight source-tested manifest mappings remain unchanged; no new rulebook compliance is claimed.

## Checkpoint 14 — rejected UI actions and phase guards

Two local Chromium contexts now compare 22 checkpoints (21 matched plus one approved same-turn replacement difference). New cases cover prohibited incomplete setup confirmation and skipping mandatory 1st Shock Army entry, both with alerts and unchanged game state, plus noncommitting movement/source/defender clicks. See `rules/tests/b4m-dual-browser-parity.py` and schema-2 differential output. All current B4M rules/browser, shared CRT, counters and five-map smoke suites pass. This is **internal** comparison of derivative v316 and v317 using a shared UI, not original upstream executable parity. The independently source-tested preliminary rule mapping count is unchanged.

## Checkpoint 16 — contiguous active browser half-turn

The internal dual-browser regression now has 40 checkpoints (39 v316/v317 matches, one user-approved replacement-policy difference). One new scenario performs combat *and* movement in the same continuous human half-turn with actual UI map clicks and buttons. Nested Undo restores the pending die, and replaying combat yields the identical serialized state SHA. Both variants share the bundled UI, assets and fixtures; **this is not an independent upstream Oberlabs executable oracle**. Source-tested preliminary mapping counts (8/28) do not change. All existing browser, rules, counter and five-map package smoke suites passed. Historical map conversion/rendering fidelity is previously completed work; no new visual-parity claim is inferred from the provenance-only test.

## Checkpoint 17 — source heading register and coverage denominator correction

`b4m-pdf-clause-index.json` indexes **26 distinct printed headings** from §§4–12 of the bundled B4M PDF, records the original PDF SHA-256 and physical sheet number, and cross-references the legacy implementation mappings. The register is checked with `node rules/tests/b4m-pdf-clause-index.js`. Parent sections such as §§7.0, 8.0, 8.2 and 12.0 naturally have no direct mapping because their substantive clauses are indexed beneath them. **Neither 26 headings nor 28 behavior mappings is an atomic-clause compliance denominator.** The §10.1 entry has now been reconciled to `enforced-and-tested` on the strength of the explicit user ruling and its 30-case replacement test, with provenance identifying it as a user decision. Current preliminary behavior-mapping statuses: **9 tested, 19 implemented-unverified, 0 active source-conflict**. This is still **not a rulebook compliance percentage**.

This register does not yet cover the image-only B4M Player Aid or subsections §§1–3 and optional §§13–15; the PDF is imposed as two physical sheets spanning four logical printed pages. Individual bullet/condition decomposition, explicit direct assertions for each, and independent upstream Oberlabs runtime verification remain **WIP**. No existing gameplay semantics were changed in this checkpoint.

## Checkpoint 18 — Player Aid field-level register

The bundled B4M Player Aid (`references/rules/b4m-aid.webp`) was inspected directly and transcribed into `b4m-player-aid-atomic.json`: **27 TEC cells + 7 turn-track records = 34 source fields**. SHA-256 hashes bind the record to the aid image and companion PDF. `node rules/tests/b4m-player-aid-atomic.js` verifies transcription shape, recorded turn-track numbers, and profile differences; it does **not** establish gameplay compliance.

**B4M-AUDIT-009:** The Aid prints **five Soviet replacement steps in turns 3 and 4**, while the bundled Oberlabs profile uses **four** during mud. The baseline retains four while upstream executable parity is unresolved. Mud combat is not a second conflict: printed PDF §12.2 restricts attack halving to Panzer/Tank and leaves infantry unaffected, matching the code.

PDF heading index (26) and Player Aid field register (34) are different granularities and **must not be combined into a misleading coverage denominator**. Unmapped rules, source clauses and upstream variants remain WIP.

## Checkpoint 19 — first-pass PDF condition decomposition

`b4m-pdf-atomic-conditions.json` adds **101 manually source-indexed, independently testable statements** from the printed §§4–12. This is a provisional decomposition rather than an exhaustive/certified clause count. All 101 start as `source-indexed-unverified`: no existing test is silently claimed to prove an atomic clause simply because its broader category has a regression fixture. Crossrefs to the legacy 28-entry implementation mapping are navigation aids, **not proof of enforcement**. Source-hash and schema tests are performed by `b4m-pdf-atomic-conditions.js`. The 34 Player Aid source fields are separately indexed and cannot be added to the PDF condition count as a compliance score.

The next pass should independently verify executable conditions and confirm the list's completeness; B4M-AUDIT-009 remains an explicitly preserved aid-versus-profile difference. Existing gameplay and browser UX remain unchanged.

### Adjacent historical map test maintenance

The broader historical `tests/*.test.js` suite (not the B4M rules suite) currently shows 25 failing and eight passing tests. Many tests read removed intermediate export folders, and others refer to older source geometry. `rules/audit/historical-tests-checkpoint19.json` records the failures. Current five-map package smoke and relevant asset/CRT/counter tests pass; no map changes were made. Treat this as obsolete or unported test fixture investigation, not automatically as a source-render failure.

## Checkpoint 20 — bounded atomic evidence (not full compliance)

Seventeen source-indexed conditions have exact executable assertion anchors recorded in `b4m-atomic-evidence.json`. Their `source-tested` status applies only to the documented fixture-level claim. For example, tests of German mud moves do not prove all Soviet non-rail mud behavior; a single EX defender-loss test does not certify every exchange rule. The 84 remaining source-indexed conditions are unverified. The 101-condition inventory is a **first pass**, not necessarily exhaustive of the printed rules. The 28-behavior manifest is maintained separately and its historical summary counts are not a substitute for this ledger.

The historical map test triage is in `historical-test-triage-checkpoint20.json`. It does not overrule previous accepted map/rendering work.
