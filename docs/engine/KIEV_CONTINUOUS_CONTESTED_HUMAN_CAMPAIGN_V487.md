# Checkpoint 253 / v487 — Kiev continuous contested human-browser campaign

## Outcome

The real Objective: Kiev experimental Chromium human gateway now completes a **single seven-turn saved campaign with contested combat and replacement decisions in the same action journal**. This closes the gap left by v486, where the seven-turn progression and the Exchange combat were independent tests.

The implementation is a **test and source-evidence addition**, not a change to the shared engine or gameplay rules.

## Source-grounded execution

- Original v485 shared Kiev browser, Kiev 165-hex map, 442-edge source-reviewed movement binding, and 30-counter illustrative source-legal starting allocation.
- **89 committed, journal-hashed human decisions** over seven turns in four independent Chromium processes. Stages restore the exact previous game's human-session JSON, without editing or synthesizing state.
- Turn 1 German two-attacker attack on Soviet `0205`: original photographed FK air marker `kiev-front-r03c01`, committed die 3, common B4M CRT **EX**; German `kiev-front-r01c01` reduced, Soviet `kiev-front-r03c04` reduced and retreated via source-legal hexsides.
- Turn 1 Soviet attack on German `0204`: `kiev-front-r04c02` and `kiev-front-r04c03`, committed die 6, common B4M CRT **AL**, eliminated the original Soviet 18th Mechanized Corps counter (`kiev-front-r04c03`).
- Turn 2 Soviet replacement: restored reduced Soviet `kiev-front-r03c04`; rebuilt original 18th Mechanized Corps at source-valid `1601`, retaining its revealed one-step identity as enforced by the engine.
- Turn 4 German replacement: restored reduced Panzer counter `kiev-front-r01c01`.
- Four scheduled reinforcements, one genuine human-declared/resolved ground movement, seven housekeeping phases, and the actual game engine's terminal **Soviet victory at two of sixteen Axis-controlled cities**.

Both sides' combat decisions, replacement selections, and every other turn action are submitted through `HistoricalBrowserPreview` (the existing production human gateway). No source registry or scenario configuration was modified to force a result. Die choices are explicit inputs, not a stochastic-strategy simulation.

## Verification

- `tests/kiev-contested-seven-turn-browser-v487.py --stage 1` through `--stage 4` — **249 completed Chromium assertions**, recorded in four staged evidence JSONs.
- `tests/kiev-contested-campaign-audit-v487.py` — **87 checks** of each output save SHA, authentic human-session envelope digest, uninterrupted journal prefix, stage-to-stage byte-identical input, legal action record counts, exact result and replacement decisions, and terminal screenshot.
- Prior 81-action pass-through campaign evidence is retained as an independent historical regression rather than rewritten to claim a contested game.

Evidence: `rules/audit/kiev-contested-v487-stage{1..4}-{save,evidence}.json`, `rules/audit/kiev-contested-seven-turn-v487.json`, and the **actual Chromium engine screenshot** `rules/audit/visual/kiev-contested-terminal-browser-v487.png`.

## Certification limits

1. This **is one continuous contested seven-turn browser test**, but only **two selected battles on Turn 1**, not an adversarial or exhaustive all-turn combat campaign. Remaining combat phases were legally declined.
2. The initial allocation is **source-legal illustrative**, not certified as the original published historical allocation.
3. The engine's human operator follows deterministic test choices, not a validated competitive AI.
4. Objective: Kiev remains explicitly **experimental**; Kiev–Odessa remains non-playable. Complete historical roster reconciliation, broader combat branch coverage, and player-facing UX parity remain deferred.

No changes to source map SVGs, approved five-map exports, original counter art, gameplay engine, historical rule PDFs, or shared B4M CRT.
