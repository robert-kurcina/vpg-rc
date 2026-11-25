# Historical combat: automatic NE / human browser control — Checkpoint 173 (v407)

## Source of authority and previous defect

The historical combat resolver already rejects a real die when odds yield automatic **NE** (`core/historical_combat_consequences.js`) and rejects `null` for a genuinely rollable CRT engagement. `core/historical_campaign_human.js` allows a committed `null` die for automatic NE; it journals this separately from the selected outcome and rejects changing the committed die. The browser formerly displayed the ordinary d6 control in *both* cases. Human play could become blocked with `No die is rolled when odds produce automatic NE` unless the player guessed that the separate automatic-NE button was required.

## Fix, without an alternate combat implementation

`core/historical_campaign_action_catalog.js` now derives `automaticNoDie` by making a **read-only transaction trial** against the same authoritative session at the already-selected battle: `resolve-battle` with `die:null,choices:{}`. It does not recompute combat odds or implement another CRT. A successful trial is the exact source-validated predicate for an ordinary automatic NE result with no choice; failures retain the normal d6 prompt. The browser bundle is **regenerated directly from this same source module**.

`core/historical_browser_app.js` uses the shared prompt flag, hides the normal die input/buttons for automatic NE, and displays a clear no-die commitment button. For genuinely rollable battles it hides the no-die control and shows manual-input/fair-random d6 controls. The browser stylesheet now honors the HTML `hidden` attribute even for author-styled buttons and labels. No result may be selected before the game records the required d6 or no-die decision. The game state, CRT file, combat resolver, source counters, and published map exports are not modified.

## Evidence and limitations

- `tests/leningrad-all-human-browser-v407.py`: isolated **real Chromium**, original v373 Leningrad map SVG and official photographed-counter vector templates, all source modules; replaces network access only with in-memory local source JSON. Automated mouse choices operate **exclusively through human UI controls**, not the baseline AI. Test dice are recorded and intentionally varied; not claims of stochastic RNG.
- A completed run reached the terminal state on Turn 8 with 122 human-interface decisions, 114 committed actions, 8 committed battle plans, 5 ordinary d6 commitments, 3 automatic-NE commitments, 8 post-roll consequence selections, and **zero** AI policy calls. Separately verifies state/save/restore each Chromium segment and the terminal state. Audit: `rules/audit/leningrad-all-human-browser-v407.json`.
- Screenshot `rules/audit/visual/leningrad-automatic-ne-v407.png` comes from the **actual running game engine and browser**, not an image generator or mockup.
- Targeted legacy human gateway, v390 legal-action catalog, v392 combat-choice, v357 source setup, v334 printed coordinate, v404 deployment, v405 Chromium counter swap, and v406 opening-side browser compatibility tests passed.

**Still open:** the rulebook printed rear anchors `1305` and `1701` disagree with registered, source-SVG fixed symbol locations (rendered `1306` and `1702`). The source SVG has no independently certified numeric text for those two markers. Changing map geometry or source markers without proof would be unjustified. Starting identities/formation allocation and strategy remain candidate-only; the browser is an experimental interface; this is human-**control-path** acceptance using scripted choices, not validation that a human would adopt those choices. The other four historical game production activations and eventual Oberlabs UX parity remain outside this bounded fix.
