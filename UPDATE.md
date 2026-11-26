# Current repository status — revision 532

The five-game accepted scope and original performance objective are complete. PR40 CI run 45763742040 passed all ten jobs. Kiev controlled campaign retained 433 exact receipts; same-run Node acceleration 1.878x. Oberlabs UX parity and WASM are rejected. PR44 final acceptance run 45765064661 passed all nine active jobs. The final controlled campaign retains 433 exact actions; Chromium 10.589s and Node 8.076s. Active implementation is closed; UX feedback will come from author playtesting. See PLAN.md for maintenance policy. Third-party redistribution rights remain unresolved.

The checkpoint entries below are preserved historical records; their open items describe the status at the time, not current requirements.

---

# Checkpoint 479 / v701 — resumable historical acceptance

All ten fresh historical scenario/CRT combinations now complete. Runner-only checkpoint/resume added; see PLAN.md and rules/audit/release-v701/. Hosted and full interactive acceptance remain open.

# Checkpoint 478 / v700 — Leningrad historical acceptance

Two complete historical seed-476 default-policy Leningrad campaigns, both CRTs; 6/10 fresh release combinations covered. Remaining four jobs: `node scripts/run-campaign-batch.js rules/audit/release-v700/remaining.json new-output-directory 1`. Kiev attempt timed out before terminal report. No runtime changes.

# Checkpoint 477 / v699 — fresh Arduous acceptance

Two complete historical seed-476 default-policy Arduous campaigns, both CRTs; 4/10 fresh release combinations now covered. Remaining six jobs: `node scripts/run-campaign-batch.js rules/audit/release-v699/remaining.json new-output-directory 1`. See PLAN.md. Batch timed out; no partial campaigns counted.

# Checkpoint 476 / v698 — historical qualification and static release staging

Completed Arduous seed 61 Standard, internal grades 10/1 (494 actions, exact terminal restore) and both fresh Moscow historical CRT runs at seed 476 (277/261 actions, exact restore). Retain reports and journals in rules/audit/release-v698/. Reproduce: `node tests/historical-operational-qualification-v644.test.js arduous standard 61 5000 campaign baseline greedy same 10 1`; `node scripts/run-native-campaign.js standard 476 5000 0 0` and same with `advanced`. The static builder creates a private, repository-relative website with no lab/evidence directories and manifest verification. HTTP HEAD checks passed, Chromium navigation remains blocked by administrator policy. Public redistribution rights and full browser acceptance not certified. No production gameplay changes.

# Checkpoint 475 / v697 — stacked EX and DRL browser acceptance

Added reproducible committed-roll browser tests for explicit EX/DRL defender loss, separate retreat destinations and no advance; EX attacker priority, exact restoration and Undo/Redo verified. No runtime changes. Reproduce: `python3 tests/b4m-double-stack-human-v697.py`. See PLAN.md.

# Checkpoint 474 / v696 — numbered rule cases

Added direct numbered-case navigation across all five source rule readers. All 133 case/subcase occurrences and 70 major headings are verified against the supplied PDF text; duplicate printed numbering is preserved. Moscow §9.1 split text fragment corrected against the page facsimile. Text-only rebuild preserves original PDF and image bytes. Semantic tables and full reading-order review remain open. No engine changes.

Reproduce: `python3 tests/rulebook-cases-v696.py` and `python3 tests/rulebook-navigation-v693.py`. Existing source movement/combat/consequence/final, stacked foundation and shared CRT tests passed. See PLAN.md for unchanged open decisions and acceptance gates.

# Checkpoint 473 / v695 — named AI presets

Author-approved Novice 1, Standard 3, Expert 8/4/7/7/7 across the five scenarios. Strategy defaults retained. Legacy numbered settings round-trip without migration. All five browser routes passed save/restore checks with isolated fixtures; internal profiles unchanged. Broad AI calibration deferred. See PLAN.md and rules/audit/named-ai-v695.json.

# Checkpoint 472 / v694 — terminal outcome UX

Four larger missions now show the actual final outcome and city totals rather than just announcing completion. Experimental results retain separate historical adjudication. AI controls cannot execute at terminal. Eight prior campaign journals replayed with all action hashes intact and passed actual isolated Chromium file import, result display, save/resume, Undo/Redo and exact restoration. Reproduce with the scenario-specific command in README; fixture saves are bundled. No fresh balance study or engine/rule changes. Real-origin storage and full browser campaign gates remain open. See rules/audit/terminal-ui-v694.json.

# Checkpoint 471 / v693 — mission persistence and rulebook navigation

A complete native Moscow mission exceeds common localStorage limits because the portable save retains each committed Undo snapshot. Measured seed 71: historical Standard/single, 8,881,295 bytes and 276 snapshots; experimental Advanced/double/graduated, 8,492,100 bytes and 268 snapshots. Preserve every snapshot; use IndexedDB for mission-local saves with atomic per-mission payload/presence metadata, deletion tombstones, legacy localStorage read compatibility and fallback, commit-before-navigation, and same-origin refresh. Existing portable JSON and game configuration fingerprints unchanged. Exit dialog initial focus is Cancel; restore-on-entry locks interaction until completion. The fallback remains quota-limited and storage clearing/eviction can still remove local data: portable JSON backups remain advisable.

