#!/usr/bin/env node
/* Mathematical and provenance regression tests for unified campaign rails. */
'use strict';
const assert=require('node:assert/strict');
const T=require('../core/terrain_tiles'),C=require('../maps/composer'),A=require('../core/terrain_adapter');
const base=require('../maps/kiev.json'),ext=require('../maps/odessa-extension.json');
const boards={
 'battle-for-moscow':require('../maps/battle-for-moscow.json'),arduous:require('../maps/arduous.json'),
 leningrad:require('../maps/leningrad.json'),kiev:base,'kiev-odessa':C.compose(base,ext)
};
const expected={'battle-for-moscow':[70,10],arduous:[88,10],leningrad:[80,5],kiev:[97,9],'kiev-odessa':[126,10]};
const norm=a=>{let l=Math.hypot(...a);return a.map(v=>v/(l||1))};
for(const [id,board] of Object.entries(boards)){
 const cfg=board.railwayPresentation;
 assert.deepEqual(cfg,T.RAILWAY_PRESENTATION,id+' nonstandard shared spline config');
 const [links,exits]=expected[id],radii=id==='battle-for-moscow'?{rx:57.275,ry:101.9/Math.sqrt(3)}:{};
 const net=T.railSplineNetwork(board,radii);
 assert.equal(net.linkCount,links);assert.equal(net.exitCount,exits);
 assert.equal(net.segments.length,links+exits);
 assert.equal(new Set(net.segments.map(s=>[s.from,s.to||s.dir].join(':'))).size,links+exits);
 const seen=new Map();
 for(const seg of net.segments){
  const [start,end]=[T.railSplineSample(seg,0),T.railSplineSample(seg,1)];
  assert.deepEqual(start.p,seg.p0);assert.deepEqual(end.p,seg.p3);
  assert.deepEqual(start.p,T.coord(board.cells.find(c=>c.id===seg.from),board.geometry));
  if(seg.to)assert.deepEqual(end.p,T.coord(board.cells.find(c=>c.id===seg.to),board.geometry));
  for(let k=0;k<=10;k++){
   const p=T.railSplineSample(seg,k/10).p;
   assert(p.every(Number.isFinite),id+' nonfinite spline coordinate');
   const len=Math.hypot(p[0]-seg.p0[0],p[1]-seg.p0[1]);
   assert(len<150,id+' extreme control-point overshoot');
  }
  assert(/^M-?\d+\.\d+,-?\d+\.\d+ C-?\d+\.\d+,-?\d+\.\d+ /.test(T.railSplinePath(seg)));
  if(!seg.to)continue;
  for(const [which,nodeId] of [['start',seg.from],['end',seg.to]]){
   const tangent=(which==='start'?start:end).tangent;
   (seen.get(nodeId)||seen.set(nodeId,[]).get(nodeId)).push(which==='start'?norm(tangent):norm(tangent));
  }
 }
 // Continuity: any unbranched two-link interior junction must have identical
 // traversal tangents (one inbound, one outbound), up to orientation and
 // floating-point tolerance. Branches need not have C1 smoothness.
 for(const [node,ts] of seen)if(ts.length===2){
  let dot=ts[0][0]*ts[1][0]+ts[0][1]*ts[1][1];
  assert(Math.abs(dot)>.999,id+' kink at simple rail junction '+node+': '+dot);
 }
 const straight=T.railSplineNetwork(board,{...radii,railwaySplineTension:0});
 assert.deepEqual(straight.segments.map(s=>[s.p0,s.p3]),net.segments.map(s=>[s.p0,s.p3]),id+' changing curvature changed anchors');
 console.log(id+': '+links+' source-linked center segments, '+exits+' off-map stubs, spline geometry valid');
}
const scenario=require('../legacy/data/scenario.json');
const live=A.oberlabsBoard(scenario,(x,y)=>({x:(x+1)*30,y:(y+1)*40}));
assert.deepEqual(live.hexCenterRailConnections,boards['battle-for-moscow'].hexCenterRailConnections);
assert.deepEqual(live.railwayBoundaryExits,boards['battle-for-moscow'].railwayBoundaryExits);
assert.deepEqual(live.railwayPresentation,boards['battle-for-moscow'].railwayPresentation);
console.log('Live Moscow and map-export railroad topology agree; no gameplay data changed.');
