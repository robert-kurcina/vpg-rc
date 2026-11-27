# Russian Campaign — Playtesting and maintenance

Revision 539 | Gameplay implementation CLOSED | Codebase rationalization planned | Author-led playtesting

## Accepted scope

Five independent browser games: Battle for Moscow, The Arduous Beginning, Target: Leningrad, Objective: Kiev and Kiev–Odessa. Shared engine, renderer and Standard CRT; scenario-specific source configuration. Historical defaults retained, including original Moscow stacking. Optional Advanced CRT, graduated victory and symmetric Moscow double stacking retained.

- DONE: historical gameplay implementation within agreed scope; human/human, human/AI and AI/AI; source-bound map and counter rendering; save/resume, Undo/Redo, mission-local storage, startup and recovery.
- DONE: immutable topology reuse, canonical campaign snapshot reuse, ZOC indexing and reproducible split browser bundles.
- DONE: integrated browser acceptance, four historical live campaigns, focused rules, source references, static distribution and controlled operational parity. PR44 run 45765064661: nine active jobs passed; optional CPU profiling skipped.
- DONE: general optimization and repository release consolidation. No further gameplay implementation milestone is required.

## Current activity

The author will examine UX through actual play. No speculative UX changes, automated UX redesign, new feature development or optimization campaign is authorized. Do not initiate changes until concrete playtesting feedback or an explicit new request is supplied.

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

## Active backlog — codebase rationalization

P0 initial measured baseline: [inventory](docs/codebase-inventory-p0.md). Complete tracked tree measured; targeted source metrics and production controller call sites verified. Run the read-only inventory script against the pinned commit and review remaining candidates before closing P0. Inventory PR introduced no runtime changes.

P1a: proposed IndexedDB rejected-open recovery, with shared concurrent attempts and late blocked-request isolation; existing transaction fixture extended and wired into focused CI. Test execution pending CI. P0 remains open; this confirmed defect does not depend on broader reachability analysis. P1b/c: page-lifetime toolbar/mission ownership guards and removable callback subscriptions implemented; existing hosted browser acceptance checks duplicate mount identity, conflicting owner rejection, single controls/dialog and disposal/resubscription. No general DOM teardown: controllers each own a single page, so replacement requires navigation; subscription disposal is supported independently. Tests pending CI. P1d: acquire operation guard before callbacks, always release even if status refresh fails, distinguish declined confirmations from completion, and allow dialog Cancel without a storage operation. Hosted acceptance extends cancellation checks for all five missions. P1 implementation complete pending CI qualification; P0 inventory review remains open. P0 follow-up: run the existing read-only inventory on the pinned baseline and current commit in CI and publish both JSON reports; review reports before closing P0. P2a: remove private pass-through legacyStorage and collapse identical exception handling for storage access/read; no change to fallback policy. Extend existing IndexedDB regression for accessor/read SecurityError with and without primary storage, and unexpected errors. No module deletion authorized by lexical counts. P1 qualified by successful main run 46052529487. PR51 inventory and focused-rules jobs succeeded (run 46052603474); downloaded reports reviewed and quantitative findings appended to inventory. P0 measured baseline now established; targeted complexity and dynamic reachability review continues per candidate. P2b/P3a: consolidate portable JSON export transport across both browser controllers using existing player_save_config module (all five routes verified by literal edges). Preserve names and formatting; attach/remove anchor consistently, delayed revocation, report export failures. Hosted real-browser download checks added, pending CI.

Author-requested maintenance initiative; gameplay implementation remains closed. Work in priority order, with independent reviewable PRs and narrow changes. Subtraction before abstraction; no framework migration, speculative architecture, feature work or arbitrary reduction target.

