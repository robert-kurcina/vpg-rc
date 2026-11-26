'use strict';
const A=require('node:assert/strict');
const G=require('../core/map_movement_graph'),H=require('../core/hexside_features'),B=require('../core/movement_binding');
const registry=require('../maps/movement-configs/experimental-source-graph-ledgers.json');
const original=G.build;let calls=0,n=0;
G.build=function(...args){calls++;return original(...args);};
const eq=(a,b)=>{A.deepEqual(a,b);n++;};
const throws=(f,p)=>{A.throws(f,p);n++;};
try{
 for(const name of ['leningrad','arduous','kiev','kiev-odessa-experimental-v531']){
  const map=structuredClone(require('../maps/'+(name.startsWith('kiev-odessa')?'kiev-odessa-composite-experimental-v531':name)+'.json'));
  const profile=require('../maps/movement-configs/'+name+'.json');
  const options={experimentalScope:profile.experimentalGraphScope||null};
  const expected=original(map,options),expectedLedger=H.inspect(map,options);
  calls=0;const actual=B.build(map,profile);eq(calls,1);eq(actual.board,expected);
  eq(actual.metadata.edgeCount,expectedLedger.metadata.edgeCount);
  calls=0;const combined=H.inspectWithGraph(map,options);eq(calls,1);eq(combined.board,expected);eq(combined.ledger,expectedLedger);
  // Returned mutable graphs cannot poison a later call or the ledger.
  actual.board.edges[0].rail=!actual.board.edges[0].rail;
  combined.board.edges[0].impassable=!combined.board.edges[0].impassable;
  eq(B.build(map,profile).board,expected);eq(H.inspect(map,options),expectedLedger);
  // Only the prepared detached source is eligible for identity reuse.
  const prepared=B.prepareContext({map,profile});
  calls=0;const cached=B.build(prepared.map,prepared.profile);
  eq(calls,1);eq(cached.board,expected);
  A.strictEqual(B.build(prepared.map,prepared.profile),cached);eq(calls,1);
  A.ok(Object.isFrozen(cached.board)&&Object.isFrozen(cached.board.edges)&&Object.isFrozen(cached.board.edges[0]));
  throws(()=>{cached.board.edges[0].rail=!cached.board.edges[0].rail;},TypeError);
  throws(()=>{prepared.map.cells[0].terrain='tampered';},TypeError);
  const detached=structuredClone(prepared);
  const reused=B.reusePreparedSource(detached,prepared);
  A.strictEqual(reused.map,prepared.map);A.strictEqual(reused.profile,prepared.profile);
  const changed=structuredClone(prepared);changed.map.sourceImageSHA256='tampered';
  const changedSource=B.reusePreparedSource(changed,prepared);
  A.notStrictEqual(changedSource.map,prepared.map);
  throws(()=>B.build(changedSource.map,changedSource.profile),/not-gameplay-certified/);
  const bad=structuredClone(map);Object.freeze(bad);
  calls=0;B.build(bad,profile);B.build(bad,profile);eq(calls,2);
  const wrong=structuredClone(map);wrong.sourceImageSHA256='tampered';
  throws(()=>B.build(wrong,profile),/not-gameplay-certified/);
  if(name.startsWith('kiev-odessa')){
   throws(()=>H.inspectWithGraph(map,{experimentalScope:'wrong'}),/not-gameplay-certified/);
   const record=registry.maps[map.id],edge=record.board.edges[0],before=edge.rail;
   try{edge.rail=!before;throws(()=>B.build(map,profile),/fingerprint-mismatch/);}finally{edge.rail=before;}
   eq(B.build(map,profile).board,expected);
   const cell=map.cells[0],terrain=cell.terrain;cell.terrain=terrain==='sea'?'open':'sea';
   throws(()=>B.build(map,profile),/fingerprint-mismatch/);cell.terrain=terrain;
   eq(B.build(map,profile).board,expected);
  }
 }
 const provisional=require('../maps/composer').compose(require('../maps/kiev.json'),require('../maps/odessa-extension.json'));
 eq(H.inspect(provisional).metadata.certified,false);
 throws(()=>H.inspectWithGraph(provisional),/not-gameplay-certified/);
}finally{G.build=original;}
console.log('PASS single-pass binding',n,'assertions');
