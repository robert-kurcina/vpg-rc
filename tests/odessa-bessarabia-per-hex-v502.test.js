/* Checkpoint 268: paint the same user-adjudicated 19 Bessarabian hostCells
 * with the existing Romania per-hex outlines; do not conflate this with
 * a historical country-mask certification or a movement-rules change. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const T=require('../core/terrain_tiles');
const P=require('../core/presentation');
const composer=require('../maps/composer');
const registry=require('../maps/registry.json').maps;
const kiev=require('../maps/kiev.json');
const extension=require('../maps/odessa-extension.json');
let checks=0;
function same(a,b,msg){assert.deepEqual(a,b,msg);checks++;}
function yes(a,msg){assert.ok(a,msg);checks++;}
const ids=extension.compositeTerritoryRegions.find(c=>c.id==='bessarabia').hostCells;
const composite=composer.compose(kiev,extension);
const opts=registry.find(p=>p.id==='kiev-odessa').renderOptions;
const [romania,bessarabia]=opts.hexRegionOutlines;
same(romania.id,'romanian-turn1-setup','existing setup outlines retained');
same(bessarabia.id,'bessarabia','new per-hex group');
same(bessarabia.hexes,ids,'no lost, duplicate, or additional selected hexes');
for(const field of ['strokeWidth','dash','inset'])same(bessarabia[field],romania[field],'uses Romania presentation property '+field);
same(bessarabia.stroke,'#9475A9','mauve from checkpoint 267');
yes(!Object.hasOwn(opts,'territoryOutlines'),'old continuous perimeter is not selected');
same(composite.cells.filter(c=>c.sourceTerritory==='bessarabia').map(c=>c.id).sort(),[...ids].sort(),'user territory classifications unchanged');
same(composite.cells.filter(c=>c.sourceTerritory===undefined).length,242,'no invented additional countries');
P.configureProfiles(registry);
const svg=T.svgMap(composite,P.options('kiev-odessa',{textures:{},showWaterBodies:false}));
const group=[...svg.matchAll(/<polygon class="setup-region-outline" data-region="([^"]+)" data-region-hex="(\d{4})"[^>]*>/g)];
const rom=group.filter(m=>m[1]===romania.id),mauve=group.filter(m=>m[1]===bessarabia.id);
same(rom.length,4,'unchanged Romanian per-hex set');
same(mauve.length,19,'exactly one mauve polygon per assigned Bessarabian hex');
same(mauve.map(x=>x[2]).sort(),[...ids].sort(),'no painted hex mismatch');
for(const poly of [...rom,...mauve]){
 const rgba=poly[1]===romania.id?romania.stroke:bessarabia.stroke;
 yes(poly[0].includes(`stroke="${rgba}"`),'correct stroke for '+poly[2]);
 yes(poly[0].includes(`stroke-width="4.50"`),'Romania width for '+poly[2]);
 yes(poly[0].includes(`stroke-dasharray="10 4"`),'Romania dash for '+poly[2]);
}
yes(!svg.includes('territory-perimeter-side'),'former solid-perimeter sides absent');
yes(!svg.includes('data-layer="territory-outlines"'),'former perimeter layer absent');
const exported=fs.readFileSync('exports/kiev-odessa.svg','utf8');
same((exported.match(/class="setup-region-outline" data-region="bessarabia"/g)||[]).length,19,'published renderer export matches live SVG');
same((exported.match(/class="setup-region-outline" data-region="romanian-turn1-setup"/g)||[]).length,4,'Romanian presentation retained in export');
yes(!exported.includes('territory-perimeter-side'),'no obsolete border in distributed export');
const kievOptions=registry.find(p=>p.id==='kiev').renderOptions;
same(kievOptions.hexRegionOutlines.length,1,'standalone Kiev keeps one existing marker group');
yes(!kiev.cells.some(c=>c.sourceTerritory==='bessarabia'),'standalone Kiev territory is untouched');
console.log('PASS v502 Bessarabia Romania-style per-hex shared renderer:',checks,'assertions; 19 mauve polygons; 4 existing Romanian polygons');
