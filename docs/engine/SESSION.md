# Shared action session — Checkpoint 36

`core/session.js` is an additive human/AI session state manager over `core/actions.js`.

- `create({scenarioId, config, state, engine?})`: validates the existing executable B4M phase, copies the supplied game state, and starts with empty history and used-unit tracking.
- `legal(session, request)`: delegates to the shared action interface with the session's used-unit IDs.
- `execute(session, action)`: validates via the shared API, advances an accepted state transition, snapshots game state and per-phase used-unit IDs, and refuses duplicate movement by the same unit in the same phase.
- `undo(session)`: restores the preceding accepted game state **and** used-unit IDs, including committed dice and battle queues.
- `canUndo(session)`: indicates whether there is an accepted state transition to reverse.

Rejected actions return the identical input session and do not create history entries. Queries and non-mutating previews do not create history entries. An accepted `finish-phase` clears phase-use tracking; Undo restores it. The legacy human UI clears transient selection controls after Undo; those controls are deliberately outside this session and remain a deferred compatibility matter.

**Not migrated:** browser bootstrap/event handlers and AI policies still call their existing paths. This is **not** a claim of an active universal gameplay runtime for other scenarios. Before changing production UI bindings, add browser-level click/Undo/die parity tests against the current shipped B4M UX. No geography or counter rendering code was changed.

**Future implementation caution:** session snapshots currently use JSON-compatible B4M state. Avoid exposing mutable session internals to consumers or using this as a persistent save format without explicit serialization/versioning. A generic action protocol must eventually accept each scenario's configured phase permissions, not B4M-only phase strings.

## Checkpoint 45 — versioned persistence (opt-in browser only)

`WargameSession.serialize(session)` creates a JSON-compatible `wargame-session`
format version 2 record with scenario ID, engine ID, game state, per-phase used-unit
IDs, and all prior accepted-action snapshots. The executable `config` is never
embedded in the save: `restore(payload, {scenarioId, config, engine?})` requires
the application's validated configuration. It rejects wrong format/version,
scenario/engine mismatch, invalid unit identities, invalid used-unit references,
invalid history snapshots, illegal phases, and invalid board placements.

When `B4M_SHARED_SESSION_OWNERSHIP_PILOT===true`, browser Export produces a v2
session save; Import restores the full session and Undo history. Importing a
legacy v1 `{version:1,state}` save is supported, but the historical save format
did not include Undo history: the new session starts at the imported state
with empty history and used-unit tracking. In normal/default browser mode the
legacy v1 export/import behavior is unchanged; a v2 session is not imported
into that mode. All imports are validated before overwriting current UI state.

**Not yet covered:** save continuity for an in-flight AI task, arbitrary mixed
legacy/shared histories, cross-version schema migrations, or the known legacy
phase-Undo used-unit difference. Persistence is limited to the tested B4M
adapter and does not activate unfinished historical scenarios.
