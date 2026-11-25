'use strict';
/* Checkpoint 242 / v476. Test-only Kiev capture/recapture on original 165-cell
 * source-reviewed candidate geometry. Neither the unapproved movement graph
 * nor a full historical Romanian political border is promoted to live gameplay.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const F=require('./fixtures/kiev-source-opening-v437');
const Initial=require('../core/historical_source_initial_state');
const Campaign=require('../core/historical_campaign_session');
const Catalog=require('../core/historical_campaign_action_catalog');
const Binding=require('../core/movement_binding');
const Graph=require('../core/map_movement_graph');
const P=require('../maps/movement-configs/kiev.json');
const Phases=require('../maps/phase-configs/kiev.json');
const Combat=require('../maps/combat-configs/kiev.json');
const Buildup=require('../maps/buildup-configs/kiev.json');
const Housekeeping=require('../maps/housekeeping-configs/kiev.json');
const Candidate=require('../maps/movement-configs/kiev-source-reviewed-candidate-v435.json');
const Policies=require('../maps/movement-configs/graph-sources.json');
const Registry=require('../maps/movement-configs/source-reviewed-edge-ledgers.json');
const clone=x=>JSON.parse(JSON.stringify(x));
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
let assertions=0;
function eq(a,b,message){assert.deepStrictEqual(a,b,message);assertions++;}
function ok(a,message){assert.ok(a,message);assertions++;}
function bad(f,re,message){assert.throws(f,re,message);assertions++;}
const originalPolicy=clone(Policies.maps[F.map.id]);
const sourceFingerprints={
 rulebook:sha('references/rules/kiev-rules.pdf'),
 map:sha('maps/kiev.json'),
 svg:sha('maps/source/user-svg/kiev-odessa-main.svg'),
 movementAuthorization:sha('maps/movement-configs/graph-sources.json'),
 combatPolicy:sha('maps/combat-configs/kiev.json')
};
let receipt;
const gameGate=()=>Graph.build({...F.map,sourceImageSHA256:'untrusted-v485-test'});
bad(gameGate,/source-geometry-not-gameplay-certified/,'Kiev live graph initially blocked');
try{
 const record=Policies.maps[F.map.id];
 Object.assign(record,{
  status:'verified',mapId:F.map.id,sourceGame:F.map.sourceGame,
  sourceImageSHA256:F.map.sourceImageSHA256,
  geometryStatus:F.map.geometry.calibrationStatus,
  evidenceTier:'source-authoritative',edgeMode:'source-reviewed-v1',
  sourceEvidenceMode:Candidate.sourceEvidenceMode,
  edgeLedgerSHA256:Candidate.edgeLedgerSHA256,
  terrainStatuses:Candidate.terrainStatuses,railStatus:Candidate.railStatus,
  edgeSource:Candidate.edgeSource,coverage:Candidate.coverage
 });
 eq(Registry.maps[F.map.id].sourceSvgSha256,sourceFingerprints.svg,
  'original authoritative source geometry unchanged');
 eq(Combat.requireFirstTurnTerritorialRestriction,true,'source §10.8 requirement remains active');
 eq(Combat.firstTurnTerritorialRestriction.targetHexes,['0709','0809','0910','1010'],
  'adjudicated game-only Romanian target set');
 const testOnlyPolicy=clone(Combat);
 const original=Initial.build({map:F.map,setupSpec:F.setupSpec,counterConfig:F.counterConfig,
  inventory:F.inventory,allocation:F.allocation,placements:F.placements});
 eq(original.sourceSetupValid,true,'source-legal sample opening');
 eq(original.gameplayAuthorized,false,'opening is not authorized historical gameplay');
 const context={map:F.map,profile:P,config:Phases,counterConfig:F.counterConfig,
  combatPolicy:testOnlyPolicy,enableAirSupport:true,buildupPolicy:Buildup,
  buildupAllocation:F.allocation,housekeepingPolicy:Housekeeping,
  cursor:{scenarioId:'kiev',turn:1,index:2,complete:false},actor:'german',state:original.state};
 ok(Campaign.create({...context,combatPolicy:Combat}),
  'Kiev §10.8 works on the TEST-ONLY injected map without bypass');
 const binding=Binding.build(F.map,P);
 eq(Object.keys(binding.board.cells).length,165);
 eq(binding.board.edges.length,442);
 const kovel=F.map.cells.find(c=>c.city?.name==='Kovel');
 eq(kovel?.id,'0502','named city verified by source-authored map');
 const sourceEdge=binding.board.edges.find(e=>
  [e.a,e.b].sort().join(':')===['0402','0502'].sort().join(':'));
 ok(sourceEdge?.verified&&!sourceEdge?.impassable,'Polish attacker connects to Kovel on real hexside');
 let session=Campaign.create(context);
 const events=[];
 function step(action){
  const before=session.snapshot();
  const result=session.execute(action);
  session=result.session;
  events.push({turn:before.cursor.turn,phase:before.phaseId,type:action.type,
   subaction:action.action?.type||null});
  return result;
 }
 function control(){return session.snapshot().state.cityControl.Kovel;}
 function cityScore(){return Object.values(session.snapshot().state.cityControl)
  .filter(owner=>owner==='german').length;}
 eq(session.snapshot().phaseId,'german-combat');
 eq(control(),'soviet');eq(cityScore(),2,'only Lublin and Iasi initially Axis');
 const gId='kiev-front-r02c03',sId='kiev-front-r05c02';
 const proposal={defenderHex:'0502',attackers:[gId]};
 const legalGerman=Catalog.discover({session,context,enumerateCombinedPlans:false});
 ok(legalGerman.proposals.some(p=>JSON.stringify(p)===JSON.stringify(proposal)),
  'real German attack on Kovel is discoverable');
 eq(session.snapshot().phaseId,'german-combat','legal discovery read-only');
 step({type:'combat',action:{type:'commit-battles',battles:[proposal]}});
 step({type:'combat',action:{type:'select-battle',defenderHex:'0502'}});
 step({type:'combat',action:{type:'commit-ground-air',faceId:null}});
 const preRoll=clone(session.snapshot()),preRollSave=clone(session.save());
 const germanOptions=Catalog.discoverPostRoll({session,context,die:2});
 eq(germanOptions.crtOutcome,'EX','actual common B4M CRT Exchange, not forced outcome');
 ok(germanOptions.options.length>=2,'advance and non-advance alternatives exist');
 const take= germanOptions.options.find(o=>o.advanced===gId&&
  o.action.action.choices.advanceUnitId===gId);
 const decline=germanOptions.options.find(o=>!o.advanced);
 ok(take&&decline,'same actual die supports either post-combat advance choice');
 eq(session.snapshot(),preRoll,'post-roll discovery cannot commit choices');
 eq(Campaign.restore(preRollSave,context).snapshot(),preRoll,'pre-roll save/restore');
 const noAdvance=session.execute(decline.action);
 eq(noAdvance.session.snapshot().state.units[gId].hex,'0402','decline keeps attacker at origin');
 eq(noAdvance.session.snapshot().state.units[sId],undefined,'source Soviet Mech eliminated either way');
 eq(noAdvance.session.snapshot().state.cityControl.Kovel,'soviet',
  'declined advance must not capture vacated city');
 eq(noAdvance.session.undo().session.snapshot(),preRoll,'undo declined choice exact');
 const germanResult=step(take.action);
 eq(germanResult.event.outcome,'EX');
 eq(germanResult.event.advanced,gId);
 eq(germanResult.event.battle.defenderHex,'0502');
 eq(session.snapshot().state.units[gId].hex,'0502','attacker advances to vacated source city');
 eq(session.snapshot().state.units[gId].strengthStatus,'printed-reduced',
  'attacker paid original CRT Exchange step');
 eq(session.snapshot().state.units[sId],undefined,'original one-step Mech destroyed');
 eq(control(),'soviet','control adjudication occurs at combat phase completion');
 eq(session.undo().session.snapshot(),preRoll,'undo exact advance and exchange');
 eq(Campaign.restore(clone(session.save()),context).snapshot(),session.snapshot(),
  'post-roll committed decision survives journal restore');
 step({type:'combat',action:{type:'finish-combat'}});
 eq(session.snapshot().phaseId,'german-special-movement');
 eq(control(),'german','original shared engine credits German advance at phase close');
 eq(cityScore(),3,'Kovel becomes third Axis-controlled victory city');
 for(const expected of ['german-special-movement','soviet-buildup','soviet-special-movement']){
  eq(session.snapshot().phaseId,expected,'source phase order');
  step(expected==='soviet-buildup'?{type:'finish-buildup'}:{type:'finish-phase'});
 }
 eq(session.snapshot().phaseId,'soviet-combat');
 eq(control(),'german');
 const sovietProposal={defenderHex:'0502',attackers:['kiev-front-r03c05']};
 const sovietCatalog=Catalog.discover({session,context,enumerateCombinedPlans:false});
 ok(sovietCatalog.proposals.some(p=>JSON.stringify(p)===JSON.stringify(sovietProposal)),
  'Turn-1 Soviet counterattack on Kovel is legal and discoverable');
 step({type:'combat',action:{type:'commit-battles',battles:[sovietProposal]}});
 step({type:'combat',action:{type:'select-battle',defenderHex:'0502'}});
 const preCounterattack=clone(session.snapshot());
 const sovietOptions=Catalog.discoverPostRoll({session,context,die:1});
 eq(sovietOptions.crtOutcome,'DR','real shared CRT forces German defender retreat');
 ok(sovietOptions.options.length>=2,'real candidate has alternative retreat/advance choices');
 const recapture=sovietOptions.options.find(o=>o.advanced===sovietProposal.attackers[0]&&
  Array.isArray(o.action.action.choices.retreatPaths?.[gId])&&
  o.action.action.choices.retreatPaths[gId].length===2);
 ok(recapture,'verified legal two-hex German retreat and immediate Soviet advance');
 bad(()=>session.execute({type:'combat',action:{type:'resolve-battle',die:1,
  choices:{retreatPaths:{[gId]:['0708','1110']},advanceUnitId:sovietProposal.attackers[0]}}}),
  /Invalid committed combat transaction|route|retreat/i,
  'forged nonadjacent retreat cannot be committed');
 eq(session.snapshot(),preCounterattack,'invalid retreat fails atomically');
 const retreat=recapture.action.action.choices.retreatPaths[gId];
 const sovietResult=step(recapture.action);
 eq(sovietResult.event.outcome,'DR');
 eq(session.snapshot().state.units[gId].hex,retreat.at(-1),'German defender routed two hexes');
 eq(session.snapshot().state.units[sovietProposal.attackers[0]].hex,'0502',
  'Soviet counterattacker advances into Kovel');
 eq(sovietResult.event.retreats.find(x=>x.unitId===gId).route,retreat,
  'retreat receipt agrees with catalogued source-valid hexside path');
 eq(control(),'german','city control not silently changed before phase close');
 eq(Campaign.restore(clone(session.save()),context).snapshot(),session.snapshot(),
  'Soviet counterattack journal exact');
 step({type:'combat',action:{type:'finish-combat'}});
 eq(session.snapshot().phaseId,'soviet-movement');
 eq(control(),'soviet','Soviet recaptures city using shared phase-close control update');
 eq(cityScore(),2,'Axis city score returns from 3 to 2');
 step({type:'finish-phase'});
 eq(session.snapshot().phaseKind,'housekeeping');
 const hk=step({type:'finish-housekeeping'});
 eq(hk.event?.turn,1,'original housekeeping closes the first game turn');
 eq(session.snapshot().cursor.turn,2,'Turn 1 completed via real housekeeping');
 eq(control(),'soviet','recapture persisted across turn boundary');
 eq(cityScore(),2,'victory-point city count persists');
 eq(Campaign.restore(clone(session.save()),context).snapshot(),session.snapshot(),
  'Turn-2 state can be fully reconstructed from actions');
 eq(sourceFingerprints.map,sha('maps/kiev.json'));
 eq(sourceFingerprints.svg,sha('maps/source/user-svg/kiev-odessa-main.svg'));
 eq(sourceFingerprints.movementAuthorization,sha('maps/movement-configs/graph-sources.json'));
 eq(sourceFingerprints.combatPolicy,sha('maps/combat-configs/kiev.json'));
 receipt={checkpoint:242,version:'v476',assertions,
  classification:'ISOLATED-TEST-ONLY-NOT-HISTORICAL-KIEV-GAMEPLAY',
  provenance:{...sourceFingerprints,candidateLedger:Candidate.edgeLedgerSHA256},
  scope:{sourceLegalButNotMandatoryHistoricalOpening:true,sourceKievHexes:165,
   actualKievPhysicalEdges:442,isolatedGraphAuthorization:true,
   testOnlyFirstTurnRomanianMaskBypass:false,romanianCountryMaskCertified:false,
   historicalKievGamePlayable:false,sourceMapUnchanged:true,
   gameRendererUnchanged:true},
  result:{actionCount:events.length,turnsCompleted:1,city:'Kovel',hex:'0502',
   initialAxisCities:2,afterGermanCombatAxisCities:3,
   afterSovietCombatAxisCities:2,germanOutcome:'EX',sovietOutcome:'DR',
   germanAttacker:gId,germanDefender:sId,sovietRecapturer:sovietProposal.attackers[0],
   originalGermanRetreat:retreat,advanceOptional:true,
   forgedRetreatRejected:true,journalRestore:true,undo:true,actionLog:events},
  limitations:['The source-reviewed Kiev movement graph remains provisional in production',
   'The four-setup-hex Turn-1 combat convention is not a claim of the complete historical Romanian border',
   'Opening face allocation is a permitted test fixture, not certified historical placement',
   'One-turn scripted city exchange cannot establish seven-turn playability or strategy']};
}finally{
 Policies.maps[F.map.id]=originalPolicy;
 eq(Policies.maps[F.map.id],originalPolicy,'test-local movement authorization restored');
 bad(gameGate,/source-geometry-not-gameplay-certified/,'live Kiev remains disabled after test');
}
receipt.assertions=assertions;
if(process.argv.includes('--write-audit'))
 fs.writeFileSync('rules/audit/kiev-kovel-contested-control-v476.json',
  JSON.stringify(receipt,null,2)+'\n');
console.log('PASS Kiev source-gated Kovel capture and Soviet recapture:',assertions,
 'assertions,',receipt.result.actionCount,'real shared-engine actions; production Kiev NOT PLAYABLE');
