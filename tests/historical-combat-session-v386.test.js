'use strict';
/* v386: source-validated replay/Undo of a Leningrad combat phase, including
 * pending dice commitments. This does not certify full campaign saving. */
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const Session=require('../core/historical_combat_session');
const Bridge=require('../core/scenario_opening_bridge'),Port=require('../core/historical_port_support');
const M=require('../maps/leningrad.json'),K=require('../maps/counter-configs/leningrad.json');
const S=require('../maps/setup/leningrad.json'),P=require('../maps/movement-configs/leningrad.json');
const F=require('../maps/phase-configs/leningrad.json'),Q=require('../maps/combat-configs/leningrad.json');
const I=require('../core/leningrad_starting_inventory'),fixture=require('./fixtures/leningrad-source-setup-v357');
const copy=x=>JSON.parse(JSON.stringify(x));let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++};
const yes=(x,label)=>{assert.ok(x,label);checks++};
const fail=(fn,re)=>{assert.throws(fn,re);checks++};
const origin=Bridge.create({map:M,setupSpec:S,counterConfig:K,inventory:I,allocation:fixture.selected,
 placements:fixture.placements,phaseConfig:F,movementProfile:P,phaseFactories:{combat:()=>({})},supportPolicy:Q}).snapshot();
const ports=Port.create({map:M,policy:Q,counterConfig:K}).portHexes;
const airFace='leningrad-front-r04c05';
const source=Object.values(origin.state.units),germans=source.filter(x=>x.owner==='german');
const used=new Set(),attackers=[12,10,8,8].map(strength=>{
 const unit=germans.find(x=>x.printedCombatStrength===strength&&!used.has(x.id));
 if(unit)used.add(unit.id);return unit;
});
const defender=source.find(x=>x.owner==='soviet'&&x.printedCombatStrength===8);
yes(attackers.every(Boolean)&&Boolean(defender));
const state={scenarioId:'leningrad',units:{},supportMarkers:{balticFleet:{...copy(origin.state.supportMarkers.balticFleet),hex:ports.Riga}}};
['0607','0608','0807','0808'].forEach((hex,i)=>state.units[attackers[i].id]={...copy(attackers[i]),hex});
state.units[defender.id]={...copy(defender),hex:ports.Riga};
const context={map:M,profile:P,config:F,cursor:origin.cursor,actor:'german',state,
 counterConfig:K,combatPolicy:Q,enableAirSupport:true};
const battles=[{defenderHex:ports.Riga,attackers:attackers.map(x=>x.id)}];
const base=Session.create(context),baseSnapshot=base.snapshot();
eq(baseSnapshot.status,'air-sea-open');eq(baseSnapshot.actionCount,0);
fail(()=>base.execute({type:'roll-fleet-attack',die:1}),/declared before/);
fail(()=>base.execute({type:'declare-fleet-attack',faceId:airFace,extra:true}),/fields/);
fail(()=>base.execute({type:'commit-battles',battles}),/already committed/);
let session=base;
function act(a){session=session.execute(a).session;return session;}
function roundTrip(phase){
 const saved=session.save();eq(saved.integrity.algorithm,'SHA-256');
 const restored=Session.restore(copy(saved),context);
 eq(restored.snapshot(),session.snapshot(),'state equals after restore: '+phase);
 eq(restored.save(),saved,'journal equals after restore: '+phase);
 return restored;
}
let stage=act({type:'declare-fleet-attack',faceId:airFace});
eq(stage.snapshot().pendingSeaFaceId,airFace);
fail(()=>stage.execute({type:'finish-air-sea'}),/unresolved die/);
roundTrip('pending-fleet-die');
stage=act({type:'roll-fleet-attack',die:6});
eq(stage.snapshot().state.airUse['1'][airFace],'fleet');
eq(stage.snapshot().state.supportMarkers.balticFleet.condition,'undamaged');
roundTrip('post-fleet-roll');
stage=act({type:'finish-air-sea'});eq(stage.snapshot().status,'awaiting-declarations');
stage=act({type:'commit-battles',battles});eq(stage.snapshot().status,'committed');
stage=act({type:'select-battle',defenderHex:ports.Riga});eq(stage.snapshot().status,'battle-selected');
fail(()=>stage.execute({type:'commit-ground-air',faceId:airFace}),/unavailable/);
stage=act({type:'commit-ground-air',faceId:null});
eq(stage.snapshot().groundAirLocked,true);
roundTrip('committed-none-before-ground-die');
fail(()=>stage.execute({type:'resolve-battle',die:1,choices:{ignoreRetreat:false}}),/retreat|choice|route|step|not allowed|illegal/i);
// A full ground-result choice without a retreat path is intentionally refused;
// choose the existing Fleet-port exception instead.
const outcome=stage.execute({type:'resolve-battle',die:1,choices:{ignoreRetreat:true}});
session=outcome.session;yes(Boolean(outcome.event.outcome));
roundTrip('after-ground-combat');
stage=act({type:'finish-combat'});
eq(stage.snapshot().status,'phase-finished');
eq(stage.snapshot().cursor.index,3);
roundTrip('after-combat-phase');
// End-to-end action journal must exactly preserve source state, choices and
// the distinction between committing an air unit and rolling for it.
const full=session.save();eq(full.journal.length,8);
eq(full.journal.map(j=>j.action.type),[
 'declare-fleet-attack','roll-fleet-attack','finish-air-sea','commit-battles',
 'select-battle','commit-ground-air','resolve-battle','finish-combat']);
