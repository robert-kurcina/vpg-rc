# v300 — Standalone Kiev railway parity with Kiev–Odessa

- Replaced the 36 superseded standalone Kiev source railway routes with 24 corresponding authoritative routes from the Kiev–Odessa composite.
- Copied the **already registered, engine-rendered** railway vertices from the full composite, not just the original source SVG input coordinates. This prevents re-snapping against standalone Kiev's smaller visual rail graph from shifting the tracks.
- Added a general `preRegisteredRailGeometry` rendering flag for cases where routes must preserve exact registered coordinates; the compositor clears this flag when rebuilding the full Kiev–Odessa map so its output stays unchanged.
- Kept the established shared railway halo, track, tie and map-footprint clip renderer. Routes extending outside standalone Kiev are clipped; no southern Odessa tracks become visible inside Kiev.
- Removed obsolete extra standalone railway boundary-rendering stubs. Retained all existing provisional logical hex-center railway links without certifying or modifying movement rules.
- Regression: all 24 visible authored railway `d` paths exactly match the full composite's corresponding paths, and the SVG + PNG exports for the other four maps remain byte-identical to v299.
