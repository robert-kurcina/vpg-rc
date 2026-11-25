'use strict';
/* Checkpoint 361: all scheduled ground arrivals and air arrival in an eight-turn no-elective-action campaign. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Phase=require('../core/phase_runtime');
const Campaign=require('../core/historical_campaign_session');
const Housekeeping=require('../core/historical_housekeeping_phase');
const Buildup=require('../core/historical_buildup_phase');
const Bridge=require('../core/scenario_opening_bridge');
const Inventory=require('../core/leningrad_starting_inventory');
const Fixture=require('./fixtures/leningrad-source-setup-v357');
const map=require('../maps/leningrad.json'),counterConfig=require('../maps/counter-configs/leningrad.json');
const setup=require('../maps/setup/leningrad.json'),profile=require('../maps/movement-configs/leningrad.json');
const config=require('../maps/phase-configs/leningrad.json'),combatPolicy=require('../maps/combat-configs/leningrad.json');
const buildupPolicy=require('../maps/buildup-configs/leningrad.json');
const housekeepingPolicy=require('../maps/housekeeping-configs/leningrad.json');
const clone=x=>JSON.parse(JSON.stringify(x));let checks=0;
const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++};
const yes=(v,msg)=>{assert.ok(v,msg);checks++};
const fail=(fn,pattern)=>{assert.throws(fn,pattern);checks++};
const origin=Bridge.create({map,setupSpec:setup,counterConfig,inventory:Inventory,
 allocation:Fixture.selected,placements:Fixture.placements,phaseConfig:config,
 movementProfile:profile,phaseFactories:{combat:()=>({})},supportPolicy:combatPolicy}).snapshot();
const ctx={...clone(origin),map,profile,config,counterConfig,combatPolicy,
 enableAirSupport:true,buildupPolicy,buildupAllocation:Fixture.selected,housekeepingPolicy};
let session=Campaign.create(ctx), count=0, entries=[], arrivals=[], air=[];
function commit(a){session=session.execute(a).session;count++;return session.snapshot();}
while(!session.snapshot().cursor.complete && count<160){
 const snap=session.snapshot(); const phase=snap.phaseId, turn=snap.cursor.turn;
 const key=`${turn}:${phase}`;if(entries.at(-1)!==key)entries.push(key);
 if(snap.phaseKind==='combat'){
  if(snap.actor==='german')commit({type:'combat',action:{type:'finish-air-sea'}});
  commit({type:'combat',action:{type:'commit-battles',battles:[]}});
  commit({type:'combat',action:{type:'finish-combat'}});
 }else if(snap.phaseKind==='buildup'){
  for(const slot of buildupPolicy.reinforcements.filter(x=>x.owner===snap.actor&&x.turn===turn)){
   const targets=slot.placement==='named-city'?['1701']:buildupPolicy.entryEdge[snap.actor];
   let chosen=null;
   for(const hex of targets){try{session.execute({type:'place-reinforcement',slotId:slot.slotId,hex});chosen=hex;break;}catch(e){if(!/Illegal reinforcement edge|overstacked/.test(e.message))throw e;}}
   yes(chosen,`No legal entry for ${slot.slotId}`);
   const after=commit({type:'place-reinforcement',slotId:slot.slotId,hex:chosen});
   const id=Fixture.selected[slot.group][slot.index];
   eq(after.state.units[id].hex,chosen);eq(after.state.units[id].strengthStatus,`printed-${slot.strength}`);
   arrivals.push({turn,slot:slot.slotId,hex:chosen,strength:slot.strength});
  }
  const after=commit({type:'finish-buildup'});
  if(snap.actor==='german'&&turn===6){eq(after.lastEvent.supportArrivals,['t6-german-air-corps-fk-viii-1']);air.push(turn);}
 }else if(snap.phaseKind==='movement'||snap.phaseKind==='special-movement')commit({type:'finish-phase'});
 else if(snap.phaseKind==='housekeeping')commit({type:'finish-housekeeping'});
 else throw Error(phase);
}
const final=session.snapshot();
eq(entries,Array.from({length:8},(_,i)=>['german-buildup','german-movement','german-combat','german-special-movement','soviet-buildup','soviet-special-movement','soviet-combat','soviet-movement','housekeeping'].slice(i===0?2:0).map(p=>`${i+1}:${p}`)).flat());
eq(arrivals.map(x=>x.turn),[3,4,4,4,5,6,7,7,8]);eq(arrivals.map(x=>x.strength),['full','full','full','reduced','reduced','reduced','full','full','full']);eq(air,[6]);eq(final.cursor.complete,true);eq(final.terminal.outcome,'soviet-victory');eq(final.terminal.axisControlledCount,1);eq(Object.keys(final.state.units).length,28);eq(Campaign.restore(session.save(),ctx).snapshot(),final);
const report={checkpoint:361,version:'v595',assertions:checks,entries:entries.length,transactions:count,arrivals,air,scope:'Source-constrained deterministic opening; no elective movement or combat; not strategic qualification'};
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/leningrad-source-arrivals-v595.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
