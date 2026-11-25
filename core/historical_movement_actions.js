/* Opt-in historical movement -> common phase-action dispatcher.
 * Does not authorize a complete historical game or implement turn completion.
 * The ONLY source of movement legality is movement_binding.move().
 */
(function(root,factory){
 const binding=typeof module==='object'&&module.exports?require('./movement_binding.js'):root.WargameMovementBinding;
 const phases=typeof module==='object'&&module.exports?require('./phase_actions.js'):root.WargamePhaseActions;
 const port=typeof module==='object'&&module.exports?require('./historical_port_support.js'):root.WargameHistoricalPortSupport;
 const territory=typeof module==='object'&&module.exports?require('./territorial_state_transition.js'):root.WargameTerritorialStateTransition;
 const rules=typeof module==='object'&&module.exports?require('./movement_rules.js'):root.WargameMovementRules;
 const api=factory(binding,phases,port,territory,rules);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameHistoricalMovementActions=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(B,X,Port,T,Rules){'use strict';
 function create({map,profile,config,supportPolicy=null,counterConfig=null}){
  if(!config||!map||!profile||config.scenarioId!==profile.id)
   throw Error('Historical movement configuration mismatch');
  const board=B.build(map,profile); // source/hexside certification gates retained
  if(supportPolicy&&supportPolicy.scenarioId!==config.scenarioId)throw Error('Movement support policy mismatch');
  const fleet=Port.create({map,policy:supportPolicy,counterConfig});
  function legalContext(draft,phase,turn){
   return B.context(board,phase,draft.units,turn,draft.territory);
  }
  function territoryValid(ctx){
   return !profile.territorialPolicy||Rules.bessarabiaAnnexation({...ctx,profile}).ok;
  }
  function phaseBinding({cursor,actor,state}){
   if(!state||state.scenarioId!==config.scenarioId||!state.units||Array.isArray(state.units)||typeof state.units!=='object')
    throw Error('Historical movement state mismatch');
   const ids=Object.keys(state.units);
   if(ids.some(id=>!state.units[id]||state.units[id].id!==id))throw Error('Malformed historical units');
   return {config,cursor,actor,state,rules:{move:{
    legal:(draft,request,phase)=>{
     const ctx=legalContext(draft,phase,cursor.turn);
     return territoryValid(ctx)&&Rules.move(ctx,request).ok===true;
    },
    apply:(draft,request,phase)=>{
     const outcome=B.move(board,phase,draft.units,cursor.turn,request,draft.territory);
     if(!outcome.ok)return {ok:false};
     const unit=draft.units[request.unitId];
     if(!unit||outcome.to!==request.path?.at(-1))return {ok:false};
     unit.hex=outcome.to;
     const reaction=fleet.forcedEntry({before:state,after:draft,actor,enteredUnitId:request.unitId,
      choice:request.fleetDisplacement});
     const committed=T.commit({profile,board:board.board,state:reaction.state});
     if(!committed.ok)return {ok:false};
     return {ok:true,state:committed.state,result:{...outcome,fleetDisplacement:reaction.event,
      ...(committed.event?{territoryEvent:committed.event}:{})}};
    }
   }}};
  }
  // Use the ordinary phase guard and its detached inputs once for this
  // read-only batch. Only this trusted movement callback shares the draft.
  function legalBatch(session,requests){
   const binding=phaseBinding(session);let results;
   binding.rules.move.legal=(draft,batch,phase)=>{
    const ctx=legalContext(draft,phase,session.cursor.turn);
    results=Rules.withSearchIndexes(ctx,()=>{
     if(!territoryValid(ctx))return batch.map(()=>false);
     return batch.map(request=>{try{return Rules.move(ctx,request).ok===true;}catch(_){return false;}});
    });
    return true;
   };
   X.legal(binding,'move',requests);
   return results;
  }
  return Object.freeze({
   metadata:board.metadata,legalBatch,
   legal:(session,request)=>X.legal(phaseBinding(session),'move',request),
   execute:(session,request)=>X.execute(phaseBinding(session),'move',request)
  });
 }
 return Object.freeze({create});
});
