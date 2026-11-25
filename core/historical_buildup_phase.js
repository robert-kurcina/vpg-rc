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
