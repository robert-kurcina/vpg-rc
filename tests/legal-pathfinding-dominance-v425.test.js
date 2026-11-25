'use strict';
/* Independent exhaustive simple-path oracle for the source movement adjudicator.
 * The optimized shared pathfinder must retain the same legal stopping hexes,
 * cost and lexicographically selected route. None of the test data changes a
 * scenario rule or admits non-source movement edges.
 */
const assert=require('node:assert/strict');
const Legal=require('../core/legal_pathfinding');
const Move=require('../core/movement_rules');
const actualProfile=require('../maps/movement-configs/arduous.json');
function oracle(ctx,unitId,mode){
 const origin=ctx.units[unitId].hex,unit=ctx.units[unitId],found=new Map();
 const neighbors=new Map(Object.keys(ctx.board.cells).map(id=>[id,[]]));
 for(const e of ctx.board.edges){if(e.verified!==true)continue;neighbors.get(e.a).push(e.b);neighbors.get(e.b).push(e.a)}
 const queue=[[origin]];
 for(let index=0;index<queue.length;index++){
  const path=queue[index];if(path.length-1>=unit.mp)continue;
  for(const to of neighbors.get(path.at(-1))){
   if(path.includes(to))continue;
   const extended=[...path,to],req={unitId,path:extended};if(mode)req.mode=mode;
   const stop=Move.move(ctx,req),through=stop.ok?stop:Move.transit(ctx,req);
   if(!through.ok)continue;
   if(stop.ok){
    const old=found.get(to);
    if(!old||stop.cost<old.cost||(stop.cost===old.cost&&extended.join('|')<old.path.join('|')))
     found.set(to,{path:extended,cost:stop.cost});
   }
   if(through.remaining>0&&!Move.enemyZOC(ctx,to,unit.owner))queue.push(extended);
  }
  assert(queue.length<75000,'independent oracle limit');
 }
 return found;
}
const ids='ABCDEFGHI'.split('');let checked=0,improvedFixtures=0;
for(let seed=1;seed<=80;seed++){
 let bits=(seed*1664525+1013904223)>>>0;
 const rand=()=>{bits=(Math.imul(bits,1664525)+1013904223)>>>0;return bits/4294967296};
 const cells=Object.fromEntries(ids.map((id,i)=>[id,{terrain:rand()>.32?'open':'forest',verified:true,rail:rand()>.45}]));
 const edges=[];const seen=new Set();
 const connect=(a,b)=>{const key=[a,b].sort().join(':');if(seen.has(key))return;seen.add(key);edges.push({a,b,verified:true,rail:rand()>.5,river:rand()>.7})};
 for(let i=1;i<ids.length;i++)connect(ids[i-1],ids[i]);
 for(let i=0;i<ids.length;i++)for(let j=i+2;j<ids.length;j++)if(rand()>.75)connect(ids[i],ids[j]);
 const owner=seed%2?'german':'soviet',kind=seed%3?'infantry':'mechanized';
 const units={x:{id:'x',owner,hex:'A',mp:seed%3+3,class:kind,size:'corps',nationality:owner}};
 if(seed%4===0)units.enemy={id:'enemy',owner:owner==='german'?'soviet':'german',hex:'I',mp:3,class:'infantry',size:'corps',nationality:'enemy'};
 if(seed%7===0)units.friend={id:'friend',owner,hex:'D',mp:3,class:'infantry',size:'corps',nationality:owner};
 const profile={...actualProfile,firstTurnSurpriseMovement:false};
 const ctx={board:{cells,edges},units,phase:{kind:seed%3?'movement':'special-movement',owner},turn:2,profile};
 for(const mode of [null,...(owner==='soviet'&&kind==='infantry'&&ctx.phase.kind==='special-movement'?['rail']:[])]){
  const expected=oracle(ctx,'x',mode),found=Legal.search(ctx,{unitId:'x',mode,maxStates:60000});
  const actual=found.reachable();
  assert.equal(actual.length,expected.size,'reachable stop count seed='+seed);
  for(const a of actual){
   assert.deepEqual({path:a.path,cost:a.cost},expected.get(a.id),'certified path/cost seed='+seed+' destination '+a.id);
   assert.equal(Move.move(ctx,{unitId:'x',path:a.path,...(mode?{mode}:{})}).ok,true);
   checked++;
  }
  improvedFixtures++;
 }
}
console.log('PASS dominance-pruned shared movement search',improvedFixtures,'oracle scenarios,',checked,'legal paths');
