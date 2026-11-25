/* Target: Leningrad Rules v1.0, §§6.0(6–7), 11.0.
 * Source-derived schedule and proposed reinforcement admission checks only.
 * The unit slots are NOT printed counter identities; do not use this module
 * to bypass the historical roster / deployment-source authorization gates.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameLeningradReinforcementRules=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const slots=[
  [3,'soviet','workers-militia',1,'full','leningrad'],
  [4,'german','infantry-corps',2,'full','entry-edge'],
  [4,'soviet','infantry-army',1,'reduced','entry-edge'],
  [5,'soviet','infantry-army',1,'reduced','entry-edge'],
  [6,'german','air-corps-fk-viii',1,'support','schedule-only'],
  [6,'soviet','infantry-army',1,'reduced','entry-edge'],
  [7,'soviet','infantry-army',2,'full','entry-edge'],
  [8,'soviet','infantry-army',1,'full','entry-edge']
 ].flatMap(([turn,owner,type,count,strength,placement])=>Array.from({length:count},(_,i)=>Object.freeze({slotId:`t${turn}-${owner}-${type}-${i+1}`,turn,owner,type,strength,placement,unitFaceId:null,identityVerified:false})));
 const schedule=Object.freeze(slots);
 function due(turn,owner){if(!Number.isInteger(turn)||turn<1||turn>8)throw Error('Turn must be 1..8');if(owner!==undefined&&!['german','soviet'].includes(owner))throw Error('Invalid side');return Object.freeze(schedule.filter(s=>s.turn===turn&&(!owner||s.owner===owner)));}
 function validatePlacement({slotId,turn,owner,hex,context}={}){
  const slot=schedule.find(s=>s.slotId===slotId);
  if(!slot)throw Error('Unknown reinforcement slot');
  const errors=[];
  if(slot.turn!==turn||slot.owner!==owner)errors.push('Slot is not due for specified side and turn');
  if(slot.placement==='schedule-only'){
   errors.push('Air support arrival requires a separately verified support-track transaction');
  }else if(!context||typeof context!=='object'){
   errors.push('Explicit certified placement context is required');
  }else if(typeof hex!=='string'||!/^[0-9]{4}$/.test(hex)||context.hexExists?.(hex)!==true){
   errors.push('Target is not a certified board hex');
  }else if(slot.placement==='leningrad'){
   // §11.0 special WMM rule: German ZOC does NOT block entry. Only
   // direct German occupation prevents placement; standard edge/stack rules
   // do not override this special reinforcement case.
   if(context.isLeningrad?.(hex)!==true)errors.push('Workers Militia must arrive in Leningrad');
   if(context.enemyOccupies?.(hex)!==false)errors.push('Workers Militia blocked by German occupation');
  }else{
   if(context.friendlyEntryEdge?.(owner,hex)!==true)errors.push('Not a certified friendly entry-edge hex');
   if(context.enemyOccupies?.(hex)!==false)errors.push('Enemy occupies reinforcement hex');
   if(context.enemyZoc?.(owner,hex)!==false)errors.push('Reinforcement entry hex is in enemy ZOC');
   if(context.canStack?.(owner,hex,slot)!==true)errors.push('Reinforcement would violate stacking or stacking is unverified');
  }
  return Object.freeze({valid:errors.length===0,errors,slot,scope:'proposed-placement-only',historicalRosterAuthorized:false,stateChanged:false});
 }
 function expiration({turn,owner,placedSlotIds=[]}={}){
  const scheduled=due(turn,owner);
  if(!Array.isArray(placedSlotIds))throw Error('Explicit attempt and placement arrays required');
  const known=new Set(scheduled.map(s=>s.slotId));
  if(placedSlotIds.some(x=>!known.has(x)))throw Error('Unknown or non-due slot in turn expiration');
  if(new Set(placedSlotIds).size!==placedSlotIds.length)throw Error('Duplicate placements');
  // This is a report, not an instruction to delete game counters.
  const lost=scheduled.filter(s=>s.placement!=='schedule-only'&&!placedSlotIds.includes(s.slotId)).map(s=>s.slotId);
  const pendingSupport=scheduled.filter(s=>s.placement==='schedule-only'&&!placedSlotIds.includes(s.slotId)).map(s=>s.slotId);
  return Object.freeze({lostGroundSlotIds:Object.freeze(lost),unresolvedSupportSlotIds:Object.freeze(pendingSupport),stateChanged:false});
 }
 return Object.freeze({schedule,due,validatePlacement,expiration});
});
