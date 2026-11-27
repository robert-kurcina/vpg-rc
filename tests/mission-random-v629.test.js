'use strict';
const A=require('node:assert/strict'),R=require('../core/mission_random'),H=require('../core/historical_campaign_human'),C=require('../core/historical_campaign_session'),Auto=require('../core/historical_campaign_autoplay');
const F=require('./fixtures/kiev-source-opening-v437');
let n=0;const eq=(a,b)=>{A.deepEqual(a,b);n++},ok=v=>{A.ok(v);n++},throws=f=>{A.throws(f);n++};
const master='00112233445566778899aabbccddeeff';
const seeds=new Set(Array.from({length:32},()=>R.generate()));eq(seeds.size,32);ok([...seeds].every(x=>R.validate(x)===x));
const combat=Array.from({length:64},(_,i)=>R.integer(master,'combat',i,6));
const naval=Array.from({length:64},(_,i)=>R.integer(master,'naval',i,6));
eq(combat,Array.from({length:64},(_,i)=>R.integer(master,'combat',i,6)));ok(combat.every(x=>x>=0&&x<6));ok(combat.some((x,i)=>x!==naval[i]));eq(new Set(combat).size,6);
throws(()=>R.integer(master,'bogus',0,6));throws(()=>R.integer(master,'combat',-1,6));throws(()=>R.validate('foo'));
const record=a=>({action:a});const empty=[];const misc=[record({type:'declare-ground-move'}),record({type:'combat',action:{type:'resolve-battle',die:null}}),record({type:'roll-fleet-move',die:6})];
eq(R.count(misc,'combat'),0);eq(R.count(misc,'naval'),1);eq(R.die(master,misc,'combat'),R.die(master,empty,'combat'));
const journal=[...misc,record({type:'combat',action:{type:'commit-fleet-displacement',die:3}}),record({type:'combat',action:{type:'roll-fleet-displacement',die:4}})];eq(R.count(journal,'combat'),1);eq(R.count(journal,'naval'),2);eq(R.die(master,journal,'combat'),1+combat[1]);eq(R.die(master,journal,'naval'),1+naval[2]);
const map=F.map,counterConfig=F.counterConfig,profile=require('../maps/movement-configs/kiev.json'),config=require('../maps/phase-configs/kiev.json'),combatPolicy=require('../maps/combat-configs/kiev.json');
const opening=require('../core/historical_deployment_session').create({map,setupSpec:F.setupSpec,counterConfig,inventory:F.inventory,phaseConfig:config,movementProfile:profile,phaseFactories:{combat:()=>({})},allocation:F.allocation,placements:F.placements}).commit();
const context={...opening.opening,map,profile,config,counterConfig,combatPolicy,enableAirSupport:true,buildupPolicy:require('../maps/buildup-configs/kiev.json'),buildupAllocation:opening.allocation,housekeepingPolicy:require('../maps/housekeeping-configs/kiev.json')};
const units=Object.values(context.state.units),gs=units.filter(u=>u.owner==='german'&&u.printedCombatStrength===12).slice(0,2),targetUnit=units.find(u=>u.owner==='soviet'&&u.printedCombatStrength===8);
const board=require('../core/movement_binding').build(map,profile).board;
const edge=board.edges.find(e=>!e.river&&!e.majorRiver&&!e.impassable&&board.cells[e.b].terrain==='open'&&!map.cells.find(c=>c.id===e.b).city&&!combatPolicy.firstTurnTerritorialRestriction.targetHexes.includes(e.b));
const target=edge.b,neighbors=board.edges.filter(e=>(e.a===target||e.b===target)&&e.verified&&!e.impassable&&!e.river&&!e.majorRiver&&!e.lake&&!e.allSea).map(e=>e.a===target?e.b:e.a);
for(const variant of ['standard','advanced']){
 const ctx={...context,actor:'german',cursor:{...context.cursor,turn:3,index:config.phases.findIndex(p=>p.id==='german-combat')},combatPolicy:{...combatPolicy,crtVariant:variant},state:{...structuredClone(C.create(context).snapshot().state),units:Object.fromEntries([...gs.map((u,i)=>({...u,hex:neighbors[i]})),{...targetUnit,hex:target,strengthStatus:'printed-reduced',printedCombatStrength:4,activeFaceId:targetUnit.reverseFaceId}].map(u=>[u.id,u]))}};
 const initial=C.create(ctx);
 eq(initial.stateHash(),initial.save().finalStateHash);
 eq(initial.stateHash(),initial.stateHash());
 // Instrument the accepted gateway interface: pending dice and RNG must not
 // construct full saves on the authoritative path.
 let saveCalls=0,journalCalls=0,hashCalls=0;
 const wrap=session=>({...session,save:()=>{saveCalls++;return session.save();},
  journal:()=>{journalCalls++;return session.journal();},
  stateHash:()=>{hashCalls++;return session.stateHash();},
  execute:action=>{const out=session.execute(action);return {...out,session:wrap(out.session)};}});
 let h=H.create({session:wrap(initial),context:ctx,missionSeed:master});
 const before=h.save();eq(h.missionSeed(),master);eq(H.restore(before,ctx).save(),before);
 const battle={defenderHex:target,attackers:gs.map(u=>u.id)};
 h=h.choose({type:'combat',action:{type:'commit-battles',battles:[battle]}});
 h=h.choose(h.view().commands.find(a=>a.action?.type==='select-battle'));
 const air=h.view().commands.find(a=>a.action?.type==='commit-ground-air'&&a.action.faceId===null);if(air)h=h.choose(air);
 const pre=h.save(),beforeCalls=saveCalls,rolled=h.rollRandom();eq(saveCalls,beforeCalls);ok(journalCalls>0);ok(hashCalls>=2);eq(rolled.view().die,1+combat[0]);eq(H.restore(rolled.save(),ctx).save(),rolled.save());eq(rolled.undo().session.save(),pre);eq(rolled.undo().session.rollRandom().save(),rolled.save());
 const next=Auto.decide({session:C.restore(pre.campaign,ctx),context:ctx,policy:{missionSeed:master}});eq(next.status,'action');eq(next.action.action.die,rolled.view().die);
 const selected=rolled.view().options[0]||rolled.view().fleetCommitments[0],done=rolled.choose(selected);eq(R.count(done.save().campaign.journal,'combat'),1);eq(done.missionSeed(),master);eq(H.restore(done.save(),ctx).save(),done.save());eq(done.undo().session.rollRandom().save(),rolled.save());
 const committed=C.restore(done.save().campaign,ctx);
 eq(committed.stateHash(),committed.save().finalStateHash);
 eq(committed.stateHash(),committed.journal().at(-1).stateHash);
 const detached=committed.journal();detached.at(-1).stateHash='0'.repeat(64);
 eq(committed.stateHash(),committed.save().finalStateHash);
 const prior=committed.undo().session;eq(prior.stateHash(),prior.save().finalStateHash);
 const corrupt=structuredClone(done.save());corrupt.missionSeed='f'.repeat(32);throws(()=>H.restore(corrupt,ctx));
}
console.log('PASS mission RNG',n,'assertions');
