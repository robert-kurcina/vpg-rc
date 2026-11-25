# v304 — Leningrad river source geometry correction

- Corrects v302/v303 visual river regression: previous river drawing used 144 old inferred hexside records instead of the authored vectors.
- Renders exactly 10 paths from `leningrad-main.svg` `river-minor` layer through the existing authored river ribbon renderer.
- The authoritative SVG's `river-major` layer is empty; no major-river paths or widths are invented.
- Preserves separate source-water and gameplay records for audit; gameplay river-crossing rules not certified.
- Retains v303 Sea/Coast masks and city/reinforcement stacking changes.
