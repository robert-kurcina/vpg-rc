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
