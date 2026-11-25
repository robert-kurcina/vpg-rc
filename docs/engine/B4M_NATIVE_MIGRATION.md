# Battle for Moscow — shared-native browser cutover (Checkpoint 175, v409)

**Current default:** The catalog and top navigation launch the shared-native Battle for Moscow game. `games/battle-for-moscow/game.json` declares `generic-hex-v1` with `browserEntry: index.html`. The canonical launch URL is `/games/battle-for-moscow/index.html`, which forwards to the existing shared-engine browser implementation under `native-preview/`. That internal directory name is retained for test and save-path compatibility; it is **not** an opt-in alternative.

The reference implementation at `legacy/index.html` and `legacy/engine.js` is retained for differential tests, not as the primary launch route. No user-facing navigation points to legacy. `game.json` identifies `nativeProfile: native-preview/config.json`; raw scenario JSON requires this policy projection before generic validation. The shared rules, existing scenario policy projection, renderer, single CRT, and historical map exports are unchanged.

**Release limitations:** Historical Soviet reserve/setup-coordinate boundaries and full Oberlabs UX parity are still not independently certified. Existing browser and seven-turn differential tests establish supported actions, not exhaustive behavioral equivalence. The cutover is a deliberate project priority, not a claim that these gates are complete.

**Historical note:** The checkpoint-126 status notes below describe the former launch policy, not current behavior.

## Historical migration detail

# Battle for Moscow — Native gameplay migration, Checkpoint 126 (v360)

## Status and authority

The active browser remains `legacy/index.html` and `games/battle-for-moscow/game.json` retains `engine: legacy-b4m-v1`. The existing Oberlabs-compatible executable remains the reference for gameplay and the human workflow until *full* differential parity is demonstrated. **Do not delete or redirect the legacy implementation.**

The new native preview is an **opt-in, executable but unreleased** configuration of the *shared* `core/engine.js`. It is **not** a second B4M engine or a B4M-specific rules implementation. It does not touch `legacy/engine.js`, `legacy/ui.js`, `core/terrain_tiles.js`, or the original map, units, CRT, and victory files.

## Files

- `games/battle-for-moscow/native-preview/config.json` — the opt-in scenario delta. Full native gameplay phases for the **subset currently exercised**, movement cost, shared `generic-hex-v1` rule parameters, and 22 reference automated deployment coordinates; all existing source files remain unchanged.
- `core/native_preview_config.js` — a **generic** whitelist-based JSON projection helper, independent of scenario identity, which forbids map/roster/objectives/CRT/special-rule modifications. It cannot modify the live selector.
- `core/engine.js` — shared initial-control fix: a map may provide `owner` or `control` for a city's original owner. The B4M source uses `control`, giving eleven city-control records instead of four. This is not B4M-specific logic.
- `tools/audit-b4m-native-preview-v360.js` — deterministic differential audit, using the current legacy engine as the reference and the real scenario map, unit roster, and CRT.
- `tests/b4m-native-preview-v360.test.js` — regression and negative tests. Existing historical tests remain present.
- `rules/audit/b4m-native-preview-parity-v360.json` — source fingerprints, test scope, counts, and unverified behavior.

## Verified scope

- 147 actual source cells, 39 counter records, 22 reference German positions + 14 source-positioned Soviets, and all **eleven** initial city-control records match the legacy opening.
- Legacy and native board topology match for every directed playable neighbor.
- In a deliberately fixed initial board layout across turns 1–7, the **entire** legal-move response (destination, cost, path, order) matches in 406 unit/mode/turn contexts, covering 2,560 individual legal moves. Modes: German normal/panzer and Soviet normal/rail; mud and clear conditions. These are **not** fourteen successively played turns.
- The replacement budgets and option sets match for fourteen fixed-layout turn/side contexts, including Soviet Shock Army **ineligibility as an ordinary replacement through Turn 4**.
- Raw and adjusted combat odds match for 3,144 synthetic two-unit adjacency cases across actual map cells, both attacker factions and clear/mud turns; the thirty initial German candidate odds also match.
- The native first phase is German combat. The verified first transition is German combat → German movement → Soviet replacements.
- Initial victory evaluation matches.
- All tests fail closed on preview/profile misuse and attempt to change protected source domains. The browser routing remains unchanged.

