'use strict';
/* Checkpoint 165: controller-selected, source-validated eight-turn candidate
 * Leningrad campaign. This is not historical setup or strategic AI signoff. */
const assert=require('node:assert/strict'),fs=require('node:fs');
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
const policy={attackSelection:'coverage',seed:Number(process.env.SEED||137),maxActions:650,maxCombatsPerPhase:1,
 maxCombatPhases:2,maxGroundMovesPerPhase:1,maxReinforcementsPerPhase:2,maxFleetMoves:1,maxFleetAttacks:2};
let emitted=0;const started=Date.now();let midCampaignSave=null;
const result=Auto.run({session:Campaign.create(context),context,policy,onStep:({session,decision,stats})=>{
 emitted++;
 if(emitted===85)midCampaignSave=clone(session.save());
 if(process.env.DEBUG_AUTOPLAY&&emitted%10===0)console.log('step',emitted,session.snapshot().phaseId,session.snapshot().cursor.turn,decision.reason,stats);
}});
console.log('AUTOPLAY',result.status,result.reason||'',result.detail||'',
 'actions',result.trace.length,'stats',result.stats,'seconds',((Date.now()-started)/1000).toFixed(2));
if(result.status==='blocked'){
 console.log('BLOCKED_DECISION',JSON.stringify(result.decision));
 const tail=result.trace.slice(-5).map(t=>({turn:t.turn,reason:t.reason,action:t.action}));
 console.log('LAST_ACTIONS',JSON.stringify(tail));
 process.exitCode=1;
}else{
 const end=result.session.snapshot();
 assert.equal(result.status,'complete');assert.equal(end.cursor.complete,true);
 assert.equal(result.stats.turns,8);
 assert(result.stats.combats>=1,'Controller must resolve actual battle');
 assert(result.stats.moves>=1,'Controller must execute real movement');
 assert(result.stats.reinforcements>=1,'Controller must perform historical buildup');
 const saved=result.session.save();
 assert(midCampaignSave&&midCampaignSave.journal.length===85,'A mid-campaign checkpoint was captured');
 const resumed=Auto.run({session:Campaign.restore(midCampaignSave,context),context,policy});
 assert.equal(resumed.status,'complete','Restored controller must finish the game');
 assert.deepEqual(resumed.session.save(),saved,'Resumed decisions and dice must replay identically');
 assert.deepEqual(Campaign.restore(saved,context).snapshot(),end,'complete campaign replay');
 assert.deepEqual(result.session.undo().session.execute({type:'finish-housekeeping'}).session.snapshot(),end);
 assert.throws(()=>Auto.policyOf({maxActionzz:5}),/Unknown controller policy/);
 assert.equal(Auto.dieFor(policy.seed,{cursor:{turn:1},phaseId:'german-combat',actionCount:7},'ground'),
  Auto.dieFor(policy.seed,{cursor:{turn:1},phaseId:'german-combat',actionCount:7},'ground'));
 const audit={checkpoint:165,version:'v399',result:'candidate eight-turn autoplay completed',
  actions:result.trace.length,stats:result.stats,policy,terminal:end.terminal,
  limitations:['Candidate unit allocation is not a historical source certification',
   'Deterministic baseline selector is not strategic AI','Any unsupported legal decision fails closed',
   'No Oberlabs UX equivalence claimed']};
 if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/leningrad-autoplay-eight-turn-v399.json',JSON.stringify(audit,null,2)+'\n');
 console.log('PASS v399 controller-directed eight-turn candidate campaign');
}
