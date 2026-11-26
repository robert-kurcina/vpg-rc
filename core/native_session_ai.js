/* Configurable baseline AI for native action sessions. This is NOT the legacy
 * strategic AI: it never modifies engine state directly and has no scenario-
 * identity branches. Its choices go through WargameSession.legal/execute and
 * are therefore compatible with the same history, Undo and save contracts as
 * human input. No game can be switched to this AI without explicit opt-in.
 */
(function(root,factory){
 const isNode=typeof module==='object'&&module.exports;
 const S=isNode?require('./session.js'):root.WargameSession;
 const E=isNode?require('./engine.js'):root.WargameCore;
 if(!S||!E)throw Error('Native session AI requires shared session and engine');
 const D=isNode?require('./ai_difficulty.js'):root.WargameAIDifficulty;
 const api=factory(S,E,D);
 if(isNode)module.exports=api;
 root.WargameNativeSessionAI=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(S,E,D){
'use strict';
const SETTINGS=Object.freeze({schemaVersion:1,mode:'deterministic-baseline',
 maxPhases:12,maxActions:180,maxMovesPerPhase:8,maxBattlesPerPhase:2,
 maxReplacementsPerPhase:8,minAttackOdds:1});
const LIMITS={maxPhases:[1,30],maxActions:[1,400],maxMovesPerPhase:[0,60],
 maxBattlesPerPhase:[0,20],maxReplacementsPerPhase:[0,24],minAttackOdds:[1,12]};
const cmpText=(a,b)=>String(a).localeCompare(String(b),'en');
const cmpPos=(a,b)=>a.x-b.x||a.y-b.y||cmpText(a.unitId??a.id??'',b.unitId??b.id??'');
function policy(value={}){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('AI profile must be an object');
 const grade=Object.hasOwn(value,'difficulty')?D.validate(value.difficulty):0;
 const p={...SETTINGS,...value,...(grade?D.native(grade):{})};
 if(Object.keys(value).some(k=>!Object.hasOwn(SETTINGS,k)&&k!=='difficulty'&&k!=='tacticalPolicy'))throw Error('Unknown native AI setting');
 if(Object.hasOwn(p,'tacticalPolicy')&&!['expected-utility-v1','positioning-v1','armored-concentration-v1','concentrated-defense-v1','mobile-concentration-v1','adaptive-concentration-v1'].includes(p.tacticalPolicy))throw Error('Unsupported native tactical policy');
 if(p.schemaVersion!==1||!['deterministic-baseline','objective-guard-v1','objective-advance-v1'].includes(p.mode))throw Error('Unsupported AI policy/version');
 for(const [name,[min,max]] of Object.entries(LIMITS))
  if(!Number.isInteger(p[name])||p[name]<min||p[name]>max||
     (Object.hasOwn(value,name)&&(!Number.isInteger(value[name])||value[name]<min||value[name]>max)))throw Error('Invalid AI limit '+name);
 return Object.freeze(p);
}
function controlGoals(g,side){
 const goals=[];const seen=new Set();
 const add=cell=>{if(!Array.isArray(cell)||cell.length!==2||!cell.every(Number.isInteger))return;
  const k=cell.join(',');if(!seen.has(k)){seen.add(k);goals.push(cell);}};
 for(const point of g.objectives?.points||[])if(point.type==='control')add(point.cell);
 const scan=predicate=>{
  if(!predicate||typeof predicate!=='object')return;
  if(predicate.type==='controls'&&predicate.faction===side)add(predicate.cell);
  if(predicate.type==='all'||predicate.type==='any')for(const x of predicate.children||[])scan(x);
  // 'not' is excluded: the player is not aiming to control a negated target.
 };
 for(const decision of g.objectives?.victory?.decisions||[])scan(decision.if);
 return goals;
}
// Advisory positioning only. Score changes, not absolute endpoint quality: a
// safe stationary unit must not move just because its destination looks safe.
// The native engine supplies every legal route and all committed transitions.
function positionalDelta(g,s,u,to,goals,friends,enemies){
 const side=E.unitSide(u),origin=u.position;
 const at=(a,b)=>a.x===b.x&&a.y===b.y;
 const dist=(a,b)=>E.distance(a.x,a.y,b.x,b.y);
 const strength=(v,role)=>Math.max(0,E.power(v,role)??0);
 const defense=Math.max(1,strength(u,'defense'));
 function features(p){
  const cell=g.cells.get(p.x+','+p.y)||{};
  const near=enemies.filter(v=>dist(v.position,p)===1);
  const pressure=near.reduce((n,v)=>n+strength(v,'attack'),0);
  const friendly=friends.filter(v=>v.id!==u.id&&dist(v.position,p)===1);
  // Nearby friendly formations are a proxy for coordinated pressure, not
  // a claim that they can join every attack or prevent a legal retreat.
  const support=friendly.reduce((n,v)=>n+strength(v,'attack'),0);
  const terrainAllowed=g.rules.combat.terrainDefenderFactions?.[cell.terrain];
  const cover=(terrainAllowed&&!terrainAllowed.includes(side)?0:(g.rules.combat.terrainShifts?.[cell.terrain]||0))+(g.rules.combat.cityShifts?.[cell.city]||0);
  const risk=Math.max(0,pressure/(defense*(1+cover))-1);
  const concentration=near.length?Math.min(2,support/defense):0;
  return {risk,concentration};
 }
 const from=features(origin),dest=features(to);
 const objective=goals.some(([x,y])=>to.x===x&&to.y===y);
 const key=to.x+','+to.y;
 const capture=Object.hasOwn(s.control,key)&&s.control[key]!==side? (objective?3:1):0;
 const originKey=origin.x+','+origin.y;
 // A threatened controlled city is a useful screen even if it is not the
 // primary objective. Avoid abandoning its last formation without benefit.
 const leavesCity=Object.hasOwn(s.control,originKey)&&s.control[originKey]===side&&
   !friends.some(v=>v.id!==u.id&&at(v.position,origin))&&enemies.some(v=>dist(v.position,origin)<=2);
 return capture+0.5*(dest.concentration-from.concentration)-0.8*(dest.risk-from.risk)-(leavesCity?1:0);
}
function chooseMovement(session,config,moved){
 const s=session.state,g=session.config,side=s.side;
 const goals=controlGoals(g,side);
 const enemies=s.units.filter(u=>u.position&&u.strength!=='dead'&&!E.support(u)&&E.unitSide(u)!==side);
 const enemy=enemies.map(u=>[u.position.x,u.position.y]);
 const friends=s.units.filter(u=>u.position&&u.strength!=='dead'&&!E.support(u)&&E.unitSide(u)===side);
 const dynamic=['mobile-concentration-v1','adaptive-concentration-v1'].includes(config.tacticalPolicy)&&g.rules.specialRules.some(x=>x.module==='stacking-capacity-v1');
 const phase=E.currentPhase(g,s);
 const quality=config.tacticalPolicy==='positioning-v1'&&config.difficulty>=6?(config.difficulty-5)/5:0;
 const targets=goals.length?goals:enemy;
 if(!targets.length)return null;
 const distance=p=>Math.min(...targets.map(t=>E.distance(p.x,p.y,t[0],t[1])));
 // Opt-in defense: never voluntarily vacate a controlled victory-objective
 // hex. This is a strategy constraint, not a movement-legality rule.
 const protectedCells=['objective-guard-v1','objective-advance-v1'].includes(config.mode)?new Set(goals.filter(([x,y])=>s.control[x+','+y]===side).map(p=>p.join(','))):new Set();
 let best=null;
 for(const u of friends){
  if(moved.has(u.id)||protectedCells.has(u.position.x+','+u.position.y))continue;
  const current=distance(u.position),opts=S.legal(session,{type:'move',unitId:u.id});
  for(const destination of opts){
   const progress=current-distance(destination);
   const doctrine=config.tacticalPolicy;
   const stackEnabled=g.rules.specialRules.some(x=>x.module==='stacking-capacity-v1');
   const value=p=>{
    if(!stackEnabled)return 0;
    const mate=friends.find(v=>v.id!==u.id&&v.position.x===p.x&&v.position.y===p.y);
    if(!mate)return 0;
    if(doctrine==='armored-concentration-v1'&&u.type==='tank'&&mate.type==='tank'&&E.power(u,'attack')>=8&&E.power(mate,'attack')>=8)
     return (enemies.some(v=>E.distance(v.position.x,v.position.y,p.x,p.y)===1)?2.5:0.7)/(1+0.12*distance(p));
    if(doctrine==='concentrated-defense-v1')return (distance(p)===0?2.8:g.cells.get(p.x+','+p.y)?.city?0.7:0)+Math.min(1.2,enemies.filter(v=>E.distance(v.position.x,v.position.y,p.x,p.y)<=2).reduce((n,v)=>n+(E.power(v,'attack')||0),0)/24);
    return 0;
   };
   const stackGain=['armored-concentration-v1','concentrated-defense-v1'].includes(doctrine)?value(destination)-value(u.position):0;
   // Concentrate in the pre-combat mobile phase; disperse after combat when
   // extra frontage or objective access is available. Score marginal coverage,
   // not a permanent bonus for sharing a hex. No extra movement allowance.
   let maneuver=0;
   if(dynamic&&u.type==='tank'&&E.power(u,'attack')>=8){
    const at=(a,b)=>a.x===b.x&&a.y===b.y;
    const paired=p=>friends.some(v=>v.id!==u.id&&v.type==='tank'&&E.power(v,'attack')>=8&&at(v.position,p));
    const coverage=p=>E.neighbors(p.x,p.y).filter(n=>g.playable(n.x,n.y)&&!friends.some(v=>v.id!==u.id&&E.distance(v.position.x,v.position.y,n.x,n.y)<=1)).length;
    const pressure=p=>enemies.filter(v=>E.distance(v.position.x,v.position.y,p.x,p.y)===1).reduce((n,v)=>n+E.power(v,'defense'),0);
    const pre=phase.movementMode==='panzer';
    const adaptive=doctrine==='adaptive-concentration-v1';
    const value=p=>{
      const contact=pressure(p),pair=paired(p);
      const staging=pre&&pair?(adaptive&&contact?Math.min(2.5,contact/8):contact?0.35:1.15):0;
      const spread=(pre?0.12:0.42)*coverage(p);
      const capture=Object.hasOwn(s.control,p.x+','+p.y)&&s.control[p.x+','+p.y]!==side?0.65:0;
      return staging+spread+capture-(pair&&!pre?0.9:0);
    };
    maneuver=value(destination)-value(u.position);
   }
   const vp=g.objectives.graduatedVictory?.weights[destination.x+','+destination.y]||0;
   const vpGain=vp&&s.control[destination.x+','+destination.y]!==side?vp:0;
   const gain=progress+stackGain+maneuver+vpGain+(quality?quality*positionalDelta(g,s,u,destination,goals,friends,enemies):0);
   if(gain<=0)continue;
   const candidate={unitId:u.id,x:destination.x,y:destination.y,gain,cost:destination.cost??0};
   const better=!best||candidate.gain>best.gain||candidate.gain===best.gain&&(
    candidate.cost<best.cost||candidate.cost===best.cost&&(
     cmpText(candidate.unitId,best.unitId)<0||candidate.unitId===best.unitId&&cmpPos(candidate,best)<0));
   if(better)best=candidate;
  }
 }
 return best?{type:'move',unitId:best.unitId,x:best.x,y:best.y}:null;
}
// Advisory expected utility over the six possible CRT outcomes. No RNG reads.
// Native B4M is single-defender; use public counter condition and actual retreat preview.
function combatUtility(g,s,attackers,defender,objective){
 const steps=defender.strength==='full'&&defender.stepLoss!=='remove'?2:1;
 let sum=0;
 for(let die=1;die<=6;die++){
  const p=E.combatPreview(g,s,attackers,defender.id,die);
  if(!p)return null;
  const loss=['DRL','EX'].includes(p.outcome)||p.outcome==='DR'&&(p.cityHold||p.cityHoldOptions?.length)?1:0;
  const retreat=['DR','DRL','EX'].includes(p.outcome)&&!p.cityHold&&!p.cityHoldOptions?.length;
  // EX can change retreat conditions after attacker losses: do not assume elimination.
  const eliminated=p.outcome==='DE'||loss>=steps||retreat&&p.outcome!=='EX'&&!p.retreat.length&&!Object.values(p.retreatByDefender||{}).some(routes=>routes.length);
  const cleared=eliminated||retreat;
  const enemyLoss=eliminated?steps:loss;
  const ownLoss=p.outcome==='AL'||p.outcome==='EX'?1:0;
  sum+=enemyLoss-ownLoss*1.25+(cleared?(objective?1.5:0.35):0);
 }
 return sum/6;
}
function chooseCombat(session,config){
 const s=session.state,g=session.config,side=s.side;
 if(s.declarationLocked){
  // Some configured games produce automatic no-die NE results. Supplying an
  // advanceId (even 'none') makes that legal commitment invalid.
  if(s.pendingRoll===0)return {type:'resolve-pending',options:{}};
  // Preserve the defensive purpose of city hold in the opt-in stacked policy.
  const declared=s.declarations[0];
  if(declared&&(g.rules.adjudications==='historical-20261125-v1'||g.rules.specialRules.some(x=>x.module==='stacked-battle-v1'&&x.cityHoldPolicy==='one-step-choice'))){
   const preview=E.combatPreview(g,s,declared.attackers,declared.defender,s.pendingRoll,declared.airSupportId||null);
   if(preview?.cityHoldOptions?.length)return {type:'resolve-pending',options:{standFastId:preview.cityHoldOptions[0],advanceId:'none'}};
  }
  // Dice are already committed at this point. Read the existing CRT preview;
  // never predict the next die, choose an advance before commitment, or
  // resolve the battle through a separate AI rules implementation.
  if(['armored-concentration-v1','mobile-concentration-v1','adaptive-concentration-v1'].includes(config.tacticalPolicy)&&s.pendingRoll>=1&&s.declarations.length){
   const b=s.declarations[0],p=E.combatPreview(g,s,b.attackers,b.defender,s.pendingRoll,b.airSupportId||null);
   if(p?.potentialAdvance&&!p.cityHold)return {type:'resolve-pending',options:{}};
  }
  if((config.mode==='objective-advance-v1'||config.tacticalPolicy==='expected-utility-v1'&&config.difficulty>=6&&config.mode==='objective-guard-v1')&&s.pendingRoll>=1&&s.declarations.length){
   const battle=s.declarations[0],target=s.units.find(u=>u.id===battle.defender);
   const p=E.combatPreview(g,s,battle.attackers,battle.defender,s.pendingRoll,battle.airSupportId||null);
   const at=target?.position,goals=controlGoals(g,side);
   if(p?.potentialAdvance&&!p.cityHold&&at&&goals.some(([x,y])=>x===at.x&&y===at.y)&&
     s.control[at.x+','+at.y]!==side){
    // An omitted advanceId selects the validated source-configured default
    // attacker. No assertion that DR/EX necessarily clears the hex: only
    // the combat transaction may decide actual occupation and ownership.
    return {type:'resolve-pending',options:{}};
   }
  }
  return {type:'resolve-pending',options:{advanceId:'none'}};
 }
 if(s.declarations.length>=config.maxBattlesPerPhase)return {type:'finish-phase'};
 const used=new Set(s.declarations.flatMap(d=>d.attackers));
 const enemies=s.units.filter(u=>u.position&&u.strength!=='dead'&&!E.support(u)&&E.unitSide(u)!==side)
  .sort((a,b)=>cmpText(a.id,b.id));
 let best=null;
 const quality=config.tacticalPolicy==='expected-utility-v1'&&config.difficulty>=6?(config.difficulty-5)/5:0;
 const goals=quality?controlGoals(g,side):[];
 for(const defender of enemies){
  // Native shared combat legality remains authoritative. Stacked attackers
  // are permitted only if the common engine approves the declared group.
  const adjacent=s.units.filter(u=>u.position&&u.strength!=='dead'&&!E.support(u)&&E.unitSide(u)===side&&
    !used.has(u.id)&&E.distance(u.position.x,u.position.y,defender.position.x,defender.position.y)===1)
    .map(u=>u.id).sort(cmpText);
  if(!adjacent.length)continue;
  const groups=[adjacent,...adjacent.map(id=>[id])];
  for(const attackers of groups){
   const action={type:'declare-battle',attackers,defender:defender.id};
   if(!S.legal(session,action).length)continue;
   const odds=E.combatOdds(g,s,attackers,defender.id)?.odds;
   if(!Number.isFinite(odds)||odds<config.minAttackOdds)continue;
   const objective=goals.some(([x,y])=>x===defender.position.x&&y===defender.position.y);
   const utility=quality?combatUtility(g,s,attackers,defender,objective):null;
   if(quality&&(utility===null||utility<=0))continue;
   let score=quality?(1-quality)*odds/6+quality*utility:odds;
   if(['armored-concentration-v1','mobile-concentration-v1','adaptive-concentration-v1'].includes(config.tacticalPolicy))score+=2/(1+Math.min(...controlGoals(g,side).map(([x,y])=>E.distance(x,y,defender.position.x,defender.position.y)),99));
   if(!best||score>best.score||score===best.score&&(
      cmpText(defender.id,best.action.defender)<0||defender.id===best.action.defender&&
      attackers.length<best.action.attackers.length))best={action,odds,score};
  }
 }
 return best?.action||{type:'finish-phase'};
}
function decide(session,settings={},counters={}){
 const p=policy(settings),s=session?.state,g=session?.config;
 if(session?.engine!=='generic-hex-v1'||!s||!g)throw Error('Native AI only accepts shared generic-hex sessions');
 const phase=E.currentPhase(g,s);if(s.over||!phase)return null;
 if(phase.kind==='setup'){
  if(!S.legal(session,{type:'finish-setup'}).length)throw Error('Manual setup requires a completed legal placement before AI turn');
  return {type:'finish-setup'};
 }
 if(phase.kind==='redeployment'){
  // A neutral AI does not silently choose a tournament-candidate reserve layout.
  // It elects the source-permitted zero-move option before ordinary play.
  return {type:'finish-redeployment'};
 }
 if(phase.kind==='reinforcement'){
  const opts=S.legal(session,{type:'place-reinforcement'}).slice().sort(cmpPos);
  if(!opts.length)return {type:'finish-phase'};
  const matching=(g.deployments?.interactiveReinforcements||[]).filter(e=>e.turn===s.turn&&
   e.side===s.side&&e.phaseId===phase.id);
  if(matching.length!==1||!matching[0].unitId)throw Error('Ambiguous reinforcement unit in scenario configuration');
  return {type:'place-reinforcement',unitId:matching[0].unitId,x:opts[0].x,y:opts[0].y};
 }
 if(phase.kind==='replacement'){
  const opts=S.legal(session,{type:'replacement'}).slice().sort((a,b)=>
   Number(a.type!=='restore')-Number(b.type!=='restore')||cmpText(a.id,b.id)||cmpPos(a,b));
  if((counters.replacements||0)>=p.maxReplacementsPerPhase||!opts.length)return {type:'finish-phase'};
  if(['objective-guard-v1','objective-advance-v1'].includes(p.mode)){
   // Source objectives, not game names or hidden map coordinates, select the
   // defended sites. Use only a legal entry action, when the defended side
   // controls the site but no living unit currently occupies it.
   const guarded=controlGoals(g,s.side).filter(([x,y])=>s.control[x+','+y]===s.side&&
    !s.units.some(u=>u.position?.x===x&&u.position?.y===y&&u.strength!=='dead'));
   const choice=guarded.flatMap(([x,y])=>opts.filter(o=>o.type==='enter'&&o.x===x&&o.y===y))
    .sort((a,b)=>cmpText(a.id,b.id)||cmpPos(a,b))[0];
   if(choice)return {type:'replacement',choice};
  }
  return {type:'replacement',choice:opts[0]};
 }
 if(phase.kind==='move'){
  const action=(counters.moves||0)<p.maxMovesPerPhase?chooseMovement(session,p,counters.moved||new Set()):null;
  return action||{type:'finish-phase'};
 }
 if(phase.kind==='combat')return chooseCombat(session,p);
 throw Error('AI has no supported action for phase '+phase.kind);
}
function* sideSteps(input,settings={}){
 const p=policy(settings);
 if(input?.engine!=='generic-hex-v1')throw Error('Native AI requires generic-hex-v1 session');
 // The complete initial session and config are validated before any decision.
 S.context(input);
 const side=input.state.side;
 if(input.state.over)return {session:input,actions:[],summary:{side,phases:0,moves:0,battles:0,replacements:0,finished:true}};
 let session=input,phaseKey=null,phases=0,counters=null;
 const actions=[];let moves=0,battles=0,replacements=0;
 while(!session.state.over&&session.state.side===side){
  const phase=E.currentPhase(session.config,session.state);
  if(!phase)throw Error('Missing native AI phase');
  const key=session.state.turn+':'+session.state.side+':'+session.state.phaseIndex;
  if(key!==phaseKey){phaseKey=key;phases++;
   // Graded movement budgets count already committed phase movements, also
   // after a saved position is restored. Keep legacy policy behavior intact.
   const moved=p.difficulty&&phase.kind==='move'?new Set(session.state.moved):new Set();
   counters={moves:moved.size,battles:0,replacements:0,moved};
   if(phases>p.maxPhases)throw Error('AI phase safety limit reached');}
  if(actions.length>=p.maxActions)throw Error('AI action safety limit reached');
  const action=decide(session,p,counters),before=session;
  if(!action)break;
  const res=S.execute(session,action);
  if(!res.ok)throw Error('Shared session rejected AI action '+action.type+': '+res.reason);
  if(res.session===session)throw Error('AI action failed to advance shared session');
  session=res.session;
  if(action.type==='move'){counters.moves++;counters.moved.add(action.unitId);moves++;}
  if(action.type==='declare-battle'){counters.battles++;battles++;}
  if(action.type==='replacement'){counters.replacements++;replacements++;}
  const item={action,result:res.result,turn:before.state.turn,side:before.state.side,
   phase:phase.id,seedBefore:before.state.seed,seedAfter:session.state.seed};
  actions.push(item);
  yield {before,after:session,...item};
 }
 return {session,actions,summary:{side,phases,moves,battles,replacements,finished:session.state.over,
  newSide:session.state.side,turn:session.state.turn}};
}
function playSide(input,settings={},onAction=null){
 const steps=sideSteps(input,settings);let next;
 while(!(next=steps.next()).done){if(onAction)onAction(next.value);}
 return next.value;
}
return {policy,controlGoals,combatUtility,positionalDelta,decide,playSide,sideSteps};
});
