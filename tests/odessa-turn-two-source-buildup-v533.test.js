'use strict';
/* Original Kiev §11/§12 and Odessa §11; real campaign journal, provisional
 * composite movement/entry graph. No certification claim for the expansion. */
const assert=require('node:assert/strict');
const Campaign=require('../core/historical_campaign_session');
const Human=require('../core/historical_campaign_human');
const Buildup=require('../core/historical_buildup_phase');
const root=x=>require('../'+x);
const sample=root('games/kiev-odessa/experimental-preview/opening-v531.json').contextStart;
const map=root('maps/kiev-odessa-composite-experimental-v531.json');
const policy=root('maps/buildup-configs/kiev-odessa-experimental-v533.json');
const allocation=root('games/kiev-odessa/experimental-preview/allocation-v533.json');
const base={...structuredClone(sample),map,profile:root('maps/movement-configs/kiev-odessa-experimental-v531.json'),
 config:root('maps/phase-configs/kiev-odessa.json'),counterConfig:root('maps/counter-configs/kiev-odessa-experimental-v531.json'),
 combatPolicy:root('maps/combat-configs/kiev-odessa-experimental-v531.json'),
 rosterOverlay:root('maps/roster-overlays/kiev-odessa.json'),enableAirSupport:true,
 buildupPolicy:policy,buildupAllocation:allocation,
 housekeepingPolicy:root('maps/housekeeping-configs/kiev-odessa-candidate-v521.json')};
