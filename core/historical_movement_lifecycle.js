/* Opt-in historical movement-phase lifecycle. No setup/combat/build-up/victory
 * adjudication, no production session cutover. Source rules: Leningrad §9.0
 * (any or all eligible units may move, stop voluntarily), §9.4 (separate
 * special movement phase). Eligibility uses the certified movement binding.
 *
 * restoreSnapshot() is an isolated movement-pilot seam for already validated
 * saves. It is NOT a production loader and never authorizes unsupported phases.
 */
(function(root,factory){
 const H=typeof module==='object'&&module.exports?require('./historical_movement_actions.js'):root.WargameHistoricalMovementActions;
 const P=typeof module==='object'&&module.exports?require('./phase_runtime.js'):root.WargamePhaseRuntime;
 const X=typeof module==='object'&&module.exports?require('./phase_actions.js'):root.WargamePhaseActions;
 const api=factory(H,P,X);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameHistoricalMovementLifecycle=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(H,P,X){'use strict';
 const clone=v=>JSON.parse(JSON.stringify(v));
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const movementPhase=phase=>phase&&(phase.kind==='movement'||phase.kind==='special-movement')&&phase.permissions?.includes('move');
 const cursorKey=c=>[c.scenarioId,c.turn,c.index,c.complete].join(':');
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function verifyMovement(s,config){
  const phase=P.current(config,s.cursor);
  if(!phase||!movementPhase(phase))throw Error('Only movement-phase pilot supported');
  if(phase.owner!==s.actor)throw Error('Wrong phase actor');
  if(s.state?.scenarioId!==config.scenarioId||!s.state.units||Array.isArray(s.state.units)||typeof s.state.units!=='object')throw Error('Historical state mismatch');
  if(!Array.isArray(s.usedUnitIds)||new Set(s.usedUnitIds).size!==s.usedUnitIds.length||s.usedUnitIds.some(id=>!own(s.state.units,id)||s.state.units[id].owner!==s.actor))throw Error('Invalid used-unit tracking');
  if(!Array.isArray(s.history))throw Error('Invalid history');
  if(Object.entries(s.state.units).some(([id,u])=>!u||u.id!==id||typeof u.hex!=='string'||typeof u.owner!=='string'))throw Error('Malformed historical units');
 }
 // Save.restore() does the strict format/namespace/fingerprint verification;
 // this independently checks that the resulting snapshot is a reachable shape
 // for the bounded movement controller. Historical path replay is impossible
 // from a snapshot alone, because earlier paths were not recorded.
 function verifyRestored(s,config){
  if(!s||typeof s!=='object'||Array.isArray(s)||!['cursor','actor','state','usedUnitIds','history'].every(k=>own(s,k))||Object.keys(s).length!==5)
   throw Error('Invalid restored movement snapshot fields');
  if(!Array.isArray(s.history))throw Error('Invalid restored movement history');
  const phase=P.current(config,s.cursor);
  const inMovement=Boolean(movementPhase(phase)&&phase.owner===s.actor);
  if(!inMovement){
   if(!s.history.length||s.usedUnitIds.length!==0)throw Error('Restored phase is not a supported movement transition');
   const before=s.history.at(-1);
   verifyMovement({...before,history:[]},config);
   const next=P.advance(config,before.cursor,()=>true);
   if(cursorKey(next)!==cursorKey(s.cursor)||s.actor!==before.actor||!same(s.state,before.state))
    throw Error('Invalid restored post-movement transition');
  }else verifyMovement(s,config);
  const records=inMovement?s.history:s.history.slice(0,-1);
  const finalMovement=inMovement?s:s.history.at(-1);
  const roster=Object.keys(s.state.units).sort();
  if(records.length!==finalMovement.usedUnitIds.length)throw Error('Restored movement history length mismatch');
  for(let i=0;i<records.length;i++){
   const h=records[i];
   if(!h||typeof h!=='object'||Array.isArray(h)||!['cursor','actor','state','usedUnitIds'].every(k=>own(h,k))||Object.keys(h).length!==4)
    throw Error('Invalid restored movement history entry');
   verifyMovement({...h,history:[]},config);
   if(cursorKey(h.cursor)!==cursorKey(finalMovement.cursor)||h.actor!==s.actor||h.usedUnitIds.length!==i||
      !same(Object.keys(h.state.units).sort(),roster))throw Error('Restored movement history progression mismatch');
   const after=i+1<records.length?records[i+1]:finalMovement;
   if(after.usedUnitIds.length!==i+1||!h.usedUnitIds.every((id,j)=>id===after.usedUnitIds[j]))
    throw Error('Restored movement used-unit progression mismatch');
   const changed=roster.filter(id=>h.state.units[id].hex!==after.state.units[id].hex);
   const newUnit=after.usedUnitIds[i];
   if(changed.length!==1||changed[0]!==newUnit||
      !roster.every(id=>{
       const before=clone(h.state.units[id]),afterUnit=clone(after.state.units[id]);
       delete before.hex;delete afterUnit.hex;
       return same(before,afterUnit);
      }))throw Error('Restored movement state progression mismatch');
   const priorState=clone(h.state),nextState=clone(after.state);
   delete priorState.units;delete nextState.units;
   if(!same(priorState,nextState))throw Error('Restored movement state metadata mismatch');
  }
  if(!same(Object.keys(finalMovement.state.units).sort(),roster))
   throw Error('Restored movement roster mismatch');
 }
 function instantiate({map,profile,config},initial){
  const pilot=H.create({map,profile,config});
  function controller(s){
   const frozen=clone(s);
   function snapshot(){return clone(frozen);}
   function move(request){
    verifyMovement(frozen,config);
    if(!request||typeof request.unitId!=='string'||frozen.usedUnitIds.includes(request.unitId))return {ok:false,reason:'already-moved-or-invalid',session:controller(frozen)};
    const outcome=pilot.execute({cursor:frozen.cursor,actor:frozen.actor,state:frozen.state},request);
    if(!outcome.ok)return {ok:false,reason:outcome.reason,session:controller(frozen)};
    const previous={cursor:frozen.cursor,actor:frozen.actor,state:frozen.state,usedUnitIds:frozen.usedUnitIds};
    const next={...frozen,state:outcome.state,usedUnitIds:[...frozen.usedUnitIds,request.unitId],history:[...frozen.history,previous]};
    verifyMovement(next,config);
    return {ok:true,session:controller(next),result:outcome.result};
   }
   function finish(){
    verifyMovement(frozen,config);
    const transition=X.finish({config,cursor:frozen.cursor,actor:frozen.actor,state:frozen.state,rules:{},complete:(_state,phase)=>movementPhase(phase)});
    const previous={cursor:frozen.cursor,actor:frozen.actor,state:frozen.state,usedUnitIds:frozen.usedUnitIds};
    const next={...frozen,cursor:transition.cursor,usedUnitIds:[],history:[...frozen.history,previous]};
    return {ok:true,session:controller(next),nextPhase:P.current(config,next.cursor)?.id??null};
   }
   function undo(){
    if(!frozen.history.length)return {ok:false,reason:'nothing-to-undo',session:controller(frozen)};
    const previous=frozen.history.at(-1);
    return {ok:true,session:controller({...previous,history:frozen.history.slice(0,-1)})};
   }
   return Object.freeze({snapshot,move,finish,undo});
  }
  return controller(initial);
 }
 function create({map,profile,config,cursor,actor,state}){
  if(!cursor||!actor||!state)throw Error('Explicit external setup and phase cursor required');
  const snapshot={cursor:clone(cursor),actor,state:clone(state),usedUnitIds:[],history:[]};
  verifyMovement(snapshot,config);
  return instantiate({map,profile,config},snapshot);
 }
 function restoreSnapshot({map,profile,config,snapshot}){
  // Caller must first call the versioned save validator. This method is an
  // opt-in, Node movement-pilot continuation, not a historical game loader.
  verifyRestored(snapshot,config);
  return instantiate({map,profile,config},snapshot);
 }
 return Object.freeze({create,restoreSnapshot});
});
