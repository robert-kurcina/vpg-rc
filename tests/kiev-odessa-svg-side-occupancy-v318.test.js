'use strict';
const assert=require('node:assert/strict');
const V=require('../core/hex_visual_features');
const C=require('../maps/composer');
const k=require('../maps/kiev.json');
const o=require('../maps/odessa-extension.json');
const kl=require('../rules/audit/kiev-svg-side-occupancy-v318.json');
const cl=require('../rules/audit/kiev-odessa-svg-side-occupancy-v318.json');
const kview=V.normalize(k), composite=C.compose(k,o), view=V.normalize(composite);
const original=JSON.stringify(view);
const ksource={sourceKey:'kiev',...k.authoredSourceVectors};
const osource={sourceKey:'odessa',...o.additionalSourceVectors[0],authoredReinforcementTraces:o.authoredReinforcementTraces};
const ke=V.withSvgMultiSourceSides(kview,kl,[ksource]);
const result=V.withSvgMultiSourceSides(view,cl,[ksource,osource]);
assert.equal(JSON.stringify(view),original);
assert.equal(result.hexCount,261);
assert.equal(result.svgSideOccupancy.physicalSidesWithObservations,Object.keys(cl.edges).length);
assert.equal(ke.svgSideOccupancy.physicalSidesWithObservations,Object.keys(kl.edges).length);
for(const [key,edge] of Object.entries(cl.edges)){
 assert.deepEqual(result.edges[key].svgMeasuredObservations,edge.observations);
 for(const m of edge.members){
  assert.deepEqual(V.side(result,m.hexId,m.dir).svgMeasuredObservations,edge.observations);
  assert.equal(V.side(result,m.hexId,m.dir).movementAuthorized,undefined);
 }
}
assert.throws(()=>V.withSvgMultiSourceSides(view,{...cl,authorizedForMovement:true},[ksource,osource]),/invalid multi-source/);
assert.throws(()=>V.withSvgMultiSourceSides(view,cl,[ksource,{...osource,sourceSvgSha256:'stale'}]),/stale SVG/);
let mutated=structuredClone(cl);let key=Object.keys(mutated.edges)[0];
mutated.edges[key].members=[{hexId:'9999',dir:'N'}];
assert.throws(()=>V.withSvgMultiSourceSides(view,mutated,[ksource,osource]),/nonreciprocal/);
mutated=structuredClone(cl);mutated.edges[key].observations[0].sourceSvgId='not-in-source';
assert.throws(()=>V.withSvgMultiSourceSides(view,mutated,[ksource,osource]),/invalid multi-source SVG observation/);
mutated=structuredClone(cl);const member=mutated.edges[key].members[0];mutated.hexes[member.hexId].sides[member.dir]=[];
assert.throws(()=>V.withSvgMultiSourceSides(view,mutated,[ksource,osource]),/differs from canonical/);
console.log('kiev-odessa-svg-side-occupancy: PASS');
