'use strict';
/* Source action boundary, deterministic dice and fail-closed budget checks. */
const assert=require('node:assert/strict');
const Auto=require('../core/historical_campaign_autoplay');
const Human=require('../core/historical_campaign_human');
const {performance}=require('node:perf_hooks');
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
const missionSeed='0123456789abcdef0123456789abcdef',deploymentDraws=9;
const start=()=>Human.create({session:Campaign.create(context),context,missionSeed,deploymentDraws});
const policy={selectionMode:'first'};
const count=24;
function run(restoreEveryAction){
 let human=start();const trace=[];const t=performance.now();
 for(let i=0;i<count;i++){
  let decision;
  if(restoreEveryAction){
   const session=Campaign.restore(human.save().campaign,context);
   decision=Auto.decide({session,context,policy:{...policy,missionSeed}});
   assert.equal(decision.status,'action');
   human=Human.create({session:session.execute(decision.action).session,context,missionSeed,deploymentDraws});
  }else{
   const previous=human,previousCount=previous.snapshot().actionCount;
   const next=human.autoplayStep(policy);decision=next.decision;
   assert.equal(decision.status,'action');assert.ok(next.session);
   human=next.session;assert.equal(previous.snapshot().actionCount,previousCount);
   assert.equal(human.snapshot().actionCount,previousCount+1);
  }
  trace.push(decision);
 }
 return {human,trace,ms:performance.now()-t};
}
const old=run(true),fast=run(false);
eq(fast.trace,old.trace,'Exact AI decisions including seeded dice');
eq(fast.human.save(),old.human.save(),'Exact journal, state hashes, RNG binding and save envelope');
eq(fast.human.missionSeed(),missionSeed);eq(fast.human.deploymentDraws(),deploymentDraws);
eq(Human.restore(fast.human.save(),context).snapshot(),fast.human.snapshot());
eq(fast.human.undo().session.save(),old.human.undo().session.save());
const next=fast.human.autoplayStep(policy),afterRestore=Human.restore(fast.human.save(),context).autoplayStep(policy);
eq(next.decision,afterRestore.decision);eq(next.session.save(),afterRestore.session.save());
console.log(JSON.stringify({checks,actions:count,oldMs:old.ms,directMs:fast.ms,scenario:'leningrad',exactJournal:true}));
