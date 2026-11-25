#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const expected={
 arduous:{faces:40,ordinary:26,special:3,unresolved:11,examples:[['r01c01','24','12-6','axis'],['r03c03','GAME TURN',null,'neutral'],['r05c08',null,'?-6','axis']]},
 leningrad:{faces:32,ordinary:20,special:4,unresolved:8,examples:[['r01c04','1 Rsv','3-4','soviet'],['r04c08','Baltic Sea','1 / arrow','soviet'],['r02c03','48','8-4','soviet']]},
 kiev:{faces:40,ordinary:27,special:3,unresolved:10,examples:[['r02c08','Rom 3','6-4','romanian'],['r04c01','Italy CSIR','4-4','italian'],['r04c08','Hun CG','4-4','hungarian']]}
};
let faces=0,matched=0;
for(const [game,exp] of Object.entries(expected)){
 const d=JSON.parse(fs.readFileSync(path.join(root,'maps/counter-configs',game+'.json')));
 const backs=new Map(d.faces.back.map(f=>[f.faceId,f]));
 assert.equal(d.faceTranscription.status,'complete-face-level-manual-source-reading');
 assert.equal(d.faces.front.length,exp.faces);assert.equal(d.faces.back.length,exp.faces);
 assert.deepEqual(d.faceTranscription.pairValidation,{'printed-pair-agrees':exp.ordinary,'special-pair-agrees':exp.special,'unresolved':exp.unresolved});
 assert.equal(Object.keys(d.sourcePrintedUnitPairs).length,exp.ordinary);
 const claimed=new Set();
 for(const side of ['front','back'])for(const f of d.faces[side]){
  assert.equal(f.visualTranscription.status,'manually-reviewed-from-source-image');
  assert(f.visualTranscription.kind);assert(f.visualTranscription.printedAffiliation);
  assert.equal(f.unitId,null,'source transcription must not invent gameplay IDs: '+f.faceId);
 }
 for(const f of d.faces.front){
  const b=backs.get(f.pairedFaceId);
  assert(b&&b.column+f.column===9&&b.row===f.row);
  assert.equal(f.printedPairValidation,b.printedPairValidation);
  if(f.printedPairValidation==='printed-pair-agrees'){
   const k=f.sourceIdentityKey;
   assert(k&&!claimed.has(k),'nonunique printed identity '+k);claimed.add(k);
   assert.equal(b.sourceIdentityKey,k);
   assert.deepEqual(d.sourcePrintedUnitPairs[k],{front:f.faceId,back:b.faceId});
   for(const prop of ['kind','printedIdentifier','printedAffiliation'])assert.equal(f.visualTranscription[prop],b.visualTranscription[prop],k);
  }else assert(!f.sourceIdentityKey,'cannot assign unverified printed identity: '+f.faceId);
 }
 for(const [pos,identifier,values,affiliation] of exp.examples){
  const f=d.faces.front.find(f=>f.faceId===game+'-front-'+pos);
  assert(f,pos);assert.equal(f.visualTranscription.printedIdentifier,identifier,pos);
  assert.equal(f.visualTranscription.printedValues,values,pos);
  assert.equal(f.visualTranscription.printedAffiliation,affiliation,pos);
 }
 faces+=exp.faces*2;matched+=exp.ordinary;
}
console.log(`Printed counter transcriptions: ${faces} faces; ${matched} nonduplicate verified printed pairs; special/uncertain slots explicitly distinguished: PASS`);
