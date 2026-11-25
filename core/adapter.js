/* The v1.6 Oberlabs implementation remains authoritative for its own game.
   Compatibility is checked by comparing states produced from migrated vs source files. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameAdapter=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const roster=typeof WargameRoster!=='undefined'?WargameRoster:(typeof require==='function'?require('./roster.js'):null);
function legacyScenario(p){return {dimensions:{width:p.map.width,height:p.map.height},hexes:p.map.cells,units:p.units.units};}
function legacyProfile(p){const r=p.rules,budget=r.specialRules.find(x=>x.module==='replacement-budget-v1'),capital=p.objectives.victory.decisions.find(x=>x.if?.type==='controls')?.if?.cell;if(!budget||!capital)throw Error('Incomplete legacy profile');return {mudTurns:r.weather[0].turns,mudAttackerMultiplier:r.weather[0].combatMultipliers,mudNormalMovementMaxHexes:r.weather[0].normalMovementLimit,mudRailMovementUnaffected:r.weather[0].railUnaffected,sovietReplacements:{normal:budget.soviet.clear,mud:budget.soviet.mud},germanReplacements:budget.german.otherwise,crtByOdds:r.combat.table,victory:{moscow:capital}};}
function create(engine,p,seed=1,verifiedRoster=null){if(p.game.engine!=='legacy-b4m-v1')throw Error('Not a legacy game');
 const source=verifiedRoster===null?p.units.units:roster.bindExecutable(verifiedRoster,p.units.units,p.game.id);
 const prepared={...p,units:{...p.units,units:source}};
 const c=engine.buildScenario(legacyScenario(prepared),legacyProfile(prepared));return {c,s:engine.makeState(c,seed)};}
return {legacyScenario,legacyProfile,create};
});
