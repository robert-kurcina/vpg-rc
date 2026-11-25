'use strict';
const assert=require('node:assert/strict');
const board=require('../maps/leningrad.json');
const T=require('../core/terrain_tiles');
const P=require('../core/presentation');
const boardCells=new Map(board.cells.map(c=>[c.id,c]));
const hosts=kind=>board.cells.flatMap(c=>(c.tileMarkers||[]).filter(m=>m.kind===kind).map(()=>c.id)).sort();
const crosses=['0210','0310','0311','0411','0511'];
const stars=['0209','0309','0410','0510','0611'];
assert.deepEqual(hosts('cross'),crosses);
assert.deepEqual(hosts('star'),stars);
assert.equal(new Set([...crosses,...stars]).size,10);
assert.equal(board.geometry.deploymentMarkerPlacement,undefined);
const style=T.numberStyle(board,{});
assert.equal(T.formatHexNumber(boardCells.get('1701'),style),'1601');
assert.equal(T.formatHexNumber(boardCells.get('0511'),style),'0411');
const svg=T.svgMap(board,P.options('leningrad',{}));
const instances=[...svg.matchAll(/<g data-deployment-hex="([0-9]{4})" data-deployment-kind="(cross|star)" data-placement="([^"]+)"/g)];
assert.equal(instances.length,10);
for(const [,id,kind,placement] of instances){
 assert.equal(placement,'bottom-center');
 assert((kind==='cross'?crosses:stars).includes(id),`${kind} at unexpected ${id}`);
}
assert.equal(T.validate(board,{requireReciprocal:true}).errors.length,0);
console.log('PASS v345: explicit host-cell registry in universal renderer; numbered lattice unchanged');
