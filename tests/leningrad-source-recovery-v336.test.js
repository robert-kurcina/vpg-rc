'use strict';
// Current deployment authority is independently calibrated board-scan geometry (v342).
// Legacy v336/v338 reports remain historical provenance, not active setup bindings.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const board=require('../maps/leningrad.json');
const T=require('../core/terrain_tiles');
const P=require('../core/presentation');
const marker=kind=>board.cells.flatMap(c=>(c.tileMarkers||[]).filter(m=>m.kind===kind).map(m=>({id:c.id,m})));
assert.deepEqual(marker('cross').map(x=>x.id).sort(),['0210','0310','0311','0411','0511']);
assert.deepEqual(marker('star').map(x=>x.id).sort(),['0209','0309','0410','0510','0611']);
assert.equal(new Set([...marker('cross'),...marker('star')].map(x=>x.id)).size,10);
const sha=crypto.createHash('sha256').update(fs.readFileSync('rules/audit/visual/leningrad-east-prussia-scan-crop-v324.png')).digest('hex');
assert.equal(sha,board.v342GridRegisteredDeployment&&board.v333SourceRegistrationRepair.sourceScanCropSHA256);
assert.equal(board.geometry.deploymentMarkerPlacement,undefined);
assert.equal(T.formatHexNumber(board.cells.find(c=>c.id==='1701'),T.numberStyle(board,{})),'1601');
const svg=T.svgMap(board,P.options('leningrad',{showWaterBodies:false}));
const matches=[...svg.matchAll(/<g data-deployment-hex="([0-9]{4})" data-deployment-kind="(cross|star)" data-placement="([^"]+)"/g)];
assert.equal(matches.length,10);
for(const m of matches)assert.equal(m[3],'bottom-center');
console.log('PASS v345: explicit host-cell registry and universal renderer; historical source SHA preserved');
