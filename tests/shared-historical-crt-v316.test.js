const assert=require('assert');const fs=require('fs');const CRT=require('../core/historical_crt');
const original=JSON.parse(fs.readFileSync('games/battle-for-moscow/rules.json','utf8')).combat.table;
const profile=JSON.parse(fs.readFileSync('rules_profiles/shared-crt.json','utf8'));
assert.deepStrictEqual(profile.results,original);
for(const game of Object.keys(profile.historicalMapProfiles)){
 assert.deepStrictEqual(CRT.tableFor(game),original);
 for(let odds=1;odds<=6;odds++)for(let roll=1;roll<=6;roll++) assert.strictEqual(CRT.result(odds,roll),original[odds][roll-1]);
}
assert.strictEqual(CRT.result(1,1),'DR');assert.strictEqual(CRT.result(6,6),'DE');
console.log('PASS v316 shared Oberlabs CRT: 36 cells x 5 historical mappings');
