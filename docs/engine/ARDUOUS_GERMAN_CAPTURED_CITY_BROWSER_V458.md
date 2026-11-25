# Checkpoint 224 / v458 — German captured-city rebuilding through actual Chromium actions

## Source authority

- `references/rules/arduous-rules.pdf`, §5: initially all cities are Soviet-controlled; control follows the last friendly unit to pass through or occupy a city.
- `references/rules/arduous-rules.pdf`, §12.0–12.4: Germany receives one replacement step starting Turn 4; off-map eliminated units return on their reduced side at the **black western map edge** or at a German-controlled city with an unblocked communication path west. Friendly units do not cancel enemy ZOC.
- `maps/setup/arduous.json`, `tests/fixtures/arduous-source-setup-v419.js`, `maps/buildup-configs/arduous.json`, and the original Arduous front/reverse counter photographs ground the chosen **candidate** setup and unit identities. This is a valid example, not a prescribed historical unit-to-hex allocation.
- All combat outcomes use the one unchanged project-authorized Oberlabs/B4M CRT and the source-configured scenario modifiers.

## Full observed browser sequence

1. Open the real shared-engine Arduous browser with the existing candidate opening, containing Soviet Brest Garrison at `0211` and other source setup units. Finish optional initial air/sea setup.
2. **Simultaneously declare three legal German Turn-1 attacks** from existing source units, then resolve each through the visible player controls:
   - On Soviet Army at `0210`: German attackers `arduous-front-r01c05` and `arduous-front-r01c07`, source Air Corps shift +1 (`arduous-front-r03c02`), die `6`, **DRL**, choosing a valid retreat without German advance. This clears the Soviet ZOC adjacent to Brest.
   - On **Brest Garrison** at `0211`: German `arduous-front-r01c08`, source Air Corps shift +2 (`arduous-front-r03c01`), die `6`, **DE**, choosing a valid German advance into Brest.
   - On `0305`: German `arduous-front-r02c02`, `arduous-front-r02c03`, and `arduous-front-r02c07`, no air support, die `2`, **EX**, selecting a validated loss reducing `arduous-front-r02c07` to one step.
3. On the completion of German Combat and ordinary phase progression, `cityControl['Brest-Litovsk']` is **german**, and German `arduous-front-r01c08` occupies the city. No source units or city ownership were injected or edited.
4. In Turn-1 Soviet Combat, three existing Soviet Mechanized Corps attack German `0306`. The player commits die `2` for **EX** and assigns the defender loss to the previously reduced `arduous-front-r02c07`. The source counter is eliminated.
5. Continue through legal player-facing phase-completion actions to **German Turn-4 Build-Up**. The eliminated German corps is genuinely absent, Brest remains German-controlled, and the shared engine's westward communication rule offers city **`0211`** as an off-map replacement destination in the same human-action menu as legal west-edge positions.
6. Select `Replace arduous-front-r02c07 at 0211`. The rebuilt source counter appears at Brest on its photographed reverse `arduous-back-r02c02`, with reduced strength; the German one-step replacement allowance is spent.
7. Browser save/restore, Undo and deterministic replay produce exactly identical snapshots and save journals. No JavaScript exceptions or UI errors occur.

## Reproduction and validation

- Runner: `python3 tests/arduous-human-german-captured-city-v458.py`
- Stages: `tests/arduous-human-german-captured-city-v458-stage1.py`, `-stage2.py`, and `-stage3.py`. Three Chromium sessions are connected **only by normal `HistoricalBrowserPreview.save()` / `.restore()` documents**, because large legal attack catalogues are expensive to recompute in one long-lived browser. They do not bypass the rules engine.
- Real browser screenshot: `rules/audit/visual/arduous-turn4-german-city-rebuild-v458.png` (actual Turn-4 player action, source map and counters).
- Audit: `rules/audit/arduous-german-captured-city-v458.json`, includes the PDF checksum, committed dice and combat outcomes, turn trace, counter identity, test count and known limits.
- **224 combined passing assertions**, plus existing communication and gameplay regressions. Stage 1 produces a genuine captured-city save; Stage 2 verifies that save and produces the Soviet-combat casualty save; Stage 3 verifies the second save and completes the city rebuild.

## Limits and next priorities

This proves **one source-valid opening, one city capture, one eliminated German infantry unit and one Turn-4 city reentry**. It does not prove all cities, later turns, alternative tactical choices, strategy quality, or complete eight/four-attacker EX choice enumeration. The complete contested seven-turn browser run remains an open test. Kiev and Kiev–Odessa integration also remain open. The optional B4M two-unit stacking study is second-to-last and the unified campaign study is absolute last.

**Preservation:** no gameplay, shared CRT, source rule PDFs, supplied counter imagery, city rendering or map/export code changes are required in v458.
