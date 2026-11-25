# Checkpoint 221 / v455 — Sparser city dots on the hex outline

Adjusted the shared city highlight styling in two ways:

1. Reduced the number of round black dots by approximately half again, by doubling the dot-gap repeat length.
2. Moved the city border path from the inset city polygon to the actual city hex outline, so both the solid black border and dot overlay sit directly on the hex outline.

## Style

- Base border: black, continuous, 2.8 units.
- Dot overlay: black, round, 6.0 units.
- Dot pattern: `stroke-dasharray="0.1 28.2"`.
- Geometry: exact hex outline path (`hexPoints(rx, ry)`), not inset.

## Scope

All five map exports and the shared browser renderer use the same vector treatment. Gameplay, map geometry, city classification, terrain, and the shared CRT are unchanged.
