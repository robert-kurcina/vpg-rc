'use strict';
/* Checkpoint 156 — multi-battle source-configured opening, casualty + replacement,
 * Fleet air strikes, reinforcements, 8-turn replay. Candidate setup, not historical
 * allocation certification or a general player-agent policy. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Campaign=require('../core/historical_campaign_session');
const Bridge=require('../core/scenario_opening_bridge');
const Inventory=require('../core/leningrad_starting_inventory');
const Fixture=require('./fixtures/leningrad-source-setup-v357');
const map=require('../maps/leningrad.json');
const counterConfig=require('../maps/counter-configs/leningrad.json');
const setup=require('../maps/setup/leningrad.json');
const profile=require('../maps/movement-configs/leningrad.json');
const config=require('../maps/phase-configs/leningrad.json');
const combatPolicy=require('../maps/combat-configs/leningrad.json');
const buildupPolicy=require('../maps/buildup-configs/leningrad.json');
const housekeepingPolicy=require('../maps/housekeeping-configs/leningrad.json');
const Ports=require('../core/historical_port_support');
const clone=x=>JSON.parse(JSON.stringify(x));
let assertions=0; const eq=(a,b,m)=>{assert.deepEqual(a,b,m);assertions++};
const ok=(v,m)=>{assert.ok(v,m);assertions++};
const fail=(fn,re)=>{assert.throws(fn,re);assertions++};
const opening=Bridge.create({map,setupSpec:setup,counterConfig,inventory:Inventory,
 allocation:Fixture.selected,placements:Fixture.placements,phaseConfig:config,
 movementProfile:profile,phaseFactories:{combat:()=>({})},supportPolicy:combatPolicy}).snapshot();
const context={...clone(opening),map,profile,config,counterConfig,combatPolicy,
 enableAirSupport:true,buildupPolicy,buildupAllocation:Fixture.selected,housekeepingPolicy};
const initial=Object.values(opening.state.units);
const german=initial.find(u=>u.owner==='german'&&u.hex==='0310'&&u.printedCombatStrength===8);
const panzer=initial.find(u=>u.owner==='german'&&u.hex==='0511'&&u.printedCombatStrength===10);
const soviet=initial.find(u=>u.owner==='soviet'&&u.hex==='0309'&&u.printedCombatStrength===3);
const sovietArmy=initial.find(u=>u.owner==='soviet'&&u.hex==='0611'&&u.printedCombatStrength===8);
ok(german&&panzer&&soviet&&sovietArmy,'Use real opening setup and its adjacent enemies');
const battles=[{defenderHex:'0309',attackers:[german.id]},
 {defenderHex:'0611',attackers:[panzer.id]}];
let session=Campaign.create(context),total=0,history=[],combats=[],turns=0;
const action=a=>{const result=session.execute(a);session=result.session;total++;
 history.push({type:a.type,phase:session.snapshot().phaseId,event:result.event});return result;};
const combat=a=>action({type:'combat',action:a});
const checkedRestore=(label)=>{
 const saved=session.save(),again=Campaign.restore(clone(saved),context);
 eq(again.snapshot(),session.snapshot(),'Full campaign restored '+label);
 eq(again.save(),saved,'Stable campaign journal '+label);
 return saved;
};
const stepBefore=session.snapshot();
// Two simultaneous declarations are resolved in a non-declaration order.
combat({type:'finish-air-sea'});
combat({type:'commit-battles',battles});
combat({type:'select-battle',defenderHex:'0611'});
combat({type:'commit-ground-air',faceId:null});
checkedRestore('pre-combat die B');
const second=combat({type:'resolve-battle',die:4,choices:{}}).event;
eq(second.outcome,'NE');eq(second.losses,[]);combats.push(second);
combat({type:'select-battle',defenderHex:'0309'});
combat({type:'commit-ground-air',faceId:null});
checkedRestore('pre-combat die A');
fail(()=>session.execute({type:'combat',action:{type:'resolve-battle',die:3,choices:{}}}),/attacker step-loss sequence/);
const beforeLoss=session.snapshot();
const exchange=combat({type:'resolve-battle',die:3,choices:{attackerLossIds:[german.id],advanceUnitId:german.id}}).event;
eq(exchange.outcome,'EX');eq(exchange.advanced,german.id);
eq(exchange.losses.length,2);eq(exchange.losses[0].removed,true);eq(exchange.losses[1].removed,false);
const aftermath=session.snapshot();
ok(!aftermath.state.units[soviet.id],'The Soviet defender was eliminated');
eq(aftermath.state.units[german.id].strengthStatus,'printed-reduced');
eq(aftermath.state.units[german.id].hex,'0309');
eq(session.undo().session.snapshot(),beforeLoss,'Undo all combat consequences before die');
checkedRestore('after EX resolution');combats.push(exchange);
combat({type:'finish-combat'});
eq(session.snapshot().phaseId,'german-special-movement');
eq(session.snapshot().state.units[german.id].hex,'0309');
checkedRestore('first combat to movement boundary');
const fkI=combatPolicy.airSupport.markers.find(m=>m.firstTurn===1).faceId;
const fkVIII=combatPolicy.airSupport.markers.find(m=>m.firstTurn===6).faceId;
let fleetMoved=false,militiaAdded=false,axisReinforced=false,sovietReinforced=false;
let restoredReduced=false,failedRestoration=null;
const portHexes=Ports.create({map,policy:combatPolicy,counterConfig}).portHexes;
function reinforcements(s){
 const slot=buildupPolicy.reinforcements.find(x=>x.kind==='ground'&&x.turn===s.cursor.turn&&x.owner===s.actor&&x.placement==='edge');
 if(!slot)return false;
 for(const hex of buildupPolicy.entryEdge[s.actor]){
  const request={type:'place-reinforcement',slotId:slot.slotId,hex};
  try {session.execute(request);action(request);return true;}catch(_){}
 }
 return false;
}
for(let cycle=0;cycle<110;cycle++){
 const s=session.snapshot();if(s.cursor.complete)break;
 if(s.phaseKind==='combat'){
  if(s.actor==='german'){
   if([2,3].includes(s.cursor.turn)){
    combat({type:'declare-fleet-attack',faceId:fkI});
    checkedRestore('pending naval die '+s.cursor.turn);
    const strike=combat({type:'roll-fleet-attack',die:1}).event;
    eq(strike.die,1);ok(strike.hit,'Naval attack hits');
   }
   if(s.cursor.turn===6){
    eq(s.state.airUse?.['6']?.[fkVIII],undefined);
   }
   combat({type:'finish-air-sea'});
  }
  combat({type:'commit-battles',battles:[]});
  combat({type:'finish-combat'});
 }else if(s.phaseKind==='buildup'){
  if(s.cursor.turn===3&&s.actor==='soviet'){
   const slot=buildupPolicy.reinforcements.find(x=>x.turn===3&&x.owner==='soviet');
   action({type:'place-reinforcement',slotId:slot.slotId,hex:portHexes.Leningrad});militiaAdded=true;
  }
  if(s.cursor.turn===4){
   if(s.actor==='german'){
    try{action({type:'apply-replacement',unitId:german.id,hex:null});restoredReduced=true;}
    catch(e){failedRestoration=e.message;}
   }
   const placed=reinforcements(s);
   if(s.actor==='german')axisReinforced=placed;else sovietReinforced=placed;
  }
  action({type:'finish-buildup'});
 }else if(s.phaseKind==='movement'||s.phaseKind==='special-movement'){
  if(s.phaseId==='soviet-special-movement'&&s.cursor.turn===1){
   action({type:'declare-fleet-move',to:portHexes.Riga});
   checkedRestore('pending Fleet movement die');
   action({type:'roll-fleet-move',die:6});fleetMoved=true;
  }
  action({type:'finish-phase'});
 }else if(s.phaseKind==='housekeeping'){
  action({type:'finish-housekeeping'});turns++;
  checkedRestore('end of turn '+turns);
 }else throw Error('Unsupported phase: '+s.phaseId);
}
eq(turns,8);eq(session.snapshot().cursor.complete,true);
ok(fleetMoved&&militiaAdded&&axisReinforced&&sovietReinforced,'Integrated special movement and buildup');
ok(!session.snapshot().state.supportMarkers.balticFleet,'Second Fleet strike eliminates marker');
eq(session.snapshot().state.airUse['2'][fkI],'fleet');
eq(session.snapshot().state.airUse['3'][fkI],'fleet');
ok(!session.snapshot().state.units[soviet.id],'Destroyed Soviet defender stays eliminated absent replacement');
// The German exchange casualty may or may not have qualified for restoration
// depending on on-map enemy ZOC and actual communication; do not circumvent rules.
const end=session.snapshot();
if(restoredReduced){eq(end.state.units[german.id].strengthStatus,'printed-full');}
else {ok(failedRestoration,'Failed replacement must explain denial');
 eq(end.state.units[german.id].strengthStatus,'printed-reduced');}
eq(end.terminal.outcome,'soviet-victory');
const last=session.save();eq(Campaign.restore(last,context).snapshot(),end);
const undo=session.undo();ok(undo.ok);eq(undo.session.snapshot().cursor.complete,false);
eq(undo.session.execute({type:'finish-housekeeping'}).session.snapshot(),end);
const audit={checkpoint:156,version:'v390',assertions,totalActions:total,completedTurns:turns,
 battleResults:combats.map(x=>({defenderHex:x.battle.defenderHex,outcome:x.outcome,losses:x.losses,advance:x.advanced})),
 restoredReduced,failedRestoration,reinforcements:{militiaAdded,axisReinforced,sovietReinforced},
 fleet:{moved:fleetMoved,eliminated:!end.state.supportMarkers.balticFleet},
 finalOutcome:end.terminal.outcome,scope:'candidate opening with real multi-battle losses, replacement attempt, Fleet damage, buildup, full eight-turn journal',
 excluded:['Independent historical unit allocation certification','General player/AI legal action selection','Production GUI','full historical strategic play']};
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/leningrad-mixed-combat-eight-turn-v390.json',JSON.stringify(audit,null,2)+'\n');
console.log('PASS v390 '+assertions+' real mixed-combat, reinforcement and eight-turn persistence assertions; '+total+' actions; replacement='+restoredReduced+(failedRestoration?' ('+failedRestoration+')':''));
