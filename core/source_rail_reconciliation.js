/* Pure, scenario-neutral source-rail comparison. Never authorizes movement:
 * an independently measured SVG crossing may be intentionally excluded by
 * the user's reviewed map corrections (e.g. a boundary exit, not a link).
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameSourceRailReconciliation=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const T=typeof module==='object'&&module.exports?require('./terrain_tiles'):globalThis.HexTerrainTiles;
 const fail=m=>{throw Error('source-rail-reconciliation: '+m);};
 const pair=(a,b)=>[a,b].sort().join(':');
 function inspect({map,derived,svgIds,excludedPairs=[]}={}){
  if(!map||!Array.isArray(map.cells)||!map.geometry||!derived||!Array.isArray(derived.adjacencyPairs)||
     !(svgIds instanceof Set)||!Array.isArray(excludedPairs))fail('invalid-input');
  const cells=new Map(map.cells.map(c=>[c.id,c]));
  if(cells.size!==map.cells.length)fail('duplicate-cell');
  const adjacent=(a,b)=>cells.has(a)&&cells.has(b)&&T.DIRS.some(d=>T.neighbor(cells.get(a),d,map.geometry)===b);
  function keys(rows,role){
   const result=new Map();
   for(const record of rows){
    const [a,b]=role==='registered'?[record.from,record.to]:record;
    if(typeof a!=='string'||typeof b!=='string'||a===b||!adjacent(a,b)||!adjacent(b,a))fail('nonadjacent-'+role+':'+a+':'+b);
    const k=pair(a,b);if(result.has(k))fail('duplicate-'+role+':'+k);
    result.set(k,record);
   }
   return result;
  }
  const registered=keys(map.hexCenterRailConnections||[],'registered');
  const measured=keys(derived.adjacencyPairs,'measured');
  const excluded=keys(excludedPairs,'excluded');
  const excludedNotMeasured=[...excluded.keys()].filter(k=>!measured.has(k));
  const approvedStillPresent=[...excluded.keys()].filter(k=>registered.has(k));
  const measuredMissing=[...measured.keys()].filter(k=>!registered.has(k)&&!excluded.has(k));
  const registeredNotMeasured=[...registered.keys()].filter(k=>!measured.has(k));
  const missingSvgIds=[];
  for(const [k,link] of registered){
   if(!Array.isArray(link.sourceSvgIds)||!link.sourceSvgIds.length||link.sourceSvgIds.some(id=>typeof id!=='string'||!id))fail('missing-link-source-id:'+k);
   for(const id of link.sourceSvgIds)if(!svgIds.has(id))missingSvgIds.push({pair:k,id});
  }
  if(excludedNotMeasured.length||approvedStillPresent.length||measuredMissing.length||registeredNotMeasured.length||missingSvgIds.length)
   fail('unreconciled-geometry:'+JSON.stringify({excludedNotMeasured,approvedStillPresent,measuredMissing,registeredNotMeasured,missingSvgIds}));
  return Object.freeze({mapId:map.id,semantics:'verified-source-registration-agreement-not-gameplay-authority',
   authorizedForMovement:false,counts:{registeredRailLinks:registered.size,measuredSvgCrossings:measured.size,
    explicitlyRemovedCrossings:excluded.size,traceableRailLinks:registered.size},
   excludedCrossings:[...excluded.keys()].sort(),railLinks:[...registered].sort(([a],[b])=>a.localeCompare(b)).map(([key,link])=>({key,sourceSvgIds:link.sourceSvgIds}))});
 }
 return Object.freeze({inspect});
});
