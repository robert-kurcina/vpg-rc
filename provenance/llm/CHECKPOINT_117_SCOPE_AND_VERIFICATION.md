# Checkpoint 117 — implementation/provenance boundary

- Input project: `hex_wargame_v350_CHECKPOINT_116_LENINGRAD_SMOOTH_RIVERS.zip`.
- New implementation is limited to canonical historical-state translation; no current map/schema/renderer/HTML/gameplay change.
- Approved Leningrad deployment (v345 left image) and smooth ten-river v350 rendering remain active.
- `rules/audit/leningrad-canonical-state-migration-v351.json` is generated from current map data with **synthetic**, not historical, unit identities. It provides no historical setup authorization.
- No raster image scan was used as a geometry source. No image generation was used.
- Historical printed-coordinate labels are candidate data, not independently SVG-certified, because the supplied source SVG contains no text labels.
- All five current SVG and PNG exports were regenerated and compared byte-for-byte to v350; all ten match.
