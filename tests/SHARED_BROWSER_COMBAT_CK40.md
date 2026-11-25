# Checkpoint 40 — shared browser combat pilot

This is an **opt-in** B4M session ownership test, not an upstream Oberlabs oracle.

Run `python tests/b4m-browser-session-combat-v317.py`. It executes the actual browser UI in two Chromium contexts: original bundled B4M vs `window.B4M_SHARED_SESSION_OWNERSHIP_PILOT=true`. A test fixture creates a legal adjacent engagement. User-visible map/candidate-button selection, combat commit, result choice confirmation and Undo are run through normal UI controls.

The session pilot now delegates `declare-battle`, `remove-last-battle`, `finish-phase` (combat commitment/roll), and `resolve-pending` to `WargameSession.execute()`. Undo uses `WargameSession.undo()`. The default implementation is untouched and remains authoritative. Combat selections (`combatChoice`) remain transient, while combat declarations, pending die, seed, and state history are session-owned. Defender markers in the pilot are rebuilt from declarations after Undo. This is *not* yet a full browser migration: setup, replacements, reinforcement, AI, import/export and arbitrary mixed-action history are outstanding. The previously observed phase-Undo used-unit difference is not resolved.
