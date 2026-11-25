#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const data=require('../maps/counter-configs/leningrad.json');
const Face=require('../core/historical_counter_face_projection');
const Art=require('../core/counter_visuals');
let n=0;
const eq=(a,b,msg)=>{A.deepEqual(a,b,msg);n++};
const ok=(v,msg)=>{A.ok(v,msg);n++};
const fail=(fn,msg)=>{A.throws(fn,undefined,msg);n++};
for(const side of ['front','back']){
 const expected=fs.readFileSync(path.join(root,data.faceSource[side].file));
 eq(crypto.createHash('sha256').update(expected).digest('hex'),data.faceSource[side].sha256,'canonical sheet SHA-256');
}
const backs=new Map(data.faces.back.map(f=>[f.faceId,f]));
let ground=0,hidden=0,redArmy=0,backTriples=0;
for(const f of data.faces.front){
 const t=f.visualTranscription;
 if(!['infantry','mechanized','tank'].includes(t.kind))continue;
 ground++;
 const b=backs.get(f.pairedFaceId);ok(Boolean(b)&&b.pairedFaceId===f.faceId,'canonical mirrored front/back pairing');
 const army=t.printedAffiliation==='soviet'&&t.printedValues==='8-4';
 const unit={id:f.faceId,sourceFaceId:f.faceId,reverseFaceId:b.faceId,unitId:null,
  strengthStatus:t.kind==='mechanized'?'untried':'printed-full',
  size:army?'army':'corps'};
 const front=Face.project(unit,data);
 eq(front.side,'front','front displayed by full/untried status');
 eq(front.printedValues,t.printedValues,'unmodified front printed values');
 eq(front.printedIdentifier,t.printedIdentifier??'','front identifier must be exactly the source');
 eq(front.printedSize,army?'XXXX':'XXX','printed army and corps designations');
 eq(front.template,t.printedValues.includes('·')?'army-3':'army-2','number-of-values template front');
 const frontSvg=Art.piece(front.art,0,0,'#ccc');
 ok(!frontSvg.includes('@@'),'every source template field substituted');
 ok(!frontSvg.includes(f.faceId+'</tspan>'),'internal face ID cannot render as vertical identifier');
 ok(frontSvg.includes('>'+front.printedIdentifier+'</tspan>')||front.printedIdentifier==='','front label projected');
 ok(frontSvg.includes('fill:#000000'),'printed digits use source black');
 if(t.kind==='mechanized'){
  hidden++;eq(t.printedIdentifier,'*','four source-concealed mechanized faces carry an asterisk');
  eq(front.printedValues,'?-6','concealed combat strength is printed unknown');
 }
 if(army){redArmy++;eq(front.printedSize,'XXXX','Soviet Army four-X insignia');}
 const reduced={...unit,strengthStatus:t.kind==='mechanized'?'revealed-one-step':'printed-reduced',activeFaceId:b.faceId};
 if(b.visualTranscription.kind==='blank'){
  fail(()=>Face.project(reduced,data),'one-step Soviet Corps cannot display blank reverse as reduced combat face');
  continue;
 }
 const reverse=Face.project(reduced,data);
 eq(reverse.side,'back','reduced/revealed state displays canonical reverse');
 eq(reverse.printedValues,b.visualTranscription.printedValues,'back shows distinct source string');
 eq(reverse.printedIdentifier,b.visualTranscription.printedIdentifier??'','back name from paired source');
 eq(reverse.template,b.visualTranscription.printedValues.includes('·')?'army-3':'army-2','three-digit reverse template');
 eq(reverse.art.counter.colors.primary,b.observedFieldColor,'reverse face color');
 const backSvg=Art.piece(reverse.art,0,0,'#ccc');
 ok(!backSvg.includes(f.faceId+'</tspan>'),'front source ID not rendered on reverse');
 ok(backSvg.includes('>'+reverse.printedIdentifier+'</tspan>')||reverse.printedIdentifier==='','reverse label projected');
 if(t.kind==='mechanized'){
  backTriples++;eq(reverse.art.counter.faces.full.digits.length,3,'revealed mechanized has three numbers');
  ok(/\d+·\d+·6/.test(reverse.printedValues),'revealed strength, defense, and move');
 }
 fail(()=>Face.project({...unit,activeFaceId:b.faceId},data),'front status cannot use unauthorized back face');
 fail(()=>Face.project({...reduced,activeFaceId:f.faceId},data),'back status must use its paired back face');
}
for(let i=5;i<=8;i++){
 const f=data.faces.front.find(x=>x.row===1&&x.column===i);
 ok(f?.visualTranscription.printedIdentifier==='*','canonical front concealment asterisk');
}
for(const [frontId,backId,frontValue,backValue] of [
 ['r01c05','r01c04','?-6','2·1·6'],
 ['r01c06','r01c03','?-6','6·3·6'],
 ['r01c07','r01c02','?-6','4·2·6'],
 ['r01c08','r01c01','?-6','4·2·6'],
 ['r02c01','r02c08','8-4','4-4'],
 ['r03c01','r03c08','12-6','6-6']
]){
 const f=data.faces.front.find(x=>x.faceId==='leningrad-front-'+frontId);
 eq(f.visualTranscription.printedValues,frontValue,'canonical front pair '+frontId);
 eq(backs.get(f.pairedFaceId).faceId,'leningrad-back-'+backId,'mirrored pairing '+frontId);
 eq(backs.get(f.pairedFaceId).visualTranscription.printedValues,backValue,'canonical reverse pair '+frontId);
}
eq(ground,28,'28 ground counters with source pairs');
eq(hidden,4,'four untried mechanized Corps');
eq(redArmy,8,'eight Soviet Army fronts');
eq(backTriples,4,'four revealed three-value mechanized reverses');
console.log(`Counter source-face projection v403: ${n} assertions PASS; ${ground} ground front/back pairs checked; four concealed/revealed Corps; sheet SHA256 verified`);
