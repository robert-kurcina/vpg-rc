'use strict';
// v301 is a historical *import*, not the active board footprint. Its two
// north-edge grid outlines were excluded by v302 for lack of terrain artwork.
// The original v301-only test is retained under provenance/llm/retired-tests.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const T=require('../core/terrain_tiles');
const b=require('../maps/leningrad.json');
const r=require('../rules/audit/leningrad-svg-footprint-v346.json');
assert.equal(b.v301ImportAudit.hexes,199,'historical import count must remain documented');
assert.deepEqual(b.v302ImportAudit.removedUnsupportedCells,['1801','2001']);
assert.equal(b.v302ImportAudit.uniqueCells,197);
assert.equal(b.cells.length,197);
assert.equal(r.runtimeHexCells,197);
assert.equal(r.sourceGridPathCount,200);
assert.equal(r.distinctSourceGridCenters,199);
assert.equal(r.sourceFootprintReconciled,true);
assert.deepEqual(r.gridOnlyUnpaintedOutlines.map(x=>x.geometrySlot),['1801','2001']);
assert(!b.cells.some(c=>c.id==='1801'||c.id==='2001'));
assert.deepEqual(Object.fromEntries([...new Set(b.cells.map(c=>c.terrain))].sort().map(x=>[x,b.cells.filter(c=>c.terrain===x).length])),
 {forest:44,open:87,sea:46,swamp:20});
assert.equal(b.sourceRailRoutes.length,14);
assert.equal(b.hexCenterRailConnections.length,80);
assert.equal(b.cells.filter(c=>c.city).length,14);
assert.equal(crypto.createHash('sha256').update(fs.readFileSync('maps/source/user-svg/leningrad-main.svg')).digest('hex'),r.sourceSvgSHA256);
assert.deepEqual(T.validate(b,{requireReciprocal:true}).errors,[]);
console.log('PASS v301→v302→v346: 200 SVG paths, 199 unique positions, 197 terrain-backed cells, source geometry retained');
