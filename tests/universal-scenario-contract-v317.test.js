const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');const data=JSON.parse(fs.readFileSync(path.join(root,'maps/scenarios/registry.json'),'utf8'));
const S=require('../core/scenario');const maps=JSON.parse(fs.readFileSync(path.join(root,'maps/registry.json'),'utf8')).maps;
const presentations=JSON.parse(fs.readFileSync(path.join(root,'maps/presentation/registry.json'),'utf8')).games;
const rosters=JSON.parse(fs.readFileSync(path.join(root,'maps/rosters/registry.json'),'utf8')).entries;
assert.equal(S.validate(data),true);assert.deepEqual(data.games.map(x=>x.id).sort(),maps.map(x=>x.id).sort());
for(const g of data.games){assert.ok(presentations[g.id]);assert.ok(rosters.some(r=>r.id===g.id));assert.equal(Object.keys(g.domains).length,14);for(const d of Object.values(g.domains)){if(d.source){const p=d.source.split('#')[0];assert.ok(fs.existsSync(path.join(root,p)),g.id+' missing '+p);}}}
assert.equal(S.requireExecutable(data,'battle-for-moscow').mode,'baseline-executable');
for(const id of ['arduous','leningrad','kiev','kiev-odessa'])assert.throws(()=>S.requireExecutable(data,id),/not executable/);
assert.equal(S.get(data,'kiev-odessa').extends,'kiev');
function mutated(f){const copy=structuredClone(data);f(copy);return copy;}
assert.throws(()=>S.validate(mutated(x=>delete x.games[1].domains.victory)),/Missing\/extra domains/);
assert.throws(()=>S.validate(mutated(x=>x.games[1].domains.victory.status='baseline-source')),/Missing source/);
assert.throws(()=>S.validate(mutated(x=>x.games[4].extends='arduous')),/Inconsistent overlay/);
assert.throws(()=>S.validate(mutated(x=>x.policy.defaultInheritance='implicit')),/Unsafe/);
assert.throws(()=>S.validate(mutated(x=>x.games[0].id='kiev')),/Duplicate/);
console.log('PASS universal scenario contract: 5 games, 14 domains, missing-data fail-closed and overlay validation');
