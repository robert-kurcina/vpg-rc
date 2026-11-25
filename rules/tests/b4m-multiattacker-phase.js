'use strict';
// v317 executable characterization; NOT independent Oberlabs parity.
const assert=require('node:assert/strict');
const E=require('../../legacy/engine');
const sc=require('../../legacy/data/scenario.json');
const pp=require('../../legacy/data/rules_profiles.json');
const c=E.buildScenario(sc,pp.profiles[pp.defaultRuleset]);
const center=c.raw.hexes.find(h=>h.terrain==='open'&&(!h.city||h.city==='none')&&E.neighbours(c,h.x,h.y).filter(n=>E.hexAt(c,n.x,n.y)?.terrain==='open').length>=2);
assert.ok(center,'No available open-hex test fixture');
const neighbors=E.neighbours(c,center.x,center.y).filter(n=>E.hexAt(c,n.x,n.y)?.terrain==='open').slice(0,2);
function fresh(){const s=E.makeState(c,77017);s.turn=2;s.side='german';s.phase='combat';for(const u of s.units){u.strength='dead';u.position=null;}
 const aa=s.units.filter(u=>u.army==='german').slice(0,2),d=s.units.find(u=>u.army==='soviet');
 aa.forEach((u,i)=>Object.assign(u,{position:{x:neighbors[i].x,y:neighbors[i].y},strength:'full',type:'infantry',combatFull:8,combatReduced:4}));
 Object.assign(d,{position:{x:center.x,y:center.y},strength:'full',type:'infantry',combatFull:4,combatReduced:2});
 return {s,aa,d};}
let exchanges=0,turns=0;
{
 const {s,aa,d}=fresh();const score=E.battleOdds(c,s,aa,d);
 const die=c.profile.crtByOdds[String(score.odds)].indexOf('EX')+1;
 assert.ok(die>0,`Expected EX at computed odds ${score.odds}`);
 const before=s.seed;
 const result=E.resolveAttack(c,s,aa.map(u=>u.id),d.id,die,{exchangeOrder:[aa[1].id,aa[0].id],advanceId:'none'});
 assert.equal(result.outcome,'EX');assert.equal(result.exchangeLosses[0],aa[1].id);
 assert.equal(result.advance,false);assert.equal(s.seed,before,'Explicit die must not consume PRNG');
 assert.equal(s.log.filter(x=>x.type==='combat').length,1);exchanges++;
}
// B4M AI half-turn event lifecycle characterization: not a nine-phase public state machine.
{
 let s=E.makeState(c,88019);
 for(let i=0;i<14;i++){
  const side=s.side,turn=s.turn,prior=s.log.length;
  s=E.playSide(c,s,'balanced');turns++;
  const events=s.log.slice(prior);
  assert.equal(events.filter(e=>e.type==='end-turn').length,1,`half turn ${i}`);
  assert.equal(events.at(-1).type,'end-turn',`end event must be last on half turn ${i}`);
  assert.equal(events.at(-1).side,side);
  assert.equal(s.ply,i+1);
  if(side==='german'){assert.equal(s.side,'soviet');assert.equal(s.turn,turn);}
  else {assert.equal(s.side,'german');assert.equal(s.turn,turn+1);}
 }
 assert.equal(s.over,true);assert.equal(s.phase,'finished');assert.equal(s.turn,8);
}
console.log(`PASS v317 legacy characterization: ${exchanges} ordered multi-attacker EX and ${turns} half-turn event cycles`);
