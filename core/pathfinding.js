/* Shared, advisory weighted routing on a source-certified movement graph.
 * This service never authorizes a move: movement_rules.move is authoritative.
 * No geometric-distance shortcuts, SVG-derived implied connections, or AI policy.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargamePathfinding=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const fail=m=>{throw Error('pathfinding: '+m);};
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function compile(board){
 if(!board||!board.cells||typeof board.cells!=='object'||!Array.isArray(board.edges))fail('invalid-board');
 const ids=Object.keys(board.cells).sort();if(!ids.length)fail('empty-board');
 const adj=Object.fromEntries(ids.map(id=>[id,[]]));const seen=new Set();
 for(const edge of board.edges){
  if(!edge||typeof edge.a!=='string'||typeof edge.b!=='string'||edge.a===edge.b||!own(adj,edge.a)||!own(adj,edge.b))fail('invalid-edge');
  const key=[edge.a,edge.b].sort().join('|');if(seen.has(key))fail('duplicate-edge:'+key);seen.add(key);
  // A graph's geometric adjacency is not permission for routing. Require verified evidence.
  if(edge.verified!==true)continue;
  adj[edge.a].push({to:edge.b,edge});adj[edge.b].push({to:edge.a,edge});
 }
 for(const id of ids)adj[id].sort((a,b)=>a.to.localeCompare(b.to));
 return {board,adj,ids};
}
// Positive edge costs are required for deterministic, non-cyclic predecessor paths.
function search(graph,{origin,target=null,edgeCost=null,blocked=null,maxCost=Infinity}={}){
 if(!graph||!graph.adj||!graph.board||typeof origin!=='string'||!own(graph.adj,origin))fail('invalid-origin');
 if(target!==null&&(!own(graph.adj,target)||typeof target!=='string'))fail('invalid-target');
 if(!(maxCost===Infinity||(typeof maxCost==='number'&&Number.isFinite(maxCost)&&maxCost>=0)))fail('invalid-max-cost');
 if(edgeCost!==null&&typeof edgeCost!=='function')fail('invalid-edge-cost');
 if(blocked!==null&&typeof blocked!=='function')fail('invalid-blocked-filter');
 const dist=new Map([[origin,0]]),prev=new Map(),settled=new Set();
 const heap=[];
 const less=(a,b)=>a.cost!==b.cost?a.cost<b.cost:a.id<b.id;
 function push(v){heap.push(v);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(!less(heap[i],heap[p]))break;[heap[p],heap[i]]=[heap[i],heap[p]];i=p;}}
 function pop(){const out=heap[0],tail=heap.pop();if(heap.length){heap[0]=tail;let i=0;while(true){let n=i,l=2*i+1,r=l+1;if(l<heap.length&&less(heap[l],heap[n]))n=l;if(r<heap.length&&less(heap[r],heap[n]))n=r;if(n===i)break;[heap[n],heap[i]]=[heap[i],heap[n]];i=n;}}return out;}
 push({id:origin,cost:0});
 while(heap.length){
  const {id,cost}=pop();if(settled.has(id)||cost!==dist.get(id))continue;
  settled.add(id);if(id===target)break;
  for(const {to,edge} of graph.adj[id]){
   if(settled.has(to)||edge.impassable===true||edge.allSea===true||edge.lake===true)continue;
   if(graph.board.cells[to]?.verified!==true||graph.board.cells[id]?.verified!==true)continue;
   if(blocked?.({from:id,to,edge,board:graph.board})===true)continue;
   // Cost is directional: terrain is normally charged on destination entry.
   const step=edgeCost?edgeCost({from:id,to,edge,fromCell:graph.board.cells[id],toCell:graph.board.cells[to]}):1;
   if(step===null||step===Infinity)continue; // deliberately excluded edge
   if(typeof step!=='number'||!Number.isFinite(step)||step<=0)fail('invalid-step-cost:'+id+'->'+to);
   const next=cost+step;if(next>maxCost)continue;
   if(next<(dist.get(to)??Infinity)){
    dist.set(to,next);prev.set(to,id);push({id:to,cost:next});
   }
  }
 }
 const costTo=id=>dist.get(id)??Infinity;
 const pathTo=id=>{if(!dist.has(id))return null;const path=[id];let cursor=id;
  while(cursor!==origin){cursor=prev.get(cursor);if(cursor===undefined)fail('invalid-predecessors');path.push(cursor);}return path.reverse();};
 return {origin,costTo,pathTo,withinBudget:budget=>{
  if(typeof budget!=='number'||!Number.isFinite(budget)||budget<0)fail('invalid-budget');
  return [...dist].filter(([,d])=>d<=budget).sort((a,b)=>a[1]-b[1]||a[0].localeCompare(b[0])).map(([id,cost])=>({id,cost}));
 },distances:()=>Object.fromEntries([...dist].sort((a,b)=>a[0].localeCompare(b[0])))};
}
function terrainCost(profile,{edge,toCell}){
 if(!profile||!profile.terrainCosts||!toCell)return fail('missing-profile');
 const base=edge.rail?profile.railCost:profile.terrainCosts[toCell.terrain];
 if(!Number.isFinite(base)||base<=0)fail('unpriced-terrain');
 return base+(edge.majorRiver===true&&!edge.rail?(profile.majorRiverExtraCost||0):0);
}
return Object.freeze({compile,search,terrainCost});
});
