'use strict';
// Source: bundled B4M rules §§9.1–9.3, including six published result codes.
// Tests the executable resolver, not independent Oberlabs browser parity.
const assert=require('node:assert/strict');
const E=require('../../legacy/engine');
const sc=require('../../legacy/data/scenario.json');
const profiles=require('../../legacy/data/rules_profiles.json');
const c=E.buildScenario(sc,profiles.profiles[profiles.defaultRuleset]);
let checks=0;
function position(){
 for(const h of c.raw.hexes){
  if(h.terrain!=='open'||(h.city&&h.city!=='none'))continue;
  for(const n of E.neighbours(c,h.x,h.y)){
   if(E.hexAt(c,n.x,n.y)?.terrain!=='open')continue;
   // Avoid river shift. River is encoded on defender hexsides.
   if((h.river||[]).includes(n.opposite))continue;
   return [h,n];
  }
 }
 throw Error('No suitable open battle pair');
}
const [dh,ah]=position();
function fresh(odds=3,defenderStrength='full'){
 const s=E.makeState(c,54321);s.turn=2;s.side='german';s.phase='combat';
 for(const u of s.units){u.position=null;u.strength='dead';}
 const a=s.units.find(u=>u.army==='german');
 const d=s.units.find(u=>u.army==='soviet');
 Object.assign(a,{position:{x:ah.x,y:ah.y},strength:'full',combatFull:odds*4,combatReduced:Math.max(1,odds*2),type:'infantry'});
 Object.assign(d,{position:{x:dh.x,y:dh.y},strength:defenderStrength,combatFull:4,combatReduced:2,type:'infantry'});
 return {s,a,d};
}
for(let odds=1;odds<=6;odds++)for(let die=1;die<=6;die++){
 const {s,a,d}=fresh(odds);
 const score=E.battleOdds(c,s,[a],d);
 assert.equal(score.odds,odds,`Open terrain must produce ${odds}:1`);
 const candidate=E.battlePreview(c,s,{attackers:[a.id],defender:d.id},die);
 const expected=c.profile.crtByOdds[String(odds)][die-1];
 assert.equal(candidate.outcome,expected,`Preview CRT ${odds}:1/${die}`);
 const outcome=E.resolveAttack(c,s,[a.id],d.id,die,{advanceId:'none'});
 assert.equal(outcome.outcome,expected,`Resolution CRT ${odds}:1/${die}`);
 assert.equal(outcome.die,die);assert.equal(outcome.advance,false);
 if(expected==='NE'){
  assert.equal(a.strength,'full');assert.equal(d.strength,'full');assert.deepEqual(d.position,{x:dh.x,y:dh.y});
 }
 if(expected==='AL'){assert.equal(a.strength,'reduced');assert.equal(d.strength,'full');}
 if(expected==='DE'){assert.equal(d.strength,'dead');assert.equal(d.position,null);}
 if(expected==='DRL'||expected==='EX')assert.notEqual(d.strength,'full');
 checks++;
}
// Explicit illegal choices must not partially mutate state or consume the RNG.
for(const [options,die] of [[{attackerLossId:'nonexistent'},6],[{exchangeOrder:['nonexistent']},4],[{retreatTo:{x:999,y:999}},1],[{advanceId:'nonexistent'},1]]){
 const {s,a,d}=fresh(3);const before=JSON.stringify(s);
 assert.throws(()=>E.resolveAttack(c,s,[a.id],d.id,die,options));
 assert.equal(JSON.stringify(s),before,'Invalid choice caused partial mutation');checks++;
}
// Declining advance must leave vacated defender hex empty.
{
 const {s,a,d}=fresh(6);const record=E.resolveAttack(c,s,[a.id],d.id,6,{advanceId:'none'});
 assert.equal(record.outcome,'DE');assert.equal(record.defenderVacated,true);
 assert.equal(E.occupant(s,dh.x,dh.y),null);checks++;
}
// Human explicit loss choice does not permit units outside the attacking force.
{
 const {s,a,d}=fresh(1);const outcome=E.resolveAttack(c,s,[a.id],d.id,6,{attackerLossId:a.id});
 assert.equal(outcome.outcome,'AL');assert.equal(outcome.attackerLoss,a.id);checks++;
}
console.log(`PASS ${checks} B4M combat resolution choice assertions (36 CRT combinations + decisions)`);
// Major-city stand-fast rule: a full-strength defender loses a step instead
// of retreating on DR, even if an open retreat route would otherwise exist.
{
 const h=c.cities.find(h=>h.city==='moscow');assert.ok(h);
 const n=E.neighbours(c,h.x,h.y)[0];assert.ok(n);
 const {s,a,d}=fresh(6);
 a.position={x:n.x,y:n.y};d.position={x:h.x,y:h.y};
 // Oversized attacker ensures a minimum 1:1 even with terrain shift.
 a.combatFull=48;
 const odds=E.battleOdds(c,s,[a],d).odds;
 const die=c.profile.crtByOdds[String(odds)].indexOf('DR')+1;
 assert.ok(die>0,'Expected DR outcome available for major city');
 const preview=E.battlePreview(c,s,{defender:d.id,attackers:[a.id]},die);
 assert.equal(preview.cityHold,true);assert.deepEqual(preview.retreat,[]);
 const r=E.resolveAttack(c,s,[a.id],d.id,die,{advanceId:'none'});
 assert.equal(r.cityHold,true);assert.equal(r.retreated,false);
 assert.deepEqual(d.position,{x:h.x,y:h.y});assert.equal(d.strength,'reduced');
 console.log('PASS B4M full-strength Moscow stand-fast on DR');
}
