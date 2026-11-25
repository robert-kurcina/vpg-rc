# Checkpoint 282 / v516 — Support counter image rendering verified

## Finding

The counter photographs were already present in the checkpoint, and the
shipped historical browser pages contain the correct relative image URLs:
`../../../assets/support-counters/<faceId>.png`.

The broken-image placeholders reported in the Kiev Turn-2 reinforcement
screenshot came from an **offline Chromium test fixture** that constructs the
page with `page.set_content()` (about:blank). The test injected project CSS,
JavaScript, JSON and the actual exported game map, but failed to provide
Support counter image bytes under the original relative URLs. This is a test
fixture error; it is not evidence of missing counter art in the package.

## Correction

- Added `tests/support_counter_offline_assets_v516.py` to validate each
  current Support / Fleet `<img src>` against the real project-relative file
  before loading the **exact original cropped source pixels** as data URIs
  for the in-memory browser fixture. This is test-only; the shipped gameplay
  code continues using ordinary project-relative URLs.
- Added source-art contract checks across Kiev, Arduous, Leningrad and Odessa
  source faces. Missing or mistyped URLs now fail a test rather than silently
  producing evidence with broken-image icons.
- Regenerated the Kiev Air Support and Turn-2 reinforcement screenshots;
  Chromium verifies that both FK IV and FK V images decode with positive
  intrinsic dimensions before saving either screenshot.
- Changed visible Air and Fleet thumbnail image loading from `lazy` to `eager`
  to avoid deferring these small, high-priority controls when a window expands.
- Updated legacy reinforcement/resupply guidance to describe dark-yellow
  outlines, matching checkpoint 281's accepted shared legal-hex highlight.

## Verification scope

- Live source engine and original map export are used in the in-memory browser.
- No generated/redrawn/third-party artwork is introduced.
- No gameplay, combat, stacking, terrain, map, CRT or Support legality change.
- Direct HTTP navigation is unavailable in the execution sandbox; source-path
  resolution and bitmap decoding were independently verified, not represented
  as a live external server test.
