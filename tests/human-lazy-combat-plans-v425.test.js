'use strict';
/* Browser-facing humans need legal battle PROPOSALS, not expensive eagerly
 * enumerated two-/three-target plans. The same transaction validates any
 * selected combination. AI and other discovery callers retain full plans. */
const assert=require('node:assert/strict');
const Bridge=require('../core/scenario_opening_bridge');
const Inventory=require('../core/leningrad_starting_inventory');
const Fixture=require('./fixtures/leningrad-source-setup-v357');
const C=require('../core/historical_campaign_session');
const Human=require('../core/historical_campaign_human');
const Catalog=require('../core/historical_campaign_action_catalog');
const map=require('../maps/leningrad.json'),counterConfig=require('../maps/counter-configs/leningrad.json');
const setup=require('../maps/setup/leningrad.json'),profile=require('../maps/movement-configs/leningrad.json');
const config=require('../maps/phase-configs/leningrad.json'),combatPolicy=require('../maps/combat-configs/leningrad.json');
const buildupPolicy=require('../maps/buildup-configs/leningrad.json'),housekeepingPolicy=require('../maps/housekeeping-configs/leningrad.json');
const opening=Bridge.create({map,setupSpec:setup,counterConfig,inventory:Inventory,
 allocation:Fixture.selected,placements:Fixture.placements,phaseConfig:config,
 movementProfile:profile,phaseFactories:{combat:()=>({})},supportPolicy:combatPolicy}).snapshot();
const context={...JSON.parse(JSON.stringify(opening)),map,profile,config,counterConfig,combatPolicy,
 enableAirSupport:true,buildupPolicy,buildupAllocation:Fixture.selected,housekeepingPolicy};
const pre=C.create(context).execute({type:'combat',action:{type:'finish-air-sea'}}).session;
const oldHash=pre.save().finalStateHash;
const full=Catalog.discover({session:pre,context});
const human=Human.create({session:pre,context}),v=human.view();
assert.deepStrictEqual(v.proposals,full.proposals,'All individually legal combat proposals preserved');
assert.deepStrictEqual(v.commands,full.commands,'Legal commands unchanged');
assert.equal(v.combatEnumeration.combinedPlansEnumerated,false,'Human catalog explicitly defers combination enumeration');
assert.equal(v.combatEnumeration.plansExhaustive,false,'Deferred work cannot be represented as exhaustive');
assert.equal(v.plans.length,0);assert.equal(v.expandedPlans.length,0);
assert(full.expandedPlans.length>0,'Default discovery still provides verified strategic three-battle plans');
assert.equal(full.combatEnumeration.combinedPlansEnumerated,true);
const plan=full.expandedPlans[0];const committed=human.choose({type:'combat',action:{type:'commit-battles',battles:plan}});
assert.equal(committed.snapshot().combat.declaration.battles.length,3,'Human can still commit three battles');
assert.equal(pre.save().finalStateHash,oldHash,'Catalog and human discovery are read-only');
assert.throws(()=>Catalog.discover({session:pre,context,enumerateCombinedPlans:'false'}),/Invalid combined-plan/);
console.log('PASS human catalog lazy combined-plans: all proposals and actual three-battle commitment preserved');
