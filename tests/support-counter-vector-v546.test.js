#!/usr/bin/env node
/* Counterexample-driven qualification of source-to-SVG Support projection.
   No PNG data URLs and no screenshot artwork in the live Support window. */
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const V=require('../core/support_counter_vectors'),Art=require('../core/counter_visuals');
let checks=0;function ok(v,msg){assert.ok(v,msg);checks++;}
function eq(a,b,msg){assert.deepEqual(a,b,msg);checks++;}
const ids=new Set();
for(const game of ['leningrad','arduous','kiev','kiev-odessa-experimental-v531','odessa-extension']){
 const source=require('../maps/counter-configs/'+game+'.json');
 for(const f of [...source.faces.front,...source.faces.back]){
  if(!['air-support','air-marker','naval-marker'].includes(f.visualTranscription?.kind))continue;
  const key=game+':'+f.faceId;if(ids.has(key))continue;ids.add(key);
  const notation=String(f.visualTranscription?.visibleNotation||'');
  const condition=notation.includes('DAMAGED')?'damaged':notation.includes('REFIT')?'refit':'undamaged';
  const svg=V.render(f,{condition,shiftRating:notation.includes('2;')?2:1});
  ok(svg.includes('class="support-counter-svg"'),'vector SVG output '+key);
  ok(svg.includes('data-source-face-id="'+f.faceId+'"'),'exact physical face '+key);
  ok(svg.includes('class="counter-vector official-counter"'),'shared map-counter renderer '+key);
  ok(!/\b(?:<image\b|<img\b|data:image|\.png|<foreignObject\b)/.test(svg),'no photographs or bitmap clips '+key);
  ok(svg.includes('viewBox="-3 -3 56 56"'),'bleed-aware SVG viewport preserves source counter perimeter '+key);
  ok(svg.includes('fill:'+V.details(f,{shiftRating:notation.includes('2;')?2:1}).field),'color bound to original/source-corrected face '+key);
  if(condition==='refit')ok(svg.includes('support-svg-refit'),'reverse REFIT printed text vector '+key);
  if(condition==='damaged')ok(svg.includes('DAMAGED'),'reverse DAMAGED generated SVG '+key);
 }
}
const col=require('../maps/counter-configs/kiev-odessa-experimental-v531.json');
const pick=id=>[...col.faces.front,...col.faces.back].find(x=>x.faceId===id);
eq(V.details(pick('odessa-front-r01c01'),{shiftRating:1}).field,'#e5454d','bad crop color corrected only for support SVG');
eq(V.details(pick('odessa-front-r01c07'),{shiftRating:1}).title,'Rom I AK','original Romanian identifier restored');
eq(V.details(pick('odessa-back-r01c08'),{condition:'damaged',shiftRating:1}).template,'fleet','reverse Fleet retains authored SVG');
eq(V.details(pick('kiev-front-r03c01'),{shiftRating:1}).template,'air','one-plane FK IV template');
const l=require('../maps/counter-configs/leningrad.json');
const len=id=>[...l.faces.front,...l.faces.back].find(x=>x.faceId===id);
eq(V.details(len('leningrad-front-r04c04'),{shiftRating:2}).template,'stuka','two-aircraft FK VIII template');
eq(V.details(len('leningrad-front-r04c05'),{shiftRating:1}).field,'#8ba396','black aircraft sample cannot paint source field black');
const support=fs.readFileSync('core/support_window.js','utf8'),app=fs.readFileSync('core/historical_browser_app.js','utf8');
ok(!support.includes('img.src=')&&!app.includes('WargameSupportCounterArt'),'active Support renderer has no cropped PNG path');
ok(support.includes('vectorSvg'),'Support window only renders supplied vector markup');
for(const page of ['leningrad/native-preview','arduous/native-preview','kiev/setup-preview','kiev-odessa/experimental-preview']){
 const html=fs.readFileSync('games/'+page+'/index.html','utf8');
 ok(html.includes('core/support_counter_vectors.js'),'loaded shared SVG adapter '+page);
 ok(!html.includes('core/support_counter_art_bundle.js'),'no bitmap bundle '+page);
}
assert.throws(()=>V.render({faceId:'fake',visualTranscription:{kind:'infantry'}},{shiftRating:1}),/registered special counter face/);checks++;
console.log('PASS v546 Support SVG source projection:',checks,'assertions; source faces:',ids.size);
