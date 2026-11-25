# Checkpoint 121 · v355 — Source-backed Leningrad setup and counter inventory

## Source evidence

`references/rules/leningrad-rules.pdf` printed page 2 §6.0, steps 2–8, explicitly requires the following:

- Rear Soviet: 3 Infantry Corps + 2 *untried* Mechanized Corps; printed reserve identifiers `0107`, `0607`, `1305`, `1606`, `1701`.
- Front Soviet: 2 full-strength Infantry Armies + 2 *untried* Mechanized Corps + 1 Infantry Corps, one per each of the five red stars; two Armies must not be adjacent.
- Starting German: 7 Infantry Corps and 2 Panzer Corps distributed across five crosses, one per cross and four double-stacked; 2 further 6-4 Infantry Corps at turn 4.
- Remaining 6 Soviet Infantry Armies and the Workers Militia are later reinforcements (PDF page 5 §11.0).

`assets/official-counters/source-sheets/counters-leningrad-front.jpg` and `...back.jpg` include 32 faces each. They agree with 4 Soviet 3-4 infantry corps, 4 untried Mechanized Corps (unknown face and asymmetric 3-number revealed face), 8 Soviet armies, 9 German infantry, 2 Panzer, 2 Air, WMM, Fleet, and turn marker. *The face-level identities of two German 6-4 arrivals, Soviet deployment assignments, and army-arrival allocations are not identified by PDF text.*

## Defect corrected

Prior `core/leningrad_setup_validator.js` modeled the frontline five Soviet units, but its result was easily misread as the complete setup. It was **not** the full ten-unit Soviet starting roster. Its status is explicitly front-only. The new `core/leningrad_starting_inventory.js` enforces all inventory categories for user-supplied allocations, rejects duplicate/reused face IDs, and never silently assigns any unit or location. Counter JSON `garrison` classifications for Soviet untried units were corrected to `mechanized`; the tan Workers’ Militia was also corrected from inferred Axis to source-rules-confirmed Soviet ownership (front, reverse and printed identity key). No source imagery or unit artwork was changed.

## Evidence boundary / remaining gates

`maps/source/user-svg/leningrad-main.svg` has no SVG `<text>` nodes; the original PDF names five printed rear hexes but *not* their physical SVG-grid coordinate pairs. Do not conflate that independent PDF label evidence with source-map geometry or `maps/leningrad.json` provisional internal IDs. The five rear source-to-runtime cell registrations still need independent scrutiny. No historical setup, movement certification, or canonical game activation is asserted.

## Verification

`node tests/leningrad-full-inventory-v355.test.js`; `python3 tools/audit-leningrad-full-inventory-v355.py` (PDF text, source photo SHA-256, SVG text register), historical counter and reinforcement suites, five-map exports compared with v354.
