'use strict';
/* Checkpoint 230: independent source-bound paged combat enumeration must
 * yield cooperative work, remain immutable, and agree with the original
 * one-shot wrapper. Leningrad provides a certified non-crowded case; the
 * Arduous crowded multi-page case is covered in Chromium v464. */
const assert=require('node:assert/strict');
const Campaign=require('../core/historical_campaign_session');
const Human=require('../core/historical_campaign_human');
const Bridge=require('../core/scenario_opening_bridge');
const Inventory=require('../core/leningrad_starting_inventory');
const Fixture=require('./fixtures/leningrad-source-setup-v357');
const Catalog=require('../core/historical_campaign_action_catalog');
const map=require('../maps/leningrad.json');
const counterConfig=require('../maps/counter-configs/leningrad.json');
const setup=require('../maps/setup/leningrad.json');
const profile=require('../maps/movement-configs/leningrad.json');
const config=require('../maps/phase-configs/leningrad.json');
const combatPolicy=require('../maps/combat-configs/leningrad.json');
const buildupPolicy=require('../maps/buildup-configs/leningrad.json');
const housekeepingPolicy=require('../maps/housekeeping-configs/leningrad.json');
const clone=x=>JSON.parse(JSON.stringify(x));
let checks=0;
const ok=(v,m)=>{assert.ok(v,m);checks++};
const same=(a,b,m)=>{assert.deepStrictEqual(a,b,m);checks++};
const throws=(fn,re,m)=>{assert.throws(fn,re,m);checks++};
const opening=Bridge.create({map,setupSpec:setup,counterConfig,inventory:Inventory,
 allocation:Fixture.selected,placements:Fixture.placements,phaseConfig:config,
 movementProfile:profile,phaseFactories:{combat:()=>({})},supportPolicy:combatPolicy}).snapshot();
const context={...clone(opening),map,profile,config,counterConfig,combatPolicy,
 enableAirSupport:true,buildupPolicy,buildupAllocation:Fixture.selected,housekeepingPolicy};
let session=Campaign.create(context).execute({type:'combat',action:{type:'finish-air-sea'}}).session;
const u=Object.values(session.snapshot().state.units).find(u=>u.owner==='german'&&u.hex==='0310'&&u.printedCombatStrength===8);
ok(u,'source-authentic Leningrad infantry attacker');
session=session.execute({type:'combat',action:{type:'commit-battles',battles:[{defenderHex:'0309',attackers:[u.id]}]}}).session;
session=session.execute({type:'combat',action:{type:'select-battle',defenderHex:'0309'}}).session;
session=session.execute({type:'combat',action:{type:'commit-ground-air',faceId:null}}).session;
const beforeSave=session.save(),beforeSnap=session.snapshot();
const pager=Catalog.createPostRollPager({session,context,die:3});
const one=pager.advance(0,1);
same(one.workSteps,1,'One cursor advance consumes one bounded step');
ok(!one.ready,'Single work step is not an eager complete enumeration');
same(session.save(),beforeSave,'One cursor step leaves authoritative journal intact');
let totalSteps=1,progress=one;
while(!progress.ready){progress=pager.advance(0,2);totalSteps+=progress.workSteps;ok(totalSteps<500,'Cursor makes bounded finite progress');}
const first=pager.page(0);
ok(first.options.length>0,'A source-authentic EX battle produces valid consequences');
ok(!first.hasNextPage,'Short battle has one consequence page');
same(first.choicePage,0,'Page index is preserved');
same(pager.stats().attempted,first.attempted,'Cursor exposure matches verified attempts');
same(Catalog.discoverPostRoll({session,context,die:3}).options,first.options,'Resumed and one-shot enumerators agree on every validated action');
same(pager.page(0).options,first.options,'Cached page remains deterministic');
same(session.save(),beforeSave,'Incremental source validator does not commit a die or action');
same(session.snapshot(),beforeSnap,'Incremental validator does not alter combat or pieces');
throws(()=>pager.advance(-1,8),/Invalid post-roll consequence page/,'Negative page rejected');
throws(()=>pager.advance(0,0),/Invalid post-roll work budget/,'Zero work budget rejected');
throws(()=>pager.advance(0,513),/Invalid post-roll work budget/,'Unbounded chunk rejected');
throws(()=>pager.page(1),/not available/,'Unverified later page cannot be fabricated');
const h=Human.create({session,context});
const pending=h.roll(3);
same(pending.view(0).options,first.options.map(x=>x.action),'Human choice gateway exposes source-only validated actions');
throws(()=>pending.preparePage(1,8),/not available/,'Human gateway refuses unavailable pages');
const pendingSave=pending.save();
same(Human.restore(pendingSave,context).view(0),pending.view(0),'Committed die and options survive ordinary save/restore');
same(session.save(),beforeSave,'Human paging does not alter source session');
console.log(`PASS v464: ${checks} incremental source-validated cursor assertions; ${totalSteps} bounded work steps`);
