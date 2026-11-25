'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const Campaign=require('../core/historical_campaign_session');
const Human=require('../core/historical_campaign_human');
const Bridge=require('../core/scenario_opening_bridge');
const Setup=require('../core/scenario_starting_setup');
const Inventory=require('../core/leningrad_starting_inventory');
const Fixture=require('./fixtures/leningrad-source-setup-v357');
const map=require('../maps/leningrad.json');
const counters=require('../maps/counter-configs/leningrad.json');
const setup=require('../maps/setup/leningrad.json');
const profile=require('../maps/movement-configs/leningrad.json');
const config=require('../maps/phase-configs/leningrad.json');
const combatPolicy=require('../maps/combat-configs/leningrad.json');
const buildupPolicy=require('../maps/buildup-configs/leningrad.json');
const housekeepingPolicy=require('../maps/housekeeping-configs/leningrad.json');
const copy=x=>JSON.parse(JSON.stringify(x));
const opening=Bridge.create({map,setupSpec:setup,counterConfig:counters,inventory:Inventory,
 allocation:Fixture.selected,placements:Fixture.placements,phaseConfig:config,
 movementProfile:profile,phaseFactories:{combat:()=>({})},supportPolicy:combatPolicy}).snapshot();
const context={...copy(opening),map,profile,config,counterConfig:counters,combatPolicy,
 enableAirSupport:true,buildupPolicy,buildupAllocation:Fixture.selected,housekeepingPolicy};
let assertions=0;
const ok=(condition,message)=>{assert(condition,message);assertions++;};
const equal=(a,b,message)=>{assert.deepEqual(a,b,message);assertions++;};
const throws=(fn,regex)=>{assert.throws(fn,regex);assertions++;};
const initial=Campaign.create(context);
const setupAudit=Setup.validate({map,spec:setup,counterConfig:counters,
 inventory:Inventory,allocation:Fixture.selected,placements:Fixture.placements});
ok(setupAudit.valid,'source-marker initial placement validity');
ok(!setupAudit.historicalSetupAuthorized,'candidate starting identities not certified');
equal(setupAudit.printedAnchorDisagreements.map(x=>x.rulebookPrintedHex).sort(),['1305','1701'],
 'do not erase two source printed-coordinate conflicts');
let human=Human.create({session:initial,context});
const firstSave=human.save();
equal(Human.restore(copy(firstSave),context).snapshot(),human.snapshot(),'opening restore');
const openingWindow=human.view();
if(openingWindow.commands.some(x=>x.action?.type==='finish-air-sea')) human=human.choose(openingWindow.commands.find(x=>x.action.type==='finish-air-sea'));
const openingPhaseSave=human.save();
const openingChoices=human.view();
ok(openingChoices.kind==='action-choice','action choice at opening');
ok(openingChoices.proposals.length>0,'real opening battle proposals');
throws(()=>human.roll(3),/No source-authorized die/);
throws(()=>human.choose({type:'finish-phase'}),/absent from current legal/);
throws(()=>human.choose({type:'combat',action:{type:'commit-battles',battles:[
 {defenderHex:'9999',attackers:['fake']}]}}),/absent from current legal/);
equal(human.save(),openingPhaseSave,'read-only illegal choices');
const battle=openingChoices.proposals[0];
const declared={type:'combat',action:{type:'commit-battles',battles:[battle]}};
human=human.choose(declared);
ok(human.snapshot().combat.status==='committed','human committed battle');
const selected=human.view().commands.find(a=>a.action?.type==='select-battle');
ok(Boolean(selected),'select-battle supplied by catalog');
human=human.choose(selected);
ok(human.snapshot().combat.status==='battle-selected','battle is selected');
let air=human.view().commands.find(a=>a.action?.type==='commit-ground-air'&&a.action.faceId===null);
if(air)human=human.choose(air);
const beforeDie=human.save(),r=human.view();
ok(r.prompts.some(x=>x.type==='resolve-battle'),'die prompt follows battle/air commitment');
throws(()=>human.choose({type:'combat',action:{type:'resolve-battle',die:1,choices:{}}}),/absent from current legal/);
const seen=[];
for(const die of [null,1,2,3,4,5,6]){
 try{
  const rolled=human.roll(die);seen.push({die,rolled});
 }catch(e){ok(/automatic NE|No authorized post-roll choices|No die is rolled|Commit|die/.test(e.message),
  'invalid CRT roll must reject with explanatory error: '+e.message);}
}
ok(seen.length>=1,'one permitted post-roll die');
const chosen=seen[0];
const committed=chosen.rolled;
ok(committed.view().kind==='post-roll-choice','result-dependent choices shown only after roll commit');
ok(committed.hasPendingRoll(),'Human gateway reports a committed die without enumerating legal choices');
throws(()=>committed.autoplayStep(),/Finish the committed human die/);
ok(!human.hasPendingRoll(),'Pre-roll state is eligible for AI handoff');
const detail=committed.view();
ok(detail.options.length+detail.fleetCommitments.length>0,'validated consequence choices');
throws(()=>committed.roll(6),/already committed/);
throws(()=>committed.choose({type:'combat',action:{type:'resolve-battle',die:5,choices:{advanceUnitId:'wrong'}}}),
 /not a validated post-roll consequence/);
