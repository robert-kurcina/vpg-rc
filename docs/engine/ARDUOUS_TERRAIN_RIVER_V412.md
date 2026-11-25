# Checkpoint 178 / v412 — Arduous terrain source reconciliation and river-side review

## Purpose and outcome

Finish the whole-hex base terrain transcription for The Arduous Beginning without substituting generated artwork, bypassing movement authorization, or changing the shared CRT. The 155 original runtime map hex IDs are retained. The source SVG itself has **30 forest markers and 20 swamp markers**, all previously registered to particular hexes (maximum recorded centroid residual **3.9744 px**). Its other **105 cells do not contain a forest/swamp marker**. The independently supplied original board scan corroborates the absence of *dominant* forest/swamp pigment in the center of each of those 105 cells. All are now explicitly entered as `open`, including previously untranscribed city hexes Brest-Litovsk `0211` and Minsk `0907`.

The new status `source-svg-scan-reviewed-open-v412` identifies this narrower source review. It is **not** synonymous with `source-authoritative` movement-graph certification. The existing 50 authored terrain statuses are untouched. The original source map and uploaded SVG are pinned by SHA-256 in `maps/arduous.json` and the new audit. The original bundled scanned image, distinct from the missing PNG href in the SVG, is `maps/source/arduous-map-scan.webp`.

## Auditable source and method

- Primary: `maps/source/user-svg/arduous-map-temp(3).svg` and its 50 authored layer objects, paired to registered runtime hexes. All vector identities, layer counts, source digest, and marker-to-cell residual limits are checked.
- Independent corroboration: `maps/source/arduous-map-scan.webp`, with exact original SHA-256. The already established source-center ellipse check requires `<0.5` green and `<0.5` yellow-brown coverage for each candidate open cell; every authored forest/swamp cell is separately corroborated by the scan. This does not use an average pixel to identify the existence or location of a forest/swamp SVG object; the original vectors remain primary.
- Regeneration: `python tools/reconcile-arduous-terrain-v412.py --write`; idempotent on the source-reviewed map. It refuses unrecognized source map preimages, tampered SVGs/scans, duplicate or missing hexes, conflicting authored terrain, and unexpected terrain records.
- Per-hex evidence: `rules/audit/arduous-whole-hex-terrain-v412.json`. Existing source readiness snapshots were regenerated from the changed source-map SHA; previous snapshots remain in checkpoint 177 for provenance.

## Current river-side candidate policy (v418)

Only sustained river-vector following of a physical shared hexside is retained as source evidence. The current candidate-only source audit is `rules/audit/arduous-river-candidates-v418.json` (45 internal candidate sides, two exterior source exits). Incidental point touches or brief nearby lines do not create river entries and are not retained as review items. None of the 45 is authorized for gameplay until the combat geography is verified.

## Engine boundaries and review conclusions

- **Changed:** `maps/arduous.json` base terrain values/statuses; shared read-only terrain coverage and certification-readiness accounting (`core/terrain_evidence.js`, `core/map_certification_readiness.js`). Arduous SVG/PNG map exports and the export manifest were regenerated from the same approved shared renderer because two formerly null terrain values now display their open texture underneath city features.
- **Unchanged:** all five original source SVGs, all counter artwork, v373 shared renderer and profiles, common B4M CRT, movement adjudicator and certification policy, B4M shared-native default entry, all other four map exports, Kiev and Leningrad maps.
- **Movement blocked:** `core/map_movement_graph.js` still rejects Arduous as `source-geometry-not-gameplay-certified`. This checkpoint claims neither full historical placement nor complete campaign gameplay.
- **Falsification/limitations:** Absence of an authored overlay by itself does not establish open terrain; the scan evidence is also required. Center color can miss small features or ambiguous hex boundaries. A different official base-terrain source, a misregistration in the original hex grid, or a river passing along a different shared side would change the appropriate interpretation. Therefore these are source-reviewed whole-cell *base* values, not a full river/shore/rail-side certification.

## Regression evidence

`rules/audit/checkpoint178-regressions-v412.json`: **41/41 selected tests passed**, including original B4M and Leningrad regressions, Arduous/Kiev rosters and victory scoring, both new evidence audits, source-edge tracing, official counters, all-five-map export freshness and reproducibility, and the single shared CRT. No new eight-turn browser acceptance is claimed.

One unrelated old v310 test (`tests/arduous-leningrad-user-corrections-v310.test.js`) contains a stale assertion requiring Leningrad Coast mode `exact-source-paths` instead of current `source-path-coast-wavelets`; it fails identically against checkpoint 177 and was not included as a passing regression. Updating that historical snapshot assertion is separate from Arduous terrain review.

## Next prioritized integration

1. Verify the 45 retained side-follow candidates for river combat attribution and connect the graph.
2. Preserve the 85 reconciled rail links and complete the seven-turn Arduous campaign.
3. Continue Kiev and combined Kiev–Odessa using the shared engine.
