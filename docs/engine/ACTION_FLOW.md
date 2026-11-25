# Shared action flow — Checkpoint 35

This is an additive adapter over the executable Battle for Moscow (B4M) Oberlabs-compatible engine, not a new rules adjudicator and **not** active in the shipped browser yet.

`WargameActions.legal(ctx, {type:'declare-battle'})` enumerates the same attacks as `legacy.attackCandidates`, excluding previously committed defenders and attackers. `execute(ctx, {type:'declare-battle', defender, attackers})` commits only a legal declaration and leaves RNG untouched. `remove-last-battle` reverses the most recent declaration. The order of declarations is retained.

`finish-phase` follows the existing human UI phase transitions: reinforcement → replacement → special → combat → combat-resolution (only if a battle was declared) → movement → next side; no-declaration combat goes straight to movement. German turn 1 and Soviet turn 4 special starting phases match `legacy/ui.js`. The Soviet Shock placement guard remains mandatory where the engine offers placement options.

When combat declarations are committed, `finish-phase` stores the queue and rolls the **first die only**. `resolve-pending` uses the stored die for user-selected consequences, resolves one battle, and rolls the next die only after successful resolution. Completed queues enter ordinary movement. Rejected actions do not change state or the RNG seed. Calling `resolve-pending` without the committed pending battle is refused.

The API remains a **B4M implementation adapter** and does not silently claim that other game configurations have these phases. The universal scenario domain contract remains the source of truth for later phase policies.

## Open integration boundaries

- **WIP:** browser and AI route through the shared API, preserving the existing view states and controls.
- **WIP:** common Undo/session owner and spent-unit/action history, currently owned by `legacy/ui.js`.
- **WIP:** separate, configurable phase transition tables and micro-rule modules for other games.
- **WIP:** browser-level differential tests after routing the UI through the adapter. The new Node tests exercise the same legacy functions but are not direct upstream executable parity evidence.
- **DEFERRED:** changing the existing direct `combat-resolve` compatibility path; it still accepts explicit rolls and exists for older callers.

The existing production legacy UI and renderer have deliberately not been modified.
