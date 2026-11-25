'use strict';
/* The original Romanian cavalry reverse faces are light blue. As source-
   authorized one-step / single-sided pieces, no damage stripe is displayed. */
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const Visuals=require('../core/counter_visuals');
const Projection=require('../core/historical_counter_face_projection');
const source=require('../maps/counter-configs/odessa-extension.json');
const combined=require('../maps/counter-configs/kiev-odessa-experimental-v531.json');
const opening=require('../games/kiev-odessa/experimental-preview/opening-v531.json');
let checks=0;
function eq(a,b,label){assert.deepStrictEqual(a,b,label);checks++}
function ok(value,label){assert.ok(value,label);checks++}
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
eq(sha('assets/official-counters/source-sheets/counters-odessa-back.jpg'),source.faceSource.back.sha256,'Original Odessa reverse source sheet preserved');
eq(sha('assets/official-counters/source-sheets/counters-odessa-front.jpg'),source.faceSource.front.sha256,'Original Odessa front source sheet preserved');
const repaired={'odessa-back-r01c01':'#c8d7ee','odessa-back-r02c01':'#c5d4e2'};
for(const [faceId,expected] of Object.entries(repaired)){
 for(const [name,cfg] of Object.entries({source,combined})){
  const f=cfg.faces.back.find(x=>x.faceId===faceId);
  ok(f,`${name} has ${faceId}`);
  eq(f.observedFieldColor,expected,`${name} source-pixel-backed cavalry field ${faceId}`);
  eq(f.visualTranscription.printedAffiliation,'romanian','Correct nationality');
  eq(f.visualTranscription.kind,'cavalry','Correct unit class');
  eq(f.visualTranscription.visibleNotation,'Rom; XXX; cavalry; 3-4','Correct printed source values');
  ok(cfg.faces.front.some(front=>front.faceId===f.pairedFaceId&&front.pairedFaceId===faceId),'Original reverse/front face pair retained');
 }
 const back=source.faces.back.find(x=>x.faceId===faceId);
 const mock={id:'romanian-cavalry-'+faceId,sourceFaceId:back.pairedFaceId,reverseFaceId:faceId,activeFaceId:faceId,strengthStatus:'printed-reduced',size:'corps'};
 const projected=Projection.project(mock,combined);
 eq(projected.faceId,faceId,'Projection uses actual original reverse');
 eq(projected.art.strength,'full','Single-sided printed reverse is displayed as an undamaged one-step piece');
 eq(projected.art.counter.faces.damaged.color,expected,'Displayed visible field uses source color');
 const painted=Visuals.model(projected.art,'#aabbcc');
 eq(painted.vars.primary,expected,'Shared renderer receives original color');
 eq(painted.vars.status_reduced,'none','One-step cavalry has no damage stripe');
 const svg=Visuals.piece(projected.art,0,0,'#aabbcc');
 ok(svg.includes('data-damaged="false"'),'One-step cavalry face is not misleadingly marked damaged');
 ok(svg.includes('fill:'+expected),'Original Romanian blue emitted by shared SVG renderer');
 ok(/<path[^>]*display:none[^>]*data-role="status_reduced"/.test(svg),'Original damage-bar shape is hidden for one-step cavalry');
}
const state=opening.contextStart.state;
// The shared experimental opening puts the displayed cavalry in hex 1010.
const candidate=state.units?.['kiev-odessa/romanian-cavalry-corps']||opening.units?.['kiev-odessa/romanian-cavalry-corps'];
ok(candidate,'Kiev–Odessa opening contains Romanian cavalry');
eq(candidate.hex,'1010','Screenshot counter is at hex 1010');
eq(candidate.nationality,'romanian','Screenshot counter remains Romanian');
eq(candidate.reverseFaceId,'odessa-back-r01c01','Screenshot counter uses original photographed reverse');
// The source-based projection applies to composed gameplay config too.
const projected=Projection.project({id:'1010',sourceFaceId:candidate.sourceFaceId,reverseFaceId:candidate.reverseFaceId,activeFaceId:candidate.activeFaceId,strengthStatus:candidate.strengthStatus,size:candidate.size},combined);
eq(Visuals.model(projected.art,'#ffffff').vars.primary,'#c8d7ee','Hex 1010 face is pale blue not white');
eq(Visuals.model(projected.art,'#ffffff').vars.status_reduced,'none','Hex 1010 is not marked damaged');
console.log('PASS Odessa original Romanian cavalry source colors v536',checks,'assertions');
