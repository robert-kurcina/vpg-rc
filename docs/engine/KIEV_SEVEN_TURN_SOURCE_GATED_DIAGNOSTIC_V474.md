# Checkpoint 240 / v474 — Kiev seven-turn source-gated diagnostic

## Outcome and scope

A single isolated Node regression now carries a **source-legal but non-historical 30-counter Kiev setup** through **all seven printed turns** on the actual **165-hex Kiev source-reviewed candidate graph** using the existing shared campaign/session, combat, movement, buildup, housekeeping, save/restore and Undo implementations. The test commits **138 actions**, including **27 legal one-hex ground moves**, **one real common-CRT German attack with an original FK IV +1 marker**, **all six scheduled original photographed ground-counter reinforcements**, and **seven housekeeping resolutions**. The final reported outcome for this deliberately low-engagement sample is **Soviet victory with 2/16 Axis-held cities**. An independent 119-assertion test passes. The result is diagnostic *smoke coverage*, not a competitive or full campaign acceptance result.

## Sources and independent checks

- The original `references/rules/kiev-rules.pdf`, the definitive user-authored `maps/source/user-svg/kiev-odessa-main.svg`, and the existing `source-reviewed-edge-ledgers.json` are SHA-256-pinned.
- The candidate graph contains **165 original Kiev hexes, 442 reciprocal physical links, 93 rail links, 72 river links and 10 Major River links**. It is built by the existing shared adapter from source-checked terrain/city/hexside evidence.
- The 30 starting units are original Kiev photographed faces in a **source-legal example distribution** (`tests/fixtures/kiev-source-opening-v437.js`), not a mandatory or independently certified exact historical unit allocation. The same source allocation identifies the six reinforcements.
- The first Axis turn begins in German Combat, without a first-turn Axis buildup/movement prelude. A Romanian-deployed Axis corps is actually rejected from an initial combat under §10.8.
- A separate source-valid Polish attack is discovered by the **original legal-action catalogue**. It commits two photographed Axis attackers, the original FK IV air marker, a d6 roll and an actual common B4M CRT result on the real Kiev map. An invalid die cannot consume the marker. Full pre-roll save/restore and terminal journal replay, Undo and recommit pass.
- Each later movement is verified by the existing shared legal movement adjudicator and executed as a real campaign transaction. All six original reinforcement arrivals are placed on source-registered entry-edge hexes, not arbitrary cells.

## Exact safety boundary

The **production map graph remains `provisional`**, and the original Kiev combat policy continues to require a **complete source-certified Romanian country mask**. Neither is changed. `tests/kiev-seven-turn-diagnostic-v474.test.js` temporarily substitutes the existing pinned source candidate into an **in-memory graph-policy object inside its own Node test process**. It also makes a **test-local copy** of the Kiev combat configuration with the missing §10.8 Romanian territory mask requirement disabled. No false mask is invented. The strict unmodified combat policy is separately checked to reject the campaign, and a real Romanian-deployed corps is still forbidden from Turn-1 attack. The test restores the in-memory graph policy before exit and independently verifies that the real Kiev movement gate remains closed. It asserts the SHA-256 fingerprints of the original on-disk map and production graph authorization registry did not change.

This deliberate diagnostic exception allows integration testing while avoiding the false claim that the missing historical source was resolved. **Do not use this test-local binding for public playable Kiev, the browser, or Kiev–Odessa.** A real source-certified complete Romanian territory definition and explicit production graph review are still required.

## What the result does *not* establish

The run has **one combat engagement**, 27 deliberately short ground moves, and no strategic opponent. It does not test the entire combat-outcome tree, seven-turn contested strategy, comprehensive Soviet counterattacks against Romanian targets, alternative national stacking/retreat combinations, or all replacement/spend opportunities. It is not a Chromium gameplay test. The official Kiev browser remains **setup-only**, and the Kiev–Odessa expansion remains unplayable.

The new regression removes uncertainty about whether the shared campaign architecture can execute all seven Kiev turn phases, six ground arrivals and the actual map's ordinary movement path, but does **not** remove the remaining source-certification blockers. It introduces **no new gameplay engine mode, browser renderer, house rule, map export, visual asset or CRT change**.

## Reproduction

From the package root:

```bash
node tests/kiev-seven-turn-diagnostic-v474.test.js --write-audit
node tests/kiev-source-reviewed-candidate-v433.test.js
node tests/kiev-ground-air-campaign-v473.test.js
python3 tools/check-package-layout-v417.py
```

The new machine-readable receipt is `rules/audit/kiev-seven-turn-diagnostic-v474.json`. The original game source and old checkpoint evidence are unchanged.
