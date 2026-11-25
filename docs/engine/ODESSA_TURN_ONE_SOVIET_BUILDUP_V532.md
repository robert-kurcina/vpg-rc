# Checkpoint 298 / v532 — actual Soviet Turn 1 Buildup in Kiev–Odessa

## Outcome and source authority

A **real** Kiev–Odessa human/browser session can now advance from German Turn 1 Combat through German Special Movement, complete mandatory **Soviet Turn 1 Buildup**, and enter Soviet Special Movement and Soviet Combat. The shared human action catalogue offers exactly **Finish Buildup** at this point. A browser click commits the normal campaign transaction, which survives Undo and Save/Restore.

This narrow rule is supported by the supplied original rules: *Objective: Kiev* §4 (phase sequence), §11 (ground arrivals begin Turn 2), §12 (replacements begin **after** the first turn); *Objective: Odessa* §11 (Romanian Air Support arrives Turn 2). Therefore, Game Turn 1 Soviet Buildup has **zero scheduled ground reinforcements and zero replacement steps**. There is no legal Turn 1 placement or repair to implement. This avoids erroneously enabling provisional eastern-edge entries before the source-movement and replacement ledger has been integrated.

## Implementation

- `maps/buildup-configs/kiev-odessa-turn-one-zero-v532.json`: explicitly scoped source policy, zero allowable actions, one phase/turn/owner, source starting counts (36 ground, one Fleet support marker, 20 city-control entries), and non-certification status.
- `core/historical_campaign_session.js`: configuration-only shared opt-in for an empty first-turn Buildup. The existing Buildup engine remains unchanged for other scenarios. The new journal action is only `finish-buildup`. No placement, replacement, or later-turn Buildup is enabled. Source policy is included in deterministic Save/Restore scope binding. Unqualified later Buildup remains **unsupported**, not skipped.
- `core/historical_browser_app.js`, candidate config and HTML: the pre-existing experimental browser loads and validates the source policy and uses the same Human controller, action catalogue, phase runtime, Undo and Save/Restore. No separate Kiev–Odessa game controller.
- Shared browser bundle rebuilt from the source.
- The 36 original Kiev/Odessa ground units and distinct Fleet support marker remain unchanged through the transition.

## Acceptance and regression (executed)

| Test | Result |
|---|---|
| `tests/odessa-turn-one-soviet-buildup-v532.test.js` | PASS, 36 assertions |
| `tests/odessa-turn-one-buildup-browser-v532.py` | PASS, 30 Chromium assertions, real DOM click |
| Existing Odessa opening Node test | PASS, 82 assertions |
| Existing Odessa opening Chromium test | PASS, 44 assertions |
| Existing Odessa experimental movement | PASS, 56 assertions |
| Existing historical Buildup | PASS, 88 assertions |
| Existing campaign continuation | PASS, 110 assertions |
| Existing combat decision flow | PASS, 281 assertions |
| Kiev contested seven-turn source-gated engine test | PASS, 159 assertions |
| Kiev counter damage and buildup visuals | PASS, 38 assertions |
| Odessa Coast ZOC, Fleet, air/Fleet, naval logistics/return, victory | PASS, individual suites |
| Arduous contested seven-turn suite | **Timed out**; no pass claim |

Actual shared-engine screenshots are `rules/audit/visual/odessa-soviet-buildup-phase-browser-v532.png` (pre-commit) and `rules/audit/visual/odessa-soviet-turn-one-buildup-browser-v532.png` (after Soviet Combat entry). The offline Chromium harness resolves the existing original Support counter photo assets to data URLs; this does not modify artwork or create synthesized images.

## Honest limits and next priorities

- **Turn 1 Buildup is a zero-action source phase**, so this release establishes phase continuity, **not** reinforcements or replacement gameplay.
- Full source-scoped Buildup for Turns 2–7 must integrate the original six Kiev scheduled arrivals, any lost or rebuilt unit face identities, source-selected active composite eastern/western exterior edge (including southern extension), enemy ZOC/stacking, Fleet-port replacement exception, evacuated-unit reentry and Romanian air Turn 2. Do **not** reuse the obsolete twelve-hex inherited Kiev edge as if it were the full combined exterior.
- Setup remains one source-validated example. Implement source-checked player-selectable deployment using the same original counter IDs and audited star choices.
- Historical Romanian movement and Turn 7 isolation victory are still uncertified; unknown territory and naval phase authority remain fail-closed.
- This is **not** a seven-turn playable Kiev–Odessa game. B4M, Arduous, Leningrad and Kiev remain on their prior verified paths; no source map, CRT, TEC or counter art edits.
