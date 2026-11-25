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
console.log('PASS v643 Fleet budget turn boundary, campaign compatibility, validation (15 assertions)');
