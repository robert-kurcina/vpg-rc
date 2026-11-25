'use strict';
/* The v454 thick City border was explicitly retired in v457.
 * Regression: only dots remain, with the ordinary grid underneath. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),P=require('../core/presentation');
let n=0;function check(c,m){assert.ok(c,m);n++}
for(const id of ['battle-for-moscow','arduous','leningrad','kiev','kiev-odessa']){
 const opts=P.options(id),svg=fs.readFileSync(path.join(root,'exports',id+'.svg'),'utf8');
 check(!Object.hasOwn(opts,'cityBorderSolidWidth'),`${id}: retired heavy outline setting`);
 check(!svg.includes('class="city-hex-border"'),`${id}: no heavy outline polygons`);
 check(svg.includes('data-layer="hex-grid"'),`${id}: ordinary grid remains`);
 check(svg.includes('data-layer="city-hex-highlights"'),`${id}: dots overlay remains`);
 const dots=[...svg.matchAll(/<circle class="city-hex-highlight"[^>]*\/>/g)].map(m=>m[0]);
 check(dots.length>0&&dots.length%24===0,`${id}: 24 dots per City`);
 for(const d of dots)check(d.includes('fill="#000000"')&&d.includes('r="2.25"'),`${id}: black 4.5-unit round dots`);
}
for(const name of ['core/terrain_tiles.js','core/historical_engine_browser_bundle.js']){
 const src=fs.readFileSync(path.join(root,name),'utf8');
 check(!src.includes('class="city-hex-border"'),`${name}: renderer does not emit heavy line`);
}
console.log(`PASS v454→v457: ${n} retired border / retained dot assertions`);
