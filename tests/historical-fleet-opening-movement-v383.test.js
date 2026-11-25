'use strict';
/* Checkpoint 149: Leningrad §§6, 13.1 initial Fleet and source-bound
 * voluntary special-phase movement. These are opt-in pilot transactions,
 * not source-certified full 8-turn play or German forced displacement. */
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const Bridge=require('../core/scenario_opening_bridge'),Fleet=require('../core/historical_port_support');
const Movement=require('../core/historical_support_movement'),Phase=require('../core/phase_runtime');
const Combat=require('../core/historical_combat_phase');
const M=require('../maps/leningrad.json'),K=require('../maps/counter-configs/leningrad.json');
const S=require('../maps/setup/leningrad.json'),P=require('../maps/movement-configs/leningrad.json');
const F=require('../maps/phase-configs/leningrad.json'),Q=require('../maps/combat-configs/leningrad.json');
const I=require('../core/leningrad_starting_inventory'),fixture=require('./fixtures/leningrad-source-setup-v357');
const copy=x=>JSON.parse(JSON.stringify(x));let checks=0;
const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++};
const yes=(x,msg)=>{assert.ok(x,msg);checks++};
const bad=(fn,re)=>{assert.throws(fn,re);checks++};
function opening(supportPolicy){return Bridge.create({map:M,setupSpec:S,counterConfig:K,inventory:I,
 allocation:fixture.selected,placements:fixture.placements,phaseConfig:F,movementProfile:P,
 phaseFactories:{combat:()=>({snapshot:()=>({})})},supportPolicy}).snapshot();}
const plain=opening(undefined),started=opening(Q),port=Fleet.create({map:M,policy:Q,counterConfig:K});
const ports=port.portHexes,key=port.markerKey;
eq(Object.keys(started.state.units).length,19);
eq(started.state.units,plain.state.units,'Fleet does not change ground-unit identities/positions');
eq(Object.keys(plain.state).sort(),['scenarioId','units']);
eq(started.state.supportMarkers[key],{hex:ports.Leningrad,condition:'undamaged',owner:'soviet',
 sourceFaceId:Q.portSupport.sourceFaceId,reverseFaceId:Q.portSupport.reverseFaceId});
eq(started.cursor,plain.cursor);eq(started.actor,plain.actor);
eq(port.validateMarker(started.state,true),started.state.supportMarkers[key]);
const realOpening=Bridge.create({map:M,setupSpec:S,counterConfig:K,inventory:I,
 allocation:fixture.selected,placements:fixture.placements,phaseConfig:F,movementProfile:P,
 phaseFactories:{combat:ctx=>Combat.create({...ctx,counterConfig:K,combatPolicy:Q})},supportPolicy:Q});
eq(realOpening.controller().snapshot().state.supportMarkers[key],started.state.supportMarkers[key]);
bad(()=>Bridge.create({map:M,setupSpec:S,counterConfig:K,inventory:I,
 allocation:fixture.selected,placements:fixture.placements,phaseConfig:F,movementProfile:P,
 phaseFactories:{combat:()=>({})},supportPolicy:{}}),/support marker policy/);
