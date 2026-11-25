'use strict';
/* Legacy dashed City stroke was replaced by explicit separated black circles.
 * Ensure City dots do not collapse into a connected special outline. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');let n=0;const ok=(v,m)=>{assert.ok(v,m);n++};
for(const id of ['battle-for-moscow','arduous','leningrad','kiev','kiev-odessa']){
 const svg=fs.readFileSync(path.join(root,'exports',id+'.svg'),'utf8');
 const circles=[...svg.matchAll(/<circle class="city-hex-highlight"[^>]*\/>/g)].map(m=>m[0]);
 ok(circles.length>0&&circles.length%24===0,`${id}: separated circle markers`);
 ok(!svg.includes('class="city-hex-border"'),`${id}: no continuous heavy City stroke`);
 for(const tag of circles)ok(tag.includes('r="2.25"')&&tag.includes('fill="#000000"'),`${id}: preserved small round dots`);
}
console.log(`PASS v447→v457: ${n} separated dot assertions`);
