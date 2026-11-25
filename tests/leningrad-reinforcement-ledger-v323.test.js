const assert=require('node:assert/strict');
const {create}=require('../core/leningrad_reinforcement_ledger.js');
const rules=require('../core/leningrad_reinforcement_rules.js');
const slots=rules.due(4,'german');
const context={hexExists:x=>['0501','0502'].includes(x),friendlyEntryEdge:(_side,h)=>['0501','0502'].includes(h),enemyOccupies:()=>false,enemyZoc:()=>false,canStack:()=>true};
let ledger=create({turn:4,owner:'german'});
const a=ledger.snapshot();assert.equal(a.provisional,true);assert.equal(a.historicalRosterAuthorized,false);assert.equal(a.boardStateChanged,false);
assert.equal(ledger.undo().ok,false);
let failed=ledger.place({slotId:slots[0].slotId,hex:'0501',context:{...context,enemyZoc:()=>true}});assert.equal(failed.ok,false);assert.deepEqual(ledger.snapshot(),a);
let result=ledger.place({slotId:slots[0].slotId,hex:'0501',context});assert.equal(result.ok,true);ledger=result.ledger;
assert.equal(ledger.snapshot().placements.length,1);assert.equal(ledger.place({slotId:slots[0].slotId,hex:'0502',context}).ok,false);
assert.equal(ledger.place({slotId:slots[1].slotId,hex:'0501',context}).reason,'cumulative-stacking-not-verified');
assert.equal(ledger.place({slotId:slots[1].slotId,hex:'0501',context:{...context,canStackWithPending:()=>true}}).ok,true);
assert.equal(ledger.place({slotId:slots[1].slotId,hex:'0502',context:{...context,enemyOccupies:()=>true}}).ok,false);
result=ledger.close();assert.equal(result.ok,true);assert.deepEqual(result.outcome.lostGroundSlotIds,[slots[1].slotId]);ledger=result.ledger;
assert.equal(ledger.snapshot().closed,true);assert.equal(ledger.place({slotId:slots[1].slotId,hex:'0502',context}).ok,false);assert.equal(ledger.close().ok,false);
result=ledger.undo();assert.equal(result.ok,true);ledger=result.ledger;assert.equal(ledger.snapshot().closed,false);
result=ledger.undo();assert.equal(result.ok,true);ledger=result.ledger;assert.deepEqual(ledger.snapshot(),a);
assert.equal(ledger.undo().ok,false);
// A separately due turn cannot borrow another turn's slots.
assert.equal(create({turn:5,owner:'soviet'}).place({slotId:slots[0].slotId,hex:'0501',context}).ok,false);
// Support never becomes a ground counter via this ledger.
const air=create({turn:6,owner:'german'});const airslot=rules.due(6,'german')[0];
assert.equal(air.place({slotId:airslot.slotId,hex:'0501',context}).ok,false);
assert.deepEqual(air.close().outcome.unresolvedSupportSlotIds,[airslot.slotId]);
// WMM exception may admit EZOC, never actual enemy occupation.
const militia=create({turn:3,owner:'soviet'}),m=rules.due(3,'soviet')[0];
const mctx={hexExists:h=>h==='1201',isLeningrad:h=>h==='1201',enemyOccupies:()=>false,enemyZoc:()=>true};
assert.equal(militia.place({slotId:m.slotId,hex:'1201',context:mctx}).ok,true);
assert.equal(militia.place({slotId:m.slotId,hex:'1201',context:{...mctx,enemyOccupies:()=>true}}).ok,false);
assert.throws(()=>create({turn:9,owner:'german'}));assert.throws(()=>create({turn:4,owner:'axis'}));
// Snapshot modifications must never mutate internal ledger.
const snap=ledger.snapshot();snap.placements.push({slotId:'fake',hex:'xxxx'});assert.equal(ledger.snapshot().placements.length,0);
console.log('Leningrad provisional reinforcement transactional ledger: passed');