let undone=session;
for(let n=full.journal.length;n>0;n--){
 const result=undone.undo();eq(result.ok,true);
 undone=result.session;eq(undone.snapshot().actionCount,n-1);
 const replay=Session.restore(undone.save(),context);
 eq(replay.snapshot(),undone.snapshot());
}
eq(undone.snapshot(),baseSnapshot);
eq(undone.undo().ok,false);
eq(Session.restore(full,context).snapshot(),session.snapshot());
// No arbitrary continuation through phase boundaries: restored completed
// combat sessions cannot resolve battles or bypass a pending pre-roll choice.
fail(()=>session.execute({type:'resolve-battle',die:1,choices:{}}),/not awaiting resolution|before resolution|Select a committed battle/);
const pending=Session.create(context).execute({type:'declare-fleet-attack',faceId:airFace}).session;
const pendingRestored=Session.restore(pending.save(),context);
fail(()=>pendingRestored.execute({type:'finish-air-sea'}),/unresolved die/);
eq(pendingRestored.execute({type:'roll-fleet-attack',die:1}).session.snapshot().state.supportMarkers.balticFleet.condition,'damaged');
// Pure source-supplied context binding; a digest cannot authenticate a foreign
// opening state, so restore REQUIRES the expected opening from trusted caller.
const variants=[
 [{...context,state:{...copy(state),units:{}}},/opening state mismatch/],
 [{...context,combatPolicy:{...copy(Q),crtId:'different-crt'}},/source\/configuration mismatch/],
 [{...context,map:{...copy(M),id:'unexpected-map'}},/source\/configuration mismatch/],
 [{...context,enableAirSupport:false},/source\/configuration mismatch/]
];
for(const [other,re] of variants)fail(()=>Session.restore(full,other),re);
let forged=copy(full);forged.journal[0].action.faceId='bogus';
fail(()=>Session.restore(forged,context),/checksum mismatch/);
// Even if an adversary recalculates the unkeyed checksum, transaction replay
// refuses illegal actions and modified outcome chains.
function resign(e){const {integrity,...body}=e;
 const sorted=(v)=>Array.isArray(v)?v.map(sorted):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sorted(v[k])])):v;
 e.integrity.digest=crypto.createHash('sha256').update(JSON.stringify(sorted(body))).digest('hex');return e;
}
fail(()=>Session.restore(resign(forged),context),/unavailable|marker|Unregistered/);
for(const field of ['stateHash','finalStateHash']){
 const altered=copy(full);
 if(field==='stateHash')altered.journal[1].stateHash='0'.repeat(64);
 else altered.finalStateHash='0'.repeat(64);
 fail(()=>Session.restore(resign(altered),context),/replay mismatch/);
}
const phaseConfig=copy(F);phaseConfig.phases[2].permissions=[];
fail(()=>Session.restore(full,{...context,config:phaseConfig}),/source\/configuration mismatch/);
fail(()=>Session.restore({...copy(full),format:'unexpected'},context),/Unsupported combat save/);
const malformed=copy(full);malformed.journal.push({action:{type:'unexpected'},stateHash:'0'.repeat(64)});
fail(()=>Session.restore(resign(malformed),context),/Unsupported combat session action/);
// Ground-support branch: saved pre-commit marker choice cannot be rewritten
// to a Fleet attack after the ground die is committed.
const groundReady=Session.create(context).execute({type:'finish-air-sea'}).session
 .execute({type:'commit-battles',battles}).session
 .execute({type:'select-battle',defenderHex:ports.Riga}).session
 .execute({type:'commit-ground-air',faceId:airFace}).session;
