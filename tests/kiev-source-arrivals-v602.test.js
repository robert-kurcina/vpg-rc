'use strict';
/* Checkpoint 368: all six scheduled ground arrivals in an seven-turn no-elective-action campaign. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Campaign=require('../core/historical_campaign_session');
const F=require('./fixtures/kiev-source-opening-v437');
const map=F.map, counterConfig=F.counterConfig;
const profile=require('../maps/movement-configs/kiev.json'), config=require('../maps/phase-configs/kiev.json');
const combatPolicy=require('../maps/combat-configs/kiev.json'), buildupPolicy=require('../maps/buildup-configs/kiev.json'), housekeepingPolicy=require('../maps/housekeeping-configs/kiev.json');
const committed=require('../core/historical_deployment_session').create({map,setupSpec:F.setupSpec,counterConfig,inventory:F.inventory,phaseConfig:config,movementProfile:profile,phaseFactories:{combat:()=>({})},allocation:F.allocation,placements:F.placements}).commit();
const ctx={...committed.opening,map,profile,config,counterConfig,combatPolicy,enableAirSupport:true,buildupPolicy,buildupAllocation:committed.allocation,housekeepingPolicy};
let checks=0;const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++};const yes=(a,m)=>{assert.ok(a,m);checks++};
let session=Campaign.create(ctx), count=0, entries=[], arrivals=[];
function commit(a){session=session.execute(a).session;count++;return session.snapshot();}
while(!session.snapshot().cursor.complete && count<160){
 const snap=session.snapshot(); const phase=snap.phaseId, turn=snap.cursor.turn;
 const key=`${turn}:${phase}`;if(entries.at(-1)!==key)entries.push(key);
 if(snap.phaseKind==='combat'){
  if(snap.combat.status==='air-sea-open')commit({type:'combat',action:{type:'finish-air-sea'}});
  commit({type:'combat',action:{type:'commit-battles',battles:[]}});
  commit({type:'combat',action:{type:'finish-combat'}});
 }else if(snap.phaseKind==='buildup'){
  for(const slot of buildupPolicy.reinforcements.filter(x=>x.owner===snap.actor&&x.turn===turn)){
   const targets=slot.placement==='named-city'?['1701']:buildupPolicy.entryEdge[snap.actor];
   let chosen=null;
   for(const hex of targets){try{session.execute({type:'place-reinforcement',slotId:slot.slotId,hex});chosen=hex;break;}catch(e){if(!/Illegal reinforcement edge|overstacked/.test(e.message))throw e;}}
   yes(chosen,`No legal entry for ${slot.slotId}`);
   const after=commit({type:'place-reinforcement',slotId:slot.slotId,hex:chosen});
   const id=committed.allocation[slot.group][slot.index];
   eq(after.state.units[id].hex,chosen);eq(after.state.units[id].strengthStatus,`printed-${slot.strength}`);
   arrivals.push({turn,slot:slot.slotId,hex:chosen,strength:slot.strength});
  }
  const after=commit({type:'finish-buildup'});

 }else if(snap.phaseKind==='movement'||snap.phaseKind==='special-movement')commit({type:'finish-phase'});
 else if(snap.phaseKind==='housekeeping')commit({type:'finish-housekeeping'});
 else throw Error(phase);
}
const final=session.snapshot();
eq(entries,Array.from({length:7},(_,i)=>['german-buildup','german-movement','german-combat','german-special-movement','soviet-buildup','soviet-special-movement','soviet-combat','soviet-movement','housekeeping'].slice(i===0?2:0).map(p=>`${i+1}:${p}`)).flat());
eq(arrivals.map(x=>x.turn),[2,2,3,3,5,6]);eq(arrivals.map(x=>x.strength),Array(6).fill('full'));eq(final.cursor.complete,true);eq(final.terminal.outcome,'soviet-victory');eq(final.terminal.axisControlledCount,2);eq(Object.keys(final.state.units).length,36);eq(Campaign.restore(session.save(),ctx).snapshot(),final);
const report={checkpoint:368,version:'v602',assertions:checks,entries:entries.length,transactions:count,arrivals,scope:'Source-constrained deterministic opening; no elective movement or combat; not strategic qualification'};
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/kiev-source-arrivals-v602.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
