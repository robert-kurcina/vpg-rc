# Russian Campaign — Playtesting and maintenance

Revision 532 | Active implementation CLOSED | Author-led playtesting

## Accepted scope

Five independent browser games: Battle for Moscow, The Arduous Beginning, Target: Leningrad, Objective: Kiev and Kiev–Odessa. Shared engine, renderer and Standard CRT; scenario-specific source configuration. Historical defaults retained, including original Moscow stacking. Optional Advanced CRT, graduated victory and symmetric Moscow double stacking retained.

- DONE: historical gameplay implementation within agreed scope; human/human, human/AI and AI/AI; source-bound map and counter rendering; save/resume, Undo/Redo, mission-local storage, startup and recovery.
- DONE: immutable topology reuse, canonical campaign snapshot reuse, ZOC indexing and reproducible split browser bundles.
- DONE: integrated browser acceptance, four historical live campaigns, focused rules, source references, static distribution and controlled operational parity. PR44 run 45765064661: nine active jobs passed; optional CPU profiling skipped.
- DONE: general optimization and repository release consolidation. No further implementation milestone is required.

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

## Active backlog

None. Await author playtesting feedback.
