'use strict';
/* Source-grounded four-Soviet-attacker/two-German-defender EX coverage.
 * Valid photographed counter faces and fully certified Arduous hexsides;
 * deliberately constructed positions are NOT an original 1941 setup.
 * Completeness is NOT asserted beyond the fixed 4096-attempt budget.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const Deployment=require('../core/historical_deployment_session');
const Inventory=require('../core/historical_source_face_inventory');
const Campaign=require('../core/historical_campaign_session');
const Catalog=require('../core/historical_campaign_action_catalog');
const Consequences=require('../core/historical_combat_consequences');
const Geography=require('../core/historical_combat_geography');
const Retreat=require('../core/historical_forced_retreat');
const Binding=require('../core/movement_binding');
const fixture=require('./fixtures/arduous-source-setup-v419');
const map=require('../maps/arduous.json'),setupSpec=require('../maps/setup/arduous.json');
const counterConfig=require('../maps/counter-configs/arduous.json');
const config=require('../maps/phase-configs/arduous.json');
const profile=require('../maps/movement-configs/arduous.json');
const fixedPolicy=require('../maps/setup/arduous-fixed-pieces.json');
const combatPolicy=require('../maps/combat-configs/arduous.json');
const buildupPolicy=require('../maps/buildup-configs/arduous.json');
const housekeepingPolicy=require('../maps/housekeeping-configs/arduous.json');
const clone=x=>JSON.parse(JSON.stringify(x));
let assertions=0;
const ok=(v,m)=>{assert.ok(v,m);assertions++};
const equal=(a,b,m)=>{assert.deepStrictEqual(a,b,m);assertions++};
const gIds=['arduous-front-r02c07','arduous-front-r02c08'];
const sIds=['arduous-front-r03c06','arduous-front-r04c02','arduous-front-r05c01','arduous-front-r05c02'];
const attackerHexes=['0206','0305','0406','0307'],defenderHex='0306',die=2;
const dep=Deployment.create({map,setupSpec,counterConfig,
 inventory:Inventory.create(require('../maps/setup/arduous-inventory.json')),
 phaseConfig:config,movementProfile:profile,fixedPolicy,
 allocation:fixture.allocation,placements:fixture.placements}).commit({requireMixed:false});
const binding=Binding.build(map,profile).board;
for(const hex of attackerHexes){
 ok(binding.edges.some(e=>e.verified&&!e.impassable&&!e.lake&&!e.allSea&&
  ((e.a===hex&&e.b===defenderHex)||(e.b===hex&&e.a===defenderHex))),
  'Verified Arduous attacker hexside '+hex+' to '+defenderHex);
}
const sourceState=dep.opening.state;
const selected=[...gIds,...sIds];
for(const id of selected)ok(!!sourceState.units[id]&&sourceState.units[id].sourceFaceId,
 'Photographed face available: '+id);
const units=Object.fromEntries(selected.map(id=>[id,clone(sourceState.units[id])]));
for(const id of gIds)units[id].hex=defenderHex;
for(let i=0;i<sIds.length;i++)units[sIds[i]].hex=attackerHexes[i];
const context={...dep.opening,map,profile,config,counterConfig,combatPolicy,
 enableAirSupport:true,buildupPolicy,buildupAllocation:dep.allocation,
 housekeepingPolicy,fixedPolicy,state:{...clone(sourceState),units}};
let session=Campaign.create(context);
const go=action=>{session=session.execute(action).session};
for(let step=0;session.snapshot().phaseId!=='soviet-combat'&&step<20;step++){
 const s=session.snapshot();
 if(s.phaseKind==='combat'){
  if(s.combat.status==='air-sea-open')go({type:'combat',action:{type:'finish-air-sea'}});
  else if(s.combat.status==='awaiting-declarations')go({type:'combat',action:{type:'commit-battles',battles:[]}});
  else if(['no-battles-declared','battles-resolved'].includes(s.combat.status))go({type:'combat',action:{type:'finish-combat'}});
  else throw Error('Unhandled combat status '+s.combat.status);
 }else if(s.phaseKind==='buildup')go({type:'finish-buildup'});
 else if(s.phaseKind==='housekeeping')go({type:'finish-housekeeping'});
 else go({type:'finish-phase'});
}
equal(session.snapshot().phaseId,'soviet-combat','Reach genuine Soviet Combat phase through normal progression');
if(session.snapshot().combat.status==='air-sea-open')go({type:'combat',action:{type:'finish-air-sea'}});
go({type:'combat',action:{type:'commit-battles',battles:[{defenderHex,attackers:sIds}]}});
go({type:'combat',action:{type:'select-battle',defenderHex}});
const s=session.snapshot(),save=session.save();
const b=s.combat.declaration.battles[0];
const evaluator=Consequences.create({map,profile,counterConfig,combatPolicy,
 geography:Geography.create(map,profile,{cityMarkerMode:combatPolicy.cityMarkerMode}),
 phaseConfig:config,enableAirSupport:true});
const independentLoss={attackerLossIds:sIds,defenderLossId:gIds[1]};
const after=evaluator.previewPostCasualty({state:s.state,battle:b,actor:s.actor,
 die,cursor:s.cursor,airSupportId:null,choices:independentLoss});
equal(after.outcome,'EX','Die 2 produces authentic shared CRT EX');
const rr=Retreat.create({map,profile,combatPolicy,counterConfig}).enumerate({
 state:after.state,defenderHex,defenderIds:after.survivingDefenderIds});
ok(rr.exhaustive&&rr.status==='certified-forced-retreat-options'&&rr.combinations.length>0,
 'Independent casualty and retreat oracle certifies legal late branch');
const choices={...independentLoss,retreatPaths:Object.fromEntries(Object.entries(rr.combinations[0])
 .filter(([,v])=>v).map(([id,v])=>[id,v.route]))};
const action={type:'combat',action:{type:'resolve-battle',die,choices}};
const played=session.execute(action);
equal(played.event.outcome,'EX','Late casualty selection is truly executable by authoritative engine');
equal(played.session.undo().session.snapshot(),s,'Independent late selection undoes to original snapshot');
equal(Campaign.restore(played.session.save(),context).snapshot(),played.session.snapshot(),
 'Independent late selection saves/restores correctly');
const pager=Catalog.createPostRollPager({session,context,die});
let targetVisible=false,pageCount=0,choiceCount=0,keys=new Set(),families=new Set();
const full=process.argv.includes('--full');
for(let page=0;page<(full?32:4);page++){
 const result=pager.page(page);
 equal(result.crtOutcome,'EX','Same EX result for page '+page);
 for(const opt of result.options){
  const c=opt.action.action.choices,k=JSON.stringify(c);
  ok(!keys.has(k),'No duplicated source-valid choices on page '+page);keys.add(k);
  families.add(JSON.stringify([c.attackerLossIds||[],c.defenderLossId||null]));
  if(k===JSON.stringify(choices))targetVisible=true;
 }
 pageCount++;choiceCount+=result.options.length;
 if(!result.hasNextPage)break;
}
ok(targetVisible,'Previously starved four-attacker loss / second-defender choice now discoverable');
ok(families.size>=12,'Large EX budget exposes diverse source-valid casualty branches');
equal(session.snapshot(),s,'Read-only paging preserves the committed battle');
equal(session.save(),save,'Read-only paging never changes save/journal/die');
if(full){
 const stats=pager.stats();
 ok(stats.budgetReached,'Large EX stress fixture reaches the fixed 4096-trial safety limit');
 equal(stats.attempted,4096,'No enlargement or bypass of safe validation budget');
}
const audit={checkpoint:233,version:'v467',source:'references/rules/arduous-rules.pdf',
 sourceSHA256:crypto.createHash('sha256').update(fs.readFileSync('references/rules/arduous-rules.pdf')).digest('hex'),
 clauses:['§8.1 two-unit defensive stacking','§10.2 one attacker per hexside',
 '§10.6 exchange casualty payment and forced retreat'],
 scenario:'arduous',constructedPlacement:true,defenderHex,attackerHexes,
 attackerFaceIds:sIds,defenderFaceIds:gIds,die,crtOutcome:'EX',
 independentLateChoice:choices,lateChoiceFound:targetVisible,pageCount,choiceCount,
 casualtyFamiliesSeen:families.size,attempts:pager.stats().attempted,
 budgetReached:pager.stats().budgetReached,assertions,full,
 limitation:'Not an exhaustive legal-consequence oracle; 4096-trial budget unchanged'};
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/arduous-large-ex-fairness-v467.json',JSON.stringify(audit,null,2)+'\n');
console.log('PASS v467:',assertions,'large-EX branch coverage assertions;',
 pageCount,'pages,',families.size,'distinct attacker/defender casualty branches, target found');
