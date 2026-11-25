'use strict';
const assert=require('node:assert/strict');
const map=require('../maps/arduous.json'),counterConfig=require('../maps/counter-configs/arduous.json');
const spec=require('../maps/setup/arduous.json'),poolPolicy=require('../maps/setup/arduous-inventory.json');
const fixedPolicy=require('../maps/setup/arduous-fixed-pieces.json');
const Inventory=require('../core/historical_source_face_inventory.js');
const Setup=require('../core/scenario_starting_setup.js');
const SourceState=require('../core/historical_source_initial_state.js');
const MovementGraph=require('../core/map_movement_graph.js');
const T=require('../core/terrain_tiles.js');
let checks=0;
const check=(v,label)=>{assert.ok(v,label);checks++;};
const inv=Inventory.create(poolPolicy),scanned=inv.inspect(counterConfig);
check(scanned.valid,'full printed source counter inventory');
check(Object.values(scanned.counts).reduce((a,b)=>a+b,0)===40,'40 printed counters, no invented identities');
check(scanned.counts.germanPanzer===5&&scanned.counts.germanInfantry===11,'16 German full starting pieces');
check(scanned.counts.sovietArmies===10&&scanned.counts.sovietMechanized===10,'20 Soviet printed army/mech faces');
const slots=Setup.slots(map,spec);check(slots.errors.length===0,'source marker and named-city slots');
for(const [key,n] of Object.entries({cross:8,star:7,fixedInfantry:3,fixedMechanized:3}))
 check(slots.slots[key].length===n,'source marker count '+key);
const fixedMechanized=slots.slots.fixedMechanized.map(x=>x.hex).sort();
check(JSON.stringify(fixedMechanized)===JSON.stringify(['0609','0907','1510']),'source §6 fixed mech locations');
check(!fixedMechanized.includes('0211'),'Brest may never consume a mechanized corps');
const armies=['0208','0210','0305'];
const stars=slots.slots.star.map(s=>s.hex);
const allocation={},placements={};
for(const [name,g] of Object.entries(poolPolicy.groups))allocation[name]=[];
for(const [name,group] of Object.entries(poolPolicy.groups)){
 const candidates=scanned.pools[group.pool].filter(id=>!Object.values(allocation).flat().includes(id));
 allocation[name]=candidates.slice(0,group.count);
 check(allocation[name].length===group.count,'allocation group '+name);
}
check(inv.validateAllocation(counterConfig,allocation).valid,'each ground face allocated exactly once');
const counters=(group)=>allocation[group];
const crossSlots=slots.slots.cross.map(s=>s.hex).sort();
const german=[...counters('germanInitialPanzer'),...counters('germanInitialInfantry')];
german.forEach((id,i)=>{placements[id]=crossSlots[Math.floor(i/2)]});
counters('sovietFrontArmies').forEach((id,i)=>{placements[id]=armies[i]});
counters('sovietFrontMechanized').forEach((id,i)=>{placements[id]=stars.filter(x=>!armies.includes(x))[i]});
counters('sovietFixedArmies').forEach((id,i)=>{placements[id]=slots.slots.fixedInfantry.map(s=>s.hex).sort()[i]});
counters('sovietFixedMechanized').forEach((id,i)=>{placements[id]=fixedMechanized[i]});
const checked=Setup.validate({map,spec,counterConfig,inventory:inv,allocation,placements});
check(checked.valid,'29 source-backed selectable starting units: '+checked.errors.join('; '));
const opening=SourceState.build({map,setupSpec:spec,counterConfig,inventory:inv,allocation,placements,fixedPolicy});
check(opening.audit.totalStartingGroundUnits===30,'29 source fronts + Brest Garrison');
check(opening.audit.german===16&&opening.audit.soviet===14,'16 German and 14 Soviet including Garrison');
check(opening.state.units['arduous:brest-garrison'].hex==='0211','Brest reverse-only Garrison starting position');
check(Object.values(opening.state.units).filter(u=>u.class==='mechanized').length===7,'seven starting Soviet Mechanized Corps');
check(Object.values(opening.state.units).filter(u=>u.owner==='soviet'&&u.size==='army').length===6,'six starting Soviet Infantry Armies');
check(Object.values(opening.state.units).filter(u=>u.hex==='0211').length===1,'one Garrison at Brest');
check(opening.gameplayAuthorized===false,'do not imply campaign authorization');
check(MovementGraph.build(map).metadata.riverEdges===45,'approved 45 river hexsides in executable Arduous graph');
// The published non-adjacency rule is validated against physical hex positions.
const illegalPlacement=structuredClone(placements);
const adj=stars.find(h=>!armies.includes(h)&&T.DIRS.some(d=>T.neighbor(map.cells.find(c=>c.id===armies[0]),d,map.geometry)===h));
check(Boolean(adj),'fixture has a neighboring Soviet star');
illegalPlacement[counters('sovietFrontArmies')[1]]=adj;
const illegal=Setup.validate({map,spec,counterConfig,inventory:inv,allocation,placements:illegalPlacement});
check(!illegal.valid&&illegal.errors.some(x=>x.includes('Forbidden adjacent')),'armies cannot be adjacent');
const duplicated=structuredClone(allocation);duplicated.sovietReinforcementArmies[0]=duplicated.sovietFrontArmies[0];
check(!inv.validateAllocation(counterConfig,duplicated).valid,'duplicate identity rejected');
const displaced=structuredClone(placements); displaced[counters('sovietFixedMechanized')[0]]='0211';
check(!Setup.validate({map,spec,counterConfig,inventory:inv,allocation,placements:displaced}).valid,'Brest cannot substitute for Baranovichi');
const tampered=structuredClone(map);tampered.cells.find(c=>c.id==='0609').tileMarkers.find(x=>x.kind==='city').label='Fictional City';
check(Setup.slots(tampered,spec).errors.some(x=>x.includes('Missing/ambiguous')),'named-city anchor source validation');

