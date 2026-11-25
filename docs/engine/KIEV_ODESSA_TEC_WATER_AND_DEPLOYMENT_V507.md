# Checkpoint 273 / v507 — TEC water-feature and deployment specimen expansion

The Kiev / Kiev–Odessa Terrain Effects Chart has been expanded and re-rendered
through the shared engine to cover additional map-feature exemplars.

## Added TEC rows

Three new rows were added between `Major River` and `Railway / Railroad`:

- `Coast`
- `Lake`
- `Sea`

## Requested specimen changes implemented

### 1. River / Major River

Both specimens now show the feature across **three consecutive hexsides** for
better legibility at chart scale.

### 2. Coast

The Coast specimen is rendered from a **central Sea hex** and shows **three
consecutive coastal hexsides** using the shared engine's shoreline treatment.

### 3. Lake

The Lake specimen shows **two consecutive lake hexsides** using the shared
engine's inland-water boundary treatment.

### 4. Sea

A dedicated Sea specimen row now exists, using a central Sea hex exemplar.

### 5. Deployment

The Deployment row now shows:

- Soviet `Star`
- Axis `Cross`
- `Infantry`
- `Cavalry`
- `Mechanized`

All five symbols are rendered **inside the specimen hex**. This uses a
presentation-only crowded deployment layout override supplied only to the TEC
specimen build, leaving the historical map renderer unchanged.

## Scope

This is a **TEC presentation update only**.

No gameplay rules, map geometry, territorial classifications, or campaign state
logic were changed.
