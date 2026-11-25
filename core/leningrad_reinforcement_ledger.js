/* Checkpoint 90 — opt-in Leningrad reinforcement ADJUDICATION LEDGER.
 * Records proposed admission/expiration atomically, with Undo. It never adds
 * historical counters to a board: no slot has a verified counter identity.
 * Source mechanics: Target: Leningrad §§6.0, 11.0 via reinforcement_rules.
 */
(function(root,factory){
 const rules=typeof module==='object'&&module.exports?require('./leningrad_reinforcement_rules.js'):root.WargameLeningradReinforcementRules;
 const api=factory(rules);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameLeningradReinforcementLedger=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(rules){'use strict';
 const copy=x=>JSON.parse(JSON.stringify(x));
 const sides=['german','soviet'];
 const dueIds=(turn,owner)=>rules.due(turn,owner).map(s=>s.slotId);
 function invariant(s){
  if(!s||!Number.isInteger(s.turn)||s.turn<1||s.turn>8||!sides.includes(s.owner)||!Array.isArray(s.placements)||!Array.isArray(s.history)||typeof s.closed!=='boolean')throw Error('Malformed ledger state');
  const ids=dueIds(s.turn,s.owner),seen=new Set();
  for(const p of s.placements){
   if(!p||!ids.includes(p.slotId)||seen.has(p.slotId)||typeof p.hex!=='string'||!/^[0-9]{4}$/.test(p.hex))throw Error('Invalid ledger placement');
   seen.add(p.slotId);
  }
  if(s.closed&&(!s.outcome||!Array.isArray(s.outcome.lostGroundSlotIds)||!Array.isArray(s.outcome.unresolvedSupportSlotIds)))throw Error('Closed ledger lacks expiration outcome');
  if(!s.closed&&s.outcome!==null)throw Error('Open ledger cannot have expiration outcome');
 }
 function controller(raw){
  invariant(raw);const s=copy(raw);
  const snapshot=()=>copy({...s,provisional:true,historicalRosterAuthorized:false,boardStateChanged:false});
  function reject(reason){return {ok:false,reason,ledger:controller(s)};}
  function place({slotId,hex,context}={}){
   if(s.closed)return reject('reinforcement-window-closed');
   if(s.placements.some(p=>p.slotId===slotId))return reject('slot-already-placed');
   // The baseline validator checks current board stacking. A prior proposal
   // in this ledger is not yet on that board; fail closed on cumulative use.
   const pendingSameHex=s.placements.filter(p=>p.hex===hex);
   if(pendingSameHex.length&&context?.canStackWithPending?.(s.owner,hex,pendingSameHex.map(p=>p.slotId),slotId)!==true)return reject('cumulative-stacking-not-verified');
   const validation=rules.validatePlacement({slotId,hex,turn:s.turn,owner:s.owner,context});
   if(!validation.valid)return {ok:false,reason:'placement-illegal',errors:validation.errors,ledger:controller(s)};
   const previous=copy({...s,history:[]});
   const next={...s,placements:[...s.placements,{slotId,hex}],history:[...s.history,previous]};
   return {ok:true,ledger:controller(next),placement:copy({slotId,hex})};
  }
  function close(){
   if(s.closed)return reject('reinforcement-window-closed');
   const result=rules.expiration({turn:s.turn,owner:s.owner,placedSlotIds:s.placements.map(p=>p.slotId)});
   const previous=copy({...s,history:[]});
   const next={...s,closed:true,outcome:copy(result),history:[...s.history,previous]};
   return {ok:true,ledger:controller(next),outcome:copy(result)};
  }
  function undo(){
   if(!s.history.length)return reject('nothing-to-undo');
   const previous=s.history.at(-1);
   return {ok:true,ledger:controller({...previous,history:s.history.slice(0,-1)})};
  }
  return Object.freeze({snapshot,place,close,undo});
 }
 function create({turn,owner}={}){
  dueIds(turn,owner);
  if(!sides.includes(owner))throw Error('Explicit German or Soviet side required');
  return controller({turn,owner,placements:[],closed:false,outcome:null,history:[]});
 }
 return Object.freeze({create});
});
