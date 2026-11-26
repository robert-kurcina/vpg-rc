# Russian Campaign — Release completion plan

Revision 502 | Production baseline: v701 / checkpoint 479 plus merged hosted UX PRs #1–7

## Objective

Release five independent browser games: Battle for Moscow, The Arduous Beginning, Target: Leningrad, Objective: Kiev, and Kiev–Odessa (combined base plus expansion). One shared engine, renderer and CRT; Standard CRT and historical rules are defaults. Preserve approved map/counter assets, deterministic action journals and browser-only runtime.

## Current status — authoritative working checklist

| Priority | Deliverable | Status | Remaining |
|---|---|---|---|
| P1 | Historical rules and gameplay | Nearly complete | Three adjudications verified; optional stacking/CRT and save compatibility checks remain |
| P2 | Gameplay UX and unified mission interface | Substantially implemented; runtime verification open | Reproduce and fix interaction defects, finish reference materials |
| P3 | AI opponents and difficulty | Implemented; provisional strength ordering | Demonstrated defects only; integrated verification |
| P4 | Optional graduated victory | Implemented, author accepted | Integrated verification |
| P5 | Optional Moscow double-stacking | Implemented, author accepted | Integrated verification |
| P6 | Integrated acceptance and release | Partial | Hosted browser evidence, affected regressions, distribution cleanup and rights |

Completed implementation is not equivalent to browser acceptance. Do not reopen accepted features without a concrete defect. Original scope remains six deliverables; the four batches below are execution groupings, not additional gates.

## Batch A — Complete approved historical gameplay corrections (P1)

- [x] B4M §9.3: defender chooses a legal step-loss-and-hold Stand Fast result or normal retreat.
- [x] B4M §§5,10: update city control for each city actually entered along a committed legal movement path, not merely the destination.
- [x] Leningrad §5: Soviet victory for otherwise unclassified 13-city outcomes; retain isolated-Leningrad draw and 14-city German victory. Explicitly identify this as author-approved house adjudication rather than printed wording.
- [ ] Targeted rule regression, including historical/optional stacking and CRT interactions where affected; preserve versioned save/replay compatibility, or reject incompatible versions explicitly rather than silently reinterpret history.

Revision 492: Moscow corrections implemented with a trusted version-bound policy; old native browser saves retain their original package fingerprint and behavior. New regression assertions added. Leningrad adjudication implemented in the trusted scenario policy and matching shared browser bundle; old Leningrad policy-bound saves reject explicitly rather than silently change the adjudication. Run 45748855998 passed the four existing focused rule/reference scripts, including all three adjudications. Optional stacking and save-version compatibility still require integrated verification. Exit: three changes implemented and focused regression passes. No unrelated engine refactoring.

## Batch B — Finish gameplay UX (P2, P6)

- [x] Add narrowly scoped hosted Chromium acceptance workflow reusing existing five-route Playwright test, real HTTP origin and IndexedDB; capture actual engine-rendered desktop/tablet screenshots and server logs as CI artifacts. Implementation in branch `test/hosted-browser-acceptance-497`; merged in PR #11. First run exposed shared initialization bug; PR #12 corrected it.
- [x] Hosted five-route initialization and persistence test passed in PR #12, run 45747675673: all five exact save/resume checks and mission-scoped abandonment passed; ten screenshots captured (artifact 15084530790). Visual review and interactive campaign acceptance remain open.
- [ ] Reproduce reported Moscow counter interaction issue; diagnose phase, AI ownership, SVG hit target, overlay, zoom and keyboard/touch behavior. Fix observed defects.
- [ ] Verify and correct approved toolbar: triple-line hamburger left, title, centered Undo/Redo, gear right. Exactly eight mission-menu entries. Keep direct Show/Hide information panel control, desktop independent scrolling and tablet drawer.
- [ ] Verify and correct persistent turn/faction/phase and feedback; primary action invokes existing legal handler only. Mandatory combat, retreat, support, reinforcement, deployment and stack cleanup decisions remain reachable when panel hidden. Check AI pause/stop, settings restoration, keyboard focus and selection.
- [ ] Verify grouped Settings (Players and AI, Mission configuration, Map display, Interface layout, Maintenance). Keep next-mission rules separate from immediate preferences. G/S markers optional and smaller. Remove duplicate controls and unnecessary diagnostic presentation only; retain meaningful source limitations. Confirm actual Oberlabs workflow gaps; no undefined tournament functionality without author clarification.

