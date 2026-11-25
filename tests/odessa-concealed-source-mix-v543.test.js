'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const E=require('../core/historical_source_setup_editor');
const Campaign=require('../core/historical_campaign_session');
const Human=require('../core/historical_campaign_human');
const opening=require('../games/kiev-odessa/experimental-preview/opening-v531.json').contextStart;
const policy=require('../games/kiev-odessa/experimental-preview/setup-policy-v534.json');
const map=require('../maps/kiev-odessa-composite-experimental-v531.json');
const source={opening,policy,map};
let n=0;
const eq=(a,b,msg)=>{assert.deepStrictEqual(a,b,msg);n++};
const ok=(v,msg)=>{assert.ok(v,msg);n++};
const reject=(f,re,msg)=>{assert.throws(f,re,msg);n++};
const base=E.create(source),start=base.snapshot();
const slots=start.concealedSlots;
eq(slots.length,10,'10 original Soviet mechanized physical fronts');
eq(start.concealedMixed,false,'original source candidate not falsely labeled mixed');
const photos=require('../maps/counter-configs/kiev-odessa-experimental-v531.json');
const front=new Map(photos.faces.front.map(f=>[f.faceId,f]));
const back=new Map(photos.faces.back.map(f=>[f.faceId,f]));
for(const slot of slots){
 const u=opening.state.units[slot];
 eq(u.strengthStatus,'untried','untried counter '+slot);
 ok(front.get(slot).visualTranscription.printedValues.startsWith('?'),'front conceals strength '+slot);
 eq(front.get(slot).pairedFaceId,back.get(u.reverseFaceId).faceId,'real reverse for '+slot);
}
const order=[...slots.slice(1),slots[0]]; // deterministic, across fixed and forward positions
const mixed=base.mixConcealed(order),snap=mixed.snapshot();
ok(snap.concealedMixed,'mix declared after a valid permutation');
eq(snap.identityAssignments[slots[0]],slots[1],'physical counter moved to a different source slot');
eq(snap.identityAssignments[slots[9]],slots[0],'source counter transferred across front/fixed group boundary');
eq(new Set(Object.values(snap.identityAssignments)).size,10,'all source identities unique');
eq(new Set(slots.map(id=>snap.placements[id])).size,10,'ten distinct mechanized setup hexes');
eq(mixed.commit().state.supportMarkers,opening.state.supportMarkers,'Fleet untouched');
const committed=mixed.commit(),units=committed.state.units;
eq(Object.keys(units).length,36,'no new/deleted ground units');
eq(new Set(Object.keys(units)).size,36,'unique ground keys');
for(const slot of slots){
 const physical=snap.identityAssignments[slot],u=units[physical],original=opening.state.units[physical];
 eq(u.hex,start.placements[slot],'permuted physical counter at source slot '+slot);
 eq(u.openingHex,u.hex,'opening lineage exact '+slot);
 eq(u.id,physical,'engine ID is physical photographed identity '+physical);
 eq(u.sourceFaceId,physical,'front face follows identity '+physical);
 eq(u.reverseFaceId,original.reverseFaceId,'original printed reverse follows front '+physical);
 eq(u.strengthStatus,'untried','no hidden strengths exposed during mixing '+physical);
 eq(snap.units[slot].sourceFaceId,physical,'visual slot projects actual untried front '+slot);
}
for(const id of Object.keys(opening.state.units).filter(id=>!slots.includes(id)))
 eq(units[id],opening.state.units[id],'unrelated counter unchanged '+id);
const moved=mixed.move(slots[0], '1113');
eq(moved.snapshot().concealedMixed,true,'mix persists through position move');
eq(moved.commit().state.units[order[0]].hex,'1113','identity follows edited destination after mixing');
const swapped=mixed.swapPositions(slots[0],slots[1]);
eq(swapped.snapshot().identityAssignments,snap.identityAssignments,'placement swaps never re-roll identity');
const saved=moved.save();eq(saved.version,2,'versioned new editor save');
eq(E.restore(saved,source).commit(),moved.commit(),'mixed saved editor restores same physical identity placement');
const forged=structuredClone(saved);forged.identityAssignments[slots[0]]=slots[4];
reject(()=>E.restore(forged,source),/checksum/i,'unchecksummed identity edit rejected');
function sign(v){const {integrity,...data}=v;v.integrity.digest=crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');return v}
const duplicates=structuredClone(saved);duplicates.identityAssignments[slots[0]]=duplicates.identityAssignments[slots[1]];
reject(()=>E.restore(sign(duplicates),source),/invalid-concealed-source-permutation/i,'self-signed duplicate physical identity rejected');
const foreign=structuredClone(saved);foreign.identityAssignments[slots[0]]='kiev-front-r03c04';
reject(()=>E.restore(sign(foreign),source),/invalid-concealed-source-permutation/i,'self-signed foreign Army face rejected');
const falseMix=structuredClone(saved);falseMix.concealedMixed=false;
reject(()=>E.restore(sign(falseMix),source),/invalid-concealed-source-permutation/i,'cannot call reassigned physical identity unmixed');
reject(()=>base.mixConcealed([...slots.slice(0,-1),slots[0]]),/invalid-concealed-source-permutation/i,'duplicate identity forbidden');
reject(()=>base.mixConcealed([...slots.slice(0,-1),'odessa-front-r01c01']),/invalid-concealed-source-permutation/i,'Fleet cannot enter the ground pool');
reject(()=>base.mixConcealed(slots.slice(0,9)),/invalid-concealed-source-permutation/i,'all ten physical counters mandatory');
const oldPayload={format:E.FORMAT,version:1,scenarioId:policy.scenarioId,openingSHA256:policy.openingSHA256,placements:start.placements};
const oldSaved={...oldPayload,integrity:{algorithm:'SHA-256',digest:crypto.createHash('sha256').update(JSON.stringify(oldPayload)).digest('hex')}};
eq(E.restore(oldSaved,source).commit(),opening,'v534 original editor save still loads');
const context={...committed,map,profile:require('../maps/movement-configs/kiev-odessa-experimental-v531.json'),
 config:require('../maps/phase-configs/kiev-odessa.json'),counterConfig:photos,
 combatPolicy:require('../maps/combat-configs/kiev-odessa-experimental-v531.json'),
 rosterOverlay:require('../maps/roster-overlays/kiev-odessa.json'),
 enableAirSupport:true,buildupPolicy:require('../maps/buildup-configs/kiev-odessa-experimental-v533.json'),
 buildupAllocation:require('../games/kiev-odessa/experimental-preview/allocation-v533.json'),
 housekeepingPolicy:require('../maps/housekeeping-configs/kiev-odessa-candidate-v521.json')};
const game=Campaign.create(context),before=game.snapshot();
eq(before.state.units[order[0]].hex,start.placements[slots[0]],'actual campaign starts with mixed identity');
const human=Human.create({session:game,context});
ok(human.view().commands.some(a=>a.action?.type==='finish-air-sea'),'source-legal first combat action offered');
const next=human.choose({type:'combat',action:{type:'finish-air-sea'}});
eq(next.snapshot().actionCount,1,'human action committed in ordinary journal');
const restored=Human.restore(next.save(),context);
eq(restored.snapshot(),next.snapshot(),'actual campaign mix + action survives save/restore');
const undone=next.undo();ok(undone.ok,'human Undo available after mixed start');
eq(undone.session.snapshot(),before,'Undo keeps the mixed start and restores first action state');
console.log('PASS v543 source-pinned Soviet Mechanized mixing:',n,'assertions');
