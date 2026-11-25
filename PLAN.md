# Russian Campaign — release completion
Revision 484 | Baseline v701 / checkpoint 479 | Decisions approved; implementation pending

This plan carries forward the six deliverables in revision 483. The full historical baseline plan is retained in the v701 distribution. No additional release milestones.

| Priority | Deliverable | Remaining work |
|---|---|---|
| P1 | Historical rules and gameplay | Implement the three approved adjudications below; preserve versioned save/replay compatibility and regression-test affected scenarios. Arduous seed-61 qualification already passed. |
| P2 | Gameplay UX and mission interface | Complete semantic rulebook review and current interactive browser workflows, including Support window decisions, tablet use, mission persistence and terminal restoration. |
| P3 | AI difficulty | Implemented in v695. Preserve mappings and strategy defaults; comprehensive strength calibration deferred. |
| P4 | Graduated victory | Existing experimental territorial scoring accepted; historical default unchanged; no further balance calibration required for release. |
| P5 | Moscow double-stacking | Existing optional nonhistorical variant accepted; targeted EX/DRL/DR/Stand Fast cases passed. Retain historical single stacking default. |
| P6 | Integrated acceptance and release | v701 fresh historical headless checks 10/10 before approved rules changes. Reverify affected behavior after implementation. Full current browser campaigns, actual hosted IndexedDB and public redistribution clearance remain open. |

## Approved adjudications

- Battle for Moscow §9.3: defender chooses step loss and hold (Stand Fast) or normal retreat.
- Battle for Moscow §§5,10: capture each city actually entered on a committed legal movement path.
- Target: Leningrad §5: award Soviet victory in otherwise unclassified 13-city outcomes; retain German victory at 14 and the printed isolated-Leningrad draw. This is an approved house adjudication, not printed text.

These are approved, not implemented or tested as of this repository bootstrap. Do not silently reinterpret earlier saves or invalidate existing evidence.

## Protected configuration

Five independent scenarios: Battle for Moscow, The Arduous Beginning, Target: Leningrad, Objective: Kiev, Kiev–Odessa expansion. Shared engine/renderer/CRT, Standard default and Advanced optional. Novice 1, Standard 3, Expert per scenario 8/4/7/7/7; retain strategy default 0 and legacy numerical save values. Graduated victory and Moscow double stacking remain optional. No grand campaign or further large AI calibration during release completion. No generated game visuals. Browser-only runtime, no backend.

## Acceptance and publication

Use prior valid evidence; rerun affected tests only when appropriate. Distinguish isolated browser fixtures from real hosted navigation and storage. Public distribution requires confirming rights for third-party rules, artwork and other source materials. The repository's software license does not grant rights to third-party assets. GitHub Pages publication has not occurred.

Next: import the v701 baseline, implement approved adjudications, validate affected saves and rules, finish current browser acceptance and semantic review.
