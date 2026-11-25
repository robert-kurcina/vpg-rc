# Checkpoint 283 / v517 — Black Sea Fleet two-port source qualification

## Source

`references/rules/odessa-rules.pdf` (Objective: Odessa, v1.0), specifically §§6.0(3), 10.5–10.6, 15.1–15.2, 15.5. Physical counter faces are pinned to the original `counters-odessa-front.jpg` and `counters-odessa-back.jpg` through their SHA-256 checksums.

## Qualified candidate functionality

- **Starting position:** The Soviet Black Sea Fleet starts undamaged at **Odessa (`1513`)**, paired with the Soviet Coastal Army in the opening setup.
- **Two registered destinations:** **Odessa (`1513`)** and **Nikolaev (`1811`)**, validated by exact named city markers on the authentic combined 261-cell board and source-pinned hostCell IDs.
- **Relocation:** During the Soviet Special Movement Phase the Fleet may transfer to the *other* Soviet-controlled port. It cannot relocate into an Axis-controlled destination or one containing Axis ground units; a missing city-control ledger fails closed.
- **Damage:** On each voluntary transfer or forced relocation, roll a d6 *after* declaring the destination. Only **1** inflicts damage. An undamaged Fleet becomes damaged; a damaged Fleet is eliminated upon another hit. Inputs remain immutable and actions replay deterministically through Undo and save/restore.
- **Combat effect:** When undamaged and co-located with Soviet ground forces at the Fleet's port, defending Soviet units receive a one-column protective shift (−1 attacker odds), and Soviet units attacking from that port receive one positive shift (+1 attacker odds). A damaged Fleet loses these shifts but still allows eligible defenders to ignore retreat elements as separately provided by §§10.6/15.2.
- **Forced destination ownership:** The Odessa candidate requires `cityControl` evidence for each port; absence is an explicit error, **not** inferred Soviet ownership. Inability to find any other Soviet-controlled receiving port eliminates the Fleet without a damage roll as prescribed after §15.2's text continuation.

## Shared engine design

The existing `core/historical_port_support.js` supports both **2-port** and **6-port** configured Fleet rules without scenario-ID-specific conditionals. Existing Leningrad six-port behavior and its unit-source verification remain unchanged. The optional `portHexes` and `destinationControlMode: city-control-v1` keys are source-pinning and authorization data, not second engines. Odessa's `maps/phase-configs/kiev-odessa.json` declares `move-support` during Soviet Special Movement, but is still `phase-simulation-only`.

The candidate lives in `maps/combat-configs/kiev-odessa-black-sea-fleet-candidate-v517.json` and is not selected by the production human game gateway.

## Verification

- 310 new assertions across exact source evidence, 2 ports × 6 dice × 2 damage conditions, combat support, forced destination control, negative/tamper cases, source-registered phases and deterministic replay.
- Existing Leningrad Fleet opening/movement (716), combat-retreat (54), forced displacement (768) all pass.
- Romanian Air REFIT (78) and previously approved 13-row TEC Chromium (21) pass.

## Deliberately not yet qualified

1. Full Kiev–Odessa live opening setup, source-complete 20-city control ledger and movement graph authorization.
2. Air-versus-Black-Sea-Fleet §15.5 attacks and their complete commitment/turn phases.
3. Convoying replacements §15.3, evacuation/transport §15.3 (duplicate printed section number), and return as subsequent reinforcements.
4. Historical capture-driven Fleet displacement through the full campaign controller: the pure transition is exercised, not the campaign entry pipeline.
5. Complete Kiev–Odessa victory isolation/terminal state and strategic AI qualification.

**Status:** source-qualified *candidate*, not an active playable Kiev–Odessa game.
