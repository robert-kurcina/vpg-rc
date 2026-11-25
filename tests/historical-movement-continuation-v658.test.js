'use strict';
const A=require('node:assert/strict'),Auto=require('../core/historical_campaign_autoplay');
let n=0;const eq=(a,b)=>{A.deepEqual(a,b);n++};const ok=x=>{A.ok(x);n++};
const move=(id,to,score)=>({action:{type:'declare-ground-move',request:{unitId:id,path:['origin-'+id,to]}},score});
const a=move('a','city',9),b=move('b','city',8),c=move('a','flank',7),d=move('c','other',6);
const ranked=[a,b,c,d],before=JSON.stringify(ranked);
// First A captures the city but blocks B. First B leaves A available for the flank.
const rankNext=(next,pool)=>{ok(pool.every(x=>x.request.unitId!==next.request.unitId));return next===b.action?[{...c,score:7}]:next===a.action?[{...d,score:1}]:[];};
const choose=(extra={})=>Auto.selectMovementContinuation({ranked,project:x=>x,rankNext,...extra});
eq(choose(),b);eq(JSON.stringify(ranked),before);eq(choose({maxFirst:1}),a);eq(choose({maxNext:0}),a);eq(choose({project:()=>null}),a);eq(choose({ranked:[a,c],project:()=>{throw Error('single unit should not project')}}),a);
eq(choose({rankNext:()=>[]}),a);eq(choose({ranked:[]}),undefined);
// Deterministic ties preserve the original candidate ordering.
eq(choose({rankNext:next=>[{score:next===a.action?2:next===b.action?3:0}]}),a);
// Integration on the authoritative Kiev source map and historical movement phase.
const Campaign=require('../core/historical_campaign_session'),Catalog=require('../core/historical_campaign_action_catalog'),F=require('./fixtures/kiev-source-opening-v437');
const map=F.map,counterConfig=F.counterConfig,profile=require('../maps/movement-configs/kiev.json'),config=require('../maps/phase-configs/kiev.json'),combatPolicy=require('../maps/combat-configs/kiev.json');
const committed=require('../core/historical_deployment_session').create({map,setupSpec:F.setupSpec,counterConfig,inventory:F.inventory,phaseConfig:config,movementProfile:profile,phaseFactories:{combat:()=>({})},allocation:F.allocation,placements:F.placements}).commit();
const ctx={...committed.opening,map,profile,config,counterConfig,combatPolicy,enableAirSupport:true,buildupPolicy:require('../maps/buildup-configs/kiev.json'),buildupAllocation:committed.allocation,housekeepingPolicy:require('../maps/housekeeping-configs/kiev.json')};
const context={...ctx,actor:'german',cursor:{...ctx.cursor,turn:3,index:config.phases.findIndex(p=>p.id==='german-movement')},state:structuredClone(Campaign.create(ctx).snapshot().state)};
const session=Campaign.create(context),snapshot=session.snapshot(),saved=session.save();
const policy=Auto.policyOf({phaseScope:'operational',objectivePolicy:'reserve-relief',movementLookahead:true,seed:7});
eq(Auto.policyOf({phaseScope:'operational',objectivePolicy:'reserve-relief'}).movementLookahead,false);
for(const bad of [{movementLookahead:true},{phaseScope:'operational',movementLookahead:true},{phaseScope:'operational',objectivePolicy:'reserve-relief',movementLookahead:'true'}]){A.throws(()=>Auto.policyOf(bad));n++;}
// Independent routes must not invoke speculative transactions.
const independent=[move('a','left',9),move('b','right',8)];
eq(Auto.chooseOperationalMovement({session:{execute:()=>{throw Error('unexpected projection')}},snapshot:{actor:'german',state:{cityControl:{}},usedUnitIds:[],actionCount:0},context:{map:{cells:[]}},ranked:independent,policy}),independent[0]);
const commands=Catalog.discover({session,context}).commands;
const candidates=Auto.rankObjectiveMoves({snapshot,context,commands,communication:true,operational:true,objectivePolicy:policy.objectivePolicy});
ok(new Set(candidates.map(x=>x.action.request.unitId)).size>=2);
const args={session,snapshot,context,ranked:candidates,policy};
const t=performance.now(),selected=Auto.chooseOperationalMovement(args);const elapsed=performance.now()-t;
ok(candidates.includes(selected));eq(Auto.chooseOperationalMovement(args),selected);eq(session.save(),saved);
eq(Auto.chooseOperationalMovement({...args,policy:{...policy,maxGroundMovesPerPhase:1}}),candidates[0]);
eq(Auto.chooseOperationalMovement({...args,policy:{...policy,maxActions:3}}),candidates[0]);
eq(Auto.chooseOperationalMovement({...args,policy:{...policy,objectivePolicy:'baseline'}}),candidates[0]);
eq(Auto.chooseOperationalMovement({...args,policy:{...policy,movementLookahead:false}}),candidates[0]);
const decision=Auto.decide({session,context,policy});eq(decision.action,selected.action);
const moved=session.execute(decision.action).session.execute({type:'resolve-ground-move'}).session;
eq(moved.snapshot().usedUnitIds,[selected.action.request.unitId]);eq(Campaign.restore(moved.save(),context).snapshot(),moved.snapshot());eq(session.save(),saved);
// Projection parity for two successive moves, invalid commands and isolated snapshots.
const samples=commands.filter(a=>a.type==='declare-ground-move').slice(0,12);
const commit=(base,a)=>base.execute(a).session.execute({type:'resolve-ground-move'}).session;
for(const a of samples){
 const real=commit(session,a),view=session.projectGroundMove(a);
 eq(view.snapshot(),real.snapshot());eq(view.canExecuteGroundBatch(samples),real.canExecuteGroundBatch(samples));
 eq(typeof view.execute,'undefined');eq(typeof view.save,'undefined');eq(typeof view.journal,'undefined');
 const detached=view.snapshot();detached.state.units={};eq(view.snapshot(),real.snapshot());
 const follow=samples.find((x,i)=>view.canExecuteGroundBatch(samples)[i]);
 if(follow)eq(view.projectGroundMove(follow).snapshot(),commit(real,follow).snapshot());
}
for(const bad of [null,{type:'finish-phase'},{type:'resolve-forced-ground-move',die:6},{type:'declare-ground-move',request:{unitId:'invalid',path:['0000','0001']}}]){A.throws(()=>session.projectGroundMove(bad));n++;}
eq(session.save(),saved);
const timings={commit:[],projection:[]};
for(const order of [['commit','projection'],['projection','commit']])for(const mode of order){
 const start=performance.now();for(const a of samples){const result=mode==='commit'?commit(session,a):session.projectGroundMove(a);result.snapshot();}
 timings[mode].push(performance.now()-start);
}
console.log('Matched source projection timing, ms',JSON.stringify(timings),'routes',samples.length);
console.log('PASS movement continuation',n,'assertions; source Kiev lookahead',elapsed.toFixed(1),'ms; selected',JSON.stringify(selected.action.request),'greedy',JSON.stringify(candidates[0].action.request));
