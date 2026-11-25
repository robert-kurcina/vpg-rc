'use strict';
/* Checkpoint 159: DRL/EX retreat proposals must be built from the exact
 * source-face state AFTER mandatory casualties, not from pre-battle units.
 * All candidates are ultimately validated through the campaign transaction.
 * This fixture uses real counter face pairs on a synthetic adversarial layout.
 */
const assert=require('node:assert/strict'),fs=require('node:fs');
const Bridge=require('../core/scenario_opening_bridge');
const Inventory=require('../core/leningrad_starting_inventory');
const Fixture=require('./fixtures/leningrad-source-setup-v357');
const Campaign=require('../core/historical_campaign_session');
const Catalog=require('../core/historical_campaign_action_catalog');
const Consequences=require('../core/historical_combat_consequences');
const Geography=require('../core/historical_combat_geography');
const Retreat=require('../core/historical_forced_retreat');
const map=require('../maps/leningrad.json'),counterConfig=require('../maps/counter-configs/leningrad.json');
const setup=require('../maps/setup/leningrad.json'),profile=require('../maps/movement-configs/leningrad.json');
const config=require('../maps/phase-configs/leningrad.json'),combatPolicy=require('../maps/combat-configs/leningrad.json');
const buildupPolicy=require('../maps/buildup-configs/leningrad.json');
const housekeepingPolicy=require('../maps/housekeeping-configs/leningrad.json');
const copy=x=>JSON.parse(JSON.stringify(x));let checks=0;
function eq(a,b,m){assert.deepEqual(a,b,m);checks++;}
function yes(v,m){assert.ok(v,m);checks++;}
function bad(f,re,m){assert.throws(f,re,m);checks++;}
const opening=Bridge.create({map,setupSpec:setup,counterConfig,inventory:Inventory,
 allocation:Fixture.selected,placements:Fixture.placements,phaseConfig:config,
 movementProfile:profile,phaseFactories:{combat:()=>({})},supportPolicy:combatPolicy}).snapshot();
const units=Object.values(opening.state.units);
const soviet=units.find(u=>u.owner==='soviet'&&u.hex==='0309');
const army=units.find(u=>u.owner==='soviet'&&u.hex==='0611'&&u.printedCombatStrength===8);
const west=units.find(u=>u.owner==='german'&&u.hex==='0210'&&u.printedCombatStrength===8);
const south=units.find(u=>u.owner==='german'&&u.hex==='0310'&&u.printedCombatStrength===8);
yes(soviet&&army&&west&&south,'Real source counter identities and values required');
const forced=copy(opening.state);
forced.units[soviet.id].hex='0611';
forced.units[army.id].hex='0309';
forced.units[west.id].hex='0308';
forced.units[west.id].printedCombatStrength=4;
forced.units[west.id].strengthStatus='printed-reduced';
forced.units[west.id].activeFaceId=forced.units[west.id].reverseFaceId;
// Remove unrelated German ZOCs from this local graph test, without
// changing any source counter faces or the authoritative terrain graph.
for(const u of Object.values(forced.units))if(u.owner==='german'&&![west.id,south.id].includes(u.id))u.hex='1609';
const context={...copy(opening),state:forced,map,profile,config,counterConfig,combatPolicy,
 enableAirSupport:true,buildupPolicy,buildupAllocation:Fixture.selected,housekeepingPolicy};
function selected(ctx,attackerIds,airFaceId=null){
 let session=Campaign.create(ctx).execute({type:'combat',action:{type:'finish-air-sea'}}).session;
 session=session.execute({type:'combat',action:{type:'commit-battles',battles:[{
  defenderHex:'0309',attackers:attackerIds}]}}).session;
 session=session.execute({type:'combat',action:{type:'select-battle',defenderHex:'0309'}}).session;
 return session.execute({type:'combat',action:{type:'commit-ground-air',faceId:airFaceId}}).session;
}
const session=selected(context,[west.id,south.id]);
const before=session.snapshot(),saved=session.save();
const selectedBattle=before.combat.declaration.battles[0];
const consequence=Consequences.create({map,profile,counterConfig,combatPolicy,phaseConfig:config,
 enableAirSupport:true,geography:Geography.create(map,profile,{cityMarkerMode:combatPolicy.cityMarkerMode})});
const base={state:before.state,battle:selectedBattle,actor:before.actor,die:2,
 cursor:before.cursor,airSupportId:null};
