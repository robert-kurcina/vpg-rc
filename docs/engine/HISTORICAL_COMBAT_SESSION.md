# Historical combat-phase journal (v386)

`core/historical_combat_session.js` is a generic Node-only, opt-in wrapper around the shared historical combat controller. It is **not** Leningrad-specific and introduces no renderer, counter, or CRT changes.

## Action contract

- `create(context)` requires explicit map, movement profile, phase configuration, counter faces, source combat policy, cursor, actor, opening state and `enableAirSupport` toggle.
- `execute({type, ...})` accepts `declare-fleet-attack`, `roll-fleet-attack`, `finish-air-sea`, `commit-battles`, `select-battle`, `commit-ground-air`, `resolve-battle`, `commit-fleet-displacement`, `roll-fleet-displacement`, `finish-combat`. The input fields are exact; pending dice are never inferred or preconsumed.
- `snapshot()` returns current phase state and journal count; `undo()` replays the complete valid history minus its last committed input, including declaration/selection actions.
- `save()` emits a version-1 envelope. `restore(envelope, context)` requires exactly the same independently trusted opening context, source configurations, map and counter definitions, and then replays all actions. Every transition's SHA-256 state digest must match the saved journal. Save checksums are **integrity checks, not signatures**.

## Acceptance boundary

The journal validates that *given an independently verified starting combat state*, the actions can be faithfully replayed. It does not validate arbitrary historical setup, bridge Fleet forced displacement to all movement phases, or supply reinforcement, replacement, victory, UI or campaign-save orchestration. Those are the next P0 tasks in `PLAN.md`.

One common Oberlabs B4M CRT serves all five games. The v373 no-shadow map baseline remains unchanged. Oberlabs UX alignment is postponed until the historical engine and playable configurations are complete.

## Checkpoint 160 staged postcombat Fleet reaction

For a source-certified German postcombat advance into a port still occupied by the Baltic Fleet, the high-level controller may use `commit-fleet-displacement` with the **already determined combat CRT die**, validated result-dependent `choices` (including the advancing counter), and an allowed receiving `to` port. The combat controller records `fleet-die-pending` with no premature casualty, advance, or Fleet state mutation. A subsequent `roll-fleet-displacement({die})` finalizes the same authoritative consequence including Fleet damage. All intermediate actions participate in save/replay and Undo, and no other combat action advances until the pending die is resolved. With no valid alternate port, ordinary combat resolution automatically eliminates the Fleet with no damage die. The read-only action catalog lists commits separately from fully executable outcomes and prompts for the pending die.

The prior one-action `resolve-battle` compound `{fleetDisplacement:{to,die}}` remains accepted for compatibility with existing direct test clients. The engine does not itself generate physical dice or enforce that old clients use the new staging protocol. Migrating human/AI callers and enforcing staged-only access on all production paths is an explicit **remaining gate**, not a completed safety feature.
