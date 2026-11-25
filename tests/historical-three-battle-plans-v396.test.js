'use strict';
/* Checkpoint 162: independently validated, bounded three-target planning and
 * all-three-battles actual B4M CRT execution from a source-configured start.
 * Candidate unit allocation is not certified original-game identity. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Bridge=require('../core/scenario_opening_bridge');
const Inventory=require('../core/leningrad_starting_inventory');
const Fixture=require('./fixtures/leningrad-source-setup-v357');
const Campaign=require('../core/historical_campaign_session');
const Catalog=require('../core/historical_campaign_action_catalog');
const map=require('../maps/leningrad.json');
const counterConfig=require('../maps/counter-configs/leningrad.json');
const setup=require('../maps/setup/leningrad.json');
const profile=require('../maps/movement-configs/leningrad.json');
const config=require('../maps/phase-configs/leningrad.json');
const combatPolicy=require('../maps/combat-configs/leningrad.json');
const buildupPolicy=require('../maps/buildup-configs/leningrad.json');
const housekeepingPolicy=require('../maps/housekeeping-configs/leningrad.json');
const copy=x=>JSON.parse(JSON.stringify(x));let checks=0;
const eq=(a,b,m)=>{assert.deepStrictEqual(a,b,m);checks++};
const yes=(v,m)=>{assert.ok(v,m);checks++};
const bad=(fn,re,m)=>{assert.throws(fn,re,m);checks++};
const opening=Bridge.create({map,setupSpec:setup,counterConfig,inventory:Inventory,
 allocation:Fixture.selected,placements:Fixture.placements,phaseConfig:config,
 movementProfile:profile,phaseFactories:{combat:()=>({})},supportPolicy:combatPolicy}).snapshot();
const context={...copy(opening),map,profile,config,counterConfig,combatPolicy,
 enableAirSupport:true,buildupPolicy,buildupAllocation:Fixture.selected,housekeepingPolicy};
const pre=Campaign.create(context).execute({type:'combat',action:{type:'finish-air-sea'}}).session;
const snap=pre.snapshot(),saved=pre.save();
const menu=Catalog.discover({session:pre,context});
eq(pre.snapshot(),snap,'Discovery does not mutate campaign snapshot');
eq(pre.save(),saved,'Discovery does not change journal');
yes(menu.expandedPlans.length>0,'At least one real three-battle plan in the source-configured opening');
eq(menu.combatEnumeration.planSizeLimit,2,'Original two-battle list contract preserved');
eq(menu.combatEnumeration.expandedPlanSizeLimit,3);
yes(menu.plans.every(x=>x.length===2),'Legacy list unchanged');
yes(menu.expandedPlans.every(x=>x.length===3),'Expanded plans have exactly three battles');
yes(menu.combatEnumeration.expandedPlansExhaustive===false,'Limit must be explicitly recorded');
yes(menu.prompts.some(p=>p.type==='three-battle-plans'&&p.kind==='enumeration-incomplete'),
 'Truncation prompt is separately displayed for larger plans');
const distinct=new Set(),originalUnitOrder=Object.values(snap.state.units).map(x=>x.id);
for(const battles of menu.expandedPlans){
 const fingerprint=JSON.stringify(battles);
 yes(!distinct.has(fingerprint),'No duplicate three-battle declaration');distinct.add(fingerprint);
 eq(new Set(battles.map(b=>b.defenderHex)).size,3,'Three different defenders');
 const attackers=battles.flatMap(b=>b.attackers);
 eq(new Set(attackers).size,attackers.length,'Attacker may participate in only one battle');
 yes(attackers.every(id=>originalUnitOrder.includes(id)),'Only counters from source allocation');
 const executed=pre.execute({type:'combat',action:{type:'commit-battles',battles}}).session;
 eq(executed.snapshot().combat.declaration.battles.length,3,
 'The authoritative transaction, not the action catalog, accepts the plan');
 eq(pre.snapshot(),snap,'Repeated proposal verification cannot mutate starting board');
}
// Complete three B4M-CRT battles after precommit, with a real die and only
// source-authorized consequence choices generated after the roll.
let played=pre.execute({type:'combat',action:{type:'commit-battles',
 battles:menu.expandedPlans[0]}}).session;
const committed=played.snapshot();
eq(Campaign.restore(copy(played.save()),context).snapshot(),committed,
 'Full three-battle commitment survives serialization');
for(const battle of menu.expandedPlans[0]){
 played=played.execute({type:'combat',action:{type:'select-battle',defenderHex:battle.defenderHex}}).session;
 const chosen=played.snapshot();
 bad(()=>Catalog.discoverPostRoll({session:played,context,die:1}),/lock Air Corps/,
  'No result-dependent choice before Air Corps commitment');
 played=played.execute({type:'combat',action:{type:'commit-ground-air',faceId:null}}).session;
 const locked=played.snapshot(),locksave=played.save();
 const choices=Catalog.discoverPostRoll({session:played,context,die:1});
 yes(choices.options.length>0,'At least one authoritative result choice for committed die');
 eq(played.snapshot(),locked,'Result discovery is side-effect-free');
 eq(played.save(),locksave,'Result discovery consumes no RNG nor journal action');
 const result=played.execute(choices.options[0].action);
 played=result.session;
 yes(['NE','DR','DRL','EX','AL','DE'].includes(result.event.outcome),
  'Actual B4M CRT consequence, never predicted by catalog');
 eq(Campaign.restore(copy(played.save()),context).snapshot(),played.snapshot(),
  'Campaign restore after each resolved battle');
 eq(played.undo().session.snapshot(),locked,'Combat Undo returns to locked pre-die state');
}
eq(played.snapshot().combat.resolved.length,3,'All three declared battles actually resolved');
eq(played.snapshot().combat.status,'battles-resolved');
played=played.execute({type:'combat',action:{type:'finish-combat'}}).session;
eq(played.snapshot().phaseId,'german-special-movement',
 'Engine transitions out of combat after all three battles');
eq(Campaign.restore(copy(played.save()),context).snapshot(),played.snapshot());
const report={checkpoint:162,version:'v396',assertions:checks,
  scenario:'leningrad candidate source-counter opening',
  legacyTwoBattlePlans:menu.plans.length,threeBattlePlans:menu.expandedPlans.length,
  expandedExhaustive:menu.combatEnumeration.expandedPlansExhaustive,
  combatResults:3,actualPhaseAfterCombat:played.snapshot().phaseId,
  preservation:'No action catalog choices commit game state or consume dice',
  limits:['Three-battle enumeration deliberately capped and flagged incomplete',
   'No exhaustive four-or-more battle partitions',
   'Candidate Leningrad unit identity and two coordinate anchors remain uncertified',
   'Result options for complex historical consequences remain bounded']};
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/leningrad-three-battle-plans-v396.json',JSON.stringify(report,null,2)+'\n');
console.log('PASS v396',checks,'assertions;',menu.expandedPlans.length,'three-battle plans; three B4M combat results; full Undo/save');
