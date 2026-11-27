/* GENERATED. Do not edit. */
(function(root){"use strict";const r=root.__historicalBundle;if(!r||r.revision!=="e0ca1ff64b70e10215a98ab99974041ad6f7b1e63484032c38704d0272616c48")throw Error("Historical bundle version mismatch");const defs=r.definitions,parts=r.parts;
defs["core/composite_entry_border_reconciliation.js"]=function(module,exports,require,Buffer){
/* Source-pinned, read-only entry boundary topology audit.
 * A geometric exterior side is a candidate source mark, NOT a certified legal
 * reinforcement side or communication endpoint. Never promote from this layer.
 */
'use strict';
const T=require('./terrain_tiles');
const fail=s=>{throw Error('composite-entry-border: '+s);};
const key=e=>e.cellId+':'+e.dir;
function reconcile(map,evidence){
 if(!map?.geometry||!Array.isArray(map.cells)||map.cells.length!==261||!map.id||
    evidence?.schemaVersion!==1||evidence.mapId!==map.id||
    evidence.certification!=='GEOMETRIC_TOPOLOGY_ONLY_NOT_REINFORCEMENT_OR_VICTORY_AUTHORITY')
  fail('unverified-composite-board');
 const trace=map.entryBoundarySelections;
 if(trace?.status!=='SOURCE_GUIDED_VISUAL_GEOMETRY_NOT_RULE_CERTIFIED'||
    evidence.sourceStatus!==trace.status||trace.sourceSvgSha256!==evidence.sourceSvgSha256||
    !Array.isArray(trace.paths)||trace.paths.length!==2||!Array.isArray(evidence.paths)||evidence.paths.length!==2)
  fail('source-evidence-disagreement');
 const cells=new Map(map.cells.map(c=>[c.id,c]));
 if(cells.size!==261||map.cells.some(c=>!c.pixelCenter||!T.DIRS.length||!c.terrain))fail('invalid-composite-cells');
 const names=new Set();const paths={};
 for(let i=0;i<trace.paths.length;i++){
  const p=trace.paths[i],record=evidence.paths[i];
  if(!p||!record||!['soviet','german'].includes(p.side)||names.has(p.side)||
     record.side!==p.side||record.sourceSvgId!==p.sourceSvgId||
     record.sourceStatus!==p.status||!Array.isArray(p.edges)||
     !Array.isArray(record.orderedSides)||record.orderedSides.length!==p.edges.length)
   fail('source-trace-path-mismatch');
  names.add(p.side);
  const seen=new Set(),exterior=[],internal=[];
  for(let j=0;j<p.edges.length;j++){
   const side=p.edges[j],pin=record.orderedSides[j];
   if(!side||!T.DIRS.includes(side.dir)||!cells.has(side.cellId)||
      cells.get(side.cellId).terrain==='sea'||seen.has(key(side))||
      !pin||pin.hex!==side.cellId||pin.dir!==side.dir)
    fail('source-side-ledger-mismatch');
   seen.add(key(side));
   const adjacent=T.neighbor(cells.get(side.cellId),side.dir,map.geometry);
   const isInternal=cells.has(adjacent);
   if(pin.topology!==(isInternal?'internal':'exterior')||
      (isInternal&&pin.adjacentHex!==adjacent)||
      (!isInternal&&Object.hasOwn(pin,'adjacentHex')))
    fail('source-side-topology-drift');
   const item=Object.freeze({hex:side.cellId,dir:side.dir, ...(isInternal?{adjacentHex:adjacent}:{})});
   (isInternal?internal:exterior).push(item);
  }
  paths[p.side]=Object.freeze({side:p.side,sourceSvgId:p.sourceSvgId,
   exterior:Object.freeze(exterior),internal:Object.freeze(internal),
   exteriorCandidateHexes:Object.freeze([...new Set(exterior.map(x=>x.hex))].sort()),
   totalMarkedSides:p.edges.length});
 }
 if(names.size!==2||!names.has('soviet')||!names.has('german'))fail('missing-faction-border');
 // The source-authoritative composite record is distinct from the older Kiev
 // trace above. The extension adds a real SOUTHERN eastern edge; ignoring it
 // would incorrectly constrain Odessa's reinforcement and communication audit.
 const active=evidence.activeComposite;
 if(map.authoritativeSourceGeometry?.sha256!==evidence.activeSourceSvgSha256||
    active?.status!=='USER_SVG_REGISTERED_COMPOSITE_EXTERIOR_GEOMETRY_NO_RULES_AUTHORITY'||
    !Array.isArray(map.compositeEntryEdges)||!Array.isArray(active.orderedSides)||
    active.orderedSides.length!==map.compositeEntryEdges.length)
  fail('active-composite-source-disagreement');
 const activePaths={soviet:[],german:[]},activeSeen=new Set();
 for(let i=0;i<map.compositeEntryEdges.length;i++){
  const raw=map.compositeEntryEdges[i],pin=active.orderedSides[i];
  if(!raw||!pin||!['soviet','german'].includes(raw.side)||!cells.has(raw.cellId)||
     !T.DIRS.includes(raw.dir)||raw.side!==pin.side||raw.cellId!==pin.hex||
     raw.dir!==pin.dir||raw.sourceSvgId!==pin.sourceSvgId||
     raw.offsetPx!==pin.offsetPx||activeSeen.has(key(raw)))
   fail('active-composite-side-ledger-drift');
  activeSeen.add(key(raw));
  if(cells.get(raw.cellId).terrain==='sea'||cells.has(T.neighbor(cells.get(raw.cellId),raw.dir,map.geometry)))
   fail('active-composite-side-not-exterior');
  activePaths[raw.side].push(Object.freeze({hex:raw.cellId,dir:raw.dir,sourceSvgId:raw.sourceSvgId}));
 }
 const activeOutput=Object.fromEntries(['soviet','german'].map(side=>[side,Object.freeze({
  side,exterior:Object.freeze(activePaths[side]),internal:Object.freeze([]),
  exteriorCandidateHexes:Object.freeze([...new Set(activePaths[side].map(x=>x.hex))].sort()),
  totalMarkedSides:activePaths[side].length
 })]));
 return Object.freeze({status:'geometry-reconciled-candidate-only',
   sourceTraceStatus:trace.status,sourceTraceSvgSha256:trace.sourceSvgSha256,
   certifiedForReinforcements:false,certifiedForVictory:false,
   paths:Object.freeze(paths),
   activePaths:Object.freeze(activeOutput),
   activeSourceSvgSha256:evidence.activeSourceSvgSha256});
}
module.exports=Object.freeze({reconcile});

};
defs["core/factions.js"]=function(module,exports,require,Buffer){
/* Single canonical faction identity and presentation settings for every map. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameFactions=api;
 if(typeof document!=='undefined'&&document.documentElement){
  document.documentElement.style.setProperty('--hex-german-entry',api.reinforcements.german.color);
  document.documentElement.style.setProperty('--hex-soviet-entry',api.reinforcements.soviet.color);
 }
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const reinforcements=Object.freeze({german:Object.freeze({color:'#08004cff',width:20.0}),soviet:Object.freeze({color:'#eb1b16',width:20.0})});
 // Common physical geometry for Star and Iron Cross in all campaigns.
 const deploymentIcons=Object.freeze({scale:0.86,crowdedScale:0.70,pairSpacing:19,bottomCenterFraction:0.42,opacity:1});
 return Object.freeze({reinforcements,deploymentIcons});
});

};
defs["core/graduated_mode.js"]=function(module,exports,require,Buffer){
/* Optional territorial scoring. Fixed experimental profiles are configuration, not printed historical rules. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameGraduatedMode=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const PROFILES={
 "battle-for-moscow": {
  "id": "territorial-experimental-v1",
  "scenario": "battle-for-moscow",
  "weights": {
   "1,4": 1,
   "2,6": 1,
   "4,8": 1,
   "5,1": 1,
   "5,3": 1,
   "7,3": 1,
   "7,5": 1,
   "7,9": 1,
   "10,2": 3,
   "10,6": 2,
   "13,5": 1
  },
  "thresholds": [
   3,
   4,
   5,
   6,
   7,
   9,
   10
  ],
  "decisiveCity": "10,2"
 },
 "arduous": {
  "id": "territorial-experimental-v1",
  "scenario": "arduous",
  "weights": {
   "Brest-Litovsk": 1,
   "Vilnius": 1,
   "Baranovichi": 1,
   "Minsk": 2,
   "Polotsk": 1,
   "Velikie Luki": 1,
   "Vitebsk": 1,
   "Orsha": 1,
   "Mogilev": 1,
   "Gomel": 1,
   "Smolensk": 2,
   "Roslavl": 1
  },
  "thresholds": [
   3,
   4,
   6,
   7,
   8,
   10,
   12,
   14
  ],
  "decisiveCity": null
 },
 "leningrad": {
  "id": "territorial-experimental-v1",
  "scenario": "leningrad",
  "weights": {
   "Liepaja": 1,
   "Insterburg": 1,
   "Siauliai": 1,
   "Riga": 1,
   "Kaunas": 1,
   "Parnu": 1,
   "Tallinn": 1,
   "Daugavpils": 1,
   "Tartu": 1,
   "Narva": 1,
   "Pskov": 1,
   "Luga": 1,
   "Leningrad": 3,
   "Novgorod": 1
  },
  "thresholds": [
   3,
   5,
   6,
   7,
   8,
   10,
   12,
   16
  ],
  "decisiveCity": null
 },
 "kiev": {
  "id": "territorial-experimental-v1",
  "scenario": "kiev",
  "weights": {
   "Lublin": 1,
   "Lvov": 1,
   "Kovel": 1,
   "Stanislavov": 1,
   "Tarnopol": 1,
   "Chernovtsy": 1,
   "Rovno": 1,
   "Sarny": 1,
   "Shepetovka": 1,
   "Iasi": 1,
   "Zhitomir": 1,
   "Vinnitsa": 1,
   "Kiev": 3,
   "Uman": 1,
   "Chernigov": 1,
   "Kirovograd": 1
  },
  "thresholds": [
   4,
   6,
   8,
   9,
   10,
   12,
   15,
   18
  ],
  "decisiveCity": null
 },
 "kiev-odessa": {
  "id": "territorial-experimental-v1",
  "scenario": "kiev-odessa",
  "weights": {
   "Lublin": 1,
   "Lvov": 1,
   "Kovel": 1,
   "Stanislavov": 1,
   "Tarnopol": 1,
   "Chernovtsy": 1,
   "Rovno": 1,
   "Sarny": 1,
   "Shepetovka": 1,
   "Iasi": 1,
   "Brăila": 1,
   "Zhitomir": 1,
   "Vinnitsa": 1,
   "Chisinau": 1,
   "Kiev": 3,
   "Uman": 1,
   "Odessa": 3,
   "Chernigov": 1,
   "Kirovograd": 1,
   "Nikolaev": 1
  },
  "thresholds": [
   5,
   7,
   9,
   10,
   11,
   14,
   18,
   24
  ],
  "decisiveCity": null
 }
};
const labels=Object.freeze(['soviet-decisive','soviet-major','soviet-minor','soviet-marginal','draw','german-marginal','german-minor','german-major','german-decisive']);
const clone=x=>JSON.parse(JSON.stringify(x));
const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
function profile(scenario){if(!Object.hasOwn(PROFILES,scenario))throw Error('No graduated victory profile for '+scenario);return clone(PROFILES[scenario]);}
function validate(scenario,p){if(JSON.stringify(stable(p))!==JSON.stringify(stable(profile(scenario))))throw Error('Unknown or altered graduated victory profile');return p;}
function classify(ledger,weights,thresholds,decisiveCity=null){
 const keys=Object.keys(weights);if(!ledger||typeof ledger!=='object'||Array.isArray(ledger)||Object.keys(ledger).length!==keys.length||keys.some(k=>!Object.hasOwn(ledger,k)||!['german','soviet'].includes(ledger[k])))throw Error('Graduated city ledger mismatch');
 const totalVP=keys.reduce((n,k)=>n+weights[k],0),germanVP=keys.reduce((n,k)=>n+(ledger[k]==='german'?weights[k]:0),0);
 const index=decisiveCity&&ledger[decisiveCity]==='german'?8:thresholds.filter(v=>germanVP>=v).length;
 const grade=labels[index],winner=index===4?'draw':index<4?'soviet':'german';
 return {germanVP,sovietVP:totalVP-germanVP,totalVP,grade,index,winner};
}
function evaluate(p,ledger){validate(p.scenario,p);return classify(ledger,p.weights,p.thresholds,p.decisiveCity);}
function withNative(base,mode='historical'){const out=clone(base);if(mode==='historical'){delete out.objectives.graduatedVictory;return out;}if(mode!=='graduated')throw Error('Invalid victory mode');out.objectives.graduatedVictory=profile(out.game.id);return out;}
function withHistorical(base,mode='historical'){if(!['historical','graduated'].includes(mode))throw Error('Invalid victory mode');const out={...base};if(!base.housekeepingPolicy){if(mode==='graduated')throw Error('No campaign victory policy');return out;}out.housekeepingPolicy={...base.housekeepingPolicy};delete out.housekeepingPolicy.graduatedVictory;if(mode==='graduated')out.housekeepingPolicy.graduatedVictory=profile(base.config.scenarioId);return out;}
function description(p,ledger,complete){const r=evaluate(p,ledger);return `${complete?'Final':'Current projected'} experimental victory: ${r.grade.replaceAll('-',' ')} · German ${r.germanVP} VP / Soviet ${r.sovietVP} VP`;}
function criteria(p){
 validate(p.scenario,p);const cap=p.decisiveCity?Object.keys(p.weights).filter(k=>k!==p.decisiveCity).reduce((n,k)=>n+p.weights[k],0):Object.values(p.weights).reduce((a,b)=>a+b,0);
 const bands=[0,...p.thresholds].map((lo,i)=>{const hi=i<p.thresholds.length?p.thresholds[i]-1:cap;return labels[i].replaceAll('-',' ')+': '+(lo===hi?lo:lo+'–'+hi);});
 return 'German VP bands: '+bands.join('; ')+'. '+(p.decisiveCity?'Holding Moscow overrides as German decisive. ':'')+'City weights: '+Object.entries(p.weights).filter(([,v])=>v>1).map(([k,v])=>(k==='10,2'?'Moscow':k==='10,6'?'Tula':k)+' '+v).join(', ')+'; all other cities 1. No casualties or isolation bonuses. Experimental, not calibrated for human balance.';
}
return Object.freeze({profile,validate,classify,evaluate,withNative,withHistorical,description,criteria});
});

};
defs["core/hexside_features.js"]=function(module,exports,require,Buffer){
/* Shared hexside feature ledger. This is the same geography used by the renderer.
 * Geometry and decorative source vectors NEVER authorize gameplay edges.
 * No runtime-supplied flag can elevate a map to certified status.
 */
(function(root,factory){
 const T=(typeof module==='object'&&module.exports)?require('./terrain_tiles'):root.HexTerrainTiles;
 const G=(typeof module==='object'&&module.exports)?require('./map_movement_graph'):root.WargameMapMovementGraph;
 const api=factory(T,G);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameHexsideFeatures=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(T,G){'use strict';
 const fail=message=>{throw Error('hexside-features: '+message);};
 const key=(a,b)=>[a,b].sort().join(':');
 const freeze=record=>Object.freeze(record);
 // Immutable ledger of the last completely fingerprint-pinned experimental map.
 // Always run G.build first; its source checks cannot be bypassed by this cache.
 let pinnedLedger=null;
 function inspectInternal(map,{experimentalScope=null}={},requireCertified=false){
  // Binding historically checks source authorization before inspecting hexsides.
  let certifiedGraph=requireCertified?G.build(map,{experimentalScope}):null;
  if(!map||!Array.isArray(map.cells)||!map.geometry||!T)return fail('invalid-map');
  const initialPin=certifiedGraph?.metadata?.scope==='experimental'?certifiedGraph.metadata.sourceGraphDigest:null;
  if(initialPin&&pinnedLedger?.pin===initialPin&&pinnedLedger.ledger.metadata.mapId===map.id)
   return {ledger:pinnedLedger.ledger,board:certifiedGraph};
  const byId=new Map();
  for(const c of map.cells){if(!c||typeof c.id!=='string'||byId.has(c.id))return fail('invalid-or-duplicate-hex');byId.set(c.id,c);}
  const shore=new Set();
  for(const h of map.authoredShoreHexsides||[]){
   if(!byId.has(h.cellId)||!T.DIRS.includes(h.dir))return fail('invalid-shore-side');
   const marker=h.cellId+':'+h.dir;if(shore.has(marker))return fail('duplicate-shore-side');shore.add(marker);
  }
  // Only the immutable existing registry can grant certification.
  // A provisional map is valid as an audit source but not for movement.
  if(!requireCertified)try{certifiedGraph=G.build(map,{experimentalScope});}catch(e){
   if(!String(e.message).includes('source-geometry-not-gameplay-certified'))throw e;
  }
  const certified=Boolean(certifiedGraph);
  const pin=certifiedGraph?.metadata?.scope==='experimental'?certifiedGraph.metadata.sourceGraphDigest:null;
  if(pin&&pinnedLedger?.pin===pin&&pinnedLedger.ledger.metadata.mapId===map.id)
   return {ledger:pinnedLedger.ledger,board:certifiedGraph};
  const verified=new Map((certifiedGraph?.edges||[]).map(e=>[key(e.a,e.b),e]));
  const edges=[],index=new Set();
  for(const c of map.cells)for(const dir of T.DIRS){
   const dest=T.neighbor(c,dir,map.geometry),other=byId.get(dest);if(!other)continue;
   const pair=key(c.id,dest);if(index.has(pair))continue;index.add(pair);
   if(T.neighbor(other,T.OPP[dir],map.geometry)!==c.id)return fail('nonreciprocal-neighbors:'+pair);
   const reverse=T.OPP[dir],a=c.tileEdges?.[dir]||[],b=other.tileEdges?.[reverse]||[];
   const coast=shore.has(c.id+':'+dir)||shore.has(dest+':'+reverse);
   const match=verified.get(pair);
   if(certified&&!match)return fail('certified-graph-edge-missing:'+pair);
   const sourceFeatures=[...a,...b].filter(f=>['rail','river'].includes(f.kind));
   // Candidate features describe visible artwork, not established gameplay legality.
   edges.push(freeze({a:c.id,b:dest,sideA:dir,sideB:reverse,
    rail:certified?match.rail:false,river:certified?match.river:false,
    impassable:certified?match.impassable:null,
    authoredShore:coast,sourceFeatureCount:sourceFeatures.length,
    evidence:certified?(certifiedGraph.metadata.scope==='experimental'?'source-pinned-experimental-movement':'certified-movement'):'geometry-only',
    movementAuthorized:certified&&!match.impassable,
    sourceMapId:map.id}));
  }
  // All registered rail links must be among verified topology, enforced by G.build.
  const entries=edges.sort((a,b)=>a.a.localeCompare(b.a)||a.b.localeCompare(b.b));
  const ledger=freeze({metadata:freeze({mapId:map.id,certified,scope:certifiedGraph?.metadata?.scope||'historical-source-binding',hexCount:byId.size,edgeCount:entries.length,
   certifiedRailEdges:entries.filter(e=>e.rail).length,
   certifiedRiverEdges:entries.filter(e=>e.river).length,
   authoredShoreSides:shore.size}),edges:Object.freeze(entries)});
  if(pin)pinnedLedger={pin,ledger};
  return {ledger,board:certifiedGraph};
 }
 // Both views are derived in one validated pass. No caller-provided graph can
 // bypass certification; no returned mutable board is shared between calls.
 function inspect(map,options){return inspectInternal(map,options).ledger;}
 function inspectWithGraph(map,options){return inspectInternal(map,options,true);}
 function edge(ledger,a,b){if(!ledger||typeof a!=='string'||typeof b!=='string')return fail('invalid-lookup');return ledger.edges.find(e=>key(e.a,e.b)===key(a,b))||null;}
 return Object.freeze({inspect,inspectWithGraph,edge});
});

};
defs["core/historical_air_support.js"]=function(module,exports,require,Buffer){
/* Optional source-bound, scenario-neutral air support and Fleet attack.
 * Air-sea attacks take place before German battle declarations; each air
 * marker is committed exactly once per turn to sea OR ground support.
 * No RNG is hidden: die is explicitly supplied after the commitment.
 */
(function(root,factory){
 const Ports=typeof module==='object'&&module.exports?require('./historical_port_support'):root.WargameHistoricalPortSupport;
 const Phases=typeof module==='object'&&module.exports?require('./phase_runtime'):root.WargamePhaseRuntime;
 const api=factory(Ports,Phases);if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameHistoricalAirSupport=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Ports,Phases){'use strict';
 const clone=v=>JSON.parse(JSON.stringify(v));
 const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const own=(v,k)=>Object.prototype.hasOwnProperty.call(v,k);
 function create({map,combatPolicy,counterConfig,phaseConfig,rosterOverlay=null}){
  const cfg=combatPolicy?.airSupport;
  if(!cfg||cfg.mode!=='photographed-shift-markers-v1'||!Array.isArray(cfg.markers)||cfg.markers.length<1||
     !obj(combatPolicy.printedAffiliationToOwner)||!phaseConfig||phaseConfig.scenarioId!==combatPolicy.scenarioId)
   throw Error('Source-configured historical air marker registration required');
  // Source configurations without a naval counter can opt out of the
  // otherwise legacy pre-battle Fleet attack window. This is gameplay
  // configuration, never a scenario-ID branch or inferred naval target.
  if(cfg.navalAttackMode!==undefined&&!['none','fleet-strike-v1'].includes(cfg.navalAttackMode))
   throw Error('Unrecognized historical naval air-attack mode');
  if(cfg.navalAttackMode==='none'&&combatPolicy.portSupport)
   throw Error('Ground-only air policy conflicts with source-configured Fleet');
  if(cfg.navalAttackMode==='fleet-strike-v1'&&!combatPolicy.portSupport)
   throw Error('Fleet strike requires source-configured Fleet');
  const faces=counterConfig?.faces;
  if(!Array.isArray(faces?.front)||!Array.isArray(faces?.back))throw Error('Source air counter faces required');
  const fronts=new Map(faces.front.map(x=>[x.faceId,x]));
  const backs=new Map(faces.back.map(x=>[x.faceId,x]));
  const markers=new Map();
  for(const m of cfg.markers){
   // Default photographed air markers refresh every turn. A source-faced
   // REFIT marker can opt into a turn-based cooldown; do not infer a cadence
   // from the scenario ID or apply it to ordinary Luftwaffe markers.
   const keys=Object.keys(m||{}).sort().join('|');
   const legacyKeys=['faceId','firstTurn','shiftRating'].sort().join('|');
   const refitKeys=['cooldownTurns','faceId','firstTurn','refitFaceId','shiftRating'].sort().join('|');
   const refit=keys===refitKeys;
   if(!obj(m)||(!refit&&keys!==legacyKeys)||
      typeof m.faceId!=='string'||markers.has(m.faceId)||!Number.isInteger(m.firstTurn)||m.firstTurn<1||m.firstTurn>phaseConfig.turns||
      !Number.isInteger(m.shiftRating)||m.shiftRating<1||m.shiftRating>6||
      (refit&&(!Number.isInteger(m.cooldownTurns)||m.cooldownTurns<1||m.cooldownTurns>=phaseConfig.turns||typeof m.refitFaceId!=='string')))
    throw Error('Invalid or duplicated historical air registration');
   const f=fronts.get(m.faceId),b=backs.get(f?.pairedFaceId),t=f?.visualTranscription,bt=b?.visualTranscription;
   const matchedFaces=!!b&&b.pairedFaceId===f.faceId;
   const ownerMatches=combatPolicy.printedAffiliationToOwner[t?.printedAffiliation]===cfg.owner;
   const legacyFace=matchedFaces&&t?.kind==='air-support'&&bt?.kind==='air-support'&&
      bt.printedIdentifier===t.printedIdentifier&&
      new RegExp('^'+m.shiftRating+'\\s*/\\s*arrow$').test(t.printedValues||'')&&bt.printedValues===t.printedValues;
   // Odessa's photographed Romanian face says "Rom I AK; aircraft silhouette;
   // 1; right arrow", while the reverse explicitly says "REFIT" rather
   // than repeating the shift. Require the exact matched print identity,
   // the rating and the refit reverse; an ordinary air marker cannot claim it.
   const printed=String(t?.visibleNotation||'').split(';').map(x=>x.trim()),
    reverse=String(bt?.visibleNotation||'').split(';').map(x=>x.trim());
   const refitFace=refit&&matchedFaces&&f.pairedFaceId===m.refitFaceId&&
      t?.kind==='air-marker'&&bt?.kind==='air-marker'&&
      printed.length===4&&printed[0]&&printed[1]==='aircraft silhouette'&&
      printed[2]===String(m.shiftRating)&&printed[3]==='right arrow'&&
      reverse.length===2&&reverse[0]===printed[0]&&reverse[1]==='REFIT';
   if(!ownerMatches||!(refit?refitFace:legacyFace))
    throw Error('Air Shift Rating or source face does not match photographed counter');
   markers.set(m.faceId,Object.freeze({...m,identifier:refit?printed[0]:t.printedIdentifier}));
  }
  if(!markers.size||!cfg.owner||!phaseConfig.players.includes(cfg.owner))throw Error('Historical air ownership missing');
  if(cfg.requireRosterFaceBinding!==undefined&&cfg.requireRosterFaceBinding!==true)
   throw Error('Invalid source air roster-binding policy');
  if(cfg.requireRosterFaceBinding){
   if(!obj(rosterOverlay)||!Array.isArray(rosterOverlay.units)||
      rosterOverlay.id!==combatPolicy.scenarioId+'-unit-overlay')
    throw Error('Source roster binding required for REFIT marker');
   for(const marker of markers.values())if(marker.refitFaceId){
    const record=rosterOverlay.units.filter(u=>u.art?.displayFaceId===marker.faceId);
    if(record.length!==1||record[0].art.alternateFaceId!==marker.refitFaceId||
       record[0].class!=='air-marker'||record[0].initial?.kind!=='reinforcement-track'||
       record[0].initial.turn!==marker.firstTurn||record[0].identityEvidence!=='explicit-pdf'||
       combatPolicy.printedAffiliationToOwner[record[0].side]!==cfg.owner)
     throw Error('Source roster arrival/REFIT binding mismatch');
   }
  }
  const ports=Ports.create({map,policy:combatPolicy,counterConfig});
  function gate({state,cursor,actor}){
   const p=Phases.current(phaseConfig,cursor);
   if(p?.kind!=='combat'||p.owner!==cfg.owner||actor!==cfg.owner||state?.scenarioId!==combatPolicy.scenarioId||!obj(state.units))
    throw Error('Air use requires owning Combat Phase and historical state');
   return cursor.turn;
  }
  function validateLedger(state){
   if(state.airUse===undefined)return;
   if(!obj(state.airUse))throw Error('Malformed air-use ledger');
   for(const [turn,entries] of Object.entries(state.airUse)){
    if(!/^[1-9][0-9]*$/.test(turn)||Number(turn)>phaseConfig.turns||!obj(entries))
     throw Error('Malformed air-use ledger');
    for(const [faceId,kind] of Object.entries(entries))
     if(!markers.has(faceId)||!['ground','fleet'].includes(kind)||Number(turn)<markers.get(faceId).firstTurn)
      throw Error('Malformed air-use ledger');
   }
   // A restored/edited history must not claim an impossible use on a REFIT
   // turn. This protects replay and save/restore even without a prior commit.
   for(const m of markers.values())if(m.cooldownTurns){
    let last=null;
    for(const t of Object.keys(state.airUse).map(Number).sort((a,b)=>a-b)){
     if(!own(state.airUse[String(t)],m.faceId))continue;
     if(last!==null&&t-last<=m.cooldownTurns)throw Error('Invalid historical air REFIT ledger');
     last=t;
    }
   }
  }
  function coolingDown(state,turn,m){
   if(!m.cooldownTurns)return false;
   for(let previous=Math.max(1,turn-m.cooldownTurns);previous<turn;previous++)
    if(own(state.airUse?.[String(previous)]||{},m.faceId))return true;
   return false;
  }
  function used({state,cursor,actor,faceId}){
   const turn=gate({state,cursor,actor}),m=markers.get(faceId);
   if(!m)throw Error('Unregistered source air marker');
   if(turn<m.firstTurn)throw Error('Air Corps has not arrived');
   validateLedger(state);
   if(own(state.airUse?.[String(turn)]||{},faceId))throw Error('Air marker already committed this turn');
   if(coolingDown(state,turn,m))throw Error('Air marker is on its REFIT turn');
   return {turn,marker:m};
  }
  function available({state,cursor,actor}){
   const turn=gate({state,cursor,actor});
   validateLedger(state);
   return Object.freeze([...markers.values()].filter(m=>m.firstTurn<=turn&&
    !own(state.airUse?.[String(turn)]||{},m.faceId)&&!coolingDown(state,turn,m))
    .map(m=>Object.freeze({...m})));
  }
  function reserve({state,cursor,actor,faceId,kind}){
   if(!['fleet','ground'].includes(kind))throw Error('Invalid air commitment');
   const {turn,marker}=used({state,cursor,actor,faceId});
   const next=clone(state);
   if(!next.airUse)next.airUse={};
   if(!next.airUse[String(turn)])next.airUse[String(turn)]={};
   next.airUse[String(turn)][faceId]=kind;
   return {state:next,marker,turn};
  }
  function ground({state,cursor,actor,faceId}){
   const result=reserve({state,cursor,actor,faceId,kind:'ground'});
   return Object.freeze({state:result.state,shiftRating:result.marker.shiftRating,
    event:Object.freeze({kind:'ground-air-commitment',faceId,turn:result.turn,shiftRating:result.marker.shiftRating})});
  }
  function attackFleet({state,cursor,actor,faceId,die}){
   if(cfg.navalAttackMode==='none')throw Error('Naval air attacks not available in this scenario');
   const marker=ports.validateMarker(state,true);
   if(!Number.isInteger(die)||die<1||die>6)throw Error('Fleet air attack requires injected six-sided die');
   const result=reserve({state,cursor,actor,faceId,kind:'fleet'});
   const hit=die<=result.marker.shiftRating;
   if(hit){
    const key=ports.markerKey;
    if(marker.condition==='damaged')delete result.state.supportMarkers[key];
    else result.state.supportMarkers[key].condition='damaged';
   }
   return Object.freeze({state:result.state,event:Object.freeze({kind:'air-sea-attack',faceId,
    identifier:result.marker.identifier,turn:result.turn,die,shiftRating:result.marker.shiftRating,
    hit,priorCondition:marker.condition,resultCondition:hit?(marker.condition==='damaged'?'eliminated':'damaged'):marker.condition})});
  }
  return Object.freeze({available,ground,attackFleet,markerFaces:Object.freeze([...markers.keys()])});
 }
 return Object.freeze({create});
});

};
defs["core/historical_combat_consequences.js"]=function(module,exports,require,Buffer){
/* Cross-scenario, source-configured, immutable combat consequences pilot.
 * Caller must supply an authoritative map, movement binding, original counter
 * faces and a rules profile. Every action is validated on a cloned state.
 * Bounded coverage: opt-in forced EZOC losses and outward overstack
 * extensions; photographed port-Fleet retreat override is separate from
 * unimplemented Fleet movement, joint retreat ordering and air commitments.
 */
(function(root,factory){
 const M=typeof module==='object'&&module.exports?require('./movement_binding.js'):root.WargameMovementBinding;
 const O=typeof module==='object'&&module.exports?require('./historical_combat_odds.js'):root.WargameHistoricalCombatOdds;
 const C=typeof module==='object'&&module.exports?require('./historical_crt.js'):root.WargameHistoricalCRT;
 const R=typeof module==='object'&&module.exports?require('./historical_forced_retreat.js'):root.WargameHistoricalForcedRetreat;
 const S=typeof module==='object'&&module.exports?require('./historical_port_support.js'):root.WargameHistoricalPortSupport;
 const Air=typeof module==='object'&&module.exports?require('./historical_air_support.js'):root.WargameHistoricalAirSupport;
 const Stack=typeof module==='object'&&module.exports?require('./movement_rules.js'):root.WargameMovementRules;
 const Territory=typeof module==='object'&&module.exports?require('./territorial_state_transition.js'):root.WargameTerritorialStateTransition;
 const api=factory(M,O,C,R,S,Air,Stack,Territory);if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameHistoricalCombatConsequences=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(M,O,C,R,S,Air,Stack,Territory){'use strict';
 const clone=v=>JSON.parse(JSON.stringify(v));
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const key=(a,b)=>[a,b].sort().join(':');
 const numeric=/^(\d+)-(\d+)$/;
 const mech=/^(\d+)[·.](\d+)[·.\-](\d+)$/;
 function create({map,profile,counterConfig,combatPolicy,geography,phaseConfig=null,enableAirSupport=false,rosterOverlay=null}){
  if(!map||!profile||!plain(combatPolicy)||combatPolicy.schemaVersion!==1||combatPolicy.scenarioId!==profile.id||
    combatPolicy.crtId!==C.id||!Array.isArray(combatPolicy.allowedOutcomes)||
    (!Number.isInteger(combatPolicy.retreatHexes)||combatPolicy.retreatHexes<1||combatPolicy.retreatHexes>4)||combatPolicy.safeRetreatOnly!==true||combatPolicy.supportMode!=='not-yet-integrated'||
    !plain(combatPolicy.printedAffiliationToOwner)||!plain(combatPolicy.counterKindToClass)||!geography)
   throw Error('Missing or incompatible source-configured combat policy');
  const faces=counterConfig?.faces;
  if(!Array.isArray(faces?.front)||!Array.isArray(faces?.back))throw Error('Photographed source counter faces required');
  const front=new Map(faces.front.map(f=>[f.faceId,f]));
  const back=new Map(faces.back.map(f=>[f.faceId,f]));
  if(front.size!==faces.front.length||back.size!==faces.back.length)throw Error('Duplicate source counter face');
  // Rare source-captioned unit types can use an ordinary NATO glyph. A
  // face-specific exception is allowed only if BOTH photographed faces and
  // the printed identifier/affiliation match the scenario's source record.
  // Never broaden every Infantry face to a Motorized class.
  const classOverrides=combatPolicy.counterFaceClassOverrides||{};
  if(!plain(classOverrides))throw Error('Invalid photographed combat face class overrides');
  for(const [faceId,exception] of Object.entries(classOverrides)){
   const face=front.get(faceId),reverse=back.get(face?.pairedFaceId),t=face?.visualTranscription;
   if(!plain(exception)||Object.keys(exception).sort().join(':')!==
       ['printedKind','printedIdentifier','printedAffiliation','unitClass'].sort().join(':')||
      !face||!reverse||reverse.pairedFaceId!==faceId||
      t?.kind!==exception.printedKind||t.printedIdentifier!==exception.printedIdentifier||
      t.printedAffiliation!==exception.printedAffiliation||
      reverse.visualTranscription?.kind!==t.kind||
      reverse.visualTranscription?.printedIdentifier!==t.printedIdentifier||
      reverse.visualTranscription?.printedAffiliation!==t.printedAffiliation||
      combatPolicy.printedAffiliationToOwner[t.printedAffiliation]===undefined||
      typeof exception.unitClass!=='string'||!exception.unitClass||
      exception.unitClass===combatPolicy.counterKindToClass[t.kind])
    throw Error('Combat class exception lacks exact photographed face evidence');
  }
  const board=M.build(map,profile).board, edges=new Map(board.edges.map(e=>[key(e.a,e.b),e]));
  if(combatPolicy.retreatMode!==undefined&&combatPolicy.retreatMode!=='source-forced-ezoc-v1')
   throw Error('Unsupported historical retreat adjudication mode');
  const forcedRetreat=combatPolicy.retreatMode==='source-forced-ezoc-v1'?R.create({map,profile,combatPolicy,counterConfig}):null;
  const portSupport=S.create({map,policy:combatPolicy,counterConfig});
  const air=enableAirSupport?Air.create({map,combatPolicy,counterConfig,phaseConfig,rosterOverlay}):null;
  const cells=board.cells;
  const adjacent=new Map();
  for(const e of board.edges){
   if(!adjacent.has(e.a))adjacent.set(e.a,[]);
   if(!adjacent.has(e.b))adjacent.set(e.b,[]);
   adjacent.get(e.a).push({to:e.b,edge:e});adjacent.get(e.b).push({to:e.a,edge:e});
  }
  function surface(u){
   if(!u||!u.sourceFaceId||!u.reverseFaceId||!u.id||!u.owner||!u.hex)throw Error('Combat unit missing source identity');
   const a=front.get(u.sourceFaceId),b=back.get(u.reverseFaceId);
   if(!a||!b||a.pairedFaceId!==b.faceId||b.pairedFaceId!==a.faceId)throw Error('Combat counter source pair mismatch');
   const t=a.visualTranscription||{},r=b.visualTranscription||{};
   const special=(combatPolicy.reverseOnlyPieces||[]).filter(p=>p.unitId===u.id&&p.sourceFaceId===a.faceId&&p.reverseFaceId===b.faceId);
   if(special.length>1)throw Error('Multiple reverse-only combat authorizations');
   if(special.length===1){
    const p=special[0],s=numeric.exec(r.printedValues||'');
    if(p.owner!==u.owner||p.class!==u.class||p.frontKind!==t.kind||p.backKind!==r.kind||
       p.backAffiliation!==r.printedAffiliation||p.printedValues!==r.printedValues||!s||
       u.strengthStatus!=='printed-reduced'||u.activeFaceId!==b.faceId||
       u.printedCombatStrength!==+s[1]||u.mp!==+s[2])
     throw Error('Reverse-only combat face disagrees with source or rule authorization');
    return {kind:u.class,attack:+s[1],defense:+s[1],face:'one-step',reduced:null};
   }
   if(combatPolicy.printedAffiliationToOwner[t.printedAffiliation]!==u.owner||
      (classOverrides[u.sourceFaceId]?.unitClass||combatPolicy.counterKindToClass[t.kind])!==u.class)
    throw Error('Combat counter affiliation/class mismatch');
   const full=numeric.exec(t.printedValues||''), untried=/^\?-(\d+)$/.exec(t.printedValues||'');
   const reduced=numeric.exec(r.printedValues||''),revealed=mech.exec(r.printedValues||'');
   const dual=/^(\d+)[·.\-](\d+)[·.\-](\d+)$/;
   const dualFull=dual.exec(t.printedValues||''),dualReduced=dual.exec(r.printedValues||'');
   if(dualFull&&dualReduced&&t.kind==='infantry'&&r.kind==='infantry'){
    if(u.mp!==+dualFull[3]||u.reverseFaceId!==b.faceId||+dualReduced[3]!==u.mp)
     throw Error('Invalid dual-strength infantry movement face');
    if(u.strengthStatus==='printed-full'&&u.printedCombatStrength===+dualFull[1]&&!own(u,'activeFaceId'))
     return {kind:u.class,attack:+dualFull[1],defense:+dualFull[2],face:'full',reduced:dualReduced,dualStrength:true};
    if(u.strengthStatus==='printed-reduced'&&u.printedCombatStrength===+dualReduced[1]&&u.activeFaceId===b.faceId)
     return {kind:u.class,attack:+dualReduced[1],defense:+dualReduced[2],face:'reduced',reduced:dualReduced,dualStrength:true};
    throw Error('Dual-strength infantry face disagrees with photographed source');
   }
   if(full){
    if(!Number.isSafeInteger(+full[1])||+full[1]<1)throw Error('Invalid front combat strength');
    if(u.strengthStatus==='printed-full'&&u.printedCombatStrength===+full[1]&&!own(u,'activeFaceId'))
     return {kind:u.class,attack:+full[1],defense:+full[1],face:'full',reduced};
    if(u.strengthStatus==='printed-reduced'&&reduced&&u.printedCombatStrength===+reduced[1]&&u.activeFaceId===b.faceId)
     return {kind:u.class,attack:+reduced[1],defense:+reduced[1],face:'reduced',reduced};
    throw Error('Unit strength/face disagrees with source counter');
   }
   if(untried&&revealed){
    if(u.strengthStatus==='untried'&&u.printedCombatStrength===null&&!own(u,'activeFaceId'))
     return {kind:u.class,face:'untried',attack:+revealed[1],defense:+revealed[2],revealedFaceId:b.faceId};
    if(u.strengthStatus==='revealed-one-step'&&u.printedCombatStrength===null&&u.activeFaceId===b.faceId&&
       u.revealedAttackStrength===+revealed[1]&&u.revealedDefenseStrength===+revealed[2])
     return {kind:u.class,face:'one-step',attack:+revealed[1],defense:+revealed[2]};
    throw Error('Untried/revealed counter state inconsistent with source');
   }
   throw Error('Unsupported or unverified combat counter face');
  }
  function reveal(u){
   const s=surface(u);
   if(s.face==='untried'){
    u.strengthStatus='revealed-one-step';u.activeFaceId=s.revealedFaceId;
    u.revealedAttackStrength=s.attack;u.revealedDefenseStrength=s.defense;
   }
   return surface(u);
  }
  function loseStep(state,id){
   const u=state.units[id];if(!u)throw Error('Loss target not on board');
   const s=surface(u),oldAttack=s.attack,oldDefense=s.defense;
   if(s.face==='full'&&s.reduced){
    const face=back.get(u.reverseFaceId),next=+s.reduced[1],nextDefense=s.dualStrength?+s.reduced[2]:next;
    if(next>=oldAttack||next<1||nextDefense<1||nextDefense>oldDefense||+(s.dualStrength?s.reduced[3]:s.reduced[2])!==u.mp)
     throw Error('Invalid reduced source face');
    u.strengthStatus='printed-reduced';u.printedCombatStrength=next;u.activeFaceId=face.faceId;
    return {unitId:id,removed:false,attackPoints:oldAttack-next,defensePoints:oldDefense-nextDefense};
   }
   // A blank reverse on an infantry corps, or an already-reduced/one-step
   // counter, has no further face to which to retreat.
   if(!['full','reduced','one-step'].includes(s.face))throw Error('Cannot lose unrevealed step');
   delete state.units[id];
   return {unitId:id,removed:true,attackPoints:oldAttack,defensePoints:oldDefense};
  }
  function graphDistance(start,goal){
   if(start===goal)return 0;
   const seen=new Set([start]),todo=[[start,0]];
   for(let i=0;i<todo.length;i++){
    const [here,depth]=todo[i];if(depth>=combatPolicy.retreatHexes)continue;
    for(const {to} of adjacent.get(here)||[]){
     if(to===goal)return depth+1;
     if(!seen.has(to)){seen.add(to);todo.push([to,depth+1]);}
    }
   }
   return Infinity;
  }
  function isEZOC(hex,unitOwner,units){
   return Object.values(units).some(enemy=>enemy.owner!==unitOwner &&
    (adjacent.get(enemy.hex)||[]).some(({to,edge})=>to===hex&&edge.verified&&!edge.impassable&&!edge.lake&&!edge.allSea));
  }
  function retreat(state,battle,ids,paths){
   if(!plain(paths)||Object.keys(paths).length!==ids.length||ids.some(id=>!own(paths,id)))throw Error('Complete retreat paths required');
   const original=battle.defenderHex, retreating=ids.map(id=>state.units[id]);
   if(retreating.some(u=>!u||u.hex!==original))throw Error('Defender no longer in target hex');
   const nextPositions=new Map();
   for(const u of retreating){
    const route=paths[u.id];
    if(!Array.isArray(route)||route.length!==combatPolicy.retreatHexes||route.some(x=>typeof x!=='string'))
     throw Error('Retreat must be exactly two hexes');
    let from=original;
    for(let i=0;i<route.length;i++){
     const to=route[i],e=edges.get(key(from,to));
     if(!e||!e.verified||e.impassable||e.allSea||e.lake||!cells[to]?.verified||
       graphDistance(original,to)!==i+1)throw Error('Retreat violates certified outward two-hex route');
     if(!Territory.retreatStep({profile,board,state,unit:u,from,to}))
      throw Error('Retreat violates certified national territory');
     if(Object.values(state.units).some(other=>other.owner!==u.owner&&other.hex===to))throw Error('Retreat enters enemy hex');
     // The forced-EZOC loss, unavoidable-EZOC choice and overstack extension
     // branches require a later separately verified legal-action enumerator.
     if(isEZOC(to,u.owner,state.units))throw Error('EZOC retreat adjudication is not yet supported');
     from=to;
    }
    nextPositions.set(u.id,from);
   }
   for(const [id,to] of nextPositions)state.units[id].hex=to;
   const counts=new Map();
   for(const u of Object.values(state.units)){
    const k=u.hex;
    if(!counts.has(k))counts.set(k,[]);
    counts.get(k).push(u);
   }
   for(const units of counts.values()){
    if(new Set(units.map(u=>u.owner)).size>1)throw Error('Retreat creates enemy coexistence');
    if(units.length>profile.maxStack)throw Error('Retreat overstack extension not implemented');
    if(!Stack.nationalStackLegal(profile,units))throw Error('Retreat violates nationality stacking');
    const owner=units[0]?.owner, armyMax=combatPolicy.armyStackingByOwner?.[owner];
    if(Number.isInteger(armyMax)&&units.filter(u=>u.size==='army').length>armyMax)
     throw Error('Retreat violates army stacking');
   }
   return [...nextPositions].map(([unitId,to])=>({unitId,to,route:clone(paths[unitId])}));
  }
  // Shared pre-roll arithmetic. Never inspect a concealed face in the advisory path.
  function calculateOdds(next,battle,actor,cursor,airShift=0,estimates=null){
   const strength=id=>estimates?.[id]||surface(next.units[id]);
   const located=geography.evaluate(battle,next.units);
   const calculation={attackers:battle.attackers.map(id=>({kind:strength(id).kind,value:strength(id).attack})),
    defenders:battle.defenders.map(id=>({kind:strength(id).kind,value:strength(id).defense})),
    defenderTerrain:located.defenderTerrain,allAttackersAcrossRiver:located.allAttackersAcrossRiver,policy:combatPolicy,
    attackerIds:battle.attackers,
    majorRiverCrossers:located.evidence.crossings.filter(x=>x.majorRiver).map(x=>x.unitId),
    actor,turn:cursor?.turn};
   const naval=portSupport.inspect({state:next,battle,actor});
   const preview=O.evaluate({...calculation,fleetShift:naval.fleetShift,airSupportShift:airShift});
   return {located,calculation,naval,preview};
  }
  function previewKnownOdds({state,battle,actor,cursor,airSupportId=null}){
   if([...battle.attackers,...battle.defenders].some(id=>state.units[id]?.strengthStatus==='untried'))
    return null;
   let shift=0;
   if(airSupportId!==null){
    const marker=air?.available({state,cursor,actor}).find(m=>m.faceId===airSupportId);
    if(!marker)throw Error("Air support unavailable for preview");
    shift=marker.shiftRating;
   }
   return calculateOdds(state,battle,actor,cursor,shift).preview;
  }
  // Public roster multiset, never the actual concealed unit-to-face association.
  // Subtract currently visible revealed counters only; off-map losses are not
  // tracked here, so the remaining pool is an approximation, not a posterior.
  function previewEstimatedOdds({state,battle,actor,cursor,maxAssignments=4096}){
   if(!Number.isInteger(maxAssignments)||maxAssignments<1||maxAssignments>4096)throw Error('Invalid estimate budget');
   const hidden=[...battle.attackers,...battle.defenders].filter(id=>state.units[id]?.strengthStatus==='untried');
   if(!hidden.length)return null;
   const pools=new Map(),poolKey=(owner,kind,mp)=>[owner,kind,mp].join(':');
   for(const f of faces.front){
    const t=f.visualTranscription||{},m=/^\?-(\d+)$/.exec(t.printedValues||'');
    if(!m)continue;
    const r=back.get(f.pairedFaceId)?.visualTranscription, v=mech.exec(r?.printedValues||'');
    if(!v||+v[3]!==+m[1])continue;
    const kind=combatPolicy.counterKindToClass[t.kind], owner=combatPolicy.printedAffiliationToOwner[t.printedAffiliation];
    const k=poolKey(owner,kind,+m[1]);
    if(!pools.has(k))pools.set(k,[]);
    pools.get(k).push({kind,attack:+v[1],defense:+v[2]});
   }
   for(const u of Object.values(state.units)){
    if(u.strengthStatus!=='revealed-one-step')continue;
    const pool=pools.get(poolKey(u.owner,u.class,u.mp));
    if(!pool)continue;
    const i=pool.findIndex(v=>v.attack===u.revealedAttackStrength&&v.defense===u.revealedDefenseStrength);
    if(i<0)return {complete:false,reason:'inconsistent-public-roster'};
    pool.splice(i,1);
   }
   // Sort by public strengths so roster ordering has no influence on the estimate.
   for(const pool of pools.values())pool.sort((a,b)=>a.attack-b.attack||a.defense-b.defense);
   const assigned=Object.create(null),distribution={};let count=0;
   const keys=hidden.map(id=>{const u=state.units[id];return poolKey(u.owner,u.class,u.mp);});
   if(keys.some(k=>!pools.get(k)?.length))return {complete:false,reason:'missing-public-pool'};
   // Count labeled assignments before evaluating any odds. Incomplete estimates
   // are never used by the controller; avoid thousands of useless evaluations.
   const needed=new Map();let total=1;
   for(const k of keys){const n=(needed.get(k)||0);needed.set(k,n+1);total*=Math.max(0,pools.get(k).length-n);if(total>maxAssignments)return {complete:false,assignments:0,distribution:{},reason:'assignment-budget',assumption:'uniform remaining public roster; on-map revealed counters excluded'};}
   // Equal public faces are interchangeable. Enumerate distinct strength tuples
   // and weight each by the number of remaining labeled assignments.
   const groups=new Map();for(const [k,pool] of pools){const g=new Map();for(const v of pool){const key=v.attack+':'+v.defense;if(!g.has(key))g.set(key,{v,n:0});g.get(key).n++;}groups.set(k,[...g.values()]);}
   function visit(i,weight){
    if(i===hidden.length){const odds=calculateOdds(state,battle,actor,cursor,0,assigned).preview.finalOdds;distribution[odds]=(distribution[odds]||0)+weight;count+=weight;return;}
    for(const g of groups.get(keys[i])){if(!g.n)continue;const n=g.n;g.n--;assigned[hidden[i]]=g.v;visit(i+1,weight*n);g.n++;}
   }
   visit(0,1);
   return {complete:count>0,assignments:count,distribution,assumption:'uniform remaining public roster; on-map revealed counters excluded'};
  }
  function prepare({state,battle,actor,die,choices={},cursor=null,airSupportId=null},skipCasualties=false){
   if(!plain(state)||!plain(state.units)||!battle||!Array.isArray(battle.attackers)||!Array.isArray(battle.defenders)||
      !(die===null||(Number.isInteger(die)&&die>=1&&die<=6))||!plain(choices)||!actor)
    throw Error('Invalid committed combat transaction');
   let next=clone(state),airEvent=null,airShift=0;
   if(airSupportId!==null){
    if(!air||typeof airSupportId!=='string'||!cursor)throw Error('Air Corps commitment requires source-bound enabled phase');
    const reserved=air.ground({state:next,cursor,actor,faceId:airSupportId});
    next=reserved.state;airShift=reserved.shiftRating;airEvent=reserved.event;
   }
   const all=[...battle.attackers,...battle.defenders];
   if(new Set(all).size!==all.length||!all.length)throw Error('Duplicate or empty battle participants');
   for(const id of battle.attackers){const u=next.units[id];if(!u||u.owner!==actor)throw Error('Committed attacker unavailable');}
   for(const id of battle.defenders){const u=next.units[id];if(!u||u.owner===actor||u.hex!==battle.defenderHex)throw Error('Committed defender unavailable');}
   const revealed=[];
   for(const id of all){const u=next.units[id];if(surface(u).face==='untried'){reveal(u);revealed.push(id);}}
   const {located,calculation,naval,preview}=calculateOdds(next,battle,actor,cursor,airShift);
   if(preview.noEffect&&die!==null)throw Error('No die is rolled when odds produce automatic NE');
   if(!preview.noEffect&&die===null)throw Error('Injected die required before a resolvable CRT result');
   const result=preview.noEffect?preview:O.evaluate({...calculation,die,fleetShift:naval.fleetShift,airSupportShift:airShift});
   const outcome=preview.noEffect?'NE':result.crtResult;
   if(!combatPolicy.allowedOutcomes.includes(outcome))throw Error('Unsupported combat result');
   const allowed=outcome==='NE'?[]:outcome==='AL'?['lossUnitId']:outcome==='DE'?['advanceUnitId','fleetDisplacement']:
    outcome==='DR'?['retreatPaths','advanceUnitId','ignoreRetreat','fleetDisplacement']:outcome==='DRL'?['defenderLossId','retreatPaths','advanceUnitId','ignoreRetreat','fleetDisplacement']:
    outcome==='EX'?['defenderLossId','attackerLossIds','retreatPaths','advanceUnitId','ignoreRetreat','fleetDisplacement']:[];
   if(Object.keys(choices).some(k=>!allowed.includes(k)))throw Error('Unsupported result-dependent choice');
   const losses=[];
   if(!skipCasualties){
   if(outcome==='AL'){
    if(typeof choices.lossUnitId!=='string'||!battle.attackers.includes(choices.lossUnitId))throw Error('Choose an eligible attacking unit for AL');
    losses.push(loseStep(next,choices.lossUnitId));
   }
   if(outcome==='DE'){
    for(const id of battle.defenders){delete next.units[id];losses.push({unitId:id,removed:true,defenderEliminated:true});}
   }
   if(outcome==='DRL'||outcome==='EX'){
    const id=choices.defenderLossId|| (battle.defenders.length===1?battle.defenders[0]:null);
    if(!battle.defenders.includes(id))throw Error('Choose an eligible defender step loss');
    const loss=loseStep(next,id);losses.push(loss);
    if(outcome==='EX'){
     const chosen=choices.attackerLossIds;
     if(!Array.isArray(chosen)||!chosen.length||new Set(chosen).size!==chosen.length||chosen.some(id=>!battle.attackers.includes(id)))
      throw Error('Explicit exchange attacker step-loss sequence required');
     let cost=0;
     for(const attackId of chosen){const l=loseStep(next,attackId);losses.push(l);cost+=l.attackPoints;}
     if(cost<loss.defensePoints){
      // Exhaustion fallback: first charge one step to every participating
      // attacker. Only the all-attacker choice can invoke further losses.
      // If the obligation is still unpaid, spend remaining steps in the
      // explicitly supplied order, stopping as soon as it is met. An
      // exhausted attacking force cannot pay more; the EX still resolves.
      if(chosen.length!==battle.attackers.length)throw Error('Exchange attacker losses do not meet defender loss');
      for(const attackId of chosen){
       while(cost<loss.defensePoints&&next.units[attackId]){
        const l=loseStep(next,attackId);losses.push(l);cost+=l.attackPoints;
       }
       if(cost>=loss.defensePoints)break;
      }
     }
    }
   }
   }
   return {next,outcome,result,losses,naval,airEvent,revealed,located};
  }
  // Read-only source-trusted pre-retreat checkpoint for a *committed* die.
  // Null choices requests only the CRT outcome, without mandatory casualties;
  // explicit choices applies the SAME casualty code as the real transaction.
  // The caller must enforce phase commitment (including air selection) first.
  function previewPostCasualty(input){
   const {choices=null,...rest}=input||{};
   if(choices!==null&&(!plain(choices)||Object.keys(choices).some(k=>
      !['lossUnitId','defenderLossId','attackerLossIds'].includes(k))))
    throw Error('Pre-retreat preview accepts only mandatory loss choices');
   const prepared=prepare({...rest,choices:choices===null?{}:choices},choices===null);
   if(choices===null)return Object.freeze({outcome:prepared.outcome});
   return Object.freeze({outcome:prepared.outcome,state:clone(prepared.next),
    losses:clone(prepared.losses),survivingDefenderIds:
     rest.battle.defenders.filter(id=>prepared.next.units[id])});
  }
  function resolve(input){
   const {state,battle,actor,die,choices={}}=input;
   const {next,outcome,result,losses,naval,airEvent,revealed,located}=prepare(input);
   const retreats=[];
   const surviving=battle.defenders.filter(id=>next.units[id]);
   const ignoredRetreat=choices.ignoreRetreat===true;
   if(own(choices,'ignoreRetreat')&&(!ignoredRetreat||!surviving.length||!naval.ignoreRetreatEligible||!forcedRetreat||
      own(choices,'retreatPaths')))throw Error('Fleet ignore-retreat requires eligible Soviet defenders and no retreat paths');
   if(ignoredRetreat&&own(choices,'advanceUnitId'))throw Error('Attacker cannot advance into an occupied Fleet port');
   if(!ignoredRetreat&&(outcome==='DR'||(['DRL','EX'].includes(outcome)&&surviving.length))){
    if(forcedRetreat){
     const applied=forcedRetreat.apply({state:next,defenderHex:battle.defenderHex,defenderIds:surviving,
      paths:choices.retreatPaths,loseStep});
     losses.push(...applied.losses);retreats.push(...applied.retreats);
    }else retreats.push(...retreat(next,battle,surviving,choices.retreatPaths));
   }
   else if(own(choices,'retreatPaths'))throw Error('No retreat is required for eliminated defenders');
   let advanced=null;
   if(own(choices,'advanceUnitId')){
    const id=choices.advanceUnitId;
    if(typeof id!=='string'||!battle.attackers.includes(id)||!next.units[id]||
       battle.defenders.some(defender=>next.units[defender]?.hex===battle.defenderHex))
     throw Error('Advance requires surviving attacker and vacated defender hex');
    // Even a cost-free Advance After Combat may not cross a source-forbidden
    // national boundary (§9.4.4 Home Army, §9.4.5 Hungarian exclusion).
    // The default policy of existing historical games remains unrestricted.
    const country=Stack.territorialAccess({profile,board,territory:next.territory},
     next.units[id],battle.defenderHex,'advance');
    if(!country.ok)throw Error('Advance violates territory: '+country.reason);
    // Advance after combat is independent of normal movement costs.
    next.units[id].hex=battle.defenderHex;advanced=id;
   }
   const reaction=portSupport.forcedEntry({before:state,after:next,actor,enteredUnitId:advanced,
    choice:choices.fleetDisplacement});
   const committed=Territory.commit({profile,board,state:reaction.state});
   if(!committed.ok)throw Error('Combat territory transition unverified: '+committed.reason);
   return Object.freeze({state:clone(committed.state),event:{outcome,die,odds:result.finalOdds,
    battle:clone(battle),revealed,losses,retreats,advanced,ignoredRetreat,
    ...(committed.event?{territoryEvent:committed.event}:{}),fleetDisplacement:clone(reaction.event),
    navalSupport:clone(naval),airSupport:clone(airEvent),geography:clone(located.evidence),
    source:combatPolicy.source,scope:forcedRetreat?'verified-effects-forced-retreat-bounded':'verified-effects-safe-retreat-only'}});
  }
  return Object.freeze({resolve,previewPostCasualty,previewKnownOdds,previewEstimatedOdds});
 }
 return Object.freeze({create});
});

};
defs["core/historical_combat_declarations.js"]=function(module,exports,require,Buffer){
/* Shared, opt-in, scenario-configured combat declaration contract.
 * Declares all battles before any dice or outcomes. Source-backed geography
 * and phase permissions are supplied by configuration and graph policies.
 */
(function(root,factory){
 const M=typeof module==='object'&&module.exports?require('./movement_binding.js'):root.WargameMovementBinding;
 const P=typeof module==='object'&&module.exports?require('./phase_runtime.js'):root.WargamePhaseRuntime;
 const api=factory(M,P);if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameHistoricalCombatDeclarations=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(M,P){'use strict';
 const copy=v=>JSON.parse(JSON.stringify(v));
 const key=(a,b)=>[a,b].sort().join(':');
 function create({map,profile,config,combatPolicy=null}){
  if(!config?.scenarioId||config.scenarioId!==profile?.id)throw Error('Combat declaration source profile mismatch');
  const binding=M.build(map,profile), edges=new Map(binding.board.edges.map(e=>[key(e.a,e.b),e]));
  // Only allow this restriction when the opening turn starts directly in
  // combat. Even then, validate the source opening hex rather than the mutable
  // current hex: the rule identifies units by where they SET UP, not where
  // an out-of-sequence action or imported state subsequently places them.
  const restriction=combatPolicy?.firstTurnCombatRestriction||null;
  if(restriction){
   if(!['german','soviet'].includes(restriction.owner)||restriction.turn!==1||
      !Array.isArray(restriction.setupHexes)||!restriction.setupHexes.length||
      new Set(restriction.setupHexes).size!==restriction.setupHexes.length||
      restriction.setupHexes.some(h=>typeof h!=='string'||!binding.board.cells[h])||
      !config.phases?.some(p=>p.id===config.firstTurnStart&&p.owner===restriction.owner&&p.kind==='combat'))
    throw Error('First-turn setup-origin restriction requires an unmoved opening combat phase');
  }
  // Two distinct authorizations are supported. A genuinely complete
  // territorial map can use `complete`. A scenario can also explicitly
  // adjudicate its ORIGINAL SETUP hexes as the entire target set for a
  // limited opening-turn rule. The latter is a game convention, NOT a
  // historically certified political boundary, and must match exactly the
  // source-designated setup hexes from the opposite side's restriction.
  const territory=combatPolicy?.firstTurnTerritorialRestriction||null;
  if(combatPolicy?.requireFirstTurnTerritorialRestriction===true&&!territory)
   throw Error('Required first-turn territorial restriction lacks source-certified target territory');
  if(territory){
   const setupScoped=territory.targetRegionEvidence?.coverage==='setup-hexes-adjudicated';
   const setupScopeValid=!setupScoped||(restriction&&territory.owner!==restriction.owner&&
     territory.turn===restriction.turn&&
     territory.targetRegionEvidence.interpretation==='scenario-turn-1-only'&&
     territory.targetHexes?.length===restriction.setupHexes.length&&
     new Set(territory.targetHexes).size===restriction.setupHexes.length&&
     restriction.setupHexes.every(h=>territory.targetHexes.includes(h)));
   if(!setupScopeValid||!['german','soviet'].includes(territory.owner)||territory.turn!==1||
      !Array.isArray(territory.allowedOpeningHexes)||!territory.allowedOpeningHexes.length||
      new Set(territory.allowedOpeningHexes).size!==territory.allowedOpeningHexes.length||
      territory.allowedOpeningHexes.some(h=>typeof h!=='string'||!binding.board.cells[h])||
      !['complete','setup-hexes-adjudicated'].includes(territory.targetRegionEvidence?.coverage)||
      typeof territory.targetRegionEvidence?.provenance!=='string'||
      !territory.targetRegionEvidence.provenance.trim()||
      !Array.isArray(territory.targetHexes)||!territory.targetHexes.length||
      new Set(territory.targetHexes).size!==territory.targetHexes.length||
      territory.targetHexes.some(h=>typeof h!=='string'||!binding.board.cells[h])||
      !config.phases?.some(p=>p.owner===territory.owner&&p.kind==='combat'))
    throw Error('Invalid source-defined first-turn territory restriction');
  }
  function declare({cursor,actor,state},battles){
   const phase=P.current(config,cursor);
   if(phase?.kind!=='combat'||!phase.permissions?.includes('declare-attack')||phase.owner!==actor)throw Error('Not the actor combat declaration phase');
   if(state?.scenarioId!==config.scenarioId||!state.units||Array.isArray(state.units)||typeof state.units!=='object')throw Error('Invalid combat state');
   if(!Array.isArray(battles))throw Error('Complete battle declaration array required');
   const occupied=new Map();
   for(const [id,u] of Object.entries(state.units)){
    if(!u||u.id!==id||!['german','soviet'].includes(u.owner)||typeof u.hex!=='string'||!binding.board.cells[u.hex])throw Error('Invalid or non-board unit');
    if(!occupied.has(u.hex))occupied.set(u.hex,[]);
    occupied.get(u.hex).push(u);
   }
   const spent=new Set(),targeted=new Set(),out=[];
   for(const b of battles){
    if(!b||typeof b.defenderHex!=='string'||!Array.isArray(b.attackers)||!b.attackers.length||targeted.has(b.defenderHex))throw Error('Invalid or duplicate battle');
    const defenders=occupied.get(b.defenderHex)||[];
    if(!defenders.length||defenders.some(u=>u.owner===actor))throw Error('Battle must target enemy-occupied hex');
    const local=new Set(),origins=new Set();
    const restrictedTerritory=territory&&cursor.turn===1&&actor===territory.owner&&
      territory.targetHexes.includes(b.defenderHex);
    for(const id of b.attackers){
     const u=state.units[id];
     if(typeof id!=='string'||!u||u.owner!==actor||spent.has(id)||local.has(id))throw Error('Attacker unavailable or used twice');
     if(restriction&&cursor.turn===restriction.turn&&actor===restriction.owner){
      if(typeof u.openingHex!=='string'||!binding.board.cells[u.openingHex])
       throw Error('First-turn setup-origin attack requires a valid original setup hex');
      if(restriction.setupHexes.includes(u.openingHex))
       throw Error('First-turn source-designated setup unit cannot attack');
     }
     if(restrictedTerritory&&(!Object.hasOwn(u,'openingHex')||
       !territory.allowedOpeningHexes.includes(u.openingHex)))
      throw Error('First-turn territorial attack requires an eligible original setup hex');
     if(origins.has(u.hex))throw Error('Only one attacker across each hexside');
     const edge=edges.get(key(u.hex,b.defenderHex));
     if(!edge||!edge.verified||edge.impassable||edge.allSea||edge.lake)throw Error('Attack blocked by geography');
     local.add(id);origins.add(u.hex);
    }
    for(const id of local)spent.add(id);
    targeted.add(b.defenderHex);
    out.push({defenderHex:b.defenderHex,attackers:[...b.attackers],defenders:defenders.map(u=>u.id).sort()});
   }
   return Object.freeze({scenarioId:config.scenarioId,cursor:copy(cursor),actor,battles:copy(out),status:'declared-not-resolved',source:config.source||'scenario-configured combat declaration contract'});
  }
  return Object.freeze({metadata:binding.metadata,declare});
 }
 return Object.freeze({create});
});

};
defs["core/historical_combat_geography.js"]=function(module,exports,require,Buffer){
/* Certified, shared map-derived combat geography; no caller-supplied
 * terrain/river flags. The movement-graph policy checks per-map provenance.
 * Default conservatively refuses ordinary city-marker combat; explicit
 * source-typed city mode distinguishes ordinary city from major city.
 */
(function(root,factory){
 const M=typeof module==='object'&&module.exports?require('./movement_binding.js'):root.WargameMovementBinding;
 const api=factory(M);if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameHistoricalCombatGeography=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(M){'use strict';
 const key=(a,b)=>[a,b].sort().join(':');
 function create(map,profile,options={}){
  const typedCities=options.cityMarkerMode==='source-typed-v1';
  if(options.cityMarkerMode!==undefined&&!typedCities)throw Error('Unsupported city marker geography mode');
  const sovietFort=options.fortificationMode==='soviet-defender-only-v1';
  if(options.fortificationMode!==undefined&&!sovietFort)throw Error('Unsupported fortification geography mode');
  const bound=M.build(map,profile);
  const edges=new Map(bound.board.edges.map(e=>[key(e.a,e.b),e]));
  const cells=new Map(map.cells.map(c=>[c.id,c]));
  function evaluate(battle,units){
   if(!battle||!Array.isArray(battle.attackers)||!battle.attackers.length||!cells.has(battle.defenderHex))throw Error('Invalid selected battle');
   const cell=cells.get(battle.defenderHex);
   if(!['open','forest','swamp'].includes(cell.terrain)||bound.board.cells[battle.defenderHex]?.verified!==true)throw Error('Defender terrain not source-certified');
   if(!typedCities&&(cell.tileMarkers||[]).some(m=>m.kind==='city'))throw Error('City modifier requires verified major-city classification');
   const markerKinds=(cell.tileMarkers||[]).filter(m=>['city','majorCity'].includes(m.kind));
   if(typedCities&&(markerKinds.length>1||markerKinds.some(m=>!m.label||!m.sourceSvgId)))throw Error('Unverified city marker identity');
   const fortifications=(cell.tileMarkers||[]).filter(m=>m.kind==='fortification');
   const sovietDefense=sovietFort&&Array.isArray(battle.defenders)&&battle.defenders.length>0&&
    battle.defenders.every(id=>units?.[id]?.owner==='soviet');
   if(sovietFort&&fortifications.some(m=>!m.sourceSvgId))throw Error('Fortification lacks source registration');
   const defenderTerrain=sovietDefense&&fortifications.length?'fortification':
    typedCities&&markerKinds.some(m=>m.kind==='majorCity')?'major-city':cell.terrain;
   const crossings=[];
   for(const id of battle.attackers){
    const origin=units?.[id]?.hex;
    const edge=origin&&edges.get(key(origin,battle.defenderHex));
    if(!edge||!edge.verified||edge.impassable||edge.lake||edge.allSea)throw Error('Attacker edge not source-certified and passable');
    crossings.push({unitId:id,from:origin,to:battle.defenderHex,river:edge.river===true,majorRiver:edge.majorRiver===true,source:edge.source});
   }
   return Object.freeze({defenderTerrain,allAttackersAcrossRiver:crossings.every(x=>x.river),
    evidence:Object.freeze({hex:battle.defenderHex,terrainStatus:cell.terrainStatus,crossings:Object.freeze(crossings.map(x=>Object.freeze(x)))}),status:'certified-geography-only'});
  }
  return Object.freeze({evaluate});
 }
 return Object.freeze({create});
});

};
defs["core/historical_combat_odds.js"]=function(module,exports,require,Buffer){
/* Shared, pure battle-odds calculation; scenario modifiers arrive through
 * source configuration. The legacy defaults preserve existing calculation-only
 * test callers; executable consequences must always pass an explicit policy.
 * Caller must certify unit strengths, geography and support eligibility.
 */
(function(root,factory){
 const C=typeof module==='object'&&module.exports?require('./historical_crt.js'):root.WargameHistoricalCRT;
 const api=factory(C);if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameHistoricalCombatOdds=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(C){'use strict';
 const OWN=x=>Object.prototype.hasOwnProperty.call(x,'value');
 function assertStrength(unit,side,zeroAttackClasses=[]){
  if(!unit||typeof unit!=='object'||!OWN(unit)||!Number.isFinite(unit.value)||(unit.value<0||(unit.value===0&&!(side==='attacker'&&zeroAttackClasses.includes(unit.kind))))||!['infantry','mechanized','panzer','motorized','cavalry','other'].includes(unit.kind))throw Error('Explicit positive verified '+side+' strength and unit kind required');
  if(unit.untried===true)throw Error('Untried unit must be revealed before combat strength is available');
  return unit.value;
 }
 const LEGACY=Object.freeze({terrainColumnShifts:{forest:-1,swamp:-1,'major-city':-1},
  allAttackersAcrossRiverShift:-1,swampTankStrengthMultiplier:.5,
  swampAffectedClasses:['panzer','mechanized'],maximumOdds:6});
 function evaluate({attackers,defenders,defenderTerrain,allAttackersAcrossRiver,airSupportShift=0,fleetShift=0,die=null,policy=null,attackerIds=null,majorRiverCrossers=[],actor=null,turn=null}={}){
  const rules=policy===null?LEGACY:policy.modifiers;
  if(!rules||!rules.terrainColumnShifts||!Array.isArray(rules.swampAffectedClasses)||
    !Number.isInteger(rules.maximumOdds)||rules.maximumOdds<1||rules.maximumOdds>6||
    !Number.isInteger(rules.allAttackersAcrossRiverShift)||rules.allAttackersAcrossRiverShift>0||
    !Number.isFinite(rules.swampTankStrengthMultiplier)||rules.swampTankStrengthMultiplier<=0||
    rules.swampTankStrengthMultiplier>1||
    Object.values(rules.terrainColumnShifts).some(x=>!Number.isInteger(x)||x>0))
   throw Error('Explicit valid source-configured combat modifiers required');
  if(rules.zeroAttackClasses!==undefined&&(!Array.isArray(rules.zeroAttackClasses)||rules.zeroAttackClasses.some(k=>!['infantry','mechanized','panzer','motorized','cavalry','other'].includes(k))))throw Error('Invalid zero-attack authorization');
  if(!Array.isArray(attackers)||!attackers.length||!Array.isArray(defenders)||!defenders.length)throw Error('Complete nonempty attacker/defender strengths required');
  // Optional source-derived, turn-limited bonuses apply only to attacking units.
  // Requiring the combat phase's real owner and turn prevents silent omissions.
  const turnBonuses=rules.attackerTurnMultipliers||[];
  if(!Array.isArray(turnBonuses)||turnBonuses.some(b=>!b||!['german','soviet'].includes(b.owner)||
    !['infantry','mechanized','panzer','motorized','cavalry','other'].includes(b.kind)||
    !Number.isInteger(b.turn)||b.turn<1||!Number.isFinite(b.multiplier)||b.multiplier<=0)||
    new Set(turnBonuses.map(b=>b.owner+':'+b.turn+':'+b.kind)).size!==turnBonuses.length)
   throw Error('Invalid scenario attacker-turn bonus policy');
  if(turnBonuses.length&&(!['german','soviet'].includes(actor)||!Number.isInteger(turn)||turn<1))
   throw Error('Turn-specific combat bonus needs source-bound owner and turn');
  if(!Array.isArray(majorRiverCrossers)||new Set(majorRiverCrossers).size!==majorRiverCrossers.length||
    majorRiverCrossers.some(id=>typeof id!=='string')||
    (majorRiverCrossers.length&&(!Array.isArray(attackerIds)||attackerIds.length!==attackers.length||
    attackerIds.some(id=>typeof id!=='string')||majorRiverCrossers.some(id=>!attackerIds.includes(id))||
    policy?.modifiers?.majorRiverAttackMultiplier!==0.5)))throw Error('Major River strength requires verified attacker IDs and an explicit scenario multiplier');
  if(!['open','forest','swamp','major-city','fortification','other'].includes(defenderTerrain))throw Error('Explicit verified defender terrain required');
  if(typeof allAttackersAcrossRiver!=='boolean')throw Error('Explicit verified river relationship required');
  if(!Number.isInteger(airSupportShift)||airSupportShift<0||airSupportShift>6||!Number.isInteger(fleetShift)||fleetShift<-1||fleetShift>1)throw Error('Invalid support shift');
  const majorSet=new Set(majorRiverCrossers);
  const attackStrength=attackers.reduce((sum,u,i)=>{
   let value=assertStrength(u,'attacker',rules.zeroAttackClasses||[]);
   const turnBonus=turnBonuses.find(b=>b.owner===actor&&b.turn===turn&&b.kind===u.kind);
   if(turnBonus)value*=turnBonus.multiplier;
   if(majorSet.size&&majorSet.has(attackerIds[i]))value=Math.floor(value*rules.majorRiverAttackMultiplier);
   return sum+(defenderTerrain==='swamp'&&rules.swampAffectedClasses.includes(u.kind)?value*rules.swampTankStrengthMultiplier:value);
  },0);
  const defenseStrength=defenders.reduce((sum,u)=>sum+assertStrength(u,'defender'),0);
  const variant=C.normalizeVariant(policy?.crtVariant||'standard');
  const rawOdds=variant==='advanced'?C.columnForRatio(attackStrength/defenseStrength,variant):Math.floor(attackStrength/defenseStrength);
  // The default calculation remains the Oberlabs B4M integer-column rule.
  // Advanced uses the user-supplied 1:2 and 3:2 intermediate columns.
  const cappedOdds=Math.min(rules.maximumOdds,rawOdds);
  const terrainShift=(rules.terrainColumnShifts[defenderTerrain]||0)+(allAttackersAcrossRiver?rules.allAttackersAcrossRiverShift:0);
  const finalOdds=C.shiftColumn(cappedOdds,terrainShift+airSupportShift+fleetShift,rules.maximumOdds,variant);
  const noEffect=finalOdds<(variant==='advanced'?0.5:1);
  if(die!==null&&(!Number.isInteger(die)||die<1||die>6))throw Error('CRT roll must be 1..6');
  return Object.freeze({attackStrength,majorRiverCrossers:[...majorRiverCrossers],defenseStrength,rawOdds,cappedOdds,terrainShift,airSupportShift,fleetShift,finalOdds,noEffect,crtResult:die===null?null:noEffect?'NE':C.result(finalOdds,die,variant),source:policy?.source||'legacy-odds-compatibility-defaults',status:'calculation-only-no-effects'});
 }
 return Object.freeze({evaluate});
});

};
defs["core/historical_combat_phase.js"]=function(module,exports,require,Buffer){
/* Shared, opt-in combat commitment/transaction pilot. Historical source
 * §10: declare all battles, then resolve them in selectable order. All dice
 * are explicitly injected at this boundary; no hidden RNG or partial write.
 * Air Corps/Fleet strike support is optional and marker-committed before dice.
 * This is not a full eight-turn historical campaign or human browser workflow.
 */
(function(root,factory){
 const D=typeof module==='object'&&module.exports?require('./historical_combat_declarations.js'):root.WargameHistoricalCombatDeclarations;
 const P=typeof module==='object'&&module.exports?require('./phase_runtime.js'):root.WargamePhaseRuntime;
 const O=typeof module==='object'&&module.exports?require('./historical_combat_odds.js'):root.WargameHistoricalCombatOdds;
 const G=typeof module==='object'&&module.exports?require('./historical_combat_geography.js'):root.WargameHistoricalCombatGeography;
 const X=typeof module==='object'&&module.exports?require('./historical_combat_consequences.js'):root.WargameHistoricalCombatConsequences;
 const R=typeof module==='object'&&module.exports?require('./historical_retreat_options.js'):root.WargameHistoricalRetreatOptions;
 const S=typeof module==='object'&&module.exports?require('./historical_port_support.js'):root.WargameHistoricalPortSupport;
 const Air=typeof module==='object'&&module.exports?require('./historical_air_support.js'):root.WargameHistoricalAirSupport;
 const api=factory(D,P,O,G,X,R,S,Air);if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameHistoricalCombatPhase=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(D,P,O,G,X,R,S,Air){'use strict';
 const clone=v=>JSON.parse(JSON.stringify(v));
 const readonly=v=>Object.freeze(clone(v));
 function create({map,profile,config,cursor,actor,state,counterConfig=null,combatPolicy=null,enableAirSupport=false,rosterOverlay=null}){
  const declarations=D.create({map,profile,config,combatPolicy});
  const geography=G.create(map,profile,{cityMarkerMode:combatPolicy?.cityMarkerMode,fortificationMode:combatPolicy?.fortificationMode});
  const phase=P.current(config,cursor);
  if(phase?.kind!=='combat'||phase.owner!==actor||!phase.permissions?.includes('declare-attack'))throw Error('Not an authorized combat phase');
  if(state?.scenarioId!==config.scenarioId||!state.units||typeof state.units!=='object'||Array.isArray(state.units))throw Error('Invalid combat state');
  const air=enableAirSupport?Air.create({map,combatPolicy,counterConfig,phaseConfig:config,rosterOverlay}):null;
  const baseline=readonly({cursor,actor,state});
  const airSeaOpen=Boolean(air&&actor===combatPolicy.airSupport.owner&&
   combatPolicy.airSupport.navalAttackMode!=='none');
  return controller({status:airSeaOpen?'air-sea-open':'awaiting-declarations',declaration:null,selected:null,observed:[],baseline,resolved:[],airSeaEvents:[],pendingSeaFaceId:null,groundAirChoice:null,groundAirLocked:false,pendingFleetCombat:null,history:[]});
  function controller(s){
   // Fresh private snapshot for every object; no reference from user arguments is retained.
   const current=clone(s);
   function snapshot(){return clone({status:current.status,declaration:current.declaration,selected:current.selected,observed:current.observed,
    resolved:current.resolved,pendingFleetCombat:current.pendingFleetCombat,...(air?{airSeaEvents:current.airSeaEvents,pendingSeaFaceId:current.pendingSeaFaceId,groundAirChoice:current.groundAirChoice,groundAirLocked:current.groundAirLocked}:{}),cursor:current.baseline.cursor,actor:current.baseline.actor,state:current.baseline.state,
    historyDepth:current.history.length});}
   function pushHistory(next){
    const {history,...previous}=current;
    return controller({...next,history:[...current.history,previous]});
   }
   function availableAir(){
    if(!air||current.status!=='air-sea-open')throw Error('Air-sea phase not open');
    return air.available({state:current.baseline.state,cursor:current.baseline.cursor,actor:current.baseline.actor});
   }
   function declareFleetAttack(faceId){
    if(!air||current.status!=='air-sea-open'||current.pendingSeaFaceId!==null)
     throw Error('Fleet air attack must be declared before the damage roll');
    const eligible=air.available({state:current.baseline.state,cursor:current.baseline.cursor,
     actor:current.baseline.actor});
    if(!eligible.some(x=>x.faceId===faceId))throw Error('Air marker unavailable for Fleet declaration');
    S.create({map,policy:combatPolicy,counterConfig}).validateMarker(current.baseline.state,true);
    return pushHistory({...current,pendingSeaFaceId:faceId});
   }
   function resolveFleetAttack(die){
    if(!air||current.status!=='air-sea-open'||current.pendingSeaFaceId===null)
     throw Error('Fleet air attack must be declared before its die');
    const effect=air.attackFleet({state:current.baseline.state,cursor:current.baseline.cursor,
     actor:current.baseline.actor,faceId:current.pendingSeaFaceId,die});
    const next=pushHistory({...current,pendingSeaFaceId:null,baseline:{...current.baseline,state:effect.state},
     airSeaEvents:[...current.airSeaEvents,effect.event]});
    return Object.freeze({ok:true,session:next,event:clone(effect.event)});
   }
   function finishAirSea(){
    if(!air||current.status!=='air-sea-open'||current.pendingSeaFaceId!==null)throw Error('Air-sea phase not open or has unresolved die');
    return pushHistory({...current,status:'awaiting-declarations'});
   }
   function commit(battles){
    if(current.status!=='awaiting-declarations')throw Error('Combat declarations already committed');
    const declaration=declarations.declare({cursor:current.baseline.cursor,actor:current.baseline.actor,state:current.baseline.state},battles);
    return controller({...current,status:declaration.battles.length?'committed':'no-battles-declared',declaration:clone(declaration)});
   }
   function select(defenderHex){
    if(current.status!=='committed')throw Error('Combat not awaiting resolution');
    if(typeof defenderHex!=='string'||!current.declaration.battles.some(b=>b.defenderHex===defenderHex))throw Error('Battle was not declared');
    // Order is selectable; consequences are derived only from verified sources.
    return controller({...current,status:'battle-selected',selected:defenderHex,groundAirChoice:null,groundAirLocked:false});
   }
   function commitGroundAir(faceId=null){
    if(!air||current.status!=='battle-selected'||current.groundAirLocked||
       current.baseline.actor!==combatPolicy.airSupport.owner)
     throw Error('Ground air choice must be committed before combat die');
    if(faceId!==null){
     const available=air.available({state:current.baseline.state,cursor:current.baseline.cursor,
      actor:current.baseline.actor});
     if(!available.some(x=>x.faceId===faceId))throw Error('Air marker unavailable for ground battle');
    }
    return pushHistory({...current,groundAirChoice:faceId,groundAirLocked:true});
   }
   function evaluateSelected({strengths,defenderTerrain,allAttackersAcrossRiver,airSupportShift=0,fleetShift=0,die=null,majorRiverCrossers=[]}={}){
    if(current.status!=='battle-selected')throw Error('Select a committed battle before calculating odds');
    const battle=current.declaration.battles.find(x=>x.defenderHex===current.selected);
    if(!strengths||typeof strengths!=='object'||Array.isArray(strengths))throw Error('Explicit unit strengths required');
    const expected=[...battle.attackers,...battle.defenders];
    if(Object.keys(strengths).length!==expected.length||expected.some(id=>!Object.prototype.hasOwnProperty.call(strengths,id)))throw Error('Strengths must exactly match all committed battle participants');
    const attackers=battle.attackers.map(id=>strengths[id]);
    const defenders=battle.defenders.map(id=>strengths[id]);
    return O.evaluate({attackers,defenders,defenderTerrain,allAttackersAcrossRiver,airSupportShift,fleetShift,die,
     majorRiverCrossers,attackerIds:battle.attackers,policy:combatPolicy||null,
     actor:current.baseline.actor,turn:current.baseline.cursor.turn});
   }
   function evaluateSelectedFromMap({strengths,airSupportShift=0,airSupportId=null,fleetShift=null,die=null}={}){
    if(current.status!=='battle-selected')throw Error('Select a committed battle before calculating odds');
    const battle=current.declaration.battles.find(x=>x.defenderHex===current.selected);
    const located=geography.evaluate(battle,current.baseline.state.units);
    const boundNaval=combatPolicy?.portSupport?S.create({map,policy:combatPolicy,counterConfig}).inspect({
     state:current.baseline.state,battle,actor:current.baseline.actor}):null;
    if(boundNaval&&fleetShift!==null)throw Error('Fleet shift is determined by source-bound support state');
    if(air&&airSupportShift!==0)throw Error('Source-bound air support cannot accept arbitrary shift');
    if(airSupportId!==null){
     if(!air)throw Error('Air support marker must be enabled');
     const allowed=air.available({state:current.baseline.state,cursor:current.baseline.cursor,actor:current.baseline.actor})
      .find(x=>x.faceId===airSupportId);
     if(!allowed)throw Error('Air support unavailable for battle');
     airSupportShift=allowed.shiftRating;
    }
    const result=evaluateSelected({strengths,defenderTerrain:located.defenderTerrain,
     allAttackersAcrossRiver:located.allAttackersAcrossRiver,airSupportShift,
     majorRiverCrossers:located.evidence.crossings.filter(x=>x.majorRiver).map(x=>x.unitId),
     fleetShift:boundNaval?boundNaval.fleetShift:fleetShift===null?0:fleetShift,die});
    return Object.freeze({...result,navalSupport:boundNaval,geography:located.evidence,status:'certified-geography-calculation-only'});
   }
   // Advisory, safe-only choices for DR outcomes: no dice are rolled, no
   // counter is revealed or removed, and no user-supplied strengths enter.
   // DRL/EX losses, fleet exceptions and forced retreats must be adjudicated
   // separately after a result; these are pre-consequence candidates only.
   function safeRetreatOptions(){
    if(current.status!=='battle-selected')throw Error('Select a committed battle before previewing retreats');
    if(!counterConfig||!combatPolicy)throw Error('Source-backed counter and consequence policies required');
    const battle=current.declaration.battles.find(b=>b.defenderHex===current.selected);
    // Do not advertise routes for battles whose underlying terrain/hexside
    // geography is not yet certified by the consequence handler.
    geography.evaluate(battle,current.baseline.state.units);
    return R.create({map,profile,combatPolicy}).enumerate({state:current.baseline.state,
     defenderHex:battle.defenderHex,defenderIds:battle.defenders});
   }
   // A postcombat advance into an active Fleet port creates a separate
   // destination commitment, saved in the session BEFORE the Fleet damage die.
   // Source legality is verified with the real consequence resolver using a
   // temporary die of 6; that provisional outcome is never committed or shown.
   function commitFleetDisplacement({die,choices={},to}={}){
    if(current.status!=='battle-selected'||!combatPolicy?.portSupport)
     throw Error('Fleet combat displacement requires a selected source-configured battle');
    if(!choices||typeof choices!=='object'||Array.isArray(choices)||
       Object.prototype.hasOwnProperty.call(choices,'fleetDisplacement'))
     throw Error('Fleet destination commitment may not contain a damage die');
    if(typeof to!=='string'||!to)throw Error('Source-registered Fleet destination required');
    if(air&&current.baseline.actor===combatPolicy.airSupport.owner&&!current.groundAirLocked)
     throw Error('Commit ground air choice before CRT resolution');
    const battle=current.declaration.battles.find(b=>b.defenderHex===current.selected);
    if(!battle)throw Error('Selected battle missing');
    const evaluator=X.create({map,profile,counterConfig,combatPolicy,geography,phaseConfig:config,enableAirSupport,rosterOverlay});
    const provisional=evaluator.resolve({state:current.baseline.state,battle,actor:current.baseline.actor,
     die,choices:{...choices,fleetDisplacement:{to,die:6}},
     cursor:current.baseline.cursor,airSupportId:current.groundAirChoice});
    if(provisional.event.fleetDisplacement?.kind!=='forced-fleet-displacement'||
       provisional.event.fleetDisplacement.to!==to)
     throw Error('Commitment does not cause verified forced Fleet entry');
    return pushHistory({...current,status:'fleet-die-pending',
     pendingFleetCombat:{die,choices:clone(choices),to}});
   }
   function completeResolution({die,choices}){
    if(!counterConfig||!combatPolicy)throw Error('Source-backed counter and consequence policies required');
    const battle=current.declaration.battles.find(b=>b.defenderHex===current.selected);
    if(!battle||current.resolved.some(e=>e.battle.defenderHex===battle.defenderHex))throw Error('Battle already resolved');
    if(air&&current.baseline.actor===combatPolicy.airSupport.owner&&!current.groundAirLocked)
     throw Error('Commit ground air choice before combat die');
    const evaluator=X.create({map,profile,counterConfig,combatPolicy,geography,phaseConfig:config,enableAirSupport,rosterOverlay});
    const effect=evaluator.resolve({state:current.baseline.state,battle,actor:current.baseline.actor,die,choices,
     cursor:current.baseline.cursor,airSupportId:current.groundAirChoice});
    const nextResolved=[...current.resolved,effect.event];
    const allDone=nextResolved.length===current.declaration.battles.length;
    const next=pushHistory({...current,status:allDone?'battles-resolved':'committed',selected:null,
     resolved:nextResolved,pendingFleetCombat:null,baseline:{...current.baseline,state:effect.state},groundAirChoice:null,groundAirLocked:false});
    return Object.freeze({ok:true,session:next,event:clone(effect.event)});
   }
   function rollFleetDisplacement(die){
    if(current.status!=='fleet-die-pending'||!current.pendingFleetCombat)
     throw Error('Commit Fleet destination before Fleet damage die');
    if(!Number.isInteger(die)||die<1||die>6)throw Error('Fleet damage roll must be a d6');
    const pending=current.pendingFleetCombat;
    return completeResolution({die:pending.die,
     choices:{...pending.choices,fleetDisplacement:{to:pending.to,die}}});
   }
   function resolveSelected(request={}){
    if(!request||typeof request!=='object'||Array.isArray(request)||
      Object.keys(request).some(k=>!['die','choices'].includes(k)))throw Error('Unbound support or unexpected combat input');
    if(current.status!=='battle-selected')throw Error('Select a committed battle before resolution');
    return completeResolution({die:request.die,choices:request.choices||{}});
   }
   // Kept as the old, intentionally unsupported API: the only action path
   // is resolveSelected, which requires a verified source policy and die.
   function recordResolution(){throw Error('Unbound direct combat-result recording is prohibited');}
   function finish(){
    if(!['no-battles-declared','battles-resolved'].includes(current.status))
     throw Error('Combat completion requires source-verified battle outcome handlers');
    const cursor=P.advance(config,current.baseline.cursor,()=>true);
    const nextPhase=P.current(config,cursor);
    const next=pushHistory({...current,status:'phase-finished',selected:null,
     baseline:{...current.baseline,cursor,actor:nextPhase?.owner||current.baseline.actor}});
    return Object.freeze({ok:true,session:next,nextPhase:nextPhase?.id||null});
   }
   function undo(){
    if(!current.history.length)return Object.freeze({ok:false,reason:'nothing-to-undo',session:controller(current)});
    const past=current.history[current.history.length-1];
    return Object.freeze({ok:true,session:controller({...past,history:current.history.slice(0,-1)})});
   }
   return Object.freeze({snapshot,availableAir,declareFleetAttack,resolveFleetAttack,finishAirSea,commit,select,commitGroundAir,evaluateSelected,evaluateSelectedFromMap,safeRetreatOptions,resolveSelected,commitFleetDisplacement,rollFleetDisplacement,recordResolution,finish,undo});
  }
 }
 return Object.freeze({create});
});

};
defs["core/historical_combat_session.js"]=function(module,exports,require,Buffer){
/* Checkpoint 152 — shared, source-bound, opt-in combat-phase session.
 * Durable action-journal replay with pre-roll commitments and Undo. This is
 * a phase-level engine contract, NOT full historical campaign persistence.
 * Node-only save format; it does not alter the browser or B4M production UI.
 */
'use strict';
const crypto=require('node:crypto');
const Combat=require('./historical_combat_phase');
const MovementBinding=require('./movement_binding');
const FORMAT='wargame-historical-combat-phase';
const VERSION=1,MAX_BYTES=16*1024*1024,MAX_ACTIONS=256;
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function canonical(value){
 const visiting=new WeakSet();
 function walk(x,depth){
  if(depth>64)throw Error('Combat save exceeds nesting limit');
  if(x===null||typeof x==='string'||typeof x==='boolean')return x;
  if(typeof x==='number'&&Number.isFinite(x))return x;
  if(!Array.isArray(x)&&!isObject(x))throw Error('Unsupported combat save value');
  if(visiting.has(x))throw Error('Cyclic combat save value');
  visiting.add(x);
  let y;
  if(Array.isArray(x)){
   if(Object.keys(x).length!==x.length)throw Error('Sparse combat save array');
   y=x.map(v=>walk(v,depth+1));
  }else{
   // Safe own-key assignment; the sorted JSON output is unchanged.
   y=Object.create(null);
   for(const k of Object.keys(x).sort()){
    if(['__proto__','prototype','constructor'].includes(k))throw Error('Forbidden combat save key');
    y[k]=walk(x[k],depth+1);
   }
  }
  visiting.delete(x);return y;
 }
 const result=JSON.stringify(walk(value,0));
 if(Buffer.byteLength(result)>MAX_BYTES)throw Error('Combat save too large');
 return result;
}
const copy=x=>JSON.parse(canonical(x));
const digest=x=>crypto.createHash('sha256').update(canonical(x)).digest('hex');
function exact(x,keys,label){
 if(!isObject(x)||Object.keys(x).length!==keys.length||keys.some(k=>!own(x,k)))
  throw Error('Invalid '+label+' fields');
}
const actions={
 'declare-fleet-attack':['type','faceId'],
 'roll-fleet-attack':['type','die'],
 'finish-air-sea':['type'],
 'commit-battles':['type','battles'],
 'select-battle':['type','defenderHex'],
 'commit-ground-air':['type','faceId'],
 'resolve-battle':['type','die','choices'],
 'commit-fleet-displacement':['type','die','choices','to'],
 'roll-fleet-displacement':['type','die'],
 'finish-combat':['type']
};
function normalizeAction(action){
 if(!isObject(action)||!own(actions,action.type))throw Error('Unsupported combat session action');
 exact(action,actions[action.type],'combat action');
 // Strictly serialize before applying: rejects special JS values and
 // aliased/mutable objects without inventing default decisions.
 return copy(action);
}
function apply(controller,action){
 switch(action.type){
  case 'declare-fleet-attack':return {controller:controller.declareFleetAttack(action.faceId)};
  case 'roll-fleet-attack':{
   const result=controller.resolveFleetAttack(action.die);
   return {controller:result.session,event:result.event};
  }
  case 'finish-air-sea':return {controller:controller.finishAirSea()};
  case 'commit-battles':return {controller:controller.commit(action.battles)};
  case 'select-battle':return {controller:controller.select(action.defenderHex)};
  case 'commit-ground-air':return {controller:controller.commitGroundAir(action.faceId)};
  case 'commit-fleet-displacement':return {controller:controller.commitFleetDisplacement({die:action.die,choices:action.choices,to:action.to})};
  case 'roll-fleet-displacement':{
   const result=controller.rollFleetDisplacement(action.die);
   return {controller:result.session,event:result.event};
  }
  case 'resolve-battle':{
   const result=controller.resolveSelected({die:action.die,choices:action.choices});
   return {controller:result.session,event:result.event};
  }
  case 'finish-combat':{
   const result=controller.finish();return {controller:result.session,event:{nextPhase:result.nextPhase}};
  }
  default:throw Error('Unsupported combat session action');
 }
}
function contextBinding(context){
 if(!isObject(context)||!isObject(context.map)||!isObject(context.profile)||
    !isObject(context.config)||!isObject(context.counterConfig)||!isObject(context.combatPolicy)||
    !isObject(context.cursor)||!isObject(context.state)||typeof context.actor!=='string'||
    typeof context.enableAirSupport!=='boolean')throw Error('Explicit source-bound combat context required');
 if(context.config.scenarioId!==context.combatPolicy.scenarioId||
    context.config.scenarioId!==context.state.scenarioId||
    context.config.scenarioId!==context.cursor.scenarioId)
  throw Error('Combat session scenario mismatch');
 const scope={map:context.map,profile:context.profile,config:context.config,
  counterConfig:context.counterConfig,combatPolicy:context.combatPolicy,
  enableAirSupport:context.enableAirSupport,
  ...(context.rosterOverlay?{rosterOverlay:context.rosterOverlay}:{})};
 const opening={cursor:context.cursor,actor:context.actor,state:context.state};
 return {scopeHash:digest(scope),openingHash:digest(opening)};
}
function replay(context,journal){
 if(!Array.isArray(journal)||journal.length>MAX_ACTIONS)throw Error('Combat action journal limit');
 let controller=Combat.create(context);
 const receipts=[];
 for(const item of journal){
  exact(item,['action','stateHash'],'combat journal entry');
  const action=normalizeAction(item.action);
  if(!/^[0-9a-f]{64}$/.test(item.stateHash))throw Error('Invalid combat journal hash');
  const step=apply(controller,action);controller=step.controller;
  const actual=digest(controller.snapshot());
  if(actual!==item.stateHash)throw Error('Combat journal replay mismatch');
  receipts.push({action,stateHash:actual});
 }
 return {controller,journal:receipts};
}
function session(context,controller,journal,binding){
 // create/restore detach the source once; replay and execute construct private
 // journal arrays from normalized actions. Neither is returned to callers:
 // snapshot, save and event receipts return detached data. Successor sessions
 // can therefore share the source and previous immutable journal entries.
 const source=context;
 const records=journal;
 function snapshot(){return {...controller.snapshot(),actionCount:records.length};}
 function execute(input){
  if(records.length>=MAX_ACTIONS)throw Error('Combat action journal limit');
  const action=normalizeAction(input);
  const result=apply(controller,action);
  const next=[...records,{action,stateHash:digest(result.controller.snapshot())}];
  return Object.freeze({session:session(source,result.controller,next,binding),
   ...(result.event===undefined?{}:{event:copy(result.event)})});
 }
 function undo(){
  if(!records.length)return Object.freeze({ok:false,reason:'nothing-to-undo',session:session(source,controller,records,binding)});
  const {controller:previous,journal:previousRecords}=replay(source,records.slice(0,-1));
  return Object.freeze({ok:true,session:session(source,previous,previousRecords,binding)});
 }
 function save(){
  const payload={format:FORMAT,version:VERSION,scenarioId:source.config.scenarioId,
   bindings:copy(binding),origin:copy({cursor:source.cursor,actor:source.actor,state:source.state}),
   journal:copy(records),finalStateHash:digest(controller.snapshot())};
  return {...payload,integrity:{algorithm:'SHA-256',digest:digest(payload)}};
 }
 return Object.freeze({snapshot,execute,undo,save});
}
function create(context){
 const binding=contextBinding(context),source=MovementBinding.reusePreparedSource(copy(context),context);
 const controller=Combat.create(source);
 return session(source,controller,[],binding);
}
function restore(envelope,context){
 canonical(envelope);
 exact(envelope,['format','version','scenarioId','bindings','origin','journal','finalStateHash','integrity'],'combat save envelope');
 if(envelope.format!==FORMAT||envelope.version!==VERSION||envelope.scenarioId!==context?.config?.scenarioId)
  throw Error('Unsupported combat save scenario/version');
 exact(envelope.integrity,['algorithm','digest'],'combat integrity');
 if(envelope.integrity.algorithm!=='SHA-256'||!/^[0-9a-f]{64}$/.test(envelope.integrity.digest))
  throw Error('Invalid combat checksum');
 const {integrity,...payload}=envelope;
 const actual=digest(payload);
 if(!crypto.timingSafeEqual(Buffer.from(integrity.digest,'hex'),Buffer.from(actual,'hex')))
  throw Error('Combat save checksum mismatch');
 const binding=contextBinding(context);
 exact(envelope.bindings,['scopeHash','openingHash'],'combat bindings');
 if(envelope.bindings.scopeHash!==binding.scopeHash)throw Error('Combat source/configuration mismatch');
 if(envelope.bindings.openingHash!==binding.openingHash||digest(envelope.origin)!==binding.openingHash)
  throw Error('Combat opening state mismatch');
 if(!/^[0-9a-f]{64}$/.test(envelope.finalStateHash))throw Error('Invalid final combat state hash');
 const source=MovementBinding.reusePreparedSource(copy(context),context);
 const {controller,journal}=replay(source,envelope.journal);
 if(digest(controller.snapshot())!==envelope.finalStateHash)throw Error('Combat final replay mismatch');
 return session(source,controller,journal,binding);
}
module.exports=Object.freeze({FORMAT,VERSION,create,restore});

};
defs["core/historical_crt.js"]=function(module,exports,require,Buffer){
/* Shared historical CRT lookup. Browser and Node compatible; pure and deterministic. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameHistoricalCRT=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const COLUMNS={"1":["DR","EX","EX","NE","NE","AL"],"2":["DR","DR","EX","EX","NE","NE"],"3":["DR","DR","DR","EX","EX","DRL"],"4":["DR","DR","EX","DRL","DRL","DE"],"5":["DR","DRL","DRL","DRL","DE","DE"],"6":["DRL","DRL","DE","DE","DE","DE"]};
// Optional player-selected Advanced CRT transcribed from the supplied eight-column chart.
// This matrix is not the Oberlabs standard CRT; never mutate the standard columns.
const ADVANCED_COLUMNS=Object.freeze({
 "0.5":["NE","NE","EX","EX","AL","AL"],
 "1":["DR","NE","NE","EX","EX","AL"],
 "1.5":["DR","NE","NE","EX","EX","EX"],
 "2":["DR","DR","NE","NE","EX","EX"],
 "3":["DRL","DR","DR","DR","EX","EX"],
 "4":["DE","DRL","DRL","DR","DR","EX"],
 "5":["DE","DE","DRL","DRL","DRL","DR"],
 "6":["DE","DE","DE","DE","DRL","DRL"]
});
const ADVANCED_ODDS=Object.freeze([0.5,1,1.5,2,3,4,5,6]);
const HISTORICAL_GAMES=Object.freeze(["battle-for-moscow", "arduous", "leningrad", "kiev", "kiev-odessa"]);
function normalizeVariant(variant='standard'){
 if(!['standard','advanced'].includes(variant))throw Error('Unsupported CRT variant '+variant);
 return variant;
}
function columns(variant='standard'){return normalizeVariant(variant)==='advanced'?ADVANCED_COLUMNS:COLUMNS;}
function result(odds,die,variant='standard'){
 const col=String(odds),table=columns(variant);
 if(!Object.prototype.hasOwnProperty.call(table,col))throw Error('Unsupported CRT odds '+col);
 if(!Number.isInteger(die)||die<1||die>6)throw Error('CRT roll must be 1..6');
 return table[col][die-1];
}
// Ratios below the lowest rolled column return zero (automatic NE). CRT shifts
// always move whole columns, never interpolate or round 3:2 up to 2:1.
function columnForRatio(ratio,variant='standard'){
 normalizeVariant(variant);
 if(!Number.isFinite(ratio)||ratio<0)throw Error('Invalid combat odds ratio');
 if(variant==='standard')return Math.min(6,Math.floor(ratio));
 let col=0;
 for(const value of ADVANCED_ODDS){if(ratio>=value)col=value;else break;}
 return col;
}
function shiftColumn(column,shift,max=6,variant='standard'){
 normalizeVariant(variant);
 if(!Number.isInteger(shift)||!Number.isInteger(max)||max<1||max>6)throw Error('Invalid CRT shift');
 if(variant==='standard')return Math.max(0,Math.min(max,column+shift));
 const positions=[0,...ADVANCED_ODDS.filter(x=>x<=max)];
 const index=positions.indexOf(column);
 if(index<0)throw Error('Invalid advanced CRT base column '+column);
 return positions[Math.max(0,Math.min(positions.length-1,index+shift))];
}
function label(odds){return odds===0.5?'1:2':odds===1.5?'3:2':String(odds)+':1';}
function tableFor(gameId,variant='standard'){
 if(!HISTORICAL_GAMES.includes(gameId))throw Error('Unknown historical CRT game '+gameId);
 return JSON.parse(JSON.stringify(columns(variant)));
}
return Object.freeze({id:'oberlabs-battle-for-moscow-crt-v1',result,tableFor,columns,columnForRatio,shiftColumn,label,normalizeVariant,games:HISTORICAL_GAMES});
});

};
defs["core/historical_fixed_source_pieces.js"]=function(module,exports,require,Buffer){
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

};
defs["core/historical_forced_retreat.js"]=function(module,exports,require,Buffer){
/* Optional, source-configured historical retreat adjudication. This module
 * handles outward two-hex routes and the additional outward hexes required
 * when no compliant stacking endpoint exists (§10.6). One EZOC step per
 * retreat, terminal EZOC elimination and physically blocked paths are handled.
 * Joint collisions are evaluated in possible retreat orders; enumeration
 * remains bounded and fails closed if its search budget is exhausted. */
(function(root,factory){
 const M=typeof module==='object'&&module.exports?require('./movement_binding.js'):root.WargameMovementBinding;
 const Stack=typeof module==='object'&&module.exports?require('./movement_rules.js'):root.WargameMovementRules;
 const T=typeof module==='object'&&module.exports?require('./territorial_state_transition.js'):root.WargameTerritorialStateTransition;
 const api=factory(M,Stack,T);if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameHistoricalForcedRetreat=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(M,Stack,T){'use strict';
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const clone=x=>JSON.parse(JSON.stringify(x));
 const key=(a,b)=>[a,b].sort().join(':');
 function create({map,profile,combatPolicy,counterConfig=null}){
  if(!map||!profile||combatPolicy?.scenarioId!==profile.id||combatPolicy?.retreatMode!=='source-forced-ezoc-v1'||
    !Number.isInteger(combatPolicy.retreatHexes)||combatPolicy.retreatHexes!==2)
   throw Error('Explicit two-hex source forced-retreat policy required');
  const board=M.build(map,profile).board,edges=new Map(),adj=new Map();
  // Automatic elimination is authoritative only on a fully registered LAND
  // graph. An unknown land cell/edge could conceal a valid retreat; fail
  // closed rather than calling it 'no physical route'. Known all-sea cells
  // remain excluded by the certified Lake/All-Sea hexside rule.
  if(board.edges.some(e=>!e.verified)||Object.values(board.cells).some(c=>!c.verified&&c.terrain!=='sea'))
   throw Error('Forced retreat requires fully certified land cells and edges');
  const fronts=new Map((counterConfig?.faces?.front||[]).map(f=>[f.faceId,f]));
  const backs=new Map((counterConfig?.faces?.back||[]).map(f=>[f.faceId,f]));
  function wouldDie(u,route,units){
   const count=route.filter(h=>zoc(h,u.owner,units)).length;
   if(!count)return false;
   if(zoc(route.at(-1),u.owner,units))return true;
   if(u.strengthStatus!=='printed-full')return true;
   const face=backs.get(u.reverseFaceId);
   // Unknown face cannot safely certify simultaneous destination stacking.
   if(!face)throw Error('Source counter reverse needed to certify joint EZOC retreat');
   // §10.6 charges ONE step for a retreat through "a hex or hexes" in EZOC,
   // not one step for each separate EZOC hex entered.
   const reverse=face.visualTranscription||{};
   if(/^\d+-\d+$/.test(reverse.printedValues||''))return false;
   const front=fronts.get(u.sourceFaceId),printed=front?.visualTranscription;
   const dual=/^(\d+)[·.\-](\d+)[·.\-](\d+)$/;
   const full=dual.exec(printed?.printedValues||''),reduced=dual.exec(reverse.printedValues||'');
   return !(front?.pairedFaceId===face.faceId&&face.pairedFaceId===front.faceId&&
    printed?.kind==='infantry'&&reverse.kind==='infantry'&&full&&reduced&&
    +full[1]===u.printedCombatStrength&&+full[3]===u.mp&&+reduced[3]===u.mp&&
    +reduced[1]>0&&+reduced[1]<+full[1]&&+reduced[2]>0&&+reduced[2]<=+full[2]);
  }
  for(const edge of board.edges){
   edges.set(key(edge.a,edge.b),edge);
   for(const [a,b] of [[edge.a,edge.b],[edge.b,edge.a]]){
    if(!adj.has(a))adj.set(a,[]);adj.get(a).push(b);
   }
  }
  for(const neighbors of adj.values())neighbors.sort();
  function traversable(from,to){
   const e=edges.get(key(from,to));
   return !!(e&&e.verified&&!e.impassable&&!e.lake&&!e.allSea&&board.cells[to]?.verified);
  }
  function distances(origin){
   const dist=new Map([[origin,0]]),queue=[origin];
   for(let i=0;i<queue.length;i++)for(const to of adj.get(queue[i])||[]){
    if(!dist.has(to)){dist.set(to,dist.get(queue[i])+1);queue.push(to);}
   }
   return dist;
  }
  function zoc(hex,owner,units){
   return Stack.enemyZOC({board,profile,units},hex,owner);
  }
  function canStack(target,id,units,selected){
   const u=units[id],residents=Object.values(units).filter(x=>x.hex===target&&!selected.has(x.id));
   if(residents.some(x=>x.owner!==u.owner)||residents.length+1>profile.maxStack||
      !Stack.nationalStackLegal(profile,[u,...residents]))return false;
   const maxArmy=combatPolicy.armyStackingByOwner?.[u.owner];
   return !(Number.isInteger(maxArmy)&&residents.filter(x=>x.size==='army').length+(u.size==='army'?1:0)>maxArmy);
  }
  function enumerate({state,defenderHex,defenderIds}){
   if(!state||!state.units||typeof state.units!=='object'||Array.isArray(state.units)||
      !board.cells[defenderHex]?.verified||!Array.isArray(defenderIds)||!defenderIds.length||
      new Set(defenderIds).size!==defenderIds.length||defenderIds.some(id=>typeof id!=='string'||
       !own(state.units,id)||state.units[id].hex!==defenderHex))
    throw Error('Certified retreating defenders at a verified hex required');
   if(new Set(defenderIds.map(id=>state.units[id].owner)).size!==1)
    throw Error('Joint retreat requires defenders of the same faction');
   if(profile.territorialPolicy){
    const verified=Stack.bessarabiaAnnexation({profile,board,units:state.units,territory:state.territory});
    if(!verified.ok)throw Error('Forced retreat country coverage unverified: '+verified.reason);
   }
   const units=clone(state.units),selected=new Set(defenderIds),dist=distances(defenderHex),perDefender={},physicalById={};
   // No arbitrary six-hex cap: the strictly increasing source-board distance
   // supplies a finite termination bound. Fail closed on combinatorial growth.
   const MAX_STATES=30000,MAX_COMBINATIONS=20000;
   let visited=0,incomplete=false,needsOverstackExtension=false;
   function routeOption(route,u){
    return {route,zocHexes:route.filter(h=>zoc(h,u.owner,units)),
     endInEZOC:zoc(route.at(-1),u.owner,units),extraHexes:route.length-combatPolicy.retreatHexes};
   }
   function neighbors(from,route,u){
    return (adj.get(from)||[]).filter(to=>traversable(from,to)&&
     dist.get(to)===route.length+1&&
     !Object.values(units).some(x=>x.owner!==u.owner&&x.hex===to)&&
     T.retreatStep({profile,board,state,unit:u,from,to}));
   }
   for(const id of defenderIds){
    const u=units[id],physical=[],short=[],blocked=[],extended=[];
    function walkTwo(from,route){
     if(incomplete)return;
     if(++visited>MAX_STATES){incomplete=true;return;}
     if(route.length===combatPolicy.retreatHexes){
      physical.push(route);
      if(wouldDie(u,route,units)||canStack(route.at(-1),id,units,selected))short.push(route);
      else blocked.push(route);
      return;
     }
     for(const to of neighbors(from,route,u)){walkTwo(to,[...route,to]);if(incomplete)return;}
    }
    walkTwo(defenderHex,[]);
    physicalById[id]=physical;
    // A prefix that is already stack-legal must stop at two hexes; extending
    // it would be an illegal voluntary extra retreat. A blocked prefix may
    // continue strictly outward. The first non-overstacked endpoint on each
    // branch is compulsory; do not expose longer optional paths past it.
    function walkExtra(from,route){
     if(incomplete)return;
     if(++visited>MAX_STATES){incomplete=true;return;}
     for(const to of neighbors(from,route,u)){
      const next=[...route,to];
      if(wouldDie(u,next,units)||canStack(to,id,units,selected))extended.push(next);
      else walkExtra(to,next);
      if(incomplete)return;
     }
    }
    for(const route of blocked){walkExtra(route.at(-1),route);if(incomplete)break;}
    if(blocked.length)needsOverstackExtension=true;
    const choices=[...short,...extended].map(route=>routeOption(route,u));
    perDefender[id]={physicalRoutes:physical.length,options:choices,
     noPhysicalRoute:physical.length===0,
     overstackOnly:physical.length>0&&!short.length,
     extensionCandidates:extended.length,
     noLegalRoute:physical.length>0&&!choices.length&&!incomplete};
   }
   const pending={},combinations=[];let examined=0;
   function combine(i){
    if(incomplete)return;
    if(i===defenderIds.length){
     if(++examined>MAX_COMBINATIONS){incomplete=true;return;}
     const ends=new Map();
     for(const id of defenderIds){
      const choice=pending[id];if(!choice)continue;
      const u=units[id],likelyRemoved=wouldDie(u,choice.route,units);
      if(likelyRemoved)continue;
      const end=choice.route.at(-1),group=ends.get(end)||[];
      group.push(u);ends.set(end,group);
     }
     for(const [end,group] of ends){
      const all=[...group,...Object.values(units).filter(u=>u.hex===end&&!selected.has(u.id))];
      if(all.length>profile.maxStack||new Set(all.map(u=>u.owner)).size>1||
       !Stack.nationalStackLegal(profile,all))return;
      const maxArmy=combatPolicy.armyStackingByOwner?.[all[0]?.owner];
      if(Number.isInteger(maxArmy)&&all.filter(u=>u.size==='army').length>maxArmy)return;
     }
     combinations.push(clone(pending));return;
    }
    const id=defenderIds[i],detail=perDefender[id];
    if(!detail.options.length){
     pending[id]=null;combine(i+1);delete pending[id];return;
    }
    for(const option of detail.options){pending[id]=option;combine(i+1);if(incomplete)break;}
    delete pending[id];
   }
   combine(0);
   // Mandatory EZOC avoidance applies to final, complete retreat routes;
   // a safe overstack extension beats a two-hex route through EZOC.
   // Among equally safe routes, stop after the shortest necessary extension.
   const required=new Map(defenderIds.map(id=>[id,
    perDefender[id].options.some(opt=>opt.zocHexes.length===0)?0:1]));
   const eligible=combinations.filter(combo=>defenderIds.every(id=>{
    const option=combo[id];return option===null||Number(option.zocHexes.length>0)===required.get(id);
   }));
   const minExtra=eligible.length?Math.min(...eligible.map(combo=>Object.values(combo)
    .reduce((total,opt)=>total+(opt?.extraHexes||0),0))):null;
   const minimal=eligible.filter(combo=>Object.values(combo)
    .reduce((total,opt)=>total+(opt?.extraHexes||0),0)===minExtra);
   const minimumExposedUnits=minimal.length?Math.min(...minimal.map(combo=>
    Object.values(combo).filter(opt=>opt&&opt.zocHexes.length>0).length)):null;
   // Independent routes can expose a fatal endpoint even when a different
   // defender order would force an extra outward hex and save that defender.
   // Previously the order search ran only when NO independent combination
   // existed, silently omitting a safer legally compelled order. Preserve the
   // inexpensive, existing result when all initial combinations survive.
   let finalChoices=minimal,orders=minimal.map(()=>[...defenderIds]);
   const allIndependentKill=!!minimal.length&&minimal.every(c=>defenderIds.some(id=>
    !c[id]||wouldDie(units[id],c[id].route,units)));
   // A more expensive order search is justified only where both defenders
   // have the same individually survivable endpoint (a stacking collision)
   // AND every cheapest independent combination kills a defender. This
   // avoids expanding unrelated EZOC retreats in campaign action catalogs.
   const competingSurvivableEndpoint=defenderIds.length===2&&
    perDefender[defenderIds[0]].options.some(a=>a&&
     !wouldDie(units[defenderIds[0]],a.route,units)&&
     perDefender[defenderIds[1]].options.some(b=>b&&
      a.route.at(-1)===b.route.at(-1)&&!wouldDie(units[defenderIds[1]],b.route,units)));
   // Do not turn a previously tractable campaign preview into an unbounded
   // nested order search. The new casualty-avoidance probe is deliberately
   // limited to small, fully enumerable two-defender option sets.
   // Bound BOTH paths into the expensive order search. The original
   // no-independent-choice path previously bypassed the small-search guard,
   // leading to pathological nested re-enumeration in large action catalogs.
   const smallOrderBudget=(defenderIds.length===2&&
     defenderIds.every(id=>perDefender[id].options.length<=8))||
    (defenderIds.length===3&&defenderIds.every(id=>perDefender[id].options.length<=4));
   const safeOrderSearchSmall=defenderIds.length===2&&minimal.length<=8&&smallOrderBudget;
   const orderSafetySearchLimited=!incomplete&&allIndependentKill&&competingSurvivableEndpoint&&!safeOrderSearchSmall;
   const orderDiscoveryLimited=!incomplete&&defenderIds.length>1&&!minimal.length&&!smallOrderBudget;
   if(!incomplete&&defenderIds.length>1&&
    ((!minimal.length&&smallOrderBudget)||(allIndependentKill&&competingSurvivableEndpoint&&safeOrderSearchSmall))){
    const candidates=[],assignment={},placed=[],order=[];
    const permanent=Object.values(units).filter(u=>!selected.has(u.id));
    let branches=0;
    function stackable(id,hex){
     const u=units[id],group=[...permanent,...placed].filter(x=>x.hex===hex);
     if(group.some(x=>x.owner!==u.owner)||group.length+1>profile.maxStack||
      !Stack.nationalStackLegal(profile,[u,...group]))return false;
     const maxArmy=combatPolicy.armyStackingByOwner?.[u.owner];
     return !(Number.isInteger(maxArmy)&&group.filter(x=>x.size==='army').length+
      (u.size==='army'?1:0)>maxArmy);
    }
    function optionsFor(id){
     const u=units[id],options=[];
     function extend(route){
      if(incomplete)return;
      if(++visited>MAX_STATES){incomplete=true;return;}
      for(const to of neighbors(route.at(-1),route,u)){
       const next=[...route,to];
       if(wouldDie(u,next,units)||stackable(id,to))options.push(routeOption(next,u));
       else extend(next);
       if(incomplete)return;
      }
     }
     for(const route of physicalById[id]){
      if(wouldDie(u,route,units)||stackable(id,route.at(-1)))options.push(routeOption(route,u));
      else extend(route);
      if(incomplete)return [];
     }
     return options;
    }
    function step(){
     if(incomplete)return;
     if(++branches>MAX_COMBINATIONS){incomplete=true;return;}
     if(order.length===defenderIds.length){
      candidates.push({choice:clone(assignment),order:[...order]});return;
     }
     for(const id of defenderIds){
      if(order.includes(id))continue;
      const options=optionsFor(id);
      // If every physical retreat is blocked even after mandatory extension,
      // that defender is eliminated. Other possible orders are considered,
      // so this cannot force a premature elimination in the final output.
      for(const option of options.length?options:[null]){
       assignment[id]=option;order.push(id);
       const removed=option===null||wouldDie(units[id],option.route,units);
       if(!removed)placed.push({...units[id],hex:option.route.at(-1)});
       step();
       if(!removed)placed.pop();
       order.pop();delete assignment[id];
       if(incomplete)return;
      }
     }
    }
    step();
    if(!incomplete&&candidates.length){
     // §10.6 requires EZOC avoidance when possible; avoid eliminating a
     // defender if any joint ordering can save it, then prefer fewer EZOC
     // exposures, then the shortest necessary overstack extension.
     const score=c=>{
      let dead=0,exposed=0,extra=0;
      for(const id of defenderIds){
       const o=c.choice[id];
       if(!o||wouldDie(units[id],o.route,units))dead++;
       if(o?.zocHexes.length)exposed++;
       extra+=o?.extraHexes||0;
      }
      return [dead,exposed,extra];
     };
     const sortScore=(a,b)=>a.reduce((v,x,i)=>v||(x-b[i]),0);
     // Compare independent and ordered options on the same terms. A forced
     // extra hex that saves a unit outranks a shorter fatal retreat. Retain
     // all equal-best source-valid choices, with stable defender-order ties.
     const pool=[...minimal.map((choice,i)=>({choice,order:orders[i]})),...candidates];
     pool.sort((a,b)=>sortScore(score(a),score(b))||
      a.order.join(':').localeCompare(b.order.join(':')));
     const best=score(pool[0]),seen=new Set(),chosen=[],chosenOrders=[];
     for(const c of pool){
      if(sortScore(score(c),best)!==0)break;
      const fingerprint=JSON.stringify(defenderIds.map(id=>c.choice[id]?.route||null));
      if(seen.has(fingerprint))continue;
      seen.add(fingerprint);chosen.push(c.choice);chosenOrders.push(c.order);
     }
     finalChoices=chosen;orders=chosenOrders;
     if(finalChoices.length)needsOverstackExtension||=finalChoices.some(c=>
      Object.values(c).some(o=>o&&o.extraHexes>0));
    }
   }
   // If a casualty-avoiding ordered retreat might exist but the search was
   // deliberately skipped for cost, do not certify a potentially fatal
   // independent fallback. Source §10.6 requires avoidance when possible.
   // The candidate routes remain diagnostic-only until jointly resolved.
   const jointExtensionUnresolved=(defenderIds.length>1&&!finalChoices.length&&
    Object.values(perDefender).some(x=>x.options.length))||orderSafetySearchLimited||orderDiscoveryLimited;
   return {status:incomplete?'enumeration-incomplete':jointExtensionUnresolved?'joint-retreat-unresolved':
     finalChoices.length?'certified-forced-retreat-options':'joint-retreat-unresolved',
    exhaustive:!incomplete&&!jointExtensionUnresolved,perDefender,combinations:finalChoices,
    jointOrders:orders,orderDependent:orders.some(x=>JSON.stringify(x)!==JSON.stringify(defenderIds)),
    minimumExposedUnits:finalChoices.length?Math.min(...finalChoices.map(c=>
     Object.values(c).filter(o=>o&&o.zocHexes.length>0).length)):minimumExposedUnits,
    needsOverstackExtension,
    extensionsAdjudicated:!incomplete&&!jointExtensionUnresolved,
    // If true, listed options are only diagnostic candidates, never
    // executable actions: survivor-preserving ordering was not certified.
    orderSafetySearchLimited,orderDiscoveryLimited,visited,examined};
  }
  function apply({state,defenderHex,defenderIds,paths,loseStep}){
   const report=enumerate({state,defenderHex,defenderIds});
   if(report.status==='enumeration-incomplete'||report.status==='joint-retreat-unresolved')
    throw Error('Retreat enumeration incomplete or unresolved joint selection');
   if(!report.combinations.length)throw Error('No certified retreat adjudication');
   const provided=paths===undefined?{}:paths;
   if(!provided||typeof provided!=='object'||Array.isArray(provided))throw Error('Complete retreat paths required');
   const matchIndex=report.combinations.findIndex(combo=>{
    const expected=Object.keys(combo).filter(id=>combo[id]!==null);
    return Object.keys(provided).length===expected.length&&expected.every(id=>
     Array.isArray(provided[id])&&JSON.stringify(provided[id])===JSON.stringify(combo[id].route));
   });
   if(matchIndex<0)throw Error('Complete retreat paths required: invalid outward route or non-mandatory EZOC retreat choice');
   const match=report.combinations[matchIndex],commitOrder=report.jointOrders[matchIndex];
   const losses=[],retreats=[];
   for(const id of commitOrder){
    const option=match[id];
    if(!option){delete state.units[id];losses.push({unitId:id,removed:true,reason:'no-legal-retreat'});continue;}
    const {route}=option;let removed=false,last=defenderHex,ezocLossApplied=false;
    for(const hex of route){
     last=hex;
     if(!ezocLossApplied&&zoc(hex,state.units[id].owner,state.units)){
      ezocLossApplied=true;
      const loss=loseStep(state,id);losses.push({...loss,reason:'forced-retreat-ezoc',hex});
      if(loss.removed){removed=true;break;}
     }
    }
    if(!removed&&zoc(last,state.units[id].owner,state.units)){
     delete state.units[id];losses.push({unitId:id,removed:true,reason:'retreat-ended-in-ezoc',hex:last});removed=true;
    }
    if(!removed){state.units[id].hex=last;retreats.push({unitId:id,to:last,route:clone(route)});}
   }
   return {losses,retreats,reportStatus:report.status,retreatOrder:commitOrder};
  }
  return Object.freeze({enumerate,apply});
 }
 return Object.freeze({create});
});

};
defs["core/historical_movement_actions.js"]=function(module,exports,require,Buffer){
/* Opt-in historical movement -> common phase-action dispatcher.
 * Does not authorize a complete historical game or implement turn completion.
 * The ONLY source of movement legality is movement_binding.move().
 */
(function(root,factory){
 const binding=typeof module==='object'&&module.exports?require('./movement_binding.js'):root.WargameMovementBinding;
 const phases=typeof module==='object'&&module.exports?require('./phase_actions.js'):root.WargamePhaseActions;
 const port=typeof module==='object'&&module.exports?require('./historical_port_support.js'):root.WargameHistoricalPortSupport;
 const territory=typeof module==='object'&&module.exports?require('./territorial_state_transition.js'):root.WargameTerritorialStateTransition;
 const rules=typeof module==='object'&&module.exports?require('./movement_rules.js'):root.WargameMovementRules;
 const api=factory(binding,phases,port,territory,rules);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameHistoricalMovementActions=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(B,X,Port,T,Rules){'use strict';
 function create({map,profile,config,supportPolicy=null,counterConfig=null}){
  if(!config||!map||!profile||config.scenarioId!==profile.id)
   throw Error('Historical movement configuration mismatch');
  const board=B.build(map,profile); // source/hexside certification gates retained
  if(supportPolicy&&supportPolicy.scenarioId!==config.scenarioId)throw Error('Movement support policy mismatch');
  const fleet=Port.create({map,policy:supportPolicy,counterConfig});
  function legalContext(draft,phase,turn){
   return B.context(board,phase,draft.units,turn,draft.territory);
  }
  function territoryValid(ctx){
   return !profile.territorialPolicy||Rules.bessarabiaAnnexation({...ctx,profile}).ok;
  }
  function phaseBinding({cursor,actor,state}){
   if(!state||state.scenarioId!==config.scenarioId||!state.units||Array.isArray(state.units)||typeof state.units!=='object')
    throw Error('Historical movement state mismatch');
   const ids=Object.keys(state.units);
   if(ids.some(id=>!state.units[id]||state.units[id].id!==id))throw Error('Malformed historical units');
   return {config,cursor,actor,state,rules:{move:{
    legal:(draft,request,phase)=>{
     const ctx=legalContext(draft,phase,cursor.turn);
     return territoryValid(ctx)&&Rules.move(ctx,request).ok===true;
    },
    apply:(draft,request,phase)=>{
     const outcome=B.move(board,phase,draft.units,cursor.turn,request,draft.territory);
     if(!outcome.ok)return {ok:false};
     const unit=draft.units[request.unitId];
     if(!unit||outcome.to!==request.path?.at(-1))return {ok:false};
     unit.hex=outcome.to;
     const reaction=fleet.forcedEntry({before:state,after:draft,actor,enteredUnitId:request.unitId,
      choice:request.fleetDisplacement});
     const committed=T.commit({profile,board:board.board,state:reaction.state});
     if(!committed.ok)return {ok:false};
     return {ok:true,state:committed.state,result:{...outcome,fleetDisplacement:reaction.event,
      ...(committed.event?{territoryEvent:committed.event}:{})}};
    }
   }}};
  }
  // Use the ordinary phase guard and its detached inputs once for this
  // read-only batch. Only this trusted movement callback shares the draft.
  function legalBatch(session,requests){
   const binding=phaseBinding(session);let results;
   binding.rules.move.legal=(draft,batch,phase)=>{
    const ctx=legalContext(draft,phase,session.cursor.turn);
    results=Rules.withSearchIndexes(ctx,()=>{
     if(!territoryValid(ctx))return batch.map(()=>false);
     return batch.map(request=>{try{return Rules.move(ctx,request).ok===true;}catch(_){return false;}});
    });
    return true;
   };
   X.legal(binding,'move',requests);
   return results;
  }
  return Object.freeze({
   metadata:board.metadata,legalBatch,
   legal:(session,request)=>X.legal(phaseBinding(session),'move',request),
   execute:(session,request)=>X.execute(phaseBinding(session),'move',request)
  });
 }
 return Object.freeze({create});
});

};
defs["core/historical_naval_logistics.js"]=function(module,exports,require,Buffer){
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

};
defs["core/historical_port_support.js"]=function(module,exports,require,Buffer){
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

};
defs["core/historical_retreat_options.js"]=function(module,exports,require,Buffer){
/* Shared, read-only preview of SAFE historical two-hex retreat choices.
 * Uses the same verified movement board and restrictions as the bounded
 * consequence handler. It never adjudicates forced EZOC step losses,
 * overstack extensions, fleet-port exemptions, or automatic elimination.
 * This is not a general historical retreat solver.
 */
(function(root,factory){
 const M=typeof module==='object'&&module.exports?require('./movement_binding.js'):root.WargameMovementBinding;
 const Stack=typeof module==='object'&&module.exports?require('./movement_rules.js'):root.WargameMovementRules;
 const T=typeof module==='object'&&module.exports?require('./territorial_state_transition.js'):root.WargameTerritorialStateTransition;
 const api=factory(M,Stack,T);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameHistoricalRetreatOptions=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(M,Stack,T){'use strict';
 const key=(a,b)=>[a,b].sort().join(':');
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
 function create({map,profile,combatPolicy}){
  if(!map||!profile||!combatPolicy||combatPolicy.schemaVersion!==1||
    combatPolicy.scenarioId!==profile.id||combatPolicy.safeRetreatOnly!==true||
    !Number.isInteger(combatPolicy.retreatHexes)||combatPolicy.retreatHexes<1||combatPolicy.retreatHexes>4)
   throw Error('A configured safe-retreat-only source policy is required');
  const bound=M.build(map,profile),board=bound.board;
  const adjacency=new Map(),edges=new Map();
  for(const e of board.edges){
   edges.set(key(e.a,e.b),e);
   for(const [from,to] of [[e.a,e.b],[e.b,e.a]]){
    if(!adjacency.has(from))adjacency.set(from,[]);
    adjacency.get(from).push(to);
   }
  }
  for(const steps of adjacency.values())steps.sort();
  function distances(origin){
   const d=new Map([[origin,0]]),queue=[origin];
   for(let i=0;i<queue.length;i++){
    const from=queue[i],distance=d.get(from);
    if(distance>=combatPolicy.retreatHexes)continue;
    for(const to of adjacency.get(from)||[]){if(!d.has(to)){d.set(to,distance+1);queue.push(to);}}
   }
   return d;
  }
  function safeEdge(a,b){
   const e=edges.get(key(a,b));
   return !!(e&&e.verified&&!e.impassable&&!e.lake&&!e.allSea&&board.cells[b]?.verified);
  }
  function ezoc(hex,owner,units){
   return Stack.enemyZOC({board,profile,units},hex,owner);
  }
  function enumerate({state,defenderHex,defenderIds}={}){
   if(!state||!state.units||typeof state.units!=='object'||Array.isArray(state.units)||
     !board.cells[defenderHex]?.verified||!Array.isArray(defenderIds)||!defenderIds.length||
     new Set(defenderIds).size!==defenderIds.length||defenderIds.some(id=>typeof id!=='string'||!own(state.units,id)||state.units[id].hex!==defenderHex))
    throw Error('Retreat preview requires certified target and present defender IDs');
   // A country-restricted force must never be declared eliminated just
   // because the historical national-territory mask is not yet certified.
   if(profile.territorialPolicy){
    const verified=Stack.bessarabiaAnnexation({profile,board,units:state.units,territory:state.territory});
    if(!verified.ok)throw Error('Retreat country coverage unverified: '+verified.reason);
   }
   // Snapshot for the whole computation: no mutating user-provided game state.
   const units=JSON.parse(JSON.stringify(state.units)),distance=distances(defenderHex);
   const selected=new Set(defenderIds),result={};
   for(const id of defenderIds){
    const u=units[id],routes=[],walk=(origin,route)=>{
     if(route.length===combatPolicy.retreatHexes){
      const target=route.at(-1);
      const residents=Object.values(units).filter(other=>other.hex===target&&!selected.has(other.id));
      if(residents.length+1>profile.maxStack||residents.some(x=>x.owner!==u.owner)||
       !Stack.nationalStackLegal(profile,[u,...residents]))return;
      const maxArmy=combatPolicy.armyStackingByOwner?.[u.owner];
      if(Number.isInteger(maxArmy)&&residents.filter(x=>x.size==='army').length+(u.size==='army'?1:0)>maxArmy)return;
      routes.push(route);return;
     }
     for(const to of adjacency.get(origin)||[]){
      if(!safeEdge(origin,to)||distance.get(to)!==route.length+1||
       Object.values(units).some(x=>x.hex===to&&x.owner!==u.owner)||ezoc(to,u.owner,units)||
       !T.retreatStep({profile,board,state,unit:u,from:origin,to}))continue;
      walk(to,[...route,to]);
     }
    };
    walk(defenderHex,[]);
    result[id]=routes;
   }
   // Individual routes may collide with other retreating units; present only
   // combinations satisfying all final stack limits, not an independent-choice
   // cartesian product misleadingly described as a legal combined retreat.
   const combinations=[],pending={},LIMIT=20000;
   let examined=0,truncated=false;
   function combine(i){
    if(truncated)return;
    if(i===defenderIds.length){
     examined++;if(examined>LIMIT){truncated=true;return;}
     const final=Object.values(units).filter(x=>!selected.has(x.id)).map(x=>({...x}));
     for(const id of defenderIds)final.push({...units[id],hex:pending[id].at(-1)});
     const byHex=new Map();
     for(const u of final){if(!byHex.has(u.hex))byHex.set(u.hex,[]);byHex.get(u.hex).push(u);}
     for(const [hex,group] of byHex){
      if(!defenderIds.some(id=>pending[id].at(-1)===hex))continue;
      if(group.length>profile.maxStack||new Set(group.map(u=>u.owner)).size>1||
       !Stack.nationalStackLegal(profile,group))return;
      const maxArmy=combatPolicy.armyStackingByOwner?.[group[0].owner];
      if(Number.isInteger(maxArmy)&&group.filter(u=>u.size==='army').length>maxArmy)return;
     }
     combinations.push(JSON.parse(JSON.stringify(pending)));return;
    }
    const id=defenderIds[i];for(const route of result[id]){pending[id]=route;combine(i+1);if(truncated)break;}
    delete pending[id];
   }
   combine(0);
   return freeze({status:truncated?'incomplete-enumeration':combinations.length?'safe-options-only':'no-certified-safe-route',
    scope:'safe-retreat-preview-only',stateChanged:false,forcedEZOCAdjudicated:false,
    overstackExtensionAdjudicated:false,automaticEliminationAdjudicated:false,
    retreatHexes:combatPolicy.retreatHexes,perDefender:result,jointOptions:combinations,
    exhaustive:!truncated,examinedCombinations:Math.min(examined,LIMIT)});
  }
  return Object.freeze({enumerate});
 }
 return Object.freeze({create});
});

};
defs["core/historical_support_movement.js"]=function(module,exports,require,Buffer){
/* Optional scenario-neutral support-marker movement transaction.
 * A destination is committed BEFORE the damage die is supplied. History is
 * replayable, immutable and Undo-safe. This is a bounded special-phase pilot:
 * no full campaign turn sequencing or German-forced Fleet displacement.
 */
(function(root,factory){
 const Phase=typeof module==='object'&&module.exports?require('./phase_runtime'):root.WargamePhaseRuntime;
 const Port=typeof module==='object'&&module.exports?require('./historical_port_support'):root.WargameHistoricalPortSupport;
 const api=factory(Phase,Port);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameHistoricalSupportMovement=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Phase,Port){'use strict';
 const clone=v=>JSON.parse(JSON.stringify(v));
 const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const keys=(v,expected)=>obj(v)&&same(Object.keys(v).sort(),[...expected].sort());
 function factory({map,policy,counterConfig,phaseConfig}){
  if(!policy||phaseConfig?.scenarioId!==policy.scenarioId)throw Error('Support phase scenario mismatch');
  const port=Port.create({map,policy,counterConfig});
  const owner=policy.portSupport.owner;
  function gate(cursor,actor){
   const p=Phase.current(phaseConfig,cursor);
   if(!p||!['special-movement','naval-operations'].includes(p.kind)||p.owner!==owner||actor!==owner||
      !p.permissions?.includes('move-support'))throw Error('Support movement permitted only in owning special phase');
  }
  function replay(initial,actions){
   if(!keys(initial,['cursor','actor','state'])||!Array.isArray(actions)||actions.length>3)
    throw Error('Invalid Fleet transaction history');
   gate(initial.cursor,initial.actor);
   port.validateMarker(initial.state,true);
   let state=clone(initial.state),cursor=clone(initial.cursor),status='ready',pending=null,event=null;
   for(const action of actions){
    if(!obj(action))throw Error('Malformed Fleet phase action');
    if(action.kind==='declare'&&keys(action,['kind','to'])&&status==='ready'){
     port.validateDestination({state,to:action.to});
     pending=action.to;status='awaiting-damage-roll';
    }else if(action.kind==='roll'&&keys(action,['kind','die'])&&status==='awaiting-damage-roll'){
     const change=port.relocate({state,to:pending,die:action.die});
     state=change.state;event=change.event;pending=null;status='moved';
    }else if(action.kind==='finish'&&keys(action,['kind'])&&['ready','moved'].includes(status)){
     cursor=Phase.advance(phaseConfig,cursor,()=>true);status='finished';
    }else throw Error('Illegal Fleet phase action ordering');
   }
   return {cursor,actor:initial.actor,state,status,pending,event};
  }
  function controller(initial,actions){
   const start=clone(initial),log=clone(actions),current=replay(start,log);
   function snapshot(){return clone({...current,initial:start,actions:log});}
   function invoke(action){return controller(start,[...log,action]);}
   function declareMove(to){return invoke({kind:'declare',to});}
   function resolveDamage(die){return invoke({kind:'roll',die});}
   function finish(){return invoke({kind:'finish'});}
   function undo(){return log.length?{ok:true,session:controller(start,log.slice(0,-1))}:
    {ok:false,reason:'nothing-to-undo',session:controller(start,log)};}
   return Object.freeze({snapshot,declareMove,resolveDamage,finish,undo});
  }
  function create({cursor,actor,state}){return controller({cursor,actor,state},[]);}
  function restoreSnapshot(saved){
   if(!keys(saved,['cursor','actor','state','status','pending','event','initial','actions']))
    throw Error('Malformed Fleet phase snapshot');
   const restored=controller(saved.initial,saved.actions);
   if(!same(restored.snapshot(),saved))throw Error('Fleet phase snapshot does not match replay');
   return restored;
  }
  return Object.freeze({create,restoreSnapshot,portHexes:port.portHexes});
 }
 return Object.freeze({factory});
});

};
defs["core/legal_pathfinding.js"]=function(module,exports,require,Buffer){
/* Rule-aware, bounded path enumeration on the SAME certified graph as movement adjudication.
 * Validates every returned destination/path with movement_rules.move().
 * Unlike shortest paths over terrain alone, this does not treat EZOC as a static edge weight.
 * Stop legality and transit-only legality are separate. Transit over a friendly stack
 * requires explicit profile authorization and NEVER yields a reported destination.
 */
(function(root,factory){
 const P=typeof module==='object'&&module.exports?require('./pathfinding'):root.WargamePathfinding;
 const M=typeof module==='object'&&module.exports?require('./movement_rules'):root.WargameMovementRules;
 const api=factory(P,M);if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameLegalPathfinding=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(P,M){'use strict';
 const fail=m=>{throw Error('legal-pathfinding: '+m);};
 function search(ctx,options={}){
  if(!ctx||!ctx.board||!ctx.units||!ctx.profile||!ctx.phase)fail('invalid-context');
  return M.withSearchIndexes(ctx,()=>searchIndexed(ctx,options));
 }
 // One immutable read scope for a batch of unit searches; never retained across calls.
 function searchBatch(ctx,queries){
  if(!ctx||!ctx.board||!ctx.units||!ctx.profile||!ctx.phase||!Array.isArray(queries))fail('invalid-context');
  return M.withSearchIndexes(ctx,()=>{const graph=P.compile(ctx.board);return queries.map(q=>searchIndexed(ctx,q,graph));});
 }
 function searchIndexed(ctx,{unitId,mode=null,maxStates=50000,maxDepth=null}={},compiled=null){
  if(!ctx||!ctx.board||!ctx.units||!ctx.profile||!ctx.phase||!ctx.units[unitId])fail('invalid-context');
  if(mode!==null&&mode!=='rail')fail('unsupported-mode');
  if(!Number.isSafeInteger(maxStates)||maxStates<1)fail('invalid-max-states');
  const unit=ctx.units[unitId];if(typeof unit.hex!=='string')fail('invalid-origin');
  const graph=compiled||P.compile(ctx.board);if(!Object.hasOwn(graph.adj,unit.hex))fail('invalid-origin');
  const limit=maxDepth===null?unit.mp:maxDepth;
  if(!Number.isSafeInteger(limit)||limit<1||limit>graph.ids.length)fail('invalid-max-depth');
  const origin=unit.hex, found=new Map();
  // Discard only provably dominated route prefixes. Movement legality after a
  // prefix depends on current hex, remaining MP and the already-visited hexes.
  // A cheaper prefix with a SUBSET of visited hexes can follow every onward
  // suffix of the longer prefix; arbitrary cheapest-by-hex pruning is UNSAFE.
  const dominates=(a,b)=>a.cost<=b.cost&&
   (a.cost<b.cost||a.key<=b.key)&&[...a.visited].every(id=>b.visited.has(id));
  const labels=new Map();
  const first={path:[origin],cost:0,key:origin,visited:new Set([origin]),discarded:false};
  labels.set(origin,[first]);
  // Deterministic frontier ordering, with no artificial static-terrain cost assumptions.
  const queue=[first];let head=0, expanded=0;
  while(head<queue.length){
   const current=queue[head++];
   if(current.discarded)continue;
   if(++expanded>maxStates)fail('search-limit-exceeded');
   if(current.path.length-1>=limit)continue;
   const from=current.path[current.path.length-1];
   for(const {to} of graph.adj[from]){
    if(current.path.includes(to))continue;
    const path=[...current.path,to];
    const request={unitId,path};if(mode)request.mode=mode;
    const verdict=M.move(ctx,request);
    // A transit-only step can be expanded, but is never advertised as a legal stop.
    const through=verdict.ok?verdict:M.transit(ctx,request);
    if(!through.ok)continue;
    if(verdict.ok){
     const old=found.get(to);
     if(!old||verdict.cost<old.cost||(verdict.cost===old.cost&&path.join('|')<old.path.join('|')))
      found.set(to,{id:to,path,cost:verdict.cost,remaining:verdict.remaining});
    }
    // Every expanded prefix has been authorized by the common movement adjudicator.
    // Consult the same transit rule for exceptional EZOC passage (e.g. Surprise Attack).
    if(through.remaining>0&&(!M.enemyZOC(ctx,to,unit.owner)||M.transit(ctx,request).ok)){
     const next={path,cost:through.cost,key:path.join('|'),visited:new Set(path),discarded:false};
     const at=labels.get(to)||[];
     if(!at.some(old=>dominates(old,next))){
      const survivors=[];
      for(const old of at){
       if(dominates(next,old))old.discarded=true;
       else survivors.push(old);
      }
      survivors.push(next);labels.set(to,survivors);queue.push(next);
     }
    }
   }
  }
  const ordered=[...found.values()].sort((a,b)=>a.cost-b.cost||a.id.localeCompare(b.id));
  return Object.freeze({origin,expanded,reachable:()=>ordered.map(r=>({...r,path:[...r.path]})),
   pathTo:id=>found.get(id)?.path.slice()??null,costTo:id=>found.get(id)?.cost??Infinity,
   withinBudget:budget=>{if(!Number.isFinite(budget)||budget<0)fail('invalid-budget');return ordered.filter(x=>x.cost<=budget).map(r=>({...r,path:[...r.path]}));}});
 }
 return Object.freeze({search,searchBatch});
});

};
defs["core/map_movement_graph.js"]=function(module,exports,require,Buffer){
/* Bind approved map configurations to executable movement edges WITHOUT changing
 * artwork or promoting provisional data to game rules.
 * Eligibility is declared in the separate, source-specific graph-policy registry.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameMapMovementGraph=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const T=(typeof HexTerrainTiles!=='undefined')?HexTerrainTiles:(typeof require==='function'?require('./terrain_tiles'):null);
const Reviewed=(typeof require==='function')?require('./source_reviewed_movement_graph'):(typeof WargameSourceReviewedMovementGraph!=='undefined'?WargameSourceReviewedMovementGraph:null);
const Experimental=(typeof require==='function')?require('./source_experimental_movement_graph'):(typeof WargameSourceExperimentalMovementGraph!=='undefined'?WargameSourceExperimentalMovementGraph:null);
const fail=(reason)=>{throw Error('movement-map-binding: '+reason);};
const policies=(typeof require==='function' && typeof module==='object'&&module.exports)
 ? require('../maps/movement-configs/graph-sources.json') : null;
function checkPolicy(map,{experimentalScope=null}={}){
 const policy=policies?.maps?.[map.id];
 if(!policy||policy.mapId!==map.id||policy.sourceGame!==map.sourceGame||
    policy.sourceImageSHA256!==map.sourceImageSHA256||
    policy.geometryStatus!==map.geometry.calibrationStatus)
   return fail('source-geometry-not-gameplay-certified');
 if(policy.status==='experimental'){
  if(policy.edgeMode!=='source-vector-experimental-v1'||
    policy.evidenceTier!=='source-derived-candidate'||
    typeof experimentalScope!=='string'||experimentalScope!==policy.authorizationScope)
   return fail('source-geometry-not-gameplay-certified');
  return policy;
 }
 if(policy.status!=='verified'||policy.evidenceTier!=='source-authoritative')
  return fail('source-geometry-not-gameplay-certified');
 if(policy.edgeMode==='source-reviewed-v1'){
  if(!policy.edgeLedgerSHA256||!Array.isArray(policy.terrainStatuses))return fail('invalid-source-reviewed-policy');
  return policy;
 }
 for(const field of ['terrainStatus','railStatus','riverStatus','edgeSource'])
  if(typeof policy[field]!=='string'||!policy[field])return fail('invalid-source-policy:'+field);
 return policy;
}
function build(map,{strict=true,experimentalScope=null}={}){
 if(!T||!map||!Array.isArray(map.cells)||!map.geometry)return fail('invalid-map');
 // These conditions are deliberate safety gates, not generic assumptions about any SVG.
 const policy=checkPolicy(map,{experimentalScope});
 if(policy.edgeMode==='source-vector-experimental-v1')return Experimental.build(map,policy);
 if(policy.edgeMode==='source-reviewed-v1')return Reviewed.build(map,policy,{strict});
 const byId=new Map();
 for(const c of map.cells){
  if(!c||typeof c.id!=='string'||byId.has(c.id))return fail('duplicate-or-invalid-hex');
  byId.set(c.id,c);
  if(c.terrainStatus!==policy.terrainStatus)return fail('unverified-terrain:'+c.id);
 }
 const rails=new Set();
 for(const l of map.hexCenterRailConnections||[]){
  if(!byId.has(l.from)||!byId.has(l.to)||l.status!==policy.railStatus)return fail('unverified-rail-link');
  rails.add([l.from,l.to].sort().join(':'));
 }
 const shore=new Set();
 for(const h of map.authoredShoreHexsides||[]){
  if(!byId.has(h.cellId)||!T.DIRS.includes(h.dir))return fail('unverified-shore-entry');
  shore.add(h.cellId+':'+h.dir);
 }
 const cells={};const edges=[];const seen=new Set();let land=0;
 for(const c of map.cells){
  const passable=['open','forest','swamp','city','major-city','fortification'].includes(c.terrain);
  cells[c.id]={terrain:c.terrain,verified:passable,rail:false,sourceTerrainStatus:c.terrainStatus};
  if(passable)land++;
 }
 for(const c of map.cells){for(const dir of T.DIRS){
  const otherId=T.neighbor(c,dir,map.geometry),other=byId.get(otherId);
  if(!other)continue;
  const key=[c.id,otherId].sort().join(':');if(seen.has(key))continue;seen.add(key);
  const opposite=T.OPP[dir],a=c.tileEdges?.[dir]||[],b=other.tileEdges?.[opposite]||[];
  const sideShore=shore.has(c.id+':'+dir)||shore.has(otherId+':'+opposite);
  const inaccessible=!cells[c.id].verified||!cells[otherId].verified||sideShore;
  const rail=rails.has(key);
  // A registered rail connection is authoritative ONLY when reciprocal at hexside level.
  const railA=a.some(f=>f.kind==='rail'&&f.status===policy.railStatus);
  const railB=b.some(f=>f.kind==='rail'&&f.status===policy.railStatus);
  if(rail!==(railA&&railB))return fail('rail-registration-disagrees:'+key);
  if(rail&&inaccessible)return fail('rail-crosses-impassable:'+key);
  const river=a.some(f=>f.kind==='river'&&f.status===policy.riverStatus)||b.some(f=>f.kind==='river'&&f.status===policy.riverStatus);
  edges.push({a:c.id,b:otherId,verified:true,rail,river,impassable:inaccessible,allSea:c.terrain==='sea'||other.terrain==='sea',lake:sideShore,source:policy.edgeSource});
  if(rail){cells[c.id].rail=true;cells[otherId].rail=true;}
 }}
 for(const key of rails)if(!seen.has(key))return fail('nonadjacent-rail:'+key);
 if(strict&&(!land||!edges.length))return fail('empty-board');
 return {cells,edges,metadata:{sourceGame:map.sourceGame,sourceMapId:map.id,landHexes:land,railEdges:rails.size,edgeCount:edges.length,coverage:policy.coverage}};
}
return {build,checkPolicy};
});

};
defs["core/mission_random.js"]=function(module,exports,require,Buffer){
/* Versioned, domain-separated mission randomness. Counters are derived from
 * committed history, not from speculative searches or UI rendering. */
'use strict';
const crypto=require('node:crypto');
const STREAMS=Object.freeze(['deployment','combat','naval','ai','test']);
function validate(seed){if(typeof seed!=='string'||!/^[0-9a-f]{32}$/.test(seed))throw Error('Invalid mission master seed');return seed;}
function generate(){const bytes=new Uint8Array(16);globalThis.crypto.getRandomValues(bytes);return Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');}
function integer(seed,stream,index,size){validate(seed);if(!STREAMS.includes(stream)||!Number.isSafeInteger(index)||index<0||!Number.isSafeInteger(size)||size<1||size>4294967296)throw Error('Invalid mission random request');const limit=4294967296-(4294967296%size);for(let retry=0;;retry++){const n=crypto.createHash('sha256').update(JSON.stringify(['mission-rng-v1',seed,stream,index,retry])).digest().readUInt32BE(0);if(n<limit)return n%size;}}
function actionStream(input){const a=input?.type==='combat'?input.action:input;if(!Number.isInteger(a?.die))return null;if(['resolve-battle','commit-fleet-displacement'].includes(a.type))return 'combat';if(['roll-fleet-attack','roll-fleet-displacement','roll-fleet-move','roll-naval-ground-transport','resolve-forced-ground-move'].includes(a.type))return 'naval';return null;}
function count(journal,stream){return journal.reduce((n,r)=>n+(actionStream(r.action)===stream?1:0),0);}
function die(seed,journal,stream){return 1+integer(seed,stream,count(journal,stream),6);}
module.exports=Object.freeze({validate,generate,integer,actionStream,count,die,STREAMS});

};
})(globalThis);
