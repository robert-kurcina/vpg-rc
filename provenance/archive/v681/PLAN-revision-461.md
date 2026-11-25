# Russian Campaign — Development plan

Revision 461 | Production baseline: v681 / checkpoint 459

## Objective

Finish the five independent historical browser games: Battle for Moscow, The Arduous Beginning, Target: Leningrad, Objective: Kiev and Kiev–Odessa. Preserve the shared engine/renderer, existing native B4M path, scenario-specific rules, common B4M CRT (Standard default; Advanced optional), approved maps and counters, and browser-only operation.

## Active plan — five deliverables only

| Priority | Deliverable | Status | Completion criterion |
|---|---|---|---|
| 1 | Historical rules and playable campaigns | WIP — nearly complete | Resolve the three outstanding rulings, verify the Brest correction, and close remaining material integrated gameplay acceptance gaps. |
| 2 | Oberlabs gameplay UX | WIP — immediate implementation | Close consequential differences in existing gameplay and reference workflows; adequate desktop/mobile viewport usability. |
| 3 | Human/AI opponents and difficulty | WIP — implemented, calibration partial | Retain functional control of either faction and ten selectable profiles; complete bounded representative cross-scenario comparisons and correct demonstrated blockers. |
| 4 | Optional graduated victory | WIP — research evaluator exists | Approve scoring criteria, calibrate provisional thresholds using existing simulations, and integrate the approved mode without changing historical default. |
| 5 | Unified mission interface and rulebooks | WIP — selector, menu, local saves and Undo/Redo implemented | Deliver the previously approved mission menu, HTML rules, toolbar, Undo/Redo and mission-scoped save/resume workflows. |

### 1. Historical rules and playable campaigns

Three decisions remain. Preserve current behavior until the author approves a correction or accepts the existing compatibility choice.

| Scenario | Issue | Proposed resolution |
|---|---|---|
| B4M | §9.3 Stand Fast | Defender chooses step loss and hold or normal retreat. |
| B4M | §§5, 10 city ownership | Capture each city actually entered on the committed legal movement path. |
| Leningrad | §5 unclassified 13-city outcomes | Soviet victory if Leningrad remains connected or another city alone remains Soviet; retain isolated-Leningrad draw and 14-city German victory. This is a proposed house adjudication, not explicit printed text. |

One targeted Arduous campaign remains to verify the v671 Brest-Litovsk fix (Standard CRT, seed 61, Axis grade 10/Soviet grade 1). Integrated acceptance: representative complete automatic browser campaigns for the four larger games and Moscow terminal browser save/restore; exercise human decisions and transitions only where evidence is missing. Check essential mobile viewport behavior. Fix actual failures, not hypothetical defects. Environment-blocked checks belong in the final acceptance gate; proceed with independent work and report any unresolved verification honestly.

### 2. Oberlabs gameplay UX

Use actual Oberlabs workflows as the comparison baseline. Finish consequential city ownership display, movement, combat and phase-control differences, and shared settings/reference/tooltip and mobile interaction gaps only where they affect play. The v676 structured TEC and original illustrated aids are accepted as the reference foundation; no exhaustive illustrated TEC recreation is required. Reuse shared UI and preserve approved artwork. Exact cosmetic replication is not a completion condition. Perform focused interaction checks as part of implementation, not as separate milestones.

### 3. Human/AI opponents and difficulty

Human-vs-Human, Human-vs-AI in either faction, AI-vs-AI, automatic faction control, persistent independent strategy/difficulty and interruption are already implemented. Do not rebuild them. Retain the ten profiles and strategy-default sentinel. Use bounded fresh faction-swapped comparisons at grades 1/5/10 across the four larger scenarios with equal-grade controls where useful; record overlap and failures. Correct demonstrated defects only. No exhaustive 45-pair tournament, proof of separation of every adjacent grade, or speculative Moscow-only tuning. Describe uncalibrated levels as provisional effort profiles rather than proven strength ranks. Historical rules, concealed information and dice remain unchanged.

### 4. Optional graduated victory

