'use strict';
/* v455 aligned city highlights to exact grid hexes; v457 retains that
 * alignment, now as explicit circles without a second solid line. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const T=require('../core/terrain_tiles'),P=require('../core/presentation'),kiev=require('../maps/kiev.json');
const root=path.resolve(__dirname,'..');let n=0;const ok=(v,m)=>{assert.ok(v,m);n++};
const [rx,ry]=T.gridRadii(kiev.geometry),cell=kiev.cells.find(c=>c.id==='0706');
const [cx,cy]=T.coord(cell,kiev.geometry);
const verts=T.hexPoints(rx,ry).map(([x,y])=>[(cx+x).toFixed(2),(cy+y).toFixed(2)]);
const svg=fs.readFileSync(path.join(root,'exports/kiev.svg'),'utf8');
const dots=[...svg.matchAll(/<circle class="city-hex-highlight"[^>]*data-city-hex="0706"[^>]*\/>/g)].map(m=>m[0]);
ok(dots.length===24,'Kiev 0706 retains 24 symmetric dots');
for(let i=0;i<6;i++){
 const d=dots[4*i],x=d.match(/cx="([^"]+)"/)?.[1],y=d.match(/cy="([^"]+)"/)?.[1];
 ok(x===verts[i][0]&&y===verts[i][1],`vertex ${i} sits on full grid hex`);
}
ok(!svg.includes('class="city-hex-border"'),'Kiev has no extra City border');
for(const id of ['battle-for-moscow','arduous','leningrad','kiev','kiev-odessa']){
 const text=fs.readFileSync(path.join(root,'exports',id+'.svg'),'utf8');
 ok(!text.includes('class="city-hex-border"'),`${id}: no special solid outline`);
 ok(text.includes('data-layer="hex-grid"'),`${id}: original grid remains`);
}
console.log(`PASS v455→v457: ${n} hex alignment assertions`);
