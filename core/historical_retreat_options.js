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
