# Russian Campaign — Playtesting and maintenance

Revision 543 | Gameplay implementation CLOSED | Bounded rationalization closeout | Author-led playtesting

## Accepted scope

Five independent browser games: Battle for Moscow, The Arduous Beginning, Target: Leningrad, Objective: Kiev and Kiev–Odessa. Shared engine, renderer and Standard CRT; scenario-specific source configuration. Historical defaults retained, including original Moscow stacking. Optional Advanced CRT, graduated victory and symmetric Moscow double stacking retained.

- DONE: historical gameplay implementation within agreed scope; human/human, human/AI and AI/AI; source-bound map and counter rendering; save/resume, Undo/Redo, mission-local storage, startup and recovery.
- DONE: immutable topology reuse, canonical campaign snapshot reuse, ZOC indexing and reproducible split browser bundles.
- DONE: integrated browser acceptance, four historical live campaigns, focused rules, source references, static distribution and controlled operational parity. PR44 run 45765064661: nine active jobs passed; optional CPU profiling skipped.
- DONE: general optimization and repository release consolidation. No further gameplay implementation milestone is required.

## Current activity

The author will examine UX through actual play. No speculative UX changes, automated UX redesign or new feature development is authorized. The explicitly approved bounded rationalization closeout below remains active. Do not initiate changes until concrete playtesting feedback or an explicit new request is supplied.

When a defect or improvement is reported, record the affected game, phase, device/input method if relevant, observed behavior and desired behavior. Prioritize gameplay correctness and lost or corrupted progress over inconvenience and cosmetic issues. Reproduce with existing tools, preserve accepted rules and artwork, make the narrowest appropriate shared-engine change, and verify affected behavior. Do not require the author to supply all diagnostic details before investigating. Record decisions in this plan only as needed.

## Standing dispositions

- REJECTED: Oberlabs UX parity as a development goal; retain historical rules and CRT provenance.
- REJECTED: WASM and associated conversion/prototype infrastructure.
- DEFERRED: cosmetic, mobile/tablet and rulebook editorial changes until requested or identified in playtesting.
- DEFERRED: Web Workers or WebGL unless a concrete latency/rendering problem warrants them; no automatic architecture work.
- DEFERRED: optional AI enhancements and further rule variants unless explicitly requested. Unified grand campaign is absolute last priority.
- EXTERNAL: third-party redistribution rights unresolved. Do not infer public redistribution authorization.
- LIMITATIONS: representative exact operational equivalence does not establish exhaustive coverage; AI grade strength ordering remains provisional. Source-bound Leningrad and Odessa provenance retained.

## Maintenance and evidence

Keep the browser-only runtime, one shared implementation and configuration-driven differences. Preserve source assets, historical evidence, linked map exports, fixtures and reusable tests. Generated browser bundles are runtime assets; regenerate and verify after relevant source changes. No bulk deletion without dependency evidence. Keep the staged static distribution separate from the development repository.

Final controlled Kiev (seed 7, grade 3/3): 433 exact receipts, authenticated campaign equivalence, Soviet victory; Chromium 10.589s, Node 8.076s (PR44). Original Chromium 28.941s; observed 2.733x across separate runs. Same-run topology Node gain 1.878x; subsequent snapshot/ZOC Node gain 1.114x (10.21% time reduction). Do not multiply separate-run gains as a single measured result.

