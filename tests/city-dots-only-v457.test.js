'use strict';
/** Current shared-engine city overlay: exactly 24 dots per City, no extra solid border.
 * The ordinary grid and all other geography remain independent. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const manifest=require('../exports/manifest.json');
const P=require('../core/presentation');
const ids=['battle-for-moscow','arduous','leningrad','kiev','kiev-odessa'];
const expectedCities={'battle-for-moscow':11,'arduous':12,'leningrad':14,'kiev':16,'kiev-odessa':20};
let checks=0, allDots=0;
function ok(v,message){assert.ok(v,message); checks++;}
const attr=(tag,key)=>tag.match(new RegExp(`${key}="([^"]+)"`))?.[1];
const point=tag=>[Number(attr(tag,'cx')),Number(attr(tag,'cy'))];
for(const id of ids){
 const opts=P.options(id);
 ok(!Object.hasOwn(opts,'cityBorderSolidWidth'),`${id}: retired heavy border setting`);
 const svg=fs.readFileSync(path.join(root,'exports',`${id}.svg`),'utf8');
 ok(!svg.includes('class="city-hex-border"'),`${id}: no extra city perimeter polygons`);
 ok(!svg.includes('<image class="city-hex-highlight"'),`${id}: no city bitmap substitute`);
 ok(svg.includes('data-layer="hex-grid"'),`${id}: ordinary hex grid retained`);
 ok(svg.includes('data-layer="city-hex-highlights"'),`${id}: city dot layer retained`);
 const tags=[...svg.matchAll(/<circle class="city-hex-highlight"[^>]*\/>/g)].map(m=>m[0]);
 const byCity=new Map();
 for(const tag of tags){
  const cid=attr(tag,'data-city-hex');
  if(!byCity.has(cid))byCity.set(cid,[]);
  byCity.get(cid).push(tag);
  ok(attr(tag,'r')==='2.25'&&attr(tag,'fill')==='#000000'&&attr(tag,'stroke')==='none',`${id}/${cid}: black dot style with smaller diameter`);
 }
 ok(byCity.size===expectedCities[id],`${id}: original city count`);
 ok(tags.length===expectedCities[id]*24,`${id}: 24 explicit dots per city`);
 for(const [cid,dots] of byCity){
  ok(dots.length===24,`${id}/${cid}: full pattern`);
  const vertices=Array.from({length:6},(_,i)=>point(dots[4*i]));
  for(let i=0;i<6;i++){
   const a=vertices[i], b=vertices[(i+1)%6];
   for(let j=0;j<4;j++){
    const dot=dots[4*i+j], role=j===0?'vertex':j===2?'midpoint':'quarter';
    const [x,y]=point(dot), t=j/4;
    ok(attr(dot,'data-city-dot-role')===role,`${id}/${cid}/${i}-${j}: symmetric dot role`);
    ok(Math.abs(x-(a[0]*(1-t)+b[0]*t))<.02 && Math.abs(y-(a[1]*(1-t)+b[1]*t))<.02,`${id}/${cid}/${i}-${j}: exact hex-side geometry`);
   }
  }
 }
 const entry=manifest.find(x=>x.id===id);
 ok(entry&&entry.errors.length===0,`${id}: map export has no validation errors`);
 allDots+=tags.length;
}
ok(allDots===1752,`all 1,752 dots retained: ${allDots}`);
const art=fs.readFileSync(path.join(root,'supplied_assets/flat/city-hex-highlight.svg'),'utf8');
ok(!art.includes('<polygon'), 'optional artwork has no extra city perimeter');
ok((art.match(/<circle /g)||[]).length===24, 'optional artwork retains 24 explicit dots');
for(const name of ['core/terrain_tiles.js','core/historical_engine_browser_bundle.js']){
 const src=fs.readFileSync(path.join(root,name),'utf8');
 ok(!src.includes('class="city-hex-border"'),`${name}: no heavy city outline markup`);
 ok(src.includes('data-city-dot-role'),`${name}: shared city dot renderer active`);
}
console.log(`PASS v457: ${checks} assertions across ${allDots} City hex dots and five engine exports`);
