'use strict';
/* Odessa §9.4.4–9.4.5: exact counter identity, territorial entries,
 * permanent Bessarabian annexation. Explicit source-free synthetic geometry
 * tests semantics only; the authentic 261-hex country mask is NOT approved. */
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const M=require('../core/movement_rules');
const L=require('../core/legal_pathfinding');
const C=require('../maps/composer'),A=require('../core/composite_land_movement_candidate');
const Graph=require('../core/map_movement_graph');
const base=require('../maps/kiev.json'),ext=require('../maps/odessa-extension.json');
const rail=require('../maps/movement-configs/odessa-source-route-rail-ledger-v496.json');
const cities=require('../maps/victory-configs/odessa-source-city-ledger-v497.json');
const p=require('../maps/movement-configs/kiev-odessa-territory-candidate-v499.json');
const prev=require('../maps/movement-configs/kiev-odessa-cavalry-candidate-v498.json');
const kiev=require('../maps/movement-configs/kiev.json');
const sheet=require('../maps/counter-configs/odessa-extension.json');
const clone=x=>JSON.parse(JSON.stringify(x));let checks=0;
const eq=(a,b,m)=>{assert.deepStrictEqual(a,b,m);checks++},ok=(a,m)=>{assert.ok(a,m);checks++};
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
eq(sha('references/rules/odessa-rules.pdf'),sheet.rulesPDF.sha256,'original §9.4.4–5 rulebook pinned');
eq(M.validProfile(p),true,'territory candidate valid');
eq(M.validProfile(prev),true,'prior cavalry profile retained');
eq(M.validProfile(kiev),true,'Kiev source profile retained');
eq(p.executableStatus,'source-reviewed-diagnostic-not-authorized','Odessa remains non-live');
const t=p.territorialPolicy;
eq(t.regionField,'sourceTerritory','exact source territory only');
const home=t.restrictedSourceUnits[0];
eq(home.sourceIdentityKey,'romanian-home-army','exact source identity');
for(const id of home.sourceFaceIds){
 const face=[...sheet.faces.front,...sheet.faces.back].find(x=>x.faceId===id);
 ok(face,'photographed Home Army face '+id);eq(face.sourceIdentityKey,home.sourceIdentityKey,'face identity '+id);
 ok(face.sourceCitation?.section?.includes('9.4.4'),'Home Army has rule citation '+id);
}
const copy=clone(t);
for(const mutate of [
 x=>{x.regionField='territory';},x=>{x.regions.push('romania');},
 x=>{x.regions=x.regions.filter(r=>r!=='bessarabia');},
 x=>{x.restrictedSourceUnits[0].sourceFaceIds.push(x.restrictedSourceUnits[0].sourceFaceIds[0]);},
 x=>{x.nationalEntryExclusions[0].regions.push('unknown');},
 x=>{x.annexation.clearOfOwner='german';},
 x=>{x.restrictedSourceUnits[0].forbidAdvanceAcrossRomanianBorder=false;}
]){
 const policy=clone(copy);mutate(policy);
 const config=clone(p);config.territorialPolicy=policy;
 eq(M.validProfile(config),false,'invalid candidate policy rejects');
}
// Small, UNREAL source-complete fixture. Its geography is test-only and is
// never mapped onto historic city/river/rail hex IDs.
const cells={};for(const [hex,region] of Object.entries({R:'romania',T:'romania',B:'bessarabia',C:'bessarabia',X:'outside',N:'outside'}))
 cells[hex]={terrain:'open',verified:true,sourceTerritory:region,territoryEvidence:'source-certified'};
const edges=[];for(const [a,b] of [['R','T'],['R','B'],['T','C'],['B','C'],['B','X'],['X','N'],['C','X']])
 edges.push({a,b,verified:true,rail:false,impassable:false,lake:false,allSea:false});
const board={cells,edges};
const unit=(id,owner,nationality,hex,identity)=>({id,owner,nationality,hex,class:'infantry',size:'corps',mp:3,
  ...(identity?{sourceIdentityKey:identity,sourceFaceId:'odessa-front-r01c05'}:{})});
const homeUnit=()=>unit('home','german','romanian','R','romanian-home-army');
const hung=()=>unit('hun','german','hungarian','X');
const context=(u,units=[u],annexed=false,scenarioBoard=board)=>({profile:p,board:scenarioBoard,turn:2,
 phase:{owner:u.owner,kind:'movement'},units:Object.fromEntries(units.map(x=>[x.id,x])),territory:{bessarabiaAnnexed:annexed}});
let ctx=context(homeUnit());
ok(M.move(ctx,{unitId:'home',path:['R','T']}).ok,'Home Army may operate within Romania');
eq(M.move(ctx,{unitId:'home',path:['R','B']}).reason,'home-army-territory-restricted','before annexation cannot cross');
const sov=unit('sov','soviet','soviet','C');
eq(M.bessarabiaAnnexation(context(homeUnit(),[homeUnit(),sov])).annexed,false,'Soviets in Bessarabia prevent annexation');
const sovMarker={...sov,id:'fleet',marker:true};
eq(M.bessarabiaAnnexation(context(homeUnit(),[homeUnit(),sovMarker])).annexed,false,
 'literal any Soviet unit in Bessarabia prevents early annexation; Fleet effect separately pending');
