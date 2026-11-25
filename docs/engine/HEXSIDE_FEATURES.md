# Shared hexside-feature ledger (v318 Checkpoint 61)

`WargameHexsideFeatures.inspect(map)` enumerates canonical reciprocal neighbor pairs from the **same cells and geometry as the map renderer**. `edge(ledger,a,b)` returns an undirected neighbor record.

There are two evidence tiers:

- `certified-movement`: only when `WargameMapMovementGraph.build` accepts the map under the immutable `maps/movement-configs/graph-sources.json` source policy. A record exposes approved rail, river, impassable and `movementAuthorized` attributes. These represent geography eligibility, **not** unit-specific legality; movement phases, ZOC, strength and nationality are still adjudicated by the common movement rules.
- `geometry-only`: for maps without certified movement input. Source shoreline entries and source feature counts may be inspected, but `rail=false`, `river=false`, `impassable=null`, and `movementAuthorized=false` deliberately prevent accidental promotion to executable gameplay.

The Kiev–Odessa composite remains geometry-only. The shared `maps/composer.js` and `core/composite_graph_audit.js` remain the authority for its assembly and seam diagnostics; the 24 seam pairs are not automatically legal movement edges. The approved map and counter assets are not changed.

## Not yet complete

This ledger does **not** certify Kiev/Arduous terrain, trace railway polylines into legal links, certify Odessa water crossings, or implement scenario-specific naval rules. Source-validated railway/river registrations and hexside microrules must precede activation for those maps. Browser consumption of the ledger remains WIP.
