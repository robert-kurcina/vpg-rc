/* Source-face binding for the inherited Kiev counter inventory and the Odessa
 * supplement. Read-only diagnostics; does not choose a historical opening,
 * rewrite the source SVG, create a playable campaign or alter any roster IDs.
 */
'use strict';
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const SourceInventory=require('./historical_source_face_inventory');
const SetupPreflight=require('./composite_setup_source_preflight');
const fail=reason=>{throw Error('odessa-roster-binding: '+reason)};
const copy=x=>JSON.parse(JSON.stringify(x));
const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
function create({root='.',combinedMap,baseMap,extension,setupPolicy,sourceBindingPolicy,
  overlay,kievInventory,kievCounters,odessaCounters}={}){
 const binding=sourceBindingPolicy;
 if(!object(binding)||binding.schemaVersion!==1||binding.scenarioId!=='kiev-odessa'||
    binding.status!=='source-face-identity-binding-candidate-not-gameplay-authorized'||
    binding.historicalSetupAuthorized!==false||binding.artworkPolicy!=='audit-only-no-map-edit'||
    binding.inheritedRomanian?.group!=='romanianInitialArmy'||
    binding.inheritedRomanian.expectedFrontFaceId!=='kiev-front-r02c08'||
    binding.inheritedRomanian.expectedBackFaceId!=='kiev-back-r02c01'||
    binding.inheritedRomanian.printedIdentifier!=='Rom 3'||
    binding.inheritedRomanian.printedValues!=='6-4'||
    binding.inheritedGermanRomania?.group!=='germanRomaniaInfantry'||
    binding.inheritedGermanRomania.expectedCount!==3||
    JSON.stringify(binding.newRomanianGroundDesignKeys)!==JSON.stringify([
       'romanian-home-army','romanian-4th-army','romanian-cavalry-corps'])||
    JSON.stringify(binding.newRomanianGroundSourceFaces)!==JSON.stringify({
      'romanian-home-army':'odessa-front-r01c05',
      'romanian-4th-army':'odessa-front-r01c06',
      'romanian-cavalry-corps':'odessa-back-r01c01'})||
    binding.sourceDefinedRearMechanized?.hex!=='1309'||
    binding.sourceDefinedRearMechanized.expectedMarker!=='fixedMechanized')fail('invalid-source-binding-policy');
 const preflight=SetupPreflight.create({root,map:combinedMap,overlay,policy:setupPolicy});
 if(kievInventory?.scenarioId!=='kiev'||kievCounters?.mapId!=='kiev'||
    odessaCounters?.mapId!=='odessa-extension'||baseMap?.cells===undefined||
    extension?.cells===undefined)fail('wrong-source-counter-inventory');
 // Verify original source-sheet bytes as well as the separately pinned PDF
 // hashes checked by SetupPreflight. Neither check trusts a fixture name alone.
 for(const config of [kievCounters,odessaCounters]){
  for(const side of ['front','back']){
   const spec=config.faceSource?.[side];
   if(!spec?.file||!spec.sha256||!/^[a-f0-9]{64}$/.test(spec.sha256))fail('missing-counter-source-hash');
   const bytes=fs.readFileSync(path.join(root,spec.file));
   if(crypto.createHash('sha256').update(bytes).digest('hex')!==spec.sha256)fail('counter-source-sheet-changed');
  }
 }
 const allFaces=new Map([
  ...odessaCounters.faces.front.map(f=>[f.faceId,f]),
  ...odessaCounters.faces.back.map(f=>[f.faceId,f])
 ]);
 const designs=new Map(overlay.units.map(u=>[u.designKey,u]));
 const supplementary=binding.newRomanianGroundDesignKeys.map(designKey=>{
  const unit=designs.get(designKey),face=allFaces.get(unit?.art?.displayFaceId);
  if(!unit||unit.side!=='romanian'||!unit.id?.startsWith('kiev-odessa/')||
     unit.initial?.region!=='Romania'||
     unit.art.displayFaceId!==binding.newRomanianGroundSourceFaces[designKey]||
     !face||!face.visualTranscription||
     face.visualTranscription.printedAffiliation!=='romanian')
    fail('unverified-supplementary-romanian-design:'+designKey);
  return Object.freeze({designKey,unitId:unit.id,sourceFaceId:unit.art.displayFaceId,
   counterSheet:'odessa-extension',placement:'source-verified-romania-only',selectedHex:null});
 });
 const inv=SourceInventory.create(kievInventory),scan=inv.inspect(kievCounters);
 if(!scan.valid)fail('kiev-counter-inventory-invalid:'+scan.errors.join(';'));
 const inherited=binding.inheritedRomanian;
 const originalRomanian=kievCounters.faces.front.find(f=>f.faceId===inherited.expectedFrontFaceId);
 if(!originalRomanian||originalRomanian.pairedFaceId!==inherited.expectedBackFaceId||
    originalRomanian.visualTranscription?.printedIdentifier!==inherited.printedIdentifier||
    originalRomanian.visualTranscription?.printedValues!==inherited.printedValues||
    originalRomanian.visualTranscription?.printedAffiliation!=='romanian'||
    !scan.pools.romanianArmy.includes(originalRomanian.faceId))fail('base-romanian-source-face-disagreement');
 const byId=new Map(combinedMap.cells.map(c=>[c.id,c]));
 const base1309=baseMap.cells.find(c=>c.id==='1309');
 if(!base1309?.tileMarkers?.some(m=>m.kind==='fixedMechanized')||!byId.has('1309'))
  fail('original-kiev-rear-1309-source-missing');
 const rear1309=byId.get('1309')?.tileMarkers?.some(m=>m.kind==='fixedMechanized')===true;
 const extra0706=byId.get('0706')?.tileMarkers?.some(m=>m.kind==='fixedMechanized')===true;
 const rearEvidence=Object.freeze({sourceRuleHex:'1309',sourceOriginalKievMarker:true,
  combinedMarkerPresent:rear1309,combinedExtraMarker0706:extra0706,
  semanticSetupPosition:'1309',artworkReassignmentAuthorized:false,
  rulePlacementValid:preflight.validateRear(Object.entries(setupPolicy.rearSoviet.positions).map(([hex,type])=>({hex,type}))).valid});
 // The source book mandates *three* German infantry counters at Romania, not
 // their unique printed designations. Preserve player-selectable source IDs.
 function bindAllocation(allocation){
  const validated=inv.validateAllocation(kievCounters,allocation);
  if(!validated.valid)fail('invalid-base-kiev-allocation:'+validated.errors.join(';'));
  const romanian=allocation[inherited.group];
  if(romanian?.length!==1||romanian[0]!==originalRomanian.faceId)fail('inherited-romanian-not-selected');
  const german=allocation[binding.inheritedGermanRomania.group];
  if(!Array.isArray(german)||german.length!==3||german.some(id=>!scan.pools.germanInfantry.includes(id)))
   fail('wrong-german-romanian-setup-group');
  const baselineRomanian=Object.freeze({sourceFaceId:originalRomanian.faceId,
   reverseFaceId:originalRomanian.pairedFaceId,printedIdentifier:'Rom 3',
   sourceIdentityKey:originalRomanian.sourceIdentityKey,side:'romanian',
   counterSheet:'kiev',unitId:null,selectedHex:null});
  const germanUnits=german.map(id=>{
   const f=kievCounters.faces.front.find(f=>f.faceId===id);
   return Object.freeze({sourceFaceId:id,reverseFaceId:f.pairedFaceId,
    printedIdentifier:f.visualTranscription.printedIdentifier,
    sourceIdentityKey:f.sourceIdentityKey,counterSheet:'kiev',side:'german',
    unitId:null,selectedHex:null});
  });
  const result={status:'candidate-source-face-bound-not-gameplay-authorized',
   inheritedRomanian:baselineRomanian,inheritedGermanInfantry:germanUnits,
   supplementalRomanian:copy(supplementary),totalRomanianGround:1+supplementary.length,
   germanRomaniaInfantry:germanUnits.length,sourceDefinedRear:copy(rearEvidence),
   frontlineCandidates:preflight.audit.actualFrontlineStarHexes,
   blockers:preflight.audit.blockers,canRunHistoricalCampaign:false,
   playerSelectedGermanSourceFaces:true,romanianStartingHexesVerified:false,
   rosterGameUnitIdsAllocated:false};
  return Object.freeze(result);
 }
 return Object.freeze({bindAllocation,sourceAudit:Object.freeze({
  originalKievRomanianFace:originalRomanian.faceId,originalKievRomanianBack:originalRomanian.pairedFaceId,
  availableKievGermanInfantry:scan.pools.germanInfantry.slice(),
  preflightBlockers:preflight.audit.blockers,sourceDefinedRear:rearEvidence,
  mapArtworkUnchanged:true,productionCertified:false})});
}
module.exports=Object.freeze({create});
