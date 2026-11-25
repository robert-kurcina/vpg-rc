# Checkpoint 286 / v520 — naval return admission and versioned campaign journal

## Historical source

`references/rules/odessa-rules.pdf` §15.3 **Evacuating Ports** permits a Soviet ground unit stacked with the Black Sea Fleet to move by naval transport to another friendly-controlled Port or evacuate off-map. A transported unit makes the §15.1 Damage Check. An evacuated survivor can **re-enter on a future Game Turn as a regular Reinforcement** (e.g. evacuated Turn 4, may re-enter Turn 5, 6, or 7).

The rule does **not** expressly prescribe a separate evacuation phase or a special evacuation-return entry hex. Both remain distinct matters from basic transaction correctness.

## Newly implemented

1. **Regular-reinforcement re-entry**: The shared naval module now provides an atomic, non-mutating transaction for a surviving evacuated unit to return on a later turn. The shared `historical_buildup_phase` supplies its *ordinary source-approved Soviet entry-edge*, enemy-occupation, EZOC, and national-stacking predicates. The original source face, reduced/full state, and identity are preserved; the evacuation reserve record is consumed once. A unit originally placed as a scheduled reinforcement can also be evacuated and later return.
2. **Campaign action**: `place-evacuated-reinforcement` is admitted only during the Soviet buildup phase when a source-qualified naval policy exists. The source-legal action catalogue projects only accepted regular-entry hexes.
3. **Commit before rolling**: Diagnostic `declare-naval-ground-transport` and `roll-naval-ground-transport` actions are separate journal transactions. Declaration validates the unit, source Fleet/port, destination, and stacking without using a damage roll. The subsequent d6 resolves the naval damage and either port transport or off-map evacuation.
4. **Explicit phase gate**: These transport actions require the `naval-ground-transport` permission on the Soviet **special-movement** phase. This is a *test-only timing hypothesis*, NOT an established Odessa historical rule. **The actual Kiev–Odessa phase configuration has NOT been granted this permission.** The campaign remains disabled.
5. **Undo/replay/save/restore**: Both actions use the existing canonical, hash-verified historical campaign journal. Pending declarations cannot be skipped, and Undo restores the prior state. Unrelated legacy snapshots remain unchanged when there is no pending naval declaration.

## Evidence and limitations

- `tests/odessa-naval-return-v520.test.js`: source-registered Odessa ports and original Kiev Soviet photographed counter faces; all six damage die outcomes, no same-turn return, no forged ledger, no duplicate return, input immutability.
- `tests/historical-naval-journal-v520.test.js`: **synthetic isolated phase-permission harness** reusing Leningrad's previously certified map/roster/buildup machinery to test generic campaign journaling and actual reinforcement-edge admission. It **does not** claim that Leningrad historically has Odessa's naval evacuation rules; no historical Leningrad data or configuration files are changed.
- Existing B4M-compatible CRT, source rulebooks, maps, approved water layering, counter sheets, and TEC were not modified.
- The combined Odessa initial setup, territorial movement, port and victory isolation, evacuation timing authority, historical seven-turn gameplay, and AI remain incomplete.

## Next critical development step

Create a source-bound Kiev–Odessa opening/buildup allocation (units, scheduled reinforcement slots, available source entry borders, city control, combat/territorial profile). Reconcile unresolved Odessa evacuation timing from the original rules or obtain an explicit convention; activate naval transport only after this work and the movement/port-control graph qualify. Then run an actual full-turn campaign in the human browser with Undo/save/restore.
