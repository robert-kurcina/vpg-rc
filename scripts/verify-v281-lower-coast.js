// v286 revalidation supersedes earlier v281 coast assumptions after v285 hex registration.
'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const ext=require('../maps/odessa-extension.json'),C=require('../maps/composer.js'),T=require('../core/terrain_tiles.js');
const kiev=require('../maps/kiev.json'),board=C.compose(kiev,ext),S=new Set(ext.authoredShoreHexsides.map(x=>x.cellId+':'+x.dir));
const required=['1315:SE','1316:SE','1414:SE','1513:SE','1514:S','1812:S','1813:SW','1913:SW','1914:S'];
for(const q of required)assert(S.has(q),'v286 source-supported Coast face missing: '+q);
const forbidden=['1416:NE','1416:SE','1513:S','1914:NE','1913:SE'];
for(const q of forbidden)assert(!S.has(q),'obsolete Coast face still present: '+q);
for(const s of ext.authoredShoreHexsides)assert(board.cells.some(c=>c.id===s.cellId),'Coast points at absent cell '+s.cellId);
assert.equal(board.waterRenderingMode,'hexside-wavelets');
assert.equal(board.hexCenterRailConnections.length,126);
const svg=T.svgMap(board);
assert(svg.includes('data-layer="water-bodies"'));
assert(svg.includes('data-layer="entry-edges"'));
assert(!svg.includes('class="source-purple-water-area"'));
for(const [id,side] of [['1912','S'],['1913','N']]){
 const c=board.cells.find(c=>c.id===id);
 assert(c.tileEdges[side].some(f=>f.kind==='majorRiver' && f.forceRenderAboveAuthoredRivers===true),'major river hidden: '+id);
}
console.log('PASS v286: registered procedural Coast faces, offboard 1416 excluded, 1912/1913 Major River and 126 railway links');
