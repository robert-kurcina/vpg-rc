/* Kiev–Odessa §6 initial counter allocation. Diagnostic-only, source-bound.
 * Every original/supplemental starting counter gets a stable runtime key and a
 * player-chosen slot. Four verified Romanian setup crosses permit a narrow
 * initial-position candidate; the complete country mask, marker provenance
 * and composite movement graph remain unresolved for historical gameplay.
 */
'use strict';
const Binder=require('./composite_setup_roster_binding');
const Preflight=require('./composite_setup_source_preflight');
const SourceInventory=require('./historical_source_face_inventory');
const Terrain=require('./terrain_tiles');
const fail=reason=>{throw Error('odessa-starting-state: '+reason)};
const clone=v=>JSON.parse(JSON.stringify(v));
const obj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const mapFaceGroups=Object.freeze({
 germanInitialPanzer:['axis','german','corps','panzer'],
 germanPolandInfantry:['axis','german','corps','infantry'],
 germanRomaniaInfantry:['axis','german','corps','infantry'],
 romanianInitialArmy:['axis','romanian','army','infantry'],
 sovietFrontArmies:['soviet','soviet','army','infantry'],
 sovietFrontMechanized:['soviet','soviet','corps','mechanized'],
 sovietFixedArmies:['soviet','soviet','army','infantry'],
 sovietFixedMechanized:['soviet','soviet','corps','mechanized']
});
const supplementaryGroups=Object.freeze({
 'soviet-cavalry-corps-a':['soviet','soviet','corps','cavalry'],
 'soviet-cavalry-corps-b':['soviet','soviet','corps','cavalry'],
 'soviet-coastal-army':['soviet','soviet','army','infantry'],
 'soviet-black-sea-fleet':['soviet','soviet','marker','fleet'],
 'romanian-home-army':['axis','romanian','army','infantry'],
 'romanian-4th-army':['axis','romanian','army','infantry'],
 'romanian-cavalry-corps':['axis','romanian','corps','cavalry']
});
function create({root,combinedMap,baseMap,extension,setupPolicy,sourceBindingPolicy,
  overlay,kievInventory,kievCounters,odessaCounters,kievSetupPolicy}={}){
 const binder=Binder.create({root,combinedMap,baseMap,extension,setupPolicy,sourceBindingPolicy,overlay,kievInventory,kievCounters,odessaCounters});
 const preflight=Preflight.create({root,map:combinedMap,overlay,policy:setupPolicy});
 const sourcePoland=['0105','0203','0204','0301','0302','0303','0402'];
 const sourceRomania=['0709','0809','0910','1010'];
 if(kievSetupPolicy?.scenarioId!=='kiev'||kievSetupPolicy?.expectedStartingUnits!==30||
   !Array.isArray(kievSetupPolicy.groups?.germanPolandInfantry?.allowedHexes)||
   JSON.stringify([...kievSetupPolicy.groups.germanPolandInfantry.allowedHexes].sort())!==JSON.stringify(sourcePoland)||
   kievSetupPolicy.groups.germanPolandInfantry.count!==7||
   kievSetupPolicy.groups.germanInitialPanzer.count!==3||
   JSON.stringify([...(kievSetupPolicy.groups.germanRomaniaInfantry?.allowedHexes||[])].sort())!==JSON.stringify(sourceRomania)||
   JSON.stringify([...(kievSetupPolicy.groups.romanianInitialArmy?.allowedHexes||[])].sort())!==JSON.stringify(sourceRomania))
  fail('invalid-original-kiev-setup-policy');
 const sourceScan=SourceInventory.create(kievInventory).inspect(kievCounters);
 if(!sourceScan.valid)fail('invalid-original-kiev-source-pools');
 const byHex=new Map(combinedMap.cells.map(c=>[c.id,c]));
 const byFront=new Map(kievCounters.faces.front.map(f=>[f.faceId,f]));
 const bySupplementary=new Map(overlay.units.map(u=>[u.designKey,u]));
 const odessaFaces=new Map([...odessaCounters.faces.front,...odessaCounters.faces.back].map(face=>[face.faceId,face]));
 const frontStars=new Set(preflight.audit.actualFrontlineStarHexes);
 const rearType=setupPolicy.rearSoviet.positions;
 const polishMarkers=new Set(kievSetupPolicy.groups.germanPolandInfantry.allowedHexes);
 const requiredOriginalGroups=Object.keys(mapFaceGroups);
 const requiredExtra=Object.keys(supplementaryGroups);
 const requiredOriginalCount=30,requiredExtraCount=7;
 function build({allocation,basePlacements,extraPlacements}={}){
  const identity=binder.bindAllocation(allocation);
  if(!obj(basePlacements)||!obj(extraPlacements))fail('explicit-original-and-supplement-placements-required');
  const initial=new Map(),assigned=new Set(),all=new Map(),positions=new Map();
  const push=(id,face,group,hex,side,nationality,size,kind,extra={})=>{
   if(all.has(id)||assigned.has(face))fail('duplicate-source-unit-or-face:'+id);
   const c=byHex.get(hex);
   if(typeof hex!=='string'||!c||c.terrain==='sea')fail('invalid-initial-hex:'+id);
   assigned.add(face);
   const u=Object.freeze({id,sourceFaceId:face,group,hex,openingHex:hex,side,nationality,size,kind,
    strengthStatus:'full',historicalUnitId:null,...extra});
   all.set(id,u);initial.set(id,u);
   if(!positions.has(hex))positions.set(hex,[]);positions.get(hex).push(u);
  };
  const startingOriginalFaces=requiredOriginalGroups.flatMap(k=>allocation[k]);
  if(startingOriginalFaces.length!==requiredOriginalCount||
     Object.keys(basePlacements).length!==requiredOriginalCount||
     new Set(Object.keys(basePlacements)).size!==requiredOriginalCount||
     Object.keys(basePlacements).some(face=>!startingOriginalFaces.includes(face)))fail('base-placement-does-not-match-starting-face-allocation');
  if(Object.keys(extraPlacements).length!==requiredExtraCount||
     requiredExtra.some(k=>!Object.hasOwn(extraPlacements,k))||
     Object.keys(extraPlacements).some(k=>!Object.hasOwn(supplementaryGroups,k)))fail('supplement-placement-mismatch');
  for(const group of requiredOriginalGroups){
   for(const faceId of allocation[group]){
    const face=byFront.get(faceId);
    if(!face?.pairedFaceId)fail('missing-original-paired-counter:'+faceId);
    const [side,nationality,size,kind]=mapFaceGroups[group];
    const displayKind=kind==='infantry'&&face.visualTranscription?.kind==='mountain-infantry'?'mountain-infantry':kind;
    push('kiev/'+faceId,faceId,group,basePlacements[faceId],side,nationality,size,displayKind,
     {reverseFaceId:face.pairedFaceId,sourceSheet:'kiev',
      printedIdentifier:face.visualTranscription?.printedIdentifier||null,
      printedValues:face.visualTranscription?.printedValues||null,
      concealed:kind==='mechanized',
      setupFaceState:kind==='mechanized'?'untried':'full'});
   }
  }
  for(const group of requiredExtra){
   const design=bySupplementary.get(group),rules=supplementaryGroups[group];
   if(!design||design.id!=='kiev-odessa/'+group||!design.art?.displayFaceId)fail('invalid-supplement-counter:'+group);
   const printed=odessaFaces.get(design.art.displayFaceId),reverse=odessaFaces.get(printed?.pairedFaceId);
   if(!printed||!reverse||reverse.pairedFaceId!==printed.faceId||
      (design.art.alternateFaceId&&design.art.alternateFaceId!==reverse.faceId)||
      (design.art.singleSided===false&&!design.art.alternateFaceId)||
      !['soviet','romanian'].includes(printed.visualTranscription?.printedAffiliation)||
      printed.visualTranscription.printedAffiliation!==design.side)fail('invalid-supplement-counter-face:'+group);
   const [side,nationality,size,kind]=rules;
   push(design.id,design.art.displayFaceId,group,extraPlacements[group],side,nationality,size,kind,
    {reverseFaceId:design.art.alternateFaceId||null,sourceSheet:'odessa-extension',
     stackFree:kind==='fleet',concealed:false,openingCounterState:kind==='fleet'?'undamaged':'full'});
  }
  if(all.size!==37||initial.size!==37||assigned.size!==37)fail('incomplete-initial-roster');
  // Soviet §6 rear slots, including the rulebook-authorized 1309. Marker
  // disagreement remains a blocker and is NOT repaired by these assignments.
  const rear=[...all.values()].filter(u=>['sovietFixedArmies','sovietFixedMechanized','soviet-cavalry-corps-a'].includes(u.group))
   .map(u=>({hex:u.hex,type:u.kind==='mechanized'?'mechanized-corps':u.kind==='cavalry'?'cavalry-corps':'infantry-army'}));
  preflight.validateRear(rear);
  const frontline=[...all.values()].filter(u=>['sovietFrontArmies','sovietFrontMechanized','soviet-cavalry-corps-b'].includes(u.group))
   .map(u=>({hex:u.hex,type:u.kind==='mechanized'?'mechanized-corps':u.kind==='cavalry'?'cavalry-corps':'infantry-army'}));
  const verifiedFront=preflight.validateFrontline(frontline);
  if(frontline.some(u=>!frontStars.has(u.hex)))fail('unapproved-frontline-star');
  // Odessa §6(4) says Army-size units may not begin next to other friendly
  // Armies; include fixed rear Armies and the Coastal Army, not only stars.
  const sovietArmies=[...all.values()].filter(u=>u.nationality==='soviet'&&u.size==='army');
  for(let i=0;i<sovietArmies.length;i++)for(let j=i+1;j<sovietArmies.length;j++){
   const a=sovietArmies[i],b=sovietArmies[j],c=byHex.get(a.hex);
   if(Terrain.DIRS.some(dir=>Terrain.neighbor(c,dir,combinedMap.geometry)===b.hex))
    fail('adjacent-soviet-armies:'+a.hex+':'+b.hex);
  }
  for(const group of ['soviet-coastal-army','soviet-black-sea-fleet']){
   const u=all.get('kiev-odessa/'+group);
   if(u.hex!=='1513')fail('odessa-port-start-required:'+group);
  }
  // Kiev §6 Polish setup: seven source crosses are all occupied, with the
  // three Panzer Corps adding one second unit to three distinct crosses.
  const polish=[...all.values()].filter(u=>['germanInitialPanzer','germanPolandInfantry'].includes(u.group));
  const byPolish=new Map();
  for(const u of polish){
   if(!polishMarkers.has(u.hex))fail('invalid-poland-setup:'+u.id);
   if(!byPolish.has(u.hex))byPolish.set(u.hex,[]);byPolish.get(u.hex).push(u);
  }
  if(byPolish.size!==7||[...byPolish.values()].some(us=>us.length<1||us.length>2)||
     [...byPolish.values()].filter(us=>us.length===2).length!==3||
     [...byPolish.values()].some(us=>us.filter(u=>u.kind==='panzer').length>1))
   fail('invalid-poland-stacking-or-source-cross-occupancy');
  // The four Kiev §6 Romanian setup crosses are authoritative for INITIAL
  // SETUP in the Odessa composite, not a country border. Do not extend that
  // narrow approval to Home Army movement or other Romanian territory tests.
  const romanianRegion=[...all.values()].filter(u=>['germanRomaniaInfantry','romanianInitialArmy',
   'romanian-home-army','romanian-4th-army','romanian-cavalry-corps'].includes(u.group));
  if(romanianRegion.length!==7||romanianRegion.filter(u=>u.nationality==='german').length!==3||
     romanianRegion.filter(u=>u.nationality==='romanian').length!==4)fail('incorrect-romanian-force-count');
  const missingRomania=[],romanianSetupEvidence={};
  for(const u of romanianRegion){
   const evidence=preflight.setupTerritoryEvidence(u.hex);
   if(evidence==='not-romanian')fail('explicitly-non-romanian-start:'+u.id);
   romanianSetupEvidence[u.id]={hex:u.hex,evidence};
   if(evidence==='unverified')missingRomania.push(u.hex);
  }
  const flat=[...all.values()];
  for(const [hex,us] of positions){
   const ground=us.filter(u=>!u.stackFree);
   const sides=new Set(ground.map(u=>u.side));
   if(sides.size>1||ground.length>2||ground.filter(u=>u.size==='army').length>1||
     ground.some(u=>u.nationality==='hungarian')&&ground.some(u=>u.nationality==='romanian'))
    fail('illegal-source-setup-stack:'+hex);
  }
  const startingCountBySide={axis:flat.filter(u=>u.side==='axis'||u.side==='german').length,
    soviet:flat.filter(u=>u.side==='soviet').length};
  if(startingCountBySide.axis!==17||startingCountBySide.soviet!==20)fail('wrong-source-starting-strength');
  // Off-map inventory is not an initial deployment. Preserve the source-typed
  // reinforcement groups and special Romanian Air Support separately.
  const reinforcement=Object.entries(allocation)
   .filter(([k])=>!Object.hasOwn(mapFaceGroups,k))
   .flatMap(([group,faces])=>faces.map(faceId=>{
    const schedule=(kievInventory.reinforcementSchedule||[]).find(t=>t[group]);
    return {id:'kiev/'+faceId,sourceFaceId:faceId,group,entryKind:group==='sovietReplacementOnlyArmy'?'replacement-only':'scheduled',
     earliestTurn:schedule?.turn|| (group==='sovietReplacementOnlyArmy'?2:null),hex:null};
   }));
  const airFaces=sourceScan.pools.airSupport.map(id=>({id:'kiev/'+id,sourceFaceId:id,entryKind:'support-marker',initialTurn:1,hex:null}));
  const romanianAir=bySupplementary.get('romanian-air-support');
  const airFront=odessaFaces.get(romanianAir?.art?.displayFaceId);
  const airBack=odessaFaces.get(romanianAir?.art?.alternateFaceId);
  if(romanianAir?.initial?.turn!==2||airFront?.pairedFaceId!==airBack?.faceId||
     airBack?.pairedFaceId!==airFront?.faceId||
     airFront?.visualTranscription?.kind!=='air-marker'||
     airFront?.visualTranscription?.printedAffiliation!=='romanian')fail('wrong-romanian-air-arrival-or-face');
  airFaces.push({id:romanianAir.id,sourceFaceId:romanianAir.art.displayFaceId,entryKind:'support-marker',initialTurn:2,hex:null});
  const blockers=[...new Set([...preflight.audit.blockers.filter(s=>
    !['unbound-base-romanian-unit','unbound-base-german-infantry'].includes(s)&&
    !s.startsWith('unclassified-political-territory:')),
    'not-certified-movement-and-eastern-communication',
    'full-romanian-country-border-still-unverified-for-movement',
    ...(missingRomania.length?['unverified-selected-romanian-hexes:'+ [...new Set(missingRomania)].sort().join(',')]:[])])];
  return Object.freeze({scenarioId:'kiev-odessa',status:'candidate-starting-state-not-gameplay-authorized',
   gameplayCertified:false,canRunHistoricalCampaign:false,
   diagnosticRuntimeIdsAllocated:true,initialUnits:Object.freeze(Object.fromEntries(all)),
   onMapCount:flat.length,bySide:startingCountBySide,reinforcementTrack:reinforcement,
   airSupportTrack:airFaces,frontlineSelected:verifiedFront.selectedSourceStarSubset,
   unusedFrontlineStars:[...frontStars].filter(h=>!verifiedFront.selectedSourceStarSubset.includes(h)).sort(),
   rearRuleSlots:Object.keys(rearType).sort(),romanianPlacementsAwaitingTerritory:[...new Set(missingRomania)].sort(),
   romanianSetupEvidence:Object.freeze(romanianSetupEvidence),
   romanianSetupSubsetVerified:missingRomania.length===0,
   sourceBlockers:blockers,sourceFaceBindingsVerified:identity.status==='candidate-source-face-bound-not-gameplay-authorized'});
 }
 return Object.freeze({build,sourceAudit:binder.sourceAudit});
}
module.exports=Object.freeze({create});
