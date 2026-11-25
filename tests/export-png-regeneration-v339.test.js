'use strict';
// Independently rerun the actual exporter and verify that fresh PNGs match
// the packaged outputs. Checks the pipeline, not historical source fidelity.
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'wargame-png-freshness-'));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
try{
 const run=cp.spawnSync(process.execPath,[path.join(root,'scripts/export-campaign-maps.js'),temp],{cwd:root,encoding:'utf8',timeout:120000});
 assert.equal(run.status,0,run.stderr||run.error?.message||'exporter failed');
 const manifest=JSON.parse(fs.readFileSync(path.join(temp,'manifest.json'),'utf8'));
 assert.equal(manifest.length,5);
 for(const m of manifest){
  assert(m.png&&m.svgSHA256&&m.pngSHA256,`${m.id}: incomplete manifest`);
  assert.equal(sha(path.join(temp,m.file)),sha(path.join(root,'exports',m.file)),`${m.id} SVG not reproducible`);
  assert.equal(sha(path.join(temp,m.png)),sha(path.join(root,'exports',m.png)),`${m.id} PNG stale or inconsistent with fresh render`);
 }
 console.log('PASS v339: isolated fresh export reproduces all five packaged PNG and SVG files');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