## Important limits

Movement checks deliberately reuse the **same initial positions** for each turn and faction, manually changing only the phase and weather turn. Likewise the combat checks construct legal *adjacency*, not full historical combat situations. These tests do **not** establish correct campaign moves after other units move or leave board, win conditions after seven turns, support/air effects, combat losses and retreat paths, manual German setup, per-phase usage, save/Undo/replay, or AI and browser behavior.

In the original v360 preview the generic module automatically placed Turn-4 Shock, whereas the legacy human UX requires a player choice; **Checkpoint 129 corrects this with an opt-in interactive reinforcement policy**. The original v360 tests alone do not certify that choice. The 22-counter initial German setup preset reproduces one automated baseline layout only; it does not replace the manual swap-and-confirm procedure. A historical typo `nornal` in the B4M source map is normalized in the legacy runtime but not rewritten in the input data by this preview.

## Run

```
node tests/b4m-native-preview-v360.test.js
node tools/audit-b4m-native-preview-v360.js
node tests/shared-action-api-v317.test.js
node tests/shared-action-session-v317.test.js
node tests/universal-scenario-contract-v317.test.js
```

## Next parity gates

1. Native declarations → post-commit die → results/retreat/advance options compared to legacy, including impossible/invalid requests and deterministic RNG consumption.
2. Native placement workflow (manual German setup and Turn 4 free Soviet Shock reinforcement). Never auto-place on a choice-required human step.
3. Generic phase and replacement transactions, supply/communication, mandatory conditions, endgame and full seven-turn replay.
4. Shared browser gameplay workflow, Undo/save/versioned replay, and human + AI legality. Cut over the active browser **only when** these pass independent differential tests.


## Checkpoint 127 (v361): Native committed-combat differential parity

The **production route remains `legacy-b4m-v1`**. The opt-in `native-preview/config.json` adds policy-only settings (not a new CRT, source rules or map): `retreatModule: retreat-radial-zoc-v1`, `exchangeMode: match-defender-step-loss`, weakest-counter defaults for losses/advances, and faction-indexed radial-retreat endpoint tie-breaking (`soviet: x-desc`, `german: x-asc`). The source rules already contain the radial retreat rule module; this change activates it in the native preview. All policy options are validated generically in `core/native_preview_config.js` and `core/engine.js`; `core/modules.js` consults the policy without branching on a scenario name.

**Observed defects corrected:** Native preview previously used one-hex fallback retreats and a one-step exchange cost. These led to 32 unequal outcomes across 180 opening attack/die cases. Both are configuration defects, not a source-map mismatch. The resulting 180/180 comparisons now match the executable legacy baseline.

`node tests/b4m-native-combat-v361.test.js` runs `tools/audit-b4m-native-combat-v361.js`. The comparison covers all thirty source opening German attack candidates and all six die faces (180 previews including sorted two-hex paths, 180 state consequences, all six CRT outcomes), 57 commits with alternate loss, retreat, exchange and advance choices, 293 disjoint two-battle announcement sequences (586 seeded and post-commit rolls), and two major-city full-strength DR-hold fixtures. It checks unit identities, strengths, positions, city ownership, result choices, RNG state, queued declarations, immutable source files, and invalid-action rejection. See `rules/audit/b4m-native-combat-parity-v361.json` for source fingerprints and counts.

**Limits:** Opening cases and short independently legal announcements are not sequential seven-turn play; the legacy executable is an implementation oracle, not independent historical-rules proof. The browser workflow remains on the legacy stack. Native Undo, manual German setup, Turn-4 human Shock selection, full game loop, save/AI/human UX parity and adversarial invalid direct-API RNG guarantees are separate release gates. Keep production routing unchanged until all are verified.

