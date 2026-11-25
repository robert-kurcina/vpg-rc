/* Canonical, read-only per-hex visual-feature projection (Checkpoint 69).
 * Six ordered sides; interior features are rail center-to-side stubs.
 * No value returned by this module is a gameplay legality determination.
 * Original continuous SVG geometry remains authoritative for curved artwork.
 */
(function(root,factory){
 const T=(typeof module==='object'&&module.exports)?require('./terrain_tiles'):root.HexTerrainTiles;
 const api=factory(T);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameHexVisualFeatures=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(T){'use strict';
 const error=m=>{throw Error('hex-visual-features: '+m);};
 const dirs=T.DIRS;
 function normalize(map){
  if(!map||!Array.isArray(map.cells)||!map.geometry)error('invalid map');
  const cells=new Map();
  for(const c of map.cells){if(!c||typeof c.id!=='string'||cells.has(c.id))error('invalid/duplicate cell');
   cells.set(c.id,{id:c.id,terrain:c.terrain||null,terrainStatus:c.terrainStatus||null,
    center:[...T.coord(c,map.geometry)],sides:Object.fromEntries(dirs.map(d=>[d,{neighbor:T.neighbor(c,d,map.geometry),features:[],railStubs:[]}])),
    sourceMapId:map.id});
  }
  // A neighbor outside the actual scenario cell set is a map boundary,
  // not a two-hex shared edge. This also keeps canonical keys consistent
  // with renderer-generated finite sides and source-vector extraction.
  for(const c of cells.values())for(const d of dirs){
   if(!cells.has(c.sides[d].neighbor))c.sides[d].neighbor=null;
  }
  const canonicalSides=new Map(),seen=new Set(),warnings=[];
  // Reuse precisely the segments built by the existing renderer. No alternative hex geometry.
  for(const seg of T.gridSegmentData(map)){
   const item=cells.get(seg.cellId).sides[seg.dir];
   item.midpoint=[(seg.a[0]+seg.b[0])/2,(seg.a[1]+seg.b[1])/2];
   item.endpoints=[seg.a,seg.b];
   if(seg.neighborId&&cells.has(seg.neighborId)){
    const twin=cells.get(seg.neighborId).sides[T.OPP[seg.dir]];
    twin.midpoint=[...item.midpoint];twin.endpoints=[seg.b,seg.a];
   }
  }
  const push=(id,dir,kind,source,role='visual')=>{
   if(!cells.has(id)||!dirs.includes(dir))error('invalid feature side '+id+':'+dir);
   const c=cells.get(id),n=c.sides[dir].neighbor;
   if(!cells.has(n))c.sides[dir].neighbor=null;
   const k=[kind,source?.sourceSvgId||'',id,dir,source?.sourceSegmentIndex??'',role].join('|');
   if(seen.has(k))return;seen.add(k);
   c.sides[dir].features.push({kind,role,source:source||null});
  };
  for(const c of map.cells){
   for(const [dir,arr] of Object.entries(c.tileEdges||{})){
    if(!dirs.includes(dir))error('invalid tile side');
    for(const f of (Array.isArray(arr)?arr:[arr]))if(f?.kind)push(c.id,dir,f.kind,{sourceSvgId:f.sourceSvgId||null,status:f.status||f.reviewStatus||null},'tile');
   }
   for(const [dir,f] of Object.entries(c.hexsideFeatures||{}))if(f?.type&&f.type!=='none')push(c.id,dir,f.type,{sourceSvgId:f.sourceSvgId||null,status:f.reviewStatus||null},'hexside');
   for(const dir of c.railEdges||[])if(dirs.includes(dir))push(c.id,dir,'rail',{status:'legacy'},'legacy');
  }
  for(const f of map.authoredShoreHexsides||[])push(f.cellId,f.dir,f.kind||'coast',{
   sourceSvgId:f.sourceSvgId||null,sourceSegmentIndex:f.sourceSegmentIndex??null,status:'authored-shore'},'shore');
  for(const p of map.entryBoundarySelections?.paths||[])for(const f of p.edges||[])push(f.cellId,f.dir,'reinforcement',{
   sourceSvgId:p.sourceSvgId||null,status:map.entryBoundarySelections.status||null,faction:p.side||null},'entry-boundary');
  let linkedRail=0;
  for(const link of map.hexCenterRailConnections||[]){
   if(!cells.has(link.from)||!cells.has(link.to)){warnings.push('rail endpoint off map '+link.from+' '+link.to);continue;}
   const from=map.cells.find(c=>c.id===link.from),to=map.cells.find(c=>c.id===link.to);
   const d=dirs.find(v=>T.neighbor(from,v,map.geometry)===to.id);
   if(!d){warnings.push('rail endpoints nonadjacent '+link.from+' '+link.to);continue;}
   for(const [id,side] of [[from.id,d],[to.id,T.OPP[d]]]){
    const stub={to:id===from.id?to.id:from.id,sourceSvgIds:[...(link.sourceSvgIds||[])],status:link.status||'unreviewed',visualOnly:true};
    const dest=cells.get(id).sides[side].railStubs;
    if(!dest.some(x=>x.to===stub.to&&JSON.stringify(x.sourceSvgIds)===JSON.stringify(stub.sourceSvgIds)))dest.push(stub);
   }
   linkedRail++;
  }
  for(const c of cells.values())for(const dir of dirs){
   const s=c.sides[dir],n=s.neighbor;
   const edge=n?[c.id,n].sort().join('~'):`${c.id}:${dir}`;
   if(!canonicalSides.has(edge))canonicalSides.set(edge,{key:edge,members:[]});
   canonicalSides.get(edge).members.push({hexId:c.id,dir});
   s.edgeKey=edge;
  }
  for(const side of canonicalSides.values()){
   if(side.members.length>2)error('nonmanifold side');
   side.visualFeatures=side.members.flatMap(m=>cells.get(m.hexId).sides[m.dir].features.map(f=>({...f,observedAt:{hexId:m.hexId,dir:m.dir}})));
   // Not all source features are reciprocal: do not synthesize missing marks.
   side.railVisual=side.members.some(m=>cells.get(m.hexId).sides[m.dir].railStubs.length>0);
  }
  return {schemaVersion:1,mapId:map.id,semantics:'visual-only',hexCount:cells.size,
   railLinksMapped:linkedRail,hexes:Object.fromEntries(cells),edges:Object.fromEntries(canonicalSides),warnings};
 }
 // Add SVG-first *observations* to a normalized visual projection without
 // replacing existing source registrations or granting gameplay permissions.
 // This module intentionally does not import generated audit data implicitly.
 function withSvgLinearObservations(view,ledger,map){
  if(!view||!ledger||!map||view.mapId!==map.id||ledger.mapId!==map.id||ledger.semantics!=='visual-only-not-gameplay-certified'||ledger.authorizedForMovement!==false)error('invalid svg linear ledger');
  const ids=new Set((map.authoredSourceVectors?.railways||[]).concat(map.authoredSourceVectors?.rivers||[],map.authoredSourceVectors?.entryBoundaries||[]).map(x=>x.id));
  if(!ids.size)error('map lacks source vector registry');
  if(ledger.sourceSvgSha256!==map.authoredSourceVectors?.sourceSvgSha256)error('stale source SVG ledger');
  if(Object.keys(ledger.hexes||{}).length!==view.hexCount)error('incomplete svg linear ledger');
  const out=structuredClone(view);
  for(const [id,rec] of Object.entries(ledger.hexes)){
   const h=out.hexes[id];if(!h||rec.hexId!==id)error('unknown ledger hex');
   for(const [dir,stub] of Object.entries(rec.railStubs||{})){
    const side=h.sides[dir];if(!side||side.neighbor!==stub.to||!stub.visualOnly||stub.status!=='svg-derived-visual-crossing')error('invalid rail observation');
    if(!Array.isArray(stub.sourceSvgIds)||!stub.sourceSvgIds.length||stub.sourceSvgIds.some(x=>!ids.has(x)))error('invalid rail path source');
    side.svgRailObservations=[{...stub}];
   }
   for(const [field,dest] of [['riverSides','svgRiverObservations'],['reinforcementSides','svgReinforcementObservations']]){
    for(const [dir,features] of Object.entries(rec[field]||{})){
     const side=h.sides[dir];if(!side||!Array.isArray(features))error('invalid side observation');
     for(const f of features)if(!f.visualOnly||f.status!=='svg-near-side-needs-topological-review'||!ids.has(f.sourceSvgId))error('invalid source observation');
     side[dest]=features.map(f=>({...f}));
    }
   }
  }
  // Enforce symmetric rail derivation, not independent one-sided inference.
  for(const [id,h] of Object.entries(out.hexes))for(const dir of dirs){
   const s=h.sides[dir],other=out.hexes[s.neighbor];
   if(!s.svgRailObservations)continue;
   const back=other?.sides?.[T.OPP[dir]]?.svgRailObservations;
   if(!back||JSON.stringify(back[0].sourceSvgIds)!==JSON.stringify(s.svgRailObservations[0].sourceSvgIds))error('asymmetric SVG railway');
  }
  out.svgLinearObservations={sourceSvgSha256:ledger.sourceSvgSha256,semantics:'visual-only',railDerivedPairs:ledger.counts.railDerivedPairs};
  return out;
 }
 // Checkpoint 78: separate measured SVG-side evidence from the registered
 // features. A physical edge is inserted only once; per-hex lookup is reciprocal.
 function withSvgSideOccupancy(view,ledger,map){
  if(!view||!map||!ledger||view.mapId!==map.id||ledger.mapId!==map.id||
     ledger.semantics!=='svg-measured-visual-only'||ledger.authorizedForMovement!==false)
   error('invalid SVG side occupancy ledger');
  if(ledger.sourceSvgSha256!==map.authoredSourceVectors?.sourceSvgSha256)
   error('stale source SVG side occupancy');
  if(Object.keys(ledger.hexes||{}).length!==view.hexCount)error('incomplete side occupancy ledger');
  const valid={river:new Set((map.authoredSourceVectors?.rivers||[]).map(x=>x.id)),
   reinforcement:new Set((map.authoredSourceVectors?.entryBoundaries||[]).map(x=>x.id))};
  const out=structuredClone(view);
  for(const [key,edge] of Object.entries(ledger.edges||{})){
   const current=out.edges[key];
   if(!current||edge.edgeKey!==key||!Array.isArray(edge.members)||!Array.isArray(edge.observations))
    error('invalid measured side edge');
   const a=edge.members.map(m=>m.hexId+':'+m.dir).sort();
   const b=current.members.map(m=>m.hexId+':'+m.dir).sort();
   if(JSON.stringify(a)!==JSON.stringify(b))error('nonreciprocal measured side');
   const observations=edge.observations.map(o=>{
    if(!valid[o.kind]?.has(o.sourceSvgId)||o.visualOnly!==true||
       o.status!=='svg-measured-visual-only'||
       !['side-follow-candidate','short-near-side','point-crossing-or-touch'].includes(o.relation)||
       !Number.isFinite(o.minimumDistancePx)||!Number.isFinite(o.sideProjectionFraction))
     error('invalid measured SVG observation');
    return {...o};
   });
   current.svgMeasuredObservations=observations;
   for(const m of edge.members){
    const h=out.hexes[m.hexId],s=h?.sides[m.dir];
    if(!s||s.edgeKey!==key)error('invalid measured side member');
    s.svgMeasuredObservations=observations.map(o=>({...o}));
   }
  }
  for(const [id,rec] of Object.entries(ledger.hexes)){
   if(!out.hexes[id]||rec.hexId!==id)error('invalid occupancy hex');
   for(const [dir,items] of Object.entries(rec.sides||{})){
    const side=out.hexes[id].sides[dir];
    if(!side||!Array.isArray(items)||
       JSON.stringify(items)!==JSON.stringify((side.svgMeasuredObservations||[]).map(o=>({edgeKey:side.edgeKey,...o}))))
     error('side occupancy differs from canonical edge');
   }
  }
  out.svgSideOccupancy={semantics:'visual-only',sourceSvgSha256:ledger.sourceSvgSha256,
   physicalSidesWithObservations:Object.keys(ledger.edges).length};
  return out;
 }
 // Checkpoint 79: attach multi-source measured observations to the *composed*
 // visual board. Kiev and Odessa source registrations remain separate even
 // though their finite shared sides belong to one composite hex grid.
 function withSvgMultiSourceSides(view,ledger,sourceRegistries){
  if(!view||!ledger||view.mapId!==ledger.mapId||
     ledger.semantics!=='svg-measured-visual-only'||ledger.authorizedForMovement!==false||
     !Array.isArray(sourceRegistries)||!Array.isArray(ledger.sources)||
     sourceRegistries.length!==ledger.sources.length||
     Object.keys(ledger.hexes||{}).length!==view.hexCount)
   error('invalid multi-source SVG side ledger');
  const ids=new Map();
  for(let i=0;i<sourceRegistries.length;i++){
   const reg=sourceRegistries[i],source=ledger.sources[i];
   if(!reg||!source||reg.sourceKey!==source.sourceKey||
      reg.sourceSvgSha256!==source.sourceSvgSha256||
      reg.sourceFile!==source.sourceFile)
    error('stale SVG source registration');
   if(ids.has(source.sourceKey))error('duplicate source registration');
   const valid=new Map();
   for(const v of reg.rivers||[])valid.set(v.id,'river');
   for(const v of reg.entryBoundaries||[])valid.set(v.id,'reinforcement');
   for(const v of reg.authoredReinforcementTraces||[])valid.set(v.sourceSvgId,'reinforcement');
   ids.set(source.sourceKey,valid);
  }
  const out=structuredClone(view);
  for(const [key,edge] of Object.entries(ledger.edges||{})){
   const original=view.edges[key],dest=out.edges[key];
   if(!original||edge.edgeKey!==key||!Array.isArray(edge.members)||
      !Array.isArray(edge.observations))error('unknown measured physical side');
   const a=edge.members.map(m=>m.hexId+':'+m.dir).sort();
   const b=original.members.map(m=>m.hexId+':'+m.dir).sort();
   if(JSON.stringify(a)!==JSON.stringify(b))error('nonreciprocal measured side');
   const observations=edge.observations.map(o=>{
    if(ids.get(o.sourceKey)?.get(o.sourceSvgId)!==o.kind||o.visualOnly!==true||
       o.status!=='svg-measured-visual-only'||
       !['side-follow-candidate','short-near-side','point-crossing-or-touch'].includes(o.relation)||
       !Number.isFinite(o.minimumDistancePx)||!Number.isFinite(o.sideProjectionFraction))
     error('invalid multi-source SVG observation');
    return {...o};
   });
   dest.svgMeasuredObservations=observations;
   for(const m of edge.members){
    const side=out.hexes[m.hexId]?.sides?.[m.dir];
    if(!side||side.edgeKey!==key)error('invalid measured side member');
    side.svgMeasuredObservations=observations.map(o=>({...o}));
   }
  }
  for(const [id,rec] of Object.entries(ledger.hexes)){
   if(!out.hexes[id]||rec.hexId!==id)error('invalid occupancy hex');
   for(const [dir,items] of Object.entries(rec.sides||{})){
    const side=out.hexes[id].sides[dir];
    if(!side||!Array.isArray(items)||
       JSON.stringify(items)!==JSON.stringify((side.svgMeasuredObservations||[]).map(o=>({edgeKey:side.edgeKey,...o}))))
     error('side occupancy differs from canonical edge');
   }
  }
  out.svgSideOccupancy={semantics:'visual-only',sourceSvgSha256:ledger.sources.map(s=>s.sourceSvgSha256),
   physicalSidesWithObservations:Object.keys(ledger.edges).length};
  return out;
 }
 function hex(view,id){return view?.hexes?.[id]||null;}
 function side(view,id,dir){if(!dirs.includes(dir))error('invalid direction');return hex(view,id)?.sides?.[dir]||null;}
 function shared(view,id,dir){const s=side(view,id,dir);return s?view.edges[s.edgeKey]:null;}
 return Object.freeze({normalize,withSvgLinearObservations,withSvgSideOccupancy,withSvgMultiSourceSides,hex,side,shared});
});
