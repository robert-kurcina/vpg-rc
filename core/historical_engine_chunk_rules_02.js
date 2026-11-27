/* GENERATED. Do not edit. */
(function(root){"use strict";const r=root.__historicalBundle;if(!r||r.revision!=="e0ca1ff64b70e10215a98ab99974041ad6f7b1e63484032c38704d0272616c48")throw Error("Historical bundle version mismatch");const defs=r.definitions,parts=r.parts;
defs["core/movement_binding.js"]=function(module,exports,require,Buffer){
/* Verified source map -> single movement adjudication board.
 * Never infer movement permission from visible SVG vectors, adjacent geometry,
 * or a caller-supplied ledger. River != major river without explicit provenance.
 */
(function(root,factory){
 const H=typeof module==='object'&&module.exports?require('./hexside_features'):root.WargameHexsideFeatures;
 const M=typeof module==='object'&&module.exports?require('./movement_rules'):root.WargameMovementRules;
 const P=typeof module==='object'&&module.exports?require('./pathfinding'):root.WargamePathfinding;
 const LP=typeof module==='object'&&module.exports?require('./legal_pathfinding'):root.WargameLegalPathfinding;
 const api=factory(H,M,P,LP);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameMovementBinding=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(H,M,P,LP){'use strict';
 const fail=message=>{throw Error('movement-binding: '+message);};
 const pair=(a,b)=>[a,b].sort().join(':');
 // Only private, deeply frozen copies can be cached. Object.freeze on a
 // caller's root is not evidence that its nested cells or policy are immutable.
 const owned=new WeakSet(),cache=new WeakMap();
 function freezeTree(value,visiting=new WeakSet(),done=new WeakSet()){
  if(value&&typeof value==='object'){
   if(done.has(value))return value;
   if(visiting.has(value)||(!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null))
    throw Error('Movement source must be an acyclic plain data tree');
   visiting.add(value);
   for(const child of Object.values(value))freezeTree(child,visiting,done);
   visiting.delete(value);Object.freeze(value);done.add(value);
  }
  return value;
 }
 function ownSource(value){
  if(owned.has(value))return value;
  const copy=freezeTree(structuredClone(value));owned.add(copy);return copy;
 }
 function prepareContext(context){
  return {...context,map:ownSource(context.map),profile:ownSource(context.profile)};
 }
 // Combat sessions already make a canonical detached copy. Reuse the
 // parent's private source only when both copies have the same serialized
 // values and order; otherwise preserve the canonical copy's semantics.
 function reusePreparedSource(detached,original){
  const same=(a,b)=>owned.has(b)&&JSON.stringify(a)===JSON.stringify(b);
  return {...detached,map:same(detached.map,original.map)?original.map:ownSource(detached.map),
   profile:same(detached.profile,original.profile)?original.profile:ownSource(detached.profile)};
 }
 function build(map,profile){
  if(!owned.has(map)||!owned.has(profile))return buildUncached(map,profile);
  let byProfile=cache.get(map);
  if(!byProfile){byProfile=new WeakMap();cache.set(map,byProfile);}
  if(!byProfile.has(profile))byProfile.set(profile,freezeTree(buildUncached(map,profile)));
  return byProfile.get(profile);
 }
 function buildUncached(map,profile){
  const p=M.validatedProfile(profile);
  // The ledger builds its own source-authorized graph once; do not construct
  // a second graph just to compare it with the independent hexside checks.
  const experimentalScope=p.experimentalGraphScope||null;
  const {board,ledger}=H.inspectWithGraph(map,{experimentalScope});
  if(!ledger.metadata.certified||ledger.metadata.mapId!==map.id||ledger.edges.length!==board.edges.length)
   fail('uncertified-or-incomplete-ledger');
  const index=new Map(ledger.edges.map(e=>[pair(e.a,e.b),e]));
  if(index.size!==board.edges.length)fail('duplicate-ledger-edge');
  for(const e of board.edges){
   const h=index.get(pair(e.a,e.b));
   if(!h||h.evidence!==(board.metadata.scope==='experimental'?'source-pinned-experimental-movement':'certified-movement')||
      h.rail!==e.rail||h.river!==e.river||
      h.impassable!==e.impassable||h.movementAuthorized===e.impassable)
     fail('ledger-board-disagreement:'+pair(e.a,e.b));
  }
  return Object.freeze({profile:p,board,metadata:Object.freeze({sourceMapId:map.id,
   sourceGame:map.sourceGame,scope:board.metadata.scope||'historical-source-binding',
   hexCount:ledger.metadata.hexCount,edgeCount:ledger.metadata.edgeCount,
   railEdges:ledger.metadata.certifiedRailEdges,riverEdges:ledger.metadata.certifiedRiverEdges})});
 }
 function context(binding,phase,units,turn,territory=undefined){
  if(!binding||!binding.board||!binding.profile||!phase||!units||!Number.isSafeInteger(turn))fail('invalid-context');
  return {profile:binding.profile,board:binding.board,phase,units,turn,territory};
 }
 function move(binding,phase,units,turn,request,territory=undefined){return M.move(context(binding,phase,units,turn,territory),request);}
 // Advisory path planning, not movement legality. The caller MUST submit each
 // candidate path to move(), which applies ZOC, occupancy, class and phase rules.
 function routes(binding,origin,{target=null,maxCost=Infinity,blocked=null}={}){
  if(!binding||!binding.board||!binding.profile)fail('invalid-binding');
  return P.search(P.compile(binding.board),{origin,target,maxCost,blocked,
   edgeCost:step=>P.terrainCost(binding.profile,step)});
 }
 // Rule-aware planning: every reported route is checked through the existing movement adjudicator.
 function legalRoutes(binding,phase,units,turn,unitId,options={}){
  // Territory belongs to the committed historical state, not a path-search
  // heuristic. Supply it to the same shared rules for all explored prefixes.
  const {territory,...query}=options;
  return LP.search(context(binding,phase,units,turn,territory),{unitId,...query});
 }
 function legalRoutesBatch(binding,phase,units,turn,queries,territory){
  return LP.searchBatch(context(binding,phase,units,turn,territory),queries);
 }
 return Object.freeze({build,prepareContext,reusePreparedSource,context,move,routes,legalRoutes,legalRoutesBatch});
});

};
defs["core/movement_rules.js"]=function(module,exports,require,Buffer){
/* Configuration-driven path adjudication. Source-backed initial profile: The Arduous Beginning
 * §7.1, §8.1, §§9.1-9.5 and Terrain Effects Chart. No provisional map edges accepted.
 * This module does not grant executable scenario status without verified board bindings.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameMovementRules=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const fail=reason=>({ok:false,reason});
// A synchronous read-only search owns its indexes. Never attach them to a
// mutable board or a saved position; discard even when the search throws.
const searchIndexes=new WeakMap();
// Only a deeply immutable edge list is eligible for topology indexing.
// No dynamic roster or ZOC result is retained in this cache.
const staticEdges=new WeakMap();
function indexedEdges(board){
 const list=board?.edges;
 if(!Array.isArray(list)||!Object.isFrozen(list))return null;
 if(staticEdges.has(list))return staticEdges.get(list);
 if(!list.every(e=>e&&Object.isFrozen(e)))return null;
 const index=new Map();
 for(const e of list)for(const h of [e.a,e.b]){
  if(!index.has(h))index.set(h,[]);
  index.get(h).push(e);
 }
 staticEdges.set(list,index);return index;
}
function withSearchIndexes(ctx,fn){
 if(searchIndexes.has(ctx))return fn();
 const byHex=new Map(),edges=new Map(),adj=new Map();
 for(const u of Object.values(ctx.units||{})){
  if(!byHex.has(u.hex))byHex.set(u.hex,[]);byHex.get(u.hex).push(u);
 }
 for(const e of ctx.board.edges||[]){
  if(e.verified===true){
   for(const [a,b] of [[e.a,e.b],[e.b,e.a]]){
    if(!edges.has(a))edges.set(a,new Map());
    if(!edges.get(a).has(b))edges.get(a).set(b,e);
   }
  }
  if(e.verified&&!e.allSea&&(ctx.profile?.zocAcrossImpassableHexsides===true||(!e.lake&&!e.impassable))){
   for(const [a,b] of [[e.a,e.b],[e.b,e.a]]){
    if(!adj.has(a))adj.set(a,[]);adj.get(a).push(b);
   }
  }
 }
 searchIndexes.set(ctx,{byHex,edges,adj,zoc:new Map(),valid:validProfile(ctx.profile),territorialValid:validTerritorialPolicy(ctx.profile?.territorialPolicy),footprintValid:undefined});
 try{return fn();}finally{searchIndexes.delete(ctx);}
}
function unitsAt(ctx,hex){const idx=searchIndexes.get(ctx);return idx?(idx.byHex.get(hex)||[]):Object.values(ctx.units).filter(u=>u.hex===hex);}
function edgeAt(ctx,from,to){const idx=searchIndexes.get(ctx);return idx?idx.edges.get(from)?.get(to):ctx.board.edges?.find(e=>e.verified===true&&((e.a===from&&e.b===to)||(e.b===from&&e.a===to)));}

// One nationality-stacking predicate for movement, reinforcement placement and
// every combat-retreat branch. Allied Axis counters share a player but not
// necessarily a legal stack (§8.1 Objective: Kiev). No nationality pair is
// prohibited unless the historical scenario profile explicitly lists it.
function nationalStackLegal(profile,units){
 const excluded=profile?.nationalStackExclusions??[];
 if(!profile||!Array.isArray(excluded)||!Array.isArray(units)||
    units.some(u=>!u||typeof (u.nationality||u.owner)!=='string'))
  throw Error('Invalid source-configured national stacking');
 for(const pair of excluded){
  if(!Array.isArray(pair)||pair.length!==2||pair.some(x=>typeof x!=='string'||!x)||pair[0]===pair[1])
   throw Error('Malformed nationality stacking exclusion');
  if(pair.every(n=>units.some(u=>(u.nationality||u.owner)===n)))return false;
 }
 return true;
}
// Source-qualified territorial entry. Regions are attached only by a separately
// approved country/annexation mask. Unknown geography is NOT an implicit "outside".
// Candidate §9.4.4/§9.4.5 policies do not turn on for other games.
function validAnnexationFootprint(annexation){
 const f=annexation?.approvedFootprint;
 return f===undefined||(f&&typeof f==='object'&&!Array.isArray(f)&&
   typeof f.boardId==='string'&&f.boardId.length>0&&
   Number.isSafeInteger(f.mapHexCount)&&f.mapHexCount>0&&
   f.region==='bessarabia'&&f.evidence==='user-adjudicated'&&
   typeof f.source==='string'&&f.source.length>0&&
   Array.isArray(f.hostCells)&&f.hostCells.length>0&&
   f.hostCells.every(id=>typeof id==='string'&&/^\d{4}$/.test(id))&&
   new Set(f.hostCells).size===f.hostCells.length&&
   f.hostCells.length<=f.mapHexCount);
}
function validTerritorialPolicy(t){
 if(t===undefined)return true;
 if(!t||typeof t!=='object'||Array.isArray(t)||t.schemaVersion!==1||
    t.regionField!=='sourceTerritory'||!Array.isArray(t.regions)||
    t.regions.length<3||new Set(t.regions).size!==t.regions.length||
    t.regions.some(x=>typeof x!=='string'||!x)||
    !t.regions.includes('romania')||!t.regions.includes('bessarabia')||
    !t.regions.includes('outside')||
    !Array.isArray(t.nationalEntryExclusions)||
    !Array.isArray(t.restrictedSourceUnits)||
    !t.annexation||typeof t.annexation!=='object'||
    t.annexation.region!=='bessarabia'||t.annexation.flag!=='bessarabiaAnnexed'||
    t.annexation.clearOfOwner!=='soviet'||
    !validAnnexationFootprint(t.annexation))return false;
 const mask=t.approvedLandMask;
 if(mask!==undefined&&(!mask||typeof mask.boardId!=='string'||typeof mask.source!=='string'||!Array.isArray(mask.romania)||!mask.romania.length||new Set(mask.romania).size!==mask.romania.length||mask.romania.some(id=>typeof id!=='string'||!/^\d{4}$/.test(id))))return false;
 const nat=new Set(),id=new Set();
 for(const x of t.nationalEntryExclusions){
  if(!x||typeof x.nationality!=='string'||!x.nationality||nat.has(x.nationality)||
     !Array.isArray(x.regions)||!x.regions.length||new Set(x.regions).size!==x.regions.length||
     x.regions.some(r=>!t.regions.includes(r)))return false;
  nat.add(x.nationality);
 }
 for(const x of t.restrictedSourceUnits){
  if(!x||typeof x.sourceIdentityKey!=='string'||!x.sourceIdentityKey||id.has(x.sourceIdentityKey)||
     typeof x.nationality!=='string'||!x.nationality||
     !Array.isArray(x.sourceFaceIds)||!x.sourceFaceIds.length||
     new Set(x.sourceFaceIds).size!==x.sourceFaceIds.length||
     x.sourceFaceIds.some(f=>typeof f!=='string'||!f)||
     !Array.isArray(x.beforeAnnexation)||!x.beforeAnnexation.length||
     !Array.isArray(x.afterAnnexation)||!x.afterAnnexation.length||
     [...x.beforeAnnexation,...x.afterAnnexation].some(r=>!t.regions.includes(r))||
     new Set(x.beforeAnnexation).size!==x.beforeAnnexation.length||
     new Set(x.afterAnnexation).size!==x.afterAnnexation.length||
     x.forbidAdvanceAcrossRomanianBorder!==true)return false;
  id.add(x.sourceIdentityKey);
 }
 return nat.has('hungarian')&&id.has('romanian-home-army');
}
function footprintMatches(board,policy){
 const f=policy?.annexation?.approvedFootprint;
 if(!f||board?.metadata?.mapId!==f.boardId||!board.cells)return false;
 const cells=Object.entries(board.cells),members=new Set(f.hostCells);
 return cells.length===f.mapHexCount&&
  cells.filter(([,c])=>c[policy.regionField]===f.region).length===members.size&&
  cells.every(([id,c])=>members.has(id)?c.verified===true&&
   c[policy.regionField]===f.region&&c.territoryEvidence===f.evidence&&
   c.territorySource===f.source:c[policy.regionField]!==f.region);
}
function territorialAccess(ctx,unit,to,action='movement',from=unit?.hex){
 const policy=ctx?.profile?.territorialPolicy;
 if(!policy)return {ok:true};
 const idx=searchIndexes.get(ctx);
 if(!(idx?.territorialValid??validTerritorialPolicy(policy)))return fail('invalid-territorial-policy');
 if(!unit||!ctx.board?.cells||!['movement','advance','retreat'].includes(action))return fail('invalid-territorial-context');
 const nationality=unit.nationality||unit.owner;
 const national=policy.nationalEntryExclusions.find(x=>x.nationality===nationality);
 const specific=policy.restrictedSourceUnits.find(x=>x.sourceIdentityKey===unit.sourceIdentityKey||
   (unit.sourceFaceId&&x.sourceFaceIds.includes(unit.sourceFaceId)));
 if(nationality==='romanian'&&!unit.sourceIdentityKey&&!unit.sourceFaceId)
  return fail('territorial-source-identity-unverified');
 if(!national&&!specific)return {ok:true};
 // A face/name mismatch can never silently bypass the photographed Home Army.
 if(specific&&(nationality!==specific.nationality||
    (unit.sourceIdentityKey&&unit.sourceIdentityKey!==specific.sourceIdentityKey)||
    (unit.sourceFaceId&&!specific.sourceFaceIds.includes(unit.sourceFaceId))))
  return fail('territorial-source-identity-mismatch');
 const origin=ctx.board.cells[from],target=ctx.board.cells[to];
 // A user-adjudicated region counts as evidence only if the policy pins the
 // complete footprint, source and exact composite board identity. Unknown
 // Romanian/outside country cells still fail closed for restricted units.
 const approved=(cell,id)=>{
  const f=policy.annexation.approvedFootprint;
  if(cell?.[policy.regionField]==='bessarabia'&&f)
   return f.hostCells.includes(id)&&(idx?(idx.footprintValid??=footprintMatches(ctx.board,policy)):footprintMatches(ctx.board,policy));
  const mask=policy.approvedLandMask;
  if(mask&&ctx.board.metadata?.mapId===mask.boardId&&cell?.territoryEvidence==='user-adjudicated'&&cell.territorySource===mask.source)
   return cell[policy.regionField]===(mask.romania.includes(id)?'romania':'outside');
  return cell?.territoryEvidence==='source-certified';
 };
 if(!origin||!target||origin.verified!==true||target.verified!==true||
    !policy.regions.includes(origin[policy.regionField])||
    !policy.regions.includes(target[policy.regionField])||
    !approved(origin,from)||!approved(target,to))
  return fail('territory-unverified');
 if(national?.regions.includes(target[policy.regionField]))return fail('national-territory-exclusion');
 if(specific){
  const annexed=ctx.territory?.[policy.annexation.flag]===true;
  const permitted=annexed?specific.afterAnnexation:specific.beforeAnnexation;
  if(!permitted.includes(origin[policy.regionField])||!permitted.includes(target[policy.regionField]))
   return fail('home-army-territory-restricted');
  // §9.4.4: combat attacks across the border are permitted, but Advance
  // After Combat across the Russo-Romanian border is explicitly prohibited.
  if(action==='advance'&&specific.forbidAdvanceAcrossRomanianBorder&&
     (origin[policy.regionField]==='romania')!==(target[policy.regionField]==='romania'))
   return fail('home-army-border-advance-forbidden');
 }
 return {ok:true};
}
// Return a proposed (immutable) status update, not a movement-side effect.
// Annexation is a permanent latch after every Bessarabia cell is certified
// and the last Soviet unit leaves. §9.4.4: later re-entry does not undo it.
function bessarabiaAnnexation(ctx){
 const p=ctx?.profile?.territorialPolicy;
 if(!p||!validTerritorialPolicy(p)||!ctx.board?.cells||!ctx.units)return fail('invalid-territorial-context');
 const all=Object.entries(ctx.board.cells),footprint=p.annexation.approvedFootprint;
 if(footprint){
  // §9.4.4 needs a complete Bessarabia footprint, NOT country labels for
  // every unrelated Kiev/Odessa hex. Exact map identity, count, membership
  // and source provenance must all match the user's adjudicated 19 cells.
  if(!footprintMatches(ctx.board,p))return fail('territory-unverified');
 }else{
  // Legacy synthetic tests and future fully certified boards still demand
  // country evidence for every verified cell.
  const cells=all.filter(([,c])=>c.verified===true);
  if(!cells.length||cells.some(([,c])=>!p.regions.includes(c[p.regionField])||
      c.territoryEvidence!=='source-certified')||
     !cells.some(([,c])=>c[p.regionField]===p.annexation.region))
   return fail('territory-unverified');
 }
 if(Object.values(ctx.units).some(u=>u.hex&&!ctx.board.cells[u.hex]))return fail('territory-unverified');
 const original=ctx.territory||{};
 if(original[p.annexation.flag]!==undefined&&typeof original[p.annexation.flag]!=='boolean')
  return fail('invalid-annexation-status');
 const remaining=Object.values(ctx.units).some(u=>u.owner===p.annexation.clearOfOwner&&
   u.hex&&ctx.board.cells[u.hex]?.[p.regionField]===p.annexation.region);
 const annexed=original[p.annexation.flag]===true||!remaining;
 return {ok:true,annexed,changed:annexed&&original[p.annexation.flag]!==true,
  territory:{...original,[p.annexation.flag]:annexed}};
}
function adjudicate(ctx,request,transitOnly=false){
 if(!ctx||!request||!ctx.profile||!ctx.board||!ctx.phase||!ctx.units)return fail('invalid-context');
 const p=ctx.profile, b=ctx.board, u=ctx.units[request.unitId];
 if(!(searchIndexes.get(ctx)?.valid??validProfile(p)))return fail('invalid-movement-profile');
 if(!u||u.owner!==ctx.phase.owner||!['german','soviet'].includes(u.owner))return fail('wrong-actor');
 const special=ctx.phase.kind==='special-movement';
 if(!special&&ctx.phase.kind!=='movement')return fail('wrong-phase');
 const path=request.path;
 if(!Array.isArray(path)||path.length<2||path[0]!==u.hex||new Set(path).size!==path.length)return fail('invalid-path');
 if(!Number.isSafeInteger(u.mp)||u.mp<1)return fail('invalid-allowance');
 const turn=ctx.turn;
 const surprise=!!(p.firstTurnSurpriseMovement&&special&&turn===1&&u.owner==='german');
 const startEZOC=enemyZOC(ctx,path[0],u.owner);
 const mechanized=(p.fullSpecialMovementClasses?.[u.owner]||[]).includes(u.class);
 // Odessa §9.4.3: cavalry has a HALF allowance in Special Movement, like
 // infantry, but unlike infantry can begin that phase in an enemy ZOC.
 // Both exceptions require explicit scenario configuration; no class-name
 // inference is permitted in the shared engine.
 const halfSpecial=(p.halfSpecialMovementClasses?.[u.owner]||[]).includes(u.class);
 const exemptFromStartEZOC=(p.specialMoveFromEZOCClasses?.[u.owner]||[]).includes(u.class);
 const halfSpecialEligible=(u.class==='infantry'&&!startEZOC)||
   (halfSpecial&&(!startEZOC||exemptFromStartEZOC));
 const railMode=request.mode==='rail';
 if(railMode&&(!special||u.owner!=='soviet'||u.class!=='infantry'||startEZOC))return fail('rail-ineligible');
 if(special&&!surprise&&!mechanized&&!halfSpecialEligible)return fail('special-ineligible');
 if(special&&surprise&&u.class!=='infantry'&&!mechanized&&!halfSpecial)return fail('surprise-ineligible');
 const allowance= special&&!mechanized&&!railMode?Math.floor(u.mp/2):u.mp;
 if(allowance<1)return fail('no-movement-points');
 let points=0;
 for(let i=1;i<path.length;i++){
  const from=path[i-1],to=path[i],edge=edgeAt(ctx,from,to);
  if(!edge)return fail('unverified-connection');
  if(edge.impassable===true||edge.allSea===true||edge.lake===true)return fail('impassable-hexside');
  const cell=b.cells?.[to];
  if(!cell||cell.verified!==true||!Object.hasOwn(p.terrainCosts,cell.terrain))return fail('unverified-terrain');
  if(unitsAt(ctx,to).some(x=>x.id!==u.id&&x.owner!==u.owner))return fail('enemy-occupied');
  // The configured 'may never stack together' exception applies even
  // to intermediate hexes; ordinary temporary overstacking is separate.
  const occupants=unitsAt(ctx,to).filter(x=>x.id!==u.id&&x.owner===u.owner&&!x.marker);
  if(!nationalStackLegal(p,[u,...occupants]))return fail('national-stack-exclusion');
  if(railMode&&!edge.rail)return fail('rail-route-required');
  if(railMode&&!b.cells?.[from]?.rail)return fail('rail-route-required');
  const country=territorialAccess(ctx,u,to,'movement',from);
  if(!country.ok)return country;
  points+=surprise?1:(railMode||edge.rail)? p.railCost:p.terrainCosts[cell.terrain];
  if(edge.majorRiver===true&&!edge.rail)points+=(p.majorRiverExtraCost||0);
  if(points>allowance)return fail('insufficient-movement-points');
  if(!surprise&&enemyZOC(ctx,to,u.owner)&&i!==path.length-1)return fail('ezoc-stops-movement');
 }
 // Transit-only inspection cannot authorize a stop or a completed move.
 // It is opt-in per profile: historical game semantics must explicitly permit it.
 if(transitOnly){
  if(p.allowFriendlyOverstackTransit!==true)return fail('transit-not-authorized');
  if(!surprise&&enemyZOC(ctx,path.at(-1),u.owner))return fail('ezoc-stops-movement');
  return {ok:true,transitOnly:true,cost:points,remaining:allowance-points,to:path.at(-1),unitId:u.id};
 }
 const destination=path.at(-1);
 const friends=unitsAt(ctx,destination).filter(x=>x.id!==u.id&&x.owner===u.owner&&!x.marker);
 if(p.allowTemporaryMovementOverstack===true)return {ok:true,cost:points,remaining:allowance-points,to:destination,unitId:u.id};
 if(friends.length+1>p.maxStack)return fail('stack-limit');
 if(u.owner==='soviet'&&u.size==='army'&&friends.some(x=>x.size==='army'))return fail('army-stack-limit');
 if(u.owner==='soviet'&&friends.some(x=>x.size==='army')&&u.size==='army')return fail('army-stack-limit');
 if(p.axisArmyMax===1&&u.owner==='german'&&u.size==='army'&&friends.some(x=>x.size==='army'))return fail('axis-army-stack-limit');
 return {ok:true,cost:points,remaining:allowance-points,to:destination,unitId:u.id};
}
function move(ctx,request){return adjudicate(ctx,request,false);}
function transit(ctx,request){return adjudicate(ctx,request,true);}
function enemyZOC(ctx,hex,owner){
 // A land/land Coast barrier blocks travel, not the six-hex ZOC prescribed
 // by Kiev §7.0. The source profile opts in; other historical games retain
 // their previously tested movement-based ZOC adjacency until qualified.
 const throughBarrier=ctx.profile?.zocAcrossImpassableHexsides===true;
 if(!ctx.board?.cells?.[hex]?.verified)return false;
 const idx=searchIndexes.get(ctx);
 if(idx){
  if(!idx.zoc.has(owner))idx.zoc.set(owner,new Map());
  const z=idx.zoc.get(owner);
  if(!z.has(hex))z.set(hex,(idx.adj.get(hex)||[]).some(h=>ctx.board.cells[h]?.verified&&
   (idx.byHex.get(h)||[]).some(x=>x.owner!==owner&&x.marker!==true&&x.strengthStatus!=='eliminated')));
  return z.get(hex);
 }
 const enemies=new Set();
 for(const x of Object.values(ctx.units||{})){
  if(x.owner!==owner&&x.marker!==true&&x.strengthStatus!=='eliminated'&&
     x.hex&&ctx.board.cells[x.hex]?.verified)enemies.add(x.hex);
 }
 if(!enemies.size)return false;
 const topology=indexedEdges(ctx.board);
 for(const e of (topology?(topology.get(hex)||[]):ctx.board.edges||[])){
  if(e.a!==hex&&e.b!==hex)continue;
  if(e.verified&&!e.allSea&&(throughBarrier||(!e.lake&&!e.impassable))&&
     enemies.has(e.a===hex?e.b:e.a))return true;
 }
 return false;
}
function validClassPairs(spec){
 return spec===undefined||(spec&&typeof spec==='object'&&!Array.isArray(spec)&&
  ['german','soviet'].every(owner=>Array.isArray(spec[owner])&&
   spec[owner].every(x=>typeof x==='string'&&x.length>0)&&
   new Set(spec[owner]).size===spec[owner].length));
}
function validProfile(p){
 if(!validTerritorialPolicy(p?.territorialPolicy))return false;
 if(p?.allowTemporaryMovementOverstack!==undefined&&(typeof p.allowTemporaryMovementOverstack!=='boolean'||(p.allowTemporaryMovementOverstack&&(p.allowFriendlyOverstackTransit!==true||p.nationalStackExclusions?.length))))return false;
 if(!(p&&typeof p==='object'&&(p.zocAcrossImpassableHexsides===undefined||typeof p.zocAcrossImpassableHexsides==='boolean')&&(p.allowFriendlyOverstackTransit===undefined||typeof p.allowFriendlyOverstackTransit==='boolean')&&typeof p.firstTurnSurpriseMovement==='boolean'&&validClassPairs(p.fullSpecialMovementClasses)&&p.fullSpecialMovementClasses&&validClassPairs(p.halfSpecialMovementClasses)&&validClassPairs(p.specialMoveFromEZOCClasses)&&Array.isArray(p.nationalStackExclusions)&&p.nationalStackExclusions.every(a=>Array.isArray(a)&&a.length===2&&a.every(x=>typeof x==='string'))&&Number.isSafeInteger(p.majorRiverExtraCost)&&p.majorRiverExtraCost>=0&&p.terrainCosts&&Object.values(p.terrainCosts).every(n=>Number.isSafeInteger(n)&&n>=1)&&Object.keys(p.terrainCosts).length&&Number.isSafeInteger(p.railCost)&&p.railCost>=1&&Number.isSafeInteger(p.maxStack)&&p.maxStack>=1))return false;
 for(const owner of ['german','soviet']){
  const full=p.fullSpecialMovementClasses[owner];
  const half=p.halfSpecialMovementClasses?.[owner]||[];
  const exempt=p.specialMoveFromEZOCClasses?.[owner]||[];
  if(half.some(x=>full.includes(x))||exempt.some(x=>!half.includes(x)))return false;
 }
 return true;
}
function validatedProfile(config){if(!validProfile(config)||config.schemaVersion!==1||typeof config.id!=='string')throw Error('Invalid movement profile');return structuredClone(config);}
// End-phase stack penalty. Ignore support markers and eliminated/off-map units.
function stackPenalty(profile,units,owner){
 if(profile.allowTemporaryMovementOverstack!==true)return {excess:0,choices:[],hexes:[]};
 const groups=new Map();
 for(const u of Object.values(units))if(u.owner===owner&&u.hex&&!u.marker&&u.strengthStatus!=='eliminated'){
  if(!groups.has(u.hex))groups.set(u.hex,[]);groups.get(u.hex).push(u);
 }
 const choices=[],hexes=[];let excess=0;
 for(const [hex,group] of [...groups].sort(([a],[b])=>a.localeCompare(b))){
  const cap=owner==='soviet'?profile.sovietArmyMax??1:profile.axisArmyMax??Infinity;
  const countExcess=Math.max(0,group.length-profile.maxStack);
  const armyExcess=Math.max(0,group.filter(u=>u.size==='army').length-cap);
  const need=Math.max(countExcess,armyExcess);
  if(!need)continue;
  excess+=need;hexes.push(hex);
  for(const u of group)if(u.size==='army'||countExcess>armyExcess)choices.push(u.id);
 }
 return {excess,choices:choices.sort(),hexes};
}
return {move,transit,enemyZOC,withSearchIndexes,nationalStackLegal,territorialAccess,bessarabiaAnnexation,validatedProfile,validProfile,stackPenalty};
});

};
defs["core/pathfinding.js"]=function(module,exports,require,Buffer){
/* Shared, advisory weighted routing on a source-certified movement graph.
 * This service never authorizes a move: movement_rules.move is authoritative.
 * No geometric-distance shortcuts, SVG-derived implied connections, or AI policy.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargamePathfinding=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const fail=m=>{throw Error('pathfinding: '+m);};
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function compile(board){
 if(!board||!board.cells||typeof board.cells!=='object'||!Array.isArray(board.edges))fail('invalid-board');
 const ids=Object.keys(board.cells).sort();if(!ids.length)fail('empty-board');
 const adj=Object.fromEntries(ids.map(id=>[id,[]]));const seen=new Set();
 for(const edge of board.edges){
  if(!edge||typeof edge.a!=='string'||typeof edge.b!=='string'||edge.a===edge.b||!own(adj,edge.a)||!own(adj,edge.b))fail('invalid-edge');
  const key=[edge.a,edge.b].sort().join('|');if(seen.has(key))fail('duplicate-edge:'+key);seen.add(key);
  // A graph's geometric adjacency is not permission for routing. Require verified evidence.
  if(edge.verified!==true)continue;
  adj[edge.a].push({to:edge.b,edge});adj[edge.b].push({to:edge.a,edge});
 }
 for(const id of ids)adj[id].sort((a,b)=>a.to.localeCompare(b.to));
 return {board,adj,ids};
}
// Positive edge costs are required for deterministic, non-cyclic predecessor paths.
function search(graph,{origin,target=null,edgeCost=null,blocked=null,maxCost=Infinity}={}){
 if(!graph||!graph.adj||!graph.board||typeof origin!=='string'||!own(graph.adj,origin))fail('invalid-origin');
 if(target!==null&&(!own(graph.adj,target)||typeof target!=='string'))fail('invalid-target');
 if(!(maxCost===Infinity||(typeof maxCost==='number'&&Number.isFinite(maxCost)&&maxCost>=0)))fail('invalid-max-cost');
 if(edgeCost!==null&&typeof edgeCost!=='function')fail('invalid-edge-cost');
 if(blocked!==null&&typeof blocked!=='function')fail('invalid-blocked-filter');
 const dist=new Map([[origin,0]]),prev=new Map(),settled=new Set();
 const heap=[];
 const less=(a,b)=>a.cost!==b.cost?a.cost<b.cost:a.id<b.id;
 function push(v){heap.push(v);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(!less(heap[i],heap[p]))break;[heap[p],heap[i]]=[heap[i],heap[p]];i=p;}}
 function pop(){const out=heap[0],tail=heap.pop();if(heap.length){heap[0]=tail;let i=0;while(true){let n=i,l=2*i+1,r=l+1;if(l<heap.length&&less(heap[l],heap[n]))n=l;if(r<heap.length&&less(heap[r],heap[n]))n=r;if(n===i)break;[heap[n],heap[i]]=[heap[i],heap[n]];i=n;}}return out;}
 push({id:origin,cost:0});
 while(heap.length){
  const {id,cost}=pop();if(settled.has(id)||cost!==dist.get(id))continue;
  settled.add(id);if(id===target)break;
  for(const {to,edge} of graph.adj[id]){
   if(settled.has(to)||edge.impassable===true||edge.allSea===true||edge.lake===true)continue;
   if(graph.board.cells[to]?.verified!==true||graph.board.cells[id]?.verified!==true)continue;
   if(blocked?.({from:id,to,edge,board:graph.board})===true)continue;
   // Cost is directional: terrain is normally charged on destination entry.
   const step=edgeCost?edgeCost({from:id,to,edge,fromCell:graph.board.cells[id],toCell:graph.board.cells[to]}):1;
   if(step===null||step===Infinity)continue; // deliberately excluded edge
   if(typeof step!=='number'||!Number.isFinite(step)||step<=0)fail('invalid-step-cost:'+id+'->'+to);
   const next=cost+step;if(next>maxCost)continue;
   if(next<(dist.get(to)??Infinity)){
    dist.set(to,next);prev.set(to,id);push({id:to,cost:next});
   }
  }
 }
 const costTo=id=>dist.get(id)??Infinity;
 const pathTo=id=>{if(!dist.has(id))return null;const path=[id];let cursor=id;
  while(cursor!==origin){cursor=prev.get(cursor);if(cursor===undefined)fail('invalid-predecessors');path.push(cursor);}return path.reverse();};
 return {origin,costTo,pathTo,withinBudget:budget=>{
  if(typeof budget!=='number'||!Number.isFinite(budget)||budget<0)fail('invalid-budget');
  return [...dist].filter(([,d])=>d<=budget).sort((a,b)=>a[1]-b[1]||a[0].localeCompare(b[0])).map(([id,cost])=>({id,cost}));
 },distances:()=>Object.fromEntries([...dist].sort((a,b)=>a[0].localeCompare(b[0])))};
}
function terrainCost(profile,{edge,toCell}){
 if(!profile||!profile.terrainCosts||!toCell)return fail('missing-profile');
 const base=edge.rail?profile.railCost:profile.terrainCosts[toCell.terrain];
 if(!Number.isFinite(base)||base<=0)fail('unpriced-terrain');
 return base+(edge.majorRiver===true&&!edge.rail?(profile.majorRiverExtraCost||0):0);
}
return Object.freeze({compile,search,terrainCost});
});

};
defs["core/phase_actions.js"]=function(module,exports,require,Buffer){
/* Cross-game phase/action binding: intentionally requires scenario-specific
 * legality and completion handlers. A phase permission alone NEVER authorizes
 * an action, and no historical scenario is activated by this adapter.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargamePhaseActions=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const P=(typeof globalThis!=='undefined'&&globalThis.WargamePhaseRuntime)||
 (typeof require==='function'?require('./phase_runtime.js'):null);
const clone=x=>JSON.parse(JSON.stringify(x));
function validateBinding(b){
 if(!b||!b.config||!b.cursor||!b.actor||!b.state||!b.rules||typeof b.rules!=='object')throw Error('Missing phase action binding');
 P.current(b.config,b.cursor);
 return true;
}
function guard(b,op){
 validateBinding(b);
 const phase=P.current(b.config,b.cursor);
 if(!phase)throw Error('Scenario completed');
 if(phase.owner!==b.actor)throw Error('Wrong phase actor');
 if(!P.permitted(b.config,b.cursor,op))throw Error('Operation not permitted in phase');
 const rule=b.rules[op];
 if(!rule||typeof rule.legal!=='function'||typeof rule.apply!=='function')throw Error('No verified rules binding for operation: '+op);
 return {phase,rule};
}
function legal(b,op,action){
 const {rule,phase}=guard(b,op);
 // Readonly view for rule callbacks; their input is detached from source state.
 return rule.legal(clone(b.state),clone(action),clone(phase))===true;
}
function execute(b,op,action){
 const {rule,phase}=guard(b,op);
 const prior=clone(b.state), proposal=clone(b.state);
 if(rule.legal(clone(proposal),clone(action),clone(phase))!==true)return {ok:false,state:b.state,reason:'illegal-action'};
 const output=rule.apply(proposal,clone(action),clone(phase));
 if(!output||output.ok!==true||!output.state||typeof output.state!=='object'||Array.isArray(output.state))
  return {ok:false,state:b.state,reason:'action-rejected'};
 // fail closed on unintentional mutation of authoritative input by callbacks
 if(JSON.stringify(prior)!==JSON.stringify(b.state))throw Error('Rules handler mutated original state');
 return {ok:true,state:clone(output.state),result:clone(output.result??null)};
}
function finish(b){
 validateBinding(b);
 const phase=P.current(b.config,b.cursor);
 if(!phase)throw Error('Scenario completed');
 if(b.actor!==phase.owner)throw Error('Wrong phase actor');
 if(typeof b.complete!=='function')throw Error('No source-backed phase completion handler');
 const approved=b.complete(clone(b.state),clone(phase),clone(b.cursor));
 if(approved!==true)throw Error('Phase has unfinished obligations');
 return {cursor:P.advance(b.config,b.cursor,()=>true),state:b.state};
}
return {validateBinding,legal,execute,finish};
});

};
defs["core/phase_runtime.js"]=function(module,exports,require,Buffer){
/* Shared configuration-driven phase cursor. Does NOT adjudicate gameplay actions. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargamePhaseRuntime=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const ID=/^[a-z][a-z0-9-]*$/;
const KINDS=new Set(['buildup','movement','combat','special-movement','naval-operations','housekeeping','reinforcement','replacement','custom']);
function validate(config){
 if(!config||config.schemaVersion!==1||!ID.test(config.scenarioId||''))throw Error('Invalid phase configuration');
 if(!Number.isSafeInteger(config.turns)||config.turns<1||config.turns>1000)throw Error('Invalid turn limit');
 if(!Array.isArray(config.players)||config.players.length<2||new Set(config.players).size!==config.players.length||config.players.some(p=>!ID.test(p)))throw Error('Invalid player order');
 if(!Array.isArray(config.phases)||!config.phases.length)throw Error('Missing phases');
 const ids=new Set();
 for(const p of config.phases){
  if(!p||!ID.test(p.id||'')||ids.has(p.id)||!KINDS.has(p.kind)||!(p.owner==='system'||config.players.includes(p.owner)))throw Error('Invalid phase');
  ids.add(p.id);
  if(p.permissions!==undefined&&(!Array.isArray(p.permissions)||p.permissions.some(x=>!ID.test(x))))throw Error('Invalid permissions');
 }
 if(!ids.has(config.firstTurnStart))throw Error('Invalid first-turn start');
 if(config.phases[config.phases.length-1].owner!=='system'||config.phases[config.phases.length-1].kind!=='housekeeping')throw Error('Missing terminal housekeeping');
 if(config.phases.filter(p=>p.kind==='housekeeping').length!==1)throw Error('Duplicate housekeeping');
 if(config.phases.some((p,i)=>i>0&&p.owner!=='system'&&config.players.indexOf(p.owner)<config.players.indexOf(config.phases[i-1].owner)))throw Error('Player order violates phase order');
 return true;
}
function start(config){validate(config);return Object.freeze({scenarioId:config.scenarioId,turn:1,index:config.phases.findIndex(p=>p.id===config.firstTurnStart),complete:false});}
function current(config,cursor){validate(config);check(config,cursor);return cursor.complete?null:config.phases[cursor.index];}
function check(config,cursor){if(!cursor||cursor.scenarioId!==config.scenarioId||!Number.isSafeInteger(cursor.turn)||cursor.turn<1||cursor.turn>config.turns||!Number.isSafeInteger(cursor.index)||cursor.index<0||cursor.index>=config.phases.length||typeof cursor.complete!=='boolean')throw Error('Invalid phase cursor');if(cursor.complete&&(cursor.turn!==config.turns||cursor.index!==config.phases.length-1))throw Error('Invalid complete cursor');}
function advance(config,cursor,gate){const p=current(config,cursor);if(!p)throw Error('Scenario complete');if(typeof gate!=='function')throw Error('Phase completion gate required');if(gate(Object.freeze({...p}),cursor)!==true)throw Error('Phase has unfinished obligations');const last=cursor.index===config.phases.length-1;return Object.freeze(last?(cursor.turn===config.turns?{scenarioId:config.scenarioId,turn:cursor.turn,index:cursor.index,complete:true}:{scenarioId:config.scenarioId,turn:cursor.turn+1,index:0,complete:false}):{scenarioId:config.scenarioId,turn:cursor.turn,index:cursor.index+1,complete:false});}
function permitted(config,cursor,operation){const p=current(config,cursor);return Boolean(p&&p.permissions?.includes(operation));}
return {validate,start,current,advance,permitted};
});

};
defs["core/printed_coordinate_registry.js"]=function(module,exports,require,Buffer){
/* Generic coordinate registry: logical cell IDs and source-facing printed IDs.
 * Read-only. Never changes a board's physical centers or movement topology.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargamePrintedCoordinates=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function resolve(board,formatNumber){
  if(!board||!Array.isArray(board.cells)||typeof formatNumber!=='function')throw Error('Board and number formatter required');
  const byPrinted=new Map(),byInternal=new Map(),invalid=[],duplicates=[];
  for(const cell of board.cells){
   const printed=String(formatNumber(cell));
   if(!/^\d{4}$/.test(printed)){invalid.push({internal:cell.id,printed,reason:'not-four-digits'});continue;}
   const col=Number(printed.slice(0,2)),row=Number(printed.slice(2,4));
   if(col<1||row<1){invalid.push({internal:cell.id,printed,reason:'zero-or-negative-coordinate'});continue;}
   if(byPrinted.has(printed)){duplicates.push({printed,internal:[byPrinted.get(printed).id,cell.id]});continue;}
   byPrinted.set(printed,cell);byInternal.set(cell.id,printed);
  }
  return {byPrinted,byInternal,invalid,duplicates,complete:invalid.length===0&&duplicates.length===0&&byPrinted.size===board.cells.length,
   printedToInternal(printed){const cell=byPrinted.get(printed);return cell?.id||null;},
   internalToPrinted(internal){return byInternal.get(internal)||null;}};
 }
 return {resolve};
});

};
defs["core/scenario_starting_setup.js"]=function(module,exports,require,Buffer){
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

};
defs["core/source_experimental_movement_graph.js"]=function(module,exports,require,Buffer){
/* Source-pinned, explicitly opt-in experimental movement graph.
 * General adapter: no scenario ID branches. Candidate topology can be exercised
 * by the SAME movement/combat rules without asserting historical certification.
 * A loaded JSON configuration alone cannot grant approval: both the exact
 * map fingerprint and independently pinned ledger digest must agree.
 */
(function(root,factory){const api=factory(
 typeof module==='object'&&module.exports?require('./terrain_tiles'):root.HexTerrainTiles,
 typeof module==='object'&&module.exports?require('node:crypto'):null,
 typeof module==='object'&&module.exports?require('../maps/movement-configs/experimental-source-graph-ledgers.json'):null);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameSourceExperimentalMovementGraph=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(T,Crypto,registry){'use strict';
 const reject=m=>{throw Error('experimental-movement-graph: '+m)};
 const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?
  Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
 // Cache digests and a private serialized topology, never an authorization result.
 // Exact serialized content, not object identity, is the cache key: in-place
 // edits and different scenario data must still pass the original digest gate.
 // Two bounded slots avoid holding every map/ledger ever opened.
 function memoDigest(){
  let previous=null,result=null;
  return x=>{
   const serialized=JSON.stringify(x);
   if(serialized===previous)return result;
   const next=Crypto.createHash('sha256').update(canonical(x)).digest('hex');
   previous=serialized;result=next;return next;
  };
 }
 const mapDigest=memoDigest(),ledgerDigest=memoDigest();
 // One bounded verified topology. The complete map and ledger digest gate below
 // remains mandatory on every call; the cached JSON yields detached mutable graphs.
 let topology=null;
 const pair=(a,b)=>[a,b].sort().join(':');
 function build(map,policy){
  const record=registry?.maps?.[map?.id];
  if(!Crypto||!T||registry?.schemaVersion!==1||!record||record.schemaVersion!==1||
   record.mapId!==map.id||record.sourceGame!==map.sourceGame||
   record.status!=='explicit-experimental-source-vector-candidate'||
   policy.edgeMode!=='source-vector-experimental-v1'||
   record.scope!==policy.authorizationScope||
   record.sourceSvgSHA256!==map.authoritativeSourceGeometry?.sha256||
   record.mapDigest!==mapDigest(map)||record.mapDigest!==policy.mapDigest||
   policy.edgeLedgerSHA256!==ledgerDigest(record))reject('source-map-or-ledger-fingerprint-mismatch');
  const topologyKey=record.mapDigest+':'+policy.edgeLedgerSHA256;
  if(topology?.key===topologyKey){
   const graph=JSON.parse(topology.json);
   graph.metadata.coverage=policy.coverage;
   return graph;
  }
  if(!record.board||!record.board.cells||!Array.isArray(record.board.edges)||
   Object.keys(record.board.cells).length!==map.cells.length)reject('incomplete-candidate-board');
  const byId=new Map(map.cells.map(c=>[c.id,c]));
  if(byId.size!==map.cells.length)reject('duplicate-map-cells');
  const cells={};
  for(const [id,cell] of Object.entries(record.board.cells)){
   const source=byId.get(id),land=source?.terrain!=='sea';
   if(!source||cell.sourceTerrainStatus!==source.terrainStatus||
      cell.verified!==land||!['open','forest','swamp','city','major-city','sea'].includes(cell.terrain)||
      (source.terrain==='sea')!==(cell.terrain==='sea')||
      (cell.sourceTerritory||null)!==(source.sourceTerritory||null))reject('candidate-cell-evidence-mismatch:'+id);
   cells[id]={...cell};
  }
  const seen=new Set(),edges=[];
  for(const edge of record.board.edges){
   const a=byId.get(edge.a),b=byId.get(edge.b),key=pair(edge.a,edge.b);
   if(!a||!b||edge.a>=edge.b||seen.has(key)||
    !T.DIRS.some(d=>T.neighbor(a,d,map.geometry)===edge.b)||
    edge.verified!==true||typeof edge.rail!=='boolean'||typeof edge.river!=='boolean'||
    typeof edge.majorRiver!=='boolean'||typeof edge.impassable!=='boolean'||
    typeof edge.lake!=='boolean'||typeof edge.allSea!=='boolean'||
    (edge.allSea!==(a.terrain==='sea'||b.terrain==='sea'))||
    (edge.impassable!==(edge.allSea||edge.lake))||
    (edge.rail&&edge.impassable)||(edge.river&&edge.majorRiver))reject('invalid-candidate-edge:'+key);
   seen.add(key);
   edges.push({...edge,source:'source-vector-experimental-v1'});
  }
  let actualEdges=0;
  for(const c of map.cells)for(const d of T.DIRS){const n=T.neighbor(c,d,map.geometry);if(byId.has(n)&&c.id<n)actualEdges++;}
  if(actualEdges!==seen.size)reject('incomplete-source-topology');
  // This is a playable candidate, NOT source-certified historical movement.
  const graph={cells,edges,metadata:{sourceMapId:map.id,sourceGame:map.sourceGame,
   mapId:map.id,scope:'experimental',historicalCertified:false,
   sourceGraphDigest:policy.edgeLedgerSHA256,hexCount:map.cells.length,
   edgeCount:edges.length,railEdges:edges.filter(e=>e.rail).length,
   riverEdges:edges.filter(e=>e.river).length,
   majorRiverEdges:edges.filter(e=>e.majorRiver).length,
   coverage:policy.coverage}};
  topology={key:topologyKey,json:JSON.stringify({...graph,metadata:{...graph.metadata,coverage:null}})};
  return graph;
 }
 return Object.freeze({build});
});

};
defs["core/source_reviewed_movement_graph.js"]=function(module,exports,require,Buffer){
/* Configured, source-pinned movement edge adapter. Uses the SAME hex-grid
 * neighbor function as the renderer and the original certified graph.
 * No scenario-specific code and no caller-supplied certification flags.
 */
(function(root,factory){const api=factory(
 typeof module==='object'&&module.exports?require('./terrain_tiles'):root.HexTerrainTiles,
 typeof module==='object'&&module.exports?require('../maps/movement-configs/source-reviewed-edge-ledgers.json'):null,
 typeof module==='object'&&module.exports?require('node:crypto'):null);
 if(typeof module==='object'&&module.exports)module.exports=api;root.WargameSourceReviewedMovementGraph=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(T,registry,Crypto){'use strict';
 const fail=s=>{throw Error('movement-map-binding: '+s)};
 const pair=(a,b)=>[a,b].sort().join(':');
 // Campaign saves canonicalize object key order. Fingerprints must not depend on insertion order.
 const canonical=x=>JSON.stringify(x,(_,v)=>v&&!Array.isArray(v)&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
 const sha=x=>Crypto.createHash('sha256').update(canonical(x)).digest('hex');
 const fingerprint=map=>sha({id:map.id,sourceGame:map.sourceGame,sourceImageSHA256:map.sourceImageSHA256,geometry:map.geometry,
  cells:map.cells.map(c=>({id:c.id,column:c.column,row:c.row,pixelCenter:c.pixelCenter,terrain:c.terrain,terrainStatus:c.terrainStatus})),railLinks:map.hexCenterRailConnections});
 // Extra source pin for maps whose City artwork has no underlying base-terrain glyph.
 // This digest is additive: original Arduous ledger and fingerprint stay identical.
 const overlayFingerprint=map=>sha({definitiveTerrainAudit:map.definitiveTerrainAudit,
  cells:map.cells.map(c=>({id:c.id,sourceTerrainEvidence:c.sourceTerrainEvidence||null, userTerrainAdjudication:c.userTerrainAdjudication||null,
   cityMarkers:(c.tileMarkers||[]).filter(m=>m.kind==='city'||m.kind==='majorCity')}))});
 function build(map,policy,{strict=true}={}){
  if(!T||!registry||!Crypto||policy.edgeMode!=='source-reviewed-v1')fail('unsupported-source-reviewed-policy');
  const evidence=registry.maps?.[map.id];
  if(!evidence||evidence.schemaVersion!==1||registry.schemaVersion!==1||evidence.mapId!==map.id||
   evidence.sourceSvgSha256!==(policy.sourceEvidenceMode==='definitive-city-layer-v1'
    ?map.definitiveTerrainAudit?.sourceSvgSha256:map.authoredSourceVectors?.sourceSvgSha256)||
   evidence.sourceFingerprint!==fingerprint(map)||
   (policy.sourceEvidenceMode==='definitive-city-layer-v1'&&evidence.overlayFingerprint!==overlayFingerprint(map)))fail('source-reviewed-fingerprint-mismatch');
  const digest=Crypto.createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
  if(digest!==policy.edgeLedgerSHA256)fail('source-reviewed-ledger-hash-mismatch');
  if(!Array.isArray(policy.terrainStatuses)||!Array.isArray(evidence.railEdges)||!Array.isArray(evidence.riverEdges))fail('invalid-source-reviewed-ledger');
  const byId=new Map();const cells={};
  const sourceCities=policy.sourceEvidenceMode==='definitive-city-layer-v1';
  const overlays=sourceCities?evidence.cityTerrainOverlays:null;
  if(sourceCities&&(!overlays||typeof overlays!=='object'||Array.isArray(overlays)))fail('missing-city-terrain-overlays');
  if(!sourceCities&&evidence.cityTerrainOverlays)fail('unsupported-city-terrain-overlays');
  const citySeen=new Set();
  for(const c of map.cells){
   if(!c||byId.has(c.id)||!policy.terrainStatuses.includes(c.terrainStatus)||
    !['open','forest','swamp'].includes(c.terrain))fail('unverified-terrain:'+c?.id);
   let terrain=c.terrain;
   if(sourceCities){
    // Terrain Effects Chart lists City and Major City as complete gameplay types.
    // The existing 'open' base beneath these symbols is a DISPLAY FALLBACK ONLY.
    const authoritative=evidence.sourceSvgSha256,city=overlays[c.id];
    if(!c.sourceTerrainEvidence||c.sourceTerrainEvidence.sourceSvgSha256!==authoritative)fail('unverified-svg-cell:'+c.id);
    if(city){
     if(c.terrainStatus!=='source-typed-city-terrain-v429'||c.terrain!=='open'||
      !['city','major-city'].includes(city.terrain)||typeof city.svgId!=='string'||
      c.sourceTerrainEvidence.layer!==city.terrain||
      !c.sourceTerrainEvidence.sourceSvgIds?.includes(city.svgId)||
      !(c.tileMarkers||[]).some(m=>(city.terrain==='major-city'?m.kind==='majorCity':m.kind==='city')&&m.sourceSvgId===city.svgId))fail('unverified-source-city:'+c.id);
     terrain=city.terrain;citySeen.add(c.id);
    }else if(c.terrainStatus==='user-adjudicated-terrain-v435'){
     const a=c.userTerrainAdjudication;
     if(!a||!a.directive||a.sourceTerrainUnchanged!==true||
       a.previousTerrain!==c.sourceTerrainEvidence.layer||
       a.terrain!==c.terrain)fail('unverified-user-terrain-adjudication:'+c.id);
    }else if(c.terrainStatus!=='definitive-user-svg-terrain-v428'||
     c.sourceTerrainEvidence.layer!==c.terrain)fail('unverified-source-base:'+c.id);
   }
   byId.set(c.id,c);cells[c.id]={terrain,verified:true,rail:false,sourceTerrainStatus:c.terrainStatus};
  }
  if(sourceCities&&citySeen.size!==Object.keys(overlays).length)fail('unmatched-city-terrain-overlay');
  if(byId.size!==evidence.hexCount)fail('source-reviewed-cell-count');
  const registered=new Set();
  for(const link of map.hexCenterRailConnections||[]){
   if(link.status!==policy.railStatus||!byId.has(link.from)||!byId.has(link.to))fail('unverified-rail-link');
   const key=pair(link.from,link.to);if(registered.has(key))fail('duplicate-rail-link');registered.add(key);
  }
  function listed(items,label){const s=new Set();for(const key of items){
   if(typeof key!=='string'||!/^[0-9]{4}:[0-9]{4}$/.test(key)||s.has(key)||key!==key.split(':').sort().join(':'))fail('invalid-'+label+'-ledger');
   s.add(key);
  }return s}
  const rails=listed(evidence.railEdges,'rail'),rivers=listed(evidence.riverEdges,'river'),
   majorRivers=listed(evidence.majorRiverEdges||[],'major-river');
  if([...rivers].some(key=>majorRivers.has(key)))fail('conflicting-river-types');
  if(rails.size!==registered.size||[...rails].some(key=>!registered.has(key)))fail('rail-ledger-disagreement');
  // Source-layer presentation markers are not exhaustive (long river paths are
  // stored separately), but any marker that IS present must agree with the
  // independently source-pinned gameplay ledger. Do not accept a depicted
  // Major River side as an ordinary River crossing or vice versa. This is
  // generic to source-city-layer registrations, never a game-name exception.
  if(sourceCities)for(const c of map.cells){
   for(const [dir,features] of Object.entries(c.tileEdges||{})){
    if(!T.DIRS.includes(dir)||!Array.isArray(features))fail('invalid-source-visual-edge');
    const adjacent=T.neighbor(c,dir,map.geometry);if(!byId.has(adjacent))continue;
    const key=pair(c.id,adjacent);
    for(const feature of features){
     const kind=feature?.kind;
     if(kind==='river'&&!rivers.has(key)||kind==='majorRiver'&&!majorRivers.has(key)||kind==='rail'&&!rails.has(key))
      fail('source-visual-edge-disagrees-with-ledger:'+key+':'+kind);
    }
   }
  }
  const edges=[];const seen=new Set();let boundary=0;
  for(const c of map.cells)for(const dir of T.DIRS){
   const otherId=T.neighbor(c,dir,map.geometry),other=byId.get(otherId);
   if(!other){boundary++;continue;}
   if(T.neighbor(other,T.OPP[dir],map.geometry)!==c.id)fail('nonreciprocal-adjacency');
   const key=pair(c.id,otherId);if(seen.has(key))continue;seen.add(key);
   const rail=rails.has(key),river=rivers.has(key),majorRiver=majorRivers.has(key);
   edges.push({a:[c.id,otherId].sort()[0],b:[c.id,otherId].sort()[1],verified:true,rail,river,majorRiver,impassable:false,allSea:false,lake:false,source:policy.edgeSource});
   if(rail){cells[c.id].rail=true;cells[otherId].rail=true;}
  }
  if(edges.length!==evidence.edgeCount||boundary!==evidence.boundarySides||
   [...rails,...rivers,...majorRivers].some(key=>!seen.has(key))||
   (strict&&(!edges.length||!byId.size)))fail('source-reviewed-grid-disagreement');
  return {cells,edges,metadata:{sourceGame:map.sourceGame,sourceMapId:map.id,landHexes:byId.size,
   railEdges:rails.size,riverEdges:rivers.size,majorRiverEdges:majorRivers.size,edgeCount:edges.length,coverage:policy.coverage}};
 }
 return Object.freeze({build,fingerprint,overlayFingerprint});
});

};
})(globalThis);