## Checkpoint 128 (v362): Shared action session, native commit/Undo/save pilot

`core/session.js` now supports an **opt-in** `engine: 'generic-hex-v1'` session alongside the unchanged `legacy-b4m-v1` contract. Its action dispatch uses the shared `core/native_session_actions.js` adapter, which calls `core/engine.js` for declarations, lock/roll, result-dependent choices, full transactional consequences, phase completion, move and replacement. The shared session owns the identical immutable rejection, history snapshot and Undo API. Scenario rules remain in JSON; **no scenario-name branch** was added to gameplay rules. Native session and save are **Node-only** for this checkpoint; no browser switch.

The native combat flow is: `declare-battle` (no RNG) → `finish-phase` (lock and commit precisely one die) → `resolve-pending` (choice + consequences; commit next die only when a further declaration remains) → final combat `endPhase`. A rejected choice leaves RNG, state and Undo history untouched. A `combat-preview` with a caller-supplied die is read-only and creates no session history. The actual first-phase cursor remains `combat` during the unresolved queue, rather than pretending the engine has a separate combat-resolution phase.

`core/native_session_save.js` introduces a separate versioned/checksummed native preview format (`generic-hex-session-preview` v1). The save carries only serializable session state, the complete Undo stack, scenario ID, and an exact digest of the external game package. Restore requires that the caller supply the identical verified package and rejects corrupted or mismatched saves. The SHA-256 is **not an authentication mechanism** against an adversary who can recompute it. Production B4M legacy session saves remain v2 and still round-trip. Neither save format executes untrusted configuration from save data.

`node tests/b4m-native-session-v362.test.js` compares 30 real opening single transactions, all 293 legal disjoint opening two-battle pairs, each of four non-default human decision categories, and 26 negative checks (including checksum-recomputed malformed states), Undo, replay and save/restore across the shared API. See `rules/audit/b4m-native-action-session-v362.json` for exact counts and limitations. This is **not** a full-game or browser release certification; no legacy source or production selector was changed.


## Checkpoint 129 (v363): opt-in manual setup and human-selected reinforcement

- `deployments.manualSetup` expresses the German starting side, 22 available crosses and setup phase. `E.start(g, seed, 'manual')` initializes with the 14 historical Soviet counters and no German deployment; `setup-place` selects an empty cross or swaps an already placed German counter. `finish-setup` requires exactly 22 legally placed German counters and enters the normal German combat phase. The initial automated preset and production legacy game are unchanged.
- `deployments.interactiveReinforcements` links the Turn-4 Shock choice to the already existing `scheduled-reinforcement-v1` source rule (unit, turn, side, entry tag, full strength, ZOC prohibition and zero cost). Generic event scheduling defers only a source event explicitly linked by this policy. The shared action session now accepts `place-reinforcement` and then `finish-phase` before normal Soviet replacements. When eligible entries exist it cannot skip a mandatory placement.
- The shared engine has no `battle-for-moscow` identity branch. All new behavior is driven by validated deployment policy and tested through `WargameSession` (declarations/combat still handled by the same native adapter).
- `node tests/b4m-native-interactive-setup-v363.test.js` compares source manual placement and representative swaps against the legacy executable, and Turn-4 interactive options against legacy Shock legality. It verifies source positions/city control, 22 placements, 17 eligible Shock locations in the starting-layout fixture, three alternative entries, Undo/replay, saved sessions, replacement budget and negative cases.
- The Turn-4 boundary fixture is **not** a played four-turn campaign. Browser parity, AI, full reinforcement lifecycle under actual combat attrition, and seven-turn victory remain outstanding. The native preview save package fingerprint has changed; backward compatibility for existing v362 preview snapshots has not been certified.


## Checkpoint 130 (v364): continuous seven-turn differential campaigns

The shared `WargameSession` native adapter now has **four full, sequential, seven-turn differential regressions** against the existing `legacy/engine.js` executable. The fourth starts from manual deployment of all 22 German counters; the other three use distinct seeded auto positions and movement selection choices. Unlike the v363 Turn-4 boundary fixture, the Shock Army is entered after actually traversing Turns 1–4. The legacy and native executables each process real legal decisions on evolving, independent unit states.

