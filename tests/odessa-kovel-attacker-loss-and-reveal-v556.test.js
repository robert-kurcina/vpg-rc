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
const defender='kiev-front-r05c02',attacker='kiev-front-r02c03';
let checks=0;
function eq(a,b,why){assert.deepStrictEqual(a,b,why);checks++;}
function ok(v,why){assert.ok(v,why);checks++;}
function bad(fn,pattern,why){assert.throws(fn,pattern,why);checks++;}
let session=Campaign.create(context);
for(const action of [
 {type:'combat',action:{type:'finish-air-sea'}},
 {type:'combat',action:{type:'commit-battles',battles:[{defenderHex:'0502',attackers:[attacker]}]}},
 {type:'combat',action:{type:'select-battle',defenderHex:'0502'}},
 {type:'combat',action:{type:'commit-ground-air',faceId:null}},
])session=session.execute(action).session;
const baseline=session.snapshot(),baseSave=session.save();
for(const [die,expected] of [[4,'NE'],[6,'AL']]){
 const trial=Catalog.discoverPostRoll({session,context,die});
 eq(trial.crtOutcome,expected,'Official B4M CRT result from real Kovel declaration');
 eq(trial.options.length,1,'Exactly one adjudicated consequence in this fixture');
 ok(Array.isArray(trial.options[0].revealed),'Catalogue carries authoritative revealed IDs');
 ok(Array.isArray(trial.options[0].losses),'Catalogue carries authoritative loss receipt');
 eq(trial.options[0].revealed,[defender],'Untried Soviet mechanized defender flips in combat');
 const human=Human.create({session,context}).roll(die);
 const view=human.view();
 eq(view.kind,'post-roll-choice','Committed die activates source-validated consequence selection');
 eq(view.options.length,1,'Human receives one unchanged legal action');
 eq(view.optionEffects.length,view.options.length,'Parallel read-only evidence per legal action');
 eq(view.optionEffects[0].outcome,expected,'Human label sees authoritative outcome');
 eq(view.optionEffects[0].revealed,[defender],'Human label can identify a revealed counter without strength');
 ok(!JSON.stringify(view.optionEffects[0]).includes('revealedAttackStrength'),'No concealed combat strength leaked in preview');
 eq(session.snapshot(),baseline,'Post-roll discovery must not mutate original campaign');
 const preChoiceSave=human.save();
 eq(Human.restore(preChoiceSave,context).view().optionEffects,view.optionEffects,'Signed pending-die restore retains exact evidence');
 bad(()=>human.choose({type:'combat',action:{type:'resolve-battle',die:die===4?6:4,choices:view.options[0].action.choices}}),
  /not a validated post-roll consequence/i,'Cannot use result for a different committed die');
 const committed=human.choose(view.options[0]);
 const state=committed.snapshot();
 eq(state.combat.resolved.at(-1).outcome,expected,'Committed campaign event has correct CRT result');
 eq(state.state.units[defender].strengthStatus,'revealed-one-step','Untried one-step defender is not reduced by revelation');
 eq(Face.project(state.state.units[defender],context.counterConfig).side,'back','Revealed defender displays original source back face');
 eq(state.state.cityControl.Kovel,'soviet','Kovel remains Soviet-held when attacker cannot advance');
 if(expected==='AL'){
  eq(view.optionEffects[0].losses.map(x=>[x.unitId,x.removed]),[[attacker,false]],'AL reduces the German attacker');
  eq(state.state.units[attacker].strengthStatus,'printed-reduced','AL uses source reduced face');
  eq(Face.project(state.state.units[attacker],context.counterConfig).printedValues,'3-4','AL projects printed 3–4, not a synthetic reduced strength');
 }else{
  eq(view.optionEffects[0].losses,[],'NE has no losses');
  eq(state.state.units[attacker].strengthStatus,'printed-full','NE leaves German attacker full');
 }
 eq(Human.restore(committed.save(),context).snapshot(),state,'Result signed Save/Restore consistent');
 const undone=committed.undo();
 ok(undone.ok,'Undo succeeds after committed result');
 eq(undone.session.snapshot(),baseline,'Undo restores pre-commit battle and unrevealed defender');
 eq(Human.restore(preChoiceSave,context).view().options,view.options,'Pending result retains exact legal action after restore');
}
eq(Campaign.restore(baseSave,context).snapshot(),baseline,'Original journal remains authentically replayable');
console.log('PASS v556 real Kovel AL/NE and read-only choice effects:',checks,'assertions');
