'use strict';
/* Arduous §8.1 / §10.2 / §10.6, source-bound differential check.
 * Genuine photographed source counters and certified edge geometry are used;
 * four-counter engagements and reduced-strength placements are deliberately
 * synthetic test cases, NOT historical turn-one or unit-identity assertions.
 * Compare the UI post-roll catalogue with a separately constructed set of
 * source-solver paths and independently adjudicated campaign transactions.
 */
const A=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const Deployment=require('../core/historical_deployment_session');
const Inventory=require('../core/historical_source_face_inventory');
const Campaign=require('../core/historical_campaign_session');
const Catalog=require('../core/historical_campaign_action_catalog');
const Consequences=require('../core/historical_combat_consequences');
const Geography=require('../core/historical_combat_geography');
const Retreat=require('../core/historical_forced_retreat');
const Binding=require('../core/movement_binding');
const fixture=require('./fixtures/arduous-source-setup-v419');
const map=require('../maps/arduous.json');
const setupSpec=require('../maps/setup/arduous.json');
const counterConfig=require('../maps/counter-configs/arduous.json');
const config=require('../maps/phase-configs/arduous.json');
const profile=require('../maps/movement-configs/arduous.json');
const fixedPolicy=require('../maps/setup/arduous-fixed-pieces.json');
const combatPolicy=require('../maps/combat-configs/arduous.json');
const buildupPolicy=require('../maps/buildup-configs/arduous.json');
const housekeepingPolicy=require('../maps/housekeeping-configs/arduous.json');
const clone=x=>JSON.parse(JSON.stringify(x));
let assertions=0;
const check=(cond,why)=>{A.ok(cond,why);assertions++};
const equal=(actual,expected,why)=>{A.deepStrictEqual(actual,expected,why);assertions++};
const fail=(fn,re,why)=>{A.throws(fn,re,why);assertions++};
const deployment=Deployment.create({map,setupSpec,counterConfig,
 inventory:Inventory.create(require('../maps/setup/arduous-inventory.json')),
 phaseConfig:config,movementProfile:profile,fixedPolicy,
 allocation:fixture.allocation,placements:fixture.placements}).commit({requireMixed:false});
const candidates=Object.values(deployment.opening.state.units);
const attackers=candidates.filter(u=>u.owner==='german'&&u.printedCombatStrength===12).slice(0,2);
const army=candidates.find(u=>u.owner==='soviet'&&u.size==='army'&&u.printedCombatStrength===8);
const mech=candidates.find(u=>u.owner==='soviet'&&u.class==='mechanized');
check(attackers.length===2&&army&&mech,'Photographed German Corps, Soviet Army and Mechanized Corps available');
check(army.size==='army'&&mech.size==='corps','§8.1 legal Army + Corps defense');
const bound=Binding.build(map,profile).board;
function adjacent(a,b){return bound.edges.some(e=>e.verified&&!e.lake&&!e.impassable&&!e.allSea&&
 ((e.a===a&&e.b===b)||(e.a===b&&e.b===a)));}
