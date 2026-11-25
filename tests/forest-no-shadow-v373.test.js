'use strict';
// Checkpoint 139: Forest/woods retain their bitmap tiles and priority,
// but no shadow filter, overlay, or pixel effect is emitted by the shared renderer.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const T=require('../core/terrain_tiles'),P=require('../core/presentation'),C=require('../maps/composer');
const root=path.resolve(__dirname,'..');
const registry=JSON.parse(fs.readFileSync(path.join(root,'maps/registry.json'))).maps;
const boards={};
for(const m of registry)if(m.file)boards[m.id]=JSON.parse(fs.readFileSync(path.join(root,'maps',m.file)));
for(const m of registry)if(m.compose)boards[m.id]=C.compose(boards[m.compose.base],JSON.parse(fs.readFileSync(root+'/maps/'+m.compose.extension)));
assert.equal(registry.length,5);
let total=0;
for(const m of registry){
 const board=boards[m.id],opts=P.options(m.id,{id:'v373-'+m.id}),svg=T.svgMap(board,opts);
 assert.equal(Object.hasOwn(opts,'forestShadow'),false,'obsolete shadow style toggle persisted');
 const forests=board.cells.filter(c=>['forest','woods'].includes(c.terrain));total+=forests.length;
 assert(forests.length>0,m.id+' missing forest test coverage');
 assert.doesNotMatch(svg,/forest-shadow|shadow-board-footprint|forest-interior-knockout|data-shadow-hex|data-shadow-interior-exclusion|feGaussianBlur|class="forest-shadow-layer"/,m.id+' retains shadow elements');
 assert(svg.includes('data-layer="forest-terrain"'),m.id+' lost forest terrain pass');
 assert(svg.includes('data-layer="city-hex-highlights"'),m.id+' lost city border');
 const at=layer=>svg.indexOf(`data-layer="${layer}"`);
 assert(at('open-terrain')<at('forest-terrain')&&(at('swamp-terrain')<0||(at('open-terrain')<at('swamp-terrain')&&at('swamp-terrain')<at('forest-terrain'))),m.id+' terrain sort changed');
 assert(at('major-city-ground')<at('forest-terrain'),m.id+' major-city foreground unexpectedly changed');
 assert(at('city-hex-highlights')<at('forest-terrain'),m.id+' city border ordering unexpectedly changed');
 const embedded=Array.from(svg.matchAll(new RegExp('href="#terrain-sprite-v373-'+m.id+'-(forest|woods)"','g')));
 assert.equal(embedded.length,forests.length,m.id+' lost forest bitmap tiles');
 assert(at('forest-terrain')<at('fortifications')&&at('forest-terrain')<at('rivers'),m.id+' forest pass order changed');
 // User-requested removal is definitive: a legacy toggle cannot revive the effect.
 const legacy=T.svgMap(board,P.options(m.id,{id:'v373-legacy-'+m.id,forestShadow:true}));
 assert.doesNotMatch(legacy,/forest-shadow|feGaussianBlur|shadow-board-footprint/,m.id+' legacy option revived shadow');
}
// With layering turned off, Forest bitmap tiles must still draw normally.
const plain=T.svgMap(boards.leningrad,P.options('leningrad',{id:'v373-no-sort',forestLayering:false,forestShadow:true}));
assert(plain.includes('terrain-sprite-v373-no-sort-forest'));
assert.doesNotMatch(plain,/forest-shadow|feGaussianBlur/);
console.log(`PASS v373: ${registry.length} shared maps, ${total} Forest/Woods cells, no shadow, bitmap texture and layer priority retained`);
