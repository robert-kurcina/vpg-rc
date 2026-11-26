# Russian Campaign — Stable release and computational improvement

Revision 530 | Five independent browser games; shared engine, renderer and CRT.

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
- REJECTED: WASM conversion, prototypes, integration and associated fallback/equivalence infrastructure (author decision). Keep the shared JavaScript engine; original acceleration objective achieved. Historical WASM discussions below are evidence only, not active requirements.
- DEFERRED: cosmetic UX, responsive redesign, and HTML rulebook editorial improvements. Correct concrete functional defects only. No new visual mockups.
- DEFERRED: WebGL unless measured rendering bottleneck; unified grand campaign absolute last.
- EXTERNAL: third-party redistribution permissions unresolved; do not declare unrestricted public release.
- LIMITATIONS: representative operational parity is not exhaustive across scenarios/difficulties; AI grade strength ordering remains provisional; source-bound Leningrad deployment and Odessa candidate provenance retained. No new calibration quota.

## Completed non-UX work

- [x] Consolidate accepted release plan and preserve historical evidence.
- [x] Profile original Operational AI campaign and identify measured bottlenecks.
- [x] Reuse immutable validated movement topology across historical engine; preserve mutable-source validation and all dynamic legality.
- [x] Regenerate browser bundles, pass integrated browser and rules acceptance, reprofile optimized engine, verify exact same-run pre/post authenticated campaign and controlled Chromium/Node parity.
- [x] Meet original acceleration objective: 1.878x Node on same runner, observed 2.463x Chromium across separate controlled runs. No new runtime dependency.

## Remaining non-UX work — prioritized and bounded

1. [ ] **State copying and source comparisons.** Investigate redundant private snapshot/draft copying and immutable source serialization in campaign and combat sessions. Remove demonstrably unnecessary work only; preserve canonical hashes, committed transaction validation, public snapshot isolation, save formats, source authorization and journal ordering. Prefer small changes to existing modules; no serialization rewrite. Combine closely related changes where justified.
2. [ ] **ZOC evaluation.** Optimize repeated edge scans using certified immutable topology and per-position unit indexes. Preserve scenario-specific barrier rules, unit markers, eliminated units, occupancies and all current legal movement outcomes. Never cache dynamic legality across changed positions.
3. [ ] **One final controlled comparison and release consolidation.** Use the optimized PR40 engine as the new baseline. Reuse existing focused tests, exact journal/save comparisons and staged browser acceptance. Retain changes only with material reproducible improvement (provisional engineering threshold: roughly 10% end-to-end, or demonstrable latency reduction, without regression). If no worthwhile change remains, close optimization; no repeated profiling or simulation quotas. Document remaining limitations and remove confirmed obsolete temporary build machinery.
4. [ ] **Conditional Web Worker evaluation.** Only if expensive AI decisions demonstrably block the browser main thread for an unacceptable duration, investigate worker isolation. Not a release gate, not a promised speedup. Keep authoritative validation, stop/resume and deterministic receipts; reject if complexity or transfer overhead outweighs benefit.

Deferred: cosmetic UX, responsive redesign, HTML rulebook editorial improvements, WebGL unless a measured rendering bottleneck exists. Unified grand campaign remains the absolute last priority; no implementation authorization implied.

Release policy: functionally complete five-game scope. Do not expand the checklist or reopen accepted rules, assets, features or UX absent a concrete defect. Remaining optimizations are bounded, not mandatory technology milestones. No WASM, backend, new dependency or new testing framework. Third-party redistribution permission remains external.

## Evidence

Full prior plan preserved at plans/archive/PLAN-revision-524.md; earlier provenance at plans/archive/PLAN-revision-490.md. Use existing tests and CI artifacts. No claim of public release rights or exhaustive operational parity.

## Revision 526 evidence

Run 45760410222 passed nine active jobs. Kiev 433 exact receipts, baseline 20.295s, profiled 20.726s, 19,250 samples. Movement binding 45.21% inclusive, hexside inspection 41.66%, graph build 29.97%, source graph hash 14.36%, GC 6.67% (overlapping inclusive samples). Reuse privately detached frozen map/profile pairs and frozen validated bindings, mutable inputs still build afresh. Campaign/combat/human/autoplay integration; four-map regression checks and deterministic journal fingerprint gate; production regeneration pending CI. No UX changes. No measured speedup yet.

Revision 527: installer run 45763491204 passed 71 binding assertions and exact 433-receipt Kiev journal fingerprint b9bc12dd55ded1c5a41347b1ab2f704aeac27acecb1b681b5a17ccb05877bd30; 7.725s campaign execution vs earlier 20.295s (2.63x observed across separate runners), exact restore. PR39 merged including generated assets. Pre-generation browser checks failed on stale generated assets; post-generation acceptance not established (bot-triggered workflow entries have no jobs). Remove temporary installer, run normal integrated acceptance with current generated assets, same-run pinned pre-optimization comparison and fresh optimized CPU profile plus controlled Chromium/Node parity. Do not claim browser improvement until measured. Further changes depend on new hotspots; no UX or WASM changes.

Revision 528: PR40 run 45763742040 passed all ten jobs, including integrated mission-browser, static distribution, four live campaigns, focused rules, references, CPU profile and controlled operational parity. Same-run Node before 14.319s, after 7.623s (1.8784x), exact full authenticated save equality. Chromium 11.75045s vs previous 28.9405s (2.463x observed across runs); current paired Node 9.369s; 433 exact actions, Soviet victory, exact persistence. New profile: enemyZOC 8.41% self, campaign walk 7.19%, canonical 5.36%, clone 5.35%, combat walk 5.28%, canonical 5.19%, communicationIndex 4.02%, GC 3.99%, immutable-source comparison 3.73%. Costs overlap for inclusive measures. Earlier 2.63x Node observation across separate runs superseded for controlled claims by 1.8784x same-run comparison. Author rejects WASM; remove from active and deferred work. Prioritize bounded JS improvements and stop once marginal benefit no longer justifies complexity.

Revision 529: repository cleanup audit identified retained source/provenance, linked map exports and historical developer checks as intentional. Synchronize README, UPDATE, package manifest and static release metadata with PR40 acceptance; ignore local profiling/browser outputs and Python caches. No deletion of source evidence, referenced assets or runtime modules without dependency proof. No production gameplay changes. Staged distribution remains separate from source; further cleanup should be limited to demonstrably obsolete artifacts.

Revision 530: implemented bounded campaign snapshot canonical-byte reuse (fresh detached parse for each public snapshot, identical receipt hashing), and immutable incident-edge indexing for ZOC with dynamic roster checks unchanged. Added public snapshot mutation isolation and all-hex indexed-versus-scan comparisons for four historical maps, both barrier policies and changed roster. Combat public snapshot ordering left unchanged. Exact journal and same-run full save comparison plus browser bundle regeneration pending CI. Retain only if materially beneficial; remove temporary installer after generation. No UX or WASM changes.
