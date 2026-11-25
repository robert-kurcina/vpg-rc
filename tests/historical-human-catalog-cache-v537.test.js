'use strict';
/* Snapshot-scoped human legal-catalog optimization. Verifies reuse only
 * within one immutable decision, and invalidation on action/Undo/Restore. */
const assert=require('node:assert/strict');
const req=p=>require('../'+p);
const source=req('core/historical_campaign_action_catalog');
const catalogPath=require.resolve('../core/historical_campaign_action_catalog');
let calls=0;
require.cache[catalogPath].exports={...source,discover:(args)=>{calls++;return source.discover(args)}};
delete require.cache[require.resolve('../core/historical_campaign_human')];
const Human=req('core/historical_campaign_human');
const Campaign=req('core/historical_campaign_session');
const context={...structuredClone(req('games/kiev-odessa/experimental-preview/opening-v531.json').contextStart),
 map:req('maps/kiev-odessa-composite-experimental-v531.json'),
 profile:req('maps/movement-configs/kiev-odessa-experimental-v531.json'),
 config:req('maps/phase-configs/kiev-odessa.json'),
 counterConfig:req('maps/counter-configs/kiev-odessa-experimental-v531.json'),
 combatPolicy:req('maps/combat-configs/kiev-odessa-experimental-v531.json'),
 rosterOverlay:req('maps/roster-overlays/kiev-odessa.json'),enableAirSupport:true,
 buildupPolicy:req('maps/buildup-configs/kiev-odessa-experimental-v533.json'),
 buildupAllocation:req('games/kiev-odessa/experimental-preview/allocation-v533.json'),
 housekeepingPolicy:req('maps/housekeeping-configs/kiev-odessa-candidate-v521.json')};
let n=0;const eq=(a,b,msg)=>{assert.deepStrictEqual(a,b,msg);n++};
const yes=(x,msg)=>{assert.ok(x,msg);n++};
const before=Campaign.create(context),human=Human.create({session:before,context});
const catalog=human.view();eq(calls,1,'First view runs one authoritative discovery');
eq(human.view(),catalog,'Repeated view returns identical legal choices');
eq(calls,1,'Repeated view reuses cache');
catalog.commands.length=0;catalog.proposals.length=0;
yes(human.view().commands.some(x=>x.action?.type==='finish-air-sea'),'Returned view mutation does not corrupt cached choices');
eq(calls,1,'No rediscovery after consumer mutation');
const after=human.choose({type:'combat',action:{type:'finish-air-sea'}});
eq(calls,1,'Choosing a displayed action does not repeat expensive original discovery');
eq(after.snapshot().combat.status,'awaiting-declarations','Authoritative combat state changed');
const next=after.view();eq(calls,2,'New immutable campaign snapshot runs fresh discovery');
yes(next.commands.some(x=>x.action?.type==='commit-battles'),'New phase offers new choices');
assert.throws(()=>after.choose({type:'combat',action:{type:'finish-air-sea'}}),/absent from current legal decision catalog/i);n++;
eq(calls,2,'Rejected stale action cannot bypass catalog validation');
const undone=after.undo();yes(undone.ok,'Undo available');
eq(undone.session.snapshot(),human.snapshot(),'Undo restores exact earlier state');
eq(calls,2,'Undo itself does not invoke speculative catalog discovery');
eq(undone.session.view(),human.view(),'Restored pre-action choices match original');
eq(calls,3,'Undo creates its own catalog bound to earlier snapshot');
const restored=Human.restore(after.save(),context);
eq(restored.view(),next,'Authenticated Save/Restore yields same choices');
eq(calls,4,'Restore has fresh catalog, not stale closure state');
console.log('PASS v537 shared human catalog immutable-snapshot caching',n,'assertions;',calls,'validated discovery calls');
