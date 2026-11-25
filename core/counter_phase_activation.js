/* Shared, read-only activation indicators for the two browser game controllers.
 * This is presentation state derived from authoritative, phase-scoped engine
 * transactions. Never alter counter colors, strength, legality, or saves.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameCounterPhaseActivation=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const isId=id=>typeof id==='string'&&id.length>0;
 function native(snapshot,phase){
  const ids=new Set();if(!snapshot||!phase||snapshot.over)return ids;
  if(phase.kind==='move')for(const id of snapshot.moved||[])if(isId(id))ids.add(id);
  if(phase.kind==='combat')for(const id of snapshot.committed||[])if(isId(id)&&!id.startsWith('def:'))ids.add(id);
  if(phase.kind==='replacement')for(const e of snapshot.log||[]){
   if(e?.type==='replacement'&&e.turn===snapshot.turn&&e.side===snapshot.side&&isId(e.unit))ids.add(e.unit);
  }
  if(phase.kind==='redeployment')for(const e of snapshot.log||[]){
   if(e?.type==='opening-redeployment'&&isId(e.unit))ids.add(e.unit);
  }
  return ids;
 }
 const boundary=a=>a?.type==='finish-phase'||a?.type==='finish-buildup'||a?.type==='finish-housekeeping'||
  a?.type==='combat'&&a.action?.type==='finish-combat';
 function historical(snapshot,journal=[],slotFaces={}){
  const ids=new Set();if(!snapshot||snapshot.cursor?.complete||!isId(snapshot.phaseKind))return ids;
  if(['movement','special-movement','naval-operations','tank-movement','rail-movement'].includes(snapshot.phaseKind)){
   for(const id of snapshot.usedUnitIds||[])if(isId(id))ids.add(id);
  }
  if(snapshot.phaseKind==='combat'){
   // Declared/selected combat does NOT mark a unit; only a resolved outcome does.
   for(const result of snapshot.combat?.resolved||[])
    for(const id of result?.battle?.attackers||[])if(isId(id))ids.add(id);
  }
  if(snapshot.phaseKind==='buildup'){
   // The journal is source-validated by the campaign session, including Undo
   // and save/restore. Stop at the previous phase boundary.
   for(let i=journal.length-1;i>=0;i--){const a=journal[i]?.action;
    if(boundary(a))break;
    if(a?.type==='apply-replacement'&&isId(a.unitId))ids.add(a.unitId);
    if(a?.type==='place-reinforcement'&&isId(slotFaces[a.slotId]))ids.add(slotFaces[a.slotId]);
   }
  }
  return ids;
 }
 return Object.freeze({native,historical});
});
