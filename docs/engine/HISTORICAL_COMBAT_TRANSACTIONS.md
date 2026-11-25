# Shared source-backed combat transactions (Checkpoint 125, v359)

This is a **bounded, opt-in gameplay pilot**, not an activated Leningrad game. The same JavaScript modules accept certified board/graph/counter faces and scenario combat configuration; scenario names are not branched in the shared declaration, geography or consequence code. The only certified movement graph currently usable here is Leningrad's.

## Sources and configuration

- Rules: `references/rules/leningrad-rules.pdf`, especially §§7.2, 7.4, 8.1, 10.0–10.7. The original rulebook is distinct from the **project-selected common Oberlabs B4M CRT** (`core/historical_crt.js`), deliberately applied to all five scenarios.
- Original photographed paired faces: `maps/counter-configs/leningrad.json` (source counter sheets under `assets/official-counters/source-sheets/`). No strengths are read from arbitrary request parameters in the effect path.
- Per-game modifiers and outcome/stack/retreat restrictions: `maps/combat-configs/leningrad.json`. The shared odds calculator retains compatibility defaults only for older calculation-only callers; source-backed consequences **require the explicit policy**.
- Approved 19-counter **test-only** opening: `tests/fixtures/leningrad-source-setup-v357.js` and `core/scenario_opening_bridge.js`. Two independently recorded printed rear hex-number conflicts remain unresolved.

## Executable API

`core/historical_combat_phase.js` accepts a configured `counterConfig` and `combatPolicy` alongside the map, movement profile, phase config, actor, cursor and state. This is *additional* to, not a replacement for, the old declaration/odds-only interface.

1. `controller.commit([...])` validates and locks **all** battles before resolution.
2. `controller.select(defenderHex)` selects any remaining declared battle.
3. `controller.resolveSelected({die, choices})` validates photographed faces, automatically reveals involved untried Soviet mechanized counters at combat time, computes the scenario-configured odds and common CRT result, then **atomically** returns `{ok, session, event}`. `die` must be supplied by the caller for a rolled result; the method never consumes random numbers itself. When an attack has automatic below-1:1 `NE`, `die:null` is required.
4. Choices depend on result: `NE` has no choices; `DE` can `advanceUnitId`; `AL` requires `lossUnitId`; `DR` requires `retreatPaths` (and may advance); `DRL` adds `defenderLossId` if needed; `EX` adds `attackerLossIds` for attacker losses meeting the defender step-loss value. All defender units in a hex are involved. Safe retreat paths are two certified, outward hex steps with **no EZOC** and legal destination stacking. As of Checkpoint 147, the source-configured forced-retreat policy additionally handles unavoidable EZOC attrition and verified outward overstack extensions; the safe-only legacy policy still rejects both.
5. After all declared outcomes, `session.finish()` moves the generic phase cursor to the configured next phase. `session.undo()` reverses the last completed result or phase finish. A committed **empty declaration** can end its combat phase because attacks are voluntary.

Every action produces a new immutable controller. Caller-supplied states, saved snapshots, counter configurations and rejected operations remain unchanged. `recordResolution()` remains intentionally blocked as an unbound legacy direct-record API. No gameplay RNG or live browser input path is wired into this pilot.

## Explicit remaining blockers

- **Forced retreats:** the explicit source-forced-EZOC policy resolves one step loss per unavoidable EZOC retreat, terminal EZOC elimination, physically blocked retreat elimination, and bounded overstack extensions. The preexisting unconfigured safe-only policy still refuses such cases. Order-dependent joint extension choices remain blocked. Current implementation can resolve the common CRT's six outcomes only **where complete verified consequences exist**.
- **Support:** no Air Corps marker commitments, Fleet support, Fleet-in-port retreat exception, or support-marker usage tracking. Arbitrary caller-provided support values are not accepted by the consequence API.
- **Terrain:** map-certified open/forest/swamp and river edges work; source-marked city hexes are blocked until ordinary versus major-city combat-modifier classification is certified.
- **Presentation and game completion:** only an isolated Node/test controller exists. No human roll/choice UI, no persistent combat save or replay, no source-certified reinforcement/turn/victory orchestration, and no demonstrated eight-turn playthrough.

## Run

```sh
node tests/historical-combat-consequences-v359.test.js
node tools/audit-shared-combat-transactions-v359.js
node tests/scenario-opening-bridge-v358.test.js
```

The audit `rules/audit/shared-combat-transactions-v359.json` records the source hashes, real opening positions, CRT `DE` result, approved unit advance, phase cursor, and two-layer Undo restoration.

## Checkpoint 145 (v379) — Read-only safe retreat choices