equal(committed.save().campaign,beforeDie.campaign,'post-roll preview must not mutate campaign journal');
const pendingSave=committed.save();
equal(Human.restore(copy(pendingSave),context).view(),detail,'pending die and options persist on save');
const altered=copy(pendingSave);altered.pendingRoll.die=chosen.die===1?2:1;
throws(()=>Human.restore(altered,context),/checksum mismatch/);
const invalidCampaign=copy(pendingSave);invalidCampaign.campaign.journal[0].stateHash='0'.repeat(64);
throws(()=>Human.restore(invalidCampaign,context),/checksum mismatch/);
const rejectedPending=committed.undo();
ok(rejectedPending.ok,'undo pending die');
equal(rejectedPending.session.save(),beforeDie,'undo pending die must restore pre-roll journal and decision');
const executable=[...detail.options,...detail.fleetCommitments];
let resolved=Human.restore(copy(pendingSave),context).choose(executable[0]);
ok(resolved.snapshot().actionCount===human.snapshot().actionCount+1,'one committed outcome appended');
const undone=resolved.undo();
ok(undone.ok,'Undo chosen consequence');
equal(undone.session.snapshot(),human.snapshot(),'Undo restores source combat state');
// Test a legal no-combat commitment and the full next-phase boundary. The
// gateway does not require the player to use the developer AI selector.
let skip=Human.create({session:initial,context});
if(skip.view().commands.some(x=>x.action?.type==='finish-air-sea'))skip=skip.choose(skip.view().commands.find(x=>x.action.type==='finish-air-sea'));
skip=skip.choose({type:'combat',action:{type:'commit-battles',battles:[]}});
let end=skip.view().commands.find(a=>a.action?.type==='finish-combat');
ok(Boolean(end),'no-battle completion available');
skip=skip.choose(end);
ok(skip.snapshot().phaseKind==='special-movement','human reaches subsequent movement');
let moves=skip.view().commands.filter(a=>a.type==='declare-ground-move');
ok(moves.length>0,'human legal ground routes in next phase');
const move=moves.find(a=>a.request?.path?.length>1)||moves[0];
skip=skip.choose(move);
ok(skip.snapshot().pendingGround!==null,'movement decision is pending');
equal(Human.restore(copy(skip.save()),context).snapshot(),skip.snapshot(),
 'pending human movement save round trip');
const next=skip.view();
if(next.commands.some(a=>a.type==='resolve-ground-move')){
 skip=skip.choose(next.commands.find(a=>a.type==='resolve-ground-move'));
 ok(skip.snapshot().pendingGround===null,'human ground move resolved');
}else if(next.commands.some(a=>a.type==='commit-forced-port')){
 skip=skip.choose(next.commands.find(a=>a.type==='commit-forced-port'));
 ok(skip.view().prompts.some(x=>x.type==='resolve-forced-ground-move'),'forced fleet prompt');
 skip=skip.roll(6);
 ok(skip.snapshot().pendingGround===null,'forced ground move resolves after die');
}else throw Error('A source-authorized movement must provide a resolution');
// A second, explicit call to the same catalog must not mutate the state.
const stable=skip.save();skip.view();equal(skip.save(),stable,'human discovery immutable');
const audit={checkpoint:167,version:'v401',scenarioId:'leningrad',
 assertions,openingPhase:openingChoices.phaseId,openingBattleProposals:openingChoices.proposals.length,
 testedBattle:battle,committedDie:chosen.die,postRollOutcome:detail.crtOutcome,
 postRollCandidates:executable.length,openedMovementChoices:moves.length,
 sourceSetup:{candidateValid:setupAudit.valid,historicalSetupAuthorized:setupAudit.historicalSetupAuthorized,
 printedAnchorDisagreements:setupAudit.printedAnchorDisagreements},
 limitations:['Source rules specify player-selected starting counter identities, not a single canonical allocation',
 'Two printed versus registered SVG map-number anchors still disagree',
 'Human decision gateway is headless and not the deferred Oberlabs UX',
 'Post-roll alternatives are bounded and not necessarily exhaustive',
 'No source-certified player-operated full eight-turn campaign is claimed']};
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/leningrad-human-gateway-v401.json',JSON.stringify(audit,null,2)+'\n');
console.log('PASS human campaign choice/roll/restore/Undo '+assertions+' assertions');
