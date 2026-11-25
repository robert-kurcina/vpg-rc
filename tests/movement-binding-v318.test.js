'use strict';
const assert=require('node:assert/strict');
const B=require('../core/movement_binding');
const M=require('../core/movement_rules');
const L=require('../maps/leningrad.json');
const A=require('../maps/arduous.json');
const K=require('../maps/kiev.json');
const C=require('../maps/composer');
const O=require('../maps/odessa-extension.json');
const copy=o=>structuredClone(o);
let n=0;const eq=(a,b)=>{assert.deepEqual(a,b);n++};
const profile=require('../maps/movement-configs/leningrad.json');
const binding=B.build(L,profile);
eq(binding.metadata.hexCount,197);eq(binding.metadata.edgeCount,533);eq(binding.metadata.railEdges,80);eq(binding.metadata.riverEdges,69);
const e=binding.board.edges.find(e=>!e.impassable&&!e.rail&&binding.board.cells[e.a].verified&&binding.board.cells[e.b].terrain==='open');
assert.ok(e);n++;
const units={x:{id:'x',owner:'german',nationality:'german',class:'infantry',size:'corps',hex:e.a,mp:4}};
const phase={kind:'movement',owner:'german'};
const request={unitId:'x',path:[e.a,e.b]};
eq(B.move(binding,phase,units,2,request),M.move(B.context(binding,phase,units,2),request));
assert.equal(B.move(binding,phase,units,2,request).ok,true);n++;
const coast=binding.board.edges.find(e=>e.impassable&&binding.board.cells[e.a].verified);
assert.ok(coast);n++;
units.x.hex=coast.a;
assert.equal(B.move(binding,phase,units,2,{unitId:'x',path:[coast.a,coast.b]}).reason,'impassable-hexside');n++;
// A visible river alone must never become an unaudited major-river surcharge.
assert.ok(binding.board.edges.some(e=>e.river&&!e.majorRiver));n++;
const ard=B.build(A,require('../maps/movement-configs/arduous.json'));
eq(ard.metadata.riverEdges,45);eq(ard.metadata.railEdges,85);
const kiev=B.build(K,require('../maps/movement-configs/kiev.json'));
eq(kiev.metadata.hexCount,165);eq(kiev.metadata.edgeCount,442);eq(kiev.metadata.railEdges,93);eq(kiev.metadata.riverEdges,72);
for(const map of [C.compose(K,O)]){
 assert.throws(()=>B.build(map,profile),/not-gameplay-certified/);n++;
}
for(const variant of [
 m=>{m.cells[0].terrainStatus='provisional';},
 m=>{m.hexCenterRailConnections[0].status='unverified';},
 m=>{m.sourceImageSHA256='fake';}
]){const tampered=copy(L);variant(tampered);assert.throws(()=>B.build(tampered,profile));n++;}
for(const invalid of [{...profile,railCost:0},{...profile,terrainCosts:{open:0}}]){
 assert.throws(()=>B.build(L,invalid),/Invalid movement profile/);n++;
}
console.log('PASS movement binding',n,'checks; verified Leningrad, Arduous and Kiev boards; unauthorized composite blocked');
