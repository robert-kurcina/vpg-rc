/* Read-only source-authored railway trace audit for composed maps.
 * The annotated hexsides are incomplete; neither these links nor the paths
 * authorize experimental gameplay. Do not use this as an executable graph.
 */
(function(root,factory){
 const T=(typeof module==='object'&&module.exports)?require('./terrain_tiles'):root.HexTerrainTiles;
 const api=factory(T);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameCompositeSourceRailAudit=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(T){'use strict';
 const fail=(s)=>{throw Error('composite-source-rail-audit: '+s);};
 const key=(a,b)=>[a,b].sort().join(':');
 function trace(composite,{centerTolerancePx=3}={}){
  if(!composite?.cells?.length||!composite?.geometry||!Array.isArray(composite.sourceRailRoutes)||
   !composite.sourceRailRoutes.length||composite.hexCenterRailConnections?.length!==0)
   return fail('not-source-route-composite');
  if(centerTolerancePx!==3)return fail('unexpected-center-tolerance');
  const byId=new Map();for(const cell of composite.cells){
   if(!cell?.id||byId.has(cell.id)||!Array.isArray(cell.pixelCenter)||cell.pixelCenter.length!==2)
    return fail('invalid-or-duplicate-cell');
   byId.set(cell.id,cell);
  }
  const shore=new Set();for(const h of composite.authoredShoreHexsides||[]){
   if(!byId.has(h.cellId)||!T.DIRS.includes(h.dir))return fail('invalid-shore-side');
   shore.add(h.cellId+':'+h.dir);
  }
  function nearest(point){
   if(!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite))return fail('invalid-point');
   let closest=null,distance=Infinity;
   for(const cell of composite.cells){
    const d=Math.hypot(point[0]-cell.pixelCenter[0],point[1]-cell.pixelCenter[1]);
    if(d<distance){closest=cell;distance=d;}
   }
   return {cell:closest,distance};
  }
  const links=new Map(),sourceIds=new Set();let centeredPoints=0,terminalStubs=0,allPoints=0;
  for(const route of composite.sourceRailRoutes){
   const sourceSvgId=route?.sourceSvgId;
   if(typeof sourceSvgId!=='string'||!/^path\d+$/.test(sourceSvgId)||sourceIds.has(sourceSvgId)||
    !Array.isArray(route.points)||route.points.length<2)return fail('invalid-or-duplicate-route');
   sourceIds.add(sourceSvgId);
   let last=null;
   for(let i=0;i<route.points.length;i++){
    const point=route.points[i],match=nearest(point);allPoints++;
    if(match.distance>centerTolerancePx){
     // Source-authored routes end on perimeter stubs half a hex beyond the
     // nearest center. Interior off-center points must never be silently skipped.
     if((i!==0&&i!==route.points.length-1)||match.distance<20||match.distance>38)
      return fail('unclassified-off-center-point:'+sourceSvgId+':'+i);
     terminalStubs++;last=null;continue;
    }
    centeredPoints++;
    const cell=match.cell;
    if(last&&last.id!==cell.id){
     const dir=T.DIRS.find(d=>T.neighbor(last,d,composite.geometry)===cell.id);
     if(!dir)return fail('nonadjacent-route-link:'+sourceSvgId+':'+last.id+':'+cell.id);
     const sideShore=shore.has(last.id+':'+dir)||shore.has(cell.id+':'+T.OPP[dir]);
     if(last.terrain==='sea'||cell.terrain==='sea'||sideShore)
      return fail('rail-crosses-sea-or-coast:'+sourceSvgId+':'+last.id+':'+cell.id);
     const k=key(last.id,cell.id),entry=links.get(k)||{a:[last.id,cell.id].sort()[0],b:[last.id,cell.id].sort()[1],sourceSvgIds:[]};
     if(!entry.sourceSvgIds.includes(sourceSvgId))entry.sourceSvgIds.push(sourceSvgId);
     links.set(k,entry);
    }
    last=cell;
   }
  }
  // The existing tile-edge rail annotations are source-derived but incomplete;
  // compare against (not substitute for) the full drawn SVG path network.
  const annotated=new Set();
  for(const cell of composite.cells)for(const dir of T.DIRS){
   const a=cell.tileEdges?.[dir]||[];
   if(!a.some(f=>f.kind==='rail'))continue;
   const id=T.neighbor(cell,dir,composite.geometry),other=byId.get(id);
   if(!other)return fail('offboard-rail-annotation:'+cell.id+':'+dir);
   if(!(other.tileEdges?.[T.OPP[dir]]||[]).some(f=>f.kind==='rail'))
    return fail('nonreciprocal-rail-annotation:'+cell.id+':'+dir);
   annotated.add(key(cell.id,id));
  }
  const tracedLinks=[...links.values()].sort((a,b)=>a.a.localeCompare(b.a)||a.b.localeCompare(b.b));
  for(const entry of tracedLinks){
   const a=byId.get(entry.a),b=byId.get(entry.b);
   entry.sourceSvgIds.sort();entry.annotated=annotated.has(key(a.id,b.id));
   entry.x=(a.pixelCenter[0]+b.pixelCenter[0])/2;
   entry.y=(a.pixelCenter[1]+b.pixelCenter[1])/2;
  }
  const missingFromSource=[...annotated].filter(k=>!links.has(k)).sort().map(k=>{
   const [a,b]=k.split(':');const ca=byId.get(a),cb=byId.get(b);
   return {a,b,x:(ca.pixelCenter[0]+cb.pixelCenter[0])/2,y:(ca.pixelCenter[1]+cb.pixelCenter[1])/2,
    reason:'annotation-without-source-traced-centerline'};
  });
  return {metadata:{mapId:composite.id,hexes:byId.size,sourcePaths:sourceIds.size,
    routePoints:allPoints,centerMatchedPoints:centeredPoints,terminalStubs,
    tracedRailLinks:tracedLinks.length,annotatedRailLinks:annotated.size,
    corroboratedRailLinks:tracedLinks.filter(x=>x.annotated).length,
    tracedButNotAnnotated:tracedLinks.filter(x=>!x.annotated).length,
    annotatedWithoutTracedRoute:missingFromSource.length,
    seaOrCoastRailLinks:0,centerTolerancePx,
    gameplayCertified:false,graphPurpose:'source-svg-centerline-rail-review-only'},
   tracedLinks,annotationsWithoutTrace:missingFromSource};
 }
 return Object.freeze({trace});
});
