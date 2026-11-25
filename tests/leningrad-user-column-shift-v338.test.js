'use strict';
// Verify the rejected v338 runtime transform is preserved as provenance,
// while current source-calibrated deployment data is NOT the arithmetic transform.
const assert=require('node:assert/strict');
const board=require('../maps/leningrad.json');
const prior=[['star','0108','0208'],['cross','0109','0209'],['star','0209','0309'],['cross','0210','0310'],['cross','0211','0311'],['star','0309','0409'],['cross','0310','0410'],['star','0410','0510'],['cross','0411','0511'],['star','0510','0610']];
assert.deepEqual(board.v338DeploymentColumnCorrection.moves.map(x=>[x.kind,x.from,x.to]),prior);
assert.deepEqual(board.v342GridRegisteredDeployment.moves.map(x=>[x.kind,x.from,x.to]),prior.map(x=>[x[0],x[2],x[1]]));
const hosts=kind=>board.cells.flatMap(c=>(c.tileMarkers||[]).filter(m=>m.kind===kind).map(()=>c.id)).sort();
assert.deepEqual(hosts('cross'),['0210','0310','0311','0411','0511']);
assert.deepEqual(hosts('star'),['0209','0309','0410','0510','0611']);
assert.equal(board.geometry.deploymentMarkerPlacement,undefined);
console.log('PASS v345: v338 column shift retained as historical evidence; explicit authority active');
