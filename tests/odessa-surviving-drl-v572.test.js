'use strict';
/* Component regression: original faces, synthetic local positions, unchanged composite map. */
const assert=require('node:assert/strict');
const path=require('node:path');
const req=x=>require(path.join('..',x));
const Face=req('core/historical_counter_face_projection');
const opening=req('games/kiev-odessa/experimental-preview/opening-v531.json').contextStart;
const context={...structuredClone(opening),map:req('maps/kiev-odessa-composite-experimental-v531.json'),
 profile:req('maps/movement-configs/kiev-odessa-experimental-v531.json'),config:req('maps/phase-configs/kiev-odessa.json'),
 counterConfig:req('maps/counter-configs/kiev-odessa-experimental-v531.json'),
 combatPolicy:req('maps/combat-configs/kiev-odessa-experimental-v531.json'),
 rosterOverlay:req('maps/roster-overlays/kiev-odessa.json'),enableAirSupport:true,
 buildupPolicy:req('maps/buildup-configs/kiev-odessa-experimental-v533.json'),
 buildupAllocation:req('games/kiev-odessa/experimental-preview/allocation-v533.json'),
 housekeepingPolicy:req('maps/housekeeping-configs/kiev-odessa-candidate-v521.json')};
// Synthetic local positioning of original counter identities on the unchanged composite map.
const Consequences=req('core/historical_combat_consequences'), Geography=req('core/historical_combat_geography'), Retreat=req('core/historical_forced_retreat');
const defender='kiev-front-r03c04',attackers=['kiev-front-r01c01','kiev-front-r01c02','kiev-front-r01c03'];
const state=structuredClone(opening.state);state.units=Object.fromEntries([defender,...attackers].map(id=>[id,state.units[id]]));
state.units[defender].hex='0605';for(const [i,id] of attackers.entries())state.units[id].hex=['0505','0506','0604'][i];
const battle={defenderHex:'0605',attackers,defenders:[defender]};
let n=0,branches=0;const eq=(a,b,m)=>{assert.deepStrictEqual(a,b,m);n++};const bad=(f,re)=>{assert.throws(f,re);n++};const baseline=structuredClone(state);
for(const variant of ['standard','advanced']){
 const combatPolicy={...context.combatPolicy,crtVariant:variant};const evaluator=Consequences.create({...context,enableAirSupport:false,combatPolicy,geography:Geography.create(context.map,context.profile,{cityMarkerMode:combatPolicy.cityMarkerMode})});
 const input={state,battle,actor:'german',cursor:{turn:2}};
 const expected=variant==='standard'?['DR','DR','EX','DRL','DRL','DE']:['DE','DRL','DRL','DR','DR','EX'];
 for(let die=1;die<=6;die++){
  let r=evaluator.previewPostCasualty({...input,die});eq(r.outcome,expected[die-1]);if(r.outcome!=='DRL')continue;
  r=evaluator.previewPostCasualty({...input,die,choices:{}});eq(r.survivingDefenderIds,[defender]);eq(r.losses,[{unitId:defender,removed:false,attackPoints:4,defensePoints:4}]);
  eq(Face.project(r.state.units[defender],context.counterConfig).printedValues,'4-4');eq(r.state.units[defender].hex,'0605');eq(state,baseline);
  const solver=Retreat.create({...context,combatPolicy});const routes=solver.enumerate({state:r.state,defenderHex:battle.defenderHex,defenderIds:[defender]});
  eq(routes.combinations.map(c=>c[defender].route),[['0706','0707'],['0706','0805'],['0706','0806']]);
  bad(()=>evaluator.resolve({...input,die,choices:{retreatPaths:{[defender]:['9999','8888']}}}),/retreat|route/i);
  for(const c of routes.combinations)for(const advance of [null,...attackers]){
   const route=c[defender].route;const choices={retreatPaths:{[defender]:route},...(advance?{advanceUnitId:advance}:{})};
   const result=evaluator.resolve({...input,die,choices});eq(result.event.outcome,'DRL');eq(result.event.odds,4);eq(result.event.losses,r.losses);eq(result.state.units[defender].hex,route.at(-1));eq(result.state.units[defender].strengthStatus,'printed-reduced');eq(Face.project(result.state.units[defender],context.counterConfig).printedValues,'4-4');eq(result.event.advanced,advance);
   for(const id of attackers){eq(result.state.units[id].hex,advance===id?'0605':state.units[id].hex);eq(result.state.units[id].strengthStatus,state.units[id].strengthStatus);}
   eq(state,baseline);branches++;
  }
 }
}
console.log('PASS v572 surviving DRL component:',n,'assertions;',branches,'branches');
