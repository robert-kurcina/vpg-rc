/* Leningrad movement-pilot save PREVIEW, version 1.
 * Node-only and opt-in: not a production save loader or canonical activation.
 * All physical/canonical conversions are delegated to the v352 migration adapter.
 */
'use strict';
const crypto=require('node:crypto');
const Migration=require('./canonical_state_migration');
const Phase=require('./phase_runtime');
const FORMAT='wargame-leningrad-movement-preview';
const VERSION=1;
const SPACES=new Set(['legacy-physical','canonical-preview']);
const MAX_BYTES=16*1024*1024;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&
  (Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null);
function exact(o,keys,label){
 if(!plain(o)||Object.keys(o).length!==keys.length||keys.some(k=>!own(o,k)))throw Error('Invalid '+label+' fields');
}
function canonicalJSON(value){
 const seen=new WeakSet();
 function norm(v,depth){
  if(depth>64)throw Error('Save nesting limit');
  if(v===null||typeof v==='string'||typeof v==='boolean')return v;
  if(typeof v==='number'&&Number.isFinite(v))return v;
  if(typeof v!=='object')throw Error('Unsupported save value');
  if(!Array.isArray(v)&&!plain(v))throw Error('Non-plain save object');
  if(seen.has(v))throw Error('Cyclic or reused save object');
  seen.add(v);
  let out;
  if(Array.isArray(v)){
   if(Object.keys(v).length!==v.length)throw Error('Sparse or extended save array');
   out=Array.from(v,x=>norm(x,depth+1));
  }else{
   out={};
   for(const key of Object.keys(v).sort()){
    if(['__proto__','prototype','constructor'].includes(key))throw Error('Forbidden save key');
    Object.defineProperty(out,key,{value:norm(v[key],depth+1),enumerable:true,writable:true,configurable:true});
   }
  }
  seen.delete(v);
  return out;
 }
 const text=JSON.stringify(norm(value,0));
 if(Buffer.byteLength(text,'utf8')>MAX_BYTES)throw Error('Save size limit exceeded');
 return text;
}
const hash=v=>crypto.createHash('sha256').update(canonicalJSON(v)).digest('hex');
const clone=v=>JSON.parse(canonicalJSON(v));
function environment(context){
 if(!plain(context)||!plain(context.map)||!plain(context.movementProfile)||!plain(context.phaseConfig)||!plain(context.projectionRecord))
  throw Error('Explicit board, movement, phase, and projection are required');
 const {map,movementProfile,phaseConfig,projectionRecord}=context;
 if(typeof map.id!=='string'||!map.id.startsWith('leningrad')||movementProfile.id!=='leningrad'||phaseConfig.scenarioId!=='leningrad')
  throw Error('Leningrad save scenario mismatch');
 Phase.validate(phaseConfig);
 const translator=Migration.create(projectionRecord,{scenarioId:'leningrad'});
 if(translator.recordStatus!=='PREVIEW_ONLY')throw Error('Canonical projection is not preview-only');
 return {translator,phaseConfig,fingerprints:{
  boardSHA256:hash(map),movementSHA256:hash(movementProfile),phaseSHA256:hash(phaseConfig),projectionSHA256:hash(projectionRecord)
 }};
}
function normalized(snapshot,namespace,env,{allowUnmarkedLegacy=false}={}){
 if(!SPACES.has(namespace))throw Error('Unsupported hex-ID namespace');
 const opts={phaseConfig:env.phaseConfig};
 let marked;
 if(namespace==='legacy-physical'){
  const canonical=env.translator.translateMovementSnapshot(snapshot,{...opts,direction:'toCanonical',allowUnmarkedLegacy});
  marked=env.translator.translateMovementSnapshot(canonical,{...opts,direction:'toPhysical'});
 }else{
  const physical=env.translator.translateMovementSnapshot(snapshot,{...opts,direction:'toPhysical'});
  marked=env.translator.translateMovementSnapshot(physical,{...opts,direction:'toCanonical'});
 }
 // Undo must never restore a different unit roster; that could manufacture or
 // silently drop formations in a save that otherwise validates syntactically.
 const ids=Object.keys(marked.state.units).sort().join('\0');
 for(const prior of marked.history)if(Object.keys(prior.state.units).sort().join('\0')!==ids)
  throw Error('Movement save history unit roster mismatch');
 // Only the actual movement-pilot lifecycle is serializable. A correctly
 // re-signed payload must not invent an actor/phase combination, skip phases,
 // or masquerade as a completed movement action from arbitrary game state.
 const phases=env.phaseConfig.phases;
 const isOwnedMovement=entry=>{
  const p=phases[entry.cursor.index];
  return !entry.cursor.complete&&p.owner===entry.actor&&
   (p.kind==='movement'||p.kind==='special-movement')&&p.permissions?.includes('move');
 };
 const cursorId=c=>[c.scenarioId,c.turn,c.index,c.complete].join(':');
 for(const prior of marked.history)
  if(!isOwnedMovement(prior)||prior.actor!==marked.actor)
   throw Error('Movement save history phase/actor mismatch');
 if(isOwnedMovement(marked)){
  if(marked.history.some(h=>cursorId(h.cursor)!==cursorId(marked.cursor)))
   throw Error('Movement save history cursor mismatch');
 }else{
  const previous=marked.history.at(-1);
  if(!previous||marked.usedUnitIds.length)
   throw Error('Movement save requires a prior completed movement phase');
  const expected=Phase.advance(env.phaseConfig,previous.cursor,()=>true);
  if(cursorId(marked.cursor)!==cursorId(expected)||
     canonicalJSON(marked.state)!==canonicalJSON(previous.state))
   throw Error('Movement save invalid phase completion transition');
  if(marked.history.some(h=>cursorId(h.cursor)!==cursorId(previous.cursor)))
   throw Error('Movement save history cursor mismatch');
 }
 return marked;
}
function phaseMetadata(snapshot,config){
 const c=snapshot.cursor;
 return {turn:c.turn,index:c.index,phaseId:c.complete?null:config.phases[c.index].id,complete:c.complete,actor:snapshot.actor};
}
function serialize(snapshot,context,{namespace='legacy-physical',allowUnmarkedLegacy=false}={}){
 const env=environment(context);
 const marked=normalized(snapshot,namespace,env,{allowUnmarkedLegacy});
 const payload={format:FORMAT,version:VERSION,scenarioId:'leningrad',kind:'historical-movement-snapshot',
  hexIdSpace:namespace,bindings:env.fingerprints,phase:phaseMetadata(marked,env.phaseConfig),snapshot:marked};
 return {...payload,integrity:{algorithm:'SHA-256',digest:hash(payload)}};
}
function restore(envelope,context,{targetNamespace=null}={}){
 // Validate serializability *before* reading any untrusted fields.
 canonicalJSON(envelope);
 exact(envelope,['format','version','scenarioId','kind','hexIdSpace','bindings','phase','snapshot','integrity'],'save envelope');
 if(envelope.format!==FORMAT||envelope.version!==VERSION||envelope.scenarioId!=='leningrad'||
    envelope.kind!=='historical-movement-snapshot'||!SPACES.has(envelope.hexIdSpace))
  throw Error('Unsupported movement save format/version/namespace');
 exact(envelope.integrity,['algorithm','digest'],'save integrity');
 if(envelope.integrity.algorithm!=='SHA-256'||!/^[a-f0-9]{64}$/.test(envelope.integrity.digest))
  throw Error('Invalid save checksum declaration');
 const {integrity,...payload}=envelope;
 const calculated=hash(payload);
 if(!crypto.timingSafeEqual(Buffer.from(calculated,'hex'),Buffer.from(integrity.digest,'hex')))
  throw Error('Save checksum mismatch');
 const env=environment(context);
 exact(envelope.bindings,['boardSHA256','movementSHA256','phaseSHA256','projectionSHA256'],'save bindings');
 for(const [key,fingerprint] of Object.entries(env.fingerprints))
  if(envelope.bindings[key]!==fingerprint)throw Error('Save incompatible '+key);
 exact(envelope.phase,['turn','index','phaseId','complete','actor'],'save phase');
 const marked=normalized(envelope.snapshot,envelope.hexIdSpace,env);
 if(canonicalJSON(envelope.phase)!==canonicalJSON(phaseMetadata(marked,env.phaseConfig)))
  throw Error('Save phase metadata mismatch');
 if(targetNamespace!==null&&!SPACES.has(targetNamespace))throw Error('Unsupported restore namespace');
 let converted=marked;
 if(targetNamespace&&targetNamespace!==envelope.hexIdSpace){
  converted=env.translator.translateMovementSnapshot(marked,{direction:targetNamespace==='canonical-preview'?'toCanonical':'toPhysical',phaseConfig:env.phaseConfig});
 }
 return {scenarioId:'leningrad',namespace:targetNamespace||envelope.hexIdSpace,snapshot:clone(converted)};
}
function undoPreview(envelope,context){
 const restored=restore(envelope,context);
 const {snapshot,namespace}=restored;
 if(!snapshot.history.length)throw Error('No movement history to undo');
 const {history}=snapshot;
 const previous=history[history.length-1];
 const rewind={...clone(previous),history:clone(history.slice(0,-1))};
 return serialize(rewind,context,{namespace});
}
module.exports=Object.freeze({FORMAT,VERSION,serialize,restore,undoPreview});
