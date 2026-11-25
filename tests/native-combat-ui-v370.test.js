'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const E=require('../core/engine.js'),S=require('../core/session.js');
const P=require('../core/native_preview_config.js');
const UI=require('../core/native_combat_ui.js');
const {load}=require('../tools/audit-b4m-native-preview-v360.js');
const {original,config}=load(),g=E.build(P.project(original,config));
const view=JSON.parse(fs.readFileSync('games/battle-for-moscow/native-preview/ui-config.json'));
assert.deepEqual(view,{schemaVersion:1,combatSelectionMode:'defender-first',showGuidedPhases:true,showRuleReferences:true});
let cases=0,legalGroups=0;
for(const seed of [1,1941,2026]){
 let s=S.create({scenarioId:g.game.id,engine:'generic-hex-v1',config:g,state:E.start(g,seed,'auto-reference')});
 const before=S.serialize(s).sha256;
 const targets=s.state.units.filter(u=>u.position&&u.strength!=='dead'&&E.unitSide(u)!==s.state.side);
 const withGroups=targets.map(u=>({id:u.id,...UI.suggestions(s,u.id,8)})).filter(x=>x.options.length);
 assert(withGroups.length>0);
 for(const target of withGroups){
  assert(UI.adjacent(s,target.id).length>0);
  assert(target.total>=target.options.length);
  assert(target.options.length<=8);
  for(const c of target.options){
   assert(UI.legal(s,c.defender,c.attackers));
   assert(S.legal(s,{type:'declare-battle',defender:c.defender,attackers:c.attackers}).length);
   assert.equal(c.defender,target.id);
   legalGroups++;
  }
 }
 const target=withGroups[0];
 const c=target.options[0];
 assert.equal(UI.legal(s,target.id,[]),false);
 assert.equal(UI.legal(s,target.id,[c.attackers[0],c.attackers[0]]),false);
 assert.equal(UI.legal(s,target.id,['imaginary']),false);
 assert.equal(UI.legal(s,'imaginary',c.attackers),false);
 assert.equal(S.serialize(s).sha256,before,'inspecting defender/candidates must not mutate game or RNG');
 const committed=S.execute(s,{type:'declare-battle',defender:c.defender,attackers:c.attackers});
 assert(committed.ok);s=committed.session;
 assert.equal(s.state.declarations.length,1);
 assert(!UI.suggestions(s,target.id).options.length,'declared defender cannot be reused');
 const rollBefore=s.state.seed;
 const locked=S.execute(s,{type:'finish-phase'});assert(locked.ok);
 assert.equal(locked.session.state.declarationLocked,true);
 assert.notEqual(locked.session.state.pendingRoll,null);
 assert(!UI.suggestions(locked.session,target.id).options.length,'locked declaration cannot be modified');
 assert.equal(S.undo(locked.session).session.state.seed,rollBefore);
 assert.equal(S.undo(locked.session).session.state.declarations.length,1);
 assert.equal(S.undo(S.undo(locked.session).session).session.state.declarations.length,0); // undo also removes announcement
 cases++;
}
assert.equal(original.game.engine,'generic-hex-v1');
assert(legalGroups>0);
console.log(JSON.stringify({status:'PASS',checkpoint:136,caseloads:cases,candidateGroups:legalGroups,source:'session.legal / engine.combatOdds',productionRoute:'generic-hex-v1'}));
