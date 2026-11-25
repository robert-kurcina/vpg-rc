'use strict';
const assert=require('node:assert/strict');
const base=require('../maps/kiev.json'),ext=require('../maps/odessa-extension.json');
const map=require('../maps/composer').compose(base,ext);
const profile=require('../maps/movement-configs/kiev-odessa-experimental-v531.json');
const board=require('../core/movement_binding').build(require('../maps/kiev-odessa-composite-experimental-v531.json'),profile).board;
const source=require('../core/composite_graph_audit').movementCandidate(base,ext,map);
const trace=require('../core/composite_source_rail_audit').trace(map);
const M=require('../core/movement_rules');
const key=e=>[e.a,e.b].sort().join(':');
const rails=new Set(trace.tracedLinks.map(key)),live=new Map(board.edges.map(e=>[key(e),e]));
const inherited=new Set(base.cells.map(c=>c.id));
let n=0;function eq(a,b,msg){assert.deepStrictEqual(a,b,msg);n++;}
const counts={seam:0,internal:0,blocked:0,rail:0,river:0,majorRiver:0};
for(const e of source.edges){
 if(inherited.has(e.a)&&inherited.has(e.b))continue;
 const k=key(e),actual=live.get(k);assert.ok(actual,k);n++;
 eq(actual.impassable,e.impassableForGround,k+' passage');
 eq(actual.rail,rails.has(k),k+' rail');
 eq(actual.river,e.sourceKinds.includes('river'),k+' river');
 eq(actual.majorRiver,e.sourceKinds.includes('majorRiver'),k+' major river');
 if(e.impassableForGround)counts.blocked++;else if(e.compositeSeam)counts.seam++;else counts.internal++;
 for(const f of ['rail','river','majorRiver'])if(actual[f])counts[f]++;
 for(const [a,b] of [[e.a,e.b],[e.b,e.a]]){
  if(board.cells[a].terrain==='sea')continue;
  const u={id:'u',hex:a,owner:'german',nationality:'german',class:'infantry',size:'corps',mp:4};
  const state={board,profile,units:{u},phase:{kind:'movement',owner:'german'},turn:2};
  const r=M.move(state,{unitId:'u',path:[a,b]});
  eq(r.ok,!actual.impassable,k+' movement '+a+'>'+b+' '+r.reason);
  eq(u.hex,a,'input counter unchanged');
 }
}
eq(counts,{seam:24,internal:148,blocked:100,rail:25,river:33,majorRiver:12},'appended coverage');
console.log('PASS appended edge source parity and bidirectional movement',n,'assertions',JSON.stringify(counts));
