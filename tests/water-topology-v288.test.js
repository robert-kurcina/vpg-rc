'use strict';
const assert=require('node:assert/strict');
const T=require('../core/terrain_tiles');
const C=require('../maps/composer');
const kiev=require('../maps/kiev.json');
const odessa=require('../maps/odessa-extension.json');
const b=C.compose(kiev,odessa),radii=T.gridRadii(b.geometry);
const audit=T.shorelineRegistrationAudit(b,...radii);
assert.equal(audit.length,20);
assert.equal(audit.filter(x=>x.sourceRegistered).length,16);
assert.deepEqual(audit.filter(x=>x.sourceRegistered===false).map(x=>x.cellId+':'+x.dir),['1118:SE','1315:SE','1415:NW','1612:SE']);
const svg=T.svgMap(b,{showWaterBodies:true,shoreSegmentsPerSide:5,showGrid:true});
assert(svg.includes('id="source-sea-playable-hex-mask"'));
assert(svg.includes('clip-path="url(#source-sea-playable-hex-mask)"'));
assert.equal((svg.match(/class="water-shore-fringe registered-shore-fringe"/g)||[]).length,16);
assert(!svg.includes('data-shore-cell="1118" data-shore-dir="SE"'));
assert(svg.includes('class="source-registered-river-geometry"'));
assert(svg.includes('class="user-svg-vector-rivers"')); // Kiev author paths survive Odessa bitmap mode
assert(svg.includes('data-authored-path="path50"')); // Kiev authored river path still drawn
assert(!svg.includes('class="water-region-cell" data-water-cell="1813"')); // Sea must not also receive incompatible cyan full-cell fill
assert(!T.svgMap(kiev,{}).includes('id="source-sea-playable-hex-mask"'));
const off=T.svgMap(b,{showSourceSeaInterior:false});
assert(!off.includes('id="source-sea-playable-hex-mask"'));
console.log('PASS v288: 16 source-adjacent coast wavelets, 4 quarantined edges, clipped source sea, preserved river rendering, Kiev isolation');