Revision 500: run 45748855998 passed all four focused rule/reference scripts (Leningrad 228 assertions, terrain reference 54 checks). Node 20 action-runtime annotation absent. Expanded browser test found the mobile drawer/backdrop intercepting the direct Hide panel control. Shared shell now relocates the same toggle into the persistent header on mobile and restores it to the map toolbar on desktop. Existing test exercises tablet and phone widths and captures true mobile layout; runtime confirmation passed on all five routes in run 45749472329. No rule changes.

Revision 499: merged PR #12 verified five-route real-origin persistence and mission-scoped abandonment. Existing four focused Node tests now run in an independent job in the same workflow; results passed in run 45748855998. Existing browser test additionally exercises the eight-entry menu, persistent phase text, sidebar visibility and Settings open/close/Escape restoration on all five routes in explicit mobile layout; asserts unchanged serialized game state. First execution exposed the drawer hit-target issue corrected in revision 500. No additional simulation quotas.

Revision 498: first hosted run 45747414550 passed Moscow save/resume/preservation, then failed waiting for Arduous initialization. Source review found an out-of-scope phaseConfig reference in the shared historical phase bar; use initialized sourceData.contextSettings.config.turns instead. Existing browser test now surfaces caught initialization exceptions immediately. Corrected branch runtime passed all five initial mission and persistence checks in run 45747675673. No additional rule test framework or simulation quota.

Revision 494: corrected shared Settings opening order, restore of prior mobile drawer visibility, Escape behavior, and Settings continuity when switching to mobile layout; both controllers use the same shell lifecycle. Revision 495 adds shared stable-identity keyboard focus restoration after native and historical SVG overlay redraws, plus header-height synchronization when mission navigation mounts. Browser regression pending.

Exit: functional essential workflows on all five routes, representative desktop/tablet sizes, no known reproducible interaction blockers. Use source inspection only as preliminary evidence, not a substitute for browser operation.

Revision 501: merged PR #14 verified mobile menu/panel/Settings and real-origin persistence on all five routes (run 45749472329). Moscow inspection found ambiguous direct counter selection vs legal occupied movement destination in double-stack mode and an incorrect persistent faction label during Soviet reserve redeployment. Corrected movement-only hit dispatch and phase label; added real pointer/keyboard/zoom/movement/Undo/Redo coverage to the existing hosted test. Run 45749832862 passed actual historical Moscow pointer/keyboard selection, focus, zoom, movement and Undo/Redo, as well as all five shared menu/persistence checks. Original reported issue not definitively reproduced; optional occupied-destination interaction remains to be exercised.

## Batch C — Complete reference materials (P2)

- [ ] Extend existing shared-renderer terrain specimen generator for fortification; use actual engine renders, not hand-drawn/cropped maps. Weather is a distinct conditional-effects section, not a fabricated permanent terrain tile. Active values from scenario rules.
- [x] Correct obsolete chart text (including Kiev–Odessa play status), retain original player aids and scope-specific distinctions.
- [ ] Correct reading order and paragraph reconstruction in all five HTML rulebooks, including remaining Moscow pages 3–4. Preserve numbered sections/cases, lists, tables, relevant illustrations and original wording. Retain unmodified PDFs and 24 facsimiles. Review extraction against printed sources; do not guess missing text.
- [ ] Verify source links, anchors, reproducible build and unchanged source checksums. Original rules are distinct from engine adaptations.

Revision 502: repaired unambiguous paragraph breaks, line-wrap hyphenation and recoverable combat sequence lines on Moscow pages 3–4 in both committed HTML and guarded correction manifest. No source PDFs or facsimiles changed. Existing navigation and numbered-case/reproducibility tests now run in the same CI workflow. Remaining interleaved page 3 fragments require direct facsimile review; no guessed wording. New reference checks pending.

