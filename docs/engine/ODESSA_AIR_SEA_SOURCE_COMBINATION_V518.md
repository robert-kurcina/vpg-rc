# Checkpoint 284 / v518 — Odessa §15.5 air-versus-Black-Sea-Fleet source qualification

## Purpose

Close a bounded cross-rule gap in the fifth historical configuration without claiming that Kiev–Odessa is playable. This combines the **already source-qualified** Kiev FK IV / FK V Air Corps, the Romanian **Rom I AK** Air Corps with its one-turn REFIT, and the two-port Soviet Black Sea Fleet, using the **same shared air/Fleet engine** already exercised for Leningrad.

## Original rule sources

- `references/rules/odessa-rules.pdf`, *Objective: Odessa* v1.0, §10.5: Romanian Air Support may not be used on consecutive turns; turn after use is REFIT.
- §11.0: Romanian Air Support reinforcement arrives on Turn 2.
- §15.1–15.2: Black Sea Fleet may relocate between Odessa and Nikolaev; movement may damage it; an undamaged Fleet has a one-column combat effect when supporting Soviet ground forces, and a damaged Fleet still permits eligible ground units to ignore retreat.
- §15.5: at the **beginning of the Axis Combat Phase**, each eligible Axis Air Support marker may instead attack the Fleet. One d6 **at or below** that marker's printed Shift Rating hits. A first hit damages the Fleet; a second hit eliminates it; a damaged Fleet cannot be repaired.
- Original Odessa and Kiev counter sheets and original roster overlay remain authoritative for face identities.

## Implementation

- New **diagnostic only** configuration: `maps/combat-configs/kiev-odessa-air-sea-candidate-v518.json`. It preserves the original Kiev combat modifiers and one common B4M CRT. It incorporates the source-approved two-port v517 Fleet configuration and the three aircraft from v510, with the explicit `navalAttackMode: fleet-strike-v1` option.
- The shared `core/historical_air_support.js` recognizes `fleet-strike-v1`, rejects unrecognized naval modes and rejects a Fleet-strike configuration without a source-configured Fleet. `none` still means ground-only support (Kiev), and legacy omitted mode still behaves as before (Leningrad).
- `core/historical_combat_phase.js`, `core/historical_combat_session.js` and `core/historical_campaign_session.js` now optionally propagate a **source roster overlay** so the Romanian REFIT marker and its photographed alternate face can be verified at the combat boundary and source-pinned in save/restore scope. Existing non-REFIT configurations continue to function with no roster option.
- The common air-use ledger already distinguishes `fleet` versus `ground`, enforces one commitment per Air Corps per turn, and applies Romanian cooldown based on the last actual use, **not a rigid even-turn schedule**.
- All changes are shared and configuration-driven; no `scenarioId` branch and no second renderer/CRT.

## Verification

`tests/odessa-black-sea-air-sea-v518.test.js` passes **270 assertions** against the **real combined 261-cell source map**, original counter metadata, source-rule hashes, and approved port locations (`1513` Odessa / `1811` Nikolaev). The test covers:

- German FK IV/FK V and Romanian Rom I AK eligibility, each d6 face, and one-use-per-turn exclusivity with ground support.
- First hit → DAMAGED, second hit → eliminated, attack at either source port, and no attack on an absent Fleet.
- Undamaged/DMG/removed Fleet combat and retreat protections.
- Romanian Turn 2 arrival, REFIT the turn after naval or ground commitment, later renewed availability, and unconstrained German next-turn availability.
- Forged roster arrival, invalid naval modes, omitted Fleet, bad dice, wrong combat actor, and tampered air-use histories.
- Immutable, JSON-restorable state. No player-facing Odessa campaign or controller is falsely authorized by the diagnostic configuration.

Additionally, the old Leningrad naval air, six-port Fleet, Kiev ground-only air, Romanian REFIT, historical campaign continuation, combat-choices, and real Support-window Chromium regressions pass. The approved maps, source SVGs/counter sheets, TEC, B4M CRT, and legal-hex highlight style remain untouched.

## Still outstanding (P0)

1. Source-certified Kiev–Odessa combined movement and country territory; opening ground-force and port-control roster binding.
2. Full seven-turn campaign with air-sea precombat commitment, Fleet relocation on capture, and Undo/save/restore **through a live historical browser**, rather than the pure diagnostic state rules.
3. Odessa port replacements / communication exception (§12.2 and first §15.3), evacuation & returning reinforcements (second §15.3), victory isolation and all remaining rule interactions.
4. Strategic Human-vs-AI and AI-vs-AI acceptance after independent human playability.

This checkpoint does **not** promote Kiev–Odessa out of diagnostic status.
