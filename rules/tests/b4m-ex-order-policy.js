'use strict';
// Characterize existing executable EX sequencing; not upstream Oberlabs parity evidence.
const assert=require('node:assert/strict');
const E=require('../../legacy/engine');
const scenario=require('../../legacy/data/scenario.json');
const profiles=require('../../legacy/data/rules_profiles.json');
const c=E.buildScenario(scenario,profiles.profiles[profiles.defaultRuleset]);
function fixture(){
 for(const h of c.raw.hexes){
  if(h.terrain!=='open'||(h.city&&h.city!=='none'))continue;
  const neighbors=E.neighbours(c,h.x,h.y).filter(n=>E.hexAt(c,n.x,n.y)?.terrain==='open');
  if(neighbors.length<2)continue;
  const s=E.makeState(c,31777);s.side='german';s.turn=2;s.phase='combat';
  for(const u of s.units){u.position=null;u.strength='dead';}
  const aa=s.units.filter(u=>u.army==='german').slice(0,2),d=s.units.find(u=>u.army==='soviet');
  for(let i=0;i<2;i++)Object.assign(aa[i],{position:{x:neighbors[i].x,y:neighbors[i].y},strength:'full',combatFull:8,combatReduced:4,type:'infantry'});
  Object.assign(d,{position:{x:h.x,y:h.y},strength:'full',combatFull:4,combatReduced:2,type:'infantry'});
  const odds=E.battleOdds(c,s,aa,d).odds,die=c.profile.crtByOdds[String(odds)].indexOf('EX')+1;
  const route=E.retreatOptions(c,s,d).find(r=>r.cost===0);
  if(die>0&&route)return {s,aa,d,die,route,from:{x:h.x,y:h.y}};
 }
 throw Error('No full-strength defender EX fixture with clean retreat');
}
let checks=0;
{
 const {s,aa,d,die,route,from}=fixture();const seed=s.seed;
 const result=E.resolveAttack(c,s,aa.map(u=>u.id),d.id,die,{exchangeOrder:[aa[1].id,aa[0].id],retreatTo:{x:route.x,y:route.y},advanceId:'none'});
 assert.equal(result.outcome,'EX');assert.equal(result.retreated,true);
 assert.deepEqual(d.position,{x:route.x,y:route.y});assert.equal(d.strength,'reduced');
 assert.equal(result.exchangeLosses[0],aa[1].id);assert.equal(result.advance,false);
 assert.equal(result.defenderVacated,true);assert.equal(s.seed,seed);
 assert.deepEqual(from,fixture().from);checks++;
}
{
 const {s,aa,d,die,route}=fixture();d.strength='reduced';
 for(const a of aa){a.combatFull=4;a.combatReduced=2;}
 // On an EX, a reduced defender is removed by the step loss and cannot retreat.
 const odds=E.battleOdds(c,s,aa,d).odds,dieReduced=c.profile.crtByOdds[String(odds)].indexOf('EX')+1;
 if(dieReduced>0){
  const result=E.resolveAttack(c,s,aa.map(u=>u.id),d.id,dieReduced,{exchangeOrder:[aa[0].id,aa[1].id],advanceId:'none'});
  assert.equal(result.outcome,'EX');assert.equal(d.strength,'dead');assert.equal(d.position,null);
  assert.equal(result.retreated,false);assert.equal(result.advance,false);checks++;
 }
}
{
 const {s,aa,d,die,route}=fixture();const original=JSON.stringify(s);
 assert.throws(()=>E.resolveAttack(c,s,aa.map(u=>u.id),d.id,die,{exchangeOrder:[d.id],retreatTo:{x:route.x,y:route.y},advanceId:'none'}),/exchange/i);
 assert.equal(JSON.stringify(s),original);checks++;
}
console.log(`PASS v317 EX sequencing policy (${checks} checks)`);
