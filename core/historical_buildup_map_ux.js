/* Phase-scoped, read-only map affordances for historical buildup/reinforcement.
 * Every highlighted hex and click action comes from the authoritative legal
 * action catalogue. The top-of-stack choice is solely a browser view preference
 * and does not alter the engine's source-validated unit positions or saves.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameHistoricalBuildupMapUX=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const own=(v,k)=>Object.prototype.hasOwnProperty.call(v,k);
 const id=x=>typeof x==='string'&&x.length>0;
 function orderedStack(units,preferredTop=null){
  if(!Array.isArray(units))throw Error('Stack must be a list');
  if(!id(preferredTop)||!units.some(u=>u.id===preferredTop))return [...units];
  return [...units.filter(u=>u.id!==preferredTop),...units.filter(u=>u.id===preferredTop)];
 }
 function nextTop(units,preferredTop=null){
  const stack=orderedStack(units,preferredTop);
  return stack.length>1?stack[stack.length-2].id:null;
 }
 function model({phaseKind,commands=[],units={},mode=null,slotId=null,reserveId=null}={}){
  if(!Array.isArray(commands)||units===null||typeof units!=='object'||Array.isArray(units))throw Error('Invalid buildup map inputs');
  const empty={active:false,mode:null,modes:[],slotId:null,slotIds:[],reserveId:null,reserveIds:[],
   entryHexes:[],repairHexes:[],rebuildHexes:[],entryByHex:{},repairByHex:{},rebuildByHex:{}};
  if(phaseKind!=='buildup')return empty;
  // Avoid trusting policy boundaries alone: enemy occupation, enemy ZOC,
  // stacking and allowance limits are already validated by the catalogue.
  const entry=commands.filter(a=>a?.type==='place-reinforcement'&&id(a.hex)&&id(a.slotId));
  const repair=commands.filter(a=>a?.type==='apply-replacement'&&a.hex===null&&id(a.unitId)&&
   units[a.unitId]?.hex&&units[a.unitId]?.strengthStatus==='printed-reduced');
  const rebuild=commands.filter(a=>a?.type==='apply-replacement'&&id(a.hex)&&id(a.unitId)&&!own(units,a.unitId));
  const slotIds=[...new Set(entry.map(a=>a.slotId))];
  const reserveIds=[...new Set(rebuild.map(a=>a.unitId))];
  const modes=[...(entry.length?['entry']:[]),...(repair.length?['repair']:[]),...(rebuild.length?['rebuild']:[])];
  const chosenMode=modes.includes(mode)?mode:modes[0]||null;
  const chosenSlot=slotIds.includes(slotId)?slotId:slotIds[0]||null;
  const chosenReserve=reserveIds.includes(reserveId)?reserveId:reserveIds[0]||null;
  const maps={entryByHex:{},repairByHex:{},rebuildByHex:{}};
  for(const a of entry)if(a.slotId===chosenSlot)(maps.entryByHex[a.hex]??=[]).push(a);
  for(const a of repair)(maps.repairByHex[units[a.unitId].hex]??=[]).push(a);
  for(const a of rebuild)if(a.unitId===chosenReserve)(maps.rebuildByHex[a.hex]??=[]).push(a);
  return {active:true,mode:chosenMode,modes,slotId:chosenSlot,slotIds,reserveId:chosenReserve,reserveIds,
   entryHexes:Object.keys(maps.entryByHex),repairHexes:Object.keys(maps.repairByHex),
   rebuildHexes:Object.keys(maps.rebuildByHex),...maps};
 }
 function actionAtHex(m,hex,stack=[]){
  if(!m?.active||!id(hex))return null;
  if(m.mode==='entry')return m.entryByHex[hex]?.[0]||null;
  if(m.mode==='rebuild')return m.rebuildByHex[hex]?.[0]||null;
  if(m.mode!=='repair')return null;
  const candidates=m.repairByHex[hex]||[];
  if(!candidates.length)return null;
  // When two units qualify, the top counter is the default (unless a stack
  // contains unrelated units, in which case the sole eligible target wins).
  for(const unit of [...stack].reverse()){
   const action=candidates.find(a=>a.unitId===unit.id);
   if(action)return action;
  }
  return candidates[0];
 }
 function tooltip(m,hex,stack=[]){
  if(!m?.active||!id(hex))return '';
  const repairs=m.repairByHex?.[hex]||[];
  const multi=repairs.length>1;
  const top=actionAtHex({...m,mode:'repair'},hex,stack);
  const instructions=multi?' Two units here can receive replacements. The top counter is selected by default. Click either counter (or Shift-click the hex) to swap the stack order, then click the highlighted hex to repair the new top unit.':'';
  const title=multi?'Eligible for repair: '+repairs.length+' counters. Top target: '+(top?.unitId||'none')+'.'+instructions:
   repairs.length?'One reduced counter is eligible for repair here. Click the highlighted hex to restore it.':'';
  if(m.mode==='entry'&&m.entryByHex?.[hex])return 'Legal reinforcement entry hex '+hex+' for '+m.slotId+'. Click this hex to place the counter.'+instructions;
  if(m.mode==='rebuild'&&m.rebuildByHex?.[hex])return 'Legal replacement rebuild destination '+hex+'. Click to place '+m.reserveId+'.'+instructions;
  return title;
 }
 return Object.freeze({model,orderedStack,nextTop,actionAtHex,tooltip});
});
