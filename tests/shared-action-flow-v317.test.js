'use strict';
const assert=require('node:assert/strict');
const A=require('../core/actions');
const E=require('../legacy/engine');
const sc=require('../legacy/data/scenario.json');
const profiles=require('../legacy/data/rules_profiles.json');
const c=E.buildScenario(sc,profiles.profiles[profiles.defaultRuleset]);
const ctx=s=>({scenarioId:'battle-for-moscow',engine:'legacy-b4m-v1',config:c,state:s,actor:s.side,phase:s.phase});
let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const accepted=(s,a)=>{let r=A.execute(ctx(s),a);assert.equal(r.ok,true,r.reason);checks++;return r.state;};
const rejected=(s,a)=>{const before=JSON.stringify(s),r=A.execute(ctx(s),a);assert.equal(r.ok,false);assert.strictEqual(r.state,s);assert.equal(JSON.stringify(s),before);checks++;};
// Precise phase transitions, including two unique turn-start exceptions.
{
 let s=E.makeState(c,123);s.turn=2;s.side='german';s.phase='replacement';
 for(const [from,to] of [['replacement','special'],['special','combat'],['combat','movement']]){
  assert.equal(s.phase,from);s=accepted(s,{type:'finish-phase'});assert.equal(s.phase,to);checks++;
 }
 s=accepted(s,{type:'finish-phase'});assert.equal(s.side,'soviet');assert.equal(s.phase,'replacement');checks++;
 let first=E.makeState(c,123);first.side='german';first.phase='movement';first.turn=1;
 first=accepted(first,{type:'finish-phase'});assert.equal(first.phase,'replacement');checks++;
 let shock=E.makeState(c,123);shock.side='soviet';shock.turn=3;shock.phase='movement';
 shock=accepted(shock,{type:'finish-phase'});assert.equal(shock.phase,'replacement');checks++;
 // The Shock placement belongs after the *German* fourth-turn end.
 let germany=E.makeState(c,124);germany.side='german';germany.turn=4;germany.phase='movement';
 shock=accepted(germany,{type:'finish-phase'});assert.equal(shock.phase,'reinforcement');checks++;
 if(E.shockReinforcementOptions(c,shock).length)rejected(shock,{type:'finish-phase'});
}
// Construct two legal, independent battles on the current map using current source rules.
{
 let s=E.makeState(c,22);s.turn=2;s.side='german';s.phase='combat';
 for(const u of s.units){u.position=null;u.strength='dead';}
 const germans=s.units.filter(u=>u.army==='german').slice(0,2);
 const soviets=s.units.filter(u=>u.army==='soviet').slice(0,2);
 const locations=[];
 for(const h of c.raw.hexes){
  if(h.terrain!=='open'||h.city&&h.city!=='none')continue;
  const adjacent=E.neighbours(c,h.x,h.y).find(n=>E.hexAt(c,n.x,n.y)?.terrain==='open');
  if(!adjacent)continue;
  if(locations.some(p=>E.dist(p.h.x,p.h.y,h.x,h.y)<4))continue;
  locations.push({h,adjacent});if(locations.length===2)break;
 }
 assert.equal(locations.length,2);
 for(let i=0;i<2;i++){
  const {h,adjacent}=locations[i];Object.assign(germans[i],{strength:'full',position:{x:adjacent.x,y:adjacent.y},combatFull:8,combatReduced:4});
  Object.assign(soviets[i],{strength:'full',position:{x:h.x,y:h.y},combatFull:2,combatReduced:1});
 }
 const a=A.legal(ctx(s),{type:'declare-battle'});
 const choices=locations.map((_,i)=>a.find(x=>x.defender===soviets[i].id&&x.attackers.length===1&&x.attackers[0]===germans[i].id));
 assert.ok(choices.every(Boolean));checks++;
 rejected(s,{type:'declare-battle',defender:soviets[0].id,attackers:[germans[1].id]});
 const initial=JSON.parse(JSON.stringify(s));
 s=accepted(s,{type:'declare-battle',...choices[0]});
 rejected(s,{type:'declare-battle',...choices[0]});
 rejected(s,{type:'declare-battle',defender:soviets[1].id,attackers:[germans[0].id]});
 s=accepted(s,{type:'declare-battle',...choices[1]});
 eq(s.seed,initial.seed);
 const stored=JSON.parse(JSON.stringify(s));
 s=accepted(s,{type:'remove-last-battle'});
 eq(s.declaredBattles.length,1);
 s=accepted(s,{type:'declare-battle',...choices[1]});eq(s,stored);
 const baseline=JSON.parse(JSON.stringify(s));
 s=accepted(s,{type:'finish-phase'});
 eq(s.phase,'combat-resolution');eq(s.combatIndex,0);
 const expected=JSON.parse(JSON.stringify(baseline));expected.combatQueue=JSON.parse(JSON.stringify(expected.declaredBattles));expected.combatIndex=0;expected.phase='combat-resolution';expected.replacementUsed=0;
 expected.pendingBattle={action:expected.combatQueue[0],die:E.rollCombatDie(expected)};
 eq(s,expected);
 rejected(s,{type:'declare-battle',...choices[0]});
 rejected(s,{type:'resolve-pending',options:{attackerLossId:'invalid',exchangeOrder:['invalid'],retreatTo:{x:999,y:999},advanceId:'invalid'}});
 // Replay from snapshot with explicit choice to decline advance, as in human interface.
 const snapshot=JSON.parse(JSON.stringify(s));
 let out=A.execute(ctx(s),{type:'resolve-pending',options:{advanceId:'none'}});
 assert.equal(out.ok,true,out.reason);checks++;
 s=out.state;eq(s.combatIndex,1);assert.ok(s.pendingBattle&&s.pendingBattle.die>=1&&s.pendingBattle.die<=6);checks++;
 let again=A.execute(ctx(snapshot),{type:'resolve-pending',options:{advanceId:'none'}});
 eq(again.state,s);eq(again.result,out.result);
 out=A.execute(ctx(s),{type:'resolve-pending',options:{advanceId:'none'}});
 assert.equal(out.ok,true,out.reason);checks++;
 s=out.state;eq(s.phase,'movement');assert.equal(s.pendingBattle,undefined);checks++;
 rejected(s,{type:'resolve-pending'});
}
console.log('PASS shared action flow:',checks,'assertions');
