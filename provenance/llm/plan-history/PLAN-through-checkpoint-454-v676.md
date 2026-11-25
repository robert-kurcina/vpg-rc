# PLAN — Russian Campaign

**Revision 455 | Production baseline: v676 / checkpoint 454**

## Objective and release definition

Deliver five independent, historically faithful browser wargames with human or computer control of either faction, reliable mandatory decisions, save/resume, and practical desktop/mobile usability. Use the shared production engine and renderer, scenario configuration, one common B4M CRT (Standard default, Advanced optional), and approved SVG artwork. Preserve the existing native B4M path; no architecture migration, BFF, anti-cheat infrastructure, or map redesign. Historical fidelity, functional playability, competitive AI strength, and optional balance research are separate claims.

## DONE — retain established evidence

- All five maps, counter sets, core rules transactions, deployment, reinforcements, replacements and CRT variants implemented. Cumulative complete headless campaigns: 10/10 scenario/CRT combinations, not a fresh v675 regression.
- All five browser routes verified for automatic faction control, independent strategy and difficulty, persistent player configuration and representative save/restore. AI interruption implemented; Moscow automatic campaign reached terminal state, terminal browser save/restore still unverified.
- Arduous temporary overstacking and owner-selected phase-end removal corrected (v655); Advanced seed 42 complete after correction. Kiev Exchange casualty alternatives and browser workflow verified. Odessa 32 exterior Soviet reinforcement sides/16 entry hexes and focused isolation checks passed; source-pinned experimental authorization is not full historical certification.
- B4M minimum odds settled: reject below Standard 1:1 / Advanced 1:2; retain automatic NE where required by other scenarios including concealed strengths. No reopening.
- Performance: v665 complete Odessa 61.927 s measured; v667 100-action mean 8.196 s measured. Further full-campaign projections are not verified. Parallel runner supports all five scenarios.
- Ten selectable effort profiles implemented and persisted; grade zero preserves strategy defaults. Competitive ordering is not established. Experimental combat, positioning, reserve and lookahead policies remain optional; rejected equal-budget experiment remains rejected.
- Offline graduated victory evaluator supports weighted city ownership across all five scenarios; Moscow held at Turn 7 is the decisive German override. No approved VP weights, thresholds or production victory mode.
- v675 shared Rules & Charts dialog: all five desktop Chromium routes passed 63 assertions. Sequence of Play, How To, Terrain Effects and active CRT tabs implemented. v676 adds shared structured engine-derived TEC rows, consistent attacker-column signs, scenario-specific original illustrated player aids, and approved Kiev engine specimens plus existing combined chart link. All five routes passed focused desktop checks across separate runs. Complete per-scenario illustrated engine-rendered TEC adaptation and mobile interaction still open.

## Active release-critical work

### P1 — Historical rulings and material defects (WIP; author decisions pending)

| Item | Current behavior | Proposed ruling / action |
|---|---|---|
| B4M §9.3 Stand Fast | Automatic loss and hold on Major City DR | Defender chooses step loss and hold or normal retreat |
| B4M §§5, 10 city ownership | Destination capture only | Capture each city actually entered on the committed legal path |
| Leningrad §5 | Two 13-city cases unclassified | Soviet victory if Leningrad is connected or another city alone remains Soviet; preserve printed isolated-Leningrad draw and 14-city German victory |

The Leningrad proposal is a house adjudication, not explicit printed text. Preserve existing defaults until approved. See `docs/engine/HISTORICAL_RULE_DECISIONS_435.md`. Do not block independent development.

Arduous v671 Brest-Litovsk post-roll catalogue fix passed exact replay of the blocked Turn 2 position; full corrected seed 61 (Standard, Axis 10 / Soviet 1) remains unverified. Resume this specific campaign when practical. Do not reopen settled geography or rerun all ten scenarios merely for assurance.

Exit: three rulings resolved or explicitly accepted as documented compatibility choices, approved changes implemented, relevant regression evidence, no known reproducible play-blocking defect left unaddressed.

### P2 — Integrated browser acceptance and essential UX (WIP)

