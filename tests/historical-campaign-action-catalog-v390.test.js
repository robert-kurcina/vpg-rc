'use strict';
/* Transaction-verified, side-effect-free action enumeration for human/AI.
 * The catalog may suggest a single attack but never commits a whole plan or
 * chooses a die/result-dependent casualty on the player's behalf. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const Bridge=require('../core/scenario_opening_bridge');
const Inventory=require('../core/leningrad_starting_inventory');
const Fixture=require('./fixtures/leningrad-source-setup-v357');
const Campaign=require('../core/historical_campaign_session');
const Catalog=require('../core/historical_campaign_action_catalog');
const map=require('../maps/leningrad.json'),counterConfig=require('../maps/counter-configs/leningrad.json');
const setup=require('../maps/setup/leningrad.json'),profile=require('../maps/movement-configs/leningrad.json');
const config=require('../maps/phase-configs/leningrad.json'),combatPolicy=require('../maps/combat-configs/leningrad.json');
const buildupPolicy=require('../maps/buildup-configs/leningrad.json');
const housekeepingPolicy=require('../maps/housekeeping-configs/leningrad.json');
const clone=x=>JSON.parse(JSON.stringify(x));let checks=0;
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++};
const yes=(v,m)=>{assert.ok(v,m);checks++};
const opening=Bridge.create({map,setupSpec:setup,counterConfig,inventory:Inventory,
 allocation:Fixture.selected,placements:Fixture.placements,phaseConfig:config,
 movementProfile:profile,phaseFactories:{combat:()=>({})},supportPolicy:combatPolicy}).snapshot();
const context={...clone(opening),map,profile,config,counterConfig,combatPolicy,
 enableAirSupport:true,buildupPolicy,buildupAllocation:Fixture.selected,housekeepingPolicy};
let session=Campaign.create(context);
function inspect(label){
 const before=clone(session.save()),snap=session.snapshot();
 const catalog=Catalog.discover({session,context});
 eq(session.save(),before,'Catalog must never write source state '+label);
 eq(session.snapshot(),snap,'Catalog must never change campaign snapshot '+label);
 eq(catalog.phaseId,snap.phaseId);
 for(const action of catalog.commands)yes(Boolean(session.execute(action).session),'Advertised action must succeed '+label);
 for(const proposal of catalog.proposals)yes(Boolean(session.execute({type:'combat',action:{type:'commit-battles',battles:[proposal]}}).session),'Single-battle proposal legal '+label);
 return catalog;
}
const first=inspect('opening German air sea');
yes(first.commands.some(a=>a.action?.type==='finish-air-sea'));
let sessionCopy=session;
const act=a=>{session=session.execute(a).session;};
act({type:'combat',action:{type:'finish-air-sea'}});
const declaration=inspect('opening declarations');
yes(declaration.proposals.some(p=>p.defenderHex==='0309'));
yes(declaration.proposals.some(p=>p.defenderHex==='0611'));
const a=declaration.proposals.find(p=>p.defenderHex==='0309');
act({type:'combat',action:{type:'commit-battles',battles:[a]}});
const choices=inspect('battle selection');
yes(choices.commands.some(x=>x.action?.type==='select-battle'));
act({type:'combat',action:{type:'select-battle',defenderHex:'0309'}});
const air=inspect('pre-roll support choices');
yes(air.commands.some(x=>x.action?.type==='commit-ground-air'&&x.action.faceId===null));
act({type:'combat',action:{type:'commit-ground-air',faceId:null}});
const beforeDie=inspect('after support locked');
eq(beforeDie.commands.length,0);
yes(beforeDie.prompts.some(x=>x.type==='resolve-battle'));
// The read-only catalog never provides a preselected die or attacker loss.
const german=session.snapshot().state.units[a.attackers[0]];
act({type:'combat',action:{type:'resolve-battle',die:3,
 choices:{attackerLossIds:[german.id],advanceUnitId:german.id}}});
const resolved=inspect('combat resolved');
yes(resolved.commands.some(x=>x.action?.type==='finish-combat'));
act({type:'combat',action:{type:'finish-combat'}});
const movement=inspect('movement after combat');
yes(movement.commands.some(x=>x.type==='finish-phase'));
const candidate=movement.commands.find(x=>x.type==='declare-ground-move');
yes(candidate,'At least one real adjacent source-legal movement offered');
act(candidate);
const pending=inspect('pending ground movement');
yes(pending.commands.some(x=>x.type==='resolve-ground-move'));
act({type:'resolve-ground-move'});
inspect('completed movement choice');
act({type:'finish-phase'});
const buildup=inspect('soviet first buildup');
yes(buildup.commands.some(x=>x.type==='finish-buildup'));
// Source-verified catalog never offers an out-of-turn reinforcement.
yes(!buildup.commands.some(x=>x.type==='place-reinforcement'&&x.slotId==='t3-soviet-workers-militia-1'));
const stopped=session.save();eq(Campaign.restore(clone(stopped),context).snapshot(),session.snapshot());
// Continue the same journal to test *due* historical reinforcement and
// replacement discovery, not only the opening with no available actions.
let sawMilitia=false,sawGermanReplacement=false,sawGermanReinforcement=false;
for(let i=0;i<38;i++){
 const snap=session.snapshot();
 if(snap.cursor.turn===3&&snap.phaseId==='soviet-buildup'){
  const options=inspect('Turn 3 Soviet reinforcement');
  const militia=options.commands.filter(x=>x.type==='place-reinforcement'&&x.slotId==='t3-soviet-workers-militia-1');
  yes(militia.length===1&&militia[0].hex==='1701','Only source-legal Leningrad placement for the militia');
  sawMilitia=true;
 }
 if(snap.cursor.turn===4&&snap.phaseId==='german-buildup'){
  const options=inspect('Turn 4 German replacement and reinforcement');
  sawGermanReplacement=options.commands.some(x=>x.type==='apply-replacement'&&x.unitId===german.id&&x.hex===null);
  sawGermanReinforcement=options.commands.some(x=>x.type==='place-reinforcement'&&x.slotId.startsWith('t4-german'));
  break;
 }
 if(snap.phaseKind==='buildup')act({type:'finish-buildup'});
 else if(snap.phaseKind==='combat'){
  if(snap.actor==='german')act({type:'combat',action:{type:'finish-air-sea'}});
  act({type:'combat',action:{type:'commit-battles',battles:[]}});
  act({type:'combat',action:{type:'finish-combat'}});
 }else if(snap.phaseKind==='movement'||snap.phaseKind==='special-movement')act({type:'finish-phase'});
 else if(snap.phaseKind==='housekeeping')act({type:'finish-housekeeping'});
 else throw Error('Unanticipated phase '+snap.phaseId);
}
yes(sawMilitia,'Turn 3 source-specific placement found');
yes(sawGermanReplacement,'Turn 4 restores eligible combat-reduced German infantry');
yes(sawGermanReinforcement,'Turn 4 source-valid German reinforcements found');
const audit={checkpoint:156,version:'v390',assertions:checks,
 path:['air-sea commitment','individual source-legal battle proposals','combat consequence','movement proposal','pending movement','buildup'],
 result:'Read-only catalog; every displayed executable action revalidated through same campaign transaction',
 limitations:['One-hex movement candidates only','Individual combat proposals only, not group enumeration',
  'Dice and result-dependent choices remain caller-supplied','Nonhistorical candidate roster']};
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/leningrad-action-catalog-v390.json',JSON.stringify(audit,null,2)+'\n');
console.log('PASS v390 '+checks+' source-validated action discovery assertions');
