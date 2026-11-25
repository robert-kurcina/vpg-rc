#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const R=path.resolve(__dirname,'..'),T=require('../core/terrain_tiles'),C=require('../maps/composer');
const base=require('../maps/kiev.json'),ext=require('../maps/odessa-extension.json');
const board=C.compose(base,ext),by=new Map(board.cells.map(c=>[c.id,c]));
const markup=fs.readFileSync(path.join(R,'exports/kiev-odessa.svg'),'utf8');
assert.deepEqual(T.HEX_FACE,{1:'N',2:'NE',3:'SE',4:'S',5:'SW',6:'NW'});
const requiredExit=ext.railwayBoundaryExits.find(e=>e.from==='0717'&&e.dir===T.HEX_FACE[6]);
assert(requiredExit&&requiredExit.renderConnector&&requiredExit.face===6,'0717 does not reach face 6');
assert(!by.has(T.neighbor(by.get('0717'),'NW',board.geometry)),'0717 rail exit does not point off map');
assert(markup.includes('data-rail-from="0717" data-rail-exit-dir="NW"'),'0717 NW rail exit is not rendered');
for(const id of ['1515','1613','1713','1416']){
 assert(!by.has(id),'Incorrectly retained land hex '+id);
 assert(!markup.includes('data-hex-id="'+id+'"'),'Invalid hex tile rendered at '+id);
 assert(!board.authoredShoreHexsides.some(e=>e.cellId===id),'Invalid shoreline on removed '+id);
 assert(!board.compositeEntryEdges.some(e=>e.cellId===id),'Invalid reinforcement boundary on removed '+id);
 assert(!board.sourceRailRoutes.some(r=>(r.anchors||[]).some(a=>a.hex===id)),'Invalid railway source anchor on removed '+id);
}
assert(by.get('1914')?.terrain==='swamp','Printed 1914 swamp/shore hex missing');
assert(markup.includes('data-hex-id="1914"'),'1914 terrain not rendered');
const c1214=by.get('1214'),c1215=by.get('1215');
assert(!c1214.tileMarkers.some(m=>['star','fixedCavalry'].includes(m.kind)),'1214 still has wrong Soviet marker');
const cavalry=c1215.tileMarkers.find(m=>m.kind==='fixedCavalry'&&m.side==='soviet');
assert(cavalry&&cavalry.sourceSvgSymbolId==='symbol12','1215 missing Soviet cavalry from supplied SVG');
assert(markup.includes('data-deployment-hex="1215" data-deployment-kind="fixedCavalry"'), '1215 cavalry not in live SVG');
assert(markup.includes('data-symbol-library-id="symbol12"'), 'Original cavalry SVG symbol not used');
assert(!markup.includes('data-deployment-hex="1214"'), 'Bad deployment still rendered at 1214');
const features=(id,dir)=>(by.get(id).tileEdges?.[dir]||[]).map(f=>f.kind);
assert(features('1912','S').includes('majorRiver'),'Major River 1912 face 4 absent');
assert(features('1913','N').includes('majorRiver'),'Major River 1913 face 1 absent');
assert(T.neighbor(by.get('1912'),'S',board.geometry)==='1913');
assert(T.neighbor(by.get('1913'),'N',board.geometry)==='1912');
const loc=n=>markup.indexOf('data-layer="'+n+'"');
for(const [before,after] of [['terrain','rivers'],['rivers','water-bodies'],['water-bodies','entry-edges'],['entry-edges','railways'],['railways','hex-grid'],['hex-grid','deployment'],['deployment','city-labels']])
 assert(loc(before)>=0&&loc(before)<loc(after),`Layer regression: ${before} not below ${after}`);
assert(markup.includes('data-layer="entry-edges" data-layer-order="3.75"'));
assert(markup.includes('data-layer="water-bodies" data-layer-order="3.5"'));
const keys=new Set(),links=board.hexCenterRailConnections;
for(const edge of links){assert(by.has(edge.from)&&by.has(edge.to));assert(T.DIRS.some(d=>T.neighbor(by.get(edge.from),d,board.geometry)===edge.to));const k=[edge.from,edge.to].sort().join(':');assert(!keys.has(k));keys.add(k);}
assert.equal(links.length,126,'Reviewed internal railway links unexpectedly changed');
assert.equal(board.railwayBoundaryExits.length,10,'Boundary exit total mismatch');
for(const city of ['Braila','Chisinau','Odessa','Nikolaev']){
 const sites=board.cells.filter(c=>c.city?.name===city);
 assert.equal(sites.length,1,`${city} city is duplicated or absent`);
 assert(markup.includes(`data-symbol-hex="${sites[0].id}" data-city-placement="hex-center"`),`${city} is not centered`);
}
const assertSha=(f,sha)=>assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(R,f))).digest('hex'),sha,`${f} changed`);
assertSha('maps/source/user-svg/odessa-map-temp(4).svg','93476e9f577b19d24b41133bad8340a87bdfef2c47ce2530cba7db708b038265');
const scan='maps/source/kiev-odessa-map-scan.jpg';assertSha(scan,'cb7f3dad98fc2a68055e2899fc7d85b14c356176fcb6fc99be79079199e5d6be');
const check=T.validate(board,{requireReciprocal:true});assert.deepEqual(check.errors,[]);
assert(!check.warnings.some(w=>w.startsWith('1912 ')||w.startsWith('1913 ')),'Major river edges are not reciprocal');
console.log('PASS v280: six faces; 0717 NW exit; 1215 SVG cavalry; 1214 marker removed; 1515/1613/1713 removed; 1914 restored; 1912/1913 reciprocal major river; reinforcement above water; 126 preserved internal rail links; 10 exits; original SVG and source bitmap unchanged');
