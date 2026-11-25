'use strict';
const assert=require('node:assert/strict'), fs=require('node:fs'),crypto=require('node:crypto');
const {create}=require('../core/historical_naval_logistics');
const Port=require('../core/historical_port_support');
const composer=require('../maps/composer');
const map=composer.compose(require('../maps/kiev.json'),require('../maps/odessa-extension.json'));
const policy=require('../maps/combat-configs/kiev-odessa-air-sea-candidate-v518.json');
const sourcePolicy=require('../maps/buildup-configs/kiev-odessa-naval-logistics-candidate-v519.json');
const kiev=require('../maps/counter-configs/kiev.json');
const odessa=require('../maps/counter-configs/odessa-extension.json');
const counterConfig={mapId:'kiev-odessa',faces:{front:[...kiev.faces.front,...odessa.faces.front],back:[...kiev.faces.back,...odessa.faces.back]}};
const copy=x=>JSON.parse(JSON.stringify(x));
let n=0;
function ok(v,msg){assert.ok(v,msg);n++}
function eq(a,b,msg){assert.deepEqual(a,b,msg);n++}
function fail(fn,rx){assert.throws(fn,rx);n++}
const hash=crypto.createHash('sha256').update(fs.readFileSync(require('node:path').join(__dirname,'../references/rules/odessa-rules.pdf'))).digest('hex');
eq(sourcePolicy.sourceRulebookSha256,hash,'source rulebook pinned');
eq(sourcePolicy.portHexes,policy.portSupport.portHexes,'authentic registered ports');
eq(sourcePolicy.turns,7,'seven-turn scenario');
const naval=create({map,combatPolicy:policy,counterConfig,sourcePolicy});
eq(naval.portHexes,{Odessa:'1513',Nikolaev:'1811'});
function unit(id,hex,status='printed-full'){
 const front=kiev.faces.front.find(x=>x.faceId===id),back=kiev.faces.back.find(x=>x.faceId===front.pairedFaceId);
 const face=status==='printed-reduced'?back:front;
 return {id,owner:'soviet',hex,sourceFaceId:id,reverseFaceId:back.faceId,nationality:'soviet',class:'infantry',size:'army',mp:4,marker:false,
  strengthStatus:status,printedCombatStrength:Number(face.visualTranscription.printedValues.split('-')[0]),...(status==='printed-reduced'?{activeFaceId:back.faceId}:{})};
}
const army='kiev-front-r03c04', second='kiev-front-r03c05';
function initial(){return Port.create({map,policy,counterConfig}).initialize({state:{scenarioId:'kiev-odessa',units:{[army]:unit(army,'1513','printed-reduced'),[second]:unit(second,'1513')},cityControl:{Odessa:'soviet',Nikolaev:'soviet'}}}).state;}
const before=initial();
ok(naval.replacementException({state:before,actor:'soviet',unitId:army}),'reduced unit restored in Fleet port');
ok(!naval.replacementException({state:before,actor:'soviet',unitId:second}),'full unit not eligible');
ok(!naval.replacementException({state:before,actor:'german',unitId:army}),'no Axis replacement bypass');
ok(!naval.replacementException({state:before,actor:'soviet',unitId:'missing'}),'no missing unit');
const damaged=copy(before);damaged.supportMarkers.blackSeaFleet.condition='damaged';
ok(naval.replacementException({state:damaged,actor:'soviet',unitId:army}),'damaged Fleet still permits port replacement');
const elsewhere=copy(before);elsewhere.units[army].hex='1211';
ok(!naval.replacementException({state:elsewhere,actor:'soviet',unitId:army}),'Fleet cannot supply inland hex');
const otherPort=copy(before);otherPort.units[army].hex='1811';
ok(!naval.replacementException({state:otherPort,actor:'soviet',unitId:army}),'Fleet must share replacement port');
const fleetAtOther=copy(otherPort);fleetAtOther.supportMarkers.blackSeaFleet.hex='1811';
ok(naval.replacementException({state:fleetAtOther,actor:'soviet',unitId:army}),'Nikolaev permitted when Fleet present');
const enemyPort=copy(before);enemyPort.cityControl.Odessa='german';
ok(!naval.replacementException({state:enemyPort,actor:'soviet',unitId:army}),'enemy-controlled source port cannot supply');
const eliminated=copy(before);delete eliminated.supportMarkers.blackSeaFleet;
ok(!naval.replacementException({state:eliminated,actor:'soviet',unitId:army}),'no replacement after Fleet eliminated');
const noControl=copy(before);delete noControl.cityControl;
fail(()=>naval.replacementException({state:noControl,actor:'soviet',unitId:army}),/port control/);
const forged=copy(before);forged.supportMarkers.blackSeaFleet.sourceFaceId='fake';
fail(()=>naval.replacementException({state:forged,actor:'soviet',unitId:army}),/Fleet marker state/);
const onlySoviet=()=>{const s=initial();delete s.units[army];return s;};
for(let die=1;die<=6;die++){
 const source=onlySoviet(),pristine=copy(source);
 const r=naval.transport({state:source,actor:'soviet',unitId:second,destination:{kind:'off-map'},turn:4,die});
 eq(source,pristine,'transaction does not mutate input');
 eq(r.event.hit,die===1,'roll-one damage only');
 eq(r.event.firstReturnTurn,5,'following-turn reinforcement');
 eq(r.state.units[second],undefined,'removed from board');
 const stored=r.state.evacuatedNavalUnits[second];
 ok(stored,'evacuation reserve recorded');
 eq(stored.unit.strengthStatus,die===1?'printed-reduced':'printed-full','source front/reverse damage transition');
 eq(stored.firstReturnTurn,5,'turn 5 first return');
 ok(!naval.returnEligibility({state:r.state,actor:'soviet',unitId:second,turn:4}),'no same-turn return');
 for(let t=5;t<=7;t++)ok(naval.returnEligibility({state:r.state,actor:'soviet',unitId:second,turn:t}),'later turn allowed');
 ok(!naval.returnEligibility({state:r.state,actor:'german',unitId:second,turn:5}),'Axis cannot return Soviet unit');
}
for(let die=1;die<=6;die++){
 const source=initial(),pristine=copy(source);
 const r=naval.transport({state:source,actor:'soviet',unitId:army,destination:{kind:'off-map'},turn:4,die});
 eq(source,pristine,'damaged-source preserved');
 eq(r.event.result,die===1?'eliminated':'printed-reduced');
 eq(r.state.evacuatedNavalUnits?.[army]?.unit?.strengthStatus,die===1?undefined:'printed-reduced');
 if(die===1)ok(!naval.returnEligibility({state:r.state,actor:'soviet',unitId:army,turn:5}),'eliminated unit cannot return');
}
for(let die=1;die<=6;die++){
 const source=onlySoviet(),pristine=copy(source);
 const r=naval.transport({state:source,actor:'soviet',unitId:second,destination:{kind:'port',hex:'1811'},turn:3,die,
  canOccupyPort:()=>true});
 eq(source,pristine,'port transfer input unchanged');
 eq(r.state.units[second].hex,'1811','arrived at only other approved port');
 eq(r.state.units[second].strengthStatus,die===1?'printed-reduced':'printed-full');
 eq(r.state.supportMarkers,source.supportMarkers,'transport does not move or damage Fleet');
 eq(r.event.kind,'naval-ground-transport');
}
const source=onlySoviet();
fail(()=>naval.transport({state:source,actor:'soviet',unitId:second,destination:{kind:'port',hex:'1811'},turn:4,die:6}),/stacking qualification/);
fail(()=>naval.transport({state:source,actor:'soviet',unitId:second,destination:{kind:'port',hex:'1811'},turn:4,die:6,canOccupyPort:()=>false}),/stacking qualification/);
fail(()=>naval.transport({state:source,actor:'soviet',unitId:second,destination:{kind:'port',hex:'1513'},turn:4,die:6,canOccupyPort:()=>true}),/another friendly-controlled port/);
fail(()=>naval.transport({state:source,actor:'soviet',unitId:second,destination:{kind:'port',hex:'1911'},turn:4,die:6,canOccupyPort:()=>true}),/another friendly-controlled port/);
for(const die of [0,7,2.5,null,'1'])fail(()=>naval.transport({state:source,actor:'soviet',unitId:second,destination:{kind:'off-map'},turn:4,die}),/d6/);
fail(()=>naval.transport({state:source,actor:'german',unitId:second,destination:{kind:'off-map'},turn:4,die:6}),/Soviet naval transport/);
fail(()=>naval.transport({state:source,actor:'soviet',unitId:second,destination:{kind:'off-map'},turn:0,die:6}),/current turn/);
fail(()=>naval.transport({state:source,actor:'soviet',unitId:second,destination:{kind:'off-map'},turn:8,die:6}),/current turn/);
const noFleet=onlySoviet();delete noFleet.supportMarkers.blackSeaFleet;
fail(()=>naval.transport({state:noFleet,actor:'soviet',unitId:second,destination:{kind:'off-map'},turn:3,die:6}),/share/);
const noPortOwner=onlySoviet();noPortOwner.cityControl.Odessa='german';
fail(()=>naval.transport({state:noPortOwner,actor:'soviet',unitId:second,destination:{kind:'off-map'},turn:3,die:6}),/Soviet-controlled/);
const enemyReceiving=onlySoviet();enemyReceiving.cityControl.Nikolaev='german';
fail(()=>naval.transport({state:enemyReceiving,actor:'soviet',unitId:second,destination:{kind:'port',hex:'1811'},turn:4,die:6,canOccupyPort:()=>true}),/friendly-controlled/);
const forgedUnit=onlySoviet();forgedUnit.units[second].reverseFaceId='fake';
fail(()=>naval.transport({state:forgedUnit,actor:'soviet',unitId:second,destination:{kind:'off-map'},turn:4,die:6}),/Source-paired/);
const hostileOrigin=onlySoviet();hostileOrigin.units['intruder']={id:'intruder',owner:'german',hex:'1513'};
fail(()=>naval.transport({state:hostileOrigin,actor:'soviet',unitId:second,destination:{kind:'off-map'},turn:4,die:6}),/Enemy occupies/);
const contestedPort=copy(hostileOrigin);contestedPort.units[army]=unit(army,'1513','printed-reduced');
ok(!naval.replacementException({state:contestedPort,actor:'soviet',unitId:army}),'contested port forbids naval replacement exception');
const reserveSource=naval.transport({state:onlySoviet(),actor:'soviet',unitId:second,destination:{kind:'off-map'},turn:3,die:6}).state;
const forgedReserve=copy(reserveSource);forgedReserve.evacuatedNavalUnits[second].firstReturnTurn=3;
fail(()=>naval.returnEligibility({state:forgedReserve,actor:'soviet',unitId:second,turn:4}),/Unverified naval evacuation/);
const doubledReserve=copy(reserveSource);doubledReserve.units[second]=unit(second,'1811');
fail(()=>naval.returnEligibility({state:doubledReserve,actor:'soviet',unitId:second,turn:4}),/Unverified naval evacuation/);
ok(!naval.returnEligibility({state:reserveSource,actor:'soviet',unitId:second,turn:8}),'no post-game reinforcement return');
const incompatible=copy(onlySoviet());incompatible.units[second].id='other';
fail(()=>naval.transport({state:incompatible,actor:'soviet',unitId:second,destination:{kind:'off-map'},turn:3,die:5}),/share/);
const wrongPort=copy(sourcePolicy);wrongPort.portHexes.Odessa='1413';
fail(()=>create({map,combatPolicy:policy,counterConfig,sourcePolicy:wrongPort}),/disagrees/);
const wrongHit=copy(sourcePolicy);wrongHit.damageDie=2;
fail(()=>create({map,combatPolicy:policy,counterConfig,sourcePolicy:wrongHit}),/disagrees/);
const wrongOwner=copy(sourcePolicy);wrongOwner.owner='german';
fail(()=>create({map,combatPolicy:policy,counterConfig,sourcePolicy:wrongOwner}),/disagrees/);
// Destination admission must not depend on whether the transported unit survives.
for(let die=1;die<=6;die++){
 const src=initial(), pristine=copy(src);
 const args={state:src,actor:'soviet',unitId:army,destination:{kind:'port',hex:'1811'},turn:4,die};
 fail(()=>naval.transport(args),/stacking qualification/);
 fail(()=>naval.transport({...args,canOccupyPort:()=>false}),/stacking qualification/);
 const hostile=copy(src);hostile.units.intruder={id:'intruder',owner:'german',hex:'1811'};
 fail(()=>naval.transport({...args,state:hostile,canOccupyPort:()=>true}),/Enemy occupies destination/);
 const r=naval.transport({...args,canOccupyPort:({state,unit})=>{
  eq(unit.strengthStatus,'printed-reduced','admission uses pre-roll face');
  state.units[army].hex='invalid';unit.hex='invalid';return true;
 }});
 eq(src,pristine,'admission cannot mutate input');
 eq(r.state.units[army]?.hex,die===1?undefined:'1811','legal destination resolves damage normally');
}
console.log(`PASS source-qualified Odessa naval logistics v561: ${n} assertions`);
