'use strict';
/* Source-bound diagnostic: Odessa §15.5 Black Sea air strikes, with the exact
 * printed FK IV/FK V / Romanian Rom I AK marker faces and REFIT timing.
 * Does not bypass the non-playable Kiev–Odessa source movement gate.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const Air=require('../core/historical_air_support');
const Ports=require('../core/historical_port_support');
const composer=require('../maps/composer');
const map=composer.compose(require('../maps/kiev.json'),require('../maps/odessa-extension.json'));
const combatPolicy=require('../maps/combat-configs/kiev-odessa-air-sea-candidate-v518.json');
const fleetBase=require('../maps/combat-configs/kiev-odessa-black-sea-fleet-candidate-v517.json');
const airBase=require('../maps/combat-configs/kiev-odessa-romanian-air-candidate-v510.json');
const baseKiev=require('../maps/combat-configs/kiev.json');
const phases=require('../maps/phase-configs/kiev-odessa.json');
const roster=require('../maps/roster-overlays/kiev-odessa.json');
const KievCounter=require('../maps/counter-configs/kiev.json');
const OdessaCounter=require('../maps/counter-configs/odessa-extension.json');
const counterConfig={faces:{front:[...KievCounter.faces.front,...OdessaCounter.faces.front],
 back:[...KievCounter.faces.back,...OdessaCounter.faces.back]}};
const deep=v=>JSON.parse(JSON.stringify(v));
const dig=rel=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,rel))).digest('hex');
let n=0;
function eq(a,b,name){assert.deepEqual(a,b,name);n++}
function ok(a,name){assert.ok(a,name);n++}
function throws(f,re,name){assert.throws(f,re,name);n++}
const fleetFace='odessa-front-r01c01';
const fk4='kiev-front-r03c01',fk5='kiev-front-r03c02',romanian='odessa-front-r01c07';
const cursor=t=>({scenarioId:'kiev-odessa',turn:t,index:2,complete:false});
const make=(policy=combatPolicy,rosterOverlay=roster)=>Air.create({map,combatPolicy:policy,
 counterConfig,phaseConfig:phases,rosterOverlay});
const ports=Ports.create({map,policy:combatPolicy,counterConfig});
const initial=()=>ports.initialize({state:{scenarioId:'kiev-odessa',units:{
  'coastal-army':{id:'coastal-army',owner:'soviet',hex:'1513',strengthStatus:'full'}},
 cityControl:{Odessa:'soviet',Nikolaev:'soviet'}}}).state;
function available(air,state,t){return air.available({state,cursor:cursor(t),actor:'german'}).map(x=>x.faceId)}
function fleet(air,state,t,faceId,die){return air.attackFleet({state,cursor:cursor(t),actor:'german',faceId,die})}
function ground(air,state,t,faceId){return air.ground({state,cursor:cursor(t),actor:'german',faceId})}

// A single explicit source profile must carry both prior qualifications.
eq(combatPolicy.scenarioId,'kiev-odessa','scenario binding');
eq(combatPolicy.status,'diagnostic-combined-air-sea-candidate-not-playable','not playable');
eq(combatPolicy.crtId,baseKiev.crtId,'one shared B4M CRT');
eq(combatPolicy.airSupport.navalAttackMode,'fleet-strike-v1','explicit source-allowed naval strike');
eq(combatPolicy.portSupport,fleetBase.portSupport,'two-port Fleet copied without alteration');
eq({...combatPolicy.airSupport,navalAttackMode:'none'},airBase.airSupport,'refit and three front faces unchanged');
eq(combatPolicy.airSupport.markers.slice(0,2),baseKiev.airSupport.markers,'Kiev air corps retained');
eq(combatPolicy.airSupport.requireRosterFaceBinding,true,'source roster required');
eq(combatPolicy.sourceEvidence.rulesPdfSha256,dig('references/rules/odessa-rules.pdf'),'original printed rules pinned');
eq(combatPolicy.sourceEvidence.counterFrontSha256,dig('assets/official-counters/source-sheets/counters-odessa-front.jpg'),'original front counter sheet pinned');
eq(combatPolicy.sourceEvidence.counterReverseSha256,dig('assets/official-counters/source-sheets/counters-odessa-back.jpg'),'original reverse counter sheet pinned');
for(const [rel,expected] of Object.entries(airBase.sourceSHA256))eq(dig(rel),expected,'air source SHA '+rel);
const air=make(),before=initial();
eq(before.supportMarkers.blackSeaFleet.sourceFaceId,fleetFace,'Black Sea front source face');
eq(before.supportMarkers.blackSeaFleet.hex,'1513','initial Odessa port');
eq(available(air,before,1),[fk4,fk5],'Romanian marker not arrived on Turn 1');
eq(available(air,before,2),[fk4,fk5,romanian],'Rom I AK available on Turn 2');
throws(()=>make({...deep(combatPolicy),airSupport:{...deep(combatPolicy.airSupport),navalAttackMode:'unknown'}}),/Unrecognized historical naval/,'unknown mode rejected');
const nonNaval=deep(combatPolicy);delete nonNaval.portSupport;
throws(()=>make(nonNaval),/Fleet strike requires/,'explicit naval mode requires port');
throws(()=>make(combatPolicy,null),/Source roster binding required/,'missing source roster rejected');
const badRoster=deep(roster);badRoster.units.find(x=>x.designKey==='romanian-air-support').initial.turn=3;
throws(()=>make(combatPolicy,badRoster),/roster arrival/,'altered roster arrival rejected');
throws(()=>fleet(air,before,1,romanian,1),/not arrived/,'Romanian early attack forbidden');
for(const id of [fk4,fk5,romanian])for(let die=1;die<=6;die++){
 const original=initial(),fingerprint=deep(original);
 const result=fleet(air,original,2,id,die),hit=die===1;
 eq(result.event.kind,'air-sea-attack','air-sea action is separate from ground combat');
 eq(result.event.faceId,id,'source-selected Air Corps face ID');
 eq(result.event.shiftRating,1,'original Air Corps shift rating');
 eq(result.event.die,die,'external die unchanged');
 eq(result.event.hit,hit,'d6 ≤ printed shift threshold');
 eq(result.event.resultCondition,hit?'damaged':'undamaged','first hit flips Fleet');
 eq(result.state.supportMarkers.blackSeaFleet.condition,hit?'damaged':'undamaged','front/reverse state');
 eq(result.state.airUse['2'][id],'fleet','shared ledger reserves Fleet rather than ground');
 eq(original,fingerprint,'air-sea never mutates historical state');
 throws(()=>fleet(air,result.state,2,id,6),/already committed/,'same marker cannot be used twice');
 throws(()=>ground(air,result.state,2,id),/already committed/,'naval attack excludes ground support');
 eq(available(air,result.state,2).includes(id),false,'committed face removed from catalogue');
}
// Two distinct aircraft can attack the same Fleet; second hit eliminates it.
const hit1=fleet(air,before,2,fk4,1),hit2=fleet(air,hit1.state,2,fk5,1);
eq(hit2.event.priorCondition,'damaged','second attack sees damaged reverse');
eq(hit2.event.resultCondition,'eliminated','second hit eliminates Fleet');
eq(hit2.state.supportMarkers.blackSeaFleet,undefined,'eliminated marker absent');
const defense={defenderHex:'1513',attackers:[],defenders:['coastal-army']};
eq(ports.inspect({state:before,battle:defense,actor:'german'}).fleetShift,-1,'undamaged Fleet shifts defensive CRT');
eq(ports.inspect({state:hit1.state,battle:defense,actor:'german'}).fleetShift,0,'damaged Fleet loses protective odds shift');
eq(ports.inspect({state:hit1.state,battle:defense,actor:'german'}).ignoreRetreatEligible,true,'damaged Fleet still provides retreat exception');
eq(ports.inspect({state:hit2.state,battle:defense,actor:'german'}).ignoreRetreatEligible,false,'eliminated Fleet provides no retreat exception');
// Source rules allow striking the Fleet at either port. A legal move must
// commit its port before the aircraft attack, not auto-target the origin.
const relocated=ports.relocate({state:before,to:'1811',die:6});
eq(relocated.state.supportMarkers.blackSeaFleet.hex,'1811','Fleet relocated to Nikolaev');
const struckAtNikolaev=fleet(air,relocated.state,2,fk4,1);
eq(struckAtNikolaev.state.supportMarkers.blackSeaFleet.hex,'1811','naval air strike targets actual relocated port');
eq(struckAtNikolaev.state.supportMarkers.blackSeaFleet.condition,'damaged','fleet at Nikolaev takes normal source-hit');
throws(()=>fleet(air,hit2.state,2,romanian,1),/Fleet marker absent/,'no strikes against absent Fleet');
// Distinct markers remain independent; ground support still selectable for unused faces.
const noHit=fleet(air,before,2,fk4,6);
ok(available(air,noHit.state,2).includes(romanian),'Romanian remains uncommitted after German attack');
const groundUse=ground(air,noHit.state,2,romanian);
eq(groundUse.event.kind,'ground-air-commitment','source-selected alternate support');
eq(groundUse.state.airUse['2'][romanian],'ground','one shared ledger for naval and ground');
throws(()=>fleet(air,groundUse.state,2,romanian,1),/already committed/,'ground excludes naval strike');
// REFIT applies to Romanian aircraft regardless of which mission was used.
const romNaval=fleet(air,before,2,romanian,6);
eq(available(air,romNaval.state,3),[fk4,fk5],'Turn 3 REFIT after naval strike');
throws(()=>ground(air,romNaval.state,3,romanian),/REFIT turn/,'REFIT prevents ground');
throws(()=>fleet(air,romNaval.state,3,romanian,1),/REFIT turn/,'REFIT prevents naval');
ok(available(air,romNaval.state,4).includes(romanian),'Turn 4 eligible after refit');
const romAgain=fleet(air,romNaval.state,4,romanian,6);
eq(available(air,romAgain.state,5),[fk4,fk5],'Turn 5 REFIT repeats based on use');
const germanConsecutive=fleet(air,noHit.state,3,fk4,6);
eq(germanConsecutive.state.airUse['3'][fk4],'fleet','German aircraft do not acquire Romanian cooldown');
// Atomic failure on invalid die, wrong owner, tampered history, and a missing control ledger.
for(const die of [0,7,null,1.5,'1'])throws(()=>fleet(air,before,2,fk4,die),/six-sided die/,'invalid injected die');
throws(()=>air.available({state:before,cursor:cursor(2),actor:'soviet'}),/owning Combat Phase/,'only owning Axis combat');
const forged=deep(romNaval.state);forged.airUse['3']={[romanian]:'fleet'};
throws(()=>available(air,forged,4),/Invalid historical air REFIT ledger/,'tampered save ledger rejected');
const missing=initial();delete missing.supportMarkers.blackSeaFleet;
throws(()=>fleet(air,missing,2,fk4,1),/Fleet marker absent/,'Fleet source marker required');
// Stateless JSON restoration preserves source-bound result and replay constraints.
const restored=deep(hit1.state);
eq(available(make(),restored,2),[fk5,romanian],'restored commitments persist');
eq(available(air,before,2),[fk4,fk5,romanian],'precommit snapshot stays immutable / undo source');
console.log(`PASS v518 Odessa §15.5 Fleet-air/REFIT diagnostic: ${n} assertions`);
if(process.argv.includes('--write-audit')){
 fs.writeFileSync(path.join(root,'rules/audit/odessa-air-sea-v518.json'),JSON.stringify({
  checkpoint:284,version:'v518',status:'PASS',assertions:n,source:'odessa-rules.pdf §§10.5,11,15.5',
  scope:'exact three Air Corps, Fleet 1513, two-port policy, six die faces, air-sea versus ground exclusivity, Romanian REFIT, source roster, save clone',
  nonLive:true,limits:'No promotion of Kiev–Odessa movement graph or full campaign and no source-authorized campaign end-to-end claim'
 },null,2)+'\n');
}
