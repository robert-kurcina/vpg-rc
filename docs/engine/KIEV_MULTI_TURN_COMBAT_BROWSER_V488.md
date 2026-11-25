# Checkpoint 254 / v488 — Kiev multi-turn contested Chromium campaign

## Verified result

A single Objective: Kiev experimental human-browser campaign reaches the terminal result through **seven turns and 92 journal-hashed actions**. The same continuous campaign now includes three genuine shared-CRT battles across **Turns 1 and 3**, not merely Turn 1. Its initial 30-counter arrangement remains source-legal but illustrative; this is bounded functional acceptance rather than historical setup or strategic AI certification.

| Turn | Side | Defender hex | CRT | Evidence |
| --- | --- | --- | --- | --- |
| 1 | German | 0205 | EX | Original FK air marker; source counter reduction and legal Soviet retreat |
| 1 | Soviet | 0204 | AL | Original 18th Mechanized Corps eliminated; rebuilt Turn 2 |
| 3 | German | 0304 | DR | German air explicitly declined; Soviet defender retreats via 0404 to 0405; German attacker advances into 0304 |

The Turn 3 combat is selected from the original shared browser controller's legal attack proposals. A die value of 1 is submitted after battle commitment. The source CRT presents DR, its legal consequence catalogue contains the chosen retreat and advance, and the resulting unit locations are asserted. A forged destination `9999` is explicitly rejected **without mutating the game state** before the legitimate consequence is committed.

In the same saved game, a reduced Soviet Army is restored in Turn 2, the eliminated Soviet 18th Mechanized Corps is rebuilt at source-valid 1601 with one-step revealed identity preserved, and the reduced German Panzer Corps is restored in Turn 4. The campaign also includes one ground move, four scheduled reinforcements, and seven housekeeping phases. The shared engine adjudicates Soviet victory with Axis control of 2 of 16 victory cities.

## Reproducible acceptance

Run stages in order from the project root:

```bash
python tests/kiev-multiturn-combat-browser-v488.py --stage 1
python tests/kiev-multiturn-combat-browser-v488.py --stage 2
python tests/kiev-multiturn-combat-browser-v488.py --stage 3
python tests/kiev-multiturn-combat-browser-v488.py --stage 4
python tests/kiev-multiturn-campaign-audit-v488.py
```

The stages run in independent Chromium processes, exchange the exact original human decision gateway save envelope, and preserve uninterrupted journal-prefix and SHA-256 integrity. Final accepted totals: **80 + 84 + 63 + 35 = 262 Chromium checks**, plus **91 independent journal/audit checks**. The accepted output contains **92 actions** and the terminal screenshot was captured by the actual Chromium engine.

Evidence: `rules/audit/kiev-multiturn-v488-stage{1..4}-{save,evidence}.json`, `rules/audit/kiev-multiturn-seven-turn-v488.json` and `rules/audit/visual/kiev-multiturn-terminal-browser-v488.png`.

## Boundaries

- Only three selected battles are checked; there is **no demonstration of strategic AI quality, exhaustive dice branches, or historically exact published starting positions**.
- The die values are deliberately selected inputs, not a stochastic strategy simulation.
- Kiev remains labeled experimental. Kiev–Odessa remains non-playable.
- No production source map, browser engine, CRT, map export, counter artwork, or historical rulebook was changed.
