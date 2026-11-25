/* Read-only audit of authored terrain and provisional map movement data.
 * Authored SVG terrain labels are evidence of markings, NOT authorization of
 * executable movement until entire geometry and hexside policy is certified.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameTerrainEvidence=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const AUTHORED=Object.freeze({forest:'user-svg-authored-forest',swamp:'user-svg-authored-swamp'});
 const REVIEWED_OPEN='source-svg-scan-reviewed-open-v412';
 const DEFINITIVE_TERRAIN='definitive-user-svg-terrain-v428';
 const USER_ADJUDICATED='user-adjudicated-terrain-v435';
 const fail=s=>{throw Error('terrain-evidence: '+s);};
 const sorted=x=>x.sort((a,b)=>a.localeCompare(b));
 function inspect(map){
  if(!map||!map.id||!Array.isArray(map.cells)||!map.geometry)fail('invalid-map');
  const ids=new Set(),marked=[],reviewedOpen=[],unresolved=[],unknown=[];
  for(const c of map.cells){
   if(!c||typeof c.id!=='string'||ids.has(c.id))fail('invalid-or-duplicate-hex');
   ids.add(c.id);
   if(AUTHORED[c.terrain]===c.terrainStatus){marked.push(c.id);continue;}
   if(c.terrainStatus===USER_ADJUDICATED){
    // Preserve original source layer as evidence while a separately recorded
    // user map decision supersedes the displayed/gameplay terrain.
    const e=c.sourceTerrainEvidence,a=c.userTerrainAdjudication;
    if(!e||!a||!a.directive||a.sourceTerrainUnchanged!==true||
       !['open','forest','swamp'].includes(a.previousTerrain)||
       !['open','forest','swamp'].includes(a.terrain)||
       e.layer!==a.previousTerrain||c.terrain!==a.terrain||
       e.sourceSvgSha256!==map.definitiveTerrainAudit?.sourceSvgSha256||
       !Array.isArray(e.sourceSvgIds)||!e.sourceSvgIds.length)
      fail('user-adjudicated-terrain-evidence-disagrees:'+c.id);
    marked.push(c.id);continue;
   }
   if(c.terrainStatus===DEFINITIVE_TERRAIN){
    const audit=map.definitiveTerrainAudit,e=c.sourceTerrainEvidence;
    if(!audit?.sourceSvgSha256||!e||e.layer!==c.terrain||
       !['open','forest','swamp'].includes(c.terrain)||!Array.isArray(e.sourceSvgIds)||
       e.sourceSvgIds.length===0||e.sourceSvgSha256!==audit.sourceSvgSha256||
       typeof e.maxRegistrationErrorPx!=='number'||e.maxRegistrationErrorPx>=6)
      fail('definitive-terrain-evidence-disagrees:'+c.id);
    marked.push(c.id);continue;
   }
   if(c.terrainStatus===REVIEWED_OPEN){
    if(c.terrain!=='open'||!map.v412TerrainEvidenceAudit?.sourceScanSHA256||
       map.v412TerrainEvidenceAudit.sourceScanSHA256!==map.sourceImageSHA256)
     fail('reviewed-open-evidence-disagrees:'+c.id);
    reviewedOpen.push(c.id);continue;
   }
   if(c.terrainStatus?.startsWith('user-svg-authored-'))fail('authored-status-disagrees:'+c.id);
   unresolved.push(c.id);
   if(!c.terrain||!c.terrainStatus)unknown.push(c.id);
  }
  const candidates=[],railStatuses={};
  for(const link of map.hexCenterRailConnections||[]){
   if(!link||!ids.has(link.from)||!ids.has(link.to))fail('rail-references-missing-hex');
   const key=[link.from,link.to].sort().join(':');
   candidates.push(key);
   const status=link.status||'unspecified';railStatuses[status]=(railStatuses[status]||0)+1;
  }
  if(new Set(candidates).size!==candidates.length)fail('duplicate-rail-candidate');
  const features={}, candidateHexsides=[];
  for(const c of map.cells)for(const [dir,entries] of Object.entries(c.tileEdges||{})){
   if(!Array.isArray(entries))fail('invalid-feature-list');
   for(const f of entries){const k=f.kind||'unspecified';features[k]=(features[k]||0)+1;
    candidateHexsides.push({cellId:c.id,direction:dir,kind:k,status:f.status||'unspecified'});
   }
  }
  const coverage={markedTerrainHexes:marked.length,reviewedOpenTerrainHexes:reviewedOpen.length,
   unresolvedTerrainHexes:unresolved.length,
   unknownTerrainHexes:unknown.length,railCandidateLinks:candidates.length,
   candidateHexsideFeatureMarks:candidateHexsides.length};
  return {mapId:map.id,sourceGame:map.sourceGame||null,sourceImageSHA256:map.sourceImageSHA256||null,
   geometryStatus:map.geometry.calibrationStatus||null,
   authorizedForMovement:false,coverage,
   verifiedAuthoredTerrainHexes:sorted(marked),reviewedOpenTerrainHexes:sorted(reviewedOpen),
   terrainReviewHexes:sorted(unresolved),
   unknownTerrainHexes:sorted(unknown),railReviewEdges:sorted(candidates),
   railCandidateStatuses:railStatuses,hexsideCandidateKinds:features,
   hexsideReviewMarks:candidateHexsides.sort((a,b)=>a.cellId.localeCompare(b.cellId)||a.direction.localeCompare(b.direction)),
   limitations:['Source-reviewed whole-cell base terrain does not certify hexside movement',
    'Geometry calibration is a visual candidate, not a certified movement lattice',
    'Rail center snaps and river/major-river features are not gameplay certified']};
 }
 return Object.freeze({inspect});
});