The evidence totals 220 actual phase visits, 108 selected legal moves, 43 combat transactions, 39 replacements, 4 actual Shock choices, 441 complete-state comparisons, 155 Undo/replays and 12 portable save/restores. Comparison includes counter strength, exact position, cities, committed RNG stream, active actor/turn, game-over and winner. Native session log and Undo history are separately validated; legacy does not have identical native session-history structures. **The sequence chooses at most one movement, replacement, and combat per phase.** It is a bounded campaign sample, not exhaustive parity.

A discrepancy surfaced only at the terminal boundary: `core/engine.js` previously advanced Turn 7 to Turn 8 before advancing from the Soviet to German side and omitted the last `ply` increment, unlike the legacy `endSide` behavior. The shared end-phase transition now advances the actor and increments the half-turn counter before the terminal predicate, and `currentPhase` returns `null` when over so no playable phase leaks into a completed game. This is generic turn-order logic, not a B4M-specific branch.

Run `node tests/b4m-native-continuous-campaign-v364.test.js` and `node tools/audit-b4m-continuous-campaign-v364.js`. The JSON audit is in `rules/audit/b4m-native-continuous-campaign-v364.json`. **Do not switch the production browser**: untested choice sequences, multiple declarations in a long campaign, expanded replacements/AI, browser UX, and upstream Oberlabs parity remain release blockers.

## Checkpoint 131 (v365): Continuous simultaneous multi-battle parity

`tests/b4m-native-multibattle-campaign-v365.test.js` replays four separate full seven-turn games through `WargameSession` and `legacy/engine.js`, with source-legal disjoint pairs announced together before dice. Twenty-six real two-battle phases produce 65 combat results, comparing positions, strengths, control and exact RNG consumption after each. Three cases reverse announcement order. The first die is locked at declaration commit; the next is committed only after the first result. All pending queues survive save/restore and Undo/replay. Alternate choices are compared with unselected legacy counterfactuals, not merely accepted as fields; 3 AL, 7 EX, 19 retreats and 2 advances demonstrably alter the game state. The formal audit is `rules/audit/b4m-native-multibattle-v365.json`.

This remains **bounded** to two simultaneous combats and a small set of chosen human actions per phase, not proof of independent upstream Oberlabs, browser or AI parity; no live B4M routing changes.

## Checkpoint 132 (v366): Expanded turns, source communication, and replacement policy defect

`tests/b4m-native-expanded-turn-v366.test.js` extends the actual seven-turn differential (not static turn fixtures) to up to **four distinct-unit movements per movement phase** and **full available replacement budgets** with interleaved option updates. Four campaigns produce 432 real moves, 124 replacement actions, 68 combat results, 25 simultaneous two-battle phases, 220 phases, 952 dynamic source communication comparisons (including 21 unreachable cases), 875 compared states and 504 Undo/replays. Three reachable Moscow ownership arrangements are also verified at the actual final-phase transition. All state comparisons match the separate `legacy/engine.js` executable.

The extended source comparison exposed a real engine defect: after spending one replacement action to enter a Soviet reduced counter, the native candidate list wrongly offered restoring that same counter immediately in the same turn. The source legacy `enteredThisTurn` logic forbids this. Added **configuration-only** `rules.replacements.preventSameTurnEntryRestore` to the shared engine; it checks source-consistent replacement entries in the current-turn action log and excludes only that unit from same-turn restoration. The native B4M preview enables it; other configurations retain their own policy by default. Both the core package and strict preview profile reject nonboolean values and unauthorized replacement overrides. The targeted test checks initial option parity, the immediate illegal restore rejection with zero session changes, following-turn legal restoration and Undo.

