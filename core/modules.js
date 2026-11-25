/* Named, deterministic rule implementations. No dynamic code from game JSON. */
(function(root,factory){const modules=factory();if(typeof module==='object'&&module.exports)module.exports=modules;root.WargameRuleModules=modules;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const key=(x,y)=>`${x},${y}`;
function reinforce(ctx,e){
 const {g,s,unitAt,enemyZoc,claim,copy}=ctx;
 const u=copy(e.unit&&typeof e.unit==='object'?e.unit:s.units.find(u=>u.id===e.unit));
 if(!u)throw Error('Missing reinforcement '+e.unit);
 const entry=e.entryCells||g.map.cells.filter(h=>h[e.entryTag]).map(h=>[h.x,h.y]);
 const at=entry.find(([x,y])=>g.playable(x,y)&&(!ctx.canOccupy? !unitAt(s,x,y): ctx.canOccupy(g,s,u,x,y))&&(!e.notInEnemyZoc||!enemyZoc(g,s,x,y,e.when.side)));
 if(!at)return {turn:s.turn,side:s.side,type:'reinforcement-unavailable',unit:u.id};
 const existing=s.units.find(v=>v.id===u.id),position={x:at[0],y:at[1]};
 if(existing){if(existing.position)throw Error('Reinforcement already deployed: '+u.id);existing.position=position;existing.strength=e.strength||'full';claim(g,s,existing);}
 else{u.position=position;u.strength=e.strength||'full';s.units.push(u);claim(g,s,u);}
 return {turn:s.turn,side:s.side,type:'reinforcement',unit:u.id,at:position,cost:e.cost??0};
}
function holdOnDR(ctx,e){const c=e.condition||{};return ctx.outcome===c.result&&ctx.defender.strength===c.strength&&(c.cityTypes||[]).includes(ctx.cell?.city);}
function replacementBudget(ctx,e){const {s,weather}=ctx;const config=e.budgets?.[s.side]||e[s.side]||{};
 const w=weather?.name||'clear';const turnVal=config[`turn${s.turn}`];const val=turnVal??config[w]??config.otherwise??config.clear??0;
 if(!Number.isInteger(val)||val<0)throw Error('Invalid replacement budget');return val;
}
function communication(ctx,e,unit){
 const {g,s,neighbors,unitAt,enemyZoc,side}=ctx;
 if(!unit.position)return false;
 const start=g.cells.get(key(unit.position.x,unit.position.y));
 if(!ctx.ignoreCapitalException&&e.capitalException?.side===side&&start?.city===e.capitalException.city)return true;
 const tag=e.entryTags?.[side]||e.edgeTags?.[side]||side+'Replacement';
 const queue=[{...unit.position}],seen=new Set([key(unit.position.x,unit.position.y)]);
 for(let i=0;i<queue.length;i++){
  const a=queue[i],here=g.cells.get(key(a.x,a.y));
  if(here?.[tag])return true;
  for(const n of neighbors(a.x,a.y)){
   const k=key(n.x,n.y);if(!g.playable(n.x,n.y)||seen.has(k))continue;
   const occupant=unitAt(s,n.x,n.y);
   if(occupant&&(occupant.faction||occupant.army)!==side||enemyZoc(g,s,n.x,n.y,side))continue;
   seen.add(k);queue.push({x:n.x,y:n.y});
  }
 }
 return false;
}
function railCanContinue(ctx,e,pos){
 if(ctx.phase?.movementMode!=='rail')return true;
 return !e.stopOnEnemyZoc||!ctx.enemyZoc(ctx.g,ctx.s,pos.x,pos.y,ctx.side);
}
function radialRetreat(ctx,e,d){
 const {g,s,neighbors,distance,unitAt,enemyZoc,unitSide}=ctx;
 if(!d.position)return [];
 const origin={...d.position},required=e.distance??2,zocBudget=e.zocTransitBudget??1;
 const limit=Math.min(g.cells.size,e.maxDepth??16),found=new Map();
 let frontier=[{...origin,cost:0,path:[]}];
 for(let depth=1;depth<=limit&&frontier.length;depth++){
  const next=new Map();
  for(const a of frontier)for(const n of neighbors(a.x,a.y)){
   if(!g.playable(n.x,n.y)||distance(origin.x,origin.y,n.x,n.y)!==depth)continue;
   const occupant=unitAt(s,n.x,n.y);if(occupant&&unitSide(occupant)!==unitSide(d))continue;
   const zoc=enemyZoc(g,s,n.x,n.y,unitSide(d)),cost=a.cost+Number(zoc);
   if(cost>zocBudget)continue;
   const path=a.path.concat({x:n.x,y:n.y}),k=key(n.x,n.y),entry={x:n.x,y:n.y,path,cost};
   if(depth>=required&&(!ctx.canOccupy? !occupant:ctx.canOccupy(g,s,d,n.x,n.y))&&!zoc){
    const prev=found.get(k);if(!prev||cost<prev.cost||(cost===prev.cost&&path.length<prev.path.length))found.set(k,entry);
   }else if(depth<limit){const prev=next.get(k);if(!prev||cost<prev.cost)next.set(k,entry);}
  }
  frontier=[...next.values()];
 }
 const preferred=e.tieBreakByFaction?.[unitSide(d)]??g.rules?.combat?.retreatTieBreakByFaction?.[unitSide(d)];
 return [...found.values()].sort((a,b)=>a.cost-b.cost||a.path.length-b.path.length||(preferred==='x-desc'?b.x-a.x:a.x-b.x)||a.y-b.y);
}
function perUnitTerrainFactor(ctx,e,strength){
 let value=strength;
 if(ctx.acrossFeature(e.majorRiverFeature))value=Math.floor(value*e.majorRiverMultiplier);
 if(ctx.cell?.terrain===e.swampTerrain&&(e.swampTankTypes||[]).includes(ctx.unit.type))value*=e.swampTankMultiplier;
 return value;
}
function turnAttackerFactor(ctx,e,strength){
 return ctx.s.side===e.side&&(e.unitTypes||[]).includes(ctx.unit.type)?strength*(e.multiplierByTurn?.[ctx.s.turn]??1):strength;
}
function firstTurnAllowed(ctx,e){
 const {s,attacker,initial,cell}=ctx;
 if(s.turn!==1)return true;
 const matches=(list)=>!!initial&&(list||[]).some(([x,y])=>initial.x===x&&initial.y===y);
 if(s.side===e.noAttack.side&&matches(e.noAttack.initialHexes))return false;
 if(s.side===e.borderDefense.side&&cell?.region===e.borderDefense.targetRegion&&
    !matches(e.borderDefense.allowedInitialHexes))return false;
 return true;
}
return Object.freeze({
 'reinforcement-event-v1':Object.freeze({onSideStart:reinforce}),
 'scheduled-reinforcement-v1':Object.freeze({onSideStart:reinforce}),
 'defender-holds-on-retreat-v1':Object.freeze({onCombatResult:holdOnDR}),
 'replacement-budget-v1':Object.freeze({onReplacementBudget:replacementBudget}),
 'communication-path-v1':Object.freeze({onCommunication:communication}),
 'retreat-radial-zoc-v1':Object.freeze({onRetreatOptions:radialRetreat}),
 'rail-path-zoc-v1':Object.freeze({canContinueMove:railCanContinue}),
 'stacking-capacity-v1':Object.freeze({version:1}),
 'counter-state-v1':Object.freeze({version:1}),
 'attacker-hexside-cap-v1':Object.freeze({version:1}),
 'stacked-battle-v1':Object.freeze({version:1,maxDefenders:2}),
 'per-unit-terrain-factors-v1':Object.freeze({attackerFactor:perUnitTerrainFactor}),
 'turn-attack-multiplier-v1':Object.freeze({attackerFactor:turnAttackerFactor}),
 'first-turn-combat-restrictions-v1':Object.freeze({allowedAttack:firstTurnAllowed}),
 'air-support-v1':Object.freeze({version:1})
});
});
