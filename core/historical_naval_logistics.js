/* Source-bound optional Black Sea port logistics (§§12.2, 15.3).
 * Does not choose a turn phase or authorize the incomplete Odessa campaign.
 * All game logic is generic: port names and Fleet faces come from policy.
 */
'use strict';
const Ports=require('./historical_port_support');
const copy=v=>JSON.parse(JSON.stringify(v));
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>obj(v)&&Object.keys(v).sort().join('|')===keys.slice().sort().join('|');
const num=/^(\d+)-(\d+)$/;
function create({map,combatPolicy,counterConfig,sourcePolicy}){
 const p=sourcePolicy, c=combatPolicy?.portSupport;
 if(!p||p.mode!=='source-fleet-port-logistics-v1'||!c||
    p.scenarioId!==combatPolicy.scenarioId)
   throw Error('Source-bound naval logistics policy required');
 if(p.owner!==c.owner||p.markerKey!==c.markerKey||p.owner!=='soviet'||
    p.replacementException!==true||p.damageDie!==1||
    p.evacuatedEarliestReturnTurnOffset!==1||!Number.isInteger(p.turns)||p.turns<2||
    !exact(p.portHexes,c.portNames)||c.portNames.some(name=>p.portHexes[name]!==c.portHexes?.[name]))
   throw Error('Naval logistics policy disagrees with source Fleet ports or damage rule');
 const fleet=Ports.create({map,policy:combatPolicy,counterConfig});
 const portByHex=Object.fromEntries(Object.entries(fleet.portHexes).map(([name,hex])=>[hex,name]));
 const fronts=new Map(counterConfig?.faces?.front?.map(f=>[f.faceId,f])||[]);
 const backs=new Map(counterConfig?.faces?.back?.map(f=>[f.faceId,f])||[]);
 function check(state){
  if(!obj(state)||state.scenarioId!==p.scenarioId||!obj(state.units)||!obj(state.cityControl)||
     c.portNames.some(name=>!['soviet','german'].includes(state.cityControl[name])))
   throw Error('Source-verified Soviet port control ledger required');
  if(state.evacuatedNavalUnits!==undefined&&!obj(state.evacuatedNavalUnits))
   throw Error('Invalid evacuated naval ground-unit ledger');
  return fleet.validateMarker(state);
 }
 function controlled(state,hex){return portByHex[hex]&&state.cityControl[portByHex[hex]]==='soviet';}
 function replacementException({state,unitId,actor}){
  const marker=check(state),unit=state.units[unitId];
  if(actor!=='soviet'||!unit||unit.owner!=='soviet'||unit.strengthStatus!=='printed-reduced')return false;
  return Boolean(marker&&marker.hex===unit.hex&&controlled(state,unit.hex)&&
   !Object.values(state.units).some(other=>other?.hex===marker.hex&&other.owner!=='soviet')); 
 }
 function paired(unit){
  const f=fronts.get(unit.sourceFaceId),b=backs.get(unit.reverseFaceId);
  if(!f||!b||f.pairedFaceId!==b.faceId||b.pairedFaceId!==f.faceId||
    f.visualTranscription?.printedAffiliation!=='soviet'||b.visualTranscription?.printedAffiliation!=='soviet')
   throw Error('Source-paired Soviet ground counter required for naval transport');
  if(unit.strengthStatus==='printed-reduced'&&unit.activeFaceId!==b.faceId)
   throw Error('Reduced ground unit lacks its photographed reverse');
  if(unit.strengthStatus==='printed-full'&&unit.activeFaceId!==undefined)
   throw Error('Full-strength ground unit has inconsistent active face');
  return {f,b};
 }
 function navalDamage(unit){
  const {f,b}=paired(unit);
  if(unit.strengthStatus==='printed-reduced'||unit.strengthStatus==='untried'||
     unit.strengthStatus==='revealed-one-step')return null;
  if(unit.strengthStatus!=='printed-full')throw Error('Unverified Soviet unit strength state for naval damage');
  const full=num.exec(f.visualTranscription?.printedValues||'');
  const back=num.exec(b.visualTranscription?.printedValues||'');
  if(!full||!back||Number(back[1])>=Number(full[1]))return null; // one-step or no valid reduction
  return {...unit,strengthStatus:'printed-reduced',activeFaceId:b.faceId,printedCombatStrength:+back[1]};
 }
 function transport({state,actor,unitId,destination,die,turn,canOccupyPort=null}){
  const marker=check(state);
  if(actor!=='soviet'||!Number.isInteger(turn)||turn<1||turn>p.turns||!Number.isInteger(die)||die<1||die>6)
   throw Error('Soviet naval transport requires a current turn and d6 damage roll');
  const unit=state.units[unitId];
  if(!marker||!unit||unit.id!==unitId||unit.owner!=='soviet'||unit.marker===true||unit.hex!==marker.hex||
     !controlled(state,unit.hex))throw Error('Ground unit must share a Soviet-controlled port with the Fleet');
  paired(unit);
  if(Object.values(state.units).some(other=>other?.hex===marker.hex&&other.owner!=='soviet'))
   throw Error('Enemy occupies the Fleet transport origin');
  if(!obj(destination)||!['port','off-map'].includes(destination.kind)||
    (destination.kind==='off-map'&&Object.keys(destination).length!==1)||
    (destination.kind==='port'&&(!exact(destination,['kind','hex'])||
     !controlled(state,destination.hex)||destination.hex===unit.hex)))
   throw Error('Transport requires another friendly-controlled port or off-map evacuation');
  // Destination legality is independent of the subsequent damage result.
  // A destroyed transport cannot retroactively legalize an illegal destination.
  if(destination.kind==='port'){
   if(Object.values(state.units).some(other=>other.id!==unitId&&other.hex===destination.hex&&other.owner!=='soviet'))
    throw Error('Enemy occupies destination port');
   if(typeof canOccupyPort!=='function'||canOccupyPort({state:copy(state),unit:copy(unit),hex:destination.hex})!==true)
    throw Error('Missing source port-stacking qualification');
  }
  const next=copy(state),hit=die===p.damageDie;
  let adjusted=copy(unit),destroyed=false;
  if(hit){const reduced=navalDamage(unit);if(!reduced)destroyed=true;else adjusted=reduced;}
  if(destroyed)delete next.units[unitId];
  else if(destination.kind==='port'){
   next.units[unitId]={...adjusted,hex:destination.hex};
  }else{
   if(!obj(next.evacuatedNavalUnits))next.evacuatedNavalUnits={};
   if(next.evacuatedNavalUnits[unitId])throw Error('Duplicate naval evacuation');
   if(!destroyed){next.evacuatedNavalUnits[unitId]={unit:adjusted,evacuatedTurn:turn,firstReturnTurn:turn+p.evacuatedEarliestReturnTurnOffset};}
   delete next.units[unitId];
  }
  return {state:next,event:{kind:destination.kind==='port'?'naval-ground-transport':'naval-ground-evacuation',
   unitId,from:unit.hex,to:destination.kind==='port'?destination.hex:null,die,hit,
   result:destroyed?'eliminated':adjusted.strengthStatus,firstReturnTurn:destination.kind==='off-map'&&!destroyed?turn+1:null}};
 }
 function returnEligibility({state,actor,unitId,turn}){
  check(state);
  if(actor!=='soviet'||!Number.isInteger(turn)||turn<1||turn>p.turns)return false;
  const record=state.evacuatedNavalUnits?.[unitId];
  if(!record)return false;
  if(!exact(record,['unit','evacuatedTurn','firstReturnTurn'])||
     !Number.isInteger(record.evacuatedTurn)||record.firstReturnTurn!==record.evacuatedTurn+1||
     !record.unit||record.unit.id!==unitId||record.unit.owner!=='soviet'||state.units[unitId])
   throw Error('Unverified naval evacuation reserve state');
  paired(record.unit);
  return turn>=record.firstReturnTurn;
 }
 // Admit an evacuated survivor ONLY through a trusted caller's ordinary
 // reinforcement predicate. The caller owns the certified source entry hexes,
 // enemy ZOC, stacking and phase authorization. No port or Fleet shortcut.
 function returnAsReinforcement({state,actor,unitId,hex,turn,validateRegularEntry}){
  if(!returnEligibility({state,actor,unitId,turn}))
   throw Error('Evacuated Soviet unit not eligible for this reinforcement turn');
  if(typeof hex!=='string'||typeof validateRegularEntry!=='function')
   throw Error('Regular reinforcement entry authority required');
  const record=state.evacuatedNavalUnits[unitId];
  const recovered=copy(record.unit);
  if(!Object.values(fleet.portHexes).includes(recovered.hex))
   throw Error('Evacuated ground-unit port provenance missing');
  const approved=validateRegularEntry({state,actor,unit:copy(recovered),hex});
  if(approved!==true)throw Error('Regular reinforcement edge, EZOC or stacking denied');
  const next=copy(state);
  next.units[unitId]={...recovered,hex};
  delete next.evacuatedNavalUnits[unitId];
  return {state:next,event:{kind:'naval-evacuee-reinforced',unitId,hex,evacuatedTurn:record.evacuatedTurn,
   firstReturnTurn:record.firstReturnTurn,turn,sourceFaceId:recovered.sourceFaceId,
   strengthStatus:recovered.strengthStatus}};
 }
 // The admitting buildup module must supply the same edge, EZOC and national
 // stacking predicate as ordinary reinforcements. Merely being eligible for
 // return never creates an automatic or port-based placement right.
 return Object.freeze({replacementException,transport,returnEligibility,returnAsReinforcement,portHexes:fleet.portHexes});
}
module.exports=Object.freeze({create});
