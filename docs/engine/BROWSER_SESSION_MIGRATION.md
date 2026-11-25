# Browser migration: checkpoint 37

This is an intentionally opt-in **movement-only** migration pilot.

The default Battle for Moscow browser still executes the established Oberlabs-style
`legacy/ui.js` path. An automated test may set `window.B4M_SHARED_SESSION_MOVEMENT=true`
**before** `legacy/ui.js` loads. In that mode, legal map-click movement is
adjudicated through `WargameSession.execute`, which delegates to the shared
`WargameActions` boundary and then the same legacy B4M engine. It uses the
existing human UI controls and existing visual renderers.

The pilot translates the legacy serialized Undo snapshots to shared session
snapshots on each movement action, then translates them back for the existing
Undo button. This is a compatibility bridge, **not** full migration of Undo
ownership, phase transitions, combat choices, replacement controls, or AI.
Legacy Undo deliberately resets used-unit and transient selection state, as
before. Snapshot conversion does not reconstruct used-unit history from older
legacy UI snapshots, so extending this approach to arbitrary mixed-action
Undo chains without a single session source of truth would be unsafe.

`tests/b4m-browser-shared-movement-v317.py` launches two independent Chromium
contexts containing the same bundled UI: default and opt-in shared-session
movement. It compares actual map-click movement, used-unit rejection, Undo,
and replay, including exact game states and UI metadata. It is **not** an
independently fetched upstream Oberlabs browser comparison.

Next integration requirement: eliminate split history ownership by migrating
all production UI action dispatches and history together, not by expanding
ad-hoc serialized history conversion. Keep this movement pilot off by default
until complete browser action parity is proven.

## Checkpoint 39 — persistent ownership pilot (opt-in, not production)

Set `window.B4M_SHARED_SESSION_OWNERSHIP_PILOT=true` **before** `legacy/ui.js`
loads to use one persistent `WargameSession` for map-click movement, phase
completion, and Undo. This experimental flag is separate from the older
`B4M_SHARED_SESSION_MOVEMENT` bridge. It does not translate the legacy Undo
stack on each move. The session is established at a clean Undo boundary and
maintains its own game-state snapshots, used-unit sets, and phase transitions.

**Important observed difference:** after Undo reverses phase advancement, the
bundled Oberlabs-style UI clears its `used` set, while the shared session
restores the set from before advancement. The game board states agree, but
movement availability may differ. This is *not yet UX parity*, so the new path
is opt-in and not suitable for a production cutover. Do not silently change
baseline Undo semantics to match a preferred rule interpretation.

The pilot is scoped to movement, phase completion without declared combats,
and Undo. Starting it with a pre-existing legacy Undo stack is rejected. Any
nonmigrated legacy action that calls `saveUndo()` after session ownership starts
is rejected. Combat consequence choices, setup, replacements, AI, and import
still require cohesive migration. The pilot is explicitly not a general mixed
legacy/shared history bridge. `tests/b4m-browser-session-ownership-v317.py`
exercises actual map clicks, phase button, and Undo in two Chromium contexts.

## Checkpoint 41 — two queued human combats (2026-11-18)

`tests/b4m-browser-session-multicombat-v317.py` exercises two spatially
independent, legal attacks using real browser map selection, attack declaration,
phase commit, consequence-resolution buttons, nested Undo, and replay against
both the default bundled B4M UI and the opt-in persistent WargameSession pilot.
Twelve comparison checkpoints assert equal full game states, including both
pending combat dice. This is a local parity fixture, **not** direct upstream
Oberlabs validation. The test-only fixture creates suitable units/positions;
production scenario placement and AI behavior are not inferred from it.

The default remains the original B4M browser. Do not cut over until setup,
replacement, reinforcement, AI, import/export, transient UI selections, and
mixed-action Undo share a verified owner. The phase-Undo used-unit difference
identified in Checkpoint 39 remains unresolved.
