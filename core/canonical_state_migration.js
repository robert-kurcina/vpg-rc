/* Explicit, reversible historic hex-ID migration for proposed historical states.
 * PREVIEW ONLY. Does not change a board, initialize units, or accept saved games.
 * Designed for the eventual atomic Leningrad canonical-ID activation.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameCanonicalStateMigration=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const clone=v=>JSON.parse(JSON.stringify(v));
 const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
 const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const STATE_KEYS=new Set(['scenarioId','hexIdSpace','units','turn','phase','side','complete']);
 const UNIT_KEYS=new Set(['id','owner','kind','hex','strength','movement','steps','untried','moved','status']);
 // The bounded Leningrad movement pilot uses a different explicit unit shape.
 // Do not relax the general translator for unsupported future combat fields.
 const MOVEMENT_UNIT_KEYS=new Set([...UNIT_KEYS,'class','size','nationality','mp']);
 const MOVEMENT_SNAPSHOT_KEYS=new Set(['cursor','actor','state','usedUnitIds','history']);
 const MOVEMENT_PRIOR_KEYS=new Set(['cursor','actor','state','usedUnitIds']);
 const DRAFT_KEYS=new Set(['scenarioId','state','cursor','history','usedUnitIds']);
 const PRIOR_KEYS=new Set(['state','usedUnitIds']);
 const CURSOR_KEYS=new Set(['scenarioId','turn','index','complete']);
 function keysAllowed(obj,keys,where){
  for(const key of Object.keys(obj))if(!keys.has(key))throw Error(where+': unsupported field '+key+' (possible unconverted hex reference)');
 }
 function validateRecord(record){
  if(!plain(record)||record.schemaVersion!==1||!plain(record.physicalToCanonical)||!plain(record.canonicalToPhysical)||!Array.isArray(record.visualOnly))
   throw Error('Invalid canonical projection registry');
  if(record.activationStatus!=='PREVIEW_ONLY'||!Array.isArray(record.errors)||record.errors.length)throw Error('Only error-free non-production projection registries are supported');
  const f=record.physicalToCanonical,r=record.canonicalToPhysical;
  const entries=Object.entries(f),inverse=Object.entries(r),seen=new Set();
  if(!entries.length||entries.length!==inverse.length)throw Error('Non-bijective coordinate registry');
  for(const [physical,canonical] of entries){
   if(!/^\d{4}$/.test(physical)||!/^\d{4}$/.test(canonical)||!Number(canonical.slice(0,2))||!Number(canonical.slice(2)))throw Error('Invalid coordinate mapping');
   if(seen.has(canonical)||r[canonical]!==physical)throw Error('Non-bijective coordinate registry');
   seen.add(canonical);
  }
  for(const [canonical,physical] of inverse)if(f[physical]!==canonical)throw Error('Non-bijective reverse registry');
  const visual=new Set();
  for(const v of record.visualOnly){
   if(!plain(v)||typeof v.physicalId!=='string'||own(f,v.physicalId)||visual.has(v.physicalId))throw Error('Invalid visual-only cell in registry');
   visual.add(v.physicalId);
  }
  if(entries.length!==record.canonicalCellCount||visual.size!==record.visualOnlyCellCount||entries.length+visual.size!==record.sourceCellCount)
   throw Error('Projection cell count mismatch');
  return {physicalToCanonical:{...f},canonicalToPhysical:{...r},visualOnly:visual};
 }
 function create(record,{scenarioId='leningrad'}={}){
  if(typeof scenarioId!=='string'||!scenarioId)throw Error('Scenario ID is required');
  const mapping=validateRecord(record);
  function translateState(state,{direction,allowUnmarkedLegacy=false,movementUnits=false}={}){
   if(!plain(state)||state.scenarioId!==scenarioId||!plain(state.units))throw Error('Historical state / scenario mismatch');
   keysAllowed(state,STATE_KEYS,'state');
   if(own(state,'turn')&&(!Number.isSafeInteger(state.turn)||state.turn<1))throw Error('Invalid state turn');
   if(own(state,'phase')&&typeof state.phase!=='string')throw Error('Invalid state phase');
   if(own(state,'side')&&typeof state.side!=='string')throw Error('Invalid state actor');
   if(own(state,'complete')&&typeof state.complete!=='boolean')throw Error('Invalid state completion flag');
   const toCanonical=direction==='toCanonical';
   if(!toCanonical&&direction!=='toPhysical')throw Error('Explicit migration direction required');
   const expected=toCanonical?'legacy-physical':'canonical-preview';
   if(state.hexIdSpace!==expected&&!(toCanonical&&allowUnmarkedLegacy&&!own(state,'hexIdSpace')))
    throw Error('State hex-ID namespace mismatch: expected '+expected);
   const map=toCanonical?mapping.physicalToCanonical:mapping.canonicalToPhysical;
   const out=clone(state),unitIds=Object.keys(out.units);
   if(!unitIds.length)throw Error('Historical state requires explicit units');
   for(const id of unitIds){
    const u=out.units[id];
    if(!plain(u)||u.id!==id||typeof u.hex!=='string')throw Error('Malformed unit or missing hex: '+id);
    keysAllowed(u,movementUnits?MOVEMENT_UNIT_KEYS:UNIT_KEYS,'unit '+id);
    // Every retained field must be scalar: nested future hex references must
    // never bypass the migration merely because their parent key is familiar.
    for(const [key,value] of Object.entries(u)){
     if(value!==null&&typeof value==='object')throw Error('Unit '+id+': nested '+key+' requires explicit coordinate-migration support');
     if(typeof value==='function'||typeof value==='undefined')throw Error('Unit '+id+': unsupported '+key+' value');
    }
    const target=map[u.hex];
    if(typeof target!=='string')throw Error('Cannot migrate unit '+id+' at unmapped '+(toCanonical?'physical':'canonical')+' hex '+u.hex);
    u.hex=target;
   }
   out.hexIdSpace=toCanonical?'canonical-preview':'legacy-physical';
   return out;
  }
  function translateDraft(draft,{direction,allowUnmarkedLegacy=false}={}){
   if(!plain(draft)||draft.scenarioId!==scenarioId||!plain(draft.state)||!Array.isArray(draft.history))throw Error('Malformed historical draft');
   keysAllowed(draft,DRAFT_KEYS,'draft');
   if(!plain(draft.cursor)||draft.cursor.scenarioId!==scenarioId)throw Error('Historical draft cursor mismatch');
   keysAllowed(draft.cursor,CURSOR_KEYS,'cursor');
   if(!Number.isSafeInteger(draft.cursor.turn)||draft.cursor.turn<1||!Number.isSafeInteger(draft.cursor.index)||draft.cursor.index<0||typeof draft.cursor.complete!=='boolean')throw Error('Invalid phase cursor');
   if(!Array.isArray(draft.usedUnitIds)||new Set(draft.usedUnitIds).size!==draft.usedUnitIds.length)throw Error('Invalid used-unit IDs');
   const unitIds=new Set(Object.keys(draft.state.units));
   if(draft.usedUnitIds.some(id=>!unitIds.has(id)))throw Error('Used-unit ID not in state');
   if(draft.history.length>20000)throw Error('Historical draft history limit exceeded');
   const opts={direction,allowUnmarkedLegacy};
   const state=translateState(draft.state,opts);
   const history=draft.history.map((prior,i)=>{
    if(!plain(prior)||!plain(prior.state)||!Array.isArray(prior.usedUnitIds))throw Error('Invalid history entry '+i);
    keysAllowed(prior,PRIOR_KEYS,'history entry '+i);
    if(new Set(prior.usedUnitIds).size!==prior.usedUnitIds.length||prior.usedUnitIds.some(id=>!Object.prototype.hasOwnProperty.call(prior.state.units||{},id)))throw Error('Invalid history used-unit IDs '+i);
    return {state:translateState(prior.state,opts),usedUnitIds:[...prior.usedUnitIds]};
   });
   return {...clone(draft),state,history};
  }
  // Actual WargameHistoricalMovementLifecycle.snapshot() shape, not the
  // simplified synthetic draft shape supported by translateDraft(). The
  // pilot's Undo records carry their own cursor and actor; neither may be
  // silently discarded during a migration.
  function translateMovementSnapshot(snapshot,{direction,allowUnmarkedLegacy=false,phaseConfig=null}={}){
   if(!plain(snapshot)||!Array.isArray(snapshot.history)||!plain(snapshot.state))throw Error('Invalid movement snapshot');
   keysAllowed(snapshot,MOVEMENT_SNAPSHOT_KEYS,'movement snapshot');
   if(snapshot.history.length>20000)throw Error('Historical movement history limit exceeded');
   if(!plain(phaseConfig)||phaseConfig.schemaVersion!==1||phaseConfig.scenarioId!==scenarioId||
      !Number.isSafeInteger(phaseConfig.turns)||phaseConfig.turns<1||!Array.isArray(phaseConfig.phases)||
      !phaseConfig.phases.length||!Array.isArray(phaseConfig.players)||!phaseConfig.players.length)
    throw Error('Movement phase configuration mismatch');
   function convert(entry,index){
    if(!plain(entry)||!plain(entry.state))throw Error('Invalid movement snapshot entry '+index);
    keysAllowed(entry,MOVEMENT_PRIOR_KEYS,'movement history entry '+index);
    if(!plain(entry.cursor)||entry.cursor.scenarioId!==scenarioId)throw Error('Movement cursor scenario mismatch '+index);
    keysAllowed(entry.cursor,CURSOR_KEYS,'movement cursor '+index);
    if(!Number.isSafeInteger(entry.cursor.turn)||entry.cursor.turn<1||!Number.isSafeInteger(entry.cursor.index)||entry.cursor.index<0||typeof entry.cursor.complete!=='boolean')
     throw Error('Invalid movement cursor '+index);
    if(entry.cursor.turn>phaseConfig.turns||entry.cursor.index>=phaseConfig.phases.length||
       (entry.cursor.complete&&(entry.cursor.turn!==phaseConfig.turns||entry.cursor.index!==phaseConfig.phases.length-1)))
     throw Error('Movement cursor outside phase configuration '+index);
    if(typeof entry.actor!=='string'||!entry.actor||entry.actor==='system')throw Error('Invalid movement actor '+index);
    if(!phaseConfig.players.includes(entry.actor))throw Error('Unknown movement actor '+index);
    if(!Array.isArray(entry.usedUnitIds)||new Set(entry.usedUnitIds).size!==entry.usedUnitIds.length||
       entry.usedUnitIds.some(id=>typeof id!=='string'||!own(entry.state.units||{},id)||entry.state.units[id]?.owner!==entry.actor))
     throw Error('Invalid movement used-unit IDs '+index);
    const state=translateState(entry.state,{direction,allowUnmarkedLegacy,movementUnits:true});
    return {cursor:clone(entry.cursor),actor:entry.actor,state,usedUnitIds:[...entry.usedUnitIds]};
   }
   const {history:undoRecords,...current}=snapshot;
   const latest=convert(current,'latest');
   const history=undoRecords.map((prior,i)=>convert(prior,i));
   return {...latest,history};
  }
  return Object.freeze({translateState,translateDraft,translateMovementSnapshot,recordStatus:'PREVIEW_ONLY'});
 }
 return Object.freeze({create});
});