Evidence: [final acceptance](https://github.com/robert-kurcina/vpg-rc/actions/runs/45765064661), [topology qualification](https://github.com/robert-kurcina/vpg-rc/actions/runs/45763742040), [snapshot/ZOC qualification](https://github.com/robert-kurcina/vpg-rc/actions/runs/45764794647). Full completed plan: plans/archive/PLAN-revision-531.md. Earlier plans 524 and 490 retained.

## Active backlog — bounded rationalization closeout

Author-approved scope reduction: prioritize return on effort; gameplay remains closed. The former P0–P8 and A–F backlog and detailed implementation history are retained in [the rationalization history](docs/codebase-rationalization-history.md), not active commitments.

Completed: inventory baseline (P0), storage lifecycle defects (P1), selected helper and controller consolidation, browser snapshot and map indexing (A), receipt hash and journal access (B), lazy AI history and command lookup (C), and active test manifest/runner (D1). PR61 corrected run [46060037699](https://github.com/robert-kurcina/vpg-rc/actions/runs/46060037699) passed all ten executed jobs including operational parity. PR62 run [46060428401](https://github.com/robert-kurcina/vpg-rc/actions/runs/46060428401) passed all nine executed jobs; optional profiling and parity skipped. The current focused suite is documented in [development layout](docs/development-layout.md).

| Priority | Status | Deliverable and exit criterion |
|---|---|---|
| R1 | NEXT | Profile before optimizing. Use existing CPU profile and operational parity jobs; compare pinned pre-follow-up revision 49afc8c9ee5bd1b7f13e5b700908e4393e517045 and current revision on the same environment, identical Kiev seed 7 / grade 3/3 / standard CRT / historical victory. Prefer multiple unprofiled runs per revision and report median and range, exact campaign equality, sampled CPU hotspots and available memory evidence. Distinguish wall time, CPU samples, heap and disk metrics; report unavailable measurements explicitly. No fabricated cache metrics or extrapolated speed claims. |
| R2 | CONDITIONAL | At most one focused optimization batch for a demonstrated material hotspot or correctness defect, then remeasure and qualify. Prefer a plausible improvement of at least 5% total workload or an independently justified reliability fix; this is a triage heuristic, not a mandatory speed target. If no candidate clears the bar, skip. |
| R3 | CONDITIONAL | Inspect the staged release core JS/CSS boundary, count and size only demonstrably unused browser files. Narrow packaging only if straightforward, evidence-backed, and meaningfully reduces deployment size or risk; preserve dynamic loading, module paths and all five routes. If dependencies are ambiguous or savings trivial, leave the existing verified distribution unchanged. |
| R4 | OPEN | Reconcile active README/PLAN/release metadata and final inventory; run existing full acceptance and representative operational parity on the final revision. Record measured results, supported saves/variants, remaining limitations and closure. No further general refactoring after this unless requested or a concrete defect is reported. |

Dropped: generic helper extraction, arbitrary function-length reduction, mass test/script/fixture consolidation, repository-wide folder moves, deletion of legacy comparison engines, historical audit relocation, and cosmetic naming changes. Keep historical evidence and source provenance at existing paths. Undo checkpoint caching, broad selective DOM rendering, Workers and other architecture changes remain deferred absent measured need. No new rules, AI doctrine, features or artwork.

A1 paired browser benchmark: 12.0867 → 11.8037 s (2.34% shorter); unchanged Node engine 9.570 → 9.391 s, so effect may reflect variance. C1 regression avoided journal reads for 20 of 32 tested decisions (62.5% of that sequence), not a total CPU reduction. No new CPU or heap claim pending R1.

Generated runtime changes must be generated and checked before presenting a review-ready PR. Preserve strict bundle verification; do not weaken CI to avoid stale artifacts.

R1 instrumentation: compare full pinned baseline and candidate worktrees on one runner, three alternating trials per revision with the same measurement-only test harness; require exact cross-revision campaign digest and existing Node/Chromium parity. Record Node process CPU time and heap endpoints (not peak heap or allocation counts); retain existing separate V8 sampled profile. Browser wall time only; hardware cache and disk metrics unavailable. PR branch triggers paired comparison and sampled profile, without changing production code. Results pending.

### Function contracts

- Repeated initialization, synchronization, assignment and cleanup must have defined behavior; duplicate mounting/listeners and poisoned retry state are defects. Stateful game commands are not universally idempotent: a second action may be illegal. Do not silently deduplicate legitimate actions.
- Prefer deterministic pure functions for computations; isolate DOM, storage, RNG and state-transition side effects. Preserve detached snapshots and immutable successor sessions.
- Reuse only identical semantics; keep scenario distinctions in configuration and historical rules authoritative. Preserve serialization bytes, save/checksum formats, error contracts, iteration order and RNG/tie-breaking.
- Establish existing callers and regression coverage before deletion/extraction. Avoid new dependencies, wrappers and complexity unless justified.

### Acceptance and tracking

For each PR record affected paths, evidence of debt, before/after measurements where meaningful, compatibility constraints, tests actually run and remaining limitations. Run relevant existing regressions per change; regenerate bundles from source when required. Gate rules/session/AI changes on exact controlled receipts and saved-state replay, UI/storage changes on real browser lifecycle and persistence where feasible, and packaging changes on static distribution verification. Compare performance on the same configuration; investigate material regressions rather than set an arbitrary speed target. No new rules, art, default policy, UX behavior or save-format changes.

Initial targeted scan confirmed repeated mounting has no guard/teardown, subscriptions lack disposal, and a rejected IndexedDB open can remain cached. Impact in normal single-mount navigation has not been established. Duplicate helper implementations and AI complexity are candidates, not proof of dead code. Repository-wide search returned no results; full inventory is P0, and no debt percentage is claimed.
