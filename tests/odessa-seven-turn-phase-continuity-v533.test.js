'use strict';
/* Experimental, NO-COMBAT phase continuity. Not a contested campaign acceptance. */
const assert=require('node:assert/strict');
const root=x=>require('../'+x);
const Campaign=root('core/historical_campaign_session');
const base=root('games/kiev-odessa/experimental-preview/opening-v531.json').contextStart;
const context={...structuredClone(base),map:root('maps/kiev-odessa-composite-experimental-v531.json'),
 profile:root('maps/movement-configs/kiev-odessa-experimental-v531.json'),
 config:root('maps/phase-configs/kiev-odessa.json'),
 counterConfig:root('maps/counter-configs/kiev-odessa-experimental-v531.json'),
 combatPolicy:root('maps/combat-configs/kiev-odessa-experimental-v531.json'),
 rosterOverlay:root('maps/roster-overlays/kiev-odessa.json'),enableAirSupport:true,
 buildupPolicy:root('maps/buildup-configs/kiev-odessa-experimental-v533.json'),
 buildupAllocation:root('games/kiev-odessa/experimental-preview/allocation-v533.json'),
 housekeepingPolicy:root('maps/housekeeping-configs/kiev-odessa-candidate-v521.json')};
let count=0;const eq=(a,b,msg)=>{assert.deepStrictEqual(a,b,msg);count++};
const yes=(x,msg)=>{assert.ok(x,msg);count++};
let game=Campaign.create(context),executed=0;
const visited=new Set(),turns=[];
while(!game.snapshot().cursor.complete&&executed<150){
 const s=game.snapshot(),k=s.phaseKind;visited.add(s.phaseId);
 if(s.phaseId==='housekeeping')turns.push(s.cursor.turn);
 let action;
 if(k==='combat'){
  if(s.combat.status==='air-sea-open')action={type:'combat',action:{type:'finish-air-sea'}};
  else if(s.combat.status==='awaiting-declarations')action={type:'combat',action:{type:'commit-battles',battles:[]}};
  else if(['complete','no-battles-declared'].includes(s.combat.status))action={type:'combat',action:{type:'finish-combat'}};
  else throw Error('Unexpected combat state in zero-battle baseline: '+s.combat.status);
 } else if(k==='buildup')action={type:'finish-buildup'};
 else if(k==='housekeeping')action={type:'finish-housekeeping'};
 else action={type:'finish-phase'};
 game=game.execute(action).session;executed++;
}
const end=game.snapshot();
eq(end.cursor.complete,true,'All seven turns completed');
eq(turns,[1,2,3,4,5,6,7],'Housekeeping executed each turn');
eq(executed,89,'Phase-only baseline journal length pinned');
eq(end.actionCount,89,'All actions recorded');
for(const phase of context.config.phases)yes(visited.has(phase.id),'Reached '+phase.id);
eq(Object.keys(end.state.units).length,36,'No phantom ground arrivals in no-placement run');
eq(end.state.supportMarkers.blackSeaFleet.hex,'1513','Fleet preserved');
eq(end.state.cityControl,context.buildupPolicy.initialCityControl,'No hypothetical city control changes');
yes(Boolean(end.terminal),'Source-scored terminal exists');
eq(end.terminal?.outcome,'soviet-victory','Three initial Axis cities imply Soviet victory in no-combat baseline');
eq(Campaign.restore(game.save(),context).snapshot(),end,'All 89 actions replay on exact source');
const undone=game.undo();yes(undone.ok,'Journal undo after terminal');
eq(undone.session.snapshot().cursor.complete,false,'Undo removes terminal housekeeping');
console.log('PASS v533 Odessa seven-turn NO-COMBAT phase continuity',count,'assertions;',executed,'journal actions');
