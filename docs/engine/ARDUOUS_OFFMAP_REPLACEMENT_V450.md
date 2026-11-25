# Checkpoint 216 / v450 — Arduous actual-browser off-map rebuild and Soviet 6th Mechanized exclusion

## Source evidence

- `references/rules/arduous-rules.pdf`, printed p. 6, §§12.0–12.4: one replacement step reintroduces a previously eliminated ground counter at reduced strength, or restores a reduced counter in communication; Soviet Mechanized Corps remain revealed after destruction; at most one Soviet Mechanized Corps can be rebuilt per turn; the special **Soviet 6th Mechanized Corps** with a red symbol box **may never be replaced after elimination**.
- `assets/official-counters/source-sheets/counters-arduous-back.jpg`: the reversed photographed counter on row 4, column 8 is the identified **6th Mechanized** with a red-background NATO symbol, printed `8·4-6`. Its mirrored concealed front is `arduous-front-r04c01` (reversed `arduous-back-r04c08`). The rule does not prohibit the 4th Mechanized Corps.
- `maps/buildup-configs/arduous.json`: added a **scenario-configuration-only** `replacementExcludedFaces` entry for that exact source face. Existing source-identity validation and the common replacement engine already support this rule; no generic code fork is necessary.

## Browser acceptance — source-excluded 6th Mechanized

`tests/arduous-human-sixth-replacement-v450.py` uses actual Chromium player controls and the unmodified shared engine/export. Under the existing candidate opening, the German player commits **two legal first-turn attacks**, including `0209` against the Soviet 6th Mechanized. A committed air choice and die `3` yield CRT `DE`, eliminating the photographed 6th counter without mutating game state directly. Another source-legal opening attack at `0305` produces CRT `EX` and leaves a reduced Soviet Infantry Army. After ordinary game phases, Soviet Turn-3 Build-Up never offers the eliminated 6th as a replacement, while that other reduced Army can still be restored through its regular visible action. Save/restore, Undo, and deterministic replay confirm replacement accounting. **151 browser assertions pass.**

## Browser acceptance — eligible off-map reentry

`tests/arduous-human-offmap-rebuild-v450.py` uses the **player's legal pregame concealed-mechanized mixing and counter exchange** to put the Soviet 4th Mechanized Corps (`arduous-front-r04c02`, reverse `arduous-back-r04c07`) into source-valid star hex `0209`. This is a legal player choice, not a claim about the historically unique counter assignment. A source-legal Turn-1 German attack uses actual player controls and a committed die `3` to eliminate it, leaving it genuinely **off-map**.

On Turn 3, Soviet Build-Up visibly offers the eliminated 4th Corps at legal east entry hexes and controlled communicating cities. Selecting source east-edge hex `1801` produces `replacement-rebuilt`, not `replacement-restored`. The returned counter retains its **revealed one-step** face, printed **2 attack / 1 defense**, consumes exactly one Turn-3 Soviet replacement step, increments the **one Mechanized rebuild per turn** counter, and cannot be rebuilt again in the same phase. Its save/restore, Undo and deterministic replay are identical. **149 browser assertions pass.** The screenshot `rules/audit/visual/arduous-turn3-offmap-rebuild-v450.png` was captured from the actual browser before the rebuild action.

## Unit-level policy negatives

`tests/arduous-sixth-mechanized-replacement-v450.test.js` applies the existing common `historical_buildup_phase.js` transaction to synthetic off-map unit-level controls on the source-validated setup. It confirms the banned 6th is rejected, unrelated one-step Soviet Mechanized are eligible, and tampered/duplicate/misidentified exclusion configurations fail closed. **23 assertions pass**. This unit test does not claim its synthetic elimination is an actual combat result; the separate Chromium test provides that evidence.

## Preservation and remaining acceptance

- The generic browser engine and game code, all five actual map exports, v447 accepted orange dashed city border, v441 terrain artwork, official counter imagery, and the single exact B4M CRT remain unchanged.
- Source rules §12 flow is now tested on a source-eliminated excluded unit and a source-eliminated eligible unit via visible human controls, but **not all reentry hex types, both player sides, turns 4–7, all stacking edge cases, or an exhaustive seven-turn contested browser campaign** have been certified.
- The Arduous printed opening allocation/marker mismatch remains explicitly provisional; neither setup used here is asserted as a unique canonical opening. Kiev and Kiev–Odessa remain gated. The optional B4M two-counter stacking study remains second-to-last priority; unified grand campaign exploration remains absolute last.

## Audit files

- `rules/audit/arduous-sixth-mechanized-v450.json`
- `rules/audit/arduous-human-sixth-v450.json`
- `rules/audit/arduous-human-offmap-rebuild-v450.json`
- `rules/audit/visual/arduous-sixth-eliminated-replacement-v450.png`
- `rules/audit/visual/arduous-turn3-offmap-rebuild-v450.png`
