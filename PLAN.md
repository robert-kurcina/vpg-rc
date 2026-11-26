# Russian Campaign — Stable release and computational improvement

Revision 525 | Five independent browser games; shared engine, renderer and CRT.

## Accepted baseline

Battle for Moscow, The Arduous Beginning, Target: Leningrad, Objective: Kiev and Kiev–Odessa are functionally complete for the accepted scope. Historical rules and Standard CRT remain defaults. Optional Advanced CRT, graduated victory and Moscow symmetric double stacking are retained. No source-bound rules, artwork, AI decisions or save formats may change merely to improve speed.

- [x] Historical gameplay corrections and focused rule regressions.
- [x] Five-route staged repository-relative browser acceptance, IndexedDB persistence, Undo/Redo, mandatory Fleet/stacking/combat decisions and mission-scoped abandonment.
- [x] Startup failure/retry, reduced motion, responsive controls, shared terrain references.
- [x] Continuous historical browser campaigns; Moscow terminal restore, occupied-hex movement and interrupted/resumed AI equivalence.
- [x] Fundamental performance remediation and committed split bundle.
- [x] Representative controlled Operational AI equivalence: Kiev seed 7, grade 3/3, 433 exact receipts, Soviet victory, 28.9405s Chromium vs 22.038s Node (1.31x), exact persistence.
- [x] PR37 run 45759279572: all eight active jobs passed. Operational parity intentionally skipped because prior PR34 run 45758205484 passed all nine jobs.

## Explicit dispositions

- REJECTED: Oberlabs UX parity as a design goal or acceptance criterion (author decision). Historical rules/CRT provenance retained.
- DEFERRED: cosmetic UX, responsive redesign, and HTML rulebook editorial improvements. Correct concrete functional defects only. No new visual mockups.
- DEFERRED: WebGL unless measured rendering bottleneck; unified grand campaign absolute last.
- EXTERNAL: third-party redistribution permissions unresolved; do not declare unrestricted public release.
- LIMITATIONS: representative operational parity is not exhaustive across scenarios/difficulties; AI grade strength ordering remains provisional; source-bound Leningrad deployment and Odessa candidate provenance retained. No new calibration quota.

## Active non-UX work

1. [x] Consolidate accepted release plan and preserve historical evidence. Retain private staged release builder; remove obsolete runtime files only after identifying actual unused dependencies.
2. [ ] Profile current Node Operational AI campaign with existing runner, seed 7 grade 3/3, Kiev, Standard CRT, historical victory. Separate setup, actual campaign execution and post-run verification using explicit profile window. Report sampled inclusive/self costs and exact journal fingerprint. Preserve raw CPU profile artifact. Compare unprofiled baseline and profiled result on same runner. No production instrumentation or new dependency.
3. [ ] Address highest measured JavaScript hotspot with a narrow change; preserve legality, search order, RNG, all committed receipts and save integrity. Reuse focused tests and controlled comparison; revert if benefit absent.
4. [ ] Evaluate Web Worker isolation for expensive AI only if main-thread latency warrants it; do not confuse responsiveness with compute speed. Keep main-thread authoritative validation and deterministic transaction boundary.
5. [ ] Prototype one suitable WASM kernel only after measurement and optimized JS baseline. Include marshalling and allocation in comparison. Reject prototype if end-to-end gain does not justify maintenance.
6. [ ] Integrate only successful kernels, with JS fallback and exact deterministic equivalence. Keep browser-only runtime. No wholesale rewrite.

Provisional performance targets: 1.2–1.5x end-to-end improvement, 1.8x stretch; not a commitment or measured result. Do not change AI effort or policy to achieve them. No new test framework or large simulation sweeps. Prefer one substantive measured improvement per PR.

## Evidence

Full prior plan preserved at plans/archive/PLAN-revision-524.md; earlier provenance at plans/archive/PLAN-revision-490.md. Use existing tests and CI artifacts. No claim of public release rights or exhaustive operational parity.