const annex=M.bessarabiaAnnexation(ctx);
eq(annex.annexed,true,'last Soviet departure permits annexation');
eq(annex.changed,true,'first annexation is event');
eq(ctx.territory.bessarabiaAnnexed,false,'pure annexation function never mutates state');
const amended={...ctx,territory:annex.territory};
ok(M.move(amended,{unitId:'home',path:['R','B']}).ok,'annexed Bessarabia is accessible');
eq(M.move(amended,{unitId:'home',path:['R','B','X']}).reason,'home-army-territory-restricted','Home Army cannot continue outside annexed region');
eq(M.territorialAccess(amended,homeUnit(),'B','advance').reason,'home-army-border-advance-forbidden',
 'cross-Romanian-border Advance After Combat forbidden even after annexation');
ok(M.territorialAccess(amended,homeUnit(),'T','advance').ok,'Advance inside Romania allowed');
ok(M.territorialAccess(amended,homeUnit(),'B','retreat').ok,'retreat access can be evaluated separately');
const reentered=M.bessarabiaAnnexation({...amended,units:{home:homeUnit(),sov}});
eq(reentered.annexed,true,'Soviet re-entry does not reverse annexation');
eq(reentered.changed,false,'annexation remains latched');
let ctxHun=context(hung());
eq(M.move(ctxHun,{unitId:'hun',path:['X','B']}).reason,'national-territory-exclusion','Hungarians cannot enter Bessarabia');
ok(M.move(ctxHun,{unitId:'hun',path:['X','N']}).ok,'Hungarian movement elsewhere still allowed');
eq(M.territorialAccess(ctxHun,hung(),'R','advance').reason,'national-territory-exclusion','Hungarian advance into Romania forbidden');
const romanianRegular=unit('rom','german','romanian','R','romanian-4th-army');delete romanianRegular.sourceFaceId;
ok(M.move(context(romanianRegular),{unitId:'rom',path:['R','B']}).ok,'ordinary Romanian army not Home Army restricted');
eq(M.move(context(unit('unbound','german','romanian','R')),{unitId:'unbound',path:['R','B']}).reason,
 'territorial-source-identity-unverified','unbound Romanian identity fails closed');
const forged=homeUnit();forged.sourceIdentityKey='romanian-4th-army';
eq(M.move(context(forged),{unitId:'home',path:['R','B']}).reason,'territorial-source-identity-mismatch','inconsistent face/identity rejected');
// The 19 user-adjudicated Bessarabia labels added in v501 are carried into
// the diagnostic map, but are NOT counterfeit source-certified country data.
// The original v499 policy remains fail-closed without a footprint clause.
const composed=C.compose(base,ext),authBoard=A.build(base,ext,composed,rail,cities).board;
eq(authBoard.metadata.hexes,261,'real combined board intact');
eq(authBoard.metadata.sourceRailEdges,117,'rail reconciliation intact');
eq(authBoard.metadata.impassableSeaOrCoast,100,'sea/coast barriers intact');
eq(Object.values(authBoard.cells).filter(c=>c.sourceTerritory==='bessarabia').length,19,
 'exactly user-adjudicated Bessarabia cells, carried as diagnostic evidence');
eq(Object.values(authBoard.cells).filter(c=>c.territoryEvidence==='source-certified').length,0,
 'no imaginary source-certified territory mask');
eq(M.move(context(homeUnit(),undefined,false,authBoard),{unitId:'home',path:['R','B']}).reason,
 'unverified-connection','synthetic hexes are not real map locations');
const realHome=homeUnit();realHome.hex='1106';
eq(M.move(context(realHome,undefined,false,authBoard),{unitId:'home',path:['1106','1107']}).reason,
 'territory-unverified','real board Home Army deliberately blocked pending source mask');
eq(M.bessarabiaAnnexation(context(realHome,undefined,false,authBoard)).reason,
 'territory-unverified','real board cannot annex without full verified geography');
assert.throws(()=>Graph.build(composed),/source-geometry-not-gameplay-certified/);checks++;
// Existing profiles have zero implicit territorial restrictions even if
// nationality is Romanian/Hungarian and the board has no country tags.
ok(M.territorialAccess({...ctx,profile:kiev},homeUnit(),'B','advance').ok,'original Kiev profile no new restriction');
const unboundPaths=L.search(ctxHun,{unitId:'hun',maxDepth:3,maxStates:1000});
eq(unboundPaths.costTo('B'),Infinity,'path finder respects exclusion');
eq(unboundPaths.costTo('N'),1,'non-restricted path still found');
const report={version:'v499',checkpoint:265,scope:'diagnostic-only',originalSource:'odessa-rules.pdf §§9.4.4–9.4.5',
 syntheticTerritory:'fixture-only',sourceMapHexes:261,sourceMaskApproved:false,annexationPersistence:true,
 countryMaskRequiredBeforeGameplay:true,checks};
if(process.env.WRITE_AUDIT==='1')fs.writeFileSync('rules/audit/odessa-territorial-restrictions-v499.json',JSON.stringify(report,null,2)+'\n');
console.log('PASS Odessa territorial restrictions candidate v499',checks,'assertions');
