'use strict';
// v330 correction is preserved for provenance, but is superseded by a measured v333 source-scan registration.
const assert=require('node:assert/strict');const b=require('../maps/leningrad.json');
assert.deepEqual(b.v330UserSourceImageReview.verifiedGermanCrosses,['0110','0210','0211','0310','0411']);
assert(b.v333SourceRegistrationRepair.supersedesRuntimeChanges.includes('v330UserSourceImageReview'));
assert(b.v335DeploymentColumnCorrection.supersedesActiveHostAssignmentsFrom.includes('v333SourceRegistrationRepair'));
assert(b.v336DeploymentSourceRecovery.historicalSetupAuthorized===false);
assert(b.cells.find(c=>c.id==='0210').tileMarkers.some(m=>m.kind==='cross'&&m.hostCell==='0210'));
assert.equal(b.v343SourceSvgHostCells.scanEvidenceUsed,false);
console.log('PASS v330: historical correction retained; user-approved left v345 now active');
