'use strict';
/* Source-certified §13.2 Fleet retreat exceptions must be exposed to human
 * controllers for DR, DRL and EX, including mandatory casualty selection.
 * The photographed Leningrad counters and true Riga map cell are reused;
 * their test battle placement is synthetic and is NOT a claimed setup.
 */
const assert=require('node:assert/strict');
const Bridge=require('../core/scenario_opening_bridge');
const Campaign=require('../core/historical_campaign_session');
const Human=require('../core/historical_campaign_human');
const Catalog=require('../core/historical_campaign_action_catalog');
const Port=require('../core/historical_port_support');
const Inventory=require('../core/leningrad_starting_inventory');
const Fixture=require('./fixtures/leningrad-source-setup-v357');
const map=require('../maps/leningrad.json');
const counterConfig=require('../maps/counter-configs/leningrad.json');
const setup=require('../maps/setup/leningrad.json');
const profile=require('../maps/movement-configs/leningrad.json');
const config=require('../maps/phase-configs/leningrad.json');
const combatPolicy=require('../maps/combat-configs/leningrad.json');
const clone=x=>JSON.parse(JSON.stringify(x));
let n=0;const same=(a,b,m)=>{assert.deepStrictEqual(a,b,m);n++};
const ok=(v,m)=>{assert.ok(v,m);n++};
const rejects=(f,re,m)=>{assert.throws(f,re,m);n++};
const opening=Bridge.create({map,setupSpec:setup,counterConfig,inventory:Inventory,
 allocation:Fixture.selected,placements:Fixture.placements,phaseConfig:config,
 movementProfile:profile,phaseFactories:{combat:()=>({})},supportPolicy:combatPolicy}).snapshot();
