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
