'use strict';
/* Source action boundary, deterministic dice and fail-closed budget checks. */
const assert=require('node:assert/strict');
const Auto=require('../core/historical_campaign_autoplay');
const Campaign=require('../core/historical_campaign_session');
const Bridge=require('../core/scenario_opening_bridge');
const Inventory=require('../core/leningrad_starting_inventory');
const Fixture=require('./fixtures/leningrad-source-setup-v357');
const map=require('../maps/leningrad.json'),counterConfig=require('../maps/counter-configs/leningrad.json');
const setup=require('../maps/setup/leningrad.json'),profile=require('../maps/movement-configs/leningrad.json');
const config=require('../maps/phase-configs/leningrad.json'),combatPolicy=require('../maps/combat-configs/leningrad.json');
const buildupPolicy=require('../maps/buildup-configs/leningrad.json');
const housekeepingPolicy=require('../maps/housekeeping-configs/leningrad.json');
const clone=x=>JSON.parse(JSON.stringify(x));let checks=0;
function eq(a,b,m){assert.deepEqual(a,b,m);checks++;}
const opening=Bridge.create({map,setupSpec:setup,counterConfig,inventory:Inventory,
 allocation:Fixture.selected,placements:Fixture.placements,phaseConfig:config,
 movementProfile:profile,phaseFactories:{combat:()=>({})},supportPolicy:combatPolicy}).snapshot();
const context={...clone(opening),map,profile,config,counterConfig,combatPolicy,
 enableAirSupport:true,buildupPolicy,buildupAllocation:Fixture.selected,housekeepingPolicy};
const session=Campaign.create(context),policy={seed:137};
const before=session.save(),decision=Auto.decide({session,context,policy});
eq(session.save(),before,'Controller discovery must not modify campaign state');
eq(decision,Auto.decide({session,context,policy}),'Identical opening has identical action');
assert.equal(decision.status,'action');checks++;
const executed=session.execute(decision.action).session;
eq(executed.snapshot().actionCount,1);
eq(session.snapshot().actionCount,0);
const bounded=Auto.run({session,context,policy:{seed:137,maxActions:1}});
eq(bounded.status,'blocked');eq(bounded.reason,'controller-action-budget');
eq(bounded.session.save(),executed.save(),'Budget may not consume or fabricate another action');
const restored=Campaign.restore(executed.save(),context);
eq(Auto.decide({session:restored,context,policy}),Auto.decide({session:executed,context,policy}),
 'Continuation choice must survive replay and restoration');
const dieState={cursor:{turn:3},phaseId:'soviet-combat',actionCount:22};
eq(Auto.dieFor(137,dieState,'ground'),Auto.dieFor(137,dieState,'ground'));
assert(Auto.dieFor(137,dieState,'ground')>=1&&Auto.dieFor(137,dieState,'ground')<=6);checks++;
for(const bad of [{maxActions:0},{maxActions:1.2},{seed:-1},{unsupported:7},null]){
 assert.throws(()=>Auto.policyOf(bad));checks++;
}
// Separate experimental movement and combat features without changing existing presets.
const operational={phaseScope:'operational'};
eq(Auto.policyOf({}).coordinatedAttacks,false);
eq(Auto.policyOf(operational).coordinatedAttacks,false);
eq(Auto.policyOf({...operational,objectivePolicy:'reserve-relief'}).coordinatedAttacks,true);
eq(Auto.policyOf({...operational,objectivePolicy:'reserve-relief',coordinatedAttacks:false}).coordinatedAttacks,false);
eq(Auto.policyOf({...operational,coordinatedAttacks:true}).coordinatedAttacks,true);
for(const bad of [{coordinatedAttacks:true},{...operational,coordinatedAttacks:'true'},{...operational,coordinatedAttacks:null}]){assert.throws(()=>Auto.policyOf(bad));checks++;}
console.log('PASS v399 '+checks+' deterministic action-controller and fail-closed budget assertions');