function prepare({defenderHex,attackerHexes,reducedArmy=false}){
 const selected=[...attackers,army,mech];
 const units=Object.fromEntries(selected.map(u=>[u.id,{...clone(u)}]));
 for(let i=0;i<attackers.length;i++)units[attackers[i].id].hex=attackerHexes[i];
 units[army.id].hex=defenderHex;units[mech.id].hex=defenderHex;
 if(reducedArmy){
  const reverse=counterConfig.faces.back.find(f=>f.faceId===army.reverseFaceId);
  check(reverse?.pairedFaceId===army.sourceFaceId,'Reduced Army has verified photographed reverse');
  equal(reverse.visualTranscription.printedValues,'4-4','Reduced Army strength is source-authentic');
  units[army.id].strengthStatus='printed-reduced';units[army.id].printedCombatStrength=4;
  units[army.id].activeFaceId=army.reverseFaceId;
 }
 check(Object.values(units).filter(u=>u.hex===defenderHex).length===2,'Exactly two stacked Soviet defenders');
 check(attackerHexes.every(hex=>adjacent(hex,defenderHex)),'Both attacking hexsides are source-verified');
 check(attackerHexes[0]!==attackerHexes[1],'§10.2 distinct attack hexsides');
 const context={...deployment.opening,map,profile,config,counterConfig,combatPolicy,
  enableAirSupport:true,buildupPolicy,buildupAllocation:deployment.allocation,
  housekeepingPolicy,fixedPolicy,state:{...clone(deployment.opening.state),units}};
 const battle={defenderHex,attackers:attackers.map(u=>u.id)};
 let session=Campaign.create(context);
 equal(session.snapshot().combat.status,'awaiting-declarations','Arduous opening ground combat source phase');
 session=session.execute({type:'combat',action:{type:'commit-battles',battles:[battle]}}).session;
 session=session.execute({type:'combat',action:{type:'select-battle',defenderHex}}).session;
 session=session.execute({type:'combat',action:{type:'commit-ground-air',faceId:null}}).session;
 return {context,session,battle};
}
const evaluator=Consequences.create({map,profile,counterConfig,combatPolicy,
 geography:Geography.create(map,profile,{cityMarkerMode:combatPolicy.cityMarkerMode}),
 phaseConfig:config,enableAirSupport:true});
const retreat=Retreat.create({map,profile,combatPolicy,counterConfig});
const exactKey=x=>JSON.stringify(x);
function* subsets(ids){for(let i=1;i<(1<<ids.length);i++)yield ids.filter((_,j)=>i&(1<<j));}
function verify({defenderHex,attackerHexes,reducedArmy=false,die,expectedOutcome}){
 const f=prepare({defenderHex,attackerHexes,reducedArmy});
 const snapshot=f.session.snapshot(),saved=f.session.save();
 const catalogue=Catalog.discoverPostRoll({session:f.session,context:f.context,die});
 equal(catalogue.crtOutcome,expectedOutcome,'Source CRT outcome at committed die');
 check(catalogue.hasNextPage===false&&catalogue.exhaustive===false,
  'Small catalogue is one page without falsely claiming global completeness');
 const officialKeys=new Set(catalogue.options.map(p=>exactKey(p.action.action.choices)));
 equal(officialKeys.size,catalogue.options.length,'No duplicate source catalogue proposals');
 const independent=new Map(),failed=[];
 function tryChoice(choices){
  const action={type:'combat',action:{type:'resolve-battle',die,choices}};
  try{
   const outcome=f.session.execute(action);
   independent.set(exactKey(choices),{action,event:outcome.event});
  }catch(e){failed.push(e.message);}
 }
 const ids=f.battle.attackers,defenders=snapshot.combat.declaration.battles[0].defenders;
 function enumerateCasualty(loss){
  let stage;
  try{stage=evaluator.previewPostCasualty({state:snapshot.state,battle:snapshot.combat.declaration.battles[0],
   actor:snapshot.actor,die,cursor:snapshot.cursor,airSupportId:null,choices:loss});}
  catch(e){return;}
  tryChoice(loss);
  for(const attacker of ids)tryChoice({...loss,advanceUnitId:attacker});
  if(!stage.survivingDefenderIds.length)return;
  const routes=retreat.enumerate({state:stage.state,defenderHex,defenderIds:stage.survivingDefenderIds});
  equal(routes.status,'certified-forced-retreat-options','Fully certified joint/single retreat after losses');
  check(routes.exhaustive===true,'Independent retreat scan complete for small synthetic fixture');
  for(const c of routes.combinations){
   const retreatPaths=Object.fromEntries(Object.entries(c).filter(([,opt])=>opt)
    .map(([id,opt])=>[id,opt.route]));
   tryChoice({...loss,retreatPaths});
   for(const attacker of ids)tryChoice({...loss,retreatPaths,advanceUnitId:attacker});
  }
 }
 if(expectedOutcome==='EX')for(const attackerLossIds of subsets(ids))
  for(const defenderLossId of defenders)enumerateCasualty({attackerLossIds,defenderLossId});
 else if(expectedOutcome==='DRL')for(const defenderLossId of defenders)enumerateCasualty({defenderLossId});
 else throw Error('Unsupported differential fixture outcome');
 const independentKeys=[...independent.keys()].sort();
 equal([...officialKeys].sort(),independentKeys,
  `Catalogue agrees with independently generated ${expectedOutcome} casualty/retreat/advance alternatives`);
 check(independent.size>=10,'Meaningful nontrivial stacked-defender alternatives');
 for(const d of defenders){
  const matching=catalogue.options.filter(p=>p.action.action.choices.defenderLossId===d);
  check(matching.length>0,'Each legally chosen Soviet defender loss is discoverable: '+d);
  for(const pick of matching.slice(0,2)){
   const played=f.session.execute(pick.action);
   equal(played.event.outcome,expectedOutcome,'Same outcome through campaign transaction');
   equal(played.event.losses,pick.losses,'Catalogue loss metadata matches transaction');
   equal(played.event.retreats,pick.retreats,'Catalogue retreat metadata matches transaction');
   equal(played.session.undo().session.snapshot(),snapshot,'Undo exact initial committed battle');
   equal(Campaign.restore(played.session.save(),f.context).snapshot(),played.session.snapshot(),
    'Resolved choice save/restore exact');
  }
 }
 equal(f.session.snapshot(),snapshot,'Read-only discovery never mutates original session state');
 equal(f.session.save(),saved,'Read-only discovery never changes game journal');
 return {count:catalogue.options.length,attempted:catalogue.attempted,
  rejectedCandidates:failed.length,afterLossRetreatScans:catalogue.afterLossRetreatScans};
}
const ex=verify({defenderHex:'0309',attackerHexes:['0209','0409'],die:2,
 expectedOutcome:'EX'});
