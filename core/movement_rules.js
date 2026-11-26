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