Retain historical victory as default. Nine outcomes: four victory grades per faction plus draw. German control of Moscow at Turn 7 is the decisive German override. Existing offline evaluator supports weighted city ownership; no approved weights or thresholds yet. Obtain author decisions on strategic city weights, isolation, secondary casualty contribution and Soviet decisive criteria. Use existing parallel runner for bounded calibration and independent validation; compare competent policies pursuing the candidate objectives. Target 45–55% German wins plus half draws (prefer 48–52% if supported), not artificial balance. Integrate approved mode, AI objectives, terminal display and saved configuration together. Do not confuse cumulative restored step losses with permanent losses or claim human balance from AI simulations.

### 5. Unified mission interface and rulebooks

Implement the existing approved specification, not an expanded redesign: shared mission selector; responsive HTML versions of original rules with numbering, tables, necessary illustrations and source/adaptation distinctions; authoritative active TEC/CRT; mission title and separate Settings; menu actions Choose Mission, Save Mission, Resume Mission, See Rules, See TEC, See CRT, Abandon Mission, Exit Game. Save/discard/cancel and destructive confirmation must be scoped to the current mission; exit returns to selector, not forced browser closure. Use scenario-scoped localStorage with failure handling and compatibility checks. Separate mirrored Undo/Redo controls, disabled when unavailable (approximately 25% opacity); exact dice/choice replay, preserve pending decisions, clear divergent redo branch. One-row toolbar where feasible, aligned menu icons and labels, usable touch targets and accessible labels/focus. Reuse existing journal and UI; verify actual Redo support before extending it. No separate engine or renderer.

## DONE — do not reopen without a demonstrated defect

- Five maps/counter sets, core transactions, deployment, reinforcements/replacements, common Standard/Advanced CRT; cumulative headless full-campaign evidence 10/10 configurations (not fresh v676 full regression).
- Browser faction control and persistent independent player settings verified on all five routes; representative save/restore and interruption implemented. Moscow reached automatic terminal state; terminal browser restoration remains in deliverable 1.
- Arduous temporary overstacking and owner-selected phase-end removal; Kiev Exchange alternatives and browser workflow; Odessa 32 exterior Soviet entry sides/16 entry hexes and focused isolation checks. B4M minimum odds settled: Standard 1:1, Advanced 1:2; retain other scenarios' automatic NE when required, including concealed strengths.
- Shared Rules & Charts dialog, Sequence of Play, How To, active CRT, structured TEC, original player aids and original rulebook access; all five desktop routes checked. Mobile verification remains in deliverables 1–2.
- Existing movement/validation caching, static topology reuse, lighter state processing, parallel runner (five scenarios). Last measured complete Odessa campaign 61.927 s (v665); later v667 100-action mean 8.196 s, not a verified full-campaign time.
- Ten difficulty profiles and persistence; optional experimental AI policies; offline weighted victory evaluator and Moscow casualty evidence. Do not describe competitive calibration or production graduated victory as complete.

## DEFERRED — not active requirements

In priority order: additional performance optimization (resume only if author reprioritizes or a demonstrated material blocker requires a fix); optional B4M two-unit stacking **study** using Arduous as a starting point (second-to-last; original one-unit default unchanged); unified/grand campaign **study** (absolute last; no map merge or timeline integration now). Advanced search caches, transposition tables, principal variations, incremental hashing and pathfinding are not scheduled deliverables. Exact original detailed deferred specifications remain in v676 revision 455.

## Scope and completion control

