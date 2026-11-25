'use strict';
/* Checkpoint 151: Leningrad §§6,10.5,11,13.3 source-faced air-sea and ground
 * use. Opt-in only, not an eight-turn campaign or certified save session. */
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const Air=require('../core/historical_air_support'),Combat=require('../core/historical_combat_phase');
const Bridge=require('../core/scenario_opening_bridge'),Port=require('../core/historical_port_support');
const M=require('../maps/leningrad.json'),K=require('../maps/counter-configs/leningrad.json');
const S=require('../maps/setup/leningrad.json'),P=require('../maps/movement-configs/leningrad.json');
const F=require('../maps/phase-configs/leningrad.json'),Q=require('../maps/combat-configs/leningrad.json');
const I=require('../core/leningrad_starting_inventory'),fixture=require('./fixtures/leningrad-source-setup-v357');
const copy=v=>JSON.parse(JSON.stringify(v));let assertions=0;
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);assertions++};
const yes=(x,m)=>{assert.ok(x,m);assertions++};
const bad=(f,re)=>{assert.throws(f,re);assertions++};
const origin=Bridge.create({map:M,setupSpec:S,counterConfig:K,inventory:I,allocation:fixture.selected,
 placements:fixture.placements,phaseConfig:F,movementProfile:P,phaseFactories:{combat:()=>({})},supportPolicy:Q}).snapshot();
const port=Port.create({map:M,policy:Q,counterConfig:K}),ports=port.portHexes;
const air=Air.create({map:M,combatPolicy:Q,counterConfig:K,phaseConfig:F});
const one='leningrad-front-r04c05',two='leningrad-front-r04c04',first=origin.cursor;
eq(air.markerFaces,[one,two]);
eq(air.available({state:origin.state,cursor:first,actor:'german'}).map(x=>x.faceId),[one]);
const six={...first,turn:6};
eq(air.available({state:origin.state,cursor:six,actor:'german'}).map(x=>[x.faceId,x.shiftRating]),[[one,1],[two,2]]);
bad(()=>air.available({state:origin.state,cursor:first,actor:'soviet'}),/owning Combat/);
bad(()=>air.available({state:origin.state,cursor:{...first,index:3},actor:'german'}),/owning Combat/);
bad(()=>air.ground({state:origin.state,cursor:first,actor:'german',faceId:two}),/not arrived/);
bad(()=>air.ground({state:origin.state,cursor:first,actor:'german',faceId:'bogus'}),/Unregistered/);
bad(()=>air.attackFleet({state:origin.state,cursor:first,actor:'german',faceId:one,die:0}),/six-sided/);
// Explicitly certify each die face for both source air Shift Ratings.
for(const [face,turn,rating] of [[one,1,1],[two,6,2]])for(let die=1;die<=6;die++){
 const cursor={...first,turn},saved=copy(origin.state);
 const res=air.attackFleet({state:origin.state,cursor,actor:'german',faceId:face,die});
 eq(res.event.hit,die<=rating);eq(res.event.shiftRating,rating);eq(res.event.die,die);
 eq(res.event.resultCondition,die<=rating?'damaged':'undamaged');
 eq(res.state.supportMarkers.balticFleet.condition,die<=rating?'damaged':'undamaged');
 eq(res.state.airUse[String(turn)][face],'fleet');
 eq(origin.state,saved,'source unmodified');
 bad(()=>air.ground({state:res.state,cursor,actor:'german',faceId:face}),/already committed/);
 bad(()=>air.attackFleet({state:res.state,cursor,actor:'german',faceId:face,die:6}),/already committed/);
}
// A second naval hit eliminates; remaining air unit may not attack a missing Fleet.
const sea1=air.attackFleet({state:origin.state,cursor:six,actor:'german',faceId:one,die:1});
const sea2=air.attackFleet({state:sea1.state,cursor:six,actor:'german',faceId:two,die:2});
eq(sea2.event.resultCondition,'eliminated');eq(sea2.state.supportMarkers.balticFleet,undefined);
bad(()=>air.attackFleet({state:sea2.state,cursor:six,actor:'german',faceId:one,die:1}),/Fleet marker absent/);
// A miss never consumes the Fleet: only the Air Corps is used.
const missed=air.attackFleet({state:origin.state,cursor:first,actor:'german',faceId:one,die:6});
eq(missed.state.supportMarkers.balticFleet,origin.state.supportMarkers.balticFleet);
bad(()=>air.ground({state:missed.state,cursor:first,actor:'german',faceId:one}),/already committed/);
const ground=air.ground({state:origin.state,cursor:first,actor:'german',faceId:one});
eq(ground.shiftRating,1);eq(ground.state.airUse['1'][one],'ground');
bad(()=>air.attackFleet({state:ground.state,cursor:first,actor:'german',faceId:one,die:1}),/already committed/);
const nextTurn=air.available({state:ground.state,cursor:{...first,turn:2},actor:'german'});
eq(nextTurn.map(x=>x.faceId),[one],'air marker refreshes in subsequent turn');
// Opt-in integrated battle: one German ground air shift produces a different
// CRT column, with immutable source state and replayable Undo.
const sourceUnits=Object.values(origin.state.units),german=sourceUnits.filter(x=>x.owner==='german');
const used=new Set(),attackers=[12,10,8,8].map(s=>{const u=german.find(x=>x.printedCombatStrength===s&&!used.has(x.id));if(u)used.add(u.id);return u;});
const defender=sourceUnits.find(x=>x.owner==='soviet'&&x.printedCombatStrength===8);
yes(attackers.every(Boolean)&&defender);
const state={scenarioId:'leningrad',units:{},supportMarkers:{balticFleet:{...copy(origin.state.supportMarkers.balticFleet),hex:ports.Riga}}};
['0607','0608','0807','0808'].forEach((hex,i)=>state.units[attackers[i].id]={...copy(attackers[i]),hex});
state.units[defender.id]={...copy(defender),hex:ports.Riga};
const battle={defenderHex:ports.Riga,attackers:attackers.map(x=>x.id)};
function create(st=state,cursor=first){return Combat.create({map:M,profile:P,config:F,cursor,actor:'german',state:st,
 counterConfig:K,combatPolicy:Q,enableAirSupport:true});}
