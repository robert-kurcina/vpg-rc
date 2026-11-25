# Shared Solo AI integration pilot (Checkpoint 46)

`core/solo_ai.js` exports `decide(session,{policy})`, `step(session,{policy})` and `halfTurn(session,{policy,maxActions})`.

Supported policies are `safe-pass` (no optional action) and `first-legal-move` (deterministic, first legal special/normal movement). These are **non-strategic adapter test policies**, not the Oberlabs AI. Required turn-four Soviet Shock placement is selected from the shared legal choice list. All actions pass through `WargameSession.execute` and receive the same history, Undo and v2 save treatment as human actions. The default browser/AI paths are not changed.

The adapter raises rather than guessing when asked to handle setup or unresolved pending combat. It also fails on action rejection or exceeding the configured per-half-turn action bound. Complete AI migration requires source-consistent decisions for replacement, attack queue construction, the committed-die consequence choices and eventual deployment. Existing `legacy/engine.js::playSide` remains canonical until an equivalent fine-grained policy has been demonstrated.

Run `node tests/shared-solo-ai-v317.test.js` for deterministic coverage.

### Checkpoint 52: source-default combat consequence adapter

`executeLegacyCombatConsequences(session)` takes a combat-resolution session with
an already committed die and resolves the battle queue via the common action
and session API. Its optionality is deliberate: `resolveAttack` in the bundled
legacy AI already provides deterministic default loss/retreat/advance choices;
there is no distinct casualty strategy to port. Each next die is committed only
following a successful previous resolution. The shared session gives Undo and
v2 persistence. Full legacy AI `combat-declaration` logging and full half-turn
parity are **not** established; the default browser/AI remains unchanged.
