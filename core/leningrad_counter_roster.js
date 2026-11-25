/* Read-only face-transcription roster analysis for Target: Leningrad §6.0.
 * A transcribed face is evidence of printed appearance, not a verified unit ID.
 * Never select an historical reinforcement pair from a strength match alone.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameLeningradCounterRoster=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const shape=/^([0-9]+)-([0-9]+)$/;
 function inspect(config){
  if(!config||!config.faces||!Array.isArray(config.faces.front)||!Array.isArray(config.faces.back))throw Error('Counter-face configuration required');
  const fronts=config.faces.front, backs=new Map(config.faces.back.map(f=>[f.faceId,f]));
  if(backs.size!==config.faces.back.length)throw Error('Duplicate back face ID');
  const errors=[],units=[],specialGroundMarkers=[];
  for(const f of fronts){
   const b=backs.get(f.pairedFaceId);
   if(!b){errors.push('Missing back face for '+f.faceId);continue;}
   const t=f.visualTranscription||{},bt=b.visualTranscription||{};
   // The Workers' Militia wears a tan counter but is a SOVIET special
   // reinforcement (§6.0(6), §11.0). Source color must not imply Axis control.
   if(t.printedIdentifier==='WMM'){
    if(t.printedAffiliation!=='soviet'||bt.printedAffiliation!=='soviet')errors.push('WMM must be Soviet on both printed faces');
    specialGroundMarkers.push(Object.freeze({faceId:f.faceId,printedIdentifier:t.printedIdentifier,printedValues:t.printedValues}));
    continue;
   }
   if(t.printedAffiliation!=='axis'||!['infantry','tank'].includes(t.kind))continue;
   const m=shape.exec(t.printedValues||'');
   if(!m){specialGroundMarkers.push(Object.freeze({faceId:f.faceId,printedIdentifier:t.printedIdentifier,printedValues:t.printedValues}));continue;}
   const reduced=shape.exec(bt.printedValues||'');
   const frontStrength=Number(m[1]),move=Number(m[2]);
   if(bt.printedAffiliation!=='axis'||bt.kind!==t.kind||bt.printedIdentifier!==t.printedIdentifier||!reduced||Number(reduced[1])!==Math.floor(frontStrength/2)||Number(reduced[2])!==move)
    errors.push('Front/back mismatch: '+f.faceId);
   units.push(Object.freeze({frontFaceId:f.faceId,backFaceId:b.faceId,printedIdentifier:t.printedIdentifier,kind:t.kind,frontStrength,move,sourceStatus:f.identityStatus||'unverified'}));
  }
  const infantry=units.filter(u=>u.kind==='infantry'),panzer=units.filter(u=>u.kind==='tank');
  const eligible=infantry.filter(u=>u.frontStrength===6&&u.move===4);
  const pairs=[];for(let i=0;i<eligible.length;i++)for(let j=i+1;j<eligible.length;j++)pairs.push(Object.freeze([eligible[i].frontFaceId,eligible[j].frontFaceId]));
  if(infantry.length!==9||panzer.length!==2)errors.push('German roster count does not match nine infantry and two panzer printed faces');
  if(pairs.length===0)errors.push('No two eligible German 6-4 reinforcement infantry counters');
  return Object.freeze({valid:errors.length===0,errors,source:'printed-face-transcription-only',germanGroundFaceCount:units.length,
   infantryFaceCount:infantry.length,panzerFaceCount:panzer.length,
   reinforcementCandidateFaceIds:Object.freeze(eligible.map(u=>u.frontFaceId)),
   possibleReinforcementPairs:Object.freeze(pairs),
   selectedReinforcementPair:null,historicalRosterAuthorized:false,
   specialGroundMarkers:Object.freeze(specialGroundMarkers),units:Object.freeze(units)});
 }
 return Object.freeze({inspect});
});