const Deployment=require('../core/historical_deployment_session.js');
const source={map,setupSpec:spec,counterConfig,inventory:inv,
  phaseConfig:require('../maps/phase-configs/arduous.json'),
  movementProfile:require('../maps/movement-configs/arduous.json'),fixedPolicy};
let deployment=Deployment.create({...source,allocation,placements});
check(deployment.snapshot().valid&&Object.keys(deployment.snapshot().units).length===30,'shared pregame session includes Brest Garrison during setup');
const initialSave=deployment.save();
check(Deployment.restore(initialSave,source).snapshot().valid,'pregame save restores using shared implementation');
const initialHexA=placements[counters('germanInitialInfantry')[0]],initialHexB=placements[counters('germanInitialInfantry')[4]];
const moved=deployment.swapPositions(counters('germanInitialInfantry')[0],counters('germanInitialInfantry')[4]);
check(moved.snapshot().placements[counters('germanInitialInfantry')[0]]===initialHexB&&
 moved.snapshot().placements[counters('germanInitialInfantry')[4]]===initialHexA,'shared map-to-map counter swap');
const sourceFace=counters('sovietReinforcementMechanized')[0],onMapFace=counters('sovietFrontMechanized')[0];
const exchanged=deployment.swapFaces(sourceFace,onMapFace);
check(exchanged.snapshot().placements[sourceFace]===placements[onMapFace]&&
 !Object.hasOwn(exchanged.snapshot().placements,onMapFace),'source pool-to-map source counter exchange');
check(!exchanged.snapshot().concealedMixed,'manual swap does not assert random mixing');
const mixGroups=spec.concealedSetup.groups;
const current=mixGroups.flatMap(g=>allocation[g]);
const randomized=deployment.permute(mixGroups,[...current].reverse());
check(randomized.snapshot().concealedMixed===true,'all ten concealed Mech identities can be deliberately mixed');
check(randomized.snapshot().valid,'mixed identities remain source-valid');
assert.throws(()=>deployment.commit({requireMixed:true}),/must be mixed/);checks++;
const candidate=randomized.commit({requireMixed:true});
check(candidate.opening.state.units['arduous:brest-garrison'].hex==='0211', 'deployment commit includes the reverse-only Garrison');
check(candidate.audit.startingUnits===30&&candidate.audit.fixedSourcePieces.length===1,'shared bridge counts all 30 starting ground pieces');
check(candidate.opening.cursor.turn===1&&candidate.opening.cursor.index===2, 'seven-turn campaign begins with German combat, skipping build-up and movement');
check(candidate.opening.actor==='german','source-backed German first actor');
check(poolPolicy.reinforcementSchedule.length===3&&poolPolicy.reinforcementSchedule.reduce((n,x)=>n+x.sovietReinforcementArmies,0)===4&&poolPolicy.reinforcementSchedule.reduce((n,x)=>n+x.sovietReinforcementMechanized,0)===3,'Soviet reinforcement schedule matches §11.0');
check(MovementGraph.build(map).metadata.riverEdges===45,'approved 45 river hexsides in executable Arduous graph');
const changed=structuredClone(initialSave);changed.placements[counters('sovietFrontArmies')[0]]='9999';
assert.throws(()=>Deployment.restore(changed,source),/checksum mismatch/);checks++;

console.log('PASS Arduous source-backed full opening',checks,'checks',JSON.stringify(opening.audit));
