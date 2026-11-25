'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const M=require('../maps/arduous.json'),C=require('../maps/counter-configs/arduous.json');
const policy=require('../maps/setup/arduous-fixed-pieces.json');
const G=require('../core/historical_fixed_source_pieces');
const P=require('../core/historical_counter_face_projection');
const clone=o=>JSON.parse(JSON.stringify(o));
let checks=0;const eq=(a,b,m)=>{A.deepEqual(a,b,m);checks++;};const deny=(f,re)=>{A.throws(f,re);checks++;};
// The actual original source sheets, not generated artwork, define the pair.
for(const side of ['front','back']){const s=C.faceSource[side];eq(crypto.createHash('sha256').update(fs.readFileSync(s.file)).digest('hex'),s.sha256);}
const result=G.initialize({map:M,counterConfig:C,policy});
const u=result.state.units['arduous:brest-garrison'];
eq(Object.keys(result.state.units),[u.id]);eq(u.hex,'0211');eq(u.owner,'soviet');
eq(u.printedCombatStrength,3);eq(u.mp,4);eq(u.strengthStatus,'printed-reduced');
eq(u.activeFaceId,'arduous-back-r04c06');eq(result.historicalFullSetupCertified,false);
const art=P.project(u,C);eq(art.side,'back');eq(art.faceId,u.activeFaceId);eq(art.printedValues,'3-4');
eq(art.art.counter.nato,'infantry');eq(art.art.counter.template,'army-2');
// Do not allow a marker face to masquerade as a full-strength unit.
deny(()=>P.project({...u,strengthStatus:'printed-full',activeFaceId:u.sourceFaceId},C),/Unsupported printed ground face/);
// Source ownership is rule-backed: visual transcription is deliberately kept.
eq(C.faces.back.find(f=>f.faceId===u.reverseFaceId).visualTranscription.printedAffiliation,'axis');
const withOther=G.initialize({map:M,counterConfig:C,policy,state:{units:{other:{id:'other',hex:'0310'}}}});
eq(withOther.state.units.other.hex,'0310');
eq(Object.keys(withOther.state.units).length,2);
deny(()=>G.initialize({map:M,counterConfig:C,policy,state:result.state}),/piece-already-assigned/);
for(const [key,value] of [['hex','0910'],['markerSourceSvgId','use334'],['reverseFaceId','arduous-back-r04c04'],['expectedBackPrintedValues','4-4'],['owner','neutral'],['activeSide','front'],['expectedBackPrintedAffiliation','soviet']]){
 const bad=clone(policy);bad.pieces[0][key]=value;deny(()=>G.initialize({map:M,counterConfig:C,policy:bad}),/fixed-source-piece/);
}
{const wrong=clone(M);wrong.cells.find(c=>c.id==='0211').tileMarkers=[];deny(()=>G.initialize({map:wrong,counterConfig:C,policy}),/map-marker/);}
{const wrong=clone(C);wrong.faces.back.find(f=>f.faceId===u.reverseFaceId).visualTranscription.printedValues='9-9';deny(()=>G.initialize({map:M,counterConfig:wrong,policy}),/map-marker/);}
{const wrong=clone(policy);wrong.scenarioId='kiev';deny(()=>G.initialize({map:M,counterConfig:C,policy:wrong}),/invalid-source/);}
console.log('PASS Arduous source-bound one-step Brest garrison:',checks,'assertions');
