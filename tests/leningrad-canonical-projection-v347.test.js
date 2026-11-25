'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const T=require('../core/terrain_tiles');
const C=require('../core/canonical_hex_projection');
const board=require('../maps/leningrad.json');
const sourceText=fs.readFileSync(require.resolve('../maps/leningrad.json'),'utf8');
const projection=C.project(board,c=>T.formatHexNumber(c,T.numberStyle(board,{})));
const {record:r,board:p}=projection;
assert.equal(r.sourceCellCount,197);assert.equal(r.canonicalCellCount,186);
assert.equal(r.visualOnlyCellCount,11);assert.equal(r.canonicalPhysicalEdges,502);
assert.deepEqual(r.migratedFeatureCounts,{railConnections:80,railwayBoundaryExits:10,entryBoundaryEdges:23,authoredShoreSides:54,canonicalSeaCells:35});
assert.equal(r.visualOnlyFeatureRecords.shoreSides.length,2);assert.equal(r.visualOnlyFeatureRecords.seaPhysicalIds.length,11);
assert.deepEqual(r.errors,[]);assert.equal(r.activationStatus,'PREVIEW_ONLY');
assert.deepEqual(r.visualOnly.map(c=>c.physicalId),['0101','0102','0103','0104','0105','0106','0107','0108','0109','0110','0201']);
assert(r.visualOnly.every(c=>c.terrain==='sea'));
assert.equal(p.geometry.neighborMode,'explicit');
assert(!('printedColumnOffset' in p.geometry.hexNumbers));
assert(!('printedRowOffsetsByColumn' in p.geometry.hexNumbers));
assert.equal(new Set(p.cells.map(c=>c.id)).size,186);
assert(p.cells.every(c=>c.id===c.displayNumber&&c.id===T.formatHexNumber(c,T.numberStyle(p,{}))));
assert.equal(r.physicalToCanonical['1701'],'1601');
assert.equal(r.canonicalToPhysical['1601'],'1701');
assert.deepEqual(r.deploymentMarkers.filter(x=>x.kind==='cross').map(x=>x.id).sort(),['0109','0210','0211','0311','0411']);
assert.deepEqual(r.deploymentMarkers.filter(x=>x.kind==='star').map(x=>x.id).sort(),['0108','0209','0310','0410','0511']);
const origById=new Map(board.cells.map(c=>[c.id,c]));
const projById=new Map(p.cells.map(c=>[c.id,c]));
assert.equal(T.validate(p,{requireReciprocal:true}).errors.length,0);
for(const rail of p.hexCenterRailConnections){const a=projById.get(rail.from);assert(a&&projById.has(rail.to));assert(T.DIRS.some(d=>T.neighbor(a,d,p.geometry)===rail.to),'rail is not a physical neighbor');}
for(const exit of p.railwayBoundaryExits){const c=projById.get(exit.from);assert(c&&!T.neighbor(c,exit.dir,p.geometry),'rail exit is no longer off board');}
for(const shore of p.authoredShoreHexsides)assert(projById.has(shore.cellId));
for(const path of p.entryBoundarySelections.paths)for(const e of path.edges)assert(projById.has(e.cellId));
for(const c of p.cells){
 const source=origById.get(c.legacyPhysicalCellId);
 assert.deepEqual(c.pixelCenter,source.pixelCenter,'physical center moved: '+c.id);
 for(const dir of T.DIRS){
  const n=T.neighbor(c,dir,p.geometry);
  const oldN=T.neighbor(source,dir,board.geometry);
  assert.equal(n,r.physicalToCanonical[oldN]||null,'adjacency changed: '+c.id+':'+dir);
  if(n)assert.equal(T.neighbor(projById.get(n),T.OPP[dir],p.geometry),c.id,'nonreciprocal '+c.id+':'+dir);
 }
}
const sides=T.gridSegmentData(p);
assert.equal(sides.filter(s=>s.neighborId).length,502);
assert.equal(sides.length,614);
assert.equal(fs.readFileSync(require.resolve('../maps/leningrad.json'),'utf8'),sourceText,'production config mutated');
// Fail-closed on a symbol placed inside a visual-only sea cell.
const bad=JSON.parse(JSON.stringify(board));
bad.cells.find(c=>c.id==='0108').tileMarkers.push({kind:'cross',faction:'german'});
assert.throws(()=>C.project(bad,c=>T.formatHexNumber(c,T.numberStyle(bad,{}))),/Unnumbered cell carries gameplay data/);
// Fail-closed on duplicate canonical names.
assert.throws(()=>C.project(board,()=> '0101'),/Duplicate canonical ID/);
const broken=JSON.parse(JSON.stringify(p));
delete broken.geometry.explicitNeighbors['0109'].NE;
assert.throws(()=>T.neighbor(broken.cells.find(c=>c.id==='0109'),'NE',broken.geometry),/Missing explicit neighbor/);
console.log('PASS v347: 186 canonical IDs, 11 visual-only sea cells, exact 502-edge physical topology, fail-closed projection');
