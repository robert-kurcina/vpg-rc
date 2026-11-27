'use strict';
const A=require('node:assert/strict');
const Auto=require('../core/historical_campaign_autoplay');
const action=type=>({type:'combat',action:{type}});
const journal=[action('declare-fleet-attack'),{type:'declare-fleet-move'},
 {type:'finish-housekeeping'},action('declare-fleet-attack'),action('roll-fleet-attack'),
 {type:'declare-fleet-move'}, {type:'finish-buildup'}, action('declare-fleet-attack')];
A.equal(Auto.policyOf({}).fleetBudgetScope,'campaign');
A.equal(Auto.policyOf({fleetBudgetScope:'turn'}).fleetBudgetScope,'turn');
A.throws(()=>Auto.policyOf({fleetBudgetScope:'phase'}),/Invalid deterministic controller policy/);
A.throws(()=>Auto.fleetDeclarationCount(journal,'declare-fleet-attack','phase'),/Invalid Fleet budget scope/);
A.equal(Auto.fleetDeclarationCount(journal,'declare-fleet-attack'),3);
A.equal(Auto.fleetDeclarationCount(journal,'declare-fleet-attack','turn'),2);
A.equal(Auto.fleetDeclarationCount(journal,'declare-fleet-move','campaign'),2);
A.equal(Auto.fleetDeclarationCount(journal,'declare-fleet-move','turn'),1);
A.equal(Auto.fleetDeclarationCount(journal,'roll-fleet-attack','turn'),1);
A.equal(Auto.fleetDeclarationCount(journal,'declare-fleet-attack','turn'),
 Auto.fleetDeclarationCount(journal,'declare-fleet-attack','turn'));
const next=[...journal,{type:'finish-housekeeping'}];
A.equal(Auto.fleetDeclarationCount(next,'declare-fleet-attack','turn'),0);
A.equal(Auto.fleetDeclarationCount(next,'declare-fleet-move','turn'),0);
A.equal(Auto.fleetDeclarationCount(next,'declare-fleet-attack','campaign'),3);
A.equal(Auto.fleetDeclarationCount([action('declare-fleet-attack')],'declare-fleet-attack','turn'),1);
A.equal(Auto.fleetDeclarationCount([],'declare-fleet-attack','turn'),0);
// Compare direct counting with the former array-based reference over every
// prefix, including a terminal turn boundary and unrelated nested actions.
for(let i=0;i<=next.length;i++)for(const scope of ['campaign','turn'])for(const type of ['declare-fleet-attack','declare-fleet-move','roll-fleet-attack']){
 const prefix=next.slice(0,i);
 const start=scope==='turn'?prefix.map(a=>a.type).lastIndexOf('finish-housekeeping')+1:0;
 A.equal(Auto.fleetDeclarationCount(prefix,type,scope),prefix.slice(start).filter(a=>(a.type==='combat'?a.action?.type:a.type)===type).length);
}
console.log('PASS v643 Fleet budget turn boundary, campaign compatibility, validation (15 assertions)');