Verification: Node storage/Redo legacy tests and large-save transaction fixture test passed. Five mission-menu browser regressions passed using existing isolated storage transport; historical and experimental full terminal saves passed exact checksums, full retained history, terminal display, Undo/Redo, Save Mission, Resume Mission and safe exit focus in actual isolated Chromium with quota/transaction fixture. The latter is not real IndexedDB acceptance. Five HTML readers now jump to all 70 verified original major headings, with 24 unchanged page facsimiles and source PDF hashes verified. Semantic transcription/table review remains open. Browser bundle parity passed. Local server selector HTTP 200; real-origin Chromium navigation blocked by `ERR_BLOCKED_BY_ADMINISTRATOR`. `tests/mission-hosted-v693.py` is provided for the actual real-origin check, not claimed passed. Full original rule adjudications, larger-game browser terminal checks, and hosted release remain outstanding. No historical engine, AI, victory profile, map or counter changes; no added milestones.

Reproduce: `node tests/mission-indexeddb-v693.test.js`; `python3 tests/rulebook-navigation-v693.py`; `python3 tests/mission-terminal-browser-v693.py` (runs both seed-71 games); see README for real-origin test. Compact audit: `rules/audit/mission-persistence-v693.json`.

# Checkpoint 470 / v692 — Moscow calibration evidence

70 played campaigns, 60 unique seeds, exact terminal restore throughout. See PLAN.md and rules/audit/graduated-moscow-v692.json. Runtime and thresholds unchanged.

Reproduce with `VICTORY_MODE=graduated node scripts/run-native-campaign.js standard SEED 5000 GRADE GRADE` (default grade 0, seeds 1001–1040 and 2001–2020; grade 5, seeds 2001–2010). No historical rule modifications. Retrospective thresholds are not fresh played outcomes. Existing scoring and pairing regressions pass (542 + 586 assertions, 12 pairing checks).

# Checkpoint 469 / v691 — cross-scenario controlled graduated victory

The v690 analyzer incorrectly assumed Moscow's report schema for all campaigns. It now accepts both native winner and historical terminal outcome, checks the nested score and terminal ledger, compares canonicalized policies and ledgers, distinguishes unresolved source outcomes from draws, and reports per-scenario summaries. No engine, renderer, AI policy, rules, save format or VP threshold change.

Reused 16 complete v690 Moscow reports and 18 compatible v689 reports. Excluded the two unpaired Moscow Advanced seed 137 reports because stacking differed. Ran eight fresh campaigns (four matched pairs): Leningrad Standard seed 41; Arduous, Kiev and Kiev–Odessa Advanced seed 79. All fresh jobs exited successfully, reached the terminal phase and restored exactly. Fresh seeds are independent of the corresponding v689 larger-scenario runs; not independent policy samples.

## Combined results (actual played modes)

| Scenario | Pairs | Distinct seeds | Graduated G / S / D | Actual German VP | German win + half-draw rate |
|---|---:|---:|---:|---|---:|
| arduous | 3 | 3 | 1 / 2 / 0 | 5, 5, 8 | 33.3% |
| battle-for-moscow | 9 | 6 | 8 / 0 / 1 | 6, 7, 7, 7, 7, 8, 8, 9, 9 | 94.4% |
| kiev | 3 | 3 | 1 / 1 / 1 | 7, 9, 14 | 50.0% |
| kiev-odessa | 3 | 3 | 0 / 2 / 1 | 7, 8, 10 | 16.7% |
| leningrad | 3 | 3 | 0 / 2 / 1 | 5, 6, 7 | 16.7% |

Historical outcomes: 0 German, 21 Soviet, 0 draws, 0 unresolved. Graduated outcomes: 10 German, 7 Soviet, 4 draws. 16/21 paired final ledgers differ. Aggregated win rates mask the independent scenario distributions; do not use the aggregate to calibrate.

The nine Moscow pairs produced 8 German wins and a draw, with German scores 6–9 and no German decisive result (holding Moscow would override the grade). At fixed observed results, moving the draw score from 6 to 7 would yield 4 German, 1 Soviet, 4 draws (66.7% German plus half draws); moving it to 8 would yield 2 German, 5 Soviet, 2 draws (33.3%). This is sensitivity only, not evidence of actual play after an altered profile. Do not create a broad draw band merely to meet an aggregate target. The larger scenarios have only three seed/CRT pairs apiece; no stable threshold recommendation. Preserve the approved historical defaults and the provisional experimental profiles until author review. Existing P4 calibration and P6 release gates remain open; do not add new milestones.

Verification: 12 pairing controls; 542 graduated profile assertions; 586 weighted scoring assertions; 780 historical research assertions; 237 Arduous and 192 Kiev victory assertions; 4,814 Odessa isolation assertions; mission Redo regression; 64-module browser bundle parity and 36 Chromium naval assertions. No fresh browser terminal or hosted acceptance claimed.

Reproduce the analysis from this archive:

`node scripts/analyze-graduated-pairs.js rules/audit/graduated-victory-v689.json rules/audit/graduated-controlled-v691.json`

Reproduce fresh campaign runs using the existing batch runner with `rules/audit/checkpoint469-jobs.json` and `rules/audit/checkpoint469-larger-jobs.json` in separate new output directories. The audit retains actual report payloads, not just summary statistics. No need to rerun archived campaigns merely to compute this comparison.
