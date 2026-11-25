'use strict';
// The user explicitly identified LEFT (v343) as correct in the exact comparison
// exports/leningrad-fresh-v343-v344-comparison.png and rejected RIGHT (v344).
const assert=require('node:assert/strict');
const board=require('../maps/leningrad.json');
const T=require('../core/terrain_tiles');
const P=require('../core/presentation');
const expected={cross:['0210','0310','0311','0411','0511'],star:['0209','0309','0410','0510','0611']};
const cells=new Map(board.cells.map(c=>[c.id,c]));
for(const [kind,ids] of Object.entries(expected)){
 const found=board.cells.flatMap(c=>(c.tileMarkers||[]).filter(m=>m.kind===kind).map(m=>({id:c.id,m})));
 assert.deepEqual(found.map(x=>x.id).sort(),ids,`user-approved ${kind} positions`);
 for(const {id,m} of found){
  assert.equal(m.hostCell,id);
  assert.equal(m.faction,kind==='cross'?'german':'soviet');
  assert.equal(m.status,'authored-svg-geometry-v343');
  assert(m.sourceSvgId && Array.isArray(m.sourceSvgCenter));
 }
}
assert.equal(new Set([...expected.cross,...expected.star]).size,10);
assert.equal(board.v345UserApprovedLeftRender.active,true);
assert.equal(board.v345UserApprovedLeftRender.approvedSide,'left');
assert.equal(board.v344UserDeploymentAuthority.status,'superseded-by-v345-user-approved-left-render');
assert(!board.cells.find(c=>c.id==='0108').tileMarkers.some(m=>m.kind==='star'));
assert(!board.cells.find(c=>c.id==='0109').tileMarkers.some(m=>m.kind==='cross'));
assert.equal(board.geometry.deploymentMarkerPlacement,undefined);
const style=T.numberStyle(board,{});
assert.equal(T.formatHexNumber(cells.get('1701'),style),'1601');
assert.equal(T.formatHexNumber(cells.get('0511'),style),'0411');
assert.equal(T.validate(board,{requireReciprocal:true}).errors.length,0);
const svg=T.svgMap(board,P.options('leningrad',{}));
const match=[...svg.matchAll(/data-deployment-hex="([0-9]{4})" data-deployment-kind="(cross|star)" data-placement="([^"]+)"/g)];
assert.equal(match.length,10);
for(const [,id,kind,placement] of match){
 assert(expected[kind].includes(id));
 assert.equal(placement,'bottom-center');
}
console.log('PASS v345: user-approved left v343 placement active; rejected v344 blocked; renderer and numbers unchanged');
