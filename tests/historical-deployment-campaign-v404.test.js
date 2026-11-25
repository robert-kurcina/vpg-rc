'use strict';
const assert=require('node:assert/strict');
const Deployment=require('../core/historical_deployment_session');
const Campaign=require('../core/historical_campaign_session');
const Auto=require('../core/historical_campaign_autoplay');
const Fixture=require('./fixtures/leningrad-source-setup-v357');
const source={map:require('../maps/leningrad.json'),setupSpec:require('../maps/setup/leningrad.json'),counterConfig:require('../maps/counter-configs/leningrad.json'),inventory:require('../core/leningrad_starting_inventory'),phaseConfig:require('../maps/phase-configs/leningrad.json'),movementProfile:require('../maps/movement-configs/leningrad.json'),supportPolicy:require('../maps/combat-configs/leningrad.json')};
const buildupPolicy=require('../maps/buildup-configs/leningrad.json'),housekeepingPolicy=require('../maps/housekeeping-configs/leningrad.json');
const mech=[...Fixture.selected.sovietRearMechanizedCorps,...Fixture.selected.sovietFrontMechanizedCorps];
const setup=Deployment.create({...source,allocation:Fixture.selected,placements:Fixture.placements})
 .move(Fixture.selected.germanInitialInfantry[0],'0511')
 .permute(['sovietRearMechanizedCorps','sovietFrontMechanizedCorps'],mech.slice().reverse());
const committed=setup.commit({requireMixed:true});
const context={...committed.opening,map:source.map,profile:source.movementProfile,config:source.phaseConfig,
 counterConfig:source.counterConfig,combatPolicy:source.supportPolicy,enableAirSupport:true,
 buildupPolicy,buildupAllocation:committed.allocation,housekeepingPolicy};
const policy={seed:137,maxActions:650,maxCombatsPerPhase:1,maxCombatPhases:2,
 maxGroundMovesPerPhase:1,maxReinforcementsPerPhase:2,maxFleetMoves:1,maxFleetAttacks:2};
const run=Auto.run({session:Campaign.create(context),context,policy});
assert.equal(run.status,'complete',run.reason+': '+run.detail);
assert.equal(run.session.snapshot().cursor.complete,true);
assert.equal(run.stats.turns,8);
assert.ok(run.stats.combats>=1);
assert.ok(run.stats.moves>=1);
assert.deepEqual(Campaign.restore(run.session.save(),context).snapshot(),run.session.snapshot());
const report={checkpoint:170,version:'v404',status:'PASS',actions:run.trace.length,stats:run.stats,
 setup:'user-changed German initial cross + randomly permuted in-browser-equivalent concealed identities',
 qualifier:'deterministic test permutation, not independently certified hidden information'};
if(process.argv.includes('--write-audit'))require('node:fs').writeFileSync('rules/audit/leningrad-deployment-campaign-v404.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
