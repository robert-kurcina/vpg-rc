#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p)));
const c=require('../core/counter_visuals');
const idx=read('assets/official-counters/source-sheets/INDEX.json');
const registry=read('maps/registry.json');
const canonical=['battle-for-moscow','arduous','leningrad','kiev','odessa-extension'];
const countExpected={'battle-for-moscow':40,'arduous':40,'leningrad':32,'kiev':40,'odessa-extension':16};
let faceCount=0;
for(const id of canonical){
 const cfg=read(`maps/counter-configs/${id}.json`);
 assert.equal(cfg.mapId,id);
 const expected=countExpected[id];
 const ids=new Set();
 for(const side of ['front','back']){
  const src=cfg.faceSource[side];
  const b=fs.readFileSync(path.join(root,src.file));
  assert.equal(crypto.createHash('sha256').update(b).digest('hex'),src.sha256,src.file);
  assert.equal(cfg.faces[side].length,expected,id+' '+side);
  cfg.faces[side].forEach(f=>{
   assert.equal(f.source,side);assert(f.crop.every(Number.isInteger));
   const [x,y,w,h]=f.crop;
   assert(w>0&&h>0&&x>=0&&y>=0&&x+w<=src.width&&y+h<=src.height,f.faceId);
   assert.match(f.observedFieldColor,/^#[0-9a-f]{6}$/i);
   assert(!ids.has(f.faceId),'duplicate face: '+f.faceId);ids.add(f.faceId);
  });
  faceCount+=expected;
 }
 assert.equal(cfg.positionPairs.length,expected,'one positional pair per front face');
 const seenReverse=new Set();
 for(const pp of cfg.positionPairs){
  const front=cfg.faces.front.find(f=>f.faceId===pp.front);
  const back=cfg.faces.back.find(f=>f.faceId===pp.back);
  assert(front&&back,'missing mirror-paired faces');
  assert.equal(front.row,back.row,'mirrored row');
  assert.equal(front.column+back.column,9,'horizontal sheet mirroring (8 cols)');
  assert.equal(front.pairedFaceId,back.faceId);
  assert.equal(back.pairedFaceId,front.faceId);
  assert(!seenReverse.has(back.faceId));seenReverse.add(back.faceId);
  if(id==='battle-for-moscow'&&front.unitId){
   assert.equal(front.unitId,back.unitId,'independent printed ID cross-check');
   assert.equal(pp.unitId,front.unitId);
  } else if(id!=='battle-for-moscow') {
   assert.equal(pp.unitId,null,'unverified identities are not invented');
  }
 }
 for(const [unitId, pair] of Object.entries(cfg.unitFacePairs)){
  assert(pair.front&&pair.back);assert(ids.has(pair.front)&&ids.has(pair.back));
  assert(cfg.faces.front.some(f=>f.faceId===pair.front&&f.unitId===unitId));
  assert(cfg.faces.back.some(f=>f.faceId===pair.back&&f.unitId===unitId));
 }
 if(id!=='battle-for-moscow')assert.equal(Object.keys(cfg.unitFacePairs).length,0,'unverified pairing was silently assigned');
}
const units=read('games/battle-for-moscow/units.json').units;
const b4m=read('maps/counter-configs/battle-for-moscow.json');
assert.equal(units.length,39);
assert.deepEqual(Object.keys(b4m.unitFacePairs).sort(),units.map(u=>u.id).sort());
for(const u of units){
 assert.deepEqual(u.counter.sourceFaces,b4m.unitFacePairs[u.id]);
 assert(u.counter.faces.full.color!==u.counter.faces.damaged.color,'full/reverse colors were collapsed: '+u.id);
 const full=c.piece({...u,strength:'full'}),damaged=c.piece({...u,strength:'reduced'});
 assert(full.includes(`data-unit-id="${u.id}"`)&&damaged.includes('data-damaged="true"'));
 assert(full.includes(u.counter.faces.full.color));
 assert(damaged.includes(u.counter.faces.damaged.color));
}
for(const m of registry.maps){
 if(m.id==='kiev-odessa')assert.deepEqual(m.counterConfigs,['counter-configs/kiev.json','counter-configs/odessa-extension.json']);
 else assert.equal(m.counterConfig,`counter-configs/${m.id}.json`);
}
console.log(`Historical counters: ${faceCount} exact raster face-slot references across 10 sheets, 39 B4M printed-ID pairs, mirrored horizontal pairing for all five sets, per-face source palette, five map references, live SVG template rendering: PASS`);
