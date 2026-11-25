# v305 — Leningrad authored river geometry fidelity

The newly uploaded `leningrad-main(1).svg` has the same SHA-256 as the authoritative source in v304. Its `river-major` layer is empty and its `river-minor` layer contains 10 authored paths. v304 used a procedural filled ribbon that added wave displacement, taper and interpolation to these paths. v305 renders each authored source path as an exact unsmoothed polyline with a fixed 10px stroke. No previously inferred major-river graphics are added.

River movement/combat semantics are unaffected. This fix applies only to Leningrad; other campaigns use their previous renderer options. Source comparison should distinguish coastline/lake water (separate SVG layers) from rivers.
