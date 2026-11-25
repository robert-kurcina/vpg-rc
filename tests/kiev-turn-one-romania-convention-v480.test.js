'use strict';
/* Checkpoint 246: user-adjudicated scenario-only meaning of Romania under
 * Objective: Kiev §10.8. Original printed rulebook identifies setup slots;
 * treating EXACTLY those four as the Turn-1 target set is a gameplay decision,
 * not an independently certified geographical boundary. The movement graph
 * is injected in this isolated test process; it remains gated in production.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const F=require('./fixtures/kiev-source-opening-v437');
const Policy=require('../maps/combat-configs/kiev.json');
const Profile=require('../maps/movement-configs/kiev.json');
const Phases=require('../maps/phase-configs/kiev.json');
const Buildup=require('../maps/buildup-configs/kiev.json');
const Housekeeping=require('../maps/housekeeping-configs/kiev.json');
const Candidate=require('../maps/movement-configs/kiev-source-reviewed-candidate-v435.json');
const Policies=require('../maps/movement-configs/graph-sources.json');
const Graph=require('../core/map_movement_graph');
const Declarations=require('../core/historical_combat_declarations');
const Campaign=require('../core/historical_campaign_session');
const Initial=require('../core/historical_source_initial_state');
const Rules=require('../core/movement_rules');
const clone=x=>JSON.parse(JSON.stringify(x));
const sha=path=>crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const eq=(a,b,m)=>{assert.deepStrictEqual(a,b,m);checks++};
const yes=(v,m)=>{assert.ok(v,m);checks++};
const bad=(f,r,m)=>{assert.throws(f,r,m);checks++};
let checks=0;
const targets=['0709','0809','0910','1010'], eligible=['0708','0808','1110'];
const sourceHash=sha('references/rules/kiev-rules.pdf');
eq(sourceHash,require('../maps/combat-configs/kiev-turn-rules-v443.json').sourceSha256);
eq(Policy.firstTurnCombatRestriction.setupHexes,targets);
eq(Policy.firstTurnTerritorialRestriction.targetHexes,targets);
eq(Policy.firstTurnTerritorialRestriction.allowedOpeningHexes,eligible);
eq(Policy.firstTurnTerritorialRestriction.targetRegionEvidence.coverage,'setup-hexes-adjudicated');
eq(Policy.firstTurnTerritorialRestriction.targetRegionEvidence.interpretation,'scenario-turn-1-only');
eq(Policy.requireFirstTurnTerritorialRestriction,true);
const beforeSource={graph:sha('maps/movement-configs/graph-sources.json'),map:sha('maps/kiev.json'),
 combat:sha('maps/combat-configs/kiev.json'),rule:sourceHash};
bad(()=>Graph.build({...F.map,sourceImageSHA256:'untrusted-v485-test'}),/source-geometry-not-gameplay-certified/,'production Kiev graph remains closed');
const original=clone(Policies.maps[F.map.id]);
let audit;
try{
 // Source-verified graph is injected ONLY IN THIS TEST PROCESS, not promoted.
 Object.assign(Policies.maps[F.map.id],{
  status:'verified',mapId:F.map.id,sourceGame:F.map.sourceGame,
  sourceImageSHA256:F.map.sourceImageSHA256,geometryStatus:F.map.geometry.calibrationStatus,
  evidenceTier:'source-authoritative',edgeMode:'source-reviewed-v1',
  sourceEvidenceMode:Candidate.sourceEvidenceMode,edgeLedgerSHA256:Candidate.edgeLedgerSHA256,
  terrainStatuses:Candidate.terrainStatuses,railStatus:Candidate.railStatus,
  edgeSource:Candidate.edgeSource,coverage:Candidate.coverage
 });
 const board=Graph.build(F.map);
 eq(Object.keys(board.cells).length,165);eq(board.edges.length,442);
 const declaration=Declarations.create({map:F.map,profile:Profile,config:Phases,combatPolicy:Policy});
 const opening=Initial.build({map:F.map,setupSpec:F.setupSpec,counterConfig:F.counterConfig,
  inventory:F.inventory,allocation:F.allocation,placements:F.placements});
 eq(opening.sourceSetupValid,true);eq(opening.gameplayAuthorized,false);
 const units=opening.state.units;
 const at=hex=>Object.values(units).filter(u=>u.hex===hex);
 for(const hex of targets)yes(at(hex).some(u=>u.owner==='german'),'source Romanian setup '+hex);
 for(const hex of eligible)yes(at(hex).some(u=>u.owner==='soviet'),'source Soviet border setup '+hex);
 const cursor=(turn,actor)=>({scenarioId:'kiev',turn,index:actor==='soviet'?6:2,complete:false});
 const sovietBattle=(defenderHex,unit)=>({defenderHex,attackers:[unit.id]});
 const pick=(hex,owner)=>at(hex).find(u=>u.owner===owner);
 const s0708=pick('0708','soviet'),s0808=pick('0808','soviet'),s1110=pick('1110','soviet');
 const battleSets=[[s0708,'0709'],[s0808,'0809'],[s1110,'1010']];
 for(const [attacker,target] of battleSets){
  eq(declaration.declare({cursor:cursor(1,'soviet'),actor:'soviet',state:opening.state},
   [sovietBattle(target,attacker)]).battles.length,1,'Soviet origin '+attacker.openingHex+' may attack '+target);
  const forged=clone(opening.state);
  forged.units[attacker.id].openingHex='0502';
  bad(()=>declaration.declare({cursor:cursor(1,'soviet'),actor:'soviet',state:forged},
   [sovietBattle(target,forged.units[attacker.id])]),/eligible original setup hex/,
   'nonborder Soviet original setup may not attack Romanian target '+target);
  eq(declaration.declare({cursor:cursor(2,'soviet'),actor:'soviet',state:forged},
   [sovietBattle(target,forged.units[attacker.id])]).battles.length,1,
   'Romania exception ends after Turn 1');
 }
 const fromRomania=pick('0709','german');
 bad(()=>declaration.declare({cursor:cursor(1,'german'),actor:'german',state:opening.state},
  [sovietBattle('0708',fromRomania)]),/source-designated setup unit cannot attack/,
  'Romanian-origin Axis corps barred at first German combat');
 eq(declaration.declare({cursor:cursor(2,'german'),actor:'german',state:opening.state},
  [sovietBattle('0708',fromRomania)]).battles.length,1,
  'Romanian-origin Axis corps permitted in later turns');
 const fromOutside=pick('0502','soviet'),poland=pick('0402','german');
 yes(fromOutside&&poland,'authentic units for non-Romanian flank');
 eq(declaration.declare({cursor:cursor(1,'soviet'),actor:'soviet',state:opening.state},
  [sovietBattle('0402',fromOutside)]).battles.length,1,
  'nonborder Soviet may attack an Axis unit OUTSIDE the four Romanian hexes');
 const wrong=clone(opening.state);wrong.units[fromOutside.id].hex='0808';
 bad(()=>declaration.declare({cursor:cursor(1,'soviet'),actor:'soviet',state:wrong},
  [sovietBattle('0809',wrong.units[fromOutside.id])]),/eligible original setup hex/,
  'even after reaching border, openingHex still determines eligibility');
 // Mutations that silently widen the four-hex user convention must fail closed.
 for(const invalid of [
  {targetHexes:[...targets,'0909']},
  {targetHexes:targets.slice(1)},
  {targetHexes:[...targets.slice(0,3),targets[0]]},
  {targetRegionEvidence:{...Policy.firstTurnTerritorialRestriction.targetRegionEvidence,
    interpretation:'historical-complete-border'}},
  {targetRegionEvidence:{coverage:'incomplete',provenance:'draft only'}},
 ]){
  const altered=clone(Policy);altered.firstTurnTerritorialRestriction={...altered.firstTurnTerritorialRestriction,...invalid};
  bad(()=>Declarations.create({map:F.map,profile:Profile,config:Phases,combatPolicy:altered}),
   /Invalid source-defined first-turn territory restriction/,
   'tampered or broadened user interpretation rejected');
 }
 const withoutAxisSetup=clone(Policy);delete withoutAxisSetup.firstTurnCombatRestriction;
 bad(()=>Declarations.create({map:F.map,profile:Profile,config:Phases,combatPolicy:withoutAxisSetup}),
  /Invalid source-defined first-turn territory restriction/,'four-hex adjudication requires matching source setup markers');
 // Real campaign through Axis Combat -> Axis Special Movement -> Soviet Combat,
 // using the actual 165-cell Kiev source-reviewed candidate (test process only).
 const context={map:F.map,profile:Profile,config:Phases,counterConfig:F.counterConfig,
  combatPolicy:Policy,enableAirSupport:true,buildupPolicy:Buildup,
  buildupAllocation:F.allocation,housekeepingPolicy:Housekeeping,
  cursor:cursor(1,'german'),actor:'german',state:opening.state};
 let session=Campaign.create(context),actions=0;
 const step=x=>{const out=session.execute(x);session=out.session;actions++;return out};
 eq(session.snapshot().phaseId,'german-combat');
 step({type:'combat',action:{type:'commit-battles',battles:[]}});
 step({type:'combat',action:{type:'finish-combat'}});
 eq(session.snapshot().phaseId,'german-special-movement');
 const g0910=pick('0910','german'),path=['0910','0909'];
 eq(Rules.move({board,profile:Profile,turn:1,phase:{kind:'special-movement',owner:'german'},units,
  },{unitId:g0910.id,path}).ok,true,'Axis original Romanian unit can leave four-hex area');
 step({type:'declare-ground-move',request:{unitId:g0910.id,path}});
 step({type:'resolve-ground-move'});
 eq(session.snapshot().state.units[g0910.id].hex,'0909');
 eq(session.snapshot().state.units[g0910.id].openingHex,'0910');
 yes(!targets.includes(session.snapshot().state.units[g0910.id].hex),
  'movement can reach non-Romanian target but cannot expand the fixed territory set');
 step({type:'finish-phase'});eq(session.snapshot().phaseId,'soviet-buildup');
 step({type:'finish-buildup'});eq(session.snapshot().phaseId,'soviet-special-movement');
 step({type:'finish-phase'});eq(session.snapshot().phaseId,'soviet-combat');
 // Real campaign declaration (not only the isolated lower-level helper).
 const legal={defenderHex:'0709',attackers:[s0708.id]};
 step({type:'combat',action:{type:'commit-battles',battles:[legal]}});
 eq(session.snapshot().combat.declaration.battles.length,1);
 eq(session.snapshot().combat.declaration.battles[0].defenderHex,'0709');
 eq(Campaign.restore(clone(session.save()),context).snapshot(),session.snapshot(),
  'strict Turn-1 Romanian attack and genuine Axis movement replay from saved campaign');
 audit={checkpoint:246,version:'v480',status:'PASS',assertions:checks,
  authorization:'user-adjudicated-Turn-1-four-hex-combat-rule-only',
  sourceRulesSha256:sourceHash,
  startingRomanianSetupHexes:targets,eligibleSovietOriginalHexes:eligible,
  verifiedAgainstActualCandidate:{hexes:165,edges:442,campaignActions:actions,
   axisRomanianUnitMovedFrom:'0910',axisRomanianUnitMovedTo:'0909',
   endToEndSovietFirstTurnAttack:legal},
  scope:{historicalCountryBoundaryCertified:false,
   scenarioScopedFirstTurnTargetConvention:true,
   noSourceTerritoryDraftPromoted:true,
   gameplayMovementGraphCertified:false,productionKievPlayable:false,
   noSourceMapChange:true,noCommonCRTChange:true},
  provenance:beforeSource};
}finally{
 Policies.maps[F.map.id]=original;
 eq(Policies.maps[F.map.id],original,'in-memory graph test authorization restored');
 bad(()=>Graph.build({...F.map,sourceImageSHA256:'untrusted-v485-test'}),/source-geometry-not-gameplay-certified/,
  'original Kiev production movement graph remains blocked');
 for(const [name,path] of Object.entries({graph:'maps/movement-configs/graph-sources.json',
  map:'maps/kiev.json',combat:'maps/combat-configs/kiev.json',rule:'references/rules/kiev-rules.pdf'}))
  eq(sha(path),beforeSource[name],'no test mutated '+name);
}
audit.assertions=checks;
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/kiev-turn-one-romania-convention-v480.json',JSON.stringify(audit,null,2)+'\n');
console.log('PASS user-adjudicated Kiev §10.8 four-hex convention:',checks,
 'assertions; production Kiev movement graph still gated');
