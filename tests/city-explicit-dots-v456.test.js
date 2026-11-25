'use strict';
/* v456 introduced 24 explicitly placed circles per city; v457 retains all
 * of them and removes the later-superseded extra perimeter polygon. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'), manifest=require('../exports/manifest.json');
let checks=0,cityCount=0,dotCount=0;
const ok=(v,m)=>{assert.ok(v,m);checks++};
const attr=(tag,key)=>tag.match(new RegExp(`${key}="([^"]+)"`))?.[1];
for(const id of ['battle-for-moscow','arduous','leningrad','kiev','kiev-odessa']){
 const svg=fs.readFileSync(path.join(root,'exports',id+'.svg'),'utf8');
 ok(!svg.includes('class="city-hex-border"'),`${id}: user removed extra solid perimeter`);
 const dots=[...svg.matchAll(/<circle class="city-hex-highlight"[^>]*\/>/g)].map(m=>m[0]);
 const map=new Map();
 for(const tag of dots){
  const cid=attr(tag,'data-city-hex');
  if(!map.has(cid))map.set(cid,[]);
  map.get(cid).push(tag);
  ok(attr(tag,'r')==='2.25', `${id}/${cid}: reduced diameter preserved`);
 }
 for(const [cid,arr] of map){
  ok(arr.length===24,`${id}/${cid}: 24 explicit dots`);
  const roles={vertex:0,quarter:0,midpoint:0};
  for(const t of arr)roles[attr(t,'data-city-dot-role')]++;
  ok(roles.vertex===6&&roles.midpoint===6&&roles.quarter===12,`${id}/${cid}: 6+6+12 symmetry`);
 }
 ok(manifest.some(x=>x.id===id&&x.errors.length===0),`${id}: valid export`);
 cityCount+=map.size;dotCount+=dots.length;
}
ok(cityCount===73&&dotCount===1752,'73 cities x 24 exact dots');
const asset=fs.readFileSync(path.join(root,'supplied_assets/flat/city-hex-highlight.svg'),'utf8');
ok((asset.match(/<circle /g)||[]).length===24&&!asset.includes('<polygon'),'optional art matches current dots-only style');
console.log(`PASS v456→v457: ${checks} current explicit-dot assertions`);