Revision 497: hosted browser test now accepts `--evidence-dir`, recording five desktop and five tablet screenshots after each actual scenario load. A single Actions workflow installs Playwright Chromium, serves the static site, runs save/resume/abandonment checks and preserves evidence. Run 45747675673 passed all five mission persistence checks; screenshots captured, not visually reviewed.

Revision 496: active TEC renders the fortification specimen inline through the shared renderer using the source-confirmed Moscow 0501 marker and approved artwork; weather has a separate conditional table. Generator extended; standalone export and browser visual inspection pending. Corrected obsolete Kiev–Odessa play status.

Exit: accurate, readable references in the existing menu. No requirement to reproduce every decorative element.

## Batch D — Integrated release (P3–P6)

- [ ] Reuse prior valid 10/10 headless campaign coverage from v701; run affected scenario/CRT regressions after Batch A. Do not repeat large simulation sweeps solely for calibration.
- [ ] Verify human/human, human/AI either side and AI/AI using existing shared legality boundary. Preserve ten internal effort profiles, strategy-default sentinel and exact legacy values. Approved grades Novice 1, Standard 3, Expert Moscow 8, Arduous 4, other three 7. Strength ordering provisional; no new calibration quota.
- [ ] Verify optional graduated victory: four grades per side plus draw, accepted territorial thresholds, German decisive Moscow held at end of Turn 7, historical default.
- [ ] Verify optional Moscow two-unit stacking: historical one-unit default, both factions same cap, no temporary overstacking, combined defender battle, legal losses/retreats/advance/Stand Fast, exact persistence. No new balance study unless author requests.
- [ ] Consolidate final browser acceptance: five hosted routes, full browser campaign evidence for four larger games and Moscow terminal restoration or full campaign, representative pending decisions, Undo/Redo, actual IndexedDB save/resume, Exit/Abandon scope, optional modes. Reuse existing tests/mission-hosted-v693.py and applicable existing fixtures. Redo session-only, not serialized. If execution blocked, report exactly what is unverified; no unsupported pass.
- [ ] Clean static distribution; keep required runtime, README, PLAN, tests and source provenance appropriately separated. Confirm third-party redistribution rights before declaring public release. GitHub Pages already deployed; deployment success alone does not establish browser acceptance. Document remaining limitations and release decision.

Exit: one integrated acceptance decision, not repeated acceptance programs. Historical release can proceed independently of optional modes only if author explicitly accepts deferral of material optional defects.

## Execution discipline

Start with Batch A. In each development turn complete a meaningful group of changes, not just inspection. Where one task is blocked, continue independent work. Use coherent PRs and verify changed behavior before merge where possible; disclose any unexecuted tests. Keep this checklist authoritative; do not add requirements without author approval. Maintain a concise implementation record and preserve existing checkpoint evidence in the archived revision 490 plan. No repeated simulation quotas or cosmetic parity projects.

## Protected decisions

No generated visuals, backend/BFF, anti-cheat engineering, scenario-specific renderer forks, separate CRT, unapproved terrain or coordinate migration. All five historical configurations use the shared B4M CRT. Preserve source-bound Leningrad deployment limitations and Odessa experimental authorization provenance. No reopening accepted artwork or historical topology absent concrete defect.

## Deferred post-release work (in order)

Author-confirmed: complete reliable gameplay, solid desktop/tablet UX and integrated release acceptance before WASM conversion. Optimize the stable JavaScript baseline first; use WASM selectively for measured computational kernels. JavaScript remains authoritative for rules, state, validation, RNG and saves.

1. Profile real workloads.
2. Web Workers for expensive AI/simulation with authoritative main-thread validation and exact replay.
3. Optimize measured JavaScript hot paths.
4. Selective WASM kernels only after measured benefit; compact inputs, fallback and deterministic equivalence.
5. WebGL only if measured SVG rendering bottlenecks justify it.
6. Unified grand campaign — absolute last.

## Evidence and history

Prior detailed plan, checkpoint records, accepted decisions and implementation provenance preserved in `plans/archive/PLAN-revision-490.md`. Historical evidence is not automatically fresh acceptance of changed code.
