# Checkpoint 288 / v522 — Odessa §6 combined-setup preflight

## Authority and scope

The actual supplied `references/rules/odessa-rules.pdf` page 1, §6.0(3),(4),(6),(7) is the authority, read with `references/rules/kiev-rules.pdf` §6 and Odessa's §0 precedence. The preflight pins both PDFs by SHA-256. **This is a source-backed diagnostic, not historical map adjudication and not a playable campaign.**

### What can now be validated

- Exactly **seven** rear Soviet hexes, with the source-prescribed unit types: Infantry Armies at `0406` and `1007`; Mechanized Corps at `0705`, `0803`, `1106`, `1309`; one Soviet Cavalry Corps at `1215`.
- Exactly **eleven** frontline Soviet units, comprising four Infantry Armies, six Mechanized Corps, and one Cavalry Corps, each on a source-designated red star, with no adjacent Infantry Armies.
- Starting Soviet Coastal Army and Black Sea Fleet together at Odessa `1513`, with the Fleet undamaged.
- A source-constrained Romania group of **three German infantry and four Romanian ground units**, subject to source-verified Romanian territorial identities. The group is *not* auto-placed in guessed country hexes, and its stacking legality must be checked separately; §6 does not impose seven different locations.
- Romanian Air Support enters on **Game Turn 2**, not as an on-map starting counter.
- Test candidate arrangements without changing original source maps or the shared historical engine. All functions return diagnostic-only status; `certify()` refuses to authorize the campaign.

## Concrete findings on the current 261-cell combined board

| Source requirement | Current active combined map | Finding |
|---|---|---|
| Eleven red-star frontline hexes (§6.0(4)) | Twelve (`0205`, `0304`, `0305`, `0401`, `0403`, `0502`, `0503`, `0708`, `0808`, `1110`, `1111`, `1113`) | **Unresolved**; do not remove `1111` (user-adjudicated), `1113`, or any other marker without source/user authority |
| Fixed Mechanized Corps at `1309` (§6.0(3)) | No fixed mechanized marker at `1309`; an extra one exists at `0706` | **Unresolved** marker-to-host discrepancy; original Kiev source has a marker at `1309` |
| Port start `1513` (§6.0(3)) | Odessa is a Major City with a fixed Infantry symbol | Coherent with Coastal Army location; do not count its fixed Infantry marker as one of the seven rear setup units |
| Country-aware Axis setup (§6.0(7)) | 19 source-approved Bessarabian land cells; **211 other non-Sea land cells** have no `sourceTerritory` | Cannot assert that seven hypothetical locations are Romanian without verified country labels |
| Four Romanian units, three German infantry | Odessa unit-design overlay has three new Romanian ground counter designs and one identified original Kiev Romanian front face, but original gameplay IDs and German bindings remain outstanding | Counts are source-reconciled; identity-to-game roster binding unfinished |

The audit does not choose which of the twelve red stars should be in the eleven-unit setup, does not overwrite the approved user-directed star at `1111`, and does not remap `0706` to `1309`. The Romanian-group diagnostic does **not** infer a one-unit-per-hex restriction or certify stacking. Source geometry and original assets stay unchanged.

## Implementation and tests

- `maps/setup-configs/kiev-odessa-source-setup-v522.json` — source-backed setup data and PDF hashes.
- `core/composite_setup_source_preflight.js` — read-only candidate admission and discrepancy audit. Operates only as a diagnostic adapter and does not alter the shared campaign engine.
- `tests/odessa-source-setup-preflight-v522.test.js` — successful and adversarial setup allocation checks, missing source marker detection, bad source hashes, impossible Army adjacency, unsafe territory claims and unauthorized production certification.
- `rules/audit/odessa-source-setup-preflight-v522.json` — machine-readable observed mismatches and readiness gates.

## Next P0 work

1. Independently adjudicate the star count and the `0706`/`1309` mechanized marker distinction while honoring any explicit user-approved map edits. Keep printable map appearance separate from the setup eligibility ledger where necessary.
2. Bind the Kiev base unit IDs and Odessa supplemental counter faces to the unified 7-turn starting roster (including the source-shown Polish setup and reinforcement schedule), leaving player-selectable placements where permitted.
3. Certify the Romanian territory subset and the combined movement and eastern-red-edge communication graph. Keep user-approved Bessarabian identities intact.
4. Integrate these source-approved setup allocations into the existing historical browser setup gateway; run seven-turn human acceptance with naval, Air Support, Undo, save/restore and victory isolation before enabling Odessa.
