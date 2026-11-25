'use strict';
/* Black Sea Fleet §§6.0(3), 15.1–15.2, 15.5 SOURCE-QUALIFIED DIAGNOSTIC.
 * This does not authorize the incomplete Kiev–Odessa historical campaign.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const Port=require('../core/historical_port_support');
const Movement=require('../core/historical_support_movement');
const Phase=require('../core/phase_runtime');
const composer=require('../maps/composer');
const map=composer.compose(require('../maps/kiev.json'),require('../maps/odessa-extension.json'));
const policy=require('../maps/combat-configs/kiev-odessa-black-sea-fleet-candidate-v517.json');
const counterConfig=require('../maps/counter-configs/odessa-extension.json');
const roster=require('../maps/roster-overlays/kiev-odessa.json');
const phaseConfig=require('../maps/phase-configs/kiev-odessa.json');
const copy=v=>JSON.parse(JSON.stringify(v));
let checks=0;
const eq=(actual,expected,desc)=>{assert.deepEqual(actual,expected,desc);checks++};
const ok=(actual,desc)=>{assert.ok(actual,desc);checks++};
const fails=(fn,match)=>{assert.throws(fn,match);checks++};
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(require('node:path').join(__dirname,'..',file))).digest('hex');
const source=policy.sourceEvidence;
eq(policy.status,'diagnostic-source-qualified-fleet-only-not-playable');
eq(source.rulesPdfSha256,sha('references/rules/odessa-rules.pdf'));
eq(source.counterFrontSha256,sha('assets/official-counters/source-sheets/counters-odessa-front.jpg'));
eq(source.counterReverseSha256,sha('assets/official-counters/source-sheets/counters-odessa-back.jpg'));
eq(source.authoritativeCells,{Odessa:'1513',Nikolaev:'1811'});
eq(policy.portSupport.portHexes,source.authoritativeCells);
eq(policy.portSupport.portNames,['Odessa','Nikolaev']);
eq(policy.portSupport.damageOnDeparture,{Odessa:1,Nikolaev:1});
const fleetSource=roster.units.filter(u=>u.designKey==='soviet-black-sea-fleet');
eq(fleetSource.length,1);eq(fleetSource[0].initial.hex,'1513');
eq(fleetSource[0].art.displayFaceId,policy.portSupport.sourceFaceId);
eq(fleetSource[0].art.alternateFaceId,policy.portSupport.reverseFaceId);
const c=Port.create({map,policy,counterConfig});
eq(c.portHexes,{Odessa:'1513',Nikolaev:'1811'});
const {markerKey}=c;eq(markerKey,'blackSeaFleet');
const units={
 'soviet-coastal-army':{owner:'soviet',hex:'1513',strengthStatus:'full'},
 'axis-infantry-corps':{owner:'german',hex:'1413',strengthStatus:'full'}
};
const plain={scenarioId:'kiev-odessa',units:copy(units),cityControl:{Odessa:'soviet',Nikolaev:'soviet'}};
const initial=c.initialize({state:plain});
eq(initial.marker,{hex:'1513',condition:'undamaged',owner:'soviet',sourceFaceId:policy.portSupport.sourceFaceId,reverseFaceId:policy.portSupport.reverseFaceId});
eq(initial.state.units,plain.units);
ok(!Object.hasOwn(plain,'supportMarkers'),'initialize never mutates input');
fails(()=>c.initialize({state:initial.state}),/uninitialized/);
const state=()=>copy(initial.state);
// Exactly one legal other port. A no-op, arbitrary hex, and enemy-occupied port fail.
fails(()=>c.validateDestination({state:state(),to:'1513'}),/different registered port/);
fails(()=>c.validateDestination({state:state(),to:'9999'}),/different registered port/);
const enemyAtOther=state();enemyAtOther.units['axis-infantry-corps'].hex='1811';
fails(()=>c.validateDestination({state:enemyAtOther,to:'1811'}),/enemy-occupied/);
const enemyAtOrigin=state();enemyAtOrigin.units['axis-infantry-corps'].hex='1513';
fails(()=>c.validateDestination({state:enemyAtOrigin,to:'1811'}),/forced displacement/);
// Both ports, all six die faces, undamaged/damaged faces: 24 source-rule outcomes.
for(const [from,to] of [['1513','1811'],['1811','1513']]){
 for(let die=1;die<=6;die++)for(const condition of ['undamaged','damaged']){
  const before=state();before.supportMarkers[markerKey].hex=from;
  before.supportMarkers[markerKey].condition=condition;
  const snapshot=copy(before),result=c.relocate({state:before,to,die});
  const damaged=die===1,dead=damaged&&condition==='damaged';
  eq(result.event.damageThreshold,1);eq(result.event.hit,damaged);
  eq(result.event.from,from);eq(result.event.to,to);eq(result.event.die,die);
  eq(result.event.resultCondition,dead?'eliminated':damaged?'damaged':condition);
  eq(result.state.supportMarkers[markerKey]?.condition,dead?undefined:damaged?'damaged':condition);
  eq(result.state.supportMarkers[markerKey]?.hex,dead?undefined:to);
  eq(result.state.units,snapshot.units);eq(before,snapshot);
 }
}
for(const die of [0,7,2.5,null,'1'])fails(()=>c.relocate({state:state(),to:'1811',die}),/six-sided/);
const badFace=state();badFace.supportMarkers[markerKey].reverseFaceId='forged';
fails(()=>c.relocate({state:badFace,to:'1811',die:2}),/uncertified/);
// A damaged fleet still protects a friendly unit from retreat, but loses its CRT shift.
const sovietBattle={defenderHex:'1513',attackers:['axis-infantry-corps'],defenders:['soviet-coastal-army']};
const defensive=c.inspect({state:state(),battle:sovietBattle,actor:'german'});
eq(defensive.fleetShift,-1);eq(defensive.ignoreRetreatEligible,true);
const damagedState=state();damagedState.supportMarkers[markerKey].condition='damaged';
const damagedDefense=c.inspect({state:damagedState,battle:sovietBattle,actor:'german'});
eq(damagedDefense.fleetShift,0);eq(damagedDefense.ignoreRetreatEligible,true);
const otherPortUnit=state();otherPortUnit.units['soviet-coastal-army'].hex='1811';
const noDefender=c.inspect({state:otherPortUnit,battle:sovietBattle,actor:'german'});
eq(noDefender.fleetShift,0);eq(noDefender.ignoreRetreatEligible,false);
const attack={defenderHex:'1413',attackers:['soviet-coastal-army'],defenders:['axis-infantry-corps']};
eq(c.inspect({state:state(),battle:attack,actor:'soviet'}).fleetShift,1);
eq(c.inspect({state:damagedState,battle:attack,actor:'soviet'}).fleetShift,0);
const noFleet=state();delete noFleet.supportMarkers[markerKey];
eq(c.inspect({state:noFleet,battle:sovietBattle,actor:'german'}).fleetShift,0);
const multiOrigin=state();multiOrigin.units['second-soviet']={owner:'soviet',hex:'1313'};
fails(()=>c.inspect({state:multiOrigin,battle:{...attack,attackers:['soviet-coastal-army','second-soviet']},actor:'soviet'}),/Mixed-origin/);
// The shared phase controller uses the actual (diagnostic-only) Odessa phase
// permission, not a test-invented authorization.
const sovietSpecial=phaseConfig.phases.findIndex(p=>p.id==='soviet-naval-operations');
ok(sovietSpecial>=0);ok(phaseConfig.phases[sovietSpecial].permissions.includes('move-support'));
const cursor={...Phase.start(phaseConfig),index:sovietSpecial};
const pilot=Movement.factory({map,policy,counterConfig,phaseConfig});
const ready=pilot.create({cursor,actor:'soviet',state:state()});
eq(ready.snapshot().status,'ready');
const committed=ready.declareMove('1811');
eq(committed.snapshot().status,'awaiting-damage-roll');
eq(committed.snapshot().pending,'1811');
eq(committed.snapshot().state,state());
fails(()=>committed.finish(),/ordering/);
const damagedMove=committed.resolveDamage(1);eq(damagedMove.snapshot().state.supportMarkers[markerKey].condition,'damaged');
eq(damagedMove.snapshot().event.toPort,'Nikolaev');
const safeMove=committed.resolveDamage(6);eq(safeMove.snapshot().state.supportMarkers[markerKey].condition,'undamaged');
eq(safeMove.snapshot().state.supportMarkers[markerKey].hex,'1811');
eq(damagedMove.undo().session.snapshot(),committed.snapshot());
eq(committed.undo().session.snapshot(),ready.snapshot());
const finished=damagedMove.finish(),restored=pilot.restoreSnapshot(copy(finished.snapshot()));
eq(restored.snapshot(),finished.snapshot());
const tamper=copy(finished.snapshot());tamper.actions[1].die=6;
fails(()=>pilot.restoreSnapshot(tamper),/does not match replay/);
const wrongActor=()=>pilot.create({cursor,actor:'german',state:state()});
fails(wrongActor,/owning special phase/);
fails(()=>pilot.create({cursor:{...cursor,index:2},actor:'soviet',state:state()}),/owning special phase/);
// Source pin failures, including a correct city name on the wrong physical cell.
const offMap=copy(policy);offMap.portSupport.portHexes.Odessa='1413';
fails(()=>Port.create({map,policy:offMap,counterConfig}),/source-approved hostCell/);
const extraPort=copy(policy);extraPort.portSupport.portNames.push('Brăila');
fails(()=>Port.create({map,policy:extraPort,counterConfig}),/configuration/);
const fakeFace=copy(counterConfig);fakeFace.faces.back=fakeFace.faces.back.filter(x=>x.faceId!==policy.portSupport.reverseFaceId);
fails(()=>Port.create({map,policy,counterConfig:fakeFace}),/faces unverified/);
// Enemy entry directly into the Fleet port triggers source-compatible forced
// displacement, while an enemy-occupied other port forces elimination.
const from=state(),after=state();after.units['axis-infantry-corps'].hex='1513';after.cityControl.Odessa='german';
const forced=c.forcedEntry({before:from,after,actor:'german',enteredUnitId:'axis-infantry-corps',choice:{to:'1811',die:6}});
eq(forced.required,true);eq(forced.event.toPort,'Nikolaev');eq(forced.state.supportMarkers[markerKey].hex,'1811');
const blocked=copy(after);blocked.cityControl.Nikolaev='german';
const removed=c.forcedEntry({before:from,after:blocked,actor:'german',enteredUnitId:'axis-infantry-corps'});
eq(removed.required,true);eq(removed.event.reason,'no-available-port');eq(removed.state.supportMarkers[markerKey],undefined);
const unverified=state();delete unverified.cityControl;
fails(()=>c.validateDestination({state:unverified,to:'1811'}),/complete cityControl ledger/);
fails(()=>c.forcedDestinations({state:unverified}),/complete cityControl ledger/);
fails(()=>c.initialize({state:{scenarioId:'kiev-odessa',units:copy(units)}}),/complete cityControl ledger/);
const hostile=state();hostile.cityControl.Nikolaev='german';
fails(()=>c.validateDestination({state:hostile,to:'1811'}),/Soviet-controlled/);
const changed=state();changed.cityControl.Odessa='german';
fails(()=>c.initialize({state:{scenarioId:'kiev-odessa',units:copy(units),cityControl:changed.cityControl}}),/enemy-controlled/);
const otherOwner=copy(policy);otherOwner.portSupport.destinationControlMode='unsupported';
fails(()=>Port.create({map,policy:otherOwner,counterConfig}),/destination control policy/);
console.log(`PASS Odessa Black Sea Fleet source-bound candidate v517: ${checks} assertions`);
if(process.argv.includes('--write-audit')){
 const record={checkpoint:283,version:'v517',status:'PASS',assertions:checks,scope:'Diagnostic Black Sea Fleet §§6, 15.1–15.2 two-port source-bound Fleet mechanics',ports:c.portHexes,sourceEvidence:source,limitations:policy.limitations};
 fs.writeFileSync(require('node:path').join(__dirname,'../rules/audit/odessa-black-sea-fleet-candidate-v517.json'),JSON.stringify(record,null,2)+'\n');
}
