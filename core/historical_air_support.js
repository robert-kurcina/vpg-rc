/* Optional source-bound, scenario-neutral air support and Fleet attack.
 * Air-sea attacks take place before German battle declarations; each air
 * marker is committed exactly once per turn to sea OR ground support.
 * No RNG is hidden: die is explicitly supplied after the commitment.
 */
(function(root,factory){
 const Ports=typeof module==='object'&&module.exports?require('./historical_port_support'):root.WargameHistoricalPortSupport;
 const Phases=typeof module==='object'&&module.exports?require('./phase_runtime'):root.WargamePhaseRuntime;
 const api=factory(Ports,Phases);if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameHistoricalAirSupport=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Ports,Phases){'use strict';
 const clone=v=>JSON.parse(JSON.stringify(v));
 const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const own=(v,k)=>Object.prototype.hasOwnProperty.call(v,k);
 function create({map,combatPolicy,counterConfig,phaseConfig,rosterOverlay=null}){
  const cfg=combatPolicy?.airSupport;
  if(!cfg||cfg.mode!=='photographed-shift-markers-v1'||!Array.isArray(cfg.markers)||cfg.markers.length<1||
     !obj(combatPolicy.printedAffiliationToOwner)||!phaseConfig||phaseConfig.scenarioId!==combatPolicy.scenarioId)
   throw Error('Source-configured historical air marker registration required');
  // Source configurations without a naval counter can opt out of the
  // otherwise legacy pre-battle Fleet attack window. This is gameplay
  // configuration, never a scenario-ID branch or inferred naval target.
  if(cfg.navalAttackMode!==undefined&&!['none','fleet-strike-v1'].includes(cfg.navalAttackMode))
   throw Error('Unrecognized historical naval air-attack mode');
  if(cfg.navalAttackMode==='none'&&combatPolicy.portSupport)
   throw Error('Ground-only air policy conflicts with source-configured Fleet');
  if(cfg.navalAttackMode==='fleet-strike-v1'&&!combatPolicy.portSupport)
   throw Error('Fleet strike requires source-configured Fleet');
  const faces=counterConfig?.faces;
  if(!Array.isArray(faces?.front)||!Array.isArray(faces?.back))throw Error('Source air counter faces required');
  const fronts=new Map(faces.front.map(x=>[x.faceId,x]));
  const backs=new Map(faces.back.map(x=>[x.faceId,x]));
  const markers=new Map();
  for(const m of cfg.markers){
   // Default photographed air markers refresh every turn. A source-faced
   // REFIT marker can opt into a turn-based cooldown; do not infer a cadence
   // from the scenario ID or apply it to ordinary Luftwaffe markers.
   const keys=Object.keys(m||{}).sort().join('|');
   const legacyKeys=['faceId','firstTurn','shiftRating'].sort().join('|');
   const refitKeys=['cooldownTurns','faceId','firstTurn','refitFaceId','shiftRating'].sort().join('|');
   const refit=keys===refitKeys;
   if(!obj(m)||(!refit&&keys!==legacyKeys)||
      typeof m.faceId!=='string'||markers.has(m.faceId)||!Number.isInteger(m.firstTurn)||m.firstTurn<1||m.firstTurn>phaseConfig.turns||
      !Number.isInteger(m.shiftRating)||m.shiftRating<1||m.shiftRating>6||
      (refit&&(!Number.isInteger(m.cooldownTurns)||m.cooldownTurns<1||m.cooldownTurns>=phaseConfig.turns||typeof m.refitFaceId!=='string')))
    throw Error('Invalid or duplicated historical air registration');
   const f=fronts.get(m.faceId),b=backs.get(f?.pairedFaceId),t=f?.visualTranscription,bt=b?.visualTranscription;
   const matchedFaces=!!b&&b.pairedFaceId===f.faceId;
   const ownerMatches=combatPolicy.printedAffiliationToOwner[t?.printedAffiliation]===cfg.owner;
   const legacyFace=matchedFaces&&t?.kind==='air-support'&&bt?.kind==='air-support'&&
      bt.printedIdentifier===t.printedIdentifier&&
      new RegExp('^'+m.shiftRating+'\\s*/\\s*arrow$').test(t.printedValues||'')&&bt.printedValues===t.printedValues;
   // Odessa's photographed Romanian face says "Rom I AK; aircraft silhouette;
   // 1; right arrow", while the reverse explicitly says "REFIT" rather
   // than repeating the shift. Require the exact matched print identity,
   // the rating and the refit reverse; an ordinary air marker cannot claim it.
   const printed=String(t?.visibleNotation||'').split(';').map(x=>x.trim()),
    reverse=String(bt?.visibleNotation||'').split(';').map(x=>x.trim());
   const refitFace=refit&&matchedFaces&&f.pairedFaceId===m.refitFaceId&&
      t?.kind==='air-marker'&&bt?.kind==='air-marker'&&
      printed.length===4&&printed[0]&&printed[1]==='aircraft silhouette'&&
      printed[2]===String(m.shiftRating)&&printed[3]==='right arrow'&&
      reverse.length===2&&reverse[0]===printed[0]&&reverse[1]==='REFIT';
   if(!ownerMatches||!(refit?refitFace:legacyFace))
    throw Error('Air Shift Rating or source face does not match photographed counter');
   markers.set(m.faceId,Object.freeze({...m,identifier:refit?printed[0]:t.printedIdentifier}));
  }
  if(!markers.size||!cfg.owner||!phaseConfig.players.includes(cfg.owner))throw Error('Historical air ownership missing');
  if(cfg.requireRosterFaceBinding!==undefined&&cfg.requireRosterFaceBinding!==true)
   throw Error('Invalid source air roster-binding policy');
  if(cfg.requireRosterFaceBinding){
   if(!obj(rosterOverlay)||!Array.isArray(rosterOverlay.units)||
      rosterOverlay.id!==combatPolicy.scenarioId+'-unit-overlay')
    throw Error('Source roster binding required for REFIT marker');
   for(const marker of markers.values())if(marker.refitFaceId){
    const record=rosterOverlay.units.filter(u=>u.art?.displayFaceId===marker.faceId);
    if(record.length!==1||record[0].art.alternateFaceId!==marker.refitFaceId||
       record[0].class!=='air-marker'||record[0].initial?.kind!=='reinforcement-track'||
       record[0].initial.turn!==marker.firstTurn||record[0].identityEvidence!=='explicit-pdf'||
       combatPolicy.printedAffiliationToOwner[record[0].side]!==cfg.owner)
     throw Error('Source roster arrival/REFIT binding mismatch');
   }
  }
  const ports=Ports.create({map,policy:combatPolicy,counterConfig});
  function gate({state,cursor,actor}){
   const p=Phases.current(phaseConfig,cursor);
   if(p?.kind!=='combat'||p.owner!==cfg.owner||actor!==cfg.owner||state?.scenarioId!==combatPolicy.scenarioId||!obj(state.units))
    throw Error('Air use requires owning Combat Phase and historical state');
   return cursor.turn;
  }
  function validateLedger(state){
   if(state.airUse===undefined)return;
   if(!obj(state.airUse))throw Error('Malformed air-use ledger');
   for(const [turn,entries] of Object.entries(state.airUse)){
    if(!/^[1-9][0-9]*$/.test(turn)||Number(turn)>phaseConfig.turns||!obj(entries))
     throw Error('Malformed air-use ledger');
    for(const [faceId,kind] of Object.entries(entries))
     if(!markers.has(faceId)||!['ground','fleet'].includes(kind)||Number(turn)<markers.get(faceId).firstTurn)
      throw Error('Malformed air-use ledger');
   }
   // A restored/edited history must not claim an impossible use on a REFIT
   // turn. This protects replay and save/restore even without a prior commit.
   for(const m of markers.values())if(m.cooldownTurns){
    let last=null;
    for(const t of Object.keys(state.airUse).map(Number).sort((a,b)=>a-b)){
     if(!own(state.airUse[String(t)],m.faceId))continue;
     if(last!==null&&t-last<=m.cooldownTurns)throw Error('Invalid historical air REFIT ledger');
     last=t;
    }
   }
  }
  function coolingDown(state,turn,m){
   if(!m.cooldownTurns)return false;
   for(let previous=Math.max(1,turn-m.cooldownTurns);previous<turn;previous++)
    if(own(state.airUse?.[String(previous)]||{},m.faceId))return true;
   return false;
  }
  function used({state,cursor,actor,faceId}){
   const turn=gate({state,cursor,actor}),m=markers.get(faceId);
   if(!m)throw Error('Unregistered source air marker');
   if(turn<m.firstTurn)throw Error('Air Corps has not arrived');
   validateLedger(state);
   if(own(state.airUse?.[String(turn)]||{},faceId))throw Error('Air marker already committed this turn');
   if(coolingDown(state,turn,m))throw Error('Air marker is on its REFIT turn');
   return {turn,marker:m};
  }
  function available({state,cursor,actor}){
   const turn=gate({state,cursor,actor});
   validateLedger(state);
   return Object.freeze([...markers.values()].filter(m=>m.firstTurn<=turn&&
    !own(state.airUse?.[String(turn)]||{},m.faceId)&&!coolingDown(state,turn,m))
    .map(m=>Object.freeze({...m})));
  }
  function reserve({state,cursor,actor,faceId,kind}){
   if(!['fleet','ground'].includes(kind))throw Error('Invalid air commitment');
   const {turn,marker}=used({state,cursor,actor,faceId});
   const next=clone(state);
   if(!next.airUse)next.airUse={};
   if(!next.airUse[String(turn)])next.airUse[String(turn)]={};
   next.airUse[String(turn)][faceId]=kind;
   return {state:next,marker,turn};
  }
  function ground({state,cursor,actor,faceId}){
   const result=reserve({state,cursor,actor,faceId,kind:'ground'});
   return Object.freeze({state:result.state,shiftRating:result.marker.shiftRating,
    event:Object.freeze({kind:'ground-air-commitment',faceId,turn:result.turn,shiftRating:result.marker.shiftRating})});
  }
  function attackFleet({state,cursor,actor,faceId,die}){
   if(cfg.navalAttackMode==='none')throw Error('Naval air attacks not available in this scenario');
   const marker=ports.validateMarker(state,true);
   if(!Number.isInteger(die)||die<1||die>6)throw Error('Fleet air attack requires injected six-sided die');
   const result=reserve({state,cursor,actor,faceId,kind:'fleet'});
   const hit=die<=result.marker.shiftRating;
   if(hit){
    const key=ports.markerKey;
    if(marker.condition==='damaged')delete result.state.supportMarkers[key];
    else result.state.supportMarkers[key].condition='damaged';
   }
   return Object.freeze({state:result.state,event:Object.freeze({kind:'air-sea-attack',faceId,
    identifier:result.marker.identifier,turn:result.turn,die,shiftRating:result.marker.shiftRating,
    hit,priorCondition:marker.condition,resultCondition:hit?(marker.condition==='damaged'?'eliminated':'damaged'):marker.condition})});
  }
  return Object.freeze({available,ground,attackFleet,markerFaces:Object.freeze([...markers.keys()])});
 }
 return Object.freeze({create});
});
