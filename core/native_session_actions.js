/* Shared generic-hex gameplay action adapter. No scenario-identity branches.
 * All changes are performed on a detached engine state and committed only after
 * the native rules engine accepts the entire requested action.
 */
(function(root,factory){
 const E=(typeof module==='object'&&module.exports)?require('./engine.js'):root.WargameCore;
 if(!E)throw Error('Native action adapter requires shared engine');
 const api=factory(E);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameNativeSessionActions=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(E){
'use strict';
const copy=x=>JSON.parse(JSON.stringify(x));
const accepted=(state,result)=>({ok:true,state,result});
const rejected=(state,reason)=>({ok:false,state,reason});
const sameBattle=(b,action)=>b.defender===action.defender&&Array.isArray(action.attackers)&&
 b.attackers.length===action.attackers.length&&b.attackers.every(id=>action.attackers.includes(id));
function legal(ctx,request){
 const {config:g,state:s}=ctx,phase=E.currentPhase(g,s);
 if(s.over||!phase)return [];
 const type=request?.type;
 if(type==='session-validation')return [];
 if(type==='declare-battle'&&phase.kind==='combat'&&phase.declarationMode==='simultaneous'&&!s.declarationLocked){
  // The declaration still passes through E.declareCombat, which is authoritative.
  const tmp=copy(s),ids=request.attackers;
  return Array.isArray(ids)&&E.declareCombat(g,tmp,ids,request.defender)?[{type,attackers:ids,defender:request.defender}]:[];
 }
 if(type==='resolve-pending'&&phase.kind==='combat'&&s.declarationLocked&&s.pendingRoll!==null)
  return [{type:'resolve-pending',die:s.pendingRoll}];
 if(type==='finish-redeployment'&&phase.kind==='redeployment')return [{type}];
 if(type==='redeploy-reserve'&&phase.kind==='redeployment')return E.openingRedeploymentOptions(g,s,request.unitId);
 if(type==='finish-setup'&&phase.kind==='setup'){
  try{E.checkSetup(g,s);return [{type:'finish-setup'}];}catch{return [];}
 }
 if(type==='finish-phase'&&(!s.declarations.length||!s.declarationLocked)){
  if(phase.kind==='setup'||phase.kind==='redeployment'||phase.kind==='reinforcement'&&E.reinforcementOptions(g,s).length)return [];
  return [{type:'finish-phase'}];
 }
 if(type==='setup-place'&&phase.kind==='setup')return E.legalSetupPositions(g,s,request.unitId);
 if(type==='place-reinforcement'&&phase.kind==='reinforcement')return E.reinforcementOptions(g,s);
 if(type==='move'&&phase.kind==='move')return E.legalMoves(g,s,request.unitId);
 if(type==='replacement'&&phase.kind==='replacement')return E.replacementOptions(g,s);
 return [];
}
function execute(ctx,action){
 const {config:g,state:s}=ctx,phase=E.currentPhase(g,s),type=action?.type;
 if(!phase||s.over)return rejected(s,'phase-unavailable');
 const next=copy(s);
 try{
  if(type==='setup-place'){
   if(phase.kind!=='setup'||!E.relocateSetup(g,next,action.unitId,action.x,action.y))return rejected(s,'illegal-setup-placement');
   return accepted(next,{type,unitId:action.unitId,x:action.x,y:action.y});
  }
  if(type==='finish-setup'){
   if(phase.kind!=='setup'||!E.finishManualSetup(g,next))return rejected(s,'incomplete-manual-setup');
   return accepted(next,{type,to:E.currentPhase(g,next)?.id});
  }
  if(type==='redeploy-reserve'){
   if(phase.kind==='redeployment'&&s.units.some(u=>u.id===action.unitId&&u.position?.x===action.x&&u.position?.y===action.y)&&
      E.openingRedeploymentOptions(g,s,action.unitId).some(v=>v.x===action.x&&v.y===action.y))
     return accepted(s,{type,unitId:action.unitId,unchanged:true});
   if(phase.kind!=='redeployment'||!E.redeployOpeningUnit(g,next,action.unitId,action.x,action.y))return rejected(s,'illegal-opening-redeployment');
   return accepted(next,{type,unitId:action.unitId,x:action.x,y:action.y});
  }
  if(type==='finish-redeployment'){
   if(phase.kind!=='redeployment'||!E.finishOpeningRedeployment(g,next))return rejected(s,'opening-redeployment-incomplete');
   return accepted(next,{type,to:E.currentPhase(g,next)?.id});
  }
  if(type==='place-reinforcement'){
   if(phase.kind!=='reinforcement'||!E.placeReinforcement(g,next,action.unitId,action.x,action.y))return rejected(s,'illegal-reinforcement');
   return accepted(next,{type,unitId:action.unitId,x:action.x,y:action.y});
  }
  if(type==='declare-battle'){
   if(phase.kind!=='combat'||phase.declarationMode!=='simultaneous'||!Array.isArray(action.attackers)||
      !E.declareCombat(g,next,action.attackers,action.defender))return rejected(s,'illegal-battle');
   return accepted(next,{type,defender:action.defender});
  }
  if(type==='remove-last-battle'){
   if(phase.kind!=='combat'||next.declarationLocked||!next.declarations.length)return rejected(s,'no-removable-declaration');
   const removed=next.declarations.pop();
   next.log.push({turn:next.turn,side:next.side,type:'remove-last-battle',defender:removed.defender});
   return accepted(next,{type,removed});
  }
  if(type==='finish-phase'){
   if(phase.kind==='combat'&&next.declarations.length){
    if(next.declarationLocked)return rejected(s,'combat-resolution-in-progress');
    if(!E.lockDeclarations(g,next))return rejected(s,'lock-rejected');
    const pending=E.previewNextDeclaration(g,next);
    if(!pending)return rejected(s,'committed-roll-unavailable');
    return accepted(next,{type,from:phase.id,to:'combat-resolution',pending});
   }
   if(!E.endPhase(g,next))return rejected(s,'finish-rejected');
   return accepted(next,{type,from:phase.id,to:E.currentPhase(g,next)?.id||'finished',turn:next.turn,side:next.side});
  }
  if(type==='resolve-pending'){
   if(phase.kind!=='combat'||!next.declarationLocked||!next.declarations.length||next.pendingRoll===null)return rejected(s,'no-committed-battle');
   if(action.die!==undefined&&action.die!==null&&action.die!==next.pendingRoll)return rejected(s,'die-mismatch');
   // Dice may only be consumed by the previous commitment or next valid battle.
   const before=next.pendingRoll;
   const record=E.resolveDeclared(g,next,null,action.options||{});
   if(!record)return rejected(s,'combat-choice-rejected');
   let pending=null;
   if(next.declarations.length){pending=E.previewNextDeclaration(g,next);if(!pending)return rejected(s,'next-combat-rejected');}
   else if(!E.endPhase(g,next))return rejected(s,'post-combat-transition-rejected');
   return accepted(next,{type,record,die:before===0?null:before,pending,nextPhase:E.currentPhase(g,next)?.id||'finished'});
  }
  if(type==='combat-preview'){
   // An inspection must not commit a die or create a session history entry.
   if(phase.kind!=='combat'||!Number.isInteger(action.die)||action.die<1||action.die>6)return rejected(s,'illegal-preview');
   const p=E.combatPreview(g,s,action.attackers||[],action.defender,action.die);
   return p?accepted(s,p):rejected(s,'illegal-preview');
  }
  if(type==='move'){
   if(phase.kind!=='move'||!E.move(g,next,action.unitId,action.x,action.y))return rejected(s,'illegal-movement');
   return accepted(next,{type,id:action.unitId,x:action.x,y:action.y});
  }
  if(type==='replacement'){
   if(phase.kind!=='replacement'||!E.applyReplacement(g,next,action.choice||{}))return rejected(s,'illegal-replacement');
   return accepted(next,{type,choice:action.choice});
  }
  return rejected(s,'action-unavailable-in-phase');
 }catch(error){return rejected(s,'rejected: '+error.message);}
}
return {legal,execute};
});
