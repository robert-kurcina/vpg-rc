#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const C=require('../core/counter_visuals');
const registry=require('../maps/registry.json');
const metric={};
assert.equal(C.COUNTER_TO_HEX_HEIGHT,46/101.9);
for(const id of ['battle-for-moscow','arduous','leningrad','kiev','kiev-odessa']){
 const entry=registry.maps.find(x=>x.id===id);assert(entry,`missing ${id}`);
 const exportText=fs.readFileSync(path.join(root,'exports',id+'.svg'),'utf8');
 const clip=/\bdata-hex-id=/.test(exportText);
 assert(clip,`The shared renderer export lacks hex cells for ${id}`);
 const polygon=exportText.match(/<clipPath[^>]*><polygon points="([^"]+)"/);
 assert(polygon,`missing physical hex clip geometry ${id}`);
 const points=polygon[1].split(/\s+/).map(x=>x.split(',').map(Number));
 const hexHeight=Math.max(...points.map(v=>v[1]))-Math.min(...points.map(v=>v[1]));
 const size=C.sizeForHexHeight(hexHeight);
 assert(Math.abs(size/hexHeight-C.COUNTER_TO_HEX_HEIGHT)<0.00003,`${id}: inconsistent visual ratios`);
 assert(size<hexHeight,`${id}: counter obscures hex`);
 const expected=id==='battle-for-moscow'?46:id==='arduous'?22.638:id==='leningrad'?29.95:30;
 assert(Math.abs(size-expected)<0.1,`${id}: ${size} does not match physical map grid`);
 if(id!=='kiev-odessa'){
  const map=require('../maps/'+id+'.json');
  const modelSize=C.sizeForMap(map);
  assert(Math.abs(modelSize-size)<0.1,`${id}: map geometry disagrees with exported hex`);
 }
 metric[id]={hexHeight:Number(hexHeight.toFixed(3)),counterSize:size,ratio:Number((size/hexHeight).toFixed(5))};
}
const native=fs.readFileSync(path.join(root,'core/native_browser_view.js'),'utf8');
const historical=fs.readFileSync(path.join(root,'core/historical_browser_app.js'),'utf8');
const generic=fs.readFileSync(path.join(root,'app.js'),'utf8');
assert(native.includes('Counters.sizeForHexHeight(')&&!native.includes('{width:46,height:46'));
assert(historical.includes('Art.sizeForMap(')&&!historical.includes('width=41,height=41'));
assert(generic.includes('WargameCounterVisuals.sizeForHexHeight('));
for(const h of [-1,0,NaN,Infinity,'65',null])assert.throws(()=>C.sizeForHexHeight(h));
assert.throws(()=>C.sizeForMap({cells:[]}));
console.log('PASS universal counter geometry',JSON.stringify(metric));
