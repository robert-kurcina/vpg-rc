'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const P=require('../core/presentation');
const registry=require('../maps/registry.json');
const exportManifest=require('../exports/manifest.json');
const audit=require('../rules/audit/terrain-swamp-adjustment-v440.json');
const sha=buf=>crypto.createHash('sha256').update(buf).digest('hex');
let n=0; const ok=(c,m)=>{assert.ok(c,m);n++;};
ok(P.textures().open==='supplied_assets/flat/terrain-open-v439.png','open stays on v439');
ok(P.textures().forest==='supplied_assets/flat/terrain-forest-v439.png','forest stays on v439');
ok(P.textures().swamp==='supplied_assets/flat/terrain-swamp-user-v441.png','v440 source remains archived; active swamp uses supplied v441 art');
const src=fs.readFileSync(path.join(ROOT,audit.input));
const out=fs.readFileSync(path.join(ROOT,audit.output));
ok(sha(src)===audit.sourceSha256,'original swamp hash preserved');
ok(sha(out)===audit.variantSha256,'v440 swamp hash recorded');
ok(sha(src)!==sha(out),'v440 swamp differs from original');
for(const entry of registry.maps){
  ok(entry.renderOptions.palette.swamp==='#616f6fff',`${entry.id} keeps requested swamp fill color`);
  const info=exportManifest.find(x=>x.id===entry.id);
  ok(info && Array.isArray(info.errors) && info.errors.length===0,`${entry.id} export geometry passes`);
  const svg=fs.readFileSync(path.join(ROOT,'exports',`${entry.id}.svg`),'utf8');
  const current=fs.readFileSync(path.join(ROOT,P.textures().swamp));
  ok(svg.includes(current.toString('base64'))===(entry.id!=='battle-for-moscow'),`${entry.id} embeds active supplied Swamp art if Swamp terrain is present`);
}
console.log(`PASS v440 source preservation + v441 current routing: ${n} assertions`);
