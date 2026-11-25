# Checkpoint 222 / v456 — Explicit city dots at vertices and side positions

Replaced the sparse dashed-style city dot overlay with an explicit symmetric dot pattern.

## City border construction

Each city hex now renders:

- one continuous black border on the exact hex outline;
- black dots at each of the **6 vertices**;
- black dots at each of the **6 side midpoints**;
- black dots at the **12 quarter points** between each midpoint and its neighboring vertices.

This yields **24 explicit dots per city hex**.

## Style

- Base border: black, continuous, 2.8 units.
- Dot radius: 1.5 units (derived from `cityBorderWidth: 3.0`).
- Geometry: exact hex outline path.
- Dot rendering: explicit `<circle>` elements, not stroke dashes.

## Scope

Applied in the shared node renderer, browser bundle, and optional vector artwork. Gameplay, terrain, city classification, and shared CRT are unchanged.
