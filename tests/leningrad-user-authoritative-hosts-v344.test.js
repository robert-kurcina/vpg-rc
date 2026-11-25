'use strict';
// Immutable regression contract from the user's explicit 2026-11-19 host-cell list.
// Do NOT derive these expectations from the board JSON, archived SVG instances or scans.
const assert=require('node:assert/strict');
const board=require('../maps/leningrad.json');
const Terrain=require('../core/terrain_tiles');
const Presentation=require('../core/presentation');
const explicit={cross:['0210','0310','0311','0411','0511'],star:['0209','0309','0410','0510','0611']};
const cells=new Map(board.cells.map(c=>[c.id,c]));
const active={};
for(const kind of ['cross','star']){
 const entries=board.cells.flatMap(c=>(c.tileMarkers||[]).filter(m=>m.kind===kind).map(m=>({id:c.id,m})));
 assert.equal(entries.length,5,`${kind} count`);
 assert.deepEqual(entries.map(x=>x.id).sort(),[...explicit[kind]].sort(),`${kind} physical hosts`);
 for(const {id,m} of entries){
  assert.equal(m.hostCell,id,`${kind} explicit hostCell must equal owning cell ID`);
  assert.equal(m.faction,kind==='cross'?'german':'soviet');
  assert.equal(m.status,'authored-svg-geometry-v343');
 }
 active[kind]=entries.map(x=>x.id).sort();
}
assert.equal(new Set([...active.cross,...active.star]).size,10,'no cross/star overlap');
assert.equal(board.geometry.deploymentMarkerPlacement,undefined,'do not fork renderer for Leningrad');
assert.equal(board.v344UserDeploymentAuthority.historicalSetupAuthorized,false);
assert.equal(board.v344UserDeploymentAuthority.status,'superseded-by-v345-user-approved-left-render');
assert.deepEqual(board.v345UserApprovedLeftRender.germanCrosses,explicit.cross);
assert.deepEqual(board.v345UserApprovedLeftRender.sovietStars,explicit.star);
assert(Terrain.validate(board,{requireReciprocal:true}).errors.length===0);
const style=Terrain.numberStyle(board,{});
assert.equal(Terrain.formatHexNumber(cells.get('1701'),style),'1601');
assert.equal(Terrain.formatHexNumber(cells.get('0511'),style),'0411');
const svg=Terrain.svgMap(board,Presentation.options('leningrad',{showWaterBodies:false}));
const markers=[...svg.matchAll(/<g data-deployment-hex="([0-9]{4})" data-deployment-kind="(cross|star)" data-placement="([^"]+)"[^>]*transform="translate\(([-.0-9]+) ([-.0-9]+)\) scale\(([-.0-9]+)\)"/g)];
assert.equal(markers.length,10,'fresh SVG must contain exactly 10 marker layers');
for(const [,id,kind,placement,x,y] of markers){
 assert(explicit[kind].includes(id),`unexpected SVG ${kind} host ${id}`);
 assert.equal(placement,'bottom-center');
 assert(Math.abs(Number(x)-cells.get(id).pixelCenter[0])<.02,`wrong horizontal placement for ${id}`);
 assert(Number.isFinite(Number(y)));
}
console.log('PASS v345: latest visual approval supersedes v344, ten rendered markers, universal renderer, unchanged printed coordinates');
