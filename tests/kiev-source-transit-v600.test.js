'use strict';
// Printed Kiev §§8.1, 9.2, both standalone and composite shipped graphs.
const A=require('node:assert/strict'), B=require('../core/movement_binding'), M=require('../core/movement_rules'), LP=require('../core/legal_pathfinding');
let n=0; const eq=(a,b,m)=>{A.equal(a,b,m);n++}; const ok=(a,m)=>{A.ok(a,m);n++};
for(const [map,profile] of [[require('../maps/kiev.json'),require('../maps/movement-configs/kiev.json')],[require('../maps/kiev-odessa-composite-experimental-v531.json'),require('../maps/movement-configs/kiev-odessa-experimental-v531.json')]]){
 const binding=B.build(map,profile),board=binding.board;
 const adj=x=>board.edges.filter(e=>(e.a===x||e.b===x)&&!e.impassable&&!e.allSea&&!e.lake).map(e=>e.a===x?e.b:e.a);
 const unit=(id,hex,nationality='german')=>({id,hex,owner:'german',nationality,class:'infantry',size:'corps',mp:4});
 const ctx=(units)=>B.context(binding,{owner:'german',kind:'movement'},Object.fromEntries(units.map(u=>[u.id,u])),2);
 let fixture;
 outer:for(const a of Object.keys(board.cells))for(const b of adj(a))for(const c of adj(b)){
  if(c===a||adj(a).includes(c))continue;
  const q=ctx([unit('u',a),unit('f',b),unit('g',b)]), request={unitId:'u',path:[a,b,c]};
  if(!M.move(q,request).ok)continue;
  if(LP.search({...q,profile:{...q.profile,allowFriendlyOverstackTransit:false}},{unitId:'u'}).pathTo(c)!==null)continue;
  fixture={a,b,c,q,request};break outer;
 }
 ok(fixture,'actual graph witness');const {a,b,c,q,request}=fixture;
 eq(M.move(q,{unitId:'u',path:[a,b]}).reason,'stack-limit');ok(M.transit(q,{unitId:'u',path:[a,b]}).ok);ok(M.move(q,request).ok);
 eq(LP.search(q,{unitId:'u'}).pathTo(b),null);ok(LP.search(q,{unitId:'u'}).pathTo(c));
 // Romanian/Hungarian exclusion remains absolute; use a Romanian mover so
 // the composite Hungarian territory mask cannot hide a stacking failure.
 const mixed=ctx([unit('u',a,'romanian'),unit('f',b,'hungarian'),unit('g',b)]);
 eq(M.transit(mixed,{unitId:'u',path:[a,b]}).reason,'national-stack-exclusion');
 eq(M.move(mixed,request).reason,'national-stack-exclusion');
 console.log('Witness',profile.id,a,b,c);
}
console.log('PASS Kiev source transit',n,'assertions');
