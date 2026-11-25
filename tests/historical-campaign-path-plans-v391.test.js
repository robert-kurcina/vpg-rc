'use strict';
/* Checkpoint 157: enumerated source-certified movement destinations and bounded
 * two-battle combination plans. This is NOT full combat-plan completeness. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Bridge=require('../core/scenario_opening_bridge');
const Inventory=require('../core/leningrad_starting_inventory');
const Fixture=require('./fixtures/leningrad-source-setup-v357');
const Campaign=require('../core/historical_campaign_session');
const Catalog=require('../core/historical_campaign_action_catalog');
const Binding=require('../core/movement_binding');
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
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const yes=(v,m)=>{assert.ok(v,m);checks++;};
const fails=(fn,re,m)=>{assert.throws(fn,re,m);checks++;};
const opening=Bridge.create({map,setupSpec:setup,counterConfig,inventory:Inventory,
 allocation:Fixture.selected,placements:Fixture.placements,phaseConfig:config,
 movementProfile:profile,phaseFactories:{combat:()=>({})},supportPolicy:combatPolicy}).snapshot();
const context={...clone(opening),map,profile,config,counterConfig,combatPolicy,
 enableAirSupport:true,buildupPolicy,buildupAllocation:Fixture.selected,housekeepingPolicy};
const fresh=Campaign.create(context);
const nonMutating=session=>{
 const before=session.save(),snapshot=session.snapshot();
 const found=Catalog.discover({session,context});
 eq(session.save(),before,'Discovery must not mutate journal');
 eq(session.snapshot(),snapshot,'Discovery must not mutate current phase');
 return found;
};
let session=fresh;
const act=a=>{session=session.execute(a).session;};
act({type:'combat',action:{type:'finish-air-sea'}});
const preCombat=nonMutating(session);
yes(preCombat.proposals.length>=2,'Source has at least two candidate single-battle attacks');
yes(preCombat.plans.length>=1,'A validated two-battle combined declaration is available');
let plansVerified=0;
for(const plan of preCombat.plans){
 eq(plan.length,2,'Every plan has two declared battles');
 yes(plan[0].defenderHex!==plan[1].defenderHex,'Separate targets');
 yes(!plan[0].attackers.some(id=>plan[1].attackers.includes(id)),'No attacker used twice');
 const accepted=session.execute({type:'combat',action:{type:'commit-battles',battles:plan}}).session;
 eq(accepted.snapshot().combat.declaration.battles.length,2,'Authoritative two-battle commitment');
 plansVerified++;
}
const chosen=preCombat.plans[0];
const original=session.snapshot();
act({type:'combat',action:{type:'commit-battles',battles:chosen}});
const afterCommit=session.snapshot();
const restored=Campaign.restore(clone(session.save()),context);
eq(restored.snapshot(),afterCommit,'Two-battle plan persists in saved game');
eq(session.undo().session.snapshot(),original,'Combined declaration fully Undoable');
// Inspect the noncombat movement choices from the same actual opening. The
// no-battle path is legal and avoids injecting arbitrary combat outcomes.
session=fresh;
act({type:'combat',action:{type:'finish-air-sea'}});
act({type:'combat',action:{type:'commit-battles',battles:[]}});
act({type:'combat',action:{type:'finish-combat'}});
eq(session.snapshot().phaseId,'german-special-movement');
act({type:'finish-phase'});act({type:'finish-buildup'});
eq(session.snapshot().phaseId,'soviet-special-movement');
const snapshot=session.snapshot();
const catalog=nonMutating(session);
const moves=catalog.commands.filter(a=>a.type==='declare-ground-move');
const multi=moves.filter(a=>a.request.path.length>=3);
const rail=moves.filter(a=>a.request.mode==='rail');
yes(multi.length>0,'Full multi-hex routes are advertised');
yes(rail.length>0,'Source-eligible rail routes are advertised during special movement');
const binding=Binding.build(map,profile);
const byIdentity=new Map();
for(const candidate of moves){
 const request=candidate.request;
 const unit=snapshot.state.units[request.unitId];
 yes(unit.owner===snapshot.actor,'Every move belongs to acting side');
 yes(request.path[0]===unit.hex,'Every path starts at actual counter position');
 const key=[request.unitId,request.mode||'ordinary',request.path.at(-1)].join(':');
 yes(!byIdentity.has(key),'At most one representative path for each destination and mode');
 byIdentity.set(key,candidate);
 const verdict=Binding.move(binding,{kind:snapshot.phaseKind,owner:snapshot.actor},snapshot.state.units,snapshot.cursor.turn,request);
 yes(verdict.ok,'Adjudicator certifies each route including multi-hex paths');
 eq(verdict.to,request.path.at(-1));
 const attempted=session.execute(candidate).session;
 eq(attempted.snapshot().pendingGround,request,'Exactly this path is committed before resolution');
}
// The representative-destination set should match the existing fully
// source-validated graph search (for each owner/mode) without omissions.
let expected=0;
for(const u of Object.values(snapshot.state.units).filter(u=>u.owner===snapshot.actor)){
 const modes=[null,...(u.class==='infantry'?['rail']:[])];
 for(const mode of modes){
  const routes=Binding.legalRoutes(binding,{kind:snapshot.phaseKind,owner:snapshot.actor},
   snapshot.state.units,snapshot.cursor.turn,u.id,{mode,maxStates:50000});
  for(const r of routes.reachable()){
   const key=[u.id,mode||'ordinary',r.id].join(':');
   yes(byIdentity.has(key),'Every source-legal search destination is in the catalog');
   eq(byIdentity.get(key).request.path,r.path,'Catalog preserves adjudicator route');
   expected++;
  }
 }
}
eq(expected,moves.length,'All reachable destinations enumerated');
// Real multi-hex move, pending state, save/replay, execution and Undo.
const move=multi.find(a=>!rail.some(b=>b.request.unitId===a.request.unitId&&b.request.path.at(-1)===a.request.path.at(-1)))||multi[0];
const prior=session.snapshot();
act(move);
yes(!nonMutating(session).commands.some(a=>a.type==='finish-phase'),'Pending movement blocks phase completion');
fails(()=>session.execute({type:'finish-phase'}),/Unresolved movement/);
fails(()=>session.execute({type:'declare-ground-move',request:{unitId:move.request.unitId,path:[move.request.path[0],'9999']}}),/Resolve pending movement/);
eq(Campaign.restore(clone(session.save()),context).snapshot(),session.snapshot(),'Pending multi-hex movement restores');
const pending=session.snapshot();
const possibilities=nonMutating(session);
const resolve=possibilities.commands.find(a=>a.type==='resolve-ground-move');
yes(resolve,'Source-legal movement has an ordinary completion choice');
act(resolve);
eq(session.snapshot().state.units[move.request.unitId].hex,move.request.path.at(-1),'Multi-hex move changes actual unit position');
eq(session.snapshot().usedUnitIds.includes(move.request.unitId),true,'Unit marked used');
yes(!nonMutating(session).commands.some(a=>a.type==='declare-ground-move'&&a.request.unitId===move.request.unitId),'No second move in same phase');
eq(Campaign.restore(clone(session.save()),context).snapshot(),session.snapshot(),'Resolved multi-hex movement restores');
eq(session.undo().session.snapshot(),pending,'Undo restores the pending movement');
eq(session.undo().session.undo().session.snapshot(),prior,'Two-step Undo restores pre-movement state');
fails(()=>Binding.legalRoutes(binding,{kind:snapshot.phaseKind,owner:snapshot.actor},snapshot.state.units,snapshot.cursor.turn,move.request.unitId,{maxStates:1}),/search-limit-exceeded/,'Explicit path budget fails closed rather than advertising partial search');
const audit={checkpoint:157,version:'v391',assertions:checks,
 combinedPlansChecked:plansVerified,turnOneSovietMovementChoices:moves.length,
 multiHexChoices:multi.length,railModeChoices:rail.length,
 verifiedDestinationCoverage:expected,selection:'lowest-cost source-valid representative per destination per mode',
 exclusions:['Multi-unit attackers within one battle are not exhaustively enumerated',
  'Combination plans are capped at 128 and must disclose truncation',
  'All combat dice, losses and outcomes still require authoritative postcommit decisions',
  'Candidate historical counter setup remains unverified']};
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/leningrad-path-plans-v391.json',JSON.stringify(audit,null,2)+'\n');
console.log('PASS v391 '+checks+' actions, '+plansVerified+' joint plans, '+expected+' reachable destinations, '+multi.length+' multi-hex choices');
