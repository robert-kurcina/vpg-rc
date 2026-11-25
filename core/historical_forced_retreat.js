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
