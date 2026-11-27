/* GENERATED. Do not edit. */
(function(root){"use strict";const r=root.__historicalBundle;if(!r||r.revision!=="49f007d5b01724bb6f07a2cbc35da4d2278b62acdce0eafda9082ae54e63c68f")throw Error("Historical bundle version mismatch");const defs=r.definitions,parts=r.parts;
defs["core/historical_buildup_phase.js"]=function(module,exports,require,Buffer){
/* Source-configured historical buildup transactions, checkpoint 154.
 * The policy and an EXPLICIT counter-face allocation supply all historical
 * identities; no scenario-ID branches and no inferred counter assignment.
 * Candidate setup is not independent historical source certification.
 */
'use strict';
const Binding=require('./movement_binding');
const Fixed=require('./historical_fixed_source_pieces');
const NavalLogistics=require('./historical_naval_logistics');
const Stack=require('./movement_rules');
const CompositeBorder=require('./composite_entry_border_reconciliation');
const CompositeBorderEvidence=require('../maps/movement-configs/odessa-entry-border-geometry-v527.json');
const copy=x=>JSON.parse(JSON.stringify(x));
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
const dual=/^(\d+)[·.\-](\d+)[·.\-](\d+)$/;
const num=/^(\d+)-(\d+)$/, triple=/^(\d+)·(\d+)[·-](\d+)$/;
// Preserve the nationality printed on a photographed counter, even when its
// controlling PLAYER is the Axis. This matters for national stacking rules.
function sourceNationality(face,declared=null){
 const printed=face?.visualTranscription?.printedAffiliation;
 if(typeof printed!=='string'||!printed)throw Error('Missing counter nationality source');
 const nationality=printed==='axis'?'german':printed;
 if(declared!==null&&declared!==undefined&&declared!==nationality)
  throw Error('Reinforcement nationality disagrees with counter source');
 return nationality;
}

// A separately listed replacement reserve is neither an opening counter nor a
// scheduled reinforcement. Only its declared face may enter via replacement.
// Pure national-stacking predicate used by reinforcement/replacement placement.
// A shared scenario profile decides the prohibited combinations; no game IDs.
function allowedNationalStack(profile,nationality,occupants){
 if(typeof nationality!=='string'||!nationality||!Array.isArray(occupants))
  throw Error('Invalid nationality stacking source');
 return Stack.nationalStackLegal(profile,[{nationality},...occupants]);
}

function replacementReserveEligible(unitId,turn,deployedIds,policy,allocation){
 const group=policy?.replacementOnlyReserveGroup,first=policy?.replacementOnlyEarliestTurn;
 return typeof group==='string'&&Array.isArray(allocation?.[group])&&
  Number.isInteger(first)&&turn>=first&&
  Array.isArray(deployedIds)&&!deployedIds.includes(unitId)&&allocation[group].includes(unitId);
}
function create({map,profile,config,counterConfig,policy,allocation,fixedPolicy=null,combatPolicy=null}){
 if(!obj(policy)||policy.schemaVersion!==1||policy.scenarioId!==config?.scenarioId||
    profile?.id!==config?.scenarioId||map?.sourceGame!==policy.sourceGame||
    !(counterConfig?.mapId===config?.scenarioId||
      (policy.entryBoundarySource==='active-composite-exterior-v533'&&counterConfig?.mapId===map?.id))||!obj(allocation)||
    !obj(policy.printedAffiliationToOwner)||
    !obj(policy.replacementSteps)||!Array.isArray(policy.reinforcements)||
    !obj(policy.entryEdge)||!obj(policy.initialCityControl)||!Array.isArray(map.cells))
  throw Error('Source-bound buildup policy and face allocation required');
 const fronts=new Map((counterConfig?.faces?.front||[]).map(f=>[f.faceId,f]));
 const backs=new Map((counterConfig?.faces?.back||[]).map(f=>[f.faceId,f]));
 if(!fronts.size||!backs.size||fronts.size!==counterConfig.faces.front.length||backs.size!==counterConfig.faces.back.length)
  throw Error('Unverified or duplicate counter faces');
 const fixedPieces=fixedPolicy?Fixed.initialize({map,counterConfig,policy:fixedPolicy}).state.units:{};
 const navalLogistics=policy.navalReplacementPolicy?NavalLogistics.create({map,combatPolicy,counterConfig,sourcePolicy:policy.navalReplacementPolicy}):null;
 const slots=new Map(),faceSlots=new Map();
 const supportArrivals=[];
 if(!Array.isArray(policy.supportArrivals))throw Error('Explicit source support-arrival track required');
 for(const e of policy.supportArrivals){
  const f=fronts.get(e.faceId),back=backs.get(f?.pairedFaceId),t=f?.visualTranscription||{},bt=back?.visualTranscription||{};
  // Original Odessa Rom I AK art is a source-transcribed 'air-marker', not
  // the generic photographed 'air-support' counter format. Its REFIT back and
  // first-use turn must agree with the combat policy; never invent a rating.
  const sourceNotation=e.sourceNotationMode==='romanian-refit-v1'&&
   t.kind==='air-marker'&&bt.kind==='air-marker'&&
   t.printedAffiliation==='romanian'&&bt.printedAffiliation==='romanian'&&
   t.visibleNotation?.includes(e.printedIdentifier)&&
   t.visibleNotation?.includes(String(e.shiftRating))&&
   bt.visibleNotation?.includes(e.printedIdentifier)&&bt.visibleNotation?.includes('REFIT')&&
   combatPolicy?.airSupport?.markers?.some(m=>m.faceId===e.faceId&&
    m.firstTurn===e.turn&&m.shiftRating===e.shiftRating&&m.refitFaceId===back?.faceId);
  const ordinary=e.sourceNotationMode===undefined&&t.kind==='air-support'&&
   t.printedIdentifier===e.printedIdentifier&&t.printedAffiliation==='axis'&&
   bt.printedIdentifier===t.printedIdentifier&&bt.kind==='air-support'&&
   t.printedValues===e.shiftRating+' / arrow'&&bt.printedValues===t.printedValues;
  if(!obj(e)||typeof e.slotId!=='string'||!integer(e.turn,1,config.turns)||
     !config.players.includes(e.owner)||supportArrivals.some(x=>x.slotId===e.slotId||x.faceId===e.faceId)||
     !f||!back||back.pairedFaceId!==e.faceId||(!ordinary&&!sourceNotation)||
     policy.printedAffiliationToOwner[t.printedAffiliation]!==e.owner)
   throw Error('Unverified special support reinforcement marker');
  supportArrivals.push({...e});
 }

 if(policy.replacementOnlyReserveGroup!==undefined&&policy.replacementOnlyReserveGroup!==null&&
   (typeof policy.replacementOnlyReserveGroup!=='string'||!Array.isArray(allocation[policy.replacementOnlyReserveGroup])||
    !allocation[policy.replacementOnlyReserveGroup].length||!integer(policy.replacementOnlyEarliestTurn,1,config.turns)||
    !['corps','army'].includes(policy.replacementReserveGroups?.[policy.replacementOnlyReserveGroup]?.size)||
    !policy.replacementReserveGroups[policy.replacementOnlyReserveGroup].class||
    policy.initialGroups?.[policy.replacementOnlyReserveGroup]||
    policy.reinforcements.some(r=>r.group===policy.replacementOnlyReserveGroup)))
  throw Error('Invalid replacement-only source reserve group or admission turn');
 const selected=new Set();
 // Some source expansions assign stable, readable namespaced runtime IDs to
 // photographed counters. Bind each one explicitly to ONE original front face.
 // Other scenarios retain their ordinary faceId=runtimeId identity.
 const aliases=policy.startingUnitAliases||{};
 if(!obj(aliases))throw Error('Invalid source runtime alias ledger');
 const aliasesByFace=new Map();
 for(const [runtime,faceId] of Object.entries(aliases)){
  const front=fronts.get(faceId),back=backs.get(front?.pairedFaceId);
  if(typeof runtime!=='string'||!runtime||runtime===faceId||
     typeof faceId!=='string'||!front||!back||back.pairedFaceId!==faceId||
     aliasesByFace.has(faceId)||front.visualTranscription?.kind==='air-marker'||
     !(policy.printedAffiliationToOwner[front.visualTranscription?.printedAffiliation]||
       (front.visualTranscription?.kind==='blank'&&back.visualTranscription?.kind==='cavalry'&&
        policy.printedAffiliationToOwner[back.visualTranscription?.printedAffiliation])))
   throw Error('Unverified initial source runtime face alias');
  aliasesByFace.set(faceId,runtime);
 }
 const sourceFace=id=>aliases[id]||id;
 for(const group of Object.values(allocation)){
  if(!Array.isArray(group))throw Error('Malformed source face allocation');
  for(const faceId of group){
   if(typeof faceId!=='string'||!fronts.has(faceId)||selected.has(faceId))throw Error('Missing or duplicate allocated counter face');
   selected.add(faceId);
  }
 }
 // Optional source-bound exception for a counter that can never be rebuilt.
 // A concealed front may show only "?": the specific printed formation must
 // be verified against its paired revealed BACK face (e.g. Kiev 4th Mech).
 const replacementExcluded=new Set();
 if(policy.replacementExcludedFaces!==undefined){
  if(!Array.isArray(policy.replacementExcludedFaces))throw Error('Invalid source replacement exclusion list');
  for(const e of policy.replacementExcludedFaces){
   const front=fronts.get(e?.faceId),back=backs.get(front?.pairedFaceId);
   const ft=front?.visualTranscription,bt=back?.visualTranscription;
   if(!e||typeof e.faceId!=='string'||replacementExcluded.has(e.faceId)||
      typeof e.ruleSource!=='string'||!e.ruleSource||
      typeof e.revealedIdentifier!=='string'||!e.revealedIdentifier||
      typeof e.kind!=='string'||!e.kind||!config.players.includes(e.owner)||!selected.has(e.faceId)||
      !back||back.pairedFaceId!==e.faceId||
      ft?.kind!==e.kind||policy.printedAffiliationToOwner[ft.printedAffiliation]!==e.owner||
      bt?.kind!==e.kind||bt.printedAffiliation!==ft.printedAffiliation||
      bt.printedIdentifier!==e.revealedIdentifier||
      !/^\d+(?:·\d+)?[·-]\d+$/.test(bt.printedValues||''))
    throw Error('Replacement exclusion lacks exact printed source-face identity');
   replacementExcluded.add(e.faceId);
  }
 }
 for(const entry of policy.reinforcements){
  if(!obj(entry)||typeof entry.slotId!=='string'||slots.has(entry.slotId)||
     !integer(entry.turn,1,config.turns)||!config.players.includes(entry.owner)||
     !['ground','air-support'].includes(entry.kind)||!Array.isArray(allocation[entry.group])||
     !integer(entry.index,0,allocation[entry.group].length-1))throw Error('Invalid source reinforcement slot');
  const faceId=allocation[entry.group][entry.index],f=fronts.get(faceId);
  if(faceSlots.has(faceId))throw Error('Counter face allocated to multiple reinforcement slots');
  const t=f?.visualTranscription||{}, b=backs.get(f?.pairedFaceId), bt=b?.visualTranscription||{};
  if(!b||b.pairedFaceId!==faceId||
     (entry.nationality!==undefined&&entry.nationality!==sourceNationality(f))||
     policy.printedAffiliationToOwner[t.printedAffiliation]!==entry.owner||
     t.printedAffiliation!==entry.printedAffiliation||
     !(entry.printedKinds?Array.isArray(entry.printedKinds)&&entry.printedKinds.includes(t.kind):t.kind===entry.printedKind)||!t.printedValues||
     (entry.printedValues&&t.printedValues!==entry.printedValues)||
     !['full','reduced','support'].includes(entry.strength)||
     (entry.kind==='ground'&&entry.strength==='support')||
     (entry.kind==='air-support'&&entry.strength!=='support')||
     (entry.kind==='air-support'&&t.kind!=='air-support')||
     (entry.kind==='ground'&&!['edge','named-city'].includes(entry.placement)))
   throw Error('Reinforcement slot lacks matching source counter face');
  if(entry.kind==='ground'){
   const full=num.exec(t.printedValues)||triple.exec(t.printedValues);
   const reduced=num.exec(bt.printedValues||'')||triple.exec(bt.printedValues||'');
   const concealed=/^\?-(\d+)$/.exec(t.printedValues||'');
   const revealed=triple.exec(bt.printedValues||'');
   const ordinary=full&&reduced&&bt.printedAffiliation===t.printedAffiliation&&bt.kind===t.kind&&
    bt.printedIdentifier===t.printedIdentifier&&+full[1]>=1&&+full[full.length-1]>=1&&
    +reduced[reduced.length-1]===+full[full.length-1]&&+reduced[1]>=1&&+reduced[1]<+full[1]&&
    (full.length!==4||reduced.length===4);
   const hidden=concealed&&revealed&&t.kind==='mechanized'&&entry.class==='mechanized'&&
    entry.strength==='full'&&bt.printedAffiliation===t.printedAffiliation&&bt.kind===t.kind&&
    +revealed[3]===+concealed[1];
   if(!ordinary&&!hidden)
    throw Error('Reinforcement counter face pairing or strength invalid');
   if(!entry.class||!['corps','army'].includes(entry.size))throw Error('Reinforcement class/size missing');
  }
  slots.set(entry.slotId,{...entry,faceId,nationality:sourceNationality(f,entry.nationality)});faceSlots.set(faceId,entry.slotId);
 }
 for(const owner of config.players){
  const amounts=policy.replacementSteps[owner];
  if(!Array.isArray(amounts)||amounts.length!==config.turns||amounts.some(n=>!integer(n,0,9)))
   throw Error('Missing source turn-track replacement allowances');
  if(!['german','soviet'].includes(owner)||!Array.isArray(policy.entryEdge[owner])||
     !policy.entryEdge[owner].length)throw Error('Source boundary for player missing');
 }
 const cityByHex=new Map(map.cells.filter(c=>c.city?.name).map(c=>[c.id,c.city.name]));
 const cityByName=new Map([...cityByHex].map(([hex,name])=>[name,hex]));
 if(cityByHex.size!==cityByName.size)throw Error('Duplicate city names');
 if(Object.keys(policy.initialCityControl).some(name=>!cityByName.has(name)))throw Error('Initial city ownership references unknown city');
 const cityNames=[...cityByName.keys()];
 if(cityNames.some(name=>!config.players.includes(policy.initialCityControl[name])))
  throw Error('Missing explicit initial city ownership');
 const allCells=new Map(map.cells.map(c=>[c.id,c]));
 const board=Binding.build(map,profile).board;
 const neighbors=new Map();
 for(const edge of board.edges){
  if(!edge.verified||edge.impassable||edge.allSea||edge.lake)continue;
  for(const [from,to] of [[edge.a,edge.b],[edge.b,edge.a]]){
   if(!neighbors.has(from))neighbors.set(from,[]);neighbors.get(from).push(to);
  }
 }
 const boundaries={};
 const compositeMode=policy.entryBoundarySource==='active-composite-exterior-v533';
 let compositeSides=null;
 if(compositeMode){
  if(policy.entryBoundarySourceSvgSha256!==map.authoritativeSourceGeometry?.sha256||
     profile.mapBinding!=='source-pinned-261-hex-experimental-graph'||
     profile.executableStatus!=='explicit-experimental-play-v531-not-historically-certified')
   throw Error('Experimental composite Buildup boundary scope/source mismatch');
  const audited=CompositeBorder.reconcile(map,CompositeBorderEvidence);
  if(audited.certifiedForReinforcements!==false||
     audited.activePaths.soviet.exterior.length!==32||
     audited.activePaths.german.exterior.length!==50)
   throw Error('Unverified experimental composite border');
  compositeSides=audited.activePaths;
 }else if(policy.entryBoundarySource!==undefined)throw Error('Unrecognized buildup border source');
 for(const owner of config.players){
  const declared=policy.entryEdge[owner],set=new Set(declared);
  if(set.size!==declared.length||declared.some(hex=>!allCells.has(hex)||allCells.get(hex).terrain==='sea'))
   throw Error('Invalid source edge hex declaration');
  const graphic=compositeMode?compositeSides[owner].exterior:
   map.entryBoundarySelections?.paths?.find(p=>p.side===owner)?.edges||[];
  const actual=new Set(graphic.map(e=>e.cellId||e.hex));
  if(actual.size!==set.size||[...set].some(hex=>!actual.has(hex)))
   throw Error('Buildup edge cells disagree with authoritative SVG border');
  boundaries[owner]=set;
 }
 function adjacent(from){return neighbors.get(from)||[];}
 function ezoc(hex,owner,units){return Stack.enemyZOC({board,profile,units},hex,owner);}
 function enemy(hex,owner,units){return Object.values(units).some(u=>u.owner!==owner&&u.hex===hex);}
 function stack(hex,owner,size,units,nationality=owner){
  const there=Object.values(units).filter(u=>u.hex===hex);
  return there.every(u=>u.owner===owner)&&allowedNationalStack(profile,nationality,there)&&there.length<profile.maxStack&&
    (size!=='army'||there.filter(u=>u.size==='army').length<(profile.sovietArmyMax||1))&&
    (owner!=='soviet'||size!=='army'||there.every(u=>u.size!=='army'))&&
    (owner!=='soviet'||there.filter(u=>u.size==='army').length+(size==='army'?1:0)<=profile.sovietArmyMax);
 }
 function communicated(hex,owner,units){
  if(boundaries[owner].has(hex))return true; // Origin is exempt from EZOC restrictions.
  const seen=new Set([hex]),todo=[hex];
  for(let i=0;i<todo.length;i++)for(const to of adjacent(todo[i])){
   if(seen.has(to)||enemy(to,owner,units)||ezoc(to,owner,units))continue;
   if(boundaries[owner].has(to))return true;
   seen.add(to);todo.push(to);
  }
  return false;
 }
 // Batch version of the same communication predicate. Compute reachable
 // safe cells from the entry edge once per side and immutable input board.
 // An origin is exempt from restrictions, but subsequent cells are not.
 // No cache is retained across states or calls.
 function communicationIndex(owner,units){
  const occupied=new Set(),zocOrigins=new Set();
  for(const u of Object.values(units))if(u.owner!==owner){
   occupied.add(u.hex);
   if(u.marker!==true&&u.strengthStatus!=='eliminated'&&u.hex&&board.cells[u.hex]?.verified)zocOrigins.add(u.hex);
  }
  const blocked=new Set(occupied),through=profile.zocAcrossImpassableHexsides===true;
  for(const e of board.edges){
   if(!e.verified||e.allSea||(!through&&(e.lake||e.impassable)))continue;
   if(zocOrigins.has(e.a)&&board.cells[e.b]?.verified)blocked.add(e.b);
   if(zocOrigins.has(e.b)&&board.cells[e.a]?.verified)blocked.add(e.a);
  }
  const todo=[...boundaries[owner]].filter(h=>!blocked.has(h)),safe=new Set(todo);
  for(let i=0;i<todo.length;i++)for(const h of adjacent(todo[i]))if(!blocked.has(h)&&!safe.has(h)){safe.add(h);todo.push(h);}
  return hex=>boundaries[owner].has(hex)||safe.has(hex)||adjacent(hex).some(h=>safe.has(h));
 }
 function initialize(state){
  const next=copy(state);
  if(next.buildupDeployedIds!==undefined||
     (next.cityControl!==undefined&&policy.acceptPreinitializedCityControl!==true))
   throw Error('Historical buildup initialization must occur once at opening');
  if(next.cityControl!==undefined){
   if(JSON.stringify(Object.entries(next.cityControl).sort())!==
      JSON.stringify(Object.entries(policy.initialCityControl).sort()))
    throw Error('Preinitialized city control disagrees with source city ledger');
  }else next.cityControl=copy(policy.initialCityControl);
  next.buildupDeployedIds=Object.keys(next.units).sort();
  const startingFaces=new Set();
  // A runtime alias must match the photographed source front AND its paired
  // back; unverified duplicate fronts and renamed unrelated pieces are barred.
  for(const [id,u] of Object.entries(next.units)){
   const face=sourceFace(id),front=fronts.get(face);
   const paired=backs.get(front?.pairedFaceId);
   const printed=front?.visualTranscription?.kind==='blank'?
    (paired?.visualTranscription?.kind==='cavalry'&&u.activeFaceId===paired.faceId?
     paired.visualTranscription.printedAffiliation:null):
    front?.visualTranscription?.printedAffiliation;
   const correct=selected.has(face)&&u.sourceFaceId===face&&
     u.reverseFaceId===front?.pairedFaceId&&!startingFaces.has(face)&&
     policy.printedAffiliationToOwner[printed]===u.owner;
   const fixed=fixedPieces[id]&&Object.keys(fixedPieces[id]).length===Object.keys(u).length&&
     Object.keys(fixedPieces[id]).every(k=>JSON.stringify(fixedPieces[id][k])===JSON.stringify(u[k]));
   if(!correct&&!fixed)
    throw Error('Initial ground-unit face absent from bound allocation or validated fixed-piece policy: '+id);
   startingFaces.add(face);
  }
  if(Object.keys(aliases).some(runtime=>!next.units[runtime]))
   throw Error('Source runtime alias not present in initial ground units');
  return next;
 }
 function checkState(state){
  if(!obj(state)||!obj(state.units)||!obj(state.cityControl)||
     !Array.isArray(state.buildupDeployedIds)||new Set(state.buildupDeployedIds).size!==state.buildupDeployedIds.length||
     cityNames.some(n=>!config.players.includes(state.cityControl[n])))
   throw Error('Historical buildup state not initialized');
 }
 function recordControl(state,actor,path){
  checkState(state);
  if(!config.players.includes(actor)||!Array.isArray(path)||path.some(hex=>!allCells.has(hex)))
   throw Error('Invalid city-control passage');
  for(const hex of path){const city=cityByHex.get(hex);if(city)state.cityControl[city]=actor;}
 }
 function openingPhase(){return {placedSlotIds:[],spent:0,rebuiltUnitIds:[],replacedMechanized:0};}
 function due(cursor,owner){return [...slots.values()].filter(s=>s.turn===cursor.turn&&s.owner===owner);}
 function validatePhase(cursor,owner,phase){
  if(!obj(cursor)||!integer(cursor.turn,1,config.turns)||!obj(phase)||
     !Array.isArray(phase.placedSlotIds)||!Array.isArray(phase.rebuiltUnitIds)||
     !integer(phase.spent,0,9)||!integer(phase.replacedMechanized,0,9))
   throw Error('Malformed buildup phase transaction');
  const limit=policy.replacementSteps[owner][cursor.turn-1];
  if(phase.spent>limit)throw Error('Buildup replacement allowance exceeded');
 }
 function place({state,cursor,actor,phase,slotId,hex}){
  checkState(state);validatePhase(cursor,actor,phase);
  const slot=slots.get(slotId);
  if(!slot||slot.turn!==cursor.turn||slot.owner!==actor||slot.kind!=='ground')
   throw Error('Reinforcement is not due as a ground unit in this phase');
  if(phase.placedSlotIds.includes(slotId)||state.units[slot.faceId]||state.buildupDeployedIds.includes(slot.faceId))
   throw Error('Reinforcement already admitted');
  if(typeof hex!=='string'||!allCells.has(hex)||allCells.get(hex).terrain==='sea')throw Error('Unknown reinforcement hex');
  if(slot.placement==='named-city'){
   if(cityByHex.get(hex)!==slot.city||enemy(hex,actor,state.units))
    throw Error('Special city reinforcement blocked or misplaced');
   if(!stack(hex,actor,slot.size,state.units,slot.nationality))throw Error('Reinforcement overstacked');
  }else if(!boundaries[actor].has(hex)||enemy(hex,actor,state.units)||ezoc(hex,actor,state.units)||
    !stack(hex,actor,slot.size,state.units,slot.nationality))throw Error('Illegal reinforcement edge, enemy ZOC, or stacking');
  const country=Stack.territorialAccess({board,profile,territory:state.territory},
   {hex,nationality:slot.nationality,sourceFaceId:slot.faceId},hex,'movement',hex);
  if(!country.ok)throw Error('Reinforcement territory: '+country.reason);
  const next=copy(state),f=fronts.get(slot.faceId),b=backs.get(f.pairedFaceId);
  const full=num.exec(f.visualTranscription.printedValues)||triple.exec(f.visualTranscription.printedValues);
  const reduced=num.exec(b.visualTranscription.printedValues)||triple.exec(b.visualTranscription.printedValues);
  const concealed=/^\?-(\d+)$/.exec(f.visualTranscription.printedValues||'');
  const useReduced=slot.strength==='reduced';
  if(concealed&&useReduced)throw Error('Concealed one-step unit cannot enter as reduced regular infantry');
  next.units[slot.faceId]={id:slot.faceId,hex,owner:actor,class:slot.class,size:slot.size,
   mp:Number(concealed?concealed[1]:full[full.length-1]),nationality:slot.nationality,marker:false,sourceFaceId:slot.faceId,
   reverseFaceId:b.faceId,historicalUnitId:null,
   strengthStatus:concealed?'untried':useReduced?'printed-reduced':'printed-full',
   printedCombatStrength:concealed?null:Number(useReduced?reduced[1]:full[1])};
  if(useReduced)next.units[slot.faceId].activeFaceId=b.faceId;
  next.buildupDeployedIds.push(slot.faceId);recordControl(next,actor,[hex]);
  return {state:next,phase:{...phase,placedSlotIds:[...phase.placedSlotIds,slotId]},
   event:{kind:'reinforcement-placed',slotId,faceId:slot.faceId,hex,initialStrength:slot.strength}};
 }
 // A naval evacuee returns as a REGULAR reinforcement: exact same source-
 // certified entry edges, enemy occupancy, ZOC and national stacking checks
 // used for the normal edge-based ground reinforcement above. There is no
 // special Fleet placement or bonus replacement step.
 function placeEvacuated({state,cursor,actor,phase,unitId,hex}){
  checkState(state);validatePhase(cursor,actor,phase);
  if(!navalLogistics||actor!=='soviet'||!phase||!state.buildupDeployedIds.includes(unitId)||!selected.has(sourceFace(unitId)))
   throw Error('No source-qualified Soviet naval reinforcement reserve');
  const record=state.evacuatedNavalUnits?.[unitId];
  if(!record||!record.unit||record.unit.sourceFaceId!==sourceFace(unitId)||record.unit.id!==unitId||
     !fronts.has(sourceFace(unitId)))
   throw Error('Naval return lacks original deployed source face');
  const result=navalLogistics.returnAsReinforcement({state,actor,unitId,hex,turn:cursor.turn,
   validateRegularEntry:({state:candidate,unit,hex:destination})=>
    typeof destination==='string'&&allCells.has(destination)&&
    allCells.get(destination).terrain!=='sea'&&boundaries[actor].has(destination)&&
    !enemy(destination,actor,candidate.units)&&!ezoc(destination,actor,candidate.units)&&
    stack(destination,actor,unit.size,candidate.units,unit.nationality)});
  recordControl(result.state,actor,[hex]);
  return {state:result.state,phase:copy(phase),event:result.event};
 }
 function canReceiveNavalTransport({state,unit,hex}){
  checkState(state);
  return Boolean(unit&&unit.owner==='soviet'&&unit.marker!==true&&
   typeof hex==='string'&&allCells.has(hex)&&allCells.get(hex).terrain!=='sea'&&
   cityByHex.has(hex)&&state.cityControl[cityByHex.get(hex)]==='soviet'&&
   !enemy(hex,'soviet',state.units)&&stack(hex,'soviet',unit.size,state.units,unit.nationality));
 }
 function replace({state,cursor,actor,phase,unitId,hex=null}){
  checkState(state);validatePhase(cursor,actor,phase);
  if(Object.hasOwn(state.evacuatedNavalUnits||{},unitId))
   throw Error('Evacuated survivor must return as a regular reinforcement before replacement');
  if(replacementExcluded.has(sourceFace(unitId)))throw Error('Source-excluded unit cannot receive replacements');
  if(phase.spent>=policy.replacementSteps[actor][cursor.turn-1])throw Error('No replacement steps remain');
  const wasDeployed=state.buildupDeployedIds.includes(unitId);
  const canEnterReserve=replacementReserveEligible(unitId,cursor.turn,state.buildupDeployedIds,policy,allocation);
  if(!selected.has(sourceFace(unitId))||!(wasDeployed||canEnterReserve))
   throw Error('Cannot rebuild a unit that has not entered play or is not a due replacement reserve');
  const front=fronts.get(sourceFace(unitId)),back=backs.get(front.pairedFaceId),ft=front.visualTranscription||{},bt=back?.visualTranscription||{};
  if(!back||bt.printedAffiliation!==ft.printedAffiliation||
     policy.printedAffiliationToOwner[ft.printedAffiliation]!==actor)
   throw Error('Replacement counter face ownership/provenance mismatch');
  const full=num.exec(ft.printedValues||'')||(ft.kind==='infantry'?dual:triple).exec(ft.printedValues||'');
  const reduced=num.exec(bt.printedValues||'')||(bt.kind==='infantry'?dual:triple).exec(bt.printedValues||'');
  const untried=/^\?-(\d+)$/.exec(ft.printedValues||'');
  const revealed=triple.exec(bt.printedValues||'');
  if((!full||!reduced)&&!(untried&&revealed))
   throw Error('This counter is not eligible for step replacement');
  const isMilitia=unitId===allocation[policy.specialMilitiaGroup]?.[0];
  const current=state.units[unitId];
  if(current&&!wasDeployed)throw Error('Unadmitted source reserve cannot already be on the map');
  const next=copy(state),nextPhase={...phase,spent:phase.spent+1};
  if(current){
   if(hex!==null||current.owner!==actor||current.strengthStatus!=='printed-reduced'||
      current.activeFaceId!==back.faceId||current.printedCombatStrength!==+reduced[1]||
      current.sourceFaceId!==sourceFace(unitId)||current.reverseFaceId!==back.faceId)
    throw Error('Only a reduced friendly on-map unit may be restored');
   if(phase.rebuiltUnitIds.includes(unitId))throw Error('Cannot rebuild and restore the same unit in one buildup');
   if(!isMilitia&&!communicated(current.hex,actor,state.units)&&
      !navalLogistics?.replacementException({state,unitId,actor}))
    throw Error('Replacement target not in communication or source-qualified Fleet port');
   next.units[unitId].strengthStatus='printed-full';next.units[unitId].printedCombatStrength=+full[1];
   delete next.units[unitId].activeFaceId;
  }else{
   if(typeof hex!=='string'||!allCells.has(hex)||allCells.get(hex).terrain==='sea')
    throw Error('Replacement requires a certified placement hex');
   if(isMilitia){
    if(cityByHex.get(hex)!==policy.specialMilitiaCity||enemy(hex,actor,state.units))
     throw Error('Workers militia replacement must be in unoccupied Leningrad');
   }else{
    const city=cityByHex.get(hex);
    const legalEdge=boundaries[actor].has(hex),legalCity=Boolean(city&&state.cityControl[city]===actor&&communicated(hex,actor,state.units));
    if(!(legalEdge||legalCity)||enemy(hex,actor,state.units)||ezoc(hex,actor,state.units))
     throw Error('Replacement placement needs safe friendly edge or communicating controlled city');
   }
   const reference=policy.reinforcements.find(s=>allocation[s.group]?.[s.index]===unitId);
   // Initial units may also be rebuilt: identify their class/size from setup policies.
   const groupName=Object.keys(allocation).find(k=>allocation[k].includes(sourceFace(unitId)));
   const groupInfo=policy.initialGroups?.[groupName]||policy.replacementReserveGroups?.[groupName];
   const size=reference?.size||groupInfo?.size,unitClass=reference?.class||groupInfo?.class;
   if(!size||!unitClass)throw Error('No verified unit class and size for replacement');
   const identity=profile.territorialPolicy?.restrictedSourceUnits.find(x=>x.sourceFaceIds.includes(sourceFace(unitId)));
   // Re-entry is placement, not travel: validate destination as both endpoints.
   const country=Stack.territorialAccess({board,profile,territory:state.territory},
    {hex,nationality:sourceNationality(front),sourceFaceId:sourceFace(unitId)},hex,'movement',hex);
   if(!country.ok)throw Error('Replacement territory: '+country.reason);
   if(!stack(hex,actor,size,state.units,sourceNationality(front)))throw Error('Replacement placement would overstack');
   if(actor==='soviet'&&unitClass==='mechanized'&&phase.replacedMechanized>=1)
    throw Error('Only one Soviet Mechanized Corps may be rebuilt per turn');
   const mechOneStep=Boolean(untried&&revealed);
   next.units[unitId]={id:unitId,hex,owner:actor,class:unitClass,size,
    mp:mechOneStep?+untried[1]:+full[full.length-1],nationality:sourceNationality(front),marker:false,sourceFaceId:sourceFace(unitId),
    reverseFaceId:back.faceId,historicalUnitId:null,
    strengthStatus:mechOneStep?'revealed-one-step':'printed-reduced',
    printedCombatStrength:mechOneStep?null:+reduced[1],activeFaceId:back.faceId};
   if(identity)next.units[unitId].sourceIdentityKey=identity.sourceIdentityKey;
   if(mechOneStep){next.units[unitId].revealedAttackStrength=+revealed[1];next.units[unitId].revealedDefenseStrength=+revealed[2];}
   if(!wasDeployed)next.buildupDeployedIds.push(unitId);
   nextPhase.rebuiltUnitIds=[...phase.rebuiltUnitIds,unitId];
   if(actor==='soviet'&&unitClass==='mechanized')nextPhase.replacedMechanized++;
   recordControl(next,actor,[hex]);
  }
  return {state:next,phase:nextPhase,event:{kind:current?'replacement-restored':'replacement-rebuilt',unitId,hex:current?.hex||hex,stepsSpent:1}};
 }
 function close({state,cursor,actor,phase}){
  checkState(state);validatePhase(cursor,actor,phase);
  const lost=due(cursor,actor).filter(s=>s.kind==='ground'&&!phase.placedSlotIds.includes(s.slotId)).map(s=>s.slotId);
  const support=supportArrivals.filter(s=>s.owner===actor&&s.turn===cursor.turn).map(s=>s.slotId);
  return {state:copy(state),event:{kind:'buildup-finished',turn:cursor.turn,actor,
   lostGroundSlotIds:lost,supportArrivals:support,forfeitedReplacementSteps:policy.replacementSteps[actor][cursor.turn-1]-phase.spent}};
 }
 return Object.freeze({initialize,recordControl,openingPhase,place,placeEvacuated,canReceiveNavalTransport,replace,close,communicated,communicationIndex,
  metadata:{source:policy.source,slots:slots.size,sourceIdentityStatus:'explicit-candidate-counter-allocation'}});
}
module.exports=Object.freeze({create,sourceNationality,replacementReserveEligible,allowedNationalStack});

};
defs["core/historical_campaign_action_catalog.js"]=function(module,exports,require,Buffer){
/* Shared historical campaign legal-action discovery (v393).
 * Read-only, bounded API for human/AI controllers. Every concrete action is
 * validated by the authoritative campaign transaction; no alternate rules
 * engine, scenario-ID branch, random die, or result-dependent guess is used.
 * Combat declarations are exposed as individually legal PROPOSALS because
 * the player must commit a coherent collection before rolling any battle.
 */
'use strict';
const Binding=require('./movement_binding');
const Retreat=require('./historical_forced_retreat');
const Consequences=require('./historical_combat_consequences');
const Geography=require('./historical_combat_geography');
const Ports=require('./historical_port_support');
const Rules=require('./movement_rules');
const {clone,object:obj}=require('./historical_campaign_json');
function discover({session,context,enumerateCombinedPlans=true}){
 if(typeof enumerateCombinedPlans!=='boolean')throw Error('Invalid combined-plan enumeration policy');
 if(!session||typeof session.snapshot!=='function'||typeof session.execute!=='function'||
    !obj(context)||!obj(context.config)||!obj(context.map)||!obj(context.profile))
  throw Error('Source-bound session and historical campaign context required');
 const s=session.snapshot();
 if(s.cursor?.scenarioId!==context.config.scenarioId||s.state?.scenarioId!==context.config.scenarioId)
  throw Error('Action catalog scenario mismatch');
 const commands=[],proposals=[],plans=[],expandedPlans=[],prompts=[];
 const limits={maxPlans:128,maxThreeBattlePlans:128,maxThreeBattleSearch:25000,
  maxCombatProposals:4096,maxCombatSearch:25000,maxSearchStatesPerUnit:50000};
 const trial=(a)=>typeof session.canExecute==='function'?session.canExecute(a):
  (()=>{try{session.execute(a);return true;}catch(_){return false;}})();
 const add=(a)=>{if(!trial(a))return false;commands.push(a);return true;};
 const combat=a=>({type:'combat',action:a});
 const diePrompt=(type,extra={})=>prompts.push({kind:'die-and-choice',type,min:1,max:6,...extra});
 if(s.cursor.complete)return {phaseId:null,phaseKind:null,commands,proposals,prompts,complete:true};
 if(!s.phaseSupported)return {phaseId:s.phaseId,phaseKind:s.phaseKind,commands,proposals,prompts,blocked:'phase-not-supported'};
 if(s.stackingCleanup){
  const penalty=Rules.stackPenalty(context.profile,s.state.units,s.actor);
  if(penalty.excess)for(const unitId of penalty.choices)add({type:'remove-overstack-unit',unitId});
  else add({type:'finish-phase'});
  return clone({phaseId:s.phaseId,phaseKind:s.phaseKind,actor:s.actor,turn:s.cursor.turn,commands,proposals,plans,expandedPlans,prompts,complete:false,stackingCleanup:true,stackPenalty:penalty.excess});
 }
 if(s.phaseKind==='housekeeping')add({type:'finish-housekeeping'});
 if(s.phaseKind==='buildup'){
  add({type:'finish-buildup'});
  const policy=context.buildupPolicy;
  if(policy&&Array.isArray(policy.reinforcements)){
   for(const r of policy.reinforcements.filter(r=>r.kind==='ground'&&r.owner===s.actor&&r.turn===s.cursor.turn)){
    const city=r.placement==='named-city'?context.map.cells.find(c=>c.city?.name===r.city)?.id:null;
    const hexes=city?[city]:policy.entryEdge?.[s.actor]||[];
    for(const hex of hexes)add({type:'place-reinforcement',slotId:r.slotId,hex});
   }
   const positions=[...new Set([...(policy.entryEdge?.[s.actor]||[]),...context.map.cells.filter(c=>c.city?.name).map(c=>c.id)])];
   // Include printed replacement-only reserves in the same source-validated
   // legal-action catalogue as damaged/eliminated units. Previously these
   // were executable via API but invisible to human players.
   const reserve=policy.replacementOnlyReserveGroup&&s.cursor.turn>=policy.replacementOnlyEarliestTurn?
    context.buildupAllocation?.[policy.replacementOnlyReserveGroup]||[]:[];
   for(const unitId of new Set([...(s.state.buildupDeployedIds||[]),...reserve])){
    if(Object.hasOwn(s.state.evacuatedNavalUnits||{},unitId))continue;
    if(s.state.units[unitId])add({type:'apply-replacement',unitId,hex:null});
    else for(const hex of positions)add({type:'apply-replacement',unitId,hex});
   }
   // A surviving naval evacuee is admitted only through the existing
   // authoritative reinforcement transaction at a source-approved edge.
   if(s.actor==='soviet')for(const unitId of Object.keys(s.state.evacuatedNavalUnits||{}).sort())
    for(const hex of policy.entryEdge?.soviet||[])
     add({type:'place-evacuated-reinforcement',unitId,hex});
  }
 }
 if(s.phaseKind==='combat'&&s.combat){
  const c=s.combat;
  if(c.status==='air-sea-open'){
   if(c.pendingSeaFaceId!==null)diePrompt('roll-fleet-attack',{faceId:c.pendingSeaFaceId});
   else{
    add(combat({type:'finish-air-sea'}));
    for(const marker of context.combatPolicy?.airSupport?.markers||[])
     add(combat({type:'declare-fleet-attack',faceId:marker.faceId}));
   }
  }else if(c.status==='awaiting-declarations'){
   add(combat({type:'commit-battles',battles:[]}));
   const board=Binding.build(context.map,context.profile).board;
   const adjacent=new Map();
   for(const e of board.edges){
    if(!e.verified||e.impassable||e.lake||e.allSea)continue;
    for(const [from,to] of [[e.a,e.b],[e.b,e.a]]){
     if(!adjacent.has(from))adjacent.set(from,[]);
     adjacent.get(from).push(to);
    }
   }
   const enemyHexes=[...new Set(Object.values(s.state.units)
    .filter(u=>u.owner!==s.actor).map(u=>u.hex))].sort();
   // Source rule: at most one counter from a single adjacent origin hex may
   // participate in a particular attack. Choose zero or one at each adjacent
   // origin, and validate every resulting nonempty set against the actual
   // declaration transaction. No synthetic combat strength or new rule path.
   let examined=0;
   for(const hex of enemyHexes){
    const byOrigin=new Map();
    for(const u of Object.values(s.state.units).filter(u=>u.owner===s.actor&&adjacent.get(u.hex)?.includes(hex))){
     if(!byOrigin.has(u.hex))byOrigin.set(u.hex,[]);
     byOrigin.get(u.hex).push(u.id);
    }
    const origins=[...byOrigin.keys()].sort(),selected=[];
    for(const ids of byOrigin.values())ids.sort();
    function walk(i){
     if(++examined>limits.maxCombatSearch)throw Error('combat-proposal-search-limit-exceeded');
     if(i===origins.length){
      if(!selected.length)return;
      const battle={defenderHex:hex,attackers:[...selected]};
      if(trial(combat({type:'commit-battles',battles:[battle]}))){
       if(proposals.length===limits.maxCombatProposals)throw Error('combat-proposal-limit-exceeded');
       proposals.push(battle);
      }
      return;
     }
     walk(i+1);
     for(const id of byOrigin.get(origins[i])){
      selected.push(id);walk(i+1);selected.pop();
     }
    }
    walk(0);
   }
   // Preserve the legacy catalog's first single-attacker candidate for each
   // defender hex. Existing action clients may select the first proposal and
   // must not silently be switched to a different battle composition.
   const insertionOrder=new Map(Object.values(s.state.units).map((u,i)=>[u.id,i]));
   proposals.sort((a,b)=>a.defenderHex.localeCompare(b.defenderHex)||
    a.attackers.length-b.attackers.length||
    (a.attackers.length===1?insertionOrder.get(a.attackers[0])-insertionOrder.get(b.attackers[0]):
    a.attackers.join(':').localeCompare(b.attackers.join(':'))));
   // TWO-battle plans are still bounded, but now may combine independently
   // committed multi-attacker engagements. Include an incomplete flag when
   // a third legal two-battle plan exceeds the configured result budget.
   if(enumerateCombinedPlans){
   let plansTruncated=false;
   for(let i=0;i<proposals.length;i++){
    for(let j=i+1;j<proposals.length;j++){
     const first=proposals[i],second=proposals[j];
     if(first.defenderHex===second.defenderHex||
        first.attackers.some(id=>second.attackers.includes(id)))continue;
     const battles=[first,second];
     if(!trial(combat({type:'commit-battles',battles})))continue;
     if(plans.length===limits.maxPlans){plansTruncated=true;break;}
     plans.push(battles);
    }
    if(plansTruncated)break;
   }
   if(plansTruncated)prompts.push({kind:'enumeration-incomplete',type:'combined-battle-plans',limit:limits.maxPlans});
   // The existing `plans` contract is deliberately kept as TWO battles for
   // older consumers. Three-battle plans are a separate, explicitly bounded
   // collection, with their own completeness marker. The authoritative
   // declaration transaction—not an inferred compatibility rule—validates
   // each combination before it is shown to a human or AI controller.
   // Fixed ascending proposal indices and source-sorted proposals make
   // results deterministic without committing a battle or rolling dice.
   let expandedTruncated=false,expandedExamined=0,expandedVisited=0;
   const chosen=[],spent=new Set(),targets=new Set();
   function chooseThree(start){
    if(expandedTruncated)return;
    // Bound the search tree itself, not merely valid leaf declarations:
    // conflicting attackers or duplicate targets could otherwise create
    // millions of rejected prefixes without spending the leaf budget.
    if(++expandedVisited>limits.maxThreeBattleSearch){expandedTruncated=true;return;}
    if(chosen.length===3){
     expandedExamined++;
     const battles=[...chosen];
     if(!trial(combat({type:'commit-battles',battles})))return;
     if(expandedPlans.length===limits.maxThreeBattlePlans){expandedTruncated=true;return;}
     expandedPlans.push(battles);
     return;
    }
    for(let i=start;i<proposals.length;i++){
     if(proposals.length-i<3-chosen.length)break;
     const p=proposals[i];
     if(targets.has(p.defenderHex)||p.attackers.some(id=>spent.has(id)))continue;
     chosen.push(p);targets.add(p.defenderHex);
     for(const id of p.attackers)spent.add(id);
     chooseThree(i+1);
     for(const id of p.attackers)spent.delete(id);
     targets.delete(p.defenderHex);chosen.pop();
     if(expandedTruncated)break;
    }
   }
   if(new Set(proposals.map(p=>p.defenderHex)).size>=3)chooseThree(0);
   if(expandedTruncated)prompts.push({kind:'enumeration-incomplete',
    type:'three-battle-plans',limit:limits.maxThreeBattlePlans,
    searchLimit:limits.maxThreeBattleSearch});
   }
  }else if(c.status==='committed'){
   const resolved=new Set(c.resolved.map(e=>e.battle.defenderHex));
   for(const b of c.declaration.battles||[])if(!resolved.has(b.defenderHex))
    add(combat({type:'select-battle',defenderHex:b.defenderHex}));
  }else if(c.status==='battle-selected'){
   if(c.groundAirLocked===false&&s.actor===context.combatPolicy?.airSupport?.owner){
    add(combat({type:'commit-ground-air',faceId:null}));
    for(const marker of context.combatPolicy.airSupport.markers||[])
     add(combat({type:'commit-ground-air',faceId:marker.faceId}));
   }else{
    // An understrength attack can be automatic NE. Test the authoritative
    // transaction itself, without evaluating a second copy of the CRT.
    // A normal battle rejects a null die; the UI must not ask for a d6 when
    // the historical rules prescribe no roll at all.
    const automaticNoDie=trial(combat({type:'resolve-battle',die:null,choices:{}}));
    diePrompt('resolve-battle',{defenderHex:c.selected,automaticNoDie,
     min:automaticNoDie?null:1,max:automaticNoDie?null:6,
     note:automaticNoDie?'Automatic NE: no die is rolled; commit the result without a d6.':
      'CRT die and result-dependent choices must be resolved by the authoritative combat transaction'});
   }
  }else if(c.status==='fleet-die-pending'){
   diePrompt('roll-fleet-displacement',{to:c.pendingFleetCombat.to,
    note:'The Fleet destination has been committed; supply a fresh damage die'});
  }else if(c.status==='no-battles-declared'||c.status==='battles-resolved')add(combat({type:'finish-combat'}));
 }
 if(['movement','special-movement','naval-operations'].includes(s.phaseKind)){
  if(s.pendingNavalGround)diePrompt('roll-naval-ground-transport',{unitId:s.pendingNavalGround.unitId,destination:s.pendingNavalGround.destination});
  else if(s.pendingFleet!==null)diePrompt('roll-fleet-move',{to:s.pendingFleet});
  else if(s.pendingGround){
   if(s.pendingPort!==null)diePrompt('resolve-forced-ground-move',{to:s.pendingPort});
   else {
    // A legal ordinary resolution proves that no forced Fleet destination
    // may be committed (the same transaction enforces mutual exclusion).
    // Avoid probing every city on every ordinary ground move.
    if(!add({type:'resolve-ground-move'})){
    for(const to of Object.values(context.combatPolicy?.portSupport?.ports||{}))if(typeof to==='string')
     add({type:'commit-forced-port',to});
    // portSupport.ports may use objects; always derive locations from source map.
    for(const c of context.map.cells.filter(c=>c.city?.name))
     add({type:'commit-forced-port',to:c.id});
    }
   }
  }else{
   add({type:'finish-phase'});
   // Use the already-certified graph and the *same* movement adjudicator
   // as execution.  One least-cost route per destination is returned; the
   // search allows transit-only prefixes only if the scenario profile does.
   // Search failures are surfaced, never converted to an empty 'legal' list.
   if(s.phaseKind!=='naval-operations'){
   const binding=Binding.build(context.map,context.profile);
   const phase={kind:s.phaseKind,owner:s.actor};
   const queries=[];
   for(const u of Object.values(s.state.units).filter(u=>u.owner===s.actor&&!s.usedUnitIds.includes(u.id))){
    const modes=[null];
    if(s.phaseKind==='special-movement'&&s.actor==='soviet'&&u.class==='infantry')modes.push('rail');
    for(const mode of modes)queries.push({unitId:u.id,mode,maxStates:limits.maxSearchStatesPerUnit});
   }
   const fields=Binding.legalRoutesBatch(binding,phase,s.state.units,s.cursor.turn,queries,s.state.territory);
   const candidates=[];
   for(let i=0;i<queries.length;i++){
    const {unitId,mode}=queries[i];
    for(const route of fields[i].reachable()){
     const request={unitId,path:route.path};
     if(mode)request.mode=mode;
     candidates.push({type:'declare-ground-move',request});
    }
   }
   if(typeof session.canExecuteGroundBatch==='function'){
    const valid=session.canExecuteGroundBatch(candidates);
    candidates.forEach((action,i)=>{if(valid[i])commands.push(action);});
   }else for(const action of candidates)add(action);
   }
   if(['special-movement','naval-operations'].includes(s.phaseKind))for(const city of context.map.cells.filter(c=>c.city?.name))
    add({type:'declare-fleet-move',to:city.id});
   const permitted=context.config.phases.find(p=>p.id===s.phaseId)?.permissions||[];
   if(['special-movement','naval-operations'].includes(s.phaseKind)&&s.actor==='soviet'&&
      permitted.includes('naval-ground-transport')&&context.buildupPolicy?.navalReplacementPolicy){
    const fleet=s.state.supportMarkers?.[context.buildupPolicy.navalReplacementPolicy.markerKey];
    if(fleet)for(const unit of Object.values(s.state.units).filter(u=>u.owner==='soviet'&&u.hex===fleet.hex&&!s.usedUnitIds.includes(u.id))){
     add({type:'declare-naval-ground-transport',unitId:unit.id,destination:{kind:'off-map'}});
     for(const hex of Object.values(context.buildupPolicy.navalReplacementPolicy.portHexes))
      if(hex!==fleet.hex)add({type:'declare-naval-ground-transport',unitId:unit.id,destination:{kind:'port',hex}});
    }
   }
  }
 }
 const penalty=['movement','special-movement'].includes(s.phaseKind)?Rules.stackPenalty(context.profile,s.state.units,s.actor).excess:0;
 return clone({phaseId:s.phaseId,phaseKind:s.phaseKind,actor:s.actor,turn:s.cursor.turn,
  commands,proposals,plans,expandedPlans,prompts,complete:false,...(penalty?{stackPenalty:penalty}:{}),
  ...(proposals.length?{combatEnumeration:{proposalsExhaustive:true,combinedPlansEnumerated:enumerateCombinedPlans,
    planSizeLimit:2,plansExhaustive:enumerateCombinedPlans&&!prompts.some(p=>p.type==='combined-battle-plans'),
    limit:limits.maxPlans,
    expandedPlanSizeLimit:3,expandedPlansExhaustive:enumerateCombinedPlans&&!prompts.some(p=>p.type==='three-battle-plans'),
    expandedPlanLimit:limits.maxThreeBattlePlans,
    note:enumerateCombinedPlans?'Two- and three-target plans are bounded and annotated for completeness':'Combined plans not enumerated for interactive human controls; any declared combination is checked by the authoritative transaction'}}:{})});
}

/* Post-roll decision proposals. The die must be supplied by a real gameplay
 * controller after the battle and air-support decisions are committed. This
 * function NEVER draws, chooses, or alters a die or a game state. Candidate
 * consequences are accepted only by replaying the authoritative transaction.
 * Post-casualty retreats use the authoritative source-face loss preparation,
 * but Fleet displacement and other historical result branches remain bounded.
 */
/**
 * Resumable, read-only source validation of post-roll choices. Each step
 * performs at most one authoritative transaction validation or one modest
 * enumerator stage. A committed die owns one cursor in the human gateway;
 * later pages resume rather than rescanning all earlier proposals.
 *
 * IMPORTANT: exhaustion is NOT a proof of rules completeness. Enumeration
 * retains the historical 4,096-validation safety budget, including Fleet
 * choices. The independent combat engine validates every actual selection.
 */
function exchangeExhaustionOrders(loss,stage,attackers){
 const order=loss.attackerLossIds;
 if(stage.outcome!=='EX'||!Array.isArray(order)||order.length!==attackers.length||
    order.length<2||order.length>12||stage.losses.length<=order.length+1)return [];
 const first=stage.losses.slice(1,1+order.length),extra=stage.losses.slice(1+order.length);
 const owed=stage.losses[0].defensePoints-first.reduce((n,l)=>n+l.attackPoints,0);
 if(owed<=0)return [];
 // Full source counters have at most two steps. The first pass identifies
 // survivors; their remaining attack points come from the reduced face or
 // from the authoritative extra-loss record if the original order killed them.
 const remaining=first.filter(l=>!l.removed).map(l=>({id:l.unitId,
  cost:extra.find(e=>e.unitId===l.unitId)?.attackPoints??stage.state.units[l.unitId]?.printedCombatStrength}));
 if(remaining.length<2||remaining.some(r=>!Number.isFinite(r.cost)||r.cost<=0)||
    remaining.reduce((n,r)=>n+r.cost,0)<=owed)return [];
 const key=ids=>JSON.stringify([...ids].sort());
 const seen=new Set([key(extra.map(e=>e.unitId))]),out=[];
 // A set is feasible iff a final casualty can bring the total across the
 // obligation; all preceding positive payments are then below that threshold.
 for(let bits=1;bits<2**remaining.length;bits++){
  const set=remaining.filter((_,i)=>bits&(2**i)),sum=set.reduce((n,r)=>n+r.cost,0);
  if(sum<owed)continue;
  const last=set.find(r=>sum-r.cost<owed);if(!last)continue;
  const k=key(set.map(r=>r.id));if(seen.has(k))continue;seen.add(k);
  const prefix=[...set.filter(r=>r!==last).map(r=>r.id),last.id];
  out.push([...prefix,...order.filter(id=>!prefix.includes(id))]);
 }
 return out;
}
function createPostRollPager({session,context,die}){
 if(!session||typeof session.snapshot!=='function'||typeof session.execute!=='function'||
    !obj(context)||!obj(context.config)||!obj(context.combatPolicy)||!obj(context.profile)||!obj(context.map))
  throw Error('Source-bound post-roll context required');
 if(!(die===null||(Number.isInteger(die)&&die>=1&&die<=6)))
  throw Error('Committed d6 (or null for automatic NE) required');
 const s=session.snapshot(),c=s.combat;
 if(s.state?.scenarioId!==context.config.scenarioId||s.phaseKind!=='combat'||
    !c||c.status!=='battle-selected'||
    (s.actor===context.combatPolicy?.airSupport?.owner&&context.enableAirSupport&&c.groundAirLocked!==true))
  throw Error('Select a committed battle and lock Air Corps use before a post-roll decision');
 const battle=c.declaration?.battles?.find(x=>x.defenderHex===c.selected);
 if(!battle)throw Error('Selected battle missing from committed declarations');
 const MAX_TRIALS=4096,MAX_CHOICES=128;
 const accepted=[],seen=new Set();
 let attempted=0,afterLossStates=0,afterLossRetreatScans=0,finished=false,budgetReached=false;
 const port=Ports.create({map:context.map,policy:context.combatPolicy,counterConfig:context.counterConfig});
 const marker=s.state.supportMarkers?.[port.markerKey];
 const candidateDestinations=marker&&s.actor!==marker.owner&&battle.defenderHex===marker.hex?
  port.forcedDestinations({state:s.state}):[];
 const attackers=battle.attackers.filter(id=>s.state.units[id]),defenders=battle.defenders.filter(id=>s.state.units[id]);
 const fleetAllowsIgnoreRetreat=port.inspect({state:s.state,battle,actor:s.actor}).ignoreRetreatEligible;
 const evaluator=Consequences.create({map:context.map,profile:context.profile,
  counterConfig:context.counterConfig,combatPolicy:context.combatPolicy,
  geography:Geography.create(context.map,context.profile,
   {cityMarkerMode:context.combatPolicy.cityMarkerMode,fortificationMode:context.combatPolicy.fortificationMode}),
  phaseConfig:context.config,enableAirSupport:context.enableAirSupport,rosterOverlay:context.rosterOverlay||null});
 const previewBase={state:s.state,battle,actor:s.actor,die,cursor:s.cursor,
  airSupportId:c.groundAirChoice??null};
 const crtOutcome=evaluator.previewPostCasualty(previewBase).outcome;
 const forced=context.combatPolicy.retreatMode==='source-forced-ezoc-v1';
 const retreatSolver=forced?Retreat.create({map:context.map,profile:context.profile,
  combatPolicy:context.combatPolicy,counterConfig:context.counterConfig}):null;
 function* offer(choices){
  if(budgetReached)return;
  const key=JSON.stringify(choices);
  if(seen.has(key))return;
  seen.add(key);
  if(attempted>=MAX_TRIALS){budgetReached=true;return;}
  attempted++;
  const action={type:'combat',action:{type:'resolve-battle',die,choices}};
  let result=null,needsFleet=false;
  try{
   const outcome=session.execute(action);
   result={action,outcome:outcome.event?.outcome||null,
    losses:outcome.event?.losses||[],retreats:outcome.event?.retreats||[],
    revealed:outcome.event?.revealed||[],advanced:outcome.event?.advanced||null};
  }catch(e){
   if(e.message==='combat-result-choice-limit-exceeded')throw e;
   needsFleet=candidateDestinations.length&&typeof choices.advanceUnitId==='string'&&
    !Object.prototype.hasOwnProperty.call(choices,'fleetDisplacement');
  }
  // Yield after every transaction, successful or not, so the browser can
  // process bounded chunks and expose a genuinely usable Cancel control.
  yield result?{item:result,fleet:false}:{trial:true};
  if(!needsFleet||budgetReached)return;
  for(const dest of candidateDestinations){
   if(attempted>=MAX_TRIALS){budgetReached=true;return;}
   attempted++;
   const action={type:'combat',action:{type:'commit-fleet-displacement',die,choices,to:dest.hex}};
   let result=null;
   try{
    const next=session.execute(action);
    result={action,to:dest.hex,port:dest.name,
     status:next.session.snapshot().combat.status,next:'roll-fleet-displacement'};
   }catch(e){if(e.message==='combat-result-choice-limit-exceeded')throw e;}
   yield result?{item:result,fleet:true}:{trial:true};
  }
 }
 function* casualtyBranch(loss,expand=true){
  if(budgetReached)return;
  let stage;
  try{stage=evaluator.previewPostCasualty({...previewBase,choices:loss});}
  catch(e){
   if(e.message==='Exchange attacker losses do not meet defender loss')return;
   throw e;
  }
  afterLossStates++;
  // Previews also consume CPU; offer a cooperative boundary before expanding
  // potentially expensive post-casualty retreat combinations.
  yield {stage:true};
  // If every attacker pays one step but the defender obligation remains,
  // the adjudicator pays additional steps in the supplied order. Enumerate
  // distinct extra-elimination sets, not factorial permutations of the same
  // result. Keep the original order first and use the existing trial budget.
  const alternatives=expand?exchangeExhaustionOrders(loss,stage,attackers):[];
  if(alternatives.length){
   const branches=[consequenceBranch(loss,stage)];
   for(const order of alternatives)branches.push(casualtyBranch({...loss,attackerLossIds:order},false));
   while(branches.length&&!budgetReached){
    for(let i=0;i<branches.length&&!budgetReached;){
     const next=branches[i].next();
     if(next.done)branches.splice(i,1);else{yield next.value;i++;}
    }
   }
   return;
  }
  yield* consequenceBranch(loss,stage);
 }
 function* consequenceBranch(loss,stage){
  yield* offer(loss);
  // Target: Leningrad §13.2: a surviving Soviet unit in the Fleet's port
  // may ignore the retreat portion of DR, DRL, or EX.  For EX and stacked
  // DRL the mandatory loss choices must be carried forward; the generic
  // {ignoreRetreat:true} probe above cannot express those outcomes.  Offer
  // this branch before the potentially large joint-retreat enumeration so
  // a valid no-retreat choice cannot be hidden behind the trial budget.
  if(stage.survivingDefenderIds.length&&['DR','DRL','EX'].includes(stage.outcome)&&
     fleetAllowsIgnoreRetreat)
   yield* offer({...loss,ignoreRetreat:true});
  for(const id of attackers){if(budgetReached)return;yield* offer({...loss,advanceUnitId:id});}
  if(!['DR','DRL','EX'].includes(stage.outcome)||!stage.survivingDefenderIds.length||!forced)return;
  const retreatReport=retreatSolver.enumerate({state:stage.state,
   defenderHex:battle.defenderHex,defenderIds:stage.survivingDefenderIds});
  afterLossRetreatScans++;
  if(!retreatReport.exhaustive)throw Error('combat-post-casualty-retreat-enumeration-incomplete');
  yield {stage:true};
  for(const combo of retreatReport.combinations){
   if(budgetReached)return;
   const paths={};for(const [id,v] of Object.entries(combo))if(v)paths[id]=v.route;
   yield* offer({...loss,retreatPaths:paths});
   for(const id of attackers){if(budgetReached)return;yield* offer({...loss,retreatPaths:paths,advanceUnitId:id});}
  }
 }
 function* enumerate(){
  yield* offer({});
  for(const id of attackers){if(budgetReached)return;yield* offer({advanceUnitId:id});yield* offer({lossUnitId:id});}
  yield* offer({ignoreRetreat:true});
  if(crtOutcome==='DR')yield* casualtyBranch({});
  if(crtOutcome==='DRL')for(const id of defenders){
   if(budgetReached)return;
   yield* casualtyBranch(defenders.length===1?{}:{defenderLossId:id});
  }
  if(crtOutcome==='EX'){
   if(attackers.length>12)throw Error('combat-exchange-subset-limit-exceeded');
   // A large EX can generate thousands of post-retreat permutations for the
   // first casualty selection alone. Under the fixed 4096-validation budget,
   // a depth-first walk can therefore hide OTHER source-legal loss choices.
   // For four-or-more attackers sharing a two-defender battle, rotate the
   // bounded generator branches. All proposals still pass the same source
   // transaction; no combat result, die, or casualty rule is changed.
   const fair=attackers.length>=4&&defenders.length===2;
   const branches=[];
   for(let bits=1;bits<2**attackers.length;bits++){
    if(budgetReached)return;
    const attackerLossIds=attackers.filter((_,i)=>bits&(2**i));
    for(const id of defenders){
     if(budgetReached)return;
     const loss={attackerLossIds,...(defenders.length===1?{}:{defenderLossId:id})};
     if(fair)branches.push(casualtyBranch(loss));
     else yield* casualtyBranch(loss);
    }
   }
   if(fair){
    // Cooperative one-step-per-branch scheduler: a branch may finish early
    // if its source-verified casualty payment is illegal. A slow retreat
    // scanner is never allowed to monopolize the global trial budget.
    while(branches.length&&!budgetReached){
     for(let i=0;i<branches.length&&!budgetReached;){
      const next=branches[i].next();
      if(next.done)branches.splice(i,1);
      else{yield next.value;i++;}
     }
    }
   }
  }
 }
 const iterator=enumerate();
 const checkPage=page=>{
  if(!Number.isSafeInteger(page)||page<0||page>255)throw Error('Invalid post-roll consequence page');
 };
 function advance(page,steps=32){
  checkPage(page);
  if(!Number.isSafeInteger(steps)||steps<1||steps>512)throw Error('Invalid post-roll work budget');
  const required=(page+1)*MAX_CHOICES+1;
  let executed=0;
  while(!finished&&accepted.length<required&&executed<steps){
   const next=iterator.next();executed++;
   if(next.done){finished=true;break;}
   if(next.value?.item)accepted.push(next.value);
  }
  return {ready:finished||accepted.length>=required,examined:attempted,
   validated:accepted.length,workSteps:executed,finished,budgetReached};
 }
 function pageResult(page){
  checkPage(page);
  const offset=page*MAX_CHOICES,required=offset+MAX_CHOICES+1;
  while(!finished&&accepted.length<required)advance(page,512);
  if(page>0&&accepted.length<=offset)throw Error('Post-roll consequence page is not available');
  const items=accepted.slice(offset,offset+MAX_CHOICES);
  const hasNextPage=accepted.length>offset+MAX_CHOICES;
  return clone({phaseId:s.phaseId,defenderHex:battle.defenderHex,die,crtOutcome,
   options:items.filter(x=>!x.fleet).map(x=>x.item),
   fleetCommitments:items.filter(x=>x.fleet).map(x=>x.item),
   attempted,afterLossStates,afterLossRetreatScans,
   choiceTruncated:hasNextPage||budgetReached,hasNextPage,choicePage:page,
   choiceOffset:offset,choiceLimit:MAX_CHOICES,exhaustive:false,
   scope:'authoritatively-validated-candidates-only',
   limitations:['Post-roll enumeration remains bounded, including casualty and joint-retreat branches',
    ...(hasNextPage?['Additional validated choices are available on the next page']:[]),
    ...(budgetReached?['Candidate validation stopped at the 4096-attempt safety budget']:[]),
    'Paging exposes further validated candidates but is not a proof that all consequences can be enumerated',
    'Fleet damage dice must be supplied after destination commitment; no RNG is generated',
    'Does not certify original counter identities or autonomous choice policy']});
 }
 return Object.freeze({advance,page:pageResult,stats:()=>({attempted,validated:accepted.length,finished,budgetReached})});
}
function discoverPostRoll({session,context,die,page=0}){
 return createPostRollPager({session,context,die}).page(page);
}
module.exports=Object.freeze({discover,discoverPostRoll,createPostRollPager});

};
defs["core/historical_campaign_human.js"]=function(module,exports,require,Buffer){
/* Shared human decision gateway for the historical campaign engine (v401).
 * This is a headless action interface, NOT a replacement player-facing UX.
 * Each displayed choice comes from the source-validated catalog. Battle dice
 * are committed separately BEFORE result-dependent choices become visible.
 * A pending die is journaled in this wrapper's versioned save and cannot be
 * changed by selecting another result. No scenario-ID-specific rules here.
 */
'use strict';
const crypto=require('node:crypto');
const Random=require('./mission_random');
const Campaign=require('./historical_campaign_session');
const MovementBinding=require('./movement_binding');
const Catalog=require('./historical_campaign_action_catalog');
const AutoPlay=require('./historical_campaign_autoplay');
const {clone,object:obj,checksum:hash,equal:same}=require('./historical_campaign_json');
const dieOK=d=>d===null||(Number.isSafeInteger(d)&&d>=1&&d<=6);
const FORMAT='historical-human-decision-session';
const VERSION=1;
function make(session,context,pending=null,existingPager=null,missionSeed=null,deploymentDraws=0){
 if(missionSeed!==null)Random.validate(missionSeed);
 if(!Number.isSafeInteger(deploymentDraws)||deploymentDraws<0||(!missionSeed&&deploymentDraws!==0))throw Error("Invalid deployment random state");
 if(!session||typeof session.snapshot!=='function'||typeof session.execute!=='function'||typeof session.save!=='function')
  throw Error('Authoritative campaign session required');
 if(!obj(context)||!obj(context.config))throw Error('Source scenario context required');
 const stateHash=()=>typeof session.stateHash==='function'?session.stateHash():session.save().finalStateHash;
 const journal=()=>typeof session.journal==='function'?session.journal():session.save().journal;
 const postPages=new Map();
 let postPager=null;
 if(pending){
  if(!obj(pending)||!dieOK(pending.die)||pending.at!==stateHash())
   throw Error('Pending combat die does not match authoritative campaign state');
  // This must still be a valid adjudication point. In particular, a restored
  // die cannot be attached to a different battle or an unlocked air decision.
  postPager=existingPager||Catalog.createPostRollPager({session,context,die:pending.die});
  postPages.set(0,postPager.page(0));
 }
 // A pending die belongs to an immutable campaign snapshot. Cache validated
 // post-roll options for this session instance so UI refreshes and the subsequent
 // click do not replay the same expensive candidate enumeration.
 // Human clients choose individual legal proposals and submit any combination to
 // the authoritative transaction; eager exhaustive plan enumeration is unused.
 // A human-session wrapper is bound to one immutable campaign snapshot.
 // Reuse its validated legal catalog between view rendering and the next
 // choice; a committed action/Undo/Restore always creates a new wrapper.
 // This avoids running expensive source movement searches twice per click.
 let catalogCache=null;
 const source=()=>catalogCache||(catalogCache=Catalog.discover({session,context,enumerateCombinedPlans:false}));
 function view(page=0){
  if(pending){
   if(!Number.isSafeInteger(page)||page<0||page>255)throw Error('Invalid post-roll consequence page');
   if(!postPages.has(page)){
    const prior=postPages.get(page-1);
    if(!prior||!prior.hasNextPage)throw Error('Post-roll consequence page is not available');
    postPages.set(page,postPager.page(page));
   }
   const post=postPages.get(page);
   return clone({kind:'post-roll-choice',phaseId:post.phaseId,die:pending.die,
    crtOutcome:post.crtOutcome,options:post.options.map(x=>x.action),
    // Read-only adjudicated evidence is parallel to options; it is never part
    // of the submitted action or the authenticated campaign transaction.
    optionEffects:post.options.map(x=>({outcome:x.outcome,losses:x.losses,
     retreats:x.retreats,advanced:x.advanced,revealed:x.revealed})),
    fleetCommitments:post.fleetCommitments.map(x=>x.action),
    exhaustive:post.exhaustive,choiceTruncated:post.choiceTruncated,
    choiceLimit:post.choiceLimit,choicePage:post.choicePage,choiceOffset:post.choiceOffset,
    hasNextPage:post.hasNextPage,limitations:post.limitations});
  }
  const catalog=source();
  return clone({kind:catalog.complete?'complete':'action-choice',...catalog});
 }
 function preparePage(page,steps=24){
  if(!pending)throw Error('No committed combat die is pending');
  if(!Number.isSafeInteger(page)||page<1||page>255)throw Error('Invalid post-roll consequence page');
  const prior=postPages.get(page-1);
  if(!prior||!prior.hasNextPage)throw Error('Post-roll consequence page is not available');
  if(postPages.has(page))return {ready:true,...postPager.stats()};
  const progress=postPager.advance(page,steps);
  if(progress.ready)postPages.set(page,postPager.page(page));
  return progress;
 }
 function choose(action){
  if(!obj(action))throw Error('Explicit legal action required');
  if(pending){
   const alreadyDisplayed=[...postPages.values()].flatMap(post=>[
    ...post.options.map(x=>x.action),...post.fleetCommitments.map(x=>x.action)]);
   if(!alreadyDisplayed.some(x=>same(x,action)))
    throw Error('Choice is not a validated post-roll consequence for committed die');
   return make(session.execute(action).session,context,null,null,missionSeed,deploymentDraws);
  }
  const candidates=source();
  let allowed=candidates.commands.some(x=>same(x,action));
  if(!allowed&&action.type==='combat'&&action.action?.type==='commit-battles'&&
    Array.isArray(action.action.battles)&&action.action.battles.length>0){
   // Any coherent combination of source-validated individual battle proposals
   // is permitted; the final authoritative transaction checks it as a whole.
   // Avoid an artificial hard cap of 2/3 battles imposed by discovery budgets.
   const chosen=action.action.battles;
   allowed=chosen.every(b=>candidates.proposals.some(p=>same(p,b)))&&
    chosen.length===new Set(chosen.map(b=>b.defenderHex)).size;
  }
  if(!allowed)throw Error('Action is absent from current legal decision catalog');
  return make(session.execute(action).session,context,null,null,missionSeed,deploymentDraws);
 }
 function roll(die){
  if(pending)throw Error('Combat die already committed; resolve or Undo before rolling again');
  if(!dieOK(die))throw Error('Invalid six-sided die');
  const catalog=source();
  const dice=catalog.prompts.filter(x=>x.kind==='die-and-choice');
  if(!dice.length)throw Error('No source-authorized die decision is pending');
  const battle=dice.find(x=>x.type==='resolve-battle');
  if(battle){
   // This is a genuine pre-consequence commit, even when the CRT gives
   // automatic NE (no die roll) and `die` must be null.
   const pager=Catalog.createPostRollPager({session,context,die});
   const post=pager.page(0);
   if(!post.options.length&&!post.fleetCommitments.length)
    throw Error('No authorized post-roll choices at committed die');
   return make(session,context,{die,at:stateHash()},pager,missionSeed,deploymentDraws);
  }
  if(die===null)throw Error('Damage rolls require a real d6');
  if(dice.length!==1)throw Error('Ambiguous pending die prompt');
  const kind=dice[0].type;
  const actions={
   'roll-fleet-attack':{type:'combat',action:{type:'roll-fleet-attack',die}},
   'roll-fleet-displacement':{type:'combat',action:{type:'roll-fleet-displacement',die}},
   'roll-fleet-move':{type:'roll-fleet-move',die},
   'roll-naval-ground-transport':{type:'roll-naval-ground-transport',die},
   'resolve-forced-ground-move':{type:'resolve-forced-ground-move',die}
  };
  if(!actions[kind])throw Error('Unsupported source die prompt: '+kind);
  return make(session.execute(actions[kind]).session,context,null,null,missionSeed,deploymentDraws);
 }
 function rollRandom(){
  if(missionSeed===null)throw Error("No mission seed assigned");
  const prompt=source().prompts.find(x=>x.kind==='die-and-choice');
  if(!prompt)throw Error("No source-authorized die decision is pending");
  return roll(prompt.automaticNoDie?null:Random.die(missionSeed,journal(),prompt.type==='resolve-battle'?'combat':'naval'));
 }
 // Hand the AI the existing immutable campaign session instead of restoring
 // and replaying the complete journal on every browser action. This is the
 // same controller and authoritative execute path used by the old UI loop.
 function autoplayStep(policy={}){
  if(pending)throw Error('Finish the committed human die and consequence before using AI');
  if(!obj(policy))throw Error('Controller policy must be an object');
  const decision=AutoPlay.decide({session,context,policy:{...policy,...(missionSeed!==null?{missionSeed}:{})}});
  if(decision.status!=='action'||!decision.action)return {decision,session:null};
  return {decision,session:make(session.execute(decision.action).session,context,null,null,missionSeed,deploymentDraws)};
 }
 function undo(){
  if(pending)return {ok:true,session:make(session,context,null,null,missionSeed,deploymentDraws)};
  const result=session.undo();
  return {ok:result.ok,session:make(result.session,context,null,null,missionSeed,deploymentDraws)};
 }
 function save(){
  const payload={format:FORMAT,version:VERSION,campaign:session.save(),pendingRoll:clone(pending)};
  if(missionSeed!==null){payload.missionSeed=missionSeed;payload.deploymentDraws=deploymentDraws;}
  return {...payload,integrity:{algorithm:'SHA-256',digest:hash(payload)}};
 }
 return Object.freeze({snapshot:()=>session.snapshot(),journal:()=>session.journal(),view,preparePage,choose,roll,rollRandom,autoplayStep,hasPendingRoll:()=>pending!==null,undo,save,missionSeed:()=>missionSeed,deploymentDraws:()=>deploymentDraws});
}
function create({session,context,missionSeed=null,deploymentDraws=0}={}){return make(session,MovementBinding.prepareContext(context),null,null,missionSeed,deploymentDraws);}
function restore(saved,context){
 if(!obj(saved)||!obj(saved.integrity)||Object.keys(saved).sort().join(',')!==
  ['campaign','format','integrity','pendingRoll','version',...(Object.prototype.hasOwnProperty.call(saved,'missionSeed')?['missionSeed']:[]),...(Object.prototype.hasOwnProperty.call(saved,'deploymentDraws')?['deploymentDraws']:[])].sort().join(',')||
  saved.format!==FORMAT||saved.version!==VERSION||saved.integrity.algorithm!=='SHA-256')
  throw Error('Invalid human-session save envelope');
 const {integrity,...payload}=saved;
 if(typeof integrity.digest!=='string'||!/^[a-f0-9]{64}$/.test(integrity.digest)||
  !crypto.timingSafeEqual(Buffer.from(integrity.digest,'hex'),Buffer.from(hash(payload),'hex')))
  throw Error('Human-session save checksum mismatch');
 const session=Campaign.restore(saved.campaign,context);
 return make(session,MovementBinding.prepareContext(context),saved.pendingRoll,null,saved.missionSeed===undefined?null:Random.validate(saved.missionSeed),saved.deploymentDraws??0);
}
module.exports=Object.freeze({FORMAT,VERSION,create,restore});

};
defs["core/historical_campaign_json.js"]=function(module,exports,require,Buffer){
/* Ordinary JSON helpers for historical session envelopes and action views.
 * Preserve JSON.stringify ordering, coercions and exceptions.
 * Canonical campaign receipt serialization remains separate.
 */
'use strict';
const crypto=require('node:crypto');
const clone=value=>JSON.parse(JSON.stringify(value));
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const checksum=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
module.exports=Object.freeze({clone,object,equal,checksum});

};
defs["core/historical_campaign_session.js"]=function(module,exports,require,Buffer){
/* Checkpoint 153: replay-verified historical campaign CONTINUATION, not a
 * certified eight-turn game. Reuses the verified combat-phase journal,
 * movement rules and Fleet movement/reaction transactions. Buildup,
 * reinforcement and housekeeping are deliberately NOT bypassable.
 * Node-only developer engine interface; scenario rules are configuration data.
 */
'use strict';
const crypto=require('node:crypto');
const Phase=require('./phase_runtime');
const Combat=require('./historical_combat_session');
const Movement=require('./historical_movement_actions');
const Support=require('./historical_support_movement');
const Ports=require('./historical_port_support');
const NavalLogistics=require('./historical_naval_logistics');
const Buildup=require('./historical_buildup_phase');
const Housekeeping=require('./historical_housekeeping_phase');
const Territory=require('./territorial_state_transition');
const MovementBinding=require('./movement_binding');
const Rules=require('./movement_rules');
const FORMAT='wargame-historical-campaign-continuation', VERSION=1;
const MAX_ACTIONS=5000, MAX_BYTES=16*1024*1024;
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function canonical(v){
 const seen=new WeakSet();
 function walk(x,depth){
  if(depth>64)throw Error('Campaign save nesting limit');
  if(x===null||typeof x==='string'||typeof x==='boolean')return x;
  if(typeof x==='number'&&Number.isFinite(x))return x;
  if(!Array.isArray(x)&&!obj(x))throw Error('Unsupported campaign save value');
  if(seen.has(x))throw Error('Cyclic campaign save value');
  seen.add(x);
  let result;
  if(Array.isArray(x)){
   if(Object.keys(x).length!==x.length)throw Error('Sparse campaign save array');
   result=x.map(y=>walk(y,depth+1));
  }else{
   // Null-prototype intermediate: safe own-key assignment without invoking
   // inherited setters. Sorted keys and the validated JSON representation stay identical.
   result=Object.create(null);
   for(const key of Object.keys(x).sort()){
    if(['__proto__','prototype','constructor'].includes(key))throw Error('Forbidden campaign save key');
    result[key]=walk(x[key],depth+1);
   }
  }
  seen.delete(x);return result;
 }
 const output=JSON.stringify(walk(v,0));
 if(Buffer.byteLength(output)>MAX_BYTES)throw Error('Campaign save too large');
 return output;
}
const clone=v=>JSON.parse(canonical(v));
const hash=v=>crypto.createHash('sha256').update(canonical(v)).digest('hex');
function exact(value,keys,label){
 if(!obj(value)||Object.keys(value).length!==keys.length||keys.some(k=>!own(value,k)))
  throw Error('Invalid '+label+' fields');
}
function validateSourcePolicies(context,config,state){
 if(Boolean(context.buildupPolicy)!==Boolean(context.buildupAllocation))
  throw Error('Buildup source policy and allocation must be supplied together');
 if(context.housekeepingPolicy&&!context.buildupPolicy)
  throw Error('Housekeeping victory requires source-bound buildup and city control');
 // A narrowly source-authorized empty first-turn buildup may run before the
 // remaining reinforcement/replacement roster has been integrated. It cannot
 // authorize a second-turn phase, placement, or extra replacement step.
 if(context.firstTurnEmptyBuildupPolicy){
  const p=context.firstTurnEmptyBuildupPolicy;
  const phase=config.phases.find(x=>x.id===p.phaseId);
  if(!obj(p)||p.schemaVersion!==1||p.scenarioId!==config.scenarioId||
     p.scope!=='source-verified-first-turn-empty-buildup-only'||
     p.status!=='experimental-journal-action-only-not-later-turn-buildup-or-full-campaign'||
     p.turn!==1||!config.players.includes(p.owner)||p.replacementSteps!==0||
     p.groundReinforcements!==0||p.supportArrivals!==0||
     phase?.kind!=='buildup'||phase.owner!==p.owner||
     !phase.permissions?.includes('reinforce')||!phase.permissions?.includes('replace')||
     !Array.isArray(p.source)||p.source.length<3||
     !Number.isInteger(p.initialGroundUnitCount)||p.initialGroundUnitCount<1||
     !Number.isInteger(p.initialSupportMarkerCount)||p.initialSupportMarkerCount<0||
     !Number.isInteger(p.initialCityCount)||p.initialCityCount<1||
     !obj(state.cityControl)||Object.keys(state.cityControl).length!==p.initialCityCount||
     !obj(state.supportMarkers)||Object.keys(state.supportMarkers).length!==p.initialSupportMarkerCount||
     Object.keys(state.units).length!==p.initialGroundUnitCount)
    throw Error('First-turn empty buildup is not source-authorized');
 }
 if(context.firstTurnEmptyBuildupPolicy&&context.buildupPolicy)
  throw Error('Cannot run overlapping buildup controllers');
}
function validateContext(context){
 if(!obj(context)||!obj(context.map)||!obj(context.profile)||!obj(context.config)||
  !obj(context.counterConfig)||!obj(context.combatPolicy)||!obj(context.cursor)||
  !obj(context.state)||typeof context.actor!=='string'||typeof context.enableAirSupport!=='boolean')
  throw Error('Explicit historical campaign source context required');
 const {config,profile,combatPolicy,actor,cursor,state}=context;
 Phase.validate(config);
 if(config.scenarioId!==profile.id||config.scenarioId!==combatPolicy.scenarioId||
    config.scenarioId!==state.scenarioId||config.scenarioId!==cursor.scenarioId)
  throw Error('Campaign scenario configuration mismatch');
 const phase=Phase.current(config,cursor);
 if(!phase||phase.owner!==actor||actor==='system')throw Error('Campaign opening must be a player phase');
 if(!obj(state.units)||Object.entries(state.units).some(([id,u])=>!obj(u)||id!==u.id||typeof u.hex!=='string'||u.owner!==config.players[0]&&u.owner!==config.players[1]))
  throw Error('Campaign ground-unit identity mismatch');
 validateSourcePolicies(context,config,state);
 if(context.housekeepingPolicy)Housekeeping.create({map:context.map,config,policy:context.housekeepingPolicy,
  initialCityControl:context.buildupPolicy.initialCityControl});
 if(context.buildupPolicy)Buildup.create({map:context.map,profile,config,
  counterConfig:context.counterConfig,policy:context.buildupPolicy,allocation:context.buildupAllocation,fixedPolicy:context.fixedPolicy||null,
   combatPolicy:context.combatPolicy});
 const scope=clone({map:context.map,profile,config,counterConfig:context.counterConfig,
  combatPolicy,enableAirSupport:context.enableAirSupport,
  ...(context.rosterOverlay?{rosterOverlay:context.rosterOverlay}:{}),
  buildupPolicy:context.buildupPolicy||null,buildupAllocation:context.buildupAllocation||null,
  ...(context.housekeepingPolicy?{housekeepingPolicy:context.housekeepingPolicy}: {}),
  ...(context.fixedPolicy?{fixedPolicy:context.fixedPolicy}: {}),
  ...(context.firstTurnEmptyBuildupPolicy?{firstTurnEmptyBuildupPolicy:context.firstTurnEmptyBuildupPolicy}: {})});
 const origin=clone({cursor,actor,state});
 return {scopeHash:hash(scope),originHash:hash(origin)};
}
function normalizedAction(input){
 if(!obj(input)||typeof input.type!=='string')throw Error('Invalid campaign action');
 const byType={
  combat:['type','action'],
  'declare-ground-move':['type','request'],
  'commit-forced-port':['type','to'],
  'resolve-ground-move':['type'],
  'resolve-forced-ground-move':['type','die'],
  'declare-fleet-move':['type','to'],
  'roll-fleet-move':['type','die'],
  'finish-phase':['type'],
  'remove-overstack-unit':['type','unitId'],
  'place-reinforcement':['type','slotId','hex'],
  'place-evacuated-reinforcement':['type','unitId','hex'],
  'declare-naval-ground-transport':['type','unitId','destination'],
  'roll-naval-ground-transport':['type','die'],
  'apply-replacement':['type','unitId','hex'],
  'finish-buildup':['type'],
  'finish-housekeeping':['type']
 };
 if(!own(byType,input.type))throw Error('Unsupported campaign action');
 exact(input,byType[input.type],'campaign action');
 if(input.type==='declare-ground-move'){
  const request=input.request;
  if(!obj(request)||typeof request.unitId!=='string'||!Array.isArray(request.path)||
     Object.keys(request).some(k=>!['unitId','path','mode'].includes(k))||
     (request.mode!==undefined&&request.mode!=='rail'))throw Error('Invalid source movement request');
 }
 return clone(input);
}
function currentPhase(context,s){return Phase.current(context.config,s.cursor);}
function combatContext(context,s){
 return {map:context.map,profile:context.profile,config:context.config,
  counterConfig:context.counterConfig,combatPolicy:context.combatPolicy,
  enableAirSupport:context.enableAirSupport,rosterOverlay:context.rosterOverlay||null,cursor:s.cursor,actor:s.actor,state:s.state};
}
function phaseMovement(p){return p&&(p.kind==='movement'||p.kind==='special-movement')&&p.permissions?.includes('move');}
function navalPhase(p){return p?.kind==='naval-operations';}
function supportPhase(p){return p&&['special-movement','naval-operations'].includes(p.kind);}
function createMachine(context){
 const movement=Movement.create({map:context.map,profile:context.profile,
  config:context.config,supportPolicy:context.combatPolicy,counterConfig:context.counterConfig});
 const port=Ports.create({map:context.map,policy:context.combatPolicy,counterConfig:context.counterConfig});
 const support=context.combatPolicy.portSupport?Support.factory({map:context.map,policy:context.combatPolicy,counterConfig:context.counterConfig,
  phaseConfig:context.config}):null;
 const naval=context.buildupPolicy?.navalReplacementPolicy?NavalLogistics.create({
  map:context.map,combatPolicy:context.combatPolicy,counterConfig:context.counterConfig,
  sourcePolicy:context.buildupPolicy.navalReplacementPolicy}):null;
 const active=s=>currentPhase(context,s);
 const emptyBuildup=context.firstTurnEmptyBuildupPolicy||null;
 const emptyBuildupAllowed=s=>Boolean(emptyBuildup&&s.cursor.turn===emptyBuildup.turn&&
  active(s)?.id===emptyBuildup.phaseId&&s.actor===emptyBuildup.owner);
 const buildup=context.buildupPolicy?Buildup.create({map:context.map,profile:context.profile,config:context.config,
  counterConfig:context.counterConfig,policy:context.buildupPolicy,allocation:context.buildupAllocation,fixedPolicy:context.fixedPolicy||null,
  combatPolicy:context.combatPolicy}):null;
 const housekeeping=context.housekeepingPolicy?Housekeeping.create({map:context.map,config:context.config,
  policy:context.housekeepingPolicy,initialCityControl:context.buildupPolicy.initialCityControl,
  communicated:(hex,owner,units)=>buildup.communicated(hex,owner,units)}):null;
 // Only opt-in territorial profiles have this additional source-bound board.
 // MapMovementGraph's existing authorization gate remains authoritative.
 const territoryBoard=context.profile.territorialPolicy?
  MovementBinding.build(context.map,context.profile).board:null;
 const footprints=units=>JSON.stringify(Object.entries(units).sort(([a],[b])=>a.localeCompare(b))
  .map(([id,u])=>[id,u.hex]));
 function skipEmptyNaval(s){
  const phase=active(s);
  if(!navalPhase(phase))return s;
  const marker=context.combatPolicy.portSupport?port.validateMarker(s.state):null;
  let available=false;
  if(marker&&support&&phase.permissions.includes('move-support')){
   available=Object.values(port.portHexes).some(to=>{try{port.validateDestination({state:s.state,to});return true;}catch(_){return false;}});
  }
  if(marker&&naval&&buildup&&phase.permissions.includes('naval-ground-transport')&&!available){
   available=Object.values(s.state.units).some(unit=>{
    if(unit.owner!==s.actor||unit.hex!==marker.hex)return false;
    try{naval.transport({state:s.state,actor:s.actor,unitId:unit.id,destination:{kind:'off-map'},turn:s.cursor.turn,die:6});return true;}catch(_){return false;}
   });
  }
  if(!available){
   s.cursor=Phase.advance(context.config,s.cursor,()=>true);s.actor=active(s)?.owner||'system';
   s.lastEvent={...(s.lastEvent||{}),skippedPhase:phase.id};
   if(active(s)?.kind==='combat')s.combat=Combat.create(combatContext(context,s));
   if(active(s)?.kind==='buildup'&&buildup)s.buildup=buildup.openingPhase();
  }
  return s;
 }
 function finalizeTerritory(s,before,priorPhase){
  if(!territoryBoard||footprints(s.state.units)===before)return priorPhase!==active(s)?.id?skipEmptyNaval(s):s;
  const committed=Territory.commit({profile:context.profile,board:territoryBoard,state:s.state});
  if(!committed.ok)throw Error('Campaign territory transition unverified: '+committed.reason);
  s.state=committed.state;
  if(committed.event)s.lastEvent={...(s.lastEvent||{}),territoryEvent:committed.event};
  return priorPhase!==active(s)?.id?skipEmptyNaval(s):s;
 }
 function pendingReaction(s){
  const req=s.pendingGround;
  if(!req||!context.combatPolicy.portSupport)return {required:false};
  const marker=port.validateMarker(s.state);
  const u=s.state.units[req.unitId],to=req.path.at(-1);
  if(!marker||u.owner===context.combatPolicy.portSupport?.owner||to!==marker.hex||u.hex===to)
   return {required:false};
  const prospective=clone(s.state);
  prospective.units[req.unitId].hex=to;
  return {required:true,options:port.forcedDestinations({state:prospective})};
 }
 function initial(){
  const first=Phase.start(context.config);
  const opening=context.cursor.turn===first.turn&&context.cursor.index===first.index;
  const ground=buildup&&opening?buildup.initialize(context.state):clone(context.state);
  if(buildup&&!opening&&(!ground.cityControl||!ground.buildupDeployedIds))
   throw Error('Continuation buildup requires previously initialized campaign state');
  const state={cursor:clone(context.cursor),actor:context.actor,state:ground,
   usedUnitIds:[],fleetUsed:false,pendingGround:null,pendingPort:null,pendingFleet:null,pendingNavalGround:null,
   lastEvent:null,combat:null,buildup:null,terminal:null};
  if(active(state)?.kind==='combat')state.combat=Combat.create(combatContext(context,state));
  if(active(state)?.kind==='buildup'&&buildup)state.buildup=buildup.openingPhase();
  return state;
 }
 function groundDeclarationGuard(s){
  const phase=active(s);
  if(!phase||phase.owner!==s.actor||s.actor==='system')throw Error('Campaign phase actor mismatch');
  if(!phaseMovement(phase))throw Error('Ground movement not permitted in naval operations');
  if(s.stackingCleanup)throw Error('Movement closed: resolve end-phase overstacking');
  if(s.pendingGround||s.pendingFleet||s.pendingNavalGround)throw Error('Resolve pending movement decision first');
 }
 function validateGroundDeclaration(s,action){
  groundDeclarationGuard(s);
  const req=action.request;
  if(s.usedUnitIds.includes(req.unitId))throw Error('Unit already used this movement phase');
  if(!movement.legal({cursor:s.cursor,actor:s.actor,state:s.state},req))
   throw Error('Ground movement is not source-legal');
 }
 function validateGroundBatch(s,actions){
  groundDeclarationGuard(s);
  const result=actions.map(()=>false),requests=[],indices=[];
  actions.forEach((action,i)=>{
   if(action?.type==='declare-ground-move'&&!s.usedUnitIds.includes(action.request.unitId)){
    indices.push(i);requests.push(action.request);
   }
  });
  const legal=movement.legalBatch({cursor:s.cursor,actor:s.actor,state:s.state},requests);
  indices.forEach((i,j)=>{result[i]=legal[j];});
  return result;
 }
 function step(s,action){
  const priorFootprints=territoryBoard?footprints(s.state.units):null;
  const phase=active(s);
  if(!phase)throw Error('Historical campaign already complete');
  if(phase.owner==='system'){
   if(!housekeeping||phase.kind!=='housekeeping')
    throw Error('Historical phase not yet implemented: '+phase.id);
   if(action.type!=='finish-housekeeping')throw Error('Only housekeeping completion authorized');
   if(s.pendingGround||s.pendingFleet||s.pendingNavalGround||s.pendingPort!==null||s.combat||s.buildup)
    throw Error('Housekeeping cannot bypass unresolved decisions');
   const ending=housekeeping.close({cursor:s.cursor,state:s.state,actor:s.actor});
   s.cursor=Phase.advance(context.config,s.cursor,()=>true);
   s.actor=active(s)?.owner||'system';
   s.terminal=ending.terminal;
   s.lastEvent=ending.event;
   s.usedUnitIds=[];s.fleetUsed=false;s.pendingGround=null;s.pendingFleet=null;s.pendingNavalGround=null;s.pendingPort=null;
   if(active(s)?.kind==='buildup'&&buildup)s.buildup=buildup.openingPhase();
   if(active(s)?.kind==='combat')s.combat=Combat.create(combatContext(context,s));
   return finalizeTerritory(s,priorFootprints,phase.id);
  }
  if(phase.owner!==s.actor)throw Error('Historical phase actor mismatch');
  if(phase.kind==='buildup'){
   if(!buildup&&emptyBuildupAllowed(s)){
    if(s.pendingGround||s.pendingFleet||s.pendingNavalGround||s.combat||s.buildup)
     throw Error('Unresolved choice before zero-action buildup');
    if(action.type!=='finish-buildup')
     throw Error('No replacements or reinforcements on this first-turn buildup');
    s.lastEvent={kind:'buildup-finished',turn:s.cursor.turn,actor:s.actor,
     lostGroundSlotIds:[],supportArrivals:[],forfeitedReplacementSteps:0,
     sourceScope:emptyBuildup.scope};
    s.cursor=Phase.advance(context.config,s.cursor,()=>true);
    s.actor=active(s)?.owner||'system';
    if(active(s)?.kind==='combat')s.combat=Combat.create(combatContext(context,s));
    return finalizeTerritory(s,priorFootprints,phase.id);
   }
   if(!buildup)throw Error('Historical phase not yet implemented: '+phase.id);
   if(s.pendingGround||s.pendingFleet||s.pendingNavalGround||s.combat)throw Error('Buildup phase has incomplete prior transaction');
   if(!s.buildup)s.buildup=buildup.openingPhase();
   if(action.type==='place-reinforcement'){
    const result=buildup.place({state:s.state,cursor:s.cursor,actor:s.actor,phase:s.buildup,slotId:action.slotId,hex:action.hex});
    s.state=result.state;s.buildup=result.phase;s.lastEvent=result.event;
   }else if(action.type==='place-evacuated-reinforcement'){
    const result=buildup.placeEvacuated({state:s.state,cursor:s.cursor,actor:s.actor,phase:s.buildup,unitId:action.unitId,hex:action.hex});
    s.state=result.state;s.buildup=result.phase;s.lastEvent=result.event;
   }else if(action.type==='apply-replacement'){
    const result=buildup.replace({state:s.state,cursor:s.cursor,actor:s.actor,phase:s.buildup,unitId:action.unitId,hex:action.hex});
    s.state=result.state;s.buildup=result.phase;s.lastEvent=result.event;
   }else if(action.type==='finish-buildup'){
    const result=buildup.close({state:s.state,cursor:s.cursor,actor:s.actor,phase:s.buildup});
    s.state=result.state;s.lastEvent=result.event;s.buildup=null;
    s.cursor=Phase.advance(context.config,s.cursor,()=>true);s.actor=active(s)?.owner||'system';
    if(active(s)?.kind==='combat')s.combat=Combat.create(combatContext(context,s));
   }else throw Error('Only source-bound buildup actions permitted during buildup phase');
   return finalizeTerritory(s,priorFootprints,phase.id);
  }
  if(phase.kind==='combat'){
   if(action.type!=='combat')throw Error('Only source-backed combat actions permitted in combat phase');
   if(!s.combat)s.combat=Combat.create(combatContext(context,s));
   const result=s.combat.execute(action.action);
   s.combat=result.session;
   const snapshot=s.combat.snapshot();
   s.cursor=snapshot.cursor;s.state=snapshot.state;
   s.lastEvent=result.event??null;
   if(snapshot.status==='phase-finished'){
    if(buildup)for(const event of snapshot.resolved||[]){
     for(const r of event.retreats||[]){
      const defenderOwner=event.battle?.defenders?.includes(r.unitId)?
       context.config.players.find(p=>p!==s.actor):null;
      if(defenderOwner)buildup.recordControl(s.state,defenderOwner,r.route||[]);
     }
     if(event.advanced)buildup.recordControl(s.state,s.actor,[event.battle.defenderHex]);
    }
    s.actor=active(s)?.owner||'system';
    s.combat=null;
    s.usedUnitIds=[];s.fleetUsed=false;
    if(active(s)?.kind==='buildup'&&buildup)s.buildup=buildup.openingPhase();
   }
   return finalizeTerritory(s,priorFootprints,phase.id);
  }
  if(!phaseMovement(phase)&&!navalPhase(phase))throw Error('Historical phase not yet implemented: '+phase.id);
  if(s.stackingCleanup&&!['remove-overstack-unit','finish-phase'].includes(action.type))throw Error('Resolve end-phase stacking before continuing');
  if(action.type==='remove-overstack-unit'){
   if(!s.stackingCleanup||!phaseMovement(phase)||!Rules.stackPenalty(context.profile,s.state.units,s.actor).choices.includes(action.unitId))
    throw Error('Select an excess friendly ground unit after committing phase completion');
   const hex=s.state.units[action.unitId].hex;delete s.state.units[action.unitId];
   s.lastEvent={kind:'overstack-unit-removed',unitId:action.unitId,hex};
  }else if(action.type==='declare-ground-move'){
   validateGroundDeclaration(s,action);
   const req=action.request;
   s.pendingGround=clone(req);s.pendingPort=null;
  }else if(action.type==='commit-forced-port'){
   if(!s.pendingGround||s.pendingPort||s.pendingFleet||s.pendingNavalGround)throw Error('No uncommitted forced Fleet destination');
   const reaction=pendingReaction(s);
   if(!reaction.required||!reaction.options.some(x=>x.hex===action.to))
    throw Error('Invalid forced Fleet destination');
   s.pendingPort=action.to;
  }else if(['resolve-ground-move','resolve-forced-ground-move'].includes(action.type)){
   if(!s.pendingGround||s.pendingFleet||s.pendingNavalGround)throw Error('No pending ground movement');
   const reaction=pendingReaction(s);
   let request=clone(s.pendingGround);
   if(reaction.required&&reaction.options.length){
    if(action.type!=='resolve-forced-ground-move'||!s.pendingPort||
       !Number.isInteger(action.die)||action.die<1||action.die>6)
     throw Error('Precommit forced Fleet destination before its die roll');
    request.fleetDisplacement={to:s.pendingPort,die:action.die};
   }else if(action.type!=='resolve-ground-move'||s.pendingPort!==null)
    throw Error('No Fleet damage die is authorized for this move');
   const outcome=movement.execute({cursor:s.cursor,actor:s.actor,state:s.state},request);
   if(!outcome.ok)throw Error('Ground movement rejected: '+outcome.reason);
   s.state=outcome.state;s.lastEvent=outcome.result;
   if(buildup)buildup.recordControl(s.state,s.actor,request.path.slice(1));
   s.usedUnitIds.push(request.unitId);s.pendingGround=null;s.pendingPort=null;
  }else if(action.type==='declare-fleet-move'){
   if(!support||!supportPhase(phase)||!phase.permissions?.includes('move-support')||
      s.pendingGround||s.pendingFleet||s.pendingNavalGround||s.fleetUsed)
    throw Error('Fleet movement not available in current phase');
   // This verified transaction validates the owning phase and destination.
   support.create({cursor:s.cursor,actor:s.actor,state:s.state}).declareMove(action.to);
   s.pendingFleet=action.to;
  }else if(action.type==='roll-fleet-move'){
   if(s.pendingFleet===null||s.pendingGround||s.pendingNavalGround)throw Error('Commit Fleet destination before its die');
   const result=support.create({cursor:s.cursor,actor:s.actor,state:s.state})
    .declareMove(s.pendingFleet).resolveDamage(action.die).snapshot();
   s.state=result.state;s.lastEvent=result.event;s.pendingFleet=null;s.fleetUsed=true;
  }else if(action.type==='declare-naval-ground-transport'){
   // Explicit scenario configuration authorizes the timing convention.
   if(!naval||!buildup||!supportPhase(phase)||s.actor!=='soviet'||
      !phase.permissions?.includes('naval-ground-transport')||
      s.pendingGround||s.pendingFleet||s.pendingNavalGround||s.usedUnitIds.includes(action.unitId))
    throw Error('Naval ground transport lacks phase permission or has a pending action');
   if(!obj(action.destination)||!['port','off-map'].includes(action.destination.kind))
    throw Error('Invalid naval destination commitment');
   // A legal dry-run with a non-damaging die validates the destination without
   // consuming a roll or changing any live game state.
   naval.transport({state:s.state,actor:s.actor,unitId:action.unitId,
    destination:action.destination,turn:s.cursor.turn,die:6,
    canOccupyPort:args=>buildup.canReceiveNavalTransport(args)});
   s.pendingNavalGround={unitId:action.unitId,destination:clone(action.destination)};
   s.lastEvent={kind:'naval-ground-transport-declared',unitId:action.unitId,destination:clone(action.destination)};
  }else if(action.type==='roll-naval-ground-transport'){
   if(!naval||!buildup||!s.pendingNavalGround||s.pendingGround||s.pendingFleet||
      !supportPhase(phase)||s.actor!=='soviet'||
      !phase.permissions?.includes('naval-ground-transport'))
    throw Error('Naval transport destination must be committed before damage die');
   const pending=s.pendingNavalGround;
   const result=naval.transport({state:s.state,actor:s.actor,unitId:pending.unitId,
    destination:pending.destination,turn:s.cursor.turn,die:action.die,
    canOccupyPort:args=>buildup.canReceiveNavalTransport(args)});
   s.state=result.state;s.lastEvent=result.event;s.pendingNavalGround=null;
   s.usedUnitIds.push(pending.unitId);
   if(pending.destination.kind==='port'&&result.event.result!=='eliminated')
    buildup.recordControl(s.state,s.actor,[pending.destination.hex]);
  }else if(action.type==='finish-phase'){
   if(s.pendingGround||s.pendingFleet||s.pendingNavalGround)throw Error('Unresolved movement or damage die');
   const penalty=Rules.stackPenalty(context.profile,s.state.units,s.actor);
   if(phaseMovement(phase)&&penalty.excess){
    if(s.stackingCleanup)throw Error('Remove remaining excess units before completing phase');
    s.stackingCleanup=true;s.lastEvent={kind:'overstack-removal-required',hexes:penalty.hexes,excess:penalty.excess};
    return finalizeTerritory(s,priorFootprints,phase.id);
   }
   delete s.stackingCleanup;
   // Movement may be voluntarily omitted; no buildup/reinforcement/housekeeping
   // transition is inferred or silently advanced here.
   s.cursor=Phase.advance(context.config,s.cursor,()=>true);
   s.actor=active(s)?.owner||'system';
   s.usedUnitIds=[];s.fleetUsed=false;s.pendingPort=null;s.pendingNavalGround=null;s.lastEvent={kind:'phase-complete',phaseId:phase.id};
   if(active(s)?.kind==='combat'&&s.actor!=='system')s.combat=Combat.create(combatContext(context,s));
   if(active(s)?.kind==='buildup'&&buildup)s.buildup=buildup.openingPhase();
  }else throw Error('Unsupported movement-phase action: '+action.type);
  return finalizeTerritory(s,priorFootprints,phase.id);
 }
 return {initial,step,validateGroundDeclaration,validateGroundBatch,phase:active,buildupSupported:s=>Boolean(buildup)||emptyBuildupAllowed(s),
  housekeepingEnabled:Boolean(housekeeping)};
}
function snapshotValue(machine,s,length){
 const phase=machine.phase(s);
 return {cursor:s.cursor,actor:s.actor,state:s.state,phaseId:phase?.id||null,
  phaseKind:phase?.kind||null,phaseSupported:Boolean(phase?.kind==='combat'||phaseMovement(phase)||navalPhase(phase)||
   (phase?.kind==='buildup'&&machine.buildupSupported(s))||
   (phase?.kind==='housekeeping'&&Boolean(machine.housekeepingEnabled))),
  usedUnitIds:s.usedUnitIds,fleetUsed:s.fleetUsed,
  pendingGround:s.pendingGround,pendingPort:s.pendingPort,pendingFleet:s.pendingFleet,
  ...(s.pendingNavalGround?{pendingNavalGround:s.pendingNavalGround}:{}),
  combat:s.combat?.snapshot()||null,buildup:s.buildup,lastEvent:s.lastEvent,actionCount:length,
  ...(s.stackingCleanup?{stackingCleanup:true}:{}),
  ...(s.terminal?{terminal:s.terminal}: {})};
}
// Public snapshots remain detached and canonical. Hashing can serialize the
// same private value directly, without first serializing and parsing a copy.
function snapshotOf(machine,s,length){return clone(snapshotValue(machine,s,length));}
function snapshotHash(machine,s,length){return hash(snapshotValue(machine,s,length));}
function replay(context,journal,machine){
 if(!Array.isArray(journal)||journal.length>MAX_ACTIONS)throw Error('Campaign journal length limit');
 let s=machine.initial();const receipts=[];
 for(const item of journal){
  exact(item,['action','stateHash'],'campaign journal record');
  const action=normalizedAction(item.action);
  if(!/^[a-f0-9]{64}$/.test(item.stateHash))throw Error('Invalid campaign journal hash');
  s=machine.step(s,action);
  const actual=snapshotHash(machine,s,receipts.length+1);
  if(item.stateHash!==actual)throw Error('Campaign action replay mismatch');
  receipts.push({action,stateHash:actual});
 }
 return {s,receipts};
}
function makeSession(context,machine,s,records,binding,initialSnapshotText){
 // Cache only the canonical string of this private immutable session; every
 // public snapshot still parses a fresh detached object. Hashes use exactly
 // the same bytes and are never cached across a transaction.
 let snapshotText=initialSnapshotText;
 const canonicalSnapshot=()=>snapshotText??=canonical(snapshotValue(machine,s,records.length));
 function snapshot(){return JSON.parse(canonicalSnapshot());}
 // Committed receipts already contain the canonical digest. The empty opening
 // has no receipt; hash it once, lazily, without constructing a save envelope.
 let stateDigest=records.at(-1)?.stateHash;
 function stateHash(){return stateDigest??=crypto.createHash('sha256').update(canonicalSnapshot()).digest('hex');}
 // One authoritative transaction path for committed actions and disposable
 // read-only legality probes. The probe never creates a campaign journal entry,
 // computes a save hash, or returns mutable draft state to its caller.
 function draftStep(state,action){
  return machine.step({...state,state:clone(state.state),cursor:clone(state.cursor),
   usedUnitIds:[...state.usedUnitIds],pendingGround:clone(state.pendingGround),pendingPort:state.pendingPort,
   pendingFleet:state.pendingFleet,pendingNavalGround:clone(state.pendingNavalGround),combat:state.combat,buildup:clone(state.buildup)},action);
 }
 function adjudicate(input){
  if(records.length>=MAX_ACTIONS)throw Error('Campaign journal length limit');
  const action=normalizedAction(input);
  return {action,next:draftStep(s,action)};
 }
 // Search-only view: no commit, save, undo, journal, RNG or mutable state.
 // Its logical action count still observes the campaign journal limit.
 function projectGround(state,length,input){
  if(length+2>MAX_ACTIONS)throw Error('Campaign journal length limit');
  const action=normalizedAction(input);
  if(action.type!=='declare-ground-move')throw Error('Only deterministic ground movement can be projected');
  const pending=draftStep(state,action);
  const next=draftStep(pending,{type:'resolve-ground-move'}),count=length+2;
  return Object.freeze({snapshot:()=>snapshotOf(machine,next,count),
   canExecuteGroundBatch:inputs=>probeGroundBatch(next,count,inputs),
   projectGroundMove:input=>projectGround(next,count,input)});
 }
 function execute(input){
  const {action,next}=adjudicate(input);
  const nextText=canonical(snapshotValue(machine,next,records.length+1));
  const record={action,stateHash:crypto.createHash('sha256').update(nextText).digest('hex')};
  return Object.freeze({session:makeSession(context,machine,next,[...records,record],binding,nextText),
   event:clone(next.lastEvent)});
 }
 function canExecute(input){
  try{
   // Ground declaration only checks legality and records a pending request.
   // The shared validator delegates to PhaseActions.legal, which detaches
   // its inputs. No board, cursor or territory transition is performed.
   if(records.length>=MAX_ACTIONS)throw Error('Campaign journal length limit');
   if(input?.type==='declare-ground-move')machine.validateGroundDeclaration(s,normalizedAction(input));
   else adjudicate(input);
   return true;
  }catch(_){return false;}
 }
 // Pure batch probe for the catalogue; malformed or non-ground actions
 // are independently false, and phase-wide rejection rejects the batch.
 function probeGroundBatch(state,length,inputs){
  if(!Array.isArray(inputs))throw Error('Invalid ground probe batch');
  try{
   if(length>=MAX_ACTIONS)throw Error('Campaign journal length limit');
   const actions=inputs.map(input=>{try{return normalizedAction(input);}catch(_){return null;}});
   return machine.validateGroundBatch(state,actions);
  }catch(_){return inputs.map(()=>false);}
 }
 function undo(){
  if(!records.length)return Object.freeze({ok:false,reason:'nothing-to-undo',session:makeSession(context,machine,s,records,binding)});
  const previous=replay(context,records.slice(0,-1),machine);
  return Object.freeze({ok:true,session:makeSession(context,machine,previous.s,previous.receipts,binding)});
 }
 function save(){
  const payload={format:FORMAT,version:VERSION,scenarioId:context.config.scenarioId,
   bindings:clone(binding),origin:clone({cursor:context.cursor,actor:context.actor,state:context.state}),
   journal:clone(records),finalStateHash:stateHash()};
  return {...payload,integrity:{algorithm:'SHA-256',digest:hash(payload)}};
 }
 // Copy the small action ledger without rehashing the whole opening and save.
 function journal(){return clone(records);}
 return Object.freeze({snapshot,execute,canExecute,canExecuteGroundBatch:inputs=>probeGroundBatch(s,records.length,inputs),projectGroundMove:input=>projectGround(s,records.length,input),undo,save,journal,stateHash});
}
function create(context){
 const binding=validateContext(context),source=MovementBinding.prepareContext(clone(context)),machine=createMachine(source);
 return makeSession(source,machine,machine.initial(),[],binding);
}
function restore(saved,context){
 canonical(saved);
 exact(saved,['format','version','scenarioId','bindings','origin','journal','finalStateHash','integrity'],'campaign save');
 if(saved.format!==FORMAT||saved.version!==VERSION||saved.scenarioId!==context?.config?.scenarioId)
  throw Error('Unsupported campaign save version or scenario');
 exact(saved.integrity,['algorithm','digest'],'campaign integrity');
 if(saved.integrity.algorithm!=='SHA-256'||!/^[a-f0-9]{64}$/.test(saved.integrity.digest))
  throw Error('Invalid campaign checksum');
 const {integrity,...payload}=saved,computed=hash(payload);
 if(!crypto.timingSafeEqual(Buffer.from(integrity.digest,'hex'),Buffer.from(computed,'hex')))
  throw Error('Campaign save checksum mismatch');
 const binding=validateContext(context);
 exact(saved.bindings,['scopeHash','originHash'],'campaign binding');
 if(saved.bindings.scopeHash!==binding.scopeHash){
  const legacy=clone(context);
  if(legacy.profile.allowTemporaryMovementOverstack!==true)throw Error('Campaign source/configuration mismatch');
  delete legacy.profile.allowTemporaryMovementOverstack;
  if(saved.bindings.scopeHash!==validateContext(legacy).scopeHash)throw Error('Campaign source/configuration mismatch');
 }
 if(saved.bindings.originHash!==binding.originHash||hash(saved.origin)!==binding.originHash)
  throw Error('Campaign opening state mismatch');
 const source=MovementBinding.prepareContext(clone(context)),machine=createMachine(source),result=replay(source,saved.journal,machine);
 if(!/^[a-f0-9]{64}$/.test(saved.finalStateHash)||
    snapshotHash(machine,result.s,result.receipts.length)!==saved.finalStateHash)
  throw Error('Campaign final replay mismatch');
 return makeSession(source,machine,result.s,result.receipts,binding);
}
module.exports=Object.freeze({FORMAT,VERSION,MAX_ACTIONS,create,restore});

};
defs["core/historical_deployment_session.js"]=function(module,exports,require,Buffer){
/* Shared, source-constrained pregame deployment session (v404).
 * Placement/identity choices are validated by the SAME scenario setup and
 * inventory modules used by the campaign opening bridge. No scenario-ID
 * branching or alternative gameplay rules. A local browser cannot guarantee
 * adversarial secrecy of unrevealed counter faces.
 */
'use strict';
const crypto=require('node:crypto');
const Setup=require('./scenario_starting_setup');
const Bridge=require('./scenario_opening_bridge');
const Fixed=require('./historical_fixed_source_pieces');
const {clone,equal,checksum:sha,object}=require('./historical_campaign_json');
const FORMAT='historical-source-deployment',VERSION=1;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function make(source,allocation,placements,mixed=false){
 if(typeof mixed!=='boolean')throw Error('Invalid concealed-counter mixing status');
 const concealed=source.setupSpec?.concealedSetup;
 if(concealed&&(!Array.isArray(concealed.groups)||!concealed.groups.length||!Number.isInteger(concealed.count)||concealed.count<1))
  throw Error('Invalid scenario-configured concealed setup');
 const {map,setupSpec,counterConfig,inventory,phaseConfig,movementProfile,phaseFactories,supportPolicy,fixedPolicy}=source;
 if(!map||!setupSpec||!counterConfig||!inventory||!phaseConfig||!movementProfile)
  throw Error('Source-verified deployment configuration required');
 const checked=Setup.validate({map,spec:setupSpec,counterConfig,inventory,allocation,placements});
 if(!checked.valid)throw Error('Illegal historical deployment: '+checked.errors.join('; '));
 const alloc=clone(allocation),pos=clone(placements);
 const preview=fixedPolicy?Fixed.initialize({map,counterConfig,policy:fixedPolicy,state:checked.state}).state:checked.state;
 const slotList=Setup.slots(map,setupSpec).slots;
 const groupByFace=new Map();
 for(const [g,ids] of Object.entries(alloc))if(own(setupSpec.groups,g))for(const id of ids)groupByFace.set(id,g);
 const allFaces=new Map(counterConfig.faces.front.map(f=>[f.faceId,f]));
 function choices(id){
  const group=groupByFace.get(id);if(!group)throw Error('Not a starting source counter '+id);
  const g=setupSpec.groups[group];
  // A symbol shared by multiple armies is not a universal placement region.
  // Example: Kiev's 11 Axis crosses comprise separate Polish and Romanian
  // setup groups. Do not advertise foreign-country hexes as destinations.
  const allowed=g.allowedHexes?new Set(g.allowedHexes):null;
  return slotList[g.marker].map(x=>x.hex).filter(id=>!allowed||allowed.has(id)).sort();
 }
 function move(id,to){
  if(!groupByFace.has(id))throw Error('Not a starting source counter');
  if(!choices(id).includes(to))throw Error('Destination is not a source-approved deployment marker');
  const proposed=clone(pos);proposed[id]=to;
  return make(source,alloc,proposed,mixed);
 }

 function swapPositions(a,b){
  if(a===b||!groupByFace.has(a)||!groupByFace.has(b))throw Error('Two distinct starting units required');
  const groupA=setupSpec.groups[groupByFace.get(a)],groupB=setupSpec.groups[groupByFace.get(b)];
  if(groupA.marker!==groupB.marker)throw Error('Starting units must use the same deployment marker');
  const proposed=clone(pos);proposed[a]=pos[b];proposed[b]=pos[a];
  return make(source,alloc,proposed,mixed);
 }
 function swapFaces(a,b){
  if(typeof a!=='string'||typeof b!=='string'||a===b||!allFaces.has(a)||!allFaces.has(b))
   throw Error('Two distinct source-face identities required');
  const next=clone(alloc),locA=pos[a],locB=pos[b];
  let foundA=0,foundB=0;
  for(const ids of Object.values(next))for(let i=0;i<ids.length;i++){
   if(ids[i]===a){ids[i]=b;foundA++}else if(ids[i]===b){ids[i]=a;foundB++}
  }
  if(foundA!==1||foundB!==1)throw Error('Both faces must have exactly one source allocation');
  const proposed=clone(pos);delete proposed[a];delete proposed[b];
  if(locA!==undefined)proposed[b]=locA;
  if(locB!==undefined)proposed[a]=locB;
  return make(source,next,proposed,mixed);
 }
 function permute(groupNames,newOrder){
  if(!Array.isArray(groupNames)||!groupNames.length||!Array.isArray(newOrder))throw Error('Explicit groups and permutation required');
  const old=groupNames.flatMap(g=>{
   if(!(own(setupSpec.groups,g)||own(inventory.policy?.groups||{},g))||!Array.isArray(alloc[g]))throw Error('Invalid source deployment group');
   return alloc[g];
  });
  if(newOrder.length!==old.length||new Set(newOrder).size!==old.length||
    !equal([...newOrder].sort(),[...old].sort()))throw Error('Permutation must use exactly the source-deployed counters');
  const next=clone(alloc),proposed=clone(pos);let index=0;
  for(const g of groupNames){next[g]=alloc[g].map(()=>newOrder[index++])}
  for(const id of old)delete proposed[id];
  for(let i=0;i<old.length;i++)if(own(pos,old[i]))proposed[newOrder[i]]=pos[old[i]];
  return make(source,next,proposed,concealed&&equal([...groupNames].sort(),[...concealed.groups].sort())&&old.length===concealed.count?true:mixed);
 }
 function commit({requireMixed=false}={}){
  if(requireMixed&&concealed?.requireMixBeforeCampaign&&!mixed)throw Error('The concealed source counters must be mixed before play');
  const bridge=Bridge.create({map,setupSpec,counterConfig,inventory,
   allocation:alloc,placements:pos,phaseConfig,movementProfile,
   phaseFactories:phaseFactories||{combat:()=>({})},supportPolicy,fixedPolicy});
  return Object.freeze({opening:bridge.snapshot(),allocation:clone(alloc),placements:clone(pos),audit:bridge.setupAudit()});
 }
 function save(){
  const payload={format:FORMAT,version:VERSION,scenarioId:setupSpec.scenarioId,allocation:clone(alloc),placements:clone(pos),concealedMixed:mixed};
  return {...payload,integrity:{algorithm:'SHA-256',digest:sha(payload)}};
 }
 return Object.freeze({choices,move,swapPositions,swapFaces,permute,commit,save,
  snapshot:()=>clone({allocation:alloc,placements:pos,units:preview.units,
   disagreements:checked.printedAnchorDisagreements,concealedMixed:mixed,valid:true}),
  groups:()=>clone(setupSpec.groups)});
}
function create(args={}){
 if(!object(args))throw Error('Source deployment inputs required');
 const {allocation,placements,...source}=args;
 return make(source,allocation,placements);
}
function restore(saved,source){
 if(!object(saved)||!object(saved.integrity)||saved.format!==FORMAT||saved.version!==VERSION||
  saved.integrity.algorithm!=='SHA-256'||typeof saved.integrity.digest!=='string'||
  !/^[a-f0-9]{64}$/.test(saved.integrity.digest)||
  Object.keys(saved).sort().join(',')!==['format','version','scenarioId','allocation','placements','concealedMixed','integrity'].sort().join(','))
  throw Error('Invalid deployment save');
 const {integrity,...payload}=saved;
 if(!crypto.timingSafeEqual(Buffer.from(integrity.digest,'hex'),Buffer.from(sha(payload),'hex')))
  throw Error('Deployment save checksum mismatch');
 if(saved.scenarioId!==source.setupSpec?.scenarioId)throw Error('Deployment source scenario mismatch');
 return make(source,saved.allocation,saved.placements,saved.concealedMixed);
}
module.exports=Object.freeze({FORMAT,VERSION,create,restore});

};
defs["core/historical_housekeeping_phase.js"]=function(module,exports,require,Buffer){
/* Shared, source-configured historical housekeeping and terminal city scoring.
 * Source-configured rule forms: literal city-count thresholds (The Arduous
 * Beginning and Kiev §5), conditional isolation draw (Leningrad §5), and
 * Odessa §5's 20-city two-tier isolation outcomes.
 * No scenario-ID branches, no guessed result for unclassified source cases.
 */
'use strict';
const Graduated=require('./graduated_mode');
const clone=v=>JSON.parse(JSON.stringify(v));
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function create({map,config,policy,initialCityControl,communicated=null}){
 const conditionalDraw=policy?.mode==='source-literal-unclassified-cases';
 const countDraw=policy?.mode==='city-count-three-way-v1';
 const twoTierIsolation=policy?.mode==='two-tier-city-isolation-v1';
 if(!obj(map)||!Array.isArray(map.cells)||!obj(config)||!obj(policy)||!obj(initialCityControl)||
    policy.schemaVersion!==1||policy.scenarioId!==config.scenarioId||
    !Array.isArray(policy.source)||!policy.source.length||!(conditionalDraw||countDraw||twoTierIsolation)||
    !Array.isArray(config.players)||!config.players.includes(policy.axisOwner)||!config.players.includes(policy.defenderOwner)||
    policy.axisOwner===policy.defenderOwner||!Number.isInteger(policy.cityCount)||
    !Number.isInteger(policy.germanVictoryAtLeast)||!Number.isInteger(policy.sovietVictoryAtMost)||
    !obj(policy.draw)||!Number.isInteger(policy.draw.axisCityCount)||
    (conditionalDraw&&(typeof policy.draw.onlyRemainingCity!=='string'||
      policy.draw.mustBeIsolatedFromDefenderEdge!==true||!['unresolved-source-rule',policy.defenderOwner+'-victory'].includes(policy.unclassifiedOutcome)))||
    (countDraw&&(Object.keys(policy.draw).length!==1||Object.hasOwn(policy,'unclassifiedOutcome')||
      policy.initialDefaultOwner!==policy.defenderOwner||!obj(policy.initialControlOverrides)))||
    (twoTierIsolation&&(Object.keys(policy.draw).length!==3||
      !Number.isInteger(policy.draw.twoRemainingAxisCityCount)||
      policy.draw.mustBeIsolatedFromDefenderEdge!==true||
      !obj(policy.sourceCityHexes)||
      policy.initialDefaultOwner!==policy.defenderOwner||
      !obj(policy.initialControlOverrides)||Object.hasOwn(policy,'unclassifiedOutcome'))))
  throw Error('Invalid source-bound housekeeping and victory policy');
 const names=map.cells.filter(c=>c.city?.name).map(c=>c.city.name);
 if(new Set(names).size!==names.length||names.length!==policy.cityCount||
    Object.keys(initialCityControl).length!==names.length||
    names.some(n=>!Object.hasOwn(initialCityControl,n)||!config.players.includes(initialCityControl[n]))||
    ((countDraw||twoTierIsolation)&&(Object.keys(policy.initialControlOverrides).some(n=>!names.includes(n)||
       !config.players.includes(policy.initialControlOverrides[n])||policy.initialControlOverrides[n]===policy.initialDefaultOwner)||
      names.some(n=>initialCityControl[n]!==
       (policy.initialControlOverrides[n]||policy.initialDefaultOwner))))||
    (twoTierIsolation&&(Object.keys(policy.sourceCityHexes).length!==names.length||
      map.cells.filter(c=>c.city?.name).some(c=>policy.sourceCityHexes[c.city.name]!==c.id)||
      policy.sovietVictoryAtMost!==policy.cityCount-3||
      policy.draw.twoRemainingAxisCityCount!==policy.cityCount-2||
      policy.draw.axisCityCount!==policy.cityCount-1))||
    (conditionalDraw&&!names.includes(policy.draw.onlyRemainingCity))||
    policy.germanVictoryAtLeast!==policy.cityCount||
    policy.sovietVictoryAtMost!==policy.draw.axisCityCount-(twoTierIsolation?2:1)||
    policy.draw.axisCityCount!==policy.cityCount-1||
    config.phases?.at(-1)?.kind!=='housekeeping'||config.phases.at(-1)?.owner!=='system')
  throw Error('Housekeeping city or phase configuration does not match registered map');
 if(policy.graduatedVictory!==undefined)Graduated.validate(config.scenarioId,policy.graduatedVictory);
 const targetHex=conditionalDraw?map.cells.find(c=>c.city?.name===policy.draw.onlyRemainingCity).id:null;
 function evaluate(state){
  if(!obj(state)||!obj(state.cityControl)||!obj(state.units)||
     Object.keys(state.cityControl).length!==names.length||
     names.some(n=>!config.players.includes(state.cityControl[n])))
   throw Error('Uninitialized or malformed final city-control state');
  const axisControlled=names.filter(n=>state.cityControl[n]===policy.axisOwner);
  const count=axisControlled.length;
  let outcome,reason,isolated=null;
  const remaining=names.filter(n=>state.cityControl[n]===policy.defenderOwner);
  let cityIsolation=null;
  function sourceIsolation(city){
   if(typeof communicated!=='function')throw Error('Certified communication graph required for Odessa isolation test');
   const hex=policy.sourceCityHexes[city];
   const connected=communicated(hex,policy.defenderOwner,state.units);
   if(typeof connected!=='boolean')throw Error('Non-boolean source communication result for '+city);
   return !connected;
  }
  if(count>=policy.germanVictoryAtLeast){outcome=policy.axisOwner+'-victory';reason='axis-controls-all-cities';}
  else if(count<=policy.sovietVictoryAtMost){outcome=policy.defenderOwner+'-victory';reason='axis-controls-at-most-threshold';}
  else if(twoTierIsolation){
   cityIsolation=Object.fromEntries(remaining.map(city=>[city,sourceIsolation(city)]));
   isolated=remaining.some(city=>cityIsolation[city]);
   if(count===policy.draw.axisCityCount){
    outcome=isolated?policy.axisOwner+'-victory':'draw';
    reason=isolated?'one-remaining-city-isolated':'one-remaining-city-communicating';
   }else if(count===policy.draw.twoRemainingAxisCityCount){
    outcome=isolated?'draw':policy.defenderOwner+'-victory';
    reason=isolated?'at-least-one-of-two-cities-isolated':'both-remaining-cities-communicating';
   }else throw Error('Odessa source victory breakpoint coverage incomplete');
  }
  else if(count===policy.draw.axisCityCount){
   if(countDraw){outcome='draw';reason='axis-controls-draw-threshold';}
   else if(state.cityControl[policy.draw.onlyRemainingCity]===policy.defenderOwner){
    if(typeof communicated!=='function')throw Error('Certified communication graph required for draw test');
    isolated=!communicated(targetHex,policy.defenderOwner,state.units);
    if(isolated){outcome='draw';reason='only-target-city-remains-and-isolated';}
   }
  }
  if(!outcome){outcome=policy.unclassifiedOutcome;reason=outcome===policy.defenderOwner+'-victory'?'author-approved-unclassified-outcome':'published-rule-has-no-explicit-result';}
  const graded=policy.graduatedVictory?Graduated.evaluate(policy.graduatedVictory,state.cityControl):null;
  const historical=graded?{outcome,reason}:null;
  if(graded){outcome=graded.winner==='draw'?'draw':graded.winner+'-victory';reason='experimental-graduated-victory';}
  return Object.freeze({outcome,reason,...(graded?{graduated:graded,historical}:{}),axisControlledCount:count,totalCities:names.length,
   onlyRemainingCity:conditionalDraw?policy.draw.onlyRemainingCity:null,onlyRemainingCityIsolated:isolated,
   ...(twoTierIsolation?{remainingSovietCities:remaining,isolatedSovietCities:remaining.filter(c=>cityIsolation?.[c]),
    cityIsolation}:{}),
   cityControl:clone(state.cityControl)});
 }
 function close({cursor,state,actor}){
  if(!obj(cursor)||cursor.scenarioId!==config.scenarioId||cursor.complete||
     cursor.index!==config.phases.length-1||!Number.isInteger(cursor.turn)||
     cursor.turn<1||cursor.turn>config.turns||actor!=='system')
   throw Error('Housekeeping requires current system phase and legal turn');
  const last=cursor.turn===config.turns;
  const terminal=last?evaluate(state):null;
  return Object.freeze({terminal,event:{kind:last?'campaign-completed':'turn-completed',
   turn:cursor.turn,nextTurn:last?null:cursor.turn+1,...(terminal?{terminal}: {})}});
 }
 return Object.freeze({close,evaluate});
}
module.exports=Object.freeze({create});

};
defs["core/historical_source_face_inventory.js"]=function(module,exports,require,Buffer){
/* Source-face inventory driven entirely by per-scenario counter-pool and
 * allocation configuration. Not a gameplay engine and never auto-selects units.
 * The caller supplies the counter sheets, allocation and the source rule policy.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameHistoricalSourceFaceInventory=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const fail=m=>{throw Error('source-face-inventory: '+m);};
const clone=v=>JSON.parse(JSON.stringify(v));
function create(policy){
 if(!policy||policy.schemaVersion!==1||!policy.scenarioId||!policy.source||!policy.pools||!policy.groups||!Array.isArray(policy.groundPools))fail('invalid-policy');
 const pools=Object.entries(policy.pools),groups=Object.entries(policy.groups);
 for(const [name,p] of pools)if(!name||!p||!Number.isInteger(p.count)||p.count<1||!p.affiliation||
    !(typeof p.kind==='string'&&p.kind||Array.isArray(p.kinds)&&p.kinds.length>1&&p.kinds.every(k=>typeof k==='string'&&k)&&new Set(p.kinds).size===p.kinds.length)||
    typeof p.printedValuesPattern!=='string')fail('invalid-pool:'+name);
 for(const [name,g] of groups)if(!name||!g||!policy.pools[g.pool]||!Number.isInteger(g.count)||g.count<1)fail('invalid-group:'+name);
 function inspect(config){
  if(config?.mapId!==policy.scenarioId||!Array.isArray(config.faces?.front)||!Array.isArray(config.faces?.back))fail('counter-source-mismatch');
  const errors=[],fronts=config.faces.front,backs=new Map(config.faces.back.map(f=>[f.faceId,f]));
  const result=Object.fromEntries(pools.map(([n])=>[n,[]]));
  if(backs.size!==config.faces.back.length||new Set(fronts.map(f=>f.faceId)).size!==fronts.length)errors.push('Duplicate counter-face IDs');
  const paired=new Set();
  for(const face of fronts){
   const back=backs.get(face.pairedFaceId),t=face.visualTranscription||{};
   if(!back||back.pairedFaceId!==face.faceId||paired.has(face.pairedFaceId)){errors.push('Invalid face pairing '+face.faceId);continue;}
   paired.add(face.pairedFaceId);
   let matching=[];
   for(const [name,p] of pools){
    const rx=new RegExp(p.printedValuesPattern);
    if(t.printedAffiliation===p.affiliation&&(p.kinds?p.kinds.includes(t.kind):t.kind===p.kind)&&rx.test(t.printedValues||''))matching.push(name);
   }
   if(matching.length!==1){errors.push('Unclassified or ambiguous front face '+face.faceId);continue;}
   const name=matching[0],spec=policy.pools[name];
   if(spec.reverseKind && back.visualTranscription?.kind!==spec.reverseKind)errors.push('Reverse kind mismatch '+face.faceId);
   if(spec.reverseMatchesFrontKind===true&&back.visualTranscription?.kind!==t.kind)errors.push('Reverse kind does not match photographed front '+face.faceId);
   if(spec.reverseAffiliation && back.visualTranscription?.printedAffiliation!==spec.reverseAffiliation)errors.push('Reverse affiliation mismatch '+face.faceId);
   result[name].push(face.faceId);
  }
  if(paired.size!==backs.size)errors.push('Unpaired reverse faces');
  for(const [name,p] of pools)if(result[name].length!==p.count)errors.push('Wrong pool '+name+': '+result[name].length+' expected '+p.count);
  for(const name of policy.groundPools)if(!policy.pools[name])errors.push('Missing ground pool '+name);
  return Object.freeze({valid:errors.length===0,errors,counts:Object.fromEntries(pools.map(([n])=>[n,result[n].length])),pools:clone(result),historicalSetupAuthorized:false});
 }
 function validateAllocation(config,allocation){
  const scanned=inspect(config),errors=[...scanned.errors],seen=new Set();
  if(!allocation||typeof allocation!=='object'||Array.isArray(allocation))fail('allocation-required');
  for(const key of Object.keys(allocation))if(!policy.groups[key])errors.push('Unknown group '+key);
  for(const [name,g] of groups){
   const values=allocation[name];
   if(!Array.isArray(values)||values.length!==g.count){errors.push('Invalid count '+name);continue;}
   for(const id of values){
    if(!scanned.pools[g.pool]?.includes(id))errors.push('Invalid face for '+name+': '+id);
    const trans=config.faces.front.find(face=>face.faceId===id)?.visualTranscription;
    if(g.printedValuesPattern&&(!trans||!new RegExp(g.printedValuesPattern).test(trans.printedValues||'')))
     errors.push('Wrong rulebook strength for '+name+': '+id);
    if(g.printedKinds&&(!Array.isArray(g.printedKinds)||!g.printedKinds.includes(trans?.kind)))
     errors.push('Wrong rulebook unit kind for '+name+': '+id);
    if(seen.has(id))errors.push('Duplicated allocated face '+id);
    seen.add(id);
   }
  }
  for(const name of policy.groundPools)for(const id of scanned.pools[name])if(!seen.has(id))errors.push('Unallocated ground face '+id);
  return Object.freeze({valid:errors.length===0,errors,allGroundAssigned:errors.length===0,sourceRule:policy.source,historicalSetupAuthorized:false});
 }
 return Object.freeze({inspect,validateAllocation,policy:clone(policy)});
}
return Object.freeze({create});
});

};
defs["core/leningrad_starting_inventory.js"]=function(module,exports,require,Buffer){
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

};
defs["core/scenario_opening_bridge.js"]=function(module,exports,require,Buffer){
/* Cross-game candidate setup -> true first-turn phase bridge.
 * All placement and turn-order data comes from scenario configurations.
 * Does not advance a phase, adjudicate combat, or authorize historical setup.
 * A supplied phase factory is independently responsible for source-backed
 * operation legality. The bridge never bypasses or synthesizes a phase.
 */
(function(root,factory){
 const Setup=typeof module==='object'&&module.exports?require('./scenario_starting_setup'):root.WargameScenarioStartingSetup;
 const Phase=typeof module==='object'&&module.exports?require('./phase_runtime'):root.WargamePhaseRuntime;
 const Ports=typeof module==='object'&&module.exports?require('./historical_port_support'):root.WargameHistoricalPortSupport;
 const Fixed=typeof module==='object'&&module.exports?require('./historical_fixed_source_pieces'):root.WargameHistoricalFixedSourcePieces;
 const api=factory(Setup,Phase,Ports,Fixed);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameScenarioOpeningBridge=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Setup,Phase,Ports,Fixed){'use strict';
 const clone=v=>JSON.parse(JSON.stringify(v));
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 function create({map,setupSpec,counterConfig,inventory,allocation,placements,phaseConfig,movementProfile,phaseFactories,supportPolicy,fixedPolicy}={}){
  if(!map||!setupSpec||!phaseConfig||!movementProfile||!object(phaseFactories))
   throw Error('Explicit map, setup, phase, movement and phase factories required');
  Phase.validate(phaseConfig);
  if(!setupSpec.scenarioId||setupSpec.scenarioId!==phaseConfig.scenarioId||movementProfile.id!==phaseConfig.scenarioId)
   throw Error('Opening scenario configuration mismatch');
  const report=Setup.validate({map,spec:setupSpec,counterConfig,inventory,allocation,placements});
  if(!report.valid||!report.state)throw Error('Opening setup is invalid: '+report.errors.join('; '));
  const cursor=Phase.start(phaseConfig);
  const phase=Phase.current(phaseConfig,cursor);
  if(!phase||phase.owner==='system')throw Error('Opening phase must have a player actor');
  const handler=own(phaseFactories,phase.kind)?phaseFactories[phase.kind]:null;
  if(own(phaseFactories,phase.kind)&&typeof handler!=='function')throw Error('Invalid opening phase factory');
  // Copies prevent mutations of configuration/placement after binding from
  // rewriting the source-checked opening position and phase cursor.
  const sourceMap=clone(map),config=clone(phaseConfig),profile=clone(movementProfile);
  // Source-configured, optional support-marker setup. Existing non-Fleet
  // scenarios receive precisely their previous ground-unit-only state.
  if(supportPolicy&&!supportPolicy.portSupport)throw Error('Source-configured support marker policy required');
  const supportState=supportPolicy?Ports.create({map,policy:supportPolicy,counterConfig})
   .initialize({state:report.state}).state:report.state;
  const fixed=fixedPolicy?Fixed.initialize({map,counterConfig,policy:fixedPolicy,state:supportState}):null;
  const state=fixed?.state||supportState;
  const opening=clone({cursor,actor:phase.owner,state});
  const audit=clone({startingUnits:Object.keys(state.units).length,sourceFaceStartingUnits:report.startingUnitCount,
   fixedSourcePieces:fixed?.audit||[],printedAnchorAgreement:report.printedAnchorAgreement,
   printedAnchorDisagreements:report.printedAnchorDisagreements,scope:report.setupScope});
  function snapshot(){return clone(opening);}
  function firstPhase(){return clone(Phase.current(config,opening.cursor));}
  function controller(){
   if(!handler)throw Error('No verified opening phase controller registered for '+phase.kind);
   return handler({map:clone(sourceMap),profile:clone(profile),config:clone(config),...snapshot()});
  }
  return Object.freeze({status:'candidate-physical-setup-preview',historicalSetupAuthorized:false,
   productionGameActivated:false,snapshot,firstPhase,controller,setupAudit:()=>clone(audit)});
 }
 return Object.freeze({create});
});

};
})(globalThis);
