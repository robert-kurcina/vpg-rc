'use strict';
/* Black color and round dot style introduced at v453, preserved explicitly
 * as 24 circles per City in v457. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),P=require('../core/presentation');
let n=0;const ok=(v,m)=>{assert.ok(v,m);n++};let total=0;
for(const id of ['battle-for-moscow','arduous','leningrad','kiev','kiev-odessa']){
 const svg=fs.readFileSync(path.join(root,'exports',id+'.svg'),'utf8');
 ok(P.options(id).cityBorderWidth===4.5,`${id}: black dot diameter`);
 const dots=[...svg.matchAll(/<circle class="city-hex-highlight"[^>]*\/>/g)].map(m=>m[0]);
 ok(dots.length>0&&dots.length%24===0,`${id}: full black dot layout`);
 for(const d of dots){ok(d.includes('fill="#000000"')&&d.includes('stroke="none"'),`${id}: solid black circle`);}
 ok(!svg.includes('class="city-hex-border"'),`${id}: extra border retired`);
 total+=dots.length;
}
ok(total===1752,'all City dots remain black');
console.log(`PASS v453→v457: ${n} black-dot assertions`);
