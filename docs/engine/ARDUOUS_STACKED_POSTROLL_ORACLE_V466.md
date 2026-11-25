# Checkpoint 232 / v466 — Arduous stacked-defense consequence completeness audit

## Purpose and scope

Examine the actual shared post-roll consequence catalogue against the printed *The Arduous Beginning* rules, using 100% source-certified Arduous hexside connectivity and photographed source counter faces. The battle positions and strength states are **deliberately synthetic** and are **not** asserted to be the game’s historical opening or a real Turn 1 combat.

No gameplay implementation change is required. This checkpoint adds a source-bound regression and its audit, not a new stacking rule or map revision.

## Source authority

`references/rules/arduous-rules.pdf` (SHA-256 pinned in `rules/audit/arduous-stacked-postroll-v466.json`):

- §8.1: At most two friendly units in one hex; at most one Soviet Army. A Soviet Army and a Corps, or two Corps, may stack.
- §10.2: Both defenders must defend together, but no more than one attacking unit can cross a given hexside.
- §10.6: DRL requires a defender step loss, then a surviving unit retreats. EX requires an attacker step-loss payment and any surviving defender retreats; advance after combat is limited to one surviving attacking unit.

This test uses the existing project-selected common Oberlabs B4M CRT, rather than silently restoring the separate printed chart.

## Source-grounded differential cases

1. **Stacked EX, Forest 0309:** An original full-strength Soviet Army and untried Soviet Mechanized Corps are placed together at an Arduous source-verified Forest hex; two genuine German Corps attack from adjacent verified hexes 0209 and 0409. The committed die is **2**; authoritative result is EX. An independent candidate generator builds all explicit attacker step-loss subsets, either defender loss, legal joint/single defender retreat routes *after* losses, and eligible advance choices. The normal historical session validates every proposed action. Exactly **54 distinct legal consequences** result. The UI catalogue contains exactly those 54—zero missing, zero extras.
2. **Stacked DRL, Open 0505:** A source-authentic reduced Soviet Infantry Army (photographed reverse face 4-4) and an untried Mechanized Corps share the Open hex. Two German Corps attack from verified adjacent hexes 0405 and 0605. Committed die **6** yields DRL. The same independent method finds **18** legal consequences, all present in the UI catalogue, including the legal choice of *either* defender to lose the compulsory step. No extras.
3. **One attacker per hexside:** Placing both German attacking Corps in origin hex 0405 and trying to use both against 0505 is rejected by the authoritative declaration transaction, in accordance with §10.2.

The tests verify individual outcomes, casualty events, retreat metadata, historical face pairing, deterministic original state, exact Undo, and save/restore of resolved actions.

## Validity limits

- The oracle is **independent of the action-catalogue enumeration**, but its retreat routes and ultimate legal/illegal decisions use the common source-certified retreat adjudicator and authoritative campaign engine. This is not a separately implemented rules engine.
- The **54 and 18 counts apply only to these two bounded positions**. They are not proof of general consequence completeness or proof that the 4,096-trial safety limit can be removed.
- Other later-turn stacks, long joint-retreat order searches, overstack extension choices, and large multi-attacker EX distributions remain separately open.
- No historical counter identity or original deployment authorization beyond the sourced counter faces and the selected candidate fixture is asserted.

## Reproduce

```bash
node tests/arduous-stacked-postroll-oracle-v466.test.js --write-audit
```

The test produces `rules/audit/arduous-stacked-postroll-v466.json`. The seven-turn headless Arduous campaign and selected cross-game combat, retreat, Kiev, and city-rendering regressions were also run separately. A long legacy post-casualty suite exceeded its execution window; that test is **not** counted as passed.

## Preservation

All existing files in the v465 package manifest were byte-identical before updating the checkpoint documents and package manifest. No shared engine, scenario policy, source map, counter art, City-dot rendering, or common CRT was changed. The Battle for Moscow optional two-unit stacking study remains second-to-last priority; unified grand campaign remains last.
