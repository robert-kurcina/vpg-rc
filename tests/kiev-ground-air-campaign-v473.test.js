'use strict';
/* Checkpoint 239: Kiev source-ground-only Air Corps through the ORIGINAL shared
 * campaign/session/action catalog. Test-only synthetic positions on verified
 * Leningrad hexsides: NEVER a Kiev movement or historical campaign opening.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const root=require('node:path').resolve(__dirname,'..');
const MapK=require('../maps/kiev.json');
const PolicyK=require('../maps/combat-configs/kiev.json');
const CountersK=require('../maps/counter-configs/kiev.json');
const PhaseK=require('../maps/phase-configs/kiev.json');
const MapL=require('../maps/leningrad.json');
const MovementL=require('../maps/movement-configs/leningrad.json');
const PhaseL=require('../maps/phase-configs/leningrad.json');
const MapGraph=require('../core/map_movement_graph');
const Air=require('../core/historical_air_support');
const Combat=require('../core/historical_combat_phase');
const Campaign=require('../core/historical_campaign_session');
const Catalog=require('../core/historical_campaign_action_catalog');
const copy=x=>JSON.parse(JSON.stringify(x));
let assertions=0;
const eq=(a,b,m)=>{assert.deepStrictEqual(a,b,m);assertions++;};
const ok=(x,m)=>{assert.ok(x,m);assertions++;};
const bad=(fn,re,m)=>{assert.throws(fn,re,m);assertions++;};
const sha=x=>crypto.createHash('sha256').update(fs.readFileSync(root+'/'+x)).digest('hex');
const front=new Map(CountersK.faces.front.map(f=>[f.faceId,f]));
const pairs=[['kiev-front-r04c01','0310','kiev-front-r04c03','0309','motorized','italian',4],
 ['kiev-front-r01c01','0510','kiev-front-r05c01','0509','panzer','german',6]];
const ground={scenarioId:'leningrad',units:{}};
for(const [att,attHex,def,defHex,klass,nation,mp] of pairs){
 for(const [id,hex,owner,cl,nationality,speed] of [
   [att,attHex,'german',klass,nation,mp],[def,defHex,'soviet','mechanized','soviet',6]]){
  const f=front.get(id);
  ok(f?.pairedFaceId&&CountersK.faces.back.some(b=>b.faceId===f.pairedFaceId),'original Kiev photographed front/back');
  ground.units[id]={id,sourceFaceId:id,reverseFaceId:f.pairedFaceId,
   hex,openingHex:hex,owner,nationality,class:cl,size:'corps',mp:speed,
   printedCombatStrength:owner==='german'?(id==='kiev-front-r04c01'?4:12):null,
   strengthStatus:owner==='german'?'printed-full':'untried'};
 }
}
const certified=MapGraph.build(MapL);
for(const [,from,,to] of pairs)ok(certified.edges.some(e=>[e.a,e.b].includes(from)&&[e.a,e.b].includes(to)&&e.verified&&!e.impassable),
 'test battle has genuinely certified physical hexside');
// Kiev historical rulebook and face sources are immutable. No forged country mask.
const ruleDigest=require('../maps/combat-configs/kiev-turn-rules-v443.json').sourceSha256;
eq(sha('references/rules/kiev-rules.pdf'),ruleDigest,'original printed Kiev rulebook');
eq(PolicyK.airSupport.navalAttackMode,'none','Kiev explicitly has no naval strike phase');
eq(PolicyK.portSupport,undefined,'Kiev has no port or naval-marker rules');
eq(PolicyK.requireFirstTurnTerritorialRestriction,true);
eq(PolicyK.firstTurnTerritorialRestriction.targetHexes,['0709','0809','0910','1010']);
bad(()=>MapGraph.build({...MapK,sourceImageSHA256:'untrusted-v485-test'}),/source-geometry-not-gameplay-certified/,'Kiev live movement graph is still shut');
const air=Air.create({map:MapK,combatPolicy:PolicyK,counterConfig:CountersK,phaseConfig:PhaseK});
const actualCursor={scenarioId:'kiev',turn:1,index:2,complete:false};
const initialSourceState={scenarioId:'kiev',units:{}};
const available=air.available({state:initialSourceState,cursor:actualCursor,actor:'german'});
eq(available.map(x=>[x.identifier,x.shiftRating]),[['FK IV',1],['FK V',1]],'Kiev genuine air marker identity');
bad(()=>air.attackFleet({state:initialSourceState,cursor:actualCursor,actor:'german',faceId:available[0].faceId,die:1}),
 /Naval air attacks not available/,'ground-only marker cannot attack nonexistent Fleet');
const invalid=copy(PolicyK);invalid.airSupport.navalAttackMode='fabricated';
bad(()=>Air.create({map:MapK,combatPolicy:invalid,counterConfig:CountersK,phaseConfig:PhaseK}),/naval air-attack mode/);
const misbound=copy(PolicyK);misbound.portSupport={mode:'invented'};
bad(()=>Air.create({map:MapK,combatPolicy:misbound,counterConfig:CountersK,phaseConfig:PhaseK}),/conflicts with source-configured Fleet/);
// To keep source/gameplay boundaries honest, only this TEST is rebound to
// the independently certified Leningrad map, movement and phase table.
const policy=copy(PolicyK);policy.scenarioId='leningrad';
policy.requireFirstTurnTerritorialRestriction=false;
policy.firstTurnTerritorialRestriction=null;
delete policy.firstTurnCombatRestriction;
const cursor={scenarioId:'leningrad',turn:3,index:2,complete:false};
const context={map:MapL,profile:MovementL,config:PhaseL,counterConfig:CountersK,
 combatPolicy:policy,enableAirSupport:true,cursor,actor:'german',state:ground};
const combat=Combat.create(context);
eq(combat.snapshot().status,'awaiting-declarations','no irrelevant Fleet-attack prelude');
bad(()=>combat.finishAirSea(),/Air-sea phase not open/);
bad(()=>combat.declareFleetAttack(available[0].faceId),/Fleet air attack must be declared/);
let campaign=Campaign.create(context);
eq(campaign.snapshot().combat.status,'awaiting-declarations');
const start=copy(campaign.snapshot());
const firstCatalog=Catalog.discover({session:campaign,context,enumerateCombinedPlans:false});
ok(firstCatalog.proposals.some(x=>x.defenderHex==='0309'),'source-verified first battle found');
ok(firstCatalog.proposals.some(x=>x.defenderHex==='0509'),'source-verified second battle found');
ok(!firstCatalog.commands.some(x=>x.action?.type==='finish-air-sea'),'no Fleet command advertised');
bad(()=>campaign.execute({type:'combat',action:{type:'finish-air-sea'}}),/Air-sea phase not open/);
const commands=battles=>({type:'combat',action:{type:'commit-battles',battles}});
const battles=pairs.map(([att,, ,defHex])=>({defenderHex:defHex,attackers:[att]}));
const act=action=>{const result=campaign.execute({type:'combat',action});campaign=result.session;return result;};
act({type:'commit-battles',battles});
eq(campaign.snapshot().combat.declaration.battles.length,2,'both announced before any result');
act({type:'select-battle',defenderHex:'0309'});
const choices=Catalog.discover({session:campaign,context});
eq(choices.commands.filter(x=>x.action?.type==='commit-ground-air').map(x=>x.action.faceId),
 [null,available[0].faceId,available[1].faceId]);
act({type:'commit-ground-air',faceId:available[0].faceId});
const locked=copy(campaign.snapshot());
bad(()=>act({type:'resolve-battle',die:0,choices:{}}),/Invalid committed combat transaction/,'invalid die cannot spend Air Corps');
eq(campaign.snapshot(),locked,'failed roll leaves commitment intact');
const first=act({type:'resolve-battle',die:6,choices:{}});
eq(first.event.outcome,'DE','real source CRT outcome');
eq(first.event.airSupport.faceId,available[0].faceId);
eq(first.event.airSupport.shiftRating,1);
eq(campaign.snapshot().state.airUse['3'][available[0].faceId],'ground');
eq(campaign.snapshot().state.units[pairs[0][2]],undefined,'first original photographed Soviet unit eliminated');
const saved=campaign.save(),replayed=Campaign.restore(copy(saved),context);
eq(replayed.snapshot(),campaign.snapshot(),'full immutable campaign state replays after air commitment');
eq(replayed.save(),saved,'save digest stable after replay');
act({type:'select-battle',defenderHex:'0509'});
const secondCatalog=Catalog.discover({session:campaign,context});
eq(secondCatalog.commands.filter(x=>x.action?.type==='commit-ground-air').map(x=>x.action.faceId),
 [null,available[1].faceId],'first marker exhausted, second available');
bad(()=>act({type:'commit-ground-air',faceId:available[0].faceId}),/unavailable/,'same turn cannot reuse first Air Corps');
act({type:'commit-ground-air',faceId:available[1].faceId});
const beforeSecond=copy(campaign.snapshot());
const second=act({type:'resolve-battle',die:6,choices:{}});
eq(second.event.outcome,'DE');
eq(second.event.airSupport.faceId,available[1].faceId);
eq(Object.keys(campaign.snapshot().state.airUse['3']).sort(),available.map(x=>x.faceId).sort(),
 'both distinct Air Corps consumed exactly once');
eq(campaign.snapshot().combat.status,'battles-resolved');
eq(Campaign.restore(copy(campaign.save()),context).snapshot(),campaign.snapshot(),
 'two real battles and both air choices restore through shared campaign journal');
const rewind=campaign.undo();eq(rewind.ok,true);
eq(rewind.session.snapshot(),beforeSecond,'undo second result but keep committed air choice');
eq(rewind.session.snapshot().state.airUse['3'][available[1].faceId],undefined,
 'pre-roll lock does not prematurely spend marker');
eq(rewind.session.undo().session.snapshot().combat.groundAirLocked,false,
 'undo the committed air choice');
eq(ground,start.state,'source caller state never mutated');
act({type:'finish-combat'});
eq(campaign.snapshot().phaseKind,'special-movement','combat can advance into genuine shared movement phase');
eq(campaign.snapshot().state.airUse['3'][available[1].faceId],'ground');
const after=copy(campaign.snapshot());
eq(Campaign.restore(copy(campaign.save()),context).snapshot(),after);
// Configuration-only effect: existing Baltic Fleet air-sea and Arduous
// experimental legacy opening were NOT globally modified by this change.
const LPolicy=require('../maps/combat-configs/leningrad.json');
const APolicy=require('../maps/combat-configs/arduous.json');
eq(LPolicy.airSupport.navalAttackMode,undefined);
eq(APolicy.airSupport.navalAttackMode,'none');
const audit={checkpoint:239,version:'v473',assertions,
 scope:'source-ground-only Kiev air support on TEST-ONLY certified Leningrad geometry',
 source:{kievRulebookSha256:ruleDigest,kievCounterFaceSha256:CountersK.faceSource.front.sha256,
  kievAidSha256:sha('references/rules/kiev-player-aid.webp')},
 proof:{airFaces:available.map(x=>x.faceId),multiBattleOutcomes:[first.event.outcome,second.event.outcome],
  twoAirMarkersCommitted:true,saveRestoreUndo:true,noFleetPrelude:true},
 limits:{kievGraphPlayable:false,kievRomanianTerritoryCertified:false,historicalKievCampaignTested:false}};
if(process.argv.includes('--write-audit'))fs.writeFileSync(root+'/rules/audit/kiev-ground-air-campaign-v473.json',JSON.stringify(audit,null,2)+'\n');
console.log('PASS Kiev v473 ground-only air campaign transaction: '+assertions+' assertions; live Kiev gate CLOSED');
