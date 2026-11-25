'use strict';
// The shared renderer uses the same bottom-center placement for all boards.
// Original source-SVG centers remain recorded separately for provenance.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const T=require('../core/terrain_tiles');
const P=require('../core/presentation');
const board=require('../maps/leningrad.json');
const authoritativeSvg=fs.readFileSync(path.join(__dirname,'../maps/source/user-svg/leningrad-main.svg'),'utf8');
assert.match(authoritativeSvg,/id="g10"/); // actual German cross symbol
assert.match(authoritativeSvg,/id="use1-1"/); // actual cross instance
const svg=T.svgMap(board,P.options('leningrad',{showWaterBodies:false}));
const markers=[...svg.matchAll(/<g data-deployment-hex="([0-9]{4})" data-deployment-kind="(cross|star)"[^>]*data-placement="([^"]+)"[^>]*transform="translate\(([-.0-9]+) ([-.0-9]+)\) scale\(([-.0-9]+)\)"/g)];
const byHex=new Map(markers.map(m=>[m[1],{kind:m[2],placement:m[3],x:Number(m[4]),y:Number(m[5]),scale:Number(m[6])}]));
const crosses=['0210','0310','0311','0411','0511'];
for(const id of crosses){
 const cell=board.cells.find(c=>c.id===id);const marker=byHex.get(id);
 assert(marker,`missing ${id}`);assert.equal(marker.kind,'cross');assert.equal(marker.placement,'bottom-center');
 assert(Math.abs(marker.x-cell.pixelCenter[0])<.011,`misaligned x ${id}`);
 assert(marker.y>cell.pixelCenter[1],`bottom-center mismatch ${id}`);
}
assert.equal(markers.filter(m=>m[2]==='cross').length,5);
assert(!byHex.has('0109')&&!byHex.has('0110')); // left v343 has no western sea cross
const soviet=byHex.get('0510');const c=board.cells.find(c=>c.id==='0510');
assert(soviet&&soviet.kind==='star'&&soviet.placement==='bottom-center');
assert(soviet.y>c.pixelCenter[1]);
// Source geometry: Inkscape query-all for source authored symbol use instances,
// centers coincide with source-registered hex centers (unit: source SVG px).
const originalAnchors={
 '0210':{id:'use1-1',x:114.0448,y:652.0541},
 '0310':{id:'use495',x:170.3761,y:685.2321},
 '0411':{id:'use496',x:226.7071,y:719.4361}
};
for(const [id,{x,y}] of Object.entries(originalAnchors)){
 const center=board.cells.find(c=>c.id===id).pixelCenter;
 assert(Math.abs(center[0]-x)<.01&&Math.abs(center[1]-y)<.01,`source SVG anchor disagrees with ${id}`);
}
// Check another scenario retains its existing bottom-center placement.
const other=require('../maps/kiev.json');const otherSvg=T.svgMap(other,P.options('kiev',{showWaterBodies:false}));
assert.match(otherSvg,/data-deployment-hex="[0-9]{4}"[^>]+data-placement="bottom-center"/);
console.log('PASS v336: Leningrad and Kiev use universal lower-center placement');
