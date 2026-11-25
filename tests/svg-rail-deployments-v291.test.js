const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const ext=require('../maps/odessa-extension.json');
const composer=require('../maps/composer.js');
const source=require('../maps/kiev.json');
const b=composer.compose(source,ext);
const kinds=new Set(['cross','star','fixedMechanized','fixedInfantry','fixedCavalry']);
assert.equal(ext.authoritativeRailRoutes.length,24);
assert.equal(b.sourceRailRoutes.length,24);
assert(b.authoritativeRailPolylineGeometry);
assert.equal(b.railwayBoundaryExits.length,0);
assert.equal(b.hexCenterRailConnections.length,0);
const deployments=b.cells.flatMap(c=>(c.tileMarkers||[]).filter(m=>kinds.has(m.kind)).map(m=>({cellId:c.id,...m})));
assert.equal(deployments.length,36);
assert.deepEqual(Object.fromEntries([...new Set(deployments.map(x=>x.kind))].map(k=>[k,deployments.filter(x=>x.kind===k).length])),{
 cross:14,star:14,fixedInfantry:3,fixedMechanized:4,fixedCavalry:1
});
assert.equal(new Set(deployments.map(x=>x.sourceSvgId)).size,36);
for(const d of deployments) assert(d.sourceSvgId && d.sourcePixelCenter);
const svg=fs.readFileSync(path.join(root,'exports/kiev-odessa.svg'),'utf8');
assert.equal((svg.match(/class="authored-center-rail"/g)||[]).length,24);
assert.equal((svg.match(/data-deployment-hex=/g)||[]).length,36);
// Exact authored polyline, never sourceRailSplinePath's cubic interpolation.
for(const rail of ext.authoritativeRailRoutes){
 assert(svg.includes(`data-source-rail-path="${rail.sourceSvgId}"`));
 const m=svg.match(new RegExp(`<path[^>]*class="authored-center-rail"[^>]*data-source-rail-path="${rail.sourceSvgId}"[^>]*>`));
 assert(m,rail.sourceSvgId);
 const d=m[0].match(/d="([^"]+)"/)[1];
 assert(!/[CQST]/.test(d),'spline/arc present in authoritative rail '+rail.sourceSvgId);
}
console.log('v291 exact SVG rails and 36 deployment placements OK');
