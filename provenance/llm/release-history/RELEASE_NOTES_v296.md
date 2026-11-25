# v296 — Forest shadow, major-river palette, city layer order

- Forest shadow now uses a 10 px positive X and Y displacement (bottom-right), 10 px stroke, 25% group opacity and unchanged 5 px blur.
- Apply a board-footprint SVG clip path to the entire shadow group after filter rendering. No shadow outside actual map hex polygons.
- City yellow borders (and major-city gray grounds) are rendered after Open/Swamp and before Forest shadow/Forest tiles. Rivers/cities remain above both.
- Major-river color changed to #289db0 (with border #1d8196) to move toward coast/sea teal; minor rivers unchanged #20719f.
- All five campaign map SVG/PNG files exported from the shared JavaScript engine, rasterized by Inkscape.
- Regression: other three maps unchanged from v295; Kiev and Kiev-Odessa change because major rivers use common renderer.
- Older v290 test is superseded by the v292 Sea-cell addition. The v293 test references an output folder not included in v295 archive.
