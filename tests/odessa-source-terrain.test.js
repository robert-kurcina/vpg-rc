// Current terrain and symbol review supersedes v283 old-raster terrain assumptions.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),J=require('../maps/odessa-extension.json');
const C=new Map(J.cells.map(c=>[c.id,c]));
for(const [id,terr] of Object.entries({'0712':'forest','0713':'forest','0714':'forest','0715':'open','0814':'open','0918':'swamp','1014':'open','1115':'forest','1211':'open','1216':'swamp','1218':'swamp','1513':'open','1514':'open','1914':'swamp'})){
 assert.equal(C.get(id)?.terrain,terr,'v286 printed hex terrain '+id);
}
for(const id of ['1416','1515','1613','1713'])assert(!C.has(id),'offboard land hex incorrectly restored: '+id);
assert(C.has('1914'),'1914 must remain land/Coast-adjacent');
assert(C.get('1014').tileMarkers.some(m=>m.kind==='cross'),'printed German deployment at 1014 missing');
assert(!C.get('1114').tileMarkers.some(m=>m.kind==='cross'),'German marker remains in superseded hex 1114');
assert(C.get('1212').city?.name==='Chisinau');
assert(C.get('1113').tileMarkers.some(m=>m.kind==='star'));
assert(C.get('1215').tileMarkers.some(m=>m.kind==='fixedCavalry'&&m.side==='soviet'));
assert.equal(J.waterRenderingMode,'hexside-wavelets');
assert.equal(J.v286SourceRegistration.calibration,'v285-hex-number anchors, 0718 and 1914 outer anchors plus row pitch');
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'maps/source/odessa-map-scan.webp'))).digest('hex'),'21e497a932131d839cbb6e54bed27be4ac422641ca4b07b1a0f604909d5482a8');
console.log('PASS v286 source-registered Odessa terrain, printed deployment, mask, unchanged bitmap and Coast/Lake rendering');