const drl=verify({defenderHex:'0505',attackerHexes:['0405','0605'],reducedArmy:true,
 die:6,expectedOutcome:'DRL'});
equal(ex.count,54,'Forested stacked EX has 54 legal consequence choices');
equal(drl.count,18,'Open stacked DRL has 18 legal consequence choices');
// §10.2 permits both counters to defend together, but only ONE attacking
// counter from the same origin hex may cross the common hexside.
const sameOrigin=prepare({defenderHex:'0505',attackerHexes:['0405','0605']});
const illegal=clone(sameOrigin.context);
illegal.state.units[attackers[1].id].hex='0405';
const blocked=Campaign.create(illegal);
fail(()=>blocked.execute({type:'combat',action:{type:'commit-battles',battles:[{
 defenderHex:'0505',attackers:attackers.map(u=>u.id)}]}}),
 /hexside|origin|same|one unit/i,'Cannot attack with two stacked German Corps through same hexside');
const source='references/rules/arduous-rules.pdf';
const audit={checkpoint:232,version:'v466',testAssertions:assertions,
 source,sourceSHA256:crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),
 clauses:['§8.1 two friendly counters; at most one Soviet Army','§10.2 one attacker per attacking hexside',
 '§10.6 mandatory defender loss and two-hex outward retreats','§10.6 EX attacker step-loss equivalence'],
 tests:{ex,drl},scope:'source-grounded photographed counters and certified graph; synthetic combat positions',
 unchanged:'No scenario CRT, map, counter, geography, or gameplay policy changes',
 limitations:['Not a claim of exhaustive post-roll catalog for larger combats or 4096 validation safety limit',
  'Synthetic German first-combat state, including pre-reduced Soviet Army, is not a historical deployment',
  'Does not certify all possible legal stacking configurations or long joint-retreat orders']};
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/arduous-stacked-postroll-v466.json',JSON.stringify(audit,null,2)+'\n');
console.log('PASS v466:',assertions,'source-bound stacked combat/postroll assertions; EX',ex.count,'DRL',drl.count);
