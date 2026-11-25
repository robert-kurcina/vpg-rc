'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const R=require('../maps/movement-configs/registry.json');
const M=require('../core/movement_rules.js');
const known=['arduous','leningrad','kiev','kiev-odessa'];
const expectedStatus={arduous:'verified-test-fixtures-only',leningrad:'verified-test-fixtures-only',
 kiev:'source-reviewed-experimental-browser','kiev-odessa':'source-reviewed-experimental-browser'};
assert.equal(R.engine,'core/movement_rules.js');
assert.deepEqual(Object.keys(R.configurations),known);
for (const id of known) {
 const entry=R.configurations[id];const profile=entry.extends?R.configurations[entry.extends].profile:entry.profile;
 assert.ok(profile);const resolved=M.validatedProfile(require(path.resolve(__dirname,'../maps/movement-configs',profile)));
 assert.equal(resolved.id,entry.extends||id);
 assert.equal(resolved.executableStatus,expectedStatus[id]);
}
console.log('Movement registry: four historical configurations verified');
