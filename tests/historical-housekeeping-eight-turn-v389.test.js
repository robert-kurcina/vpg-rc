'use strict';
/* Checkpoint 155: fully journaled no-combat eight-turn trajectory + literal
 * rules-based victory boundaries. No historical military victory is claimed. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Phase=require('../core/phase_runtime');
const Campaign=require('../core/historical_campaign_session');
const Housekeeping=require('../core/historical_housekeeping_phase');
const Buildup=require('../core/historical_buildup_phase');
const Bridge=require('../core/scenario_opening_bridge');
const Inventory=require('../core/leningrad_starting_inventory');
const Fixture=require('./fixtures/leningrad-source-setup-v357');
const map=require('../maps/leningrad.json'),counterConfig=require('../maps/counter-configs/leningrad.json');
const setup=require('../maps/setup/leningrad.json'),profile=require('../maps/movement-configs/leningrad.json');
const config=require('../maps/phase-configs/leningrad.json'),combatPolicy=require('../maps/combat-configs/leningrad.json');
const buildupPolicy=require('../maps/buildup-configs/leningrad.json');
const housekeepingPolicy=require('../maps/housekeeping-configs/leningrad.json');
const clone=x=>JSON.parse(JSON.stringify(x));let checks=0;
const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++};
const yes=(v,msg)=>{assert.ok(v,msg);checks++};
const fail=(fn,pattern)=>{assert.throws(fn,pattern);checks++};
const origin=Bridge.create({map,setupSpec:setup,counterConfig,inventory:Inventory,
 allocation:Fixture.selected,placements:Fixture.placements,phaseConfig:config,
 movementProfile:profile,phaseFactories:{combat:()=>({})},supportPolicy:combatPolicy}).snapshot();
const ctx={...clone(origin),map,profile,config,counterConfig,combatPolicy,
 enableAirSupport:true,buildupPolicy,buildupAllocation:Fixture.selected,housekeepingPolicy};
const score=Housekeeping.create({map,config,policy:housekeepingPolicy,
 initialCityControl:buildupPolicy.initialCityControl,
 communicated:Buildup.create({map,profile,config,counterConfig,policy:buildupPolicy,
  allocation:Fixture.selected}).communicated});
const cityNames=Object.keys(buildupPolicy.initialCityControl);
eq(cityNames.length,14);eq(housekeepingPolicy.draw.axisCityCount,13);
eq(config.phases.at(-1).id,'housekeeping');eq(Phase.start(config).index,2);
const state=Campaign.create(ctx).snapshot().state;
const atCount=(n,leave=null)=>{
 const v=clone(state);
 for(const name of cityNames)v.cityControl[name]='soviet';
 let targets=cityNames.filter(name=>name!==leave);
 if(leave===null)targets=cityNames;
 targets.slice(0,n).forEach(name=>v.cityControl[name]='german');
 return v;
};
let all=atCount(14);
eq(score.evaluate(all).outcome,'german-victory');
eq(score.evaluate(all).axisControlledCount,14);
let twelve=atCount(12);
eq(score.evaluate(twelve).outcome,'soviet-victory');
eq(score.evaluate(twelve).axisControlledCount,12);
let thirteen=atCount(13,'Leningrad');
yes(score.evaluate(thirteen).onlyRemainingCityIsolated===false,'Unblocked east edge must communicate');
eq(score.evaluate(thirteen).outcome,'unresolved-source-rule');
const isolated=clone(thirteen);
const german=Object.values(isolated.units).filter(u=>u.owner==='german');
for(let i=0;i<7;i++)german[i].hex=buildupPolicy.entryEdge.soviet[i];
yes(score.evaluate(isolated).onlyRemainingCityIsolated,'Enemy blockade makes Leningrad isolated');
eq(score.evaluate(isolated).outcome,'draw');
eq(score.evaluate(isolated).reason,'only-target-city-remains-and-isolated');
let wrong=atCount(13,'Riga');
eq(score.evaluate(wrong).outcome,'unresolved-source-rule');
eq(score.evaluate(wrong).onlyRemainingCityIsolated,null);
fail(()=>score.evaluate({...state,cityControl:{}}),/Malformed final city-control|Uninitialized/);
fail(()=>score.evaluate({...state,cityControl:{...state.cityControl,Other:'german'}}),/malformed final city-control/);
fail(()=>Housekeeping.create({map,config,policy:{...housekeepingPolicy,germanVictoryAtLeast:13},
 initialCityControl:buildupPolicy.initialCityControl}),/Housekeeping city or phase/);
fail(()=>Housekeeping.create({map,config,policy:{...housekeepingPolicy,cityCount:15},
 initialCityControl:buildupPolicy.initialCityControl}),/Housekeeping city or phase/);
fail(()=>Housekeeping.create({map,config,policy:{...housekeepingPolicy,scenarioId:'other'},
 initialCityControl:buildupPolicy.initialCityControl}),/Invalid source-bound/);
const lastCursor={scenarioId:'leningrad',turn:8,index:8,complete:false};
fail(()=>score.close({cursor:{...lastCursor,index:7},state,actor:'system'}),/Housekeeping requires/);
fail(()=>score.close({cursor:lastCursor,state,actor:'german'}),/Housekeeping requires/);
eq(score.close({cursor:lastCursor,state,actor:'system'}).terminal.outcome,'soviet-victory');
eq(score.close({cursor:{...lastCursor,turn:7},state,actor:'system'}).terminal,null);
// Preserve opt-in behavior of earlier campaign sessions without the policy.
const legacyContext={...ctx};delete legacyContext.housekeepingPolicy;
fail(()=>Campaign.create({...ctx,housekeepingPolicy:housekeepingPolicy,buildupPolicy:null,buildupAllocation:null}),/Housekeeping victory requires/);
let session=Campaign.create(ctx),totalActions=0,completedTurns=0;
const phaseTrace=[],pointSaves=[];
function commit(a){session=session.execute(a).session;totalActions++;return session.snapshot();}
function restoreAndCheck(){const saved=session.save();const revived=Campaign.restore(clone(saved),ctx);
 eq(revived.snapshot(),session.snapshot());eq(revived.save(),saved);
 fail(()=>Campaign.restore({...clone(saved),finalStateHash:'a'.repeat(64)},ctx),/checksum mismatch/);
 const changed=clone(ctx);changed.housekeepingPolicy={...housekeepingPolicy,source:[...housekeepingPolicy.source,'altered rule source binding']};
 fail(()=>Campaign.restore(saved,changed),/configuration mismatch|source configuration mismatch/);
 return saved;
}
for(let limit=0;limit<128;limit++){
 const snap=session.snapshot();if(snap.cursor.complete)break;
 phaseTrace.push(`${snap.cursor.turn}:${snap.phaseId}`);
 eq(snap.phaseSupported,true,'Every phase in opt-in eight-turn sequence is runnable');
 if(snap.phaseKind==='combat'){
  if(snap.actor==='german')commit({type:'combat',action:{type:'finish-air-sea'}});
  commit({type:'combat',action:{type:'commit-battles',battles:[]}});
  commit({type:'combat',action:{type:'finish-combat'}});
 }else if(snap.phaseKind==='buildup'){
  commit({type:'finish-buildup'});
 }else if(snap.phaseKind==='movement'||snap.phaseKind==='special-movement'){
  commit({type:'finish-phase'});
 }else if(snap.phaseKind==='housekeeping'){
  fail(()=>session.execute({type:'finish-phase'}),/Only housekeeping/);
  fail(()=>session.execute({type:'finish-buildup'}),/Only housekeeping/);
  const previous=session;
  const end=commit({type:'finish-housekeeping'});
  completedTurns++;
  eq(end.lastEvent.turn,completedTurns);
  if(completedTurns<8){
   eq(end.cursor.turn,completedTurns+1);
   eq(end.phaseId,'german-buildup');
   eq(end.buildup.spent,0);
   eq(end.usedUnitIds,[]);eq(end.fleetUsed,false);
   eq(end.lastEvent.kind,'turn-completed');
  }else{
   eq(end.cursor.complete,true);eq(end.phaseId,null);
   eq(end.lastEvent.kind,'campaign-completed');
   eq(end.terminal.outcome,'soviet-victory');
   eq(end.terminal.axisControlledCount,1);
   fail(()=>session.execute({type:'finish-housekeeping'}),/already complete/);
  }
  // Every housekeeping transition can be Undone exactly, even at Turn 8.
  eq(session.undo().session.snapshot(),previous.snapshot());
  if([1,3,6,8].includes(completedTurns))pointSaves.push(restoreAndCheck());
 }else throw Error('Unsupported phase '+snap.phaseId);
}
eq(completedTurns,8);eq(phaseTrace.length,70);
eq(phaseTrace[0],'1:german-combat');eq(phaseTrace.at(-1),'8:housekeeping');
eq(session.snapshot().cursor.complete,true);
eq(session.snapshot().actor,'system');
eq(session.snapshot().phaseSupported,false);
eq(session.snapshot().terminal.cityControl.Insterburg,'german');
eq(Object.keys(session.snapshot().terminal.cityControl).length,14);
fail(()=>session.execute({type:'combat',action:{type:'finish-combat'}}),/already complete/);
const saved=session.save();
eq(Campaign.restore(clone(saved),ctx).save(),saved);
const foreign=clone(ctx);foreign.state=clone(ctx.state);foreign.state.units[Object.keys(foreign.state.units)[0]].hex='0101';
fail(()=>Campaign.restore(saved,foreign),/opening state mismatch/);
// Final victory must not be computed until the last housekeeping.
let early=Campaign.create(ctx);for(const a of [
 {type:'combat',action:{type:'finish-air-sea'}},
 {type:'combat',action:{type:'commit-battles',battles:[]}},
 {type:'combat',action:{type:'finish-combat'}}])early=early.execute(a).session;
eq(early.snapshot().terminal,undefined);
// A second, nontrivial legal-action history: source-legal ground move,
// voluntary Fleet movement, scheduled Militia and regular reinforcements,
// per-turn FK I attacks, and Turn 6 FK VIII air marker availability.
const Binding=require('../core/movement_binding');
const Ports=require('../core/historical_port_support');
const board=Binding.build(map,profile);
const portHexes=Ports.create({map,policy:combatPolicy,counterConfig}).portHexes;
const fkI=combatPolicy.airSupport.markers.find(x=>x.firstTurn===1).faceId;
const fkVIII=combatPolicy.airSupport.markers.find(x=>x.firstTurn===6).faceId;
let real=Campaign.create(ctx),testedMove=false,testedFleet=false,testedMilitia=false,
 testedAxisReinforcement=false,testedSovietReinforcement=false,attackTurns=[];
const realAction=a=>{real=real.execute(a).session;};
function firstLegalGroundMove(snap){
 const ph=Phase.current(config,snap.cursor);
 for(const unit of Object.values(snap.state.units).filter(u=>u.owner===snap.actor)){
  for(const edge of board.board.edges.filter(e=>e.a===unit.hex||e.b===unit.hex)){
   const req={unitId:unit.id,path:[unit.hex,edge.a===unit.hex?edge.b:edge.a]};
   if(Binding.move(board,ph,snap.state.units,snap.cursor.turn,req).ok)return req;
  }
 }
 return null;
}
function firstLegalReinforcement(snap){
 const target=buildupPolicy.reinforcements.find(x=>x.owner===snap.actor&&x.turn===snap.cursor.turn&&x.placement==='edge');
 if(!target)return null;
 for(const hex of buildupPolicy.entryEdge[snap.actor]){
  const action={type:'place-reinforcement',slotId:target.slotId,hex};
  try{real.execute(action);return action;}catch(_e){}
 }
 return null;
}
for(let limit=0;limit<90;limit++){
 const snap=real.snapshot();if(snap.cursor.complete)break;
 if(snap.phaseKind==='combat'){
  if(snap.actor==='german'){
   if([2,3,6].includes(snap.cursor.turn)){
    const faceId=snap.cursor.turn===6?fkVIII:fkI;
    realAction({type:'combat',action:{type:'declare-fleet-attack',faceId}});
    realAction({type:'combat',action:{type:'roll-fleet-attack',die:6}});
    attackTurns.push(snap.cursor.turn);
   }
   realAction({type:'combat',action:{type:'finish-air-sea'}});
  }
  realAction({type:'combat',action:{type:'commit-battles',battles:[]}});
  realAction({type:'combat',action:{type:'finish-combat'}});
 }else if(snap.phaseKind==='buildup'){
  if(snap.cursor.turn===3&&snap.actor==='soviet'){
   const militia=buildupPolicy.reinforcements.find(x=>x.turn===3);
   realAction({type:'place-reinforcement',slotId:militia.slotId,hex:'1701'});
   testedMilitia=true;
  }
  if(snap.cursor.turn===4){
   const choice=firstLegalReinforcement(real.snapshot());
   if(choice){realAction(choice);if(snap.actor==='german')testedAxisReinforcement=true;
    else testedSovietReinforcement=true;}
  }
  realAction({type:'finish-buildup'});
 }else if(snap.phaseKind==='movement'||snap.phaseKind==='special-movement'){
  if(!testedMove&&snap.cursor.turn===1&&snap.phaseId==='german-special-movement'){
   const req=firstLegalGroundMove(snap);yes(req,'Opening must offer source-legal German move');
   realAction({type:'declare-ground-move',request:req});
   realAction({type:'resolve-ground-move'});testedMove=true;
  }
  if(!testedFleet&&snap.cursor.turn===1&&snap.phaseId==='soviet-special-movement'){
   realAction({type:'declare-fleet-move',to:portHexes.Riga});
   realAction({type:'roll-fleet-move',die:6});testedFleet=true;
  }
  realAction({type:'finish-phase'});
 }else if(snap.phaseKind==='housekeeping'){
  realAction({type:'finish-housekeeping'});
  if([1,3,6,8].includes(snap.cursor.turn)){
   const saved=real.save();const restored=Campaign.restore(clone(saved),ctx);
   eq(restored.snapshot(),real.snapshot());eq(restored.save(),saved);
  }
 }else throw Error('Unexpected historical phase '+snap.phaseId);
}
for(const [value,name] of [[testedMove,'ground move'],[testedFleet,'Fleet relocation'],
 [testedMilitia,'Workers militia'],[testedAxisReinforcement,'German reinforcement'],
 [testedSovietReinforcement,'Soviet reinforcement']])yes(value,name+' exercised');
eq(attackTurns,[2,3,6]);
yes(real.snapshot().cursor.complete,'Second integrated campaign reaches end of Turn 8');
eq(real.snapshot().terminal.outcome,'soviet-victory');
eq(real.snapshot().state.airUse['2'][fkI],'fleet');
eq(real.snapshot().state.airUse['3'][fkI],'fleet');
eq(real.snapshot().state.airUse['6'][fkVIII],'fleet');
eq(real.snapshot().state.supportMarkers.balticFleet.hex,portHexes.Riga);
yes(real.snapshot().state.units[Fixture.selected.sovietTurn3WorkersMilitia[0]],'Militia exists at final turn');
const audit={checkpoint:155,version:'v389',assertions:checks,fullNoActionTurnSequence:true,
 completedTurns,phaseCount:phaseTrace.length,actionCount:totalActions,phaseTrace,
 finalOutcome:session.snapshot().terminal.outcome,
 secondFullTurnSequence:true,realActionMilestones:{testedMove,testedFleet,testedMilitia,
 testedAxisReinforcement,testedSovietReinforcement,attackTurns},
 sourceRuleGap:'Axis controls 13 cities outside the precise published Leningrad isolated-draw predicate',
 sourceIdentityStatus:'candidate-supplied, not certified historical initial deployment',
 explicitNote:'Legal omissions / no declared battles are a transaction-continuity trajectory, not a historical full-play campaign or complete human UX'};
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/leningrad-housekeeping-eight-turn-v389.json',JSON.stringify(audit,null,2)+'\n');
console.log('PASS v389 '+checks+' historical housekeeping, victory and eight-turn journal assertions; '+totalActions+' source-legal actions');
