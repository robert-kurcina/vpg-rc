/* Shared action-session state for human players and solo AI.
 * Routes opt-in generic-hex action sessions through the shared native engine,
 * while preserving the existing live legacy-B4M adapter and save format.
 * A native Node preview does not activate the browser runtime.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameSession=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const actions=(typeof globalThis!=='undefined'&&globalThis.WargameActions)||
 (typeof require==='function'?require('./actions.js'):null);
const copy=value=>JSON.parse(JSON.stringify(value));
const nativeActions=(typeof globalThis!=='undefined'&&globalThis.WargameNativeSessionActions)||
 (typeof require==='function'?require('./native_session_actions.js'):null);
const nativeSave=(typeof globalThis!=='undefined'&&globalThis.WargameNativeSessionSave)||
 (typeof require==='function'?require('./native_session_save.js'):null);
const runtimeFor=engine=>engine==='generic-hex-v1'?nativeActions:engine==='legacy-b4m-v1'?actions:null;
function create({scenarioId,engine='legacy-b4m-v1',config,state,usedUnitIds=[],history=[]}){
 if(!runtimeFor(engine))throw Error('Shared action API unavailable');
 if(!config||!state)throw Error('Session needs a scenario configuration and state');
 if(!Array.isArray(usedUnitIds)||!Array.isArray(history))throw Error('Invalid session metadata');
 const session={scenarioId,engine,config,state:copy(state),usedUnitIds:[...new Set(usedUnitIds)],history:copy(history)};
 context(session); // fail closed on missing/invalid player and phase
 if(engine==='generic-hex-v1')nativeSave.validateSession(session);
 return session;
}
function context(session){
 if(!session||!session.state)throw Error('Missing action session');
 const {scenarioId,engine,config,state}=session;
 const runtime=runtimeFor(engine);if(!runtime)throw Error('Unsupported action engine');
 if(engine==='generic-hex-v1'){
  if(!nativeSave)throw Error('Native engine session unavailable');
  if(config.game.id!==scenarioId)throw Error('Native scenario mismatch');
  nativeSave.validate(config,state);
 }
 const ctx={scenarioId,engine,config,state,actor:state.side,phase:engine==='generic-hex-v1'?'native':state.phase,usedUnitIds:session.usedUnitIds};
 // An innocuous query validates the same phase contract used for commands.
 runtime.legal(ctx,{type:'session-validation'});
 return ctx;
}
function legal(session,request){return runtimeFor(session.engine).legal(context(session),request);}
function execute(session,action){
 const ctx=context(session);
 // A query/preview is not an action and must not create an Undo entry.
 const output=runtimeFor(session.engine).execute(ctx,action);
 if(!output.ok)return {ok:false,session,reason:output.reason};
 if(output.state===session.state)return {ok:true,session,result:output.result};
 const prior={state:copy(session.state),usedUnitIds:[...session.usedUnitIds]};
 const used=action.type==='moscow-relief'?[...session.usedUnitIds,action.oldId,action.shockId]:
  action.type==='move'?[...session.usedUnitIds,action.unitId]:
  action.type==='finish-phase'?[]:[...session.usedUnitIds];
 const next={...session,state:output.state,usedUnitIds:[...new Set(used)],history:[...session.history,prior]};
 return {ok:true,session:next,result:output.result};
}
function undo(session){
 if(!session?.history?.length)return {ok:false,session,reason:'nothing-to-undo'};
 const previous=session.history[session.history.length-1];
 const restored={...session,state:copy(previous.state),usedUnitIds:[...previous.usedUnitIds],history:session.history.slice(0,-1)};
 context(restored);
 return {ok:true,session:restored};
}
function canUndo(session){return Boolean(session?.history?.length);}
// Save only portable state: the scenario's executable config is supplied and
// validated by the application at load time, never trusted from a save file.
const SAVE_FORMAT='wargame-session', SAVE_VERSION=2;
function validateSnapshot(snapshot,config){
 if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))throw Error('Invalid session snapshot');
 if(!Array.isArray(snapshot.state?.units))throw Error('Invalid snapshot units');
 if(!Array.isArray(snapshot.usedUnitIds)||new Set(snapshot.usedUnitIds).size!==snapshot.usedUnitIds.length)
  throw Error('Invalid used-unit tracking');
 const ids=new Set(snapshot.state.units.map(u=>u.id));
 if(ids.size!==snapshot.state.units.length||[...ids].some(id=>typeof id!=='string'))throw Error('Duplicate or invalid unit IDs');
 if(snapshot.usedUnitIds.some(id=>typeof id!=='string'||!ids.has(id)))throw Error('Unknown used-unit ID');
 const engine=(typeof globalThis!=='undefined'&&globalThis.B4MEngine)||
  (typeof require==='function'?require('../legacy/engine'):null);
 if(engine)engine.validate(config,snapshot.state);
}
function serialize(session){
 context(session);
 if(session.engine==='generic-hex-v1')return nativeSave.serialize(session);
 const payload={format:SAVE_FORMAT,version:SAVE_VERSION,scenarioId:session.scenarioId,
  engine:session.engine,state:copy(session.state),usedUnitIds:[...session.usedUnitIds],
  history:copy(session.history)};
 return payload;
}
function restore(payload,{scenarioId,config,engine='legacy-b4m-v1'}){
 if(engine==='generic-hex-v1')return nativeSave.restore(payload,{scenarioId,config},create);
 if(!payload||payload.format!==SAVE_FORMAT||payload.version!==SAVE_VERSION)throw Error('Unsupported session save format');
 if(payload.scenarioId!==scenarioId||payload.engine!==engine)throw Error('Save scenario/engine mismatch');
 if(!Array.isArray(payload.history)||payload.history.length>20000)throw Error('Invalid save history');
 validateSnapshot(payload,config);
 for(const prior of payload.history)validateSnapshot(prior,config);
 const session=create({scenarioId,engine,config,state:payload.state,
  usedUnitIds:payload.usedUnitIds,history:payload.history});
 // Every recorded history entry must also be a legal phase/actor snapshot.
 for(const prior of session.history)context({...session,state:prior.state,usedUnitIds:prior.usedUnitIds});
 return session;
}
return {create,context,legal,execute,undo,canUndo,serialize,restore,SAVE_VERSION};
});
