/* Generic source-marker-bound historical starting setup. The scenario owns
 * all group/slot/printed-anchor rules in configuration. Never auto-selects
 * identities or silently translates disputed printed hex coordinates.
 * This returns a candidate state, NOT gameplay activation/certification.
 */
(function(root,factory){
 const T=typeof module==='object'&&module.exports?require('./terrain_tiles.js'):root.HexTerrainTiles;
 const R=typeof module==='object'&&module.exports?require('./printed_coordinate_registry.js'):root.WargamePrintedCoordinates;
 const api=factory(T,R);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameScenarioStartingSetup=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(T,R){'use strict';
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const copy=o=>JSON.parse(JSON.stringify(o));
 const hex=/^\d{4}$/;
 function slots(map,spec){
  if(!map||!Array.isArray(map.cells)||!spec||spec.schemaVersion!==1||!spec.scenarioId||!spec.markerSlots||!spec.groups)
   throw Error('Explicit board and typed scenario setup configuration required');
  const errors=[],all=Object.fromEntries(Object.keys(spec.markerSlots).map(k=>[k,[]]));
  if(spec.mapSourceGame&&map.sourceGame!==spec.mapSourceGame)errors.push('Setup configuration/map provenance mismatch');
  const anchoredKinds=new Set(Object.entries(spec.markerSlots).filter(([,rule])=>Array.isArray(rule.cityAnchors)).map(([kind])=>kind));
  for(const cell of map.cells){
   for(const marker of cell.tileMarkers||[]){
    if(!own(all,marker.kind)||anchoredKinds.has(marker.kind))continue;
    all[marker.kind].push({hex:cell.id,sourceSvgId:marker.sourceSvgId||null,kind:marker.kind,terrain:cell.terrain});
   }
  }
  // A rulebook can place an initial counter at a named city even when the
  // user-authored SVG lacks (or misclassifies) a miniature deployment glyph.
  // The anchor is accepted only if the exact named city exists at the declared
  // cell; an arbitrary coordinate alone cannot authorize it.
  const byHex=new Map(map.cells.map(c=>[c.id,c]));
  for(const kind of anchoredKinds){
   for(const a of spec.markerSlots[kind].cityAnchors){
    const cell=byHex.get(a.hex);
    const cities=(cell?.tileMarkers||[]).filter(m=>m.kind==='city'&&m.label===a.cityLabel&&m.sourceSvgId);
    if(!cell||cities.length!==1||!a.ruleSource){errors.push('Missing/ambiguous source city anchor '+kind+':'+a.hex);continue;}
    all[kind].push({hex:cell.id,sourceSvgId:cities[0].sourceSvgId,kind,terrain:cell.terrain,anchorSource:'rule-and-authored-city',ruleSource:a.ruleSource});
   }
  }
  for(const [kind,rule] of Object.entries(spec.markerSlots)){
   const items=all[kind],count=items.length;
   if(!Number.isSafeInteger(rule.count)||rule.count<1||!Array.isArray(rule.occupancy)||rule.occupancy.length!==rule.count||
      !rule.occupancy.every(n=>Number.isSafeInteger(n)&&n>=1))errors.push('Invalid marker capacity '+kind);
   if(count!==rule.count||new Set(items.map(x=>x.hex)).size!==count)errors.push('Marker count/uniqueness mismatch '+kind);
   if(items.some(x=>!hex.test(x.hex)||x.terrain==='sea'))errors.push('Marker on invalid/unplayable cell '+kind);
  }
  if(Object.entries(spec.groups).some(([name,g])=>!g||!own(all,g.marker)||typeof g.owner!=='string'||!g.owner||typeof g.class!=='string'||!g.class||!['corps','army'].includes(g.size)||!g.pool||
     !g.printedAffiliation||!(typeof g.printedKind==='string'&&g.printedKind||Array.isArray(g.printedKinds)&&g.printedKinds.length>1&&g.printedKinds.every(k=>typeof k==='string'&&k))||!Number.isSafeInteger(g.count)||g.count<1))
   errors.push('Invalid group/marker configuration');
  // Source-book placement regions may be narrower than a faction-wide glyph:
  // e.g. Kiev's Polish vs Romanian Axis crosses. Never infer them from art.
  for(const [name,g] of Object.entries(spec.groups)){
   if(g?.allowedHexes===undefined)continue;
   const permitted=all[g.marker]||[],allowed=g.allowedHexes;
   if(!Array.isArray(allowed)||!allowed.length||new Set(allowed).size!==allowed.length||
      allowed.some(h=>!hex.test(h)||!permitted.some(p=>p.hex===h)))
    errors.push('Invalid rulebook placement region '+name);
  }
  return {slots:all,errors};
 }
 function printedAnchors(map,spec,all){
  const numbers=R.resolve(map,c=>T.formatHexNumber(c,T.numberStyle(map,{})));
  const errors=[],report=[],seenSource=new Set(),seenPrinted=new Set();
  for(const a of spec.printedRearAnchors||[]){
   if(!a||!hex.test(a.printed)||!a.sourceSvgId||!own(all,a.marker)||seenSource.has(a.sourceSvgId)||seenPrinted.has(a.printed)){
    errors.push('Invalid/duplicate rear source anchor');continue;
   }
   seenSource.add(a.sourceSvgId);seenPrinted.add(a.printed);
   const found=all[a.marker].filter(m=>m.sourceSvgId===a.sourceSvgId);
   if(found.length!==1){errors.push('Missing/ambiguous SVG rear anchor '+a.sourceSvgId);continue;}
   const target=found[0],displayed=numbers.internalToPrinted(target.hex);
   const printedCandidate=numbers.printedToInternal(a.printed);
   report.push({rulebookPrintedHex:a.printed,sourceSvgId:a.sourceSvgId,marker:a.marker,physicalCellId:target.hex,
    renderedNumber:displayed,renderedNumberMatchesRulebook:displayed===a.printed,
    numberRegistryCellId:printedCandidate,numberRegistryMatchesSource:printedCandidate===target.hex});
  }
  if(report.length!==(spec.printedRearAnchors||[]).length)errors.push('Incomplete source anchor resolution');
  return {anchors:report,errors,disagreements:report.filter(a=>!a.renderedNumberMatchesRulebook)};
 }
 // Explicit caller inputs: allocation from independent source-face inventory,
 // placement keyed by each selected STARTING front face ID, and identity pools.
 function validate({map,spec,counterConfig,inventory,allocation,placements}={}){
  const {slots:all,errors}=slots(map,spec);
  let inspected=null,allocationReport=null;
  if(!inventory||typeof inventory.inspect!=='function'||typeof inventory.validateAllocation!=='function'||!counterConfig||!allocation){
   errors.push('Source-valid inventory, explicit allocation and placements required');
  }else{
   try{inspected=inventory.inspect(counterConfig);allocationReport=inventory.validateAllocation(counterConfig,allocation)}
   catch(e){errors.push('Invalid source inventory: '+e.message)}
   if(!inspected?.valid||!allocationReport?.valid)errors.push('Source-valid inventory and allocation required');
  }
  if(!placements)errors.push('Explicit starting placements required');
  const faces=counterConfig?.faces,pools=inspected?.pools;
  const byFace=new Map((faces?.front||[]).map(f=>[f.faceId,f]));
  const backs=new Map((faces?.back||[]).map(f=>[f.faceId,f]));
  const selected=new Map(),used=new Set();
  for(const [group,rule] of Object.entries(spec.groups)){
   const claimed=allocation?.[group];
   if(!Array.isArray(claimed)){errors.push('Missing starting group '+group);continue;}
   if(claimed.length!==rule.count)errors.push('Incorrect starting group count '+group);
   for(const id of claimed){
    if(typeof id!=='string'||!byFace.has(id)||!Array.isArray(pools?.[rule.pool])||!pools[rule.pool].includes(id)){
     errors.push('Unverified face for '+group+': '+id);continue;
    }
    if(used.has(id)){errors.push('Duplicate starting face '+id);continue;}
    used.add(id);selected.set(id,{group,...rule});
   }
  }
  if(selected.size!==spec.expectedStartingUnits)errors.push('Expected '+spec.expectedStartingUnits+' starting faces; found '+selected.size);
  if(!placements||typeof placements!=='object'||Array.isArray(placements))errors.push('Placements must be an explicit face-to-hex map');
  const assigned=placements&&typeof placements==='object'&&!Array.isArray(placements)?Object.entries(placements):[];
  if(assigned.length!==selected.size)errors.push('Every starting face must have exactly one placement');
  const positions=Object.fromEntries(Object.keys(all).map(k=>[k,new Map()]));
  const units={};
  for(const [id,target] of assigned){
   const rule=selected.get(id);
   if(!rule){errors.push('Non-starting or unknown face placed '+id);continue;}
   if(typeof target!=='string'||!hex.test(target)){errors.push('Malformed hex for '+id);continue;}
   const allowed=all[rule.marker].find(s=>s.hex===target);
   if(!allowed){errors.push('Wrong source marker for '+id+': '+target);continue;}
   if(rule.allowedHexes&&!rule.allowedHexes.includes(target))errors.push('Outside source-approved group region '+id+': '+target);
   if(!positions[rule.marker].has(target))positions[rule.marker].set(target,[]);
   positions[rule.marker].get(target).push(id);
   const face=byFace.get(id),reverse=backs.get(face.pairedFaceId);
   const trans=face.visualTranscription||{},backTrans=reverse?.visualTranscription||{};
   if(trans.printedAffiliation!==rule.printedAffiliation||!(rule.printedKinds?rule.printedKinds.includes(trans.kind):trans.kind===rule.printedKind)||
      !(rule.reverseBlank===true&&backTrans.printedAffiliation==='neutral'&&backTrans.kind==='blank')&&
      (backTrans.printedAffiliation!==rule.printedAffiliation||!(rule.printedKinds?rule.printedKinds.includes(backTrans.kind):backTrans.kind===rule.printedKind)))
    errors.push('Counter face/source group mismatch '+id);
   const printed=trans.printedValues||'';
   const strength=/^(\d+|\?)-(\d+)$/.exec(printed);
   if(!strength||!reverse||reverse.pairedFaceId!==id||!Number.isSafeInteger(Number(strength[2]))||Number(strength[2])<1){errors.push('Missing movement/paired counter face '+id);continue;}
   // Immutable-in-meaning starting-position lineage: movement changes `hex`,
   // never `openingHex`. This is recorded only for verified starting counters;
   // later reinforcements must not fabricate an opening position.
   units[id]={id,hex:target,openingHex:target,owner:rule.owner,class:rule.class,size:rule.size,mp:Number(strength[2]),
    nationality:rule.nationality||rule.owner,marker:false,sourceFaceId:id,reverseFaceId:reverse.faceId,
    historicalUnitId:null,strengthStatus:strength[1]==='?'?'untried':'printed-full',
    printedCombatStrength:strength[1]==='?'?null:Number(strength[1])};
  }
  for(const [kind,rule] of Object.entries(spec.markerSlots)){
   const got=all[kind].map(s=>(positions[kind].get(s.hex)||[]).length).sort((a,b)=>a-b);
   if(JSON.stringify(got)!==JSON.stringify([...rule.occupancy].sort((a,b)=>a-b)))errors.push('Occupancy distribution mismatch '+kind);
  }
  // A rule may prohibit adjacency across multiple deployment groups, even when
  // their marker types differ (e.g. front-line and fixed rear armies). Keep the
  // legacy single-group constraint, and validate every member of an explicit
  // cross-group set against every other member on the same physical hex grid.
  const separationSets=[...(spec.nonAdjacentGroups||[]).map(g=>[g]),...(spec.nonAdjacentGroupSets||[])];
  const cells=new Map(map.cells.map(c=>[c.id,c]));
  for(const groupSet of separationSets){
   if(!Array.isArray(groupSet)||!groupSet.length||new Set(groupSet).size!==groupSet.length||
      groupSet.some(g=>typeof g!=='string'||!own(spec.groups,g))){
    errors.push('Invalid non-adjacent group set');continue;
   }
   const members=[...selected.entries()].filter(([,g])=>groupSet.includes(g.group))
    .map(([id])=>({id,hex:placements?.[id]})).filter(m=>typeof m.hex==='string'&&cells.has(m.hex));
   for(let i=0;i<members.length;i++)for(let j=i+1;j<members.length;j++){
    const a=members[i],b=members[j],cell=cells.get(a.hex);
    if(T.DIRS.some(d=>T.neighbor(cell,d,map.geometry)===b.hex))
     errors.push('Forbidden adjacent group '+groupSet.join('+')+': '+a.hex+'/'+b.hex);
   }
  }
  const anchorAudit=printedAnchors(map,spec,all);errors.push(...anchorAudit.errors);
  const valid=errors.length===0;
  return Object.freeze({valid,errors,setupScope:'candidate-initial-placement-by-approved-runtime-hex-markers',
   physicalSetupValid:valid,printedAnchorAgreement:anchorAudit.disagreements.length===0,
   printedAnchorReport:anchorAudit.anchors,printedAnchorDisagreements:anchorAudit.disagreements,
   historicalSetupAuthorized:false,productionGameActivated:false,
   state:valid?copy({scenarioId:spec.scenarioId,units}):null,
   startingUnitCount:Object.keys(units).length,sourceMarkerCounts:Object.fromEntries(Object.entries(all).map(([k,v])=>[k,v.length]))});
 }
 return Object.freeze({slots,printedAnchors,validate});
});
