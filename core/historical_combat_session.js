/* Checkpoint 152 — shared, source-bound, opt-in combat-phase session.
 * Durable action-journal replay with pre-roll commitments and Undo. This is
 * a phase-level engine contract, NOT full historical campaign persistence.
 * Node-only save format; it does not alter the browser or B4M production UI.
 */
'use strict';
const crypto=require('node:crypto');
const Combat=require('./historical_combat_phase');
const FORMAT='wargame-historical-combat-phase';
const VERSION=1,MAX_BYTES=16*1024*1024,MAX_ACTIONS=256;
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function canonical(value){
 const visiting=new WeakSet();
 function walk(x,depth){
  if(depth>64)throw Error('Combat save exceeds nesting limit');
  if(x===null||typeof x==='string'||typeof x==='boolean')return x;
  if(typeof x==='number'&&Number.isFinite(x))return x;
  if(!Array.isArray(x)&&!isObject(x))throw Error('Unsupported combat save value');
  if(visiting.has(x))throw Error('Cyclic combat save value');
  visiting.add(x);
  let y;
  if(Array.isArray(x)){
   if(Object.keys(x).length!==x.length)throw Error('Sparse combat save array');
   y=x.map(v=>walk(v,depth+1));
  }else{
   // Safe own-key assignment; the sorted JSON output is unchanged.
   y=Object.create(null);
   for(const k of Object.keys(x).sort()){
    if(['__proto__','prototype','constructor'].includes(k))throw Error('Forbidden combat save key');
    y[k]=walk(x[k],depth+1);
   }
  }
  visiting.delete(x);return y;
 }
 const result=JSON.stringify(walk(value,0));
 if(Buffer.byteLength(result)>MAX_BYTES)throw Error('Combat save too large');
 return result;
}
const copy=x=>JSON.parse(canonical(x));
const digest=x=>crypto.createHash('sha256').update(canonical(x)).digest('hex');
function exact(x,keys,label){
 if(!isObject(x)||Object.keys(x).length!==keys.length||keys.some(k=>!own(x,k)))
  throw Error('Invalid '+label+' fields');
}
const actions={
 'declare-fleet-attack':['type','faceId'],
 'roll-fleet-attack':['type','die'],
 'finish-air-sea':['type'],
 'commit-battles':['type','battles'],
 'select-battle':['type','defenderHex'],
 'commit-ground-air':['type','faceId'],
 'resolve-battle':['type','die','choices'],
 'commit-fleet-displacement':['type','die','choices','to'],
 'roll-fleet-displacement':['type','die'],
 'finish-combat':['type']
};
function normalizeAction(action){
 if(!isObject(action)||!own(actions,action.type))throw Error('Unsupported combat session action');
 exact(action,actions[action.type],'combat action');
 // Strictly serialize before applying: rejects special JS values and
 // aliased/mutable objects without inventing default decisions.
 return copy(action);
}
function apply(controller,action){
 switch(action.type){
  case 'declare-fleet-attack':return {controller:controller.declareFleetAttack(action.faceId)};
  case 'roll-fleet-attack':{
   const result=controller.resolveFleetAttack(action.die);
   return {controller:result.session,event:result.event};
  }
  case 'finish-air-sea':return {controller:controller.finishAirSea()};
  case 'commit-battles':return {controller:controller.commit(action.battles)};
  case 'select-battle':return {controller:controller.select(action.defenderHex)};
  case 'commit-ground-air':return {controller:controller.commitGroundAir(action.faceId)};
  case 'commit-fleet-displacement':return {controller:controller.commitFleetDisplacement({die:action.die,choices:action.choices,to:action.to})};
  case 'roll-fleet-displacement':{
   const result=controller.rollFleetDisplacement(action.die);
   return {controller:result.session,event:result.event};
  }
  case 'resolve-battle':{
   const result=controller.resolveSelected({die:action.die,choices:action.choices});
   return {controller:result.session,event:result.event};
  }
  case 'finish-combat':{
   const result=controller.finish();return {controller:result.session,event:{nextPhase:result.nextPhase}};
  }
  default:throw Error('Unsupported combat session action');
 }
}
function contextBinding(context){
 if(!isObject(context)||!isObject(context.map)||!isObject(context.profile)||
    !isObject(context.config)||!isObject(context.counterConfig)||!isObject(context.combatPolicy)||
    !isObject(context.cursor)||!isObject(context.state)||typeof context.actor!=='string'||
    typeof context.enableAirSupport!=='boolean')throw Error('Explicit source-bound combat context required');
 if(context.config.scenarioId!==context.combatPolicy.scenarioId||
    context.config.scenarioId!==context.state.scenarioId||
    context.config.scenarioId!==context.cursor.scenarioId)
  throw Error('Combat session scenario mismatch');
 const scope={map:context.map,profile:context.profile,config:context.config,
  counterConfig:context.counterConfig,combatPolicy:context.combatPolicy,
  enableAirSupport:context.enableAirSupport,
  ...(context.rosterOverlay?{rosterOverlay:context.rosterOverlay}:{})};
 const opening={cursor:context.cursor,actor:context.actor,state:context.state};
 return {scopeHash:digest(scope),openingHash:digest(opening)};
}
function replay(context,journal){
 if(!Array.isArray(journal)||journal.length>MAX_ACTIONS)throw Error('Combat action journal limit');
 let controller=Combat.create(context);
 const receipts=[];
 for(const item of journal){
  exact(item,['action','stateHash'],'combat journal entry');
  const action=normalizeAction(item.action);
  if(!/^[0-9a-f]{64}$/.test(item.stateHash))throw Error('Invalid combat journal hash');
  const step=apply(controller,action);controller=step.controller;
  const actual=digest(controller.snapshot());
  if(actual!==item.stateHash)throw Error('Combat journal replay mismatch');
  receipts.push({action,stateHash:actual});
 }
 return {controller,journal:receipts};
}
function session(context,controller,journal,binding){
 // create/restore detach the source once; replay and execute construct private
 // journal arrays from normalized actions. Neither is returned to callers:
 // snapshot, save and event receipts return detached data. Successor sessions
 // can therefore share the source and previous immutable journal entries.
 const source=context;
 const records=journal;
 function snapshot(){return {...controller.snapshot(),actionCount:records.length};}
 function execute(input){
  if(records.length>=MAX_ACTIONS)throw Error('Combat action journal limit');
  const action=normalizeAction(input);
  const result=apply(controller,action);
  const next=[...records,{action,stateHash:digest(result.controller.snapshot())}];
  return Object.freeze({session:session(source,result.controller,next,binding),
   ...(result.event===undefined?{}:{event:copy(result.event)})});
 }
 function undo(){
  if(!records.length)return Object.freeze({ok:false,reason:'nothing-to-undo',session:session(source,controller,records,binding)});
  const {controller:previous,journal:previousRecords}=replay(source,records.slice(0,-1));
  return Object.freeze({ok:true,session:session(source,previous,previousRecords,binding)});
 }
 function save(){
  const payload={format:FORMAT,version:VERSION,scenarioId:source.config.scenarioId,
   bindings:copy(binding),origin:copy({cursor:source.cursor,actor:source.actor,state:source.state}),
   journal:copy(records),finalStateHash:digest(controller.snapshot())};
  return {...payload,integrity:{algorithm:'SHA-256',digest:digest(payload)}};
 }
 return Object.freeze({snapshot,execute,undo,save});
}
function create(context){
 const binding=contextBinding(context),source=copy(context);
 const controller=Combat.create(source);
 return session(source,controller,[],binding);
}
function restore(envelope,context){
 canonical(envelope);
 exact(envelope,['format','version','scenarioId','bindings','origin','journal','finalStateHash','integrity'],'combat save envelope');
 if(envelope.format!==FORMAT||envelope.version!==VERSION||envelope.scenarioId!==context?.config?.scenarioId)
  throw Error('Unsupported combat save scenario/version');
 exact(envelope.integrity,['algorithm','digest'],'combat integrity');
 if(envelope.integrity.algorithm!=='SHA-256'||!/^[0-9a-f]{64}$/.test(envelope.integrity.digest))
  throw Error('Invalid combat checksum');
 const {integrity,...payload}=envelope;
 const actual=digest(payload);
 if(!crypto.timingSafeEqual(Buffer.from(integrity.digest,'hex'),Buffer.from(actual,'hex')))
  throw Error('Combat save checksum mismatch');
 const binding=contextBinding(context);
 exact(envelope.bindings,['scopeHash','openingHash'],'combat bindings');
 if(envelope.bindings.scopeHash!==binding.scopeHash)throw Error('Combat source/configuration mismatch');
 if(envelope.bindings.openingHash!==binding.openingHash||digest(envelope.origin)!==binding.openingHash)
  throw Error('Combat opening state mismatch');
 if(!/^[0-9a-f]{64}$/.test(envelope.finalStateHash))throw Error('Invalid final combat state hash');
 const source=copy(context);
 const {controller,journal}=replay(source,envelope.journal);
 if(digest(controller.snapshot())!==envelope.finalStateHash)throw Error('Combat final replay mismatch');
 return session(source,controller,journal,binding);
}
module.exports=Object.freeze({FORMAT,VERSION,create,restore});