- These five deliverables are the entire active scope. No new milestones or acceptance criteria without author approval. Implementation details and tests stay inside their parent deliverable.
- Historical release is complete after deliverable 1, functional opponents from deliverable 3, and essential usability from deliverable 2 are accepted. Competitive calibration, graduated victory, exact cosmetic parity and unified menu are not historical release gates; they remain requested enhancements.
- Work on deliverable 2 immediately while rule decisions or browser execution are blocked. Combine related changes in substantive releases. Do not issue audit-only packages or repeat passing tests unless affected by a change or final integrated acceptance.
- Mark DONE only against the stated criterion. A blocked test is not proof of a gameplay defect or a pass. Record concrete residual limitations once; do not turn them into new projects. If a deliverable cannot be closed because of an author decision, present that decision once and proceed independently.
- Preserve existing deterministic journals, backward-compatible saves, concealed information, approved assets and source provenance. Use actual engine/browser renders for game evidence. No BFF, anti-cheat engineering, fabricated river hexsides, revival of the 25 rejected incidental contacts, separate renderer/CRT, or default legacy B4M.
- Keep historical evidence in provenance. The complete prior plan is `rc_dev325/PLAN.md` in the v676 archive; revision 455 is the source for detailed accepted specifications and evidence. This replacement supersedes its active priorities, not its historical record.

v677 progress within deliverable 2: live city ownership markers across all five games, direct legal movement selection in four historical routes, and map-driven combat proposal filtering. Chromium verified all five opening city displays and Arduous selection, declaration, resolution and exact undo. Native city ledger and terrain-reference regressions passed. Other movement paths, mobile interaction and complete combat workflow parity remain unverified. Next: close consequential combat/phase-control and mobile workflow gaps; no new milestones.


v678 progress within deliverable 2: committed battle selection on the map, conflict prevention for staged declarations, explicit clearing of staged battles and filter-independent phase completion. Arduous Chromium interaction and exact Undo passed; 112 source-validated action discovery assertions passed. Shared interface applies to the four larger scenarios; other routes and touch interaction not separately verified. No additional milestones.

v679 progress within deliverable 2: mobile map-to-Orders/decision handoff after movement declaration, route ambiguity, battle selection and retreat preview; move support overlay above the Controls launcher to prevent obstruction. Actual Arduous Chromium touch viewport (820×1180) passed movement selection/cancellation, explicit resolution, exact Undo, map-first return, Controls reopening, combat proposal selection and committed battle selection with exact Undo. Desktop combat regression and 112 action catalogue assertions passed. Multiple-route and retreat handoffs and other routes/devices not independently exercised. No new milestones. Next: close practical remaining gameplay UX against existing criteria and proceed to unified interface or bounded difficulty calibration; do not turn optional cosmetic or device-specific work into new requirements.


v680 progress within deliverable 5: root mission selector now links the five historical routes; old development catalogue preserved as mechanics-lab.html. All five routes use shared mission-scoped localStorage Save/Resume and scoped deletion, plus Save/Discard/Cancel when returning via Choose Mission. Existing portable JSON and authoritative restore validation retained. Isolated actual Chromium checks passed for selector, Arduous and Moscow local save, exact restore after state change, cancellation and Arduous deletion. Hosted navigation blocked by administrator; real cross-page browser storage and other three route interactions not yet verified. No new milestone. Remaining at v680 in deliverable 5: standardized toolbar, Undo/Redo, complete HTML rulebooks and remaining approved navigation actions. Deliverable 2 remains at its existing practical workflow criterion; no cosmetic or additional device requirements added.


v681 progress within deliverable 5: shared header toolbar with separate Undo/Redo and Settings; hamburger menu with mission-scoped Save/Resume, Choose, See Rules/TEC/CRT, Abandon and Exit, plus existing local deletion and map export. Redo restores the exact previously committed successor session without rerolling; divergent committed actions clear the redo branch. Browser-session redo is intentionally transient; the existing portable save retains committed state and Undo history, not abandoned future branches. Navigation prompts pause automatic AI before opening, and the existing local save validation remains authoritative. Isolated Chromium checks passed all five routes for history and menu controls, exact local restoration, reference tabs and focus return, Exit/Abandon cancellation, and unchanged saves while reading charts. The recorded Kiev Exchange fixture passed 20 assertions including exact die and casualty-choice Redo and clearing Redo on Load. Arduous touch test at 820×1180 passed map workflow and toolbar Undo/Redo with the drawer open. Node history and storage tests passed. Full HTML rulebooks, hosted cross-page persistence, confirmed Abandon/Exit navigation and final integrated acceptance remain outstanding under the existing deliverables. No new milestones or gameplay changes.
