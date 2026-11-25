#!/usr/bin/env node
'use strict';
/* Original Kiev–Odessa source-bound Kovel battle. Verify AL and NE consequences
 * through the shared campaign transaction, and the read-only evidence returned
 * for human labels. No fabricated combat outcomes or counter identities. */
const assert=require('node:assert/strict');
const path=require('node:path');
const req=x=>require(path.join('..',x));
const Campaign=req('core/historical_campaign_session');
const Catalog=req('core/historical_campaign_action_catalog');
const Human=req('core/historical_campaign_human');
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
// Source opening, no fabricated units or outcomes. All legal advance choices
// are committed independently for each die in both CRT modes.
const declaration={defenderHex:'0304',attackers:['kiev-front-r01c02','kiev-front-r01c03','kiev-front-r02c02']};
const defender='kiev-front-r04c02';let n=0;
const eq=(a,b,m)=>{assert.deepStrictEqual(a,b,m);n++};
for(const variant of ['standard','advanced']){
 const ctx={...context,combatPolicy:{...context.combatPolicy,crtVariant:variant}};
 let s=Campaign.create(ctx);
 s=s.execute({type:'combat',action:{type:'finish-air-sea'}}).session;
 eq(Catalog.discover({session:s,context:ctx,enumerateCombinedPlans:false}).proposals.some(p=>JSON.stringify(p)===JSON.stringify(declaration)),true);
 for(const a of [{type:'commit-battles',battles:[declaration]},{type:'select-battle',defenderHex:declaration.defenderHex},{type:'commit-ground-air',faceId:null}])s=s.execute({type:'combat',action:a}).session;
 const before=s.snapshot();eq(before.state.units[defender].strengthStatus,'untried');
 const expected=variant==='standard'?['DRL','DRL','DE','DE','DE','DE']:['DE','DE','DE','DE','DRL','DRL'];
 for(let die=1;die<=6;die++){
  const r=Catalog.discoverPostRoll({session:s,context:ctx,die});eq(r.crtOutcome,expected[die-1]);
  eq(r.options.map(o=>o.advanced).sort(),[null,...declaration.attackers].sort());eq(s.snapshot(),before);
  for(const o of r.options){
   eq(o.revealed,[defender]);eq(o.retreats,[]);eq(o.losses.map(l=>[l.unitId,l.removed]),[[defender,true]]);
   const trial=s.execute(o.action),after=trial.session.snapshot();eq(trial.event.outcome,expected[die-1]);eq(after.state.units[defender],undefined);
   for(const id of declaration.attackers){eq(after.state.units[id].hex,o.advanced===id?'0304':before.state.units[id].hex);eq(after.state.units[id].strengthStatus,before.state.units[id].strengthStatus);}
   eq(trial.session.undo().session.snapshot(),before);eq(Campaign.restore(trial.session.save(),ctx).snapshot(),after);
  }
 }
 eq(s.snapshot(),before);
}
console.log('PASS v571 source opening DRL/DE both CRT modes:',n,'assertions');
