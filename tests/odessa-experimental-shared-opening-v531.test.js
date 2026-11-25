'use strict';
/* Odessa experimental opening is a REAL shared-engine scenario, but only its
 * opening phases are activated. It must not silently become a certified game. */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),req=p=>require(path.join(root,p));
const Compose=req('maps/composer'),G=req('core/map_movement_graph'),Binding=req('core/movement_binding');
const Campaign=req('core/historical_campaign_session'),Human=req('core/historical_campaign_human'),Face=req('core/historical_counter_face_projection');
const opening=req('games/kiev-odessa/experimental-preview/opening-v531.json');
const browserConfig=req('games/kiev-odessa/experimental-preview/config.json');
const map=Compose.compose(req('maps/kiev.json'),req('maps/odessa-extension.json'));
const publishedMap=req('maps/kiev-odessa-composite-experimental-v531.json');
const profile=req('maps/movement-configs/kiev-odessa-experimental-v531.json');
const phaseConfig=req('maps/phase-configs/kiev-odessa.json');
const counterConfig=req('maps/counter-configs/kiev-odessa-experimental-v531.json');
const combatPolicy=req('maps/combat-configs/kiev-odessa-experimental-v531.json');
const overlay=req('maps/roster-overlays/kiev-odessa.json');
let checks=0;const eq=(a,b,msg)=>{assert.deepStrictEqual(a,b,msg);checks++};const yes=(x,msg)=>{assert.ok(x,msg);checks++};const bad=(fn,re,msg)=>{assert.throws(fn,re,msg);checks++};
eq(publishedMap,map,'Static browser map matches current shared composer output exactly');
eq(opening.mapId,map.id,'Fixture pinned to source composite map');
eq(opening.profileScope,profile.experimentalGraphScope,'Fixture matches experimental graph scope');
eq(opening.audit.historicalCertified,false,'No false certification');
eq(Object.keys(opening.contextStart.state.units).length,36,'36 ground counters');
eq(Object.keys(opening.contextStart.state.supportMarkers).length,1,'1 independent naval marker');
eq(opening.contextStart.state.supportMarkers.blackSeaFleet.hex,'1513','Fleet starts Odessa');
eq(Object.keys(opening.contextStart.state.cityControl).length,20,'20 cities');
eq(Object.entries(opening.contextStart.state.cityControl).filter(([,v])=>v==='german').map(([k])=>k).sort(),['Brăila','Iasi','Lublin'],'Three historical starting Axis cities');
const board=Binding.build(map,profile);eq(board.metadata.scope,'experimental');eq(board.board.edges.length,714);eq(board.board.edges.filter(e=>!e.impassable).length,614);
bad(()=>G.build(map),/source-geometry-not-gameplay-certified/,'No promotion to historical approval');
const context={...structuredClone(opening.contextStart),map,profile,config:phaseConfig,counterConfig,combatPolicy,rosterOverlay:overlay,enableAirSupport:true};
for(const u of Object.values(context.state.units)){
 const drawn=Face.project(u,counterConfig);yes(['front','back'].includes(drawn.side),'Official face projectable: '+u.id);
}
for(const id of ['kiev-odessa/soviet-cavalry-corps-a','kiev-odessa/soviet-cavalry-corps-b','kiev-odessa/romanian-cavalry-corps']){
 const u=context.state.units[id];eq(u.strengthStatus,'printed-reduced');eq(Face.project(u,counterConfig).side,'back');
}
eq(Face.project(context.state.units['kiev-odessa/soviet-coastal-army'],counterConfig).art.counter.nato,'infantry');
let session=Campaign.create(context);eq(session.snapshot().phaseId,'german-combat');eq(session.snapshot().phaseSupported,true);
let human=Human.create({session,context});const initialHuman=human.view();yes(initialHuman.commands.some(a=>a.action?.type==='finish-air-sea'),'Source-bound Air-to-Fleet choice offered');
for(const action of [
 {type:'combat',action:{type:'finish-air-sea'}},
 {type:'combat',action:{type:'commit-battles',battles:[]}},
 {type:'combat',action:{type:'finish-combat'}}
])session=session.execute(action).session;
eq(session.snapshot().phaseId,'german-special-movement');eq(session.snapshot().phaseSupported,true);
const afterCombat=session.snapshot();const phase=afterCombat.phaseId;
const discovered=Human.create({session,context}).view();const move=discovered.commands.find(x=>x.type==='declare-ground-move');yes(move,'A real legal German movement command exists');
const sourceHex=move.request.path[0],target=move.request.path.at(-1),id=move.request.unitId;
session=session.execute(move).session;eq(session.snapshot().pendingGround.unitId,id,'Move request staged');
session=session.execute({type:'resolve-ground-move'}).session;eq(session.snapshot().state.units[id].hex,target,'Shared engine moved counter on composite board');
let saved=session.save(),restored=Campaign.restore(saved,context);eq(restored.snapshot(),session.snapshot(),'Saved game deterministically replays');
let undone=restored.undo();yes(undone.ok);eq(undone.session.snapshot().state.units[id].hex,sourceHex,'Undo removes movement result');
let before=undone.session.undo();yes(before.ok);eq(before.session.snapshot().phaseId,phase,'Undo retains special movement cursor');
const overlayBroken=structuredClone(context);overlayBroken.rosterOverlay.units=[];bad(()=>Campaign.create(overlayBroken),/Source roster binding required|source.*air|REFIT/i,'Romanian air REFIT must remain source bound');
const mapBroken=structuredClone(context);mapBroken.map.cells[0].terrain='sea';bad(()=>Campaign.create(mapBroken),/fingerprint-mismatch/,'Map tampering blocks experimental session');
// A contested ORIGINAL Kiev battle must resolve with the shared B4M CRT,
// authentic photographed Air Support and post-roll result choices. A no-battle
// advance alone does not establish campaign combat playability.
let contested=Human.create({session:Campaign.create(context),context});
contested=contested.choose({type:'combat',action:{type:'finish-air-sea'}});
const battles=contested.view().proposals;
const originalBattle=battles.find(b=>b.defenderHex==='0205'&&
 b.attackers.join(',')==='kiev-front-r01c01,kiev-front-r01c03');
