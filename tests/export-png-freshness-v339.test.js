'use strict';
// Regression: default engine export must refresh PNG as well as SVG.
// Compare cached manifest hashes to the bytes actually present, and make
// sure SVG-only mode cannot leave an out-of-date PNG beside a new SVG.
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const digest=(v)=>crypto.createHash('sha256').update(v).digest('hex');
const manifest=require('../exports/manifest.json');
assert.equal(manifest.length,5,'five scenario maps');
for(const m of manifest){
  const svg=fs.readFileSync(path.join(root,'exports',m.file));
  assert.equal(digest(svg),m.svgSHA256,`${m.id}: exported SVG does not match manifest`);
  assert(m.png&&m.pngSHA256,`${m.id}: PNG not generated (check default export flags)`);
  const png=fs.readFileSync(path.join(root,'exports',m.png));
  assert.equal(digest(png),m.pngSHA256,`${m.id}: stale PNG does not match manifest`);
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a',`${m.id}: invalid PNG`);
}
const script=fs.readFileSync(path.join(root,'scripts/export-campaign-maps.js'),'utf8');
assert.match(script,/png=!args\.includes\('--svg-only'\)/,'PNG export must be default');
assert.match(script,/fs\.unlinkSync\(pngPath\)/,'SVG-only export must remove older PNGs');
console.log('PASS v339: five synchronized PNG/SVG exports and manifest digests');
