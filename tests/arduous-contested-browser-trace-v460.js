'use strict';
/* Emit an independently computed, source-validated contested Arduous game
 * as a replay oracle. Browser test must click real controls to enact actions;
 * this fixture is NOT a browser state transplant or a fake UI rendering. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const Campaign=require('../core/historical_campaign_session');
const Auto=require('../core/historical_campaign_autoplay');
const Deployment=require('../core/historical_deployment_session');
const Inventory=require('../core/historical_source_face_inventory');
const fixture=require('./fixtures/arduous-source-setup-v419');
const map=require('../maps/arduous.json');
const setupSpec=require('../maps/setup/arduous.json');
const config=require('../maps/phase-configs/arduous.json');
const profile=require('../maps/movement-configs/arduous.json');
const counterConfig=require('../maps/counter-configs/arduous.json');
const fixedPolicy=require('../maps/setup/arduous-fixed-pieces.json');
const combatPolicy=require('../maps/combat-configs/arduous.json');
const buildupPolicy=require('../maps/buildup-configs/arduous.json');
const housekeepingPolicy=require('../maps/housekeeping-configs/arduous.json');
const deployment=Deployment.create({map,setupSpec,counterConfig,
 inventory:Inventory.create(require('../maps/setup/arduous-inventory.json')),
 phaseConfig:config,movementProfile:profile,fixedPolicy,
 allocation:fixture.allocation,placements:fixture.placements}).commit({requireMixed:false});
const context={...deployment.opening,map,profile,config,counterConfig,combatPolicy,
 enableAirSupport:true,buildupPolicy,buildupAllocation:deployment.allocation,
 housekeepingPolicy,fixedPolicy};
const policy={seed:7,selectionMode:'seeded',maxActions:700,maxCombatsPerPhase:1,
 maxCombatPhases:16,maxGroundMovesPerPhase:1,maxReinforcementsPerPhase:4,
 maxFleetMoves:0,maxFleetAttacks:0};
let session=Campaign.create(context);
const openingHash=session.save().finalStateHash;
const trace=[];
for(let i=0;i<policy.maxActions;i++){
 const snap=session.snapshot();
 if(snap.cursor.complete)break;
 const d=Auto.decide({session,context,policy});
 assert.equal(d.status,'action',JSON.stringify(d));
 const next=session.execute(d.action).session;
 const after=next.snapshot();
 trace.push({index:i,turn:snap.cursor.turn,phaseId:snap.phaseId,actor:snap.actor,
  actionCount:snap.actionCount,action:d.action,reason:d.reason,
  afterActionCount:after.actionCount,afterPhaseId:after.phaseId,
  afterStateHash:next.save().finalStateHash});
 session=next;
}
const final=session.snapshot();
assert.equal(final.cursor.complete,true);
assert.equal(final.cursor.turn,7);
assert.equal(trace.length,184);
const body={checkpoint:226,version:'v460',scenarioId:'arduous',
 source:'Current shared engine campaign and deterministic legal-action controller; NOT browser acceptance',
 policy,openingStateHash:openingHash,finalStateHash:session.save().finalStateHash,
 outcome:final.terminal.outcome,actions:trace};
const dest=path.join(root,'rules/audit/arduous-contested-browser-oracle-v460.json');
fs.writeFileSync(dest,JSON.stringify(body,null,2)+'\n');
console.log('PASS trace oracle: '+trace.length+' actions, seven turns, '+body.outcome+', '+dest);
