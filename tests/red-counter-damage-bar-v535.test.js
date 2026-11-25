#!/usr/bin/env node
'use strict';
// Source art is untouched: the shared SVG renderer chooses only strip fill.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const Art=require('../core/counter_visuals');
const Projection=require('../core/historical_counter_face_projection');
const T=require('../core/official_counter_templates');
const manifest=require('../assets/official-counters/source-manifest.json');
let checks=0;
function eq(actual,expected,message){assert.equal(actual,expected,message);checks++}
function check(condition,message){assert.ok(condition,message);checks++}
function strip(svg){const tag=svg.match(/<path[^>]*data-role="status_reduced"[^>]*>/);check(tag,'source template damage strip exists');return tag[0];}
const source=fs.readFileSync('assets/official-counters/source-counters.svg');
eq(crypto.createHash('sha256').update(source).digest('hex'),manifest.source_sha256,'original user SVG unchanged');
for(const kind of Art.KINDS){
 check(T[kind].includes('fill:@@color_reduced_bar@@'),'shared template has fill substitution: '+kind);
 for(const [background,expected] of [
  ['#e64652','#ffffff'], // Soviet scarlet front
  ['#f8a19a','#ffffff'], // Soviet salmon reduced reverse
  ['#c15854','#ffffff'], // muted red historical unit
  ['#b55f5e','#ffffff'], // Odessa red field
  ['#d7a477','#ff0000'], // ochre remains conventional
  ['#8ca095','#ff0000'], // German gray-green
  ['#95b5de','#ff0000'], // blue support
  ['#997c6c','#ff0000'], // brown is not red
  ['#9474b5','#ff0000']  // purple is not red
 ]){
  const base={id:kind+'-test',strength:'reduced',counter:{template:kind,colors:{primary:background}}};
  const svg=Art.piece(base,0,0);
  check(strip(svg).includes('fill:'+expected),`${kind} ${background}: damage strip should be ${expected}`);
  check(strip(Art.piece({...base,strength:'full'})).includes('display:none'),`${kind} ${background}: healthy face must not show strip`);
 }
 const overridden=Art.piece({id:'custom',strength:'reduced',counter:{template:kind,colors:{primary:'#e64652',reducedBar:'#ffcc00'}}});
 check(strip(overridden).includes('fill:#ffcc00'),kind+' explicit scenario strip override');
}
// Verify source-paired historical reverse face, not an arbitrary invented Soviet pink.
const cfg=require('../maps/counter-configs/kiev.json');
const f=cfg.faces.front.find(f=>f.faceId==='kiev-front-r03c04');
const b=cfg.faces.back.find(b=>b.faceId===f.pairedFaceId);
eq(f.observedFieldColor,'#e4494d','actual Kiev scarlet front');
eq(b.observedFieldColor,'#f8a19a','actual Kiev reduced salmon reverse');
for(const [status,active,expectedDisplay] of [['printed-full',f.faceId,'none'],['printed-reduced',b.faceId,'inline']]){
 const projected=Projection.project({id:'soviet-red',sourceFaceId:f.faceId,reverseFaceId:b.faceId,activeFaceId:active,strengthStatus:status,size:'corps'},cfg);
 const s=strip(Art.piece(projected.art));
 check(s.includes('fill:#ffffff'),'source-paired Soviet red family gets white status strip');
 check(s.includes('display:'+expectedDisplay),'only printed-reduced actually displays strip');
}
console.log('PASS shared counter white-on-red reduced bar v535',checks,'assertions');
