'use strict';
/* §10.5 Romanian Air Support / §11 Turn-2 arrival. The fifth game remains
 * non-live; these tests exercise original photographed counters through the
 * generic historical AirSupport implementation, not an invented Odessa UI.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const Air=require('../core/historical_air_support');
const composer=require('../maps/composer');
const K=require('../maps/kiev.json');
const Odessa=require('../maps/odessa-extension.json');
const Kiev=require('../maps/combat-configs/kiev.json');
const Config=require('../maps/combat-configs/kiev-odessa-romanian-air-candidate-v510.json');
const Phases=require('../maps/phase-configs/kiev-odessa.json');
const KievCounters=require('../maps/counter-configs/kiev.json');
const OdessaCounters=require('../maps/counter-configs/odessa-extension.json');
const Roster=require('../maps/roster-overlays/kiev-odessa.json');
const clone=v=>JSON.parse(JSON.stringify(v));
const hash=rel=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,rel))).digest('hex');
let n=0;
const eq=(a,b,msg)=>{assert.deepStrictEqual(a,b,msg);n++};
const ok=(a,msg)=>{assert.ok(a,msg);n++};
const bad=(fn,re,msg)=>{assert.throws(fn,re,msg);n++};
const map=composer.compose(K,Odessa);
const counters={faces:{front:[...KievCounters.faces.front,...OdessaCounters.faces.front],
 back:[...KievCounters.faces.back,...OdessaCounters.faces.back]}};
const face='odessa-front-r01c07', reverse='odessa-back-r01c02';
const make=(policy=Config,config=counters)=>Air.create({map,combatPolicy:policy,counterConfig:config,phaseConfig:Phases,rosterOverlay:Roster});
const cursor=turn=>({scenarioId:'kiev-odessa',turn,index:2,complete:false});
const available=(air,state,turn)=>air.available({state,cursor:cursor(turn),actor:'german'}).map(m=>m.faceId);
const ground=(air,state,turn,id=face)=>air.ground({state,cursor:cursor(turn),actor:'german',faceId:id});

// Source qualification: three independent original materials and the base Kiev
// support faces. The base's CRT/source combat policy is not edited or swapped.
for(const [rel,digest] of Object.entries(Config.sourceSHA256))eq(hash(rel),digest,'original source SHA: '+rel);
eq(Config.scenarioId,'kiev-odessa');
eq(Config.airSupport.owner,'german','Axis player controls Romanian support');
eq(Config.status.includes('not-live'),true);
eq(Config.airSupport.navalAttackMode,'none','do not prematurely authorize §15 Fleet air strikes');
eq(Config.airSupport.markers.slice(0,2),Kiev.airSupport.markers,'original German air support retained');
eq(Config.airSupport.markers[2],{faceId:face,firstTurn:2,shiftRating:1,cooldownTurns:1,refitFaceId:reverse});
const sourceFront=OdessaCounters.faces.front.find(x=>x.faceId===face),
 sourceBack=OdessaCounters.faces.back.find(x=>x.faceId===reverse);
eq(sourceFront.pairedFaceId,reverse);eq(sourceBack.pairedFaceId,face);
eq(sourceFront.visualTranscription.kind,'air-marker');eq(sourceBack.visualTranscription.kind,'air-marker');
ok(sourceFront.visualTranscription.visibleNotation.includes('1; right arrow'));
ok(sourceBack.visualTranscription.visibleNotation.endsWith('REFIT'));
const rosterMarker=Roster.units.find(x=>x.designKey==='romanian-air-support');
eq(rosterMarker.initial.turn,2);eq(rosterMarker.art.displayFaceId,face);eq(rosterMarker.art.alternateFaceId,reverse);

bad(()=>Air.create({map,combatPolicy:Config,counterConfig:counters,phaseConfig:Phases}),/Source roster binding required/);
const rosterBad=clone(Roster);rosterBad.units.find(x=>x.designKey==='romanian-air-support').initial.turn=1;
bad(()=>Air.create({map,combatPolicy:Config,counterConfig:counters,phaseConfig:Phases,rosterOverlay:rosterBad}),/roster arrival/);
const air=make();eq(air.markerFaces,[...Kiev.airSupport.markers.map(m=>m.faceId),face]);
const initial={scenarioId:'kiev-odessa',units:{}};
const fresh=available(air,initial,1);eq(fresh,[...Kiev.airSupport.markers.map(m=>m.faceId)]);
eq(available(air,initial,2),[...fresh,face]);
for(let turn=2;turn<=7;turn++)ok(available(air,initial,turn).includes(face),'unused Romanian air available on turn '+turn);
const used2=ground(air,initial,2);
eq(used2.shiftRating,1);eq(used2.event.turn,2);eq(used2.event.kind,'ground-air-commitment');
eq(used2.event.faceId,face);eq(used2.state.airUse['2'][face],'ground');
eq(initial.airUse,undefined,'source state immutable');
bad(()=>ground(air,initial,1),/not arrived/);
bad(()=>ground(air,used2.state,2),/already committed/);
eq(available(air,used2.state,2),fresh,'same-turn Romanian support unavailable');
eq(available(air,used2.state,3),fresh,'Turn 3 REFIT: German air remains available');
bad(()=>ground(air,used2.state,3),/REFIT turn/);
ok(available(air,used2.state,4).includes(face),'Turn 4 is eligible after refit');
const used4=ground(air,used2.state,4);
eq(used4.state.airUse['2'][face],'ground');eq(used4.state.airUse['4'][face],'ground');
eq(available(air,used4.state,5),fresh,'Turn 5 refit');
bad(()=>ground(air,used4.state,5),/REFIT turn/);
ok(available(air,used4.state,6).includes(face),'Turn 6 ready after refit');
const used6=ground(air,used4.state,6);
eq(available(air,used6.state,7),fresh,'Turn 7 refit');
// If the marker is not used after its Turn-3 refit, the eligibility persists:
// refit is one skipped turn, not a rigid even-turn-only calendar.
for(const t of [4,5,6,7])ok(available(air,used2.state,t).includes(face),'refit expires without forced later use on '+t);
const used5=ground(air,used2.state,5);
eq(available(air,used5.state,6),fresh);
ok(available(air,used5.state,7).includes(face));
// Undo via immutable prior snapshots, save/restore JSON, and repeated creation.
eq(used4.state.airUse,JSON.parse(JSON.stringify(used4.state)).airUse);
eq(available(make(),clone(used4.state),5),fresh);
ok(available(make(),clone(used2.state),4).includes(face));
eq(available(air,used2.state,2),fresh,'prior snapshot stays at Turn 2 commitment');
const german=ground(air,used2.state,3,fresh[0]);
eq(german.state.airUse['3'][fresh[0]],'ground','German support remains valid during Romanian refit');
const germanNext=ground(air,german.state,4,fresh[0]);
eq(germanNext.state.airUse['4'][fresh[0]],'ground','German support can fly consecutive turns');
// Source binding and phase gating are fail-closed.
bad(()=>air.available({state:initial,cursor:cursor(2),actor:'soviet'}),/owning Combat Phase/);
bad(()=>air.available({state:initial,cursor:{...cursor(2),index:3},actor:'german'}),/owning Combat Phase/);
bad(()=>air.available({state:{scenarioId:'kiev',units:{}},cursor:cursor(2),actor:'german'}),/historical state/);
bad(()=>air.attackFleet({state:initial,cursor:cursor(2),actor:'german',faceId:face,die:1}),/Naval air attacks not available/);
for(const m of [
 {...Config.airSupport.markers[2],firstTurn:1},
 {...Config.airSupport.markers[2],shiftRating:2},
 {...Config.airSupport.markers[2],refitFaceId:'odessa-back-r01c01'},
 {...Config.airSupport.markers[2],cooldownTurns:0},
 {...Config.airSupport.markers[2],cooldownTurns:Phases.turns},
 {...Config.airSupport.markers[2],faceId:'odessa-front-r01c06'},
 {...Config.airSupport.markers[2],other:1},
]){
 const alt=clone(Config);alt.airSupport.markers[2]=m;
 bad(()=>make(alt),/Invalid|unverified|does not match photographed|roster arrival/,'altered photographed marker rejected');
}
for(const invalid of [
 {airUse:{'2':{[face]:'ground'},'3':{[face]:'ground'}}},
 {airUse:{'0':{[face]:'ground'}}},
 {airUse:{'1':{[face]:'ground'}}},
 {airUse:{'8':{[face]:'ground'}}},
 {airUse:{'2':{[face]:'bogus'}}},
 {airUse:{'2':{'unregistered-air-marker':'ground'}}},
 {airUse:{'2':null}},
 {airUse:[]},
]){
 const state={...clone(initial),...invalid};
 bad(()=>available(air,state,4),/Malformed air-use ledger|Invalid historical air REFIT ledger/);
}
console.log('PASS v510 Romanian Air Support REFIT source-candidate:',n,'assertions; Odessa campaign still gated');
