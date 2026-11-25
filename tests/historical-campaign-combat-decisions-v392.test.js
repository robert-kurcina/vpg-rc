'use strict';
/* Checkpoint 158: source-verified multi-origin attackers and post-roll choice
 * discovery using authoritative campaign transactions. Candidate, not AI. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const Bridge=require('../core/scenario_opening_bridge');
const Inventory=require('../core/leningrad_starting_inventory');
const Fixture=require('./fixtures/leningrad-source-setup-v357');
const Campaign=require('../core/historical_campaign_session');
const Binding=require('../core/movement_binding');
const Catalog=require('../core/historical_campaign_action_catalog');
const map=require('../maps/leningrad.json');
const counterConfig=require('../maps/counter-configs/leningrad.json');
const setup=require('../maps/setup/leningrad.json');
const profile=require('../maps/movement-configs/leningrad.json');
const config=require('../maps/phase-configs/leningrad.json');
const combatPolicy=require('../maps/combat-configs/leningrad.json');
const buildupPolicy=require('../maps/buildup-configs/leningrad.json');
const housekeepingPolicy=require('../maps/housekeeping-configs/leningrad.json');
const clone=x=>JSON.parse(JSON.stringify(x));let n=0;
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);n++};
const ok=(v,m)=>{assert.ok(v,m);n++};
const bad=(f,re,m)=>{assert.throws(f,re,m);n++};
const opening=Bridge.create({map,setupSpec:setup,counterConfig,inventory:Inventory,
 allocation:Fixture.selected,placements:Fixture.placements,phaseConfig:config,
 movementProfile:profile,phaseFactories:{combat:()=>({})},supportPolicy:combatPolicy}).snapshot();
const context={...clone(opening),map,profile,config,counterConfig,combatPolicy,
 enableAirSupport:true,buildupPolicy,buildupAllocation:Fixture.selected,housekeepingPolicy};
const fresh=Campaign.create(context);
let phase=fresh.execute({type:'combat',action:{type:'finish-air-sea'}}).session;
const baseline=phase.save(),original=phase.snapshot();
const menu=Catalog.discover({session:phase,context});
eq(phase.snapshot(),original,'Catalog must be read-only');
eq(phase.save(),baseline,'Catalog must not consume game journal');
const multi=menu.proposals.filter(p=>p.attackers.length>1);
ok(multi.length>0,'At least one real multi-attacker battle is found');
ok(menu.proposals.some(p=>p.attackers.length===1),'Original individual proposals retained');
ok(menu.combatEnumeration.proposalsExhaustive,'Enumerated every admissible attacker subset for opening source state');
eq(menu.combatEnumeration.planSizeLimit,2,'Do not claim larger plan coverage');
let validated=0;
for(const proposal of menu.proposals){
 const next=phase.execute({type:'combat',action:{type:'commit-battles',battles:[proposal]}}).session;
 eq(next.snapshot().combat.declaration.battles[0].attackers,proposal.attackers);
 const origins=proposal.attackers.map(id=>original.state.units[id].hex);
 eq(new Set(origins).size,origins.length,'Only one attacker per origin/hexside');
 validated++;
}
// Independent subset oracle: derive adjacent origin hexes directly from the
// certified graph, then compare the full catalog set to authoritative commits.
// This catches omitted attacker-origin combinations, not merely false positives.
const board=Binding.build(map,profile).board;
const legalEdges=new Set(board.edges.filter(e=>e.verified&&!e.impassable&&!e.allSea&&!e.lake)
 .flatMap(e=>[e.a+':'+e.b,e.b+':'+e.a]));
const expected=new Set(),found=new Set(menu.proposals.map(b=>b.defenderHex+'='+b.attackers.join(',')));
for(const hex of [...new Set(Object.values(original.state.units).filter(u=>u.owner!=='german').map(u=>u.hex))].sort()){
 const adjacent=new Map();
 for(const u of Object.values(original.state.units).filter(u=>u.owner==='german'&&legalEdges.has(u.hex+':'+hex))){
  if(!adjacent.has(u.hex))adjacent.set(u.hex,[]);adjacent.get(u.hex).push(u.id);
 }
 let combos=[[]];
 for(const origin of [...adjacent.keys()].sort()){
  const next=[];for(const prefix of combos){next.push(prefix);for(const id of adjacent.get(origin).sort())next.push([...prefix,id]);}
  combos=next;
 }
 for(const ids of combos.filter(x=>x.length)){
  const b={defenderHex:hex,attackers:ids};
  try{phase.execute({type:'combat',action:{type:'commit-battles',battles:[b]}});
   expected.add(hex+'='+ids.join(','));}catch(_){}
 }
}
eq(found,expected,'Multi-attacker catalog equals all authoritative origin-side subsets in source opening');
ok(menu.plans.some(plan=>plan.some(b=>b.attackers.length>1)),
 'Bounded combined-battle plans include genuine multi-attacker choices');
for(const plan of menu.plans){
 const next=phase.execute({type:'combat',action:{type:'commit-battles',battles:plan}}).session;
 eq(next.snapshot().combat.declaration.battles.length,2);
}
// Source test first, then commit a multi-hexside battle. The die is provided
// AFTER the complete attack declaration and German air choice are committed.
const at0309=multi.find(p=>p.defenderHex==='0309');
ok(at0309,'Opening offers a two-origin attack on 0309');
phase=phase.execute({type:'combat',action:{type:'commit-battles',battles:[at0309]}}).session;
phase=phase.execute({type:'combat',action:{type:'select-battle',defenderHex:'0309'}}).session;
bad(()=>Catalog.discoverPostRoll({session:phase,context,die:1}),/lock Air Corps/,
 'Die-dependent choice discovery blocked before air commitment');
phase=phase.execute({type:'combat',action:{type:'commit-ground-air',faceId:null}}).session;
bad(()=>Catalog.discoverPostRoll({session:phase,context,die:0}),/Committed d6/);
bad(()=>Catalog.discoverPostRoll({session:phase,context,die:7}),/Committed d6/);
const beforeRoll=phase.snapshot(),save=phase.save();
const post=Catalog.discoverPostRoll({session:phase,context,die:1});
eq(phase.snapshot(),beforeRoll,'Post-roll option discovery must be read-only');
eq(phase.save(),save,'Post-roll option discovery cannot consume dice or state');
ok(post.options.length>0,'At least one authoritative die-1 consequence');
eq(post.exhaustive,false,'Explicitly acknowledge incomplete post-casualty consequence discovery');
for(const item of post.options){
 const actual=phase.execute(item.action);
 eq(actual.event.outcome,item.outcome,'Catalog outcome comes from the real CRT resolver');
 eq(actual.event.losses,item.losses);
 eq(actual.event.retreats,item.retreats);
 eq(actual.event.advanced,item.advanced);
}
const withRetreat=post.options.find(p=>p.retreats.length>0);
ok(withRetreat,'At least one source-validated retreat candidate for multi-attacker attack');
const actual=phase.execute(withRetreat.action).session;
eq(Campaign.restore(clone(actual.save()),context).snapshot(),actual.snapshot(),
 'Resolved multi-attacker combat restores from full campaign journal');
eq(actual.undo().session.snapshot(),beforeRoll,'Undo returns to locked, pre-die choice state');
// The opening 8-v-3 engagement is the established EX test. Counter faces,
// not fabricated strengths, determine loss feasibility.
const unit=Object.values(original.state.units).find(u=>u.owner==='german'&&u.hex==='0310'&&u.printedCombatStrength===8);
ok(unit,'Original source German unit identified');
let ex=fresh.execute({type:'combat',action:{type:'finish-air-sea'}}).session;
ex=ex.execute({type:'combat',action:{type:'commit-battles',battles:[{defenderHex:'0309',attackers:[unit.id]}]}}).session;
ex=ex.execute({type:'combat',action:{type:'select-battle',defenderHex:'0309'}}).session;
ex=ex.execute({type:'combat',action:{type:'commit-ground-air',faceId:null}}).session;
const exCatalog=Catalog.discoverPostRoll({session:ex,context,die:3});
const exchange=exCatalog.options.find(o=>o.outcome==='EX'&&o.losses.length===2);
ok(exchange,'Source-valid EX casualty choice advertised after committed die');
const casualty=ex.execute(exchange.action).session;
eq(casualty.snapshot().combat.resolved[0].outcome,'EX');
eq(Campaign.restore(clone(casualty.save()),context).snapshot(),casualty.snapshot());
// Negative: even a seemingly plausible advance cannot be advertised unless
// accepted by the same source consequence resolver.
for(const result of exCatalog.options){
 const r=ex.execute(result.action);
 eq(r.event.outcome,'EX');
}
const audit={checkpoint:158,version:'v392',assertions:n,
 multiAttackerProposals:multi.length,allLegalIndividualBattleProposals:validated,
 boundedTwoBattlePlans:menu.plans.length,plansExhaustive:menu.combatEnumeration.plansExhaustive,
 postRollCandidates:post.options.length,exchangeCandidates:exCatalog.options.length,
 verified:'Current configured source counter opening, all proposals and listed outcomes pass immutable authoritative transactions',
 exclusions:['Candidate historical unit identities and two printed host coordinates remain unresolved',
 'Multiple-target plans capped at two battles and 128 entries',
 'Post-roll choices not complete for post-casualty retreat recomputation or Fleet displacement',
 'No AI policy, no UX cutover, no change to the common B4M CRT or approved map rendering']};
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/leningrad-combat-decisions-v392.json',JSON.stringify(audit,null,2)+'\n');
console.log('PASS v392 '+n+' assertions; '+multi.length+' multi-attacker choices, '+menu.plans.length+' bounded two-battle plans, '+post.options.length+' die-1 options');
