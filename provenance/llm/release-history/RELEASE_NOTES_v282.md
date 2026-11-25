# v2.82 — Source review and release cleanup

- Applied eight independently identified Odessa open-terrain corrections: 0815, 0914, 1014, 1212, 1214, 1215, 1513, 1514. These are review candidates, not certified rule classifications.
- Reduced the visible forest texture density at Kiev hex 1111 without changing its gameplay terrain type.
- Preserved a bitmap-registered *display-only* river-ink candidate layer separately from hexside combat/movement rules, retaining the original SVG water paths for audit. Hydrology is not certified.
- Preserved other historical campaign map geometry and core assets.
- Cleaned 148 superseded files from the distribution copy; current PNG exports were subsequently regenerated and retained for supported viewer links.
- All five map structure tests, railway spline tests, v2.80 hexside tests, counter tests, and source-path SHA/path checks pass. These are **consistency tests**, not proof of source accuracy.
- Removed older tests/importers that could restore superseded topology, while retaining current checks.
- Validation caveat: full source-to-engine feature-by-feature cartographic comparison is still outstanding.
