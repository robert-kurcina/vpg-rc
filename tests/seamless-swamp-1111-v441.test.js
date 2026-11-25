'use strict';
/* Current presentation regression: actual user Swamp source tile, global pattern,
 * and removal of an inconsistent Kiev-only Forest opacity exception.
 * No scenario-specific rendering code or gameplay approval implied. */
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const P=require('../core/presentation');
const E=require('../core/source_reviewed_movement_graph');
const composer=require('../maps/composer');
const registry=require('../maps/registry.json');
const base=require('../maps/kiev.json');
const extension=require('../maps/odessa-extension.json');
const cfg=require('../maps/movement-configs/kiev-source-reviewed-candidate-v435.json');
const audit=require('../rules/audit/seamless-swamp-1111-v441.json');
const ROOT=path.resolve(__dirname,'..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
let n=0;
function check(c,s){assert.ok(c,s);n++;}
const current='supplied_assets/flat/terrain-swamp-user-v441.png';
const userTile=fs.readFileSync(path.join(ROOT,current));
check(P.textures().swamp===current,'common presentation uses the unaltered user Swamp tile');
check(P.textures().forest==='supplied_assets/flat/terrain-forest-v439.png','Forest bitmap remains v439');
check(P.textures().open==='supplied_assets/flat/terrain-open-v439.png','Open bitmap remains v439');
check(P.options('kiev').seamlessTerrainTextureSizes.swamp===180,'Swamp pattern has a stable map-space period');
check(sha(userTile)===audit.uploadedSourceSHA256,'exact uploaded source pixels retained');
check(sha(fs.readFileSync(path.join(ROOT,'supplied_assets/flat/terrain-swamp.png')))===audit.originalSwampSHA256,'original project Swamp art preserved');
const forest1111=base.cells.find(c=>c.id==='1111');
const forest1110=base.cells.find(c=>c.id==='1110');
check(forest1111.terrain==='forest','1111 remains Forest, not Swamp');
check(forest1111.terrainTextureOpacityMultiplier===undefined,'legacy isolated 0.52 opacity has been removed');
check(forest1110.terrainTextureOpacityMultiplier===undefined,'adjacent Forest uses the same default opacity');
check(E.build(base,cfg).cells['1111'].terrain==='forest','movement candidate preserves 1111 Forest');
const composite=composer.compose(base,extension);
check(composite.cells.find(c=>c.id==='1111').terrainTextureOpacityMultiplier===1,'composite 1111 Forest texture is normal');
check(!forest1111.tileMarkers.some(m=>m.kind==='star'),'standalone Kiev 1111 retains no star');
check(composite.cells.find(c=>c.id==='1111').tileMarkers.filter(m=>m.kind==='star').length===1,'composite 1111 retains one Soviet star');
const extensionSwamps=extension.cells.filter(c=>c.terrain==='swamp');
check(extensionSwamps.length===8,'Odessa expansion has eight Swamp hexes');
for(const c of extensionSwamps)check(c.terrainTextureOpacityMultiplier===1,'Odessa Swamp '+c.id+' now displays user art');
for(const c of extension.cells.filter(c=>c.terrain!=='swamp'&&c.terrainTextureOpacityMultiplier===0))check(c.terrainTextureOpacityMultiplier===0,'non-Swamp extension imagery unchanged '+c.id);
const srcBase64=userTile.toString('base64');
for(const entry of registry.maps){
 const board=entry.id==='kiev-odessa'?composite:entry.id==='kiev'?base:require('../maps/'+entry.file);
 const ids=board.cells.filter(c=>c.terrain==='swamp').map(c=>c.id);
 const svg=fs.readFileSync(path.join(ROOT,'exports',entry.id+'.svg'),'utf8');
 const expected=ids.length;
 const polygons=[...svg.matchAll(/class="terrain-seamless-texture" data-texture-hex="([0-9]{4})"/g)].map(m=>m[1]);
 check(polygons.length===expected,entry.id+' has one globally aligned texture polygon per Swamp hex');
 check(new Set(polygons).size===expected,entry.id+' has no duplicated Swamp polygons');
 for(const id of ids)check(polygons.includes(id),entry.id+' Swamp '+id+' appears in shared pattern');
 check(svg.includes('id="terrain-seamless-export-'+entry.id+'-swamp"')===(expected>0),entry.id+' shared pattern only when required');
 check(svg.includes(srcBase64)===(expected>0),entry.id+' embeds exact user bitmap only if Swamp exists');
 check(!svg.includes('id="terrain-sprite-export-'+entry.id+'-swamp"'),entry.id+' no redundant per-hex Swamp sprite');
 const info=require('../exports/manifest.json').find(v=>v.id===entry.id);
 check(info && info.errors.length===0,entry.id+' exporter geometry has no errors');
}
const kiev=fs.readFileSync(path.join(ROOT,'exports/kiev.svg'),'utf8');
for(const id of ['1110','1111']){
 const portion=kiev.substring(kiev.indexOf('data-hex-id="'+id+'"')).split('</g></g>')[0];
 check(portion.includes('opacity="1.00"'),id+' forest bitmap is fully opaque in engine export');
 check(portion.includes('terrain-sprite-export-kiev-forest'),id+' uses the identical shared Forest bitmap');
}
console.log(`PASS v441 seamless Swamp and Kiev Forest correction: ${n} assertions`);
