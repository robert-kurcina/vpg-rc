'use strict';
/* Checkpoint 270 / v504: §9.4.4 annexation can be determined from the user's
 * complete 19-cell Bessarabia region without inventing 242 country labels.
 * This is a source-adjudicated DIAGNOSTIC, not production graph permission. */
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const M=require('../core/movement_rules');
const T=require('../core/territorial_state_transition');
const C=require('../maps/composer');
const A=require('../core/composite_land_movement_candidate');
const Graph=require('../core/map_movement_graph');
const b=require('../maps/kiev.json'),ext=require('../maps/odessa-extension.json');
const p=require('../maps/movement-configs/kiev-odessa-territory-candidate-v504.json');
const previous=require('../maps/movement-configs/kiev-odessa-territory-candidate-v499.json');
const rail=require('../maps/movement-configs/odessa-source-route-rail-ledger-v496.json');
const cities=require('../maps/victory-configs/odessa-source-city-ledger-v497.json');
const clone=x=>JSON.parse(JSON.stringify(x));let checks=0;
const eq=(a,b,s)=>{assert.deepEqual(a,b,s);checks++};
const yes=(a,s)=>{assert.ok(a,s);checks++};
const rejects=(f,pattern,s)=>{assert.throws(f,pattern,s);checks++};
const hash=x=>crypto.createHash('sha256').update(fs.readFileSync(x)).digest('hex');
const map=C.compose(b,ext),board=A.build(b,ext,map,rail,cities).board;
const fp=p.territorialPolicy.annexation.approvedFootprint;
const region=ext.compositeTerritoryRegions[0];
const expected='1111 1112 1113 1114 1115 1116 1211 1212 1213 1214 1215 1312 1313 1314 1315 1316 1413 1414 1514'.split(' ');
eq(M.validProfile(p),true,'profile with source-pinned regional footprint valid');
eq(p.executableStatus,'source-reviewed-diagnostic-not-authorized','still not promoted');
eq(board.metadata.mapId,fp.boardId,'source graph ID');
eq(board.metadata.noRulesAuthorization,true,'source graph is explicitly nonlive');
eq(fp.hostCells,expected,'user-approved exact list');
eq(fp.hostCells,region.hostCells,'map and source profile agree');
eq(fp.source,region.source,'independent source provenance');
eq(fp.evidence,region.territoryEvidence,'user decision, not imaginary archival certification');
eq(Object.keys(board.cells).length,261,'actual composite hex count');
eq(Object.values(board.cells).filter(x=>x.sourceTerritory==='bessarabia').length,19);
eq(Object.values(board.cells).filter(x=>x.sourceTerritory===undefined).length,242);
eq(Object.values(board.cells).filter(x=>x.territoryEvidence==='source-certified').length,0);
for(const id of expected){
 const c=board.cells[id];yes(c,'real board contains '+id);
 eq(c.verified,true,'region hex playable terrain '+id);
 eq(c.sourceTerritory,'bessarabia','region '+id);
 eq(c.territoryEvidence,'user-adjudicated','evidence '+id);
 eq(c.territorySource,fp.source,'provenance '+id);
}
const u=(id,owner,hex,nationality=owner,identity=null)=>({id,owner,hex,nationality,mp:6,
 class:'infantry',size:'corps',...(identity?{sourceIdentityKey:identity,sourceFaceId:'odessa-front-r01c05'}:{})});
const sov=u('s','soviet','1212'),home=u('h','german','1112','romanian','romanian-home-army'),
 hun=u('g','german','1112','hungarian');
const state=(unitMap,annexed=false)=>({scenarioId:'kiev-odessa',turn:2,
 units:Object.fromEntries(unitMap.map(x=>[x.id,clone(x)])),territory:{bessarabiaAnnexed:annexed},
 journal:[{kind:'before'}]});
