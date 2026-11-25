'use strict';
// v317: executable state/die rollback tests + static checks of the browser UI wiring.
// NOT a browser automation test or independent upstream Oberlabs parity proof.
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const E=require('../../legacy/engine');
const sc=require('../../legacy/data/scenario.json');
const profiles=require('../../legacy/data/rules_profiles.json');
const c=E.buildScenario(sc,profiles.profiles[profiles.defaultRuleset]);
const ui=fs.readFileSync(path.join(__dirname,'../../legacy/ui.js'),'utf8');
let checks=0;
// Static guardrail on exact UI wiring: a declared battle is rolled once and retained.
const prep=ui.slice(ui.indexOf('function prepareCurrentHumanBattle(){'),ui.indexOf('function resolveCurrentHumanBattle(){'));
const resolution=ui.slice(ui.indexOf('function resolveCurrentHumanBattle(){'),ui.indexOf('function phaseAdvance(){'));
const undo=ui.slice(ui.indexOf("$('undo').onclick=()=>"),ui.indexOf("$('export').onclick="));
assert.match(prep,/pendingBattle=\{action:a,die:E\.rollCombatDie\(s\)\}/);checks++;
assert.match(resolution,/E\.resolveAttack\(c,s,a\.attackers,a\.defender,s\.pendingBattle\.die,options\)/);checks++;
assert.match(resolution,/saveUndo\(\);[\s\S]*E\.resolveAttack/);checks++;
assert.match(undo,/s=JSON\.parse\(history\.pop\(\)\)/);checks++;
assert.match(undo,/combatChoice=null/);checks++;
assert.match(undo,/combatChoice=\{attackerLossId:a\.attackers\[0\],exchangeOrder:\[\.\.\.a\.attackers\],retreatTo:null,advanceId:'none'\}/);checks++;
assert.ok(!/rollCombatDie/.test(resolution),'resolution must not roll a second die');checks++;
assert.ok(!/rollCombatDie/.test(undo),'undo must not consume RNG');checks++;
// Small actual engine fixture for the state transition made by the UI's JSON undo stack.
function battleFixture(seed){
 for(const h of c.raw.hexes){
  if(h.terrain!=='open'||(h.city&&h.city!=='none'))continue;
  const n=E.neighbours(c,h.x,h.y).find(n=>E.hexAt(c,n.x,n.y)?.terrain==='open'&&!(h.river||[]).includes(n.opposite));
  if(!n)continue;
  const s=E.makeState(c,seed);s.turn=2;s.side='german';s.phase='combat-resolution';
  for(const u of s.units){u.position=null;u.strength='dead';}
  const a=s.units.find(u=>u.army==='german');const d=s.units.find(u=>u.army==='soviet');
  Object.assign(a,{position:{x:n.x,y:n.y},strength:'full',combatFull:12,combatReduced:6,type:'infantry'});
  Object.assign(d,{position:{x:h.x,y:h.y},strength:'full',combatFull:4,combatReduced:2,type:'infantry'});
  const action={attackers:[a.id],defender:d.id};
  s.combatQueue=[action];s.combatIndex=0;s.pendingBattle={action,die:E.rollCombatDie(s)};
  if(E.battlePreview(c,s,action,s.pendingBattle.die))return {s,action};
 }
 throw Error('No legal combat fixture');
}
for(const seed of [31701,31702,31703,31704,31705,31706]){
 const {s,action}=battleFixture(seed);
 const snapshot=JSON.stringify(s); // exactly what saveUndo() stores
 const die=s.pendingBattle.die,rolledSeed=s.seed;
 const preview=E.battlePreview(c,s,action,die);
 assert.equal(preview.die,die);checks++;
 const result=E.resolveAttack(c,s,action.attackers,action.defender,die,{advanceId:'none'});
 assert.equal(result.die,die);assert.equal(s.seed,rolledSeed);checks++;
 const restored=JSON.parse(snapshot);
 assert.equal(JSON.stringify(restored),snapshot);assert.equal(restored.pendingBattle.die,die);assert.equal(restored.seed,rolledSeed);checks++;
 const retry=E.resolveAttack(c,restored,action.attackers,action.defender,die,{advanceId:'none'});
 assert.equal(retry.outcome,result.outcome);assert.equal(restored.seed,rolledSeed);checks++;
 assert.equal(JSON.stringify(restored),JSON.stringify(s),'replay from undo snapshot must be deterministic');checks++;
}
console.log(`PASS v317 human combat undo characterizations (${checks} checks)`);
