# Checkpoint 176 (v410) — Source-grounded Arduous and Kiev mechanics

## What is implemented

- Corrected the **ten Soviet untried Mechanized Corps** in each of `maps/counter-configs/arduous.json` and `maps/counter-configs/kiev.json`. The previous transcriptions labeled their concealed fronts and revealed backs as Axis `garrison` counters. That classification contradicts both supplied official source sheets and the published setup rules: *The Arduous Beginning* §§3.3, 6.0(1–4) and *Objective: Kiev* §§3.3, 6.0(2–4). The front-face `*` / `?-6` remains concealed; the paired reverse identifies real attack/defense/movement values. No IDs or unprinted counter numbers were synthesized.
- Kept the source-specific **Arduous** revealed-strength form, such as `4·2-6`, and expanded the two shared source-face parsers to accept this alongside the existing `4·2·6` form. The latter remains the format of the already-working Leningrad and Kiev source transcriptions. No B4M CRT outcome lookup or dice behavior changed.
- Implemented generic, configuration-selected `city-count-three-way-v1` final scoring in `core/historical_housekeeping_phase.js`; it does **not** branch on scenario ID. The existing special Leningrad isolation-draw mode is preserved and still fails closed on previously unclassified Leningrad outcomes.
- Added `maps/housekeeping-configs/arduous.json`: 7 turns, 12 cities, 12 German = victory, 11 = draw, 10 or fewer = Soviet victory, all cities initially Soviet controlled (*Arduous*, §§4–6).
- Added `maps/housekeeping-configs/kiev.json`: 7 turns, 16 cities, 16 Axis = victory, 15 = draw, 14 or fewer = Soviet victory, with **Lublin and Iasi** initially Axis controlled (*Objective: Kiev*, §§4–5). The scenario still uses `german` as the engine-side identifier for Axis.
- Both source-count modes reject incorrect source city counts, illegal threshold shapes, missing/altered opening ownership, and invalid terminal phase/turn context.

## Tested boundaries

- `tests/arduous-roster-and-victory-v410.test.js`: official sheet SHA-256, 10 concealed front/reverse pairs, *Brest-Litovsk* exception, literal city-score thresholds, shared source-face parsing via an isolated certified Leningrad **test board**, and refusal to promote the provisional Arduous graph into playable map authority.
- `tests/kiev-roster-and-victory-v410.test.js`: same official pairing verification; 16 named cities, unique source-only 2-city Axis opening; terminal scores; source policy rejection; map certification still blocked.
- Existing eight-turn Leningrad housekeeping, verified combat consequences, CRT, Phase/Undo and browser counter/pool interaction tests remain passing. Consult `rules/audit/checkpoint176-node-regressions-v410.json` for the exact test matrix.

## Explicitly not done

1. Arduous and Kiev **do not yet have verified executable movement maps**. `core/movement_binding.js` correctly rejects both; the source SVG alone is not a certified legal edge, rail, river and terrain binding. Never bypass the graph registry to fake campaign playability. Audit and certify SVG-derived adjacency/features against authoritative source before activating moves.
2. Historical candidate placement is not fully bound: Arduous starts with a unique Brest-Litovsk garrison whose playable 3-4 face is on the *reverse* of a location marker, not the standard normal front. Do not assign that marker a fabricated normal front identity. Kiev has national contingent, Major River and reinforcement exceptions. Source-authoritative setup and correct special rules must be implemented and tested before making these available as complete games.
3. Full reinforcement/replacement tracks, combat source effects, hidden-counter mixing in actual Arduous/Kiev UI, seven-turn end-to-end acceptance, and combined Kiev–Odessa gameplay are still pending.
4. All five historical configurations use exactly **one** Oberlabs Battle for Moscow CRT. Source-specific rules can modify odds and other mechanics, **not** this CRT.
5. The five accepted v373 no-drop-shadow map SVG exports, common renderer, shared B4M default routing and source counter JPGs are unchanged.

**Next P0:** certify Arduous source-authoritative hexside/rail/river topology against the user-authored SVGs, then bind its source-validated placement (including the Brest special unit) and remaining buildup/combat rules. Reuse the same shared phase engine; then Kiev and combined Kiev–Odessa. UX parity remains deferred.
