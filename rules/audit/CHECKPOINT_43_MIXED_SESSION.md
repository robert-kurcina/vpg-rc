# Checkpoint 43: continuous human mixed-action session

Baseline: consolidated Checkpoint 42. A headless Chromium test runs the bundled
B4M interface in two contexts: unchanged legacy UI action history and opt-in
persistent shared-session action history. This is *local compatibility* testing,
not an executable upstream Oberlabs comparison.

Test: `python tests/b4m-browser-session-mixed-turn-v317.py`

The test uses a controlled legal turn-two German fixture set *before* UI input.
All subsequent actions use actual browser map-click/phase/option/Undo controls.
Twelve state checkpoints check phase progression; defender-first declaration;
committed die; combat resolution; actual normal movement; end of German half-turn;
three nested Undo operations; preserved die; and bitwise-equivalent restored
combat state on replay. The replacement and special phases are traversed but
no optional action is taken within them. Separate tests cover replacement,
reinforcement and queued combats; they are not a substitute for combined history.

Observed: 12/12 checkpoints passed. Legacy and opt-in shared path generated
identical game-state objects at all twelve checkpoints; no production code
changes were necessary. The known discrepancy about used-unit tracking after
Undo of phase advancement is not exercised here and remains open.

Follow-up: add a continuous fixture involving active replacement and special
movement, test save/import synchronization of session-owned history, and migrate
AI calls behind the shared action boundary. No default cutover at this checkpoint.