| Priority | Status | Work and exit criterion |
|---|---|---|
| P0 | IN PROGRESS | Establish a pinned baseline: tracked handwritten JS/Python and HTML/controller inventory, function counts, complexity hotspots, duplicate/near-duplicate candidates, dependency/reachability map including HTML entry points, dynamic/global registrations, fixtures, build and CI scripts. Separate generated runtime, assets, evidence and archived materials. Record baseline test commands and current results; do not invent coverage or removal estimates. |
| P1 | DONE | Fix confirmed lifecycle/recovery defects in core/mission_storage.js: retry after rejected IndexedDB open without invalidating a newer connection, explicit repeated mount contract, removable subscriptions, and consistent busy/cancel/failure handling. Test concurrent opens, failure/retry, mount twice, reject conflicting owner, dispose/re-subscribe, storage commits, tombstones and notification behavior. Confirm actual call sites before choosing lifecycle contract. |
| P2 | IN PROGRESS | Remove only proven unreachable or superseded handwritten code, stale wrappers and duplicate implementations. Establish caller and external entry-point evidence first; distinguish archive from deletion. Keep production bundle inputs, source evidence and useful regression fixtures. |
| P3 | IN PROGRESS | Consolidate genuinely equivalent reusable functions, starting with serialization/integrity helpers in historical campaign/human/deployment modules and communication evaluation in autoplay. Preserve separate canonical vs ordinary JSON byte contracts, validation limits, error behavior, cache ownership and deterministic ordering. No generic utility dumping ground or abstraction for superficial similarities. |
| P4 | OPEN | Decompose high-complexity functions in historical_campaign_autoplay.js, historical_campaign_session.js and UI controllers. Extract pure calculations and validators before touching orchestration; preserve action order, tie-breaks, phase transitions and random draws. Use measured hotspots, not arbitrary line-length targets. |
| P5 | OPEN | Normalize contracts in touched code: explicit input/output and ownership, pure queries vs commands, boundary validation, errors, naming, resource acquire/release, and repeat-call semantics. No mass formatting or mechanical renaming. |
| P6 | OPEN | Rationalize development scripts, tests and fixtures with dependency evidence; merge equivalent harnesses but preserve distinct assertions, historical cases, reproducibility and CI coverage. Prefer existing tools; no elaborate new test framework. |
| P7 | OPEN | Reconcile active documentation and archive superseded development material with provenance intact. Verify linked files and packaging; no bulk removal. |
| P8 | OPEN | Compare measured baseline/final inventory, remaining hotspots and known risks; qualify five production games and supported variants, old saves, Undo/Redo, seeded replay/receipt equivalence, browser bundle parity, static packaging and representative performance. Close when remaining debt has no justified maintenance benefit; document deferred items. |

### Function contracts

- Repeated initialization, synchronization, assignment and cleanup must have defined behavior; duplicate mounting/listeners and poisoned retry state are defects. Stateful game commands are not universally idempotent: a second action may be illegal. Do not silently deduplicate legitimate actions.
- Prefer deterministic pure functions for computations; isolate DOM, storage, RNG and state-transition side effects. Preserve detached snapshots and immutable successor sessions.
- Reuse only identical semantics; keep scenario distinctions in configuration and historical rules authoritative. Preserve serialization bytes, save/checksum formats, error contracts, iteration order and RNG/tie-breaking.
- Establish existing callers and regression coverage before deletion/extraction. Avoid new dependencies, wrappers and complexity unless justified.

### Acceptance and tracking

For each PR record affected paths, evidence of debt, before/after measurements where meaningful, compatibility constraints, tests actually run and remaining limitations. Run relevant existing regressions per change; regenerate bundles from source when required. Gate rules/session/AI changes on exact controlled receipts and saved-state replay, UI/storage changes on real browser lifecycle and persistence where feasible, and packaging changes on static distribution verification. Compare performance on the same configuration; investigate material regressions rather than set an arbitrary speed target. No new rules, art, default policy, UX behavior or save-format changes.

Initial targeted scan confirmed repeated mounting has no guard/teardown, subscriptions lack disposal, and a rejected IndexedDB open can remain cached. Impact in normal single-mount navigation has not been established. Duplicate helper implementations and AI complexity are candidates, not proof of dead code. Repository-wide search returned no results; full inventory is P0, and no debt percentage is claimed.
