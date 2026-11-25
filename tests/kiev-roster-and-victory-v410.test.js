'use strict';
/* Checkpoint 176 — published Kiev §5 and genuine counter source sheets.
 * This does NOT authorize unfinished Kiev map/setup movement gameplay.
 */
const A=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const K=require('../maps/counter-configs/kiev.json');
const M=require('../maps/kiev.json');
const F=require('../maps/phase-configs/kiev.json');
const P=require('../maps/housekeeping-configs/kiev.json');
const Score=require('../core/historical_housekeeping_phase');
const Art=require('../core/historical_counter_face_projection');
const Binding=require('../core/movement_binding');
let assertions=0;
const eq=(a,b,msg)=>{A.deepEqual(a,b,msg);assertions++};
const ok=(x,msg)=>{A.ok(x,msg);assertions++};
const fail=(fn,re)=>{A.throws(fn,re);assertions++};
const clone=x=>JSON.parse(JSON.stringify(x));
for(const side of ['front','back']){
 const source=K.faceSource[side];
 eq(crypto.createHash('sha256').update(fs.readFileSync(source.file)).digest('hex'),source.sha256,side+' source checksum');
}
const visible=K.faces.front,backs=new Map(K.faces.back.map(f=>[f.faceId,f]));
const hidden=visible.filter(f=>f.visualTranscription.printedValues==='?-6');
eq(hidden.length,10);eq(K.concealedMechanizedFacePairs.length,10);
const reverseIds=new Set();
for(const f of hidden){
 const b=backs.get(f.pairedFaceId);ok(b);
 eq(f.visualTranscription.kind,'mechanized');eq(f.visualTranscription.printedAffiliation,'soviet');
 eq(f.visualTranscription.printedIdentifier,'*');
 eq(b.visualTranscription.kind,'mechanized');eq(b.visualTranscription.printedAffiliation,'soviet');
 eq(b.pairedFaceId,f.faceId);
 ok(/^\d+·\d+·6$/.test(b.visualTranscription.printedValues));
 const image=Art.project({id:f.faceId,sourceFaceId:f.faceId,reverseFaceId:b.faceId,
  size:'corps',strengthStatus:'untried'},K);
 eq(image.printedIdentifier,'*');eq(image.printedValues,'?-6');
 const revealed=Art.project({id:f.faceId,sourceFaceId:f.faceId,reverseFaceId:b.faceId,
  size:'corps',strengthStatus:'revealed-one-step',activeFaceId:b.faceId},K);
 eq(revealed.printedValues,b.visualTranscription.printedValues);eq(revealed.art.counter.nato,'mechanized');
 reverseIds.add(b.visualTranscription.printedIdentifier);
}
eq(reverseIds.size,10);
eq(visible.filter(f=>f.visualTranscription.kind==='mechanized').length,10);
// All 16 source-registered cities, two Axis-controlled before the first turn.
const cityNames=M.cells.filter(c=>c.city?.name).map(c=>c.city.name);
eq(cityNames.length,16);eq(new Set(cityNames).size,16);
const initial=Object.fromEntries(cityNames.map(name=>[name,P.initialControlOverrides[name]||P.initialDefaultOwner]));
eq(initial.Lublin,'german');eq(initial.Iasi,'german');
eq(Object.values(initial).filter(x=>x==='german').length,2);
const score=Score.create({map:M,config:F,policy:P,initialCityControl:initial});
const state=(count)=>({units:{},cityControl:Object.fromEntries(cityNames.map((name,i)=>[name,i<count?'german':'soviet']))});
for(let n=0;n<=16;n++){
 const r=score.evaluate(state(n));
 eq(r.axisControlledCount,n);
 eq(r.outcome,n===16?'german-victory':n===15?'draw':'soviet-victory');
 eq(r.onlyRemainingCity,null);
}
eq(score.evaluate({units:{},cityControl:initial}).outcome,'soviet-victory');
const finalCursor={scenarioId:'kiev',turn:7,index:8,complete:false};
eq(score.close({cursor:finalCursor,state:state(16),actor:'system'}).terminal.outcome,'german-victory');
eq(score.close({cursor:finalCursor,state:state(15),actor:'system'}).terminal.outcome,'draw');
eq(score.close({cursor:finalCursor,state:state(14),actor:'system'}).terminal.outcome,'soviet-victory');
eq(score.close({cursor:{...finalCursor,turn:6},state:state(15),actor:'system'}).terminal,null);
fail(()=>Score.create({map:M,config:F,policy:P,initialCityControl:{...initial,Lublin:'soviet'}}),/Housekeeping city/);
fail(()=>Score.create({map:M,config:F,policy:P,initialCityControl:{...initial,Iasi:'soviet'}}),/Housekeeping city/);
fail(()=>Score.create({map:M,config:F,policy:{...P,initialControlOverrides:{Other:'german'}},initialCityControl:initial}),/Housekeeping city/);
fail(()=>Score.create({map:M,config:F,policy:{...P,germanVictoryAtLeast:15},initialCityControl:initial}),/Housekeeping city/);
eq(Binding.build(M,require('../maps/movement-configs/kiev.json')).board.edges.length,442,'source-reviewed experimental graph');
console.log('PASS v410 Kiev photographed counters + §5 victory:',assertions,'assertions');
