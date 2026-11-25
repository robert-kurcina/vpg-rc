'use strict';
/* Checkpoint 166: varied, continuous, reproducible eight-turn candidate campaigns.
 * A fixed seed changes precommitted dice and legal-action selection. This does
 * NOT certify the historical source allocation, strategic AI, or all decisions.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
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
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const opening=Bridge.create({map,setupSpec:setup,counterConfig,inventory:Inventory,
 allocation:Fixture.selected,placements:Fixture.placements,phaseConfig:config,
 movementProfile:profile,phaseFactories:{combat:()=>({})},supportPolicy:combatPolicy}).snapshot();
const context={...clone(opening),map,profile,config,counterConfig,combatPolicy,
 enableAirSupport:true,buildupPolicy,buildupAllocation:Fixture.selected,housekeepingPolicy};
const rows=[],positions=new Set(),journals=new Set(),outcomes=new Set(),battlePhases=new Set();
let savedMid=null;const started=Date.now();
for(const seed of [7,42,901]){
 const policy={seed,selectionMode:'seeded',attackSelection:'coverage',maxActions:650,maxCombatsPerPhase:1,
  maxCombatPhases:12,maxGroundMovesPerPhase:1,maxReinforcementsPerPhase:2,
  maxFleetMoves:1,maxFleetAttacks:2};
 const initial=Campaign.create(context),original=clone(initial.save());
 assert.deepEqual(Auto.decide({session:initial,context,policy}),
  Auto.decide({session:initial,context,policy}),'Seeded action choice must be deterministic');
 assert.deepEqual(initial.save(),original,'Decision discovery must not mutate game state');
 const result=Auto.run({session:initial,context,policy,onStep:({session})=>{
  if(seed===42&&session.snapshot().actionCount===85)savedMid=clone(session.save());
 }});
 assert.equal(result.status,'complete',`Seed ${seed} blocked: ${result.reason}: ${result.detail}`);
 assert.equal(result.session.snapshot().cursor.complete,true);
 assert.equal(result.stats.turns,8);
 assert(result.stats.combats>=8,'Seeded qualification must exercise later-turn ground combat');
 const combats=result.trace.filter(x=>x.action.action?.type==='resolve-battle');
 const rolls=combats.filter(x=>x.action.action.die!==null);
 const turns=[...new Set(combats.map(x=>x.turn))].sort((a,b)=>a-b);
 assert(turns.length>=5,'Ground combat must span at least five turns');
 assert(rolls.length>=3,'Actual source-bound ground combat dice must occur');
 const byOutcome={};for(const c of combats){const outcome=c.event?.outcome||'unknown';byOutcome[outcome]=(byOutcome[outcome]||0)+1;outcomes.add(outcome);}
 const final=result.session.save(),state=result.session.snapshot();
 assert.deepEqual(Campaign.restore(final,context).snapshot(),state,'Final save must replay');
 const record={seed,status:result.status,actions:result.trace.length,stats:result.stats,
  combatTurns:turns,combatOutcomes:byOutcome,combatRolls:rolls.map(c=>c.action.action.die),
  cityCount:state.terminal.axisControlledCount,victory:state.terminal.outcome,
  terminalCityControl:state.terminal.cityControl,
  journalSHA256:hash(final.journal),stateSHA256:hash(state.state)};
 rows.push(record);positions.add(record.stateSHA256);journals.add(record.journalSHA256);
 turns.forEach(x=>battlePhases.add(x));
 console.log('SEED',seed,'actions',record.actions,'combats',combats.length,
  'outcomes',JSON.stringify(byOutcome),'cities',record.cityCount,'seconds',Math.round((Date.now()-started)/1000));
}
assert.equal(positions.size,3,'The terminal unit states must materially differ across seeds');
assert.equal(journals.size,3,'The action journals must differ across seeds');
assert(outcomes.has('EX')&&outcomes.has('DR')&&outcomes.has('DRL')&&outcomes.has('DE'),
 'Campaigns must include four distinct source CRT outcomes');
assert(battlePhases.size>=6,'Combat must extend well beyond Turn 1');
assert(savedMid&&savedMid.journal.length===85,'Mid-campaign seed 42 save required');
const policy42={seed:42,selectionMode:'seeded',attackSelection:'coverage',maxActions:650,maxCombatsPerPhase:1,
 maxCombatPhases:12,maxGroundMovesPerPhase:1,maxReinforcementsPerPhase:2,
 maxFleetMoves:1,maxFleetAttacks:2};
const resume=Auto.run({session:Campaign.restore(savedMid,context),context,policy:policy42});
assert.equal(resume.status,'complete',`Resumed run blocked: ${resume.reason}`);
assert.equal(hash(resume.session.save().journal),rows[1].journalSHA256,'Mid-campaign replay journal must match');
assert.equal(hash(resume.session.snapshot().state),rows[1].stateSHA256,'Mid-campaign replay state must match');
assert.throws(()=>Auto.policyOf({selectionMode:'not-a-mode'}),/Invalid deterministic controller policy/);
const audit={checkpoint:166,version:'v400',scope:'candidate Leningrad eight-turn baseline selector with seeded legal-action variation',
 policy:policy42,runs:rows,completed:rows.filter(x=>x.status==='complete').length,
 uniqueTerminalStates:positions.size,uniqueJournals:journals.size,
 observedCombatOutcomes:[...outcomes].sort(),uniqueCombatTurns:[...battlePhases].sort((a,b)=>a-b),
 midCampaignReplay:'identical journal and final state',
 limitations:['Same source-uncertified candidate counter allocation for all three runs',
 'Seeded legal-action selection is a deterministic test policy, not a strategic AI',
 'All three games may share the same victor despite materially different board states',
 'Only one-battle combat declarations and twelve combat phases permitted by this test policy',
 'Rare unsupported joint retreats and incomplete source identities remain open']};
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/leningrad-autoplay-multiseed-v400.json',JSON.stringify(audit,null,2)+'\n');
console.log('PASS v400 3 varied eight-turn campaigns, outcome diversity, deterministic save and resume',
 'seconds',Math.round((Date.now()-started)/1000));
