/* Verified source map -> single movement adjudication board.
 * Never infer movement permission from visible SVG vectors, adjacent geometry,
 * or a caller-supplied ledger. River != major river without explicit provenance.
 */
(function(root,factory){
 const H=typeof module==='object'&&module.exports?require('./hexside_features'):root.WargameHexsideFeatures;
 const M=typeof module==='object'&&module.exports?require('./movement_rules'):root.WargameMovementRules;
 const P=typeof module==='object'&&module.exports?require('./pathfinding'):root.WargamePathfinding;
 const LP=typeof module==='object'&&module.exports?require('./legal_pathfinding'):root.WargameLegalPathfinding;
 const api=factory(H,M,P,LP);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameMovementBinding=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(H,M,P,LP){'use strict';
 const fail=message=>{throw Error('movement-binding: '+message);};
 const pair=(a,b)=>[a,b].sort().join(':');
 // Only private, deeply frozen copies can be cached. Object.freeze on a
 // caller's root is not evidence that its nested cells or policy are immutable.
 const owned=new WeakSet(),cache=new WeakMap();
 function freezeTree(value){
  if(value&&typeof value==='object'){
   for(const child of Object.values(value))freezeTree(child);
   Object.freeze(value);
  }
  return value;
 }
 function ownSource(value){
  if(owned.has(value))return value;
  const copy=freezeTree(structuredClone(value));owned.add(copy);return copy;
 }
 function prepareContext(context){
  return {...context,map:ownSource(context.map),profile:ownSource(context.profile)};
 }
 function build(map,profile){
  if(!owned.has(map)||!owned.has(profile))return buildUncached(map,profile);
  let byProfile=cache.get(map);
  if(!byProfile){byProfile=new WeakMap();cache.set(map,byProfile);}
  if(!byProfile.has(profile))byProfile.set(profile,freezeTree(buildUncached(map,profile)));
  return byProfile.get(profile);
 }
 function buildUncached(map,profile){
  const p=M.validatedProfile(profile);
  // The ledger builds its own source-authorized graph once; do not construct
  // a second graph just to compare it with the independent hexside checks.
  const experimentalScope=p.experimentalGraphScope||null;
  const {board,ledger}=H.inspectWithGraph(map,{experimentalScope});
  if(!ledger.metadata.certified||ledger.metadata.mapId!==map.id||ledger.edges.length!==board.edges.length)
   fail('uncertified-or-incomplete-ledger');
  const index=new Map(ledger.edges.map(e=>[pair(e.a,e.b),e]));
  if(index.size!==board.edges.length)fail('duplicate-ledger-edge');
  for(const e of board.edges){
   const h=index.get(pair(e.a,e.b));
   if(!h||h.evidence!==(board.metadata.scope==='experimental'?'source-pinned-experimental-movement':'certified-movement')||
      h.rail!==e.rail||h.river!==e.river||
      h.impassable!==e.impassable||h.movementAuthorized===e.impassable)
     fail('ledger-board-disagreement:'+pair(e.a,e.b));
  }
  return Object.freeze({profile:p,board,metadata:Object.freeze({sourceMapId:map.id,
   sourceGame:map.sourceGame,scope:board.metadata.scope||'historical-source-binding',
   hexCount:ledger.metadata.hexCount,edgeCount:ledger.metadata.edgeCount,
   railEdges:ledger.metadata.certifiedRailEdges,riverEdges:ledger.metadata.certifiedRiverEdges})});
 }
 function context(binding,phase,units,turn,territory=undefined){
  if(!binding||!binding.board||!binding.profile||!phase||!units||!Number.isSafeInteger(turn))fail('invalid-context');
  return {profile:binding.profile,board:binding.board,phase,units,turn,territory};
 }
 function move(binding,phase,units,turn,request,territory=undefined){return M.move(context(binding,phase,units,turn,territory),request);}
 // Advisory path planning, not movement legality. The caller MUST submit each
 // candidate path to move(), which applies ZOC, occupancy, class and phase rules.
 function routes(binding,origin,{target=null,maxCost=Infinity,blocked=null}={}){
  if(!binding||!binding.board||!binding.profile)fail('invalid-binding');
  return P.search(P.compile(binding.board),{origin,target,maxCost,blocked,
   edgeCost:step=>P.terrainCost(binding.profile,step)});
 }
 // Rule-aware planning: every reported route is checked through the existing movement adjudicator.
 function legalRoutes(binding,phase,units,turn,unitId,options={}){
  // Territory belongs to the committed historical state, not a path-search
  // heuristic. Supply it to the same shared rules for all explored prefixes.
  const {territory,...query}=options;
  return LP.search(context(binding,phase,units,turn,territory),{unitId,...query});
 }
 function legalRoutesBatch(binding,phase,units,turn,queries,territory){
  return LP.searchBatch(context(binding,phase,units,turn,territory),queries);
 }
 return Object.freeze({build,prepareContext,context,move,routes,legalRoutes,legalRoutesBatch});
});
