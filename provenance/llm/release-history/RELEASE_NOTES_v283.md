# v2.83 — Odessa numbered-hex source correlation (partial)

This is a targeted implementation, not a claim that the Odessa map now matches the original source completely.

## Configuration changes

| Hex | Previous | Updated | Evidence |
|---|---|---|---|
| 0712–0715 | Open | Forest | Forest region in published Odessa bitmap |
| 0814 | Forest | Open | Printed terrain classification at 0814 |
| 0918 | Open | Swamp | Southern printed terrain at 0918 |
| 1115 | Open | Forest | Source Forest patches in this hex |
| 1216 | Open | Swamp | Printed Swamp containing the red deployment marking |

Additional procedural Coast/Lake hexside visual candidates: **1315 face 3 (SE), 1414 face 3 (SE), and 1513 face 4 (S)**. The original nine accepted Coast faces are retained. No source-water polygon is substituted for the Coast/Lake subroutine.

All eight terrain changes and three Coast additions are recorded in `maps/odessa-extension.json` under `v283HexCorrelation`. These are reviewed visual candidates, **not a certified complete cartographic transcription**.

## Independent source auditing

Run `python3 scripts/audit-odessa-hex-correlation.py` to regenerate `evidence-v283/odessa-hex-correlations.csv`, `.json`, and a diagnostic overlay of all 70 extension-hex IDs over the original bitmap. Source pixel alignment is a *candidate*, not pixel-registered ground truth. Forest/sea ink fractions are evidence, never automatic terrain labels.

## Verification

- All five maps: Chromium `HexTerrainTiles.svgMap` exactly matched Node-generated engine SVGs.
- Moscow, Arduous, Leningrad, and standalone Kiev SVGs: byte-identical to v2.82.
- Kiev + Odessa: 235 renderable hexes; railway connection count unchanged at 126; Coast/Lake remains procedural.
- Existing tests and the new eight-hex and three-coast regression passed.
- Original SVG and bitmap references unchanged.

## Not corrected / not verified

Several source disagreements remain, especially the Brăila Major River delta, Prut/western River courses, the complete Odessa sea mask, partial coastal hex shapes, the Chisinau and Odessa City relationships, and Railway routes. The source bitmap alone cannot resolve all legal edge semantics without independent hexside-by-hexside review. Do not treat a matching exported screenshot as source-fidelity certification.
