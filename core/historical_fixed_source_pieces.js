/* Source-bound exceptional starting pieces. Reusable across historical games:
 * a printed playable unit may occupy a counter reverse whose ordinary front
 * is a map/location marker. No face fabrication or ordinary-unit fallback.
 * Caller must supply explicit scenario rule/provenance and source IDs.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameHistoricalFixedSourcePieces=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const fail=m=>{throw Error('fixed-source-piece: '+m);};
 const clone=v=>JSON.parse(JSON.stringify(v));
 const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
 function initialize({map,counterConfig,policy,state={units:{}}}={}){
  if(!obj(map)||!Array.isArray(map.cells)||!obj(counterConfig)||!obj(policy)||
     policy.schemaVersion!==1||!policy.source||!Array.isArray(policy.pieces)||!policy.pieces.length||
     policy.scenarioId!==counterConfig.mapId||policy.sourceGame!==map.sourceGame||
     !obj(state)||!obj(state.units))fail('invalid-source-configuration');
  const hexes=new Map(map.cells.map(c=>[c.id,c]));
  if(hexes.size!==map.cells.length)fail('duplicate-board-hex');
  const fronts=new Map(counterConfig.faces?.front?.map(f=>[f.faceId,f])||[]);
  const backs=new Map(counterConfig.faces?.back?.map(f=>[f.faceId,f])||[]);
  if(fronts.size!==(counterConfig.faces?.front?.length||0)||backs.size!==(counterConfig.faces?.back?.length||0))fail('duplicate-counter-face');
  const result=clone(state),byCell=new Set(),byFace=new Set(),audit=[];
  for(const p of policy.pieces){
   if(!obj(p)||typeof p.id!=='string'||!p.id||!/^\d{4}$/.test(p.hex)||
      !['german','soviet'].includes(p.owner)||!['corps','army'].includes(p.size)||
      typeof p.class!=='string'||!p.class||p.activeSide!=='back'||
      p.strengthStatus!=='printed-reduced'||!p.expectedFrontKind||!p.expectedBackKind||
      !/^\d+-\d+$/.test(p.expectedBackPrintedValues)||!p.markerKind||!p.markerSourceSvgId||
      !p.sourceFaceId||!p.reverseFaceId||!p.ruleSource||
      p.ruleSource!==policy.source||byFace.has(p.sourceFaceId)||byFace.has(p.reverseFaceId))fail('invalid-piece-declaration');
   byFace.add(p.sourceFaceId);byFace.add(p.reverseFaceId);
   const cell=hexes.get(p.hex),front=fronts.get(p.sourceFaceId),back=backs.get(p.reverseFaceId);
   if(!cell||cell.terrain==='sea'||!front||!back||front.pairedFaceId!==back.faceId||back.pairedFaceId!==front.faceId)
    fail('missing-or-mismatched-source-face-or-hex:'+p.id);
   const marks=(cell.tileMarkers||[]).filter(t=>t.kind===p.markerKind&&t.sourceSvgId===p.markerSourceSvgId);
   if(marks.length!==1||front.visualTranscription?.kind!==p.expectedFrontKind||
      back.visualTranscription?.kind!==p.expectedBackKind||
      back.visualTranscription?.printedValues!==p.expectedBackPrintedValues||
      back.visualTranscription?.printedAffiliation!==p.expectedBackPrintedAffiliation)
    fail('map-marker-or-printed-counter-mismatch:'+p.id);
   const [attack,movement]=p.expectedBackPrintedValues.split('-').map(Number);
   if(!Number.isSafeInteger(attack)||attack<1||!Number.isSafeInteger(movement)||movement<1)fail('invalid-source-values');
   if(Object.hasOwn(result.units,p.id)||Object.values(result.units).some(u=>u.sourceFaceId===front.faceId||u.reverseFaceId===back.faceId))
    fail('piece-already-assigned:'+p.id);
   const key=p.hex+':'+p.id;if(byCell.has(key))fail('duplicate-fixed-placement');byCell.add(key);
   // Owner is explicitly defined from the scenario rule. The printed face
   // retains its observed visual-affiliation transcription even when the two
   // differ; do not silently infer ownership from counter palette.
   result.units[p.id]={id:p.id,hex:p.hex,owner:p.owner,nationality:p.nationality||p.owner,
    class:p.class,size:p.size,mp:movement,marker:false,sourceFaceId:front.faceId,
    reverseFaceId:back.faceId,activeFaceId:back.faceId,historicalUnitId:null,
    strengthStatus:'printed-reduced',printedCombatStrength:attack};
   audit.push({id:p.id,hex:p.hex,owner:p.owner,sourceFaceId:front.faceId,activeFaceId:back.faceId,
    sourceMapMarkerSvgId:p.markerSourceSvgId,printedValues:p.expectedBackPrintedValues,
    printedAffiliation:back.visualTranscription.printedAffiliation,ruleSource:p.ruleSource});
  }
  return Object.freeze({state:clone(result),audit:clone(audit),sourceBound:true,historicalFullSetupCertified:false});
 }
 function combatAuthorizations({map,counterConfig,policy}={}){
  // Revalidate the rule-backed starting face before authorizing its unusual
  // reverse-only combat surface. No dynamic per-scenario branch in combat.
  initialize({map,counterConfig,policy});
  return Object.freeze(policy.pieces.map(p=>Object.freeze({unitId:p.id,sourceFaceId:p.sourceFaceId,
   reverseFaceId:p.reverseFaceId,owner:p.owner,class:p.class,frontKind:p.expectedFrontKind,
   backKind:p.expectedBackKind,backAffiliation:p.expectedBackPrintedAffiliation,
   printedValues:p.expectedBackPrintedValues})));
 }
 return Object.freeze({initialize,combatAuthorizations});
});
