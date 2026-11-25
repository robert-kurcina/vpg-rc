/* Inventory conflicting source registries; never auto-promote map marks. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameLeningradDeploymentReconciliation=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 function inspect(map){
  if(map?.sourceGame!=='Target: Leningrad'||!Array.isArray(map.cells))throw Error('Leningrad map required');
  const a=map.authoredSvgImportAudit?.details?.deployment;
  if(!Array.isArray(a))throw Error('SVG deployment audit unavailable');
  const fromAudit=a.filter(x=>x.kind==='cross').map(x=>({hex:x.cellId,svgId:x.sourceId})).sort((x,y)=>x.hex.localeCompare(y.hex));
  const fromMarkers=map.cells.flatMap(c=>(c.tileMarkers||[]).filter(x=>x.kind==='cross').map(x=>({hex:c.id,svgId:x.sourceSvgId}))).sort((x,y)=>x.hex.localeCompare(y.hex));
  const audited=new Set(fromAudit.map(x=>x.hex)),marked=new Set(fromMarkers.map(x=>x.hex));
  const auditOnly=fromAudit.filter(x=>!marked.has(x.hex));
  const markerOnly=fromMarkers.filter(x=>!audited.has(x.hex));
  // SVG IDs are scoped to their source files; same hex with different IDs
  // is not an identity conflict. Only distinct hex sets are discrepant.
  const conflicts=[];
  // Five corrected placement markers do not certify historical counter identities,
  // terrain registration or the original SVG. Do not promote historical setup.
  return {ready:false,registrationCorrected:!!map.v327DeploymentRegistrationCorrection,
   ruleExpectedGermanCrosses:5,audit:fromAudit,tileMarkers:fromMarkers,auditOnly,markerOnly,sourceIdConflicts:conflicts,
   status:'board-scan-corrected-map-markers-original-svg-registries-disagree-historical-setup-gated'};
 }
 return Object.freeze({inspect});
});
