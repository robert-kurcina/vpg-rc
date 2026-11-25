'use strict';
const assert=require('node:assert/strict');
const {run,load}=require('../tools/audit-b4m-native-preview-v360.js');
const preview=require('../core/native_preview_config.js'),core=require('../core/engine.js');
const original=load();const snapshot=JSON.stringify(original);
const positive=run();
assert.equal(positive.status,'differential-only-not-live');
assert.equal(positive.initialState.unitCount,39);
assert.equal(positive.initialState.startingUnitCount,36);
assert.equal(positive.initialState.cityControls,11);
assert.equal(positive.initialState.initialPhase,'combat');
assert.equal(positive.initialState.topologyDirectedEdges,786); // 393 undirected edges
assert.equal(positive.movement.contexts,406);
assert.equal(positive.movement.options,2560);
assert.equal(positive.replacements.contexts,14);
assert.equal(positive.combat.virtualPairwiseOdds,3144);
assert.equal(positive.combat.initialGermanCandidateOdds,30);
assert.ok(positive.uncertified.includes('Browser UX migration; production remains legacy/index.html'));
const mut=x=>JSON.parse(JSON.stringify(x));
assert.throws(()=>preview.project(original.original,{...original.config,status:'production'}),/unknown preview profile/);
assert.throws(()=>preview.project(original.original,{...original.config,scenarioId:'leningrad'}),/unknown preview profile/);
{const p=mut(original.config);p.overrides.map={cells:[]};assert.throws(()=>preview.project(original.original,p),/unsupported section/);}
{const p=mut(original.config);p.overrides.rules.combat.table={'1':['DE']};assert.throws(()=>preview.project(original.original,p),/CRT and modifiers/);}
{const p=mut(original.config);p.overrides.game.legacyUrl='../../broken.html';assert.throws(()=>preview.project(original.original,p),/unsupported override/);}
{const p=mut(original.config);p.overrides.rules.specialRules=[];assert.throws(()=>preview.project(original.original,p),/unsupported override/);}
{const p=mut(original.config);p.overrides.game.engine='legacy-b4m-v1';assert.throws(()=>preview.project(original.original,p),/not a generic engine package/);}
assert.equal(JSON.stringify(load()),snapshot,'Preview adapter modified source files');
const native=preview.project(original.original,original.config);
assert.equal(native.game.engine,'generic-hex-v1');
assert.equal(original.original.game.engine,'generic-hex-v1');
assert.deepEqual(native.map,original.original.map);
assert.deepEqual(native.units,original.original.units);
assert.deepEqual(native.objectives,original.original.objectives);
assert.deepEqual(native.rules.combat.table,original.original.rules.combat.table);
assert.deepEqual(native.rules.specialRules,original.original.rules.specialRules);
assert.equal(core.validatePackage(native).engine,'generic-hex-v1');
console.log('PASS B4M native preview v360: exact multi-mode movement, initial state, replacement, odds, first phase; production remains legacy');
