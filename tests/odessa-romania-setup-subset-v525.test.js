'use strict';
/* Kiev–Odessa Romanian SETUP-ONLY authority from Kiev §6 + approved map crosses.
 * Does not classify a country border or allow movement into unverified hexes. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const Compose=require('../maps/composer');
const Preflight=require('../core/composite_setup_source_preflight');
const State=require('../core/composite_starting_state_candidate');
const base=require('../maps/kiev.json');
const ext=require('../maps/odessa-extension.json');
const combined=Compose.compose(base,ext);
const overlay=require('../maps/roster-overlays/kiev-odessa.json');
const setupPolicy=require('../maps/setup-configs/kiev-odessa-source-setup-v522.json');
const sourceBindingPolicy=require('../maps/setup-configs/kiev-odessa-source-face-bindings-v523.json');
const kievInventory=require('../maps/setup/kiev-inventory.json');
const kievCounters=require('../maps/counter-configs/kiev.json');
const odessaCounters=require('../maps/counter-configs/odessa-extension.json');
const kievSetupPolicy=require('../maps/setup/kiev.json');
const kievOpening=require('../games/kiev/setup-preview/candidate.json');
const fixture={
 'soviet-cavalry-corps-a':'1215','soviet-cavalry-corps-b':'1111',
 'soviet-coastal-army':'1513','soviet-black-sea-fleet':'1513',
 'romanian-home-army':'0709','romanian-4th-army':'0809',
 'romanian-cavalry-corps':'1010'
};
const args={root,combinedMap:combined,baseMap:base,extension:ext,setupPolicy,sourceBindingPolicy,overlay,kievInventory,kievCounters,odessaCounters,kievSetupPolicy};
const clone=x=>JSON.parse(JSON.stringify(x));
let assertions=0;
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);assertions++;};
const ok=(v,m)=>{assert.ok(v,m);assertions++;};
const rejects=(fn,regex)=>{assert.throws(fn,regex);assertions++;};
const before=fs.statSync(path.join(root,'exports/kiev-odessa.svg')).size;
const source=Preflight.create({root,map:combined,overlay,policy:setupPolicy});
const four=['0709','0809','0910','1010'];
eq(setupPolicy.romaniaStart.verifiedSetupHexes,four,'the explicit four initial crosses');
for(const id of four){
 eq(source.setupTerritoryEvidence(id),'verified-setup-only','certified initial Romanian placement at '+id);
 const c=combined.cells.find(c=>c.id===id);
 ok(c.tileMarkers.some(m=>m.kind==='cross'),'authored cross on '+id);
 ok(!c.sourceTerritory,'setup-only label must not mutate political country mask at '+id);
}
for(const id of ['0909','1012','1014','1016','1309'])
 eq(source.setupTerritoryEvidence(id),'unverified','not authorized as Romanian territory: '+id);
for(const id of ['1111','1212','1416','9999'])
 eq(source.setupTerritoryEvidence(id),'not-romanian','Bessarabia/Sea/nonexistent cannot qualify: '+id);
const state=State.create(args).build({allocation:kievOpening.allocation,basePlacements:kievOpening.placements,extraPlacements:fixture});
eq(state.onMapCount,37);
eq(state.bySide,{axis:17,soviet:20});
eq(state.romanianSetupSubsetVerified,true);
eq(state.romanianPlacementsAwaitingTerritory,[]);
ok(!state.sourceBlockers.some(k=>k.startsWith('unverified-selected-romanian-hexes:')),'no setup-country block when all 7 use four approved crosses');
ok(state.sourceBlockers.includes('full-romanian-country-border-still-unverified-for-movement'),'movement certification still blocked');
eq(state.gameplayCertified,false);
eq(state.canRunHistoricalCampaign,false);
eq(Object.keys(state.romanianSetupEvidence).length,7);
for(const unit of Object.values(state.romanianSetupEvidence)){
 ok(four.includes(unit.hex));eq(unit.evidence,'verified-setup-only');
}
// The four approved setup hexes can legally hold seven units. The source
// did not authorize adding extra borders or silently choosing a full Romania.
const occupied=new Set(Object.values(state.romanianSetupEvidence).map(x=>x.hex));
eq([...occupied].sort(),four);
const outside=clone(fixture);outside['romanian-home-army']='0909';
const staged=State.create(args).build({allocation:kievOpening.allocation,basePlacements:kievOpening.placements,extraPlacements:outside});
eq(staged.romanianPlacementsAwaitingTerritory,['0909']);
eq(staged.romanianSetupSubsetVerified,false);
ok(staged.sourceBlockers.some(k=>k.startsWith('unverified-selected-romanian-hexes:')));
const invalid=clone(fixture);invalid['romanian-home-army']='1111';
rejects(()=>State.create(args).build({allocation:kievOpening.allocation,basePlacements:kievOpening.placements,extraPlacements:invalid}),/explicitly-non-romanian-start/);
const tamperedPolicy=clone(setupPolicy);tamperedPolicy.romaniaStart.verifiedSetupHexes.push('0909');
rejects(()=>Preflight.create({root,map:combined,overlay,policy:tamperedPolicy}),/romanian-setup-subset-mismatch/);
const tamperedMap=clone(combined);tamperedMap.cells.find(c=>c.id==='0910').tileMarkers=[];
rejects(()=>Preflight.create({root,map:tamperedMap,overlay,policy:setupPolicy}),/romanian-setup-subset-mismatch/);
const tamperedKiev=clone(kievSetupPolicy);tamperedKiev.groups.germanRomaniaInfantry.allowedHexes[0]='0909';
rejects(()=>State.create({...args,kievSetupPolicy:tamperedKiev}),/invalid-original-kiev-setup-policy/);
const forbiddenTerritory=clone(combined);forbiddenTerritory.cells.find(c=>c.id==='0709').sourceTerritory='bessarabia';
rejects(()=>Preflight.create({root,map:forbiddenTerritory,overlay,policy:setupPolicy}),/romanian-setup-subset-mismatch/);
// Old strict, source-territory validator deliberately remains strict: an
// initial setup cross is not sufficient proof for Home Army movement.
const all7=Object.keys(state.romanianSetupEvidence).map((id,i)=>({id,hex:state.romanianSetupEvidence[id].hex,side:i<3?'german':'romanian',type:i<3?'infantry-corps':'ground'}));
rejects(()=>source.validateRomania(all7,{}),/unverified-or-non-romanian/);
eq(fs.statSync(path.join(root,'exports/kiev-odessa.svg')).size,before,'map export unchanged');
const audit={checkpoint:291,version:'v525',assertions,status:'PASS',scope:'Kiev–Odessa initial setup-only',approvedRomanianHexes:four,
 initialUnits:state.onMapCount,initialRomaniaUnits:7,allSevenOnVerifiedSetupSubset:true,
 unresolved:[...state.sourceBlockers],notes:'Four Romanian setup crosses are source-backed initial destinations, not a Romanian political border or movement authorization.'};
fs.writeFileSync(path.join(root,'rules/audit/odessa-romania-setup-subset-v525.json'),JSON.stringify(audit,null,2)+'\n');
fs.writeFileSync(path.join(root,'rules/audit/odessa-candidate-37-unit-manifest-v525.json'),JSON.stringify({
 ...state,sourceAllocationType:'synthetic-player-choice-diagnostic',purpose:'setup-only Romanian evidence qualification; historical gameplay still disabled'
},null,2)+'\n');
console.log('PASS v525 Odessa source-backed Romanian initial setup subset:',assertions,'assertions');
