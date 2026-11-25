'use strict';
/* Checkpoint 176 — source sheets & published Arduous §5 scoring.
 * This DOES NOT turn the provisional Arduous movement graph into game authority.
 */
const A=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const K=require('../maps/counter-configs/arduous.json');
const map=require('../maps/arduous.json');
const config=require('../maps/phase-configs/arduous.json');
const policy=require('../maps/housekeeping-configs/arduous.json');
const Score=require('../core/historical_housekeeping_phase');
const Art=require('../core/historical_counter_face_projection');
const Movement=require('../core/movement_binding');
const Consequences=require('../core/historical_combat_consequences');
const Geography=require('../core/historical_combat_geography');
let assertions=0;
const eq=(a,b,label)=>{A.deepEqual(a,b,label);assertions++;};
const ok=(a,label)=>{A.ok(a,label);assertions++;};
const fail=(f,re,label)=>{A.throws(f,re,label);assertions++;};
const copy=v=>JSON.parse(JSON.stringify(v));
for(const side of ['front','back']){
 const source=K.faceSource[side];
 eq(crypto.createHash('sha256').update(fs.readFileSync(source.file)).digest('hex'),source.sha256,side+' source-sheet hash');
}
const faces=new Map(K.faces.front.map(x=>[x.faceId,x]));
const backs=new Map(K.faces.back.map(x=>[x.faceId,x]));
const hidden=K.faces.front.filter(x=>x.visualTranscription.printedValues==='?-6');
eq(hidden.length,10,'Ten source untried Mechanized Corps');
eq(K.concealedMechanizedFacePairs.length,10);
const reverseIds=new Set();
for(const f of hidden){
 const t=f.visualTranscription, reverse=backs.get(f.pairedFaceId);ok(reverse);
 eq(t.kind,'mechanized');eq(t.printedAffiliation,'soviet');eq(t.printedIdentifier,'*');
 eq(reverse.visualTranscription.kind,'mechanized');eq(reverse.visualTranscription.printedAffiliation,'soviet');
 ok(/^\d+·\d+-6$/.test(reverse.visualTranscription.printedValues),'source back has attack·defense-movement');
 eq(reverse.pairedFaceId,f.faceId,'mutual face pairing');
 const rendered=Art.project({id:f.faceId,sourceFaceId:f.faceId,reverseFaceId:reverse.faceId,
  size:'corps',strengthStatus:'untried'},K);
 eq(rendered.printedValues,'?-6');eq(rendered.printedIdentifier,'*');eq(rendered.art.counter.nato,'mechanized');
 const revealed=Art.project({id:f.faceId,sourceFaceId:f.faceId,reverseFaceId:reverse.faceId,
  size:'corps',strengthStatus:'revealed-one-step',activeFaceId:reverse.faceId},K);
 eq(revealed.printedValues,reverse.visualTranscription.printedValues);
 eq(revealed.template,'army-3');eq(revealed.printedSize,'XXX');
 reverseIds.add(reverse.visualTranscription.printedIdentifier);
}
eq(reverseIds.size,10,'Ten source-distinct revealed identifiers');
eq(K.faces.front.filter(x=>x.visualTranscription.kind==='mechanized').length,10);
eq(K.faces.back.filter(x=>x.visualTranscription.kind==='mechanized').length,10);
eq(K.faces.front.filter(x=>x.visualTranscription.kind==='infantry'&&x.visualTranscription.printedAffiliation==='soviet').length,10);
eq(K.faces.front.filter(x=>x.visualTranscription.kind==='tank'&&x.visualTranscription.printedAffiliation==='axis').length,5);
eq(K.faces.front.filter(x=>x.visualTranscription.kind==='infantry'&&x.visualTranscription.printedAffiliation==='axis').length,11);
// The special Brest starting unit has the literal 3-4 face on the reverse of
// its location marker. Do not invent a front-face identity or silently use it.
eq(faces.get('arduous-front-r04c03').visualTranscription.kind,'location-marker');
eq(backs.get('arduous-back-r04c06').visualTranscription.printedValues,'3-4');
const fake=copy(K);
fake.faces.front.find(x=>x.faceId===hidden[0].faceId).visualTranscription.printedValues='FAKE';
fail(()=>Art.project({id:hidden[0].faceId,sourceFaceId:hidden[0].faceId,
 reverseFaceId:hidden[0].pairedFaceId,size:'corps',strengthStatus:'printed-full'},fake),
 /Unsupported printed ground face/, 'unverified printable face must fail');