const s0=state([sov,home]),original=clone(s0);
const c0=T.commit({profile:p,board,state:s0});yes(c0.ok,'19 complete enough for annexation check');
eq(c0.state.territory.bessarabiaAnnexed,false,'Soviet still in Bessarabia');
eq(c0.event,null);
eq(s0,original,'pure state transition');
const after=clone(s0);after.units.s.hex='1404';
const c1=T.commit({profile:p,board,state:after});yes(c1.ok);
eq(c1.state.territory.bessarabiaAnnexed,true,'last Soviet departure annexes');
eq(c1.event,{kind:'bessarabia-annexed',region:'bessarabia',permanent:true});
eq(after.territory.bessarabiaAnnexed,false,'no eager mutation');
eq(c1.state.journal,after.journal,'journal preserved');
const c1repeat=T.commit({profile:p,board,state:c1.state});yes(c1repeat.ok);
eq(c1repeat.event,null,'no duplicate annexation event');
const returned=clone(c1.state);returned.units.s.hex='1212';
const c2=T.commit({profile:p,board,state:returned});yes(c2.ok);
eq(c2.state.territory.bessarabiaAnnexed,true,'Soviet reentry never revokes');
eq(c2.event,null);
const replay=T.commit({profile:p,board,state:clone(after)});
eq(replay,c1,'annexation replay deterministic');
const undo=T.commit({profile:p,board,state:clone(original)});
eq(undo.state.territory.bessarabiaAnnexed,false,'reversible by restoring pre-annexation state');
// Source approval is precise and fragile to any mismatch, including silent
// loss/reclassification of a single approved hex or any spurious extra cell.
const attacked=[
 ['missing approved cell',x=>{delete x.cells['1112']},'territory-unverified'],
 ['wrong approved territory',x=>{x.cells['1112'].sourceTerritory='outside'},'territory-unverified'],
 ['approved provenance tampered',x=>{x.cells['1112'].territorySource='unknown'},'territory-unverified'],
 ['approved evidence upgraded without source',x=>{x.cells['1112'].territoryEvidence='source-certified'},'territory-unverified'],
 ['approved terrain unverified',x=>{x.cells['1112'].verified=false},'territory-unverified'],
 ['extra fabricated Bessarabia',x=>{x.cells['1404'].sourceTerritory='bessarabia'},'territory-unverified'],
 ['wrong board identity',x=>{x.metadata.mapId='kiev'},'territory-unverified'],
 ['board hex missing outside region',x=>{delete x.cells['1704']},'territory-unverified']
];
for(const [label,mutate,reason] of attacked){const x=clone(board);mutate(x);
 eq(T.commit({profile:p,board:x,state:after}).reason,reason,label);
 eq(M.territorialAccess({profile:p,board:x,territory:{bessarabiaAnnexed:true}},home,'1113','movement','1112').reason,
  'territory-unverified','tampered footprint does not license restricted move: '+label);
}
const badProfile=[
 x=>{x.territorialPolicy.annexation.approvedFootprint.hostCells.push('1111')},
 x=>{x.territorialPolicy.annexation.approvedFootprint.region='romania'},
 x=>{x.territorialPolicy.annexation.approvedFootprint.evidence='unknown'},
 x=>{x.territorialPolicy.annexation.approvedFootprint.hostCells.push('invalid')},
 x=>{x.territorialPolicy.annexation.approvedFootprint.mapHexCount=0}
];
for(const mutate of badProfile){const x=clone(p);mutate(x);eq(M.validProfile(x),false,'reject bad territory source config');}
// Only within-Bessarabia movement can be assessed for Home Army in this
// partial mask; no Romanian territory has been authorized outside 19 cells.
const phase={owner:'german',kind:'movement'};
const beforeMove={profile:p,board,phase,units:{h:home},turn:2,territory:{bessarabiaAnnexed:false}};
const afterMove={...beforeMove,territory:{bessarabiaAnnexed:true}};
eq(M.move(beforeMove,{unitId:'h',path:['1112','1113']}).reason,'home-army-territory-restricted');
yes(M.move(afterMove,{unitId:'h',path:['1112','1113']}).ok,'inside certified Bessarabia after annexation');
eq(M.move(afterMove,{unitId:'h',path:['1112','1012']}).reason,'territory-unverified','cannot infer country outside 19 cells');
eq(M.territorialAccess(afterMove,home,'1113','retreat','1112').ok,true,'retreat permitted inside annexed region');
eq(M.territorialAccess(afterMove,home,'1113','advance','1112').ok,true,'no invented Russo-Romanian border for inside-region advance');
eq(M.move({...afterMove,units:{g:hun}},{unitId:'g',path:['1112','1113']}).reason,
 'national-territory-exclusion','Hungarian forbidden even after annexation');
eq(M.move({...afterMove,units:{h:home},territory:{bessarabiaAnnexed:false}},
 {unitId:'h',path:['1112','1113']}).reason,'home-army-territory-restricted');
// v649: reuse of approved footprint is limited to a read-only scope. A
// later scope must detect tampering and must not reuse cached approval.
const scoped={...afterMove,board:clone(board),profile:clone(p)};
const probe=()=>M.territorialAccess(scoped,home,'1113','movement','1112');
const scopedParity=()=>{const expected=probe();M.withSearchIndexes(scoped,()=>{eq(probe(),expected);eq(probe(),expected);});return expected;};
yes(scopedParity().ok,'valid approved footprint within batch');
scoped.board.cells['1112'].territorySource='tampered';
eq(scopedParity().reason,'territory-unverified','no cached source approval across batches');
scoped.board.cells['1112'].territorySource=fp.source;
yes(scopedParity().ok,'restored approved footprint rechecked');
scoped.profile.territorialPolicy.annexation.approvedFootprint.hostCells.push('1111');
eq(scopedParity().reason,'invalid-territorial-policy','invalid mutated policy rechecked');
// A sovereign-boundary answer outside the footprint remains UNKNOWN. Do not
// promote this rule-only qualification to production Odessa movement.
const unreviewed=Object.keys(board.cells).find(x=>board.cells[x].verified&&board.cells[x].sourceTerritory===undefined);
yes(unreviewed,'at least one real unreviewed Romanian/outside candidate');
eq(M.territorialAccess(afterMove,home,unreviewed,'retreat','1112').reason,
 'territory-unverified','retreat outside known area must not cause a fake casualty');
rejects(()=>T.retreatStep({profile:p,board,state:c1.state,unit:home,from:'1112',to:unreviewed}),
 /country identity\/coverage unverified/,'unknown region cannot be inferred from retreat');
eq(M.bessarabiaAnnexation({profile:previous,board,units:after.units,territory:after.territory}).reason,
 'territory-unverified','legacy v499 policy does not inherit new gate');
rejects(()=>Graph.build(map),/source-geometry-not-gameplay-certified/,'composite never promoted to a production graph');
eq(hash('references/rules/odessa-rules.pdf'),require('../maps/counter-configs/odessa-extension.json').rulesPDF.sha256,'original PDF unchanged');
const audit={checkpoint:270,version:'v504',scope:'diagnostic-only-no-odessa-gameplay-authorization',
 source:region.source,footprint:expected,hexes:261,unclassified:242,
 independentAnnexationQualification:true,restrictionOutsideFootprintFailClosed:true,
 actualOdessaUndoSaveRestoreCertified:false,originalSourcePDF:hash('references/rules/odessa-rules.pdf'),checks};
if(process.env.WRITE_AUDIT==='1')fs.writeFileSync('rules/audit/odessa-annexation-footprint-v504.json',JSON.stringify(audit,null,2)+'\n');
console.log('PASS Odessa source-scoped 19-cell annexation v504',checks,'checks');