Complete representative automatic browser campaigns for Arduous, Leningrad, Kiev and Kiev–Odessa; verify Moscow terminal browser save/restore. Reuse existing browser harnesses and actual shipped assets. Exercise human ownership, mandatory decisions and AI/human transitions where not already verified. Verify mobile viewport and dialog interaction, including Escape isolation from controls drawer; physical device testing remains unavailable unless supplied. Fix demonstrated failures; distinguish transport/timeouts from gameplay defects. Move blocked tests to final release gate rather than repeatedly retrying them. Existing early Kiev–Odessa human acceptance does not substitute for a full automatic browser campaign.

Exit: all five production routes complete representative campaigns, mandatory decisions accessible, deterministic saves and continuation verified, no reproducible play blockers, essential desktop and mobile-viewport usability. Document remaining source and environment limitations; do not claim unsupported certification.

## Independent feature work — proceed while P1/P2 blocked

### P3 — Oberlabs workflow parity (WIP; immediate implementation focus)

1. Compare actual remaining workflows with Oberlabs: city ownership display, movement/combat controls, phase transitions, settings, desktop tooltips and mobile map viewport. Fix consequential differences first; retain approved artwork and renderer.
2. Finish active-scenario TEC presentation using authoritative source and engine configuration, with source/adaptation distinctions; preserve active CRT, colors and shared reference dialog. Avoid duplicate rule values.
3. Complete responsive and accessible reference interactions; keyboard focus, labels and touch targets. Reuse shared UI, not separate scenario-specific copies.

Exit: documented meaningful workflow differences closed or explicitly accepted; shared references and actual browser interactions tested. Exact cosmetic replication is not a release gate. Full mission selector, HTML rulebooks and standardized Redo remain P6.

### P4 — Difficulty calibration (PARTIAL; bounded research)

Retain ten existing profiles and compatibility sentinel. Moscow evidence shows overlapping strengths; prior expected-utility and positioning experiments do not establish superiority. Do not tune repeatedly on the same seeds or equate action budgets with intelligence. Run representative grades 1/5/10 with fresh paired faction swaps across the four larger scenarios, starting with the corrected Arduous case. Use equal-grade controls and record scenario-specific wins, territory and failures. Only change policy in response to demonstrated deficiencies. No requirement for all 45 pairings or statistically distinct adjacent grades before historical release.

Exit: representative evidence across all five scenarios, documented strength overlap and any verified improvements, honest UI description of provisional effort grades until calibrated. No hidden information, biased dice or changed historical rules.

### P5 — Optional graduated victory (PARTIAL; scoring decisions needed)

Retain historical default. Nine grades (four per faction plus draw); Moscow held at Turn 7 gives decisive German victory. Existing equal-grade Moscow samples are exploratory: 1/24 German historical victories across the two 12-game samples; narrow city distributions. Latest 12 games yielded five ownership patterns and twelve ownership-plus-step-loss pairs. Distinct patterns do not establish valid scoring weights. Cumulative losses include restored steps; other scenarios lack verified comparable loss reports.

Next: agree on strategic city weights, isolation relevance, whether casualty efficiency merits secondary credit, and Soviet decisive definition. Collect bounded equal-policy samples across all five scenarios using existing parallel runner; report draws and uncertainty. Separate calibration from held-out seeds, test alternative competent policies and rerun with AI pursuing candidate objectives. Aim for German wins plus half draws near 50% (45–55%, preferably 48–52% if supported); do not force balance or widen draws artificially. Only after author approval implement selectable mode, AI objective adaptation, saved configuration and terminal UI. No historical rule changes or claims of human balance based solely on simulations.

### P6 — Shared mission selector, HTML rules and toolbar (PLANNED)

Implement after higher-priority feature work. Full detailed previously approved specification retained below. Shared mission menu, scenario-scoped persistence, accessible HTML rulebooks and authoritative TEC/CRT reference, exact Undo/Redo and safe save/discard/cancel transitions. Do not duplicate the engine or renderer.

### P7 — Additional performance (DEFERRED)

Dedicated effort deferred by author; resume only for measured gameplay/throughput blocker or clear later benefit. Immutable source fingerprint/graph reuse predicted 10–20% reduction, not measured; remaining combat and movement caching conditional. Browser workers only for demonstrated latency. No speculative transposition tables, principal variations, Zobrist hashing or incremental pathfinding on critical path.

### P8 — Optional B4M two-unit stacking study (DEFERRED, second-to-last)

