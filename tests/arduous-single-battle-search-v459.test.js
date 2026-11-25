'use strict';
/* Source-valid campaign check: single-battle policies never require eager
 * two- or three-battle plan enumeration. Compare independent complete and
 * lazy candidate catalogs at the same immutable gameplay snapshot.
 */
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const Deployment=require('../core/historical_deployment_session');
const Inventory=require('../core/historical_source_face_inventory');
const Campaign=require('../core/historical_campaign_session');
const Catalog=require('../core/historical_campaign_action_catalog');
const Auto=require('../core/historical_campaign_autoplay');
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
let n=0;
const eq=(x,y,msg)=>{assert.deepStrictEqual(x,y,msg);n++;};
const ok=(x,msg)=>{assert.ok(x,msg);n++;};
const deployment=Deployment.create({map,setupSpec,counterConfig,
 inventory:Inventory.create(require('../maps/setup/arduous-inventory.json')),
 phaseConfig:config,movementProfile:profile,fixedPolicy,
 allocation:fixture.allocation,placements:fixture.placements}).commit({requireMixed:false});
const context={...deployment.opening,map,profile,config,counterConfig,combatPolicy,
 enableAirSupport:true,buildupPolicy,buildupAllocation:deployment.allocation,
 housekeepingPolicy,fixedPolicy};
const opening=Campaign.create(context);
const session=opening;
const snap=session.snapshot();
eq(snap.phaseKind,'combat','Opening German combat');
eq(snap.combat.status,'awaiting-declarations','Source-valid declaration point');
const before=session.save();
const full=Catalog.discover({session,context,enumerateCombinedPlans:true});
const lazy=Catalog.discover({session,context,enumerateCombinedPlans:false});
ok(full.proposals.length>0,'Has source-legal battle proposals');
eq(full.proposals,lazy.proposals,'All individual source-validated battles identical');
eq(full.commands,lazy.commands,'Authoritative commands identical');
eq(full.prompts.filter(p=>p.kind==='die-and-choice'),lazy.prompts.filter(p=>p.kind==='die-and-choice'),'Actual die decisions identical');
ok(full.prompts.every(p=>p.kind==='enumeration-incomplete'),'Full discovery reports only bounded multi-battle search warnings');
eq(lazy.combatEnumeration.combinedPlansEnumerated,false,'Lazy catalog does not enumerate combination plans');
eq(full.combatEnumeration.combinedPlansEnumerated,true,'Full catalog still supports combined battle plans');
eq(session.save(),before,'Neither discovery mutated the campaign or dice');
function expectedSeeded(choices,policy,turn,phaseId,actionCount,purpose){
 const key=[policy.seed,turn,phaseId,actionCount,purpose].join('|');
 const i=crypto.createHash('sha256').update(key).digest().readUInt32BE(0)%choices.length;
 return choices[i];
}
const policy={seed:7,selectionMode:'seeded',maxCombatsPerPhase:1,maxCombatsPerPhaseUnused:undefined};
delete policy.maxCombatsPerPhaseUnused;
const one=Auto.decide({session,context,policy});
eq(one.status,'action','Single-battle controller has a decision');
const expected=expectedSeeded(lazy.proposals.map(p=>[p]),policy,snap.cursor.turn,snap.phaseId,snap.actionCount,'battle-plan');
eq(one.action,{type:'combat',action:{type:'commit-battles',battles:expected}},'Seeded choice uses unchanged full individual proposal set');
ok(expected.length===1,'One attack only');
const executed=session.execute(one.action).session;
eq(executed.snapshot().combat.status,'committed','Authoritative engine accepts selected single attack');
eq(session.save(),before,'Controller discovery and execution preserve original snapshot');
const twoPolicy={seed:7,selectionMode:'seeded',maxCombatsPerPhase:2};
const two=Auto.decide({session,context,policy:twoPolicy});
eq(two.status,'action','Multi-battle controller still works');
const multiCandidates=full.plans.length?full.plans:full.proposals.map(p=>[p]);
const twoExpected=expectedSeeded(multiCandidates,twoPolicy,snap.cursor.turn,snap.phaseId,snap.actionCount,'battle-plan');
eq(two.action,{type:'combat',action:{type:'commit-battles',battles:twoExpected}},'Multi-battle enumeration behavior remains unchanged');
session.execute(two.action);
eq(session.save(),before,'Multi-battle discovery is read-only');
console.log(`PASS v459: ${n} single-battle lazy-search parity assertions; ${lazy.proposals.length} individual proposals; ${full.plans.length} two-battle plans available`);
