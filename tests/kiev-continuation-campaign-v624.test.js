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
const policy={seed,selectionMode:'seeded',attackSelection:'continuation-pilot',maxActions:450,maxCombatsPerPhase:1,maxCombatPhases:14,maxGroundMovesPerPhase:1,maxReinforcementsPerPhase:2,maxFleetMoves:2,maxFleetAttacks:3};
const start=Campaign.create(context);
const original=start.save();
assert.deepEqual(Auto.decide({session:start,context,policy}),Auto.decide({session:start,context,policy}));
assert.deepEqual(start.save(),original);
let lastTurn=0;
const run=Auto.run({session:start,context,policy,onStep:({session,stats})=>{const t=session.snapshot().cursor.turn;if(t!==lastTurn){lastTurn=t;console.error(variant,seed,'turn',t,JSON.stringify(stats));}}});
const final=run.session.snapshot();
if(run.status==='blocked' && process.argv.includes('--write-audit')){require('node:fs').writeFileSync('rules/audit/kiev-seeded-blocker-v603.json',JSON.stringify({seed,variant,decision:run.decision,snapshot:final,save:run.session.save(),trace:run.trace},null,2)+'\n');}
const oddsDistribution={};
const outcomes={};for(const t of run.trace.filter(t=>t.action.action?.type==='resolve-battle')){const o=t.event?.outcome||'unknown';outcomes[o]=(outcomes[o]||0)+1;const odds=t.event?.die===null?'below-minimum':String(t.event?.odds??'unknown');oddsDistribution[odds]=(oddsDistribution[odds]||0)+1;}
console.log(JSON.stringify({seed,variant,status:run.status,reason:run.reason,detail:run.detail,decision:run.decision,stats:run.stats,actions:run.trace.length,outcomes,oddsDistribution,attackSelection:policy.attackSelection,terminal:final.terminal?.outcome,phase:final.phaseId}));
assert.equal(run.status,'complete');assert.equal(run.stats.turns,7);assert.equal(final.cursor.complete,true);
assert.deepEqual(Campaign.restore(run.session.save(),context).snapshot(),final);
console.log('PASS deterministic discovery and terminal replay');
