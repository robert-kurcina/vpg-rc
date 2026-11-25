/* Target: Leningrad §6.0, §11.0. Read-only historical counter inventory and
 * candidate allocation validator. This does not certify hex-number-to-runtime
 * mappings, assign counters automatically, or enable a production game.
 * Source: references/rules/leningrad-rules.pdf (printed pp.1,2,5) and
 * assets/official-counters/source-sheets/counters-leningrad-{front,back}.jpg.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameLeningradStartingInventory=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const sourceRearHexes=Object.freeze(['0107','0607','1305','1606','1701']);
 const groups=Object.freeze({
  germanInitialInfantry:['germanInfantry',7],
  germanInitialPanzer:['germanPanzer',2],
  germanTurn4Infantry:['germanReinforcementInfantry',2],
  sovietTurn3WorkersMilitia:['workersMilitia',1],
  sovietRearInfantryCorps:['sovietInfantryCorps',3],
  sovietRearMechanizedCorps:['sovietMechanized',2],
  sovietFrontInfantryCorps:['sovietInfantryCorps',1],
  sovietFrontMechanizedCorps:['sovietMechanized',2],
  sovietFrontArmies:['sovietInfantryArmies',2],
  sovietTurn4Army:['sovietInfantryArmies',1],
  sovietTurn5Army:['sovietInfantryArmies',1],
  sovietTurn6Army:['sovietInfantryArmies',1],
  sovietTurn7Armies:['sovietInfantryArmies',2],
  sovietTurn8Army:['sovietInfantryArmies',1]
 });
 const expected=Object.freeze({sovietInfantryCorps:4,sovietMechanized:4,sovietInfantryArmies:8,germanInfantry:9,germanPanzer:2,
  germanReinforcementInfantry:6,supportAir:2,workersMilitia:1,balticFleet:1,turnMarker:1,
  startingGroundUnits:19,startingSovietGroundUnits:10,startingGermanGroundUnits:9,
  totalRegularGroundCounters:27,totalGroundCountersIncludingMilitia:28,laterGroundReinforcements:9});
 const own=o=>Object.prototype.hasOwnProperty.call(groups,o);
 function inspect(config){
  if(!config||config.mapId!=='leningrad'||!Array.isArray(config.faces?.front)||!Array.isArray(config.faces?.back))throw Error('Leningrad counter-face configuration required');
  const errors=[],all=config.faces.front,backs=new Map(config.faces.back.map(f=>[f.faceId,f]));
  if(backs.size!==config.faces.back.length)errors.push('Duplicate reverse face ID');
  const pools={sovietInfantryCorps:[],sovietMechanized:[],sovietInfantryArmies:[],germanInfantry:[],germanPanzer:[],germanReinforcementInfantry:[],supportAir:[],workersMilitia:[],balticFleet:[],turnMarker:[]};
  const seen=new Set(),pairedBacks=new Set();
  for(const f of all){
   const t=f.visualTranscription||{}, b=backs.get(f.pairedFaceId),v=b?.visualTranscription||{};
   if(!f.faceId||seen.has(f.faceId))errors.push('Duplicate or empty face ID '+f.faceId);
   seen.add(f.faceId);
   if(!b)errors.push('Missing reverse face: '+f.faceId);
   if(pairedBacks.has(f.pairedFaceId))errors.push('Multiple faces share reverse side '+f.pairedFaceId);
   pairedBacks.add(f.pairedFaceId);
   const matches=(aff,kind,values)=>t.printedAffiliation===aff&&t.kind===kind&&t.printedValues===values;
   let pool=null;
   if(matches('soviet','infantry','3-4'))pool='sovietInfantryCorps';
   else if(matches('soviet','mechanized','?-6')){
    pool='sovietMechanized';
    if(v.kind!=='mechanized'||v.printedAffiliation!=='soviet'||!/^\d+·\d+·6$/.test(v.printedValues||''))
     errors.push('Untried mechanized reverse does not identify one mechanized corps: '+f.faceId);
   }else if(matches('soviet','infantry','8-4'))pool='sovietInfantryArmies';
   else if(t.printedAffiliation==='axis'&&t.kind==='infantry'&&['8-4','6-4'].includes(t.printedValues)){
    pool='germanInfantry';if(t.printedValues==='6-4')pools.germanReinforcementInfantry.push(f.faceId);
   }else if(t.printedAffiliation==='axis'&&t.kind==='tank'&&['12-6','10-6'].includes(t.printedValues))pool='germanPanzer';
   else if(t.printedAffiliation==='axis'&&t.kind==='air-support'&&['FK I','FK VIII'].includes(t.printedIdentifier))pool='supportAir';
   else if(t.printedAffiliation==='soviet'&&t.kind==='infantry'&&t.printedIdentifier==='WMM'&&t.printedValues==='2·5·3')pool='workersMilitia';
   else if(t.printedAffiliation==='soviet'&&t.kind==='naval-marker')pool='balticFleet';
   else if(t.kind==='game-turn')pool='turnMarker';
   if(pool)pools[pool].push(f.faceId);else errors.push('Unclassified printed face '+f.faceId);
  }
  if(all.length!==32||config.faces.back.length!==32)errors.push('Leningrad must have 32 front and 32 reverse faces');
  for(const b of backs.keys())if(!pairedBacks.has(b))errors.push('Unpaired reverse face '+b);
  for(const [name,n] of Object.entries(expected))if(name in pools&&pools[name].length!==n)errors.push('Wrong printed counter pool '+name+': '+pools[name].length+' != '+n);
  if(config.unitIdsVerified===true)errors.push('Unsupported promotion of printed faces to historical gameplay IDs');
  if(all.some(f=>f.unitId!==null)||config.faces.back.some(f=>f.unitId!==null))errors.push('Counter slots promoted to gameplay IDs without source proof');
  return Object.freeze({valid:errors.length===0,errors,pools:Object.freeze(Object.fromEntries(Object.entries(pools).map(([k,v])=>[k,Object.freeze([...v])]))),
   counts:Object.freeze(Object.fromEntries(Object.entries(pools).map(([k,v])=>[k,v.length]))),
   expected,sourceRearHexes,sourceRearHexNamespace:'printed-number-in-rules-pdf-not-runtime-cell-id',
   setupScope:'inventory-only-not-physical-placement',historicalSetupAuthorized:false});
 }
 function validateAllocation(config,allocation){
  const report=inspect(config),errors=[...report.errors];
  if(!allocation||typeof allocation!=='object'||Array.isArray(allocation))throw Error('Explicit historical counter allocation required');
  const poolSets=Object.fromEntries(Object.entries(report.pools).map(([k,v])=>[k,new Set(v)]));
  const seen=new Set();
  for(const key of Object.keys(allocation))if(!own(key))errors.push('Unknown allocation group '+key);
  for(const [name,[pool,count]] of Object.entries(groups)){
   const selected=allocation[name];
   if(!Array.isArray(selected)||selected.length!==count){errors.push('Invalid allocation count '+name);continue;}
   for(const face of selected){
    if(typeof face!=='string'||!poolSets[pool].has(face))errors.push('Invalid source face in '+name+': '+face);
    if(seen.has(face))errors.push('Counter allocated twice: '+face);
    seen.add(face);
   }
  }
  const allGround=[...report.pools.sovietInfantryCorps,...report.pools.sovietMechanized,...report.pools.sovietInfantryArmies,...report.pools.germanInfantry,...report.pools.germanPanzer,...report.pools.workersMilitia];
  for(const face of allGround)if(!seen.has(face))errors.push('Ground face unallocated: '+face);
  return Object.freeze({valid:errors.length===0,errors,allocationScope:'source-face-inventory-only',
   initialGermanGround:9,initialSovietGround:10,initialTotalGround:19,laterGroundReinforcements:9,totalGroundCounters:28,
   printedRearHexes:sourceRearHexes,historicalSetupAuthorized:false,positionsVerified:false,
   reinforcementCounterSelectionAuthorized:false});
 }
 return Object.freeze({inspect,validateAllocation,sourceRearHexes,groups,expected});
});
