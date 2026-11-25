'use strict';
/* Shared-engine-derived Kiev terrain art and Romanian setup rule chart. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const T=require('../core/terrain_tiles');
const P=require('../core/presentation');
const board=require('../maps/kiev.json');
const registry=require('../maps/registry.json').maps;
const combat=require('../maps/combat-configs/kiev.json');
const movement=require('../maps/movement-configs/kiev.json');
const chart=require('../maps/presentation/kiev-terrain-effects.json');
let checks=0;
function equal(a,b,msg){assert.deepEqual(a,b,msg);checks++;}
function ok(a,msg){assert.ok(a,msg);checks++;}
const cells=new Map(board.cells.map(c=>[c.id,c]));
const kiev=registry.find(m=>m.id==='kiev');
const markers=kiev.renderOptions.hexRegionOutlines[0];
const expected=['0709','0809','0910','1010'];
const soviet=['0708','0808','1110'];
equal(chart.rows.map(r=>r.id),['open','forest','swamp','city','major-city','river','major-river','railroad','deployment','romanian'],'chart row types match original player aid plus Romanian');
equal(markers.hexes,expected,'Romanian map markers');
equal(combat.firstTurnCombatRestriction.setupHexes,expected,'Axis Turn 1 source setup restriction');
equal(combat.firstTurnTerritorialRestriction.targetHexes,expected,'Romanian target convention');
equal(combat.firstTurnTerritorialRestriction.allowedOpeningHexes,soviet,'Soviet original-deployment exception');
equal(combat.firstTurnTerritorialRestriction.turn,1,'restricted only Turn 1');
equal(combat.requireFirstTurnTerritorialRestriction,true,'rule enabled');
equal(movement.terrainCosts.forest,2,'Forest 2 hexes');
equal(movement.terrainCosts.swamp,2,'Swamp 2 hexes');
equal(combat.modifiers.terrainColumnShifts.forest,-1,'Forest -1');
equal(combat.modifiers.terrainColumnShifts.swamp,-1,'Swamp -1');
equal(combat.modifiers.terrainColumnShifts['major-city'],-1,'Major city -1');
equal(combat.modifiers.allAttackersAcrossRiverShift,-1,'All attackers crossing river -1');
equal(combat.modifiers.swampTankStrengthMultiplier,.5,'Tank strength halved in swamp');
equal(combat.modifiers.majorRiverAttackMultiplier,.5,'Major River attacking strength halved');
const requiredFiles=['references/rules/kiev-rules.pdf','references/rules/kiev-player-aid.webp','maps/kiev.json'];
for(const file of requiredFiles)ok(fs.existsSync(file),'source available '+file);
for(const row of chart.rows){
 const cell=cells.get(row.sampleHex);
 ok(cell,'existing source hex '+row.id);
 const mark=(cell.tileMarkers||[]).map(m=>m.kind);
 const edges=Object.values(cell.tileEdges||{}).flat().map(e=>e.kind);
 if(row.sampleKind==='terrain')equal(cell.terrain,row.id,row.id+' correct source base');
 else if(row.sampleKind==='romanian')ok(markers.hexes.includes(cell.id),'Romanian sample original setup');
 else if(['city','majorCity','star','cross'].includes(row.sampleKind))ok(mark.includes(row.sampleKind),row.id+' source feature');
 else ok(edges.includes(row.sampleKind),row.id+' source hexside');
 for(const p of ['movement','combat','notes','name'])ok(typeof row[p]==='string'&&row[p].length>2,'nonempty '+row.id+' '+p);
 const png=fs.readFileSync('assets/terrain-chart/kiev/'+row.id+'.png');
 equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a',row.id+' image is PNG');
 equal(png.readUInt32BE(16),88,row.id+' correct pixel width');
 equal(png.readUInt32BE(20),82,row.id+' correct pixel height');
}
const romanian=chart.rows.find(r=>r.id==='romanian');
for(const id of [...expected,...soviet])ok(romanian.combat.includes(id),'Turn 1 rules text mentions '+id);
ok(romanian.combat.includes('originally')&&romanian.combat.includes('Turn 1'),'source tracking and temporal scope');
ok(romanian.movement.includes('underlying'),'Romanian is not alternative terrain');
const svg=T.svgMap(board,P.options('kiev',{textures:{}}));
const order=['data-layer="rivers"','data-layer="setup-region-outlines"','data-layer="roads"','data-layer="railways"','data-layer="hex-grid"','data-layer="coordinates"'];
for(let i=1;i<order.length;i++)ok(svg.indexOf(order[i-1])>=0&&svg.indexOf(order[i])>svg.indexOf(order[i-1]),order[i-1]+' below '+order[i]);
for(const id of ['kiev','kiev-odessa']){
 const output=fs.readFileSync('exports/'+id+'.svg','utf8');
 for(const layer of ['setup-region-outlines','railways'])ok(output.includes('data-layer="'+layer+'"'),id+' '+layer);
 ok(output.indexOf('data-layer="setup-region-outlines"')<output.indexOf('data-layer="railways"'),id+' railway above orange');
}
for(const id of ['battle-for-moscow','arduous','leningrad'])ok(!fs.readFileSync('exports/'+id+'.svg','utf8').includes('setup-region-outlines'),'no marker leak '+id);
const page=fs.readFileSync('tools/terrain-effects-chart/index.html','utf8');
ok(page.includes('kiev-terrain-effects.json')&&page.includes('terrain-chart/kiev'),'page loads source chart data and engine artwork');
for(const [file,match] of [['games/kiev/setup-preview/index.html','terrain-effects-chart'],['maps/index.html','kiev-terrain-chart'],['index.html','terrain-effects-chart']])ok(fs.readFileSync(file,'utf8').includes(match),'reachable chart navigation '+file);
console.log('PASS Kiev Terrain Effects Chart v482',checks,'assertions');
