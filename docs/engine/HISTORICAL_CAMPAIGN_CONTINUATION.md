# Shared historical campaign continuation — Checkpoint 153 (v387)

This **opt-in Node-only engine integration** composes previously source-checked phase transactions. It does not activate a complete historical game, infer reinforcements, or alter the human interface.


## Checkpoint 154 v388 extension — opt-in buildup actions

When the caller additionally supplies `buildupPolicy` and `buildupAllocation`, the same journal supports the configured `buildup` kind with `place-reinforcement({slotId,hex})`, `apply-replacement({unitId,hex:null|<certified hex>})`, then `finish-buildup`. Source counter face selection is **explicit** and bound to save hashes. The resolver tracks turn-specific replacement expenditures, source full/reduced face state, killed-unit reentry, friendly colored edge/ZOC/stack and controlled communicating city restrictions, the special Workers Militia hex, reinforcement expiration, and forfeiture of unspent steps. It cannot be invoked via generic `finish-phase`; omission of the policy still blocks buildup as before. City ownership is maintained from recorded land passages and combat advance/retreat on configured city hexes. Turn 6 FK VIII eligibility is still enforced by the independent air policy from its source-scheduled arrival turn. The old absence-of-buildup statements below describe the **v387 baseline**, not the current opt-in v388 behavior.

**At v388, still blocked (now implemented opt-in in v389):** `housekeeping` / eight-turn terminal victory, live browser integration, historical identity certification of chosen individual formation assignments, and original printed-to-host disputes. Only the first Turn 1 buildup boundary has been reached in an unbroken opening replay; later source actions have independently supplied trusted states.

## Checkpoint 155 v389 extension — opt-in Housekeeping and eight-turn completion

`housekeepingPolicy` is optional and requires the already validated `buildupPolicy` + `buildupAllocation` to maintain the `cityControl` state. Its source-authorized action is `execute({type:'finish-housekeeping'})`, **only** from the system-owned configured Housekeeping Phase and with no pending movement, Fleet die, combat or buildup transaction. Nonfinal turns advance to German Buildup with cleared phase use ledgers; Turn 8 sets `cursor.complete`, produces a stable `terminal` result and rejects further actions. Terminal outcome is replayed through the same session save and Undo journal. Sessions without the new policy retain their old unsupported-housekeeping gate and save binding shape.

§5.0: German win if controlling 14 of 14 cities; Soviet win if Axis controls 12 or fewer; draw if Axis controls 13 and Leningrad (the only Soviet-held city) is isolated from the east boundary according to the same certified §12.0 communication graph as replacements. The source does not explicitly resolve other 13-city outcomes; the shared scorer returns `unresolved-source-rule`. No victory is calculated before Turn 8. Policy stays in `maps/housekeeping-configs/leningrad.json`, not scenario-ID branches in the engine.

`node tests/historical-housekeeping-eight-turn-v389.test.js --write-audit` proves two continuous eight-turn, 70-phase action histories, terminal and source-gap boundaries, in-turn and terminal replay/Undo. One route performs no combats/moves; the other uses actual legal ground and Fleet moves, Militia/reinforcements, and repeated air-sea commitments across Turns 2, 3 and 6. Both use explicitly selected **candidate counter identities**, not a certified setup, and do not establish production playability. To avoid premature migration, this is a Node-only developer engine path; player browser UI is unchanged. Historical roster mapping and mixed real-casualty eight-turn tests are still blocking.

## Supported transactions

- In a configured **combat** phase, `execute({type:'combat', action:<historical_combat_session action>})` uses the unchanged replay-verified phase controller. A verified `finish-combat` passes its resulting ground/Fleet/air-use state and new cursor into the next configured phase.
- In a configured **movement or special-movement** phase with `move` permission: `declare-ground-move` (source-legal path checked) then `resolve-ground-move` (atomic source-valid move). Each unit can move at most once per phase. The player may instead finish a movement phase without moving a unit.
- When a source-valid German move enters the Baltic Fleet's port, the staged action sequence is `declare-ground-move`, `commit-forced-port` with a registered, available port, and `resolve-forced-ground-move` with a d6. The die **cannot** be submitted before the destination is committed. If there is no available alternative port, use the ordinary `resolve-ground-move`: the existing §13.2 rule removes the Fleet without a die.
- In a configured owner-specific special-movement phase with `move-support`: `declare-fleet-move` then `roll-fleet-move`. The destination is committed before the departure-port damage roll, and the Fleet cannot move twice in the same special-movement phase. A Fleet eliminated earlier need not move.
- `finish-phase` is allowed **only** for supported ground movement and special movement phases with no unresolved decision. Combat completion must use the combat controller. Buildup, reinforcement, replacement and housekeeping have **no generic skip action** and cannot be silently advanced.
- All actions are recorded in a versioned, SHA-256 checksummed journal. State and action hashes are independently recomputed by replay. The journal preserves pre-die pending decisions, actor/turn/phase, moved-unit tracking and Fleet use across the tested handoffs. Undo replays the journal without its last action; invalid actions are failure-atomic.