let n=0;
function eq(actual,expected,label){assert.deepStrictEqual(actual,expected,label);n++}
function yes(value,label){assert.ok(value,label);n++}
function no(action,pattern,label){assert.throws(action,pattern,label);n++}
function step(session,action){return session.execute(action).session}
function toGermanTwo(context){
 let s=Campaign.create(context);
 for(const action of [
  {type:'combat',action:{type:'finish-air-sea'}},
  {type:'combat',action:{type:'commit-battles',battles:[]}},
  {type:'combat',action:{type:'finish-combat'}},
  {type:'finish-phase'},
  {type:'finish-buildup'},
  {type:'finish-phase'},
  {type:'finish-phase'}, // dedicated Naval Operations
  {type:'combat',action:{type:'commit-battles',battles:[]}},
  {type:'combat',action:{type:'finish-combat'}},
  {type:'finish-phase'},
  {type:'finish-housekeeping'}])s=step(s,action);
 eq(s.snapshot().phaseId,'german-buildup','Real Turn 2 German Buildup reached after housekeeping');
 eq(s.snapshot().cursor.turn,2,'Second turn');
 return s;
}
const initial=Campaign.create(base), start=initial.snapshot();
eq(Object.keys(start.state.units).length,36,'All 36 ground units retained');
eq(start.state.buildupDeployedIds.length,36,'Source-face initial ground ledger includes six aliased pieces');
eq(start.phaseSupported,true,'Source-locked initial campaign supported');
eq(policy.entryEdge.soviet.length,16,'Active 16-edge-hex Soviet boundary');
eq(policy.entryEdge.german.length,23,'Active combined Axis boundary');
eq(policy.supportArrivals[0].faceId,'odessa-front-r01c07','Romanian original photo marker');
let game=toGermanTwo(base);
const g2=game.snapshot(), germanView=Human.create({session:game,context:base}).view();
yes(germanView.commands.some(c=>c.type==='place-reinforcement'&&c.slotId==='t2-slovak'), 'Slovak player placement offered');
yes(germanView.commands.some(c=>c.type==='place-reinforcement'&&c.slotId==='t2-hungarian'), 'Hungarian player placement offered');
no(()=>step(game,{type:'place-reinforcement',slotId:'t3-german-infantry',hex:'0101'}),/not due/i,'Turn 3 unit cannot arrive Turn 2');
no(()=>step(game,{type:'place-reinforcement',slotId:'t2-slovak',hex:'1914'}),/illegal reinforcement/i,'Axis cannot enter Soviet edge');
no(()=>step(game,{type:'place-reinforcement',slotId:'t2-hungarian',hex:'0709'}),/illegal reinforcement|overstack|Hungarian|national/i,'Hungarian cannot be admitted in Romanian territory');
yes(step(game,{type:'place-reinforcement',slotId:'t2-hungarian',hex:'0102'}).snapshot().state.units['kiev-front-r04c08'].hex==='0102','Adjudicated outside edge admits Hungarian unit');
const hungarianOptions=germanView.commands.filter(c=>c.slotId==='t2-hungarian').map(c=>c.hex);
yes(hungarianOptions.includes('0201'),'Lublin offered');
yes(hungarianOptions.every(h=>map.cells.find(c=>c.id===h)?.sourceTerritory==='outside'),'Catalogue offers only approved outside entry points');
const sl=step(game,{type:'place-reinforcement',slotId:'t2-slovak',hex:'0101'});
eq(sl.snapshot().state.units['kiev-front-r02c07'].nationality,'slovak','Printed Slovak national identity preserved');
eq(sl.snapshot().state.units['kiev-front-r02c07'].hex,'0101','Slovak entry on source border');
no(()=>step(sl,{type:'place-reinforcement',slotId:'t2-slovak',hex:'0102'}),/already admitted/i,'No duplicate Slovak entry');
let arrived=step(sl,{type:'place-reinforcement',slotId:'t2-hungarian',hex:'0201'});
eq(arrived.snapshot().state.units['kiev-front-r04c08'].nationality,'hungarian','Printed Hungarian identity retained');
eq(arrived.snapshot().state.units['kiev-front-r04c08'].hex,'0201','Hungarian legal entry');
eq(Object.keys(arrived.snapshot().state.units).length,38,'Both ground arrivals are on map');
eq(Campaign.restore(arrived.save(),base).snapshot(),arrived.snapshot(),'Reinforcement placements survive full journal replay');
const revert=arrived.undo();yes(revert.ok,'Undo supported');
yes(!revert.session.snapshot().state.units['kiev-front-r04c08'],'Undo reverses Hungarian placement');
arrived=step(arrived,{type:'finish-buildup'});
eq(arrived.snapshot().phaseId,'german-movement','Real Turn 2 German movement begins');
eq(arrived.snapshot().lastEvent.lostGroundSlotIds,[],'Both reinforcements admitted');
eq(arrived.snapshot().lastEvent.supportArrivals,['t2-romanian-air'],'Original Odessa Romanian air arrives Turn 2');
const forfeited=step(game,{type:'finish-buildup'});
eq(forfeited.snapshot().lastEvent.lostGroundSlotIds,['t2-slovak','t2-hungarian'],'Missed scheduled arrivals forfeited');
no(()=>step(forfeited,{type:'place-reinforcement',slotId:'t2-slovak',hex:'0101'}),/Only ground movement|phase/i,'Cannot place missed arrival in movement');
// A synthetic reduced Coastal Army is intentionally prepared to test the
// exact Odessa source-back counterpart and Fleet port replacement exception;
// this is NOT a claim that the historical starting Coastal Army was reduced.
const damaged=structuredClone(base);
const coastal=damaged.state.units['kiev-odessa/soviet-coastal-army'];
coastal.strengthStatus='printed-reduced';coastal.activeFaceId='odessa-back-r01c07';coastal.printedCombatStrength=2;
let sov=toGermanTwo(damaged);
for(const action of [
 {type:'place-reinforcement',slotId:'t2-slovak',hex:'0101'},
 {type:'place-reinforcement',slotId:'t2-hungarian',hex:'0201'},
 {type:'finish-buildup'},
 {type:'finish-phase'},
 {type:'combat',action:{type:'finish-air-sea'}},
 {type:'combat',action:{type:'commit-battles',battles:[]}},
 {type:'combat',action:{type:'finish-combat'}},
 {type:'finish-phase'}])sov=step(sov,action);
