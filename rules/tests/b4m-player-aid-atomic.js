'use strict';
// Source-transcription integrity only: not a statement of rules compliance.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const doc=JSON.parse(fs.readFileSync(path.join(root,'rules/audit/b4m-player-aid-atomic.json')));
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
assert.equal(sha(doc.source),doc.sourceSha256,'Player Aid source changed');
assert.equal(sha(doc.companionPdf),doc.companionPdfSha256,'PDF source changed');
assert.equal(doc.entries.length,34);
assert.equal(new Set(doc.entries.map(e=>e.id)).size,34);
for(const terrain of ['open','forest','city','moscow','fortification','river','railroad','star-cross','mud']) {
 const group=doc.entries.filter(e=>e.id.startsWith(`aid.tec.${terrain}.`));
 assert.deepEqual(group.map(e=>e.field).sort(),['combat','movement','notes']);
}
const turns=doc.entries.filter(e=>e.region==='Game Turn Record Track');
assert.deepEqual(turns.map(t=>t.turn),[1,2,3,4,5,6,7]);
assert.deepEqual(turns.map(t=>t.germanReplacementSteps),[0,1,1,1,1,1,1]);
assert.deepEqual(turns.map(t=>t.sovietReplacementSteps),[5,5,5,5,5,5,5]);
const profile=JSON.parse(fs.readFileSync(path.join(root,'legacy/data/rules_profiles.json'))).profiles.oberlabs_2009_web;
assert.equal(profile.sovietReplacements.mud,4,'Expected known Aid-vs-Oberlabs profile difference must be reaudited');
assert.equal(profile.sovietReplacements.normal,5);
assert.deepEqual(profile.mudTurns,[3,4]);
assert.equal(profile.mudAttackerMultiplier.tank,0.5);
assert.equal(profile.mudAttackerMultiplier.infantry,1);
assert.equal(doc.openQuestions.find(x=>x.id==='AID-TRACK-001').status,'unresolved-source-vs-profile');
console.log('PASS B4M Player Aid: 34 transcribed fields, source hashes and explicit tracked difference (NOT compliance)');
