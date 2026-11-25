'use strict';
/* Checkpoint 241 / v475. A STRICTLY ISOLATED contested seven-turn Kiev integration test
 * using the source-reviewed but PRODUCTION-BLOCKED Kiev candidate graph.
 * The test process temporarily binds the already-pinned v435 evidence to the
 * shared graph adapter with the user-adjudicated four-hex §10.8 rule ACTIVE.
 * Nothing is written into the source policy registry; no game is activated.
 * The sample starting face allocation is source-legal, not historical identity.
 * This run is not accepted Kiev gameplay or proof of a Romanian boundary.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),crypto=require('node:crypto');
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
const sha=(file)=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
let assertions=0;
const ok=(x,m)=>{assert.ok(x,m);assertions++};
const eq=(x,y,m)=>{assert.deepStrictEqual(x,y,m);assertions++};
const bad=(f,re,m)=>{assert.throws(f,re,m);assertions++};
const originalPolicy=clone(Policies.maps[F.map.id]);
const originalRule=clone(Combat);
const originalMap=sha('maps/kiev.json');
const originalRegistry=sha('maps/movement-configs/graph-sources.json');
const sourceDigest=sha('references/rules/kiev-rules.pdf');
const svgDigest=sha('maps/source/user-svg/kiev-odessa-main.svg');
const sourceLedger=Registry.maps[F.map.id];
let audit;
bad(()=>Graph.build({...F.map,sourceImageSHA256:'untrusted-v485-test'}),/source-geometry-not-gameplay-certified/,'real historical Kiev remains gated');
try {
 // The trusted registry is replaced IN THIS TEST PROCESS ONLY; actual files,
 // browser bundle, production source registry and other games are untouched.
 // An isolated process is required; never import this script from a browser.
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
 eq(svgDigest,sourceLedger.sourceSvgSha256,'untouched definitive source SVG');
 eq(sourceDigest,'d55e8f0e567d1f8c7907c4fc8368954ec0e5fa8d6fe9e8e71c61acf9bb3c3756');
 const bind=Binding.build(F.map,P);
 eq(Object.keys(bind.board.cells).length,165);
 eq(bind.board.edges.length,442);
 eq(bind.board.edges.filter(e=>e.rail).length,93);
 eq(bind.board.edges.filter(e=>e.river).length,72);
 eq(bind.board.edges.filter(e=>e.majorRiver).length,10);
 // §10.8 is now explicitly enforced for the four adjudicated setup hexes.
 eq(Combat.firstTurnTerritorialRestriction.targetHexes,['0709','0809','0910','1010']);
 eq(Combat.requireFirstTurnTerritorialRestriction,true);
 const testPolicy=clone(Combat);
 const source=Initial.build({map:F.map,setupSpec:F.setupSpec,counterConfig:F.counterConfig,
  inventory:F.inventory,allocation:F.allocation,placements:F.placements});
 eq(source.sourceSetupValid,true);
 eq(source.gameplayAuthorized,false);
 eq(Object.keys(source.state.units).length,30);
 const context={map:F.map,profile:P,config:Phases,counterConfig:F.counterConfig,
  combatPolicy:testPolicy,enableAirSupport:true,buildupPolicy:Buildup,
  buildupAllocation:F.allocation,housekeepingPolicy:Housekeeping,
  cursor:{scenarioId:'kiev',turn:1,index:2,complete:false},
  actor:'german',state:source.state};
 const strictContext={...context,combatPolicy:Combat};
 ok(Campaign.create(strictContext),
  'exact §10.8 combat policy now runs when TEST-ONLY graph is bound');
 let s=Campaign.create(context);
 const opening=clone(s.snapshot());
 eq(opening.phaseId,'german-combat');
 eq(opening.combat.status,'awaiting-declarations');
 eq(Object.keys(opening.state.units).length,30);
 let actionCount=0,reins=0,moves=0,battles=0,housekeep=0,replacements=0,groundCounterattacks=0;
 const actions=[],combatEvents=[],replacementEvents=[];
 function step(action){
  const before=s.snapshot();
  const next=s.execute(action);
  s=next.session;actionCount++;
  actions.push({turn:before.cursor.turn,phase:before.phaseId,type:action.type,detail:action.action?.type||null});
  return next;
 }
 // Romanian first-turn German corps must not attack even with this test-only
 // mask bypass. Use real source-adjacent hexes, not a fabricated second map.
 const romanian=Object.values(opening.state.units).find(u=>u.hex==='0709'&&u.owner==='german');
 ok(romanian&&RomanianOpening(romanian), 'real source Romanian set-up origin');
 function RomanianOpening(u){return Combat.firstTurnCombatRestriction.setupHexes.includes(u.openingHex);}
 bad(()=>s.execute({type:'combat',action:{type:'commit-battles',
  battles:[{defenderHex:'0708',attackers:[romanian.id]}]}}),
  /source-designated setup unit cannot attack/,'source §10.8 German opening restriction remains active');
 const proposals=Catalog.discover({session:s,context,enumerateCombinedPlans:false}).proposals;
 ok(proposals.some(x=>x.defenderHex==='0205'&&x.attackers.includes('kiev-front-r01c01')),
  'first Polish attack discovers source-adjacent target');
 const chosen={defenderHex:'0205',attackers:['kiev-front-r01c01','kiev-front-r01c03']};
 const second={defenderHex:'0401',attackers:['kiev-front-r01c08']};
 ok(proposals.some(x=>x.defenderHex===second.defenderHex&&JSON.stringify(x.attackers)===JSON.stringify(second.attackers)),
  'independent second attack is source-legal');
 ok(proposals.some(x=>x.defenderHex===chosen.defenderHex&&
  JSON.stringify(x.attackers)===JSON.stringify(chosen.attackers)),
  'both-attacker plan is source-legal and catalogued');
 step({type:'combat',action:{type:'commit-battles',battles:[chosen,second]}});
 step({type:'combat',action:{type:'select-battle',defenderHex:chosen.defenderHex}});
 step({type:'combat',action:{type:'commit-ground-air',faceId:'kiev-front-r03c01'}});
 const beforeDie=clone(s.snapshot()),savedBeforeDie=s.save();
 bad(()=>s.execute({type:'combat',action:{type:'resolve-battle',die:7,choices:{}}}),
  /Invalid committed combat transaction/,'invalid die cannot spend committed air');
 eq(s.snapshot(),beforeDie,'failed roll is atomic');
 eq(Campaign.restore(clone(savedBeforeDie),context).snapshot(),beforeDie,
  'pre-roll air commitment survives exact journal restore');
 const verifiedEX=Catalog.discoverPostRoll({session:s,context,die:3}).options;
 const chosenEX=verifiedEX.find(x=>x.outcome==='EX'&&x.losses?.some(l=>l.unitId==='kiev-front-r01c01'&&!l.removed)&&
  x.losses?.some(l=>l.unitId==='kiev-front-r03c04'&&!l.removed)&&!x.advanced);
 ok(chosenEX,'explicit exchange can damage both nations with source-validated retreat');
 const event=step(chosenEX.action).event;
 eq(event.outcome,'EX');
 combatEvents.push({side:'german',turn:1,defenderHex:event.battle.defenderHex,outcome:event.outcome,
  airFace:event.airSupport.faceId,losses:event.losses.map(x=>({unitId:x.unitId,removed:x.removed}))});
 eq(s.snapshot().state.units['kiev-front-r01c01'].strengthStatus,'printed-reduced');
 eq(s.snapshot().state.units['kiev-front-r03c04'].strengthStatus,'printed-reduced');
 eq(event.battle.defenderHex,'0205');
 eq(event.airSupport.faceId,'kiev-front-r03c01');
 eq(s.snapshot().state.airUse['1']['kiev-front-r03c01'],'ground');
 ok(['NE','DR','DRL','EX','AL','DE'].includes(event.outcome),'uses real common CRT result');
 battles++;
 step({type:'combat',action:{type:'select-battle',defenderHex:second.defenderHex}});
 step({type:'combat',action:{type:'commit-ground-air',faceId:'kiev-front-r03c02'}});
 const secondOptions=Catalog.discoverPostRoll({session:s,context,die:null}).options;
 ok(secondOptions.length>0,'second photographed air-supported battle has a legal consequence');
 const secondResult=step(secondOptions[0].action).event;
 eq(secondResult.airSupport.faceId,'kiev-front-r03c02');
 eq(secondResult.outcome,'NE','automatic no-die combat is resolved without invented random roll');
 combatEvents.push({side:'german',turn:1,defenderHex:secondResult.battle.defenderHex,
  outcome:secondResult.outcome,airFace:secondResult.airSupport.faceId,automaticNoDie:true});
 battles++;
 step({type:'combat',action:{type:'finish-combat'}});
 // One source-legal Soviet counterattack follows in Turn 1; other battle
 // opportunities are not fabricated as a certified political territory border.
 const across=[];
 const restoreGerman='kiev-front-r01c01',restoreSoviet='kiev-front-r03c04',
  rebuildSoviet='kiev-front-r04c03';
 while(!s.snapshot().cursor.complete){
  const snapshot=s.snapshot(),turn=snapshot.cursor.turn;
  if(actionCount>250)throw Error('Diagnostic campaign action budget exceeded');
  if(snapshot.phaseKind==='combat'){
   eq(snapshot.combat.status,'awaiting-declarations','normal ground-only combat cursor');
   if(turn===1&&snapshot.actor==='soviet'){
    const sovietProposals=Catalog.discover({session:s,context,enumerateCombinedPlans:false}).proposals;
    const sovietAttack=sovietProposals.find(x=>x.defenderHex==='0204'&&
     JSON.stringify(x.attackers)===JSON.stringify(['kiev-front-r04c02','kiev-front-r04c03']));
    ok(sovietAttack,'Soviet counterattack discovered by actual post-movement action catalog');
    step({type:'combat',action:{type:'commit-battles',battles:[sovietAttack]}});
    step({type:'combat',action:{type:'select-battle',defenderHex:sovietAttack.defenderHex}});
    const postRoll=Catalog.discoverPostRoll({session:s,context,die:6});
    eq(postRoll.crtOutcome,'AL','Soviet counterattack produces a source-resolved attacker-loss result');
    const sovietChoice=postRoll.options.find(x=>x.losses?.some(l=>l.unitId===rebuildSoviet&&l.removed));
    ok(sovietChoice,'an eligible 18th Mechanized unit can be eliminated in real Soviet counterattack');
    const reply=step(sovietChoice.action).event;
    eq(reply.outcome,'AL');
    combatEvents.push({side:'soviet',turn:1,defenderHex:reply.battle.defenderHex,
     outcome:reply.outcome,losses:reply.losses.map(x=>({unitId:x.unitId,removed:x.removed}))});
    eq(s.snapshot().state.units[rebuildSoviet],undefined,'18th Mechanized removed from map by real combat');
    ok(s.snapshot().state.buildupDeployedIds.includes(rebuildSoviet),
     'Soviet eliminated source face remains in the historical deployed ledger');
    battles++;groundCounterattacks++;
    step({type:'combat',action:{type:'finish-combat'}});
    continue;
   }
   step({type:'combat',action:{type:'commit-battles',battles:[]}});
   step({type:'combat',action:{type:'finish-combat'}});
  }else if(snapshot.phaseKind==='buildup'){
   if(snapshot.actor==='soviet'&&turn===1){
    bad(()=>s.execute({type:'apply-replacement',unitId:restoreSoviet,hex:null}),
     /No replacement steps remain/,'Soviet cannot use replacements on first turn');
   }
   if(snapshot.actor==='soviet'&&turn===2){
    eq(snapshot.state.units[restoreSoviet]?.strengthStatus,'printed-reduced','Soviet exchange loss persists to Turn 2');
    eq(snapshot.buildup.spent,0);
    const result=step({type:'apply-replacement',unitId:restoreSoviet,hex:null});replacements++;
    eq(result.event.kind,'replacement-restored');
    replacementEvents.push({turn,owner:snapshot.actor,kind:result.event.kind,unitId:restoreSoviet});
    eq(s.snapshot().buildup.spent,1);
    eq(s.snapshot().state.units[restoreSoviet].strengthStatus,'printed-full');
    eq(s.snapshot().state.units[rebuildSoviet],undefined,'destroyed Mechanized still off map before rebuilding');
    const beforeCatalog=clone(s.snapshot());
    const catalog=Catalog.discover({session:s,context,enumerateCombinedPlans:false});
    eq(s.snapshot(),beforeCatalog,'replacement catalogue cannot mutate campaign history');
    const permitted=catalog.commands.find(x=>x.type==='apply-replacement'&&x.unitId===rebuildSoviet);
    ok(permitted,'real source catalog offers destroyed 18th Mechanized as a possible replacement');
    const rebuilt=step(permitted);replacements++;
    eq(rebuilt.event.kind,'replacement-rebuilt');
    replacementEvents.push({turn,owner:snapshot.actor,kind:rebuilt.event.kind,unitId:rebuildSoviet,hex:permitted.hex});
    eq(s.snapshot().buildup.spent,2,'both Soviet replacement points spent in Turn 2');
    eq(s.snapshot().buildup.replacedMechanized,1,'Mechanized replacement cap applied');
    eq(s.snapshot().state.units[rebuildSoviet].strengthStatus,'revealed-one-step',
     'replaced Mechanized Corps retains revealed identity and one-step status');
    eq(s.snapshot().state.units[rebuildSoviet].hex,permitted.hex,
     'rebuild uses a source-authorized reinforcement hex');
    eq(s.snapshot().state.units[rebuildSoviet].revealedAttackStrength,2,
     'replacement reads the original 18th Mechanized photographed reverse attack face');
    eq(s.snapshot().state.units[rebuildSoviet].revealedDefenseStrength,1,
     'replacement reads original revealed defense face');
    eq(Campaign.restore(clone(s.save()),context).snapshot(),s.snapshot(),
     'replacement and revealed-identity decisions survive journal save/restore');
    bad(()=>s.execute({type:'apply-replacement',unitId:restoreSoviet,hex:null}),
     /No replacement steps remain/,'Soviet replacement allowance exhausted');
    eq(s.snapshot().state.units[restoreSoviet].strengthStatus,'printed-full');
   }
   if(snapshot.actor==='german'&&turn===4){
    eq(snapshot.state.units[restoreGerman]?.strengthStatus,'printed-reduced','German exchange loss persists to Turn 4');
    const result=step({type:'apply-replacement',unitId:restoreGerman,hex:null});replacements++;
    eq(result.event.kind,'replacement-restored');
    replacementEvents.push({turn,owner:snapshot.actor,kind:result.event.kind,unitId:restoreGerman});
    eq(s.snapshot().state.units[restoreGerman].strengthStatus,'printed-full');
   }
   const due=Buildup.reinforcements.filter(r=>r.turn===turn&&r.owner===snapshot.actor);
   for(const entry of due){
    // Use authentic national entry-edge cells from the approved Kiev SVG.
    // The choice is intentionally deterministic, NOT a historic march.
    let committed=false;
    for(const hex of Buildup.entryEdge[snapshot.actor]){
     try{step({type:'place-reinforcement',slotId:entry.slotId,hex});committed=true;reins++;break;}
     catch(e){if(!/Illegal reinforcement edge/.test(e.message))throw e;}
    }
    ok(committed,'source reinforcement can enter '+entry.slotId);
   }
   step({type:'finish-buildup'});
  }else if(['movement','special-movement'].includes(snapshot.phaseKind)){
   // A genuine shared-graph move, if possible, from the unchanged Kiev board.
   // Try only one adjacent step; no provisional multi-step path is certified.
   const candidates=Object.values(snapshot.state.units).filter(u=>u.owner===snapshot.actor&&
    u.id!==restoreGerman&&u.id!==restoreSoviet).sort((a,b)=>a.id.localeCompare(b.id));
   let request=null;
   for(const unit of candidates){
    for(const edge of bind.board.edges){
     if(edge.a!==unit.hex&&edge.b!==unit.hex)continue;
     const to=edge.a===unit.hex?edge.b:edge.a;
     const trial={unitId:unit.id,path:[unit.hex,to]};
     const phase={kind:snapshot.phaseKind,owner:snapshot.actor};
     if(Binding.move(bind,phase,snapshot.state.units,turn,trial).ok){request=trial;break;}
    }
    if(request)break;
   }
   if(request){
    step({type:'declare-ground-move',request});
    const outcome=step({type:'resolve-ground-move'});
    eq(s.snapshot().state.units[request.unitId].hex,request.path.at(-1),'Kiev hex move committed');
    eq(outcome.event?.to,request.path.at(-1),'source move receipt destination');
    moves++;
   }
   step({type:'finish-phase'});
  }else if(snapshot.phaseKind==='housekeeping'){
   step({type:'finish-housekeeping'});housekeep++;
   across.push({turn,axisCities:Object.values(s.snapshot().state.cityControl).filter(x=>x==='german').length});
  }else throw Error('Unrecognized historical phase '+snapshot.phaseKind);
 }
 const terminal=s.snapshot();
 eq(terminal.cursor.complete,true,'complete seven-turn sequence');
 eq(terminal.cursor.turn,7);
 eq(terminal.terminal.totalCities,16);
 eq(terminal.terminal.outcome,'soviet-victory','bounded no-capture scenario retains source terminal rule');
 eq(housekeep,7,'all seven housekeeping phases');
 eq(reins,6,'all six original scheduled ground arrivals');
 ok(moves>=8,'at least eight genuine shared-engine Kiev movements');
 eq(battles,3,'two German attacks and one Soviet counterattack on original Kiev map');
 eq(groundCounterattacks,1,'actual Soviet attack committed and resolved');
 eq(replacements,3,'two full-strength restorations and one source-legal Mechanized rebuild');
 eq(combatEvents.map(x=>x.outcome),['EX','NE','AL'],'both players combat outcomes source-verified');
 eq(replacementEvents.map(x=>x.kind),['replacement-restored','replacement-rebuilt','replacement-restored']);
 eq(Object.keys(terminal.state.units).length,36,
  '30 original source units, one destroyed/rebuilt Mechanized, six source ground arrivals');
 const terminalSaved=s.save();
 eq(Campaign.restore(clone(terminalSaved),context).snapshot(),terminal,
  'entire seven-turn campaign journal restores against exact source context');
 const undo=s.undo();eq(undo.ok,true);
 eq(undo.session.snapshot().cursor.turn,7);
 eq(undo.session.execute({type:'finish-housekeeping'}).session.snapshot(),terminal,
  'undo and re-commit terminal housekeeping transaction');
 eq(sha('maps/kiev.json'),originalMap,'source map was not edited');
 eq(sha('maps/movement-configs/graph-sources.json'),originalRegistry,'production movement policy file was not edited');
 audit={checkpoint:241,version:'v475',assertions,
  classification:'ISOLATED-DIAGNOSTIC-NOT-AUTHORIZED-KIEV-GAMEPLAY',
  graph:{hexes:165,edges:442,rails:93,rivers:72,majorRivers:10,
   originalPolicyStatus:originalPolicy.status,productionGraphAuthorized:false},
  source:{rulebookSha256:sourceDigest,svgSha256:svgDigest,
   sourceMapSha256:originalMap,productionGraphPolicySha256:originalRegistry},
  scope:{testProcessPolicyInjection:true,testProcessTerritoryMaskBypass:true,
   sourceLegalButNonhistoricalOpening:true,genuineKievHexsides:true,
   certifiedRomanianTerritory:false,airMarkers:['kiev-front-r03c01','kiev-front-r03c02'],
   realSharedEngineAndCRT:true,fullCampaignAcceptance:false},
  result:{actions:actionCount,sevenTurnHousekeeping:housekeep,moves,
   battles,groundCounterattacks,reinforcements:reins,replacements,
   combatEvents,replacementEvents,perTurnCityControl:across,
   terminalOutcome:terminal.terminal.outcome,
   endingSourceFaces:Object.keys(terminal.state.units).length,
   restore:true,undo:true,phases:actions.length},
  limitations:['No country boundary: one source restriction bypassed in TEST ONLY',
   'Source-legal 30-unit allocation is not a certified historical opening',
   'Three deliberately bounded battles and short moves; no strategic opponent',
   'Source movement authorization remains deliberately withheld in production']};
}finally{
 Policies.maps[F.map.id]=originalPolicy;
 eq(Policies.maps[F.map.id],originalPolicy,'source graph authorization restored inside test process');
 eq(Combat,originalRule,'source combat policy not edited by diagnostic');
 bad(()=>Graph.build({...F.map,sourceImageSHA256:'untrusted-v485-test'}),/source-geometry-not-gameplay-certified/,
  'live map graph remains closed after completed diagnostic');
}

// Only publish evidence after source policy was restored and gate rechecked.
audit.assertions=assertions;
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/kiev-contested-replacement-campaign-v475.json',JSON.stringify(audit,null,2)+'\n');
console.log('PASS Kiev contested 7-turn SOURCE-GATED TEST-ONLY diagnostic:',assertions,'assertions;',audit.result.actions,
 'actions,',audit.result.moves,'moves,',audit.result.battles,'battles,',audit.result.replacements,
 'replacements,',audit.result.reinforcements,'reinforcements,',audit.result.sevenTurnHousekeeping,'housekeeping phases; actual game remains NOT playable');
