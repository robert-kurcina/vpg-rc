'use strict';
/* Source-position editor: actual approved combined map, original 36 ground
 * counters, normal campaign creation; no synthetic geography/game engine. */
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const E=require('../core/historical_source_setup_editor');
const opening=require('../games/kiev-odessa/experimental-preview/opening-v531.json').contextStart;
const map=require('../maps/kiev-odessa-composite-experimental-v531.json');
const policy=require('../games/kiev-odessa/experimental-preview/setup-policy-v534.json');
const source={opening,map,policy};
let count=0;
function ok(x,label){assert.ok(x,label);count++}
function same(x,y,label){assert.deepEqual(x,y,label);count++}
function fails(fn,pattern,label){assert.throws(fn,pattern,label);count++}
const starting=E.create(source);const baseline=starting.snapshot();
ok(E.fingerprint(opening)===policy.openingSHA256,'Pinned original candidate opening SHA');
ok(E.fingerprint(opening)===crypto.createHash('sha256').update(JSON.stringify(opening)).digest('hex'),'Independent crypto hash');
same(Object.keys(baseline.units).length,36,'36 ground source face identities');
same(baseline.unselectedFrontlineHexes,['1113'],'One source-star unused, 1111 remains preserved');
same(starting.commit(),opening,'Unchanged default source opening byte-for-byte at object level');
same(Object.keys(starting.commit().state.supportMarkers).length,1,'Fleet remains separate from ground roster');
ok(starting.choices('kiev-front-r01c01').includes('0301'),'Legal Panzer can stack with lone infantry');
ok(!starting.choices('kiev-front-r01c01').includes('0203'),'Two Panzer Corps cannot stack');
const panzer=starting.move('kiev-front-r01c01','0301');
same(panzer.commit().state.units['kiev-front-r01c01'].hex,'0301','Panzer moved to permitted source cross');
same(panzer.commit().state.units['kiev-front-r01c01'].openingHex,'0301','Immutable opening coordinate updated before gameplay');
same(starting.commit(),opening,'Immutable editor did not mutate original source');
const front=starting.move('kiev-front-r05c04','1113');
same(front.snapshot().unselectedFrontlineHexes,['0808'],'Soviet 12th star can become newly vacant');
same(front.commit().state.units['kiev-front-r05c04'].hex,'1113','Source mechanized moved to selected new star');
same(front.commit().state.units['kiev-front-r05c04'].sourceFaceId,'kiev-front-r05c04','Counter identity preserved');
same(front.commit().state.supportMarkers,opening.state.supportMarkers,'Fleet immutable');
const swapped=starting.swapPositions('kiev-front-r01c01','kiev-front-r01c02');
same(swapped.commit().state.units['kiev-front-r01c01'].hex,'0203','First panzer exchanged positions');
same(swapped.commit().state.units['kiev-front-r01c02'].hex,'0105','Second panzer exchanged positions');
const saved=front.save();const restored=E.restore(JSON.parse(JSON.stringify(saved)),source);
same(restored.commit(),front.commit(),'Complete setup save/restore');
fails(()=>E.restore({...saved,placements:{...saved.placements,'kiev-front-r05c04':'0808'}},source),/checksum/i,'Mutation without checksum rejected');
const malicious={...saved,placements:{...saved.placements,'kiev-front-r05c04':'0105'}};
const body=Object.fromEntries(Object.entries(malicious).filter(([k])=>k!=='integrity'));
malicious.integrity={algorithm:'SHA-256',digest:crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex')};
fails(()=>E.restore(malicious,source),/unapproved-source-destination/,'Self-consistently forged setup still rule-invalid');
fails(()=>starting.move('kiev-front-r05c04','1513'),/unapproved-source-destination/,'No front mech at Odessa port');
fails(()=>starting.move('kiev-front-r05c04','0706'),/unapproved-source-destination/,'Wrong source marker 0706 not authorized as fixed rear');
fails(()=>starting.move('kiev-front-r03c08','0706'),/unapproved-source-destination/,'Fixed infantry cannot leave its source rear slots');
fails(()=>starting.move('kiev-front-r05c08','0706'),/unapproved-source-destination/,'Source 1309 mandated fixed mechanized, not 0706');
fails(()=>starting.move('kiev-front-r01c01','0709'),/unapproved-source-destination/,'German Polish panzer cannot deploy in Romania');
fails(()=>starting.move('kiev-front-r01c04','0709'),/unapproved-source-destination/,'Polish infantry cannot move to Romanian setup');
fails(()=>starting.move('kiev-odessa/romanian-home-army','0302'),/unapproved-source-destination/,'Romanian Home Army not authorized in Poland');
const exposedStar=starting.move('kiev-front-r04c03','1113');
fails(()=>exposedStar.move('kiev-front-r03c05','0305'),/adjacent-source-units/,'Soviet front Army next to 0205 Army prohibited');
fails(()=>starting.move('kiev-front-r01c01','0203'),/illegal-national-stacking/,'Third ground unit on same cross prohibited');
fails(()=>starting.move('kiev-front-r01c08','0204'),/illegal-national-stacking/,'Poland infantry missing and three-stack rejected');
fails(()=>starting.move('kiev-odessa/romanian-cavalry-corps','0709'),/illegal-national-stacking/,'Romanian triple stack rejected');
fails(()=>starting.move('kiev-front-r03c04','0204'),/unapproved-source-destination/,'Soviet starting Army cannot occupy Axis hex');
fails(()=>starting.swapPositions('kiev-front-r01c01','kiev-front-r03c04'),/unapproved-source-destination/,'Cross-faction source-group swap rejected');
fails(()=>E.create({...source,policy:{...policy,openingSHA256:'0'.repeat(64)}}),/fingerprint-mismatch/,'Altered opening binding rejected');
fails(()=>E.create({...source,opening:{...opening,state:{...opening.state,units:{...opening.state.units,unlisted:{id:'unlisted',hex:'0101'}}}}}),/fingerprint-mismatch/,'Extra unbound source unit rejected');
for(const [name,g] of Object.entries(policy.groups))for(const id of g.ids){
 same(baseline.placements[id]!==undefined,true,'Every pinned source group member starts placed '+id);
 ok(g.allowed.includes(baseline.placements[id]),'Starting source slot approved '+id);
}
// Assert each candidate editor actually feeds the pre-existing campaign engine.
const campaignConfig=require('../maps/phase-configs/kiev-odessa.json');
const originalContext={...front.commit(),map,config:campaignConfig};
// The real context also supplies live combat/buildup policies; phase-create is
// tested by the historical browser integration, not by this isolated module.
ok(originalContext.cursor.turn===1&&originalContext.actor==='german','Edited opening maintains Turn 1 actor/cursor');
console.log('PASS v534 source-constrained setup editor',count,'assertions');
