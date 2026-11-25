'use strict';
const assert=require('node:assert/strict');
const req=p=>require('../'+p);
const Campaign=req('core/historical_campaign_session');
const Auto=req('core/historical_campaign_autoplay');
const opening=req('games/kiev-odessa/experimental-preview/opening-v531.json').contextStart;
const context={...structuredClone(opening),map:req('maps/kiev-odessa-composite-experimental-v531.json'),
 profile:req('maps/movement-configs/kiev-odessa-experimental-v531.json'),
 config:req('maps/phase-configs/kiev-odessa.json'),
 counterConfig:req('maps/counter-configs/kiev-odessa-experimental-v531.json'),
 combatPolicy:req('maps/combat-configs/kiev-odessa-experimental-v531.json'),
 rosterOverlay:req('maps/roster-overlays/kiev-odessa.json'),enableAirSupport:true,
 buildupPolicy:req('maps/buildup-configs/kiev-odessa-experimental-v533.json'),
 buildupAllocation:req('games/kiev-odessa/experimental-preview/allocation-v533.json'),
 housekeepingPolicy:req('maps/housekeeping-configs/kiev-odessa-candidate-v521.json')};
const seed=Number(process.argv[2]||7),variant=process.argv[3]||'standard';
if(variant==='advanced')context.combatPolicy={...context.combatPolicy,crtVariant:'advanced'};
const policy={seed,selectionMode:'seeded',attackSelection:'coverage',maxActions:450,maxCombatsPerPhase:1,maxCombatPhases:14,maxGroundMovesPerPhase:1,maxReinforcementsPerPhase:2,maxFleetMoves:2,maxFleetAttacks:3};
const start=Campaign.create(context);
const original=start.save();
assert.deepEqual(Auto.decide({session:start,context,policy}),Auto.decide({session:start,context,policy}));
assert.deepEqual(start.save(),original);
let lastTurn=0;
const run=Auto.run({session:start,context,policy,onStep:({session,stats})=>{const t=session.snapshot().cursor.turn;if(t!==lastTurn){lastTurn=t;console.error(variant,seed,'turn',t,JSON.stringify(stats));}}});
const final=run.session.snapshot();
const outcomes={};for(const t of run.trace.filter(t=>t.action.action?.type==='resolve-battle')){const o=t.event?.outcome||'unknown';outcomes[o]=(outcomes[o]||0)+1;}
console.log(JSON.stringify({seed,variant,status:run.status,reason:run.reason,detail:run.detail,decision:run.decision,stats:run.stats,actions:run.trace.length,outcomes,terminal:final.terminal?.outcome,phase:final.phaseId}));
assert.equal(run.status,'complete');assert.equal(run.stats.turns,7);assert.equal(final.cursor.complete,true);
assert.deepEqual(Campaign.restore(run.session.save(),context).snapshot(),final);
console.log('PASS deterministic discovery and terminal replay');
