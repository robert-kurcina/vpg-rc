/* Read-only bridge from the source-reconciled Kiev–Odessa eastern-edge tracer
 * to source-pinned city victory and potential Soviet reinforcement entry.
 * This is NOT a historical movement or reinforcement authorization. It never
 * exports the boolean communicated callback required by live housekeeping.
 */
'use strict';
const Comms=require('./composite_eastern_communication_preflight');
const City=require('./composite_city_victory_candidate');
const fail=s=>{throw Error('composite-east-qualification: '+s);};
function create({map,board,cityLedger,root}){
 const tracer=Comms.createComposite({map,board});
 const cities=City.build(map,cityLedger,{root});
 if(cities.metadata.status!=='diagnostic-not-gameplay-authorized'||
    cities.metadata.cityCount!==20||
    tracer.metadata.certifiedForVictory!==false||
    tracer.metadata.certifiedForReinforcements!==false||
    tracer.metadata.exteriorCandidateHexes.length!==16)
  fail('uncertified-source-bridge-required');
 const names=cities.metadata.cities.map(c=>c.name),nameSet=new Set(names);
 const sourceByName=new Map(cities.metadata.cities.map(c=>[c.name,c]));
 function assess({cityControl,units={},turn=7}){
  if(!cityControl||typeof cityControl!=='object'||Array.isArray(cityControl)||
     Object.keys(cityControl).length!==20||
     Object.entries(cityControl).some(([name,owner])=>!nameSet.has(name)||!['german','soviet'].includes(owner))||
     !Number.isInteger(turn)||turn<1||turn>7)
   fail('invalid-candidate-game-state');
  // The same verified German occupied/ZOC ledger is used for both entry and
  // city communications. Unlike an already-on-map unit, a new reinforcement
  // cannot enter a threatened edge hex: candidateEntries enforces this.
  const entry=tracer.candidateEntries({units});
  const cityPaths={};
  for(const name of names){
   if(cityControl[name]!=='soviet')continue;
   const route=tracer.trace(sourceByName.get(name).hex,{units});
   if(route.certifiedForVictory!==false||route.status!=='candidate-only-not-gameplay-authorized')
    fail('candidate-path-promoted-to-authority');
   cityPaths[name]=Object.freeze({hex:sourceByName.get(name).hex,
    candidateConnected:route.reachable,exitHex:route.exitHex,
    path:Object.freeze([...route.path]),certifiedForVictory:false});
  }
  const hypothesis=cities.evaluate(cityControl,{isolationByCity:Object.fromEntries(
   Object.entries(cityPaths).map(([name,path])=>[name,!path.candidateConnected]))});
  return Object.freeze({status:'source-pinned-read-only-hypothesis-not-gameplay-authorized',
   turn,certifiedForReinforcements:false,certifiedForReplacements:false,
   certifiedForVictory:false,sourceEdgeMode:tracer.metadata.edgeSource,
   sourceSvgSha256:tracer.metadata.activeCompositeSvgSha256,
   sourceExteriorSideCount:entry.sourceExteriorSideCount,
   candidateEntryHexes:entry.candidateHexes,
   blockedCandidateEntryHexes:entry.blockedHexes,
   entrySides:entry.sides,cityPaths:Object.freeze(cityPaths),
   // Even an unconditional city-count result is NOT an actual game outcome
   // until historical setup, map movement and the turn-end state are certified.
   projectedTurnSeven:turn===7?Object.freeze({
    hypotheticalOnly:true,outcome:hypothesis.outcome,reason:hypothesis.reason,
    germanCities:hypothesis.germanCities,
    remainingSovietCities:hypothesis.remainingSovietCities}):null});
 }
 return Object.freeze({metadata:Object.freeze({status:'candidate-only',
  certifiedForVictory:false,certifiedForReinforcements:false,
  sourceSvgSha256:tracer.metadata.activeCompositeSvgSha256,
  candidateSourceExteriorHexes:tracer.metadata.exteriorCandidateHexes}),assess});
}
module.exports=Object.freeze({create});
