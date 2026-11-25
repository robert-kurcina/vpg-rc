'use strict';
/* Human/controller integration regression: initialized synthetic Turn 2 origin, original faces and map. */
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
// Synthetic Turn 2 origin, original counter identities and source map. Not a replay from Turn 1.
const Campaign=req('core/historical_campaign_session'),Human=req('core/historical_campaign_human');
const defender='kiev-front-r03c04',attackers=['kiev-front-r01c01','kiev-front-r01c02','kiev-front-r01c03'];
const state=Campaign.create(context).snapshot().state;state.units=Object.fromEntries([defender,...attackers].map(id=>[id,state.units[id]]));
state.units[defender].hex='0605';for(const [i,id] of attackers.entries())state.units[id].hex=['0505','0506','0604'][i];
const battle={defenderHex:'0605',attackers};
let n=0,branches=0;const eq=(a,b,m)=>{assert.deepStrictEqual(a,b,m);n++};const ok=(x,m)=>{assert.ok(x,m);n++};
for(const variant of ['standard','advanced']){
 const ctx={...context,state,cursor:{...opening.cursor,turn:2},combatPolicy:{...context.combatPolicy,crtVariant:variant}};
 let h=Human.create({session:Campaign.create(ctx),context:ctx});
 h=h.choose({type:'combat',action:{type:'finish-air-sea'}});
 ok(h.view().proposals.some(b=>b.defenderHex===battle.defenderHex&&b.attackers.join()===attackers.join()),'legal battle proposal');
 h=h.choose({type:'combat',action:{type:'commit-battles',battles:[battle]}}).choose({type:'combat',action:{type:'select-battle',defenderHex:battle.defenderHex}}).choose({type:'combat',action:{type:'commit-ground-air',faceId:null}});
 const before=h.snapshot();
 for(const die of variant==='standard'?[4,5]:[2,3]){
  const rolled=h.roll(die),saved=rolled.save(),restored=Human.restore(saved,ctx),view=restored.view();
  eq(view.crtOutcome,'DRL');eq(view.kind,'post-roll-choice');eq(rolled.snapshot(),restored.snapshot());
  eq(view.options.length,12);eq(view.hasNextPage,false);eq(view.choiceTruncated,false);
  eq(restored.undo().session.snapshot(),before);assert.throws(()=>restored.roll(die),/already committed/);n++;
  const keys=new Set();
  for(const [i,action] of view.options.entries()){
   const choices=action.action.choices,route=choices.retreatPaths[defender],advance=choices.advanceUnitId||null;
   const effect=view.optionEffects[i];eq(effect.outcome,'DRL');eq(effect.losses,[{unitId:defender,removed:false,attackPoints:4,defensePoints:4}]);eq(effect.advanced,advance);
   keys.add(route.join('/')+':'+advance);
   const next=restored.choose(action),after=next.snapshot();eq(after.state.units[defender].hex,route.at(-1));eq(Face.project(after.state.units[defender],ctx.counterConfig).printedValues,'4-4');
   for(const id of attackers){eq(after.state.units[id].hex,advance===id?'0605':before.state.units[id].hex);eq(after.state.units[id].strengthStatus,before.state.units[id].strengthStatus);}
   eq(after.combat.resolved.length,1);eq(Human.restore(next.save(),ctx).snapshot(),after);eq(next.undo().session.snapshot(),before);
   eq(restored.snapshot(),before);branches++;
  }
  eq([...keys].sort(),['0706/0707','0706/0805','0706/0806'].flatMap(r=>[null,...attackers].map(a=>r+':'+a)).sort());
  const forged=structuredClone(view.options[0]);forged.action.choices.retreatPaths[defender]=['9999','8888'];assert.throws(()=>restored.choose(forged),/not a validated/);n++;
  eq(h.snapshot(),before);
 }
}
console.log('PASS v573 surviving DRL controller',n,'assertions;',branches,'branches');
