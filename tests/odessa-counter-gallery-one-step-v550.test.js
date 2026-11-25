#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=require('../maps/counter-configs/kiev-odessa-experimental-v531.json');
const opening=require('../games/kiev-odessa/experimental-preview/opening-v531.json');
const Project=require('../core/historical_counter_face_projection');
const Art=require('../core/counter_visuals');
const oneStep=new Set(['kiev-odessa/romanian-cavalry-corps','kiev-odessa/soviet-cavalry-corps-a','kiev-odessa/soviet-cavalry-corps-b']);
const front=new Map(source.faces.front.map(f=>[f.faceId,f]));
const back=new Map(source.faces.back.map(f=>[f.faceId,f]));
let n=0;const eq=(x,y,m)=>{assert.deepEqual(x,y,m);n++};const yes=(x,m)=>{assert.ok(x,m);n++};
const originals=structuredClone(opening.contextStart.state.units);
for(const [id,u] of Object.entries(opening.contextStart.state.units)){
 const f=front.get(u.sourceFaceId),b=back.get(u.reverseFaceId);
 yes(f&&b&&f.pairedFaceId===b.faceId&&b.pairedFaceId===f.faceId,'Original face pairing: '+id);
 if(oneStep.has(id)){
  eq(u.strengthStatus,'printed-reduced','Original runtime reverse-only face index remains unchanged');
  eq(f.role,'blank-face-of-single-sided-cavalry-counter','Blank physical front evidenced');
  eq(b.role,'single-sided-cavalry-printed-face','Only playable reverse evidenced');
  const rendered=Project.project(u,source);
  eq(rendered.faceId,b.faceId,'Source-pinned printed face retained');
  eq(rendered.displayStatus,'one-step-single-sided','UI denotes single-step, not damage');
  eq(rendered.art.strength,'full','No false damage state on printed cavalry');
  const vars=Art.model(rendered.art,'#ffffff').vars;
  eq(vars.status_reduced,'none','Damage stripe invisible');
  const svg=Art.piece(rendered.art,0,0,'#ffffff');
  yes(svg.includes('data-damaged="false"'),'Official SVG draws undamaged cavalry');
  yes(svg.includes('data-role="status_reduced"'),'Authored bar still in original template');
  yes(/data-role="status_reduced"/.test(svg),'Artwork untouched');
 }else if(f.visualTranscription?.kind==='mechanized'){
  const concealed=Project.project({...u,strengthStatus:'untried',activeFaceId:u.sourceFaceId},source);
  const revealed=Project.project({...u,strengthStatus:'revealed-one-step',activeFaceId:u.reverseFaceId},source);
  eq(concealed.displayStatus,'one-step-untried','Untried not damaged');
  eq(revealed.displayStatus,'one-step-revealed','Reveal not damage');
  eq(Art.model(revealed.art,'#ffffff').vars.status_reduced,'none','Revealed Corps has no damaged strip');
 }else{
  const normal=Project.project(u,source);
  yes(['full','reduced'].includes(normal.displayStatus),'Other ground source faces unchanged: '+id);
 }
}
const html=fs.readFileSync(path.join(__dirname,'../rules/audit/visual/kiev-odessa-source-counter-gallery-v550.html'),'utf8');
for(const id of oneStep){yes(html.includes(`data-gallery-unit="${id}" data-gallery-category="single-sided"`),'Gallery marks one-step '+id)}
eq((html.match(/data-gallery-category="untried"/g)||[]).length,10,'All 10 concealed Corps retained');
eq((html.match(/data-gallery-category="single-sided"/g)||[]).length,3,'Three one-sided cavalry');
eq((html.match(/data-gallery-category="support"/g)||[]).length,4,'Four support entries');
eq((html.match(/data-gallery-unit="original-reserve:/g)||[]).length,7,'Six original reinforcements and one replacement-only reserve');
eq(opening.contextStart.state.units,originals,'Pure presentation does not mutate starting campaign state');
console.log('PASS Kiev–Odessa one-step source gallery v550:',n,'assertions');
