'use strict';
const assert=require('node:assert/strict');
const E=require('../legacy/engine');
const Session=require('../core/session');
const AI=require('../core/solo_ai');
const raw=require('../legacy/data/scenario.json');
const profiles=require('../legacy/data/rules_profiles.json');
const c=E.buildScenario(raw,profiles.profiles[profiles.defaultRuleset]);
let assertions=0,withBattles=0,withMultiple=0;
function eq(a,b,label){assert.deepStrictEqual(a,b,label);assertions++;}
function fixture(side,turn,variant,seed){
 const s=E.makeState(c,seed);s.turn=turn;s.side=side;s.phase='combat';s.setupDone=true;
 for(const u of s.units){u.position=null;u.strength='dead';}
 const attackers=s.units.filter(u=>u.army===side).slice(0,4);
 const defenders=s.units.filter(u=>u.army!==side).slice(0,3);
 let count=0;
 for(const h of c.raw.hexes){
  if(count>=3)break;
  if(h.terrain!=='open'||h.city&&h.city!=='none')continue;
  const around=E.neighbours(c,h.x,h.y).filter(n=>E.hexAt(c,n.x,n.y)?.terrain==='open');
  if(!around.length)continue;
  if(defenders.slice(0,count).some(u=>E.dist(u.position.x,u.position.y,h.x,h.y)<5))continue;
  const d=defenders[count],a=attackers[count];
  d.position={x:h.x,y:h.y};d.strength='full';d.combatFull=variant==='low'?8:variant==='high'?1:3;d.combatReduced=1;
  a.position={x:around[0].x,y:around[0].y};a.strength='full';a.combatFull=variant==='low'?3:variant==='high'?9:6;a.combatReduced=2;
  count++;
 }
 assert.equal(count,3);
 return Session.create({scenarioId:'battle-for-moscow',config:c,state:s});
}
for(const side of ['german','soviet'])for(const turn of [2,3,5])for(const variant of ['balanced','high','low'])for(const seed of [12,173,947]){
 const initial=fixture(side,turn,variant,seed);
 const policy='aggressive';
 const plan=AI.executeLegacyCombatDeclarations(initial,policy);
 const declared=plan.session.state.declaredBattles||[];
 const committed=Session.execute(plan.session,{type:'finish-phase'});
 assert.equal(committed.ok,true,committed.reason);assertions++;
 if(!declared.length){eq(committed.session.state.phase,'movement','empty combat queue');continue;}
 withBattles++;
 if(declared.length>1)withMultiple++;
 // Legacy AI logs one declaration event, then resolves all combats using
 // default choices, one die per battle and reserved future attackers.
 const reference=structuredClone(initial.state);
 reference.log.push({t:reference.turn,side:reference.side,type:'combat-declaration',battles:structuredClone(declared)});
 const legacyRecords=E.resolveDeclaredBattles(c,reference,declared);
 const result=AI.executeLegacyCombatConsequences(committed.session);
 eq(result.records,legacyRecords,'combat records including dice/consequences');
 eq(result.session.state.units,reference.units,'unit positions and step losses');
 eq(result.session.state.control,reference.control,'city control');
 eq(result.session.state.seed,reference.seed,'exact RNG state');
 eq(result.session.state.log.filter(x=>x.type==='combat'),legacyRecords,'ordered combat log');
 eq(result.session.state.phase,'movement','completed queue');
 const rewind=Array.from({length:result.actions.length}).reduce(s=>{
  const u=Session.undo(s);assert.equal(u.ok,true);return u.session;
 },result.session);
 eq(rewind.state,committed.session.state,'Undo restores queue, committed die, RNG');
 const replay=AI.executeLegacyCombatConsequences(rewind);
 eq(replay.records,result.records,'replayed combat events');
 eq(replay.session.state, result.session.state,'exact replay state');
}
assert.ok(withBattles>0&&withMultiple>0,'fixture must exercise multiple combats');assertions++;
const empty=fixture('german',2,'high',11);
assert.throws(()=>AI.executeLegacyCombatConsequences(empty),/Committed combat resolution/);assertions++;
console.log('PASS shared AI combat consequences:',assertions,'assertions',withBattles,'nonempty fixtures',withMultiple,'multi-battle fixtures');
