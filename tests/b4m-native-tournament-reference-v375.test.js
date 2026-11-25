/* Checkpoint 141: six source-listed tournament outcomes, step bonuses,
 * communication exceptions, and disabled game-mode boundary. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const E=require('../core/engine.js'),P=require('../core/native_preview_config.js');
const T=require('../core/native_tournament_scoring.js'),City=require('../core/native_city_status.js'),S=require('../core/session.js');
const r=name=>JSON.parse(fs.readFileSync('games/battle-for-moscow/'+name+'.json','utf8'));
const input=Object.fromEntries(['game','map','units','deployments','rules','objectives'].map(k=>[k,r(k)]));
const g=E.build(P.project(input,r('native-preview/config')));
const initial=E.start(g,1941,'auto-reference'),hash=JSON.stringify(initial),moscow='10,2',tula='10,6';
const visual=JSON.parse(fs.readFileSync('maps/battle-for-moscow.json','utf8'));
const assess=(s)=>T.read(g,s);
const result=(s,m='soviet',t='soviet')=>{s.control[moscow]=m;s.control[tula]=t;return assess(s);};
assert.equal(T.validate(g,g.objectives.tournamentVariant).decisions.length,6);
assert.equal(assess(initial).primary.id,'soviet-decisive');
assert.deepEqual(assess(initial).points,{german:1,soviet:3});
assert.equal(assess(initial).stepCounts[0].count,16);
assert.equal(assess(initial).bonuses[0].id,'panzer-preservation');
assert.equal(E.result(g,initial),'soviet');
const cases=[];
function check(id,moscowOwner,tulaOwner,expected){
 const s=structuredClone(initial),v=result(s,moscowOwner,tulaOwner);
 assert.equal(v.primary.id,id);assert.deepEqual(v.points,expected);
 assert.equal(v.gameplayEnabled,false);assert.equal(v.setupAvailable,false);
 cases.push({id,points:v.points});
}
check('german-decisive','german','german',{german:4,soviet:0});
check('german-major','german','soviet',{german:3,soviet:0});
check('soviet-minor','soviet','german',{german:1,soviet:1});
check('soviet-decisive','soviet','soviet',{german:1,soviet:3});
// Isolate a city by occupying all six surrounding hexes with enemy counters.
// This fixture is constructed for victory-communication testing; it is not a
// claimed legal Battle for Moscow turn history.
function cordon(...hexes){
 const s=structuredClone(initial);
 for(const u of s.units)u.position=null;
 const positions=hexes.flatMap(([x,y])=>E.neighbors(x,y));
 const defenders=s.units.filter(u=>u.army==='german');assert(defenders.length>=positions.length);
 positions.forEach((p,i)=>{assert(g.playable(p.x,p.y));defenders[i].position={x:p.x,y:p.y};});
 return s;
}
const isolatedM=cordon([10,2]);
assert.equal(E.communication(g,isolatedM,{position:{x:10,y:2},faction:'soviet'},'soviet'),true,
 'Moscow replacement exception must remain in force');
assert.equal(E.communication(g,isolatedM,{position:{x:10,y:2},faction:'soviet'},'soviet',{ignoreCapitalException:true}),false,
 'Tournament rule 10 communication must not use replacement-only capital exception');
const gm=result(isolatedM,'soviet','german');
assert.equal(gm.ambiguous,true,'Published German and Soviet minor conditions overlap when Moscow is isolated');
assert.equal(gm.primary,null);assert.equal(gm.points,null);
assert.deepEqual(gm.eligible.map(d=>d.id),['german-minor','soviet-minor']);
assert.equal(gm.connections['soviet:10,2'],false);
cases.push({id:'overlapping-german-and-soviet-minor',eligible:gm.eligible,bonusPoints:gm.bonusPoints});
const isolatedT=cordon([10,6]);
const tm=result(isolatedT,'soviet','soviet');
assert.equal(tm.primary.id,'soviet-major');
assert.equal(tm.connections['soviet:10,2'],true);
assert.equal(tm.connections['soviet:10,6'],false);
cases.push({id:'soviet-major',points:tm.points});
const both=cordon([10,2],[10,6]);
assert.equal(result(both,'soviet','soviet').primary.id,'soviet-major');
// Bonus step thresholds from the actual counter roster, never strength numbers.
const byStrength=(target)=>{
 const s=structuredClone(initial),tanks=s.units.filter(u=>u.army==='german'&&u.type==='tank');
 const positions=tanks.map(u=>u.position);
 for(const u of tanks)u.position=null;
 let remaining=target;
 for(const [i,u] of tanks.entries()){
  if(remaining>=2){u.strength='full';u.position=structuredClone(positions[i]);remaining-=2;}
  else if(remaining===1){u.strength='reduced';u.position=structuredClone(positions[i]);remaining--;}
 }
 assert.equal(remaining,0);return s;
};
for(const [steps,bonus] of [[0,'panzer-attrition'],[7,'panzer-attrition'],[8,null],[11,null],[12,'panzer-preservation'],[16,'panzer-preservation']]){
 const t=assess(byStrength(steps));assert.equal(t.stepCounts[0].count,steps);
 assert.deepEqual(t.bonuses.map(b=>b.id),bonus?[bonus]:[]);
}
assert.throws(()=>result(structuredClone(isolatedM),'soviet',null),/no matching tournament outcome/);
// Unknown owners cannot map into a valid outcome silently.
const bad=structuredClone(initial);delete bad.control[tula];
assert.throws(()=>assess(bad),/no matching tournament outcome/);
const dup=structuredClone(g.objectives.tournamentVariant);dup.profile.decisions.push(structuredClone(dup.profile.decisions[0]));
assert.throws(()=>T.validate(g,dup),/duplicate outcomes/);
const badPredicate=structuredClone(g.objectives.tournamentVariant);badPredicate.profile.decisions[0].if.children[0].cell=[40,40];
assert.throws(()=>T.validate(g,badPredicate),/scored city is missing/);
const overlap=structuredClone(g.objectives.tournamentVariant);overlap.allowedOverlaps=[];
assert.throws(()=>T.read(g,isolatedM,overlap),/unregistered overlapping outcomes/);
const unsupported=structuredClone(g.objectives.tournamentVariant);unsupported.enabled=true;
assert.throws(()=>T.read(g,initial,unsupported),/gated reference profile/);
assert.equal(JSON.stringify(initial),hash,'No scoring side effects');
const session=S.create({scenarioId:g.game.id,engine:'generic-hex-v1',config:g,state:initial});
const saveHash=S.serialize(session).sha256;
const city=City.read(session,visual);assert.equal(city.tournamentPreview.primary.id,'soviet-decisive');
assert.equal(city.tournamentAvailable,false);assert.equal(city.cities.find(c=>c.name==='Moscow').objective,true);
assert.equal(city.cities.find(c=>c.name==='Tula').objective,false);
assert.equal(S.serialize(session).sha256,saveHash,'Reference scoring must not mutate save hash');
assert.equal(input.game.engine,'generic-hex-v1');
console.log(JSON.stringify({status:'PASS',checkpoint:141,version:'v375',primaryCases:cases,
 bonusThresholds:[0,7,8,11,12,16],communication:['Moscow isolated','Tula isolated','both isolated'],
 mode:'disabled read-only reference',production:input.game.engine}));
