# Checkpoint 47 — Solo AI replacement source alignment

Source: `legacy/engine.js`, function `doReplacements()`; output actions are obtained from `core/session.js::legal` and executed via `core/session.js::execute`.

The score and stable input ordering replicate the baseline replacement selection for the supported policy names. This tests only the *first action* per fixture, not the entire replacement phase. The legacy `doReplacements` repeats scoring after each action; the shared policy does the same when called once per step, but that full sequence and subsequent operations need independent parity tests.

Fixture coverage: both sides; turns 2, 3, 4, and 5 (including mud); controlled reduced-only and reduced-plus-eliminated rosters; balanced, conserve, fortress, screen, counter, and railguard ranking. This is local code-source parity, not independent upstream Oberlabs validation.

Known gaps: source `strategicMove()` can run compound Moscow relief and source `sweepMove()` applies multi-stage sweeps. Neither is represented by the current common AI planner. The new `legacy-replacement-*` pilot skips strategic movement and combat. It must not be enabled as the default policy.
