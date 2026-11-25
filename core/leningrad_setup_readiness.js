/* Source-backed setup readiness, not auto-placement. Do not substitute
 * candidate SVG deployment marks for authoritative accepted registrations.
 * Source: Target: Leningrad Rules §6.0 (five Soviet stars, five German crosses; five additional Soviet rear
 * positions (printed §6.0 hexes 0107, 0607, 1305, 1606, 1701);
 * German stack 9 units over 5 crosses).
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameLeningradSetupReadiness=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 function inspect(map,rosterConfig){
  if(map?.sourceGame!=='Target: Leningrad'||!Array.isArray(map.cells))throw Error('Unexpected Leningrad map');
  const registrations=map.authoredSvgImportAudit?.details?.deployment;
  const primary=Array.isArray(registrations)?{path:'authoredSvgImportAudit.details.deployment',records:registrations}:null;
  const stars=primary?.records.filter(x=>x.kind==='star')||[],crosses=primary?.records.filter(x=>x.kind==='cross')||[];
  const expected={sovietFrontlineStars:5,germanBlackCrosses:5,sovietRearFixed:5,
   sovietPrintedRearHexes:['0107','0607','1305','1606','1701'],sovietRearGroundUnits:5,
   sovietFrontlineGroundUnits:5,sovietStartingGroundUnits:10,germanStartingGroundUnits:9,
   sovietStartingInfantryCorps:4,sovietStartingMechanizedCorps:4,sovietStartingInfantryArmies:2,
   germanTurn4InfantryReinforcements:2};
  const gaps=[];
  // This bounded check does not bind printed unit strength, hidden identities,
  // reinforcement track or historical placement; never declare executable setup.
  gaps.push('Full historical unit placement and strengths not yet source-bound');
  gaps.push('Five rear Soviet setup positions from rules PDF have not been independently bound to runtime hexes');
  if(stars.length!==expected.sovietFrontlineStars)gaps.push('Soviet star source-mark count '+stars.length+' != 5');
  if(crosses.length!==expected.germanBlackCrosses)gaps.push('German cross source-mark count '+crosses.length+' != 5');
  if(new Set([...stars,...crosses].map(x=>x.cellId)).size!==stars.length+crosses.length)gaps.push('Duplicate starting hex');
  for(const m of [...stars,...crosses])if(!map.cells.some(c=>c.id===m.cellId))gaps.push('Missing map hex '+m.cellId);
  if(rosterConfig?.unitIdsVerified!==true)gaps.push('Printed historical counter identities not fully verified');
  return {ready:gaps.length===0,sourceRegister:primary?.path||null,expected,registered:{stars:stars.map(x=>({hex:x.cellId,svgId:x.sourceId})),crosses:crosses.map(x=>({hex:x.cellId,svgId:x.sourceId}))},gaps};
 }
 return Object.freeze({inspect});
});
