'use strict';
/* v505: scenario-scoped TEC markers and source-engine specimens. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const chart = require('../maps/presentation/kiev-terrain-effects.json');
const registry = require('../maps/registry.json').maps;
const kiev = require('../maps/kiev.json');
const extension = require('../maps/odessa-extension.json');
const movement = require('../maps/movement-configs/kiev.json');
const combat = require('../maps/combat-configs/kiev.json');
const T = require('../core/terrain_tiles');
const P = require('../core/presentation');
const composer = require('../maps/composer');
let checks=0;
function yes(v,m){assert.ok(v,m);checks++;}
function eq(a,b,m){assert.deepEqual(a,b,m);checks++;}
const rows=chart.rows;
const ids=rows.map(r=>r.id);
eq(ids,['open','forest','swamp','city','major-city','river','major-river','railroad','deployment','romanian','bessarabia'],'two territory rows after base terrain');
eq(new Set(ids).size,11,'unique rows');
const base=registry.find(x=>x.id==='kiev');
const both=registry.find(x=>x.id==='kiev-odessa');
const orange=both.renderOptions.hexRegionOutlines.find(x=>x.id==='romanian-turn1-setup');
const mauve=both.renderOptions.hexRegionOutlines.find(x=>x.id==='bessarabia');
eq(orange.hexes,['0709','0809','0910','1010'],'four orange starting hexes');
eq(mauve.hexes,["1111","1112","1113","1114","1115","1116","1211","1212","1213","1214","1215","1312","1313","1314","1315","1316","1413","1414","1514"],'exact 19 user-adjudicated Bessarabia cells');
eq(mauve.stroke,'#9475A9','mauve marker source color');
const board=composer.compose(kiev,extension);
const kievCells=new Map(kiev.cells.map(c=>[c.id,c]));
const allCells=new Map(board.cells.map(c=>[c.id,c]));
for (const r of rows){
 const mapId=r.sampleMap||'kiev';
 yes(['kiev','kiev-odessa'].includes(mapId),'valid source map for '+r.id);
 const cell=(mapId==='kiev'?kievCells:allCells).get(r.sampleHex);
 yes(cell,'source cell '+r.id);
 if(r.sampleKind==='romanian')yes(orange.hexes.includes(cell.id),'Romania sample is orange outlined');
 else if(r.sampleKind==='bessarabia')yes(mauve.hexes.includes(cell.id),'Bessarabia sample is mauve outlined');
 else if(r.sampleKind==='terrain')eq(cell.terrain,r.id,'terrain '+r.id);
 else if(['city','majorCity','star','cross'].includes(r.sampleKind))yes((cell.tileMarkers||[]).some(m=>m.kind===r.sampleKind),'marker '+r.id);
 else yes(Object.values(cell.tileEdges||{}).flat().some(e=>e.kind===r.sampleKind),'hexside '+r.id);
 for(const k of ['name','movement','combat','notes'])yes(typeof r[k]==='string'&&r[k].length>2,'descriptive '+r.id+' '+k);
 const file='assets/terrain-chart/'+mapId+'/'+r.id+'.png';
 const png=fs.readFileSync(file);
 eq(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a','engine specimen PNG '+file);
 eq([png.readUInt32BE(16),png.readUInt32BE(20)],[88,82],'specimen size '+file);
}
const rom=rows.at(-2), bess=rows.at(-1);
eq([rom.id,bess.id],['romanian','bessarabia'],'last two rows');
eq(bess.sampleHex,'1212','uncluttered mauve sample from actual combined map');
eq(bess.sampleMap,'kiev-odessa','Odessa sample uses full combined export');
eq(rom.sampleMap,undefined,'Kiev Romanian sample remains Kiev-only');
for(const id of [...orange.hexes,...['0708','0808','1110']])yes(rom.combat.includes(id),'Kiev Turn 1 exact IDs still in Romania row: '+id);
for(const needle of ['Kiev §10.8','Turn 1','originally','Kiev–Odessa','Home Army','Hungarian','Russo-Romanian'])yes(rom.movement.includes(needle)||rom.combat.includes(needle)||rom.notes.includes(needle),'Romanian combined scope '+needle);
for(const needle of ['Kiev–Odessa only','before annexation','Soviet units','even if Soviet units later return','Hungarian','no combat odds modifier','19 user-designated','§9.4.4'])yes((bess.movement+' '+bess.combat+' '+bess.notes).includes(needle),'Bessarabia rule '+needle);
yes(!bess.movement.includes('costs 2'),'political border is not terrain cost');
eq(combat.requireFirstTurnTerritorialRestriction,true,'Kiev production restriction remains gated');
yes(!both.file && both.compose,'Odessa still only composite visual');
yes(chart.source.some(x=>x.includes('odessa-rules.pdf §§0.0, 9.4.4–9.4.5')),'Odessa printed source cited');
const html=fs.readFileSync('tools/terrain-effects-chart/index.html','utf8');
yes(html.includes("row.sampleMap==='kiev-odessa'"),'per-scenario engine sample source switch');
yes(html.includes('tr[data-kind="bessarabia"]'),'mauve style');
yes(html.includes('Odessa rules apply only to the combined Kiev–Odessa expansion'),'explicit scope');
yes(fs.readFileSync('maps/index.html','utf8').includes('Terrain Effects Chart (Kiev + Odessa)'),'map viewer link label');
for(const id of ['kiev','kiev-odessa']) {
 const svg=fs.readFileSync('exports/'+id+'.svg','utf8');
 const region=svg.indexOf('data-layer="setup-region-outlines"');
 const river=svg.indexOf('data-layer="rivers"');
 const lake=svg.indexOf('data-layer="water-bodies"');
 yes(region>=0&&region<river,'territory before River '+id);
 yes(svg.includes('data-region="romanian-turn1-setup"'),'Romanian marker retained '+id);
 yes(svg.includes('data-layer="railways"'),'rail unchanged '+id);
 if(id==='kiev-odessa') {
  yes(svg.includes('data-region="bessarabia"'),'Odessa marker retained');
  eq((svg.match(/data-region="bessarabia"/g)||[]).length,19,'19 actual-engine mauve hex outlines');
 } else yes(!svg.includes('data-region="bessarabia"'),'Kiev is unchanged map scope');
}
console.log('PASS v505 Kiev–Odessa TEC territorial rows:',checks,'assertions');
