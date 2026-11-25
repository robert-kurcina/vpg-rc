#!/usr/bin/env node
'use strict';
/* Source-anchored regression: only the cited railway and deployment fixes.
   This is a structural/geometry audit, not a rules certification. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const T=require('../core/terrain_tiles'),C=require('../maps/composer');
const base=require('../maps/kiev.json'),extension=require('../maps/odessa-extension.json');
const board=C.compose(base,extension);
const get=id=>board.cells.find(c=>c.id===id);
const links=new Set(board.hexCenterRailConnections.map(l=>[l.from,l.to].sort().join(':')));
const has=(a,b)=>links.has([a,b].sort().join(':'));
const byId=new Map(board.cells.map(c=>[c.id,c]));
for(const [a,b] of [['1010','1111'],['1111','1211'],['1211','1312'],['1116','1117'],['1117','1017'],['1812','1913']])
 assert(has(a,b),`missing source-verified rail ${a}/${b}`);
for(const [a,b] of [['1112','1211'],['1118','1217'],['1216','1217'],['1117','1118']])
 assert(!has(a,b),`unsupported or duplicated rail ${a}/${b}`);
assert(!get('1717'), '1717 is not a playable hex and must not have railroad data');
assert(!board.hexCenterRailConnections.some(l=>l.from==='1717'||l.to==='1717'));
assert(!board.railwayBoundaryExits.some(x=>x.from==='1717'));
assert.equal(board.railwayBoundaryExits.length,10,'v280 adds 0717 face 6 exit');
const r41=extension.bitmapRailCorrections.routes.find(x=>x.sourceRouteIndex===41);
const r40=extension.bitmapRailCorrections.routes.find(x=>x.sourceRouteIndex===40);
assert.deepEqual(r40.hexAnchors,['1111','1211','1312']);
assert.deepEqual(r41.hexAnchors,['1312','1313','1213','1214','1115','1116','1117','1017']);
for(const [a,b] of [['1413','1414'],['1414','1315'],['1315','1316'],['1316','1216']]) assert(!has(a,b),`superseded coastward rail ${a}/${b}`);
assert.deepEqual(r40.points[0],T.coord(get('1111'),board.geometry));
assert.deepEqual(r41.points.at(-1),T.coord(get('1017'),board.geometry));
const displayed=T.registeredSourceRailRoutes(board);
assert.equal(displayed.length,46);
assert.deepEqual(displayed[40].points[0],T.coord(get('1111'),board.geometry));
assert.deepEqual(displayed[41].points.at(-1),T.coord(get('1017'),board.geometry));
const sourceIcon=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/map-symbols/german-symbol122.json')));
const original=fs.readFileSync(path.join(__dirname,'../maps/source/user-svg/odessa-map-temp(4).svg'),'utf8');
assert.equal(sourceIcon.symbolId,'symbol122');
for(const p of sourceIcon.paths){
 assert(original.includes('id="'+p.sourcePathId+'"'));
 assert(original.includes('d="'+p.d+'"'),`source symbol ${p.sourcePathId} geometry changed`);
 const src=fs.readFileSync(path.join(__dirname,'../core/terrain_tiles.js'),'utf8');
 assert(src.includes(p.d),`live engine does not render source symbol path ${p.sourcePathId}`);
}
const moscow=require('../maps/battle-for-moscow.json');
for(const id of ['battle-for-moscow','arduous','leningrad','kiev','kiev-odessa']){
 const map=id==='kiev-odessa'?board:require('../maps/'+id+'.json');
 const svg=fs.readFileSync(path.join(__dirname,'../exports/'+id+'.svg'),'utf8');
 const crossCount=(svg.match(/data-deployment-kind="cross"/g)||[]).length;
 const iconCount=(svg.match(/data-symbol-library-id="symbol122"/g)||[]).length;
 assert.equal(iconCount,crossCount,`${id}: German icon renderer not globally standardized`);
 assert(!svg.includes('class="deployment-ink" d="M-9'),`${id}: obsolete generic German deployment cross`);
}
const svg=fs.readFileSync(path.join(__dirname,'../exports/kiev-odessa.svg'),'utf8');
assert(svg.includes('data-rail-from="1812" data-rail-to="1913"'));
assert(!Object.hasOwn(board.hexCenterRailConnections.find(l=>l.from==='1811'&&l.to==='1812'),'terminalFraction'),'1811–1812 must reach its center, not truncate');
assert(svg.includes('data-source-rail-path="path44"'));
assert.equal(board.hexCenterRailConnections.length,126);
console.log('PASS v277: source glyph symbol122 exact path data; Iasi/Chisinau 1111, Braila 1017; 1812/1913 center link; 1717 excluded; all 5 maps share icon renderer');
