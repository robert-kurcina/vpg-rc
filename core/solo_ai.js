/* Opt-in Solo AI action adapter. Decisions use shared legal-action queries;
 * execution and history are owned exclusively by WargameSession.
 * This first deterministic policy is NOT Oberlabs strategic-policy parity.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameSoloAI=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const Session=(typeof globalThis!=='undefined'&&globalThis.WargameSession)||
 (typeof require==='function'?require('./session.js'):null);
const ALLOWED_POLICIES=new Set(['safe-pass','first-legal-move','legacy-replacement-balanced','legacy-replacement-conserve','legacy-replacement-fortress','legacy-replacement-screen','legacy-replacement-counter','legacy-replacement-railguard']);
const engine=(typeof globalThis!=='undefined'&&globalThis.B4MEngine)||
 (typeof require==='function'?require('../legacy/engine.js'):null);
// Source-aligned ranking from legacy/engine.js::doReplacements. Only the
// replacement decision is migrated; subsequent strategic decisions are NOT.
function planLegacyReplacement(session,policy='balanced'){
 if(!engine)throw Error('Oberlabs-compatible reference engine unavailable');
 Session.context(session);
 if(session.state.phase!=='replacement')return null;
 const options=Session.legal(session,{type:'replacement'});
 if(!options.length)return null;
 const c=session.config,s=session.state,m=c.profile.victory.moscow;
 const defensive=s.side==='soviet'&&['fortress','screen','counter','railguard'].includes(policy);
 const occupied=engine.occupant(s,m[0],m[1]);
 const score=r=>{
  const u=s.units.find(v=>v.id===r.id);
  const xy=r.operation==='enter'?r:u.position;
  const near=engine.dist(xy.x,xy.y,...m);
  if(defensive){
   const atM=xy.x===m[0]&&xy.y===m[1];
   if(atM&&r.operation==='restore')return 100000;
   if(!occupied&&atM&&r.operation==='enter')return 90000+(u.type==='shock'?1000:0)+u.combatReduced;
   if(r.operation==='restore')return 2800-40*near+u.combatFull*.5;
   if(r.operation==='enter')return 500-35*near+u.combatReduced*.4;
   return 0;
  }
  return (r.operation==='restore'?40:policy==='conserve'?5:28)+engine.strength(u)*.4+
   (r.operation==='enter'?-near*2:0)+(u.type==='shock'?20:0);
 };
 // Stable source ordering is significant when scores tie. Array.sort is stable
 // in supported JS runtimes, as in the source engine.
 return [...options].sort((a,b)=>score(b)-score(a))[0];
}


// Reproduces the first ordinary move of legacy/engine.js::strategicMove.
// Moscow relief is a single atomic action; the isolated first-move adapter
// refuses to split it, while the full-phase planner handles it first.
const MOVE_POLICIES=new Set(['balanced','conserve','aggressive','fortress','screen','counter','railguard','north','south','flank']);
const DEFENSIVE=new Set(['fortress','screen','counter','railguard']);
function planLegacyMove(session,policy='balanced',options={}){
 if(!engine)throw Error('Oberlabs-compatible reference engine unavailable');
 Session.context(session);
 if(!MOVE_POLICIES.has(policy))throw Error('Unknown movement policy');
 const s=session.state,c=session.config,side=s.side;
 if(!['special','movement'].includes(s.phase))return null;
 const mode=s.phase==='movement'?'normal':side==='german'?'panzer':'rail';
 // The compound action is planned separately and is applied once per phase.
 if(!options.skipRelief){
  const relief=planMoscowRelief(session,policy);
  if(relief)throw Error('Moscow relief requires full-phase planner');
 }
 const city=c.cities.slice().sort((a,b)=>((b.city==='moscow'?20:0)-(a.city==='moscow'?20:0))||
   (side==='german'?b.x-a.x:a.x-b.x));
 if(policy==='flank')city.reverse();
 if(policy==='south')city.sort((a,b)=>b.y-a.y);
 if(policy==='north')city.sort((a,b)=>a.y-b.y);
 const distanceToCity=u=>Math.min(...city.map(h=>engine.dist(u.position.x,u.position.y,h.x,h.y)));
 const eligible=engine.units(s,side).filter(u=>mode!=='panzer'||u.type==='tank')
  .filter(u=>mode!=='rail'||(engine.hexAt(c,u.position.x,u.position.y).rail||[]).length)
  .sort((a,b)=>distanceToCity(a)-distanceToCity(b)||engine.strength(b)-engine.strength(a));
 for(const u of eligible){
  if(options.onlyUnitId&&u.id!==options.onlyUnitId)continue;
  if(side==='soviet'&&DEFENSIVE.has(policy)&&u.position.x===10&&u.position.y===2)continue;
  if(session.usedUnitIds.includes(u.id))continue;
  const moves=Session.legal(session,{type:'move',unitId:u.id,mode});
  if(!moves.length)continue;
  const at=u.position,initial=distanceToCity(u);
  const scored=moves.map(m=>{
   const distValue=Math.min(...city.map((h,i)=>engine.dist(m.x,m.y,h.x,h.y)*(i===0?.65:1.1)));
   const threat=engine.neighbours(c,m.x,m.y).filter(n=>engine.occupant(s,n.x,n.y)?.army===engine.enemy(side)).length;
   const z=engine.neighbours(c,m.x,m.y).some(n=>engine.occupant(s,n.x,n.y)?.army===engine.enemy(side));
   const here=engine.hexAt(c,m.x,m.y),heldCity=engine.hexAt(c,at.x,at.y)?.city;
   const score=-distValue*5+(here.city!=='none'?8:0)+
    (side==='soviet'&&here.terrain==='fortification'?8:0)+
    (side==='soviet'&&DEFENSIVE.has(policy)?
     Math.max(0,4-engine.dist(m.x,m.y,10,2))*(policy==='screen'?17:policy==='railguard'?12:11)+
     (here.terrain==='fortification'?(policy==='screen'?18:9):0)+
     (policy==='counter'?threat*8:0)+
     (policy==='railguard'&&(here.rail||[]).length?8:0):0)+
    (policy==='aggressive'?threat*9:policy==='conserve'?-threat*8:DEFENSIVE.has(policy)?threat*4:threat*2)+
    (policy==='south'?m.y*1.5:policy==='north'?-m.y*1.5:0)-
    (heldCity==='moscow'&&side==='soviet'?80:0)-(z&&policy==='conserve'?10:0);
   return {m,score};
  }).sort((a,b)=>b.score-a.score);
  const originScore=-initial*5+(engine.hexAt(c,at.x,at.y).city!=='none'?8:0)+
   (engine.hexAt(c,at.x,at.y).city==='moscow'&&side==='soviet'?100:0);
  if(scored[0].score>originScore+.2){
   const {x,y}=scored[0].m;return {type:'move',unitId:u.id,x,y,mode};
  }
 }
 return null;
}


// Match source tryMoscowRelief: test destinations in legalMoves order,
// requiring BOTH legs to pass before proposing a single committed action.
function planMoscowRelief(session,policy='fortress'){
 Session.context(session);
 const s=session.state;
 if(!DEFENSIVE.has(policy)||s.side!=='soviet'||s.phase!=='movement'||s.turn<4)return null;
 return Session.legal(session,{type:'moscow-relief'})[0]||null;
}

// Run a complete source-ordered movement phase without changing the source AI.
// Source strategicMove freezes the eligible unit order at phase entry, but
// recomputes each unit's legal moves and score against the updated board.
// The full-phase planner handles Moscow relief as one atomic action before
// reproducing source-ordered ordinary moves.
function planLegacyMovementPhase(session,policy='balanced'){
 if(!MOVE_POLICIES.has(policy))throw Error('Unknown movement policy');
 Session.context(session);
 const {state:s,config:c}=session;
 if(!['special','movement'].includes(s.phase))throw Error('Not a movement phase');
 const side=s.side,mode=s.phase==='movement'?'normal':side==='german'?'panzer':'rail';
 // Source first attempts garrison relief before constructing the movement order.
 let current=session;const actions=[];
 const relief=planMoscowRelief(current,policy);
 if(relief){
  const result=Session.execute(current,relief);
  if(!result.ok)throw Error('Compound relief rejected: '+result.reason);
  current=result.session;actions.push(relief);
 }
 const city=c.cities.slice().sort((a,b)=>((b.city==='moscow'?20:0)-(a.city==='moscow'?20:0))||
  (side==='german'?b.x-a.x:a.x-b.x));
 if(policy==='flank')city.reverse();
 if(policy==='south')city.sort((a,b)=>b.y-a.y);
 if(policy==='north')city.sort((a,b)=>a.y-b.y);
 const rank=u=>Math.min(...city.map(h=>engine.dist(u.position.x,u.position.y,h.x,h.y)));
 const order=engine.units(current.state,side).filter(u=>mode!=='panzer'||u.type==='tank')
  .filter(u=>mode!=='rail'||(engine.hexAt(c,u.position.x,u.position.y).rail||[]).length)
  .sort((a,b)=>rank(a)-rank(b)||engine.strength(b)-engine.strength(a)).map(u=>u.id);
 for(const id of order){
  const action=planLegacyMove(current,policy,{onlyUnitId:id,skipRelief:true});
  if(!action)continue;
  const result=Session.execute(current,action);
  if(!result.ok)throw Error('Source-aligned movement rejected: '+result.reason);
  current=result.session;actions.push(action);
 }
 return {session:current,actions,mode,policy};
}

// Source-aligned *declaration* stage of legacy/engine.js::announceBattles.
// Retrieve candidates through the common legality boundary. Sort and reserve
// the complete set before rolling; consequence policy is intentionally separate.
const COMBAT_POLICIES=new Set(['balanced','conserve','aggressive','adaptive','envelop','interdict','tactical','fortress','screen','counter','railguard']);
function planLegacyCombatDeclarations(session,policy='balanced'){
 Session.context(session);
 if(!COMBAT_POLICIES.has(policy))throw Error('Unknown combat policy');
 if(session.state.phase!=='combat')throw Error('Combat declaration phase required');
 if(session.state.declaredBattles?.length)throw Error('Planner requires an undeclared combat phase');
 const c=session.config,s=session.state,side=s.side,m=c.profile.victory.moscow;
 const refined=['adaptive','interdict','envelop','tactical'].includes(policy);
 const scored=Session.legal(session,{type:'declare-battle'}).map(a=>{
  const d=s.units.find(u=>u.id===a.defender),h=engine.hexAt(c,d.position.x,d.position.y);
  const committed=a.attackers.reduce((sum,id)=>sum+engine.strength(s.units.find(u=>u.id===id)),0);
  const strategic=(h.city==='moscow'?180:h.city!=='none'?35:0)-engine.dist(d.position.x,d.position.y,...m)*(side==='german'?3:0);
  return {...a,committed,score:strategic+a.odds*11-(refined?a.attackers.length*8+committed*.15:a.attackers.length*.1)};
 }).sort((a,b)=>b.score-a.score||b.odds-a.odds||a.committed-b.committed);
 const threshold=['aggressive','adaptive','envelop','interdict'].includes(policy)?1:policy==='conserve'?3:2;
 const used=new Set(),defended=new Set(),actions=[];
 for(const a of scored){
  if(a.odds<threshold||defended.has(a.defender)||a.attackers.some(id=>used.has(id)))continue;
  actions.push({type:'declare-battle',defender:a.defender,attackers:[...a.attackers]});
  defended.add(a.defender);a.attackers.forEach(id=>used.add(id));
 }
 return actions;
}
function executeLegacyCombatDeclarations(session,policy='balanced'){
 const actions=planLegacyCombatDeclarations(session,policy);
 let current=session;
 for(const action of actions){
  const result=Session.execute(current,action);
  if(!result.ok)throw Error('Combat declaration rejected: '+result.reason);
  current=result.session;
 }
 return {session:current,actions,policy};
}


// Oberlabs AI uses resolveAttack's default consequences (no independent
// casualty policy). Always consume each *committed* die via the shared action
// and session boundary; subsequent dice are rolled by that boundary only
// after successful resolution of the previous encounter.
function executeLegacyCombatConsequences(session){
 Session.context(session);
 if(session.state.phase!=='combat-resolution'||!session.state.pendingBattle)
  throw Error('Committed combat resolution phase required');
 let current=session;
 const actions=[],records=[],dice=[];
 while(current.state.phase==='combat-resolution'){
  const battle=current.state.pendingBattle;
  if(!battle||!Number.isInteger(battle.die)||battle.die<1||battle.die>6)
   throw Error('Invalid committed combat die');
  const action={type:'resolve-pending',options:{}};
  const output=Session.execute(current,action);
  if(!output.ok)throw Error('Legacy AI consequence rejected: '+output.reason);
  actions.push(action);dice.push(battle.die);records.push(output.result.combat);
  current=output.session;
  if(actions.length>100)throw Error('Combat queue action limit exceeded');
 }
 return {session:current,actions,records,dice};
}

// Opt-in source-aligned orchestration for a standard (non-sweep) AI half-turn.
// Every board mutation is performed by WargameSession.execute(); policy choices
// remain separate from the legacy rules adjudicator. Source event parity is
// audited separately until the common action API can own AI log events.
function executeLegacyHalfTurn(session,policy='balanced'){
 if(!MOVE_POLICIES.has(policy)||!COMBAT_POLICIES.has(policy))
  throw Error('Unsupported whole-half-turn policy');
 Session.context(session);
 const origin={side:session.state.side,turn:session.state.turn};
 if(!['reinforcement','replacement'].includes(session.state.phase))
  throw Error('Half-turn must begin at reinforcement or replacement');
 let current=session;const actions=[];const trace=[];
 function apply(action){
  const before={phase:current.state.phase,seed:current.state.seed,logLength:current.state.log.length};
  const out=Session.execute(current,action);
  if(!out.ok)throw Error('AI half-turn action rejected: '+out.reason);
  current=out.session;actions.push(action);
  trace.push({action,from:before.phase,to:current.state.phase,seedBefore:before.seed,
   seedAfter:current.state.seed,events:current.state.log.slice(before.logLength)});
 }
 if(current.state.phase==='reinforcement'){
  const opts=Session.legal(current,{type:'shock-reinforcement'});
  if(opts.length){
   const m=current.config.profile.victory.moscow;
   const preferred=opts.slice().sort((a,b)=>
    (engine.hexAt(current.config,b.x,b.y).rail||[]).length-
     (engine.hexAt(current.config,a.x,a.y).rail||[]).length||
     engine.dist(a.x,a.y,...m)-engine.dist(b.x,b.y,...m))[0];
   apply({type:'shock-reinforcement',x:preferred.x,y:preferred.y});
  }
  apply({type:'finish-phase'});
 }
 for(let i=0;i<16;i++){
  const next=planLegacyReplacement(current,policy);
  if(!next)break;
  apply(next);
 }
 if(current.state.phase!=='replacement')throw Error('Unexpected replacement phase');
 apply({type:'finish-phase'});
 if(origin.side==='german'&&origin.turn!==1||origin.side==='soviet'){
  const planned=planLegacyMovementPhase(current,policy);
  // Replay through the same single session, rather than adopt a separate
  // planner-owned history that could diverge from this action trace.
  for(const action of planned.actions)apply(action);
 }
 apply({type:'finish-phase'});
 const declared=planLegacyCombatDeclarations(current,policy);
 for(const action of declared)apply(action);
 apply({type:'finish-phase',aiPolicy:policy});
 while(current.state.phase==='combat-resolution')apply({type:'resolve-pending',options:{}});
 if(current.state.phase!=='movement')throw Error('Combat did not lead to movement');
 const ordinary=planLegacyMovementPhase(current,policy);
 for(const action of ordinary.actions)apply(action);
 apply({type:'finish-phase',aiPolicy:policy});
 if(current.state.side===origin.side&&current.state.turn===origin.turn&&!current.state.over)
  throw Error('AI half-turn failed to advance');
 return {session:current,actions,trace,policy,origin};
}

function decide(session,{policy='safe-pass'}={}){
 if(!Session)throw Error('Shared session API unavailable');
 if(!ALLOWED_POLICIES.has(policy))throw Error('Unknown Solo AI policy');
 Session.context(session);
 const s=session.state;
 if(s.phase==='setup')throw Error('Solo AI setup policy not implemented');
 if(s.phase==='combat-resolution')throw Error('Solo AI combat consequence policy not implemented');
 if(s.phase==='reinforcement'){
  const choices=Session.legal(session,{type:'shock-reinforcement'});
  if(choices.length)return {type:'shock-reinforcement',x:choices[0].x,y:choices[0].y};
 }
 if(policy.startsWith('legacy-replacement-')&&s.phase==='replacement'){
  const candidate=planLegacyReplacement(session,policy.slice('legacy-replacement-'.length));
  if(candidate)return candidate;
 }
 if(policy==='first-legal-move'&&['special','movement'].includes(s.phase)){
  const mode=s.phase==='movement'?'normal':s.side==='german'?'panzer':'rail';
  for(const u of s.units){
   if(u.army!==s.side||!u.position||session.usedUnitIds.includes(u.id))continue;
   const moves=Session.legal(session,{type:'move',unitId:u.id,mode});
   if(moves.length)return {type:'move',unitId:u.id,x:moves[0].x,y:moves[0].y,mode};
  }
 }
 // Deliberately abstains from replacement, combat declaration, and all
 // strategic decisions. Useful for integration, not a competitive Solo AI.
 return {type:'finish-phase'};
}
function step(session,opts={}){
 const action=decide(session,opts);
 const output=Session.execute(session,action);
 if(!output.ok)throw Error('Solo AI action rejected: '+output.reason);
 return {session:output.session,action,result:output.result};
}
function halfTurn(session,{policy='safe-pass',maxActions=256}={}){
 if(!Number.isInteger(maxActions)||maxActions<1||maxActions>10000)throw Error('Invalid action limit');
 const origin={turn:session.state.turn,side:session.state.side};
 let current=session;const actions=[];
 for(let i=0;i<maxActions;i++){
  if(current.state.side!==origin.side||current.state.turn!==origin.turn||current.state.over)
   return {session:current,actions};
  const output=step(current,{policy});
  if(output.session===current)throw Error('Solo AI failed to advance');
  current=output.session;actions.push(output.action);
 }
 throw Error('Solo AI reached action limit without ending half-turn');
}
return {decide,step,halfTurn,planLegacyReplacement,planLegacyMove,planMoscowRelief,planLegacyMovementPhase,planLegacyCombatDeclarations,executeLegacyCombatDeclarations,executeLegacyCombatConsequences,executeLegacyHalfTurn,COMBAT_POLICIES:[...COMBAT_POLICIES],MOVE_POLICIES:[...MOVE_POLICIES],ALLOWED_POLICIES:[...ALLOWED_POLICIES]};
});
