# Universal phase runtime — Checkpoint 54

`core/phase_runtime.js` is a data-driven, browser-compatible phase cursor. It is deliberately separate from the B4M rules adjudicator. Its API is `validate(config)`, `start(config)`, `current(config, cursor)`, `permitted(config, cursor, operation)`, `advance(config, cursor, completionGate)`.

The phase completion callback is mandatory and must return `true`. No phase is silently marked complete. The API does not modify board state or consume RNG. Phase `permissions` are descriptive identifiers and **not proof of action legality**; a scenario must not enter playable mode until all rules and action bindings have been verified. A phase configuration cannot activate a non-executable scenario.

The Arduous Beginning and Target: Leningrad configurations are separately sourced from §§4.0 and 6.0 of their printed rulebooks. Both use nine phases, German then Soviet followed by housekeeping, and start Game Turn 1 at German Combat. The phase cursor does not copy B4M phase order. Their game lengths are respectively seven and eight turns.

**Open:** source-backed Kiev and Kiev–Odessa phase mapping, action binding, setup/roster activation, weather/microrules, phase completion guard semantics, Undo integration, presentation integration and AI. Preserve existing B4M engine/UI until its migration meets parity gates.

## Checkpoint 55 — Source-bound phase adapters and action dispatch

Kiev's seven-turn, nine-phase sequence and Game Turn 1 Axis Combat start are mapped from `references/rules/kiev-rules.pdf` §§4.0, 6.0(9). `maps/phase-configs/kiev.json` uses the common internal `german` identifier for the Axis player, which includes other Axis contingents. `maps/phase-configs/kiev-odessa.json` explicitly resolves Kiev's schedule with `extends: kiev`; `references/rules/odessa-rules.pdf` §§0.0, 6.0, 9.4, 10.5, 11.0 and 15.0 modify setup, special movement, combat, reinforcements, and naval operations *within* the existing phases. The expansion is not a standalone playable game.

`core/phase_actions.js` offers `legal`, `execute`, and `finish` around the same phase cursor for all four historical configurations. It does **not** include an unverified default rules engine. Every action needs a registered `legal` and `apply` adjudication callback; every phase transition needs a source-backed completion gate. Action callbacks operate on detached game-state copies. A successful return does not mutate the original state; rejected requests cannot partially apply. These callbacks are only a controlled integration seam, not yet source-verified historical combat or movement rules. Production B4M continues through its established action/session implementation.

**Pending:** bind source-derived legality/obligation modules for historical movement, combat, reinforcement, victory, weather and microrules; make validation stronger against untrusted scenario plugin code; integrate phase/session history and browser presentation. The new phase configurations do not change the historical scenario modes from non-executable.