const sourceUnits=Object.values(opening.state.units);
const army=sourceUnits.find(u=>u.owner==='soviet'&&u.size==='army'&&u.printedCombatStrength===8);
const corps=sourceUnits.filter(u=>u.owner==='soviet'&&u.size==='corps'&&u.printedCombatStrength===3);
const used=new Set(),attackers=[12,10,8,8].map(strength=>{
 const u=sourceUnits.find(x=>x.owner==='german'&&x.printedCombatStrength===strength&&!used.has(x.id));
 if(u)used.add(u.id);return u;
});
ok(army&&corps.length>=2&&attackers.every(Boolean),'Photographed source counters available for Army, Corps and attackers');
const port=Port.create({map,policy:combatPolicy,counterConfig});
const riga=port.portHexes.Riga;
same(riga,'0707','Certified Fleet city: Riga');
function fixture(defenders,{marker=true,condition='undamaged'}={}){
 const state={scenarioId:'leningrad',units:{}};
 attackers.forEach((u,i)=>state.units[u.id]={...clone(u),hex:['0607','0608','0807','0808'][i]});
 defenders.forEach(u=>state.units[u.id]={...clone(u),hex:riga});
 if(marker)state.supportMarkers={[port.markerKey]:{hex:riga,condition,owner:'soviet',
  sourceFaceId:combatPolicy.portSupport.sourceFaceId,reverseFaceId:combatPolicy.portSupport.reverseFaceId}};
 const context={...clone(opening),state,map,profile,config,counterConfig,combatPolicy,enableAirSupport:false};
 const battle={defenderHex:riga,attackers:attackers.map(u=>u.id)};
 const session=Campaign.create(context).execute({type:'combat',action:{type:'commit-battles',battles:[battle]}}).session
  .execute({type:'combat',action:{type:'select-battle',defenderHex:riga}}).session;
 return {context,session};
}
const ignored=page=>page.options.filter(x=>x.action.action.choices.ignoreRetreat===true);
function exercise({defenders,die,outcome,marker=true,condition='undamaged',expect=true}){
 const {context,session}=fixture(defenders,{marker,condition});
 const saved=session.save(),before=session.snapshot();
 const page=Catalog.discoverPostRoll({session,context,die});
 same(page.crtOutcome,outcome,`Expected CRT result ${outcome}`);
 const choices=ignored(page);
 if(expect){
  ok(choices.length>0,`${outcome} has source-validated Fleet ignore-retreat choices`);
  for(const option of choices){
   same(option.action.action.die,die,`${outcome} accepted choice retains committed die`);
   const ch=option.action.action.choices;
   ok(!('retreatPaths' in ch)&&!('advanceUnitId' in ch),`${outcome} ignore excludes retreat and advance`);
   if(outcome==='EX')ok(Array.isArray(ch.attackerLossIds)&&ch.attackerLossIds.length>0,
    'EX exemption preserves mandatory attacker casualties');
   if(outcome==='DRL'&&defenders.length===2)ok(defenders.some(u=>u.id===ch.defenderLossId),
    'Stacked DRL requires an explicit selected defender casualty');
   const direct=session.execute(option.action);
   same(direct.event.outcome,outcome,`${outcome} applies through source engine`);
   same(direct.event.ignoredRetreat,true,`${outcome} suppressed retreat`);
   same(direct.event.retreats,[],`${outcome} no retreat applied`);
   const remaining=defenders.filter(u=>direct.session.snapshot().state.units[u.id]);
   ok(remaining.length>0,`${outcome} has surviving Fleet-protected Soviet defender`);
   ok(remaining.every(u=>direct.session.snapshot().state.units[u.id].hex===riga),
    `${outcome} surviving Soviet defenders remain at Riga`);
   same(direct.session.undo().session.snapshot(),before,`${outcome} Undo restores source session`);
  }
  const h=Human.create({session,context}).roll(die);
  const shown=h.view(0);
  same(shown.die,die,'Human menu die remains committed');
  const pick=choices[0].action;
  ok(shown.options.some(x=>JSON.stringify(x)===JSON.stringify(pick)),
   `${outcome} Fleet exception visible as a human option`);
  same(Human.restore(h.save(),context).view(0),shown,
   `${outcome} Fleet choice survives human save/restore`);
  const after=h.choose(pick);
  same(after.snapshot().state.units,session.execute(pick).session.snapshot().state.units,
   `${outcome} human selection agrees with authoritative engine`);
  same(h.snapshot(),before,'Inspecting / choosing through new human session does not mutate the original');
 }else{
  same(choices,[],`${outcome} must not offer unauthorized ignore-retreat action`);
 }
 same(session.save(),saved,`${outcome} enumeration does not mutate source journal`);
 same(session.snapshot(),before,`${outcome} enumeration does not mutate source state`);
 return {page,choices};
}
// §13.2 includes both undamaged and damaged Fleet markers.
exercise({defenders:[army],die:1,outcome:'DR'});
exercise({defenders:[army],die:6,outcome:'DRL'});
exercise({defenders:[army],die:4,outcome:'EX'});
exercise({defenders:[army],die:3,outcome:'EX',condition:'damaged'});
// Stacked Soviet Corps can survive a mandatory DRL loss; the target must be selected.
const stacked=exercise({defenders:[corps[0],corps[1]],die:2,outcome:'DRL'});
ok(stacked.choices.some(c=>c.action.action.choices.defenderLossId===corps[0].id)&&
   stacked.choices.some(c=>c.action.action.choices.defenderLossId===corps[1].id),
 'Both printed Corps defender-loss selections are offered with Fleet protection');
// No photographed Fleet marker means no exemption; even a normal CRT result cannot forge one.
const noFleet=fixture([army],{marker:false});
const noFleetPage=Catalog.discoverPostRoll({session:noFleet.session,context:noFleet.context,die:3});
same(ignored(noFleetPage),[],'No Fleet: no ignore-retreat proposal');
rejects(()=>noFleet.session.execute({type:'combat',action:{type:'resolve-battle',die:3,
 choices:{defenderLossId:army.id,attackerLossIds:[attackers[2].id],ignoreRetreat:true}}}),
 /Fleet ignore-retreat/,'No Fleet: forged ignore-retreat is rejected');
// A one-step defender cannot ignore a retreat if the compulsory loss eliminates it.
const dead=fixture([corps[0]]);
const deadPage=Catalog.discoverPostRoll({session:dead.session,context:dead.context,die:2});
ok(!ignored(deadPage).length,'Eliminated Corps defender cannot claim Fleet-protected nonretreat');
console.log(`PASS v465: ${n} source-validated Fleet DR/DRL/EX consequence assertions`);
