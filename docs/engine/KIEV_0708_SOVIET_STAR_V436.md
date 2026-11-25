# Checkpoint 202 / v436 — Soviet deployment star at 0708

## Requested change and provenance

User directive: place a **Soviet star** at hostCell `0708` for both **Objective: Kiev** and **Kiev–Odessa**.

- The standalone Kiev `maps/kiev.json` cell `0708` (Chernovtsy) previously contained only the authored city marker. It now contains **one additional user-adjudicated Soviet star** with directive `user-directive-2026-11-21-checkpoint-202`. The original city and terrain/edge metadata remain intact.
- The composite `maps/odessa-extension.json` authoritative `0708` override **already** contained exactly one star, recorded as source SVG `use30`, in addition to the city marker. The composer uses this override, so we **kept** that star instead of adding another. The composite image and its generated SVG are therefore unchanged.
- `1111` remains a Soviet star *only in Kiev–Odessa*. The v435 removals `0608`, `0909`, `1009` stay in effect for both configurations. `1502` remains user-adjudicated Forest for both.
- No original source SVG was modified; the standalone star is a documented user correction, not a claim that the original SVG contained the mark.

## Setup implications

| Board | v435 Soviet stars | v436 Soviet stars | Status |
|---|---:|---:|---|
| Objective: Kiev | 9 | **10** | The printed ten-slot marker count now matches; **not** full historical gameplay certification |
| Kiev–Odessa | 12 | **12** | Existing star at 0708 retained; setup/seam remains unverified |

The generic `ScenarioStartingSetup.slots()` preflight now has **zero star-count/uniqueness errors** for standalone Kiev. This does not establish the historical allocation of named counter faces, certify remaining Kiev gameplay rules, or activate the scenario. `historicalSetupAuthorized` and `productionGameActivated` stay false, and the live Kiev movement graph remains explicitly provisional. The **isolated** 165-cell graph, 442 edges, 93 railway edges, 72 ordinary river sides and 10 Major River sides are unchanged.

## Implementation and validation

- Shared renderer only: `node scripts/export-campaign-maps.js` regenerated all five current exports. The generated Kiev SVG/PNG changed; Kiev–Odessa and the other three SVG/PNG pairs are byte-identical to v435. No manually painted or image-generated game map.
- `node tests/kiev-user-map-corrections-v436.test.js` checks the 0708 star exactly once in both configurations and both engine-rendered SVGs; the city marker, old removals, composite-only 1111, Forest 1502 and source pinned terrain evidence remain intact.
- `node tests/kiev-opening-preflight-v436.test.js --write-audit` checks 289 assertions, now accepting the complete marker count without promoting the scenario. Audit in `rules/audit/kiev-opening-preflight-v436.json`.
- `node tests/kiev-source-reviewed-candidate-v433.test.js` still checks 2,949 assertions and retains the deliberately blocked live graph. The new star affects deployment markup, not the source-reviewed movement fingerprint (which is limited to terrain, authoritative city evidence and rail geometry).
- Source-side diagnostic records are maintained with updated JSON file hashes, without treating deployment markers as new river/rail geometry. Historic reports remain available in the package.

## Remaining work

Historical unit-face allocation and complete seven-turn Objective: Kiev validation; composite seam and Kiev–Odessa rules/gameplay. Matching a required number of placement icons is necessary but not sufficient for scenario certification.
