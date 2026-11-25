'use strict';
// Modern source-lineage contract for v302: test the current source geometry,
// not an obsolete exports-v302 snapshot excluded from clean checkpoints.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const T=require('../core/terrain_tiles');
const P=require('../core/presentation');
const b=require('../maps/leningrad.json');
const r=require('../rules/audit/leningrad-svg-footprint-v346.json');
const audit=b.v302ImportAudit;
assert.equal(b.cells.length,197);
assert.equal(r.sourceFootprintReconciled,true);
assert.deepEqual(audit.removedUnsupportedCells,['1801','2001']);
assert.deepEqual(r.gridOnlyUnpaintedOutlines.map(x=>x.sourceSvgPaths),[['path142'],['path144']]);
assert.equal(audit.sourceCoastSegments,53);
assert.equal(audit.registeredCoastSides,47);
assert.equal(audit.registeredLakeSides,9);
assert(audit.segmentSideAudit.every(e=>e.errorPx<1));
assert.equal(b.sourceRailRoutes.length,14);
assert.equal(b.preRegisteredRailGeometry,true);
assert.equal(b.authoritativeRailPolylineGeometry,true);
const svg=T.svgMap(b,P.options('leningrad',{}));
assert.equal((svg.match(/class="authored-center-rail"/g)||[]).length,14);
assert(svg.includes('class="source-coast-connected-wavelet-fringe"'),'Current source-coast wavelet layer missing');
assert(!svg.includes('grid-face-rail-network'));
assert(!svg.includes('data-hex="2001"'));
assert(!svg.includes('data-hex="1801"'));
assert.equal(T.validate(b,{requireReciprocal:false}).errors.length,0);
console.log('PASS v302/v346: source-backed 197 terrain-cell footprint and railway/coast geometry unchanged');