Call `controller.safeRetreatOptions()` **only after** `controller.commit([...]).select(defenderHex)`. The phase validates the same terrain and hexside combat geography as a consequence transaction before returning a frozen result with `perDefender` and `jointOptions` (mapping unit IDs to ordered routes), `exhaustive`, and `status`. `status: 'no-certified-safe-route'` is **not** elimination authority. Multi-defender `jointOptions` account for combined destination stacking and army limits. Configured two-hex routes, physical shortest outward distance, certified movement edges, enemy occupation and ZOCs are enforced by a single scenario-independent implementation in `core/historical_retreat_options.js`. The original `resolveSelected({die,choices})` remains the only action that changes game state; returned safe paths can be supplied as `choices.retreatPaths` when the actual result is a plain DR.

These are **pre-consequence** safe cases only: after an EX/DRL loss, attackers/defenders might be removed or reduced, changing the actual ZOC and retreat eligibility. Do not treat these previews as authoritative post-loss options. Likewise, forced EZOC step attrition, no-path elimination, additional retreat distance for overstack, and Soviet Fleet-port exceptions remain unimplemented. A result with no listed safe choice is not resolved by this helper. Human browser Leningrad and eight-turn orchestration remain outside this checkpoint. Source: `references/rules/leningrad-rules.pdf` §10.6, page 5. Evidence: `tests/historical-safe-retreat-options-v379.test.js` and `rules/audit/leningrad-safe-retreat-options-v379.json`.

## Checkpoint 146 (v380) — Opt-in forced-EZOC effects (not full retreat)

When `combatPolicy.retreatMode` is explicitly `"source-forced-ezoc-v1"`, the **committed consequence transaction** uses `core/historical_forced_retreat.js` to enumerate joint mandatory outward two-hex legal choices and apply a single source-counter step loss when a retreat enters one or more unavoidable enemy-ZOC hexes. If a destination remains in an enemy ZOC, the unit is eliminated; a unit without any physical outward route is also eliminated. These effects follow any DRL/EX prior losses and remain atomic/Undoable. Enemy occupation, prohibited Lake/Sea hexsides, verified adjacency and full end-of-retreat stacking are checked. The attacking player chooses among certified routes; a zero-EZOC joint choice is required where one exists. No source-policy option means the preexisting safe-only consequence handler is used. An unrecognized option is rejected, never silently downgraded.

**Safety boundary:** If the two-hex physical routes require end-of-retreat overstacking, the transaction fails closed until the additional-outward-hex procedure is implemented; no automatic elimination can be inferred. The port-occupied Soviet Fleet exception, human post-result choice UI, and eight-turn orchestration are not implemented. The earlier read-only `safeRetreatOptions()` still describes pre-result safe routes only and MUST NOT be used as the post-EX/DRL/forced-retreat answer. The legacy `safeRetreatOnly` key continues to authorize this read-only safe-preview module, while `retreatMode` controls the consequence executor separately. No production/renderer changes are made.

Run: `node tests/historical-forced-retreat-v380.test.js`; `python3 scripts/verify-checkpoint146-regressions.py`.

## Checkpoint 147 (v381) — Mandatory outward overstack extensions

The same `core/historical_forced_retreat.js` enumerator now extends a defender beyond the ordinary two-hex retreat **only** when its two-hex destination violates stacking (§10.6). Every extra step must increase source-board distance from the battle hex and traverse a certified, legal hexside without entering an enemy-occupied hex. An extension stops at its first legal destination, and the attacking player cannot voluntarily extend a retreat that was already stack-legal. Among safe alternatives, prefer the minimum necessary extension; avoid any EZOC across the whole route whenever a no-EZOC legal retreat exists. The existing single step loss for any EZOC traversal and terminal EZOC elimination remain intact.

The source rule provides no deterministic move-order mechanism for cases in which multiple retreating defenders mutually block each other's extra destinations. Such cases continue to refuse adjudication. Enumerator visits and joint combinations have finite safety budgets; exhausting either budget fails closed rather than claiming elimination. This is a bounded policy extension, not complete Leningrad combat/port play.

Verified by `node tests/historical-overstack-retreat-v381.test.js --write-audit` and `python3 scripts/verify-checkpoint147-regressions.py` (17-command suite). Source: `references/rules/leningrad-rules.pdf`, page 5, §10.6. Earlier source/audit evidence is retained.

## Checkpoint 148 (v382): photographed Fleet marker, optional ignored retreat

`maps/combat-configs/leningrad.json` opts into `cityMarkerMode: "source-typed-v1"` and `portSupport.mode: "photographed-port-marker-v1"`. The generic `core/historical_port_support.js` binds the front/back naval marker face pair to a configured six-port registry and the actual map city markers. Port support exists only if a caller explicitly supplies a strictly validated `state.supportMarkers.balticFleet` record containing the marker hex, owner, photo face IDs and condition (`undamaged` / `damaged`). The current 19-ground-counter opening bridge does **not** instantiate this marker. It is a bounded state/transaction interface, not Fleet deployment or a special movement phase.

