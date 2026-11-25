const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const manifest=read('references/ux/oberlabs/manifest.json');
const conf=read('maps/presentation/registry.json');
const games=read('maps/registry.json').maps;
assert.equal(manifest.screenshots.length,7);
assert.deepEqual(Object.keys(conf.games).sort(),games.map(m=>m.id).sort());
assert.equal(new Set(conf.componentIds).size,conf.componentIds.length);
for(const image of manifest.screenshots){
 const bytes=fs.readFileSync(path.join(root,'references/ux/oberlabs',image.reviewCopy));
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),image.reviewCopySha256);
 assert.match(image.sourceSha256,/^[0-9a-f]{64}$/);
}
for(const [id,game] of Object.entries(conf.games)){
 assert.ok(game.referenceTabs.includes('terrain-effects'));
 assert.ok(game.referenceTabs.includes('combat-results'));
 assert.ok(game.status);
}
assert.equal(conf.games['kiev-odessa'].composition,'kiev + odessa expansion rules and roster');
console.log('PASS: 7 screenshot references, 5 shared presentation registrations, and provenance hashes');
