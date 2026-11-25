/* Scenario-agnostic source-constrained pre-game editor for an auditable historical
 * opening. This edits setup positions and configured concealed physical identity assignment, never rules,
 * combat state, source-face pairing, reinforcement schedules, map geometry or the campaign runtime.
 * Shared across scenarios by configuration; not a second game controller.
 */
(function(root,factory){
 const Terrain=typeof module==='object'&&module.exports?require('./terrain_tiles'):root.HexTerrainTiles;
 const Hash=typeof module==='object'&&module.exports?require('./sync_sha256'):root.WargameSyncSha256;
 const api=factory(Terrain,Hash);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameHistoricalSourceSetupEditor=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Terrain,Hash){
'use strict';
const fail=s=>{throw Error('historical-source-setup: '+s)};
const clone=x=>JSON.parse(JSON.stringify(x));
const FORMAT='historical-source-setup-candidate-v1';
function fingerprint(opening){return Hash.sha256(JSON.stringify(opening))}
function create({opening,map,policy,placements,identityAssignments,concealedMixed=false,
 counterConfig=null,buildupAllocation=null,infantryReserveSlot=null}={}){
 if(!Terrain||!Hash||!opening?.state?.units||!Array.isArray(map?.cells)||
    !policy?.groups||!policy?.scenarioId||opening.state.scenarioId!==policy.scenarioId||
    policy.openingSHA256!==fingerprint(opening))fail('source-profile-or-opening-fingerprint-mismatch');
 const byId=new Map(map.cells.map(c=>[c.id,c]));
 const baseline=opening.state.units, groups=policy.groups;
 const memberToGroup={};
 for(const [name,g] of Object.entries(groups)){
  if(!Array.isArray(g.ids)||!Array.isArray(g.allowed)||!g.ids.length||!g.allowed.length)fail('invalid-setup-group:'+name);
  for(const id of g.ids){if(!baseline[id]||memberToGroup[id])fail('missing-or-duplicate-source-unit:'+id);memberToGroup[id]=name}
  for(const hex of g.allowed)if(!byId.has(hex)||byId.get(hex).terrain==='sea')fail('invalid-source-slot:'+hex);
 }
 if(!Number.isInteger(policy.groundUnitCount)||policy.groundUnitCount<1||
    Object.keys(memberToGroup).length!==policy.groundUnitCount||
    Object.keys(baseline).length!==policy.groundUnitCount||Object.keys(baseline).some(k=>!memberToGroup[k]))fail('source-roster-mismatch');
 const mix=policy.concealedMix||null;
 const concealedSlots=mix?(mix.groups||[]).flatMap(name=>groups[name]?.ids||[]):[];
 if(mix&&(!Array.isArray(mix.groups)||mix.groups.some(name=>!groups[name])||
    !Number.isInteger(mix.count)||mix.count!==concealedSlots.length||
    new Set(concealedSlots).size!==mix.count||
    concealedSlots.some(id=>baseline[id].owner!==mix.owner||baseline[id].class!==mix.class||
      baseline[id].size!==mix.size||baseline[id].strengthStatus!=='untried')))
  fail('invalid-concealed-source-group');
 const faceMap=identityAssignments===undefined?
  Object.fromEntries(concealedSlots.map(id=>[id,id])):clone(identityAssignments);
 if(typeof concealedMixed!=='boolean'||!faceMap||Array.isArray(faceMap)||
    Object.keys(faceMap).length!==concealedSlots.length||
    Object.keys(faceMap).some(id=>!concealedSlots.includes(id))||
    new Set(Object.values(faceMap)).size!==concealedSlots.length||
    Object.values(faceMap).some(id=>!concealedSlots.includes(id))||
    (!concealedMixed&&concealedSlots.some(id=>faceMap[id]!==id)))
  fail('invalid-concealed-source-permutation');
 // Optional source-verified non-concealed face-pool selection. Only the single
 // scheduled 6-4 infantry reserve may trade with a compatible initially placed
 // 6-4 infantry face. The face registry and reinforcement allocation are the
 // authoritative inputs; no guessed combat strengths or reverse pairings.
 const selection=policy.infantryFaceSelection||null;
 if(selection&&Boolean(counterConfig)!==Boolean(buildupAllocation))
  fail('incomplete-verified-face-selection-source');
 const facePoolEnabled=!!(selection&&counterConfig&&buildupAllocation);
 let facePool=null;
 if(facePoolEnabled){
  const front=new Map((counterConfig.faces?.front||[]).map(f=>[f.faceId,f]));
  const back=new Map((counterConfig.faces?.back||[]).map(f=>[f.faceId,f]));
  if(!Array.isArray(selection.deployedGroups)||!selection.deployedGroups.length||
     typeof selection.reserveGroup!=='string'||!selection.reserveGroup||
     !Number.isInteger(selection.deployedCount)||selection.deployedCount<1||
     !Array.isArray(selection.allowedPrintedKinds)||!selection.allowedPrintedKinds.length||
     !Array.isArray(selection.allowedDeployedPrintedValues)||
     !selection.allowedDeployedPrintedValues.includes(selection.reservePrintedStrength)||
     typeof selection.printedAffiliation!=='string'||typeof selection.gameClass!=='string'||
     typeof selection.gameSize!=='string'||typeof selection.reserveOwner!=='string')
   fail('invalid-face-selection-policy');
  const deployed=selection.deployedGroups.flatMap(g=>groups[g]?.ids||[]);
  const reserve=buildupAllocation[selection.reserveGroup];
  if(!Array.isArray(reserve)||reserve.length!==1||
    selection.deployedGroups.some(g=>!groups[g]||
      JSON.stringify([...groups[g].ids].sort())!==JSON.stringify([...(buildupAllocation[g]||[])].sort()))||
    new Set(deployed).size!==deployed.length||deployed.length!==selection.deployedCount||
    reserve[0] in baseline||deployed.includes(reserve[0])||
    (counterConfig.faces?.front||[]).length!==front.size||
    (counterConfig.faces?.back||[]).length!==back.size)
   fail('invalid-verified-infantry-face-allocation');
  for(const id of [...deployed,...reserve]){
   const f=front.get(id),b=back.get(f?.pairedFaceId),t=f?.visualTranscription;
   if(!f||!b||b.faceId!==f.pairedFaceId||b.pairedFaceId!==id||
     f.printedPairValidation!=='printed-pair-agrees'||
     b.visualTranscription?.kind!==t?.kind||
     b.visualTranscription?.printedIdentifier!==t?.printedIdentifier||
     b.visualTranscription?.printedAffiliation!==t?.printedAffiliation||
     !selection.allowedPrintedKinds.includes(t?.kind)||t?.printedAffiliation!==selection.printedAffiliation||
     !selection.allowedDeployedPrintedValues.includes(t?.printedValues)||
     (id===reserve[0]&&t.printedValues!==selection.reservePrintedStrength)||
     (id!==reserve[0]&&(baseline[id]?.owner!==selection.reserveOwner||
       baseline[id].class!==selection.gameClass||baseline[id].size!==selection.gameSize||
       baseline[id].sourceFaceId!==id||baseline[id].reverseFaceId!==b.faceId||
       baseline[id].printedCombatStrength!==Number(t.printedValues.split('-')[0]))))
    fail('unverified-infantry-source-face:'+id);
  }
  facePool={front,back,deployed,reserveId:reserve[0],eligible:deployed.filter(id=>
    front.get(id).visualTranscription.printedValues===selection.reservePrintedStrength)};
 }
 if(infantryReserveSlot!==null&&(!facePool||!facePool.eligible.includes(infantryReserveSlot)))
  fail('invalid-infantry-reserve-selection');
 const initial=Object.fromEntries(Object.entries(baseline).map(([k,v])=>[k,v.hex]));
 const next=placements===undefined?initial:clone(placements);
 function validate(pos){
  if(!pos||Object.keys(pos).length!==policy.groundUnitCount||Object.keys(pos).some(k=>!memberToGroup[k]))fail('placement-roster-mismatch');
  const byHex=new Map();
  for(const [id,hex] of Object.entries(pos)){
   const g=groups[memberToGroup[id]];
   if(typeof hex!=='string'||!g.allowed.includes(hex))fail('unapproved-source-destination:'+id+':'+hex);
   if(!byHex.has(hex))byHex.set(hex,[]);byHex.get(hex).push(id);
  }
  for(const [hex,ids] of byHex){
   const units=ids.map(id=>baseline[id]);
   if(ids.length>2||new Set(units.map(u=>u.owner)).size!==1||units.filter(u=>u.size==='army').length>1)
    fail('illegal-national-stacking:'+hex);

  }
  const requireFilled=(name)=>{
   const g=groups[name];if(!g)return;
   for(const hex of g.required||[])if(!byHex.get(hex)?.some(id=>memberToGroup[id]===name))
    fail('mandatory-source-slot-unfilled:'+name+':'+hex);
  };
  Object.keys(groups).forEach(requireFilled);
  // Source-specific allocation rules are data, not scenario-ID-specific
  // executable code. Every constraint below applies to any supplied profile.
  for(const check of policy.distinctGroups||[]){
   const ids=(check.groups||[]).flatMap(name=>groups[name]?.ids||[]);
   if(ids.length!==check.count||new Set(ids.map(id=>pos[id])).size!==check.uniquePositions)
    fail('source-distinct-positions:'+check.name);
  }
  for(const check of policy.exclusiveRegions||[]){
   const allowed=new Set(check.groups||[]);
   for(const hex of check.hexes||[]){
    const ids=byHex.get(hex)||[];
    if(ids.length>check.maxUnits||ids.some(id=>!allowed.has(memberToGroup[id])))
     fail('source-exclusive-region:'+check.name+':'+hex);
   }
  }
  for(const check of policy.noAdjacent||[]){
   const ids=Object.keys(pos).filter(id=>baseline[id].owner===check.owner&&baseline[id].size===check.size);
   for(const id of ids){
    const cell=byId.get(pos[id]);
    for(const dir of Terrain.DIRS){const near=Terrain.neighbor(cell,dir,map.geometry);
     if(ids.some(other=>other!==id&&pos[other]===near))fail('adjacent-source-units:'+check.name+':'+pos[id]+':'+near);
    }
   }
  }
  for(const marker of policy.fixedSupportMarkers||[]){
   const sourceMarker=opening.state.supportMarkers?.[marker.key];
   if(!sourceMarker||sourceMarker.hex!==marker.hex||sourceMarker.sourceFaceId!==marker.sourceFaceId)
    fail('source-fixed-support-marker:'+marker.key);
  }

  return true;
 }
 validate(next);
 function fork(p,infantrySlot=infantryReserveSlot){return create({opening,map,policy,placements:p,
  identityAssignments:faceMap,concealedMixed,counterConfig,buildupAllocation,infantryReserveSlot:infantrySlot})}
 function move(id,hex){
  if(!memberToGroup[id])fail('unknown-source-counter:'+id);
  const p={...next,[id]:hex};validate(p);return fork(p);
 }
 function swapPositions(a,b){
  if(!memberToGroup[a]||!memberToGroup[b]||a===b)fail('invalid-swap-pair');
  const p={...next,[a]:next[b],[b]:next[a]};validate(p);return fork(p);
 }
 function choices(id){
  if(!memberToGroup[id])return [];
  return groups[memberToGroup[id]].allowed.filter(hex=>{
   try{validate({...next,[id]:hex});return true}catch{return false}
  });
 }
 function selectInfantryReserve(slot){
  if(!facePool)fail('no-verified-infantry-face-pool');
  if(slot!==null&&!facePool.eligible.includes(slot))fail('invalid-infantry-reserve-selection');
  return fork(next,slot);
 }
 function selectedAllocation(){
  if(!facePool)return buildupAllocation?clone(buildupAllocation):null;
  const nextAlloc=clone(buildupAllocation);
  if(infantryReserveSlot!==null){
   const g=memberToGroup[infantryReserveSlot],index=nextAlloc[g].indexOf(infantryReserveSlot);
   if(index<0)fail('source-infantry-group-slot-missing');
   nextAlloc[g][index]=facePool.reserveId;
   nextAlloc[selection.reserveGroup]=[infantryReserveSlot];
  }
  return nextAlloc;
 }
 function selectedPhysical(slot){
  const face=facePool.front.get(facePool.reserveId),original=baseline[slot];
  return {...clone(original),id:face.faceId,sourceFaceId:face.faceId,
   reverseFaceId:face.pairedFaceId,printedCombatStrength:Number(face.visualTranscription.printedValues.split('-')[0]),
   hex:next[slot],openingHex:next[slot]};
 }
 function commit(){
  validate(next);
  const context=clone(opening),units=context.state.units;
  // A concealed slot is a deployment position, NOT the physical counter ID.
  // Re-key only at commitment, preserving the complete actual face lineage.
  for(const [slot,faceId] of Object.entries(faceMap)){
   const actual=clone(baseline[faceId]);actual.hex=next[slot];actual.openingHex=next[slot];
   units[slot]=actual;
  }
  if(concealedSlots.length){
   const physical=Object.fromEntries(concealedSlots.map(slot=>[faceMap[slot],units[slot]]));
   for(const slot of concealedSlots)delete units[slot];
   Object.assign(units,physical);
  }
  for(const [id,hex] of Object.entries(next))if(!concealedSlots.includes(id)){
   units[id].hex=hex;units[id].openingHex=hex;
  }
  if(infantryReserveSlot!==null){
   delete units[infantryReserveSlot];
   units[facePool.reserveId]=selectedPhysical(infantryReserveSlot);
  }
  return context;
 }
 function previewUnits(){
  const units=clone(baseline);
  for(const [slot,faceId] of Object.entries(faceMap)){
   const actual=clone(baseline[faceId]);actual.id=slot;units[slot]=actual;
  }
  for(const [id,hex] of Object.entries(next)){units[id].hex=hex;units[id].openingHex=hex}
  if(infantryReserveSlot!==null){
   units[infantryReserveSlot]={...selectedPhysical(infantryReserveSlot),id:infantryReserveSlot};
  }
  return units;
 }
 function mixConcealed(order){
  if(!mix)fail('no-concealed-source-group');
  if(!Array.isArray(order)||order.length!==concealedSlots.length||
     new Set(order).size!==concealedSlots.length||order.some(id=>!concealedSlots.includes(id)))
   fail('invalid-concealed-source-permutation');
  return create({opening,map,policy,placements:next,
   identityAssignments:Object.fromEntries(concealedSlots.map((slot,i)=>[slot,order[i]])),concealedMixed:true,
   counterConfig,buildupAllocation,infantryReserveSlot});
 }
 function save(){
  const payload={format:FORMAT,version:infantryReserveSlot===null?2:3,scenarioId:policy.scenarioId,
   openingSHA256:policy.openingSHA256,placements:clone(next),identityAssignments:clone(faceMap),concealedMixed,
   ...(infantryReserveSlot===null?{}:{infantryReserveSlot})};
  return {...payload,integrity:{algorithm:'SHA-256',digest:Hash.sha256(JSON.stringify(payload))}};
 }
 return Object.freeze({snapshot:()=>({placements:clone(next),units:previewUnits(),groups:clone(groups),
  concealedSlots:clone(concealedSlots),concealedMixed,identityAssignments:clone(faceMap),
  infantryFaceSelection:facePool?{
   reserveFaceId:infantryReserveSlot||facePool.reserveId,
   sourceReserveFaceId:facePool.reserveId,
   swappedDeployedSlot:infantryReserveSlot,
   eligibleDeployedSlots:clone(facePool.eligible),
   choices:facePool.eligible.map(id=>({slot:id,
    printedIdentifier:facePool.front.get(id).visualTranscription.printedIdentifier,
    printedStrength:facePool.front.get(id).visualTranscription.printedValues}))
  }:null,
  sourceCounterCount:policy.groundUnitCount,sourceFleetCount:(policy.fixedSupportMarkers||[]).length,unselectedFrontlineHexes:(policy.unselectedRegion?.hexes||[]).filter(h=>!
   Object.entries(next).some(([id,x])=>x===h&&policy.unselectedRegion.groups.includes(memberToGroup[id])))}),
  move,swapPositions,choices,mixConcealed,selectInfantryReserve,selectedAllocation,commit,save});
}
function restore(saved,source){
 const v=saved?.version;
 if(saved?.format!==FORMAT||![1,2,3].includes(v)||saved.scenarioId!==source.policy?.scenarioId||
    saved.openingSHA256!==source.policy?.openingSHA256||saved.integrity?.algorithm!=='SHA-256'||
    Object.keys(saved).sort().join(',')!==(v===1?
     ['format','version','scenarioId','openingSHA256','placements','integrity']:
     v===2?['format','version','scenarioId','openingSHA256','placements','identityAssignments','concealedMixed','integrity']:
     ['format','version','scenarioId','openingSHA256','placements','identityAssignments','concealedMixed','infantryReserveSlot','integrity']).sort().join(','))
  fail('invalid-editor-save-envelope');
 const {integrity,...payload}=saved;
 if(Hash.sha256(JSON.stringify(payload))!==integrity.digest)fail('save-checksum-mismatch');
 return create({...source,placements:saved.placements,
  ...(v>=2?{identityAssignments:saved.identityAssignments,concealedMixed:saved.concealedMixed}:{}),
  ...(v===3?{infantryReserveSlot:saved.infantryReserveSlot}: {})});
}

return Object.freeze({create,restore,FORMAT,fingerprint});
});
