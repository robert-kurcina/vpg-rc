'use strict';
/* Inset mode from v446 retired in v455: dots now align with the actual hex
 * perimeter. The shared City overlay remains vector-based. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),P=require('../core/presentation'),registry=require('../maps/registry.json');
let n=0;const ok=(v,m)=>{assert.ok(v,m);n++};
ok(P.options('kiev').cityBorderOutsideGrid===false,'no outside-grid City effect');
ok(!registry.maps.some(m=>m.renderOptions?.cityHexArtwork),'no custom City artwork override');
for(const id of ['battle-for-moscow','arduous','leningrad','kiev','kiev-odessa']){
 const svg=fs.readFileSync(path.join(root,'exports',id+'.svg'),'utf8');
 const i=svg.indexOf('data-layer="city-hex-highlights"');
 ok(i>=0,`${id}: shared City highlight layer`);
 const layer=svg.slice(i,i+5000);
 ok(layer.includes('data-layer-order="10.5"'),`${id}: same shared layer position`);
 ok(layer.includes('<circle class="city-hex-highlight"'),`${id}: vector dots, not a border image`);
 ok(!layer.includes('class="city-hex-border"'),`${id}: no special City perimeter`);
}
console.log(`PASS v446→v457: ${n} shared layer assertions`);
