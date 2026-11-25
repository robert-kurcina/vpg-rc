'use strict';
/* Checkpoint 238: Kiev complete combat-profile candidate, not game activation.
 * All source photo and rule facts are pinned; combat transaction uses a
 * deliberately SYNTHETIC location on genuinely certified Leningrad geography.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const KMap=require('../maps/kiev.json');
const KConfig=require('../maps/combat-configs/kiev.json');
const KCounters=require('../maps/counter-configs/kiev.json');
const KPhase=require('../maps/phase-configs/kiev.json');
const KMovement=require('../maps/movement-configs/kiev.json');
const KSetup=require('../maps/setup/kiev.json');
const prior=require('../maps/combat-configs/kiev-turn-rules-v443.json');
const LMap=require('../maps/leningrad.json');
const LMovement=require('../maps/movement-configs/leningrad.json');
const LPhase=require('../maps/phase-configs/leningrad.json');
const LCombat=require('../maps/combat-configs/leningrad.json');
const Graph=require('../core/map_movement_graph');
const Reviewed=require('../core/source_reviewed_movement_graph');
const MovementRules=require('../core/movement_rules');
const Air=require('../core/historical_air_support');
const Odds=require('../core/historical_combat_odds');
const Declare=require('../core/historical_combat_declarations');
const Combat=require('../core/historical_combat_phase');
const C=require('../core/historical_crt');
const SourceSetup=require('../tests/fixtures/kiev-source-opening-v437');
const Setup=require('../core/scenario_starting_setup');
const clone=x=>JSON.parse(JSON.stringify(x));
const sha=x=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,x))).digest('hex');
let assertions=0;
const eq=(x,y,msg)=>{assert.deepStrictEqual(x,y,msg);assertions++;};
const ok=(x,msg)=>{assert.ok(x,msg);assertions++;};
const bad=(fn,re,msg)=>{assert.throws(fn,re,msg);assertions++;};

// Source fingerprints and current official shared CRT. This profile is
// distinct from the older fragments, which remain unchanged for traceability.
eq(sha('references/rules/kiev-rules.pdf'),prior.sourceSha256,'original Kiev printed rulebook');
const index=require('../references/rules/SOURCE_INDEX.json');
const sourceAid=index.items.find(x=>x.file==='kiev-player-aid.webp');
eq(sha('references/rules/kiev-player-aid.webp'),sourceAid.sha256,'original official terrain/turn aid');
for(const side of ['front','back'])eq(sha(KCounters.faceSource[side].file),KCounters.faceSource[side].sha256,'photographed Kiev '+side);
eq(KConfig.crtId,C.id,'one B4M CRT for all five historical scenarios');
eq(C.tableFor('kiev'),C.tableFor('battle-for-moscow'),'exact shared CRT');
eq(KConfig.scenarioId,'kiev');
ok(KConfig.status.includes('NOT-LIVE'));
eq(KConfig.firstTurnCombatRestriction.setupHexes,prior.firstTurnCombatRestriction.setupHexes);
eq(KConfig.modifiers.attackerTurnMultipliers,prior.attackerTurnMultipliers);
eq(KConfig.modifiers.majorRiverAttackMultiplier,0.5);
eq(KConfig.modifiers.terrainColumnShifts,{'forest':-1,'swamp':-1,'major-city':-1});
eq(KConfig.modifiers.swampAffectedClasses,['panzer','mechanized']);
eq(KConfig.retreatHexes,2);
eq(KConfig.armyStackingByOwner,{soviet:1,german:1});
eq(KMovement.nationalStackExclusions,[['romanian','hungarian']]);
eq(KConfig.requireFirstTurnTerritorialRestriction,true);
eq(KConfig.firstTurnTerritorialRestriction.targetHexes,['0709','0809','0910','1010'],'adjudicated scenario-local Turn-1 target set');
eq(KConfig.firstTurnTerritorialRestriction.targetRegionEvidence.coverage,'setup-hexes-adjudicated');
eq(KConfig.firstTurnTerritorialRestriction.allowedOpeningHexes,['0708','0808','1110']);

// All initial source-photo counters classify under this exact policy; no
// unrelated generic Infantry face is reclassified as Motorized by the exception.
const opening=Setup.validate({map:SourceSetup.map,spec:SourceSetup.setupSpec,
 counterConfig:SourceSetup.counterConfig,inventory:SourceSetup.inventory,
 allocation:SourceSetup.allocation,placements:SourceSetup.placements});
ok(opening.valid,'original 30-unit source-legal synthetic sample is unchanged');
eq(Object.keys(opening.state.units).length,30);
const front=new Map(KCounters.faces.front.map(f=>[f.faceId,f]));
const back=new Map(KCounters.faces.back.map(f=>[f.faceId,f]));
for(const unit of Object.values(opening.state.units)){
 const f=front.get(unit.sourceFaceId),t=f?.visualTranscription;
 ok(f&&back.has(f.pairedFaceId),'initial unit has source front and reverse');
 eq(KConfig.printedAffiliationToOwner[t.printedAffiliation],unit.owner,'authentic national owner');
 eq(KConfig.counterKindToClass[t.kind],unit.class,'authentic initial combat class');
}
const italy=front.get('kiev-front-r04c01'),it=italy.visualTranscription;
eq([it.kind,it.printedIdentifier,it.printedAffiliation,it.printedValues],
 ['infantry','Italy CSIR','italian','4-4'],'source photo shows ordinary infantry symbol');
eq(back.get(italy.pairedFaceId).visualTranscription.printedValues,'2-4');
eq(KSetup.groups?.italianReinforcementMotorized?.class,undefined,'setup group describes pool, not necessarily class');
const italianSlot=require('../maps/buildup-configs/kiev.json').reinforcements.find(x=>x.slotId==='t3-italian-motorized');
ok(italianSlot,'historical turn-3 Italian unit exists');
eq([italianSlot.class,italianSlot.printedKind,italianSlot.printedAffiliation,italianSlot.printedValues],
 ['motorized','infantry','italian','4-4'],'source-captioned Motorized Infantry keeps infantry counter glyph');
eq(KConfig.counterFaceClassOverrides[italy.faceId],{
 printedKind:'infantry',printedIdentifier:'Italy CSIR',printedAffiliation:'italian',unitClass:'motorized'});
eq(Object.keys(KConfig.counterFaceClassOverrides),[italy.faceId],
 'override is face-specific, not blanket Infantry-to-Motorized');

// Test-only Kiev graph: the §9 special-movement benefit must follow the
// rulebook's Motorized Infantry classification, not the source NATO glyph.
// Using Reviewed.build() here cannot authorize Graph.build(Kiev) for live play.
const provisional=Reviewed.build(KMap,require('../maps/movement-configs/kiev-source-reviewed-candidate-v435.json'));
const neighbor=new Map();
for(const e of provisional.edges)for(const [from,to] of [[e.a,e.b],[e.b,e.a]]){
 if(!neighbor.has(from))neighbor.set(from,[]);neighbor.get(from).push(to);
}
const pathCost=path=>path.slice(1).reduce((cost,to,i)=>{
 const edge=provisional.edges.find(e=>[e.a,e.b].includes(path[i])&&[e.a,e.b].includes(to));
 return cost+(edge.rail?KMovement.railCost:KMovement.terrainCosts[provisional.cells[to].terrain]+
  (edge.majorRiver?KMovement.majorRiverExtraCost:0));
},0);
let motorRoute=null;
routeSearch:for(const [a,seconds] of neighbor){
 for(const b of seconds)for(const c of neighbor.get(b)||[])for(const d of neighbor.get(c)||[]){
  const path=[a,b,c,d],cost=pathCost(path);
  if(new Set(path).size===4&&cost>2&&cost<=4){motorRoute=path;break routeSearch;}
 }
}
ok(motorRoute,'source-reviewed Kiev graph has a 3-or-4-MP special movement path');
const movementFor=unitClass=>MovementRules.move({profile:KMovement,board:provisional,turn:3,
 phase:{kind:'special-movement',owner:'german'},units:{it:{id:'it',hex:motorRoute[0],
 owner:'german',nationality:'italian',class:unitClass,size:'corps',mp:4}}},
 {unitId:'it',path:motorRoute});
eq(movementFor('motorized').ok,true,'Turn-3 Italian Motorized unit gets full special allowance');
eq(movementFor('infantry').reason,'insufficient-movement-points',
 'An ordinary Infantry unit with the same photographed movement rating gets only half');

// Opening country rule must remain fail-closed, even if a future caller
// accidentally tries to compose Kiev with the provisional movement board.
bad(()=>Graph.build({...KMap,sourceImageSHA256:'untrusted-v485-test'}),/source-geometry-not-gameplay-certified/);
const required={requireFirstTurnTerritorialRestriction:true};
bad(()=>Declare.create({map:LMap,profile:LMovement,config:LPhase,combatPolicy:required}),
 /Required first-turn territorial restriction lacks source-certified target territory/);
const known=clone(required);
known.firstTurnTerritorialRestriction={owner:'soviet',turn:1,allowedOpeningHexes:['0309'],
 targetHexes:['0310'],targetRegionEvidence:{coverage:'complete',provenance:'synthetic single-hex certified-board test only'}};
ok(Declare.create({map:LMap,profile:LMovement,config:LPhase,combatPolicy:known}),
 'generic rules admit only an explicitly complete synthetic test territory');
for(const [candidate,description] of [
 [{...known.firstTurnTerritorialRestriction,targetRegionEvidence:{coverage:'draft-complete-pending-independent-source-approval',provenance:'unsigned review'}},'draft'],
 [{...known.firstTurnTerritorialRestriction,targetRegionEvidence:{coverage:'complete',provenance:''}},'missing provenance']
])bad(()=>Declare.create({map:LMap,profile:LMovement,config:LPhase,
 combatPolicy:{...required,firstTurnTerritorialRestriction:candidate}}),
 /Invalid source-defined first-turn territory restriction/,'reject '+description);

// Source-bound air rules are exercised on Kiev's original photographed
// support markers WITHOUT activating any Kiev movement or game campaign.
const air=Air.create({map:KMap,combatPolicy:KConfig,counterConfig:KCounters,phaseConfig:KPhase});
const initial={scenarioId:'kiev',units:{}};
const cursor=(turn,index=2)=>({scenarioId:'kiev',turn,index,complete:false});
const markers=air.available({state:initial,cursor:cursor(1),actor:'german'});
eq(markers.map(m=>[m.faceId,m.shiftRating,m.firstTurn,m.identifier]),[
 ['kiev-front-r03c01',1,1,'FK IV'],['kiev-front-r03c02',1,1,'FK V']]);
let applied=air.ground({state:initial,cursor:cursor(1),actor:'german',faceId:markers[0].faceId});
eq(applied.shiftRating,1);
eq(applied.event.kind,'ground-air-commitment');
eq(initial.airUse,undefined,'original state never mutated');
eq(air.available({state:applied.state,cursor:cursor(1),actor:'german'}).length,1);
bad(()=>air.ground({state:applied.state,cursor:cursor(1),actor:'german',faceId:markers[0].faceId}),
 /already committed/,'air marker once per turn');
applied=air.ground({state:applied.state,cursor:cursor(1),actor:'german',faceId:markers[1].faceId});
eq(air.available({state:applied.state,cursor:cursor(1),actor:'german'}).length,0);
eq(air.available({state:applied.state,cursor:cursor(2),actor:'german'}).length,2,'both reusable next turn');
bad(()=>air.available({state:initial,cursor:cursor(1,6),actor:'german'}),/owning Combat Phase/);
bad(()=>air.available({state:initial,cursor:cursor(1),actor:'soviet'}),/owning Combat Phase/);
const fakeAir=clone(KConfig);fakeAir.airSupport.markers[0].shiftRating=2;
bad(()=>Air.create({map:KMap,combatPolicy:fakeAir,counterConfig:KCounters,phaseConfig:KPhase}),
 /photographed counter/,'source-face shift forgery');

// §10.9 Soviet Mechanized Counterattack uses printed reverse face attack
// strengths exactly on Turns 1 and 2 (and never on Turn 3).
const q={attackers:[{kind:'mechanized',value:4},{kind:'infantry',value:6}],
 defenders:[{kind:'infantry',value:4}],defenderTerrain:'open',allAttackersAcrossRiver:false,
 attackerIds:['mech','inf'],policy:KConfig,actor:'soviet'};
for(const [turn,strength] of [[1,14],[2,12],[3,10]])
 eq(Odds.evaluate({...q,turn}).attackStrength,strength,'source turn-specific Soviet mechanized bonus');
eq(Odds.evaluate({...q,turn:1,majorRiverCrossers:['mech']}).attackStrength,10,
 'turn bonus before per-unit major-river halving');
eq(Odds.evaluate({...q,turn:2,defenderTerrain:'swamp'}).attackStrength,9,
 'Soviet Mechanized bonus followed by exact swamp half-strength');
eq(Odds.evaluate({...q,actor:'german',turn:1}).attackStrength,10);
eq(Odds.evaluate({...q,turn:3,attackers:[{kind:'motorized',value:4}],
 defenderTerrain:'swamp'}).attackStrength,4,'Motorized Infantry is not a Tank for swamp halving');

// Real shared combat uses the source Kiev Italian face and actual source
// Kiev concealed Soviet Mechanized face, but positions them on independently
// CERTIFIED Leningrad hexsides for a test-only provenance-safe transaction.
const simulated=clone(KConfig);simulated.scenarioId='leningrad';
simulated.requireFirstTurnTerritorialRestriction=false;
simulated.firstTurnTerritorialRestriction=null;
delete simulated.firstTurnCombatRestriction; // the original printed Kiev start hexes cannot apply in Leningrad
const soviet=front.get('kiev-front-r04c03');
const makeUnit=(f,opts)=>({id:f.faceId,sourceFaceId:f.faceId,reverseFaceId:f.pairedFaceId,...opts});
const scenario={scenarioId:'leningrad',units:{
 [italy.faceId]:makeUnit(italy,{owner:'german',nationality:'italian',class:'motorized',size:'corps',
  hex:'0310',openingHex:'0310',mp:4,printedCombatStrength:4,strengthStatus:'printed-full'}),
 [soviet.faceId]:makeUnit(soviet,{owner:'soviet',nationality:'soviet',class:'mechanized',size:'corps',
  hex:'0309',openingHex:'0309',mp:6,printedCombatStrength:null,strengthStatus:'untried'})
}};
const ctx={map:LMap,profile:LMovement,config:LPhase,cursor:cursor(3),actor:'german',
 state:scenario,counterConfig:KCounters,combatPolicy:simulated};
ctx.cursor.scenarioId='leningrad';
const battle=[{defenderHex:'0309',attackers:[italy.faceId]}];
const pre=Combat.create(ctx).commit(battle).select('0309');
const outcome=pre.resolveSelected({die:6});
eq(outcome.event.outcome,'DE','genuine shared B4M CRT committed and resolved');
eq(outcome.event.odds,4,'authentic Italy 4 against source-revealed Soviet defense 1');
ok(!Object.hasOwn(outcome.session.snapshot().state.units,soviet.faceId),
 'Soviet counter removed by actual shared combat transaction');
ok(Object.hasOwn(outcome.session.snapshot().state.units,italy.faceId));
eq(pre.snapshot().state.units[soviet.faceId].strengthStatus,'untried','unrevealed before committed die');
eq(scenario.units[soviet.faceId].strengthStatus,'untried','input state untouched');
eq(outcome.session.undo().session.snapshot().status,'battle-selected','true Undo before resolution');
const noOverride=clone(simulated);delete noOverride.counterFaceClassOverrides;
bad(()=>Combat.create({...ctx,combatPolicy:noOverride}).commit(battle).select('0309').resolveSelected({die:6}),
 /Combat counter affiliation\/class mismatch/,'Italian mobility identity cannot be silently discarded');
for(const mutate of [
 p=>{p.counterFaceClassOverrides[italy.faceId].printedIdentifier='not photographed';},
 p=>{p.counterFaceClassOverrides[italy.faceId].unitClass='infantry';},
 p=>{p.counterFaceClassOverrides['kiev-front-r01c01']=p.counterFaceClassOverrides[italy.faceId];}
]){
 const invalid=clone(simulated);mutate(invalid);
 bad(()=>Combat.create({...ctx,combatPolicy:invalid}).commit(battle).select('0309').resolveSelected({die:6}),
 /class exception lacks exact photographed face evidence/,'face override cannot be broadened');
}
// Separate game controls remain unmodified; the Kiev profile does not alter
// the accepted Arduous / Leningrad input source configs.
eq(LCombat.counterFaceClassOverrides,undefined);
eq(LCombat.requireFirstTurnTerritorialRestriction,undefined);
eq(KPhase.mode,'phase-simulation-only');
const audit={checkpoint:238,version:'v472',scope:'test-only Kiev combat source profile, shared-engine class exception and guard; NO game activation',
 assertions,source:{rulebookSha256:prior.sourceSha256,aidSha256:sourceAid.sha256,
  frontSha256:KCounters.faceSource.front.sha256,backSha256:KCounters.faceSource.back.sha256},
 proof:{italianSourceFace:italy.faceId,italianOfficialIdentity:it.printedIdentifier,
  combatResult:outcome.event.outcome,combatOdds:outcome.event.odds,
  airMarkers:markers.map(m=>({faceId:m.faceId,printed:m.identifier,shift:m.shiftRating})),
  nationalTerritoryCertified:false,provisionalMovementGraphOnly:true,gameplayAuthorized:false}};
if(process.argv.includes('--write-audit'))fs.writeFileSync(path.join(root,'rules/audit/kiev-combat-policy-v472.json'),JSON.stringify(audit,null,2)+'\n');
console.log('PASS Kiev v472 source-profile + photographed Italian / air / certified-board combat: '+assertions+' assertions; Kiev live gate CLOSED');
