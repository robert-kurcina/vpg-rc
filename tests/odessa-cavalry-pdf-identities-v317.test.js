// Checkpoint 25: source-grounded Odessa cavalry inference and face preservation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname,'..');
const config = JSON.parse(fs.readFileSync(path.join(root,'maps/counter-configs/odessa-extension.json')));
const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'references/rules/odessa-rules.pdf'))).digest('hex');
assert.equal(sha,config.rulesPDF.sha256);
assert.deepEqual(config.sourceIdentifiedDesigns.map(x=>x.designColumn),[1,2,3,4,5,6,7,8]);
assert.deepEqual(config.unresolvedDesignColumns,[]);
const expected={3:['soviet-cavalry-corps-a','soviet',6],4:['soviet-cavalry-corps-b','soviet',5],8:['romanian-cavalry-corps','romanian',1]};
for(const [columnText,[identity,faction,backColumn]] of Object.entries(expected)) {
 const column=Number(columnText), design=config.sourceIdentifiedDesigns.find(d=>d.designColumn===column);
 assert.equal(design.identityKey,identity); assert.equal(design.faction,faction);
 assert.equal(design.gameplayUnitId,null);assert.match(design.identityEvidence,/inference/);
 for(let row=1;row<=2;row++) {
  const front=config.faces.front.find(f=>f.row===row&&f.column===column);
  const back=config.faces.back.find(f=>f.row===row&&f.column===backColumn);
  assert.equal(front.pairedFaceId,back.faceId);
  assert.equal(back.pairedFaceId,front.faceId);
  assert.equal(front.visualTranscription.visibility,'blank');
  assert.equal(back.visualTranscription.kind,'cavalry');
  assert.equal(back.visualTranscription.printedAffiliation,faction);
  assert.equal(back.sourceIdentityKey,identity);
  assert.equal(front.sourceIdentityKey,identity);
  assert.equal(back.singleSidedPlayableFaceId,back.faceId);
  assert.equal(front.singleSidedPlayableFaceId,back.faceId);
  assert.equal(back.unitId,null);
 }
}
assert.equal(config.sourceIdentifiedDesigns.length,8);
assert.equal(config.playableDesignRegistry.length,8);
assert.equal(new Set(config.playableDesignRegistry.map(x=>x.designKey)).size,8);
for (const design of config.playableDesignRegistry) {
 assert.equal(design.gameplayUnitId,null);
 assert.equal(design.historicalUnitId,null);
 assert.equal(design.isSingleSided,[3,4,8].includes(design.designColumn));
 assert.equal(design.alternateFaceId===null,[3,4,8].includes(design.designColumn));
 assert.equal(config.faces[design.isSingleSided?'back':'front'].some(f=>f.faceId===design.displayFaceId),true);
}
console.log('PASS: Odessa eight source-design identities; inferred cavalry; mirrored blank/printed faces; gameplay IDs remain unbound');
