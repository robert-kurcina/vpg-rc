'use strict';
const assert=require('node:assert/strict');
const board=require('../maps/leningrad.json');
const T=require('../core/terrain_tiles');
const P=require('../core/presentation');
const b=board.v333SourceRegistrationRepair;
const marker=k=>board.cells.flatMap(c=>(c.tileMarkers||[]).filter(m=>m.kind===k).map(m=>({cell:c.id,source:m.sourceSvgCenter}))); 
const crosses=marker('cross'),stars=marker('star');
assert.deepEqual(crosses.map(m=>m.cell).sort(),['0210','0310','0311','0411','0511']);
assert.deepEqual(stars.map(m=>m.cell).sort(),['0209','0309','0410','0510','0611']);
assert.equal(new Set(crosses.map(m=>m.cell)).size,5);
assert.equal(new Set(stars.map(m=>m.cell)).size,5);
assert.equal(crosses.filter(m=>stars.some(s=>s.cell===m.cell)).length,0);
assert(board.v343SourceSvgHostCells&&board.v343SourceSvgHostCells.scanEvidenceUsed===false);
assert.equal(board.geometry.hexNumbers.rowShift,undefined);
assert(b.markerObservations.every(x=>x.nearestDistance<30&&x.secondDistance-x.nearestDistance>15));
const svg=T.svgMap(board,P.options('leningrad',{showWaterBodies:false}));
for(const c of crosses)assert(svg.includes(`data-deployment-hex="${c.cell}" data-deployment-kind="cross"`),c.cell);
for(const s of stars)assert(svg.includes(`data-deployment-hex="${s.cell}" data-deployment-kind="star"`),s.cell);
const labels=[...svg.matchAll(/data-number-cell="([0-9]{4})" data-display-number="([0-9]{4})"/g)];
assert(labels.length>0);
assert(labels.some(x=>x[1]!==x[2])); // physical cell and historical printed label differ
assert(svg.includes('data-number-cell="0211"')); // previous row-shift suppressed southern labels
assert.equal(T.validate(board,{requireReciprocal:true}).errors.length,0);
console.log('PASS v345: historical scan-affine report archived; active user-authoritative hosts rendered');
