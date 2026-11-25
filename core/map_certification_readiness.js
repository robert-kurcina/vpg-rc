/* Source-backed coverage ledger for candidate historical movement maps.
 * Reports absence of certification, NEVER promotes source marks to legal moves.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameMapCertificationReadiness=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const T=typeof require==='function'?require('./terrain_tiles'):globalThis.HexTerrainTiles;
 const V=typeof require==='function'?require('./hex_visual_features'):globalThis.WargameHexVisualFeatures;
 const E=typeof require==='function'?require('./terrain_evidence'):globalThis.WargameTerrainEvidence;
 const fail=m=>{throw Error('map-certification-readiness: '+m);};
 const pair=(a,b)=>[a,b].sort().join(':');
 function inspect(map,extracted){
  if(!map||!map.id||!Array.isArray(map.cells)||!map.geometry)fail('invalid-map');
  if(!extracted||extracted.map!==map.id.split('-')[0]||extracted.sourceMapSha256===undefined)fail('missing-or-mismatched-extraction');
  // SHA verification is performed by the command-line audit before this pure function.
  const v=V.normalize(map),terrain=E.inspect(map);
  const existing=new Map();for(const l of map.hexCenterRailConnections||[]){const k=pair(l.from,l.to);if(existing.has(k))fail('duplicate-rail-link');existing.set(k,l);}
  const derived=new Set(extracted.adjacencyPairs.map(p=>{if(!Array.isArray(p)||p.length!==2||!v.hexes[p[0]]||!v.hexes[p[1]])fail('invalid-derived-rail');return pair(...p);}));
  const ambiguous=new Map();for(const a of extracted.ambiguous||[]){if(!a.hexPair||a.hexPair.length!==2)fail('invalid-ambiguity');const k=pair(...a.hexPair);if(!ambiguous.has(k))ambiguous.set(k,[]);ambiguous.get(k).push({sourceSvgId:a.sourceSvgId,reason:a.reason});}
  const hexes={};for(const c of map.cells){const entries=[];for(const dir of T.DIRS){const s=v.hexes[c.id].sides[dir];entries.push({dir,neighbor:s.neighbor||null,edgeKey:s.edgeKey,visualKinds:[...new Set(s.features.map(f=>f.kind))].sort(),railStubCount:s.railStubs.length});}
   hexes[c.id]={terrain:c.terrain,terrainStatus:c.terrainStatus,terrainCertified:false,requiresTerrainReview:!(c.terrainStatus?.startsWith('user-svg-authored-')||c.terrainStatus==='source-svg-scan-reviewed-open-v412'||c.terrainStatus==='definitive-user-svg-terrain-v428'),sides:entries};}
  const edges=[];for(const e of Object.values(v.edges)){
   if(e.members.length!==2)continue;
   const [a,b]=e.key.split('~');if(!a||!b)fail('invalid-shared-edge');
   const k=pair(a,b), link=existing.get(k),isDerived=derived.has(k),flags=[];
   if(link&&!isDerived)flags.push('registered-rail-not-derived');
   if(isDerived&&!link)flags.push('derived-rail-not-registered');
   if(ambiguous.has(k))flags.push('ambiguous-source-crossing');
   const features=e.members.flatMap(m=>v.hexes[m.hexId].sides[m.dir].features.map(f=>({hexId:m.hexId,dir:m.dir,kind:f.kind,source:f.source})));
   const marks=features.filter(f=>f.kind!=='rail');
   if(marks.length&&new Set(marks.map(f=>f.kind)).size>1)flags.push('multiple-feature-kinds-review');
   edges.push({key:k,members:e.members,registeredRail:!!link,derivedRail:isDerived,railSourceSvgIds:link?.sourceSvgIds||[],ambiguousCrossings:ambiguous.get(k)||[],features,reviewFlags:flags,gameplayCertified:false});
  }
  const present=new Set(edges.map(e=>e.key));for(const k of new Set([...existing.keys(),...derived]))if(!present.has(k))fail('rail-link-not-geometric-neighbor:'+k);
  edges.sort((a,b)=>a.key.localeCompare(b.key));const flagged=edges.filter(e=>e.reviewFlags.length);
  return {schemaVersion:1,mapId:map.id,sourceGame:map.sourceGame,semantics:'certification-readiness-only',authorizedForMovement:false,
   coverage:{hexes:map.cells.length,authoredTerrainHexes:terrain.coverage.markedTerrainHexes,terrainReviewHexes:terrain.coverage.unresolvedTerrainHexes,sharedSides:edges.length,registeredRailLinks:existing.size,derivedRailLinks:derived.size,railMissingFromRegistration:edges.filter(e=>e.reviewFlags.includes('derived-rail-not-registered')).length,registeredRailNotDerived:edges.filter(e=>e.reviewFlags.includes('registered-rail-not-derived')).length,flaggedSharedSides:flagged.length},
   blockers:['grid-registration-not-independently-certified',
    ...(terrain.coverage.unresolvedTerrainHexes?['terrain-classification-incomplete']:[]),
    'hexside-and-rail-semantics-not-gameplay-certified'],
   hexes,sharedSides:edges};
 }
 return Object.freeze({inspect});
});