const session=create(),initialSnapshot=session.snapshot(),saved=copy(state);
eq(initialSnapshot.status,'air-sea-open');
eq(session.availableAir().map(x=>x.faceId),[one]);
bad(()=>session.commit([battle]),/Combat declarations already committed/);
const navalPending=session.declareFleetAttack(one);
eq(navalPending.snapshot().pendingSeaFaceId,one);
bad(()=>navalPending.finishAirSea(),/unresolved die/);
bad(()=>navalPending.declareFleetAttack(two),/before the damage roll/);
bad(()=>session.resolveFleetAttack(1),/declared before/);
const naval=navalPending.resolveFleetAttack(1);
eq(naval.event.resultCondition,'damaged');eq(naval.session.snapshot().state.airUse['1'][one],'fleet');
eq(naval.session.undo().session.snapshot(),navalPending.snapshot());
eq(naval.session.undo().session.undo().session.snapshot(),initialSnapshot);
bad(()=>naval.session.declareFleetAttack(one),/unavailable/);
const navalClosed=naval.session.finishAirSea();
eq(navalClosed.snapshot().status,'awaiting-declarations');
bad(()=>navalClosed.declareFleetAttack(one),/before the damage roll/);
bad(()=>navalClosed.commit([battle]).select(ports.Riga).commitGroundAir(one),/unavailable/);
// No Fleet strike: ground shift can be used after deliberately closing the
// naval attack window, and the committed battle is still CRT-driven.
const ready=session.finishAirSea();
eq(ready.undo().session.snapshot(),initialSnapshot);
const selected=ready.commit([battle]).select(ports.Riga);
const explicitStrengths=Object.fromEntries([...attackers,defender].map(u=>[u.id,{kind:u.class,value:u.printedCombatStrength}]));
const beforeOdds=selected.evaluateSelectedFromMap({strengths:explicitStrengths,die:1});
const withOdds=selected.evaluateSelectedFromMap({strengths:explicitStrengths,airSupportId:one,die:1});
eq(withOdds.finalOdds,beforeOdds.finalOdds+1);
bad(()=>selected.evaluateSelectedFromMap({strengths:explicitStrengths,airSupportShift:6}),/arbitrary shift/);
bad(()=>selected.commitGroundAir(two),/unavailable/);
bad(()=>selected.resolveSelected({die:1,airSupportId:one}),/Unbound support/);
bad(()=>selected.resolveSelected({die:1}),/Commit ground air choice/);
// At the actual 4:1 column, die 1 yields DR: Fleet-supported defenders
// may exercise the independently verified port retreat exception.
const airCommitted=selected.commitGroundAir(one);
eq(airCommitted.snapshot().groundAirLocked,true);
bad(()=>airCommitted.commitGroundAir(null),/before combat die/);
const result=airCommitted.resolveSelected({die:1,choices:{ignoreRetreat:true}});
eq(result.event.outcome,'DR');eq(result.event.airSupport.shiftRating,1);
eq(result.session.snapshot().state.airUse['1'][one],'ground');
eq(result.session.undo().session.snapshot(),airCommitted.snapshot());
eq(result.session.undo().session.undo().session.snapshot(),selected.snapshot());
eq(state,saved,'integrated transaction did not modify input');
eq(airCommitted.resolveSelected({die:1,choices:{ignoreRetreat:true}}).event,result.event,'deterministic replay');
// A Sea attack and committed ground support are mutually exclusive. A new
// turn permits reuse, and Turn 6 adds only the historically scheduled marker.
const sixSession=create(state,six),both=sixSession.availableAir();eq(both.length,2);
const firstHit=sixSession.declareFleetAttack(one).resolveFleetAttack(1);
eq(firstHit.session.availableAir().map(x=>x.faceId),[two]);
const destroyed=firstHit.session.declareFleetAttack(two).resolveFleetAttack(2);eq(destroyed.event.resultCondition,'eliminated');
eq(destroyed.session.availableAir(),[]);
// A second-pass audit of the reusable source and shared engine gate.
const wrong=copy(Q);wrong.airSupport.markers[0].shiftRating=4;
bad(()=>Air.create({map:M,counterConfig:K,combatPolicy:wrong,phaseConfig:F}),/Shift Rating/);
const forged=copy(K);forged.faces.front.find(x=>x.faceId===one).visualTranscription.printedIdentifier='injected';
bad(()=>Air.create({map:M,counterConfig:forged,combatPolicy:Q,phaseConfig:F}),/source face/);
const sourceText=fs.readFileSync('core/historical_air_support.js','utf8');
yes(!/if\s*\([^)]*scenarioId\s*===\s*['"]leningrad['"]/.test(sourceText));
const audit={checkpoint:151,version:'v385',source:'references/rules/leningrad-rules.pdf §§6, 10.5, 11, 13.3',
 pdfSha256:crypto.createHash('sha256').update(fs.readFileSync('references/rules/leningrad-rules.pdf')).digest('hex'),
 assertions,airMarkers:[...Q.airSupport.markers],verified:['Turn 1/Turn 6 availability','source-faces and shifts',
 'one die per Fleet attack','once per turn mutual exclusion of sea and ground air use',
 'Fleet first-hit damage and second-hit elimination','pre-declaration air-sea phase gate',
 'source-bound ground shifts change B4M CRT column','transaction Undo and deterministic replay'],
 limits:['Opt-in German combat transaction; no full eight-turn orchestration or human browser air choices',
 'Air-use tracking is in bounded game state, not yet included in the versioned full-campaign save contract',
 'Turn-6 arrival is source-scheduled availability, not yet a general reinforcement event',
 'Independent source-executable parity unverified']};
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/leningrad-air-sea-support-v385.json',JSON.stringify(audit,null,2)+'\n');
console.log('PASS v385:',assertions,'source-bound air-sea/ground support checks');
