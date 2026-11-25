'use strict';
const assert=require('node:assert/strict');
const req=p=>require('../'+p);
const Campaign=req('core/historical_campaign_session');
const Auto=req('core/historical_campaign_autoplay');
const F=require('./fixtures/kiev-source-opening-v437');
const map=F.map, counterConfig=F.counterConfig;
const profile=require('../maps/movement-configs/kiev.json'), config=require('../maps/phase-configs/kiev.json');
const combatPolicy=require('../maps/combat-configs/kiev.json'), buildupPolicy=require('../maps/buildup-configs/kiev.json'), housekeepingPolicy=require('../maps/housekeeping-configs/kiev.json');
const committed=require('../core/historical_deployment_session').create({map,setupSpec:F.setupSpec,counterConfig,inventory:F.inventory,phaseConfig:config,movementProfile:profile,phaseFactories:{combat:()=>({})},allocation:F.allocation,placements:F.placements}).commit();
const ctx={...committed.opening,map,profile,config,counterConfig,combatPolicy,enableAirSupport:true,buildupPolicy,buildupAllocation:committed.allocation,housekeepingPolicy};
const context=ctx;
const seed=Number(process.argv[2]||7),variant=process.argv[3]||'standard';
if(variant==='advanced')context.combatPolicy={...context.combatPolicy,crtVariant:'advanced'};
const policy={seed,selectionMode:'seeded',attackSelection:process.argv[4]||'continuation-pilot',maxActions:1500,maxCombatsPerPhase:Number(process.argv[6]||1),maxCombatPhases:14,maxGroundMovesPerPhase:Number(process.argv[5]||1),maxReinforcementsPerPhase:2,maxFleetMoves:2,maxFleetAttacks:3};
if(process.argv[8]==='operational'){
 policy.phaseScope='operational'; policy.maxActions=5000;
 // A dash requests operational defaults; numeric arguments retain explicit bounds.
 if(!process.argv[5]||process.argv[5]==='-')delete policy.maxGroundMovesPerPhase;
 if(!process.argv[6]||process.argv[6]==='-')delete policy.maxCombatsPerPhase;
 delete policy.maxCombatPhases; delete policy.maxReinforcementsPerPhase;
}
if(process.argv[7]==='mission')policy.missionSeed=seed.toString(16).padStart(32,'0');
const start=Campaign.create(context);
const original=start.save();
assert.deepEqual(Auto.decide({session:start,context,policy}),Auto.decide({session:start,context,policy}));
assert.deepEqual(start.save(),original);
let lastTurn=0; const counts={}, phases=[];
const started=Date.now();
const run=Auto.run({session:start,context,policy,onStep:({session,stats,decision})=>{if(decision.attackDiagnostics){const rows=decision.attackDiagnostics;assert.equal(new Set(rows.map(r=>JSON.stringify(r.battle))).size,rows.length);const tally={};for(const r of rows){counts[r.reason]=(counts[r.reason]||0)+1;tally[r.reason]=(tally[r.reason]||0)+1;}phases.push({turn:session.snapshot().cursor.turn,phase:session.snapshot().phaseId,counts:tally});console.error("diagnostics",JSON.stringify(phases.at(-1)));}const t=session.snapshot().cursor.turn;if(t!==lastTurn){lastTurn=t;console.error(variant,seed,'turn',t,JSON.stringify(stats));}}});
const final=run.session.snapshot();

const oddsDistribution={};
const outcomes={};for(const t of run.trace.filter(t=>t.action.action?.type==='resolve-battle')){const o=t.event?.outcome||'unknown';outcomes[o]=(outcomes[o]||0)+1;const odds=t.event?.die===null?'below-minimum':String(t.event?.odds??'unknown');oddsDistribution[odds]=(oddsDistribution[odds]||0)+1;}
console.log(JSON.stringify({elapsedMs:Date.now()-started,policy,cityControl:final.state.cityControl,counts,phases,seed,variant,status:run.status,reason:run.reason,detail:run.detail,decision:run.decision,stats:run.stats,actions:run.trace.length,outcomes,oddsDistribution,attackSelection:policy.attackSelection,terminal:final.terminal?.outcome,phase:final.phaseId}));
assert.equal(run.status,'complete');assert.equal(run.stats.turns,7);assert.equal(final.cursor.complete,true);
assert.deepEqual(Campaign.restore(run.session.save(),context).snapshot(),final);
console.log('PASS deterministic discovery and terminal replay');
