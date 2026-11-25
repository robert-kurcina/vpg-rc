'use strict';
// v317 characterization: exercise actual resolution, not merely retreatOptions.
// Printed §9.3 provides retreat context; exact legacy choices remain Oberlabs-parity WIP.
const assert=require('node:assert/strict');
const E=require('../../legacy/engine');
const sc=require('../../legacy/data/scenario.json');
const profiles=require('../../legacy/data/rules_profiles.json');
const c=E.buildScenario(sc,profiles.profiles[profiles.defaultRuleset]);
const places=c.raw.hexes.filter(h=>h.terrain==='open'&&(!h.city||h.city==='none')&&E.neighbours(c,h.x,h.y).length===6);
function fresh(h){
 const s=E.makeState(c,98765);s.turn=2;s.side='german';s.phase='combat';
 for(const u of s.units){u.position=null;u.strength='dead';}
 const a=s.units.find(u=>u.army==='german');const d=s.units.find(u=>u.army==='soviet');
 const n=E.neighbours(c,h.x,h.y)[0];
 Object.assign(a,{position:{x:n.x,y:n.y},strength:'full',combatFull:36,combatReduced:18,type:'infantry'});
 Object.assign(d,{position:{x:h.x,y:h.y},strength:'full',combatFull:4,combatReduced:2,type:'infantry'});
 return {s,a,d};
}
function dieFor(s,a,d,code){const odds=E.battleOdds(c,s,[a],d).odds;return c.profile.crtByOdds[String(odds)].indexOf(code)+1;}
const selected=places.map(h=>({h,...fresh(h)})).find(v=>{
 const die=dieFor(v.s,v.a,v.d,'DR');return die>0&&E.retreatOptions(c,v.s,v.d).some(r=>r.cost===0);
});
assert.ok(selected,'Requires an open-ground DR battle with legal retreat');
let checks=0;
{
 const {s,a,d}=fresh(selected.h),die=dieFor(s,a,d,'DR');
 const choices=E.retreatOptions(c,s,d);assert.ok(choices.length);
 const destination=choices.find(r=>r.cost===0);assert.ok(destination);
 const record=E.resolveAttack(c,s,[a.id],d.id,die,{retreatTo:{x:destination.x,y:destination.y},advanceId:'none'});
 assert.equal(record.outcome,'DR');assert.equal(record.retreated,true);
 assert.equal(record.retreatZocCost,0);assert.equal(d.strength,'full');
 assert.deepEqual(d.position,{x:destination.x,y:destination.y});
 assert.deepEqual(record.retreatPath,destination.path);
 assert.equal(record.advance,false);checks++;
}
{
 const {s,a,d}=fresh(selected.h),die=dieFor(s,a,d,'DR');
 const illegal={x:999,y:999};const prior=JSON.stringify(s);
 assert.throws(()=>E.resolveAttack(c,s,[a.id],d.id,die,{retreatTo:illegal,advanceId:'none'}),/retreat/i);
 assert.equal(JSON.stringify(s),prior,'Invalid retreat must not mutate game state');checks++;
}
{
 const {s,a,d}=fresh(selected.h);
 // Surround the defender with hostile units, so no first retreat step exists.
 const occupied=new Set([`${a.position.x},${a.position.y}`]);
 const others=s.units.filter(u=>u.army==='german'&&u.id!==a.id);
 const adjacent=E.neighbours(c,d.position.x,d.position.y).filter(n=>!occupied.has(`${n.x},${n.y}`));
 assert.ok(others.length>=adjacent.length);
 adjacent.forEach((n,i)=>{others[i].position={x:n.x,y:n.y};others[i].strength='full';});
 assert.deepEqual(E.retreatOptions(c,s,d),[]);
 const die=dieFor(s,a,d,'DR');assert.ok(die);
 const result=E.resolveAttack(c,s,[a.id],d.id,die,{advanceId:'none'});
 assert.equal(result.outcome,'DR');assert.equal(result.retreated,false);
 assert.equal(d.strength,'dead');assert.equal(d.position,null);
 assert.equal(result.defenderVacated,true);checks++;
}
{
 const candidate=places.map(h=>({h,...fresh(h)})).find(v=>dieFor(v.s,v.a,v.d,'DRL')>0&&E.retreatOptions(c,v.s,v.d).some(r=>r.cost===0));
 assert.ok(candidate,'Requires an open-ground DRL battle');
 const {s,a,d}=fresh(candidate.h),die=dieFor(s,a,d,'DRL');
 const destination=E.retreatOptions(c,s,d).find(r=>r.cost===0);
 const result=E.resolveAttack(c,s,[a.id],d.id,die,{retreatTo:{x:destination.x,y:destination.y},advanceId:'none'});
 assert.equal(result.outcome,'DRL');assert.equal(d.strength,'reduced');
 assert.equal(result.retreated,true);assert.deepEqual(d.position,{x:destination.x,y:destination.y});checks++;
}
console.log(`PASS B4M ${checks} retreat resolution boundary cases (DR, no-route, DRL, invalid destination)`);
{
 // Enemy ZOC transit: explicitly choose the one-ZOC route when available.
 // Find an actual scenario location instead of hard-coding axial-grid assumptions.
 let found=null;
 for(const h of places){
  const setup=fresh(h),other=setup.s.units.find(u=>u.army==='german'&&u.id!==setup.a.id);
  for(const spot of c.raw.hexes){
   if(E.dist(spot.x,spot.y,h.x,h.y)<2)continue;
   other.position={x:spot.x,y:spot.y};other.strength='full';
   const route=E.retreatOptions(c,setup.s,setup.d).find(r=>r.cost===1);
   if(route&&dieFor(setup.s,setup.a,setup.d,'DR')>0){found={h,spot,route};break;}
  }
  if(found)break;
 }
 assert.ok(found,'At least one legal retreat with a single hostile ZOC transit');
 const {s,a,d}=fresh(found.h),other=s.units.find(u=>u.army==='german'&&u.id!==a.id);
 other.position={x:found.spot.x,y:found.spot.y};other.strength='full';
 const die=dieFor(s,a,d,'DR');
 const result=E.resolveAttack(c,s,[a.id],d.id,die,{retreatTo:{x:found.route.x,y:found.route.y},advanceId:'none'});
 assert.equal(result.retreated,true);assert.equal(result.retreatZocCost,1);
 assert.equal(d.strength,'reduced','ZOC transit costs one step');checks++;
}
console.log(`PASS B4M retreat adjudication extended (${checks} total cases)`);