eq(sov.snapshot().phaseId,'soviet-buildup','Turn 2 Soviet Buildup now live');
eq(sov.snapshot().phaseSupported,true,'Soviet replacements supported');
let sv=Human.create({session:sov,context:damaged}).view();
yes(sv.commands.some(c=>c.type==='apply-replacement'&&c.unitId==='kiev-odessa/soviet-coastal-army'), 'Aliased Odessa Coastal Army replacement offered');
yes(sv.commands.some(c=>c.type==='apply-replacement'&&c.unitId==='kiev-front-r04c07'&&c.hex==='1914'), 'Rebuild-only Kiev Soviet Army at southern composite edge offered');
no(()=>step(sov,{type:'apply-replacement',unitId:'kiev-odessa/soviet-cavalry-corps-a',hex:null}),/not eligible|Only a reduced|counter/i,'One-step Soviet cavalry cannot be upgraded');
let restored=step(sov,{type:'apply-replacement',unitId:'kiev-odessa/soviet-coastal-army',hex:null});
eq(restored.snapshot().state.units['kiev-odessa/soviet-coastal-army'].strengthStatus,'printed-full','Source-paired Coastal Army restored');
eq(restored.snapshot().buildup.spent,1,'One replacement step spent');
no(()=>step(restored,{type:'apply-replacement',unitId:'kiev-odessa/soviet-coastal-army',hex:null}),/Only a reduced|No replacement steps remain/i,'Cannot restore same unit again');
restored=step(restored,{type:'apply-replacement',unitId:'kiev-front-r04c07',hex:'1914'});
eq(restored.snapshot().buildup.spent,2,'Exactly two Turn 2 Soviet replacement steps');
eq(restored.snapshot().state.units['kiev-front-r04c07'].hex,'1914','Source reserve built on appended eastern edge');
eq(restored.snapshot().state.units['kiev-front-r04c07'].strengthStatus,'printed-reduced','Rebuilt two-step army enters reduced');
no(()=>step(restored,{type:'apply-replacement',unitId:'kiev-front-r03c04',hex:null}),/No replacement steps remain/,'Turn 2 step allowance enforced');
const saved=restored.save();eq(Campaign.restore(saved,damaged).snapshot(),restored.snapshot(),'Two Soviet replacements replay exactly');
const undo2=restored.undo();yes(undo2.ok,'Undo restore supported');
yes(!undo2.session.snapshot().state.units['kiev-front-r04c07'],'Undo withdraws rebuilt reserve');
restored=step(restored,{type:'finish-buildup'});
eq(restored.snapshot().phaseId,'soviet-special-movement','Soviet movement unlocked after funded replacements');
eq(restored.snapshot().lastEvent.forfeitedReplacementSteps,0,'All Soviet replacement steps allocated');
// Source face and composite border fail-closed changes.
const tamperPolicy=structuredClone(base);tamperPolicy.buildupPolicy.entryEdge.soviet.pop();
no(()=>Campaign.create(tamperPolicy),/edge cells disagree/i,'Reject missing southern source edge');
const tamperAlias=structuredClone(base);tamperAlias.buildupPolicy.startingUnitAliases['kiev-odessa/soviet-coastal-army']='kiev-front-r03c04';
no(()=>Campaign.create(tamperAlias),/alias|face/i,'Reject duplicate/forged expansion source ID');
const tamperCity=structuredClone(base);tamperCity.state.cityControl.Odessa='german';
no(()=>Campaign.create(tamperCity),/city control disagrees/i,'Reject preinitialized city ownership tampering');
const tamperScope=structuredClone(base);tamperScope.buildupPolicy.entryBoundarySourceSvgSha256='0'.repeat(64);
no(()=>Campaign.create(tamperScope),/boundary scope\/source mismatch/i,'Reject unpinned active boundary hash');
console.log('PASS v533 Odessa Turn 2 shared-source Buildup',n,'assertions');
