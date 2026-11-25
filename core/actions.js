/* Shared human/AI legal-action boundary, v1. The Oberlabs engine remains the
 * B4M adjudicator. No historical scenario executes through this adapter yet.
 * Explicit UI phase context is required: the legacy state alone is not a
 * complete representation of the human-facing phase workflow.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameActions=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const legacy=(typeof globalThis!=='undefined'&&globalThis.B4MEngine) ||
 (typeof require==='function'?require('../legacy/engine.js'):null);
const copy=o=>JSON.parse(JSON.stringify(o));
const PHASE_ACTIONS=Object.freeze({
 setup:['setup-place','finish-setup'],
 reinforcement:['shock-reinforcement','finish-phase'],
 replacement:['replacement','finish-phase'],
 special:['move','finish-phase'],
 combat:['combat-preview','declare-battle','remove-last-battle','finish-phase'],
 'combat-resolution':['combat-preview','combat-resolve','resolve-pending'],
 movement:['move','moscow-relief','finish-phase']
});
const MODES={special:['rail','panzer'],movement:['normal']};
function assertContext(ctx){
 if(!ctx||ctx.scenarioId!=='battle-for-moscow'||!ctx.config||!ctx.state)throw Error('Action runtime not available for this scenario');
 if(ctx.engine&&ctx.engine!== 'legacy-b4m-v1')throw Error('Unsupported action engine');
 if(!PHASE_ACTIONS[ctx.phase])throw Error('Unknown action phase');
 if(ctx.state.over)throw Error('Game already finished');
 if(!['german','soviet'].includes(ctx.actor)||ctx.actor!==ctx.state.side)throw Error('Wrong acting player');
 if(ctx.state.phase!==ctx.phase)throw Error('Phase context does not match state');
 if(ctx.phase==='setup'&&ctx.state.setupDone)throw Error('Setup already completed');
 if(ctx.phase!=='setup'&&!ctx.state.setupDone)throw Error('Opening setup not complete');
 return ctx;
}
function legal(ctx,request){
 assertContext(ctx);
 const {config:c,state:s,actor,phase}=ctx;
 if(request?.type==='move'&&MODES[phase]){
  const mode=request.mode||'normal';if(!MODES[phase].includes(mode))return [];
  const u=s.units.find(u=>u.id===request.unitId);
  if(!u||u.army!==actor||!u.position||(ctx.usedUnitIds||[]).includes(u.id))return [];
  return legacy.legalMoves(c,s,u,mode).map(({x,y,cost,path})=>({type:'move',unitId:u.id,x,y,mode,cost,path}));
 }
 if(request?.type==='moscow-relief'&&phase==='movement'&&actor==='soviet'&&s.turn>=4){
  const m=c.profile.victory.moscow,old=legacy.occupant(s,...m);
  const shock=s.units.find(u=>u.army==='soviet'&&u.type==='shock'&&u.position);
  if(!old||!shock||old.id===shock.id||legacy.strength(shock)<=legacy.strength(old)||
     legacy.dist(shock.position.x,shock.position.y,...m)!==1||
     (ctx.usedUnitIds||[]).includes(old.id)||(ctx.usedUnitIds||[]).includes(shock.id))return [];
  return legacy.legalMoves(c,s,old,'normal').filter(h=>
    !legacy.neighbours(c,h.x,h.y).some(n=>legacy.occupant(s,n.x,n.y)?.army==='german')&&
    legacy.dist(h.x,h.y,...m)<=2&&legacy.hexAt(c,h.x,h.y)?.terrain==='fortification')
   .filter(h=>{
    const draft=copy(s);
    return legacy.move(c,draft,old.id,h.x,h.y,'normal')&&
     legacy.move(c,draft,shock.id,m[0],m[1],'normal');
   })
   .map(h=>({type:'moscow-relief',oldId:old.id,shockId:shock.id,destination:{x:h.x,y:h.y}}));
 }
 if(request?.type==='replacement'&&phase==='replacement'&&
    (s.replacementUsed||0)<legacy.replacementBudget(c,s))return legacy.replacementOptions(c,s,actor).map(o=>({type:'replacement',operation:o.type,id:o.id,...(o.type==='enter'?{x:o.x,y:o.y}:{})}));
 if(request?.type==='shock-reinforcement'&&phase==='reinforcement'&&actor==='soviet')return legacy.shockReinforcementOptions(c,s).map(o=>({type:'shock-reinforcement',...o}));
 if(request?.type==='declare-battle'&&phase==='combat'){
  const declared=s.declaredBattles||[],used=new Set(declared.flatMap(b=>b.attackers));
  return legacy.attackCandidates(c,s,actor).filter(b=>!declared.some(d=>d.defender===b.defender)&&!b.attackers.some(id=>used.has(id))).map(b=>({type:'declare-battle',defender:b.defender,attackers:b.attackers,odds:b.odds}));
 }
 if(request?.type==='combat-preview'&&['combat','combat-resolution'].includes(phase)){
  if(!Number.isInteger(request.die)||request.die<1||request.die>6)return null;
  const d=s.units.find(u=>u.id===request.defender);
  if(!d||d.army===actor)return null;
  const ids=request.attackers||[];
  if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||ids.some(id=>s.units.find(u=>u.id===id)?.army!==actor))return null;
  return legacy.battlePreview(c,s,{attackers:ids,defender:request.defender},request.die);
 }
 return [];
}
function success(next,result){return {ok:true,state:next,result};}
function failure(state,reason){return {ok:false,state,reason};}
function execute(ctx,action){
 assertContext(ctx);
 const {config:c,state:s,actor,phase}=ctx;
 if(!action||!PHASE_ACTIONS[phase].includes(action.type))return failure(s,'action-unavailable-in-phase');
 const next=copy(s);
 try{
  if(action.type==='declare-battle'){
   const eligible=legal(ctx,{type:'declare-battle'});
   const candidate=eligible.find(b=>b.defender===action.defender&&Array.isArray(action.attackers)&&
    b.attackers.length===action.attackers.length&&b.attackers.every(id=>action.attackers.includes(id)));
   if(!candidate)return failure(s,'illegal-or-duplicate-battle');
   next.declaredBattles=next.declaredBattles||[];
   next.declaredBattles.push({defender:candidate.defender,attackers:[...candidate.attackers],declaredOdds:candidate.odds});
   return success(next,{type:'declare-battle',defender:candidate.defender});
  }
  if(action.type==='remove-last-battle'){
   if(!next.declaredBattles?.length)return failure(s,'no-declared-battle');
   const removed=next.declaredBattles.pop();
   return success(next,{type:'remove-last-battle',removed});
  }
  if(action.type==='finish-phase'){
   // Opt-in legacy AI event compatibility: these entries are emitted at
   // exactly the same boundaries as playSide(), without altering the
   // default human/UI finish-phase path or independently mutating AI state.
   if(action.aiPolicy!==undefined){
    if(typeof action.aiPolicy!=='string'||
       !['balanced','conserve','fortress','screen','counter','railguard','aggressive',
         'flank','north','south','adaptive','envelop','interdict','tactical',
         'sweep','north-route'].includes(action.aiPolicy)||
       !['combat','movement'].includes(phase))return failure(s,'invalid-ai-policy-event');
    if(phase==='combat')next.log.push({t:next.turn,side:next.side,type:'combat-declaration',
      battles:copy(next.declaredBattles||[])});
    else next.log.push({t:next.turn,side:next.side,type:'end-turn',policy:action.aiPolicy});
   }
   if(phase==='reinforcement'&&legacy.shockReinforcementOptions(c,next).length&&
    !next.units.some(u=>u.type==='shock'&&u.position))return failure(s,'required-shock-placement');
   next.replacementUsed=0;
   if(phase==='reinforcement')next.phase='replacement';
   else if(phase==='replacement')next.phase='special';
   else if(phase==='special')next.phase='combat';
   else if(phase==='combat'){
    if(next.declaredBattles?.length){
     next.combatQueue=copy(next.declaredBattles);next.combatIndex=0;
     next.phase='combat-resolution';
     const first=next.combatQueue[0];next.pendingBattle={action:first,die:legacy.rollCombatDie(next)};
    }else next.phase='movement';
   }else if(phase==='movement'){
    legacy.endSide(c,next);
    if(next.side==='german'&&next.turn===1)next.phase='combat';
    if(next.side==='soviet'&&next.turn===4)next.phase='reinforcement';
   }else return failure(s,'phase-cannot-finish');
   return success(next,{type:'finish-phase',from:phase,to:next.phase,side:next.side,turn:next.turn});
  }
  if(action.type==='resolve-pending'){
   if(!s.pendingBattle||!Array.isArray(s.combatQueue)||s.combatIndex>=s.combatQueue.length)
    return failure(s,'no-pending-battle');
   const pending=s.pendingBattle,declared=s.combatQueue[s.combatIndex];
   if(JSON.stringify(pending.action)!==JSON.stringify(declared))return failure(s,'invalid-pending-battle');
   const preview=legal(ctx,{type:'combat-preview',...pending.action,die:pending.die});
   if(!preview)return failure(s,'combat-no-longer-legal');
   const options={...(action.options||{}),avoidAdvanceIds:s.combatQueue.slice(s.combatIndex+1).flatMap(b=>b.attackers)};
   const record=legacy.resolveAttack(c,next,declared.attackers,declared.defender,pending.die,options);
   if(!record)return failure(s,'combat-rejected');
   next.combatIndex++;
   if(next.combatIndex<next.combatQueue.length){
    const following=next.combatQueue[next.combatIndex];
    next.pendingBattle={action:following,die:legacy.rollCombatDie(next)};
   }else{
    next.phase='movement';delete next.pendingBattle;delete next.combatQueue;
    delete next.declaredBattles;delete next.combatIndex;
   }
   return success(next,{type:'resolve-pending',combat:record,nextPhase:next.phase});
  }
  if(action.type==='moscow-relief'){
   // Validate the complete two-leg move before committing anything.
   const choices=legal(ctx,{type:'moscow-relief'});
   const chosen=choices.find(o=>o.oldId===action.oldId&&o.shockId===action.shockId&&
    o.destination.x===action.destination?.x&&o.destination.y===action.destination?.y);
   if(!chosen)return failure(s,'relief-ineligible-or-illegal');
   const m=c.profile.victory.moscow,old=s.units.find(u=>u.id===chosen.oldId),
    shock=s.units.find(u=>u.id===chosen.shockId),destination=chosen.destination;
   if(!legacy.move(c,next,old.id,destination.x,destination.y,'normal')||
      !legacy.move(c,next,shock.id,m[0],m[1],'normal'))
    return failure(s,'relief-second-leg-illegal');
   next.log.push({t:next.turn,side:'soviet',type:'garrison-relief',from:old.id,to:shock.id});
   return success(next,{type:'moscow-relief',oldId:old.id,shockId:shock.id,destination});
  }
  if(action.type==='move'){
   const opts=legal(ctx,action);
   if(!opts.some(o=>o.x===action.x&&o.y===action.y))return failure(s,'illegal-destination');
   if(!legacy.move(c,next,action.unitId,action.x,action.y,action.mode||'normal'))return failure(s,'move-rejected');
   return success(next,{type:'move',unitId:action.unitId,x:action.x,y:action.y});
  }
  if(action.type==='replacement'){
   const opts=legal(ctx,action);
   // Action uses distinct names for the action and replacement operation.
   const valid=opts.find(o=>o.id===action.id&&o.operation===action.operation&&
     (o.operation==='restore'||o.x===action.x&&o.y===action.y));
   if(!valid)return failure(s,'illegal-replacement');
   if(!legacy.applyReplacement(c,next,{type:action.operation,id:action.id,...(action.operation==='enter'?{x:action.x,y:action.y}:{})}))return failure(s,'replacement-rejected');
   next.replacementUsed=(next.replacementUsed||0)+1;
   return success(next,{type:'replacement',operation:action.operation,id:action.id});
  }
  if(action.type==='shock-reinforcement'){
   if(!legal(ctx,action).some(o=>o.x===action.x&&o.y===action.y))return failure(s,'illegal-reinforcement');
   if(!legacy.performShockReinforcement(c,next,{x:action.x,y:action.y}))return failure(s,'reinforcement-rejected');
   return success(next,{type:'shock-reinforcement',x:action.x,y:action.y});
  }
  if(action.type==='setup-place'){
   if(actor!=='german'||!legacy.setupPlace(c,next,action.unitId,action.x,action.y))return failure(s,'illegal-setup');
   return success(next,{type:'setup-place',unitId:action.unitId});
  }
  if(action.type==='finish-setup'){
   if(actor!=='german'||!legacy.finishSetup(c,next))return failure(s,'incomplete-setup');
   return success(next,{type:'finish-setup'});
  }
  if(action.type==='combat-preview'){
   const result=legal(ctx,action);
   return result?success(s,result):failure(s,'illegal-combat-preview');
  }
  if(action.type==='combat-resolve'){
   // A committed die is mandatory. The UI must roll once at declaration
   // commitment, before consequence choices, as in the Oberlabs workflow.
   const preview=legal(ctx, {...action,type:'combat-preview'});
   if(!preview)return failure(s,'illegal-combat');
   const rec=legacy.resolveAttack(c,next,action.attackers,action.defender,action.die,action.options||{});
   return rec?success(next,rec):failure(s,'combat-rejected');
  }
  return failure(s,'unsupported-action');
 }catch(e){return failure(s,'rejected: '+e.message);}
}
return {PHASE_ACTIONS,legal,execute};
});
