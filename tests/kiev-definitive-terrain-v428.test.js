'use strict';
const assert=require('node:assert/strict'),T=require('../core/terrain_evidence'),Graph=require('../core/map_movement_graph'),fs=require('node:fs'),crypto=require('node:crypto');
const b=require('../maps/kiev.json'),a=require('../rules/audit/kiev-definitive-terrain-v428.json');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
assert.equal(sha(a.source),a.sourceSvgSha256);
assert.equal(b.cells.length,165);
assert.equal(a.sourceCertifiedHexes,149);
assert.deepEqual(a.correctedTerrainHexes,['0403','0608','1009']);
for(const id of a.correctedTerrainHexes){
 const c=b.cells.find(c=>c.id===id);assert.equal(c.terrain,'open');assert.equal(c.sourceTerrainEvidence.layer,'open');
}
const report=T.inspect(b);
assert.equal(report.coverage.markedTerrainHexes,149);
assert.equal(report.coverage.unresolvedTerrainHexes,16);
assert.equal(report.coverage.railCandidateLinks,93);
assert.equal(report.coverage.candidateHexsideFeatureMarks,230);
assert.equal(report.authorizedForMovement,false);
const tampered=structuredClone(b);tampered.cells.find(c=>c.id==='0403').terrain='swamp';
assert.throws(()=>T.inspect(tampered),/definitive-terrain-evidence-disagrees/);
assert.throws(()=>Graph.build({...b,sourceImageSHA256:'untrusted-v485-test'}),/source-geometry-not-gameplay-certified/);
console.log('PASS Kiev source terrain: 149 explicit, 16 city underlays unspecified, 3 corrections; movement gate remains closed.');