Run `node tests/b4m-native-expanded-turn-v366.test.js`, `node tests/b4m-native-replacement-policy-v366.test.js`, and `node tools/audit-b4m-native-expanded-turn-v366.js`. The authoritative results and file digests are in `rules/audit/b4m-native-expanded-turn-v366.json`. Native browser, AI, independent upstream Oberlabs parity, exhaustive replacement ordering and exotic supply cutsets remain out of scope. The production selector is still `legacy-b4m-v1`.

## Checkpoint 133 — Browser preview (v367; not production)

The new configuration-driven native browser page calls the exact `WargameSession` and `WargameCore` used by CLI differential tests. `core/native_session_actions.js` and `core/native_session_save.js` now expose browser globals without altering Node/CommonJS behavior. Browser saves use compatible synchronous SHA-256 (`core/sync_sha256.js`), not a new save schema. The universal terrain renderer and official counter templates render the approved B4M map.

Independent Chromium DOM tests cover a real click-to-declare and resolve combat, click movement, Undo, manual setup, and Node/browser save hash parity. Because the Chromium installation blocks navigation to all localhost/file pages, the test directly injects real scripts and mocks only JSON fetch; full hosted asset navigation remains **unverified**. The existing `game.json` still selects `legacy-b4m-v1`. AI, mobile/accessibility, all legal player choices, hosted workflow and independently measured upstream Oberlabs parity remain open. See `core/NATIVE_BROWSER_WORKFLOW.md`.

## Checkpoint 134 — baseline AI via shared session

The native baseline AI is independent of scenario IDs and uses the shared human-action session boundary for every operation. In four complete AI-selected seven-turn B4M campaigns, **1,089 committed states** matched when the exact same AI actions were replayed through the legacy game rules. The new AI policy intentionally does *not* mimic the Oberlabs tactical/search AI. Do not retire legacy AI or report strategic/difficulty parity from these tests. The experimental browser button is smoke-tested with real source JS in Chromium with only JSON fetch mocked; no hosted acceptance was possible in this environment.

## Checkpoint 144 · v378: reserve-position-continuity campaign differential

A bounded follow-up to the v376 candidate reserve action and v377 read-only candidate mask verifies whether nonzero startup relocations alter **downstream** native/legacy rule parity. `tests/b4m-native-redeployment-campaign-v378.test.js` uses four full seven-turn deterministic AI-selected action histories after candidate reserve placement (0,1,1,3 moves). At the end of setup, it creates a local legacy engine state with **identical unit positions, strengths, city ownership and die seed**, and then replays the very same selected action against both engines. Every action is asserted on the matching canonical state; 56 reference-score inspections must remain non-adjudicative and save-hash-pure. The actual precombat setup and browser save/Undo use `WargameSession` transactions only; no branch was added to the common rules kernel.

Results: 1,052 action comparisons, 103 combats, 477 moves, 145 replacements and 4 Shock arrivals; 14 full side-turns per seed and terminal outcomes; 33 save/restores, 65 Undo/replays. Actual shared-browser Chromium placement of all three pieces followed by Undo/JSON restore and German combat passes with 40 original image assets. Evidence under `rules/audit/b4m-native-redeployment-campaign-v378.json` and `rules/audit/visual/b4m-three-reserve-start-v378.png`.

**Falsification boundary:** The local legacy executable is NOT used to judge original tournament setup legality; its starting board is deliberately transplanted. The original Oberlabs live executable, its reserve legal-placement masks and tournament scoring priority are independently unverified. Candidate policy remains disabled by default and standard victory continues to determine native outcomes. No change to production `legacy-b4m-v1` routing, source rules or user-accepted v373 no-shadow terrain exports.

## Checkpoint 174 · v408 — opt-in objective advance (not production)

The third shared-native policy `objective-advance-v1` now requests source-configured post-combat occupation of control objectives when the already-committed CRT result permits it. This was falsified with synthetic Moscow DE versus full-strength DR hold, native/legacy action parity, seven-turn native rules-differential campaigns, and actual isolated Chromium strategy selection. No new rule engine, custom CRT, renderer branch, or production selector change was introduced. See `core/B4M_OBJECTIVE_ADVANCE.md`.
