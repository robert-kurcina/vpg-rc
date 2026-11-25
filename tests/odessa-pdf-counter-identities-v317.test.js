// Odessa PDF-backed source identity audit. Avoid guessing gameplay unit IDs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
const cfg = require('../maps/counter-configs/odessa-extension.json');
const pdf = path.join(root, cfg.rulesPDF.file);
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(pdf)).digest('hex'), cfg.rulesPDF.sha256);
assert.equal(cfg.rulesPDF.piecesPerPDF, 8);
assert.equal(cfg.rulesPDF.distinctPrintDesigns, 8);
assert.equal(cfg.sourceIdentifiedDesigns.length, 8);
assert.deepEqual(cfg.unresolvedDesignColumns, []);
for (const [col,key,faction] of [[1,'soviet-black-sea-fleet','soviet'],[2,'soviet-coastal-army','soviet'],[5,'romanian-home-army','romanian'],[6,'romanian-4th-army','romanian'],[7,'romanian-air-support','romanian']]) {
 for (let row=1;row<=2;row++) {
  const f = cfg.faces.front.find(x=>x.row===row&&x.column===col);
  const b = cfg.faces.back.find(x=>x.row===row&&x.column===9-col);
  assert.ok(f&&b); assert.equal(f.pairedFaceId,b.faceId);
  assert.equal(f.sourceIdentityKey,key); assert.equal(b.sourceIdentityKey,key);
  assert.equal(f.visualTranscription.printedAffiliation,faction);
  assert.equal(b.visualTranscription.printedAffiliation,faction);
  assert.equal(f.unitId,null); assert.equal(b.unitId,null);
 }
}
// The three further designs are identified by a source-backed cavalry inference,
// NOT by an explicit unit number or fabricated gameplay unit ID.
for (const col of [3,4,8]) {
 const design=cfg.sourceIdentifiedDesigns.find(x=>x.designColumn===col);
 assert.match(design.identityEvidence,/inference/);
 assert.equal(design.gameplayUnitId,null);
 for(const row of [1,2]) {
  const f=cfg.faces.front.find(x=>x.row===row&&x.column===col);
  const b=cfg.faces.back.find(x=>x.row===row&&x.column===9-col);
  assert.equal(f.unitId,null);assert.equal(b.unitId,null);
  assert.equal(f.sourceIdentityKey,design.identityKey);
  assert.equal(b.sourceIdentityKey,design.identityKey);
 }
}
console.log('PASS Odessa PDF identities, affiliations, mirrored pairs and inferred cavalry provenance');
