'use strict';
const assert=require('node:assert/strict');
const E=require('../legacy/engine');
const Session=require('../core/session');
const AI=require('../core/solo_ai');
const raw=require('../legacy/data/scenario.json');
const profiles=require('../legacy/data/rules_profiles.json');
const c=E.buildScenario(raw,profiles.profiles[profiles.defaultRuleset]);
let checks=0,nonempty=0;
const eq=(a,b,msg)=>{assert.deepStrictEqual(a,b,msg);checks++;};
function fixture(side,turn,variant){
 const s=E.makeState(c,530+turn);s.turn=turn;s.side=side;s.phase='combat';s.setupDone=true;
 // Controlled, spatially separated engagements. Build positions exclusively
 // from actual hexes and adjacency; change strength but not source identities.
 for(const u of s.units){u.position=null;u.strength='dead';}
 const attackers=s.units.filter(u=>u.army===side).slice(0,4);
 const defenders=s.units.filter(u=>u.army!==side).slice(0,3);
 let count=0;
 for(const h of c.raw.hexes){
  if(count>=3)break;
  if(h.terrain!=='open'||(h.city&&h.city!=='none'))continue;
  const around=E.neighbours(c,h.x,h.y).filter(n=>E.hexAt(c,n.x,n.y)?.terrain==='open');
  if(!around.length)continue;
  if(defenders.slice(0,count).some(u=>E.dist(u.position.x,u.position.y,h.x,h.y)<5))continue;
  const d=defenders[count],a=attackers[count];
  d.position={x:h.x,y:h.y};d.strength='full';d.combatFull=variant==='low-odds'?8:variant==='high-odds'?1:3;d.combatReduced=1;
  a.position={x:around[0].x,y:around[0].y};a.strength='full';a.combatFull=variant==='low-odds'?3:variant==='high-odds'?9:6;a.combatReduced=2;
  count++;
 }
 assert.equal(count,3);
 return Session.create({scenarioId:'battle-for-moscow',config:c,state:s});
}
for(const side of ['german','soviet'])for(const turn of [2,3,5])for(const variant of ['balanced','low-odds','high-odds'])for(const policy of AI.COMBAT_POLICIES){
 const original=fixture(side,turn,variant);
 const expected=E.announceBattles(c,structuredClone(original.state),policy,side);
 const plan=AI.planLegacyCombatDeclarations(original,policy);
 eq(plan.map(({defender,attackers})=>({defender,attackers,declaredOdds:expected.find(v=>v.defender===defender)?.declaredOdds})),expected,`${side}/${turn}/${variant}/${policy} declaration`);
 if(plan.length)nonempty++;
 const performed=AI.executeLegacyCombatDeclarations(original,policy);
 eq(performed.session.state.declaredBattles||[],expected, 'session declarations');
 eq(performed.session.state.seed,original.state.seed,'declaration cannot roll dice');
 eq(original.state.declaredBattles,undefined,'original state unchanged');
 if(plan.length){
  let curr=performed.session;
  for(let j=0;j<plan.length;j++)curr=Session.undo(curr).session;
  eq(curr.state,original.state,'undo complete declaration sequence');
 }
 if(plan.length){
  const committed=Session.execute(performed.session,{type:'finish-phase'});
  assert.equal(committed.ok,true,committed.reason);checks++;
  eq(committed.session.state.phase,'combat-resolution','phase');
  assert.ok(committed.session.state.pendingBattle.die>=1);checks++;
 }
}
assert.ok(nonempty>0,'At least one battle must be declared');checks++;
const test=fixture('german',2,'high-odds');
assert.throws(()=>AI.planLegacyCombatDeclarations(test,'unknown'),/Unknown combat policy/);checks++;
assert.throws(()=>AI.planLegacyCombatDeclarations({...test,state:{...test.state,phase:'movement'}},'balanced'),/Combat declaration phase/);checks++;
console.log('PASS shared Solo AI combat declaration parity:',checks,'assertions;',nonempty,'nonempty fixtures');
