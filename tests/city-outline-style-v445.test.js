'use strict';
/* Early City outline color tests follow the current dots-only rendering. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),P=require('../core/presentation'),manifest=require('../exports/manifest.json');
let n=0;const ok=(v,m)=>{assert.ok(v,m);n++};
ok(P.options('kiev').cityBorderWidth===4.5,'current City dot diameter');
const art=fs.readFileSync(path.join(root,'supplied_assets/flat/city-hex-highlight.svg'),'utf8');
ok(!art.includes('<polygon')&&(art.match(/<circle /g)||[]).length===24,'art contains dots but no extra outline');
ok(!art.includes('#e8cd63')&&!art.includes('#ed8d30'),'retired yellow/orange City colors');
for(const id of ['battle-for-moscow','arduous','leningrad','kiev','kiev-odessa']){
 const svg=fs.readFileSync(path.join(root,'exports',id+'.svg'),'utf8');
 ok(svg.includes('<circle class="city-hex-highlight"'),`${id}: City dots drawn`);
 ok(!svg.includes('class="city-hex-border"'),`${id}: no thick City border`);
 ok(manifest.some(x=>x.id===id&&x.errors.length===0),`${id}: valid export`);
}
console.log(`PASS v445→v457: ${n} City highlight assertions`);
