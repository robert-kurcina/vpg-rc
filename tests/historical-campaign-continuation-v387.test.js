'use strict';
/* Source-bound integration assertions for consecutive historical phases.
 * Intentionally refuses Soviet buildup, reinforcement and housekeeping,
 * which are not yet certified runnable game phases. */
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const Campaign=require('../core/historical_campaign_session');
const Bridge=require('../core/scenario_opening_bridge');
const Binding=require('../core/movement_binding');
const Phase=require('../core/phase_runtime');
const Port=require('../core/historical_port_support');
const M=require('../maps/leningrad.json'),K=require('../maps/counter-configs/leningrad.json');
const S=require('../maps/setup/leningrad.json'),P=require('../maps/movement-configs/leningrad.json');
const F=require('../maps/phase-configs/leningrad.json'),Q=require('../maps/combat-configs/leningrad.json');
const I=require('../core/leningrad_starting_inventory'),fixture=require('./fixtures/leningrad-source-setup-v357');
const copy=v=>JSON.parse(JSON.stringify(v));let n=0;
const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);n++};
const yes=(v,msg)=>{assert.ok(v,msg);n++};
const fail=(f,re)=>{assert.throws(f,re);n++};
const opening=Bridge.create({map:M,setupSpec:S,counterConfig:K,inventory:I,allocation:fixture.selected,
 placements:fixture.placements,phaseConfig:F,movementProfile:P,phaseFactories:{combat:()=>({})},supportPolicy:Q}).snapshot();
const source=(origin,air=true)=>({map:M,profile:P,config:F,counterConfig:K,
 combatPolicy:Q,enableAirSupport:air,...copy(origin)});
function run(session,action){return session.execute(action).session;}
// Independent sorted-JSON oracle: the committed hash must still be that of
// the public snapshot, not merely agree with the revised replay implementation.
function stable(x){return Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;}
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(stable(x))).digest('hex');
function restored(session,ctx){
 const envelope=session.save(),revived=Campaign.restore(copy(envelope),ctx);
 const expected=digest(session.snapshot());
 eq(envelope.finalStateHash,expected,'final hash matches independent public snapshot oracle');
 if(envelope.journal.length)eq(envelope.journal.at(-1).stateHash,expected,'journal hash matches independent public snapshot oracle');
 eq(revived.snapshot(),session.snapshot(),'checkpoint continuation snapshot');
 eq(revived.save(),envelope,'checkpoint replay preserves exact save');
 return revived;
}
const original=copy(opening),ctx=source(original);
let s=Campaign.create(ctx),steps=[];
eq(s.snapshot().phaseId,'german-combat');eq(s.snapshot().actionCount,0);
fail(()=>s.execute({type:'finish-phase'}),/Only source-backed combat/);
fail(()=>s.execute({type:'combat',action:{type:'finish-combat'}}),/completion requires/);
function action(a){s=run(s,a);steps.push(copy(s.snapshot()));restored(s,ctx);return s;}
action({type:'combat',action:{type:'finish-air-sea'}});
action({type:'combat',action:{type:'commit-battles',battles:[]}});
eq(s.snapshot().combat.status,'no-battles-declared');
action({type:'combat',action:{type:'finish-combat'}});
eq(s.snapshot().phaseId,'german-special-movement');eq(s.snapshot().actor,'german');
// Find a real source-legal opening German special-movement adjacency.
const board=Binding.build(M,P),cur=s.snapshot(),phase=Phase.current(F,cur.cursor);
const choices=[];
for(const unit of Object.values(cur.state.units).filter(u=>u.owner==='german')){
 for(const edge of board.board.edges.filter(e=>e.a===unit.hex||e.b===unit.hex)){
  const req={unitId:unit.id,path:[unit.hex,edge.a===unit.hex?edge.b:edge.a]};
  if(Binding.move(board,phase,cur.state.units,cur.cursor.turn,req).ok)choices.push(req);
 }
}
yes(choices.length>0,'opening offers at least one source-legal move');
const request=choices[0];
action({type:'declare-ground-move',request});
eq(s.snapshot().pendingGround,request);fail(()=>s.execute({type:'finish-phase'}),/Unresolved/);
fail(()=>s.execute({type:'resolve-forced-ground-move',die:2}),/is authorized/);
action({type:'resolve-ground-move'});
eq(s.snapshot().state.units[request.unitId].hex,request.path.at(-1));
eq(s.snapshot().usedUnitIds,[request.unitId]);
fail(()=>s.execute({type:'declare-ground-move',request}),/already used/);
action({type:'finish-phase'});
eq(s.snapshot().phaseId,'soviet-buildup');eq(s.snapshot().phaseSupported,false);
fail(()=>s.execute({type:'finish-phase'}),/not yet implemented/);
fail(()=>s.execute({type:'combat',action:{type:'commit-battles',battles:[]}}),/not yet implemented/);
restored(s,ctx);eq(opening,original,'source opening immutable');
// End-to-end undo crosses movement boundary and combat->movement boundary.
let rewind=s;
for(let i=steps.length-1;i>=0;i--){
 const u=rewind.undo();eq(u.ok,true);rewind=u.session;
 eq(rewind.snapshot(),i?steps[i-1]:Campaign.create(ctx).snapshot());
 restored(rewind,ctx);
}
eq(rewind.undo().ok,false);
// Validated real Soviet special Fleet transaction, followed by Soviet combat.
const ports=Port.create({map:M,policy:Q,counterConfig:K}).portHexes;
const fleetOrigin={cursor:{scenarioId:'leningrad',turn:2,index:5,complete:false},actor:'soviet',state:copy(original.state)};
const fleetCtx=source(fleetOrigin);
let fleet=Campaign.create(fleetCtx);
eq(fleet.snapshot().phaseId,'soviet-special-movement');
fleet=run(fleet,{type:'declare-fleet-move',to:ports.Riga});
eq(fleet.snapshot().pendingFleet,ports.Riga);
fail(()=>fleet.execute({type:'finish-phase'}),/Unresolved/);
fail(()=>fleet.execute({type:'roll-fleet-move',die:0}),/die/);
restored(fleet,fleetCtx);
fleet=run(fleet,{type:'roll-fleet-move',die:6});
eq(fleet.snapshot().state.supportMarkers.balticFleet.hex,ports.Riga);
eq(fleet.snapshot().fleetUsed,true);
fail(()=>fleet.execute({type:'declare-fleet-move',to:ports.Narva}),/not available/);
fleet=run(fleet,{type:'finish-phase'});
eq(fleet.snapshot().phaseId,'soviet-combat');eq(fleet.snapshot().combat.status,'awaiting-declarations');
fleet=run(fleet,{type:'combat',action:{type:'commit-battles',battles:[]}});
fleet=run(fleet,{type:'combat',action:{type:'finish-combat'}});
eq(fleet.snapshot().phaseId,'soviet-movement');eq(fleet.snapshot().actor,'soviet');
restored(fleet,fleetCtx);
fleet=run(fleet,{type:'finish-phase'});
eq(fleet.snapshot().phaseKind,'housekeeping');eq(fleet.snapshot().phaseSupported,false);
fail(()=>fleet.execute({type:'finish-phase'}),/not yet implemented/);
restored(fleet,fleetCtx);
// German movement to an occupied Fleet port must commit destination before
// supplying a die, preserving the same reaction in the shared movement rules.
const germ=Object.values(original.state.units).find(u=>u.owner==='german'&&u.printedCombatStrength===12);
yes(germ);
const forcedState={scenarioId:'leningrad',units:{[germ.id]:{...copy(germ),hex:'0607'}},
 supportMarkers:{balticFleet:{...copy(original.state.supportMarkers.balticFleet),hex:ports.Riga}}};
