'use strict';
// Reproduce actual seed 61 grade-10/1 blocked combat; no synthetic geometry.
const A=require('node:assert/strict'), R=p=>require('../'+p), C=R('core/historical_campaign_session');
const map=R('maps/arduous.json'),profile=R('maps/movement-configs/arduous.json'),config=R('maps/phase-configs/arduous.json'),counterConfig=R('maps/counter-configs/arduous.json'),combatPolicy=R('maps/combat-configs/arduous.json'),setupSpec=R('maps/setup/arduous.json');
const f=require('./fixtures/arduous-source-setup-v419'),fixedPolicy=R('maps/setup/arduous-fixed-pieces.json');
const d=R('core/historical_deployment_session').create({map,setupSpec,counterConfig,phaseConfig:config,movementProfile:profile,phaseFactories:{combat:()=>({})},fixedPolicy,inventory:R('core/historical_source_face_inventory').create(R('maps/setup/arduous-inventory.json')),allocation:f.allocation,placements:f.placements}).commit({requireMixed:false});
const context={...d.opening,map,profile,config,counterConfig,combatPolicy:{...combatPolicy,crtVariant:'standard'},enableAirSupport:true,buildupPolicy:R('maps/buildup-configs/arduous.json'),housekeepingPolicy:R('maps/housekeeping-configs/arduous.json'),fixedPolicy,buildupAllocation:d.allocation};

let cur=C.create(context),n=0;
for(const rec of require('./fixtures/arduous-brest-drl-v671.json')){cur=cur.execute(rec.action).session;A.deepEqual(cur.journal().at(-1),rec);n++;}
const before=cur.save(),s=cur.snapshot();
A.equal(s.cursor.turn,2); A.equal(s.combat.selected,'0211'); n+=2;
const post=R('core/historical_campaign_action_catalog').discoverPostRoll({session:cur,context,die:1});
A.equal(post.crtOutcome,'DR');A.ok(post.options.length>0);n+=2;
for(const option of post.options){const next=cur.execute(option.action);A.equal(next.event.outcome,post.crtOutcome);A.equal(next.event.odds,5);n+=2;}
const resolved=cur.execute(post.options[0].action).session;
A.deepEqual(C.restore(resolved.save(),context).snapshot(),resolved.snapshot());A.deepEqual(cur.save(),before);n+=2;
console.log('Arduous Brest post-roll parity:',n,'assertions');
