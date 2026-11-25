# Checkpoint 234 / v468 — Kiev pregame national-region deployment

## Provenance and scope

The supplied **Objective: Kiev** §6 opening (printed page 2), photographed 40-face counter configuration, and user-authored map markers already identify separate initial Axis regions: seven German-in-Poland crosses and four German/Romanian-in-Romania crosses. The common source setup validator rejected out-of-region moves but `historical_deployment_session.choices()` previously advertised **all 11** crosses to a German or Romanian unit. This is a misleading player-action catalogue, not a game legality failure.

## Change

- `core/historical_deployment_session.js`: filter per-unit candidate marker destinations through its configured group `allowedHexes` before advertising choices. Unrestricted groups still see all markers of the correct kind. The existing source setup validator remains the authority on stacking, adjacency, identity, and occupancy.
- The existing universal browser bundle is rebuilt from source with **no extra Kiev fixture/modules**. The Chromium test passes the published-source Kiev JSON and source-legal starting counter allocation into the same bundled `Deployment` module; this avoids increasing the payload for Leningrad/Arduous players. No Kiev `native-preview` game or production campaign route is registered.
- No per-scenario conditional code, new CRT, alternative renderer, or new historical assumption.

## Tests

- `node tests/kiev-deployment-region-choices-v468.test.js --write-audit`: 100 assertions, including all opening groups, Poland/Romania exclusivity, valid/invalid position swaps, occupied Romanian slot rejection, fixed Soviet rear markers, concealed ten-Mech mixing, required mixing before first phase, save integrity, actual opening cursor, and live movement policy denial.
- `python3 tests/kiev-deployment-browser-runtime-v468.py`: 20 checks in real isolated Chromium, executing the bundled source with its original Kiev JSON and the same 30-unit sample fixture. Tests country group choices, out-of-region rejection, stacking, mixing, source save restore, and opening phase. **This tests browser runtime APIs, not a complete player-facing Kiev UI.**
- Existing Leningrad player deployment and eight-turn customized campaign regression, Arduous full source opening and seven-turn smoke, Kiev §6 fixture (180), inventory preflight (289), Romania source boundary audit (27), and 165-hex source-reviewed graph (2,949) pass.
- The Kiev movement graph remains explicitly `provisional` in `maps/movement-configs/graph-sources.json`; no live campaign authorization, no complete Romanian-country target territory set, and no Kiev seven-turn browser completion.

## Next blocking steps

1. Expose this validated candidate deployment workflow in a player-accessible, **clearly non-playable Kiev setup preview** before the campaign is authorized.
2. Reconcile remaining §10.8 target territory and scenario combat/buildup integration with source evidence; do not extrapolate an entire Romania mask from starting crosses.
3. Only after historical scenario acceptance, enable the certified Kiev movement graph and execute a full seven-turn Chromium campaign.

## Preservation

Approved city dots (v463), five SVG/PNG exports, map/counter source assets, original rules PDFs, and the shared B4M CRT are unchanged.
