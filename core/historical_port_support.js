/* Shared, optional historical support-marker binding (two- or six-port rule). Only certified marker
 * faces and city-marker names from the supplied scenario map can activate a
 * retreat exemption. No marker is synthesized by the setup bridge.
 * Optional Fleet opening, voluntary relocation and §13.2 mandatory
 * displacement on verified enemy port entry. Opt-in air-sea resolution lives
 * in the generic historical_air_support module. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameHistoricalPortSupport=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
 const clone=x=>JSON.parse(JSON.stringify(x));
 const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 function create({map,policy,counterConfig}){
  const cfg=policy?.portSupport;
  if(!cfg)return Object.freeze({inspect:()=>Object.freeze({active:false,fleetShift:0,ignoreRetreatEligible:false}),
   forcedEntry:({after,choice})=>{if(choice!==undefined)throw Error('Fleet displacement is not configured');return Object.freeze({state:clone(after),event:null,required:false});}});
  if(cfg.mode!=='photographed-port-marker-v1'||!cfg.markerKey||!cfg.owner||
     !Array.isArray(cfg.portNames)||![2,6].includes(cfg.portNames.length)||new Set(cfg.portNames).size!==cfg.portNames.length||
     !cfg.sourceFaceId||!cfg.reverseFaceId||cfg.undamagedDefenseShift!==-1||cfg.undamagedAttackShift!==1||
     !cfg.portNames.includes(cfg.initialPortName)||!obj(cfg.damageOnDeparture)||
     Object.keys(cfg.damageOnDeparture).length!==cfg.portNames.length||
     cfg.portNames.some(n=>!Number.isInteger(cfg.damageOnDeparture[n])||cfg.damageOnDeparture[n]<1||cfg.damageOnDeparture[n]>6))
   throw Error('Source-certified port support configuration required');
  const f=counterConfig?.faces?.front?.find(x=>x.faceId===cfg.sourceFaceId),
   b=counterConfig?.faces?.back?.find(x=>x.faceId===cfg.reverseFaceId);
  if(!f||!b||f.pairedFaceId!==b.faceId||b.pairedFaceId!==f.faceId||
    f.visualTranscription?.kind!=='naval-marker'||b.visualTranscription?.kind!=='naval-marker'||
    f.visualTranscription?.printedAffiliation!==cfg.owner||
    !/damaged/i.test(b.visualTranscription?.printedValues||b.visualTranscription?.visibleNotation||''))
   throw Error('Fleet marker source counter faces unverified');
  const ports=new Map();
  for(const c of map.cells||[])for(const m of c.tileMarkers||[]){
   if(cfg.portNames.includes(m.label)&&['city','majorCity'].includes(m.kind)){
    if(ports.has(m.label))throw Error('Duplicate registered port city');
    ports.set(m.label,c.id);
   }
  }
  if(ports.size!==cfg.portNames.length)throw Error('Named source ports require registered city markers');
  // Optional source-geography pinning: the original port name must resolve to
  // its source-approved hostCell, not merely to a similarly named candidate.
  // Older source-qualified profiles remain valid without this field.
  if(cfg.portHexes!==undefined){
   if(!obj(cfg.portHexes)||Object.keys(cfg.portHexes).sort().join('|')!==cfg.portNames.slice().sort().join('|')||
      cfg.portNames.some(name=>cfg.portHexes[name]!==ports.get(name)))
    throw Error('Registered Fleet port does not match source-approved hostCell');
  }
  const eligibleHexes=new Set(ports.values());
  const namesByHex=new Map([...ports].map(([name,hex])=>[hex,name]));
  // Source rules for some Fleets distinguish a friendly-controlled receiving
  // port from one that merely lacks an enemy counter. This optional check
  // consumes the existing authoritative campaign cityControl ledger.
  if(cfg.destinationControlMode!==undefined&&cfg.destinationControlMode!=='city-control-v1')
   throw Error('Unsupported Fleet destination control policy');
  function controllingCities(state){
   if(cfg.destinationControlMode!=='city-control-v1')return null;
   if(!obj(state?.cityControl)||cfg.portNames.some(name=>
     !['german','soviet'].includes(state.cityControl[name])))
    throw Error('Source-controlled Fleet port requires complete cityControl ledger');
   return state.cityControl;
  }
  const markerTemplate=(hex,condition='undamaged')=>({hex,condition,owner:cfg.owner,
   sourceFaceId:cfg.sourceFaceId,reverseFaceId:cfg.reverseFaceId});
  function validateMarker(state,required=false){
   if(!obj(state)||!obj(state.units)||state.scenarioId!==policy.scenarioId)
    throw Error('Invalid scenario state for Fleet');
   if(state.supportMarkers!==undefined&&!obj(state.supportMarkers))throw Error('Invalid support marker registry');
   const marker=state.supportMarkers?.[cfg.markerKey];
   if(marker===undefined){if(required)throw Error('Fleet marker absent');return null;}
   if(!obj(marker)||Object.keys(marker).sort().join('|')!==
       ['condition','hex','owner','reverseFaceId','sourceFaceId'].sort().join('|')||
      marker.owner!==cfg.owner||marker.sourceFaceId!==cfg.sourceFaceId||
      marker.reverseFaceId!==cfg.reverseFaceId||!eligibleHexes.has(marker.hex)||
      !['undamaged','damaged'].includes(marker.condition))
    throw Error('Invalid or uncertified Fleet marker state');
   return marker;
  }
  function initialize({state}){
   if(!obj(state)||!obj(state.units)||state.scenarioId!==policy.scenarioId||
      state.supportMarkers!==undefined)throw Error('Opening Fleet requires uninitialized scenario state');
   const controls=controllingCities(state);
   if(controls&&controls[cfg.initialPortName]!==cfg.owner)
    throw Error('Fleet cannot initialize in enemy-controlled port');
   const initial=markerTemplate(ports.get(cfg.initialPortName));
   const next=clone(state);next.supportMarkers={[cfg.markerKey]:initial};
   validateMarker(next,true);
   return Object.freeze({state:next,marker:clone(initial)});
  }
  function validateDestination({state,to}){
   const marker=validateMarker(state,true);
   if(!eligibleHexes.has(to)||to===marker.hex)throw Error('Fleet must move to a different registered port');
   const controls=controllingCities(state);
   if(controls&&controls[namesByHex.get(to)]!==cfg.owner)
    throw Error('Fleet destination must be Soviet-controlled');
   if(Object.values(state.units).some(u=>u?.hex===marker.hex&&u.owner!==cfg.owner))
    throw Error('Enemy occupation at Fleet origin requires forced displacement, not voluntary movement');
   if(Object.values(state.units).some(u=>u?.hex===to&&u.owner!==cfg.owner))
    throw Error('Fleet cannot voluntarily move into an enemy-occupied port');
   return true;
  }
  function relocate({state,to,die}){
   validateDestination({state,to});
   const marker=validateMarker(state,true);
   if(!Number.isInteger(die)||die<1||die>6)throw Error('Fleet move requires a verified six-sided die');
   const originName=namesByHex.get(marker.hex),destinationName=namesByHex.get(to);
   const damageThreshold=cfg.damageOnDeparture[originName],hit=die<=damageThreshold;
   const eliminated=hit&&marker.condition==='damaged';
   const next=clone(state);
   if(eliminated)delete next.supportMarkers[cfg.markerKey];
   else next.supportMarkers[cfg.markerKey]=markerTemplate(to,hit?'damaged':marker.condition);
   const event={kind:'voluntary-fleet-move',markerKey:cfg.markerKey,from:marker.hex,to,
    fromPort:originName,toPort:destinationName,die,damageThreshold,hit,
    priorCondition:marker.condition,resultCondition:eliminated?'eliminated':next.supportMarkers[cfg.markerKey].condition};
   return Object.freeze({state:next,event:Object.freeze(event)});
  }
  // The ground move/advance must first pass its own source-bound legality
  // checks. We then atomically react to the actual transition of an enemy
  // counter into the Fleet's port; no fabricated entry or prior dice roll.
  function forcedDestinations({state}){
   const marker=validateMarker(state,true);
   const controls=controllingCities(state);
   return Object.freeze([...ports].filter(([name,hex])=>hex!==marker.hex&&
    (!controls||controls[name]===cfg.owner)&&
    !Object.values(state.units).some(u=>u?.hex===hex&&u.owner!==cfg.owner))
    .map(([name,hex])=>Object.freeze({name,hex})));
  }
  function forcedEntry({before,after,actor,enteredUnitId=null,choice}){
   const marker=validateMarker(before);
   // An absent or eliminated Fleet never requires a reaction.
   if(!marker){
    if(choice!==undefined)throw Error('Fleet displacement requested without an active Fleet');
    return Object.freeze({state:clone(after),event:null,required:false});
   }
   const afterMarker=validateMarker(after,true);
   if(JSON.stringify(afterMarker)!==JSON.stringify(marker))throw Error('Ground entry cannot independently alter Fleet state');
   const originUnit=before.units?.[enteredUnitId],newUnit=after.units?.[enteredUnitId];
   const entered=actor!==cfg.owner&&originUnit?.owner===actor&&newUnit?.owner===actor&&
    originUnit.hex!==marker.hex&&newUnit.hex===marker.hex;
   if(!entered){
    if(choice!==undefined)throw Error('Fleet displacement requires verified enemy entry');
    return Object.freeze({state:clone(after),event:null,required:false});
   }
   if(Object.values(before.units).some(u=>u?.hex===marker.hex&&u.owner!==cfg.owner))
    throw Error('Fleet origin was already enemy-occupied before entry');
   const options=forcedDestinations({state:after});
   const name=namesByHex.get(marker.hex),threshold=cfg.damageOnDeparture[name];
   const next=clone(after);
   // §13.2: if no other port can receive the Fleet, it is eliminated;
   // there is no destination and therefore no departure damage die.
   if(!options.length){
    if(choice!==undefined)throw Error('No safe Fleet port exists; automatic elimination is required');
    delete next.supportMarkers[cfg.markerKey];
    return Object.freeze({state:next,required:true,event:Object.freeze({kind:'forced-fleet-displacement',
     markerKey:cfg.markerKey,triggeredBy:enteredUnitId,from:marker.hex,fromPort:name,
     to:null,toPort:null,die:null,damageThreshold:null,hit:null,
     priorCondition:marker.condition,resultCondition:'eliminated',reason:'no-available-port'})});
   }
   if(!keys(choice,['to','die'])||!options.some(x=>x.hex===choice.to))
    throw Error('Forced Fleet displacement requires a different available port and die');
   if(!Number.isInteger(choice.die)||choice.die<1||choice.die>6)
    throw Error('Forced Fleet displacement requires a verified six-sided die');
   const dest=options.find(x=>x.hex===choice.to),hit=choice.die<=threshold;
   const eliminated=hit&&marker.condition==='damaged';
   if(eliminated)delete next.supportMarkers[cfg.markerKey];
   else next.supportMarkers[cfg.markerKey]=markerTemplate(dest.hex,hit?'damaged':marker.condition);
   return Object.freeze({state:next,required:true,event:Object.freeze({kind:'forced-fleet-displacement',
    markerKey:cfg.markerKey,triggeredBy:enteredUnitId,from:marker.hex,fromPort:name,
    to:dest.hex,toPort:dest.name,die:choice.die,damageThreshold:threshold,hit,
    priorCondition:marker.condition,resultCondition:eliminated?'eliminated':hit?'damaged':marker.condition,
    reason:'enemy-entered-fleet-port'})});
  }
  function keys(v,expected){return obj(v)&&JSON.stringify(Object.keys(v).sort())===JSON.stringify(expected.slice().sort());}
  function inspect({state,battle,actor}){
   if(!obj(state)||!obj(battle)||!Array.isArray(battle.defenders)||!Array.isArray(battle.attackers))
    throw Error('Bound combat and state required for port support');
   const marker=validateMarker(state);
   if(!marker)return Object.freeze({active:false,fleetShift:0,ignoreRetreatEligible:false});
   const defenders=battle.defenders.map(id=>state.units?.[id]);
   const attackers=battle.attackers.map(id=>state.units?.[id]);
   if([...defenders,...attackers].some(u=>!u||!u.owner||!u.hex))throw Error('Missing bound combat unit');
   const defendingAtPort=battle.defenderHex===marker.hex&&
    defenders.length>0&&defenders.every(u=>u.owner===cfg.owner&&u.hex===marker.hex);
   const attackingFromPort=actor===cfg.owner&&attackers.some(u=>u.hex===marker.hex);
   // Multiple attack origins have no independently certified Fleet-column
   // policy. Explicitly refuse the ambiguous mixed-origin case rather than
   // applying an invented shift.
   if(attackingFromPort&&attackers.some(u=>u.hex!==marker.hex))
    throw Error('Mixed-origin Fleet naval support is not source-certified');
   const fleetShift=marker.condition==='undamaged'?
    (defendingAtPort?cfg.undamagedDefenseShift:attackingFromPort?cfg.undamagedAttackShift:0):0;
   return Object.freeze({active:true,markerHex:marker.hex,condition:marker.condition,
    fleetShift,ignoreRetreatEligible:defendingAtPort&&actor!==cfg.owner,
    sourceFaceId:marker.sourceFaceId});
  }
  return Object.freeze({inspect,initialize,validateDestination,relocate,validateMarker,forcedDestinations,forcedEntry,
   markerKey:cfg.markerKey,portHexes:Object.freeze(Object.fromEntries(ports))});
 }
 return Object.freeze({create});
});
