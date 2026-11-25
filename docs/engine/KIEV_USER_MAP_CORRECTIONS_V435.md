# Checkpoint 201 / v435 — Kiev and Kiev–Odessa user-adjudicated map corrections

## Directives implemented

1. Remove Soviet deployment stars from hostCells `0608`, `0909`, and `1009` on **both** Objective: Kiev and the composed Kiev–Odessa map. Do not change those hexes' Open terrain or adjoining rails/rivers.
2. Add a Soviet deployment star in `1111` **only** in the Kiev–Odessa composite. Standalone Kiev has no star there. The composite uses its existing authoritative cell-override configuration; no duplicated renderer or hard-coded scenario check was introduced.
3. Change `1502` from Swamp to **Forest** in **both** games, including the rendered terrain tile and Kiev's source-reviewed movement candidate.

## Resulting counts and authorization

| Map | Soviet star markers | 1111 | 1502 terrain | Historical setup certified? |
|---|---:|---|---|---|
| Objective: Kiev | 9 | no star | Forest | **No**: §6 calls for 10 front-line Soviet star slots |
| Kiev–Odessa | 12 | Soviet star | Forest | **No**: composite setup/seam and expansion rules still unverified |

The composite has its own existing stars, including `0708` and `1113`, and does **not** inherit Kiev's star count one-for-one. None of those unrelated marks were removed. The Kiev star count is **nine**, not ten; the previous 12-versus-10 mismatch is resolved into a different 9-versus-10 mismatch, and the validator remains intentionally closed. Do not auto-add a Kiev-only tenth star or treat the Odessa-only `1111` as that missing Kiev slot.

## Provenance and implementation

- `maps/kiev.json` modifies standalone cell markers and terrain; `maps/odessa-extension.json` changes the **authoritative composite cell overrides** so composition does not restore the removed stars, Swamp terrain, or suppress Odessa-only `1111`.
- `maps/composer.js` carries user-terrain-adjudication metadata from composite overrides into the composed board using the existing shared composition pipeline.
- The original authored `maps/source/user-svg/kiev-odessa-main.svg` and printed rule sources remain byte-identical to v434. At 1502 the SVG still identifies Swamp, and `sourceTerrainEvidence.layer` remains `swamp`. The new `user-adjudicated-terrain-v435` status and `userTerrainAdjudication` record transparently supersede that visual source as a user-authorized classification. This is **not** a new claim about the original SVG.
- The generic `core/terrain_evidence.js` and `core/source_reviewed_movement_graph.js` verify that a user override preserves its original source layer, recorded former terrain, chosen terrain, and directive. The existing 165-cell candidate policy/ledger is re-pinned to the new map fingerprint, and the live Kiev authorization remains provisional.
- `tools/reconcile-kiev-terrain-v428.py` preserves valid explicit adjudications when rereading SVG source, avoiding accidental restoration of Swamp at `1502`.
- The two v318 side-occupancy snapshots were updated **only** for the changed map JSON SHA-256 hashes; their geometry and side measurements remain identical.
- No changes to map geometry, railway/river hexsides, original counter artwork, CRT, city locations, shared renderer, or any non-Kiev map/export. Reexported both affected maps through `scripts/export-campaign-maps.js` (shared engine; not image generation).

## Validation

- `node tests/kiev-user-map-corrections-v435.test.js` — conditional star, three removals in both composed and standalone boards, source evidence, preserved terrain/river edges, movement graph, setup gate, and actual exported SVG markers.
- `node tests/kiev-source-reviewed-candidate-v433.test.js` — 2,949 checks on the repinned candidate, including both movement directions on every physical hexside.
- `node tests/kiev-opening-preflight-v434.test.js` — 289 checks, with 9-versus-10 setup rejection.
- `python tests/kiev-definitive-terrain-v428.test.py -q` — source extraction and adjudication preservation.
- `python tests/kiev-odessa-svg-side-occupancy-v318.test.py -q` — source hexside source measurements unchanged; source-file digest snapshots updated.
- `node tests/kiev-major-river-shared-v430.test.js`; `node tests/arduous-executable-graph-v419.test.js`; `node tests/leningrad-movement-lifecycle-v318.test.js`; `node tests/forest-no-shadow-v373.test.js`.
- `python tools/check-package-layout-v417.py` — current package layout.

**Known pre-existing verification issues:** `scripts/verify-campaign-maps.js` still compares current outputs to obsolete v373 reference hashes (first failure on unchanged Arduous SVG). `scripts/verify-source-path-integrity.py` expects a stale Kiev source-audit shape. Both were already mismatched against unchanged files from v434; neither is evidence of an altered third-party map in v435. Full game authorization is not claimed.
