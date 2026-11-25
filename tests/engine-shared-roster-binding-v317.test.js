'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const R=require('../core/roster');
const Loader=require('../maps/rosters/loader');
const Core=require('../core/engine');
const Adapter=require('../core/adapter');
const B4M=require('../legacy/engine');
const source=require('../games/battle-for-moscow/units.json').units;
const roster=Loader.load('battle-for-moscow');
const original=JSON.stringify(source);
const attached=R.bindExecutable(roster,source,'battle-for-moscow');
assert.deepEqual(attached,source);
assert.notEqual(attached,source);
attached[0].strength='dead';assert.notEqual(source[0].strength,'dead');
const load=id=>{const read=name=>require('../games/'+id+'/'+name+'.json');return {game:read('game'),map:read('map'),units:read('units'),rules:read('rules'),deployments:read('deployments'),objectives:read('objectives')};};
const p=load('battle-for-moscow');
// Test the legacy compatibility oracle explicitly, not the new default browser metadata.
const legacyFixture={...p,game:{...p.game,engine:'legacy-b4m-v1'}};
const legacy=Adapter.create(B4M,legacyFixture,43210);
const shared=Adapter.create(B4M,legacyFixture,43210,roster);
assert.deepEqual(shared.s,legacy.s,'Shared roster must not change initial Oberlabs state');
assert.deepEqual(shared.c.raw,legacy.c.raw,'Shared roster must not change canonical game scenario');
let old=legacy.s,now=shared.s;
for(let ply=0;ply<14;ply++){
 old=B4M.playSide(legacy.c,old,'baseline');now=B4M.playSide(shared.c,now,'baseline');
 assert.deepEqual(now,old,'Shared roster must not change AI half-turn '+(ply+1));
}
assert.equal(JSON.stringify(source),original,'Binding may not mutate source definitions');
// Fail closed: no incomplete historical roster can be loaded into executable gameplay.
for(const id of ['arduous','leningrad','kiev','kiev-odessa']){
 assert.throws(()=>R.bindExecutable(Loader.load(id),source,id),/Unverified roster/);
}
const tamper=(f,needle)=>{const t=JSON.parse(JSON.stringify(roster));f(t[0]);assert.throws(()=>R.bindExecutable(t,source,'battle-for-moscow'),needle);};
tamper(u=>u.characteristics.combatFull++,/attributes disagree/);
tamper(u=>u.artwork.front='wrong-face',/Counter identity/);
tamper(u=>u.artwork.colors.primary='#ffffff',/Counter identity/);
tamper(u=>u.deployment.kind='unverified',/Incomplete executable|Deployment mismatch/);
tamper(u=>u.rawRef='nonexistent',/provenance|Missing executable roster source|Incomplete executable|source key/);
assert.throws(()=>R.bindExecutable(roster,source.slice(1),'battle-for-moscow'),/count mismatch/);
assert.throws(()=>R.bindExecutable(roster,source,'kiev'),/Scenario mismatch/);
// Generic core consumes the same contract; no separate unit system is introduced.
const read=name=>require('../games/eastern-corridor/'+name+'.json');
const generic={game:read('game'),map:read('map'),units:read('units'),rules:read('rules'),objectives:read('objectives'),deployments:read('deployments')};
assert.equal(Core.validatePackage(generic).ok,true);
assert.equal(Core.build(generic).game.id,'eastern-corridor');
assert.deepEqual(Core.build(require('../core/native_preview_config').project(p,require('../games/battle-for-moscow/native-preview/config.json')),roster).units.units,p.units.units,'Common core shared native package must consume identical canonical units');
assert.throws(()=>Core.build(generic,roster),/count mismatch/);
console.log('PASS shared roster -> Oberlabs adapter parity; strict fail-closed executable binding; common core roster contract');