const groundRestored=Session.restore(groundReady.save(),context);
eq(groundRestored.snapshot().groundAirChoice,airFace);
eq(groundRestored.snapshot().groundAirLocked,true);
const supported=groundRestored.execute({type:'resolve-battle',die:1,choices:{ignoreRetreat:true}});
eq(supported.event.airSupport.shiftRating,1);
eq(supported.session.snapshot().state.airUse['1'][airFace],'ground');
eq(supported.session.undo().session.snapshot(),groundRestored.snapshot());
fail(()=>groundRestored.execute({type:'roll-fleet-attack',die:1}),/declared before/);
const rootState=copy(state);
eq(base.snapshot().state,rootState,'source state remained immutable');
// Successor sessions share private source and journal storage. Verify all
// public inputs/outputs remain detached, including sibling branches.
const isolatedContext=copy(context), isolated=Session.create(isolatedContext);
const isolatedSave=isolated.save();
isolatedContext.state.units={};isolatedContext.map.cells.length=0;
eq(isolated.save(),isolatedSave,'caller context detached');
const left=isolated.execute({type:'declare-fleet-attack',faceId:airFace}).session;
const leftSave=left.save(), right=left.execute({type:'roll-fleet-attack',die:1});
const rightSave=right.session.save();
const leaked=right.session.save();leaked.journal[0].action.faceId='changed';leaked.origin.state.units={};leaked.bindings.scopeHash='changed';
const snapshotLeak=right.session.snapshot();snapshotLeak.state.units={};
right.event.die=99;
eq(right.session.save(),rightSave,'public outputs detached');
eq(left.save(),leftSave,'parent journal unchanged');
eq(isolated.save(),isolatedSave,'root unchanged');
const sibling=left.execute({type:'roll-fleet-attack',die:6}).session;
eq(right.session.save(),rightSave,'sibling journal isolated');
eq(sibling.undo().session.save(),leftSave,'sibling undo exact');
const actionInput={type:'commit-battles',battles:copy(battles)};
const committed=isolated.execute({type:'finish-air-sea'}).session.execute(actionInput).session;
const committedSave=committed.save();actionInput.battles[0].attackers.length=0;
eq(committed.save(),committedSave,'nested action input detached');
const restoreInput=copy(rightSave), restoredIsolated=Session.restore(restoreInput,context);
restoreInput.journal[0].action.faceId='changed';restoreInput.origin.state.units={};
eq(restoredIsolated.save(),rightSave,'restore envelope detached');
// Canonical save validation remains fail-closed for untrusted values.
for(const key of ['__proto__','prototype','constructor']){
 const bad=copy(full);Object.defineProperty(bad.origin.state,key,{value:1,enumerable:true});
 fail(()=>Session.restore(bad,context),/Forbidden combat save key/);
}
const cyclic=copy(full);cyclic.origin.state.loop=cyclic;
fail(()=>Session.restore(cyclic,context),/Cyclic combat save value/);
const sparse=copy(full);delete sparse.journal[0];
fail(()=>Session.restore(sparse,context),/Sparse combat save array/);
const nonFinite=copy(full);nonFinite.origin.state.invalid=Infinity;
fail(()=>Session.restore(nonFinite,context),/Unsupported combat save value/);
const audit={checkpoint:152,version:'v386',assertions:checks,scope:'opt-in source-bound combat-phase persistence',
 paths:['Fleet precommit and die','air-use ledger','battle declaration and selection','ground air no-choice precommit',
 'source-configured CRT consequence','phase finish','phase-level Undo','tamper and source-binding validation'],
 excluded:['Full eight-turn campaign orchestration','movement and forced entry in same session',
 'save from arbitrary source claims','full historical setup certification','human UX alignment']};
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/leningrad-combat-session-v386.json',JSON.stringify(audit,null,2)+'\n');
console.log('PASS v386:',checks,'replay-validated historical combat session assertions');