eq(consequence.previewPostCasualty(base).outcome,'EX','CRT result from authoritative shared evaluator');
const EX={attackerLossIds:[west.id]};
const intermediate=consequence.previewPostCasualty({...base,choices:EX});
eq(intermediate.outcome,'EX');
eq(intermediate.state.units[west.id],undefined,'Reduced attacker dies paying EX loss');
eq(intermediate.state.units[army.id].printedCombatStrength,4,'Defender reduced before retreat');
eq(intermediate.survivingDefenderIds,[army.id]);
eq(before.state.units[army.id].printedCombatStrength,8,'Preview leaves source board intact');
const solver=Retreat.create({map,profile,combatPolicy,counterConfig});
const oldRoutes=solver.enumerate({state:before.state,defenderHex:'0309',defenderIds:[army.id]});
const postRoutes=solver.enumerate({state:intermediate.state,defenderHex:'0309',defenderIds:[army.id]});
yes(!oldRoutes.combinations.some(c=>c[army.id]?.route[0]==='0308'),
 'Pre-loss board blocks German-occupied retreat hex 0308');
yes(postRoutes.combinations.some(c=>c[army.id]?.route[0]==='0308'),
 'After eliminated attacking unit, that same hex is vacated and legal to traverse');
const discovered=Catalog.discoverPostRoll({session,context,die:2});
eq(discovered.crtOutcome,'EX');
yes(discovered.afterLossRetreatScans>0);
yes(discovered.options.length>0);
const newlyAvailable=discovered.options.filter(o=>o.action.action.choices.attackerLossIds?.includes(west.id)&&
 Object.values(o.action.action.choices.retreatPaths||{}).some(route=>route[0]==='0308'));
yes(newlyAvailable.length>0,'Advertise at least one post-EX casualty route absent from pre-loss board');
for(const proposal of newlyAvailable){
 const actual=session.execute(proposal.action);
 eq(actual.event.outcome,'EX');
 eq(actual.event.losses,proposal.losses);
 eq(actual.event.retreats,proposal.retreats);
 const replay=Campaign.restore(copy(actual.session.save()),context);
 eq(replay.snapshot(),actual.session.snapshot());
 eq(actual.session.undo().session.snapshot(),before);
}
eq(session.snapshot(),before,'Discovery and preview never mutate session state');
eq(session.save(),saved,'Discovery never changes journal or consumes RNG');
// DRL: a full-strength Soviet Army loses its first step BEFORE a forced
// retreat, with the die and source-identified German Air Corps already locked.
const drlState=copy(forced);
drlState.units[west.id].strengthStatus='printed-full';
drlState.units[west.id].printedCombatStrength=8;
delete drlState.units[west.id].activeFaceId;
const drlContext={...context,state:drlState};
const drl=selected(drlContext,[west.id,south.id],'leningrad-front-r04c05');
const drlBefore=drl.snapshot(),drlSaved=drl.save();
const drlChoices=Catalog.discoverPostRoll({session:drl,context:drlContext,die:6});
eq(drlChoices.crtOutcome,'DRL','Air Corps commitment shifts to DRL column');
yes(drlChoices.afterLossRetreatScans>0,'Retreat routes recalculated after DRL step loss');
yes(drlChoices.options.some(o=>o.losses.some(l=>l.unitId===army.id&&l.removed===false)),
 'DRL mandatory Army step loss occurs before the post-roll retreat');
for(const proposal of drlChoices.options){
 const action=drl.execute(proposal.action);
 eq(action.event.outcome,'DRL');
 eq(action.event.losses,proposal.losses);
 eq(action.event.retreats,proposal.retreats);
}
eq(drl.snapshot(),drlBefore);eq(drl.save(),drlSaved);
// Strict commitment discipline and typed source validation.
const uncommitted=Campaign.create(context).execute({type:'combat',action:{type:'finish-air-sea'}}).session;
bad(()=>Catalog.discoverPostRoll({session:uncommitted,context,die:2}),/Select a committed battle/);
bad(()=>consequence.previewPostCasualty({...base,choices:{attackerLossIds:['forged']}}),
 /Explicit exchange attacker step-loss sequence required/);
bad(()=>consequence.previewPostCasualty({...base,choices:{advanceUnitId:west.id}}),
 /only mandatory loss choices/);
const audit={checkpoint:159,version:'v393',assertions:checks,
 exAfterLossRoutes:postRoutes.combinations.length,exBeforeLossRoutes:oldRoutes.combinations.length,
 newlyAvailableRoutes:newlyAvailable.length,exCandidates:discovered.options.length,
 drlCandidates:drlChoices.options.length,postLossStages:discovered.afterLossStates,
 evidence:'Certified Leningrad graph and photographed source counter face pairs; adversarial nonhistorical positions',
 limits:['Historical unit-to-formation assignments and two source coordinate anchors remain unverified',
 'Fleet displacement decision discovery still incomplete','Joint retreat enumeration that cannot be certified fails closed',
 'Post-roll catalog is bounded and not a complete human or AI campaign controller']};
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/leningrad-postcasualty-retreat-v393.json',JSON.stringify(audit,null,2)+'\n');
console.log('PASS v393',checks,'assertions; EX',discovered.options.length,'DRL',drlChoices.options.length,
 'new-after-loss',newlyAvailable.length);
