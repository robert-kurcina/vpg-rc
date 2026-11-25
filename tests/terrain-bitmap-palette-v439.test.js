'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const P=require('../core/presentation');
const registry=require('../maps/registry.json');
const recolor=require('../rules/audit/terrain-bitmap-recolor-v439.json');
const exportManifest=require('../exports/manifest.json');
const targets={open:'#dcd4c9ff',forest:'#727f61ff',swamp:'#616f6fff'};
const sha=buf=>crypto.createHash('sha256').update(buf).digest('hex');
let assertions=0;
function check(condition,message){assert.ok(condition,message);assertions++;}
for(const [kind,color] of Object.entries(targets)){
 const e=recolor[kind];check(e.target===color,`source trace records ${kind} target`);
 const original=fs.readFileSync(path.join(ROOT,e.input));
 const variant=fs.readFileSync(path.join(ROOT,e.output));
 check(sha(original)===e.sourceSha256,`${kind} original texture hash retained`);
 check(sha(variant)===e.variantSha256,`${kind} alternate texture hash retained`);
 check(sha(original)!==sha(variant),`${kind} pixels really changed`);
 check(e.alphaUnchanged===true,`${kind} raster transparency retained`);
 const rgb=Buffer.from(color.slice(1,7),'hex');
 check(e.variantOpaqueRGBMean.every((v,i)=>Math.abs(v-rgb[i])<4),`${kind} bitmap mean matches requested color`);
 const expectedCurrent=kind==='swamp'?'supplied_assets/flat/terrain-swamp-user-v441.png':`supplied_assets/flat/terrain-${kind}-v439.png`;
 check(P.textures()[kind]===expectedCurrent,`${kind} current browser texture path matches current presentation`);
}
for(const entry of registry.maps){
 const map=entry.id;
 for(const [kind,color] of Object.entries(targets))check(entry.renderOptions.palette[kind]===color,`${map} uses approved ${kind} fill`);
 const info=exportManifest.find(x=>x.id===map);
 check(info&&Array.isArray(info.errors)&&info.errors.length===0,`${map} exporter geometry passes`);
 const svg=fs.readFileSync(path.join(ROOT,'exports',`${map}.svg`),'utf8');
 for(const kind of Object.keys(targets)){
  const current=fs.readFileSync(path.join(ROOT,P.textures()[kind]));
  const mapUses=kind==='swamp'?entry.id!=='battle-for-moscow':true;
  check(svg.includes(current.toString('base64'))===mapUses,`${map} SVG embeds active ${kind} bitmap only when used`);
 }
}
for(const other of ['woods','hills','mountain','rough'])check(P.textures()[other]===`supplied_assets/flat/terrain-${other}.png`,`${other} source bitmap stays in use`);
check(P.options('kiev').openTerrainLighten===0,'green Open overlay disabled for neutral-beige experiment');
console.log(`PASS v439 source preservation + v441 current routing: ${assertions} assertions`);
