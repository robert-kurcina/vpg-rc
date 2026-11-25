const assert=require('node:assert/strict');
const kiev=require('../maps/kiev.json');
const proof=require('../rules/audit/kiev-definitive-city-river-v429.json');
const Graph=require('../core/map_movement_graph.js');
const Movement=require('../core/movement_binding.js');
const source=require('../maps/movement-configs/graph-sources.json');
assert.equal(kiev.cells.length,165);
assert.equal(proof.cityCount,16);assert.equal(proof.riverCount,72);
assert.equal(proof.majorRiverCount,10);
assert.equal(proof.cityGameplayTerrain['1404'].type,'major-city');
assert.equal(kiev.cells.find(c=>c.id==='1404').tileMarkers.find(m=>m.kind==='majorCity').sourceSvgId, proof.cityGameplayTerrain['1404'].svgId);
assert.equal(source.maps[kiev.id].status,'verified');
assert.throws(()=>Graph.build({...kiev,sourceImageSHA256:'untrusted-v485-test'}),/source-geometry-not-gameplay-certified/);
assert.equal(proof.movementAuthorized,false);
assert.equal(proof.combatAuthorized,false);
assert.equal(proof.riverHexsides.length,82);
assert.equal(new Set(proof.riverHexsides.map(x=>x.hexPair)).size,82);
for(const side of proof.riverHexsides){
 assert.match(side.hexPair,/^\d{4}:\d{4}$/);
 assert(side.coverageFraction>=0.9);
 assert(['river','majorRiver'].includes(side.kind));
}
assert.equal(kiev.hexCenterRailConnections.length,93);
console.log('Kiev city/river source geometry and movement gate: PASS');
