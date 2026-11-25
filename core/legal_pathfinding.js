/* Rule-aware, bounded path enumeration on the SAME certified graph as movement adjudication.
 * Validates every returned destination/path with movement_rules.move().
 * Unlike shortest paths over terrain alone, this does not treat EZOC as a static edge weight.
 * Stop legality and transit-only legality are separate. Transit over a friendly stack
 * requires explicit profile authorization and NEVER yields a reported destination.
 */
(function(root,factory){
 const P=typeof module==='object'&&module.exports?require('./pathfinding'):root.WargamePathfinding;
 const M=typeof module==='object'&&module.exports?require('./movement_rules'):root.WargameMovementRules;
 const api=factory(P,M);if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameLegalPathfinding=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(P,M){'use strict';
 const fail=m=>{throw Error('legal-pathfinding: '+m);};
 function search(ctx,options={}){
  if(!ctx||!ctx.board||!ctx.units||!ctx.profile||!ctx.phase)fail('invalid-context');
  return M.withSearchIndexes(ctx,()=>searchIndexed(ctx,options));
 }
 // One immutable read scope for a batch of unit searches; never retained across calls.
 function searchBatch(ctx,queries){
  if(!ctx||!ctx.board||!ctx.units||!ctx.profile||!ctx.phase||!Array.isArray(queries))fail('invalid-context');
  return M.withSearchIndexes(ctx,()=>{const graph=P.compile(ctx.board);return queries.map(q=>searchIndexed(ctx,q,graph));});
 }
 function searchIndexed(ctx,{unitId,mode=null,maxStates=50000,maxDepth=null}={},compiled=null){
  if(!ctx||!ctx.board||!ctx.units||!ctx.profile||!ctx.phase||!ctx.units[unitId])fail('invalid-context');
  if(mode!==null&&mode!=='rail')fail('unsupported-mode');
  if(!Number.isSafeInteger(maxStates)||maxStates<1)fail('invalid-max-states');
  const unit=ctx.units[unitId];if(typeof unit.hex!=='string')fail('invalid-origin');
  const graph=compiled||P.compile(ctx.board);if(!Object.hasOwn(graph.adj,unit.hex))fail('invalid-origin');
  const limit=maxDepth===null?unit.mp:maxDepth;
  if(!Number.isSafeInteger(limit)||limit<1||limit>graph.ids.length)fail('invalid-max-depth');
  const origin=unit.hex, found=new Map();
  // Discard only provably dominated route prefixes. Movement legality after a
  // prefix depends on current hex, remaining MP and the already-visited hexes.
  // A cheaper prefix with a SUBSET of visited hexes can follow every onward
  // suffix of the longer prefix; arbitrary cheapest-by-hex pruning is UNSAFE.
  const dominates=(a,b)=>a.cost<=b.cost&&
   (a.cost<b.cost||a.key<=b.key)&&[...a.visited].every(id=>b.visited.has(id));
  const labels=new Map();
  const first={path:[origin],cost:0,key:origin,visited:new Set([origin]),discarded:false};
  labels.set(origin,[first]);
  // Deterministic frontier ordering, with no artificial static-terrain cost assumptions.
  const queue=[first];let head=0, expanded=0;
  while(head<queue.length){
   const current=queue[head++];
   if(current.discarded)continue;
   if(++expanded>maxStates)fail('search-limit-exceeded');
   if(current.path.length-1>=limit)continue;
   const from=current.path[current.path.length-1];
   for(const {to} of graph.adj[from]){
    if(current.path.includes(to))continue;
    const path=[...current.path,to];
    const request={unitId,path};if(mode)request.mode=mode;
    const verdict=M.move(ctx,request);
    // A transit-only step can be expanded, but is never advertised as a legal stop.
    const through=verdict.ok?verdict:M.transit(ctx,request);
    if(!through.ok)continue;
    if(verdict.ok){
     const old=found.get(to);
     if(!old||verdict.cost<old.cost||(verdict.cost===old.cost&&path.join('|')<old.path.join('|')))
      found.set(to,{id:to,path,cost:verdict.cost,remaining:verdict.remaining});
    }
    // Every expanded prefix has been authorized by the common movement adjudicator.
    // Consult the same transit rule for exceptional EZOC passage (e.g. Surprise Attack).
    if(through.remaining>0&&(!M.enemyZOC(ctx,to,unit.owner)||M.transit(ctx,request).ok)){
     const next={path,cost:through.cost,key:path.join('|'),visited:new Set(path),discarded:false};
     const at=labels.get(to)||[];
     if(!at.some(old=>dominates(old,next))){
      const survivors=[];
      for(const old of at){
       if(dominates(next,old))old.discarded=true;
       else survivors.push(old);
      }
      survivors.push(next);labels.set(to,survivors);queue.push(next);
     }
    }
   }
  }
  const ordered=[...found.values()].sort((a,b)=>a.cost-b.cost||a.id.localeCompare(b.id));
  return Object.freeze({origin,expanded,reachable:()=>ordered.map(r=>({...r,path:[...r.path]})),
   pathTo:id=>found.get(id)?.path.slice()??null,costTo:id=>found.get(id)?.cost??Infinity,
   withinBudget:budget=>{if(!Number.isFinite(budget)||budget<0)fail('invalid-budget');return ordered.filter(x=>x.cost<=budget).map(r=>({...r,path:[...r.path]}));}});
 }
 return Object.freeze({search,searchBatch});
});
