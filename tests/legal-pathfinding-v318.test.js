'use strict';
const assert=require('node:assert/strict');
const LP=require('../core/legal_pathfinding');
const M=require('../core/movement_rules');
const Binding=require('../core/movement_binding');
const L=require('../maps/leningrad.json');
const profile=require('../maps/movement-configs/leningrad.json');
let checks=0;function ok(value){assert.ok(value);checks++;}
function eq(a,b){assert.deepEqual(a,b);checks++;}
const cells=Object.fromEntries('ABCDE'.split('').map(id=>[id,{verified:true,terrain:'open',rail:true}]));
const edges=[['A','B'],['B','D'],['A','C'],['C','D'],['D','E']].map(([a,b])=>({a,b,verified:true,rail:true}));
const units={g:{id:'g',owner:'german',hex:'A',mp:4,class:'infantry',size:'corps',nationality:'german'}};
const ctx={board:{cells,edges},units,phase:{kind:'movement',owner:'german'},turn:2,profile};
const result=LP.search(ctx,{unitId:'g'});eq(result.pathTo('E'),['A','B','D','E']);eq(result.costTo('E'),3);
for(const r of result.reachable()){eq(M.move(ctx,{unitId:'g',path:r.path}).ok,true);eq(M.move(ctx,{unitId:'g',path:r.path}).cost,r.cost);}
const zoc=structuredClone(ctx);zoc.units.enemy={id:'enemy',owner:'soviet',hex:'E',mp:3,class:'infantry'};
// D is in enemy ZOC (E adjacent): reaching D is allowed, traversing D to E is not.
const ez=LP.search(zoc,{unitId:'g'});ok(ez.pathTo('D'));eq(ez.pathTo('E'),null);
const occupied=structuredClone(ctx);occupied.units.enemy={id:'enemy',owner:'soviet',hex:'B',mp:3,class:'infantry'};
const alt=LP.search(occupied,{unitId:'g'});eq(alt.pathTo('D'),['A','C','D']);
const short=structuredClone(ctx);short.units.g.mp=2;eq(LP.search(short,{unitId:'g'}).pathTo('E'),null);
const phase=structuredClone(ctx);phase.phase.kind='combat';eq(LP.search(phase,{unitId:'g'}).reachable(),[]);
const rail=structuredClone(ctx);rail.units.g.owner='soviet';rail.phase={kind:'special-movement',owner:'soviet'};
const railR=LP.search(rail,{unitId:'g',mode:'rail'});ok(railR.pathTo('E'));
const noRail=structuredClone(rail);for(const e of noRail.board.edges)if(e.a==='B'||e.b==='B')e.rail=false;eq(LP.search(noRail,{unitId:'g',mode:'rail'}).pathTo('B'),null);
const before=JSON.stringify(ctx);LP.search(ctx,{unitId:'g'});eq(JSON.stringify(ctx),before);
assert.throws(()=>LP.search(ctx,{unitId:'g',maxStates:1}),/search-limit-exceeded/);checks++;
const binding=Binding.build(L,profile);const edge=binding.board.edges.find(e=>!e.impassable&&binding.board.cells[e.a].verified&&binding.board.cells[e.b].verified&&binding.board.cells[e.b].terrain==='open');ok(edge);
const mapunits={x:{id:'x',owner:'german',hex:edge.a,mp:4,class:'infantry',size:'corps',nationality:'german'}};
const bound=Binding.legalRoutes(binding,{kind:'movement',owner:'german'},mapunits,2,'x',{maxStates:20000});ok(bound.pathTo(edge.b));
for(const r of bound.reachable()){const decision=Binding.move(binding,{kind:'movement',owner:'german'},mapunits,2,{unitId:'x',path:r.path});eq(decision.ok,true);eq(decision.cost,r.cost);}
console.log('PASS rule-aware legal-pathfinding',checks,'assertions');
