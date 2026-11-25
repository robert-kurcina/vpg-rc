'use strict';
const assert=require('node:assert/strict');
const V=require('../core/hex_visual_features');
const map=require('../maps/arduous.json');
const ledger=require('../rules/audit/arduous-svg-side-occupancy-v318.json');
const view=V.normalize(map);const unchanged=JSON.stringify(view);
const enhanced=V.withSvgSideOccupancy(view,ledger,map);
assert.equal(JSON.stringify(view),unchanged);
assert.equal(enhanced.svgSideOccupancy.physicalSidesWithObservations,Object.keys(ledger.edges).length);
assert.equal(enhanced.railLinksMapped,85);
for(const [key,edge] of Object.entries(ledger.edges)){
 assert.deepEqual(enhanced.edges[key].svgMeasuredObservations,edge.observations);
 for(const m of edge.members){
  const side=V.side(enhanced,m.hexId,m.dir);
  assert.deepEqual(side.svgMeasuredObservations,edge.observations);
  assert.equal(side.movementAuthorized,undefined);
 }
}
assert.throws(()=>V.withSvgSideOccupancy(view,{...ledger,authorizedForMovement:true},map),/invalid SVG side occupancy ledger/);
assert.throws(()=>V.withSvgSideOccupancy(view,{...ledger,sourceSvgSha256:'wrong'},map),/stale source/);
let bad=structuredClone(ledger);let first=Object.keys(bad.edges)[0];bad.edges[first].members=[{hexId:'9999',dir:'N'}];
assert.throws(()=>V.withSvgSideOccupancy(view,bad,map),/nonreciprocal/);
bad=structuredClone(ledger);bad.edges[first].observations[0].sourceSvgId='fake';
assert.throws(()=>V.withSvgSideOccupancy(view,bad,map),/invalid measured SVG observation/);
bad=structuredClone(ledger);bad.hexes[bad.edges[first].members[0].hexId].sides[bad.edges[first].members[0].dir]=[];
assert.throws(()=>V.withSvgSideOccupancy(view,bad,map),/differs from canonical/);
console.log('arduous-svg-side-occupancy: PASS');
