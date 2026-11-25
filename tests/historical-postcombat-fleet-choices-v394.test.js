'use strict';
/* Checkpoint 160: precommit Fleet displacement after a genuine CRT result.
 * Uses source-identified photographed counter faces and the certified port map;
 * positions are intentionally synthetic, not a claimed historical opening. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const Port=require('../core/historical_port_support');
const Bridge=require('../core/scenario_opening_bridge');
const Campaign=require('../core/historical_campaign_session');
const Catalog=require('../core/historical_campaign_action_catalog');
const Inventory=require('../core/leningrad_starting_inventory');
const Fixture=require('./fixtures/leningrad-source-setup-v357');
const map=require('../maps/leningrad.json'),counterConfig=require('../maps/counter-configs/leningrad.json');
const setup=require('../maps/setup/leningrad.json'),profile=require('../maps/movement-configs/leningrad.json');
const config=require('../maps/phase-configs/leningrad.json'),combatPolicy=require('../maps/combat-configs/leningrad.json');
const clone=x=>JSON.parse(JSON.stringify(x));let n=0;
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);n++};
const ok=(x,m)=>{assert.ok(x,m);n++};
const bad=(fn,re,m)=>{assert.throws(fn,re,m);n++};
const opening=Bridge.create({map,setupSpec:setup,counterConfig,inventory:Inventory,
 allocation:Fixture.selected,placements:Fixture.placements,phaseConfig:config,
 movementProfile:profile,phaseFactories:{combat:()=>({})},supportPolicy:combatPolicy}).snapshot();
const port=Port.create({map,policy:combatPolicy,counterConfig}),ports=port.portHexes;
const units=Object.values(opening.state.units),german=units.filter(u=>u.owner==='german');
const strengths=[12,10,8,8],used=new Set(),attackers=strengths.map(value=>{
 const u=german.find(x=>x.printedCombatStrength===value&&!used.has(x.id));
 if(u)used.add(u.id);return u;
});
const defender=units.find(u=>u.owner==='soviet'&&u.printedCombatStrength===3);
ok(attackers.every(Boolean)&&defender);
const others=german.filter(u=>!used.has(u.id));
function makeContext({condition='undamaged',filled=false,marker=true}={}){
 const state={scenarioId:'leningrad',units:{}};
 attackers.forEach((u,i)=>state.units[u.id]={...clone(u),hex:['0607','0608','0807','0808'][i]});
 state.units[defender.id]={...clone(defender),hex:ports.Riga};
 if(filled)Object.entries(ports).filter(([name])=>name!=='Riga').forEach(([name,hex],i)=>{
  state.units[others[i].id]={...clone(others[i]),hex};
 });
 if(marker)state.supportMarkers={[port.markerKey]:{hex:ports.Riga,condition,owner:'soviet',
  sourceFaceId:combatPolicy.portSupport.sourceFaceId,reverseFaceId:combatPolicy.portSupport.reverseFaceId}};
 return {...clone(opening),state,map,profile,config,counterConfig,combatPolicy,enableAirSupport:false};
}
function selected(context){
 const battle={defenderHex:ports.Riga,attackers:attackers.map(u=>u.id)};
 return Campaign.create(context)
  .execute({type:'combat',action:{type:'commit-battles',battles:[battle]}}).session
  .execute({type:'combat',action:{type:'select-battle',defenderHex:ports.Riga}}).session;
}
for(const condition of ['undamaged','damaged']){
 const context=makeContext({condition}),session=selected(context),pre=session.snapshot(),save=session.save();
 const choices=Catalog.discoverPostRoll({session,context,die:5});
 eq(choices.crtOutcome,'DE');eq(choices.fleetCommitments.length,20);
 eq([...new Set(choices.fleetCommitments.map(x=>x.to))].sort(),Object.values(ports).filter(x=>x!==ports.Riga).sort());
 eq(choices.options.filter(x=>x.advanced).length,0,'Cannot finish advance without forced Fleet reaction');
 eq(session.snapshot(),pre);eq(session.save(),save,'Read-only enumeration does not consume dice');
 for(const entry of choices.fleetCommitments){
  eq(entry.status,'fleet-die-pending');eq(entry.next,'roll-fleet-displacement');
  ok(attackers.some(u=>u.id===entry.action.action.choices.advanceUnitId));
  ok(!('fleetDisplacement' in entry.action.action.choices));
  const commit=session.execute(entry.action).session,pending=commit.snapshot();
  eq(pending.combat.status,'fleet-die-pending');
  eq(pending.combat.pendingFleetCombat.to,entry.to);
  eq(pending.state,pre.state,'No casualties or movement before Fleet damage die');
  eq(Campaign.restore(clone(commit.save()),context).snapshot(),pending);
  eq(commit.undo().session.snapshot(),pre);
  const menu=Catalog.discover({session:commit,context});
  ok(menu.prompts.some(p=>p.type==='roll-fleet-displacement'&&p.to===entry.to));
  bad(()=>commit.execute({type:'combat',action:{type:'finish-combat'}}),/requires source-verified|completion requires/);
  bad(()=>commit.execute({type:'combat',action:{type:'resolve-battle',die:5,choices:{}}}),/Select a committed battle/);
  for(const die of [1,6]){
   const resolution=commit.execute({type:'combat',action:{type:'roll-fleet-displacement',die}});
   const event=resolution.event.fleetDisplacement;
   eq(event.kind,'forced-fleet-displacement');eq(event.to,entry.to);eq(event.die,die);
   eq(event.from,ports.Riga);eq(event.hit,die<=combatPolicy.portSupport.damageOnDeparture.Riga);
   eq(resolution.session.snapshot().state.units[entry.action.action.choices.advanceUnitId].hex,ports.Riga);
   if(condition==='damaged'&&die===1)eq(resolution.session.snapshot().state.supportMarkers?.[port.markerKey],undefined);
   else eq(resolution.session.snapshot().state.supportMarkers[port.markerKey].hex,entry.to);
   eq(Campaign.restore(clone(resolution.session.save()),context).snapshot(),resolution.session.snapshot());
   eq(resolution.session.undo().session.snapshot(),pending);
  }
  bad(()=>commit.execute({type:'combat',action:{type:'roll-fleet-displacement',die:7}}),/d6/);
 }
 const candidate=choices.fleetCommitments[0];
 bad(()=>session.execute({type:'combat',action:{type:'commit-fleet-displacement',die:5,
  choices:{advanceUnitId:attackers[0].id},to:ports.Riga}}),/different available port/);
 bad(()=>session.execute({type:'combat',action:{type:'commit-fleet-displacement',die:5,
  choices:{advanceUnitId:attackers[0].id,fleetDisplacement:{to:candidate.to,die:1}},to:candidate.to}}),/may not contain a damage die/);
 bad(()=>session.execute({type:'combat',action:{type:'roll-fleet-displacement',die:1}}),/Commit Fleet destination/);
}
// Every other source port occupied: no Fleet destination and no damage die;
// the old automatic elimination consequence is the ONLY valid advance outcome.
const blockedContext=makeContext({filled:true}),blockedSession=selected(blockedContext);
const blocked=Catalog.discoverPostRoll({session:blockedSession,context:blockedContext,die:5});
eq(blocked.fleetCommitments.length,0);
const terminal=blocked.options.find(x=>x.advanced===attackers[0].id);
ok(terminal);
eq(blockedSession.execute(terminal.action).event.fleetDisplacement.reason,'no-available-port');
// Without any Fleet, a legal German advance remains directly executable.
const emptyContext=makeContext({marker:false}),emptySession=selected(emptyContext);
const empty=Catalog.discoverPostRoll({session:emptySession,context:emptyContext,die:5});
eq(empty.fleetCommitments.length,0);
ok(empty.options.some(x=>x.advanced===attackers[0].id));
const audit={checkpoint:160,version:'v394',assertions:n,source:'Leningrad §§13.1–13.2, certified map and photographed counter faces',
 destinations:5,advanceChoices:4,sourcePort:'Riga',testedFleetConditions:['undamaged','damaged'],testedDamageDice:[1,6],
 verified:['CRT outcome and advance before Fleet destination selection','Destination committed and journaled before Fleet d6',
 'No provisional casualties leaked into active state','Undo and replay across both actions',
 'automatic elimination without port or die','normal combat advance without Fleet'],
 limitations:['Legacy single-action combat resolver remains for backward-compatible test harnesses',
 'Human/AI controller still supplies physical dice and choices',
 'Historical unit identities and printed coordinate exceptions remain uncertified']};
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/leningrad-postcombat-fleet-choices-v394.json',JSON.stringify(audit,null,2)+'\n');
console.log('PASS v394',n,'assertions; five port choices, two Fleet conditions, saved pre-roll commitments');
