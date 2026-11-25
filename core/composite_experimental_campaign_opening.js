/* Source-checked Odessa candidate -> normal shared campaign opening.
 * Reuses the original Kiev face allocation, explicit Odessa placement choices,
 * the ordinary Phase runtime, photographed counter identities, and Fleet
 * support-marker registry. No second campaign/gameplay implementation.
 * The resulting session is EXPERIMENTAL; buildup and historical victory are
 * not yet bound and must not be claimed as a seven-turn playable game.
 */
'use strict';
const Phase=require('./phase_runtime');
const Fleet=require('./historical_port_support');
const Candidate=require('./composite_starting_state_candidate');
const fail=m=>{throw Error('odessa-experimental-opening: '+m)};
const clone=x=>JSON.parse(JSON.stringify(x));
function create({sources,allocation,basePlacements,extraPlacements,profile,phaseConfig,
 counterConfig,combatPolicy,housekeepingPolicy}={}){
 if(!sources||!profile||!phaseConfig||!counterConfig||!combatPolicy||!housekeepingPolicy||
    profile.id!=='kiev-odessa'||!profile.experimentalGraphScope||
    phaseConfig.scenarioId!=='kiev-odessa'||combatPolicy.scenarioId!=='kiev-odessa'||
    housekeepingPolicy.scenarioId!=='kiev-odessa'||
    combatPolicy.status!=='explicit-experimental-source-backed-no-full-campaign'||
    counterConfig.status!=='source-pinned-experimental-front-and-reverse-identities')fail('missing-source-bound-experimental-profile');
 const state=Candidate.create(sources).build({allocation,basePlacements,extraPlacements});
 if(state.onMapCount!==37||!state.romanianSetupSubsetVerified||!state.sourceFaceBindingsVerified||
    state.canRunHistoricalCampaign!==false)fail('source-starting-allocation-rejected');
 const fronts=new Map(counterConfig.faces.front.map(f=>[f.faceId,f]));
 const backs=new Map(counterConfig.faces.back.map(f=>[f.faceId,f]));
 const reverseOnly=new Map((combatPolicy.reverseOnlyPieces||[]).map(p=>[p.unitId,p]));
 const units={};let fleet=0;
 const derive=(display,face)=>{
  const values=face.visualTranscription?.printedValues||'',concealed=/^\?-(\d+)$/.exec(values);
  const two=/^(\d+)-(\d+)$/.exec(values),three=/^(\d+)-(\d+)-(\d+)$/.exec(values);
  if(!two&&!three&&!concealed)fail('unknown-source-strength:'+display);
  return {mp:+(concealed?concealed[1]:two?two[2]:three[3]),
   strengthStatus:concealed?'untried':'printed-full',printedCombatStrength:concealed?null:+(two?two[1]:three[1])};
 };
 for(const unit of Object.values(state.initialUnits)){
  if(unit.stackFree){
   if(unit.group!=='soviet-black-sea-fleet'||unit.sourceFaceId!=='odessa-front-r01c01'||unit.hex!=='1513')fail('unsupported-naval-unit');
   fleet++;continue;
  }
  const id=unit.sourceSheet==='kiev'?unit.sourceFaceId:unit.id;
  const special=reverseOnly.get(id);
  let sourceFaceId=unit.sourceFaceId,reverseFaceId=unit.reverseFaceId;
  if(special){
   if(unit.sourceFaceId!==special.reverseFaceId||reverseFaceId!==null||
      special.unitId!==id||special.owner!==(unit.side==='axis'?'german':'soviet'))
    fail('reverse-only-counter-disagrees:'+id);
   sourceFaceId=special.sourceFaceId;reverseFaceId=special.reverseFaceId;
  }
  const face=fronts.get(sourceFaceId),reverse=backs.get(reverseFaceId);
  if(!face||!reverse||face.pairedFaceId!==reverseFaceId||reverse.pairedFaceId!==sourceFaceId)
   fail('source-photo-pair-mismatch:'+id);
  const source=special?reverse:face, strength=derive(id,source);
  const owner=unit.side==='axis'?'german':unit.side;
  const klass=unit.kind==='coastal-infantry'||unit.kind==='mountain-infantry'?'infantry':unit.kind;
  if(!['german','soviet'].includes(owner)||!['infantry','mechanized','panzer','cavalry'].includes(klass))
   fail('unsupported-ground-source-kind:'+id);
  if(Object.hasOwn(units,id))fail('duplicate-game-unit-id:'+id);
  units[id]={id,hex:unit.hex,openingHex:unit.openingHex,owner,
   nationality:unit.nationality,class:klass,size:unit.size,
   mp:strength.mp,marker:false,sourceFaceId,reverseFaceId,historicalUnitId:null,
   strengthStatus:special?'printed-reduced':strength.strengthStatus,
   printedCombatStrength:strength.printedCombatStrength,
   ...(special?{activeFaceId:reverseFaceId}:{}),
   ...(unit.group==='romanian-home-army'?{sourceIdentityKey:'romanian-home-army'}:{})};
 }
 if(fleet!==1||Object.keys(units).length!==36||!state.frontlineSelected.length)
  fail('ground-and-fleet-separation-incomplete');
 const overrides=housekeepingPolicy.initialControlOverrides;
 const cityLedger=housekeepingPolicy.sourceCityHexes;
 if(!cityLedger||Object.keys(cityLedger).length!==20||overrides?.['Brăila']!=='german')
  fail('source-city-opening-missing');
 const cityControl=Object.fromEntries(Object.keys(cityLedger).map(city=>[city,overrides?.[city]||housekeepingPolicy.initialDefaultOwner]));
 if(Object.keys(cityControl).filter(city=>cityControl[city]==='german').length!==3)
  fail('incorrect-printed-start-city-control');
 const initial={scenarioId:'kiev-odessa',units,cityControl};
 const opened=Fleet.create({map:sources.combinedMap,policy:combatPolicy,counterConfig}).initialize({state:initial}).state;
 const cursor=Phase.start(phaseConfig),phase=Phase.current(phaseConfig,cursor);
 if(phase?.kind!=='combat'||phase.owner!=='german'||cursor.turn!==1)
  fail('unexpected-source-first-turn');
 const context={cursor,actor:'german',state:opened,map:sources.combinedMap,
  profile,config:phaseConfig,counterConfig,combatPolicy,rosterOverlay:sources.overlay,
  enableAirSupport:true};
 return Object.freeze({context:clone(context),audit:clone({status:'explicit-experimental-shared-engine-opening',
  historicalCertified:false,firstPhase:phase.id,groundUnits:36,navalMarkers:1,
  sourceStartingCounters:37,supportAirMarkers:state.airSupportTrack.length,
  initialAxisCities:3,sourceBlockers:state.sourceBlockers,
  nextIntegration:'Buildup+reinforcements+housekeeping; all post-opening phases not yet playable'})});
}
module.exports=Object.freeze({create});
