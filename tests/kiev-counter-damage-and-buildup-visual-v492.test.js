'use strict';
// The user's counters-temp SVG defines the LEFT damage strip. Verify that
// source-paired historical faces expose it only for printed step reduction.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const Projection=require('../core/historical_counter_face_projection');
const Art=require('../core/counter_visuals');
const cfg=require('./fixtures/kiev-source-opening-v437').counterConfig;
let checks=0;
const eq=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};
const ok=(condition,message)=>{assert.ok(condition,message);checks++;};
const source=fs.readFileSync('assets/official-counters/source-counters.svg');
const manifest=require('../assets/official-counters/source-manifest.json');
eq(crypto.createHash('sha256').update(source).digest('hex'),manifest.source_sha256,'unmodified user-authored SVG source hash');
const front=id=>cfg.faces.front.find(f=>f.faceId===id);
function unit(id,strengthStatus){
 const f=front(id);ok(f,'original source front face exists: '+id);
 return {id:'test-'+strengthStatus,sourceFaceId:f.faceId,reverseFaceId:f.pairedFaceId,
   strengthStatus,activeFaceId:strengthStatus==='printed-full'||strengthStatus==='untried'?f.faceId:f.pairedFaceId,
   size:'corps'};
}
function redBand(u,expected,values,stripFill){
 const face=Projection.project(u,cfg);
 eq(face.printedValues,values,'correct printed values preserved');
 eq(face.art.strength,expected?'reduced':'full','source red band controlled by printed-reduced status only');
 const svg=Art.piece(face.art,0,0,'#fff');
 eq(svg.includes('data-damaged="true"'),expected,'authored counter reduced state');
 const role=svg.match(/<path[^>]*data-role="status_reduced"[^>]*>/)?.[0];
 ok(role,'red band role from original user vector template exists');
 ok(role.includes('fill:'+stripFill),'face-aware damage stripe contrast');
 eq(role.includes('display:inline'),expected,'red band SVG visibility');
 ok(svg.includes(values.split(/[·-]/)[0]),'displayed printed digits retained');
}
redBand(unit('kiev-front-r03c04','printed-full'),false,'8-4','#ffffff');
redBand(unit('kiev-front-r03c04','printed-reduced'),true,'4-4','#ffffff');
// An exposed formerly concealed one-step Mechanized Corps is NOT a newly
// damaged two-step counter; don't confuse exposure with step reduction.
redBand(unit('kiev-front-r05c03','untried'),false,'?-6','#ff0000');
redBand(unit('kiev-front-r05c03','revealed-one-step'),false,'4·2·6','#ff0000');
const css=fs.readFileSync('games/leningrad/native-preview/style.css','utf8');
const browser=fs.readFileSync('core/historical_browser_app.js','utf8');
ok(css.includes('body.buildup-map-active #counter-overlay .hex-hit:not([data-buildup-action]):hover'),
  'non-action hex hover suppressed during buildup');
ok(browser.includes("(buildup.repairByHex[hex]||[]).length>1"),
  'only a stack with multiple eligible repairs gets top-target outline');
ok(browser.includes('BuildupMap.actionAtHex(buildup,hex,units)?.unitId')&&browser.includes('u.id===repairTarget'),
  'only eligible selected repair target receives outline');
ok(browser.includes("document.body.classList.toggle('buildup-map-active',m.active)"),
  'buildup hover guard follows phase state');
ok(!browser.includes("buildup.mode==='repair'&&units.length>1&&i===units.length-1"),
  'old generic stack outline logic removed');
console.log('PASS Kiev reduced-source SVG and buildup highlight v492',checks,'assertions');
