'use strict';
const assert=require('node:assert/strict');
const P=require('../core/pathfinding');
const G=require('../core/map_movement_graph');
const Binding=require('../core/movement_binding');
const L=require('../maps/leningrad.json');
const profile=require('../maps/movement-configs/leningrad.json');
let n=0;const eq=(actual,expected)=>{assert.deepEqual(actual,expected);n++;};
const board={cells:Object.fromEntries(['A','B','C','D','E'].map(id=>[id,{verified:true,terrain:'open'}])),edges:[
 {a:'A',b:'B',verified:true},{a:'A',b:'C',verified:true},{a:'B',b:'D',verified:true},{a:'C',b:'D',verified:true},{a:'D',b:'E',verified:true},
]};
const graph=P.compile(board);const weights={'A:B':2,'A:C':1,'B:D':5,'C:D':2,'D:E':1};
const edgeCost=({from,to})=>weights[[from,to].sort().join(':')];
const result=P.search(graph,{origin:'A',edgeCost});
eq(result.costTo('E'),4);eq(result.pathTo('E'),['A','C','D','E']);
eq(result.costTo('A'),0);eq(result.pathTo('A'),['A']);
eq(result.withinBudget(3),[{id:'A',cost:0},{id:'C',cost:1},{id:'B',cost:2},{id:'D',cost:3}]);
const restricted=P.search(graph,{origin:'A',edgeCost,blocked:({to})=>to==='C'});
eq(restricted.pathTo('E'),['A','B','D','E']);eq(restricted.costTo('E'),8);
const capped=P.search(graph,{origin:'A',edgeCost,maxCost:2});eq(capped.pathTo('E'),null);eq(capped.costTo('E'),Infinity);
const disconnected=structuredClone(board);disconnected.edges[4].verified=false;
eq(P.search(P.compile(disconnected),{origin:'A',edgeCost}).pathTo('E'),null);
const impassable=structuredClone(board);impassable.edges[3].impassable=true;
eq(P.search(P.compile(impassable),{origin:'A',edgeCost}).pathTo('D'),['A','B','D']);
const before=JSON.stringify(board);P.search(graph,{origin:'A',edgeCost});eq(JSON.stringify(board),before);
for(const args of [ {origin:'Z'},{origin:'A',edgeCost:()=>-1},{origin:'A',edgeCost:()=>NaN},{origin:'A',maxCost:-1}]){assert.throws(()=>P.search(graph,args),/pathfinding:/);n++;}
const bad=structuredClone(board);bad.edges.push({...bad.edges[0]});assert.throws(()=>P.compile(bad),/duplicate-edge/);n++;
// Source-certified real map; the routing layer never modifies or promotes graph source policy.
const realBoard=G.build(L),real=P.compile(realBoard);
eq(real.ids.length,197);eq(realBoard.edges.length,533);
const passableEdge=realBoard.edges.find(e=>!e.impassable&&realBoard.cells[e.a].verified&&realBoard.cells[e.b].verified);
assert.ok(passableEdge);n++;
const route=P.search(real,{origin:passableEdge.a,edgeCost:x=>P.terrainCost(profile,x),maxCost:2});
assert.ok(route.pathTo(passableEdge.b));n++;
const coast=realBoard.edges.find(e=>e.impassable&&realBoard.cells[e.a].verified&&realBoard.cells[e.b].verified);
if(coast){const one=P.search(real,{origin:coast.a,maxCost:1});assert.notDeepEqual(one.pathTo(coast.b),[coast.a,coast.b]);n++;}
const binding=Binding.build(L,profile);
const bound=Binding.routes(binding,passableEdge.a,{maxCost:2});
eq(bound.costTo(passableEdge.b),route.costTo(passableEdge.b));
// This distance service is NOT legal movement: EZOC, stacking and phase rules live in movement_rules.js.
eq(P.compile(G.build(require('../maps/arduous.json'))).ids.length,155);
// Kiev's reviewed graph is now authorized; this does not certify historical rules.
const kiev=require('../maps/kiev.json'),kb=G.build(kiev),kg=P.compile(kb);
eq(kg.ids.length,165);eq(kb.edges.length,442);
const ke=kb.edges.find(e=>e.verified&&!e.impassable&&kb.cells[e.a].verified&&kb.cells[e.b].verified);
assert.ok(ke);n++;eq(P.search(kg,{origin:ke.a,maxCost:1}).pathTo(ke.b),[ke.a,ke.b]);
const tampered=structuredClone(kiev);tampered.sourceImageSHA256='fake';
assert.throws(()=>G.build(tampered),/not-gameplay-certified/);n++;
const composite=require('../maps/composer').compose(kiev,require('../maps/odessa-extension.json'));
assert.throws(()=>G.build(composite),/not-gameplay-certified/);n++;
console.log('PASS shared pathfinding',n,'assertions');
