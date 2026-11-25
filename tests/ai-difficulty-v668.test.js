'use strict';
const assert=require('node:assert/strict');
const D=require('../core/ai_difficulty'),P=require('../core/player_save_config'),AI=require('../core/native_session_ai'),Auto=require('../core/historical_campaign_autoplay');
const E=require('../core/engine'),S=require('../core/session'),Project=require('../core/native_preview_config'),C=require('../core/historical_campaign_session');
let checks=0;const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++},ok=(v,m)=>{assert.ok(v,m);checks++},bad=(fn)=>{assert.throws(fn);checks++};
for(const value of [-1,11,1.5,'4',null,undefined,NaN,true]){bad(()=>D.validate(value));bad(()=>AI.policy({difficulty:value}));bad(()=>Auto.policyOf({difficulty:value}));}
for(const strategies of [['diagnostic','operational','reserve-relief'],['baseline','objective','capture']]){
 const raw={format:'sample-engine-save',state:{seed:1}};
 for(let germanDifficulty=0;germanDifficulty<=10;germanDifficulty++)for(let sovietDifficulty=0;sovietDifficulty<=10;sovietDifficulty++){
  const cfg={assignment:'both',german:strategies[0],soviet:strategies[1],germanDifficulty,sovietDifficulty};
  const packed=P.pack(raw,cfg,strategies),decoded=P.unpack(JSON.parse(JSON.stringify(packed)),strategies);
  eq(decoded.save,raw);eq(decoded.players,P.validate(cfg,strategies));eq(packed.playerSession.version,germanDifficulty||sovietDifficulty?2:1);
  if(germanDifficulty||sovietDifficulty){const corrupt=structuredClone(packed);corrupt.playerSession.players.germanDifficulty=(germanDifficulty+1)%11;bad(()=>P.unpack(corrupt,strategies));}
 }
 bad(()=>P.pack(raw,{...P.defaults(strategies),germanDifficulty:2},strategies));
 bad(()=>P.pack(raw,{...P.defaults(strategies),germanDifficulty:0,sovietDifficulty:11},strategies));
}
eq(AI.policy({difficulty:0}).maxMovesPerPhase,AI.policy().maxMovesPerPhase);eq(Auto.policyOf({difficulty:0}).phaseScope,'diagnostic');
bad(()=>Auto.policyOf({phaseScope:'diagnostic',difficulty:1}));bad(()=>AI.policy({difficulty:1,maxMovesPerPhase:-1}));bad(()=>Auto.policyOf({difficulty:1,maxGroundMovesPerPhase:-1}));
const profiles=[];
for(let grade=1;grade<=10;grade++){
 const native=AI.policy({difficulty:grade}),historical=Auto.policyOf({difficulty:grade}),continuation=D.continuation(grade);
 eq(AI.policy(native),native);eq(Auto.policyOf(historical),historical);eq(historical.phaseScope,'operational');eq(historical.attackSelection,'continuation-pilot');eq(historical.maxReinforcementsPerPhase,Auto.policyOf({phaseScope:'operational'}).maxReinforcementsPerPhase);
 eq(native.maxReplacementsPerPhase,AI.policy().maxReplacementsPerPhase);eq(native.minAttackOdds,AI.policy().minAttackOdds);
 profiles.push({grade,nativeMoves:native.maxMovesPerPhase,nativeBattles:native.maxBattlesPerPhase,historicalMoves:historical.maxGroundMovesPerPhase,historicalBattles:historical.maxCombatsPerPhase,...continuation});
}
for(let i=1;i<profiles.length;i++)for(const key of Object.keys(profiles[i]))ok(profiles[i][key]>=profiles[i-1][key],`${key} budget should not decrease`);
// Native actual rules, fixed source opening, two grades and exact continuation.
const {original,config}=require('../tools/audit-b4m-native-preview-v360').load();
const g=E.build(Project.project(original,config)),scope={scenarioId:g.game.id,engine:'generic-hex-v1',config:g};
const start=S.create({...scope,state:E.start(g,7,'auto-reference')}),opening=S.serialize(start);
const low=AI.playSide(start,{difficulty:1,mode:'objective-guard-v1'}),high=AI.playSide(start,{difficulty:10,mode:'objective-guard-v1'});
eq(low.session.state.side,'soviet');eq(high.session.state.side,'soviet');ok(high.summary.moves>low.summary.moves,'Actual native grades must change movement effort');eq(S.serialize(start),opening);
for(const grade of [1,6,10]){
 const settings={difficulty:grade,mode:'objective-guard-v1'},steps=AI.sideSteps(start,settings);let next,paused;
 while(!(next=steps.next()).done){if(next.value.action.type==='move'){paused=next.value.after;break;}}
 ok(paused,'source-legal movement witness');const saved=S.serialize(paused),restored=S.restore(saved,scope);eq(S.serialize(restored),saved);
 const expected=AI.playSide(start,settings).session;const actual=AI.playSide(restored,settings).session;eq(S.serialize(actual),S.serialize(expected),'Restored graded movement budget must match uninterrupted play');
}
// Actual historical Kiev source position, ordinary movement phase, not a mock rules engine.
const F=require('./fixtures/kiev-source-opening-v437'),map=F.map,counterConfig=F.counterConfig,profile=require('../maps/movement-configs/kiev.json'),phaseConfig=require('../maps/phase-configs/kiev.json'),combatPolicy=require('../maps/combat-configs/kiev.json');
const committed=require('../core/historical_deployment_session').create({map,setupSpec:F.setupSpec,counterConfig,inventory:F.inventory,phaseConfig,movementProfile:profile,phaseFactories:{combat:()=>({})},allocation:F.allocation,placements:F.placements}).commit();
const ctx={...committed.opening,map,profile,config:phaseConfig,counterConfig,combatPolicy,enableAirSupport:true,buildupPolicy:require('../maps/buildup-configs/kiev.json'),buildupAllocation:committed.allocation,housekeepingPolicy:require('../maps/housekeeping-configs/kiev.json')};
const cursor={...ctx.cursor,turn:3,index:phaseConfig.phases.findIndex(p=>p.id==='german-movement')};
const c={...ctx,actor:'german',cursor,state:structuredClone(C.create(ctx).snapshot().state)},source=C.create(c),before=source.save(),movements=[];
for(const difficulty of [1,10]){
 let session=source,moves=0,actions=0;const policy={difficulty,seed:7};
 while(session.snapshot().phaseId===source.snapshot().phaseId&&actions++<160){const d=Auto.decide({session,context:c,policy});eq(d.status,'action',JSON.stringify(d));if(d.action.type==='resolve-ground-move')moves++;session=session.execute(d.action).session;}
 ok(session.snapshot().phaseId!==source.snapshot().phaseId,'graded phase must terminate');eq(C.restore(session.save(),c).snapshot(),session.snapshot());movements.push(moves);
}
eq(movements[0],D.historical(1).maxGroundMovesPerPhase);ok(movements[1]>movements[0]);eq(source.save(),before);
console.log(JSON.stringify({checks,profiles,nativeMoves:[low.summary.moves,high.summary.moves],kievMoves:movements}));
