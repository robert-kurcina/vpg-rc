#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const cfg=JSON.parse(fs.readFileSync(path.join(__dirname,'../maps/counter-configs/odessa-extension.json')));
assert.equal(cfg.visualTranscriptionStatus,'odessa-face-designs-reviewed-unit-ids-unverified');
assert.equal(cfg.physicalSheetCopies.rows,2);
assert.equal(cfg.faces.front.length,16); assert.equal(cfg.faces.back.length,16);
assert.equal(Object.keys(cfg.unitFacePairs).length,0,'printed captions must not become invented unit IDs');
const F=cfg.faces.front,B=cfg.faces.back;
const expectedFront=['naval-marker','coastal-infantry','blank','blank','infantry','infantry','air-marker','blank'];
const expectedBack=['cavalry','air-marker','infantry','infantry','cavalry','cavalry','coastal-infantry','naval-marker'];
for(const [side,rows,kinds] of [['front',F,expectedFront],['back',B,expectedBack]]){
 for(let col=1;col<=8;col++){
  const a=rows.find(f=>f.row===1&&f.column===col);
  const b=rows.find(f=>f.row===2&&f.column===col);
  assert(a&&b);
  assert.equal(a.visualTranscription.kind,kinds[col-1]);
  assert.deepEqual(a.visualTranscription,b.visualTranscription,'duplicated print rows have same artwork designation');
  assert.equal(a.unitId,null);assert.equal(b.unitId,null);
  assert.match(a.observedFieldColor,/^#[0-9a-f]{6}$/i);
 }
}
for(const pair of cfg.positionPairs){
 const front=F.find(f=>f.faceId===pair.front),back=B.find(f=>f.faceId===pair.back);
 assert(front&&back);
 assert.equal(front.row,back.row);assert.equal(front.column+back.column,9);
 assert.equal(pair.unitId,null);
}
for(const col of [3,4,8]) assert.equal(F.find(f=>f.row===1&&f.column===col).visualTranscription.visibility,'blank');
assert(B.find(f=>f.row===1&&f.column===1).visualTranscription.visibleNotation.includes('3-4'));
console.log('Odessa: 16 front/back print slots, 8 repeated source designs per side, 3 visibly blank front columns, mirrored pair mapping, no invented unit IDs: PASS');
