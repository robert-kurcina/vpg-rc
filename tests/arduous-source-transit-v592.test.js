'use strict';
// Printed §§5, 8.1–8.2, 9.2, 9.5. Source counter identities and map;
// controlled test positioning. Temporary overstacked stops now legal.
const assert=require('node:assert/strict');
const B=require('../core/movement_binding'),M=require('../core/movement_rules'),LP=require('../core/legal_pathfinding');
const Deployment=require('../core/historical_deployment_session'),Inventory=require('../core/historical_source_face_inventory'),Campaign=require('../core/historical_campaign_session'),Catalog=require('../core/historical_campaign_action_catalog');
const map=require('../maps/arduous.json'),profile=require('../maps/movement-configs/arduous.json'),config=require('../maps/phase-configs/arduous.json'),setupSpec=require('../maps/setup/arduous.json'),counterConfig=require('../maps/counter-configs/arduous.json'),fixedPolicy=require('../maps/setup/arduous-fixed-pieces.json'),combatPolicy=require('../maps/combat-configs/arduous.json'),buildupPolicy=require('../maps/buildup-configs/arduous.json'),housekeepingPolicy=require('../maps/housekeeping-configs/arduous.json');
const f=require('./fixtures/arduous-source-setup-v419');
const groups=setupSpec.concealedSetup.groups;
let deployment=Deployment.create({map,setupSpec,counterConfig,inventory:Inventory.create(require('../maps/setup/arduous-inventory.json')),phaseConfig:config,movementProfile:profile,fixedPolicy,allocation:f.allocation,placements:f.placements});
deployment=deployment.permute(groups,groups.flatMap(g=>f.allocation[g]).slice().reverse());
const committed=deployment.commit({requireMixed:true});
const opening={...committed.opening,map,profile,config,counterConfig,combatPolicy,enableAirSupport:true,buildupPolicy,buildupAllocation:committed.allocation,housekeepingPolicy,fixedPolicy};
const original=Campaign.create(opening).snapshot().state;
const binding=B.build(map,profile),board=binding.board;
const adj=h=>board.edges.filter(e=>(e.a===h||e.b===h)&&!e.impassable&&!e.allSea&&!e.lake).map(e=>e.a===h?e.b:e.a);
let n=0;const eq=(a,b,m)=>{assert.deepEqual(a,b,m);n++};const ok=(x,m)=>{assert.ok(x,m);n++};
const g=Object.values(original.units).filter(u=>u.owner==='german'&&u.class==='infantry');const su=Object.values(original.units).filter(u=>u.owner==='soviet'&&u.size==='army');
const ctx=(units,owner='german',kind='movement',turn=2,p=profile)=>({profile:p,board,units:Object.fromEntries(units.map(u=>[u.id,u])),phase:{owner,kind},turn});
const old={...profile};delete old.allowFriendlyOverstackTransit;delete old.allowTemporaryMovementOverstack;
// Find a route on the actual board whose legal endpoint disappears from the
// old catalogue when every reachable prefix is full or unaffordable.
let stackFixture;
for(const a of Object.keys(board.cells)){
 for(const b of adj(a))for(const c of adj(b)){
  if(c===a||adj(a).includes(c))continue;
  const units=[{...g[0],hex:a},{...g[1],hex:b},{...g[2],hex:b}];
  const q=ctx(units),r={unitId:g[0].id,path:[a,b,c]};
  if(!M.move(q,r).ok)continue;
  if(LP.search(ctx(units,'german','movement',2,old),{unitId:g[0].id}).pathTo(c)!==null)continue;
  stackFixture={a,b,c,units};break;
 }if(stackFixture)break;
}
ok(stackFixture,'actual-map regression witness');const {a,b,c,units}=stackFixture;
const q=ctx(units);ok(M.move(q,{unitId:g[0].id,path:[a,b]}).ok);ok(M.move(q,{unitId:g[0].id,path:[a,b,c]}).ok);ok(M.transit(q,{unitId:g[0].id,path:[a,b]}).ok);ok(LP.search(q,{unitId:g[0].id}).pathTo(b));ok(LP.search(q,{unitId:g[0].id}).pathTo(c),'catalogue discovers through-stack destination');
// Check actual campaign catalogue, commitment, phase completion and replay.
function continuation(units,owner,phase,turn=2,state=original){return {...opening,state:{...structuredClone(state),units:Object.fromEntries(units.map(u=>[u.id,u]))},actor:owner,cursor:{scenarioId:'arduous',turn,index:config.phases.findIndex(p=>p.id===phase),complete:false}};}
const sc=continuation(units,'german','german-movement');let s=Campaign.create(sc);const initial=s.snapshot();const actions=Catalog.discover({session:s,context:sc}).commands;
const move=actions.find(x=>x.type==='declare-ground-move'&&x.request.unitId===g[0].id&&x.request.path.at(-1)===c);ok(move);ok(actions.some(x=>x.type==='declare-ground-move'&&x.request.unitId===g[0].id&&x.request.path.at(-1)===b));
eq(s.canExecute({type:'declare-ground-move',request:{unitId:g[0].id,path:[a,b]}}),true);
s=s.execute(move).session;s=s.execute({type:'resolve-ground-move'}).session;eq(s.snapshot().state.units[g[0].id].hex,c);eq(s.snapshot().state.units[g[1].id].hex,b);eq(s.snapshot().state.units[g[2].id].hex,b);eq(Campaign.restore(s.save(),sc).snapshot(),s.snapshot());eq(s.undo().session.undo().session.snapshot(),initial);s=s.execute({type:'finish-phase'}).session;eq(s.snapshot().phaseId,'german-combat');
// §5: city pass-through capture and opposing recapture with no counter left there.
let cityFixture;
for(const city of map.cells.filter(x=>x.city))for(const x of adj(city.id))for(const z of adj(city.id)){
 if(x===z)continue;
 const u={...g[0],hex:x},v={...su[0],hex:z};
 if(M.move(ctx([u]),{unitId:u.id,path:[x,city.id,z]}).ok&&M.move(ctx([v],'soviet'),{unitId:v.id,path:[z,city.id,x]}).ok&&!cityFixture)cityFixture={city,x,z,u,v};
}
ok(cityFixture);const {city,x,z,u,v}=cityFixture;
const gc=continuation([u],'german','german-movement');s=Campaign.create(gc);eq(s.snapshot().state.cityControl[city.city.name],'soviet');
function commit(s,id,path){s=s.execute({type:'declare-ground-move',request:{unitId:id,path}}).session;return s.execute({type:'resolve-ground-move'}).session;}
s=commit(s,u.id,[x,city.id,z]);const captured=s.snapshot();eq(captured.state.units[u.id].hex,z);eq(captured.state.cityControl[city.city.name],'german');ok(!Object.values(captured.state.units).some(u=>u.hex===city.id));eq(Campaign.restore(s.save(),gc).snapshot(),captured);eq(s.undo().session.snapshot().state.cityControl[city.city.name],'soviet');
const rc=continuation([v],'soviet','soviet-movement',2,captured.state);s=commit(Campaign.create(rc),v.id,[z,city.id,x]);eq(s.snapshot().state.cityControl[city.city.name],'soviet');eq(s.snapshot().state.units[v.id].hex,x);
// §9.5: route discovery must not stop at an intermediate EZOC in Surprise Attack.
let surprise;
for(const a of Object.keys(board.cells)){
 for(const b of adj(a))for(const c of adj(b)){
  if(c===a||adj(a).includes(c))continue;
  const enemy=adj(b).find(h=>![a,c].includes(h));if(!enemy)continue;
  const us=[{...g[0],hex:a},{...su[0],hex:enemy}],q=ctx(us,'german','special-movement',1);
  if(!M.move(q,{unitId:g[0].id,path:[a,b,c]}).ok||!M.enemyZOC(q,b,'german'))continue;
  // Require all two-hop alternatives to be enemy-controlled or occupied.
  if(adj(a).some(h=>adj(h).includes(c)&&h!==enemy&&!M.enemyZOC(q,h,'german')))continue;
  surprise={a,b,c,enemy,us};break;
 }if(surprise)break;
}
ok(surprise);const sp=ctx(surprise.us,'german','special-movement',1);ok(LP.search(sp,{unitId:g[0].id}).pathTo(surprise.c),'Surprise catalogue discovers beyond EZOC');eq(M.move(ctx(surprise.us,'german','movement',1),{unitId:g[0].id,path:[surprise.a,surprise.b,surprise.c]}).reason,'ezoc-stops-movement');
console.log('PASS Arduous source transit',n,'assertions',JSON.stringify({stack:[a,b,c],city:city.city.name,route:[x,city.id,z],surprise:[surprise.a,surprise.b,surprise.c,surprise.enemy]}));
// v655: printed end-of-phase penalty, not immediate movement rejection.
const Human=require('../core/historical_campaign_human'),AI=require('../core/historical_campaign_autoplay');
const stop={type:'declare-ground-move',request:{unitId:g[0].id,path:[a,b]}},finish={type:'finish-phase'};
const over=commit(Campaign.create(sc),g[0].id,[a,b]);
const remove=id=>({type:'remove-overstack-unit',unitId:id});
const count=(ss,h)=>Object.values(ss.snapshot().state.units).filter(u=>u.hex===h).length;
eq(count(over,b),3);eq(over.snapshot().stackingCleanup,undefined);eq(over.canExecute(remove(g[0].id)),false);
eq(Catalog.discover({session:over,context:sc}).stackPenalty,1);
// A second formation can vacate, ending the phase without a loss.
const resolved=commit(over,g[1].id,[b,c]);eq(count(resolved,b),2);eq(resolved.execute(finish).session.snapshot().phaseId,'german-combat');
eq(Object.keys(resolved.snapshot().state.units).length,3);
const locked=over.execute(finish).session;eq(locked.snapshot().stackingCleanup,true);eq(locked.snapshot().phaseId,'german-movement');
eq(locked.canExecute(finish),false);eq(locked.canExecute({type:'declare-ground-move',request:{unitId:g[1].id,path:[b,c]}}),false);
eq(locked.canExecuteGroundBatch([{type:'declare-ground-move',request:{unitId:g[1].id,path:[b,c]}}]),[false]);
eq(locked.canExecute(remove('nonexistent')),false);eq(Campaign.restore(locked.save(),sc).snapshot(),locked.snapshot());eq(locked.undo().session.snapshot(),over.snapshot());
const choices=Catalog.discover({session:locked,context:sc});eq(choices.stackPenalty,1);eq(choices.commands.map(x=>x.unitId).sort(),g.slice(0,3).map(x=>x.id).sort());
for(const choice of choices.commands){
 const h=Human.create({session:locked,context:sc});const next=h.choose(choice);ok(!next.snapshot().state.units[choice.unitId]);eq(next.snapshot().stackingCleanup,true);
 eq(next.view().commands,[finish]);eq(Human.restore(next.save(),sc).snapshot(),next.snapshot());eq(next.undo().session.snapshot(),locked.snapshot());
 const ended=next.choose(finish);eq(ended.snapshot().phaseId,'german-combat');eq(ended.snapshot().stackingCleanup,undefined);eq(Object.keys(ended.snapshot().state.units).length,2);
}
// Legacy campaign scope hashes remain readable when every journal state replays exactly.
const previousProfile={...profile};delete previousProfile.allowTemporaryMovementOverstack;
const legacyContext={...sc,profile:previousProfile};let legacy=commit(Campaign.create(legacyContext),g[0].id,[a,b,c]);
eq(Campaign.restore(legacy.save(),sc).snapshot(),legacy.snapshot());
eq(Campaign.create(legacyContext).canExecute(stop),false);
// Soviet Army exception: three units (two armies, one corps) can be repaired
// with one loss; removing the corps would demand a second unnecessary loss.
const sovietCorps=Object.values(original.units).find(u=>u.owner==='soviet'&&u.size==='corps');ok(sovietCorps);
const sov=continuation([{...su[0],hex:a},{...su[1],hex:b},{...sovietCorps,hex:b}],'soviet','soviet-movement');
const armyOver=commit(Campaign.create(sov),su[0].id,[a,b]);const armyLocked=armyOver.execute(finish).session;
eq(Catalog.discover({session:armyLocked,context:sov}).commands.map(x=>x.unitId).sort(),su.slice(0,2).map(x=>x.id).sort());
eq(armyLocked.canExecute(remove(sovietCorps.id)),false);eq(armyLocked.canExecute(remove(g[0].id)),false);
const armyClean=armyLocked.execute(remove(su[1].id)).session;eq(count(armyClean,b),2);eq(armyClean.execute(finish).session.snapshot().phaseId,'housekeeping');
// Two excess formations across two separate hexes and multiple losses in one
// hex remain mandatory; support markers do not count as ground formations.
const multi=[...g.slice(0,4).map(u=>({...u,hex:b})),...su.slice(0,2).map(u=>({...u,hex:c})),{id:'marker',owner:'german',hex:b,marker:true}];
eq(M.stackPenalty(profile,multi,'german').excess,2);eq(M.stackPenalty(profile,multi,'soviet').excess,1);eq(M.stackPenalty(profile,multi,'german').choices.length,4);
// Diagnostic AI avoids creating excess and prioritizes redistribution when
// possible; when already locked, it selects a real owner removal.
const first=AI.decide({session:Campaign.create(sc),context:sc});ok(first.status==='action');
if(first.action.type==='declare-ground-move')ok(first.action.request.path.at(-1)!==b||first.action.request.path[0]===b);
const relief=AI.decide({session:over,context:sc,policy:{maxGroundMovesPerPhase:2}});eq(relief.reason,'resolve-temporary-overstack-before-phase-end');eq(relief.action.type,'declare-ground-move');eq(relief.action.request.path[0],b);
const forced=AI.decide({session:locked,context:sc});eq(forced.action.type,'remove-overstack-unit');ok(locked.canExecute(forced.action));
const aiClean=locked.execute(forced.action).session;eq(AI.decide({session:aiClean,context:sc}).action,finish);
console.log('PASS Arduous temporary overstacking and owner removal, cumulative',n,'assertions');
