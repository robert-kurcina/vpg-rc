'use strict';
// The five configurations share one painter order. Shadow reaches water,
// cities, fortifications and both river widths without tinting forest interiors.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const T=require('../core/terrain_tiles'),P=require('../core/presentation'),C=require('../maps/composer');
const root=path.resolve(__dirname,'..');
const registry=JSON.parse(fs.readFileSync(path.join(root,'maps/registry.json'))).maps;
const boards={};
for(const m of registry){if(m.file)boards[m.id]=JSON.parse(fs.readFileSync(path.join(root,'maps',m.file)));}
for(const m of registry){if(m.compose)boards[m.id]=C.compose(boards[m.compose.base],JSON.parse(fs.readFileSync(path.join(root,'maps',m.compose.extension))));}
let totalForest=0;
for(const item of registry){
 const board=boards[item.id],svg=T.svgMap(board,P.options(item.id,{id:'v372-'+item.id}));
 const at=(layer)=>{const index=svg.indexOf(`data-layer="${layer}"`);assert(index>=0,`${item.id}: ${layer} missing`);return index;};
 for(const layer of ['open-terrain','swamp-terrain','forest-terrain','major-city-ground','city-hex-highlights','fortifications','rivers','water-bodies','roadways','railways','hex-grid','coordinates','cities']){
  // Some boards omit roadways as a standalone layer, but shared renderer must
  // have passed any that it did emit before placing the foreground shadow.
  if(svg.includes(`data-layer="${layer}"`))assert(at(layer)<at('forest-shadow'),`${item.id}: ${layer} covers shadow`);
 }
 for(const layer of ['deployment','modifiers','city-labels'])assert(at('forest-shadow')<at(layer),`${item.id}: ${layer} must remain legible`);
 const forests=board.cells.filter(c=>['forest','woods'].includes(c.terrain));totalForest+=forests.length;
 assert.equal((svg.match(/class="forest-shadow" /g)||[]).length,forests.length,item.id+' shadow count');
 assert.equal((svg.match(/data-shadow-interior-exclusion=/g)||[]).length,forests.length,item.id+' forest knockout');
 assert.match(svg,new RegExp(`class="forest-shadow-layer"[^>]+clip-path="url\\(#hex-clip-v372-${item.id}-shadow-board-footprint\\)"[^>]+mask="url\\(#hex-clip-v372-${item.id}-forest-interior-knockout\\)"`));
 const shadowGroup=svg.match(/<g class="forest-shadow-layer"[\s\S]*?<\/g>/)?.[0];assert(shadowGroup);
 assert(!shadowGroup.includes('dry-coast-mask'),item.id+' shadow incorrectly clipped to dry coastline');
 assert.match(svg,/class="forest-shadow"[^>]+stroke-width="10"/);
 const cellsClip=svg.match(new RegExp(`<clipPath id="hex-clip-v372-${item.id}-shadow-board-footprint"[\\s\\S]*?<\\/clipPath>`));assert(cellsClip);
 assert.equal((cellsClip[0].match(/<polygon /g)||[]).length,board.cells.length,item.id+' shadow board clip excludes water');
}
const water=boards.leningrad;
assert(water.cells.some(c=>c.terrain==='sea'),'Leningrad sea cells needed to test water inclusion');
// The shadow is genuinely independent of the separate optional forest texture
// sort: disabling forestLayering cannot silently disable forest shadows.
const plain=T.svgMap(boards.leningrad,P.options('leningrad',{id:'v372-no-sort',forestLayering:false,forestShadow:true}));
assert.equal((plain.match(/class="forest-shadow" /g)||[]).length,water.cells.filter(c=>c.terrain==='forest'||c.terrain==='woods').length);
console.log('PASS v372: 5 maps, '+totalForest+' forest shadows; foreground order, full water clip, forest interior protection, symbol readability');
