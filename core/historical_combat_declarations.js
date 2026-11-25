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