## Source binding and safety

The caller supplies **trusted, independently established** `map`, `profile`, `config`, `counterConfig`, `combatPolicy`, `enableAirSupport`, `cursor`, `actor` and `state`. A save is restored only with that same source scope and its original opening state. SHA-256 checksums detect accidental/casual edits and inconsistent journals; they are **not a digital signature or an authentication mechanism**. No saved document can establish its own historical starting position.

The shared engine contains no scenario-ID-specific branch; per-scenario feature availability is controlled by source configuration. Existing accepted Forest-without-shadow maps and the single five-scenario B4M CRT are unchanged.

## Verified use

`node tests/historical-campaign-continuation-v387.test.js --write-audit`

1. Actual candidate Leningrad opening: German combat (with no committed battles), source-legal German special movement, then **blocked** Soviet buildup. Save/restore and cross-boundary Undo are tested after every action.
2. Independently supplied Soviet special-movement source state: source-backed Fleet relocation with a precommitted destination, continuation into Soviet combat, then Soviet ordinary movement, followed by an **explicit housekeeping block**. This is **not** an unbroken opening-to-Turn-2 historical campaign.
3. Source-valid German entry into a Fleet port: forced destination before die, Fleet damage, and no-port automatic elimination; Undo, state conservation and tampered-record rejection.

## Not yet implemented

- Historical buildup, counter-authenticated reinforcement placement, replacement and housekeeping/victory closure.
- Automatic full eight-turn turn-cycle execution and a complete game save from certified opening to victory. The current format is a **campaign continuation journal limited to existing supported phases**, not a release-grade campaign save.
- Complete human/browser action integration, order-dependent joint retreats, disputed source numbering, and an AI for the four unfinished scenarios.

## Next gate

Implement source-identity-verified buildup/reinforcements and explicit forfeiture/arrival semantics before allowing the German special-movement → Soviet buildup boundary to advance. Then add end-turn/victory evaluation and full eight-turn differential/regression history. Oberlabs presentation parity is deferred by user instruction until engine completion.

## Checkpoint 156 v390: Nontrivial combat and legal-action discovery

`tests/historical-mixed-combat-eight-turn-v390.test.js` validates a full source-configured campaign transaction chain with genuine simultaneous battle declarations, out-of-order adjudication, an EX casualty and post-combat advance, German replacement restoration, Fleet movement and air-sea elimination, Turn 3/4 buildup, cross-turn save replay, Undo and terminal scoring. The fixture intentionally supplies candidate source-counter faces; it is NOT verified historical initial identity mapping.

`historical_campaign_action_catalog.discover({session,context})` returns `{phaseId,phaseKind,actor,turn,commands,proposals,prompts,complete}`. Each listed executable command is trial-validated through the same immutable campaign transaction, so there is **one** source of legality. `proposals` are individually legal attacks; composing them into a simultaneous declaration requires the existing combined validator (the catalog does not guess a plan). `prompts` are **not** executable and never include fabricated dice; callers must commit and supply a die according to phase policy, then request authoritative consequences. Movement discovery currently offers source-legal single-hex requests only; multi-hex planning, automatic retreat-choice enumeration, and full human/AI policy remain future work. The interface does not modify engine/UI rendering or scenario-specific production paths.

## Checkpoint 157 v391: Multi-hex routes and bounded battle plans

The read-only `historical_campaign_action_catalog.discover({session,context})` now returns `{commands,proposals,plans,prompts,...}`. In movement phases, `commands` contains one *source-adjudicator-verified*, least-cost path for each reachable unit/destination/mode; the full path appears in `declare-ground-move.request.path`, including routes of multiple certified hexes. Rail-mode alternatives are considered only for Soviet infantry in authorized special-movement phases, and every action is revalidated through the same campaign transaction. Path search is limited to 50,000 states per unit/mode: exhaustion throws rather than silently truncating destinations. All session state remains immutable.

In the combat declaration phase, `plans` contains up to 128 validated pairs of single-attacker, distinct-defender proposals; after 128, a prompt with `kind:'enumeration-incomplete'` identifies truncation. The single-battle `proposals` remain available and unselected. This is **not a complete combat planner**: multiple attackers against one defender, more than two simultaneous battles, dice, and result-dependent decisions still require the authoritative engine and player/AI decisions. The only gameplay changes are to read-only discovery: the accepted B4M CRT, battle/movement resolver, campaign save format, renderer, and scenario configurations are unchanged.
