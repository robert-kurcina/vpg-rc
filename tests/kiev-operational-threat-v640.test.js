'use strict';
const A=require('node:assert/strict'),Auto=require('../core/historical_campaign_autoplay'),Campaign=require('../core/historical_campaign_session'),Catalog=require('../core/historical_campaign_action_catalog');
const F=require('./fixtures/kiev-source-opening-v437');
const map=F.map,counterConfig=F.counterConfig,profile=require('../maps/movement-configs/kiev.json'),config=require('../maps/phase-configs/kiev.json');
const combatPolicy=require('../maps/combat-configs/kiev.json');
const committed=require('../core/historical_deployment_session').create({map,setupSpec:F.setupSpec,counterConfig,inventory:F.inventory,phaseConfig:config,movementProfile:profile,phaseFactories:{combat:()=>({})},allocation:F.allocation,placements:F.placements}).commit();
const ctx={...committed.opening,map,profile,config,counterConfig,combatPolicy,enableAirSupport:true,buildupPolicy:require('../maps/buildup-configs/kiev.json'),buildupAllocation:committed.allocation,housekeepingPolicy:require('../maps/housekeeping-configs/kiev.json')};
let n=0;const ok=(v,m)=>{A.ok(v,m);n++};const eq=(a,b,m)=>{A.deepEqual(a,b,m);n++};
const cursor={...ctx.cursor,turn:3,index:config.phases.findIndex(p=>p.id==='german-movement')};
const c={...ctx,actor:'german',cursor,state:structuredClone(Campaign.create(ctx).snapshot().state)};
const s=Campaign.create(c),snap=s.snapshot(),before=s.save();

const policy={phaseScope:'operational',seed:7};
const options=Catalog.discover({session:s,context:c,enumerateCombinedPlans:false});
const ranked=Auto.rankObjectiveMoves({snapshot:snap,context:c,commands:options.commands,communication:true,operational:true});
ok(ranked.length>0);const t=require('../core/historical_threat_assessment').create(c);
function pressure(state,hex){const count=Object.values(state.units).filter(u=>u.owner===snap.actor&&u.hex===hex&&!u.marker).length;if(!count)return 0;const r=t.assess({state,cursor:snap.cursor,owner:snap.actor,hex});return r.unknownPlans?null:count*Math.min(1,(r.strongest?.odds||0)/6);}
let known=0;
for(const x of ranked){const {unitId,path}=x.action.request;const projected={...snap.state,units:{...snap.state.units,[unitId]:{...snap.state.units[unitId],hex:path.at(-1)}}};const hexes=[...new Set([path[0],path.at(-1)])];const a=hexes.map(h=>pressure(snap.state,h)),b=hexes.map(h=>pressure(projected,h));const expected=[...a,...b].every(Number.isFinite)?a.reduce((x,y)=>x+y,0)-b.reduce((x,y)=>x+y,0):null;eq(x.threatDelta,expected);if(expected!==null)known++;ok(x.score>0);}
ok(known>0);const d=Auto.decide({session:s,context:c,policy});eq(d.action,ranked[0].action);eq(s.save(),before);
console.log('PASS operational comparative movement threat',n,'assertions',known,'known comparisons');
const reliefPolicy={...policy,objectivePolicy:'reserve-relief'};
const reliefRanked=Auto.rankObjectiveMoves({snapshot:snap,context:c,commands:options.commands,communication:true,operational:true,objectivePolicy:'reserve-relief'});
const reliefDecision=Auto.decide({session:s,context:c,policy:reliefPolicy});
ok(reliefRanked.length>0);eq(reliefDecision.action,reliefRanked[0].action);eq(Auto.decide({session:s,context:c,policy:reliefPolicy}),reliefDecision);ok(s.execute(reliefDecision.action).session.snapshot().pendingGround);eq(s.save(),before);
console.log('PASS reserve-relief authoritative selection and deterministic probe',n,'cumulative assertions');
