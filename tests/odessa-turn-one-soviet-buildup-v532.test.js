'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const req=p=>require(path.join(root,p));
const Campaign=req('core/historical_campaign_session'),Human=req('core/historical_campaign_human');
const candidate=req('games/kiev-odessa/experimental-preview/opening-v531.json').contextStart;
const policy=req('maps/buildup-configs/kiev-odessa-turn-one-zero-v532.json');
const context={...structuredClone(candidate),map:req('maps/kiev-odessa-composite-experimental-v531.json'),
 profile:req('maps/movement-configs/kiev-odessa-experimental-v531.json'),
 config:req('maps/phase-configs/kiev-odessa.json'),counterConfig:req('maps/counter-configs/kiev-odessa-experimental-v531.json'),
 combatPolicy:req('maps/combat-configs/kiev-odessa-experimental-v531.json'),
 rosterOverlay:req('maps/roster-overlays/kiev-odessa.json'),enableAirSupport:true,firstTurnEmptyBuildupPolicy:policy};
let checks=0;const eq=(a,b,m)=>{assert.deepStrictEqual(a,b,m);checks++}, yes=(v,m)=>{assert.ok(v,m);checks++}, bad=(f,re,m)=>{assert.throws(f,re,m);checks++};
let game=Campaign.create(context);
for(const action of [{type:'combat',action:{type:'finish-air-sea'}},
 {type:'combat',action:{type:'commit-battles',battles:[]}},
 {type:'combat',action:{type:'finish-combat'}},
 {type:'finish-phase'}])game=game.execute(action).session;
let b=game.snapshot();eq(b.phaseId,'soviet-buildup');eq(b.cursor.turn,1);eq(b.actor,'soviet');eq(b.phaseSupported,true);
eq(Object.keys(b.state.units).length,36);eq(b.state.supportMarkers.blackSeaFleet.hex,'1513');
let human=Human.create({session:game,context});const v=human.view();
eq(v.commands,[{type:'finish-buildup'}],'No fabricated Turn 1 replacements, reinforcements, or extra actions');
for(const action of [{type:'apply-replacement',unitId:'kiev-front-r05c01',hex:null},
 {type:'place-reinforcement',slotId:'t2-slovak',hex:'0101'},
 {type:'place-evacuated-reinforcement',unitId:'kiev-front-r05c01',hex:'1801'},
 {type:'finish-phase'}])bad(()=>game.execute(action),/No replacements or reinforcements|No replacements|Only source|first-turn buildup/i,'Turn 1 action rejected');
const beforeSave=human.save(),savedGame=game.save();
const completed=human.choose({type:'finish-buildup'});const after=completed.snapshot();
eq(after.phaseId,'soviet-special-movement');eq(after.cursor.turn,1);eq(after.actor,'soviet');
eq(after.lastEvent.forfeitedReplacementSteps,0);eq(after.lastEvent.lostGroundSlotIds,[]);eq(after.lastEvent.supportArrivals,[]);
eq(Object.keys(after.state.units).length,36);eq(after.state.supportMarkers.blackSeaFleet.hex,'1513');
eq(after.state.cityControl,b.state.cityControl,'Zero-action Buildup does not change city control');
const snapGame=game.execute({type:'finish-buildup'}).session;
eq(Campaign.restore(snapGame.save(),context).snapshot(),snapGame.snapshot(),'Save/Restore after Buildup');
eq(Human.restore(completed.save(),context).snapshot(),after,'Human save/restore after Buildup');
const undo=snapGame.undo();yes(undo.ok);eq(undo.session.snapshot().phaseId,'soviet-buildup','Undo returns to mandatory Buildup');
eq(Campaign.restore(savedGame,context).snapshot(),b,'Pre-buildup Save/Restore stable');
eq(Human.restore(beforeSave,context).snapshot(),b);
const wrongZero=structuredClone(context);wrongZero.firstTurnEmptyBuildupPolicy.replacementSteps=1;
bad(()=>Campaign.create(wrongZero),/not source-authorized/i,'Reject invented first-turn replacement');
const wrongArrival=structuredClone(context);wrongArrival.firstTurnEmptyBuildupPolicy.groundReinforcements=1;
bad(()=>Campaign.create(wrongArrival),/not source-authorized/i,'Reject invented first-turn arrivals');
const wrongOwner=structuredClone(context);wrongOwner.firstTurnEmptyBuildupPolicy.owner='german';
bad(()=>Campaign.create(wrongOwner),/not source-authorized/i,'Reject wrong actor');
const wrongPhase=structuredClone(context);wrongPhase.firstTurnEmptyBuildupPolicy.phaseId='soviet-combat';
bad(()=>Campaign.create(wrongPhase),/not source-authorized/i,'Reject wrong phase');
const without=structuredClone(context);delete without.firstTurnEmptyBuildupPolicy;
let old=Campaign.create(without);for(const a of [{type:'combat',action:{type:'finish-air-sea'}},
 {type:'combat',action:{type:'commit-battles',battles:[]}},
 {type:'combat',action:{type:'finish-combat'}},{type:'finish-phase'}])old=old.execute(a).session;
eq(old.snapshot().phaseSupported,false,'No implicit Buildup when feature absent');
bad(()=>old.execute({type:'finish-buildup'}),/not yet implemented/i,'Cannot skip mandatory phase without policy');
const onTurn2=structuredClone(context);onTurn2.cursor={scenarioId:'kiev-odessa',turn:2,index:4,complete:false};onTurn2.actor='soviet';
const turn2=Campaign.create(onTurn2);eq(turn2.snapshot().phaseId,'soviet-buildup');eq(turn2.snapshot().phaseSupported,false);
bad(()=>turn2.execute({type:'finish-buildup'}),/not yet implemented/i,'No unauthorized later turn bypass');
const tamperSave=structuredClone(snapGame.save()), tamperContext=structuredClone(context);tamperContext.firstTurnEmptyBuildupPolicy.status='historical-certified';
bad(()=>Campaign.restore(tamperSave,tamperContext),/not source-authorized|mismatch/i,'Changed policy cannot restore saved journal');
console.log('PASS v532 source-verified Turn 1 Soviet Buildup',checks,'assertions');