### P9 — Unified grand campaign study (DEFERRED, absolute last)

## Next development increment

Continue P3 with meaningful city ownership and movement/combat workflow gaps. The shared TEC table and original printed references are implemented in v676; complete remaining scenario-specific chart adaptations only where needed for actual play. Independently resolve P1 rulings when the author responds and pursue bounded P2/P4 runs where the environment permits. Do not issue another audit-only distribution. Do not start another Moscow-only tuning or scoring batch before its purpose and criteria are established.

## Operating policy and evidence

- Group related implementation, focused tests and documentation; no micro-checkpoint or audit-only release cadence.
- Reuse cumulative evidence; rerun changed paths or meaningful milestone acceptance only. Record complete versus incomplete runs and actual errors. Preserve deterministic journals, concealed information, backward-compatible saves and historical defaults.
- Keep active plan concise with DONE/WIP/PLANNED/DEFERRED/REJECTED. The full revision 453 plan and detailed checkpoint evidence remain in the original v675 archive and its `provenance/llm/` records; earlier complete plan archived at `provenance/llm/plan-history/PLAN-through-checkpoint-434-v667.md`. No evidence deleted.
- Use actual engine/browser renders for game evidence, never generated or unrelated web images. Browser-only shared architecture remains mandatory.
- Revision 454 is a replacement planning document only: no production source changes, tests, or new gameplay package.

## DEFERRED — ordered by priority (last item is absolute lowest)

1. **THIRD-TO-LAST — Shared mission menu, HTML rules and reference UX:** Convert the supplied original PDF rules for all five scenarios into accessible, responsive HTML, retaining section numbering, tables, examples, illustrations where needed, and source provenance. Identify approved engine adaptations separately; do not silently rewrite printed rules. Use one shared viewer and scenario-configured content. Hamburger menu: Choose Mission (save/discard/cancel when switching an active mission), Save Mission, Resume Mission, See Rules, See TEC, See CRT, Abandon Mission (explicit destructive confirmation, scoped to current mission), Exit Game (Save / Don't Save / Cancel; save to localStorage before leaving to mission selector, never claim browser tab closure). Menu icons and labels occupy one horizontal line per clickable row with fixed icon-column width and vertical alignment. Toolbar identifies the full active mission title; Undo and Redo are separate side-by-side mirrored curved-arrow controls outside the menu, independently enabled only when history exists in their direction, disabled at approximately 25% opacity. Settings uses a separate gear icon. Keep toolbar on one row where width permits; desktop tooltips and mobile touch targets. TEC and CRT must reuse authoritative active scenario data and CRT mode, preserving the approved outcome palette. Undo/Redo is scoped to each mission instance, reusing existing validated Undo/journal mechanisms where supported; verify Redo capability rather than assume it exists. Redo must replay exact committed dice and choices, preserve pending decisions and clear the redo branch on a divergent committed action. Persist mission-specific state and history with version/configuration compatibility checks; handle unavailable or full localStorage without reporting a successful save or losing the active mission. Disable unavailable actions, preserve concealed information and existing AI turn policy. Mobile-first overlays, keyboard navigation, focus restoration, accessible icon labels and actual browser tests across all five scenarios. Implement at P6 after higher-priority feature work; essential usability fixes belong to P2/P3.
2. **SECOND-TO-LAST — Battle for Moscow two-unit stacking exploration (study only):** Investigate an **optional variant** allowing up to two combat units per hex. Use *The Arduous Beginning* stacking restrictions as the baseline to assess Army/Corps combinations, movement, combat, retreat, ZOC, supply, reinforcement placement, AI and victory-balance effects. Identify B4M-specific incompatibilities and acceptance tests before considering any implementation. The official one-unit-per-hex Battle for Moscow rules remain the default; no variant is enabled.
3. **ABSOLUTE LAST — unified/grand campaign exploration (study only):** Consider linking all five historical configurations only after independent scenario playability and all higher-priority development and deferred work are resolved. Geographic registration, timeline reconciliation, counter identity and campaign rules will be assessed then. Do **not** build a combined campaign, merge maps or alter existing game rules now.

## REJECTED

- Separate renderer/engine/CRT for any scenario; default legacy B4M; fabricated river hexsides or revival of 25 discarded incidental contacts.
