/* Source-pinned, explicitly opt-in experimental movement graph.
 * General adapter: no scenario ID branches. Candidate topology can be exercised
 * by the SAME movement/combat rules without asserting historical certification.
 * A loaded JSON configuration alone cannot grant approval: both the exact
 * map fingerprint and independently pinned ledger digest must agree.
 */
(function(root,factory){const api=factory(
 typeof module==='object'&&module.exports?require('./terrain_tiles'):root.HexTerrainTiles,
 typeof module==='object'&&module.exports?require('node:crypto'):null,
 typeof module==='object'&&module.exports?require('../maps/movement-configs/experimental-source-graph-ledgers.json'):null);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameSourceExperimentalMovementGraph=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(T,Crypto,registry){'use strict';
 const reject=m=>{throw Error('experimental-movement-graph: '+m)};
 const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?
  Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
 // Cache digests and a private serialized topology, never an authorization result.
 // Exact serialized content, not object identity, is the cache key: in-place
 // edits and different scenario data must still pass the original digest gate.
 // Two bounded slots avoid holding every map/ledger ever opened.
 function memoDigest(){
  let previous=null,result=null;
  return x=>{
   const serialized=JSON.stringify(x);
   if(serialized===previous)return result;
   const next=Crypto.createHash('sha256').update(canonical(x)).digest('hex');
   previous=serialized;result=next;return next;
  };
 }
 const mapDigest=memoDigest(),ledgerDigest=memoDigest();
 // One bounded verified topology. The complete map and ledger digest gate below
 // remains mandatory on every call; the cached JSON yields detached mutable graphs.
 let topology=null;
 const pair=(a,b)=>[a,b].sort().join(':');
 function build(map,policy){
  const record=registry?.maps?.[map?.id];
  if(!Crypto||!T||registry?.schemaVersion!==1||!record||record.schemaVersion!==1||
   record.mapId!==map.id||record.sourceGame!==map.sourceGame||
   record.status!=='explicit-experimental-source-vector-candidate'||
   policy.edgeMode!=='source-vector-experimental-v1'||
   record.scope!==policy.authorizationScope||
   record.sourceSvgSHA256!==map.authoritativeSourceGeometry?.sha256||
   record.mapDigest!==mapDigest(map)||record.mapDigest!==policy.mapDigest||
   policy.edgeLedgerSHA256!==ledgerDigest(record))reject('source-map-or-ledger-fingerprint-mismatch');
  const topologyKey=record.mapDigest+':'+policy.edgeLedgerSHA256;
  if(topology?.key===topologyKey){
   const graph=JSON.parse(topology.json);
   graph.metadata.coverage=policy.coverage;
   return graph;
  }
  if(!record.board||!record.board.cells||!Array.isArray(record.board.edges)||
   Object.keys(record.board.cells).length!==map.cells.length)reject('incomplete-candidate-board');
  const byId=new Map(map.cells.map(c=>[c.id,c]));
  if(byId.size!==map.cells.length)reject('duplicate-map-cells');
  const cells={};
  for(const [id,cell] of Object.entries(record.board.cells)){
   const source=byId.get(id),land=source?.terrain!=='sea';
   if(!source||cell.sourceTerrainStatus!==source.terrainStatus||
      cell.verified!==land||!['open','forest','swamp','city','major-city','sea'].includes(cell.terrain)||
      (source.terrain==='sea')!==(cell.terrain==='sea')||
      (cell.sourceTerritory||null)!==(source.sourceTerritory||null))reject('candidate-cell-evidence-mismatch:'+id);
   cells[id]={...cell};
  }
  const seen=new Set(),edges=[];
  for(const edge of record.board.edges){
   const a=byId.get(edge.a),b=byId.get(edge.b),key=pair(edge.a,edge.b);
   if(!a||!b||edge.a>=edge.b||seen.has(key)||
    !T.DIRS.some(d=>T.neighbor(a,d,map.geometry)===edge.b)||
    edge.verified!==true||typeof edge.rail!=='boolean'||typeof edge.river!=='boolean'||
    typeof edge.majorRiver!=='boolean'||typeof edge.impassable!=='boolean'||
    typeof edge.lake!=='boolean'||typeof edge.allSea!=='boolean'||
    (edge.allSea!==(a.terrain==='sea'||b.terrain==='sea'))||
    (edge.impassable!==(edge.allSea||edge.lake))||
    (edge.rail&&edge.impassable)||(edge.river&&edge.majorRiver))reject('invalid-candidate-edge:'+key);
   seen.add(key);
   edges.push({...edge,source:'source-vector-experimental-v1'});
  }
  let actualEdges=0;
  for(const c of map.cells)for(const d of T.DIRS){const n=T.neighbor(c,d,map.geometry);if(byId.has(n)&&c.id<n)actualEdges++;}
  if(actualEdges!==seen.size)reject('incomplete-source-topology');
  // This is a playable candidate, NOT source-certified historical movement.
  const graph={cells,edges,metadata:{sourceMapId:map.id,sourceGame:map.sourceGame,
   mapId:map.id,scope:'experimental',historicalCertified:false,
   sourceGraphDigest:policy.edgeLedgerSHA256,hexCount:map.cells.length,
   edgeCount:edges.length,railEdges:edges.filter(e=>e.rail).length,
   riverEdges:edges.filter(e=>e.river).length,
   majorRiverEdges:edges.filter(e=>e.majorRiver).length,
   coverage:policy.coverage}};
  topology={key:topologyKey,json:JSON.stringify({...graph,metadata:{...graph.metadata,coverage:null}})};
  return graph;
 }
 return Object.freeze({build});
});