const forcedCtx=source({cursor:{scenarioId:'leningrad',turn:2,index:1,complete:false},actor:'german',state:forcedState});
let forced=Campaign.create(forcedCtx);
const forcedReq={unitId:germ.id,path:['0607',ports.Riga]};
forced=run(forced,{type:'declare-ground-move',request:forcedReq});
fail(()=>forced.execute({type:'resolve-ground-move'}),/Precommit forced Fleet/);
fail(()=>forced.execute({type:'resolve-forced-ground-move',die:2}),/Precommit forced Fleet/);
fail(()=>forced.execute({type:'commit-forced-port',to:ports.Riga}),/Invalid forced Fleet/);
forced=run(forced,{type:'commit-forced-port',to:ports.Narva});
eq(forced.snapshot().pendingPort,ports.Narva);restored(forced,forcedCtx);
fail(()=>forced.execute({type:'resolve-forced-ground-move',die:7}),/Precommit forced Fleet/);
forced=run(forced,{type:'resolve-forced-ground-move',die:2});
eq(forced.snapshot().state.units[germ.id].hex,ports.Riga);
eq(forced.snapshot().state.supportMarkers.balticFleet.hex,ports.Narva);
eq(forced.snapshot().state.supportMarkers.balticFleet.condition,'damaged');
restored(forced,forcedCtx);
eq(forced.undo().session.snapshot().pendingPort,ports.Narva);
// A missing Fleet does not demand a ghost damage roll.
const noMarker=copy(forcedState);delete noMarker.supportMarkers;
const absentCtx=source({...forcedCtx, state:noMarker});
let absent=Campaign.create(absentCtx);
absent=run(absent,{type:'declare-ground-move',request:forcedReq});
fail(()=>absent.execute({type:'commit-forced-port',to:ports.Narva}),/Invalid forced Fleet/);
absent=run(absent,{type:'resolve-ground-move'});
eq(absent.snapshot().state.units[germ.id].hex,ports.Riga);
// No remaining destination: the shared rule eliminates the Fleet on enemy
// entry without inventing a damage roll, and Undo restores the marker.
const otherPorts=Object.entries(ports).filter(([name])=>name!=='Riga');
const others=Object.values(original.state.units).filter(u=>u.owner==='german'&&u.id!==germ.id);
yes(others.length>=otherPorts.length);
const blockedState=copy(forcedState);
otherPorts.forEach(([name,hex],i)=>blockedState.units[others[i].id]={...copy(others[i]),hex});
const blockedCtx=source({...forcedCtx,state:blockedState});
let blocked=Campaign.create(blockedCtx);
blocked=run(blocked,{type:'declare-ground-move',request:forcedReq});
fail(()=>blocked.execute({type:'commit-forced-port',to:ports.Narva}),/Invalid forced Fleet/);
blocked=run(blocked,{type:'resolve-ground-move'});
eq(blocked.snapshot().state.supportMarkers.balticFleet,undefined);
eq(blocked.snapshot().lastEvent.fleetDisplacement.reason,'no-available-port');
eq(blocked.undo().session.snapshot().state.supportMarkers.balticFleet.hex,ports.Riga);
restored(blocked,blockedCtx);
// Uncommitted Fleet damage dice cannot be supplied during ground movement.
fail(()=>blocked.execute({type:'roll-fleet-move',die:6}),/Commit Fleet destination before its die/);
// Source, opening, action and checksum validation are independent.
const saved=s.save();
fail(()=>Campaign.restore(saved,{...ctx,profile:{...copy(P),maxStack:88}}),/source\/configuration mismatch/);
fail(()=>Campaign.restore(saved,{...ctx,state:{...copy(original.state),units:{}}}),/opening state mismatch/);
const tampered=copy(saved);tampered.journal[0].action.action.type='finish-combat';
fail(()=>Campaign.restore(tampered,ctx),/checksum mismatch/);
function resign(e){
 const {integrity,...payload}=e;
 e.integrity.digest=digest(payload);return e;
}
fail(()=>Campaign.restore(resign(tampered),ctx),/completion requires/);
const tamperedHash=copy(saved);tamperedHash.journal[0].stateHash='0'.repeat(64);
fail(()=>Campaign.restore(resign(tamperedHash),ctx),/replay mismatch/);
const tamperedFinal=copy(saved);tamperedFinal.finalStateHash='0'.repeat(64);
fail(()=>Campaign.restore(resign(tamperedFinal),ctx),/final replay mismatch/);
// The faster canonicalizer must not relax validation of untrusted saves.
for(const key of ['__proto__','prototype','constructor']){
 const bad=copy(saved);Object.defineProperty(bad.origin.state,key,{value:1,enumerable:true});
 fail(()=>Campaign.restore(bad,ctx),/Forbidden campaign save key/);
}
const cyclic=copy(saved);cyclic.origin.state.loop=cyclic;
fail(()=>Campaign.restore(cyclic,ctx),/Cyclic campaign save value/);
const sparse=copy(saved);delete sparse.journal[0];
fail(()=>Campaign.restore(sparse,ctx),/Sparse campaign save array/);
const nonFinite=copy(saved);nonFinite.origin.state.invalid=Infinity;
fail(()=>Campaign.restore(nonFinite,ctx),/Unsupported campaign save value/);
fail(()=>s.execute({type:'finish-phase',extra:true}),/fields/);
fail(()=>Campaign.create({...ctx,actor:'soviet'}),/opening must be a player phase/);
const audit={checkpoint:153,version:'v387',assertions:n,scope:'source-bound consecutive-phase journal',
 verified:['Real Leningrad opening German combat -> German special ground movement -> blocked Soviet buildup',
 'Fleet special movement -> Soviet combat -> Soviet movement using a separately trusted origin',
 'Ground entry into Fleet port requires committed displacement destination before die',
 'Cross-phase Undo, replay, source hashes, checksum and in-progress save restoration',
 'All five games retain one shared B4M CRT; no graphics/rules changed'],
 limitations:['Not a complete eight-turn campaign','No implementation of buildup/reinforcement/housekeeping',
  'Synthetic post-buildup Fleet boundary is not a certified historical game history',
  'No player-facing UX integration; no proof of source-coordinate reconciliation']};
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/leningrad-campaign-continuation-v387.json',JSON.stringify(audit,null,2)+'\n');
console.log('PASS v387',n,'consecutive-phase historical campaign continuation assertions');
