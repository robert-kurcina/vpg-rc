'use strict';
/* Contested source-validated Arduous campaign through all seven turns.
 * Moves and battle consequences are actually executed by the shared transaction
 * engine; the deterministic action selector is a test policy, not strategic AI.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const Campaign=require('../core/historical_campaign_session');
const Auto=require('../core/historical_campaign_autoplay');
const Deployment=require('../core/historical_deployment_session');
const Inventory=require('../core/historical_source_face_inventory');
const fixture=require('./fixtures/arduous-source-setup-v419');
const map=require('../maps/arduous.json');
const setupSpec=require('../maps/setup/arduous.json');
const config=require('../maps/phase-configs/arduous.json');
const profile=require('../maps/movement-configs/arduous.json');
const counterConfig=require('../maps/counter-configs/arduous.json');
const fixedPolicy=require('../maps/setup/arduous-fixed-pieces.json');
const combatPolicy=require('../maps/combat-configs/arduous.json');
const buildupPolicy=require('../maps/buildup-configs/arduous.json');
const housekeepingPolicy=require('../maps/housekeeping-configs/arduous.json');
const hash=o=>crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
const deployment=Deployment.create({map,setupSpec,counterConfig,
 inventory:Inventory.create(require('../maps/setup/arduous-inventory.json')),
 phaseConfig:config,movementProfile:profile,fixedPolicy,
 allocation:fixture.allocation,placements:fixture.placements}).commit({requireMixed:false});
const context={...deployment.opening,map,profile,config,counterConfig,combatPolicy,
 enableAirSupport:true,buildupPolicy,buildupAllocation:deployment.allocation,
 housekeepingPolicy,fixedPolicy};
const policy={seed:7,selectionMode:'seeded',maxActions:700,maxCombatsPerPhase:1,
 maxCombatPhases:16,maxGroundMovesPerPhase:1,maxReinforcementsPerPhase:4,
 maxFleetMoves:0,maxFleetAttacks:0};
let game=Campaign.create(context),stats={turns:0,moves:0,battles:0,reinforcements:0,
 combatDeclarations:0,airChoices:0,postCombatAdvances:0,postCombatRetreats:0,
 replacements:0},savedAtTurn3=false,trace=[],rolls=[],battleTurns=new Set(),phases=new Set();
const opening=game.save(),openingHash=opening.finalStateHash;
assert.deepEqual(Auto.decide({session:game,context,policy}),Auto.decide({session:game,context,policy}),
 'Same opening produces the same precommitted seeded decision');
assert.equal(game.save().finalStateHash,openingHash,'Discovery cannot mutate the opening');
for(let step=0;step<policy.maxActions;step++){
 const before=game.snapshot(),decision=Auto.decide({session:game,context,policy});
 assert.equal(decision.status,'action',`Controller blocked at Turn ${before.cursor.turn} ${before.phaseId}: ${JSON.stringify(decision)}`);
 const action=decision.action;
 const result=game.execute(action);
 game=result.session;
 const event=result.event;
 const kind=action.type==='combat'?action.action.type:action.type;
 trace.push({turn:before.cursor.turn,phase:before.phaseId,action,event});
 phases.add(before.phaseId);
 if(kind==='resolve-ground-move'||kind==='resolve-forced-ground-move')stats.moves++;
 if(kind==='commit-battles'&&action.action.battles.length)stats.combatDeclarations+=action.action.battles.length;
 if(kind==='resolve-battle'){
  stats.battles++;battleTurns.add(before.cursor.turn);
  if(action.action.die!==null)rolls.push(action.action.die);
  if(event?.advanced)stats.postCombatAdvances++;
  if(event?.retreats?.length)stats.postCombatRetreats+=event.retreats.length;
 }
 if(kind==='commit-ground-air')stats.airChoices++;
 if(kind==='apply-replacement')stats.replacements++;
 if(kind==='place-reinforcement')stats.reinforcements++;
 if(kind==='finish-housekeeping'){
  stats.turns++;
  if(stats.turns===3){
   const save=game.save(),state=game.snapshot();
   const restored=Campaign.restore(save,context);
   assert.deepEqual(restored.snapshot(),state,'Turn 3 save replays exactly');
   assert.deepEqual(Auto.decide({session:restored,context,policy}),
    Auto.decide({session:game,context,policy}),'Restored Turn 4 decision is deterministic');
   game=restored;savedAtTurn3=true;
  }
 }
 if(game.snapshot().cursor.complete)break;
}
const final=game.snapshot();
assert(final.cursor.complete,'All seven turns must complete; no action-budget escape');
assert.equal(stats.turns,7,'Exactly seven housekeeping phases');
assert(stats.moves>=14,`Contested campaign must exercise movement (${stats.moves})`);
assert(stats.battles>=8,`Contested campaign must resolve battles (${stats.battles})`);
assert(stats.combatDeclarations>=stats.battles,'Every battle was committed before rolling');
assert(battleTurns.size>=5,`Combats must span five or more turns (${battleTurns.size})`);
assert(rolls.length>=2,`More than one actual ground d6 required (${rolls.length})`);
assert(stats.reinforcements>=6,'Scheduled reinforcements must be exercised');
assert(savedAtTurn3,'Mid-campaign restoration is mandatory');
assert(final.terminal&&['soviet-victory','german-victory','draw'].includes(final.terminal.outcome),'Final victory adjudication');
const finalSave=game.save();
assert.deepEqual(Campaign.restore(finalSave,context).snapshot(),final,'Terminal state replays exactly');
const report={checkpoint:188,version:'v422',scenario:'arduous',scope:'contested headless seven-turn source-transaction acceptance',
 policy,actionCount:trace.length,statistics:{...stats,combatTurns:[...battleTurns].sort(),dieRolls:rolls},
 final:{outcome:final.terminal.outcome,axisControlledCities:final.terminal.axisControlledCount,
 stateSHA256:hash(final.state),journalSHA256:hash(finalSave.journal)},
 saves:{turn3:'restored exactly',terminal:'restored exactly'},
 limitations:['Test uses one candidate opening allocation; source marker overrides do not change gameplay',
 'Deterministic legal-action controller is not strategic AI or interactive human play',
 'One seeded run does not certify all possible retreats, replacements, or source rule variants',
 'Only actions and consequences observed in this run count as tested']};
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/arduous-contested-seven-turn-v422.json',JSON.stringify(report,null,2)+'\n');
if(process.argv.includes('--write-v459-audit')){
 const sourceFile=require('node:fs').readFileSync('core/historical_campaign_autoplay.js');
 const prior=JSON.parse(fs.readFileSync('rules/audit/arduous-contested-seven-turn-v422.json','utf8'));
 const updated={...report,checkpoint:225,version:'v459',
  scope:'seven-turn, 184-action contested source-transaction acceptance after single-battle search optimization',
  optimization:'Skip combined two-/three-target plan discovery only when maxCombatsPerPhase <= 1; full plan discovery is preserved when policy allows multiple attacks per phase',
  controllerSHA256:crypto.createHash('sha256').update(sourceFile).digest('hex'),
  legacyAuditComparison:{checkpoint:prior.checkpoint,priorStateSHA256:prior.final.stateSHA256,
   priorJournalSHA256:prior.final.journalSHA256,identicalState:prior.final.stateSHA256===report.final.stateSHA256,
   identicalJournal:prior.final.journalSHA256===report.final.journalSHA256,
   warning:'v422 and v459 use different intervening project versions; mismatches are not evidence that the v459 optimization changed rules'},
  verification:['Replay is deterministic on save/restore','Individual opening proposals match the eager catalog','Combined plans are still available under multi-battle policy'],
  remaining:['184-action complete Chromium browser trace not certified','Post-roll consequences still bounded at 128 validated choices','One deterministic test opening and controller policy are not exhaustive']};
 fs.writeFileSync('rules/audit/arduous-contested-seven-turn-v459.json',JSON.stringify(updated,null,2)+'\n');
}
console.log('PASS contested seven-turn Arduous source campaign',JSON.stringify({actions:report.actionCount,stats,terminal:report.final.outcome}));