bad(()=>port.initialize({state:started.state}),/uninitialized/);
bad(()=>port.initialize({state:{...plain.state,scenarioId:'wrong'}}),/uninitialized/);
bad(()=>port.initialize({state:{...plain.state,supportMarkers:{}}}),/uninitialized/);
const savedStart=copy(started.state);port.initialize({state:plain.state});eq(started.state,savedStart);
const enemy=copy(started.state),anEnemy=Object.values(enemy.units).find(u=>u.owner==='german');
anEnemy.hex=ports.Riga;
bad(()=>port.validateDestination({state:enemy,to:ports.Riga}),/enemy-occupied/);
const enemyOrigin=copy(started.state);Object.values(enemyOrigin.units).find(u=>u.owner==='german').hex=ports.Leningrad;
bad(()=>port.validateDestination({state:enemyOrigin,to:ports.Riga}),/requires forced displacement/);
bad(()=>port.validateDestination({state:started.state,to:ports.Leningrad}),/different registered port/);
bad(()=>port.validateDestination({state:started.state,to:'9999'}),/different registered port/);
const tampered=copy(started.state);tampered.supportMarkers[key].sourceFaceId='faked';
bad(()=>port.relocate({state:tampered,to:ports.Riga,die:6}),/uncertified/);
bad(()=>port.relocate({state:started.state,to:ports.Riga,die:0}),/six-sided/);
bad(()=>port.relocate({state:started.state,to:ports.Riga,die:7}),/six-sided/);
bad(()=>port.relocate({state:started.state,to:ports.Riga,die:1.5}),/six-sided/);
// Every source departure port against all six die faces, both conditions.
for(const [name,from] of Object.entries(ports)){
 const to=ports[name==='Leningrad'?'Riga':'Leningrad'];
 for(let die=1;die<=6;die++)for(const condition of ['undamaged','damaged']){
  const before=copy(started.state);before.supportMarkers[key].hex=from;
  before.supportMarkers[key].condition=condition;
  const keep=copy(before),result=port.relocate({state:before,to,die});
  const hit=die<=Q.portSupport.damageOnDeparture[name],destroyed=hit&&condition==='damaged';
  eq(result.event.fromPort,name);eq(result.event.die,die);eq(result.event.damageThreshold,Q.portSupport.damageOnDeparture[name]);
  eq(result.event.hit,hit);eq(result.event.resultCondition,destroyed?'eliminated':hit?'damaged':condition);
  eq(result.state.supportMarkers[key]?.hex, destroyed?undefined:to);
  eq(result.state.supportMarkers[key]?.condition,destroyed?undefined:hit?'damaged':condition);
  eq(result.state.units,keep.units);eq(before,keep,'no input mutation');
 }
}
// Explicit phase gate. No hidden phase skipping or zero-turn start hack.
const sovietSpecial=F.phases.findIndex(p=>p.owner==='soviet'&&p.kind==='special-movement');
yes(sovietSpecial>=0);
const cursor={...Phase.start(F),index:sovietSpecial};
const pilot=Movement.factory({map:M,policy:Q,counterConfig:K,phaseConfig:F});
const first=pilot.create({cursor,actor:'soviet',state:started.state});
eq(first.snapshot().status,'ready');eq(first.snapshot().state,savedStart);
bad(()=>first.resolveDamage(1),/ordering/);
bad(()=>first.declareMove('9999'),/different registered port/);
bad(()=>first.declareMove(ports.Leningrad),/different registered port/);
bad(()=>pilot.create({cursor:{...cursor,index:2},actor:'soviet',state:started.state}),/owning special phase/);
bad(()=>pilot.create({cursor,actor:'german',state:started.state}),/owning special phase/);
const committed=first.declareMove(ports.Riga);
eq(committed.snapshot().status,'awaiting-damage-roll');eq(committed.snapshot().pending,ports.Riga);
eq(committed.snapshot().state,savedStart,'declaration does not apply a move or consume a die');
bad(()=>committed.finish(),/ordering/);
bad(()=>committed.declareMove(ports.Tallinn),/ordering/);
bad(()=>committed.resolveDamage(7),/six-sided/);
// Roll 2 from Leningrad inflicts one hit; destination was committed already.
const damaged=committed.resolveDamage(2),ds=damaged.snapshot();
eq(ds.status,'moved');eq(ds.state.supportMarkers[key].hex,ports.Riga);
eq(ds.state.supportMarkers[key].condition,'damaged');eq(ds.event.damageThreshold,2);
eq(ds.event.fromPort,'Leningrad');eq(ds.event.toPort,'Riga');
bad(()=>damaged.declareMove(ports.Narva),/ordering/);
bad(()=>damaged.resolveDamage(2),/ordering/);
// Undo/replay covers die outcome first, declaration second.
const u1=damaged.undo();eq(u1.ok,true);eq(u1.session.snapshot(),committed.snapshot());
const u2=u1.session.undo();eq(u2.ok,true);eq(u2.session.snapshot(),first.snapshot());
eq(committed.resolveDamage(2).snapshot(),damaged.snapshot());
const after=damaged.finish();eq(after.snapshot().status,'finished');
eq(after.snapshot().cursor.index,sovietSpecial+1);
eq(after.snapshot().state,damaged.snapshot().state);
bad(()=>after.finish(),/Invalid Fleet transaction history|ordering/);
const undoneFinish=after.undo();eq(undoneFinish.session.snapshot(),damaged.snapshot());
const restored=pilot.restoreSnapshot(copy(after.snapshot()));eq(restored.snapshot(),after.snapshot());
const falsified=copy(after.snapshot());falsified.state.supportMarkers[key].hex=ports.Narva;
bad(()=>pilot.restoreSnapshot(falsified),/does not match replay/);
const swappedRoll=copy(after.snapshot());swappedRoll.actions[1].die=6;
bad(()=>pilot.restoreSnapshot(swappedRoll),/does not match replay/);
const swappedCursor=copy(after.snapshot());swappedCursor.initial.cursor.index=2;
bad(()=>pilot.restoreSnapshot(swappedCursor),/owning special phase/);
const invalidAction=copy(after.snapshot());invalidAction.actions[0].to=ports.Leningrad;
bad(()=>pilot.restoreSnapshot(invalidAction),/different registered port/);
// Neither a zero-move phase nor safe movement requires die consumption.
const noMove=first.finish();eq(noMove.snapshot().status,'finished');
eq(noMove.snapshot().state,savedStart);eq(noMove.undo().session.snapshot(),first.snapshot());
const safe=first.declareMove(ports.Riga).resolveDamage(6);
eq(safe.snapshot().state.supportMarkers[key].condition,'undamaged');
// After a damaged Fleet relocates from Riga, 1-3 eliminates it; its marker is
// absent from combat support and no subsequent movement is legal.
const second=pilot.create({cursor:{...cursor,turn:2},actor:'soviet',state:ds.state});
const eliminated=second.declareMove(ports.Narva).resolveDamage(3);
eq(eliminated.snapshot().event.damageThreshold,3);
eq(eliminated.snapshot().event.resultCondition,'eliminated');
eq(eliminated.snapshot().state.supportMarkers[key],undefined);
bad(()=>port.relocate({state:eliminated.snapshot().state,to:ports.Tallinn,die:6}),/marker absent/);
// Reconfiguration must be explicit and the expected source face pair present.
const wrong=copy(Q);wrong.portSupport.damageOnDeparture={Leningrad:2};
bad(()=>Fleet.create({map:M,policy:wrong,counterConfig:K}),/configuration/);
const forged=copy(K);forged.faces.front=forged.faces.front.filter(f=>f.faceId!==Q.portSupport.sourceFaceId);
bad(()=>Fleet.create({map:M,policy:Q,counterConfig:forged}),/faces unverified/);
const evidence={checkpoint:149,version:'v383',source:'references/rules/leningrad-rules.pdf §§6.0 and 13.1',
 sourcePdfSha256:crypto.createHash('sha256').update(fs.readFileSync('references/rules/leningrad-rules.pdf')).digest('hex'),
 assertions:checks,registeredPorts:ports,initialPort:Q.portSupport.initialPortName,
 damageOnDeparture:Q.portSupport.damageOnDeparture,
 verified:['optional opening placement keeps all 19 ground units intact','6-port by 6-die by 2-condition matrix',
 'departure threshold not destination','no-op and enemy-occupied ports rejected','destination committed before die',
 'support move restricted to Soviet special phase','one move per phase, skip and finish',
 'damage flip and second hit elimination','Undo, restore from replayable action history, tamper rejection'],
 limitations:['Special-phase pilot is not chained through 8-turn game; saved snapshot is not production authentication',
  'German-forced port displacement and air-sea attacks not implemented',
  'Mixed-origin Fleet support and full combat-UI integration not implemented',
  'Two rear printed/source hex labels unresolved; campaign play still uncertified']};
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/leningrad-fleet-opening-movement-v383.json',JSON.stringify(evidence,null,2)+'\n');
console.log('PASS v383:',checks,'opening, port-hazard, and Fleet special-movement checks');
