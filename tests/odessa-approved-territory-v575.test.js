'use strict';
const assert=require('node:assert/strict');
const map=require('../maps/kiev-odessa-composite-experimental-v531.json'),kiev=require('../maps/kiev.json'),p=require('../maps/movement-configs/kiev-odessa-experimental-v531.json'),M=require('../core/movement_rules'),B=require('../core/movement_binding');
const board=B.build(map,p).board, audit=require('../rules/audit/odessa-approved-territory-v575.json');
const r=new Set(audit.romania),b=new Set(audit.bessarabia);let n=0;const eq=(a,e)=>{assert.deepEqual(a,e);n++};
const count={romania:0,bessarabia:0,outside:0,sea:0};
for(const c of map.cells){const id=c.id,region=c.terrain==='sea'?'sea':r.has(id)?'romania':b.has(id)?'bessarabia':'outside';count[region]++;eq(c.sourceTerritory,region==='sea'?undefined:region);eq(board.cells[id].sourceTerritory,c.sourceTerritory);
 const hu={hex:'0201',nationality:'hungarian',owner:'german'},home={hex:'1016',nationality:'romanian',owner:'german',sourceIdentityKey:'romanian-home-army',sourceFaceId:'odessa-front-r01c05'};
 for(const annexed of [false,true]){const ctx={profile:p,board,territory:{bessarabiaAnnexed:annexed}};
 for(const action of ['movement','retreat','advance']){const h=M.territorialAccess(ctx,hu,id,action),a=M.territorialAccess(ctx,home,id,action);eq(h.ok,region==='outside');eq(a.ok,region==='romania'||(region==='bessarabia'&&annexed&&action!=='advance'));}}
}
eq(count,audit.coverage);const kievTargets=require('../maps/combat-configs/kiev.json').firstTurnTerritorialRestriction.targetHexes;eq(kievTargets,[...r].filter(id=>kiev.cells.some(c=>c.id===id))); 
const tampered=structuredClone(board);tampered.cells['0102'].territorySource='unapproved';eq(M.territorialAccess({profile:p,board:tampered},{hex:'0201',nationality:'hungarian'},'0102').reason,'territory-unverified');
console.log('PASS v575 approved territory',n,'assertions');
