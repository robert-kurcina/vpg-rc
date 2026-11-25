# Checkpoint 235 / v469 — Source-constrained Kiev deployment browser (not playable)

## Scope and source

Exposed **Objective: Kiev** pregame deployment in the existing shared historical
browser using the rules contained in the original user-supplied
`references/rules/kiev-rules.pdf`, **§6, printed p. 2**, authored map
`maps/kiev.json`, setup specification `maps/setup/kiev.json`, source counter
transcriptions `maps/counter-configs/kiev.json`, and inventory
`maps/setup/kiev-inventory.json`. No new gameplay rules or per-scenario renderer
were introduced. The §6 initial setup calls for four German/Romanian counters
in Romania, the remaining Axis infantry/Panzers in Poland, six Soviet fixed
counters at printed markers, and ten Soviet front-line counters (four armies,
six concealed Mechanized Corps). The ten Soviet Mechanized Corps must be mixed.

## Browser entry and workflow

Open **`games/kiev/setup-preview/index.html`** from the project root running
with `python3 serve.py`, or use the new project-home link. The page loads
Kiev source JSON at runtime and uses the same `historical_browser_app.js`,
`HistoricalCampaignBrowserEngine.Deployment`, official counter templates,
`exports/kiev.svg` **real engine export**, and map navigation used by Leningrad
and Arduous. It starts directly in setup mode. Players can select map counters,
swap legal positions and eligible source faces from reserve pools, use map
hex selection, mix all ten concealed Soviet Mechanized Corps, validate the
current sample, and download or restore checksum-validated deployment JSON.

The starting layout `games/kiev/setup-preview/candidate.json` is an explicitly
**synthetic legal sample**, generated from the pre-existing v437 source-checked
test fixture. It is *not* a historically certified default deployment, not
an assumption that any player should use these counters, and not an AI setup.
The source setup rules, not the initial sample, authorize legal changes.
Polish-only and Romanian-only map hexes are highlighted separately when one
of their units is selected (seven and four eligible crosses respectively).
Stacking and occupancy remain enforced by the original setup validator.

The page's final action is **Validate setup (no gameplay)**. It calls the
existing deployment commit with the mandatory concealment check to validate
and report the number of counters, but **does not construct, activate, or save a
historical campaign**. Normal movement graph building, combat, AI, turn
advancement and campaign save restoration are explicitly disabled. The Kiev
movement profile remains `verified-test-fixtures-only` and §10.8 lacks a
source-certified complete Romanian territory mask. Full Kiev gameplay remains
**not authorized**.

## Shared presentation edge case

The Kiev photographed `49 Mtn` Mountain Infantry front (`6-4`) and reverse
(`3-4`) were previously rejected by the common face projector, which expected
only Infantry/Tank/Mechanized/Garrison kinds. The projector now accepts the
source `mountain-infantry` kind **without changing its printed counter name or
combat/movement values**, using the standard infantry NATO glyph in the current
universal counter artwork. A visually distinct historical mountain-infantry
symbol remains an artwork-fidelity improvement; this approximation does not
change unit rules.

## Verification

- `node tests/kiev-setup-preview-v469.test.js`: **21 assertions** on source
  sample parity, setup-only gate, correct Polish/Romanian permitted markers,
  and source-printed Mountain Infantry front/reverse.
- `python3 tests/kiev-setup-page-browser-v469.py`: **40 assertions** in genuine
  Chromium, including 30 vector counters, accepted SVG map, click-to-swap,
  national-region destination highlighting, random concealed mixing,
  validation without game start, JSON save/restore, tamper rejection and
  campaign-save rejection. Actual UI screenshot:
  `rules/audit/visual/kiev-setup-browser-v469.png`. Due this execution
  environment's local-HTTP restriction, the browser test inlines **the exact
  original packaged HTML, modules, JSON and engine-generated SVG image**;
  it does not substitute a mock renderer/rules engine.
- v468 Kiev source-deployment Node **100** and Chromium **20** checks,
  v437 Kiev 30-ground source-opening **180**, v442 Kiev early-combat **45**,
  v403 Leningrad source-face **552**, v404 Leningrad source-deployment browser,
  v425 Arduous human-browser progression **35** steps, v419 Arduous seven-turn
  smoke **89** actions, and v457 city-dot regression **5,376** all pass.
- The existing 48-module shared browser engine is **not rebuilt or enlarged**
  for Kiev. Only the shared browser UI and face-projection adapter change;
  no authored rules, CRT, maps, exported map images, counters, or other
  gameplay modules change.

## Next blocking work

1. Certify the complete Romanian target-territory set needed for §10.8,
   without mistaking four starting crosses for the entire territory.
2. Close the remaining Kiev special-rule and runtime integration gaps;
   promote its movement graph only after source-backed certification.
3. Complete a genuine seven-turn Kiev human and baseline AI campaign
   acceptance before declaring it playable.
4. Continue Kiev–Odessa gameplay after Kiev, keeping the shared engine and CRT.
