'use strict';
// Checkpoint v332 temporary user-requested moves produced overlapping marks.
// Their preservation is historical; v333 removes overlap on the active board.
const assert=require('node:assert/strict');const b=require('../maps/leningrad.json');
assert.equal(b.v332DeploymentOverrides.conflicts.length,2);
assert(b.v333SourceRegistrationRepair.supersedesRuntimeChanges.includes('v332DeploymentOverrides'));
const cs=b.cells.flatMap(c=>(c.tileMarkers||[]).filter(m=>m.kind==='cross').map(()=>c.id));
const ss=b.cells.flatMap(c=>(c.tileMarkers||[]).filter(m=>m.kind==='star').map(()=>c.id));
assert.equal(cs.length,5);assert.equal(new Set(cs).size,5);assert.equal(cs.filter(id=>ss.includes(id)).length,0);
console.log('PASS v332 conflict provenance retained; active v333 board is collision-free');
