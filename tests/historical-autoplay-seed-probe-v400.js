'use strict';
const fs=require('node:fs');
const Campaign=require('../core/historical_campaign_session');
const Auto=require('../core/historical_campaign_autoplay');
const Bridge=require('../core/scenario_opening_bridge');
const Inventory=require('../core/leningrad_starting_inventory');
const Fixture=require('./fixtures/leningrad-source-setup-v357');
const map=require('../maps/leningrad.json');
const counterConfig=require('../maps/counter-configs/leningrad.json');
const setup=require('../maps/setup/leningrad.json');
const profile=require('../maps/movement-configs/leningrad.json');
const config=require('../maps/phase-configs/leningrad.json');
const combatPolicy=require('../maps/combat-configs/leningrad.json');
const buildupPolicy=require('../maps/buildup-configs/leningrad.json');
const housekeepingPolicy=require('../maps/housekeeping-configs/leningrad.json');
const clone=x=>JSON.parse(JSON.stringify(x));
const opening=Bridge.create({map,setupSpec:setup,counterConfig,inventory:Inventory,
 allocation:Fixture.selected,placements:Fixture.placements,phaseConfig:config,
 movementProfile:profile,phaseFactories:{combat:()=>({})},supportPolicy:combatPolicy}).snapshot();
const context={...clone(opening),map,profile,config,counterConfig,combatPolicy,
 enableAirSupport:true,buildupPolicy,buildupAllocation:Fixture.selected,housekeepingPolicy};
const seed=Number(process.argv[2]||137);
const extra=process.argv[3]?JSON.parse(process.argv[3]):{};
const policy={seed,maxActions:650,maxCombatsPerPhase:1,maxCombatPhases:2,
 maxGroundMovesPerPhase:1,maxReinforcementsPerPhase:2,maxFleetMoves:1,maxFleetAttacks:2,...extra};
const started=Date.now();
const run=Auto.run({session:Campaign.create(context),context,policy});
const snap=run.session.snapshot();
const combats=run.trace.filter(x=>x.action.action?.type==='resolve-battle').map(t=>({turn:t.turn,die:t.action.action.die,
 choices:t.action.action.choices, event:t.event}));
const out={seed,policy,status:run.status,reason:run.reason,detail:run.detail,actions:run.trace.length,
 stats:run.stats,terminal:snap.terminal,combatCount:combats.length,combats,
 lastActions:run.trace.slice(-4).map(x=>({reason:x.reason,action:x.action})),seconds:Math.round((Date.now()-started)/100)/10};
console.log(JSON.stringify(out));
if(run.status!=='complete')process.exitCode=1;
