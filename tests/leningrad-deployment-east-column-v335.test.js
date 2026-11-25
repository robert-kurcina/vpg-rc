'use strict';
// Historical east-column shifts and SVG-autoassignment remain audit-only.
// Active authority is the explicit user's host-cell list, never the older transforms.
const assert=require('node:assert/strict');
const board=require('../maps/leningrad.json');
const T=require('../core/terrain_tiles');
const P=require('../core/presentation');
for(const k of ['v335DeploymentColumnCorrection','v338DeploymentColumnCorrection','v342GridRegisteredDeployment']){
 assert.equal(board[k].moves.length,10);
}
const historicalSvg=new Map(board.v343SourceSvgHostCells.hostCellAssignments.map(a=>[a.sourceSvgId,a.hostCell]));
assert.equal(historicalSvg.size,10);
const active=Object.fromEntries(['cross','star'].map(kind=>[kind,board.cells.flatMap(c=>(c.tileMarkers||[]).filter(m=>m.kind===kind).map(()=>c.id)).sort()]));
assert.deepEqual(active.cross,['0210','0310','0311','0411','0511']);
assert.deepEqual(active.star,['0209','0309','0410','0510','0611']);
assert.deepEqual(active.cross,['0210','0310','0311','0411','0511']);
assert.equal(board.v345UserApprovedLeftRender.active,true);
const svg=T.svgMap(board,P.options('leningrad',{}));
for(const [kind,ids] of Object.entries(active)){
 for(const id of ids)assert(svg.includes(`data-deployment-hex="${id}" data-deployment-kind="${kind}"`));
}
console.log('PASS v344: historical east-shift and SVG audits preserved; explicit user host cells active');