yes(originalBattle,'Original Kiev contested attack remains source-legal in composite');
contested=contested.choose({type:'combat',action:{type:'commit-battles',battles:[originalBattle]}});
contested=contested.choose({type:'combat',action:{type:'select-battle',defenderHex:'0205'}});
contested=contested.choose({type:'combat',action:{type:'commit-ground-air',faceId:'kiev-front-r03c01'}});
contested=contested.roll(3);const postRoll=contested.view();
eq(postRoll.kind,'post-roll-choice','Die committed before CRT consequence selection');
eq(postRoll.crtOutcome,'EX','Shared original B4M CRT returned exchange');
yes(postRoll.options.length>0,'Original source permits result-dependent Exchange choices');
const staged=contested.save();const restoredRoll=Human.restore(staged,context);
eq(restoredRoll.view().crtOutcome,'EX','Committed post-roll result survives Save/Restore');
contested=restoredRoll.choose(restoredRoll.view().options[0]);
eq(contested.snapshot().combat.resolved.length,1,'Authentic combat result applied to campaign');
yes(contested.snapshot().state.units['kiev-front-r01c01']?.strengthStatus==='printed-reduced'||
 !contested.snapshot().state.units['kiev-front-r01c01'],'Source counter loses a real combat step');
const snap=Human.restore(human.save(),context).snapshot();eq(snap.phaseId,'german-combat','Human session restores original player decision');
const invalid=structuredClone(context);invalid.profile.experimentalGraphScope='historical-approved';bad(()=>Campaign.create(invalid),/source-geometry-not-gameplay-certified/,'Unauthorized scope denied');
yes(browserConfig.mode==='experimental-candidate-campaign','Browser explicitly scoped experimental');
yes(fs.readFileSync(path.join(root,'core/historical_engine_browser_bundle.js'),'utf8').includes('experimental-source-graph-ledgers'),'Browser bundle includes same graph source');
console.log('PASS v531 Odessa actual shared-engine opening',checks,'assertions');
