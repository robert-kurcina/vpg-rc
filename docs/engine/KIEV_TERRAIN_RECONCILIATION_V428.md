# Objective: Kiev — definitive terrain transcription (v428)

## Verified source

- `maps/source/user-svg/kiev-odessa-main.svg`, SHA-256 `2b15c3a92a282a7efc27d54bcd8994470f0fce8ee5417d5d734969fcd2c4ab7e`, which also drives the accepted Kiev map presentation.
- Existing `maps/kiev.json` calibrated hex centers; source terrain symbol bounding boxes measured using Inkscape `--query-all`, as in the prior authoritative-svg import.
- Requires one uniquely classified Open, Forest or Swamp layer per hex and a maximum 6-pixel center mismatch. The full set of Kiev noncity cells is exhausted.

## Corrections and limitations

| Classification | Source-confirmed hexes |
|---|---:|
| Open | 97 |
| Forest | 41 |
| Swamp | 11 |
| **Total** | **149 / 165** |

The old provisional resampling misidentified `0403`, `0608`, and `1009` as Swamp. All three are explicitly marked Open in the definitive source. Kiev now encodes them Open in the terrain configuration. Source evidence for every other explicit cell also carries its SVG symbol ID and exact source SHA-256. Former bitmap sampling scores were removed where superseded by explicit authored geometry.

**16 city-overlay hexes** lack an explicit underlying Open/Forest/Swamp symbol: `0201`, `0404`, `0502`, `0507`, `0706`, `0708`, `0803`, `0902`, `0905`, `1010`, `1105`, `1107`, `1404`, `1408`, `1602`, `1708`. Their current base Open presentation is retained but is not certified from an explicit base-terrain symbol. This is intentional; a City marker does not prove its underlying base type.

This source transcription does **not** certify river or Major River combat crossings, external rail stubs, initial deployment, or full physical gameplay policy. `maps/movement-configs/graph-sources.json` continues to refuse executable Kiev movement. The 93 certified internal rail links and 186 reciprocal records are unchanged.

The source export is not replaced with a manually painted map. The normal shared renderer regenerates `exports/kiev.png` and `exports/kiev.svg`; the other four SVG/PNG export pairs remain byte-identical to v427. `rules/audit/visual/kiev-terrain-corrections-v428.png` only annotates those three changes over the **actual game export**.

## Reproduce

```bash
python tools/reconcile-kiev-terrain-v428.py
python tests/kiev-definitive-terrain-v428.test.py
node tests/kiev-definitive-terrain-v428.test.js
node tests/kiev-definitive-rail-v427.test.js
node scripts/export-campaign-maps.js
```

To re-transcribe after an intentionally authorized source change, first update and review the SHA pin, then run `python tools/reconcile-kiev-terrain-v428.py --write`; this is not an automatic resampling operation.
