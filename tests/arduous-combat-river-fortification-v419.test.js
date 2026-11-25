'use strict';
/* Source-reviewed geography must affect the shared B4M odds calculation
 * without adding a scenario-specific combat table or guessed river edges. */
const assert=require('node:assert/strict');
const map=require('../maps/arduous.json');
const profile=require('../maps/movement-configs/arduous.json');
const combatPolicy=require('../maps/combat-configs/arduous.json');
const Geo=require('../core/historical_combat_geography');
const Odds=require('../core/historical_combat_odds');
const Graph=require('../core/map_movement_graph');
const CRT=require('../core/historical_crt');
const g=Graph.build(map),geo=Geo.create(map,profile,{cityMarkerMode:'source-typed-v1',fortificationMode:combatPolicy.fortificationMode});
let n=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);n++};
const at=(edge,owner='soviet')=>geo.evaluate({attackers:['axis'],defenders:['def'],defenderHex:edge.b},{axis:{hex:edge.a,owner:'german'},def:{hex:edge.b,owner}});
const good=g.edges.find(e=>e.river&&!map.cells.find(c=>c.id===e.b).tileMarkers?.some(m=>m.kind==='city'));
const dry=g.edges.find(e=>!e.river&&!map.cells.find(c=>c.id===e.b).tileMarkers?.some(m=>m.kind==='city'));
assert(good&&dry);n++;
eq(at(good).allAttackersAcrossRiver,true,'river crossing is a source-approved hexside');
eq(at(dry).allAttackersAcrossRiver,false,'dry hexside never receives river defense');
const edge=g.edges.find(e=>e.b==='0211'||e.a==='0211');assert(edge);n++;
const brest={a:edge.a==='0211'?edge.b:edge.a,b:'0211'};
eq(at(brest).defenderTerrain,'fortification','Brest Soviet garrison uses defensive fortification');
eq(at(brest,'german').defenderTerrain,'open','German occupant does not receive Soviet fortification bonus');
const units=[{value:12,kind:'infantry'}],defenders=[{value:3,kind:'infantry'}];
function result(terrain,river,air=0){return Odds.evaluate({attackers:units,defenders,defenderTerrain:terrain,
 allAttackersAcrossRiver:river,airSupportShift:air,policy:combatPolicy,die:3})}
const plain=result('open',false),river=result('open',true),fort=result('fortification',false),air=result('fortification',false,2);
eq(plain.finalOdds,4,'ordinary open 4:1');
eq(river.finalOdds,3,'river 4:1 shifted left one');
eq(fort.finalOdds,3,'Soviet fort 4:1 shifted left one');
eq(air.finalOdds,5,'German +2 air support shifts two columns');
eq(plain.crtResult,CRT.result(4,3),'single shared B4M CRT used');
eq(air.crtResult,CRT.result(5,3),'air result uses shared CRT');
// The photographed air markers are source-registered and consumable once per turn.
const Air=require('../core/historical_air_support');
const Phase=require('../core/phase_runtime');
const phaseConfig=require('../maps/phase-configs/arduous.json');
const counterConfig=require('../maps/counter-configs/arduous.json');
const support=Air.create({map,combatPolicy,counterConfig,phaseConfig});
const cursor=Phase.start(phaseConfig),state={scenarioId:'arduous',units:{}};
const available=support.available({state,cursor,actor:'german'});
eq(available.map(x=>x.shiftRating).sort(),[1,2],'both photographed air ratings available');
const used=support.ground({state,cursor,actor:'german',faceId:available.find(x=>x.shiftRating===2).faceId});
eq(used.shiftRating,2,'+2 air shift source face');
eq(support.available({state:used.state,cursor,actor:'german'}).length,1,'air marker cannot be reused in same turn');
const forbidden=[...g.edges].find(e=>!e.river&&e.a==='0406'&&e.b==='0505');
if(forbidden){eq(at(forbidden).allAttackersAcrossRiver,false,'non-candidate contact not promoted into gameplay');}
eq(g.metadata.riverEdges,45,'no extra river observations survive');
console.log('PASS Arduous shared CRT, fortification and approved river combat',n,'checks');
