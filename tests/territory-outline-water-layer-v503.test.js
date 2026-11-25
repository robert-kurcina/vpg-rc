/* Checkpoint 269: the original shared-engine Romania/Bessarabia per-hex
 * outlines must be rendered below ALL three water classes, while preserving
 * membership, geometry, color and source-only status. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const T=require('../core/terrain_tiles');
const P=require('../core/presentation');
const composer=require('../maps/composer');
const registry=require('../maps/registry.json').maps;
const extension=require('../maps/odessa-extension.json');
const kiev=require('../maps/kiev.json');
let checks=0;
const same=(a,b,msg)=>{assert.deepStrictEqual(a,b,msg);checks++;};
const yes=(x,msg)=>{assert.ok(x,msg);checks++;};
const groups={kiev:['romanian-turn1-setup'], 'kiev-odessa':['romanian-turn1-setup','bessarabia']};
for(const mapId of ['kiev','kiev-odessa']){
 const board=mapId==='kiev'?kiev:composer.compose(kiev,extension);
 const opts=P.options(mapId,{textures:{}});
 const svg=T.svgMap(board,opts);
 const published=fs.readFileSync('exports/'+mapId+'.svg','utf8');
 const getPos=(tag,blob)=>blob.indexOf('data-layer="'+tag+'"');
 for(const [name,blob] of [['runtime',svg],['export',published]]){
  const setup=getPos('setup-region-outlines',blob);
  yes(setup>getPos('fortifications',blob),mapId+' '+name+' keeps outlines after terrain/fortifications');
  for(const water of ['rivers','water-bodies']){
   yes(getPos(water,blob)>setup,mapId+' '+name+' water '+water+' paints over outlines');
  }
  for(const overlay of ['roads','railways','hex-grid','coordinates','cities']){
   yes(getPos(overlay,blob)>setup,mapId+' '+name+' other overlays remain above outlines: '+overlay);
  }
  same([...blob.matchAll(/class="setup-region-outline" data-region="([^"]+)" data-region-hex="([0-9]{4})"/g)]
   .reduce((acc,m)=>{(acc[m[1]]??=[]).push(m[2]);return acc;},{}),
   Object.fromEntries(groups[mapId].map(id=>[id,[...opts.hexRegionOutlines.find(g=>g.id===id).hexes]])),
   mapId+' '+name+' exact original hex membership and per-cell drawing order');
 }
 const mauve=opts.hexRegionOutlines.find(g=>g.id==='bessarabia');
 const rom=opts.hexRegionOutlines.find(g=>g.id==='romanian-turn1-setup');
 yes(rom!=null,mapId+' Romania still present');
 if(mauve){
  same(mauve.hexes,extension.compositeTerritoryRegions[0].hostCells,'all 19 Bessarabia approved IDs preserved');
  same(mauve.stroke,'#9475A9','mauve unchanged');
  for(const field of ['strokeWidth','dash','inset'])same(mauve[field],rom[field],'geometry/style unchanged: '+field);
  same(board.cells.filter(c=>c.sourceTerritory==='bessarabia').length,19,'source territory semantic assignments preserved');
  same(board.cells.filter(c=>c.sourceTerritory===undefined).length,242,'remaining 242 not assigned inferred countries');
 }else yes(!board.cells.some(c=>c.sourceTerritory==='bessarabia'),'standalone Kiev not given Odessa territory');
}
for(const mapId of ['arduous','leningrad','battle-for-moscow']){
 const opts=P.options(mapId,{textures:{}});
 yes(!opts.hexRegionOutlines,'other three renderer profiles remain untouched');
}
console.log('PASS v503 territorial outline below rivers + lakes + coasts:',checks,'assertions, actual shared renderer + exports');
