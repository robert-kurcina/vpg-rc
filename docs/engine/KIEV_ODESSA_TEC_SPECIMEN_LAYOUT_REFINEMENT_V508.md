# Checkpoint 274 / v508 — TEC specimen layout refinement

Follow-up refinement to the shared-engine Terrain Effects Chart specimens.

## Changes

### Coast
- Reworked to a **Sea hex** base.
- Coast now appears on the **top three consecutive hexsides** of that Sea hex.
- This replaces the earlier broader coast/water treatment.

### Lake
- Reworked to use a **smooth joined two-side lake stroke**.
- The previous specimen showed a harsher segmented join.

### Deployment specimen
- Removed the specimen-only crowded scale reduction.
- Deployment icons now render at **normal shared-engine scale**.
- The specimen is laid out in **three in-hex rows**, instead of one compressed row.
- The row still remains a TEC presentation specimen only; historical map deployment rendering is unchanged.

## Engine impact

A presentation-only shared renderer extension was added:
- `deploymentMarkerLayout.useStandardScale`
- `deploymentMarkerLayout.slotOffsets`

These support specimen-specific in-hex icon layouts without altering historical map behavior.

## Scope

No rules logic, map topology, or territorial semantics changed.