const allCities=map.cells.filter(x=>x.city?.name).map(x=>x.city.name);
eq(allCities.length,12);eq(new Set(allCities).size,12);
const initial=Object.fromEntries(allCities.map(name=>[name,'soviet']));
const evalScore=Score.create({map,config,policy,initialCityControl:initial});
const at=n=>({units:{},cityControl:Object.fromEntries(allCities.map((name,i)=>[name,i<n?'german':'soviet']))});
for(let n=0;n<=12;n++){
 const result=evalScore.evaluate(at(n));
 eq(result.axisControlledCount,n);
 eq(result.totalCities,12);
 eq(result.outcome,n===12?'german-victory':n===11?'draw':'soviet-victory');
 eq(result.onlyRemainingCity,null);
 eq(result.onlyRemainingCityIsolated,null);
}
eq(evalScore.evaluate(at(11)).reason,'axis-controls-draw-threshold');
const last={scenarioId:'arduous',turn:7,index:8,complete:false};
eq(evalScore.close({cursor:last,state:at(12),actor:'system'}).terminal.outcome,'german-victory');
eq(evalScore.close({cursor:last,state:at(11),actor:'system'}).terminal.outcome,'draw');
eq(evalScore.close({cursor:last,state:at(10),actor:'system'}).terminal.outcome,'soviet-victory');
eq(evalScore.close({cursor:{...last,turn:6},state:at(11),actor:'system'}).terminal,null);
fail(()=>evalScore.close({cursor:{...last,index:7},state:at(11),actor:'system'}),/Housekeeping requires/);
fail(()=>Score.create({map,config,policy:{...policy,cityCount:13},initialCityControl:initial}),/Housekeeping city/);
fail(()=>Score.create({map,config,policy:{...policy,draw:{axisCityCount:10}},initialCityControl:initial}),/Housekeeping city/);
fail(()=>Score.create({map,config,policy:{...policy,mode:'source-literal-unclassified-cases'},initialCityControl:initial}),/Invalid source-bound/);
fail(()=>Score.create({map,config,policy:{...policy,unclassifiedOutcome:'german-victory'},initialCityControl:initial}),/Invalid source-bound/);
fail(()=>evalScore.evaluate({units:{},cityControl:{...at(11).cityControl,Fake:'german'}}),/Uninitialized or malformed/);
// Isolated COUNTER FACE parser compatibility test. The Leningrad graph supplies
// verified neighboring hexes for exercising the generic source-face parser;
// this is NOT Arduous map/gameplay, scoring, or Arduous combat-rule validation.
const testMap=require('../maps/leningrad.json');
const testMovement=require('../maps/movement-configs/leningrad.json');
const testPolicy=copy(require('../maps/combat-configs/leningrad.json'));
delete testPolicy.portSupport;
const attacker=faces.get('arduous-front-r01c06'),defender=hidden.find(f=>f.faceId==='arduous-front-r05c01');
const boardState={scenarioId:'leningrad',units:{}};
boardState.units[attacker.faceId]={id:attacker.faceId,sourceFaceId:attacker.faceId,
 reverseFaceId:attacker.pairedFaceId,owner:'german',class:'infantry',size:'corps',
 hex:'0310',mp:4,strengthStatus:'printed-full',printedCombatStrength:8};
boardState.units[defender.faceId]={id:defender.faceId,sourceFaceId:defender.faceId,
 reverseFaceId:defender.pairedFaceId,owner:'soviet',class:'mechanized',size:'corps',
 hex:'0309',mp:6,strengthStatus:'untried',printedCombatStrength:null};
const transaction=Consequences.create({map:testMap,profile:testMovement,counterConfig:K,
 combatPolicy:testPolicy,geography:Geography.create(testMap,testMovement,{cityMarkerMode:'source-typed-v1'})});
const battle={defenderHex:'0309',attackers:[attacker.faceId],defenders:[defender.faceId]};
eq(transaction.previewPostCasualty({state:boardState,battle,actor:'german',die:3}).outcome,'DE');
const resolved=transaction.resolve({state:boardState,battle,actor:'german',die:3});
eq(resolved.event.revealed,[defender.faceId],'Untried Arduous mech correctly revealed for combat');
eq(resolved.event.outcome,'DE');
eq(resolved.state.units[defender.faceId],undefined,'Eliminated hidden defender not retained');
eq(boardState.units[defender.faceId].strengthStatus,'untried','Original concealment survives immutable transaction');
// The later source-reviewed binding authorizes the 45 confirmed river hexsides.
eq(Movement.build(map,require('../maps/movement-configs/arduous.json')).metadata.riverEdges,45,'Source-reviewed river graph enabled');
console.log('PASS v410 Arduous photographed counters + §5 victory:',assertions,'assertions');
