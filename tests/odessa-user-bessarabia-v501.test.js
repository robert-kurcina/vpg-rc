/* User-adjudicated 19-cell Bessarabia, visible through the actual universal renderer.
 * Does not certify other 242 cells or authorize Odessa gameplay.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const T=require('../core/terrain_tiles');
const P=require('../core/presentation');
const composer=require('../maps/composer');
const reg=require('../maps/registry.json').maps;
const base=require('../maps/kiev.json');
const extension=require('../maps/odessa-extension.json');
const expected='1111 1112 1113 1114 1115 1116 1211 1212 1213 1214 1215 1312 1313 1314 1315 1316 1413 1414 1514'.split(' ');
let checks=0;
function eq(a,b,msg){assert.deepEqual(a,b,msg);checks++;}
function ok(a,msg){assert.ok(a,msg);checks++;}
const map=composer.compose(base,extension);
const picked=map.cells.filter(c=>c.sourceTerritory==='bessarabia').map(c=>c.id).sort();
eq(picked,expected,'exactly the user-supplied 19 hostCells, no extras');
eq(extension.compositeTerritoryRegions.length,1);
eq(extension.compositeTerritoryRegions[0].hostCells,expected);
eq(map.cells.length,261);
const source=extension.compositeTerritoryRegions[0].source;
for(const id of expected){
 const c=map.cells.find(c=>c.id===id);
 ok(c,'selected cell is present: '+id);
 eq(c.territoryEvidence,'user-adjudicated','not misrepresented as certified');
 eq(c.territorySource,source,'provenance preserved');
 ok(c.terrain!=='sea','must not label a full Sea hex');
}
ok(!base.cells.some(c=>c.sourceTerritory),'standalone Kiev source remains untouched');
const standalone=composer.compose(base,{...extension,compositeTerritoryRegions:[]});
ok(!standalone.cells.some(c=>c.sourceTerritory),'without explicit config there is no inference');
eq(map.cells.filter(c=>c.sourceTerritory===undefined).length,242,'unreviewed cells remain unknown');
P.configureProfiles(reg);
const opts=P.options('kiev-odessa',{textures:{},showWaterBodies:false});
const svg=T.svgMap(map,opts);
// v502 presentation supersedes v501's continuous perimeter. This remains a
// v501 user-territory/data regression, with v502 testing the actual display.
const selectedOutlines=[...svg.matchAll(/class="setup-region-outline" data-region="bessarabia" data-region-hex="(\d{4})"/g)].map(m=>m[1]);
eq(selectedOutlines.slice().sort(),expected,'user-adjudicated cells still receive precisely one display polygon each');
ok(!svg.includes('class="territory-perimeter-side"'), 'retired perimeter presentation is not emitted');
const members=new Set(expected),byId=new Map(map.cells.map(c=>[c.id,c]));
let exterior=0;
for(const id of expected){const cell=byId.get(id);for(const dir of T.DIRS){if(!members.has(T.neighbor(cell,dir,map.geometry)))exterior++;}}
eq(exterior,36,'historical 36 outside sides remain an observed graph fact, not a drawn perimeter');
const reached=new Set([expected[0]]),queue=[expected[0]];
while(queue.length){const id=queue.shift();for(const dir of T.DIRS){const adj=T.neighbor(byId.get(id),dir,map.geometry);if(members.has(adj)&&!reached.has(adj)){reached.add(adj);queue.push(adj);}}}
eq(reached.size,19,'continuous 19-hex source territory remains connected');
const none=T.svgMap(map,{...opts,hexRegionOutlines:[]});
ok(!none.includes('data-region="bessarabia"'),'presentation opt-in remains config driven');
const kiev=T.svgMap(base,P.options('kiev',{textures:{},showWaterBodies:false}));
ok(!kiev.includes('data-region="bessarabia"'),'standalone Kiev not repainted');
const published=fs.readFileSync(require('node:path').join(__dirname,'../exports/kiev-odessa.svg'),'utf8');
eq((published.match(/class="setup-region-outline" data-region="bessarabia"/g)||[]).length,19,'published engine export matches live renderer');
ok(published.includes('stroke="#9475A9"'),'source mauve chosen in registry');
console.log('PASS v501 user Bessarabia region:',checks,'checks; 19 cells; 36 geometric outside sides; 242 remaining unclassified');
