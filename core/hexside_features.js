/* Shared hexside feature ledger. This is the same geography used by the renderer.
 * Geometry and decorative source vectors NEVER authorize gameplay edges.
 * No runtime-supplied flag can elevate a map to certified status.
 */
(function(root,factory){
 const T=(typeof module==='object'&&module.exports)?require('./terrain_tiles'):root.HexTerrainTiles;
 const G=(typeof module==='object'&&module.exports)?require('./map_movement_graph'):root.WargameMapMovementGraph;
 const api=factory(T,G);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameHexsideFeatures=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(T,G){'use strict';
 const fail=message=>{throw Error('hexside-features: '+message);};
 const key=(a,b)=>[a,b].sort().join(':');
 const freeze=record=>Object.freeze(record);
 // Immutable ledger of the last completely fingerprint-pinned experimental map.
 // Always run G.build first; its source checks cannot be bypassed by this cache.
 let pinnedLedger=null;
 function inspectInternal(map,{experimentalScope=null}={},requireCertified=false){
  // Binding historically checks source authorization before inspecting hexsides.
  let certifiedGraph=requireCertified?G.build(map,{experimentalScope}):null;
  if(!map||!Array.isArray(map.cells)||!map.geometry||!T)return fail('invalid-map');
  const initialPin=certifiedGraph?.metadata?.scope==='experimental'?certifiedGraph.metadata.sourceGraphDigest:null;
  if(initialPin&&pinnedLedger?.pin===initialPin&&pinnedLedger.ledger.metadata.mapId===map.id)
   return {ledger:pinnedLedger.ledger,board:certifiedGraph};
  const byId=new Map();
  for(const c of map.cells){if(!c||typeof c.id!=='string'||byId.has(c.id))return fail('invalid-or-duplicate-hex');byId.set(c.id,c);}
  const shore=new Set();
  for(const h of map.authoredShoreHexsides||[]){
   if(!byId.has(h.cellId)||!T.DIRS.includes(h.dir))return fail('invalid-shore-side');
   const marker=h.cellId+':'+h.dir;if(shore.has(marker))return fail('duplicate-shore-side');shore.add(marker);
  }
  // Only the immutable existing registry can grant certification.
  // A provisional map is valid as an audit source but not for movement.
  if(!requireCertified)try{certifiedGraph=G.build(map,{experimentalScope});}catch(e){
   if(!String(e.message).includes('source-geometry-not-gameplay-certified'))throw e;
  }
  const certified=Boolean(certifiedGraph);
  const pin=certifiedGraph?.metadata?.scope==='experimental'?certifiedGraph.metadata.sourceGraphDigest:null;
  if(pin&&pinnedLedger?.pin===pin&&pinnedLedger.ledger.metadata.mapId===map.id)
   return {ledger:pinnedLedger.ledger,board:certifiedGraph};
  const verified=new Map((certifiedGraph?.edges||[]).map(e=>[key(e.a,e.b),e]));
  const edges=[],index=new Set();
  for(const c of map.cells)for(const dir of T.DIRS){
   const dest=T.neighbor(c,dir,map.geometry),other=byId.get(dest);if(!other)continue;
   const pair=key(c.id,dest);if(index.has(pair))continue;index.add(pair);
   if(T.neighbor(other,T.OPP[dir],map.geometry)!==c.id)return fail('nonreciprocal-neighbors:'+pair);
   const reverse=T.OPP[dir],a=c.tileEdges?.[dir]||[],b=other.tileEdges?.[reverse]||[];
   const coast=shore.has(c.id+':'+dir)||shore.has(dest+':'+reverse);
   const match=verified.get(pair);
   if(certified&&!match)return fail('certified-graph-edge-missing:'+pair);
   const sourceFeatures=[...a,...b].filter(f=>['rail','river'].includes(f.kind));
   // Candidate features describe visible artwork, not established gameplay legality.
   edges.push(freeze({a:c.id,b:dest,sideA:dir,sideB:reverse,
    rail:certified?match.rail:false,river:certified?match.river:false,
    impassable:certified?match.impassable:null,
    authoredShore:coast,sourceFeatureCount:sourceFeatures.length,
    evidence:certified?(certifiedGraph.metadata.scope==='experimental'?'source-pinned-experimental-movement':'certified-movement'):'geometry-only',
    movementAuthorized:certified&&!match.impassable,
    sourceMapId:map.id}));
  }
  // All registered rail links must be among verified topology, enforced by G.build.
  const entries=edges.sort((a,b)=>a.a.localeCompare(b.a)||a.b.localeCompare(b.b));
  const ledger=freeze({metadata:freeze({mapId:map.id,certified,scope:certifiedGraph?.metadata?.scope||'historical-source-binding',hexCount:byId.size,edgeCount:entries.length,
   certifiedRailEdges:entries.filter(e=>e.rail).length,
   certifiedRiverEdges:entries.filter(e=>e.river).length,
   authoredShoreSides:shore.size}),edges:Object.freeze(entries)});
  if(pin)pinnedLedger={pin,ledger};
  return {ledger,board:certifiedGraph};
 }
 // Both views are derived in one validated pass. No caller-provided graph can
 // bypass certification; no returned mutable board is shared between calls.
 function inspect(map,options){return inspectInternal(map,options).ledger;}
 function inspectWithGraph(map,options){return inspectInternal(map,options,true);}
 function edge(ledger,a,b){if(!ledger||typeof a!=='string'||typeof b!=='string')return fail('invalid-lookup');return ledger.edges.find(e=>key(e.a,e.b)===key(a,b))||null;}
 return Object.freeze({inspect,inspectWithGraph,edge});
});
