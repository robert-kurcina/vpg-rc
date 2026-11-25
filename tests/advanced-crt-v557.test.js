#!/usr/bin/env node
/* Player-supplied optional Advanced CRT. Standard remains authoritative default;
 * both native B4M and the historical shared engine consume this one table.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const C=require('../core/historical_crt');
const O=require('../core/historical_combat_odds');
const E=require('../core/engine');
const Project=require('../core/native_preview_config');
const Session=require('../core/session');
const Campaign=require('../core/historical_campaign_session');
const Catalog=require('../core/historical_campaign_action_catalog');
let count=0;
const eq=(a,b,why)=>{assert.deepStrictEqual(a,b,why);count++};
const bad=(fn,re,why)=>{assert.throws(fn,re,why);count++};
const rows={
 '0.5':['NE','NE','EX','EX','AL','AL'],
 '1':['DR','NE','NE','EX','EX','AL'],
 '1.5':['DR','NE','NE','EX','EX','EX'],
 '2':['DR','DR','NE','NE','EX','EX'],
 '3':['DRL','DR','DR','DR','EX','EX'],
 '4':['DE','DRL','DRL','DR','DR','EX'],
 '5':['DE','DE','DRL','DRL','DRL','DR'],
 '6':['DE','DE','DE','DE','DRL','DRL']
};
for(const game of C.games){
 eq(C.tableFor(game,'advanced'),rows,'Advanced matrix, '+game);
 for(const [odds,values] of Object.entries(rows))for(let die=1;die<=6;die++)
  eq(C.result(Number(odds),die,'advanced'),values[die-1],'Cell '+game+' '+odds+' / '+die);
}
const orig=JSON.parse(fs.readFileSync('games/battle-for-moscow/rules.json')).combat.table;
eq(C.tableFor('battle-for-moscow'),orig,'Standard unchanged');
eq(C.result(1,2),orig['1'][1],'Standard default lookup unchanged');
bad(()=>C.tableFor('kiev','nonsense'),/variant/);
bad(()=>C.result(0.5,1),/Unsupported CRT odds/);
bad(()=>C.shiftColumn(1.25,1,6,'advanced'),/base column/);
for(const [ratio,expected] of [[.49,0],[.5,.5],[.9999,.5],[1,1],[1.49,1],[1.5,1.5],[1.999,1.5],[2,2],[2.99,2],[3,3],[9,6]])
 eq(C.columnForRatio(ratio,'advanced'),expected,'Ratio cutoff '+ratio);
for(const [col,shift,expected] of [[0,1,.5],[.5,-1,0],[1,1,1.5],[1.5,1,2],[2,-1,1.5],[6,1,6]])
 eq(C.shiftColumn(col,shift,6,'advanced'),expected,'Adv column shift');
const combatPolicy=require('../maps/combat-configs/kiev-odessa-experimental-v531.json');
function odds(ratio,variant='standard',shifts={}){
 const defender=20,atk=defender*ratio;
 return O.evaluate({attackers:[{kind:'infantry',value:atk}],defenders:[{kind:'infantry',value:defender}],
  defenderTerrain:'open',allAttackersAcrossRiver:false,die:4,actor:'german',turn:2,
  policy:variant==='advanced'?{...combatPolicy,crtVariant:'advanced'}:combatPolicy,
  ...shifts});
}
for(const [ratio,col] of [[.49,0],[.5,.5],[1,1],[1.5,1.5],[2,2],[6,6]]){
 const x=odds(ratio,'advanced');eq(x.finalOdds,col,'Historical advanced ratio '+ratio);
 eq(x.noEffect,col===0,'Advanced automatic-NE threshold');
 if(col)eq(x.crtResult,rows[String(col)][3]);
}
eq(odds(.5).finalOdds,0,'Standard 1:2 is still below floor');
eq(odds(.5,'advanced',{airSupportShift:1}).finalOdds,1,'Advanced 1:2 + one column -> 1:1');
eq(odds(2,'advanced',{fleetShift:-1}).finalOdds,1.5,'Advanced 2:1 - one column -> 3:2');
eq(odds(2).finalOdds,2,'Standard 2:1 unchanged');
// Native package from original source, without changing the source CRT.
const read=p=>JSON.parse(fs.readFileSync(p));
const native=Object.fromEntries(['game','map','units','deployments','rules','objectives'].map(k=>[k,read('games/battle-for-moscow/'+k+'.json')]));
const base=Project.project(native,read('games/battle-for-moscow/native-preview/config.json'));
const advanced=structuredClone(base);advanced.rules.combat.crtVariant='advanced';advanced.rules.combat.table=C.tableFor('battle-for-moscow','advanced');
const gs=E.build(base),ga=E.build(advanced);
eq(gs.rules.combat.table,orig,'Native standard matches source table');
eq(ga.rules.combat.table,rows,'Native alternate matches source supplied matrix');
const invalid=structuredClone(advanced);invalid.rules.combat.table['1'][0]='AL';
bad(()=>E.build(invalid),/Advanced CRT must match/,'Native rejects altered advanced result');
const firstStandard=Session.create({scenarioId:gs.game.id,engine:'generic-hex-v1',config:gs,state:E.start(gs,1941,'auto-reference')});
const firstAdvanced=Session.create({scenarioId:ga.game.id,engine:'generic-hex-v1',config:ga,state:E.start(ga,1941,'auto-reference')});
eq(firstStandard.state,firstAdvanced.state,'Variant does not mutate native setup');
const savedStandard=Session.serialize(firstStandard),savedAdvanced=Session.serialize(firstAdvanced);
eq(Session.restore(savedStandard,{scenarioId:gs.game.id,engine:'generic-hex-v1',config:gs}).state,firstStandard.state,'Standard native save roundtrip');
eq(Session.restore(savedAdvanced,{scenarioId:ga.game.id,engine:'generic-hex-v1',config:ga}).state,firstAdvanced.state,'Advanced native save roundtrip');
bad(()=>Session.restore(savedAdvanced,{scenarioId:gs.game.id,engine:'generic-hex-v1',config:gs}),/package mismatch/);
bad(()=>Session.restore(savedStandard,{scenarioId:ga.game.id,engine:'generic-hex-v1',config:ga}),/package mismatch/);
// Original source-backed Kovel attack: variants produce different rolled results.
const opening=require('../games/kiev-odessa/experimental-preview/opening-v531.json').contextStart;
const historical={...structuredClone(opening),map:require('../maps/kiev-odessa-composite-experimental-v531.json'),
 profile:require('../maps/movement-configs/kiev-odessa-experimental-v531.json'),
 config:require('../maps/phase-configs/kiev-odessa.json'),
 counterConfig:require('../maps/counter-configs/kiev-odessa-experimental-v531.json'),
 combatPolicy,rosterOverlay:require('../maps/roster-overlays/kiev-odessa.json'),enableAirSupport:true,
 buildupPolicy:require('../maps/buildup-configs/kiev-odessa-experimental-v533.json'),
 buildupAllocation:require('../games/kiev-odessa/experimental-preview/allocation-v533.json'),
 housekeepingPolicy:require('../maps/housekeeping-configs/kiev-odessa-candidate-v521.json')};
const alternate={...historical,combatPolicy:{...combatPolicy,crtVariant:'advanced'}};
function kovel(context){let s=Campaign.create(context);
 for(const action of [
  {type:'combat',action:{type:'finish-air-sea'}},
  {type:'combat',action:{type:'commit-battles',battles:[{defenderHex:'0502',attackers:['kiev-front-r02c03']}]}},
  {type:'combat',action:{type:'select-battle',defenderHex:'0502'}},
  {type:'combat',action:{type:'commit-ground-air',faceId:null}}
 ])s=s.execute(action).session;
 return s;
}
const standardK=kovel(historical),advancedK=kovel(alternate);
eq(Catalog.discoverPostRoll({session:standardK,context:historical,die:4}).crtOutcome,'NE','Kovel original CRT at die 4');
eq(Catalog.discoverPostRoll({session:advancedK,context:alternate,die:4}).crtOutcome,'EX','Kovel Advanced CRT at die 4');
const advSave=advancedK.save();eq(Campaign.restore(advSave,alternate).snapshot(),advancedK.snapshot(),'Advanced campaign signed restore');
bad(()=>Campaign.restore(advSave,historical),/source\/configuration mismatch/,'Advanced save cannot use Standard rules');
bad(()=>Campaign.restore(standardK.save(),alternate),/source\/configuration mismatch/,'Standard save cannot use Advanced rules');
console.log('PASS v557 shared Advanced CRT + both engine modes:',count,'assertions');
