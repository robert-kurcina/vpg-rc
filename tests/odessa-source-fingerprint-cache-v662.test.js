'use strict';
const A=require('node:assert/strict'),G=require('../core/map_movement_graph');
const source=require('../maps/kiev-odessa-composite-experimental-v531.json');
const registry=require('../maps/movement-configs/experimental-source-graph-ledgers.json');
const scope=require('../maps/movement-configs/kiev-odessa-experimental-v531.json').experimentalGraphScope;
const map=structuredClone(source),record=registry.maps[map.id];
const build=m=>G.build(m,{experimentalScope:scope});
let n=0;const eq=(a,b)=>{A.deepEqual(a,b);n++;};const rejects=f=>{A.throws(f,/fingerprint-mismatch/);n++;};
const original=build(map);eq(build(map),original);eq(build(structuredClone(map)),original);
const changed=build(map);changed.edges[0].rail=!changed.edges[0].rail;eq(build(map),original);
const terrain=map.cells[0].terrain;map.cells[0].terrain=terrain==='sea'?'open':'sea';rejects(()=>build(map));map.cells[0].terrain=terrain;eq(build(map),original);
const saved=record.board.edges[0].rail;try{record.board.edges[0].rail=!saved;rejects(()=>build(map));}finally{record.board.edges[0].rail=saved;}
eq(build(map),original);
const invalid=structuredClone(map);invalid.geometry.calibration.pitchX+=1;rejects(()=>build(invalid));eq(build(map),original);
A.throws(()=>G.build(map,{experimentalScope:'wrong'}),/source-geometry-not-gameplay-certified/);n++;
console.log('PASS source fingerprint cache:',n,'assertions');