In a source-verified port battle, `core/historical_combat_consequences.js` applies the Fleet's undamaged defender odds-column shift automatically and lets surviving Soviet defenders choose `choices.ignoreRetreat: true` for DR, DRL or EX. DRL/EX step losses must still be chosen and applied first. If the Fleet is damaged the shift is zero but the option remains. The port defenders stay in place; thus the attacking player may not advance. A forged marker, unsupported/missing port, optional ignore combined with route/advance, or ignored retreat after all defenders are eliminated is rejected. `core/historical_combat_phase.js` uses the same bound support state when computing read-only odds; it rejects a manually injected Fleet shift for the source-configured mode.

This source-certified opt-in also allows the generic combat-geography binder to distinguish ordinary city markers from the registered Major City when `cityMarkerMode` is enabled. The previous conservative default remains unchanged. Fleet setup, movement, damage checks, air-sea attacks, mixed-origin Fleet attack shifts, joint retreat move-order resolution, eight-turn replay, and a human result-choice UI remain blocked. See `rules/audit/leningrad-fleet-port-retreat-v382.json` and `rules/audit/leningrad-fleet-port-retreat-regressions-v382.json`.

## Checkpoint 149 (v383): Fleet opening and source-bound voluntary movement

Optional `supportPolicy` injection in `core/scenario_opening_bridge.js` now creates the verified photo-face Fleet marker at the registered `initialPortName` port while leaving the source-validated ground setup untouched. The module `core/historical_port_support.js` provides a pure `relocate({state,to,die})` transition governed by `portSupport.damageOnDeparture` from the source rules; it validates source-owned Fleet condition, source faces, known ports and occupancy, and consumes only an explicitly supplied 1–6 die. A hit flips undamaged→damaged or eliminates an already damaged Fleet. An enemy-occupied port cannot be used for voluntary movement; hostile entry into the *current* Fleet port must await mandatory displacement integration instead.

`core/historical_support_movement.js` wraps the pure transition in a **separate opt-in** Soviet Special Movement Phase pilot. The two-step `declareMove(to)` then `resolveDamage(die)` API commits destination before the caller knows the roll. Only one move can be committed in a single phase; `finish()` also permits none but cannot bypass an unresolved die. History is immutable and replayable; `undo()` and `restoreSnapshot()` validate recorded action progression, but saved snapshots are not cryptographic production-authenticated. The host game still needs to bind real combat→Soviet special movement→combat→turn progression. German forced port displacement, German air-sea attacks and exclusive air-marker commitments, full human gameplay and eight-turn Leningrad certification remain unfinished.

Source: Leningrad rules §§6.0, 13.1–13.3, printed pages 2 and 6. Audit: `rules/audit/leningrad-fleet-opening-movement-v383.json` (716 focused assertions). Regression: `rules/audit/leningrad-fleet-opening-movement-regressions-v383.json` (19/19).

## Checkpoint 150 · v384 — verified German port-entry Fleet reaction

`core/historical_port_support.js` defines one optional `forcedEntry({before,after,actor,enteredUnitId,choice})` for independently valid German ground movement and combat advance. It checks a genuine nonowner unit's change into the photographed Fleet marker's registered source port. Available destinations are the other five named ports minus enemy-occupied ports. A valid choice supplies the port and an externally injected d6 die, with hit threshold keyed to the **departure** port. If no destination exists, the marker is eliminated without rolling. The common combat consequences and historical movement action modules call the same rule; combat session Undo returns to the complete precombat state. Unsupported post-commit human decision UI and movement-controller persistence remain explicitly unimplemented. This does not authorize an eight-turn Leningrad campaign. See `tests/historical-fleet-forced-displacement-v384.test.js` (768 assertions).

## Checkpoint 151 (v385): Precommitted air-sea attack and ground support

The optional `core/historical_air_support.js` reads photographed Axis Air Corps marker faces and configured Shift Ratings, starting turns and faction through the historical combat policy. All five scenarios still call the **same Oberlabs Battle for Moscow CRT**; the optional Air Corps changes the applicable odds column, not the table.

For German Combat Phases using `enableAirSupport: true`, the shared combat phase begins in `air-sea-open`. `declareFleetAttack(faceId)` fixes a still-available air marker; `resolveFleetAttack(die)` then rolls against its Shift Rating and applies Fleet damage or elimination. A pending die cannot be bypassed. `finishAirSea()` is required before battle declarations. During a selected German ground battle, `commitGroundAir(faceId)` or `commitGroundAir(null)` fixes whether/which marker supports that battle **before** `resolveSelected({die,choices})`. A per-turn immutable state ledger forbids reuse for ground and naval support, including two grounds or two naval attacks. The lower-level atomic resolver remains a bounded, externally supplied die transaction, not a source of hidden RNG.

`core/historical_combat_consequences.js` consumes only a marker already committed through the phase controller. Arbitrary air-shift injection is prohibited in the opt-in bound preview. Regression tests cover Undo/replay and first/second Fleet hits. This is an **experimental combat subphase**, not the complete eight-turn historical rules controller; no browser action buttons or campaign-grade save/restore are enabled, and source-printed coordinate contradictions persist. Tests: `tests/historical-air-sea-support-v385.test.js`, `scripts/verify-checkpoint151-regressions.py`.
